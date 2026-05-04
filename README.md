# AI Chat

A full-stack web chat interface for OpenAI-compatible APIs. Features streaming responses, conversation history, file upload with text extraction, and a clean responsive UI.

## Features

- **Streaming responses** — real-time token-by-token display (SSE)
- **Conversation history** — auto-saved, switch between conversations
- **File upload** — drag-and-drop or button upload, text extraction for .docx and plain text files
- **Model selection** — fetch available models from your API provider
- **Multi-provider** — works with OpenAI, DeepSeek, and any OpenAI-compatible API
- **Conversation history** — auto-saved, switch between conversations
- **Reasoning display** — shows thinking process for models like DeepSeek-R1
- **Responsive UI** — desktop and mobile layout

## Quick Start

1. **Clone and install**
   ```
   cd backend
   npm install
   ```

2. **Configure your API key**
   - Edit `backend/.env` (auto-created on first run)
   - Or configure via the settings panel in the web UI
   ```
   API_KEY=sk-your-api-key
   API_BASE_URL=https://api.openai.com
   MODEL=gpt-3.5-turbo
   ```

3. **Start**
   ```
   cd backend
   npm start
   ```

4. Open http://localhost:3001

Or double-click `start.bat` on Windows.

## Project Structure

```
AIWeb/
├── backend/
│   ├── server.js          # Express server + API proxy + file parsing
│   ├── package.json
│   ├── .env.example       # Configuration template
│   ├── conversations/     # Chat history (gitignored)
│   └── uploads/           # Temp uploads (gitignored)
├── frontend/
│   ├── index.html         # Single-page app
│   ├── css/style.css
│   └── js/app.js
├── start.bat              # Windows launcher
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Streaming chat (SSE) |
| GET | `/api/settings` | Get current settings |
| POST | `/api/settings` | Save settings |
| POST | `/api/test` | Test API connection |
| GET | `/api/models` | List available models |
| POST | `/api/upload` | Upload and parse files |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Save conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no build tools)
- **Backend:** Node.js + Express
- **File parsing:** mammoth (.docx)
- **API protocol:** OpenAI-compatible (works with OpenAI, DeepSeek, Ollama, etc.)
