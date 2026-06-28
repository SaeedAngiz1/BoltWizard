/**
 * Markdown renderer.
 *
 * Wraps react-markdown with GFM + syntax highlighting. Links open in a new
 * tab; fenced code blocks get a small language-label header bar. Token colors
 * come from the `.hljs` theme already defined in styles.css.
 */
import { useState, type ReactNode } from 'react';
import MarkdownReact from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';

type MarkdownProps = {
  children: string;
};

/** Fenced-code component: renders a header bar (language + copy) + <pre>. */
function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  // react-markdown passes the language as `language-xxx` on the <code> className.
  const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? 'text';
  const code = typeof children === 'string' ? children : String(children ?? '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span className="code-block__lang mono">{lang}</span>
        <button
          type="button"
          className="code-block__copy icon-btn btn--sm"
          onClick={copy}
          aria-label="Copy code"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export default function Markdown({ children }: MarkdownProps) {
  return (
    <div className="markdown">
      <MarkdownReact
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" />
          ),
          // Inline code vs block: react-markdown v10 renders fenced blocks as
          // <pre><code class="language-x">...</code></pre>; inline code has no
          // language class and no <pre> parent, so we wrap blocks via `pre`.
          pre: ({ children }) => <>{children}</>,
          code: (props) => {
            const { className, children, ...rest } = props as {
              className?: string;
              children?: ReactNode;
            };
            // Block code carries a language-* class (or multi-line content).
            const isBlock = !!className?.includes('language-') || /\n/.test(String(children ?? ''));
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </MarkdownReact>
    </div>
  );
}
