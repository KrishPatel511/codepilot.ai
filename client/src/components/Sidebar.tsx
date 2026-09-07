import {
  FiEdit,
  FiFolder,
  FiSearch,
  FiSidebar,
  FiBookmark,
  FiMessageSquare,
} from "react-icons/fi";
import {
  HiChevronRight,
  HiOutlineSparkles,
  HiOutlineUserCircle,
  HiOutlineUser,
  HiOutlineCog6Tooth,
  HiOutlineQuestionMarkCircle,
  HiOutlineArrowRightOnRectangle,
} from "react-icons/hi2";
import { ChatMenuPos, ChatSession, CurrentUser, Repo } from "../types";
import { initialsFrom } from "../utils";
import { ChatListItem } from "./ChatListItem";

interface SidebarProps {
  collapsed: boolean;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  onExpandFromRail: () => void;
  onCloseSidebarOverlay: () => void;
  onNewChat: () => void;

  repos: Repo[];
  reposLoaded: boolean;
  reposLoading: boolean;
  onFetchRepos: () => void;
  onRepoClick: (repo: Repo) => void;

  chats: ChatSession[];
  activeChatId: number | null;
  renamingChatId: number | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: (id: number) => void;
  onCancelRename: () => void;
  onSwitchChat: (id: number) => void;
  onTogglePin: (id: number, pinned: boolean) => void;
  onStartRename: (id: number, title: string) => void;
  onDeleteChat: (id: number) => void;
  chatMenuOpenId: number | null;
  chatMenuPos: ChatMenuPos | null;
  onOpenChatMenu: (chatId: number, pos: ChatMenuPos) => void;
  onCloseChatMenu: () => void;

  currentUser: CurrentUser;
  profileMenuOpen: boolean;
  onToggleProfileMenu: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function Sidebar({
  collapsed,
  sidebarOpen,
  onSidebarToggle,
  onExpandFromRail,
  onCloseSidebarOverlay,
  onNewChat,
  repos,
  reposLoaded,
  reposLoading,
  onFetchRepos,
  onRepoClick,
  chats,
  activeChatId,
  renamingChatId,
  renameValue,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onSwitchChat,
  onTogglePin,
  onStartRename,
  onDeleteChat,
  chatMenuOpenId,
  chatMenuPos,
  onOpenChatMenu,
  onCloseChatMenu,
  currentUser,
  profileMenuOpen,
  onToggleProfileMenu,
  onOpenSettings,
  onLogout,
}: SidebarProps) {
  const pinnedChats = chats.filter((c) => c.pinned);
  const recentChats = chats.filter((c) => !c.pinned);

  const renderChatItem = (c: ChatSession) => (
    <ChatListItem
      key={c.id}
      chat={c}
      isActive={c.id === activeChatId}
      isRenaming={renamingChatId === c.id}
      renameValue={renameValue}
      onRenameValueChange={onRenameValueChange}
      onConfirmRename={onConfirmRename}
      onCancelRename={onCancelRename}
      onSwitchChat={onSwitchChat}
      onTogglePin={onTogglePin}
      onStartRename={onStartRename}
      onDeleteChat={onDeleteChat}
      isMenuOpen={chatMenuOpenId === c.id}
      menuPos={chatMenuPos}
      onOpenMenu={onOpenChatMenu}
      onCloseMenu={onCloseChatMenu}
    />
  );

  return (
    <>
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
            onClick={onSidebarToggle}
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

        <button className="new-chat-btn" onClick={onNewChat} data-tooltip="New chat" title="New chat">
          <FiEdit />
          <span className="label">New chat</span>
        </button>

        {collapsed && (
          <div className="rail-icons">
            <button
              className="icon-btn rail-icon-btn"
              onClick={onExpandFromRail}
              data-tooltip="Search"
              title="Search"
            >
              <FiSearch />
            </button>
            <button
              className="icon-btn rail-icon-btn"
              onClick={onExpandFromRail}
              data-tooltip="Pinned"
              title="Pinned"
            >
              <FiBookmark />
            </button>
            <button
              className="icon-btn rail-icon-btn"
              onClick={onExpandFromRail}
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
            <button className="fetch-link" onClick={onFetchRepos} disabled={reposLoading}>
              {reposLoading ? "Loading..." : reposLoaded ? "Refresh" : "Fetch"}
            </button>
          </div>

          {!reposLoaded && !reposLoading && (
            <p className="sidebar-empty-hint">Click "Fetch" to load your GitHub repos.</p>
          )}
          {reposLoaded &&
            repos.map((r) => (
              <button key={r.fullName} className="repo-item" onClick={() => onRepoClick(r)}>
                <FiFolder className="item-icon" /> {r.name}
              </button>
            ))}

          {pinnedChats.length > 0 && (
            <>
              <div className="sidebar-section-label">
                <span>Pinned</span>
              </div>
              {pinnedChats.map(renderChatItem)}
            </>
          )}

          <div className="sidebar-section-label">
            <span>Recent chats</span>
          </div>
          {recentChats.map(renderChatItem)}
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
              <button className="profile-menu-item" onClick={onOpenSettings}>
                <HiOutlineCog6Tooth className="profile-menu-icon" />
                Settings
              </button>

              <div className="profile-menu-divider" />

              <button className="profile-menu-item" disabled title="Coming soon — not implemented yet">
                <HiOutlineQuestionMarkCircle className="profile-menu-icon" />
                Help
                <HiChevronRight className="profile-menu-chevron-right" />
              </button>
              <button className="profile-menu-item" onClick={onLogout}>
                <HiOutlineArrowRightOnRectangle className="profile-menu-icon" />
                Log out
              </button>
            </div>
          )}
          <div className="sidebar-footer-row">
            <button className="sidebar-footer" onClick={onToggleProfileMenu} data-tooltip={currentUser.username}>
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay open" onClick={onCloseSidebarOverlay} />}
    </>
  );
}
