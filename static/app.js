// App State
let appState = {
  telegram: {
    isConnected: false,
    isAuthorized: false,
    user: null
  },
  excel: {
    filePath: null,
    headers: [],
    contacts: [],
    totalContacts: 0,
    phoneColIdx: 0,
    nameColIdx: null
  },
  media: {
    filePath: null,
    filename: null
  },
  campaign: {
    status: 'idle',
    stats: {
      total: 0,
      processed: 0,
      sent: 0,
      not_found: 0,
      failed: 0,
      current_status_text: 'Kutilmoqda'
    }
  }
};

let ws = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupDragAndDrop();
  connectWebSocket();
  setupMessageTime();
  initMobileView();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 991) {
    const setupCol = document.getElementById('config-col');
    const monitorCol = document.getElementById('monitor-col');
    if (setupCol) setupCol.classList.remove('mobile-hidden');
    if (monitorCol) monitorCol.classList.remove('mobile-hidden');
  }
});

function setupMessageTime() {
  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById('preview-time');
  if (el) el.textContent = timeStr;
}

// Fetch Initial Status
async function initApp() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.config) {
      if (data.config.api_id) document.getElementById('auth-api-id').value = data.config.api_id;
      if (data.config.api_hash) document.getElementById('auth-api-hash').value = data.config.api_hash;
      if (data.config.phone) document.getElementById('auth-phone').value = data.config.phone;
      if (data.config.min_delay) document.getElementById('min-delay').value = data.config.min_delay;
      if (data.config.max_delay) document.getElementById('max-delay').value = data.config.max_delay;
      if (data.config.auto_clean_contacts !== undefined) {
        document.getElementById('clean-contacts-check').checked = data.config.auto_clean_contacts;
      }
      if (data.config.max_limit !== undefined) {
        document.getElementById('max-limit').value = data.config.max_limit;
      }
    }

    if (data.telegram && data.telegram.is_authorized) {
      setTelegramAuthorized(data.telegram.user);
    } else {
      setTelegramDisconnected();
    }

    if (data.campaign) {
      updateCampaignStatus(data.campaign.status, data.campaign.stats);
    }
  } catch (err) {
    console.error('Init error:', err);
  }
}

// ----------------- WebSocket Connection -----------------
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket ulandi');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'init') {
        updateCampaignStatus(msg.data.status, msg.data.stats);
        if (msg.data.logs && msg.data.logs.length > 0) {
          renderLogs(msg.data.logs);
        }
      } else if (msg.type === 'status_change') {
        updateCampaignStatus(msg.data.status, msg.data.stats);
      } else if (msg.type === 'progress') {
        updateStats(msg.data.stats);
      } else if (msg.type === 'log') {
        appendLog(msg.data);
      }
    } catch (err) {
      console.error('WS parse error:', err);
    }
  };

  ws.onclose = () => {
    console.warn('WS uzildi, 3 soniyadan so\'ng qayta ulanadi...');
    setTimeout(connectWebSocket, 3000);
  };
}

// ----------------- Telegram Auth Flow -----------------
function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function setTelegramAuthorized(user) {
  appState.telegram.isAuthorized = true;
  appState.telegram.user = user;

  const badge = document.getElementById('account-badge');
  badge.classList.remove('disconnected');
  badge.classList.add('connected');

  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Telegram Foydalanuvchi';
  document.getElementById('account-name').textContent = fullName;
  document.getElementById('profile-full-name').textContent = fullName;
  document.getElementById('profile-phone').textContent = user.phone ? `+${user.phone.replace('+', '')}` : '';
  document.getElementById('profile-username').textContent = user.username ? `@${user.username}` : '';

  const initials = (user.first_name ? user.first_name[0] : 'T') + (user.last_name ? user.last_name[0] : '');
  document.getElementById('user-avatar').textContent = initials.toUpperCase();

  document.getElementById('auth-login-prompt').classList.add('hidden');
  document.getElementById('auth-connected-view').classList.remove('hidden');
  closeAuthModal();
}

function setTelegramDisconnected() {
  appState.telegram.isAuthorized = false;
  appState.telegram.user = null;

  const badge = document.getElementById('account-badge');
  badge.classList.add('disconnected');
  badge.classList.remove('connected');
  document.getElementById('account-name').textContent = 'Akkaunt ulanmagan';

  document.getElementById('auth-login-prompt').classList.remove('hidden');
  document.getElementById('auth-connected-view').classList.add('hidden');
}

async function requestCode() {
  const apiId = document.getElementById('auth-api-id').value.trim();
  const apiHash = document.getElementById('auth-api-hash').value.trim();
  const phone = document.getElementById('auth-phone').value.trim();
  const errEl = document.getElementById('auth-error-1');
  const btn = document.getElementById('btn-request-code');

  errEl.classList.add('hidden');

  if (!apiId || !apiHash || !phone) {
    errEl.textContent = "Barcha maydonlarni (API ID, Hash, Telefon) to'ldiring!";
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = "Kutilmoqda...";

  try {
    const res = await fetch('/api/auth/send_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_id: apiId, api_hash: apiHash, phone: phone })
    });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Kod yuborilmadi");
    }

    if (data.status === 'already_authorized') {
      showToast('Akkaunt allaqachon ulangan!', 'success');
      setTelegramAuthorized(data.user);
      return;
    }

    // Switch to step 2
    document.getElementById('auth-step-1').classList.add('hidden');
    document.getElementById('auth-step-2').classList.remove('hidden');
    document.getElementById('auth-modal-title').textContent = 'Tasdiqlash kodini kiriting';
    showToast('Tasdiqlash kodi Telegramingizga yuborildi!', 'info');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = "Tasdiqlash kodini olish";
  }
}

async function verifyCode() {
  const code = document.getElementById('auth-code').value.trim();
  const errEl = document.getElementById('auth-error-2');
  const btn = document.getElementById('btn-verify-code');

  errEl.classList.add('hidden');
  if (!code) {
    errEl.textContent = "Kodni kiriting!";
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = "Tekshirilmoqda...";

  try {
    const res = await fetch('/api/auth/verify_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code })
    });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Kod noto'g'ri");
    }

    if (data.status === 'password_needed') {
      // 2FA required
      document.getElementById('auth-step-2').classList.add('hidden');
      document.getElementById('auth-step-3').classList.remove('hidden');
      document.getElementById('auth-modal-title').textContent = '2FA Parolini kiriting';
      return;
    }

    if (data.status === 'success') {
      showToast('Akkaunt muvaffaqiyatli ulandi!', 'success');
      setTelegramAuthorized(data.user);
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = "Akkauntga kirish";
  }
}

async function verifyPassword() {
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error-3');
  const btn = document.getElementById('btn-verify-password');

  errEl.classList.add('hidden');
  if (!password) {
    errEl.textContent = "Parolni kiriting!";
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = "Tekshirilmoqda...";

  try {
    const res = await fetch('/api/auth/verify_password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Parol noto'g'ri");
    }

    showToast('Akkaunt muvaffaqiyatli ulandi!', 'success');
    setTelegramAuthorized(data.user);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = "Kirishni yakunlash";
  }
}

async function logoutTelegram() {
  if (!confirm("Rostdan ham akkauntdan chiqmoqchimisiz?")) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    setTelegramDisconnected();
    showToast('Akkauntdan chiqildi', 'info');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ----------------- Excel File Upload & Handling -----------------
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      uploadExcelFile(files[0]);
    }
  });
}

function handleExcelSelect(e) {
  if (e.target.files.length > 0) {
    uploadExcelFile(e.target.files[0]);
  }
}

async function uploadExcelFile(file) {
  const formData = new FormData();
  formData.append('excel_file', file);

  document.getElementById('dropzone-filename').textContent = `Yuklanmoqda: ${file.name}...`;

  try {
    const res = await fetch('/api/excel/upload', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (!result.ok) {
      throw new Error(result.error || "Excel yuklashda xato yuz berdi");
    }

    const data = result.data;
    appState.excel.filePath = data.file_path;
    appState.excel.headers = data.headers;
    appState.excel.contacts = data.contacts;
    appState.excel.totalContacts = data.total_contacts;
    appState.excel.phoneColIdx = data.phone_col_idx;
    appState.excel.nameColIdx = data.name_col_idx;

    document.getElementById('dropzone-filename').textContent = `Fayl: ${file.name}`;
    document.getElementById('total-contacts-badge').textContent = `${data.total_contacts} ta raqam`;
    document.getElementById('stat-total').textContent = data.total_contacts;

    // Populate column selects
    const phoneSelect = document.getElementById('phone-column-select');
    const nameSelect = document.getElementById('name-column-select');
    phoneSelect.innerHTML = '';
    nameSelect.innerHTML = '<option value="-1">— Belgilanmagan —</option>';

    data.headers.forEach((h, i) => {
      const optP = document.createElement('option');
      optP.value = i;
      optP.textContent = `${h} (Ustun ${i+1})`;
      if (i === data.phone_col_idx) optP.selected = true;
      phoneSelect.appendChild(optP);

      const optN = document.createElement('option');
      optN.value = i;
      optN.textContent = `${h} (Ustun ${i+1})`;
      if (data.name_col_idx !== null && i === data.name_col_idx) optN.selected = true;
      nameSelect.appendChild(optN);
    });

    // Populate preview table
    renderPreviewTable(data.preview);
    document.getElementById('excel-summary').classList.remove('hidden');

    showToast(`Excel yuklandi: ${data.total_contacts} ta kontakt topildi!`, 'success');
    updateMessagePreview();
  } catch (err) {
    document.getElementById('dropzone-filename').textContent = "Excel faylni bu yerga tashlang yoki bosing";
    showToast(err.message, 'error');
  }
}

function updateColumnMapping() {
  const phoneIdx = parseInt(document.getElementById('phone-column-select').value);
  const nameIdx = parseInt(document.getElementById('name-column-select').value);
  
  appState.excel.phoneColIdx = phoneIdx;
  appState.excel.nameColIdx = nameIdx >= 0 ? nameIdx : null;

  // Re-map contacts
  appState.excel.contacts.forEach(c => {
    const rawRow = c.extra;
    const phoneColName = appState.excel.headers[phoneIdx];
    if (phoneColName && rawRow[phoneColName]) {
      c.phone = rawRow[phoneColName];
    }
    if (nameIdx >= 0) {
      const nameColName = appState.excel.headers[nameIdx];
      c.name = rawRow[nameColName] || '';
    } else {
      c.name = '';
    }
  });

  updateMessagePreview();
}

function renderPreviewTable(previewRows) {
  const tbody = document.getElementById('preview-table-body');
  tbody.innerHTML = '';
  if (!previewRows || previewRows.length === 0) return;

  previewRows.slice(0, 5).forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#38bdf8;">${r.phone}</td>
      <td>${r.name}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------- Message Composer & Dynamic Tags -----------------
function insertTag(tag) {
  const textarea = document.getElementById('message-text');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;

  textarea.value = text.substring(0, start) + tag + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + tag.length;
  textarea.focus();
  updateMessagePreview();
}

function updateMessagePreview() {
  const rawText = document.getElementById('message-text').value;
  const previewEl = document.getElementById('tg-preview-text');

  if (!rawText.trim()) {
    previewEl.textContent = "Xabar matni kiritilmadi...";
    return;
  }

  // Sample person from contacts or fallback
  let sampleName = "Azizbek";
  let samplePhone = "+998901234567";
  if (appState.excel.contacts.length > 0) {
    const first = appState.excel.contacts[0];
    if (first.name) sampleName = first.name;
    if (first.phone) samplePhone = first.phone;
  }

  let formatted = rawText
    .replace(/{ism}/g, sampleName)
    .replace(/{name}/g, sampleName)
    .replace(/{telefon}/g, samplePhone)
    .replace(/{phone}/g, samplePhone);

  previewEl.textContent = formatted;
}

// ----------------- Media Attachment -----------------
async function handleMediaSelect(e) {
  if (e.target.files.length === 0) return;
  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('media_file', file);

  document.getElementById('media-filename').textContent = `Yuklanmoqda: ${file.name}...`;

  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    appState.media.filePath = data.file_path;
    appState.media.filename = data.filename;

    document.getElementById('media-filename').textContent = `Rasm biriktirildi: ${file.name}`;
    document.getElementById('media-remove-btn').classList.remove('hidden');
    showToast('Rasm muvaffaqiyatli yuklandi', 'success');
  } catch (err) {
    document.getElementById('media-filename').textContent = "Rasm tanlanmagan";
    showToast(err.message, 'error');
  }
}

function removeMedia() {
  appState.media.filePath = null;
  appState.media.filename = null;
  document.getElementById('media-input').value = '';
  document.getElementById('media-filename').textContent = "Rasm tanlanmagan";
  document.getElementById('media-remove-btn').classList.add('hidden');
}

// ----------------- Campaign Controls -----------------
async function startCampaign() {
  if (!appState.telegram.isAuthorized) {
    showToast("Avval Telegram akkauntingizni ulang!", "error");
    openAuthModal();
    return;
  }

  if (appState.excel.contacts.length === 0) {
    showToast("Avval Excel faylni yuklang!", "error");
    return;
  }

  const message = document.getElementById('message-text').value.trim();
  if (!message && !appState.media.filePath) {
    showToast("Xabar matni yoki rasm kiritilishi shart!", "error");
    return;
  }

  const minDelay = parseInt(document.getElementById('min-delay').value) || 15;
  const maxDelay = parseInt(document.getElementById('max-delay').value) || 30;
  const autoClean = document.getElementById('clean-contacts-check').checked;
  const maxLimit = parseInt(document.getElementById('max-limit').value) || 0;

  if (minDelay < 5) {
    showToast("Minimal kutilma kamida 5 soniya bo'lishi lozim!", "error");
    return;
  }

  // Clear logs table UI
  document.getElementById('logs-table-body').innerHTML = '';

  const payload = {
    contacts: appState.excel.contacts,
    message: message,
    media_path: appState.media.filePath,
    min_delay: minDelay,
    max_delay: maxDelay,
    auto_clean_contacts: autoClean,
    max_limit: maxLimit
  };

  try {
    const res = await fetch('/api/campaign/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    showToast("Rassilka boshlandi!", "success");
    if (window.innerWidth <= 991) {
      switchMobileTab('monitor');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function pauseCampaign() {
  try {
    const res = await fetch('/api/campaign/pause', { method: 'POST' });
    const data = await res.json();
    if (data.ok) showToast("Rassilka vaqtincha to'xtatildi", "info");
  } catch (err) {
    console.error(err);
  }
}

async function resumeCampaign() {
  try {
    const res = await fetch('/api/campaign/resume', { method: 'POST' });
    const data = await res.json();
    if (data.ok) showToast("Rassilka davom ettirilmoqda", "info");
  } catch (err) {
    console.error(err);
  }
}

async function stopCampaign() {
  if (!confirm("Rostdan ham rassilkani butunlay to'xtatmoqchimisiz?")) return;
  try {
    const res = await fetch('/api/campaign/stop', { method: 'POST' });
    const data = await res.json();
    if (data.ok) showToast("Rassilka to'xtatildi", "info");
  } catch (err) {
    console.error(err);
  }
}

// ----------------- UI Updates & Logs -----------------
function updateCampaignStatus(status, stats) {
  appState.campaign.status = status;
  if (stats) updateStats(stats);

  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnStop = document.getElementById('btn-stop');
  const statusText = document.getElementById('monitor-status-text');

  if (status === 'running') {
    btnStart.classList.add('hidden');
    btnPause.classList.remove('hidden');
    btnResume.classList.add('hidden');
    btnStop.classList.remove('hidden');
    statusText.textContent = stats && stats.current_status_text ? stats.current_status_text : "Rassilka davom etmoqda...";
  } else if (status === 'paused') {
    btnStart.classList.add('hidden');
    btnPause.classList.add('hidden');
    btnResume.classList.remove('hidden');
    btnStop.classList.remove('hidden');
    statusText.textContent = "Vaqtincha to'xtatilgan (Pauza). Davom ettirish uchun tugmani bosing.";
  } else if (status === 'completed') {
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnResume.classList.add('hidden');
    btnStop.classList.add('hidden');
    statusText.textContent = "Rassilka muvaffaqiyatli yakunlandi! Natijalarni Excelda yuklab olishingiz mumkin.";
  } else if (status === 'stopped') {
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnResume.classList.add('hidden');
    btnStop.classList.add('hidden');
    statusText.textContent = "Rassilka to'xtatildi.";
  } else {
    btnStart.classList.remove('hidden');
    btnPause.classList.add('hidden');
    btnResume.classList.add('hidden');
    btnStop.classList.add('hidden');
    statusText.textContent = "Kutilmoqda. Excel fayl va xabarni kiriting.";
  }

  // Update mobile tab live indicator
  const mobileLiveDot = document.getElementById('mobile-live-dot');
  if (mobileLiveDot) {
    if (status === 'running') mobileLiveDot.classList.remove('hidden');
    else mobileLiveDot.classList.add('hidden');
  }
}

function updateStats(stats) {
  if (!stats) return;

  const total = stats.total || 0;
  const processed = stats.processed || 0;
  const sent = stats.sent || 0;
  const notFound = stats.not_found || 0;
  const failed = stats.failed || 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-sent').textContent = sent;
  document.getElementById('stat-notfound').textContent = notFound;
  document.getElementById('stat-failed').textContent = failed;

  // Progress Bar
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
  document.getElementById('progress-percent').textContent = `${percent}%`;
  document.getElementById('progress-counts').textContent = `${processed} / ${total} ta`;
  document.getElementById('progress-fill').style.width = `${percent}%`;

  if (stats.current_status_text) {
    document.getElementById('monitor-status-text').textContent = stats.current_status_text;
  }
}

function renderLogs(logs) {
  const tbody = document.getElementById('logs-table-body');
  tbody.innerHTML = '';
  logs.forEach(l => appendLog(l, false));
}

function appendLog(entry, scroll = true) {
  const tbody = document.getElementById('logs-table-body');
  
  // Remove placeholder row if present
  const emptyRow = tbody.querySelector('.empty-row');
  if (emptyRow) emptyRow.remove();

  const tr = document.createElement('tr');
  const badgeClass = entry.status || 'info';

  const statusLabels = {
    'sent': 'Yuborildi',
    'not_found': 'Topilmadi',
    'failed': 'Xatolik',
    'info': 'Ma\'lumot',
    'warning': 'Ogohlantirish'
  };

  const label = statusLabels[entry.status] || entry.status;

  tr.innerHTML = `
    <td style="font-family:'JetBrains Mono', monospace; font-size:0.75rem; color:#64748b;">${entry.time}</td>
    <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#38bdf8;">${entry.phone}</td>
    <td>${entry.name}</td>
    <td><span class="status-badge ${badgeClass}">${label}</span></td>
    <td style="font-size:0.8rem; color:#cbd5e1;">${entry.detail || '—'}</td>
  `;

  tbody.appendChild(tr);

  if (scroll) {
    const wrap = document.querySelector('.logs-table-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }
}

// ----------------- Toast Notification -----------------
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ----------------- Mobile Segmented Tab Switcher -----------------
function switchMobileTab(tab) {
  const setupCol = document.getElementById('config-col');
  const monitorCol = document.getElementById('monitor-col');
  const btnSetup = document.getElementById('tab-btn-setup');
  const btnMonitor = document.getElementById('tab-btn-monitor');

  if (tab === 'setup') {
    if (btnSetup) btnSetup.classList.add('active');
    if (btnMonitor) btnMonitor.classList.remove('active');
    if (setupCol) setupCol.classList.remove('mobile-hidden');
    if (monitorCol) monitorCol.classList.add('mobile-hidden');
  } else {
    if (btnMonitor) btnMonitor.classList.add('active');
    if (btnSetup) btnSetup.classList.remove('active');
    if (setupCol) setupCol.classList.add('mobile-hidden');
    if (monitorCol) monitorCol.classList.remove('mobile-hidden');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initMobileView() {
  if (window.innerWidth <= 991) {
    switchMobileTab('setup');
  }
}
