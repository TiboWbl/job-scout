// Starts the collection workflow on GitHub Actions (free for a public repository), as the schedule
// would: every career page and search engine read with the new searches, then everything sorted.
// Needs GITHUB_DISPATCH_TOKEN, a fine-grained token limited to this repository with "Actions: write".
const REPO = process.env.GITHUB_REPOSITORY ?? "TiboWbl/job-scout";

export function isDispatchConfigured() {
  return Boolean(process.env.GITHUB_DISPATCH_TOKEN);
}

export async function requestCollection(): Promise<boolean> {
  if (!isDispatchConfigured()) return false;
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/collect.yml/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main" }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  // 204: queued. A run already waiting absorbs this one (the workflow allows one at a time).
  return res?.status === 204;
}
