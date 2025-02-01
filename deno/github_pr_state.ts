import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

// Load environment variables
config({ export: true });

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

if (!GITHUB_TOKEN) {
  console.error("Please set the GITHUB_TOKEN environment variable.");
  Deno.exit(1);
}

// Add a list of bot logins to filter out
const BOT_LOGINS = [
  "codecov",
  "dependabot",
  "github-actions",
  "opensearch-changeset-bot[bot]",
  "github-actions[bot]",
]; // add bot logins as needed

// Updated determinePRState to include granular reasons based on activity type.
function determinePRState(pr: any): { state: string; reason: string } {
  if (pr.isDraft)
    return { state: "Draft", reason: "The PR is marked as draft." };
  if (pr.merged) return { state: "Merged", reason: "The PR has been merged." };
  if (pr.state === "CLOSED")
    return { state: "Closed", reason: "The PR is closed." };

  const approvedReviews = pr.reviews.nodes.filter(
    (r: any) => r.state === "APPROVED"
  );
  if (approvedReviews && approvedReviews.length > 1)
    return {
      state: "Approved",
      reason: "There are multiple approved reviews indicating readiness.",
    };

  // Build activities without fetching body; for comments, check if the author is a bot.
  let activities: { time: number; user: string; type: string }[] = [];
  if (pr.reviews.nodes.length > 0) {
    activities = activities.concat(
      pr.reviews.nodes.map((r: any) => ({
        time: new Date(r.submittedAt).getTime(),
        user: r.author.login,
        type: "review",
      }))
    );
  }
  if (pr.comments.nodes.length > 0) {
    activities = activities.concat(
      pr.comments.nodes.map((c: any) => ({
        time: new Date(c.createdAt).getTime(),
        user: c.author.login,
        type: "comment",
      }))
    );
  }
  if (pr.commits.nodes.length > 0) {
    const commitActivities = pr.commits.nodes
      .map((node: any) => {
        const commit = node.commit;
        if (commit.author && commit.committer && commit.author.user) {
          return {
            time: new Date(commit.committer.date).getTime(),
            user: commit.author.user.login,
            type: "commit",
          };
        }
        return null;
      })
      .filter((activity: any) => activity !== null);
    activities = activities.concat(commitActivities);
  }

  if (activities.length > 0) {
    // Sort by time ascending.
    activities.sort((a, b) => a.time - b.time);
    // Iterate backward to find the last valid activity not from a bot.
    let lastActivity: (typeof activities)[number] | undefined = undefined;
    for (let i = activities.length - 1; i >= 0; i--) {
      const act = activities[i];
      // Skip any activity if the author is from a known bot.
      if (
        BOT_LOGINS.some((bot) => bot.toLowerCase() === act.user.toLowerCase())
      ) {
        continue;
      }
      lastActivity = act;
      break;
    }
    // If no non-bot activity was found...
    if (!lastActivity) {
      if (pr.assignees.nodes.length > 0) {
        return {
          state: "Review_Pending",
          reason:
            "All activities were performed by bots, but assignees exist so review is pending.",
        };
      } else {
        return {
          state: "Unassigned",
          reason:
            "All activities were performed by bots and no assignees are present, so the PR is unassigned.",
        };
      }
    }

    if (lastActivity.user === pr.author.login) {
      return {
        state: "Review_Pending",
        reason: `The last ${lastActivity.type} was by the PR author (${lastActivity.user}); awaiting external review.`,
      };
    } else {
      if (lastActivity.type === "review") {
        const lastReview = pr.reviews.nodes.find(
          (review: any) =>
            review.author.login === lastActivity.user &&
            new Date(review.submittedAt).getTime() === lastActivity.time
        );
        if (lastReview && lastReview.state === "APPROVED") {
          return {
            state: "Review_Pending",
            reason: `The last review was an approval by ${lastActivity.user}; awaiting additional review.`,
          };
        } else {
          return {
            state: "Changes_Requested",
            reason: `The last review by ${lastActivity.user} did not approve changes and is treated as a changes request.`,
          };
        }
      } else {
        return {
          state: "Changes_Requested",
          reason: `The last ${lastActivity.type} was by reviewer (${lastActivity.user}); changes have been requested.`,
        };
      }
    }
  }
  if (pr.assignees.nodes.length > 0)
    return {
      state: "Review_Pending",
      reason:
        "Assignees are set on the PR which indicates that review is pending.",
    };

  return {
    state: "Unassigned",
    reason: "No activity, approvals, or assignees were found on the PR.",
  };
}

async function fetchPRDetails(owner: string, repo: string, prNumber: number) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          isDraft
          merged
          state
          author { login }
          reviews(last: 100) { nodes { state submittedAt author { login } } }
          comments(last: 100) { nodes { createdAt author { login } } }
          commits(last: 100) { nodes { commit { committer { date } author { user { login } } } } }
          assignees(last: 10) { nodes { login } }
        }
      }
    }
  `;
  const variables = { owner, repo, number: prNumber };

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL error: ${response.status}`);
  }
  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  // Return the pullRequest field directly for convenience.
  return json.data.repository.pullRequest;
}

function parsePRInput(input: string): {
  owner: string;
  repo: string;
  prNumber: number;
} {
  if (input.startsWith("http")) {
    const url = new URL(input);
    const parts = url.pathname.split("/");
    if (parts.length >= 5 && parts[3] === "pull") {
      return {
        owner: parts[1],
        repo: parts[2],
        prNumber: parseInt(parts[4]),
      };
    }
  }

  if (/^\d+$/.test(input)) {
    return {
      owner: "opensearch-project",
      repo: "OpenSearch-Dashboards",
      prNumber: parseInt(input),
    };
  }

  throw new Error(
    "Invalid input. Please provide either a PR number or a full GitHub PR URL."
  );
}

async function main() {
  let input;
  if (Deno.args.length > 0) {
    input = Deno.args[0];
  } else {
    input = prompt("Please enter the PR number or full GitHub PR URL:");
  }

  if (!input) {
    console.error("No input provided. Exiting.");
    Deno.exit(1);
  }

  try {
    const { owner, repo, prNumber } = parsePRInput(input);
    const prData = await fetchPRDetails(owner, repo, prNumber);
    const result = determinePRState(prData);

    console.log(`\nDetermined State: ${result.state}`);
    console.log(`Reason: ${result.reason}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

main();
