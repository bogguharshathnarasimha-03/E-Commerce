// login.js - unified Login & Register with inline password toggles and no captcha on register
const API_BASE = '/api';

function el(id){ return document.getElementById(id); }

const tabLogin = el('tab-login');
const tabRegister = el('tab-register');

const loginForm = el('login-form');
const liPhone = el('li-phone');
const liPassword = el('li-password');
const liPwToggle = el('li-pw-toggle');
const liCaptchaBox = el('li-captcha-box');
const liCaptcha = el('li-captcha');
const liCaptchaRefresh = el('li-captcha-refresh');
const loginMsg = el('login-msg');

const signupForm = el('signup-form');
const suName = el('su-name');
const suPhone = el('su-phone');
const suPassword = el('su-password');
const suPassword2 = el('su-password2');
const suPwToggle = el('su-pw-toggle');
const suPw2Toggle = el('su-pw2-toggle');
const signupMsg = el('signup-msg');

function setActiveTab(tab) {
  if (tab === 'login') {
    tabLogin.classList.add('active'); tabLogin.setAttribute('aria-selected','true');
    tabRegister.classList.remove('active'); tabRegister.setAttribute('aria-selected','false');
    loginForm.style.display = ''; signupForm.style.display = 'none';
    clearMsgs();
  } else {
    tabRegister.classList.add('active'); tabRegister.setAttribute('aria-selected','true');
    tabLogin.classList.remove('active'); tabLogin.setAttribute('aria-selected','false');
    signupForm.style.display = ''; loginForm.style.display = 'none';
    clearMsgs();
  }
}

function clearMsgs() {
  if (loginMsg) { loginMsg.textContent=''; loginMsg.className='msg'; }
  if (signupMsg) { signupMsg.textContent=''; signupMsg.className='msg'; }
}

function setMsg(node, text, cls) {
  if (!node) return;
  node.textContent = text || '';
  node.className = 'msg' + (cls ? ' ' + cls : '');
}

function genCaptcha(len=6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789^%$';
  let s=''; for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function refreshLoginCaptcha() {
  if (liCaptchaBox) liCaptchaBox.textContent = genCaptcha();
  if (liCaptcha) liCaptcha.value = '';
  if (loginMsg && loginMsg.classList.contains('error')) setMsg(loginMsg, '');
}

function phoneDigits(v) { return (v||'').toString().replace(/\D+/g,'').slice(0,10); }

function attachInlinePwToggle(btn, input) {
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; btn.setAttribute('aria-pressed','true'); }
    else { input.type = 'password'; btn.textContent = 'Show'; btn.setAttribute('aria-pressed','false'); }
  });
}

// handle tab clicks/keyboard
if (tabLogin) { tabLogin.addEventListener('click', ()=> setActiveTab('login')); tabLogin.addEventListener('keydown', (e)=> { if(e.key==='Enter' || e.key===' ') setActiveTab('login'); }); }
if (tabRegister) { tabRegister.addEventListener('click', ()=> setActiveTab('register')); tabRegister.addEventListener('keydown', (e)=> { if(e.key==='Enter' || e.key===' ') setActiveTab('register'); }); }

attachInlinePwToggle(liPwToggle, liPassword);
attachInlinePwToggle(suPwToggle, suPassword);
attachInlinePwToggle(suPw2Toggle, suPassword2);

// refresh captcha button
if (liCaptchaRefresh) liCaptchaRefresh.addEventListener('click', ()=> refreshLoginCaptcha());

// Signup handler (no captcha)
if (signupForm) {
  signupForm.addEventListener('submit', async (e)=> {
    e.preventDefault();
    setMsg(signupMsg, '', '');
    const name = (suName && suName.value || '').trim();
    const phoneRaw = (suPhone && suPhone.value || '').trim();
    const password = (suPassword && suPassword.value) || '';
    const password2 = (suPassword2 && suPassword2.value) || '';

    if (!name) return setMsg(signupMsg, 'Enter name', 'error');
    const phone = phoneDigits(phoneRaw);
    if (!/^\d{10}$/.test(phone)) return setMsg(signupMsg, 'Phone must be 10 digits', 'error');
    if (password !== password2) return setMsg(signupMsg, 'Passwords do not match', 'error');
    if (!/(?=.{8,})(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(password)) return setMsg(signupMsg, 'Password too weak', 'error');

    setMsg(signupMsg, 'Registering...', '');
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ phone, password, name })
      });
      const body = await res.json().catch(()=>null);
      if (res.status === 201) {
        setMsg(signupMsg, 'Registered. Please login.', 'success');
        // auto-switch to login and prefill phone
        if (liPhone) liPhone.value = phone;
        setTimeout(()=> { setActiveTab('login'); setMsg(loginMsg, 'Account created — enter password to login', 'success'); refreshLoginCaptcha(); }, 700);
        return;
      }
      if (res.status === 409) { setMsg(signupMsg, 'Phone already registered', 'error'); return; }
      if (res.status === 400 && body && body.error === 'invalid_phone') { setMsg(signupMsg, 'Phone must be 10 digits', 'error'); return; }
      setMsg(signupMsg, (body && (body.error || body.message)) || 'Registration failed', 'error');
    } catch (err) {
      console.error('Signup error', err);
      setMsg(signupMsg, 'Network error', 'error');
    }
  });
}

// Login handler (still uses captcha)
if (loginForm) {
  loginForm.addEventListener('submit', async (e)=> {
    e.preventDefault();
    setMsg(loginMsg, '', '');
    const phoneRaw = (liPhone && liPhone.value || '').trim();
    const password = (liPassword && liPassword.value) || '';
    const captchaShown = (liCaptchaBox && liCaptchaBox.textContent || '').trim();
    const captchaEntered = (liCaptcha && liCaptcha.value || '').trim();

    if (!captchaEntered) return setMsg(loginMsg, 'Enter CAPTCHA', 'error');
    if (captchaEntered !== captchaShown) { setMsg(loginMsg, 'CAPTCHA does not match', 'error'); if (liCaptchaBox) liCaptchaBox.textContent = genCaptcha(); return; }

    const phone = phoneDigits(phoneRaw);
    if (!/^\d{10}$/.test(phone)) return setMsg(loginMsg, 'Enter a valid 10-digit phone', 'error');
    if (!password) return setMsg(loginMsg, 'Enter password', 'error');

    setMsg(loginMsg, 'Logging in...', '');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ phone, password })
      });
      const body = await res.json().catch(()=>null);
      if (res.ok) {
        const serverPhone = (body && (body.phone || '')).toString().replace(/\D+/g,'').slice(0,10) || phone;
        const stored = { id: body && body.id, phone: serverPhone, name: (body && body.name) || '' };
        localStorage.setItem('user', JSON.stringify(stored));
        setMsg(loginMsg, 'Login successful — redirecting...', 'success');
        setTimeout(()=> location.href = 'index.html', 700);
        return;
      }
      if (res.status === 401) { setMsg(loginMsg, 'Incorrect password', 'error'); return; }
      if (res.status === 404) { setMsg(loginMsg, 'Phone not registered — please register first', 'error'); setActiveTab('register'); if (suPhone) suPhone.value = phone; return; }
      setMsg(loginMsg, (body && (body.error || body.message)) || 'Login failed', 'error');
    } catch (err) {
      console.error('Login error', err);
      setMsg(loginMsg, 'Network error', 'error');
    }
  });
}

// Start state
document.addEventListener('DOMContentLoaded', ()=> {
  setActiveTab('login');
  refreshLoginCaptcha();
});