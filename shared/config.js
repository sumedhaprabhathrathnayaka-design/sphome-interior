// ═══════════════════════════════════════════════════
//  SP HOME INTERIOR — CONFIG  (shared/config.js)
//  ✏️  Edit ONLY this file for all settings
// ═══════════════════════════════════════════════════

const CONFIG = {
  // ✅ YOUR GOOGLE APPS SCRIPT BACKEND URL
  // (Replace with your own /exec URL after deploying Code.gs)
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbwk0JWInd52x1RZ9NHEvbt7C7ax22W7cj-ehB20sESz3Pp7Tt3k2DUuVbKu-ioJRpM6qw/exec',

  // Admin PIN — unlock the MD Admin Panel
  ADMIN_PIN: '1234',

  // Worker default PIN — every worker starts with this (can change later)
  DEFAULT_WORKER_PIN: '0000',

  // Company name shown in UI
  COMPANY_NAME: 'SP Home Interior',

  // Currency
  CURRENCY: 'Rs.',

  // Service Worker cache name — bump when deploying new code
  SW_CACHE: 'sphome-v1',

  // ── 20 Test Workers (EMP001–EMP020) ─────────────
  DEFAULT_WORKERS: [
    { id: 'EMP001', name: 'Nimal Perera',        salary: 2000 },
    { id: 'EMP002', name: 'Kamal Silva',          salary: 2000 },
    { id: 'EMP003', name: 'Sunil Fernando',       salary: 2000 },
    { id: 'EMP004', name: 'Ruwan Jayasinghe',     salary: 2000 },
    { id: 'EMP005', name: 'Chamara Bandara',      salary: 2000 },
    { id: 'EMP006', name: 'Lasith Dissanayake',   salary: 2000 },
    { id: 'EMP007', name: 'Pradeep Kumara',       salary: 2000 },
    { id: 'EMP008', name: 'Asanka Rajapaksha',    salary: 2000 },
    { id: 'EMP009', name: 'Thilina Herath',       salary: 2000 },
    { id: 'EMP010', name: 'Mahesh Wickrama',      salary: 2000 },
    { id: 'EMP011', name: 'Sanjeewa Gunawardena', salary: 2000 },
    { id: 'EMP012', name: 'Dilshan Pathirana',    salary: 2000 },
    { id: 'EMP013', name: 'Nuwan Senanayake',     salary: 2000 },
    { id: 'EMP014', name: 'Janaka Liyanage',      salary: 2000 },
    { id: 'EMP015', name: 'Buddhika Madushanka',  salary: 2000 },
    { id: 'EMP016', name: 'Hasitha Wijeratne',    salary: 2000 },
    { id: 'EMP017', name: 'Sajith Premaratne',    salary: 2000 },
    { id: 'EMP018', name: 'Amila Gunasekara',     salary: 2000 },
    { id: 'EMP019', name: 'Chathura Madushanka',  salary: 2000 },
    { id: 'EMP020', name: 'Gayan Sampath',        salary: 2000 },
  ],
};
