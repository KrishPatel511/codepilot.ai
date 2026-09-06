import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FiPlus, FiCpu, FiMic, FiArrowUp,  FiPaperclip,
  FiFolder,
  FiGitBranch,
  FiSearch,
  FiSidebar,
  FiEdit,
  FiBookmark,
  FiMessageSquare,
  FiCopy,
  FiCheck,
  FiMoreHorizontal,
  FiEdit2,
  FiTrash2,
  FiX,
  FiGithub } from "react-icons/fi";

import {
  HiChevronRight,
  HiOutlineSparkles,
  HiOutlineUserCircle,
  HiOutlineUser,
  HiOutlineCog6Tooth,
  HiOutlineQuestionMarkCircle,
  HiOutlineArrowRightOnRectangle,
} from "react-icons/hi2";

const SERVER_BASE = "http://localhost:5001";
const API_BASE = `${SERVER_BASE}/api`;

interface CurrentUser {
  id: number;
  username: string;
  avatarUrl: string | null;
}

interface Message {
  role: "user" | "agent";
  text: string;
  time: string;
}

interface ChatSession {
  id: number | null;
  title: string;
  pinned: boolean;
  messages: Message[];
}

interface Repo {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  private: boolean;
}

interface UsageData {
  lastModelUsed: string | null;
  today: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    assumedDailyLimit: number;
    percentUsed: number;
  };
  perModelToday: { model: string; requests: number; totalTokens: number }[];
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Wraps fetch() and automatically attaches the logged-in user's token,
// so every API call is scoped to them without repeating this everywhere.
function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("authToken");
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function initialsFrom(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function CodeBlock({ className, children }: any) {
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

function emptyDraft(): ChatSession {
  return { id: null, title: "New chat", pinned: false, messages: [] };
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/logo-icon.png" alt="" className="login-logo" />
        <h1 className="login-title">CodePilot</h1>
        <p className="login-subtitle">
          Your AI coding agent for GitHub — sign in to let it read and analyze your own repositories.
        </p>
        <button className="login-github-btn" onClick={onLogin}>
          <FiGithub /> Login with GitHub
        </button>
        <p className="login-hint">
          We only ever access repos on your behalf, using your own GitHub permissions.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("authToken"));
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [draftChat, setDraftChat] = useState<ChatSession>(emptyDraft());
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem("sidebarCollapsed") === "true"
  );
  const [clock, setClock] = useState(nowTime());

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [thinkMode, setThinkMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [chatMenuOpenId, setChatMenuOpenId] = useState<number | null>(null);
  const [chatMenuPos, setChatMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(
    null
  );
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat =
    activeChatId === null ? draftChat : chats.find((c) => c.id === activeChatId) ?? draftChat;

  const lastUserMsgIndex = activeChat.messages.reduce(
    (acc, m, i) => (m.role === "user" ? i : acc),
    -1
  );

  // Live clock in topbar
  useEffect(() => {
    const interval = setInterval(() => setClock(nowTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  // If GitHub just redirected back here with ?token=..., capture it and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      localStorage.setItem("authToken", urlToken);
      setAuthToken(urlToken);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Verify the token (if any) against the backend and load the logged-in user's profile.
  useEffect(() => {
    if (!authToken) {
      setCurrentUser(null);
      setAuthChecked(true);
      return;
    }
    fetch(`${SERVER_BASE}/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid or expired session");
        return res.json();
      })
      .then((data: CurrentUser) => setCurrentUser(data))
      .catch(() => {
        localStorage.removeItem("authToken");
        setAuthToken(null);
        setCurrentUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, [authToken]);

  const handleLogin = () => {
    window.location.href = `${SERVER_BASE}/auth/github`;
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthToken(null);
    setCurrentUser(null);
    setChats([]);
    setDraftChat(emptyDraft());
    setActiveChatId(null);
    setProfileMenuOpen(false);
  };

  // Load the sidebar's chat list once we know who's logged in.
  useEffect(() => {
    if (!currentUser) return;
    apiFetch("/chats")
      .then((res) => res.json())
      .then((data: { id: number; title: string; pinned: number }[]) => {
        setChats(data.map((c) => ({ id: c.id, title: c.title, pinned: !!c.pinned, messages: [] })));
      })
      .catch((err) => console.error("Failed to load chats", err));
  }, [currentUser]);

  // Pin the latest question to the top of the view (like ChatGPT/Claude)
  // instead of jumping to the bottom of a long answer.
  useEffect(() => {
    lastUserMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeChat?.messages.length]);

  // Close the chat item's "..." menu when clicking anywhere outside it.
  useEffect(() => {
    if (chatMenuOpenId === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".chat-item-actions") && !target.closest(".chat-item-menu-portal")) {
        setChatMenuOpenId(null);
        setChatMenuPos(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [chatMenuOpenId]);

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  // Below the mobile breakpoint the sidebar is an overlay drawer (fully open/closed);
  // above it, this button collapses it to an icon rail instead.
  const handleSidebarToggle = () => {
    if (window.innerWidth <= 820) {
      setSidebarOpen(false);
    } else {
      setCollapsed((prev) => !prev);
    }
  };

  const handleNewChat = () => {
    setDraftChat(emptyDraft());
    setActiveChatId(null);
    setSidebarOpen(false);
  };

  const handleSwitchChat = async (id: number) => {
    setActiveChatId(id);
    setSidebarOpen(false);

    const existing = chats.find((c) => c.id === id);
    if (existing && existing.messages.length > 0) return;

    try {
      const res = await apiFetch(`/chats/${id}`);
      const data = await res.json();
      const messages: Message[] = (data.messages || []).map((m: any) => ({
        role: m.role,
        text: m.text,
        time: new Date(m.created_at.replace(" ", "T") + "Z").toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, messages } : c)));
    } catch (err) {
      console.error("Failed to load chat messages", err);
    }
  };

  const handleTogglePin = async (id: number, pinned: boolean) => {
    setChatMenuOpenId(null);
    setChatMenuPos(null);
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned } : c)));
    try {
      await apiFetch(`/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });
    } catch (err) {
      console.error("Failed to update pin state", err);
    }
  };

  const handleStartRename = (id: number, currentTitle: string) => {
    setChatMenuOpenId(null);
    setChatMenuPos(null);
    setRenamingChatId(id);
    setRenameValue(currentTitle);
  };

  const handleConfirmRename = async (id: number) => {
    const title = renameValue.trim();
    setRenamingChatId(null);
    if (!title) return;

    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await apiFetch(`/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch (err) {
      console.error("Failed to rename chat", err);
    }
  };

  const handleDeleteChat = async (id: number) => {
    setChatMenuOpenId(null);
    setChatMenuPos(null);
    if (!window.confirm("Delete this chat? This can't be undone.")) return;

    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setDraftChat(emptyDraft());
      setActiveChatId(null);
    }
    try {
      await apiFetch(`/chats/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const fetchRepos = async () => {
    setReposLoading(true);
    try {
      const res = await apiFetch("/github/repos");
      const data = await res.json();
      setRepos(Array.isArray(data) ? data : []);
      setReposLoaded(true);
    } catch (err) {
      console.error("Failed to fetch repos", err);
    } finally {
      setReposLoading(false);
    }
  };

  const handleOpenSettings = () => {
    setProfileMenuOpen(false);
    setSettingsOpen(true);
    setUsageLoading(true);
    apiFetch("/usage")
      .then((res) => res.json())
      .then((data: UsageData) => setUsageData(data))
      .catch((err) => console.error("Failed to load usage", err))
      .finally(() => setUsageLoading(false));
  };

  const handleRepoClick = (repo: Repo) => {
    setInput(`Tell me about the ${repo.name} repository and show its folder structure.`);
    textareaRef.current?.focus();
    setSidebarOpen(false);
  };

  const promptForRepo = () => {
    const suggestion = repos[0]?.fullName || "";
    return window.prompt("Which repo? (e.g. owner/repo)", suggestion)?.trim() || null;
  };

  const handleBrowseRepository = () => {
    setPlusMenuOpen(false);
    const repo = promptForRepo();
    if (!repo) return;
    setInput(`Show me the files in the root of ${repo}`);
    textareaRef.current?.focus();
  };

  const handleExploreFolderTree = () => {
    setPlusMenuOpen(false);
    const repo = promptForRepo();
    if (!repo) return;
    setInput(`Show me the complete folder structure of ${repo}, including all nested folders`);
    textareaRef.current?.focus();
  };

  const handleSearchCode = () => {
    setPlusMenuOpen(false);
    const repo = promptForRepo();
    if (!repo) return;
    const query = window.prompt(`Search for what, inside ${repo}?`)?.trim();
    if (!query) return;
    setInput(`Search for "${query}" in ${repo}`);
    textareaRef.current?.focus();
  };

  const handleManageGithubConnection = () => {
    setPlusMenuOpen(false);
    window.open("https://github.com/settings/connections", "_blank", "noopener,noreferrer");
  };

  const handleToggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const autoGrow = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const messageText = input;
    const userMessage: Message = { role: "user", text: messageText, time: nowTime() };
    const isNewChat = activeChatId === null;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    if (isNewChat) {
      setDraftChat((prev) => ({ ...prev, messages: [...prev.messages, userMessage] }));
    } else {
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, userMessage] } : c))
      );
    }

    let chatId = activeChatId;

    try {
      if (isNewChat) {
        const createRes = await apiFetch("/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: messageText.slice(0, 40) }),
        });
        const newChat = await createRes.json();
        chatId = newChat.id;
        setChats((prev) => [
          { id: newChat.id, title: newChat.title, pinned: false, messages: [userMessage] },
          ...prev,
        ]);
        setDraftChat(emptyDraft());
        setActiveChatId(newChat.id);
      }

      const res = await apiFetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: messageText, thinkMode }),
      });
      const data = await res.json();
      const agentMessage: Message = {
        role: "agent",
        text: data.reply || data.error || "No response.",
        time: nowTime(),
      };
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, agentMessage] } : c))
      );
    } catch (err) {
      const errMessage: Message = {
        role: "agent",
        text: "⚠️ Could not reach the server. Is it running on port 5001?",
        time: nowTime(),
      };
      if (chatId === null) {
        setDraftChat((prev) => ({ ...prev, messages: [...prev.messages, errMessage] }));
      } else {
        setChats((prev) =>
          prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, errMessage] } : c))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = activeChat.messages.length === 0;

  const renderChatItem = (c: ChatSession) => (
    <div key={c.id} className={`chat-item ${c.id === activeChatId ? "active" : ""}`}>
      {renamingChatId === c.id ? (
        <input
          className="chat-item-rename-input"
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && c.id !== null) handleConfirmRename(c.id);
            if (e.key === "Escape") setRenamingChatId(null);
          }}
          onBlur={() => c.id !== null && handleConfirmRename(c.id)}
        />
      ) : (
        <button
          className="history-item chat-item-title-btn"
          onClick={() => c.id !== null && handleSwitchChat(c.id)}
        >
          <FiMessageSquare className="item-icon" />
          <span className="chat-item-title">{c.title}</span>
        </button>
      )}

      {renamingChatId !== c.id && (
        <div className="chat-item-actions">
          <button
            className="chat-item-action-btn"
            title={c.pinned ? "Unpin" : "Pin"}
            onClick={(e) => {
              e.stopPropagation();
              if (c.id !== null) handleTogglePin(c.id, !c.pinned);
            }}
          >
            <FiBookmark className={c.pinned ? "pinned" : ""} />
          </button>
          <button
            className="chat-item-action-btn"
            title="More"
            onClick={(e) => {
              e.stopPropagation();
              if (chatMenuOpenId === c.id) {
                setChatMenuOpenId(null);
                setChatMenuPos(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const menuWidth = 190;
              const menuHeightEstimate = 160;
              const openUp = window.innerHeight - rect.bottom < menuHeightEstimate;
              const left = Math.min(
                Math.max(8, rect.right - menuWidth),
                window.innerWidth - menuWidth - 8
              );
              setChatMenuPos(
                openUp ? { bottom: window.innerHeight - rect.top + 4, left } : { top: rect.bottom + 4, left }
              );
              setChatMenuOpenId(c.id);
            }}
          >
            <FiMoreHorizontal />
          </button>

          {chatMenuOpenId === c.id &&
            chatMenuPos &&
            createPortal(
              <div
                className="chat-item-menu chat-item-menu-portal"
                style={{ top: chatMenuPos.top, bottom: chatMenuPos.bottom, left: chatMenuPos.left }}
              >
                <button onClick={() => c.id !== null && handleStartRename(c.id, c.title)}>
                  <FiEdit2 /> Rename
                </button>
                <button onClick={() => c.id !== null && handleTogglePin(c.id, !c.pinned)}>
                  <FiBookmark /> {c.pinned ? "Unpin chat" : "Pin chat"}
                </button>
                <div className="chat-item-menu-divider" />
                <button
                  className="chat-item-menu-danger"
                  onClick={() => c.id !== null && handleDeleteChat(c.id)}
                >
                  <FiTrash2 /> Delete
                </button>
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );

  const inputPanel = (
    <div className="input-inner">
      <div className="input-box-wrapper">
        {plusMenuOpen && (
          <div className="plus-menu">
            <button className="plus-menu-item" disabled title="Coming soon — not implemented yet">
              <FiPaperclip className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Add photos & files</p>
                <p className="plus-menu-subtitle">Upload from computer</p>
              </div>
            </button>
            <button className="plus-menu-item" onClick={handleBrowseRepository}>
              <FiFolder className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Browse repository</p>
                <p className="plus-menu-subtitle">Pick a file from GitHub</p>
              </div>
            </button>
            <button className="plus-menu-item" onClick={handleExploreFolderTree}>
              <FiGitBranch className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Explore folder tree</p>
                <p className="plus-menu-subtitle">View full repo structure</p>
              </div>
            </button>
            <button className="plus-menu-item" onClick={handleSearchCode}>
              <FiSearch className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Search code</p>
                <p className="plus-menu-subtitle">Find something in a repo</p>
              </div>
            </button>
            <div className="plus-menu-divider" />
            <button className="plus-menu-item" onClick={handleManageGithubConnection}>
              <FiGithub className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">GitHub</p>
                <p className="plus-menu-subtitle">Manage connection</p>
              </div>
              <span className="plus-menu-connect">Connected</span>
            </button>
            <p className="plus-menu-hint">Type to search files, repos & tools</p>
          </div>
        )}

        <div className="input-box">
          <button className="plus-btn" onClick={() => setPlusMenuOpen((prev) => !prev)}>
            <FiPlus />
          </button>

          <textarea
            ref={textareaRef}
            placeholder="Message CodePilot..."
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow();
            }}
            onKeyDown={handleKeyDown}
          />

          <div className="input-actions-right">
            <button
              className={`think-btn ${thinkMode ? "active" : ""}`}
              onClick={() => setThinkMode((prev) => !prev)}
            >
              <FiCpu />
              Think
            </button>
            <button
              className={`icon-only-btn ${isRecording ? "recording" : ""}`}
              onClick={handleToggleMic}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              <FiMic />
            </button>
            <button className="send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
              <FiArrowUp />
            </button>
          </div>
        </div>
      </div>
      <div className="input-hint">Connected to your local backend at localhost:5001</div>
    </div>
  );

  if (!authChecked) {
    return <div className="auth-loading" />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          {!collapsed && (
            <div className="brand">
              <div className="brand-icon">
                <img src="/logo-icon.png" alt="" className="brand-logo-img" />
              </div>
              CodePilot
            </div>
          )}
          <button
            className="icon-btn sidebar-toggle-btn"
            onClick={handleSidebarToggle}
            data-tooltip={collapsed ? "Open sidebar" : "Close sidebar"}
            title={collapsed ? "Open sidebar" : "Close sidebar"}
          >
            <span className="toggle-icon-stack">
              <span className="toggle-icon toggle-icon-brand">
                <img src="/logo-icon.png" alt="" className="brand-logo-img" />
              </span>
              <span className="toggle-icon toggle-icon-panel">
                <FiSidebar />
              </span>
            </span>
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat} data-tooltip="New chat" title="New chat">
          <FiEdit />
          <span className="label">New chat</span>
        </button>

        {collapsed && (
          <div className="rail-icons">
            <button
              className="icon-btn rail-icon-btn"
              onClick={() => setCollapsed(false)}
              data-tooltip="Search"
              title="Search"
            >
              <FiSearch />
            </button>
            <button
              className="icon-btn rail-icon-btn"
              onClick={() => setCollapsed(false)}
              data-tooltip="Pinned"
              title="Pinned"
            >
              <FiBookmark />
            </button>
            <button
              className="icon-btn rail-icon-btn"
              onClick={() => setCollapsed(false)}
              data-tooltip="Chats"
              title="Chats"
            >
              <FiMessageSquare />
            </button>
          </div>
        )}

        <div className="sidebar-scroll">
          <div className="sidebar-section-label">
            <span>Your repositories</span>
            <button className="fetch-link" onClick={fetchRepos} disabled={reposLoading}>
              {reposLoading ? "Loading..." : reposLoaded ? "Refresh" : "Fetch"}
            </button>
          </div>

          {!reposLoaded && !reposLoading && (
            <p className="sidebar-empty-hint">Click "Fetch" to load your GitHub repos.</p>
          )}
          {reposLoaded &&
            repos.map((r) => (
              <button key={r.fullName} className="repo-item" onClick={() => handleRepoClick(r)}>
                <FiFolder className="item-icon" /> {r.name}
              </button>
            ))}

          {chats.some((c) => c.pinned) && (
            <>
              <div className="sidebar-section-label">
                <span>Pinned</span>
              </div>
              {chats.filter((c) => c.pinned).map(renderChatItem)}
            </>
          )}

          <div className="sidebar-section-label">
            <span>Recent chats</span>
          </div>
          {chats.filter((c) => !c.pinned).map(renderChatItem)}
        </div>

        <div className="sidebar-footer-wrapper">
                   {profileMenuOpen && (
            <div className="profile-menu">
              <button className="profile-menu-header">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="avatar" />
                ) : (
                  <div className="avatar">{initialsFrom(currentUser.username)}</div>
                )}
                <div className="profile-menu-header-text">
                  <p className="profile-menu-name">{currentUser.username}</p>
                  <p className="profile-menu-plan">GitHub connected</p>
                </div>
                <HiChevronRight className="profile-menu-chevron" />
              </button>

              <div className="profile-menu-divider" />

              <button className="profile-menu-item" disabled title="Coming soon — not implemented yet">
                <HiOutlineSparkles className="profile-menu-icon" />
                Upgrade plan
              </button>
              <button className="profile-menu-item" disabled title="Coming soon — not implemented yet">
                <HiOutlineUserCircle className="profile-menu-icon" />
                Personalization
              </button>
              <button className="profile-menu-item" disabled title="Coming soon — not implemented yet">
                <HiOutlineUser className="profile-menu-icon" />
                Profile
              </button>
              <button className="profile-menu-item" onClick={handleOpenSettings}>
                <HiOutlineCog6Tooth className="profile-menu-icon" />
                Settings
              </button>

              <div className="profile-menu-divider" />

              <button className="profile-menu-item" disabled title="Coming soon — not implemented yet">
                <HiOutlineQuestionMarkCircle className="profile-menu-icon" />
                Help
                <HiChevronRight className="profile-menu-chevron-right" />
              </button>
              <button className="profile-menu-item" onClick={handleLogout}>
                <HiOutlineArrowRightOnRectangle className="profile-menu-icon" />
                Log out
              </button>
            </div>
          )}
                    <div className="sidebar-footer-row">
            <button
              className="sidebar-footer"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              data-tooltip={currentUser.username}
            >
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" className="avatar" />
              ) : (
                <div className="avatar">{initialsFrom(currentUser.username)}</div>
              )}
              <div className="sidebar-footer-text">
                <p className="sidebar-footer-name">{currentUser.username}</p>
                <p className="sidebar-footer-plan">GitHub connected</p>
              </div>
            </button>
            <button className="grid-icon-btn" title="Apps">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
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
              {inputPanel}
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

        {!isEmpty && <div className="input-area">{inputPanel}</div>}
      </main>

      {settingsOpen &&
        createPortal(
          <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-header">
                <h2>Settings</h2>
                <button className="settings-close-btn" onClick={() => setSettingsOpen(false)}>
                  <FiX />
                </button>
              </div>

              <div className="settings-section">
                <h3>Model &amp; Usage</h3>

                {usageLoading ? (
                  <p className="settings-hint">Loading usage...</p>
                ) : usageData ? (
                  <>
                    <div className="usage-row">
                      <span className="usage-label">Current model</span>
                      <span className="usage-value">{usageData.lastModelUsed || "No requests yet"}</span>
                    </div>

                    <div className="usage-row">
                      <span className="usage-label">Requests today</span>
                      <span className="usage-value">
                        {usageData.today.requests} / {usageData.today.assumedDailyLimit}
                      </span>
                    </div>

                    <div className="usage-bar-track">
                      <div className="usage-bar-fill" style={{ width: `${usageData.today.percentUsed}%` }} />
                    </div>

                    <div className="usage-row">
                      <span className="usage-label">Tokens used today</span>
                      <span className="usage-value">{usageData.today.totalTokens.toLocaleString()}</span>
                    </div>

                    {usageData.perModelToday.length > 0 && (
                      <div className="usage-per-model">
                        {usageData.perModelToday.map((m) => (
                          <div key={m.model} className="usage-row usage-row-sub">
                            <span className="usage-label">{m.model}</span>
                            <span className="usage-value">
                              {m.requests} reqs · {m.totalTokens.toLocaleString()} tok
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="settings-note">
                      Gemini's API doesn't expose real-time remaining quota — this is a self-tracked
                      count against a configured daily cap, not a live number from Google.
                    </p>
                  </>
                ) : (
                  <p className="settings-hint">Couldn't load usage data.</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default App;
