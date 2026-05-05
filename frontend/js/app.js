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
const thinkCheck = document.getElementById('think-check');
const thinkEffort = document.getElementById('think-effort');
const settingTemp = document.getElementById('setting-temp');
const tempVal = document.getElementById('temp-val');
const settingTopp = document.getElementById('setting-topp');
const toppVal = document.getElementById('topp-val');

const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const convList = document.getElementById('conv-list');
const newChatBtn = document.getElementById('new-chat-btn');

let messages = [];
let currentConvId = null;
let abortController = null;
let saveTimer = null;
let attachedFiles = []; // {file, name, size, type}
let isStreaming = false;

// ---- Markdown 渲染 ----
function mdRender(text) {
  if (!text) return '';
  // 先转义 HTML
  let h = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 代码块 (```lang\n...\n```)
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const cls = lang ? ` class="lang-${escHtml(lang)}"` : '';
    return `<pre><code${cls}>${code.trim()}</code></pre>`;
  });

  // 行内代码 `code`
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 标题
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 加粗 **text**
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // 斜体 *text*
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // 删除线 ~~text~~
  h = h.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 链接 [text](url)
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // 引用 > text
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 无序列表 - item
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // 有序列表 1. item
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, (m) => m.includes('<ul>') ? m : '<ol>' + m + '</ol>');

  // 段落（连续两行换行分割）
  const paragraphs = h.split(/\n\n+/);
  if (paragraphs.length > 1) {
    h = paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      if (/^<(h[123]|pre|ul|ol|blockquote|li)/.test(p)) return p;
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');
  } else {
    h = h.replace(/\n/g, '<br>');
  }

  return h;
}

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
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false;
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
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false;
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
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    settingUrl.value = data.apiBaseUrl || '';
    settingModel.value = data.model || '';
    settingKey.placeholder = data.hasKey ? '(已设置，留空则不修改)' : 'sk-...';
  } catch {}
});

settingsClose.addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});

// 设置页标签切换
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

settingsSave.addEventListener('click', async () => {
  const body = {};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();

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

// ---- 主题背景 ----
function applyBg(name) {
  document.body.className = 'bg-' + name;
  localStorage.setItem('bgTheme', name);
  document.querySelectorAll('.bg-option').forEach(el => {
    el.classList.toggle('active', el.dataset.bg === name);
  });
}
applyBg(localStorage.getItem('bgTheme') || 'light');

document.querySelectorAll('.bg-option').forEach(el => {
  el.addEventListener('click', () => applyBg(el.dataset.bg));
});

// ---- 模型参数滑块 ----
function loadParams() {
  settingTemp.value = localStorage.getItem('temperature') || '1';
  settingTopp.value = localStorage.getItem('top_p') || '1';
  tempVal.textContent = parseFloat(settingTemp.value).toFixed(1);
  toppVal.textContent = parseFloat(settingTopp.value).toFixed(2);
}
loadParams();

settingTemp.addEventListener('input', () => {
  tempVal.textContent = parseFloat(settingTemp.value).toFixed(1);
  localStorage.setItem('temperature', settingTemp.value);
});
settingTopp.addEventListener('input', () => {
  toppVal.textContent = parseFloat(settingTopp.value).toFixed(2);
  localStorage.setItem('top_p', settingTopp.value);
});

// ---- API 连接测试 ----
testBtn.addEventListener('click', async () => {
  testResult.className = 'test-msg';
  testResult.textContent = '测试中...';

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
  if (isStreaming) { stopStreaming(); return; }

  const fileResults = await uploadFiles();

  const userMsg = { role: 'user', content: text, files: fileResults };
  messages.push(userMsg);
  appendMessage('user', text, fileResults);

  userInput.value = '';
  userInput.style.height = 'auto';

  scheduleSave();
  setLoading(true);
  showStopBtn();

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
  let fullUserText = text;
  for (const f of fileResults) {
    if (f.text) fullUserText += `\n\n[文件内容: ${f.name}]\n${f.text}`;
  }
  apiMessages.push({ role: 'user', content: fullUserText });

  const assistantIdx = messages.length;
  messages.push({ role: 'assistant', content: '' });
  const assistantBubble = appendMessage('assistant', '……');
  const assistantText = assistantBubble.querySelector('.assistant-text');
  if (assistantText) assistantText.style.opacity = '0.5';

  isStreaming = true;

  try {
    abortController = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        thinkingEnabled: thinkCheck.checked,
        reasoningEffort: thinkEffort.value,
        temperature: parseFloat(settingTemp.value),
        top_p: parseFloat(settingTopp.value),
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
            if (assistantText) assistantText.textContent = parsed.error;
            else assistantBubble.textContent = parsed.error;
            assistantBubble.parentElement.className = 'message error';
            isStreaming = false;
            return;
          }

          const reasoning = parsed.reasoning_content;
          if (reasoning) {
            fullReasoning += reasoning;
            messages[assistantIdx].reasoning = fullReasoning;
            updateReasoningDisplay(assistantBubble, fullReasoning);
            scrollToBottom();
          }

          if (parsed.content) {
            fullContent += parsed.content;
            messages[assistantIdx].content = fullContent;
            if (assistantText) {
              assistantText.innerHTML = mdRender(fullContent);
              assistantText.style.opacity = '1';
            } else {
              assistantBubble.innerHTML = mdRender(fullContent);
            }
            scrollToBottom();
          }
        } catch {}
      }
    }

    messages[assistantIdx].content = fullContent;
    if (fullReasoning) messages[assistantIdx].reasoning = fullReasoning;
    scheduleSave();

  } catch (err) {
    if (err.name === 'AbortError') return;
    const errMsg = '请求失败: ' + err.message;
    if (assistantText) assistantText.textContent = errMsg;
    else assistantBubble.textContent = errMsg;
    assistantBubble.parentElement.className = 'message error';
  } finally {
    setLoading(false);
    hideStopBtn();
    isStreaming = false;
    abortController = null;
  }
});

function stopStreaming() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isStreaming = false;
  setLoading(false);
  hideStopBtn();
  // 保存已收到的 partial 内容
  if (messages.length) scheduleSave();
}

// ---- 停止生成按钮 ----
function showStopBtn() {
  sendBtn.textContent = '停止';
  sendBtn.className = 'btn-stop';
}

function hideStopBtn() {
  sendBtn.textContent = '发送';
  sendBtn.className = '';
}

// ---- 复制消息 ----
function addCopyBtn(bubble, content) {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.title = '复制';
  btn.innerHTML = '&#128203;';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      btn.innerHTML = '&#10003;';
      btn.style.color = '#52c41a';
      setTimeout(() => { btn.innerHTML = '&#128203;'; btn.style.color = ''; }, 1500);
    } catch {}
  });
  bubble.appendChild(btn);
}

// ---- 重新生成 ----
function regenerateLast() {
  if (isStreaming) return;
  // 找到最后一条 assistant 消息并移除
  let lastAsstIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') { lastAsstIdx = i; break; }
  }
  if (lastAsstIdx === -1) return;
  messages.splice(lastAsstIdx, 1);
  // 重新提交（模拟表单提交）
  renderMessages();
  scrollToBottom();
  // 取最后一条 user 消息的内容重新触发
  const lastUser = messages[messages.length - 1];
  if (lastUser && lastUser.role === 'user') {
    const text = typeof lastUser.content === 'string' ? lastUser.content : '';
    attachedFiles = lastUser.files ? lastUser.files.map(f => ({ file: null, name: f.name, size: 0, type: '.' + f.name.split('.').pop() })) : [];
    // 用已有数据触发提交（绕过表单验证）
    doSubmit(text, lastUser.files || []);
  }
}

async function doSubmit(text, files) {
  if (isStreaming) return;
  const fileResults = await uploadFiles();
  // 如果有遗留文件，合并
  for (const f of files) { if (!fileResults.find(r => r.name === f.name)) fileResults.push(f); }
  attachedFiles = [];

  const userMsg = { role: 'user', content: text, files: fileResults };
  messages.push(userMsg);
  appendMessage('user', text, fileResults);

  scheduleSave();
  setLoading(true);
  showStopBtn();

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
  let fullUserText = text;
  for (const f of fileResults) {
    if (f.text) fullUserText += `\n\n[文件内容: ${f.name}]\n${f.text}`;
  }
  apiMessages.push({ role: 'user', content: fullUserText });

  const assistantIdx = messages.length;
  messages.push({ role: 'assistant', content: '' });
  const assistantBubble = appendMessage('assistant', '……');
  const assistantText = assistantBubble.querySelector('.assistant-text');
  if (assistantText) assistantText.style.opacity = '0.5';

  isStreaming = true;

  try {
    abortController = new AbortController();
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        thinkingEnabled: thinkCheck.checked,
        reasoningEffort: thinkEffort.value,
        temperature: parseFloat(settingTemp.value),
        top_p: parseFloat(settingTopp.value),
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
            if (assistantText) assistantText.textContent = parsed.error;
            else assistantBubble.textContent = parsed.error;
            assistantBubble.parentElement.className = 'message error';
            isStreaming = false;
            return;
          }
          const reasoning = parsed.reasoning_content;
          if (reasoning) {
            fullReasoning += reasoning;
            messages[assistantIdx].reasoning = fullReasoning;
            updateReasoningDisplay(assistantBubble, fullReasoning);
            scrollToBottom();
          }
          if (parsed.content) {
            fullContent += parsed.content;
            messages[assistantIdx].content = fullContent;
            if (assistantText) {
              assistantText.innerHTML = mdRender(fullContent);
              assistantText.style.opacity = '1';
            } else {
              assistantBubble.innerHTML = mdRender(fullContent);
            }
            scrollToBottom();
          }
        } catch {}
      }
    }
    messages[assistantIdx].content = fullContent;
    if (fullReasoning) messages[assistantIdx].reasoning = fullReasoning;
    scheduleSave();
  } catch (err) {
    if (err.name === 'AbortError') return;
    const errMsg = '请求失败: ' + err.message;
    if (assistantText) assistantText.textContent = errMsg;
    else assistantBubble.textContent = errMsg;
    assistantBubble.parentElement.className = 'message error';
  } finally {
    setLoading(false);
    hideStopBtn();
    isStreaming = false;
    abortController = null;
  }
}

// ---- 工具函数 ----
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

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
    appendMessage(msg.role, msg.content, msg.files, msg.reasoning);
  }
}

function appendMessage(role, content, files, reasoning) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const label = document.createElement('div');
  label.className = 'role-label';
  label.textContent = role === 'user' ? '你' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (role === 'assistant') {
    if (reasoning) {
      const box = document.createElement('div');
      box.className = 'reasoning-box collapsed';
      const header = document.createElement('div');
      header.className = 'reasoning-header';
      header.innerHTML = '<span class="reasoning-toggle">&#9654;</span><span>&#128300; 已思考</span>';
      header.addEventListener('click', () => {
        box.classList.toggle('collapsed');
        header.querySelector('.reasoning-toggle').textContent =
          box.classList.contains('collapsed') ? '▶' : '▼';
      });
      const rc = document.createElement('div');
      rc.className = 'reasoning-content';
      rc.textContent = reasoning;
      box.appendChild(header);
      box.appendChild(rc);
      bubble.appendChild(box);
    }
    const textEl = document.createElement('div');
    textEl.className = 'assistant-text';
    if (content) textEl.innerHTML = mdRender(content);
    bubble.appendChild(textEl);
    addCopyBtn(bubble, content || '');
  } else {
    if (content) {
      const textEl = document.createElement('div');
      textEl.className = 'user-text';
      textEl.textContent = content;
      bubble.appendChild(textEl);
    }
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
    addCopyBtn(bubble, content || '');
  }

  div.appendChild(label);
  div.appendChild(bubble);

  // 操作按钮（重新生成、token 计数）
  if (role === 'assistant' && content) {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    // 重新生成
    const regenBtn = document.createElement('button');
    regenBtn.className = 'action-btn';
    regenBtn.title = '重新生成';
    regenBtn.innerHTML = '&#8635;';
    regenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      regenerateLast();
    });
    actions.appendChild(regenBtn);

    // Token 估算（~4 chars/token）
    const tCount = Math.max(1, Math.round(content.length / 4));
    const tokEl = document.createElement('span');
    tokEl.className = 'token-count';
    tokEl.textContent = `~${tCount} tokens`;
    tokEl.title = '估算值（~4 字符/token）';
    actions.appendChild(tokEl);

    div.appendChild(actions);
  }

  messagesContainer.appendChild(div);
  scrollToBottom();
  return bubble;
}

function setLoading(active) {
  loading.classList.toggle('hidden', !active);
  fileBtn.disabled = active;
}

function scrollToBottom() {
  const container = document.getElementById('chat-container');
  container.scrollTop = container.scrollHeight;
}

// ---- 初始化 ----
loadConvList();
