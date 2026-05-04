// ---- DOM refs ----
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const messagesContainer = document.getElementById('messages');
const loading = document.getElementById('loading');
const sendBtn = document.getElementById('send-btn');
const fileBtn = document.getElementById('file-btn');
const fileInput = document.getElementById('file-input');
const filePreviews = document.getElementById('file-previews');

const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');
const settingUrl = document.getElementById('setting-url');
const settingModel = document.getElementById('setting-model');
const settingKey = document.getElementById('setting-key');
const testBtn = document.getElementById('test-btn');
const testResult = document.getElementById('test-result');
const fetchModelsBtn = document.getElementById('fetch-models-btn');
const modelSelectWrap = document.getElementById('model-list-wrap');
const modelSelect = document.getElementById('model-select');
const thinkingToggle = document.getElementById('thinking-toggle');
const effortSelect = document.getElementById('effort-select');
const effortLabel = document.getElementById('effort-label');

const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const convList = document.getElementById('conv-list');
const newChatBtn = document.getElementById('new-chat-btn');

let messages = [];
let currentConvId = null;
let abortController = null;
let saveTimer = null;
let attachedFiles = []; // {file, name, size, type}

// ---- 文件上传 ----
const ALLOWED_EXTENSIONS = new Set([
  '.txt','.md','.js','.py','.html','.css','.json','.csv','.xml','.yaml','.yml',
  '.sh','.bat','.log','.env','.ini','.cfg','.conf','.sql','.rs','.go','.java',
  '.ts','.tsx','.jsx','.vue','.php','.rb','.pl','.lua','.zig','.toml',
  '.png','.jpg','.jpeg','.gif','.webp','.bmp',
  '.pdf','.doc','.docx','.xls','.xlsx','.zip','.tar','.gz','.7z','.rar',
]);
fileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    if (file.size > 10 * 1024 * 1024) { alert('文件 ' + file.name + ' 超过 10MB 限制'); continue; }
    attachedFiles.push({ file, name: file.name, size: file.size, type: ext });
  }
  fileInput.value = '';
  renderFilePreviews();
});

function renderFilePreviews() {
  if (attachedFiles.length === 0) { filePreviews.classList.add('hidden'); return; }
  filePreviews.classList.remove('hidden');
  filePreviews.innerHTML = attachedFiles.map((f, i) =>
    `<span class="file-chip">${escHtml(f.name)} <button data-idx="${i}" class="file-chip-del">&times;</button></span>`
  ).join('');
  filePreviews.querySelectorAll('.file-chip-del').forEach(btn => {
    btn.addEventListener('click', () => {
      attachedFiles.splice(parseInt(btn.dataset.idx), 1);
      renderFilePreviews();
    });
  });
}

// 上传文件到后端解析，返回 [{ name, text }]
async function uploadFiles() {
  if (attachedFiles.length === 0) return [];
  const results = [];
  for (const af of attachedFiles) {
    const fd = new FormData();
    fd.append('file', af.file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      results.push({ name: data.name, text: data.text || '' });
    } catch {
      results.push({ name: af.name, text: '' });
    }
  }
  attachedFiles = [];
  renderFilePreviews();
  return results;
}

// ---- 侧边栏 ----
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('hidden-mobile');
  sidebar.classList.toggle('show-mobile');
});

document.addEventListener('click', (e) => {
  if (window.innerWidth > 700) return;
  if (!sidebar.contains(e.target) && e.target !== sidebarToggle) {
    sidebar.classList.add('hidden-mobile');
    sidebar.classList.remove('show-mobile');
  }
});

// ---- 对话列表 ----
async function loadConvList() {
  try {
    const res = await fetch('/api/conversations');
    const list = await res.json();
    convList.innerHTML = '';
    if (list.length === 0) {
      convList.innerHTML = '<div class="conv-empty">暂无对话</div>';
      return;
    }
    for (const conv of list) {
      const item = document.createElement('div');
      item.className = 'conv-item' + (conv.id === currentConvId ? ' active' : '');
      item.innerHTML = `
        <span class="conv-title">${escHtml(conv.title || '新对话')}</span>
        <button class="conv-del" data-id="${conv.id}">&times;</button>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.conv-del')) return;
        switchConv(conv.id);
      });
      item.querySelector('.conv-del').addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteConv(conv.id);
      });
      convList.appendChild(item);
    }
  } catch {}
}

async function switchConv(id) {
  if (currentConvId) await saveCurrentConv();
  try {
    const res = await fetch(`/api/conversations/${id}`);
    const conv = await res.json();
    currentConvId = conv.id;
    messages = conv.messages || [];
    renderMessages();
    loadConvList();
    if (window.innerWidth <= 700) {
      sidebar.classList.add('hidden-mobile');
      sidebar.classList.remove('show-mobile');
    }
  } catch (err) {
    console.error('Failed to load conversation', err);
  }
}

async function deleteConv(id) {
  try {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (currentConvId === id) {
      currentConvId = null;
      messages = [];
      renderMessages();
    }
    loadConvList();
  } catch {}
}

newChatBtn.addEventListener('click', async () => {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (currentConvId && messages.filter(m => m.content).length > 0) {
    await saveCurrentConv();
  }
  currentConvId = null;
  messages = [];
  attachedFiles = [];
  renderFilePreviews();
  renderMessages();
  loadConvList();
  userInput.focus();
  if (window.innerWidth <= 700) {
    sidebar.classList.add('hidden-mobile');
    sidebar.classList.remove('show-mobile');
  }
});

// ---- 自动保存对话 ----
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentConv, 1500);
}

async function saveCurrentConv() {
  saveTimer = null;
  const filtered = messages.filter(m => m.content);
  if (filtered.length === 0) return;

  const savedId = currentConvId;
  try {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: savedId, messages: filtered }),
    });
    const data = await res.json();
    if (data.id && currentConvId === savedId) {
      currentConvId = data.id;
    }
    loadConvList();
  } catch {}
}

// ---- 设置功能 ----
settingsBtn.addEventListener('click', async () => {
  settingsOverlay.classList.remove('hidden');
  // 从 localStorage 加载思考模式设置
  thinkingToggle.checked = localStorage.getItem('thinkingEnabled') !== 'false';
  effortSelect.value = localStorage.getItem('reasoningEffort') || 'high';
  effortLabel.style.display = thinkingToggle.checked ? '' : 'none';
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    settingUrl.value = data.apiBaseUrl || '';
    settingModel.value = data.model || '';
    settingKey.placeholder = data.hasKey ? '(已设置，留空则不修改)' : 'sk-...';
  } catch {}
});

thinkingToggle.addEventListener('change', () => {
  effortLabel.style.display = thinkingToggle.checked ? '' : 'none';
});

settingsClose.addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});

settingsSave.addEventListener('click', async () => {
  const body = {};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();
  // 保存思考模式设置到 localStorage
  localStorage.setItem('thinkingEnabled', thinkingToggle.checked);
  localStorage.setItem('reasoningEffort', effortSelect.value);

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      settingsOverlay.classList.add('hidden');
      settingKey.value = '';
    }
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
});

// ---- API 连接测试 ----
testBtn.addEventListener('click', async () => {
  testResult.className = 'test-msg';
  testResult.textContent = '测试中...';

  // 先保存当前输入，确保测试用的是最新配置
  const body = {};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();
  if (Object.keys(body).length) {
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  }

  try {
    const res = await fetch('/api/test', { method: 'POST' });
    const data = await res.json();
    testResult.className = data.ok ? 'test-msg test-ok' : 'test-msg test-fail';
    testResult.textContent = data.msg;
  } catch (err) {
    testResult.className = 'test-msg test-fail';
    testResult.textContent = '请求失败: ' + err.message;
  }
});

// ---- 获取模型列表 ----
fetchModelsBtn.addEventListener('click', async () => {
  fetchModelsBtn.disabled = true;
  fetchModelsBtn.textContent = '...';

  // 先保存当前输入的配置
  const body = {};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();
  if (Object.keys(body).length) {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    if (data.ok && data.models.length) {
      modelSelect.innerHTML = data.models.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
      modelSelectWrap.classList.remove('hidden');
      modelSelect.onchange = () => { settingModel.value = modelSelect.value; };
      settingModel.value = '';
    } else {
      modelSelectWrap.classList.add('hidden');
      alert(data.msg || '获取模型列表失败');
    }
  } catch (err) {
    modelSelectWrap.classList.add('hidden');
    alert('请求失败: ' + err.message);
  } finally {
    fetchModelsBtn.disabled = false;
    fetchModelsBtn.innerHTML = '&#128269;';
  }
});

// ---- 聊天功能 ----
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
});

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text && attachedFiles.length === 0) return;

  // 上传文件到后端解析
  const fileResults = await uploadFiles();

  // 存入消息（content 只存用户文本，files 存文件元数据）
  const userMsg = { role: 'user', content: text, files: fileResults };
  messages.push(userMsg);

  // 显示用户消息（文本 + 文件卡片）
  appendMessage('user', text, fileResults);

  userInput.value = '';
  userInput.style.height = 'auto';

  scheduleSave();
  setLoading(true);

  // 构建发给 API 的 messages（历史 + 用户消息 + 文件内容）
  const apiMessages = messages.slice(0, -1).map(m => {
    if (m.role === 'user' && m.files && m.files.length) {
      let full = m.content || '';
      for (const f of m.files) {
        if (f.text) full += `\n\n[文件内容: ${f.name}]\n${f.text}`;
      }
      return { role: 'user', content: full };
    }
    return { role: m.role, content: m.content || '' };
  });
  // 当前用户消息（文本 + 文件内容拼接）
  let fullUserText = text;
  for (const f of fileResults) {
    if (f.text) fullUserText += `\n\n[文件内容: ${f.name}]\n${f.text}`;
  }
  apiMessages.push({ role: 'user', content: fullUserText });

  const assistantIdx = messages.length;
  messages.push({ role: 'assistant', content: '' });
  const assistantBubble = appendMessage('assistant', '……');
  assistantBubble.style.opacity = '0.5';

  try {
    abortController = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        thinkingEnabled: localStorage.getItem('thinkingEnabled') !== 'false',
        reasoningEffort: localStorage.getItem('reasoningEffort') || 'high',
      }),
      signal: abortController.signal,
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            assistantBubble.textContent = parsed.error;
            assistantBubble.parentElement.className = 'message error';
            return;
          }

          // DeepSeek-R1 等模型的思考内容
          const reasoning = parsed.reasoning_content;
          if (reasoning) {
            fullReasoning += reasoning;
            updateReasoningDisplay(assistantBubble, fullReasoning);
            scrollToBottom();
          }

          if (parsed.content) {
            fullContent += parsed.content;
            assistantBubble.textContent = fullContent;
            assistantBubble.style.opacity = '1';
            scrollToBottom();
          }
        } catch {}
      }
    }

    messages[assistantIdx].content = fullContent;
    scheduleSave();

  } catch (err) {
    if (err.name === 'AbortError') return;
    assistantBubble.textContent = '请求失败: ' + err.message;
    assistantBubble.parentElement.className = 'message error';
  } finally {
    setLoading(false);
    abortController = null;
  }
});

// ---- 工具函数 ----
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// DeepSeek-R1 思考内容展示
function updateReasoningDisplay(bubble, text) {
  let el = bubble.querySelector('.reasoning-box');
  if (!el) {
    el = document.createElement('div');
    el.className = 'reasoning-box collapsed';

    const header = document.createElement('div');
    header.className = 'reasoning-header';
    header.innerHTML = '<span class="reasoning-toggle">&#9654;</span><span>&#128300; 已思考</span>';
    header.addEventListener('click', () => {
      el.classList.toggle('collapsed');
      header.querySelector('.reasoning-toggle').textContent =
        el.classList.contains('collapsed') ? '▶' : '▼';
    });

    const content = document.createElement('div');
    content.className = 'reasoning-content';
    content.textContent = text;

    el.appendChild(header);
    el.appendChild(content);
    bubble.prepend(el);
  } else {
    el.querySelector('.reasoning-content').textContent = text;
  }
}

function contentToString(content, files) {
  let s = content || '';
  if (files && files.length) {
    const names = files.map(f => f.name).join(', ');
    if (s) s += ' ';
    s += `[文件: ${names}]`;
  }
  return s;
}

function renderMessages() {
  messagesContainer.innerHTML = '';
  for (const msg of messages) {
    if (!msg.content && (!msg.files || !msg.files.length)) continue;
    appendMessage(msg.role, msg.content, msg.files);
  }
}

function appendMessage(role, content, files) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const label = document.createElement('div');
  label.className = 'role-label';
  label.textContent = role === 'user' ? '你' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  // 用户文本
  if (content) {
    bubble.textContent = content;
  }

  // 文件卡片
  if (files && files.length) {
    const container = document.createElement('div');
    container.className = 'msg-files';
    for (const f of files) {
      const card = document.createElement('div');
      card.className = 'file-card';
      const badgeCls = f.text ? 'badge-ok' : 'badge-fail';
      const badgeText = f.text ? '已解析' : '不支持解析';
      card.innerHTML = `
        <span class="file-card-icon">&#128196;</span>
        <span class="file-card-name">${escHtml(f.name)}</span>
        <span class="file-card-badge ${badgeCls}">${badgeText}</span>
      `;
      container.appendChild(card);
    }
    bubble.appendChild(container);
  }

  div.appendChild(label);
  div.appendChild(bubble);
  messagesContainer.appendChild(div);
  scrollToBottom();
  return bubble;
}

function setLoading(active) {
  loading.classList.toggle('hidden', !active);
  sendBtn.disabled = active;
  fileBtn.disabled = active;
}

function scrollToBottom() {
  const container = document.getElementById('chat-container');
  container.scrollTop = container.scrollHeight;
}

// ---- 初始化 ----
loadConvList();
