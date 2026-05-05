const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mammoth = require('mammoth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const CONV_DIR = path.join(__dirname, 'conversations');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 确保目录存在
[CONV_DIR, UPLOAD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

// POST /api/upload — 上传并解析文件
const TEXT_EXTS = new Set(['.txt','.md','.js','.py','.html','.css','.json','.csv','.xml','.yaml','.yml','.sh','.bat','.log','.env','.ini','.cfg','.conf','.sql','.rs','.go','.java','.ts','.tsx','.jsx','.vue','.php','.rb','.pl','.lua','.zig','.toml']);

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  let text = '';

  try {
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value.trim();
    } else if (TEXT_EXTS.has(ext)) {
      text = fs.readFileSync(req.file.path, 'utf-8').trim();
    }
  } catch (err) {
    text = '';
  }

  // 清理临时文件
  fs.unlink(req.file.path, () => {});

  // 修复 Windows 下 multer 对 UTF-8 文件名的乱码问题
  const fixedName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

  res.json({
    name: fixedName,
    text,
    parsed: !!text,
    size: req.file.size,
  });
});

// POST /api/test — 测试 API 连接
app.post('/api/test', async (req, res) => {
  const settings = getSettings();

  if (!settings.apiKey) {
    return res.json({ ok: false, msg: '请先配置 API_KEY' });
  }

  try {
    const response = await fetch(`${settings.apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: 'Say hi in one word.' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.json({ ok: false, msg: `API ${response.status}: ${text.slice(0, 200)}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    res.json({ ok: true, msg: `连接成功！响应: ${reply.trim()}` });
  } catch (err) {
    res.json({ ok: false, msg: `请求失败: ${err.message}` });
  }
});

// GET /api/models — 获取可用模型列表
app.get('/api/models', async (req, res) => {
  const settings = getSettings();

  if (!settings.apiKey) {
    return res.json({ ok: false, msg: '请先配置 API_KEY', models: [] });
  }

  try {
    const response = await fetch(`${settings.apiBaseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${settings.apiKey}` },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.json({ ok: false, msg: `API ${response.status}`, models: [] });
    }

    const data = await response.json();
    const models = (data.data || [])
      .map(m => m.id)
      .filter(id => typeof id === 'string')
      .sort();
    res.json({ ok: true, models });
  } catch (err) {
    res.json({ ok: false, msg: err.message, models: [] });
  }
});

// POST /api/chat — 流式代理到 OpenAI 兼容 API
app.post('/api/chat', async (req, res) => {
  const { messages, model, reasoningEffort, thinkingEnabled, temperature, top_p } = req.body;
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
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        ...(thinkingEnabled !== undefined ? {
          extra_body: { thinking: { type: thinkingEnabled ? 'enabled' : 'disabled' } }
        } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(top_p !== undefined ? { top_p } : {}),
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
          const choice = parsed.choices?.[0]?.delta;
          if (choice?.reasoning_content) {
            res.write(`data: ${JSON.stringify({ reasoning_content: choice.reasoning_content })}\n\n`);
          }
          if (choice?.content) {
            res.write(`data: ${JSON.stringify({ content: choice.content })}\n\n`);
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

// ---- 对话历史 API ----

function ensureConvDir() {
  if (!fs.existsSync(CONV_DIR)) fs.mkdirSync(CONV_DIR, { recursive: true });
}

function convPath(id) {
  return path.join(CONV_DIR, `${id}.json`);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 生成对话标题（取第一条用户消息的前 30 个字符）
function generateTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first) return '新对话';
  let t = '';
  if (typeof first.content === 'string') t = first.content;
  else if (Array.isArray(first.content)) {
    const textPart = first.content.find(p => p.type === 'text');
    t = textPart ? textPart.text : '文件消息';
  }
  t = t.trim();
  return t.length > 30 ? t.slice(0, 30) + '...' : t;
}

// GET /api/conversations — 列出所有对话
app.get('/api/conversations', (req, res) => {
  ensureConvDir();
  try {
    const files = fs.readdirSync(CONV_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CONV_DIR, f), 'utf-8'));
      return {
        id: data.id,
        title: data.title,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        messageCount: data.messages ? data.messages.length : 0,
      };
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/conversations/:id — 获取单个对话
app.get('/api/conversations/:id', (req, res) => {
  ensureConvDir();
  const file = convPath(req.params.id);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: '对话不存在' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/conversations — 保存对话（新建 / 更新）
app.post('/api/conversations', (req, res) => {
  ensureConvDir();
  const { id, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages 是必填项' });
  }

  const now = Date.now();

  if (id && fs.existsSync(convPath(id))) {
    // 更新已有对话
    const existing = JSON.parse(fs.readFileSync(convPath(id), 'utf-8'));
    existing.messages = messages;
    existing.title = generateTitle(messages);
    existing.updatedAt = now;
    fs.writeFileSync(convPath(id), JSON.stringify(existing, null, 2), 'utf-8');
    return res.json({ id: existing.id });
  }

  // 新建对话
  const newConv = {
    id: generateId(),
    title: generateTitle(messages),
    messages,
    createdAt: now,
    updatedAt: now,
  };
  fs.writeFileSync(convPath(newConv.id), JSON.stringify(newConv, null, 2), 'utf-8');
  res.json({ id: newConv.id });
});

// DELETE /api/conversations/:id — 删除对话
app.delete('/api/conversations/:id', (req, res) => {
  ensureConvDir();
  const file = convPath(req.params.id);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: '对话不存在' });
  }
  fs.unlinkSync(file);
  res.json({ success: true });
});

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  const s = getSettings();
  console.log(`aiChatFramework started: http://localhost:${PORT}`);
  console.log(`   API: ${s.apiBaseUrl}`);
  console.log(`   Model: ${s.model}`);
  console.log(`   API Key: ${s.apiKey ? 'configured' : 'NOT configured'}`);
});
