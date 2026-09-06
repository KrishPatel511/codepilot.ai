# 🤖 AI GitHub Coding Agent

An AI agent that explores your GitHub repositories, reads files, and answers
questions about your code using natural language + tool calling.

Built with React + Node.js + Gemini API.

## Status: Phase 3 complete — ChatGPT-style UI, tool calling, conversation memory

## Tech Stack
- **Frontend:** React + TypeScript + Vite (custom dark UI, no Tailwind)
- **Backend:** Node.js + Express + TypeScript
- **AI:** Google Gemini API (function calling / tool use)
- **GitHub Integration:** GitHub REST + Git Trees API

## Features
- Chat interface with conversation memory (multi-turn context)
- Sidebar with your GitHub repos (fetched on demand, not automatically)
- Multiple chat sessions ("New chat" button) — session data is in-memory for now
- Full recursive folder/file tree exploration
- Markdown-rendered responses (bold, lists, code blocks, tables)
- Fully responsive — sidebar collapses on mobile

## Setup
See `SETUP_INSTRUCTIONS.md` for full step-by-step setup.

## Project Structure
```
ai-github-agent/
  ├── client/   → React frontend
  └── server/   → Node.js + Express backend
```

## Roadmap
- [ ] Persist chat history to a database (SQLite)
- [ ] Code syntax highlighting for read_file results
- [ ] Deploy to Vercel (frontend) + Render (backend)
- [ ] Authentication (multi-user support)
