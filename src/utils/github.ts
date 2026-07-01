/**
 * Minimal GitHub REST client for the opt-in integration.
 *
 * Everything here is only reached when the user has explicitly connected a
 * token (Settings → Integrations). No token, no calls. Calls go straight to
 * api.github.com (CORS-enabled), read-only.
 */

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export interface GitHubItem {
  number: number;
  title: string;
  url: string;
  author: string;
  updatedAt: string;
  isDraft?: boolean;
}

const API = 'https://api.github.com';

/** Parse an owner/repo from a github.com URL. Returns null for non-GitHub links. */
export function parseGitHubRepo(url: string | undefined | null): GitHubRepoRef | null {
  if (!url) return null;
  const cleaned = url.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  const match = cleaned.match(/^github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  return { owner, repo };
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function describeError(status: number): string {
  if (status === 401) return 'Invalid or expired token';
  if (status === 403) return 'Rate limited or insufficient scope';
  if (status === 404) return 'Repository not found (or token lacks access)';
  return `GitHub error ${status}`;
}

/** Validate a token by fetching the authenticated user. Throws on failure. */
export async function validateGitHubToken(token: string): Promise<{ login: string }> {
  const res = await fetch(`${API}/user`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(describeError(res.status));
  const data = await res.json();
  return { login: data.login };
}

/** Fetch open pull requests and issues for a repo. Throws on failure. */
export async function fetchRepoActivity(
  owner: string,
  repo: string,
  token: string,
): Promise<{ prs: GitHubItem[]; issues: GitHubItem[] }> {
  const [prRes, issueRes] = await Promise.all([
    fetch(`${API}/repos/${owner}/${repo}/pulls?state=open&per_page=10&sort=updated&direction=desc`, { headers: authHeaders(token) }),
    fetch(`${API}/repos/${owner}/${repo}/issues?state=open&per_page=20&sort=updated&direction=desc`, { headers: authHeaders(token) }),
  ]);
  if (!prRes.ok) throw new Error(describeError(prRes.status));
  if (!issueRes.ok) throw new Error(describeError(issueRes.status));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toItem = (x: any): GitHubItem => ({
    number: x.number,
    title: x.title,
    url: x.html_url,
    author: x.user?.login ?? '',
    updatedAt: x.updated_at,
    isDraft: x.draft,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prs: GitHubItem[] = (await prRes.json()).map(toItem);
  // The issues endpoint returns PRs too — filter them out by the pull_request marker.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues: GitHubItem[] = (await issueRes.json()).filter((i: any) => !i.pull_request).slice(0, 10).map(toItem);

  return { prs, issues };
}
