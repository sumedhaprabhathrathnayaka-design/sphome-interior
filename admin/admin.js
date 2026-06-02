// ═══════════════════════════════════════════════════
//  SP HOME INTERIOR — ADMIN PANEL  (admin.js)
//  All backend calls use CONFIG.BACKEND_URL
// ═══════════════════════════════════════════════════

/* ── Service Worker (admin panel also registers SW) ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ── State ── */
const Admin = {
  loggedIn: false,
  workers: [],
  pendingRequests: 0,
  currentTab: 'payroll',
};

const API = CONFIG.BACKEND_URL;
const CUR = CONFIG.CURRENCY || 'Rs.';

/* ── Helpers ── */
const $ = (id) => document.getElementById(id);

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
    .then(r => r.json());
}

function apiPost(body) {
  return fetch(API, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

function fmtMoney(v) { return CUR + ' ' + Number(v || 0).toLocaleString(); }

/* ── Login ── */
$('loginBtn').addEventListener('click', doLogin);
$('pinInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

function doLogin() {
  const pin = $('pinInput').value.trim();
  if (pin === CONFIG.ADMIN_PIN) {
    Admin.loggedIn = true;
    $('loginScreen').classList.add('hidden');
    $('adminApp').classList.remove('hidden');
    initAdmin();
  } else {
    $('pinInput').value = '';
    $('pinInput').placeholder = '❌ Wrong PIN';
    setTimeout(() => { $('pinInput').placeholder = '••••'; }, 1500);
  }
}

$('logoutBtn').addEventListener('click', () => {
  Admin.loggedIn = false;
  $('adminApp').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  $('pinInput').value = '';
});

/* ── Month / Year selectors ── */
function initSelectors() {
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mSel = $('monthSel');
  months.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i + 1;
    o.textContent = m;
    if (i === now.getMonth()) o.selected = true;
    mSel.appendChild(o);
  });
  const ySel = $('yearSel');
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = y;
    ySel.appendChild(o);
  }
  mSel.addEventListener('change', refreshCurrentTab);
  ySel.addEventListener('change', refreshCurrentTab);
}

function getMonthYear() {
  return { month: parseInt($('monthSel').value), year: parseInt($('yearSel').value) };
}

/* ── Tabs ── */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
    this.classList.add('on');
    Admin.currentTab = this.dataset.tab;
    document.querySelectorAll('section[id^="t-"]').forEach(s => s.classList.add('hidden'));
    $('t-' + Admin.currentTab).classList.remove('hidden');
    refreshCurrentTab();
  });
});

function refreshCurrentTab() {
  switch (Admin.currentTab) {
    case 'payroll':    loadPayroll();    break;
    case 'attendance': loadAttendance(); break;
    case 'requests':   loadRequests();   break;
    case 'proof':      loadProof();      break;
    case 'settings':   loadSettings();   break;
  }
}

/* ── Payroll ── */
async function loadPayroll() {
  const { month, year } = getMonthYear();
  const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  $('payTitle').textContent = `Payroll — ${months[month]} ${year}`;

  try {
    const res = await api({ action: 'getPayroll', month, year });
    if (!res.ok) throw new Error(res.error);
    const data = res.data || [];

    // Stats
    let totalGross = 0, totalAdv = 0, totalNet = 0;
    data.forEach(w => { totalGross += w.gross || 0; totalAdv += w.advance || 0; totalNet += w.net || 0; });

    $('payStats').innerHTML = `
      <div class="a-stat"><div class="sk">Total Workers</div><div class="sv num">${data.length}</div></div>
      <div class="a-stat"><div class="sk">Gross Payroll</div><div class="sv num">${fmtMoney(totalGross)}</div></div>
      <div class="a-stat s-amber"><div class="sk">Total Advances</div><div class="sv num">${fmtMoney(totalAdv)}</div></div>
      <div class="a-stat"><div class="sk">Net Payroll</div><div class="sv num">${fmtMoney(totalNet)}</div></div>
    `;
    $('paySub').textContent = `${data.length} workers`;

    // Table
    let thead = `<thead><tr>
      <th>Emp No.</th><th class="tc-name">Name</th><th>Days</th><th>Daily Rate</th>
      <th>Gross</th><th>Advance</th><th>Net Pay</th>
    </tr></thead>`;
    let tbody = '<tbody>';
    data.forEach(w => {
      tbody += `<tr>
        <td class="wno">${w.id}</td>
        <td class="tc-name">${w.name}</td>
        <td class="tc-num">${w.days || 0}</td>
        <td class="tc-num">${fmtMoney(w.dailySalary)}</td>
        <td class="tc-gross tc-num">${fmtMoney(w.gross)}</td>
        <td class="tc-adv tc-num">${fmtMoney(w.advance)}</td>
        <td class="tc-net tc-num">${fmtMoney(w.net)}</td>
      </tr>`;
    });
    tbody += '</tbody>';
    let tfoot = `<tfoot><tr>
      <td colspan="4" class="tfoot td.tc-lbl">TOTAL</td>
      <td class="tc-num">${fmtMoney(totalGross)}</td>
      <td class="tc-num">${fmtMoney(totalAdv)}</td>
      <td class="tc-num">${fmtMoney(totalNet)}</td>
    </tr></tfoot>`;
    $('payTable').innerHTML = thead + tbody + tfoot;
  } catch (err) {
    $('payTable').innerHTML = `<tbody><tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">Unable to load payroll data</td></tr></tbody>`;
    toast('Payroll load error: ' + err.message, true);
  }
}

/* ── Attendance ── */
async function loadAttendance() {
  const { month, year } = getMonthYear();
  const daysInMonth = new Date(year, month, 0).getDate();
  $('attSub').textContent = `${month}/${year}`;

  try {
    const res = await api({ action: 'getAttendance', month, year });
    if (!res.ok) throw new Error(res.error);
    const data = res.data || {}; // { workerId: { name, days: { '1': 'in', '2': 'out', ... } } }

    let thead = '<thead><tr><th>Emp</th><th>Name</th>';
    for (let d = 1; d <= daysInMonth; d++) thead += `<th class="dh day-h">${d}</th>`;
    thead += '<th>Total</th></tr></thead>';

    let tbody = '<tbody>';
    Object.values(data).forEach(w => {
      let total = 0;
      let row = `<tr><td class="wno">${w.id}</td><td class="tc-name">${w.name}</td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const status = (w.days && w.days[d]) || '';
        if (status === 'P' || status === 'present') { row += `<td class="tc-in dh">✓</td>`; total++; }
        else if (status === 'H' || status === 'half') { row += `<td class="tc-in dh" style="color:var(--amber)">½</td>`; total += 0.5; }
        else { row += `<td class="tc-miss dh">·</td>`; }
      }
      row += `<td class="tc-num">${total}</td></tr>`;
      tbody += row;
    });
    tbody += '</tbody>';
    $('attTable').innerHTML = thead + tbody;
  } catch (err) {
    $('attTable').innerHTML = `<tbody><tr><td colspan="35" style="text-align:center;padding:40px;color:var(--muted)">No attendance data</td></tr></tbody>`;
  }
}

/* ── Requests ── */
async function loadRequests() {
  const filter = $('reqFilter').value;
  const grid = $('reqGrid');
  grid.innerHTML = '<div class="empty-msg">Loading…</div>';

  try {
    const res = await api({ action: 'getRequests', filter });
    if (!res.ok) throw new Error(res.error);
    const data = res.data || [];

    // Update badge count
    const pending = data.filter(r => r.status === 'pending').length;
    Admin.pendingRequests = pending;
    $('reqCnt').textContent = pending;
    $('reqCnt').className = 'cnt' + (pending === 0 ? ' zero' : '');

    if (!data.length) { grid.innerHTML = '<div class="empty-msg">No requests found</div>'; return; }

    grid.innerHTML = data.map(r => `
      <div class="rq-card">
        ${r.status !== 'pending' ? `<span class="rq-badge ${r.status === 'approved' ? 'appr' : 'rejt'}">${r.status}</span>` : ''}
        <div class="rq-card-top">
          <div class="rq-ico ${r.type === 'leave' ? 'rq-ico-leave' : 'rq-ico-adv'}">${r.type === 'leave' ? '🌿' : '💰'}</div>
          <div>
            <div class="rq-name">${r.workerName}</div>
            <div class="rq-meta">${r.workerId} · ${r.ts ? new Date(r.ts).toLocaleDateString() : ''}</div>
          </div>
        </div>
        <div class="rq-body">
          ${r.type === 'leave'
            ? `<div>${r.leaveType || 'Leave'}</div><div style="font-size:12px;margin-top:4px">${r.from} → ${r.to}</div>`
            : `<div class="rq-big">${fmtMoney(r.amount)}</div>`
          }
          ${r.reason ? `<div class="rq-reason">"${r.reason}"</div>` : ''}
        </div>
        ${r.status === 'pending' ? `
          <div class="rq-actions">
            <button class="rq-approve" onclick="handleRequest('${r.id}','approved')">✓ Approve</button>
            <button class="rq-reject" onclick="handleRequest('${r.id}','rejected')">✕ Reject</button>
          </div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<div class="empty-msg">Unable to load requests</div>';
  }
}

async function handleRequest(id, status) {
  try {
    const res = await apiPost({ action: 'updateRequest', requestId: id, status });
    if (res.ok) { toast(status === 'approved' ? '✅ Approved' : '✕ Rejected'); loadRequests(); }
    else { toast(res.error || 'Failed', true); }
  } catch (_) { toast('Network error', true); }
}

$('reqFilter').addEventListener('change', loadRequests);

/* ── Photo Proof ── */
async function loadProof() {
  const workerId = $('proofWorker').value;
  const date = $('proofDate').value;
  const grid = $('proofGrid');
  grid.innerHTML = '<div class="empty-msg">Loading…</div>';

  try {
    const params = { action: 'getPhotos' };
    if (workerId) params.workerId = workerId;
    if (date) params.date = date;
    const res = await api(params);
    if (!res.ok) throw new Error(res.error);
    const data = res.data || [];
    if (!data.length) { grid.innerHTML = '<div class="empty-msg">No photos found</div>'; return; }

    grid.innerHTML = data.map(p => `
      <div class="proof-card" onclick="openLightbox('${p.url}','${p.workerName}','${p.timestamp}','${p.type}','${p.url}')">
        <img src="${p.url}" alt="${p.workerName}" loading="lazy" onerror="this.src=''">
        <div class="proof-info">
          <div class="proof-wname">${p.workerName}</div>
          <div class="proof-meta">${p.timestamp ? new Date(p.timestamp).toLocaleString() : ''}</div>
          <span class="proof-type ${p.type === 'clockIn' ? 'in' : 'out'}">${p.type === 'clockIn' ? 'Clock In' : 'Clock Out'}</span>
        </div>
      </div>
    `).join('');
  } catch (_) {
    grid.innerHTML = '<div class="empty-msg">Unable to load photos</div>';
  }
}

$('proofWorker').addEventListener('change', loadProof);
$('proofDate').addEventListener('change', loadProof);

function openLightbox(src, name, ts, type, url) {
  $('lbImg').src = src;
  $('lbInfo').innerHTML = `
    <h3>${name}</h3>
    <p>${ts ? new Date(ts).toLocaleString() : ''} · ${type === 'clockIn' ? 'Clock In' : 'Clock Out'}</p>
    ${url ? `<a href="${url}" target="_blank" rel="noopener">⬇ Download Photo</a>` : ''}
  `;
  $('lightbox').classList.remove('hidden');
}

$('lbClose').addEventListener('click', () => $('lightbox').classList.add('hidden'));
$('lightbox').addEventListener('click', function (e) { if (e.target === this) $('lightbox').classList.add('hidden'); });

/* ── Settings / Workers ── */
async function loadSettings() {
  try {
    const res = await api({ action: 'getWorkers' });
    if (!res.ok) throw new Error(res.error);
    Admin.workers = res.data || [];
    renderWorkerTable();
    populateProofWorkerFilter();
  } catch (_) {
    Admin.workers = CONFIG.DEFAULT_WORKERS || [];
    renderWorkerTable();
  }
}

function renderWorkerTable() {
  const tbody = $('wtableBody');
  if (!Admin.workers.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No workers</td></tr>';
    return;
  }
  tbody.innerHTML = Admin.workers.map((w, i) => `
    <tr>
      <td><span class="wno">${w.id}</span></td>
      <td><input value="${w.name}" data-i="${i}" data-field="name" onchange="workerFieldChange(this)"></td>
      <td><input class="sal" value="${w.salary || 0}" data-i="${i}" data-field="salary" onchange="workerFieldChange(this)" type="number" min="0"></td>
      <td><button class="pin-reset-btn" onclick="resetWorkerPin('${w.id}','${w.name}')" title="Reset PIN to 0000">🔑 Reset PIN</button></td>
      <td><button class="x-btn" onclick="removeWorker(${i})">✕</button></td>
    </tr>
  `).join('');
}


/* ── Reset Worker PIN ── */
async function resetWorkerPin(workerId, workerName) {
  const defaultPin = CONFIG.DEFAULT_WORKER_PIN || '0000';
  if (!confirm('Reset PIN for ' + workerName + ' to ' + defaultPin + '?')) return;
  try {
    const res = await apiPost({ action: 'resetPin', workerId, newPin: defaultPin });
    if (res.ok) {
      // Clear cached PIN on this device too
      try { localStorage.removeItem('sphome_pin_' + workerId); } catch (_) {}
      toast('✅ PIN reset to ' + defaultPin + ' for ' + workerName);
    } else {
      toast(res.error || 'Reset failed', true);
    }
  } catch (_) {
    toast('Network error — could not reset PIN', true);
  }
}

function workerFieldChange(el) {
  const i = parseInt(el.dataset.i);
  Admin.workers[i][el.dataset.field] = el.dataset.field === 'salary' ? parseFloat(el.value) : el.value;
}

function removeWorker(i) {
  if (!confirm('Remove ' + Admin.workers[i].name + '?')) return;
  Admin.workers.splice(i, 1);
  renderWorkerTable();
}

$('addWorkerBtn').addEventListener('click', () => {
  const id = 'W' + String(Admin.workers.length + 1).padStart(3, '0');
  Admin.workers.push({ id, name: 'New Worker', salary: 2000 });
  renderWorkerTable();
});

// Save workers button (inside settings panel header)
document.addEventListener('click', async function (e) {
  if (e.target && e.target.id === 'saveWorkersBtn') {
    try {
      const res = await apiPost({ action: 'saveWorkers', workers: Admin.workers });
      if (res.ok) { toast('✅ Workers saved'); }
      else { toast(res.error || 'Failed', true); }
    } catch (_) { toast('Network error', true); }
  }
});

function populateProofWorkerFilter() {
  const sel = $('proofWorker');
  sel.innerHTML = '<option value="">All workers</option>';
  Admin.workers.forEach(w => {
    const o = document.createElement('option');
    o.value = w.id;
    o.textContent = w.name;
    sel.appendChild(o);
  });
}

/* ── Export CSV ── */
$('exportBtn').addEventListener('click', async function () {
  const { month, year } = getMonthYear();
  try {
    const res = await api({ action: 'getPayroll', month, year });
    if (!res.ok || !res.data) { toast('No data to export', true); return; }
    const rows = [['Emp No.', 'Name', 'Days', 'Daily Rate', 'Gross', 'Advance', 'Net Pay']];
    res.data.forEach(w => rows.push([w.id, w.name, w.days, w.dailySalary, w.gross, w.advance, w.net]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `payroll_${year}_${String(month).padStart(2,'0')}.csv`;
    a.click();
  } catch (_) { toast('Export failed', true); }
});

/* ── Refresh / Clear ── */
$('refreshBtn').addEventListener('click', () => { refreshCurrentTab(); toast('Synced'); });

$('clearBtn').addEventListener('click', () => {
  if (!confirm('Clear ALL local data? This cannot be undone.')) return;
  localStorage.clear();
  toast('Local data cleared');
});

/* ── Init ── */
function initAdmin() {
  initSelectors();
  loadPayroll();
  loadRequests(); // to get pending count for badge
}

document.addEventListener('DOMContentLoaded', function () {
  // auto-focus pin input
  const pi = $('pinInput');
  if (pi) pi.focus();
});
