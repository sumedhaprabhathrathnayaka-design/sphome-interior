// ═══════════════════════════════════════════════════
//  SP HOME INTERIOR — WORKER APP  (app.js)
//  All backend calls use CONFIG.BACKEND_URL
//  Fixed: SW registration, camera mirror guard,
//         select option styling, PIN change, offline sync
// ═══════════════════════════════════════════════════

/* ── Service Worker Registration ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      console.log('[SW] Registered:', reg.scope);
    }).catch(function (err) {
      console.warn('[SW] Registration failed:', err);
    });
  });
}

/* ── State ── */
const App = {
  worker: null,
  workers: [],
  clockedIn: false,
  clockInTime: null,
  clockInPhoto: null,
  stream: null,
  useFrontCam: true,
  capturedBlob: null,
  coords: null,
  online: navigator.onLine,
  offlineQueue: [],
};

/* ── Helpers ── */
const $ = (id) => document.getElementById(id);
const API = CONFIG.BACKEND_URL;
const CUR = CONFIG.CURRENCY || 'Rs.';

function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = 'toast'; }, 3200);
}

function api(params) {
  const url = new URL(API);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString(), { redirect: 'follow' })
    .then(r => r.json())
    .catch(err => { throw err; });
}

function apiPost(body) {
  return fetch(API, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

/* Upload image as base64 via POST */
function uploadPhoto(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result.split(',')[1]); // base64 string
    };
    reader.readAsDataURL(blob);
  });
}

/* ── Clock ── */
function startClock() {
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ct = $('clockTime');
    if (ct) ct.textContent = `${h}:${m}:${s}`;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dt = $('clockDate');
    if (dt) dt.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Online status ── */
function updateOnline() {
  App.online = navigator.onLine;
  const bar = $('syncBar');
  if (!bar) return;
  bar.className = 'sync-bar ' + (App.online ? 'online' : 'offline');
  bar.querySelector('.sync-txt').textContent = App.online ? 'Live sync' : 'Offline mode';
  if (App.online) flushQueue();
}

window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

/* ── Offline queue ── */
function queueAction(action) {
  App.offlineQueue.push(action);
  try { localStorage.setItem('sphome_queue', JSON.stringify(App.offlineQueue)); } catch (_) {}
  toast('Saved offline — will sync when online');
}

function flushQueue() {
  const q = App.offlineQueue.slice();
  if (!q.length) return;
  App.offlineQueue = [];
  try { localStorage.removeItem('sphome_queue'); } catch (_) {}
  q.forEach(action => apiPost(action).catch(() => App.offlineQueue.push(action)));
}

function loadQueue() {
  try {
    const raw = localStorage.getItem('sphome_queue');
    if (raw) App.offlineQueue = JSON.parse(raw);
  } catch (_) {}
}

/* ── Workers ── */
function loadWorkers() {
  const sel = $('workerSel');

  function populate(list) {
    sel.innerHTML = '<option value="">— Select Worker —</option>';
    App.workers = list || [];
    (list || []).forEach(w => {
      const o = document.createElement('option');
      o.value = w.id;
      o.textContent = w.name + ' (' + w.id + ')';
      sel.appendChild(o);
    });
  }

  // 1) Show something IMMEDIATELY so dropdown is never empty:
  //    cached workers if we have them, otherwise the config defaults.
  let shown = false;
  try {
    const cached = localStorage.getItem('sphome_workers');
    if (cached) {
      const list = JSON.parse(cached);
      if (Array.isArray(list) && list.length > 0) { populate(list); shown = true; }
    }
  } catch (_) {}
  if (!shown) {
    populate(CONFIG.DEFAULT_WORKERS || []);
  }

  // 2) Then try the backend. If it returns a non-empty list, upgrade + cache.
  if (App.online && API && API.indexOf('YOUR_DEPLOYMENT_ID') === -1) {
    api({ action: 'getWorkers' }).then(res => {
      if (res && res.ok && Array.isArray(res.data) && res.data.length > 0) {
        populate(res.data);
        try { localStorage.setItem('sphome_workers', JSON.stringify(res.data)); } catch (_) {}
      }
    }).catch(() => { /* keep whatever we already showed */ });
  }
}

/* ── Worker selection / PIN ── */
$('workerSel').addEventListener('change', function () {
  const id = this.value;
  App.worker = App.workers.find(w => w.id === id) || null;
  $('workerSection').classList.toggle('hidden', !App.worker);
  if (App.worker) {
    checkStatus();
  }
});

function checkStatus() {
  if (!App.worker) return;
  if (!App.online) {
    renderStatus(false, null);
    return;
  }
  api({ action: 'getStatus', workerId: App.worker.id }).then(res => {
    if (res.ok) {
      App.clockedIn = res.clockedIn;
      App.clockInTime = res.clockInTime || null;
      renderStatus(res.clockedIn, res.clockInTime);
    }
  }).catch(() => renderStatus(false, null));
}

function renderStatus(isClockedIn, since) {
  App.clockedIn = isClockedIn;
  const banner = $('statusBanner');
  const sdot = banner.querySelector('.sdot');
  const smain = banner.querySelector('.stt-main');
  const ssub = banner.querySelector('.stt-sub');
  const btnIn = $('btnClockIn');
  const btnOut = $('btnClockOut');

  if (isClockedIn) {
    banner.className = 'status-banner clocked-in';
    smain.textContent = '🟢 Clocked In';
    ssub.textContent = since ? 'Since ' + formatTime(since) : 'Currently working';
    btnIn.disabled = true;
    btnOut.disabled = false;
  } else {
    banner.className = 'status-banner';
    smain.textContent = '⚪ Not Clocked In';
    ssub.textContent = 'Tap Clock In to start';
    btnIn.disabled = false;
    btnOut.disabled = true;
  }
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return iso; }
}

/* ── Camera ── */
async function startCamera() {
  stopCamera();
  const preview = $('wPreview');
  const video = $('wVideo');
  const ph = $('selfiePh');
  const zone = $('selfieZone');

  try {
    const constraints = {
      video: {
        facingMode: App.useFrontCam ? 'user' : 'environment',
        width: { ideal: 640 }, height: { ideal: 640 }
      }
    };
    App.stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = App.stream;
    // Only mirror for front camera
    video.style.transform = App.useFrontCam ? 'scaleX(-1)' : 'scaleX(1)';
    await video.play();
    video.classList.remove('hidden');
    preview.classList.add('hidden');
    ph.classList.add('hidden');
    zone.classList.add('live');
    $('btnCapture').disabled = false;
    $('btnRetake').disabled = true;
    $('btnCamToggle').disabled = false;
    updateLocation();
  } catch (err) {
    toast('Camera error: ' + err.message, true);
  }
}

function stopCamera() {
  if (App.stream) {
    App.stream.getTracks().forEach(t => t.stop());
    App.stream = null;
  }
}

function capturePhoto() {
  const video = $('wVideo');
  const preview = $('wPreview');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 640;
  const ctx = canvas.getContext('2d');
  // Mirror canvas output for front cam to match natural orientation
  if (App.useFrontCam) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    App.capturedBlob = blob;
    preview.src = URL.createObjectURL(blob);
    preview.classList.remove('hidden');
    $('wVideo').classList.add('hidden');
    $('selfieZone').classList.remove('live');
    $('btnCapture').disabled = true;
    $('btnRetake').disabled = false;
    stopCamera();
  }, 'image/jpeg', 0.85);
}

$('btnCamera').addEventListener('click', () => startCamera());
$('btnCapture').addEventListener('click', () => capturePhoto());
$('btnRetake').addEventListener('click', () => { App.capturedBlob = null; startCamera(); });
$('btnCamToggle').addEventListener('click', () => { App.useFrontCam = !App.useFrontCam; startCamera(); });

/* ── Geolocation ── */
function updateLocation() {
  const chip = $('locChip');
  if (!navigator.geolocation) { chip.classList.add('hidden'); return; }
  chip.classList.remove('hidden');
  chip.querySelector('.loc-txt').innerHTML = '📍 Getting location…';
  navigator.geolocation.getCurrentPosition(pos => {
    App.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) };
    chip.querySelector('.loc-txt').innerHTML = `📍 <b>${App.coords.lat.toFixed(5)}, ${App.coords.lng.toFixed(5)}</b> ±${App.coords.acc}m`;
  }, () => {
    App.coords = null;
    chip.querySelector('.loc-txt').innerHTML = '📍 Location unavailable';
  }, { enableHighAccuracy: true, timeout: 10000 });
}

/* ── PIN Modal ── */
let pinBuffer = '';
let pinTarget = null; // 'clockIn' | 'clockOut'

function openPin(target) {
  if (!App.capturedBlob && target === 'clockIn') {
    toast('Please take a selfie photo first', true);
    return;
  }
  if (!App.capturedBlob && target === 'clockOut') {
    toast('Please take a clock-out photo first', true);
    return;
  }
  pinTarget = target;
  pinBuffer = '';
  renderPinDots();
  $('pinError').textContent = '';
  $('pinWorkerLbl').textContent = App.worker ? App.worker.name : '';
  $('pinModal').classList.remove('hidden');
}

function closePinModal() {
  $('pinModal').classList.add('hidden');
  pinBuffer = '';
  pinTarget = null;
}

function renderPinDots() {
  document.querySelectorAll('.pin-dot').forEach((d, i) => {
    d.classList.toggle('filled', i < pinBuffer.length);
  });
}

function pinKey(val) {
  if (val === 'del') {
    pinBuffer = pinBuffer.slice(0, -1);
  } else if (pinBuffer.length < 4) {
    pinBuffer += val;
  }
  renderPinDots();
  if (pinBuffer.length === 4) setTimeout(submitPin, 200);
}

async function submitPin() {
  const DEFAULT_PIN = (CONFIG.DEFAULT_WORKER_PIN || '0000');

  // ── OFFLINE mode ────────────────────────────────
  if (!App.online) {
    const storedPin = localStorage.getItem('sphome_pin_' + App.worker.id);
    // If no PIN stored yet, accept default PIN (0000)
    const expected = storedPin || DEFAULT_PIN;
    if (pinBuffer !== expected) {
      $('pinError').textContent = 'Wrong PIN';
      pinBuffer = '';
      renderPinDots();
      return;
    }
    executeClock();
    return;
  }

  // ── ONLINE mode ──────────────────────────────────
  try {
    const res = await api({ action: 'verifyPin', workerId: App.worker.id, pin: pinBuffer });
    if (res.ok && res.valid) {
      // Cache PIN locally for offline use
      try { localStorage.setItem('sphome_pin_' + App.worker.id, pinBuffer); } catch (_) {}
      executeClock();
    } else {
      $('pinError').textContent = 'Wrong PIN — try again';
      pinBuffer = '';
      renderPinDots();
    }
  } catch (_) {
    // Network error — fall back: accept default PIN or cached PIN
    const storedPin = localStorage.getItem('sphome_pin_' + App.worker.id);
    const expected = storedPin || DEFAULT_PIN;
    if (pinBuffer !== expected) {
      $('pinError').textContent = 'Wrong PIN';
      pinBuffer = '';
      renderPinDots();
      return;
    }
    executeClock();
  }
}

async function executeClock() {
  closePinModal();
  const ts = new Date().toISOString();
  const type = pinTarget; // 'clockIn' | 'clockOut'

  let photoB64 = null;
  if (App.capturedBlob) {
    photoB64 = await uploadPhoto(App.capturedBlob);
  }

  const payload = {
    action: type === 'clockIn' ? 'clockIn' : 'clockOut',
    workerId: App.worker.id,
    workerName: App.worker.name,
    timestamp: ts,
    photo: photoB64,
    lat: App.coords ? App.coords.lat : null,
    lng: App.coords ? App.coords.lng : null,
    accuracy: App.coords ? App.coords.acc : null,
  };

  if (!App.online) {
    queueAction(payload);
    renderStatus(type === 'clockIn', ts);
    App.capturedBlob = null;
    $('wPreview').classList.add('hidden');
    $('selfiePh').classList.remove('hidden');
    toast(type === 'clockIn' ? '🕐 Clocked In (offline)' : '🕕 Clocked Out (offline)');
    return;
  }

  try {
    const res = await apiPost(payload);
    if (res.ok) {
      renderStatus(type === 'clockIn', ts);
      App.capturedBlob = null;
      $('wPreview').classList.add('hidden');
      $('selfiePh').classList.remove('hidden');
      toast(type === 'clockIn' ? '✅ Clocked In!' : '✅ Clocked Out!');
    } else {
      toast(res.error || 'Server error', true);
    }
  } catch (_) {
    queueAction(payload);
    renderStatus(type === 'clockIn', ts);
    App.capturedBlob = null;
    toast(type === 'clockIn' ? '🕐 Clocked In (offline)' : '🕕 Clocked Out (offline)');
  }
}

$('btnClockIn').addEventListener('click', () => openPin('clockIn'));
$('btnClockOut').addEventListener('click', () => openPin('clockOut'));

// Keypad
document.querySelectorAll('.pin-key').forEach(btn => {
  btn.addEventListener('click', function () {
    pinKey(this.dataset.key);
  });
});
$('pinCancel').addEventListener('click', closePinModal);

/* ── Change PIN ── */
$('btnChangePin').addEventListener('click', function () {
  openChangePinSheet();
});

function openChangePinSheet() {
  $('changePinSheet').classList.remove('hidden');
  $('oldPinInput').value = '';
  $('newPinInput').value = '';
  $('confirmPinInput').value = '';
  $('changePinError').textContent = '';
}

$('closePinSheet').addEventListener('click', () => $('changePinSheet').classList.add('hidden'));

$('submitPinChange').addEventListener('click', async function () {
  const oldPin = $('oldPinInput').value.trim();
  const newPin = $('newPinInput').value.trim();
  const confirmPin = $('confirmPinInput').value.trim();

  if (!oldPin || !newPin || !confirmPin) {
    $('changePinError').textContent = 'All fields required'; return;
  }
  if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    $('changePinError').textContent = 'PIN must be 4 digits'; return;
  }
  if (newPin !== confirmPin) {
    $('changePinError').textContent = 'PINs do not match'; return;
  }

  try {
    const res = await apiPost({
      action: 'changePin',
      workerId: App.worker.id,
      oldPin: oldPin,
      newPin: newPin,
    });
    if (res.ok) {
      try { localStorage.setItem('sphome_pin_' + App.worker.id, newPin); } catch (_) {}
      $('changePinSheet').classList.add('hidden');
      toast('✅ PIN changed successfully');
    } else {
      $('changePinError').textContent = res.error || 'Wrong current PIN';
    }
  } catch (_) {
    $('changePinError').textContent = 'Network error — try again';
  }
});

/* ── Leave Request ── */
$('btnLeave').addEventListener('click', () => $('leaveSheet').classList.remove('hidden'));
$('closeLeaveSheet').addEventListener('click', () => $('leaveSheet').classList.add('hidden'));
$('submitLeave').addEventListener('click', async function () {
  const type = $('leaveType').value;
  const from = $('leaveFrom').value;
  const to = $('leaveTo').value;
  const reason = $('leaveReason').value.trim();
  if (!from || !to) { toast('Please select dates', true); return; }
  const payload = { action: 'leaveRequest', workerId: App.worker.id, workerName: App.worker.name, leaveType: type, from, to, reason, ts: new Date().toISOString() };
  if (!App.online) { queueAction(payload); $('leaveSheet').classList.add('hidden'); toast('Leave request saved offline'); return; }
  try {
    const res = await apiPost(payload);
    if (res.ok) { $('leaveSheet').classList.add('hidden'); toast('✅ Leave request sent'); }
    else { toast(res.error || 'Failed', true); }
  } catch (_) { queueAction(payload); $('leaveSheet').classList.add('hidden'); toast('Leave saved offline'); }
});

/* ── Advance Request ── */
$('btnAdvanceSubmit').addEventListener('click', async function () {
  const amt = parseFloat($('advanceAmount').value);
  const reason = $('advanceReason').value.trim();
  if (!amt || amt <= 0) { toast('Enter a valid amount', true); return; }
  const payload = { action: 'advanceRequest', workerId: App.worker.id, workerName: App.worker.name, amount: amt, reason, ts: new Date().toISOString() };
  if (!App.online) { queueAction(payload); $('advanceAmount').value = ''; $('advanceReason').value = ''; toast('Advance saved offline'); return; }
  try {
    const res = await apiPost(payload);
    if (res.ok) { $('advanceAmount').value = ''; $('advanceReason').value = ''; toast('✅ Advance request sent'); }
    else { toast(res.error || 'Failed', true); }
  } catch (_) { queueAction(payload); $('advanceAmount').value = ''; toast('Advance saved offline'); }
});

/* ── Records ── */
$('btnRecords').addEventListener('click', async function () {
  $('recordsSheet').classList.remove('hidden');
  loadRecords();
});
$('closeRecordsSheet').addEventListener('click', () => $('recordsSheet').classList.add('hidden'));

document.querySelectorAll('.rec-tab').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.rec-tab').forEach(b => b.classList.remove('on'));
    this.classList.add('on');
    loadRecords(this.dataset.tab);
  });
});

async function loadRecords(tab) {
  tab = tab || 'attendance';
  const container = $('recordsContent');
  container.innerHTML = '<div class="empty-msg">Loading…</div>';
  if (!App.online) { container.innerHTML = '<div class="empty-msg">Records require internet connection</div>'; return; }
  try {
    const res = await api({ action: 'getWorkerRecords', workerId: App.worker.id, tab });
    if (res.ok && res.data) {
      renderRecords(res.data, tab, container);
    } else {
      container.innerHTML = '<div class="empty-msg">No records found</div>';
    }
  } catch (_) { container.innerHTML = '<div class="empty-msg">Unable to load records</div>'; }
}

function renderRecords(data, tab, container) {
  if (!data || !data.length) { container.innerHTML = '<div class="empty-msg">No records</div>'; return; }
  let html = '';
  data.forEach(item => {
    html += `<div class="act-item">
      <div class="act-ico ${tab === 'attendance' ? 'ai-clock' : tab === 'leaves' ? 'ai-leave' : 'ai-adv'}">${tab === 'attendance' ? '🕐' : tab === 'leaves' ? '🌿' : '💰'}</div>
      <div class="act-mid">
        <div class="act-title">${item.title || item.date || ''}</div>
        <div class="act-sub">${item.sub || item.note || ''}</div>
      </div>
      ${item.status ? `<span class="act-badge badge-${item.status}">${item.status}</span>` : ''}
    </div>`;
  });
  container.innerHTML = html;
}

/* ── Init ── */
function init() {
  startClock();
  updateOnline();
  loadQueue();
  loadWorkers();
  // Logo already handled by logo.js
}

document.addEventListener('DOMContentLoaded', init);
