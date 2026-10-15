// Starts the collection workflow on GitHub Actions (free for a public repository), as the schedule
// would: every career page and search engine read with the new searches, then everything sorted.
// Needs GITHUB_DISPATCH_TOKEN, a fine-grained token limited to this repository with "Actions: write".
// On Vercel, the repository the site is deployed from (its system variables follow a rename).
const REPO =
  process.env.GITHUB_REPOSITORY ??
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : "TiboWbl/scout");

export function isDispatchConfigured() {
  return Boolean(process.env.GITHUB_DISPATCH_TOKEN);
}

// The run under way or waiting, if any: when it was started. The repository is public, the token only
// lifts the rate limit.
export async function collectionUnderWay(): Promise<string | null> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (process.env.GITHUB_DISPATCH_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`;
  for (const status of ["in_progress", "queued"]) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/collect.yml/runs?status=${status}&per_page=1`, { headers, signal: AbortSignal.timeout(8_000) }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { workflow_runs?: { created_at: string }[] }) : null;
    if (data?.workflow_runs?.[0]) return data.workflow_runs[0].created_at;
  }
  return null;
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
