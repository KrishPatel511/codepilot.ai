import { RefObject, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FiCheck, FiCopy, FiRefreshCw, FiThumbsDown, FiThumbsUp } from "react-icons/fi";
import { ChatSession } from "../types";
import { CodeBlock } from "./CodeBlock";
import { InputPanel } from "./InputPanel";

type InputPanelForwardProps = Omit<React.ComponentProps<typeof InputPanel>, never>;

interface ChatWindowProps {
  clock: string;
  onOpenSidebar: () => void;
  activeChat: ChatSession;
  loading: boolean;
  chatScrollRef: RefObject<HTMLDivElement>;
  lastUserMsgRef: RefObject<HTMLDivElement>;
  inputPanelProps: InputPanelForwardProps;
  onRegenerate: () => void;
}

const THINKING_PHRASES = [
  "Thinking",
  "Looking through the repo",
  "Reasoning about your request",
  "Putting together a response",
];

function useThinkingPhrase(active: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => setIndex((i) => (i + 1) % THINKING_PHRASES.length), 2200);
    return () => clearInterval(id);
  }, [active]);
  return THINKING_PHRASES[index];
}

function MessageActions({
  text,
  showRegenerate,
  onRegenerate,
}: {
  text: string;
  showRegenerate: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="msg-actions">
      <button className="msg-action-btn" title="Copy" onClick={handleCopy}>
        {copied ? <FiCheck /> : <FiCopy />}
      </button>
      <button
        className={`msg-action-btn ${feedback === "up" ? "active" : ""}`}
        title="Good response"
        onClick={() => setFeedback((prev) => (prev === "up" ? null : "up"))}
      >
        <FiThumbsUp />
      </button>
      <button
        className={`msg-action-btn ${feedback === "down" ? "active" : ""}`}
        title="Bad response"
        onClick={() => setFeedback((prev) => (prev === "down" ? null : "down"))}
      >
        <FiThumbsDown />
      </button>
      {showRegenerate && (
        <button className="msg-action-btn" title="Regenerate response" onClick={onRegenerate}>
          <FiRefreshCw />
        </button>
      )}
    </div>
  );
}

export function ChatWindow({
  clock,
  onOpenSidebar,
  activeChat,
  loading,
  chatScrollRef,
  lastUserMsgRef,
  inputPanelProps,
  onRegenerate,
}: ChatWindowProps) {
  const isEmpty = activeChat.messages.length === 0;
  const lastUserMsgIndex = activeChat.messages.reduce(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1
  );
  const lastMessageIndex = activeChat.messages.length - 1;
  const thinkingPhrase = useThinkingPhrase(loading);

  return (
    <main className="main">
      <div className="topbar">
        <div className="topbar-left">
          <button className="mobile-menu-btn" onClick={onOpenSidebar}>
            ☰
          </button>
          <span className="status-dot"></span>
          <span className="topbar-title">CodePilot</span>
        </div>
        <div className="topbar-clock">{clock}</div>
      </div>

      <div className={`chat-scroll ${isEmpty ? "chat-scroll-empty" : ""}`} ref={chatScrollRef}>
        {isEmpty ? (
          <div className="landing">
            <p className="landing-heading">Ready when you are.</p>
            <InputPanel {...inputPanelProps} />
          </div>
        ) : (
          <div className="chat-inner">
            {activeChat.messages.map((m, i) => (
              <div
                key={i}
                ref={i === lastUserMsgIndex ? lastUserMsgRef : undefined}
                className={`msg-row ${m.role}`}
              >
                <div className="msg-col">
                  <div className="msg-bubble">
                    {m.role === "agent" ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          pre: ({ children }) => <>{children}</>,
                          code: CodeBlock,
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    ) : (
                      m.text
                    )}
                  </div>
                  <div className="msg-meta">{m.time}</div>
                  {m.role === "agent" && (
                    <MessageActions
                      text={m.text}
                      showRegenerate={i === lastMessageIndex && !loading}
                      onRegenerate={onRegenerate}
                    />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="typing-row">
                <span className="thinking-orb" />
                <span className="thinking-text">{thinkingPhrase}…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="input-area">
          <InputPanel {...inputPanelProps} />
        </div>
      )}
    </main>
  );
}
