// ---- i18n ----
const LANG = {
  zh: {
    think:'思考', send:'发送', stop:'停止', settings:'设置', save:'保存',
    appearance:'外观', about:'关于', api_url:'API 地址', model:'模型',
    api_key:'API 密钥', system_prompt:'系统提示词', model_settings:'模型设置', settings_hint:'修改后自动保存，重启服务后仍然有效',
    test_btn:'测试 API 连接', theme:'主题背景', language:'语言',
    light:'明亮', dark:'暗色', warm:'暖色',
    gradient_blue:'渐变蓝', gradient_green:'渐变绿', gradient_sunset:'日落',
    input_placeholder:'输入消息，Enter 发送，Shift+Enter 换行...',
    new_chat:'+ 新对话', export_btn:'导出对话', search_placeholder:'搜索对话...',
    no_conv:'暂无对话', file_limit:'文件 {{name}} 超过 10MB 限制',
    copy:'复制', regenerate:'重新生成', parsed:'已解析', not_supported:'不支持解析',
    no_file:'不支持解析', thinking:'思考中...', thought:'已思考',
    conv_title_new:'新对话', error_prefix:'请求失败: ',
    settings_saved:'保存失败: ',
    test_ok:'连接成功！响应: ', test_fail:'请先配置 API_KEY',
    fetch_models_fail:'获取模型列表失败',
    export_title:'导出对话', export_md:'导出 Markdown', export_json:'导出 JSON',
    token_label:'~{{n}} tokens',
  },
  en: {
    think:'Think', send:'Send', stop:'Stop', settings:'Settings', save:'Save',
    appearance:'Appearance', about:'About', api_url:'API URL', model:'Model',
    api_key:'API Key', system_prompt:'System Prompt', model_settings:'Model', settings_hint:'Auto-saved. Persists after restart.',
    test_btn:'Test API Connection', theme:'Background', language:'Language',
    light:'Light', dark:'Dark', warm:'Warm',
    gradient_blue:'Blue Gradient', gradient_green:'Green Gradient', gradient_sunset:'Sunset',
    input_placeholder:'Type a message, Enter to send, Shift+Enter for new line...',
    new_chat:'+ New Chat', export_btn:'Export', search_placeholder:'Search conversations...',
    no_conv:'No conversations yet', file_limit:'File {{name}} exceeds 10MB limit',
    copy:'Copy', regenerate:'Regenerate', parsed:'Parsed', not_supported:'Unsupported',
    no_file:'Unsupported', thinking:'Thinking...', thought:'Thought',
    conv_title_new:'New Chat', error_prefix:'Request failed: ',
    settings_saved:'Save failed: ',
    test_ok:'Connected! Response: ', test_fail:'Please configure API_KEY first',
    fetch_models_fail:'Failed to fetch models',
    export_title:'Export', export_md:'Export Markdown', export_json:'Export JSON',
    token_label:'~{{n}} tokens',
  }
};

let lang = localStorage.getItem('lang') || 'zh';

function t(key, vars) {
  let s = (LANG[lang] && LANG[lang][key]) || (LANG.zh[key]) || key;
  if (vars) for (const [k,v] of Object.entries(vars)) s = s.replace('{{'+k+'}}', v);
  return s;
}

function applyLang() {
  lang = localStorage.getItem('lang') || 'zh';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    // 只替换文本节点，不清掉子元素
    const key = el.dataset.i18n;
    if (el.children.length === 0) { el.textContent = t(key); }
    else {
      // 有子元素的只替换第一个文本节点
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      const firstText = walker.nextNode();
      if (firstText && firstText.textContent.trim()) firstText.textContent = t(key);
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t(el.dataset.i18nPlaceholder));
  document.getElementById('lang-select').value = lang;
}
applyLang();

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
const settingSystem = document.getElementById('setting-system');
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
const exportBtn = document.getElementById('export-btn');
const searchInput = document.getElementById('search-input');
const langSelect = document.getElementById('lang-select');

const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const convList = document.getElementById('conv-list');
const newChatBtn = document.getElementById('new-chat-btn');
const chatContainer = document.getElementById('chat-container');

let messages = [];
let currentConvId = null;
let abortController = null;
let saveTimer = null;
let attachedFiles = [];
let isStreaming = false;

// ---- i18n: lang switch ----
langSelect.addEventListener('change', () => {
  localStorage.setItem('lang', langSelect.value);
  applyLang();
  // 刷新对话列表以更新 conv-empty
  loadConvList();
});

// ---- Markdown 渲染 ----
function mdRender(text) {
  if (!text) return '';
  let h = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, l, c) => {
    const cls = l ? ` class="lang-${escHtml(l)}"` : '';
    return `<pre><code${cls}>${c.trim()}</code></pre>`;
  });
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/~~(.+?)~~/g, '<del>$1</del>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, m => m.includes('<ul>') ? m : '<ol>' + m + '</ol>');
  const paras = h.split(/\n\n+/);
  if (paras.length > 1) {
    h = paras.map(p => { p = p.trim(); if (!p) return ''; return /^<(h[123]|pre|ul|ol|blockquote|li)/.test(p) ? p : '<p>' + p.replace(/\n/g,'<br>') + '</p>'; }).join('\n');
  } else h = h.replace(/\n/g, '<br>');
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
    if (file.size > 10 * 1024 * 1024) { alert(t('file_limit',{name:file.name})); continue; }
    attachedFiles.push({ file, name: file.name, size: file.size, type: ext });
  }
  fileInput.value = '';
  renderFilePreviews();
});

// ---- 拖拽上传 ----
chatContainer.addEventListener('dragenter', (e) => { e.preventDefault(); chatContainer.classList.add('drag-over'); });
chatContainer.addEventListener('dragover', (e) => { e.preventDefault(); chatContainer.classList.add('drag-over'); });
chatContainer.addEventListener('dragleave', () => { chatContainer.classList.remove('drag-over'); });
chatContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  chatContainer.classList.remove('drag-over');
  for (const file of e.dataTransfer.files) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    if (file.size > 10 * 1024 * 1024) { alert(t('file_limit',{name:file.name})); continue; }
    attachedFiles.push({ file, name: file.name, size: file.size, type: ext });
  }
  renderFilePreviews();
});

function renderFilePreviews() {
  if (attachedFiles.length === 0) { filePreviews.classList.add('hidden'); return; }
  filePreviews.classList.remove('hidden');
  filePreviews.innerHTML = attachedFiles.map((f, i) =>
    `<span class="file-chip">${escHtml(f.name)} <button data-idx="${i}" class="file-chip-del">&times;</button></span>`
  ).join('');
  filePreviews.querySelectorAll('.file-chip-del').forEach(btn => {
    btn.addEventListener('click', () => { attachedFiles.splice(parseInt(btn.dataset.idx), 1); renderFilePreviews(); });
  });
}

async function uploadFiles() {
  if (attachedFiles.length === 0) return [];
  const results = [];
  for (const af of attachedFiles) {
    const fd = new FormData(); fd.append('file', af.file);
    try { const r = await (await fetch('/api/upload',{method:'POST',body:fd})).json(); results.push({name:r.name,text:r.text||''}); }
    catch { results.push({name:af.name,text:''}); }
  }
  attachedFiles = []; renderFilePreviews();
  return results;
}

// ---- 侧边栏 ----
sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('hidden-mobile'); sidebar.classList.toggle('show-mobile'); });
document.addEventListener('click', (e) => {
  if (window.innerWidth > 700) return;
  if (!sidebar.contains(e.target) && e.target !== sidebarToggle) { sidebar.classList.add('hidden-mobile'); sidebar.classList.remove('show-mobile'); }
});

// ---- 对话搜索 ----
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  document.querySelectorAll('.conv-item').forEach(el => {
    const title = el.querySelector('.conv-title').textContent.toLowerCase();
    el.style.display = (!q || title.includes(q)) ? '' : 'none';
  });
});

// ---- 对话列表 ----
async function loadConvList() {
  try {
    const list = await (await fetch('/api/conversations')).json();
    convList.innerHTML = '';
    if (list.length === 0) { convList.innerHTML = '<div class="conv-empty">' + t('no_conv') + '</div>'; return; }
    for (const conv of list) {
      const item = document.createElement('div');
      item.className = 'conv-item' + (conv.id === currentConvId ? ' active' : '');
      item.innerHTML = `<span class="conv-title">${escHtml(conv.title || t('conv_title_new'))}</span><button class="conv-del" data-id="${conv.id}">&times;</button>`;
      item.addEventListener('click', (e) => { if (e.target.closest('.conv-del')) return; switchConv(conv.id); });
      item.querySelector('.conv-del').addEventListener('click', async (e) => { e.stopPropagation(); await deleteConv(conv.id); });
      convList.appendChild(item);
    }
  } catch {}
}

async function switchConv(id) {
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false;
  if (currentConvId) await saveCurrentConv();
  try {
    const conv = await (await fetch(`/api/conversations/${id}`)).json();
    currentConvId = conv.id; messages = conv.messages || []; renderMessages(); loadConvList();
    if (window.innerWidth <= 700) { sidebar.classList.add('hidden-mobile'); sidebar.classList.remove('show-mobile'); }
  } catch (err) { console.error('Failed to load conversation', err); }
}

async function deleteConv(id) {
  try {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (currentConvId === id) { currentConvId = null; messages = []; renderMessages(); }
    loadConvList();
  } catch {}
}

newChatBtn.addEventListener('click', async () => {
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (currentConvId && messages.filter(m => m.content).length > 0) await saveCurrentConv();
  currentConvId = null; messages = []; attachedFiles = []; renderFilePreviews(); renderMessages(); loadConvList();
  userInput.focus();
  if (window.innerWidth <= 700) { sidebar.classList.add('hidden-mobile'); sidebar.classList.remove('show-mobile'); }
});

// ---- 导出对话 ----
exportBtn.addEventListener('click', () => {
  if (!messages.length) return;
  const title = (messages.find(m => m.role==='user')?.content || 'export').slice(0,30);

  // Markdown
  let md = `# ${title}\n\n`;
  for (const m of messages) {
    const name = m.role === 'user' ? 'You' : 'AI';
    md += `**${name}:**\n${m.content || ''}\n\n`;
  }
  downloadFile(md, title + '.md', 'text/markdown');

  // 也导出 JSON
  const json = JSON.stringify({ title, messages, exportedAt: new Date().toISOString() }, null, 2);
  downloadFile(json, title + '.json', 'application/json');
});

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
}

// ---- 自动保存 ----
function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveCurrentConv, 1500); }
async function saveCurrentConv() {
  saveTimer = null;
  const filtered = messages.filter(m => m.content);
  if (filtered.length === 0) return;
  const savedId = currentConvId;
  try {
    const data = await (await fetch('/api/conversations', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:savedId, messages:filtered}) })).json();
    if (data.id && currentConvId === savedId) currentConvId = data.id;
    loadConvList();
  } catch {}
}

// ---- 设置 ----
settingsBtn.addEventListener('click', async () => {
  settingsOverlay.classList.remove('hidden');
  settingSystem.value = localStorage.getItem('systemPrompt') || '';
  try {
    const s = await (await fetch('/api/settings')).json();
    settingUrl.value = s.apiBaseUrl || ''; settingModel.value = s.model || '';
    settingKey.placeholder = s.hasKey ? t('api_key') + ' (已设置)' : 'sk-...';
  } catch {}
});
settingsClose.addEventListener('click', () => settingsOverlay.classList.add('hidden'));

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
  localStorage.setItem('systemPrompt', settingSystem.value);
  try {
    await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    settingsOverlay.classList.add('hidden'); settingKey.value = '';
  } catch (err) { alert(t('settings_saved') + err.message); }
});

// ---- 主题背景 ----
function applyBg(name) {
  document.body.className = 'bg-' + name;
  localStorage.setItem('bgTheme', name);
  document.querySelectorAll('.bg-option').forEach(el => el.classList.toggle('active', el.dataset.bg === name));
}
applyBg(localStorage.getItem('bgTheme') || 'light');
document.querySelectorAll('.bg-option').forEach(el => el.addEventListener('click', () => applyBg(el.dataset.bg)));

// ---- 模型参数 ----
function loadParams() {
  settingTemp.value = localStorage.getItem('temperature') || '1'; settingTopp.value = localStorage.getItem('top_p') || '1';
  tempVal.textContent = parseFloat(settingTemp.value).toFixed(1); toppVal.textContent = parseFloat(settingTopp.value).toFixed(2);
}
loadParams();
settingTemp.addEventListener('input', () => { tempVal.textContent = parseFloat(settingTemp.value).toFixed(1); localStorage.setItem('temperature', settingTemp.value); });
settingTopp.addEventListener('input', () => { toppVal.textContent = parseFloat(settingTopp.value).toFixed(2); localStorage.setItem('top_p', settingTopp.value); });

// ---- API 测试 ----
testBtn.addEventListener('click', async () => {
  testResult.className = 'test-msg'; testResult.textContent = '...';
  const body = {};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();
  if (Object.keys(body).length) await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    const data = await (await fetch('/api/test',{method:'POST'})).json();
    testResult.className = data.ok ? 'test-msg test-ok' : 'test-msg test-fail';
    testResult.textContent = data.ok ? t('test_ok') + (data.msg||'') : data.msg;
  } catch (err) { testResult.className = 'test-msg test-fail'; testResult.textContent = t('error_prefix') + err.message; }
});

// ---- 模型列表 ----
fetchModelsBtn.addEventListener('click', async () => {
  fetchModelsBtn.disabled = true; fetchModelsBtn.textContent = '...';
  const body = {};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();
  if (Object.keys(body).length) await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    const data = await (await fetch('/api/models')).json();
    if (data.ok && data.models.length) {
      modelSelect.innerHTML = data.models.map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('');
      modelSelectWrap.classList.remove('hidden');
      modelSelect.onchange = () => { settingModel.value = modelSelect.value; };
      settingModel.value = '';
    } else { modelSelectWrap.classList.add('hidden'); alert(data.msg || t('fetch_models_fail')); }
  } catch (err) { modelSelectWrap.classList.add('hidden'); alert(t('error_prefix') + err.message); }
  finally { fetchModelsBtn.disabled = false; fetchModelsBtn.innerHTML = '&#128269;'; }
});

// ---- 聊天（核心） ----
userInput.addEventListener('input', () => { userInput.style.height = 'auto'; userInput.style.height = Math.min(userInput.scrollHeight,120)+'px'; });
userInput.addEventListener('keydown', (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); } });

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text && attachedFiles.length === 0) return;
  if (isStreaming) { stopStreaming(); return; }

  const fileResults = await uploadFiles();
  const userMsg = { role:'user', content:text, files:fileResults };
  messages.push(userMsg);
  appendMessage('user', text, fileResults);
  userInput.value = ''; userInput.style.height = 'auto';
  scheduleSave(); setLoading(true); showStopBtn();

  // 构建 API messages（含 system prompt）
  const systemPrompt = localStorage.getItem('systemPrompt') || '';
  const apiMessages = systemPrompt ? [{ role:'system', content:systemPrompt }] : [];

  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    if (m.role === 'user' && m.files && m.files.length) {
      let full = m.content || '';
      for (const f of m.files) { if (f.text) full += '\n\n[文件内容: ' + f.name + ']\n' + f.text; }
      apiMessages.push({ role:'user', content:full });
    } else apiMessages.push({ role:m.role, content:m.content || '' });
  }
  let fullUserText = text;
  for (const f of fileResults) { if (f.text) fullUserText += '\n\n[文件内容: ' + f.name + ']\n' + f.text; }
  apiMessages.push({ role:'user', content:fullUserText });

  const assistantIdx = messages.length;
  messages.push({ role:'assistant', content:'' });
  const assistantBubble = appendMessage('assistant', '……');
  const assistantText = assistantBubble.querySelector('.assistant-text');
  if (assistantText) assistantText.style.opacity = '0.5';
  isStreaming = true;

  try {
    abortController = new AbortController();
    const response = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages:apiMessages, thinkingEnabled:thinkCheck.checked, reasoningEffort:thinkEffort.value, temperature:parseFloat(settingTemp.value), top_p:parseFloat(settingTopp.value) }),
      signal: abortController.signal,
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder(); let buffer = ''; let fullContent = ''; let fullReasoning = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, {stream:true});
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim(); if (!t.startsWith('data: ')) continue;
        const d = t.slice(6); if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          if (p.error) { (assistantText||assistantBubble).textContent = p.error; assistantBubble.parentElement.className = 'message error'; isStreaming=false; return; }
          const r = p.reasoning_content;
          if (r) { fullReasoning += r; messages[assistantIdx].reasoning = fullReasoning; updateReasoningDisplay(assistantBubble, fullReasoning); scrollToBottom(); }
          if (p.content) {
            fullContent += p.content; messages[assistantIdx].content = fullContent;
            if (assistantText) { assistantText.innerHTML = mdRender(fullContent); assistantText.style.opacity = '1'; }
            else assistantBubble.innerHTML = mdRender(fullContent);
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
    const em = t('error_prefix') + err.message;
    if (assistantText) assistantText.textContent = em; else assistantBubble.textContent = em;
    assistantBubble.parentElement.className = 'message error';
  } finally { setLoading(false); hideStopBtn(); isStreaming = false; abortController = null; }
});

function stopStreaming() {
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false; setLoading(false); hideStopBtn();
  if (messages.length) scheduleSave();
}
function showStopBtn() { sendBtn.textContent = t('stop'); sendBtn.className = 'btn-stop'; }
function hideStopBtn() { sendBtn.textContent = t('send'); sendBtn.className = ''; }

// ---- 重新生成 ----
function regenerateLast() {
  if (isStreaming) return;
  let idx = -1;
  for (let i = messages.length-1; i>=0; i--) { if (messages[i].role==='assistant') { idx=i; break; } }
  if (idx===-1) return;
  messages.splice(idx,1); renderMessages(); scrollToBottom();
  const last = messages[messages.length-1];
  if (last && last.role==='user') {
    const t2 = typeof last.content==='string' ? last.content : '';
    attachedFiles = last.files ? last.files.map(f => ({file:null, name:f.name, size:0, type:'.'+f.name.split('.').pop()})) : [];
    doSubmit(t2, last.files||[]);
  }
}

async function doSubmit(text, files) {
  if (isStreaming) return;
  const fileResults = await uploadFiles();
  for (const f of files) { if (!fileResults.find(r=>r.name===f.name)) fileResults.push(f); }
  attachedFiles = [];
  const userMsg = { role:'user', content:text, files:fileResults };
  messages.push(userMsg); appendMessage('user', text, fileResults);
  scheduleSave(); setLoading(true); showStopBtn();

  const systemPrompt = localStorage.getItem('systemPrompt') || '';
  const apiMessages = systemPrompt ? [{role:'system', content:systemPrompt}] : [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    if (m.role==='user' && m.files && m.files.length) {
      let full = m.content||'';
      for (const f of m.files) { if (f.text) full += '\n\n[文件内容: ' + f.name + ']\n' + f.text; }
      apiMessages.push({role:'user', content:full});
    } else apiMessages.push({role:m.role, content:m.content||''});
  }
  let fullUserText = text;
  for (const f of fileResults) { if (f.text) fullUserText += '\n\n[文件内容: ' + f.name + ']\n' + f.text; }
  apiMessages.push({role:'user', content:fullUserText});

  const assistantIdx = messages.length;
  messages.push({role:'assistant', content:''});
  const assistantBubble = appendMessage('assistant', '……');
  const assistantText = assistantBubble.querySelector('.assistant-text');
  if (assistantText) assistantText.style.opacity = '0.5';
  isStreaming = true;

  try {
    abortController = new AbortController();
    const response = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages:apiMessages, thinkingEnabled:thinkCheck.checked, reasoningEffort:thinkEffort.value, temperature:parseFloat(settingTemp.value), top_p:parseFloat(settingTopp.value) }),
      signal: abortController.signal,
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder(); let buffer = ''; let fullContent = ''; let fullReasoning = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, {stream:true});
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim(); if (!t.startsWith('data: ')) continue;
        const d = t.slice(6); if (d === '[DONE]') continue;
        try {
          const p = JSON.parse(d);
          if (p.error) { (assistantText||assistantBubble).textContent = p.error; assistantBubble.parentElement.className = 'message error'; isStreaming=false; return; }
          const r = p.reasoning_content;
          if (r) { fullReasoning += r; messages[assistantIdx].reasoning = fullReasoning; updateReasoningDisplay(assistantBubble, fullReasoning); scrollToBottom(); }
          if (p.content) {
            fullContent += p.content; messages[assistantIdx].content = fullContent;
            if (assistantText) { assistantText.innerHTML = mdRender(fullContent); assistantText.style.opacity = '1'; }
            else assistantBubble.innerHTML = mdRender(fullContent);
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
    const em = t('error_prefix') + err.message;
    if (assistantText) assistantText.textContent = em; else assistantBubble.textContent = em;
    assistantBubble.parentElement.className = 'message error';
  } finally { setLoading(false); hideStopBtn(); isStreaming = false; abortController = null; }
}

// ---- 复制 ----
function addCopyBtn(bubble, content) {
  const btn = document.createElement('button'); btn.className = 'copy-btn'; btn.title = t('copy');
  btn.innerHTML = '&#128203;';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(content); btn.innerHTML = '&#10003;'; btn.style.color = '#52c41a'; setTimeout(() => { btn.innerHTML = '&#128203;'; btn.style.color = ''; }, 1500); } catch {}
  });
  bubble.appendChild(btn);
}

// ---- 工具 ----
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function updateReasoningDisplay(bubble, text) {
  let el = bubble.querySelector('.reasoning-box');
  if (!el) {
    el = document.createElement('div'); el.className = 'reasoning-box collapsed';
    const hdr = document.createElement('div'); hdr.className = 'reasoning-header';
    hdr.innerHTML = '<span class="reasoning-toggle">&#9654;</span><span>&#128300; '+t('thought')+'</span>';
    hdr.addEventListener('click', () => { el.classList.toggle('collapsed'); hdr.querySelector('.reasoning-toggle').textContent = el.classList.contains('collapsed') ? '▶' : '▼'; });
    const rc = document.createElement('div'); rc.className = 'reasoning-content'; rc.textContent = text;
    el.appendChild(hdr); el.appendChild(rc); bubble.prepend(el);
  } else el.querySelector('.reasoning-content').textContent = text;
}

function renderMessages() {
  messagesContainer.innerHTML = '';
  for (const msg of messages) {
    if (!msg.content && (!msg.files || !msg.files.length)) continue;
    appendMessage(msg.role, msg.content, msg.files, msg.reasoning);
  }
}

function appendMessage(role, content, files, reasoning) {
  const div = document.createElement('div'); div.className = `message ${role}`;
  const label = document.createElement('div'); label.className = 'role-label'; label.textContent = role === 'user' ? 'You' : 'AI';
  const bubble = document.createElement('div'); bubble.className = 'bubble';

  if (role === 'assistant') {
    if (reasoning) {
      const box = document.createElement('div'); box.className = 'reasoning-box collapsed';
      const hdr = document.createElement('div'); hdr.className = 'reasoning-header';
      hdr.innerHTML = '<span class="reasoning-toggle">&#9654;</span><span>&#128300; '+t('thought')+'</span>';
      hdr.addEventListener('click', () => { box.classList.toggle('collapsed'); hdr.querySelector('.reasoning-toggle').textContent = box.classList.contains('collapsed') ? '▶' : '▼'; });
      const rc = document.createElement('div'); rc.className = 'reasoning-content'; rc.textContent = reasoning;
      box.appendChild(hdr); box.appendChild(rc); bubble.appendChild(box);
    }
    const textEl = document.createElement('div'); textEl.className = 'assistant-text';
    if (content) textEl.innerHTML = mdRender(content);
    bubble.appendChild(textEl); addCopyBtn(bubble, content||'');
  } else {
    if (content) { const te = document.createElement('div'); te.className = 'user-text'; te.textContent = content; bubble.appendChild(te); }
    if (files && files.length) {
      const c = document.createElement('div'); c.className = 'msg-files';
      for (const f of files) {
        const card = document.createElement('div'); card.className = 'file-card';
        card.innerHTML = `<span class="file-card-icon">&#128196;</span><span class="file-card-name">${escHtml(f.name)}</span><span class="file-card-badge ${f.text?'badge-ok':'badge-fail'}">${f.text ? t('parsed') : t('not_supported')}</span>`;
        c.appendChild(card);
      }
      bubble.appendChild(c);
    }
    addCopyBtn(bubble, content||'');
  }

  div.appendChild(label); div.appendChild(bubble);

  if (role === 'assistant' && content) {
    const actions = document.createElement('div'); actions.className = 'msg-actions';
    const regen = document.createElement('button'); regen.className = 'action-btn'; regen.title = t('regenerate'); regen.innerHTML = '&#8635;';
    regen.addEventListener('click', (e) => { e.stopPropagation(); regenerateLast(); });
    actions.appendChild(regen);
    const tok = document.createElement('span'); tok.className = 'token-count';
    tok.textContent = t('token_label',{n:Math.max(1,Math.round(content.length/4))});
    tok.title = '~4 chars/token';
    actions.appendChild(tok);
    div.appendChild(actions);
  }

  messagesContainer.appendChild(div); scrollToBottom();
  return bubble;
}

function setLoading(active) { loading.classList.toggle('hidden', !active); fileBtn.disabled = active; }
function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }

// ---- 初始化 ----
loadConvList();
