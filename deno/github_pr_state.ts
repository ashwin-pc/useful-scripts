import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

// Load environment variables
config({ export: true });

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");

if (!GITHUB_TOKEN) {
  console.error("Please set the GITHUB_TOKEN environment variable.");
  Deno.exit(1);
}

function determinePRState(prData: any): string {
  if (prData.draft) {
    return "Draft";
  }

  if (prData.merged) {
    return "Merged";
  }

  if (prData.state === "closed") {
    return "Closed";
  }

  const approvedReviews = prData.reviews?.filter(
    (review: any) => review.state === "APPROVED"
  );
  if (approvedReviews && approvedReviews.length > 1) {
    return "Approved";
  }

  // Combine reviews, comments, and commits to determine the last activity
  let activities: { time: number; user: string }[] = [];
  if (prData.reviews && prData.reviews.length > 0) {
    activities = activities.concat(
      prData.reviews.map((r: any) => ({
        time: new Date(r.submitted_at).getTime(),
        user: r.user.login,
      }))
    );
  }
  if (prData.comments && prData.comments.length > 0) {
    activities = activities.concat(
      prData.comments.map((c: any) => ({
        time: new Date(c.created_at).getTime(),
        user: c.user.login,
      }))
    );
  }
  if (prData.commits && prData.commits.length > 0) {
    const commitActivities = prData.commits
      .map((commit: any) => {
        // Only include commit if authored by a GitHub user
        if (commit.author && commit.commit && commit.commit.committer) {
          return {
            time: new Date(commit.commit.committer.date).getTime(),
            user: commit.author.login,
          };
        }
        return null;
      })
      .filter((activity: any) => activity !== null);
    activities = activities.concat(commitActivities);
  }

  if (activities.length > 0) {
    activities.sort((a, b) => a.time - b.time);
    const lastActivity = activities[activities.length - 1];
    if (lastActivity.user === prData.user.login) {
      return "Review_Pending";
    } else {
      return "Changes_Requested";
    }
  }

  if (prData.assignees && prData.assignees.length > 0) {
    return "Review_Pending";
  }

  return "Unassigned";
}

async function fetchPRDetails(owner: string, repo: string, prNumber: number) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const prData = await response.json();

  // Fetch reviews
  const reviewsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
  const reviewsResponse = await fetch(reviewsUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!reviewsResponse.ok) {
    throw new Error(`HTTP error! status: ${reviewsResponse.status}`);
  }
  const reviews = await reviewsResponse.json();
  prData.reviews = reviews;

  // Fetch issue comments (PR comments)
  const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const commentsResponse = await fetch(commentsUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!commentsResponse.ok) {
    throw new Error(`HTTP error! status: ${commentsResponse.status}`);
  }
  const comments = await commentsResponse.json();
  prData.comments = comments;

  // Fetch commits
  const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`;
  const commitsResponse = await fetch(commitsUrl, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!commitsResponse.ok) {
    throw new Error(`HTTP error! status: ${commitsResponse.status}`);
  }
  const commits = await commitsResponse.json();
  prData.commits = commits;

  return prData;
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
    const state = determinePRState(prData);

    console.log("\nDetermined State:", state);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Unknown error:", error);
    }
  }
}

main();
