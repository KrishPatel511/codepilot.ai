export interface CurrentUser {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export interface Message {
  role: "user" | "agent";
  text: string;
  time: string;
}

export interface ChatSession {
  id: number | null;
  title: string;
  pinned: boolean;
  messages: Message[];
}

export interface Repo {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  private: boolean;
}

export interface UsageData {
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

export interface ChatMenuPos {
  top?: number;
  bottom?: number;
  left: number;
}
