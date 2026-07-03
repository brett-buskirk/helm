import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Dark-theme styling for each rendered markdown element (no @tailwindcss/typography
// in this project, so we map elements explicitly).
const components: Components = {
  h1: ({ node: _n, ...p }) => <h1 className="mb-2 mt-4 text-lg font-bold text-slate-100 first:mt-0" {...p} />,
  h2: ({ node: _n, ...p }) => <h2 className="mb-2 mt-4 text-base font-semibold text-slate-100 first:mt-0" {...p} />,
  h3: ({ node: _n, ...p }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold text-slate-100 first:mt-0" {...p} />,
  p: ({ node: _n, ...p }) => <p className="mb-3 leading-relaxed text-slate-300" {...p} />,
  ul: ({ node: _n, ...p }) => <ul className="mb-3 ml-5 list-disc space-y-1 text-slate-300" {...p} />,
  ol: ({ node: _n, ...p }) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-slate-300" {...p} />,
  li: ({ node: _n, ...p }) => <li className="leading-relaxed" {...p} />,
  a: ({ node: _n, ...p }) => (
    <a className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" {...p} />
  ),
  strong: ({ node: _n, ...p }) => <strong className="font-semibold text-slate-100" {...p} />,
  em: ({ node: _n, ...p }) => <em className="italic" {...p} />,
  blockquote: ({ node: _n, ...p }) => (
    <blockquote className="mb-3 border-l-2 border-slate-600 pl-3 italic text-slate-400" {...p} />
  ),
  hr: () => <hr className="my-4 border-slate-700" />,
  code: ({ node: _n, className, ...p }) =>
    className ? (
      <code className="font-mono text-xs" {...p} />
    ) : (
      <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-indigo-300" {...p} />
    ),
  pre: ({ node: _n, ...p }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-800 p-3 font-mono text-xs text-slate-200" {...p} />
  ),
  table: ({ node: _n, ...p }) => <table className="mb-3 w-full border-collapse text-xs" {...p} />,
  th: ({ node: _n, ...p }) => (
    <th className="border border-slate-700 bg-slate-800 px-2 py-1 text-left font-semibold text-slate-200" {...p} />
  ),
  td: ({ node: _n, ...p }) => <td className="border border-slate-700 px-2 py-1 text-slate-300" {...p} />,
};

export function MarkdownPreview({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm italic text-slate-600">Nothing to preview yet.</p>;
  }
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
