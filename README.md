# aiChatFramework

A lightweight full-stack web chat interface for OpenAI-compatible APIs. Features streaming responses, thinking/reasoning mode, file upload with text extraction, conversation history, and a clean responsive UI.

## Features

- **Streaming responses** — real-time token-by-token display (SSE)
- **Thinking / Reasoning mode** — toggle on/off, control effort level (high/max), collapsible reasoning display
- **File upload** — upload .docx, .txt, code files, images and more; backend extracts text for .docx and plain text files
- **Conversation history** — auto-saved, switch between conversations, delete old ones
- **Model selection** — fetch available models from your API provider with one click
- **Multi-provider** — works with OpenAI, DeepSeek, and any OpenAI-compatible API
- **Responsive UI** — desktop and mobile layout with sidebar

## Quick Start

```bash
# Install dependencies
cd backend
npm install

# Configure your API key (or use the settings panel in the UI)
# Edit backend/.env
API_KEY=sk-your-api-key
API_BASE_URL=https://api.deepseek.com
MODEL=deepseek-v4-pro

# Start
npm start
```

Open http://localhost:3001

Or double-click `start.bat` on Windows (auto-creates .env from template on first run).

## Project Structure

```
aiChatFramework/
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
| POST | `/api/chat` | Streaming chat (SSE) with thinking params |
| GET | `/api/settings` | Get current API settings |
| POST | `/api/settings` | Save API settings |
| POST | `/api/test` | Test API connection |
| GET | `/api/models` | List available models |
| POST | `/api/upload` | Upload and parse files (.docx, text) |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Save conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no build tools)
- **Backend:** Node.js + Express
- **File parsing:** mammoth (.docx text extraction)
- **API protocol:** OpenAI-compatible (works with OpenAI, DeepSeek, Ollama, etc.)

## License

MIT
