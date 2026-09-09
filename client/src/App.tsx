import { useEffect, useRef, useState } from "react";
import { SERVER_BASE, apiFetch } from "./api";
import { nowTime } from "./utils";
import { ChatMenuPos, ChatSession, CurrentUser, Message, Repo, UsageData } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { SettingsModal } from "./components/SettingsModal";

function emptyDraft(): ChatSession {
  return { id: null, title: "New chat", pinned: false, messages: [] };
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
  const [chatMenuPos, setChatMenuPos] = useState<ChatMenuPos | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat =
    activeChatId === null ? draftChat : chats.find((c) => c.id === activeChatId) ?? draftChat;

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

  const regenerateLastResponse = async () => {
    if (loading || activeChatId === null) return;

    const current = chats.find((c) => c.id === activeChatId);
    if (!current || current.messages.length < 2) return;

    const lastAgentMessage = current.messages[current.messages.length - 1];
    const lastUserMessage = current.messages[current.messages.length - 2];
    if (lastAgentMessage.role !== "agent" || lastUserMessage.role !== "user") return;

    setLoading(true);
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, messages: c.messages.slice(0, -1) } : c))
    );

    try {
      const res = await apiFetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChatId,
          message: lastUserMessage.text,
          thinkMode,
          regenerate: true,
        }),
      });
      const data = await res.json();
      const agentMessage: Message = {
        role: "agent",
        text: data.reply || data.error || "No response.",
        time: nowTime(),
      };
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, agentMessage] } : c))
      );
    } catch (err) {
      const errMessage: Message = {
        role: "agent",
        text: "⚠️ Could not reach the server. Is it running on port 5001?",
        time: nowTime(),
      };
      setChats((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, messages: [...c.messages, errMessage] } : c))
      );
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

  if (!authChecked) {
    return <div className="auth-loading" />;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const inputPanelProps = {
    input,
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      autoGrow();
    },
    onKeyDown: handleKeyDown,
    textareaRef,
    loading,
    plusMenuOpen,
    onTogglePlusMenu: () => setPlusMenuOpen((prev) => !prev),
    onBrowseRepository: handleBrowseRepository,
    onExploreFolderTree: handleExploreFolderTree,
    onSearchCode: handleSearchCode,
    onManageGithubConnection: handleManageGithubConnection,
    thinkMode,
    onToggleThinkMode: () => setThinkMode((prev) => !prev),
    isRecording,
    onToggleMic: handleToggleMic,
    onSend: sendMessage,
  };

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={handleSidebarToggle}
        onExpandFromRail={() => setCollapsed(false)}
        onCloseSidebarOverlay={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        repos={repos}
        reposLoaded={reposLoaded}
        reposLoading={reposLoading}
        onFetchRepos={fetchRepos}
        onRepoClick={handleRepoClick}
        chats={chats}
        activeChatId={activeChatId}
        renamingChatId={renamingChatId}
        renameValue={renameValue}
        onRenameValueChange={setRenameValue}
        onConfirmRename={handleConfirmRename}
        onCancelRename={() => setRenamingChatId(null)}
        onSwitchChat={handleSwitchChat}
        onTogglePin={handleTogglePin}
        onStartRename={handleStartRename}
        onDeleteChat={handleDeleteChat}
        chatMenuOpenId={chatMenuOpenId}
        chatMenuPos={chatMenuPos}
        onOpenChatMenu={(chatId, pos) => {
          setChatMenuOpenId(chatId);
          setChatMenuPos(pos);
        }}
        onCloseChatMenu={() => {
          setChatMenuOpenId(null);
          setChatMenuPos(null);
        }}
        currentUser={currentUser}
        profileMenuOpen={profileMenuOpen}
        onToggleProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
      />

      <ChatWindow
        clock={clock}
        onOpenSidebar={() => setSidebarOpen(true)}
        activeChat={activeChat}
        loading={loading}
        chatScrollRef={chatScrollRef}
        lastUserMsgRef={lastUserMsgRef}
        inputPanelProps={inputPanelProps}
        onRegenerate={regenerateLastResponse}
      />

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          usageLoading={usageLoading}
          usageData={usageData}
        />
      )}
    </div>
  );
}

export default App;
