const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const messagesContainer = document.getElementById('messages');
const loading = document.getElementById('loading');
const sendBtn = document.getElementById('send-btn');

const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');
const settingUrl = document.getElementById('setting-url');
const settingModel = document.getElementById('setting-model');
const settingKey = document.getElementById('setting-key');

let messages = [];
let abortController = null;

// ---- 设置功能 ----

// 打开设置弹窗并加载当前设置
settingsBtn.addEventListener('click', async () => {
  settingsOverlay.classList.remove('hidden');
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    settingUrl.value = data.apiBaseUrl || '';
    settingModel.value = data.model || '';
    // API Key 只回传是否有值，不暴露完整密钥
    settingKey.placeholder = data.hasKey ? '(已设置，留空则不修改)' : 'sk-...';
  } catch {}
});

// 关闭弹窗
settingsClose.addEventListener('click', () => {
  settingsOverlay.classList.add('hidden');
});
settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
});

// 保存设置
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
  if (!text) return;

  messages.push({ role: 'user', content: text });
  appendMessage('user', text);

  userInput.value = '';
  userInput.style.height = 'auto';

  setLoading(true);

  const assistantIndex = messages.length;
  messages.push({ role: 'assistant', content: '' });
  const assistantBubble = appendMessage('assistant', '');

  try {
    abortController = new AbortController();

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.slice(0, assistantIndex) }),
      signal: abortController.signal,
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

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

          if (parsed.content) {
            fullContent += parsed.content;
            assistantBubble.textContent = fullContent;
            scrollToBottom();
          }
        } catch {}
      }
    }

    messages[assistantIndex].content = fullContent;

  } catch (err) {
    if (err.name === 'AbortError') return;
    assistantBubble.textContent = `请求失败: ${err.message}`;
    assistantBubble.parentElement.className = 'message error';
  } finally {
    setLoading(false);
    abortController = null;
  }
});

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const label = document.createElement('div');
  label.className = 'role-label';
  label.textContent = role === 'user' ? '你' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;

  div.appendChild(label);
  div.appendChild(bubble);
  messagesContainer.appendChild(div);
  scrollToBottom();
  return bubble;
}

function setLoading(active) {
  loading.classList.toggle('hidden', !active);
  sendBtn.disabled = active;
}

function scrollToBottom() {
  const container = document.getElementById('chat-container');
  container.scrollTop = container.scrollHeight;
}
