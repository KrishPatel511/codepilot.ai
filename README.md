# 🤖 RepoSentry

An AI agent that explores your GitHub repositories, reads files, and answers
questions about your code using natural language + tool calling.

Built with React + Node.js + Gemini API.

## Status: GitHub OAuth login, persistent chat history (Postgres/Prisma), and usage tracking added

## Tech Stack
- **Frontend:** React + TypeScript + Vite (custom dark UI, no Tailwind)
- **Backend:** Node.js + Express + TypeScript (controllers/services/routes/middleware)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** GitHub OAuth + JWT (httpOnly cookie sessions)
- **AI:** Google Gemini API (function calling / tool use)
- **GitHub Integration:** GitHub REST + Git Trees API

## Features
- GitHub OAuth login (multi-user support)
- Chat interface with conversation memory (multi-turn context)
- Chat history persisted to Postgres — chats and messages survive page refresh
- Sidebar with your GitHub repos (fetched on demand, not automatically)
- Multiple chat sessions ("New chat" button, pin/rename/delete)
- Full recursive folder/file tree exploration
- Per-user Gemini usage tracking against a daily request cap
- Markdown-rendered responses (bold, lists, code blocks, tables)
- Fully responsive — sidebar collapses on mobile

## Setup
See `SETUP_INSTRUCTIONS.md` for full step-by-step setup.

## Project Structure
```
ai-github-agent/
  ├── client/   → React frontend
  └── server/   → Node.js + Express backend
        ├── prisma/       → schema + migrations (Postgres)
        └── src/
              ├── controllers/  → request handlers
              ├── services/     → business logic (auth, chat, github, usage)
              ├── routes/       → Express route definitions
              ├── middleware/   → auth middleware (JWT)
              └── lib/          → shared utilities
```

## Roadmap
- [ ] Code syntax highlighting for read_file results
- [ ] Deploy to Vercel (frontend) + Render (backend)
- [ ] Rate limiting / abuse protection on public endpoints
