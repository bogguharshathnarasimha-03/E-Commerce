// adminpage.js - resilient admin UI (for adminpage.html)
// Features:
//  - origin-aware API base (uses location.origin + '/api' when available)
//  - lists server products, Add/Edit/Delete
//  - saves locally when server unreachable (localStorage queue) and supports Sync
//  - shows helpful diagnostics in console and on page

(function () {
  // API base: prefer location.origin when served over http(s), otherwise fallback to localhost
  const API = (location && location.protocol && location.protocol.startsWith('http')) ? (location.origin + '/api') : 'http://localhost:5000/api';
  const diagEl = document.getElementById('diag');
  function diagLog(...args) {
    console.log(...args);
    if (diagEl) {
      diagEl.style.display = 'block';
      diagEl.textContent = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    }
  }

  const productsRoot = document.getElementById('products');
  const noProducts = document.getElementById('no-products');
  const listStatus = document.getElementById('list-status');
  const retryBtn = document.getElementById('retry-btn');
  const syncBtn = document.getElementById('sync-btn');

  const form = document.getElementById('product-form');
  const idInput = document.getElementById('prod-id');
  const nameInput = document.getElementById('prod-name');
  const priceInput = document.getElementById('prod-price');
  const imageInput = document.getElementById('prod-image');
  const saveBtn = document.getElementById('save-btn');
  const deleteBtn = document.getElementById('delete-btn');
  const resetBtn = document.getElementById('reset-btn');
  const formMsg = document.getElementById('form-msg');
  const modeSelect = document.getElementById('mode-select');

  let products = [];         // server products
  const LOCAL_KEY = 'adminpage_local_products';

  function setListStatus(txt, cls = '') {
    listStatus.textContent = txt || '';
    listStatus.className = cls ? `status ${cls}` : 'status small';
  }
  function setFormMsg(txt, cls = '') {
    formMsg.textContent = txt || '';
    formMsg.className = cls ? `status ${cls}` : 'status small';
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // local queue helpers
  function loadLocalQueue() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveLocalQueue(q) { localStorage.setItem(LOCAL_KEY, JSON.stringify(q || [])); }
  function addLocalProduct(p) {
    const q = loadLocalQueue();
    q.push(p);
    saveLocalQueue(q);
    updateSyncButton();
  }
  function clearLocalQueue() { localStorage.removeItem(LOCAL_KEY); updateSyncButton(); }

  function updateSyncButton() {
    const q = loadLocalQueue();
    syncBtn.style.display = (q && q.length) ? 'inline-block' : 'none';
    if (q && q.length) syncBtn.textContent = `Sync ${q.length} local item(s) → server`;
  }

  // fetch server products
  async function fetchProducts() {
    setListStatus('Loading products...');
    retryBtn.style.display = 'none';
    try {
      const res = await fetch(`${API}/products`);
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ' — ' + txt : ''}`);
      }
      products = await res.json();
      renderProducts();
      setListStatus('');
      updateSyncButton();
      diagLog('Products fetched OK. count=', products.length);
    } catch (err) {
      console.error('fetchProducts error', err);
      setListStatus('Failed to load products: ' + (err.message || 'network error'), 'error');
      retryBtn.style.display = 'inline-block';
      renderProducts(); // will show local queue if any
      updateSyncButton();
      diagLog('Fetch error', err.message || err);
    }
  }

  // render combined view: server products first, then local-only items (labelled)
  function renderProducts() {
    productsRoot.innerHTML = '';
    const localQueue = loadLocalQueue();

    const combined = [];
    if (products && products.length) combined.push(...products.map(p => ({...p, _source: 'server'})));
    if (localQueue && localQueue.length) {
      // local items don't have id assigned by server; mark them
      localQueue.forEach((p, idx) => combined.push({...p, _source: 'local', _localIndex: idx}));
    }

    if (!combined.length) {
      noProducts.style.display = 'block';
      return;
    }
    noProducts.style.display = 'none';

    combined.forEach(item => {
      const el = document.createElement('div');
      el.className = 'prod';
      const badge = item._source === 'local' ? '<div style="font-size:11px;color:#b85">LOCAL</div>' : '';
      el.innerHTML = `
        <img class="prod-img" src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name)}" onerror="this.src='https://via.placeholder.com/180x120?text=No+Image'"/>
        <div class="prod-meta">
          <div style="font-weight:700">${escapeHtml(item.name)} ${badge}</div>
          <div class="small">${ item._source === 'server' ? 'ID: ' + item.id : 'Local item' } • Price: ₹${item.price}</div>
        </div>
        <div class="prod-actions">
          <button class="btn btn-plain btn-edit" data-src="${item._source}" data-id="${item._source === 'server' ? item.id : item._localIndex}">Edit</button>
          <button class="btn btn-danger btn-delete" data-src="${item._source}" data-id="${item._source === 'server' ? item.id : item._localIndex}">Delete</button>
        </div>
      `;
      productsRoot.appendChild(el);
    });

    // attach handlers
    productsRoot.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => {
      const src = b.getAttribute('data-src');
      const id = b.getAttribute('data-id');
      startEdit(src, Number(id));
    }));
    productsRoot.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => {
      const src = b.getAttribute('data-src');
      const id = b.getAttribute('data-id');
      deleteItem(src, Number(id));
    }));
  }

  // start edit - if local, we edit the local queue item; if server, we populate server item
  function startEdit(source, id) {
    if (source === 'local') {
      const q = loadLocalQueue();
      const p = q[id];
      if (!p) return setFormMsg('Local product not found', 'error');
      idInput.value = '';            // no server id
      nameInput.value = p.name;
      priceInput.value = p.price;
      imageInput.value = p.image || '';
      modeSelect.value = 'edit';
      saveBtn.textContent = 'Update (local)';
      deleteBtn.style.display = 'inline-block';
      setFormMsg('Editing local product (will sync when server available)');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const p = products.find(x => Number(x.id) === Number(id));
      if (!p) return setFormMsg('Product not found', 'error');
      idInput.value = p.id;
      nameInput.value = p.name;
      priceInput.value = p.price;
      imageInput.value = p.image || '';
      modeSelect.value = 'edit';
      saveBtn.textContent = 'Update product';
      deleteBtn.style.display = 'inline-block';
      setFormMsg(`Editing server product ID ${p.id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // delete either server item or local queued item
  async function deleteItem(source, id) {
    if (source === 'local') {
      if (!confirm('Delete this local (unsynced) product?')) return;
      const q = loadLocalQueue();
      q.splice(id, 1);
      saveLocalQueue(q);
      renderProducts();
      updateSyncButton();
      setListStatus('Deleted local product', 'success');
      setTimeout(()=> setListStatus(''), 1200);
      return;
    }

    if (!confirm('Delete this product from server?')) return;
    setListStatus('Deleting...');
    try {
      const res = await fetch(`${API}/products/${id}`, { method: 'DELETE' });
      if (res.status === 204) {
        // remove from local copy
        products = products.filter(x => Number(x.id) !== Number(id));
        renderProducts();
        setListStatus('Product deleted', 'success');
        resetFormUI();
        setTimeout(()=> setListStatus(''), 1200);
      } else {
        const body = await res.json().catch(()=>null);
        throw new Error(body && body.error ? body.error : `Server ${res.status}`);
      }
    } catch (err) {
      console.error('deleteItem err', err);
      setListStatus('Delete failed: ' + (err.message || ''), 'error');
      diagLog('Delete failed', err);
    }
  }

  function resetFormUI() {
    idInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    imageInput.value = '';
    saveBtn.textContent = 'Add product';
    deleteBtn.style.display = 'none';
    modeSelect.value = 'add';
    setFormMsg('');
  }

  // form submit: if server reachable and mode 'add' -> POST to server, else save local
  async function doSave(e) {
    e.preventDefault();
    const name = nameInput.value.trim();
    const price = Number(priceInput.value);
    const image = imageInput.value.trim();

    if (!name) { setFormMsg('Name required', 'error'); return; }
    if (isNaN(price) || price < 0) { setFormMsg('Enter valid price', 'error'); return; }

    const mode = modeSelect.value;
    const localQueue = loadLocalQueue();

    // If in edit mode with server id present -> attempt server PUT
    if (mode === 'edit' && idInput.value) {
      const id = Number(idInput.value);
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';
      setFormMsg('Updating server product...');
      try {
        const res = await fetch(`${API}/products/${id}`, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ name, price, image })
        });
        if (!res.ok) {
          const txt = await res.text().catch(()=>null);
          throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ' - ' + txt : ''}`);
        }
        const updated = await res.json();
        products = products.map(p => p.id === updated.id ? updated : p);
        renderProducts();
        setFormMsg('Product updated', 'success');
        diagLog('Server update OK', updated);
      } catch (err) {
        console.error('Update failed, saving locally', err);
        // fallback: push an "update" as local record to sync later (we mark with _op)
        localQueue.push({ _op: 'update', id: id, name, price, image });
        saveLocalQueue(localQueue);
        setFormMsg('Server update failed — queued locally to sync later', 'error');
        updateSyncButton();
        diagLog('Queued update locally', err.message || err);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update product';
      }
      return;
    }

    // If mode=edit but idInput empty, treat as local add
    if (mode === 'edit' && !idInput.value) {
      const localItem = { name, price, image };
      addLocalProduct(localItem);
      setFormMsg('Saved locally (no server ID). Sync later.', 'success');
      resetFormUI();
      renderProducts();
      return;
    }

    // mode = add: try server POST first
    saveBtn.disabled = true;
    saveBtn.textContent = 'Adding...';
    setFormMsg('Adding product...');
    try {
      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ name, price, image })
      });
      if (res.status === 201) {
        const created = await res.json();
        // push to top
        products.unshift(created);
        renderProducts();
        setFormMsg('Product added to server', 'success');
        resetFormUI();
        diagLog('Created product', created);
      } else {
        const txt = await res.text().catch(()=>null);
        throw new Error(`HTTP ${res.status}${txt ? ' - ' + txt : ''}`);
      }
    } catch (err) {
      console.error('Add to server failed, saving locally', err);
      addLocalProduct({ name, price, image });
      setFormMsg('Server not reachable — saved locally. Use Sync when server is up.', 'error');
      renderProducts();
      diagLog('Saved locally due to add error', err.message || err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add product';
    }
  }

  // sync local queue to server
  async function syncLocalToServer() {
    const q = loadLocalQueue();
    if (!q || !q.length) { setListStatus('Nothing to sync'); return; }
    setListStatus(`Syncing ${q.length} item(s)...`);
    syncBtn.disabled = true;
    try {
      // Process each item in sequence
      for (let i = 0; i < q.length; i++) {
        const item = q[i];
        // if item has _op 'update', perform PUT
        if (item._op === 'update') {
          const res = await fetch(`${API}/products/${item.id}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name: item.name, price: item.price, image: item.image })
          });
          if (!res.ok) throw new Error(`Update failed ${res.status}`);
        } else {
          // POST new item
          const res = await fetch(`${API}/products`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ name: item.name, price: item.price, image: item.image })
          });
          if (res.status !== 201) {
            const txt = await res.text().catch(()=>null);
            throw new Error(`Post failed ${res.status}${txt ? ' - ' + txt : ''}`);
          }
          const created = await res.json();
          // add to local products list
          products.unshift(created);
        }
      }
      // success
      clearLocalQueue();
      renderProducts();
      setListStatus('Sync complete', 'success');
      setTimeout(()=> setListStatus(''), 1500);
      diagLog('Sync complete');
    } catch (err) {
      console.error('syncLocalToServer err', err);
      setListStatus('Sync failed: ' + (err.message || ''), 'error');
      diagLog('Sync failed', err.message || err);
    } finally {
      syncBtn.disabled = false;
      updateSyncButton();
    }
  }

  // wire events
  resetBtn.addEventListener('click', resetFormUI);
  deleteBtn.addEventListener('click', () => {
    // delete either local or server depending on selected id
    if (!idInput.value) { setFormMsg('No server product selected for delete; remove local in list.', 'error'); return; }
    deleteItem('server', Number(idInput.value));
  });
  form.addEventListener('submit', doSave);
  retryBtn.addEventListener('click', fetchProducts);
  syncBtn.addEventListener('click', syncLocalToServer);

  // initial load
  updateSyncButton();
  fetchProducts();

  // expose helpers for debugging
  window.__adminpage_reload = fetchProducts;
  window.__adminpage_local = () => loadLocalQueue();

  // quick check: if opened via file://, show a helpful note in diag
  if (location.protocol === 'file:') {
    diagLog('Warning: page opened via file://. API base set to', API, '. For consistent behavior open via http://localhost:5000/adminpage.html');
  }
})();