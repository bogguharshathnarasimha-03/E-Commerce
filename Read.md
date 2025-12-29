```markdown
# ShopEasy — split frontend / backend / database

Overview
- Backend serves the frontend (so you must open the site via the server URL)
- API routes are mounted under /api/*
- Database is simple JSON files in the `database/` folder

Folder layout
- project-root/
  - package.json
  - backend/
    - server.js
  - frontend/
    - index.html, admin.html, login.html, cart.html, checkout.html, payment.html, transactions.html
    - style.css, script.js, admin.js, login.js, cart.js, checkout.js, payment.js, transactions.js
  - database/
    - products.json, user.json, transactions.json

How to run (recommended)
1. From project root:
   npm install
   npm start

2. Open your browser at:
   http://localhost:5000/

Important troubleshooting notes
- Do NOT open files with file:// (e.g. double-clicking index.html). That will break fetch() calls. Always use http://localhost:5000/ (or your host).
- If you see an empty page, open DevTools (F12) → Console and Network and check the GET /api/products request. Also check server logs for incoming requests.

Common commands
- Start server: npm start
- Start server with auto-reload (dev): npm run dev

If something still fails, copy the browser console errors and the server console output and paste here — I'll debug further.
```