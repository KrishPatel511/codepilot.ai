import { FiGithub } from "react-icons/fi";

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
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
