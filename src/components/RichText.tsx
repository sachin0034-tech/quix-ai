import type { ReactNode } from "react";

/**
 * Question and option text: keeps line breaks, shows ``` fences as code blocks and `inline` code as code.
 * `links` turns web addresses into links that open in a new tab (explanations; never inside an option button).
 */
export default function RichText({ text, links = false }: { text: string; links?: boolean }) {
  const parts = text.split(/```[a-z]*\n?([\s\S]*?)```/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} style={{ margin: "12px 0", padding: "12px 14px", background: "var(--canvas)", border: "1px solid var(--border)", borderRadius: "8px", overflowX: "auto", fontSize: "13px", lineHeight: 1.55, fontWeight: 400, whiteSpace: "pre" }}>
            <code>{part.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>{inline(part, links)}</span>
        )
      )}
    </>
  );
}

function inline(text: string, links: boolean): ReactNode[] {
  return text.split(/(`[^`\n]+`)/).map((seg, i) =>
    seg.length > 2 && seg.startsWith("`") && seg.endsWith("`") ? (
      <code key={i} style={{ fontSize: "0.92em", padding: "1px 5px", borderRadius: "4px", background: "rgba(15,27,51,.07)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{seg.slice(1, -1)}</code>
    ) : links ? (
      <span key={i}>{linked(seg)}</span>
    ) : (
      seg
    )
  );
}

/** Web addresses in plain text as links; punctuation that ends the sentence stays outside the link */
function linked(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>"]+)/).map((seg, i) => {
    if (i % 2 === 0) return seg;
    const url = seg.replace(/[.,;:!?)\]'"]+$/, "");
    return (
      <span key={i}>
        <a className="rich-link" href={url} target="_blank" rel="noopener noreferrer">
          {url}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {seg.slice(url.length)}
      </span>
    );
  });
}
