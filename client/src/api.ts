export const SERVER_BASE = import.meta.env.VITE_SERVER_BASE || "http://localhost:5001";
export const API_BASE = `${SERVER_BASE}/api`;

// Wraps fetch() and automatically attaches the logged-in user's token,
// so every API call is scoped to them without repeating this everywhere.
export function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("authToken");
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
