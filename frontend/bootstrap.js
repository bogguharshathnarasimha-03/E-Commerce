(function () {
  // If opened via file://, redirect once to http://localhost:5000/
  try {
    if (location && location.protocol === 'file:') {
      const attempted = sessionStorage.getItem('redirected_to_server');
      if (!attempted) {
        sessionStorage.setItem('redirected_to_server', '1');
        const serverUrl = 'http://localhost:5000/';
        setTimeout(() => {
          try { location.href = serverUrl; } catch (e) {}
        }, 120);
      } else {
        // show a small in-page instruction
        const warning = document.createElement('div');
        warning.style.position = 'fixed';
        warning.style.left = '12px';
        warning.style.right = '12px';
        warning.style.top = '12px';
        warning.style.zIndex = 9999;
        warning.style.padding = '12px';
        warning.style.background = '#fff3cd';
        warning.style.border = '1px solid #ffeeba';
        warning.style.color = '#856404';
        warning.style.borderRadius = '6px';
        warning.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
        warning.innerHTML = '<strong>Open via server:</strong> This page was opened from the filesystem. Please open <a href="http://localhost:5000/" style="font-weight:600">http://localhost:5000/</a> instead so the app can reach its API.';
        document.body && document.body.appendChild(warning);
      }
    }
  } catch (e) {
    // ignore
  }
})();
// bootstrap.js - small placeholder to avoid 404 if referenced by pages.
// If you have your own bootstrap.js, replace this with that file.
console.log('bootstrap.js loaded');