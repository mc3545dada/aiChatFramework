// ---- i18n ----
const LANG = {
  zh: {
    think:'思考', send:'发送', stop:'停止', settings:'设置', save:'保存',
    appearance:'外观', about:'关于', api_url:'API 地址', model:'模型',
    api_key:'API 密钥', system_prompt:'系统提示词', model_settings:'模型设置',
    settings_hint:'修改后自动保存，重启服务后仍然有效',
    test_btn:'测试 API 连接', theme:'主题背景', language:'语言',
    light:'明亮', dark:'暗色', warm:'暖色',
    gradient_blue:'渐变蓝', gradient_green:'渐变绿', gradient_sunset:'日落',
    input_placeholder:'输入消息，Enter 发送，Shift+Enter 换行...',
    new_chat:'+ 新对话', export_btn:'导出对话', search_placeholder:'搜索对话...',
    no_conv:'暂无对话', file_limit:'文件 {{name}} 超过 10MB 限制',
    copy:'复制', regenerate:'重新生成', parsed:'已解析', not_supported:'不支持解析',
    thinking:'思考中...', thought:'已思考',
    conv_title_new:'新对话', error_prefix:'请求失败: ',
    settings_saved:'保存失败: ',
    test_ok:'连接成功！响应: ', test_fail:'请先配置 API_KEY',
    fetch_models_fail:'获取模型列表失败',
    export_title:'导出对话', export_md:'导出 Markdown', export_json:'导出 JSON',
    token_label:'~{{n}} tokens', delete_msg:'删除', edit:'编辑',
    pin:'置顶', unpin:'取消置顶', pinned:'已置顶',
    just_now:'刚刚', min_ago:'{{n}}分钟前', hour_ago:'{{n}}小时前', day_ago:'{{n}}天前',
  },
  en: {
    think:'Think', send:'Send', stop:'Stop', settings:'Settings', save:'Save',
    appearance:'Appearance', about:'About', api_url:'API URL', model:'Model',
    api_key:'API Key', system_prompt:'System Prompt', model_settings:'Model',
    settings_hint:'Auto-saved. Persists after restart.',
    test_btn:'Test API Connection', theme:'Background', language:'Language',
    light:'Light', dark:'Dark', warm:'Warm',
    gradient_blue:'Blue Gradient', gradient_green:'Green Gradient', gradient_sunset:'Sunset',
    input_placeholder:'Type a message, Enter to send, Shift+Enter for new line...',
    new_chat:'+ New Chat', export_btn:'Export', search_placeholder:'Search conversations...',
    no_conv:'No conversations yet', file_limit:'File {{name}} exceeds 10MB limit',
    copy:'Copy', regenerate:'Regenerate', parsed:'Parsed', not_supported:'Unsupported',
    thinking:'Thinking...', thought:'Thought',
    conv_title_new:'New Chat', error_prefix:'Request failed: ',
    settings_saved:'Save failed: ',
    test_ok:'Connected! Response: ', test_fail:'Please configure API_KEY first',
    fetch_models_fail:'Failed to fetch models',
    export_title:'Export', export_md:'Export Markdown', export_json:'Export JSON',
    token_label:'~{{n}} tokens', delete_msg:'Delete', edit:'Edit',
    pin:'Pin', unpin:'Unpin', pinned:'Pinned',
    just_now:'just now', min_ago:'{{n}}m ago', hour_ago:'{{n}}h ago', day_ago:'{{n}}d ago',
  }
};
let lang = localStorage.getItem('lang') || 'zh';
function t(key, vars) {
  let s = (LANG[lang]&&LANG[lang][key])||(LANG.zh[key])||key;
  if (vars) for (const [k,v] of Object.entries(vars)) s = s.replace('{{'+k+'}}',v);
  return s;
}
function applyLang() {
  lang = localStorage.getItem('lang') || 'zh';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (el.children.length === 0) el.textContent = t(key);
    else { const w = document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null,false); const f = w.nextNode(); if (f && f.textContent.trim()) f.textContent = t(key); }
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
const renameToggle = document.getElementById('rename-toggle');
const presetSelect = document.getElementById('preset-select');
const presetName = document.getElementById('preset-name');
const presetLoadBtn = document.getElementById('preset-load-btn');
const presetSaveBtn = document.getElementById('preset-save-btn');
const presetDelBtn = document.getElementById('preset-del-btn');
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
let scrollLocked = false;
let renamePending = false; // 等待 AI 回复后重命名

function scrollToBottom() {
  if (!scrollLocked) chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ---- 时间格式化 ----
function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return t('just_now');
  const m = Math.floor(diff/60000); if (m < 60) return t('min_ago',{n:m});
  const h = Math.floor(m/60); if (h < 24) return t('hour_ago',{n:h});
  return t('day_ago',{n:Math.floor(h/24)});
}

// ---- Markdown 渲染 ----

function highlightCode(code) {
  return escHtml(code);
}

function mdRender(text) {
  if (!text) return '';
  // 先提取代码块（原始文本），避免转义破坏代码
  const codeBlocks = [];
  const raw = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push({ lang, code: code.trim() });
    return `\x00CODE${i}\x00`;
  });
  // 转义非代码部分
  let h = raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // 插回高亮后的代码块（带复制按钮）
  const codeCopyLabels = { zh:'复制代码', en:'Copy code' };
  const codeCopyLabel = codeCopyLabels[lang] || codeCopyLabels.zh;
  h = h.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    const b = codeBlocks[parseInt(i)];
    return `<div class="code-wrap"><button class="code-copy" data-code="${encodeURIComponent(b.code)}">${codeCopyLabel}</button><pre><code class="lang-${b.lang||''}">${highlightCode(b.code, b.lang)}</code></pre></div>`;
  });
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/~~(.+?)~~/g,'<del>$1</del>');
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^- (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>.*<\/li>\n?)+/g, m => m.includes('<ul>')?m:'<ol>'+m+'</ol>');
  const ps = h.split(/\n\n+/);
  if (ps.length>1) h = ps.map(p => { p=p.trim(); return !p?'':/^<(h[123]|pre|ul|ol|blockquote|li)/.test(p)?p:'<p>'+p.replace(/\n/g,'<br>')+'</p>'; }).join('\n');
  else h = h.replace(/\n/g,'<br>');
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
  for (const f of fileInput.files) {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    if (f.size > 10*1024*1024) { alert(t('file_limit',{name:f.name})); continue; }
    attachedFiles.push({file:f, name:f.name, size:f.size, type:ext});
  }
  fileInput.value = ''; renderFilePreviews();
});
chatContainer.addEventListener('dragenter', e => { e.preventDefault(); chatContainer.classList.add('drag-over'); });
chatContainer.addEventListener('dragover', e => { e.preventDefault(); chatContainer.classList.add('drag-over'); });
chatContainer.addEventListener('dragleave', () => chatContainer.classList.remove('drag-over'));
chatContainer.addEventListener('drop', e => {
  e.preventDefault(); chatContainer.classList.remove('drag-over');
  for (const f of e.dataTransfer.files) {
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    if (f.size > 10*1024*1024) { alert(t('file_limit',{name:f.name})); continue; }
    attachedFiles.push({file:f, name:f.name, size:f.size, type:ext});
  }
  renderFilePreviews();
});
function renderFilePreviews() {
  if (!attachedFiles.length) { filePreviews.classList.add('hidden'); return; }
  filePreviews.classList.remove('hidden');
  filePreviews.innerHTML = attachedFiles.map((f,i) => `<span class="file-chip">${escHtml(f.name)} <button data-idx="${i}" class="file-chip-del">&times;</button></span>`).join('');
  filePreviews.querySelectorAll('.file-chip-del').forEach(btn => { btn.addEventListener('click',()=>{ attachedFiles.splice(parseInt(btn.dataset.idx),1); renderFilePreviews(); }); });
}
async function uploadFiles() {
  if (!attachedFiles.length) return [];
  const r = [];
  for (const af of attachedFiles) {
    const fd = new FormData(); fd.append('file',af.file);
    try { const d = await (await fetch('/api/upload',{method:'POST',body:fd})).json(); r.push({name:d.name,text:d.text||''}); }
    catch { r.push({name:af.name,text:''}); }
  }
  attachedFiles = []; renderFilePreviews();
  return r;
}

// ---- 侧边栏 ----
sidebarToggle.addEventListener('click', () => { sidebar.classList.toggle('hidden-mobile'); sidebar.classList.toggle('show-mobile'); });
document.addEventListener('click', e => {
  if (window.innerWidth>700) return;
  if (!sidebar.contains(e.target) && e.target!==sidebarToggle) { sidebar.classList.add('hidden-mobile'); sidebar.classList.remove('show-mobile'); }
});
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  document.querySelectorAll('.conv-item').forEach(el => { const t = el.querySelector('.conv-title').textContent.toLowerCase(); el.style.display = (!q||t.includes(q)) ? '' : 'none'; });
});

// ---- 对话列表（含置顶） ----
function getPinned() { try { return JSON.parse(localStorage.getItem('pinnedConvs')||'[]'); } catch { return []; } }
function setPinned(list) { localStorage.setItem('pinnedConvs',JSON.stringify(list)); }

async function loadConvList() {
  try {
    const list = await (await fetch('/api/conversations')).json();
    const pinned = getPinned();
    const sorted = [...list].sort((a,b) => {
      const ap = pinned.includes(a.id), bp = pinned.includes(b.id);
      if (ap !== bp) return ap ? -1 : 1;
      return (b.updatedAt||0) - (a.updatedAt||0);
    });
    convList.innerHTML = '';
    if (!sorted.length) { convList.innerHTML = '<div class="conv-empty">'+t('no_conv')+'</div>'; return; }
    // 按日期分组
    const groups = {};
    for (const conv of sorted) {
      const g = dateGroup(conv.updatedAt || conv.createdAt || Date.now());
      if (!groups[g]) groups[g] = [];
      groups[g].push(conv);
    }
    const groupOrder = ['today','yesterday','week','older'];
    for (const g of groupOrder) {
      const convs = groups[g];
      if (!convs || !convs.length) continue;
      const hdr = document.createElement('div'); hdr.className = 'conv-group-header'; hdr.textContent = dateGroupLabel(g);
      convList.appendChild(hdr);
      for (const conv of convs) {
      const isPinned = pinned.includes(conv.id);
      const item = document.createElement('div');
      item.className = 'conv-item' + (conv.id===currentConvId?' active':'') + (isPinned?' pinned':'');
      item.innerHTML = `<span class="conv-title">${escHtml(conv.title||t('conv_title_new'))}</span>
        <button class="conv-rename" data-id="${conv.id}" title="${t('edit')}">&#9998;</button>
        <button class="conv-pin" data-id="${conv.id}">${isPinned?'&#128205;':'&#128204;'}</button>
        <button class="conv-del" data-id="${conv.id}">&times;</button>`;
      item.addEventListener('click', e => { if (e.target.closest('.conv-del')||e.target.closest('.conv-pin')||e.target.closest('.conv-rename')) return; switchConv(conv.id); });
      item.querySelector('.conv-del').addEventListener('click', async e => { e.stopPropagation(); await deleteConv(conv.id); });
      item.querySelector('.conv-pin').addEventListener('click', e => {
        e.stopPropagation();
        const p = getPinned();
        if (p.includes(conv.id)) setPinned(p.filter(x=>x!==conv.id));
        else { p.push(conv.id); setPinned(p); }
        loadConvList();
      });
      // 点击编辑图标重命名
      item.querySelector('.conv-rename').addEventListener('click', e => {
        e.stopPropagation();
        const span = item.querySelector('.conv-title');
        const old = span.textContent;
        const inp = document.createElement('input');
        inp.className = 'title-edit'; inp.value = old;
        inp.addEventListener('blur', () => finishEdit(conv.id, inp.value || old));
        inp.addEventListener('keydown', e2 => { if (e2.key==='Enter') inp.blur(); if (e2.key==='Escape') { inp.value=old; inp.blur(); } });
        span.replaceWith(inp); inp.focus(); inp.select();
      });
      convList.appendChild(item);
    }
    }
  } catch {}
}
async function finishEdit(id, title) {
  try {
    const c = await (await fetch(`/api/conversations/${id}`)).json();
    c.title = title;
    await fetch('/api/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id, messages:c.messages, title})});
    loadConvList();
  } catch {}
}

async function switchConv(id) {
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false;
  if (currentConvId) await saveCurrentConv();
  try {
    const conv = await (await fetch(`/api/conversations/${id}`)).json();
    currentConvId = conv.id; messages = conv.messages||[]; renderMessages(); loadConvList();
    if (window.innerWidth<=700) { sidebar.classList.add('hidden-mobile'); sidebar.classList.remove('show-mobile'); }
  } catch(err) { console.error('Failed to load conversation',err); }
}
async function deleteConv(id) {
  try {
    await fetch(`/api/conversations/${id}`,{method:'DELETE'});
    if (currentConvId===id) { currentConvId=null; messages=[]; renderMessages(); }
    loadConvList();
  } catch {}
}
newChatBtn.addEventListener('click', async () => {
  if (abortController) { abortController.abort(); abortController = null; }
  isStreaming = false;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (currentConvId && messages.filter(m=>m.content).length>0) await saveCurrentConv();
  currentConvId = null; messages = []; attachedFiles = []; renderFilePreviews(); renderMessages(); loadConvList();
  userInput.focus();
  if (window.innerWidth<=700) { sidebar.classList.add('hidden-mobile'); sidebar.classList.remove('show-mobile'); }
});

// ---- 导出 ----
exportBtn.addEventListener('click', () => {
  if (!messages.length) return;
  const title = (messages.find(m=>m.role==='user')?.content||'export').slice(0,30);
  let md = `# ${title}\n\n`;
  for (const m of messages) { md += `**${m.role==='user'?'You':'AI'}:**\n${m.content||''}\n\n`; }
  downloadFile(md,title+'.md','text/markdown');
  downloadFile(JSON.stringify({title,messages,exportedAt:new Date().toISOString()},null,2),title+'.json','application/json');
});
function downloadFile(c,f,t) { const b=new Blob([c],{type:t}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=f; document.body.appendChild(a); a.click(); setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href);},100); }

// ---- 自动保存 ----
function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(saveCurrentConv, 1500); }
async function saveCurrentConv() {
  saveTimer = null;
  const filtered = messages.filter(m=>m.content);
  if (!filtered.length) return;
  const savedId = currentConvId;
  try {
    const data = await (await fetch('/api/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:savedId,messages:filtered})})).json();
    if (data.id && currentConvId===savedId) currentConvId = data.id;
    loadConvList();
    if (renamePending && data.id && localStorage.getItem('autoRename') !== 'false') { renamePending = false; autoRename(); }
  } catch {}
}

// ---- 设置 ----
settingsBtn.addEventListener('click', async () => {
  settingsOverlay.classList.remove('hidden');
  settingSystem.value = localStorage.getItem('systemPrompt')||'';
  renameToggle.checked = localStorage.getItem('autoRename') !== 'false';
  try { const s=await(await fetch('/api/settings')).json(); settingUrl.value=s.apiBaseUrl||''; settingModel.value=s.model||''; settingKey.placeholder=s.hasKey?t('api_key')+' (已设置)':'sk-...'; } catch {}
});
settingsClose.addEventListener('click', () => settingsOverlay.classList.add('hidden'));
document.querySelectorAll('.tab-btn').forEach(btn => { btn.addEventListener('click',()=>{ document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden')); document.getElementById('tab-'+btn.dataset.tab).classList.remove('hidden'); }); });
settingsSave.addEventListener('click', async () => {
  const body={};
  if (settingUrl.value.trim()) body.apiBaseUrl = settingUrl.value.trim();
  if (settingModel.value.trim()) body.model = settingModel.value.trim();
  if (settingKey.value.trim()) body.apiKey = settingKey.value.trim();
  localStorage.setItem('systemPrompt',settingSystem.value);
  try { await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); settingsOverlay.classList.add('hidden'); settingKey.value=''; } catch(err) { alert(t('settings_saved')+err.message); }
});
function applyBg(name) { document.body.className='bg-'+name; localStorage.setItem('bgTheme',name); document.querySelectorAll('.bg-option').forEach(el=>el.classList.toggle('active',el.dataset.bg===name)); }
applyBg(localStorage.getItem('bgTheme')||'light');
document.querySelectorAll('.bg-option').forEach(el => el.addEventListener('click',()=>applyBg(el.dataset.bg)));
function loadParams() { settingTemp.value=localStorage.getItem('temperature')||'1'; settingTopp.value=localStorage.getItem('top_p')||'1'; tempVal.textContent=parseFloat(settingTemp.value).toFixed(1); toppVal.textContent=parseFloat(settingTopp.value).toFixed(2); }
loadParams();
settingTemp.addEventListener('input',()=>{tempVal.textContent=parseFloat(settingTemp.value).toFixed(1);localStorage.setItem('temperature',settingTemp.value);});
settingTopp.addEventListener('input',()=>{toppVal.textContent=parseFloat(settingTopp.value).toFixed(2);localStorage.setItem('top_p',settingTopp.value);});
renameToggle.addEventListener('change',()=>localStorage.setItem('autoRename',renameToggle.checked));
testBtn.addEventListener('click', async () => {
  testResult.className='test-msg'; testResult.textContent='...';
  const body={}; if (settingUrl.value.trim()) body.apiBaseUrl=settingUrl.value.trim(); if (settingModel.value.trim()) body.model=settingModel.value.trim(); if (settingKey.value.trim()) body.apiKey=settingKey.value.trim();
  if (Object.keys(body).length) await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try { const d=await(await fetch('/api/test',{method:'POST'})).json(); testResult.className=d.ok?'test-msg test-ok':'test-msg test-fail'; testResult.textContent=d.ok?t('test_ok')+(d.msg||''):d.msg; } catch(err) { testResult.className='test-msg test-fail'; testResult.textContent=t('error_prefix')+err.message; }
});
fetchModelsBtn.addEventListener('click', async () => {
  fetchModelsBtn.disabled=true; fetchModelsBtn.textContent='...';
  const body={}; if (settingUrl.value.trim()) body.apiBaseUrl=settingUrl.value.trim(); if (settingModel.value.trim()) body.model=settingModel.value.trim(); if (settingKey.value.trim()) body.apiKey=settingKey.value.trim();
  if (Object.keys(body).length) await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try { const d=await(await fetch('/api/models')).json(); if (d.ok && d.models.length) { modelSelect.innerHTML=d.models.map(m=>`<option value="${escHtml(m)}">${escHtml(m)}</option>`).join(''); modelSelectWrap.classList.remove('hidden'); modelSelect.onchange=()=>{settingModel.value=modelSelect.value;}; settingModel.value=''; } else { modelSelectWrap.classList.add('hidden'); alert(d.msg||t('fetch_models_fail')); } } catch(err) { modelSelectWrap.classList.add('hidden'); alert(t('error_prefix')+err.message); } finally { fetchModelsBtn.disabled=false; fetchModelsBtn.innerHTML='&#128269;'; }
});
langSelect.addEventListener('change', () => { localStorage.setItem('lang',langSelect.value); applyLang(); loadConvList(); });

// ---- API 预设 ----
function getPresets() { try { return JSON.parse(localStorage.getItem('apiPresets')||'[]'); } catch { return []; } }
function savePresets(p) { localStorage.setItem('apiPresets',JSON.stringify(p)); }

function refreshPresetList() {
  const presets = getPresets();
  presetSelect.innerHTML = '<option value="">-- 选择预设 --</option>' + presets.map((p,i) => `<option value="${i}">${escHtml(p.name)}</option>`).join('');
}
refreshPresetList();

presetSaveBtn.addEventListener('click', () => {
  const name = presetName.value.trim();
  if (!name) return;
  const presets = getPresets();
  presets.push({ name, apiBaseUrl: settingUrl.value.trim(), model: settingModel.value.trim(), apiKey: settingKey.value.trim() });
  savePresets(presets);
  presetName.value = '';
  refreshPresetList();
  presetSelect.value = presets.length - 1;
});

presetLoadBtn.addEventListener('click', () => {
  const idx = parseInt(presetSelect.value);
  if (isNaN(idx)) return;
  const presets = getPresets();
  const p = presets[idx];
  if (!p) return;
  if (p.apiBaseUrl) settingUrl.value = p.apiBaseUrl;
  if (p.model) settingModel.value = p.model;
  if (p.apiKey) settingKey.value = p.apiKey;
});

presetDelBtn.addEventListener('click', () => {
  const idx = parseInt(presetSelect.value);
  if (isNaN(idx)) return;
  let presets = getPresets();
  presets.splice(idx, 1);
  savePresets(presets);
  refreshPresetList();
});

// ---- 聊天核心 ----
userInput.addEventListener('input', () => { userInput.style.height='auto'; userInput.style.height=Math.min(userInput.scrollHeight,120)+'px'; });
userInput.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); } });

chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (isStreaming) { stopStreaming(); return; }
  const text = userInput.value.trim();
  if (!text && !attachedFiles.length) return;
  const fileResults = await uploadFiles();
  const userMsg = { role:'user', content:text, files:fileResults, ts:Date.now() };
  messages.push(userMsg); appendMessage('user',text,fileResults);
  userInput.value=''; userInput.style.height='auto';
  scheduleSave(); setLoading(true); showStopBtn();
  const sp = localStorage.getItem('systemPrompt')||'';
  const apiMsgs = sp ? [{role:'system',content:sp}] : [];
  for (let i=0; i<messages.length-1; i++) {
    const m=messages[i];
    if (m.role==='user' && m.files && m.files.length) { let f=m.content||''; for (const ff of m.files) if (ff.text) f+='\n\n[文件内容: '+ff.name+']\n'+ff.text; apiMsgs.push({role:'user',content:f}); }
    else apiMsgs.push({role:m.role,content:m.content||''});
  }
  let fut = text;
  for (const f of fileResults) if (f.text) fut += '\n\n[文件内容: '+f.name+']\n'+f.text;
  apiMsgs.push({role:'user',content:fut});
  const asIdx = messages.length;
  messages.push({role:'assistant',content:'',ts:Date.now()});
  const ab = appendMessage('assistant','……');
  const at = ab.querySelector('.assistant-text');
  if (at) at.style.opacity='0.5';
  isStreaming = true;
  try {
    abortController = new AbortController();
    const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:apiMsgs,thinkingEnabled:thinkCheck.checked,reasoningEffort:thinkEffort.value,
        temperature:parseFloat(settingTemp.value),top_p:parseFloat(settingTopp.value)}),
      signal:abortController.signal});
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf='',fc='',fr='';
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      buf += dec.decode(value,{stream:true}); const lines = buf.split('\n'); buf = lines.pop()||'';
      for (const line of lines) {
        const t = line.trim(); if (!t.startsWith('data: ')) continue;
        const d = t.slice(6); if (d==='[DONE]') continue;
        try { const p = JSON.parse(d);
          if (p.error) { (at||ab).textContent=p.error; ab.parentElement.className='message error'; isStreaming=false; return; }
          if (p.reasoning_content) { fr+=p.reasoning_content; messages[asIdx].reasoning=fr; updateReasoningDisplay(ab,fr); scrollToBottom(); }
          if (p.content) { fc+=p.content; messages[asIdx].content=fc; if (at) { at.innerHTML=mdRender(fc); at.style.opacity='1'; } else ab.innerHTML=mdRender(fc); scrollToBottom(); }
        } catch {}
      }
    }
    messages[asIdx].content=fc; if (fr) messages[asIdx].reasoning=fr; renamePending = true; scheduleSave();
  } catch(err) {
    if (err.name==='AbortError') return;
    const em = t('error_prefix')+err.message;
    if (at) at.textContent=em; else ab.textContent=em;
    ab.parentElement.className='message error';
  } finally { setLoading(false); hideStopBtn(); isStreaming=false; abortController=null; }
});
function stopStreaming() { if (abortController) { abortController.abort(); abortController=null; } isStreaming=false; setLoading(false); hideStopBtn(); if (messages.length) scheduleSave(); }
function showStopBtn() { sendBtn.textContent=t('stop'); sendBtn.className='btn-stop'; }
function hideStopBtn() { sendBtn.textContent=t('send'); sendBtn.className=''; }

// ---- 重新生成 ----
function regenerateLast() {
  if (isStreaming) return;
  let idx=-1; for (let i=messages.length-1;i>=0;i--) { if (messages[i].role==='assistant') { idx=i; break; } }
  if (idx===-1) return;
  messages.splice(idx,1); renderMessages(); scrollToBottom();
  const last = messages[messages.length-1];
  if (last && last.role==='user') {
    const t2 = typeof last.content==='string' ? last.content : '';
    attachedFiles = last.files ? last.files.map(f=>({file:null,name:f.name,size:0,type:'.'+f.name.split('.').pop()})) : [];
    doSubmit(t2,last.files||[]);
  }
}
async function doSubmit(text,files) {
  if (isStreaming) return;
  const fr = await uploadFiles();
  for (const f of files) if (!fr.find(r=>r.name===f.name)) fr.push(f);
  attachedFiles=[];
  const um = {role:'user',content:text,files:fr,ts:Date.now()};
  messages.push(um); appendMessage('user',text,fr); scheduleSave(); setLoading(true); showStopBtn();
  const sp = localStorage.getItem('systemPrompt')||'';
  const am = sp ? [{role:'system',content:sp}] : [];
  for (let i=0; i<messages.length-1; i++) {
    const m=messages[i];
    if (m.role==='user'&&m.files&&m.files.length) { let f=m.content||''; for (const ff of m.files) if (ff.text) f+='\n\n[文件内容: '+ff.name+']\n'+ff.text; am.push({role:'user',content:f}); }
    else am.push({role:m.role,content:m.content||''});
  }
  let ft = text;
  for (const f of fr) if (f.text) ft += '\n\n[文件内容: '+f.name+']\n'+f.text;
  am.push({role:'user',content:ft});
  const aidx = messages.length;
  messages.push({role:'assistant',content:'',ts:Date.now()});
  const ab = appendMessage('assistant','……'); const at = ab.querySelector('.assistant-text');
  if (at) at.style.opacity='0.5';
  isStreaming = true;
  try {
    abortController = new AbortController();
    const res = await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:am,thinkingEnabled:thinkCheck.checked,reasoningEffort:thinkEffort.value,
        temperature:parseFloat(settingTemp.value),top_p:parseFloat(settingTopp.value)}),
      signal:abortController.signal});
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf='',fc='',fr2='';
    while (true) {
      const {done,value} = await reader.read(); if (done) break;
      buf += dec.decode(value,{stream:true}); const lines = buf.split('\n'); buf = lines.pop()||'';
      for (const line of lines) {
        const t = line.trim(); if (!t.startsWith('data: ')) continue;
        const d = t.slice(6); if (d==='[DONE]') continue;
        try { const p = JSON.parse(d);
          if (p.error) { (at||ab).textContent=p.error; ab.parentElement.className='message error'; isStreaming=false; return; }
          if (p.reasoning_content) { fr2+=p.reasoning_content; messages[aidx].reasoning=fr2; updateReasoningDisplay(ab,fr2); scrollToBottom(); }
          if (p.content) { fc+=p.content; messages[aidx].content=fc; if (at) { at.innerHTML=mdRender(fc); at.style.opacity='1'; } else ab.innerHTML=mdRender(fc); scrollToBottom(); }
        } catch {}
      }
    }
    messages[aidx].content=fc; if (fr2) messages[aidx].reasoning=fr2; scheduleSave();
  } catch(err) {
    if (err.name==='AbortError') return;
    const em = t('error_prefix')+err.message;
    if (at) at.textContent=em; else ab.textContent=em;
    ab.parentElement.className='message error';
  } finally { setLoading(false); hideStopBtn(); isStreaming=false; abortController=null; }
}

// ---- 代码块复制（事件委托） ----
document.addEventListener('click', e => {
  const btn = e.target.closest('.code-copy');
  if (!btn) return;
  try {
    const code = decodeURIComponent(btn.dataset.code);
    if (!code) return;
    navigator.clipboard.writeText(code);
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = t('copy'); }, 1500);
  } catch {}
});

// ---- 图片放大查看 ----
let lightboxEl = null;
function showLightbox(src) {
  if (!lightboxEl) {
    lightboxEl = document.createElement('div'); lightboxEl.className = 'lightbox hidden';
    lightboxEl.addEventListener('click', () => lightboxEl.classList.add('hidden'));
    const img = document.createElement('img');
    img.className = 'lightbox-img';
    lightboxEl.appendChild(img);
    document.body.appendChild(lightboxEl);
    // Esc 关闭
    document.addEventListener('keydown', e2 => { if (e2.key === 'Escape') lightboxEl.classList.add('hidden'); });
  }
  lightboxEl.querySelector('img').src = src;
  lightboxEl.classList.remove('hidden');
}

// ---- 对话按日期分组 ----
function dateGroup(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'today';
  if (diff < 172800000 && (d.getDate() === now.getDate() - 1 || (now.getDate() === 1 && d.getDate() > 20))) return 'yesterday';
  if (diff < 604800000) return 'week';
  return 'older';
}
function dateGroupLabel(group) {
  const labels = { today: '今天', yesterday: '昨天', week: '本周', older: '更早' };
  const en = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', older: 'Earlier' };
  return (lang === 'en' ? en : labels)[group] || group;
}

// ---- 工具函数 ----
function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function updateReasoningDisplay(bubble, text) {
  let el = bubble.querySelector('.reasoning-box');
  if (!el) {
    el=document.createElement('div'); el.className='reasoning-box collapsed';
    const h=document.createElement('div'); h.className='reasoning-header';
    h.innerHTML='<span class="reasoning-toggle">&#9654;</span><span>&#128300; '+t('thought')+'</span>';
    h.addEventListener('click',()=>{el.classList.toggle('collapsed');h.querySelector('.reasoning-toggle').textContent=el.classList.contains('collapsed')?'▶':'▼';});
    const c=document.createElement('div'); c.className='reasoning-content'; c.textContent=text;
    el.appendChild(h); el.appendChild(c); bubble.prepend(el);
  } else el.querySelector('.reasoning-content').textContent=text;
}

// ---- 删除消息 ----
function deleteMessage(idx) {
  if (confirm(t('delete_msg')+'?')) {
    messages.splice(idx, messages.length - idx);
    renderMessages(); scheduleSave();
  }
}

// ---- 渲染消息 ----
function renderMessages() {
  messagesContainer.innerHTML = '';
  for (const msg of messages) {
    if (!msg.content && (!msg.files||!msg.files.length)) continue;
    appendMessage(msg.role, msg.content, msg.files, msg.reasoning, msg.ts);
  }
}

function appendMessage(role, content, files, reasoning, ts) {
  const div = document.createElement('div'); div.className=`message ${role}`;
  const label = document.createElement('div'); label.className='role-label';
  label.textContent = role==='user' ? 'You' : 'AI';
  if (ts) { const time = document.createElement('span'); time.className='msg-time'; time.textContent=relTime(ts); label.appendChild(time); }

  const bubble = document.createElement('div'); bubble.className='bubble';

  if (role==='assistant') {
    if (reasoning) {
      const box=document.createElement('div'); box.className='reasoning-box collapsed';
      const h=document.createElement('div'); h.className='reasoning-header';
      h.innerHTML='<span class="reasoning-toggle">&#9654;</span><span>&#128300; '+t('thought')+'</span>';
      h.addEventListener('click',()=>{box.classList.toggle('collapsed');h.querySelector('.reasoning-toggle').textContent=box.classList.contains('collapsed')?'▶':'▼';});
      const rc=document.createElement('div'); rc.className='reasoning-content'; rc.textContent=reasoning;
      box.appendChild(h); box.appendChild(rc); bubble.appendChild(box);
    }
    const te=document.createElement('div'); te.className='assistant-text';
    if (content) te.innerHTML=mdRender(content);
    bubble.appendChild(te);
  } else {
    if (content) { const te=document.createElement('div'); te.className='user-text'; te.textContent=content; bubble.appendChild(te); }
    if (files&&files.length) {
      const c=document.createElement('div'); c.className='msg-files';
      for (const f of files) { const card=document.createElement('div'); card.className='file-card'; card.innerHTML=`<span class="file-card-icon">&#128196;</span><span class="file-card-name">${escHtml(f.name)}</span><span class="file-card-badge ${f.text?'badge-ok':'badge-fail'}">${f.text?t('parsed'):t('not_supported')}</span>`; c.appendChild(card); }
      bubble.appendChild(c);
    }
  }

  div.appendChild(label); div.appendChild(bubble);

  // 操作栏（所有消息都有）
  const act = document.createElement('div'); act.className='msg-actions';
  // 复制
  const cb = document.createElement('button'); cb.className='action-btn'; cb.title=t('copy');
  cb.innerHTML='&#128203;';
  cb.addEventListener('click', async e => { e.stopPropagation();
    try { await navigator.clipboard.writeText(content||''); cb.innerHTML='&#10003;'; cb.style.color='#52c41a'; setTimeout(()=>{cb.innerHTML='&#128203;';cb.style.color='';},1500); } catch {}
  });
  act.appendChild(cb);
  // 用户消息：编辑 + 删除
  if (role==='user' && content) {
    const eb = document.createElement('button'); eb.className='action-btn'; eb.title=t('edit');
    eb.innerHTML='&#9998;';
    eb.addEventListener('click', e => { e.stopPropagation(); editMessage(div, content); });
    act.appendChild(eb);
    const db = document.createElement('button'); db.className='action-btn'; db.title=t('delete_msg');
    db.innerHTML='&#128465;';
    db.addEventListener('click', e => { e.stopPropagation(); const idx = Array.from(messagesContainer.children).indexOf(div); if (idx>=0) deleteMessage(idx); });
    act.appendChild(db);
  }
  // AI 消息：重新生成 + token
  if (role==='assistant' && content) {
    const rb=document.createElement('button'); rb.className='action-btn'; rb.title=t('regenerate'); rb.innerHTML='&#8635;';
    rb.addEventListener('click',e=>{e.stopPropagation();regenerateLast();});
    act.appendChild(rb);
    const tk=document.createElement('span'); tk.className='token-count';
    tk.textContent=t('token_label',{n:Math.max(1,Math.round(content.length/4))});
    act.appendChild(tk);
  }
  div.appendChild(act);

  messagesContainer.appendChild(div); scrollToBottom();
  return bubble;
}

function setLoading(active) { loading.classList.toggle('hidden',!active); fileBtn.disabled=active; }

// ---- AI 自动重命名 ----
async function autoRename() {
  if (!messages.length || !currentConvId) return;
  try {
    const data = await (await fetch('/api/rename', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(0, 2) }),
    })).json();
    if (data.title && data.title !== '新对话') {
      // 直接更新后端
      await fetch('/api/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentConvId, messages, title: data.title }),
      });
      loadConvList();
    }
  } catch {}
}

// ---- 编辑消息 ----
function editMessage(msgDiv, oldContent) {
  const bubble = msgDiv.querySelector('.bubble');
  const userText = bubble.querySelector('.user-text');
  if (!userText) return;
  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = oldContent;
  userText.replaceWith(textarea);
  textarea.focus(); textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  function saveEdit() {
    const newContent = textarea.value.trim();
    if (newContent && newContent !== oldContent) {
      const idx = Array.from(messagesContainer.children).indexOf(msgDiv);
      if (idx >= 0) {
        messages[idx].content = newContent;
        renderMessages();
        scheduleSave();
      }
    } else {
      // 恢复原文
      const te = document.createElement('div'); te.className = 'user-text'; te.textContent = oldContent;
      textarea.replaceWith(te);
    }
  }

  textarea.addEventListener('blur', saveEdit);
  textarea.addEventListener('keydown', e2 => {
    if (e2.key === 'Enter' && !e2.shiftKey) { e2.preventDefault(); textarea.blur(); }
    if (e2.key === 'Escape') { textarea.value = oldContent; textarea.blur(); }
  });
}

// ---- 滚动到底部按钮 ----
const scrollBtn = document.getElementById('scroll-bottom-btn');
chatContainer.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = chatContainer;
  scrollLocked = scrollHeight - scrollTop - clientHeight > 80;
  scrollBtn.classList.toggle('hidden', !scrollLocked);
});
scrollBtn.addEventListener('click', () => {
  scrollLocked = false;
  chatContainer.scrollTop = chatContainer.scrollHeight;
  scrollBtn.classList.add('hidden');
});

// ---- 初始化 ----
loadConvList();
