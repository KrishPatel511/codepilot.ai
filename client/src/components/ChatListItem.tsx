import { createPortal } from "react-dom";
import { FiMessageSquare, FiBookmark, FiMoreHorizontal, FiEdit2, FiTrash2 } from "react-icons/fi";
import { ChatMenuPos, ChatSession } from "../types";

interface ChatListItemProps {
  chat: ChatSession;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onConfirmRename: (id: number) => void;
  onCancelRename: () => void;
  onSwitchChat: (id: number) => void;
  onTogglePin: (id: number, pinned: boolean) => void;
  onStartRename: (id: number, title: string) => void;
  onDeleteChat: (id: number) => void;
  isMenuOpen: boolean;
  menuPos: ChatMenuPos | null;
  onOpenMenu: (chatId: number, pos: ChatMenuPos) => void;
  onCloseMenu: () => void;
}

export function ChatListItem({
  chat,
  isActive,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onConfirmRename,
  onCancelRename,
  onSwitchChat,
  onTogglePin,
  onStartRename,
  onDeleteChat,
  isMenuOpen,
  menuPos,
  onOpenMenu,
  onCloseMenu,
}: ChatListItemProps) {
  return (
    <div className={`chat-item ${isActive ? "active" : ""}`}>
      {isRenaming ? (
        <input
          className="chat-item-rename-input"
          autoFocus
          value={renameValue}
          onChange={(e) => onRenameValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && chat.id !== null) onConfirmRename(chat.id);
            if (e.key === "Escape") onCancelRename();
          }}
          onBlur={() => chat.id !== null && onConfirmRename(chat.id)}
        />
      ) : (
        <button
          className="history-item chat-item-title-btn"
          onClick={() => chat.id !== null && onSwitchChat(chat.id)}
        >
          <FiMessageSquare className="item-icon" />
          <span className="chat-item-title">{chat.title}</span>
        </button>
      )}

      {!isRenaming && (
        <div className="chat-item-actions">
          <button
            className="chat-item-action-btn"
            title={chat.pinned ? "Unpin" : "Pin"}
            onClick={(e) => {
              e.stopPropagation();
              if (chat.id !== null) onTogglePin(chat.id, !chat.pinned);
            }}
          >
            <FiBookmark className={chat.pinned ? "pinned" : ""} />
          </button>
          <button
            className="chat-item-action-btn"
            title="More"
            onClick={(e) => {
              e.stopPropagation();
              if (chat.id === null) return;

              if (isMenuOpen) {
                onCloseMenu();
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
              onOpenMenu(
                chat.id,
                openUp ? { bottom: window.innerHeight - rect.top + 4, left } : { top: rect.bottom + 4, left }
              );
            }}
          >
            <FiMoreHorizontal />
          </button>

          {isMenuOpen &&
            menuPos &&
            createPortal(
              <div
                className="chat-item-menu chat-item-menu-portal"
                style={{ top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left }}
              >
                <button onClick={() => chat.id !== null && onStartRename(chat.id, chat.title)}>
                  <FiEdit2 /> Rename
                </button>
                <button onClick={() => chat.id !== null && onTogglePin(chat.id, !chat.pinned)}>
                  <FiBookmark /> {chat.pinned ? "Unpin chat" : "Pin chat"}
                </button>
                <div className="chat-item-menu-divider" />
                <button
                  className="chat-item-menu-danger"
                  onClick={() => chat.id !== null && onDeleteChat(chat.id)}
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
}
