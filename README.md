# aiChatFramework

A lightweight full-stack web chat interface for OpenAI-compatible APIs. Streaming, thinking mode, file upload, multimodal support, conversation management, and a polished responsive UI — all in zero-build HTML/CSS/JS + Node.js.

## Features

- **Streaming responses** — real-time token-by-token via SSE, with auto-scroll lock
- **Thinking / Reasoning** — on/off toggle, effort control (high/max), collapsible reasoning display (DeepSeek R1 / V4)
- **Multimodal support** — images sent as `image_url` for vision models, auto-fallback to text-only for non-vision models
- **File upload** — .docx text extraction via mammoth, plain text/code files read as text, images as base64 for multimodal models
- **Conversation history** — auto-saved, switch between conversations, delete, rename, pin, date grouping (Today/Yesterday/Week/Earlier)
- **Auto rename** — AI-generated conversation titles (toggle in settings)
- **Message actions** — copy, edit (user messages), delete, regenerate (AI messages), token count estimate, timestamps
- **Model management** — fetch available models from your API provider, save API presets (multi-provider quick switch)
- **Model parameters** — temperature (0–2), top-P (0–1) sliders
- **System prompt** — custom instructions prepended to every request
- **Export** — download conversation as Markdown + JSON
- **Markdown rendering** — code blocks (with copy button), tables, lists, links, blockquotes
- **Dark mode** — 6 background themes (light, dark, warm, 3 gradients), synced dark UI
- **i18n** — Chinese / English interface
- **Drag & drop** — drop files onto chat area
- **Responsive** — desktop sidebar + mobile hamburger menu

## Quick Start

```bash
cd backend
npm install
# Edit backend/.env with your API key
npm start
```

Open http://localhost:3001

Or double-click `start.bat` on Windows (auto-creates .env from template on first run, auto-opens browser, auto-closes launcher).

## Project Structure

```
aiChatFramework/
├── backend/
│   ├── server.js            # Express server + API proxy + file parsing
│   ├── package.json
│   ├── .env.example         # Configuration template
│   ├── config.json          # Saved settings (gitignored)
│   ├── conversations/       # Chat history (gitignored)
│   └── uploads/             # Temp uploads (gitignored)
├── frontend/
│   ├── index.html           # Single-page app
│   ├── css/style.css
│   └── js/app.js
├── start.bat                # Windows launcher
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Streaming chat (SSE) with thinking & model params |
| GET | `/api/settings` | Get current API settings (includes key) |
| POST | `/api/settings` | Save API settings |
| POST | `/api/test` | Test API connection |
| GET | `/api/models` | List available models |
| POST | `/api/rename` | AI title generation |
| POST | `/api/upload` | Upload & parse files (.docx, text) |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Save / update conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no build tools, no frameworks)
- **Backend:** Node.js + Express
- **File parsing:** mammoth (.docx)
- **API protocol:** OpenAI-compatible (OpenAI, DeepSeek, Ollama, etc.)

## License

MIT
