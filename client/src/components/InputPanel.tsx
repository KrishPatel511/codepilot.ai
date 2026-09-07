import { RefObject } from "react";
import {
  FiPlus,
  FiCpu,
  FiMic,
  FiArrowUp,
  FiPaperclip,
  FiFolder,
  FiGitBranch,
  FiSearch,
  FiGithub,
} from "react-icons/fi";
import { SERVER_BASE } from "../api";

interface InputPanelProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  loading: boolean;
  plusMenuOpen: boolean;
  onTogglePlusMenu: () => void;
  onBrowseRepository: () => void;
  onExploreFolderTree: () => void;
  onSearchCode: () => void;
  onManageGithubConnection: () => void;
  thinkMode: boolean;
  onToggleThinkMode: () => void;
  isRecording: boolean;
  onToggleMic: () => void;
  onSend: () => void;
}

export function InputPanel({
  input,
  onInputChange,
  onKeyDown,
  textareaRef,
  loading,
  plusMenuOpen,
  onTogglePlusMenu,
  onBrowseRepository,
  onExploreFolderTree,
  onSearchCode,
  onManageGithubConnection,
  thinkMode,
  onToggleThinkMode,
  isRecording,
  onToggleMic,
  onSend,
}: InputPanelProps) {
  return (
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
            <button className="plus-menu-item" onClick={onBrowseRepository}>
              <FiFolder className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Browse repository</p>
                <p className="plus-menu-subtitle">Pick a file from GitHub</p>
              </div>
            </button>
            <button className="plus-menu-item" onClick={onExploreFolderTree}>
              <FiGitBranch className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Explore folder tree</p>
                <p className="plus-menu-subtitle">View full repo structure</p>
              </div>
            </button>
            <button className="plus-menu-item" onClick={onSearchCode}>
              <FiSearch className="plus-menu-icon" />
              <div className="plus-menu-text">
                <p className="plus-menu-title">Search code</p>
                <p className="plus-menu-subtitle">Find something in a repo</p>
              </div>
            </button>
            <div className="plus-menu-divider" />
            <button className="plus-menu-item" onClick={onManageGithubConnection}>
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
          <button className="plus-btn" onClick={onTogglePlusMenu}>
            <FiPlus />
          </button>

          <textarea
            ref={textareaRef}
            placeholder="Message CodePilot..."
            rows={1}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
          />

          <div className="input-actions-right">
            <button className={`think-btn ${thinkMode ? "active" : ""}`} onClick={onToggleThinkMode}>
              <FiCpu />
              Think
            </button>
            <button
              className={`icon-only-btn ${isRecording ? "recording" : ""}`}
              onClick={onToggleMic}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              <FiMic />
            </button>
            <button className="send-btn" onClick={onSend} disabled={loading || !input.trim()}>
              <FiArrowUp />
            </button>
          </div>
        </div>
      </div>
      <div className="input-hint">Connected to backend at {SERVER_BASE}</div>
    </div>
  );
}
