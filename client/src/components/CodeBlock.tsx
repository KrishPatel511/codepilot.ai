import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FiCopy, FiCheck } from "react-icons/fi";

export function CodeBlock({ className, children }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");

  if (!match) {
    return <code className={className}>{children}</code>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{match[1]}</span>
        <button className="code-block-copy" onClick={handleCopy}>
          {copied ? <FiCheck /> : <FiCopy />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={match[1]}
        style={vscDarkPlus}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "12px 14px",
          background: "#1a1a1a",
          fontSize: "12.5px",
          borderRadius: 0,
          overflowX: "auto",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}
