import { useState, useEffect } from 'react';
import { GitPullRequest, CircleDot, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fetchRepoActivity, type GitHubItem } from '../../utils/github';

interface Props {
  owner: string;
  repo: string;
  token: string;
}

/**
 * Live open PRs + issues for a repo. Only rendered when GitHub is connected and
 * a project link points at a github.com repo. Fetches on mount; read-only.
 */
export function GitHubActivity({ owner, repo, token }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prs, setPrs] = useState<GitHubItem[]>([]);
  const [issues, setIssues] = useState<GitHubItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRepoActivity(owner, repo, token)
      .then((data) => {
        if (cancelled) return;
        setPrs(data.prs);
        setIssues(data.issues);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, repo, token]);

  const prsUrl = `https://github.com/${owner}/${repo}/pulls`;
  const issuesUrl = `https://github.com/${owner}/${repo}/issues`;

  return (
    <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <GitPullRequest size={11} /> GitHub · {owner}/{repo}
      </p>

      {loading ? (
        <p className="flex items-center gap-2 py-2 text-xs text-slate-500">
          <Loader2 size={13} className="animate-spin" /> Loading activity…
        </p>
      ) : error ? (
        <p className="flex items-center gap-2 py-1 text-xs text-red-400">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </p>
      ) : prs.length === 0 && issues.length === 0 ? (
        <p className="flex items-center gap-2 py-1 text-xs text-slate-500">
          <CheckCircle2 size={13} className="shrink-0 text-emerald-500" /> No open PRs or issues.
        </p>
      ) : (
        <div className="space-y-3">
          {prs.length > 0 && (
            <ItemList
              icon={GitPullRequest}
              iconClass="text-emerald-400"
              heading={`${prs.length} open pull request${prs.length === 1 ? '' : 's'}`}
              items={prs}
              viewAllUrl={prsUrl}
            />
          )}
          {issues.length > 0 && (
            <ItemList
              icon={CircleDot}
              iconClass="text-amber-400"
              heading={`${issues.length} open issue${issues.length === 1 ? '' : 's'}`}
              items={issues}
              viewAllUrl={issuesUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ItemList({
  icon: Icon,
  iconClass,
  heading,
  items,
  viewAllUrl,
}: {
  icon: React.ElementType;
  iconClass: string;
  heading: string;
  items: GitHubItem[];
  viewAllUrl?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
          <Icon size={12} className={iconClass} /> {heading}
        </p>
        {viewAllUrl && (
          <a
            href={viewAllUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View all ↗
          </a>
        )}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.number}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-800"
            >
              <span className="shrink-0 font-mono text-slate-600">#{item.number}</span>
              <span className="min-w-0 flex-1 truncate text-slate-300">
                {item.title}
                {item.isDraft && <span className="ml-1.5 text-[10px] text-slate-500">Draft</span>}
              </span>
              {item.author && <span className="shrink-0 text-slate-600">@{item.author}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
