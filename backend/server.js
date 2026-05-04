const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CONFIG_PATH = path.join(__dirname, 'config.json');

// 从 config.json 读取设置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function isValidKey(k) {
  return k && k !== 'sk-your-api-key-here';
}

// 获取当前生效的设置（config.json 优先，.env 次之，最后默认值）
function getSettings() {
  const cfg = loadConfig();
  return {
    apiBaseUrl: (cfg.apiBaseUrl || process.env.API_BASE_URL || 'https://api.openai.com').replace(/\/+$/, ''),
    model: cfg.model || process.env.MODEL || 'gpt-3.5-turbo',
    apiKey: isValidKey(cfg.apiKey) ? cfg.apiKey : (isValidKey(process.env.API_KEY) ? process.env.API_KEY : ''),
  };
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// GET /api/settings — 获取当前设置
app.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({
    apiBaseUrl: s.apiBaseUrl,
    model: s.model,
    hasKey: !!s.apiKey,
  });
});

// POST /api/settings — 保存设置到 config.json
app.post('/api/settings', (req, res) => {
  const { apiBaseUrl, model, apiKey } = req.body;
  const cfg = loadConfig();

  if (apiBaseUrl !== undefined) cfg.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  if (model !== undefined) cfg.model = model;
  if (apiKey !== undefined) cfg.apiKey = apiKey;

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  res.json({ success: true });
});

// POST /api/chat — 流式代理到 OpenAI 兼容 API
app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body;
  const settings = getSettings();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 是必填项，且必须是非空数组' });
  }

  if (!settings.apiKey) {
    return res.status(500).json({ error: '请先配置 API_KEY' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const response = await fetch(`${settings.apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: model || settings.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `API 错误 (${response.status}): ${errorText}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch {}
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: `请求失败: ${err.message}` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  const s = getSettings();
  console.log(`AI Chat started: http://localhost:${PORT}`);
  console.log(`   API: ${s.apiBaseUrl}`);
  console.log(`   Model: ${s.model}`);
  console.log(`   API Key: ${s.apiKey ? 'configured' : 'NOT configured'}`);
});
