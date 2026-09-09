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

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore if already stopped
        }
      }
    };
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
    try {
      const res = await apiFetch(`/chats/${id}`);
      if (!res.ok) throw new Error("Failed to load chat");
      const data = await res.json();
      const messages: Message[] = (data.messages || []).map((m: any) => {
        const dateObj = m.created_at ? new Date(m.created_at.replace(" ", "T") + "Z") : new Date();
        const time = isNaN(dateObj.getTime())
          ? nowTime()
          : dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return {
          role: m.role,
          text: m.text,
          time,
        };
      });
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, messages } : c)));
    } catch (err) {
      console.error("Failed to load chat messages", err);
    }
  };

  const handleTogglePin = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    const newPinned = !chat.pinned;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: newPinned } : c)));
    try {
      const res = await apiFetch(`/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: newPinned }),
      });
      if (!res.ok) throw new Error("Failed to update pin");
    } catch (err) {
      console.error("Failed to update pin state", err);
      // Revert optimistic update on failure
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !newPinned } : c)));
    }
  };

  const handleDeleteChat = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const chatToDelete = chats.find((c) => c.id === id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
      setDraftChat(emptyDraft());
    }
    try {
      const res = await apiFetch(`/chats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chat");
    } catch (err) {
      console.error("Failed to delete chat", err);
      if (chatToDelete) {
        setChats((prev) => [...prev, chatToDelete]);
      }
    }
  };

  const handleStartRename = (id: number, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingChatId(id);
    setRenameValue(currentTitle);
    setChatMenuOpenId(null);
    setChatMenuPos(null);
  };

  const handleSaveRename = async (id: number) => {
    const trimmed = renameValue.trim();
    setRenamingChatId(null);
    if (!trimmed) return;
    const oldChat = chats.find((c) => c.id === id);
    const oldTitle = oldChat?.title;
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)));
    try {
      const res = await apiFetch(`/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to rename chat");
    } catch (err) {
      console.error("Failed to rename chat", err);
      if (oldTitle !== undefined) {
        setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title: oldTitle } : c)));
      }
    }
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
    setProfileMenuOpen(false);
    setUsageLoading(true);
    apiFetch("/usage")
      .then((res) => res.json())
      .then((data: UsageData) => setUsageData(data))
      .catch((err) => console.error("Failed to fetch usage data", err))
      .finally(() => setUsageLoading(false));
  };

  const handleToggleMic = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const handleSend = async (repoContext?: { owner: string; name: string; path?: string }) => {
    const textToSend = input.trim();
    if ((!textToSend && !repoContext) || loading) return;

    let userDisplayMessage = textToSend;
    if (repoContext) {
      const prefix = repoContext.path
        ? `[Repo: ${repoContext.owner}/${repoContext.name} @ ${repoContext.path}] `
        : `[Repo: ${repoContext.owner}/${repoContext.name}] `;
      userDisplayMessage = prefix + (textToSend || "Please analyze this repository.");
    }

    const userMsg: Message = { role: "user", text: userDisplayMessage, time: nowTime() };
    const assistantPlaceholder: Message = { role: "assistant", text: "", time: nowTime() };

    let chatId = activeChatId;
    let updatedChats = [...chats];

    if (chatId === null) {
      try {
        const title = textToSend.slice(0, 30) || "Code analysis";
        const createRes = await apiFetch("/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (createRes.ok) {
          const newChatData = await createRes.json();
          chatId = newChatData.id;
          setActiveChatId(chatId);
          const newChatObj: ChatSession = {
            id: chatId!,
            title: newChatData.title || title,
            pinned: false,
            messages: [userMsg, assistantPlaceholder],
          };
          updatedChats = [newChatObj, ...chats];
          setChats(updatedChats);
          setDraftChat(emptyDraft());
        }
      } catch (err) {
        console.error("Failed to create chat", err);
      }
    } else {
      updatedChats = chats.map((c) =>
        c.id === chatId ? { ...c, messages: [...c.messages, userMsg, assistantPlaceholder] } : c
      );
      setChats(updatedChats);
    }

    setInput("");
    setLoading(true);

    try {
      const chatHistory =
        chatId !== null
          ? updatedChats.find((c) => c.id === chatId)?.messages.slice(0, -1) || []
          : [...draftChat.messages, userMsg];

      const res = await apiFetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory.map((m) => ({ role: m.role, text: m.text })),
          repoContext: repoContext || null,
          thinkMode,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setChats((prev) =>
          prev.map((c) => {
            if (c.id === chatId) {
              const msgs = [...c.messages];
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], text: accumulated };
              return { ...c, messages: msgs };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("Chat error", err);
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            const msgs = [...c.messages];
            msgs[msgs.length - 1] = {
              ...msgs[msgs.length - 1],
              text: "Sorry, something went wrong while generating the response.",
            };
            return { ...c, messages: msgs };
          }
          return c;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (activeChat.messages.length < 2 || loading) return;
    const msgsWithoutLast = activeChat.messages.slice(0, -1);
    const assistantPlaceholder: Message = { role: "assistant", text: "", time: nowTime() };

    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId ? { ...c, messages: [...msgsWithoutLast, assistantPlaceholder] } : c
      )
    );
    setLoading(true);

    try {
      const res = await apiFetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgsWithoutLast.map((m) => ({ role: m.role, text: m.text })),
          thinkMode,
        }),
      });

      if (!res.ok) throw new Error("Failed to regenerate");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        setChats((prev) =>
          prev.map((c) => {
            if (c.id === activeChatId) {
              const msgs = [...c.messages];
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], text: accumulated };
              return { ...c, messages: msgs };
            }
            return c;
          })
        );
      }
    } catch (err) {
      console.error("Regenerate error", err);
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1117] text-gray-300 font-sans">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Codepilot.ai...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-[#0d1117] text-gray-100 font-sans overflow-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        collapsed={collapsed}
        handleSidebarToggle={handleSidebarToggle}
        handleNewChat={handleNewChat}
        chats={chats}
        activeChatId={activeChatId}
        handleSwitchChat={handleSwitchChat}
        chatMenuOpenId={chatMenuOpenId}
        setChatMenuOpenId={setChatMenuOpenId}
        chatMenuPos={chatMenuPos}
        setChatMenuPos={setChatMenuPos}
        renamingChatId={renamingChatId}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        handleStartRename={handleStartRename}
        handleSaveRename={handleSaveRename}
        handleTogglePin={handleTogglePin}
        handleDeleteChat={handleDeleteChat}
        currentUser={currentUser}
        profileMenuOpen={profileMenuOpen}
        setProfileMenuOpen={setProfileMenuOpen}
        handleOpenSettings={handleOpenSettings}
        handleLogout={handleLogout}
      />

      <ChatWindow
        activeChat={activeChat}
        clock={clock}
        loading={loading}
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        handleRegenerate={handleRegenerate}
        handleSidebarToggle={handleSidebarToggle}
        chatScrollRef={chatScrollRef}
        lastUserMsgRef={lastUserMsgRef}
        textareaRef={textareaRef}
        repos={repos}
        reposLoaded={reposLoaded}
        setReposLoaded={setReposLoaded}
        reposLoading={reposLoading}
        setReposLoading={setReposLoading}
        setRepos={setRepos}
        plusMenuOpen={plusMenuOpen}
        setPlusMenuOpen={setPlusMenuOpen}
        thinkMode={thinkMode}
        setThinkMode={setThinkMode}
        isRecording={isRecording}
        handleToggleMic={handleToggleMic}
      />

      {settingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          usageData={usageData}
          usageLoading={usageLoading}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
