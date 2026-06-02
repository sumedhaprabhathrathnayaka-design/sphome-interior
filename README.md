# SP Home Interior — PWA (Worker + Admin)

Two installable PWA apps + Google Apps Script backend.

## Folder layout (upload to repo root exactly like this)
```
worker/    → yoursite.github.io/REPO/worker/   (Worker app)
admin/     → yoursite.github.io/REPO/admin/    (Admin app)
shared/    → config.js, logo.js, icons (used by both)
Code.gs    → paste into Google Apps Script
index.html → root redirect to /worker/
```

## QUICK START (3 steps)

### 1. Backend (Google Apps Script)
1. Go to script.google.com → New project
2. Delete default code, paste ALL of `Code.gs`
3. Run → select `setupSheets` → Run → Allow permissions
   (creates 20 workers EMP001–EMP020, all with PIN 0000)
4. Deploy → New deployment → Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the /exec URL

### 2. Config
Edit `shared/config.js` → paste your /exec URL into `BACKEND_URL`

### 3. Upload to GitHub
- Upload everything to repo root
- Settings → Pages → Deploy from branch `main` / `(root)`
- Worker: `…/worker/`   Admin: `…/admin/`

## Logins
- Admin PIN: **1234**
- Worker PIN (all): **0000**  (change in Worker app, or reset from Admin → Workers tab)

## Important
- The worker dropdown ALWAYS shows the 20 workers from config.js, even if the
  backend is down. When the backend is live with data, it upgrades automatically.
- After any code change, bump `CACHE` in worker/sw.js AND admin/sw.js (v1 → v2…)
