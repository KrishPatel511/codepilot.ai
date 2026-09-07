import { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
}

export function ChatWindow({
  clock,
  onOpenSidebar,
  activeChat,
  loading,
  chatScrollRef,
  lastUserMsgRef,
  inputPanelProps,
}: ChatWindowProps) {
  const isEmpty = activeChat.messages.length === 0;
  const lastUserMsgIndex = activeChat.messages.reduce(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1
  );

  return (
    <main className="main">
      <div className="topbar">
        <div className="topbar-left">
          <button className="mobile-menu-btn" onClick={onOpenSidebar}>
            ☰
          </button>
          <span className="status-dot"></span> CodePilot
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{clock}</div>
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
                </div>
              </div>
            ))}

            {loading && (
              <div className="typing-row">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
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
