# Setup Instructions

## 1. Server Setup

```bash
cd server
npm install
```

Copy the example env file and fill in your OWN keys (never share these):
```bash
cp .env.example .env
```

Edit `.env`:
```
GEMINI_API_KEY=your_gemini_api_key
PORT=5000
```

Start the server:
```bash
npm run dev
```

You should see:
```
✅ Server running on http://localhost:5000
```

## 2. Client Setup

Open a new terminal:
```bash
cd client
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

## 3. Using the App

- The sidebar starts empty for repos — click **"Fetch"** next to "Your repositories" to load them.
- Click any repo in the sidebar to auto-fill a prompt about it.
- Click **"+ New chat"** to start a fresh conversation (previous chats stay in the sidebar for this session — they reset on page refresh since there's no database yet).
- Try prompts like:
  - "Show me my repos"
  - "Show me the full folder structure of `<repo-name>`"
  - "Read the `<filename>` file from `<repo-name>`"

## Notes
- The Gemini free tier has a daily request quota per model. If you hit a "quota exceeded" error, the app automatically retries with a fallback model. If both are exhausted, wait for the daily reset or enable billing in Google AI Studio.
- Never commit your real `.env` file — it's already excluded via `.gitignore`.
