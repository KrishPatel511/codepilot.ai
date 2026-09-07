import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { UsageData } from "../types";

interface SettingsModalProps {
  onClose: () => void;
  usageLoading: boolean;
  usageData: UsageData | null;
}

export function SettingsModal({ onClose, usageLoading, usageData }: SettingsModalProps) {
  return createPortal(
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>
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
  );
}
