// App State
let appState = {
  user: null,
  authMode: 'login', // 'login' or 'register'
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
  checkUserAuth();
  initFirebase();
  setupDragAndDrop();
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

// ----------------- Safe JSON Fetch Helper -----------------
async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (res.status === 502) {
      throw new Error("Server xatosi: 502 Bad Gateway. Serverda Python app.py ishga tushmagan yoki kutubxona yetishmaydi.");
    } else if (res.status === 504) {
      throw new Error("Server xatosi: 504 Gateway Timeout. Server javob bermayapti.");
    } else if (res.status === 404) {
      throw new Error("Server xatosi: 404 Not Found. API manzili topilmadi.");
    } else if (res.status >= 500) {
      throw new Error(`Server xatosi (${res.status}): Server loglarini tekshiring.`);
    } else {
      throw new Error(`Server noaniq javob qaytardi (${res.status}): ${text.substring(0, 80)}`);
    }
  }
  return { res, data };
}

// ----------------- User Auth & SaaS Management -----------------
async function checkUserAuth() {
  try {
    const { res, data } = await safeFetchJson('/api/auth/me');
    if (res.ok && data && data.ok && data.user) {
      setUserLoggedIn(data.user);
      initApp();
      connectWebSocket();
      return;
    }
    setUserLoggedOut();
    openUserAuthModal();
  } catch (err) {
    console.warn('Auth check error:', err);
    setUserLoggedOut();
    openUserAuthModal();
  }
}

function setUserLoggedIn(user) {
  appState.user = user;

  const btnLogin = document.getElementById('btn-open-user-auth');
  const userBadge = document.getElementById('user-profile-badge');
  const userName = document.getElementById('user-nav-name');
  const userEmail = document.getElementById('user-nav-email');
  const userAvatar = document.getElementById('user-nav-avatar');

  if (btnLogin) btnLogin.classList.add('hidden');
  if (userBadge) userBadge.classList.remove('hidden');

  if (userName) userName.textContent = user.full_name || user.email.split('@')[0];
  if (userEmail) userEmail.textContent = user.email;

  if (userAvatar) {
    const initial = (user.full_name ? user.full_name[0] : user.email[0]).toUpperCase();
    userAvatar.textContent = initial;
  }

  closeUserAuthModal();
}

function setUserLoggedOut() {
  appState.user = null;
  const btnLogin = document.getElementById('btn-open-user-auth');
  const userBadge = document.getElementById('user-profile-badge');

  if (btnLogin) btnLogin.classList.remove('hidden');
  if (userBadge) userBadge.classList.add('hidden');

  setTelegramDisconnected();
  if (ws) {
    try { ws.close(); } catch (e) {}
    ws = null;
  }
}

function openUserAuthModal() {
  const modal = document.getElementById('user-auth-modal');
  if (modal) {
    modal.classList.remove('hidden');
    clearAuthErrors();
  }
}

function closeUserAuthModal() {
  const modal = document.getElementById('user-auth-modal');
  if (modal) modal.classList.add('hidden');
  clearAuthErrors();
}

function toggleAuthMode() {
  if (appState.authMode === 'login') {
    switchAuthMode('register');
  } else {
    switchAuthMode('login');
  }
}

function switchAuthMode(mode) {
  appState.authMode = mode;
  const btnLogin = document.getElementById('tab-login-btn');
  const btnRegister = document.getElementById('tab-register-btn');
  const nameGroup = document.getElementById('register-name-group');
  const modalTitle = document.getElementById('user-auth-modal-title');
  const submitBtn = document.getElementById('btn-auth-submit');
  const switchText = document.getElementById('auth-switch-text');
  const switchBtn = document.getElementById('auth-switch-btn');

  clearAuthErrors();

  if (mode === 'login') {
    if (btnLogin) btnLogin.classList.add('active');
    if (btnRegister) btnRegister.classList.remove('active');
    if (nameGroup) nameGroup.classList.add('hidden');
    if (modalTitle) modalTitle.textContent = "Shaxsiy Kabinetga Kirish";
    if (submitBtn) submitBtn.textContent = "Kirish";
    if (switchText) switchText.textContent = "Hali akkauntingiz yo'qmi?";
    if (switchBtn) switchBtn.textContent = "Ro'yxatdan o'tish";
  } else {
    if (btnLogin) btnLogin.classList.remove('active');
    if (btnRegister) btnRegister.classList.add('active');
    if (nameGroup) nameGroup.classList.remove('hidden');
    if (modalTitle) modalTitle.textContent = "Ro'yxatdan O'tish";
    if (submitBtn) submitBtn.textContent = "Ro'yxatdan o'tish";
    if (switchText) switchText.textContent = "Akkauntingiz bormi?";
    if (switchBtn) switchBtn.textContent = "Kirish";
  }
}

function clearAuthErrors() {
  const errEl = document.getElementById('user-auth-error');
  const succEl = document.getElementById('user-auth-success');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
  if (succEl) {
    succEl.textContent = '';
    succEl.classList.add('hidden');
  }
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthErrors();

  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-user-password').value;
  const fullName = document.getElementById('auth-full-name').value.trim();
  const errEl = document.getElementById('user-auth-error');
  const succEl = document.getElementById('user-auth-success');
  const btn = document.getElementById('btn-auth-submit');

  btn.disabled = true;
  btn.textContent = "Kutilmoqda...";

  const isRegister = appState.authMode === 'register';
  const url = isRegister ? '/api/auth/register' : '/api/auth/login';
  const payload = isRegister ? { email, password, full_name: fullName } : { email, password };

  try {
    const { res, data } = await safeFetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Xatolik yuz berdi");
    }

    if (isRegister) {
      succEl.textContent = "Muvaffaqiyatli ro'yxatdan o'tdingiz!";
      succEl.classList.remove('hidden');
    }

    showToast(isRegister ? "Xush kelibsiz! Shaxsiy kabinetingiz ochildi." : "Muvaffaqiyatli kirdingiz!", "success");
    setUserLoggedIn(data.user);
    initApp();
    connectWebSocket();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = isRegister ? "Ro'yxatdan o'tish" : "Kirish";
  }
}

// ----------------- Firebase Google Authentication -----------------
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB8ZfLGqGprrilq-AP3ZzuQ2DESW_OCu4A",
  authDomain: "idialno-rasilka.firebaseapp.com",
  projectId: "idialno-rasilka",
  storageBucket: "idialno-rasilka.firebasestorage.app",
  messagingSenderId: "661702211662",
  appId: "1:661702211662:web:5b4001b341bf1c29d4eb1f",
  measurementId: "G-SVT2JTXSNQ"
};

let firebaseInitialized = false;
let currentFirebaseConfig = DEFAULT_FIREBASE_CONFIG;

async function initFirebase() {
  try {
    // 1. Initialize immediately with embedded config if available
    if (window.firebase && !firebase.apps.length && DEFAULT_FIREBASE_CONFIG.apiKey) {
      firebase.initializeApp(DEFAULT_FIREBASE_CONFIG);
      firebaseInitialized = true;
    }

    // 2. Fetch server-side updated config if exists
    const { res, data } = await safeFetchJson('/api/auth/firebase-config');
    if (res.ok && data.ok && data.config && data.config.apiKey) {
      currentFirebaseConfig = data.config;
      if (window.firebase && !firebase.apps.length) {
        firebase.initializeApp(data.config);
      }
      firebaseInitialized = true;
    }
    const gBtnText = document.getElementById('google-btn-text');
    if (gBtnText) gBtnText.textContent = "Google orqali kirish (1-bosish)";
  } catch (e) {
    console.warn("Firebase config yuklanmadi:", e);
  }
}

function openFirebaseConfigModal() {
  const modal = document.getElementById('firebase-config-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('firebase-config-input');
    if (input && currentFirebaseConfig) {
      input.value = JSON.stringify(currentFirebaseConfig, null, 2);
    }
    const errEl = document.getElementById('firebase-config-error');
    const succEl = document.getElementById('firebase-config-success');
    if (errEl) errEl.classList.add('hidden');
    if (succEl) succEl.classList.add('hidden');
  }
}

function closeFirebaseConfigModal() {
  const modal = document.getElementById('firebase-config-modal');
  if (modal) modal.classList.add('hidden');
}

function parseFirebaseSnippet(rawText) {
  rawText = (rawText || '').trim();
  if (!rawText) return null;

  // 1. Direct JSON parse
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object' && parsed.apiKey) {
      return parsed;
    }
  } catch (e) {}

  // 2. Regex parser for JS config snippet
  const extract = (key) => {
    const m = rawText.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, 'i'));
    return m ? m[1].trim() : '';
  };

  const apiKey = extract('apiKey');
  const authDomain = extract('authDomain');
  const projectId = extract('projectId');
  const storageBucket = extract('storageBucket');
  const messagingSenderId = extract('messagingSenderId');
  const appId = extract('appId');
  const measurementId = extract('measurementId');

  if (apiKey && (projectId || authDomain)) {
    const cfg = { apiKey, authDomain, projectId };
    if (storageBucket) cfg.storageBucket = storageBucket;
    if (messagingSenderId) cfg.messagingSenderId = messagingSenderId;
    if (appId) cfg.appId = appId;
    if (measurementId) cfg.measurementId = measurementId;
    return cfg;
  }

  return null;
}

async function saveFirebaseConfigFromModal() {
  const input = document.getElementById('firebase-config-input');
  const errEl = document.getElementById('firebase-config-error');
  const succEl = document.getElementById('firebase-config-success');
  const btn = document.getElementById('btn-save-firebase-config');

  if (errEl) errEl.classList.add('hidden');
  if (succEl) succEl.classList.add('hidden');

  const raw = input ? input.value : '';
  const parsed = parseFirebaseSnippet(raw);

  if (!parsed || !parsed.apiKey) {
    if (errEl) {
      errEl.textContent = "Noto'g'ri config! Firebase'dan olingan kodni (apiKey, authDomain, projectId) to'liq kiriting.";
      errEl.classList.remove('hidden');
    }
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saqlanmoqda...";

  try {
    const { res, data } = await safeFetchJson('/api/auth/firebase-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: parsed })
    });

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Firebase sozlamalarini saqlab bo'lmadi");
    }

    currentFirebaseConfig = parsed;
    if (window.firebase) {
      if (!firebase.apps.length) {
        firebase.initializeApp(parsed);
      }
      firebaseInitialized = true;
    }

    if (succEl) {
      succEl.textContent = "Sozlandi! Google oynasi ochilmoqda...";
      succEl.classList.remove('hidden');
    }

    setTimeout(() => {
      closeFirebaseConfigModal();
      quickGoogleLogin();
    }, 700);
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Saqlash va Google bilan Kirish";
  }
}

async function quickGoogleLogin() {
  if (!window.firebase) {
    showToast("Firebase kutubxonasi yuklanmadi, internetni tekshiring", "error");
    return;
  }

  if (!firebaseInitialized || !firebase.apps.length) {
    openFirebaseConfigModal();
    return;
  }

  const btn = document.getElementById('btn-google-login');
  const btnText = document.getElementById('google-btn-text');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = "Google oynasi ochilmoqda...";

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Official Google Sign-In Popup window!
    const result = await firebase.auth().signInWithPopup(provider);
    const gUser = result.user;
    if (!gUser || !gUser.email) {
      throw new Error("Google hisobidan ma'lumot olinmadi!");
    }

    if (btnText) btnText.textContent = "Avtorizatsiya qilinmoqda...";

    const idToken = await gUser.getIdToken();
    const payload = {
      email: gUser.email,
      full_name: gUser.displayName || gUser.email.split('@')[0],
      avatar: gUser.photoURL || '',
      credential: idToken
    };

    const { res, data } = await safeFetchJson('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Google orqali tizimga kirib bo'lmadi");
    }

    showToast(`Xush kelibsiz, ${data.user.full_name || data.user.email}!`, "success");
    setUserLoggedIn(data.user);
    initApp();
    connectWebSocket();
  } catch (err) {
    console.error("Firebase Google Sign-in error:", err);
    if (err.code === 'auth/popup-closed-by-user') {
      showToast("Google oynasi yopildi", "info");
      return;
    }
    if (err.code === 'auth/unauthorized-domain') {
      const currentHost = window.location.hostname;
      const msg = `Diqqat: '${currentHost}' domenini Firebase Console -> Authentication -> Settings -> Authorized domains ga qo'shing!`;
      const errEl = document.getElementById('user-auth-error');
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      showToast(msg, "error");
      return;
    }
    if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found') {
      const msg = "Firebase Console'da Authentication hali yoqilmagan! Firebase konsoliga kiring -> Authentication bo'limidan 'Get started' ni bosing va 'Google'ni yoqing.";
      const errEl = document.getElementById('user-auth-error');
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('hidden');
      }
      showToast(msg, "error");
      return;
    }

    const errEl = document.getElementById('user-auth-error');
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
    showToast(err.message || "Google orqali kirishda xato yuz berdi", "error");
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Google orqali kirish";
  }
}

async function logoutUser() {
  if (!confirm("Haqiqatan ham shaxsiy kabinetdan chiqmoqchimisiz?")) return;
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUserLoggedOut();
    showToast("Tizimdan chiqildi", "info");
    openUserAuthModal();
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ----------------- Fetch Initial User Dashboard Status -----------------
async function initApp() {
  try {
    const { res, data } = await safeFetchJson('/api/status');
    if (res.status === 401) {
      setUserLoggedOut();
      openUserAuthModal();
      return;
    }

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

// ----------------- WebSocket Connection (Per User) -----------------
function connectWebSocket() {
  if (!appState.user) return;
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[WS] Shaxsiy kabinetga ulandi');
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
      } else if (msg.type === 'new_log') {
        appendLog(msg.data.log);
        if (msg.data.stats) updateStats(msg.data.stats);
      }
    } catch (err) {
      console.error('WS parse error:', err);
    }
  };

  ws.onclose = () => {
    if (appState.user) {
      setTimeout(connectWebSocket, 3000);
    }
  };
}

// ----------------- Telegram Auth Flow -----------------
function openAuthModal() {
  if (!appState.user) {
    openUserAuthModal();
    return;
  }
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
  document.getElementById('account-name').textContent = `TG: ${fullName}`;
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
  document.getElementById('account-name').textContent = 'Telegram ulanmagan';

  document.getElementById('auth-login-prompt').classList.remove('hidden');
  document.getElementById('auth-connected-view').classList.add('hidden');
}

// ----------------- Profile Modal & Advanced Telegram Settings -----------------
function openProfileModal() {
  if (!appState.user) {
    openUserAuthModal();
    return;
  }
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  const u = appState.user;
  const nameEl = document.getElementById('profile-modal-name');
  const emailEl = document.getElementById('profile-modal-email');
  const avatarEl = document.getElementById('profile-modal-avatar');

  if (nameEl) nameEl.textContent = u.full_name || u.email.split('@')[0];
  if (emailEl) emailEl.textContent = u.email;
  if (avatarEl) {
    const init = (u.full_name ? u.full_name[0] : u.email[0]).toUpperCase();
    avatarEl.textContent = init;
  }

  const tgUserTitle = document.getElementById('profile-tg-user-title');
  const tgPhoneTitle = document.getElementById('profile-tg-phone-title');
  const tgStatusBadge = document.getElementById('profile-tg-status-badge');

  if (appState.telegram.isAuthorized && appState.telegram.user) {
    const tg = appState.telegram.user;
    if (tgUserTitle) tgUserTitle.textContent = `${tg.first_name || ''} ${tg.last_name || ''}`.trim() || 'Telegram Akkaunt';
    if (tgPhoneTitle) tgPhoneTitle.textContent = tg.phone ? `+${tg.phone.replace('+', '')}` : 'Raqam mavjud';
    if (tgStatusBadge) {
      tgStatusBadge.textContent = 'Ulangan (Faol)';
      tgStatusBadge.className = 'stat-chip stat-chip-success';
    }
  } else {
    if (tgUserTitle) tgUserTitle.textContent = 'Telegram ulanmagan';
    if (tgPhoneTitle) tgPhoneTitle.textContent = 'Rassilka qilish uchun profilni ulang';
    if (tgStatusBadge) {
      tgStatusBadge.textContent = 'Ulanmagan';
      tgStatusBadge.className = 'stat-chip stat-chip-warning';
    }
  }

  fetch('/api/status').then(r => r.json()).then(data => {
    if (data.analytics) {
      const a = data.analytics;
      const cEl = document.getElementById('profile-stat-campaigns');
      const sEl = document.getElementById('profile-stat-sent');
      const rEl = document.getElementById('profile-stat-rate');
      const fEl = document.getElementById('profile-stat-failed');

      if (cEl) cEl.textContent = a.total_campaigns || 0;
      if (sEl) sEl.textContent = a.total_sent || 0;
      if (rEl) rEl.textContent = `${a.success_rate || 0}%`;
      if (fEl) fEl.textContent = (a.total_not_found || 0) + (a.total_failed || 0);
    }
  }).catch(() => {});

  modal.classList.remove('hidden');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleCustomApiFields() {
  const fields = document.getElementById('custom-api-fields');
  const arrow = document.getElementById('api-toggle-arrow');
  if (!fields) return;
  if (fields.classList.contains('hidden')) {
    fields.classList.remove('hidden');
    if (arrow) arrow.textContent = '▲';
  } else {
    fields.classList.add('hidden');
    if (arrow) arrow.textContent = '▼';
  }
}

async function requestCode() {
  const apiId = document.getElementById('auth-api-id').value.trim();
  const apiHash = document.getElementById('auth-api-hash').value.trim();
  const phone = document.getElementById('auth-phone').value.trim();
  const errEl = document.getElementById('auth-error-1');
  const btn = document.getElementById('btn-request-code');

  errEl.classList.add('hidden');

  if (!phone) {
    errEl.textContent = "Telegram telefon raqamingizni kiriting!";
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

    if (!data.ok) throw new Error(data.error || "Kod yuborilmadi");

    if (data.status === 'already_authorized') {
      showToast('Telegram akkaunt allaqachon ulangan!', 'success');
      setTelegramAuthorized(data.user);
      return;
    }

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

    if (!data.ok) throw new Error(data.error || "Kod noto'g'ri");

    if (data.status === 'password_needed') {
      document.getElementById('auth-step-2').classList.add('hidden');
      document.getElementById('auth-step-3').classList.remove('hidden');
      document.getElementById('auth-modal-title').textContent = '2FA Parolini kiriting';
      return;
    }

    if (data.status === 'success') {
      showToast('Telegram akkaunt muvaffaqiyatli ulandi!', 'success');
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

    if (!data.ok) throw new Error(data.error || "Parol noto'g'ri");

    showToast('Telegram akkaunt muvaffaqiyatli ulandi!', 'success');
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
  if (!confirm("Rostdan ham Telegram akkauntingizni uzmoqchimisiz?")) return;
  try {
    await fetch('/api/auth/logout_telegram', { method: 'POST' });
    setTelegramDisconnected();
    showToast('Telegram akkaunt uzildi', 'info');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ----------------- Excel File Upload & Handling -----------------
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');
  if (!dropzone) return;

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
  if (!appState.user) {
    openUserAuthModal();
    return;
  }

  const formData = new FormData();
  formData.append('excel_file', file);

  document.getElementById('dropzone-filename').textContent = `Fayl yuklanmoqda: ${file.name}...`;

  try {
    const res = await fetch('/api/excel/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || "Excel faylni yuklashda xatolik");

    const parsed = data.data;
    appState.excel.filePath = parsed.file_path;
    appState.excel.headers = parsed.headers;
    appState.excel.contacts = parsed.contacts;
    appState.excel.totalContacts = parsed.total_contacts;
    appState.excel.phoneColIdx = parsed.phone_col_idx;
    appState.excel.nameColIdx = parsed.name_col_idx;

    document.getElementById('dropzone-filename').textContent = `Yuklandi: ${file.name}`;
    document.getElementById('total-contacts-badge').textContent = `${parsed.total_contacts} ta`;
    document.getElementById('excel-summary').classList.remove('hidden');

    populateColumnSelectors(parsed.headers, parsed.phone_col_idx, parsed.name_col_idx);
    renderPreviewTable(parsed.preview);
    showToast(`Excel yuklandi! Jami: ${parsed.total_contacts} ta kontakt`, 'success');
  } catch (err) {
    document.getElementById('dropzone-filename').textContent = "Excel faylni bu yerga tashlang yoki bosing";
    showToast(err.message, 'error');
  }
}

function populateColumnSelectors(headers, phoneIdx, nameIdx) {
  const phoneSelect = document.getElementById('phone-column-select');
  const nameSelect = document.getElementById('name-column-select');

  phoneSelect.innerHTML = '';
  nameSelect.innerHTML = '<option value="-1">— Belgilanmagan —</option>';

  headers.forEach((h, i) => {
    const optPhone = document.createElement('option');
    optPhone.value = i;
    optPhone.textContent = `${h} (Ustun ${i+1})`;
    if (i === phoneIdx) optPhone.selected = true;
    phoneSelect.appendChild(optPhone);

    const optName = document.createElement('option');
    optName.value = i;
    optName.textContent = `${h} (Ustun ${i+1})`;
    if (i === nameIdx) optName.selected = true;
    nameSelect.appendChild(optName);
  });
}

function updateColumnMapping() {
  const phoneIdx = parseInt(document.getElementById('phone-column-select').value);
  const nameIdx = parseInt(document.getElementById('name-column-select').value);

  appState.excel.phoneColIdx = phoneIdx;
  appState.excel.nameColIdx = nameIdx >= 0 ? nameIdx : null;

  appState.excel.contacts.forEach(c => {
    const rawVal = c.extra[appState.excel.headers[phoneIdx]];
    if (rawVal) c.phone = cleanPhone_js(rawVal);
    if (appState.excel.nameColIdx !== null) {
      c.name = c.extra[appState.excel.headers[appState.excel.nameColIdx]] || '';
    } else {
      c.name = '';
    }
  });

  const previewSlice = appState.excel.contacts.slice(0, 5).map(c => ({
    id: c.id,
    phone: c.phone,
    name: c.name || '—'
  }));
  renderPreviewTable(previewSlice);
  updateMessagePreview();
}

function cleanPhone_js(val) {
  let digits = String(val).replace(/[^\d+]/g, '');
  let raw = digits.replace('+', '');
  if (raw.length === 9 && ['9', '8', '7', '3', '5'].includes(raw[0])) {
    return '+998' + raw;
  } else if (raw.length === 12 && raw.startsWith('998')) {
    return '+' + raw;
  } else if (!digits.startsWith('+')) {
    return '+' + digits;
  }
  return digits;
}

function renderPreviewTable(rows) {
  const tbody = document.getElementById('preview-table-body');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td style="font-family:'JetBrains Mono', monospace; color:#34d399;">${r.phone}</td>
      <td>${r.name || '—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------- Message Editor & Multi-Variant Anti-Spam -----------------
let currentActiveVariant = 1;
let currentPreviewVariant = 1;

function switchVariantTab(num) {
  currentActiveVariant = num;
  currentPreviewVariant = num;

  for (let i = 1; i <= 3; i++) {
    const tab = document.getElementById(`var-tab-${i}`);
    const pane = document.getElementById(`pane-var-${i}`);
    if (tab) tab.classList.toggle('active', i === num);
    if (pane) pane.style.display = (i === num) ? 'block' : 'none';
  }

  const activeInput = getActiveVariantTextarea();
  if (activeInput) activeInput.focus();

  updateMessagePreview();
}

function getActiveVariantTextarea() {
  if (currentActiveVariant === 1) return document.getElementById('message-text');
  return document.getElementById(`message-text-${currentActiveVariant}`) || document.getElementById('message-text');
}

function onVariantInput(num) {
  updateVariantStatusTags();
  if (currentPreviewVariant === num) {
    updateMessagePreview();
  }
}

function updateVariantStatusTags() {
  const v1 = (document.getElementById('message-text')?.value || '').trim();
  const v2 = (document.getElementById('message-text-2')?.value || '').trim();
  const v3 = (document.getElementById('message-text-3')?.value || '').trim();

  const status2 = document.getElementById('var-status-2');
  if (status2) {
    if (v2) {
      status2.textContent = "To'ldirildi";
      status2.className = "var-tag-status var-filled";
    } else {
      status2.textContent = "Bo'sh";
      status2.className = "var-tag-status var-empty";
    }
  }

  const status3 = document.getElementById('var-status-3');
  if (status3) {
    if (v3) {
      status3.textContent = "To'ldirildi";
      status3.className = "var-tag-status var-filled";
    } else {
      status3.textContent = "Bo'sh";
      status3.className = "var-tag-status var-empty";
    }
  }

  let count = 0;
  if (v1) count++;
  if (v2) count++;
  if (v3) count++;
  if (count === 0) count = 1;

  const summary = document.getElementById('variant-summary-text');
  if (summary) {
    if (count === 1) {
      summary.textContent = "1 ta variant faol (Variant 1)";
    } else {
      summary.textContent = `${count} ta variant faol (Ketma-ket navbat bilan almashinadi)`;
    }
  }
}

function cyclePreviewVariant() {
  const v1 = (document.getElementById('message-text')?.value || '').trim();
  const v2 = (document.getElementById('message-text-2')?.value || '').trim();
  const v3 = (document.getElementById('message-text-3')?.value || '').trim();

  const filled = [];
  if (v1) filled.push(1);
  if (v2) filled.push(2);
  if (v3) filled.push(3);
  if (filled.length === 0) filled.push(1);

  const curIdx = filled.indexOf(currentPreviewVariant);
  const nextIdx = (curIdx + 1) % filled.length;
  currentPreviewVariant = filled[nextIdx];

  updateMessagePreview();
  showToast(`Variant ${currentPreviewVariant} namunasi ko'rsatilmoqda`, 'info');
}

function insertTag(tag) {
  const textarea = getActiveVariantTextarea();
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + tag + text.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + tag.length;
  onVariantInput(currentActiveVariant);
}

// Spintax generator for real-time live preview in UI
function processSpintaxJs(text) {
  if (!text) return '';
  const pattern = /\{([^{}]+)\}/g;
  let loops = 5;
  while (loops > 0 && text.includes('{') && text.includes('|')) {
    const newText = text.replace(pattern, (match, content) => {
      if (content.includes('|')) {
        const options = content.split('|');
        const chosen = options[Math.floor(Math.random() * options.length)];
        return chosen.trim();
      }
      return match;
    });
    if (newText === text) break;
    text = newText;
    loops--;
  }
  return text;
}

function refreshSpintaxPreview() {
  updateMessagePreview();
  showToast("Tasodifiy Spintax varianti yangilandi!", "info");
}

function updateMessagePreview() {
  let text = "";
  if (currentPreviewVariant === 1) {
    text = document.getElementById('message-text')?.value || "";
  } else if (currentPreviewVariant === 2) {
    text = document.getElementById('message-text-2')?.value || "";
  } else if (currentPreviewVariant === 3) {
    text = document.getElementById('message-text-3')?.value || "";
  }

  const label = document.getElementById('preview-variant-label');
  if (label) {
    label.textContent = `Variant ${currentPreviewVariant}`;
  }

  const previewText = document.getElementById('tg-preview-text') || document.getElementById('preview-message-text');
  if (!previewText) return;

  let sampleName = "Ali";
  let samplePhone = "+998 90 123 45 67";

  if (appState.excel.contacts.length > 0) {
    const first = appState.excel.contacts[0];
    if (first.name) sampleName = first.name;
    if (first.phone) samplePhone = first.phone;
  }

  let rendered = text
    .replace(/{ism}/g, sampleName)
    .replace(/{name}/g, sampleName)
    .replace(/{telefon}/g, samplePhone)
    .replace(/{phone}/g, samplePhone);

  // Spintax tasodifiy variantini ko'rsatish
  rendered = processSpintaxJs(rendered);

  if (rendered.trim() === '') {
    previewText.textContent = `Variant ${currentPreviewVariant} matni bu yerda ko'rinadi...`;
  } else {
    previewText.textContent = rendered;
  }
}

// ----------------- Media Attachment -----------------
function handleMediaSelect(e) {
  if (!appState.user) {
    openUserAuthModal();
    return;
  }
  if (!e.target.files.length) return;

  const file = e.target.files[0];
  const formData = new FormData();
  formData.append('media_file', file);

  document.getElementById('media-filename').textContent = `Yuklanmoqda: ${file.name}...`;

  fetch('/api/media/upload', {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (!data.ok) throw new Error(data.error);
    appState.media.filePath = data.file_path;
    appState.media.filename = data.filename;

    document.getElementById('media-filename').textContent = `Rasm biriktirildi: ${file.name}`;
    document.getElementById('media-remove-btn').classList.remove('hidden');
    document.getElementById('media-warning-box')?.classList.remove('hidden');
    showToast('Rasm biriktirildi. Ogohlantirishni o\'qing!', 'info');
  })
  .catch(err => {
    document.getElementById('media-filename').textContent = "Rasm tanlanmagan";
    showToast(err.message, 'error');
  });
}

function removeMedia() {
  appState.media.filePath = null;
  appState.media.filename = null;
  document.getElementById('media-input').value = '';
  document.getElementById('media-filename').textContent = "Rasm tanlanmagan";
  document.getElementById('media-remove-btn').classList.add('hidden');
  document.getElementById('media-warning-box')?.classList.add('hidden');
}

// ----------------- Campaign Controls -----------------
async function startCampaign() {
  if (!appState.user) {
    openUserAuthModal();
    return;
  }

  if (!appState.telegram.isAuthorized) {
    showToast("Avval Telegram akkauntingizni ulang!", "error");
    openAuthModal();
    return;
  }

  if (appState.excel.contacts.length === 0) {
    showToast("Avval Excel faylni yuklang!", "error");
    return;
  }

  const var1 = (document.getElementById('message-text')?.value || '').trim();
  const var2 = (document.getElementById('message-text-2')?.value || '').trim();
  const var3 = (document.getElementById('message-text-3')?.value || '').trim();

  const messages = [];
  if (var1) messages.push(var1);
  if (var2) messages.push(var2);
  if (var3) messages.push(var3);

  if (messages.length === 0 && !appState.media.filePath) {
    showToast("Kamida 1 ta xabar matni yoki rasm kiritilishi shart!", "error");
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

  document.getElementById('logs-table-body').innerHTML = '';

  const payload = {
    contacts: appState.excel.contacts,
    message: messages[0] || "",
    messages: messages,
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

    const varInfo = messages.length > 1 ? `${messages.length} xil variant navbat bilan` : "1 xil variant";
    showToast(`Rassilka boshlandi (${varInfo})!`, "success");
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
    <td style="font-family:'JetBrains Mono', monospace; font-weight:600; color:#34d399;">${entry.phone}</td>
    <td>${entry.name}</td>
    <td><span class="status-badge ${badgeClass}">${label}</span></td>
    <td style="font-size:0.8rem; color:#cbd5e1;">${entry.message || entry.detail || '—'}</td>
  `;

  tbody.appendChild(tr);

  if (scroll) {
    const wrap = document.querySelector('.logs-table-wrap');
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }
}

// ----------------- Campaign History Management -----------------
function openHistoryModal() {
  if (!appState.user) {
    openUserAuthModal();
    return;
  }
  const modal = document.getElementById('history-modal');
  if (modal) {
    modal.classList.remove('hidden');
    loadCampaignHistory();
  }
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  if (modal) modal.classList.add('hidden');
}

async function loadCampaignHistory() {
  const tbody = document.getElementById('history-table-body');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:24px;">Tarix yuklanmoqda...</td></tr>';

  try {
    const res = await fetch('/api/campaign/history');
    if (res.status === 401) {
      setUserLoggedOut();
      closeHistoryModal();
      openUserAuthModal();
      return;
    }
    const data = await res.json();
    if (!data.ok || !data.history || data.history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding:24px;">Hozircha hech qanday rassilka o\'tkazilmagan.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.history.forEach((h, idx) => {
      const tr = document.createElement('tr');
      const preview = h.message_preview ? (h.message_preview.length > 35 ? h.message_preview.substring(0, 35) + '...' : h.message_preview) : '—';
      
      tr.innerHTML = `
        <td style="font-weight:600;">#${h.id}</td>
        <td style="font-size:0.8rem; color:#94a3b8; white-space:nowrap;">${h.created_at}</td>
        <td style="font-size:0.825rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.message_preview || ''}">${preview}</td>
        <td><strong>${h.total}</strong></td>
        <td><span class="stat-chip stat-chip-success">${h.sent}</span></td>
        <td><span class="stat-chip stat-chip-warning">${h.not_found}</span></td>
        <td><span class="stat-chip stat-chip-danger">${h.failed}</span></td>
        <td>
          <a href="/api/campaign/history/${h.id}/download" class="btn-download-sm" download>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px; height:13px;">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Excel
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger" style="padding:24px;">Tarixni yuklashda xatolik: ${err.message}</td></tr>`;
  }
}

// ----------------- Toast Notification -----------------
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// ----------------- Mobile Tab Switcher -----------------
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
