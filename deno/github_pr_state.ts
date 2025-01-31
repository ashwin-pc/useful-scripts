import { config } from "https://deno.land/x/dotenv/mod.ts";

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

  const changesRequestedReviews = prData.reviews?.filter(
    (review: any) => review.state === "CHANGES_REQUESTED"
  );
  if (changesRequestedReviews && changesRequestedReviews.length > 0) {
    return "Changes_Requested";
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

  // Fetch reviews separately as they're not included in the PR data
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

  // Add reviews to the PR data
  prData.reviews = reviews;

  return prData;
}

function parsePRInput(input: string): {
  owner: string;
  repo: string;
  prNumber: number;
} {
  // Check if input is a URL
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

  // Check if input is just a number
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
  const input = prompt("Please enter the PR number or full GitHub PR URL:");

  if (!input) {
    console.error("No input provided. Exiting.");
    Deno.exit(1);
  }

  try {
    const { owner, repo, prNumber } = parsePRInput(input);
    const prData = await fetchPRDetails(owner, repo, prNumber);
    const state = determinePRState(prData);

    // console.log("PR Details:", JSON.stringify(prData, null, 2));
    console.log("\nDetermined State:", state);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
