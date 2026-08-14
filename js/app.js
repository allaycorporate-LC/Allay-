// ------------------------------------------------------------
var _isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
var _log   = _isDev ? (...a) => console.error(...a) : () => {};

// ------------------------------------------------------------
// ------------------------------------------------------------

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  _applySidebarState();
}

function _applySidebarState() {
  const sidebar = document.getElementById('left-sidebar');
  if (!sidebar) return;
  const icon  = document.getElementById('sidebar-toggle-icon');
  const label = document.getElementById('sidebar-toggle-label');

  if (sidebarCollapsed) {
    // 1. Hide text immediately (before transition)
    sidebar.querySelectorAll('.nav-section-divider').forEach(el => el.style.display = 'none');
    sidebar.querySelectorAll('.nav-label').forEach(el => el.style.display = 'none');
    sidebar.querySelectorAll('.nav-link').forEach(el => {
      el.style.justifyContent = 'center';
      el.style.paddingLeft    = '0';
      el.style.paddingRight   = '0';
      el.style.gap            = '0';
    });
    if (icon)  icon.setAttribute('data-lucide', 'chevrons-right');
    if (label) label.style.display = 'none';
    lucide.createIcons();
    // 2. Then shrink (transition plays cleanly)
    sidebar.style.width    = '3.5rem';
    sidebar.style.minWidth = '3.5rem';
    setTimeout(_repositionVisibleOverlays, 0);
  } else {
    // 1. First expand width (transition plays)
    sidebar.style.width    = '16rem';
    sidebar.style.minWidth = '16rem';
    setTimeout(_repositionVisibleOverlays, 0);
    if (icon) icon.setAttribute('data-lucide', 'chevrons-left');
    lucide.createIcons();
    // 2. Show text only after transition completes (250ms)
    setTimeout(() => {
      sidebar.querySelectorAll('.nav-section-divider').forEach(el => el.style.display = '');
      sidebar.querySelectorAll('.nav-label').forEach(el => el.style.display = '');
      sidebar.querySelectorAll('.nav-link').forEach(el => {
        el.style.justifyContent = '';
        el.style.paddingLeft    = '';
        el.style.paddingRight   = '';
        el.style.gap            = '';
      });
      if (label) label.style.display = '';
    }, 260);
  }
}

function _closeAllOverlays() {
  const ids = ['profile-page','admin-page','analytics-page','store-page',
                'notifications-page','programs-page','approvals-page','points-page',
                'user-profile-page','other-profile-page','superadmin-ar-page'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
  });
}

function sidebarNav(callback) {
  _closeAllOverlays();
  callback();
}

function _positionOverlayPage(pageId) {
  const page    = document.getElementById(pageId);
  const sidebar = document.getElementById('left-sidebar');
  const header  = document.getElementById('topnav');
  if (!page) return;
  const sidebarW = sidebar ? (sidebar.style.width || '16rem') : '0px';
  const headerH  = header ? header.offsetHeight : 0;
  const bannerEl = document.getElementById('impersonation-banner');
  const bannerH  = (bannerEl && !bannerEl.classList.contains('hidden')) ? bannerEl.offsetHeight : 0;
  page.style.position = 'fixed';
  page.style.left     = sidebarW;
  page.style.top      = (headerH + bannerH) + 'px';
  page.style.right    = '0';
  page.style.bottom   = '0';
  page.style.width    = 'auto';
  page.style.height   = 'auto';
  page.style.zIndex   = '48';
  page.style.display  = '';
}

function _repositionVisibleOverlays() {
  const ids = ['profile-page','admin-page','analytics-page','store-page',
                'notifications-page','programs-page','approvals-page','points-page'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden') && el.style.display !== 'none') {
      _positionOverlayPage(id);
    }
  });
}

function _initSidebarTooltip() {
  if (document.getElementById('sidebar-tip')) return;
  const tip = document.createElement('div');
  tip.id = 'sidebar-tip';
  document.body.appendChild(tip);

  const sidebar = document.getElementById('left-sidebar');
  if (!sidebar) return;

  sidebar.addEventListener('mouseover', (e) => {
    if (!sidebarCollapsed) return;
    const link = e.target.closest('[data-tip]');
    if (!link) return;
    const rect = link.getBoundingClientRect();
    tip.textContent = link.dataset.tip;
    tip.style.left = (rect.right + 8) + 'px';
    tip.style.top  = Math.round(rect.top + rect.height / 2 - 10) + 'px';
    tip.style.display = 'block';
  });

  sidebar.addEventListener('mouseout', () => { tip.style.display = 'none'; });
}

let currentStep = 1;
let _selectedRecipients = [];   // [{ id, name }]
let selectedProgram = null;
let currentPage = 'home';
let employees = [];
let selectedFile = null;
let _csvRequestsData = [];
let _csvPreviewRequestId = null;
let _csvRequestTab = 'pending';
let _pendingRejectId = null;
let currentUser = null;
let _companyMemberIds = null; // pre-computed Set, rebuilt only when allUsers changes
let originalSuperadminUser = null;
let isImpersonating = false;
let _storeEnabled = true; // per-company flag: false = tienda y puntos desactivados
let allUsers = [];
let isLoggedIn = false;
let _approvalsQueue   = [];
let _approvalsHistory = [];
let notificationsTab = 'all';
let sidebarCollapsed = false;

// ── HTML escape ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let notificationsList = [
  { id: 1, type: 'recognition',      name: 'Carlos Ruiz',         action: 'reaccionó a tu reconocimiento',  emoji: '❤️', time: '2 horas',  read: false },
  { id: 2, type: 'comment',          name: 'Ana López',            action: 'comentó en tu reconocimiento',   message: '¡Totalmente merecido! María es increíble 😊', time: '2 horas',  read: false },
  { id: 3, type: 'reaction_multiple',name: 'Diego Torres y otros', action: 'reaccionaron ❤️ a tu reconocimiento', time: '3 horas',  read: true  },
  { id: 4, type: 'recognition',      name: 'Lucas Méndez',         action: 'te reconoció',                   emoji: '⭐', time: '5 horas',  read: true  },
  { id: 5, type: 'milestone',        name: 'Sistema',              action: 'Alcanzaste 500 puntos acumulados', emoji: '🏆', time: '1 día',   read: true  }
];

let companies = [
  { id: 'comp-1', name: 'Tech Corp',      domain: '@techcorp.com'      },
  { id: 'comp-2', name: 'Design Studio',  domain: '@designstudio.com'  },
  { id: 'comp-3', name: 'Marketing Pro',  domain: '@marketingpro.com'  },
  { id: 'comp-0', name: 'Superadmin',     domain: '@superadmin.com'    }
];

function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  const icon  = document.getElementById('eye-icon');
  input.type = input.type === 'password' ? 'text' : 'password';
  icon.setAttribute('data-lucide', input.type === 'password' ? 'eye' : 'eye-off');
  lucide.createIcons();
}

function togglePasswordVisibilityModal(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
  lucide.createIcons();
}

async function handleLogin(e) {
  e.preventDefault();

  const email     = document.getElementById('login-email').value.trim();
  const password  = document.getElementById('login-password').value;
  const errorDiv  = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');
  const loginBtn  = document.getElementById('login-btn');

  if (!email || !password) {
    errorText.textContent = 'Por favor completa todos los campos';
    errorDiv.classList.remove('hidden');
    return;
  }

  loginBtn.disabled = true;
  const originalHTML = loginBtn.innerHTML;
  loginBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> <span>Verificando...</span>';
  lucide.createIcons();

  try {
    const { isOk, error: authError } = await window.authSdk.login(email, password);

    if (!isOk) {
      errorText.textContent = authError?.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : (authError?.message || 'Error al iniciar sesión');
      errorDiv.classList.remove('hidden');
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalHTML;
      lucide.createIcons();
      return;
    }

    await window.dataSdk.refresh();

    const profile = allUsers.find(u => u.email === email);

    if (!profile) {
      errorText.textContent = 'No se encontró perfil de usuario';
      errorDiv.classList.remove('hidden');
      await window.authSdk.logout();
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalHTML;
      lucide.createIcons();
      return;
    }

    currentUser = {
      name:             profile.name,
      email:            profile.email,
      department:       profile.department,
      company_id:       profile.company_id,
      role:             profile.role || 'employee',
      user_id:          profile.email,
      points_to_give:   profile.points_to_give,
      points_to_redeem: profile.points_to_redeem,
      __backendId:      profile.__backendId,
      password_changed: profile.password_changed || false,
      birthday:         profile.birthday         || null,
      anniversary_date: profile.anniversary_date || null,
      auto_birthday:    profile.auto_birthday    ?? true,
      auto_anniversary: profile.auto_anniversary ?? true,
    };

    isLoggedIn = true;
    document.body.classList.toggle('is-superadmin', currentUser.role === 'superadmin');
    document.getElementById('login-form').reset();
    errorDiv.classList.add('hidden');
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalHTML;
    lucide.createIcons();

    if (!currentUser.password_changed) {
      document.getElementById('login-page').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('change-password-modal').classList.remove('hidden');
      document.getElementById('pwd-change-name').textContent = currentUser.name.split(' ')[0];
      document.getElementById('new-password-input').value = '';
      document.getElementById('confirm-password-input').value = '';
      document.getElementById('pwd-change-error').classList.add('hidden');
      validatePasswordRequirements();
      _applySidebarState();
      _initSidebarTooltip();
      lucide.createIcons();
    } else {
      _closeAllOverlays();
      document.getElementById('login-page').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('change-password-modal').classList.add('hidden');
      filterEmployeesByCompany();
      renderEmployeesList();
      updateAdminVisibility();
      updateProfileDisplay();
      updatePointsDisplay();
      _rebuildCompanyMemberIds();
      renderFeed(true);
      loadNotifications();
      loadCompanyPrograms().then(() => _loadApprovals());
      loadHomeSidebar();
      loadCurrentCompanySettings();
      _setupFeedRealtime();
      _setupCommentsRealtime();
      renderWeeklyRecap();
      _applySidebarState();
      _initSidebarTooltip();
      showSuccessToast(`¡Bienvenido, ${currentUser.name}!`);
      lucide.createIcons();
      setTimeout(() => _checkOnboarding(), 700);
    }
  } catch (err) {
    _log('Login error:', err);
    errorText.textContent = 'Error de conexión. Recargá la página e intentá de nuevo.';
    errorDiv.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalHTML;
    lucide.createIcons();
  }
}

// ── Forgot / Reset password flow ─────────────────────────────────────────────

function openForgotPassword() {
  document.getElementById('fp-email').value = '';
  document.getElementById('fp-error').classList.add('hidden');
  document.getElementById('fp-form-step').classList.remove('hidden');
  document.getElementById('fp-sent-step').classList.add('hidden');
  document.getElementById('forgot-password-page').classList.remove('hidden');
}

function closeForgotPassword() {
  document.getElementById('forgot-password-page').classList.add('hidden');
}

async function sendPasswordReset() {
  const emailEl = document.getElementById('fp-email');
  const errorDiv = document.getElementById('fp-error');
  const errorText = document.getElementById('fp-error-text');
  const btn = document.getElementById('fp-send-btn');
  const email = emailEl.value.trim();

  if (!email) {
    errorText.textContent = 'Ingresá tu email para continuar.';
    errorDiv.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando...';
  lucide.createIcons({ nodes: [btn] });
  errorDiv.classList.add('hidden');

  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await window._sb.auth.resetPasswordForEmail(email, { redirectTo });

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Enviar link de recuperación';
  lucide.createIcons({ nodes: [btn] });

  if (error) {
    errorText.textContent = 'No pudimos enviar el email. Verificá la dirección e intentá de nuevo.';
    errorDiv.classList.remove('hidden');
    return;
  }

  document.getElementById('fp-sent-email').textContent = email;
  document.getElementById('fp-form-step').classList.add('hidden');
  document.getElementById('fp-sent-step').classList.remove('hidden');
}

function _openRecoveryPasswordPage() {
  document.getElementById('rp-new-password').value = '';
  document.getElementById('rp-confirm-password').value = '';
  document.getElementById('rp-error').classList.add('hidden');
  document.getElementById('forgot-password-page').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('recovery-password-page').classList.remove('hidden');
  lucide.createIcons();
}

async function saveRecoveryPassword() {
  const newPw  = document.getElementById('rp-new-password').value.trim();
  const confPw = document.getElementById('rp-confirm-password').value.trim();
  const errorDiv  = document.getElementById('rp-error');
  const errorText = document.getElementById('rp-error-text');
  const btn = document.getElementById('rp-save-btn');

  errorDiv.classList.add('hidden');

  if (newPw.length < 8) {
    errorText.textContent = 'La contraseña debe tener al menos 8 caracteres.';
    errorDiv.classList.remove('hidden');
    return;
  }
  if (newPw !== confPw) {
    errorText.textContent = 'Las contraseñas no coinciden.';
    errorDiv.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
  lucide.createIcons({ nodes: [btn] });

  const { error } = await window._sb.auth.updateUser({ password: newPw });

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Guardar nueva contraseña';
  lucide.createIcons({ nodes: [btn] });

  if (error) {
    errorText.textContent = 'No se pudo guardar la contraseña: ' + error.message;
    errorDiv.classList.remove('hidden');
    return;
  }

  // Sign out recovery session so user logs in with new credentials
  await window._sb.auth.signOut();
  document.getElementById('recovery-password-page').classList.add('hidden');
  showSuccessToast('¡Contraseña actualizada! Iniciá sesión con tu nueva contraseña.');
}

// Detect Supabase PASSWORD_RECOVERY event (user clicked the email link)
window._sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    _openRecoveryPasswordPage();
  }
});

// ── Company settings ──────────────────────────────────────────────────────────

async function loadCurrentCompanySettings() {
  if (currentUser?.role === 'superadmin' && !isImpersonating) {
    _storeEnabled = true;
    _applyStoreMode();
    return;
  }
  const companyId = currentUser?.company_id;
  if (!companyId) { _storeEnabled = true; _applyStoreMode(); return; }

  // Use cached _companiesData if already loaded (superadmin impersonating)
  const cached = _companiesData.find(c => c.id === companyId);
  if (cached) {
    _storeEnabled = cached.store_enabled !== false;
    _applyStoreMode();
    return;
  }

  const { isOk, data } = await window.companySdk.getById(companyId);
  _storeEnabled = (isOk && data) ? data.store_enabled !== false : true;
  _applyStoreMode();
}

function _applyStoreMode() {
  // Points section in recognition modal
  const modalPts = document.getElementById('modal-points-section');
  if (modalPts) modalPts.classList.toggle('hidden', !_storeEnabled);

  // Store nav points display
  const storeNav = document.getElementById('store-points-display');
  if (storeNav) storeNav.parentElement?.classList.toggle('hidden', !_storeEnabled);

  // Admin banner (only for company admins, not superadmin)
  const banner = document.getElementById('admin-store-disabled-banner');
  if (banner) {
    const showBanner = !_storeEnabled && currentUser?.role === 'admin' && !isImpersonating;
    banner.classList.toggle('hidden', !showBanner);
  }
}

function logout() {
  // Tear down realtime channels before clearing session
  if (_feedRealtimeChannel) {
    window.recognitionSdk.unsubscribeChannel(_feedRealtimeChannel);
    _feedRealtimeChannel = null;
  }
  if (_commentsRealtimeChannel) {
    window.recognitionSdk.unsubscribeChannel(_commentsRealtimeChannel);
    _commentsRealtimeChannel = null;
  }
  clearTimeout(_feedRefreshTimer);
  _feedRefreshTimer = null;

  window.authSdk.logout();
  currentUser = null;
  isLoggedIn  = false;
  isImpersonating = false;
  document.body.classList.remove('is-superadmin');
  originalSuperadminUser = null;
  _closeAllOverlays();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('change-password-modal').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('impersonation-banner').classList.add('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.add('hidden');
  showSuccessToast('Sesión cerrada correctamente');
}

function validatePasswordRequirements() {
  const newPwd     = document.getElementById('new-password-input').value;
  const confirmPwd = document.getElementById('confirm-password-input').value;
  const saveBtn    = document.getElementById('pwd-change-save-btn');

  const checks = [
    { id: 'req-length', ok: newPwd.length >= 6 },
    { id: 'req-upper',  ok: /[A-Z]/.test(newPwd) },
    { id: 'req-number', ok: /[0-9]/.test(newPwd) },
    { id: 'req-match',  ok: newPwd === confirmPwd && newPwd.length > 0 },
  ];

  checks.forEach(({ id, ok }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('text-gray-300', !ok);
    el.classList.toggle('text-green-500', ok);
    el.textContent = ok ? '✓' : '✕';
  });

  saveBtn.disabled = !checks.every(c => c.ok);
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'new-password-input' || e.target.id === 'confirm-password-input') {
    validatePasswordRequirements();
  }
});

async function saveNewPassword() {
  if (!currentUser) return;

  const newPwd     = document.getElementById('new-password-input').value;
  const confirmPwd = document.getElementById('confirm-password-input').value;
  const errorDiv   = document.getElementById('pwd-change-error');
  const errorText  = document.getElementById('pwd-change-error-text');
  const saveBtn    = document.getElementById('pwd-change-save-btn');

  if (newPwd.length < 6 || !/[A-Z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
    errorText.textContent = 'La contraseña debe tener al menos 6 caracteres, una mayúscula y un número';
    errorDiv.classList.remove('hidden');
    return;
  }
  if (newPwd !== confirmPwd) {
    errorText.textContent = 'Las contraseñas no coinciden';
    errorDiv.classList.remove('hidden');
    return;
  }

  saveBtn.disabled = true;
  const originalText = saveBtn.textContent;
  saveBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
  lucide.createIcons();

  try {
    // Actualizar contraseña en Supabase Auth (nunca guardamos el password en DB)
    const { isOk: authOk, error: authErr } = await window.authSdk.updatePassword(newPwd);
    if (!authOk) {
      errorText.textContent = authErr?.message || 'Error al guardar la contraseña';
      errorDiv.classList.remove('hidden');
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      return;
    }

    // Marcar password_changed en el perfil
    const fullRecord = allUsers.find(u => u.email === currentUser.email);
    if (fullRecord) {
      await window.dataSdk.update({ ...fullRecord, password_changed: true });
    }

    currentUser.password_changed = true;
    const idx = allUsers.findIndex(u => u.email === currentUser.email);
    if (idx !== -1) allUsers[idx] = { ...allUsers[idx], password_changed: true };

    document.getElementById('change-password-modal').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    filterEmployeesByCompany();
    renderEmployeesList();
    updateAdminVisibility();
    updateProfileDisplay();
    updatePointsDisplay();
    showSuccessToast('¡Contraseña establecida correctamente! Bienvenido.');
    setTimeout(() => _checkOnboarding(), 700);
  } catch (error) {
    _log('Error saving password:', error);
    errorText.textContent = 'Error al procesar la solicitud';
    errorDiv.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
    lucide.createIcons();
  }
}

function closeChangePasswordModal(event) {
  if (event && event.target.id !== 'change-password-modal') return;
}

function logoutFromPasswordChange() {
  currentUser = null;
  isLoggedIn  = false;
  document.getElementById('change-password-modal').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.add('hidden');
  showSuccessToast('Sesión cancelada');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showSuccessToast('Contraseña copiada')).catch(_log);
}

function getCompanyByEmail(email) {
  const domain = '@' + email.split('@')[1];
  return companies.find(c => c.domain === domain) || null;
}

function getUserRole(email) {
  if (email.includes('superadmin')) return 'superadmin';
  if (email.includes('admin'))      return 'admin';
  return 'employee';
}

function getAvatarColor(name) {
  const colors = ['bg-[#3d2b56]', 'bg-[#f19ac4]', 'bg-[#c9a7d4]'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const dataHandler = {
  onDataChanged(data) {
    allUsers  = data || [];
    employees = [...allUsers];
    _rebuildCompanyMemberIds();
    if (isLoggedIn && currentUser) {
      filterEmployeesByCompany();
      renderEmployeesList();
      renderPeopleList();
    }
  }
};

function _rebuildCompanyMemberIds() {
  if (!currentUser) { _companyMemberIds = null; return; }
  if (currentUser.role === 'superadmin' && !isImpersonating) { _companyMemberIds = null; return; }
  const cid = currentUser.company_id;
  _companyMemberIds = new Set(allUsers.filter(u => u.company_id === cid).map(u => u.__backendId));
}

function filterEmployeesByCompany() {
  if (!currentUser) return;
  if (currentUser.role === 'superadmin') {
    employees = [...allUsers];
  } else {
    employees = allUsers.filter(emp => emp.company_id === currentUser.company_id && emp.email !== currentUser.email);
  }
}

async function initDataSDK() {
  const result = await window.dataSdk.init(dataHandler);
  if (!result.isOk) _log('Failed to initialize Data SDK');
}

initDataSDK();


const PAGE_SIZE = 7;
let _empPage = 0;

function filterEmployeesSearch() {
  _empPage = 0;
  renderEmployeesList();
}

function renderEmployeesList() {
  const container = document.getElementById('employees-container');
  const countEl   = document.getElementById('employee-count');

  let displayEmployees = [];
  if (!currentUser) {
    displayEmployees = [];
  } else if (currentUser.role === 'superadmin') {
    displayEmployees = allUsers || [];
  } else if (currentUser.role === 'admin') {
    displayEmployees = (allUsers || []).filter(emp => emp.company_id === currentUser.company_id);
  }

  const searchTerm = (document.getElementById('employee-search')?.value || '').toLowerCase().trim();
  if (searchTerm) {
    displayEmployees = displayEmployees.filter(emp =>
      emp.name?.toLowerCase().includes(searchTerm) ||
      emp.email?.toLowerCase().includes(searchTerm) ||
      emp.department?.toLowerCase().includes(searchTerm)
    );
  }

  displayEmployees = [...displayEmployees].sort((a, b) => {
    const co = (a.company_id || '').localeCompare(b.company_id || '');
    return co !== 0 ? co : (a.name || '').localeCompare(b.name || '', 'es');
  });

  const total = displayEmployees.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (_empPage >= totalPages) _empPage = totalPages - 1;
  const paged = displayEmployees.slice(_empPage * PAGE_SIZE, (_empPage + 1) * PAGE_SIZE);

  countEl.textContent = `${total} ${total === 1 ? 'empleado' : 'empleados'}`;

  if (total === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No hay empleados cargados. Sube un archivo CSV para comenzar.</p>';
    return;
  }

  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  const rows = paged.map(emp => `
    <div data-emp-id="${esc(emp.__backendId)}" class="p-4 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 transition flex items-center justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <p class="text-sm font-semibold text-gray-800">${esc(emp.name)}</p>
          <span class="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">${esc(emp.company_id)}</span>
          ${emp.role === 'superadmin' ? '<span class="text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Superadmin</span>' : emp.role === 'admin' ? '<span class="text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Admin</span>' : '<span class="text-xs font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Empleado</span>'}
        </div>
        <p class="text-xs text-gray-500 mt-0.5">${esc(emp.email)} · ${esc(emp.department)}</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="text-right">
          <div class="flex items-center gap-1 text-sm">
            <span class="font-semibold text-violet-600">${Number(emp.points_to_give)}</span>
            <span class="text-xs text-gray-400">para dar</span>
          </div>
          <div class="flex items-center gap-1 text-sm mt-1">
            <span class="font-semibold text-green-600">${Number(emp.points_to_redeem)}</span>
            <span class="text-xs text-gray-400">para canjear</span>
          </div>
        </div>
        ${canManage ? `
        <button onclick="openPointsModal(this.closest('[data-emp-id]').dataset.empId)" class="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition" title="Gestionar puntos">
          <i data-lucide="coins" class="w-4 h-4"></i>
        </button>` : ''}
        ${currentUser?.role === 'superadmin' ? `
        <button onclick="impersonateEmployee(this.closest('[data-emp-id]').dataset.empId)" class="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Usar cuenta de este empleado">
          <i data-lucide="user-check" class="w-4 h-4"></i>
        </button>
        <button onclick="openRoleModal(this.closest('[data-emp-id]').dataset.empId)" class="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition" title="Cambiar rol">
          <i data-lucide="shield" class="w-4 h-4"></i>
        </button>` : ''}
        ${canManage ? `
        <button onclick="deleteEmployee(this.closest('[data-emp-id]').dataset.empId)" class="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="Eliminar empleado">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>` : ''}
      </div>
    </div>
  `).join('');

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
      <button onclick="_empPage--;renderEmployeesList()" ${_empPage === 0 ? 'disabled' : ''} class="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
        <i data-lucide="chevron-left" class="w-4 h-4"></i> Anterior
      </button>
      <span class="text-xs text-gray-500">Página ${_empPage + 1} de ${totalPages}</span>
      <button onclick="_empPage++;renderEmployeesList()" ${_empPage >= totalPages - 1 ? 'disabled' : ''} class="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
        Siguiente <i data-lucide="chevron-right" class="w-4 h-4"></i>
      </button>
    </div>` : '';

  container.innerHTML = rows + pagination;
  renderPeopleList();
  lucide.createIcons();
}

function renderPeopleList() {
  const container = document.getElementById('people-list');
  if (!container) return;
  container.innerHTML = '';
}

function _renderPeopleResults(q) {
  const container = document.getElementById('people-list');
  if (!container || !currentUser) return;

  q = (q || '').toLowerCase().trim();

  // With no query, keep list empty
  if (!q) {
    container.innerHTML = '';
    const emptyMsg = document.getElementById('people-empty-msg');
    if (emptyMsg) emptyMsg.classList.add('hidden');
    return;
  }

  const available = allUsers.filter(emp =>
    (currentUser.role === 'superadmin' || emp.company_id === currentUser.company_id) &&
    emp.email !== currentUser.email &&
    emp.name.toLowerCase().includes(q)
  );

  if (available.length === 0) {
    container.innerHTML = '';
    let emptyMsg = document.getElementById('people-empty-msg');
    if (!emptyMsg) {
      emptyMsg = document.createElement('p');
      emptyMsg.id = 'people-empty-msg';
      emptyMsg.className = 'text-sm text-gray-400 text-center py-4';
      container.after(emptyMsg);
    }
    emptyMsg.textContent = `No se encontró ningún empleado con el nombre "${q}".`;
    emptyMsg.classList.remove('hidden');
    return;
  }

  const emptyMsg = document.getElementById('people-empty-msg');
  if (emptyMsg) emptyMsg.classList.add('hidden');

  container.innerHTML = available.map(emp => {
    const initials    = emp.name.split(' ').map(n => n[0]).join('').toUpperCase();
    const avatarColor = getAvatarColor(emp.name);
    const isSelected  = _selectedRecipients.some(r => r.id === emp.__backendId);
    return `
      <div class="person-item flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 cursor-pointer transition border ${isSelected ? 'bg-violet-50 border-violet-300' : 'border-transparent hover:border-violet-200'}"
           data-name="${esc(emp.name)}" data-id="${esc(emp.__backendId)}" data-email="${esc(emp.email)}" onclick="toggleRecipient(this)">
        <div class="w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold shrink-0">
          ${esc(initials)}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">${esc(emp.name)}</p>
          <p class="text-xs text-gray-500">${esc(emp.department)} · ${esc(emp.email)}</p>
        </div>
        <div class="w-5 h-5 rounded-full border-2 ${isSelected ? 'bg-violet-500 border-violet-500' : 'border-gray-300'} flex items-center justify-center shrink-0 transition">
          ${isSelected ? '<svg viewBox="0 0 12 12" fill="none" class="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function toggleRecipient(el) {
  const id   = el.dataset.id;
  const name = el.dataset.name;
  const idx  = _selectedRecipients.findIndex(r => r.id === id);
  if (idx >= 0) {
    _selectedRecipients.splice(idx, 1);
  } else {
    _selectedRecipients.push({ id, name });
  }
  // Re-render the list to update checkbox state
  renderPeopleList();
  filterPeople(document.getElementById('person-search')?.value || '');
  _renderSelectedBar();
  updateModalBtn();
}

function removeRecipient(id) {
  _selectedRecipients = _selectedRecipients.filter(r => r.id !== id);
  renderPeopleList();
  filterPeople(document.getElementById('person-search')?.value || '');
  _renderSelectedBar();
  updateModalBtn();
}

function _renderSelectedBar() {
  const bar = document.getElementById('selected-recipients-bar');
  if (!bar) return;
  if (_selectedRecipients.length === 0) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  bar.classList.remove('hidden');
  bar.innerHTML = _selectedRecipients.map(r =>
    `<span class="inline-flex items-center gap-1 bg-white border border-violet-200 text-violet-700 text-xs font-medium px-2.5 py-1 rounded-full">
      ${esc(r.name)}
      <button type="button" onclick="removeRecipient('${esc(r.id)}')" class="text-violet-400 hover:text-violet-600 leading-none font-bold">×</button>
    </span>`
  ).join('') +
  `<span class="text-xs text-violet-500 font-semibold self-center ml-1">${_selectedRecipients.length} seleccionado${_selectedRecipients.length > 1 ? 's' : ''}</span>`;
}

const _GROUP_PREFIX = '\n[allay-group:';

function _parseGroupMarker(message) {
  if (!message) return null;
  const idx = message.indexOf(_GROUP_PREFIX);
  if (idx === -1) return null;
  const jsonStr = message.slice(idx + _GROUP_PREFIX.length, -1); // strip trailing ]
  try { return JSON.parse(jsonStr); } catch { return null; }
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  selectedFile = file;
  document.getElementById('upload-btn').disabled = false;
  const hint = input.parentElement.querySelector('p:last-child');
  if (hint) hint.textContent = `Archivo: ${file.name}`;
}

function parseCSV(csvText) {
  // Normalize line endings and strip BOM
  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^﻿/, '');
  const lines = normalized.split('\n').filter(l => l.trim().replace(/;+$/, '').replace(/,+$/, ''));

  // Auto-detect separator: whichever appears more in the header row
  const headerRaw = lines[0];
  const sep = (headerRaw.split(';').length > headerRaw.split(',').length) ? ';' : ',';

  const splitRow = row => row.split(sep).map(c => c.trim());
  const headers = splitRow(headerRaw).map(h => h.toLowerCase().replace(/[À-ÿ]/g, c => {
    // normalize accented chars that may appear garbled (e.g. contraseÃ±a → contraseña)
    try { return decodeURIComponent(escape(c)); } catch { return c; }
  }));

  const idx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
  const nameIdx         = idx(['nombre', 'name']);
  const emailIdx        = idx(['email', 'correo']);
  const passwordIdx     = idx(['contraseña', 'password', 'contrase', 'pass']);
  const deptIdx         = idx(['departamento', 'department', 'depto']);
  const companyIdx      = idx(['empresa', 'company_id', 'company']);
  const roleIdx         = idx(['rol', 'role']);
  const giveIdx         = idx(['para_dar', 'to_give', 'puntos_dar']);
  const redeemIdx       = idx(['para_canjear', 'to_redeem', 'puntos_canjear']);
  const birthdayIdx     = idx(['cumpleaños', 'cumpleanos', 'birthday', 'nacimiento']);
  const anniversaryIdx  = idx(['aniversario', 'anniversary', 'fecha_ingreso', 'ingreso']);

  const newEmployees = [];
  const duplicates   = [];
  const toUpdate     = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    // Require at least name + email (2 cols); everything else has defaults
    if (cols.length >= 2 && cols[0]) {
      const email = cols[emailIdx] || cols[1];
      const existing = allUsers.find(emp => emp.email === email);
      if (existing) { duplicates.push(email); toUpdate.push({ existing, cols }); continue; }
      const rawRole = (roleIdx !== -1 ? cols[roleIdx] : '') || 'employee';
      const validRole = ['employee', 'admin', 'superadmin'].includes(rawRole) ? rawRole : 'employee';

      // Birthday: acepta DD/MM, DD-MM, o DD/MM/YYYY (ignora el año) — normaliza a DD/MM
      let birthday = null;
      if (birthdayIdx !== -1 && cols[birthdayIdx]) {
        const raw = cols[birthdayIdx].trim().replace(/-/g, '/');
        const mDMY = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
        if (mDMY) birthday = `${mDMY[1].padStart(2,'0')}/${mDMY[2].padStart(2,'0')}`;
      }
      // Anniversary: acepta YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY — normaliza a YYYY-MM-DD
      let anniversary_date = null;
      if (anniversaryIdx !== -1 && cols[anniversaryIdx]) {
        const raw = cols[anniversaryIdx].trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          anniversary_date = raw;
        } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(raw)) {
          const parts = raw.split(/[\/\-]/);
          anniversary_date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }

      newEmployees.push({
        name:             cols[nameIdx]    || cols[0],
        email,
        password:         cols[passwordIdx] || 'Allay2024!',
        department:       cols[deptIdx]    || cols[2] || 'General',
        company_id:       cols[companyIdx] || currentUser?.company_id || 'comp-1',
        points_to_give:   parseInt(cols[giveIdx]   || cols[3]) || 100,
        points_to_redeem: parseInt(cols[redeemIdx] || cols[4]) || 0,
        user_id:          email,
        role:             validRole,
        birthday,
        anniversary_date,
      });
    }
  }
  return { employees: newEmployees, duplicates, toUpdate, birthdayIdx, anniversaryIdx };
}

async function uploadEmployees() {
  if (!selectedFile) return;
  const role = currentUser?.role;
  if (role !== 'superadmin' && role !== 'admin') {
    showErrorToast('Solo administradores pueden cargar empleados');
    return;
  }
  if (role === 'admin') {
    await submitCsvRequest();
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const { employees: newEmps, duplicates, toUpdate, birthdayIdx, anniversaryIdx } = parseCSV(e.target.result);

    if (newEmps.length === 0 && toUpdate.length === 0) {
      showErrorToast('No se encontraron filas válidas en el CSV. Verificá que tenga al menos las columnas "nombre" y "email".');
      return;
    }

    const CSV_MAX_ROWS   = 200;
    const CSV_CHUNK_SIZE = 20;  // users per batch
    const CSV_CHUNK_DELAY = 300; // ms between batches to avoid rate-limit

    if (newEmps.length > CSV_MAX_ROWS) {
      showErrorToast(`El archivo tiene ${newEmps.length} filas. El límite es ${CSV_MAX_ROWS} por importación. Dividí el archivo en partes.`);
      return;
    }

    const btn = document.getElementById('upload-btn');
    btn.disabled = true;

    const results = [];
    const chunks = [];
    for (let i = 0; i < newEmps.length; i += CSV_CHUNK_SIZE) {
      chunks.push(newEmps.slice(i, i + CSV_CHUNK_SIZE));
    }

    for (let ci = 0; ci < chunks.length; ci++) {
      const pct = Math.round(((ci * CSV_CHUNK_SIZE) / newEmps.length) * 100);
      btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Cargando... ${pct}%`;
      lucide.createIcons();

      for (const emp of chunks[ci]) {
        const result = await window.dataSdk.create(emp);
        results.push({ emp, ok: result.isOk, error: result.error || null });
      }

      // Brief pause between chunks to avoid overwhelming Supabase
      if (ci < chunks.length - 1) await new Promise(r => setTimeout(r, CSV_CHUNK_DELAY));
    }

    // Update birthday/anniversary_date for existing users
    for (const { existing, cols } of toUpdate) {
      let birthday = null;
      if (birthdayIdx !== -1 && cols[birthdayIdx]) {
        const raw = cols[birthdayIdx].trim().replace(/-/g, '/');
        const mDMY = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
        if (mDMY) birthday = `${mDMY[1].padStart(2,'0')}/${mDMY[2].padStart(2,'0')}`;
      }
      let anniversary_date = null;
      if (anniversaryIdx !== -1 && cols[anniversaryIdx]) {
        const raw = cols[anniversaryIdx].trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          anniversary_date = raw;
        } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(raw)) {
          const parts = raw.split(/[\/\-]/);
          anniversary_date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
      }
      await window.dataSdk.updateDates(existing.__backendId, birthday, anniversary_date);
    }

    await window.dataSdk.refresh();
    filterEmployeesByCompany();
    renderEmployeesList();
    renderAutoRecognitionsAdmin();

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Cargar empleados';
    selectedFile = null;
    document.getElementById('csv-file-input').value = '';
    const hint = document.querySelector('.border-dashed p:last-child');
    if (hint) hint.textContent = 'o arrastra y suelta aquí';

    showCsvResults(results, duplicates);
    lucide.createIcons();
  };
  reader.readAsText(selectedFile);
}

function friendlyCsvError(raw) {
  if (!raw) return 'Error desconocido';
  const r = raw.toLowerCase();
  if (r.includes('failed to send a request to the edge function') || r.includes('failed to fetch'))
    return 'No se pudo conectar con el servidor. Verificá tu conexión a internet.';
  if (r.includes('user already registered') || r.includes('already exists') || r.includes('duplicate') || r.includes('unique'))
    return 'El email ya está registrado en la plataforma.';
  if (r.includes('invalid email') || r.includes('email inválido'))
    return 'El formato del email no es válido.';
  if (r.includes('foreign key') || r.includes('violates') || r.includes('company'))
    return 'El ID de empresa (company_id) no existe. Usá: comp-1, comp-2 o comp-3.';
  if (r.includes('forbidden') || r.includes('403'))
    return 'Sin permiso para crear usuarios. Tu cuenta debe ser admin o superadmin.';
  if (r.includes('unauthorized') || r.includes('401'))
    return 'Sesión no válida. Cerrá sesión y volvé a ingresar.';
  if (r.includes('password') || r.includes('contraseña'))
    return 'La contraseña no cumple los requisitos mínimos (al menos 6 caracteres).';
  if (r.includes('network') || r.includes('fetch') || r.includes('connection'))
    return 'Error de conexión. Verificá tu acceso a internet.';
  if (r.includes('database error') || r.includes('db error'))
    return 'Error de base de datos al crear el usuario. Causas comunes: el company_id no existe, la contraseña tiene menos de 6 caracteres, o hay un conflicto en la base de datos.';
  return raw;
}

function showCsvResults(results, duplicates) {
  const modal   = document.getElementById('csv-results-modal');
  const summary = document.getElementById('csv-results-summary');
  const list    = document.getElementById('csv-results-list');

  const ok  = results.filter(r => r.ok).length;
  const err = results.filter(r => !r.ok).length;

  summary.innerHTML = `
    <span class="flex items-center gap-1.5 text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
      <i data-lucide="check-circle" class="w-4 h-4"></i> ${ok} exitoso(s)
    </span>
    ${err > 0 ? `<span class="flex items-center gap-1.5 text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
      <i data-lucide="x-circle" class="w-4 h-4"></i> ${err} error(es)
    </span>` : ''}
    ${duplicates.length > 0 ? `<span class="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
      <i data-lucide="skip-forward" class="w-4 h-4"></i> ${duplicates.length} duplicado(s)
    </span>` : ''}
  `;

  let html = '';
  for (const r of results) {
    html += `
      <div class="flex items-start gap-3 p-3 rounded-xl ${r.ok ? 'bg-green-50' : 'bg-red-50'} border ${r.ok ? 'border-green-100' : 'border-red-100'}">
        <div class="mt-0.5 shrink-0">
          ${r.ok
            ? '<i data-lucide="check-circle" class="w-4 h-4 text-green-500"></i>'
            : '<i data-lucide="x-circle" class="w-4 h-4 text-red-500"></i>'}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${esc(r.emp.name)}</p>
          <p class="text-xs text-gray-500 truncate">${esc(r.emp.email)}</p>
          ${!r.ok ? `<p class="text-xs text-red-600 mt-1 font-medium">${friendlyCsvError(r.error)}</p>` : ''}
        </div>
      </div>`;
  }
  for (const dup of duplicates) {
    html += `
      <div class="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
        <div class="mt-0.5 shrink-0"><i data-lucide="skip-forward" class="w-4 h-4 text-amber-500"></i></div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${dup}</p>
          <p class="text-xs text-amber-600 mt-0.5">Ya existe en la plataforma &mdash; omitido</p>
        </div>
      </div>`;
  }

  list.innerHTML = html;
  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeCsvResultsModal() {
  document.getElementById('csv-results-modal').classList.add('hidden');
}

// ── CSV Approval Workflow (admin: submit, superadmin: review) ──────────────────

async function submitCsvRequest() {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const csvText = e.target.result;
    const { employees: newEmps } = parseCSV(csvText);

    if (newEmps.length === 0) {
      showErrorToast('El archivo no contiene empleados válidos o todos ya existen.');
      return;
    }

    const btn = document.getElementById('upload-btn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando solicitud...';
    lucide.createIcons();

    const result = await window.csvRequestSdk.submit(
      currentUser.company_id,
      selectedFile.name,
      csvText,
      newEmps.length,
      currentUser.__backendId
    );

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Enviar para aprobación';
    lucide.createIcons();

    if (!result.isOk) {
      showErrorToast('No se pudo enviar la solicitud: ' + (result.error || 'Error desconocido'));
      return;
    }

    if (result.data?.id) {
      const { data: { session } } = await window._sb.auth.getSession().catch(() => ({ data: { session: null } }));
      const token = session?.access_token;

      if (token) {
        // Notificaciones in-app para todos los superadmins
        const superadminIds = allUsers.filter(u => u.role === 'superadmin').map(u => u.__backendId).filter(Boolean);
        if (superadminIds.length > 0) {
          fetch(`${SUPABASE_URL}/functions/v1/send-recognition-notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              notifications: superadminIds.map(saId => ({
                user_id: saId,
                type: 'csv_request',
                data: {
                  request_id: result.data.id,
                  requester_name: currentUser.name,
                  requester_id: currentUser.__backendId,
                  company_id: currentUser.company_id,
                  file_name: selectedFile?.name || 'archivo.csv',
                  row_count: newEmps.length,
                },
              })),
            }),
          }).catch(() => {});
        }

      }
    }

    selectedFile = null;
    document.getElementById('csv-file-input').value = '';
    const hint = document.querySelector('.border-dashed p:last-child');
    if (hint) hint.textContent = 'o arrastra y suelta aquí';
    btn.disabled = true;

    showSuccessToast(`Solicitud enviada (${newEmps.length} empleados). El superadmin la revisará pronto.`);
    loadAdminCsvHistory();
  };
  reader.readAsText(selectedFile);
}

async function loadCsvRequests() {
  if (currentUser?.role !== 'superadmin') return;
  const { data } = await window.csvRequestSdk.list();
  _csvRequestsData = data || [];
  renderCsvRequestsList();
  // Update pending badge
  const pending = _csvRequestsData.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('csv-requests-badge');
  if (badge) {
    badge.textContent = pending;
    badge.classList.toggle('hidden', pending === 0);
  }
}

let _adminCsvHistoryRows = [];
let _adminCsvHistoryPage = 0;
const _ADMIN_CSV_PAGE_SIZE = 2;

async function loadAdminCsvHistory() {
  const { data } = await window.csvRequestSdk.list();
  const myId = currentUser?.__backendId;
  _adminCsvHistoryRows = (data || []).filter(r => r.requested_by === myId);
  _adminCsvHistoryPage = 0;

  const badge = document.getElementById('admin-csv-history-badge');
  if (badge) {
    const pending = _adminCsvHistoryRows.filter(r => r.status === 'pending').length;
    badge.textContent = pending;
    badge.classList.toggle('hidden', pending === 0);
  }

  renderAdminCsvHistory();
}

function renderAdminCsvHistory() {
  const container = document.getElementById('admin-csv-history-list');
  const pagination = document.getElementById('admin-csv-history-pagination');
  if (!container) return;

  if (_adminCsvHistoryRows.length === 0) {
    container.innerHTML = '<p class="text-center py-6 text-gray-400 text-sm">Todavía no enviaste ninguna solicitud.</p>';
    if (pagination) pagination.classList.add('hidden');
    return;
  }

  const totalPages = Math.ceil(_adminCsvHistoryRows.length / _ADMIN_CSV_PAGE_SIZE);
  const start = _adminCsvHistoryPage * _ADMIN_CSV_PAGE_SIZE;
  const pageRows = _adminCsvHistoryRows.slice(start, start + _ADMIN_CSV_PAGE_SIZE);

  const statusBadge = (s) => {
    if (s === 'pending')  return '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">Pendiente</span>';
    if (s === 'approved') return '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Aprobada</span>';
    return '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Rechazada</span>';
  };

  container.innerHTML = pageRows.map(r => {
    const date = new Date(r.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
    const rejection = r.status === 'rejected' && r.rejection_reason
      ? `<p class="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"><span class="font-semibold">Motivo:</span> ${r.rejection_reason}</p>`
      : '';
    return `
      <div class="flex flex-col gap-1 p-4 rounded-xl border border-gray-100 bg-gray-50">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <i data-lucide="file-text" class="w-4 h-4 text-violet-400 shrink-0"></i>
            <span class="text-sm font-semibold text-gray-800">${r.file_name || 'archivo.csv'}</span>
            <span class="text-xs text-gray-400">${r.row_count} empleados</span>
          </div>
          <div class="flex items-center gap-2">
            ${statusBadge(r.status)}
            <span class="text-xs text-gray-400">${date}</span>
          </div>
        </div>
        ${rejection}
      </div>`;
  }).join('');

  if (pagination) {
    pagination.classList.toggle('hidden', totalPages <= 1);
    document.getElementById('admin-csv-page-info').textContent = `${_adminCsvHistoryPage + 1} / ${totalPages}`;
    document.getElementById('admin-csv-prev').disabled = _adminCsvHistoryPage === 0;
    document.getElementById('admin-csv-next').disabled = _adminCsvHistoryPage >= totalPages - 1;
  }

  lucide.createIcons();
}

function adminCsvHistoryPage(dir) {
  const totalPages = Math.ceil(_adminCsvHistoryRows.length / _ADMIN_CSV_PAGE_SIZE);
  _adminCsvHistoryPage = Math.max(0, Math.min(totalPages - 1, _adminCsvHistoryPage + dir));
  renderAdminCsvHistory();
}

function toggleAdminCsvHistory() {
  const body = document.getElementById('admin-csv-history-body');
  const chevron = document.getElementById('admin-csv-history-chevron');
  if (!body) return;
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function setCsvRequestTab(tab) {
  _csvRequestTab = tab;
  ['pending', 'approved', 'rejected'].forEach(t => {
    const btn = document.getElementById(`csv-tab-${t}`);
    if (!btn) return;
    if (t === tab) {
      btn.className = 'px-4 py-1.5 text-sm font-semibold rounded-lg transition bg-white text-violet-600 shadow-sm';
    } else {
      btn.className = 'px-4 py-1.5 text-sm font-semibold rounded-lg transition text-gray-500 hover:bg-gray-200';
    }
  });
  renderCsvRequestsList();
}

function renderCsvRequestsList() {
  const container = document.getElementById('csv-requests-list');
  if (!container) return;

  const filtered = _csvRequestsData.filter(r => r.status === _csvRequestTab);
  if (filtered.length === 0) {
    const labels = { pending: 'solicitudes pendientes', approved: 'solicitudes aprobadas', rejected: 'solicitudes rechazadas' };
    container.innerHTML = `<p class="text-center py-8 text-gray-400 text-sm">No hay ${labels[_csvRequestTab] || 'solicitudes'}</p>`;
    return;
  }

  container.innerHTML = filtered.map(req => {
    const date = new Date(req.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    const requester = allUsers.find(u => u.__backendId === req.requested_by);
    const requesterName = requester?.name || 'Admin';
    const requesterEmail = requester?.email ? ` (${requester.email})` : '';
    const idJson = JSON.stringify(req.id);

    let statusBadge = '';
    if (req.status === 'pending')  statusBadge = '<span class="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pendiente</span>';
    if (req.status === 'approved') statusBadge = '<span class="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aprobado</span>';
    if (req.status === 'rejected') statusBadge = '<span class="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rechazado</span>';

    const actionBtns = req.status === 'pending' ? `
      <button onclick='approveCsvRequest(${idJson})' class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg transition">
        <i data-lucide="check" class="w-3 h-3"></i> Aprobar
      </button>
      <button onclick='openRejectCsvModal(${idJson})' class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition">
        <i data-lucide="x" class="w-3 h-3"></i> Rechazar
      </button>
    ` : '';

    return `
      <div class="flex items-start justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="font-semibold text-gray-800 text-sm truncate">${esc(req.file_name || 'archivo.csv')}</span>
            ${statusBadge}
          </div>
          <p class="text-xs text-gray-500">${esc(requesterName)}${esc(requesterEmail)} · ${esc(req.company_id)} · ${req.row_count} filas · ${date}</p>
          ${req.rejection_reason ? `<p class="text-xs text-red-500 mt-1"><strong>Motivo:</strong> ${esc(req.rejection_reason)}</p>` : ''}
        </div>
        <div class="flex gap-2 shrink-0 flex-wrap justify-end">
          <button onclick='openCsvPreviewModal(${idJson})' class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition">
            <i data-lucide="table" class="w-3 h-3"></i> Ver CSV
          </button>
          ${actionBtns}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function openCsvPreviewModal(id) {
  _csvPreviewRequestId = id;
  const req = _csvRequestsData.find(r => r.id === id);
  if (!req) return;

  const modal = document.getElementById('csv-preview-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const requesterName = allUsers.find(u => u.__backendId === req.requested_by)?.name || 'Admin';
  const subtitle = document.getElementById('csv-preview-subtitle');
  if (subtitle) subtitle.textContent = `${esc(requesterName)} · ${esc(req.company_id)} · ${req.row_count} filas · ${esc(req.file_name || 'archivo.csv')}`;

  // Build HTML table from CSV
  const container = document.getElementById('csv-preview-table-container');
  if (container) {
    try {
      const lines = req.csv_content.split('\n').filter(l => l.trim());
      if (lines.length < 1) {
        container.innerHTML = '<p class="text-gray-400 text-sm text-center py-8">Sin datos</p>';
      } else {
        const headers = lines[0].split(',').map(h => `<th class="px-3 py-2 text-left text-xs font-bold text-gray-600 whitespace-nowrap border-b border-gray-200">${esc(h.trim())}</th>`).join('');
        const rows = lines.slice(1).map(line => {
          const cells = line.split(',').map(c => `<td class="px-3 py-2 text-xs text-gray-700 whitespace-nowrap border-b border-gray-100">${esc(c.trim())}</td>`).join('');
          return `<tr class="hover:bg-gray-50">${cells}</tr>`;
        }).join('');
        container.innerHTML = `
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead class="bg-gray-50"><tr>${headers}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }
    } catch {
      container.innerHTML = '<p class="text-red-500 text-sm text-center py-8">No se pudo procesar el archivo.</p>';
    }
  }

  // Show/hide action buttons based on status
  const actions = document.getElementById('csv-preview-actions');
  const approveBtn = document.getElementById('csv-preview-approve-btn');
  const rejectBtn  = document.getElementById('csv-preview-reject-btn');
  if (approveBtn) {
    approveBtn.onclick = () => { closeCsvPreviewModal(); approveCsvRequest(id); };
    approveBtn.classList.toggle('hidden', req.status !== 'pending');
  }
  if (rejectBtn) {
    rejectBtn.onclick = () => { closeCsvPreviewModal(); openRejectCsvModal(id); };
    rejectBtn.classList.toggle('hidden', req.status !== 'pending');
  }

  lucide.createIcons();
}

function closeCsvPreviewModal() {
  document.getElementById('csv-preview-modal')?.classList.add('hidden');
  _csvPreviewRequestId = null;
}

async function approveCsvRequest(id) {
  const req = _csvRequestsData.find(r => r.id === id);
  if (!req) return;

  // Optimistic update
  req.status = 'approved';
  renderCsvRequestsList();

  const result = await window.csvRequestSdk.approve(id);

  if (!result.isOk) {
    // Revert
    req.status = 'pending';
    renderCsvRequestsList();
    showErrorToast('Error al aprobar: ' + (result.error || 'Error desconocido'));
    return;
  }

  const { okCount = 0, failCount = 0 } = result.data || {};
  showSuccessToast(`CSV aprobado. ${okCount} empleados creados${failCount > 0 ? `, ${failCount} con errores` : ''}.`);

  // Notificar al admin que lo solicitó (client-side para garantizar el destinatario correcto)
  if (req.requested_by) {
    const { data: { session } } = await window._sb.auth.getSession().catch(() => ({ data: { session: null } }));
    const token = session?.access_token;
    if (token) {
      fetch(`${SUPABASE_URL}/functions/v1/send-recognition-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          notifications: [{
            user_id: req.requested_by,
            type: 'csv_approved',
            data: { request_id: req.id, file_name: req.file_name || 'archivo.csv', ok_count: okCount, fail_count: failCount },
          }],
        }),
      }).catch(() => {});
    }
  }

  await window.dataSdk.refresh();
  filterEmployeesByCompany();
  renderEmployeesList();
  await loadCsvRequests();
}

function openRejectCsvModal(id) {
  _pendingRejectId = id;
  const modal = document.getElementById('reject-csv-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const input = document.getElementById('reject-reason-input');
  if (input) input.value = '';
}

function closeRejectCsvModal() {
  document.getElementById('reject-csv-modal')?.classList.add('hidden');
  _pendingRejectId = null;
}

async function confirmRejectCsvRequest() {
  if (!_pendingRejectId) return;
  const id = _pendingRejectId;
  const reason = document.getElementById('reject-reason-input')?.value?.trim() || null;
  closeRejectCsvModal();

  // Optimistic update
  const req = _csvRequestsData.find(r => r.id === id);
  if (req) { req.status = 'rejected'; req.rejection_reason = reason; }
  renderCsvRequestsList();

  const result = await window.csvRequestSdk.reject(id, reason);

  if (!result.isOk) {
    if (req) { req.status = 'pending'; req.rejection_reason = null; }
    renderCsvRequestsList();
    showErrorToast('Error al rechazar la solicitud');
    return;
  }

  showSuccessToast('Solicitud rechazada. El administrador recibirá una notificación.');
  await loadCsvRequests();
}

let _deletingEmployeeId = null;

function deleteEmployee(id) {
  const emp = allUsers.find(e => e.__backendId === id);
  if (!emp) return;
  _deletingEmployeeId = id;
  document.getElementById('delete-employee-name').textContent = emp.name;
  document.getElementById('delete-employee-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeDeleteEmployeeModal() {
  document.getElementById('delete-employee-modal').classList.add('hidden');
  _deletingEmployeeId = null;
}

async function confirmDeleteEmployee() {
  if (!_deletingEmployeeId) return;
  const emp = allUsers.find(e => e.__backendId === _deletingEmployeeId);
  if (!emp) { closeDeleteEmployeeModal(); return; }

  const btn = document.getElementById('delete-employee-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Eliminando...';

  await window.dataSdk.preserveUserNames(emp.__backendId, emp.name);
  const result = await window.dataSdk.delete(emp);

  btn.disabled = false;
  btn.textContent = 'Eliminar';

  if (!result.isOk) {
    showErrorToast('No se pudo eliminar el usuario. Intentá de nuevo.');
    closeDeleteEmployeeModal();
    return;
  }

  allUsers = allUsers.filter(u => u.__backendId !== _deletingEmployeeId);
  closeDeleteEmployeeModal();
  filterEmployeesByCompany();
  renderEmployeesList();
  showSuccessToast(`${emp.name} eliminado correctamente`);
}

async function clearAllEmployees() {
  if (!employees.length) return;
  for (const emp of employees) await window.dataSdk.delete(emp);
  showSuccessToast('Todos los empleados eliminados');
}

// ------------------------------------------------------------
// ------------------------------------------------------------

// ------------------------------------------------------------
// ------------------------------------------------------------

function openPointsModal(empId) {
  const emp = allUsers.find(u => u.__backendId === empId);
  if (!emp) return;
  _pointsTargetId = empId;
  document.getElementById('points-modal-name').textContent      = emp.name;
  document.getElementById('points-give-current').textContent    = emp.points_to_give;
  document.getElementById('points-redeem-current').textContent  = emp.points_to_redeem;
  document.getElementById('points-give-input').value    = '';
  document.getElementById('points-redeem-input').value  = '';
  document.getElementById('points-give-op').value       = 'add';
  document.getElementById('points-redeem-op').value     = 'add';
  document.getElementById('points-modal').classList.remove('hidden');
}

function closePointsModal() {
  document.getElementById('points-modal').classList.add('hidden');
  _pointsTargetId = null;
}

async function savePoints() {
  if (!_pointsTargetId) return;
  const emp = allUsers.find(u => u.__backendId === _pointsTargetId);
  if (!emp) return;

  const giveVal   = parseInt(document.getElementById('points-give-input').value)   || 0;
  const redeemVal = parseInt(document.getElementById('points-redeem-input').value) || 0;
  const giveOp    = document.getElementById('points-give-op').value;
  const redeemOp  = document.getElementById('points-redeem-op').value;

  const newGive   = Math.max(0, giveOp   === 'add' ? emp.points_to_give   + giveVal   : emp.points_to_give   - giveVal);
  const newRedeem = Math.max(0, redeemOp === 'add' ? emp.points_to_redeem + redeemVal : emp.points_to_redeem - redeemVal);

  const btn = document.getElementById('points-save-btn');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const result = await window.dataSdk.update({ ...emp, points_to_give: newGive, points_to_redeem: newRedeem });

  btn.disabled = false;
  btn.textContent = 'Guardar cambios';

  if (result.isOk) {
    showSuccessToast(`Puntos actualizados para ${emp.name}`);
    closePointsModal();
    await window.dataSdk.refresh();
    filterEmployeesByCompany();
    renderEmployeesList();
  } else {
    showErrorToast('Error al actualizar los puntos');
  }
}

function openRoleModal(empId) {
  if (!currentUser || currentUser.role !== 'superadmin') { showErrorToast('Solo superadmins pueden cambiar roles de usuarios'); return; }
  if (empId === currentUser.__backendId) { showErrorToast('No podés cambiar tu propio rol. Pedíselo a otro superadmin.'); return; }
  const emp = allUsers.find(u => u.__backendId === empId);
  if (!emp) return;
  selectedEmployeeForRole = empId;
  document.getElementById('role-modal-user-name').textContent  = emp.name;
  document.getElementById('role-modal-user-email').textContent = emp.email;
  const roleInput = document.querySelector(`input[name="new-role"][value="${emp.role}"]`);
  if (roleInput) roleInput.checked = true;
  document.getElementById('role-modal').classList.remove('hidden');
}

function closeRoleModal() { document.getElementById('role-modal').classList.add('hidden'); }

async function saveRoleChange() {
  if (!currentUser || currentUser.role !== 'superadmin') { showErrorToast('Solo superadmins pueden cambiar roles'); return; }
  if (!selectedEmployeeForRole) { showErrorToast('No hay empleado seleccionado'); return; }
  if (selectedEmployeeForRole === currentUser.__backendId) { showErrorToast('No podés cambiar tu propio rol.'); closeRoleModal(); return; }

  const newRole = document.querySelector('input[name="new-role"]:checked')?.value;
  if (!newRole) { showErrorToast('Seleccioná un rol'); return; }

  const employee = allUsers.find(emp => emp.__backendId === selectedEmployeeForRole);
  if (!employee) { showErrorToast('Empleado no encontrado'); return; }

  const saveBtn = document.getElementById('save-role-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
  lucide.createIcons();

  try {
    // Use the security-definer RPC so the role change bypasses client-side RLS restrictions
    const { error } = await window._sb.rpc('update_user_role', {
      p_target_user_id: employee.__backendId,
      p_new_role:        newRole,
    });

    if (!error) {
      // Update local cache immediately so the UI reflects the change without re-fetching
      employee.role = newRole;
      showSuccessToast(`Rol de ${employee.name} actualizado a ${newRole}`);
      closeRoleModal();
      renderEmployeesList();
      updateAdminVisibility();
    } else {
      _log('saveRoleChange error:', error.message);
      showErrorToast('Error al guardar. Aplicá el SQL fix_17 en Supabase.');
    }
  } catch(e) {
    _log('saveRoleChange exception:', e);
    showErrorToast('Error inesperado al cambiar el rol.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Guardar rol';
  }
}

// ── Global search ─────────────────────────────────────────────────────────────

const _SEARCH_FEATURES = [
  { label: 'Reconocimientos',         icon: 'home',          action: () => { navigateTo('home'); } },
  { label: 'Mis puntos',              icon: 'coins',         action: () => { openPointsPage(); } },
  { label: 'Tienda de recompensas',   icon: 'shopping-bag',  action: () => { navigateTo('store'); } },
  { label: 'Programas',               icon: 'award',         action: () => { openProgramsPage(); } },
  { label: 'Notificaciones',          icon: 'bell',          action: () => { openNotificationsPage(); } },
  { label: 'Mi perfil',               icon: 'user',          action: () => { openUserProfilePage(); } },
  { label: 'Editar perfil',           icon: 'settings',      action: () => { openProfilePage(); } },
  { label: 'Panel de administración', icon: 'shield',        action: () => { navigateTo('admin'); }, adminOnly: true },
  { label: 'Analytics',               icon: 'bar-chart-2',   action: () => { openAnalyticsPage(); }, adminOnly: true },
  { label: 'Reconocimientos automáticos', icon: 'calendar-heart', action: () => { navigateTo('admin'); setTimeout(() => document.getElementById('admin-tab-auto')?.click(), 300); }, adminOnly: true },
  { label: 'Gestión de empresas',     icon: 'building-2',    action: () => { navigateTo('admin'); }, superOnly: true },
];

function onGlobalSearch(q) {
  const panel = document.getElementById('global-search-results');
  if (!panel) return;
  q = q.trim();
  if (!q) { panel.classList.add('hidden'); return; }

  const lq = q.toLowerCase();
  const isAdmin  = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSuper  = currentUser?.role === 'superadmin';
  const companyId = currentUser?.company_id;

  // People
  const people = (allUsers || []).filter(u => {
    if (!isSuper && u.company_id !== companyId) return false;
    return (u.name||'').toLowerCase().includes(lq) ||
           (u.email||'').toLowerCase().includes(lq) ||
           (u.department||'').toLowerCase().includes(lq);
  }).slice(0, 5);

  // Programs
  const programs = (companyPrograms || []).filter(p =>
    !p.pending &&
    ((p.name||'').toLowerCase().includes(lq) ||
     (p.tag||'').toLowerCase().includes(lq) ||
     (p.description||'').toLowerCase().includes(lq))
  ).slice(0, 4);

  // Features
  const features = _SEARCH_FEATURES.filter(f => {
    if (f.superOnly && !isSuper) return false;
    if (f.adminOnly && !isAdmin) return false;
    return f.label.toLowerCase().includes(lq);
  }).slice(0, 4);

  if (!people.length && !programs.length && !features.length) {
    panel.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Sin resultados para "' + esc(q) + '"</p>';
    panel.classList.remove('hidden');
    return;
  }

  let html = '';

  if (people.length) {
    html += '<p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">Personas</p>';
    html += people.map(u => {
      const initials = (u.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2);
      const color = getAvatarColor(u.name||'');
      return `<button onclick="_searchGoUser('${esc(u.__backendId)}')"
        class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 transition text-left">
        <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0">${esc(initials)}</div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${esc(u.name)}</p>
          <p class="text-xs text-gray-400 truncate">${esc(u.department || u.email || '')}</p>
        </div>
      </button>`;
    }).join('');
  }

  if (programs.length) {
    html += '<p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">Programas</p>';
    html += programs.map(p =>
      `<button onclick="_searchGoProgram()"
        class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 transition text-left">
        <span class="text-xl shrink-0">${p.emoji || '⭐'}</span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate">${esc(p.name)}</p>
          ${p.tag ? `<p class="text-xs text-gray-400">#${esc(p.tag)}</p>` : ''}
        </div>
      </button>`
    ).join('');
  }

  if (features.length) {
    html += '<p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">Funcionalidades</p>';
    html += features.map((f, i) =>
      `<button onclick="_searchRunFeature(${_SEARCH_FEATURES.indexOf(f)})"
        class="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 transition text-left">
        <div class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <i data-lucide="${f.icon}" class="w-3.5 h-3.5 text-gray-500"></i>
        </div>
        <p class="text-sm text-gray-700">${esc(f.label)}</p>
      </button>`
    ).join('');
  }

  panel.innerHTML = html;
  panel.classList.remove('hidden');
  lucide.createIcons();
}

function _searchGoUser(userId) {
  _closeGlobalSearch();
  if (userId === currentUser?.__backendId) { openUserProfilePage(); return; }
  openOtherProfile(userId);
}

function openPeekById(userId) {
  if (!userId) return;
  if (userId === currentUser?.__backendId) { openUserProfilePage(); return; }
  openOtherProfile(userId);
}

// ─── Estado de la página de perfil ajeno ──────────────────────────────────────
let _oppUserId  = null;
let _oppRecs    = [];
let _oppFilter  = 'all';

function setOppTab(tab) {
  const isActivity = tab === 'activity';
  document.getElementById('opp-activity-section')?.classList.toggle('hidden', !isActivity);
  document.getElementById('opp-about-section')?.classList.toggle('hidden',    isActivity);
  ['activity','about'].forEach(t => {
    const btn = document.getElementById(`opp-tab-${t}`);
    if (!btn) return;
    btn.className = t === tab
      ? 'px-3 py-1 rounded-lg text-xs font-semibold transition bg-white text-[#3d2b56] shadow-sm'
      : 'px-3 py-1 rounded-lg text-xs font-semibold transition text-gray-500';
  });
}

function setOppFilter(filter) {
  _oppFilter = filter;
  ['all','received','given'].forEach(f => {
    const btn = document.getElementById(`opp-filter-${f}`);
    if (!btn) return;
    btn.className = f === filter
      ? 'opp-filter-btn px-3 py-1 rounded-lg text-xs font-semibold transition bg-white text-[#3d2b56] shadow-sm'
      : 'opp-filter-btn px-3 py-1 rounded-lg text-xs font-semibold transition text-gray-500';
  });
  _renderOppFeed();
}

function _renderOppFeed() {
  const userId = _oppUserId;
  const feed   = document.getElementById('opp-feed');
  if (!feed) return;

  let recs = _oppRecs;
  if (_oppFilter === 'given')    recs = recs.filter(r => r._type === 'sent');
  if (_oppFilter === 'received') recs = recs.filter(r => r._type === 'received');

  if (!recs.length) {
    feed.innerHTML = '<p class="text-xs text-gray-400 py-4 text-center">No hay reconocimientos para mostrar.</p>';
    return;
  }

  feed.innerHTML = recs.map(r => {
    const isSent  = r._type === 'sent';
    const other   = isSent ? (r.to_user?.name || 'Desconocido') : (r.from_user?.name || 'Desconocido');
    const otherId = isSent ? r.to_user?.id : r.from_user?.id;
    const initial = (other[0] || '?').toUpperCase();
    const time    = formatTimeAgo(r.created_at);
    const points  = Number(r.points) || 0;
    const label   = isSent
      ? `Reconoció a <button onclick="openPeekById('${otherId||''}')" class="font-semibold text-gray-800 hover:text-violet-600 transition">${esc(other)}</button>`
      : `<button onclick="openPeekById('${otherId||''}')" class="font-semibold text-gray-800 hover:text-violet-600 transition">${esc(other)}</button> lo reconoció`;
    const badge   = isSent
      ? `<span class="text-[10px] font-bold uppercase tracking-wide text-[#3d2b56] bg-violet-50 px-2 py-0.5 rounded-full">Dado</span>`
      : `<span class="text-[10px] font-bold uppercase tracking-wide text-[#e87cb4] bg-pink-50 px-2 py-0.5 rounded-full">Recibido</span>`;
    const ptsBadge = points > 0
      ? isSent
        ? `<span class="text-xs font-semibold text-[#3d2b56]">-${points} puntos</span>`
        : `<span class="text-xs font-semibold text-[#e87cb4]">+${points} puntos</span>`
      : '';
    return `<div class="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div class="w-9 h-9 rounded-full ${getAvatarColor(other)} flex items-center justify-center text-white text-sm font-bold shrink-0">${initial}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm text-gray-600">${label}</p>
          ${badge}
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="text-xs text-[#3d2b56] font-medium">${esc(r.program || '')}</p>
          ${ptsBadge}
        </div>
        <p class="text-xs text-gray-400 mt-1">${time}</p>
      </div>
    </div>`;
  }).join('');
}

function _renderOppConnections(recs) {
  const el = document.getElementById('opp-connections');
  if (!el) return;
  const map = {};
  recs.forEach(r => {
    const isSent = r._type === 'sent';
    const name   = isSent ? (r.to_user?.name || '') : (r.from_user?.name || '');
    const id     = isSent ? (r.to_user?.id || '') : (r.from_user?.id || '');
    if (!name) return;
    if (!map[id]) map[id] = { name, id, count: 0 };
    map[id].count++;
  });
  const sorted = Object.values(map).sort((a, b) => b.count - a.count).slice(0, 6);
  if (!sorted.length) { el.innerHTML = '<p class="text-[10px] text-gray-400 text-center py-2">Sin conexiones aún</p>'; return; }
  el.innerHTML = sorted.map(c => {
    const initials = c.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const color    = getAvatarColor(c.name);
    return `<button onclick="openPeekById('${c.id}')" class="flex items-center gap-2 w-full py-1.5 hover:bg-gray-50 rounded-lg transition text-left">
      <div class="w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-[9px] font-bold shrink-0">${initials}</div>
      <span class="text-[10px] text-gray-700 truncate font-medium">${esc(c.name)}</span>
      <span class="text-[9px] text-gray-400 ml-auto shrink-0">${c.count}</span>
    </button>`;
  }).join('');
}

async function openOtherProfile(userId) {
  if (!userId) return;
  _closeAllOverlays();
  _oppUserId = userId;
  _oppRecs   = [];
  _oppFilter = 'all';

  const page = document.getElementById('other-profile-page');
  page.classList.remove('hidden');
  page.style.display = '';
  _positionOverlayPage('other-profile-page');

  // Datos básicos del usuario desde allUsers
  const u = allUsers.find(x => x.__backendId === userId) || {};
  const initials    = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const color       = getAvatarColor(u.name || '');
  const roleLabels  = { superadmin: 'Superadmin', admin: 'Administrador', employee: 'Empleado' };

  const el = id => document.getElementById(id);
  el('opp-header-name').textContent = u.name || 'Perfil';
  el('opp-name').textContent        = u.name || '—';
  el('opp-role').textContent        = u.department || '';
  el('opp-role').classList.toggle('hidden', !u.department);
  el('opp-meta').textContent        = u.company || '—';
  const av = el('opp-avatar');
  av.textContent = initials;
  av.className   = `w-16 h-16 rounded-full ${color} flex items-center justify-center text-white text-2xl font-bold shrink-0`;
  const recBtn = el('opp-recognize-btn');
  if (recBtn) recBtn.setAttribute('onclick', `openRecognitionFromPeek('${userId}')`);

  // Reset feed
  el('opp-feed').innerHTML = '<div class="flex justify-center py-8"><i data-lucide="loader" class="w-6 h-6 animate-spin text-violet-300"></i></div>';
  el('opp-given').textContent    = '—';
  el('opp-received').textContent = '—';
  el('opp-connections').innerHTML = '<p class="text-[10px] text-gray-400 text-center py-2">Cargando...</p>';
  setOppTab('activity');
  lucide.createIcons();

  // Sección "Sobre mí" con datos de allUsers (bio, interests, work_style)
  _renderOppAbout(u);

  // Fetch reconocimientos del servidor
  const { data: recs } = await window.recognitionSdk.recentForUser(userId, 50);
  _oppRecs = recs || [];

  el('opp-given').textContent    = _oppRecs.filter(r => r._type === 'sent').length;
  el('opp-received').textContent = _oppRecs.filter(r => r._type === 'received').length;

  setOppFilter('all');
  _renderOppConnections(_oppRecs);
  lucide.createIcons();

  // Si el perfil completo tiene más info que allUsers, lo recargamos desde DB
  const { data: fullProfile } = await _sb.from('profiles')
    .select('bio, interests, work_style, department')
    .eq('id', userId)
    .maybeSingle();
  if (fullProfile) _renderOppAbout({ ...u, ...fullProfile });
}

function _renderOppAbout(u) {
  const el = id => document.getElementById(id);

  const hasBio        = !!u.bio;
  const hasInterests  = !!u.interests;
  const hasWorkStyle  = !!u.work_style;
  const hasAnything   = hasBio || hasInterests || hasWorkStyle;

  el('opp-about-bio')?.classList.toggle('hidden', !hasBio);
  if (hasBio) el('opp-bio-text').textContent = u.bio;

  el('opp-about-interests')?.classList.toggle('hidden', !hasInterests);
  if (hasInterests) {
    const tags = u.interests.split(/[,·]/).map(t => t.trim()).filter(Boolean);
    el('opp-interests-tags').innerHTML = tags.map(t =>
      `<span class="text-xs font-medium text-[#3d2b56] bg-violet-50 px-2.5 py-1 rounded-full">${esc(t)}</span>`
    ).join('');
  }

  el('opp-about-workstyle')?.classList.toggle('hidden', !hasWorkStyle);
  if (hasWorkStyle) {
    const tags = u.work_style.split(/[,·]/).map(t => t.trim()).filter(Boolean);
    el('opp-workstyle-tags').innerHTML = tags.map(t =>
      `<span class="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">${esc(t)}</span>`
    ).join('');
  }

  el('opp-about-empty')?.classList.toggle('hidden', hasAnything);
}

function closeOtherProfile() {
  const page = document.getElementById('other-profile-page');
  page?.classList.add('hidden');
  if (page) page.style.display = 'none';
  _oppUserId = null;
  _oppRecs   = [];
  currentPage = 'home';
}

async function openPeekProfile(u) {
  let modal = document.getElementById('peek-profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'peek-profile-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick="closePeekProfile()"></div>
      <div id="peek-profile-card" class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden"></div>`;
    document.body.appendChild(modal);
  }

  const initials   = (u.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2);
  const color      = getAvatarColor(u.name||'');
  const roleLabels = { superadmin:'Superadmin', admin:'Admin', employee:'Empleado' };
  const roleLabel  = u.department || roleLabels[u.role] || u.role || '';
  const card       = document.getElementById('peek-profile-card');
  const canRecognize = currentUser?.role !== 'employee' || true; // employees can also recognize

  card.innerHTML = `
    <div class="p-6 flex flex-col items-center gap-3 text-center">
      <button onclick="closePeekProfile()" class="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
      <div class="w-20 h-20 rounded-full ${color} flex items-center justify-center text-white text-3xl font-bold">${esc(initials)}</div>
      <div class="text-center">
        <p class="text-lg font-bold text-gray-800">${esc(u.name)}</p>
        ${roleLabel ? `<p class="text-sm text-gray-400">${esc(roleLabel)}</p>` : ''}
      </div>
      ${u.bio ? `<p class="text-sm text-gray-500 leading-snug max-w-xs">${esc(u.bio)}</p>` : ''}
      <div class="flex gap-6 text-center">
        ${u.points_received != null ? `<div><p class="text-lg font-bold text-[#e87cb4]">${u.points_received ?? 0}</p><p class="text-[10px] text-gray-400">puntos recibidos</p></div>` : ''}
      </div>
      <button onclick="openRecognitionFromPeek('${esc(u.__backendId)}')"
        class="btn-recognize text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5">
        <i data-lucide="heart" class="w-4 h-4"></i> Reconocer
      </button>
    </div>
    <div class="border-t border-gray-100">
      <div class="px-5 py-3 flex items-center justify-between">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actividad reciente</p>
      </div>
      <div id="peek-feed" class="px-5 pb-4 space-y-0 max-h-64 overflow-y-auto">
        <div class="flex justify-center py-4"><i data-lucide="loader" class="w-5 h-5 animate-spin text-violet-300"></i></div>
      </div>
    </div>`;

  modal.classList.remove('hidden');
  lucide.createIcons();

  // Async load mini feed
  const { data: recs } = await window.recognitionSdk.recentForUser(u.__backendId, 8);
  const feedEl = document.getElementById('peek-feed');
  if (!feedEl) return;

  if (!recs || recs.length === 0) {
    feedEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-3">Sin reconocimientos aún.</p>';
    return;
  }

  feedEl.innerHTML = recs.map(r => {
    const isSent  = r._type === 'sent';
    const other   = isSent ? (r.to_user?.name || 'Desconocido') : (r.from_user?.name || 'Desconocido');
    const otherId = isSent ? r.to_user?.id : r.from_user?.id;
    const label   = isSent
      ? `<span class="text-gray-500">Reconoció a </span><button onclick="openPeekById('${otherId||''}')" class="font-semibold text-gray-800 hover:text-violet-600 transition">${esc(other)}</button>`
      : `<button onclick="openPeekById('${otherId||''}')" class="font-semibold text-gray-800 hover:text-violet-600 transition">${esc(other)}</button><span class="text-gray-500"> lo reconoció</span>`;
    const badge   = isSent
      ? `<span class="text-[9px] font-bold text-[#3d2b56] bg-violet-50 px-1.5 py-0.5 rounded-full">Dado</span>`
      : `<span class="text-[9px] font-bold text-[#e87cb4] bg-pink-50 px-1.5 py-0.5 rounded-full">Recibido</span>`;
    const pts     = Number(r.points) || 0;
    const ptsEl   = pts > 0 ? `<span class="text-[10px] font-semibold ${isSent ? 'text-[#3d2b56]' : 'text-[#e87cb4]'}">${isSent ? '-' : '+'}${pts} puntos</span>` : '';
    return `
    <div class="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div class="w-7 h-7 rounded-full ${getAvatarColor(other)} flex items-center justify-center text-white text-[10px] font-bold shrink-0">${esc((other[0]||'?').toUpperCase())}</div>
      <div class="flex-1 min-w-0">
        <p class="text-xs leading-snug">${label} ${badge}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="text-[10px] text-violet-500 font-medium truncate">${esc(r.program||'')}</p>
          ${ptsEl}
        </div>
      </div>
      <p class="text-[10px] text-gray-400 shrink-0">${formatTimeAgo(r.created_at)}</p>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function closePeekProfile() {
  document.getElementById('peek-profile-modal')?.classList.add('hidden');
}

function openRecognitionFromPeek(userId) {
  closePeekProfile();
  // No cerramos other-profile-page para que quede de fondo bajo el modal
  const u = allUsers.find(x => x.__backendId === userId);
  if (!u) return;
  openModal();
  setTimeout(() => {
    _selectedRecipients = [{ id: u.__backendId, name: u.name }];
    _renderSelectedBar();
    updateModalBtn();
    showStep(2);
  }, 50);
}

function _searchGoProgram() {
  _closeGlobalSearch();
  openProgramsPage();
}

function _searchRunFeature(idx) {
  _closeGlobalSearch();
  _SEARCH_FEATURES[idx]?.action();
}

function _closeGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const panel = document.getElementById('global-search-results');
  if (input) input.value = '';
  if (panel) panel.classList.add('hidden');
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('global-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('global-search-results')?.classList.add('hidden');
  }
});

// ── End global search ──────────────────────────────────────────────────────────

function showSuccessToast(msg) {
  const toast = document.getElementById('success-toast');
  toast.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> <span>${esc(msg)}</span>`;
  toast.classList.remove('hidden');
  lucide.createIcons();
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showErrorToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold';
  toast.style.animation = 'scaleIn 0.3s ease';
  toast.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5"></i> <span>${esc(msg)}</span>`;
  document.body.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => toast.remove(), 3000);
}

function toggleNotificationsDropdown(e) {
  e.stopPropagation();
  document.getElementById('notifications-dropdown').classList.toggle('hidden');
}
function toggleNotifications(e) { toggleNotificationsDropdown(e); }

function openNotificationsPage() {
  closeAnalyticsPage();
  currentPage = 'notifications';
  const np = document.getElementById('notifications-page');
  np.style.display = '';
  np.classList.remove('hidden');
  _positionOverlayPage('notifications-page');
  document.getElementById('notifications-dropdown').classList.add('hidden');
  renderNotificationsPage();
}

function openNotificationSettings() {
  closeNotificationsPage();
  openProfilePage();
}

function closeNotificationsPage() {
  document.getElementById('notifications-page').classList.add('hidden');
  if (currentPage === 'notifications') currentPage = 'home';
}

function switchNotificationTab(tab) {
  notificationsTab = tab;
  ['all', 'unread'].forEach(t => {
    const btn = document.getElementById('tab-' + t);
    btn.classList.toggle('text-violet-600', t === tab);
    btn.classList.toggle('border-violet-600', t === tab);
    btn.classList.toggle('text-gray-600', t !== tab);
    btn.classList.toggle('border-transparent', t !== tab);
  });
  renderNotificationsPage();
}


async function markNotificationRead(id) {
  const n = _notificationsData.find(n => n.id === id);
  if (!n || n.read) return;
  n.read = true;
  updateNotificationBadge();
  renderNotificationsPage();
  renderNotificationsDropdown();
  await window.notificationSdk.markRead(id);
}

async function deleteNotification(id) {
  _notificationsData = _notificationsData.filter(n => n.id !== id);
  updateNotificationBadge();
  renderNotificationsPage();
  renderNotificationsDropdown();
  showSuccessToast('Notificación eliminada');
  await window.notificationSdk.remove(id);
}

async function markAllAsRead() {
  _notificationsData.forEach(n => n.read = true);
  updateNotificationBadge();
  renderNotificationsPage();
  renderNotificationsDropdown();
  showSuccessToast('Todas las notificaciones marcadas como leídas');
  await window.notificationSdk.markAllRead();
}

function updateNotificationBadge() {
  const unread = _notificationsData.filter(n => !n.read).length;
  document.getElementById('btn-notif')?.classList.toggle('notification-dot', unread > 0);
}

async function clearNotifications() {
  _notificationsData.forEach(n => n.read = true);
  updateNotificationBadge();
  renderNotificationsDropdown();
  renderNotificationsPage();
  await window.notificationSdk.markAllRead();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#btn-notif') && !e.target.closest('#notifications-dropdown')) {
    document.getElementById('notifications-dropdown').classList.add('hidden');
  }
});


// ─────────────────────────────────────────
// RECOGNITION BATTERY
// ─────────────────────────────────────────
function renderRecognitionBattery() {
  if (!currentUser?.__backendId) return;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const allRecs = window._allRecognitions || [];
  const sent    = allRecs.filter(r =>
    r.from_user?.id === currentUser.__backendId &&
    new Date(r.created_at) >= weekStart
  );

  const count  = sent.length;
  const MAX    = 5;
  const filled = Math.min(count, MAX);

  const MSGS = [
    'No pierdas el ritmo, reconocé hoy 🔋',
    '¡Arrancaste! Seguí así 💪',
    '¡Bien! Construís cultura 🚀',
    '¡Vas muy bien! 💪',
    '¡Casi llena! Un reconocimiento más 🌟',
    '¡Batería llena! 🔋🎉',
  ];

  for (let i = 1; i <= MAX; i++) {
    const seg = document.getElementById(`bseg-${i}`);
    if (!seg) continue;
    seg.className = `h-9 w-11 rounded transition-all duration-500 ${i <= filled ? 'bg-green-400' : 'bg-gray-100'}`;
  }

  const label = document.getElementById('battery-label');
  const msg   = document.getElementById('battery-msg');
  if (label) label.textContent = `${filled} / ${MAX} esta semana`;
  if (msg)   msg.textContent   = MSGS[Math.min(filled, MSGS.length - 1)];
}

function updateProfileDisplay() {
  if (!currentUser) return;
  const initials  = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const firstName = currentUser.name.split(' ')[0];

  const avatar = document.getElementById('btn-profile')?.querySelector('div');
  if (avatar) avatar.textContent = initials;

  const navAvatar = document.getElementById('profile-nav-avatar');
  if (navAvatar) navAvatar.textContent = initials;

  const welcomeText = document.getElementById('welcome-text');
  if (welcomeText) welcomeText.textContent = `¡Hola, ${firstName}! 👋`;
  renderRecognitionBattery();

  const pName  = document.getElementById('profile-name');
  const pEmail = document.getElementById('profile-email');
  if (pName)  pName.textContent  = currentUser.name;
  if (pEmail) pEmail.textContent = currentUser.email;

  const dName    = document.getElementById('profile-display-name');
  const dEmail   = document.getElementById('profile-display-email');
  const dCompany = document.getElementById('profile-display-company');
  const dRole    = document.getElementById('profile-display-role');

  if (dName)  dName.textContent  = currentUser.name;
  if (dEmail) dEmail.textContent = currentUser.email;
  const co = companies.find(c => c.id === currentUser.company_id);
  if (dCompany) dCompany.textContent = co?.name || 'N/A';
  const roleMap = { superadmin: 'Superadministrador', admin: 'Administrador de empresa', employee: 'Empleado' };
  if (dRole) dRole.textContent = roleMap[currentUser.role] || currentUser.role;

  // Populate settings form with current user preferences
  const visPublic  = document.getElementById('pref-cfg-vis-public');
  const visPrivate = document.getElementById('pref-cfg-vis-private');
  if (visPublic && visPrivate) {
    const isPrivate = currentUser.recognition_visibility === 'private';
    visPublic.checked  = !isPrivate;
    visPrivate.checked = isPrivate;
  }
  const bdayToggle  = document.getElementById('pref-cfg-birthday');
  const anivToggle  = document.getElementById('pref-cfg-anniversary');
  if (bdayToggle)  bdayToggle.checked  = currentUser.auto_birthday  !== false;
  if (anivToggle)  anivToggle.checked  = currentUser.auto_anniversary !== false;

  // Clear password fields on open
  const pwEl  = document.getElementById('cfg-new-password');
  const pwEl2 = document.getElementById('cfg-confirm-password');
  const pwErr = document.getElementById('cfg-pw-error');
  if (pwEl)  pwEl.value  = '';
  if (pwEl2) pwEl2.value = '';
  if (pwErr) pwErr.classList.add('hidden');
}

// ------------------------------------------------------------

function switchProfileTab(tab) {
  _profileTab = tab;
  const isActivity = tab === 'activity';
  document.getElementById('up-activity-section')?.classList.toggle('hidden', !isActivity);
  document.getElementById('up-about-section')?.classList.toggle('hidden', isActivity);

  const tabAct   = document.getElementById('up-tab-activity');
  const tabAbout = document.getElementById('up-tab-about');
  const activeC  = 'px-3 py-1 rounded-lg text-xs font-semibold transition bg-white text-[#3d2b56] shadow-sm';
  const idleC    = 'px-3 py-1 rounded-lg text-xs font-semibold transition text-gray-500';
  if (tabAct)   tabAct.className   = isActivity ? activeC : idleC;
  if (tabAbout) tabAbout.className = isActivity ? idleC : activeC;

  if (!isActivity) { _loadAboutMe(); _loadDates(); lucide.createIcons(); }
}

function _aboutMeKey() {
  return `allay_about_${currentUser?.__backendId || currentUser?.email || 'me'}`;
}

// ── Dates (birthday + anniversary) — saved to Supabase ───────────────────────
function _loadDates() {
  const b = document.getElementById('up-birthday');
  const a = document.getElementById('up-anniversary');
  if (b) b.value = currentUser?.birthday         || '';
  if (a) a.value = currentUser?.anniversary_date || '';
}

function formatBirthdayInput(el) {
  let v = el.value.replace(/[^\d]/g, '');
  if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2, 4);
  el.value = v;
}

async function saveDates() {
  if (!currentUser?.__backendId) return;

  const birthday         = document.getElementById('up-birthday')?.value?.trim()    || null;
  const anniversary_date = document.getElementById('up-anniversary')?.value?.trim() || null;

  // Validate birthday format DD/MM
  if (birthday && !/^\d{1,2}\/\d{1,2}$/.test(birthday)) {
    showErrorToast('Formato incorrecto. Usá DD/MM (ej: 15/03)');
    return;
  }

  // Normalize birthday to zero-padded DD/MM
  const normalizedBirthday = birthday
    ? birthday.split('/').map(p => p.padStart(2,'0')).join('/')
    : null;

  // Update in-memory
  if (currentUser) {
    currentUser.birthday         = normalizedBirthday;
    currentUser.anniversary_date = anniversary_date;
  }

  // Persist only these two columns — avoids touching points or other sensitive fields
  const result = await window.dataSdk.update({
    ...currentUser,
    birthday:         normalizedBirthday,
    anniversary_date: anniversary_date,
  });

  if (result.isOk) {
    // Refresh input with normalized value
    const bi = document.getElementById('up-birthday');
    if (bi && normalizedBirthday) bi.value = normalizedBirthday;
    const saved = document.getElementById('up-dates-saved');
    if (saved) { saved.classList.remove('hidden'); setTimeout(() => saved.classList.add('hidden'), 2500); }
  } else {
    showErrorToast('No se pudo guardar. Asegurate de haber aplicado el SQL fix_15 en Supabase.');
  }
}

function _loadAboutMe() {
  if (!currentUser) return;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) { el.value = val || ''; updateAboutMeCounter(el, id.replace('up-','up-').replace(/$/,'-count'), parseInt(el.maxLength)||250); }
  };
  // Read from currentUser (Supabase), fallback to localStorage for migration
  const lsRaw  = localStorage.getItem(_aboutMeKey());
  const lsData = lsRaw ? JSON.parse(lsRaw) : {};
  set('up-bio',       currentUser.bio        || lsData.bio       || '');
  set('up-interests', currentUser.interests  || lsData.interests || '');
  set('up-workstyle', currentUser.work_style || lsData.workStyle || '');
  _renderAboutMeTags('up-interests', 'up-interests-tags');
  _renderAboutMeTags('up-workstyle',  'up-workstyle-tags');
  // Preferences from Supabase
  const vis  = currentUser.recognition_visibility || lsData.visibility || 'public';
  const bday = (currentUser.auto_birthday !== false && currentUser.auto_anniversary !== false) ? 'yes' : 'no';
  _applyPrefButtons('vis',  vis);
  _applyPrefButtons('bday', bday);
}

function saveAboutMe() {
  if (!currentUser) return;
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const bio        = get('up-bio');
  const interests  = get('up-interests');
  const work_style = get('up-workstyle');

  // Update in-memory
  currentUser.bio        = bio        || null;
  currentUser.interests  = interests  || null;
  currentUser.work_style = work_style || null;

  // Persist to Supabase
  window.dataSdk.update({ ...currentUser, bio, interests, work_style }).catch(() => {});

  _renderAboutMeTags('up-interests', 'up-interests-tags');
  _renderAboutMeTags('up-workstyle',  'up-workstyle-tags');
  const s = document.getElementById('up-bio-saved');
  if (s) { s.classList.remove('hidden'); setTimeout(() => s.classList.add('hidden'), 1800); }
}

function setRecognitionPref(type, value) {
  if (!currentUser) return;
  _applyPrefButtons(type === 'visibility' ? 'vis' : 'bday', value);

  // Update in-memory only — actual save triggered by saveRecognitionPrefs()
  if (type === 'visibility') {
    currentUser.recognition_visibility = value;
  } else {
    const optIn = value === 'yes';
    currentUser.auto_birthday    = optIn;
    currentUser.auto_anniversary = optIn;
  }

  // Hide any previous status messages
  document.getElementById('pref-saved-msg')?.classList.add('hidden');
  document.getElementById('pref-error-msg')?.classList.add('hidden');
}

async function saveRecognitionPrefs() {
  if (!currentUser) return;

  const btn = document.querySelector('[onclick="saveRecognitionPrefs()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  let isOk = false;
  try {
    const result = await window.dataSdk.updatePreferences({
      recognition_visibility: currentUser.recognition_visibility || 'public',
      auto_birthday:          currentUser.auto_birthday ?? true,
      auto_anniversary:       currentUser.auto_anniversary ?? true,
    });
    isOk = result.isOk;
    if (!isOk) console.error('[saveRecognitionPrefs] updatePreferences failed', result);
  } catch (e) {
    console.error('[saveRecognitionPrefs] exception:', e);
    isOk = false;
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Guardar preferencias';
  }

  if (isOk) {
    // Sync allUsers so the privacy hint in the recognition modal is up to date
    const idx = allUsers.findIndex(u => u.__backendId === currentUser.__backendId);
    if (idx !== -1) {
      allUsers[idx].recognition_visibility = currentUser.recognition_visibility || 'public';
      allUsers[idx].auto_birthday          = currentUser.auto_birthday ?? true;
      allUsers[idx].auto_anniversary       = currentUser.auto_anniversary ?? true;
    }

    const msg = document.getElementById('pref-saved-msg');
    if (msg) {
      msg.classList.remove('hidden');
      lucide.createIcons({ nodes: [msg] });
      setTimeout(() => msg.classList.add('hidden'), 2500);
    }
  } else {
    const err = document.getElementById('pref-error-msg');
    if (err) { err.classList.remove('hidden'); setTimeout(() => err.classList.add('hidden'), 3000); }
  }
}

function _applyPrefButtons(group, value) {
  const ACTIVE  = { vis: 'bg-white text-[#3d2b56] shadow-sm', bday: 'bg-white text-green-600 shadow-sm' };
  const IDLE    = 'text-gray-500';
  const baseC   = 'pref-' + group + '-btn px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5';
  const ids     = group === 'vis'
    ? { public: 'pref-vis-public', private: 'pref-vis-private' }
    : { yes: 'pref-bday-yes', no: 'pref-bday-no' };
  Object.entries(ids).forEach(([key, id]) => {
    const btn = document.getElementById(id);
    if (btn) btn.className = `${baseC} ${key === value ? ACTIVE[group] : IDLE}`;
  });
}

function updateAboutMeCounter(el, countId, max) {
  const c = document.getElementById(countId);
  if (c) c.textContent = el.value.length;
}

function _renderAboutMeTags(inputId, tagsId) {
  const input = document.getElementById(inputId);
  const wrap  = document.getElementById(tagsId);
  if (!input || !wrap) return;
  const raw  = input.value.trim();
  if (!raw) { wrap.innerHTML = ''; return; }
  const tags = raw.split(/[·,]+/).map(t=>t.trim()).filter(Boolean);
  wrap.innerHTML = tags.map(t =>
    `<span class="inline-block text-xs px-2.5 py-1 rounded-full bg-[#ede9f7] text-[#3d2b56] font-medium">${esc(t)}</span>`
  ).join('');
}

function openUserProfilePage() {
  switchProfileTab('activity');
  _closeAllOverlays();
  currentPage = 'user-profile';
  const pp = document.getElementById('user-profile-page');
  pp.style.display = '';
  pp.classList.remove('hidden');
  _positionOverlayPage('user-profile-page');
  _renderUserProfile();
}

function closeUserProfilePage() {
  const pp = document.getElementById('user-profile-page');
  pp.classList.add('hidden');
  pp.style.display = 'none';
  if (currentPage === 'user-profile') currentPage = 'home';
}

let _upFilter = 'all';

function setUpFilter(filter) {
  _upFilter = filter;
  ['all', 'received', 'given'].forEach(f => {
    const btn = document.getElementById(`up-filter-${f}`);
    if (!btn) return;
    if (f === filter) {
      btn.className = 'up-filter-btn px-3 py-1 rounded-lg text-xs font-semibold transition bg-white text-[#3d2b56] shadow-sm';
    } else {
      btn.className = 'up-filter-btn px-3 py-1 rounded-lg text-xs font-semibold transition text-gray-500';
    }
  });
  _renderUpFeed();
}

function _renderUpFeed() {
  const u      = currentUser;
  const userId = u?.__backendId;
  const allRecs = window._allRecognitions || [];
  const feed    = document.getElementById('up-feed');
  if (!feed) return;

  let recs;
  if (_upFilter === 'given')    recs = allRecs.filter(r => r.from_user?.id === userId);
  else if (_upFilter === 'received') recs = allRecs.filter(r => r.to_user?.id === userId);
  else recs = allRecs.filter(r => r.from_user?.id === userId || r.to_user?.id === userId);

  if (recs.length === 0) {
    feed.innerHTML = '<p class="text-xs text-gray-400 py-2">No hay reconocimientos para mostrar.</p>';
    return;
  }

  feed.innerHTML = recs.slice(0, 20).map(r => {
    const isSent       = r.from_user?.id === userId;
    const other        = isSent ? (r.to_user?.name || 'Usuario eliminado') : (r.from_user?.name || 'Usuario eliminado');
    const otherInitial = (other[0] || '?').toUpperCase();
    const time         = formatTimeAgo(r.created_at);
    const program      = r.program || '';
    const rawMessage   = _cleanPrivateMarker(r.message || '');
    const { text: msgText, imgs: msgImgs } = parseCommentMessage(rawMessage);
    const points       = Number(r.points) || 0;
    const label = isSent
      ? `Reconociste a <span class="font-semibold text-gray-800">${esc(other)}</span>`
      : `<span class="font-semibold text-gray-800">${esc(other)}</span> te reconoció`;
    const badge = isSent
      ? `<span class="text-[10px] font-bold uppercase tracking-wide text-[#3d2b56] bg-violet-50 px-2 py-0.5 rounded-full">Dado</span>`
      : `<span class="text-[10px] font-bold uppercase tracking-wide text-[#e87cb4] bg-rosa-50 px-2 py-0.5 rounded-full">Recibido</span>`;
    const pointsBadge = points > 0
      ? isSent
        ? `<span class="text-xs font-semibold text-[#3d2b56]">-${points} puntos</span>`
        : `<span class="text-xs font-semibold text-[#e87cb4]">+${points} puntos</span>`
      : '';
    const messageEl = msgText
      ? `<p class="text-xs text-gray-500 italic mt-1 leading-relaxed">"${esc(msgText)}"</p>`
      : '';
    const imgsEl = msgImgs.length
      ? msgImgs.map(url => `<img src="${esc(url)}" class="mt-2 rounded-lg max-h-40 max-w-full object-cover" loading="lazy">`).join('')
      : '';
    return `<div class="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div class="w-9 h-9 rounded-full ${getAvatarColor(other)} flex items-center justify-center text-white text-sm font-bold shrink-0">${esc(otherInitial)}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm text-gray-600">${label}</p>
          ${badge}
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="text-xs text-[#3d2b56] font-medium">${esc(program)}</p>
          ${pointsBadge}
        </div>
        ${messageEl}${imgsEl}
        <p class="text-xs text-gray-400 mt-1">${time}</p>
      </div>
    </div>`;
  }).join('');
}

function _renderUserProfile() {
  const u = currentUser;
  if (!u) return;

  const initials    = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const avatarColor = getAvatarColor(u.name || '');
  const el          = id => document.getElementById(id);

  const avatar = el('up-avatar');
  avatar.textContent = initials;
  avatar.className = `w-20 h-20 rounded-full ${avatarColor} flex items-center justify-center text-white text-3xl font-bold shrink-0`;

  el('up-name').textContent    = u.name    || '—';
  el('up-role').textContent    = u.role    || '—';
  el('up-company').textContent = u.company || '—';
  el('up-points').textContent  = (u.points_to_redeem ?? '–');

  const allRecs = window._allRecognitions || [];
  const userId  = u.__backendId;
  el('up-given').textContent    = allRecs.filter(r => r.from_user?.id === userId).length;
  el('up-received').textContent = allRecs.filter(r => r.to_user?.id   === userId).length;

  _upFilter = 'all';
  setUpFilter('all');
  _renderConnections();
}

function _renderConnections() {
  const el = document.getElementById('up-connections');
  if (!el || !currentUser) return;

  const userId  = currentUser.__backendId;
  const allRecs = window._allRecognitions || [];
  const map = {};

  const add = (uid, name, dept, type, pts) => {
    if (!uid || uid === userId) return;
    if (!map[uid]) map[uid] = { score:0, types:new Set(), name: name||uid, dept: dept||'' };
    map[uid].score += pts;
    map[uid].types.add(type);
  };

  allRecs.forEach(r => {
    const fid = r.from_user?.id, tid = r.to_user?.id;
    const fn  = r.from_user?.name, tn = r.to_user?.name;
    const fd  = allUsers.find(u=>u.__backendId===fid)?.department || '';
    const td  = allUsers.find(u=>u.__backendId===tid)?.department || '';

    if (fid === userId && tid) add(tid, tn, td, 'Reconociste', 3);
    if (tid === userId && fid) add(fid, fn, fd, 'Te reconoció', 3);

    (r.reactions || []).forEach(rx => {
      const rid = rx.user_id;
      if (rid === userId) {
        if (fid && fid !== userId) add(fid, fn, fd, 'Reaccionaste', 1);
        if (tid && tid !== userId) add(tid, tn, td, 'Reaccionaste', 1);
      } else if (rid && (fid === userId || tid === userId)) {
        const ru = allUsers.find(u=>u.__backendId===rid);
        add(rid, ru?.name, ru?.department, 'Reaccionó', 1);
      }
    });

    (r.comments || []).forEach(cm => {
      const cid = cm.user?.id, cn = cm.user?.name;
      const cu  = allUsers.find(u=>u.__backendId===cid);
      if (cid === userId) {
        if (fid && fid !== userId) add(fid, fn, fd, 'Comentaste', 2);
        if (tid && tid !== userId) add(tid, tn, td, 'Comentaste', 2);
      } else if (cid && (fid === userId || tid === userId)) {
        add(cid, cn, cu?.department, 'Comentó', 2);
      }
    });
  });

  const sorted = Object.entries(map)
    .map(([uid, d]) => ({ uid, ...d }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!sorted.length) {
    el.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Aún no hay conexiones registradas. Empezá reconociendo a alguien o interactuando con el feed.</p>';
    return;
  }

  const maxScore = sorted[0].score || 1;
  const TYPE_COLOR = {
    'Reconociste':  'bg-violet-100 text-[#3d2b56]',
    'Te reconoció': 'bg-[#fff0f6] text-[#e87cb4]',
    'Reaccionaste': 'bg-[#f0ecf6] text-[#7c3aed]',
    'Reaccionó':    'bg-[#f0ecf6] text-[#7c3aed]',
    'Comentaste':   'bg-blue-50 text-blue-600',
    'Comentó':      'bg-blue-50 text-blue-600',
  };

  // Compact sidebar card for each person
  const peopleHTML = sorted.map(c => {
    const initials = (c.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2);
    const color    = getAvatarColor(c.name||'');
    const barW     = Math.round((c.score/maxScore)*100);
    const mainType = [...c.types][0] || '';
    const dot      = TYPE_COLOR[mainType] ? TYPE_COLOR[mainType].split(' ')[0] : 'bg-gray-100';
    return `<div class="flex items-center gap-2 group">
      <div class="w-7 h-7 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-bold shrink-0">${esc(initials)}</div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-gray-800 truncate leading-tight">${esc(c.name.split(' ')[0])} ${esc((c.name.split(' ')[1]||'')[0]||'')}.</p>
        <div class="w-full bg-gray-100 rounded-full h-1 mt-1">
          <div class="bg-[#3d2b56] h-1 rounded-full" style="width:${barW}%"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Top team (just one, compact)
  const teamMap = {};
  sorted.forEach(c => { if (c.dept) teamMap[c.dept] = (teamMap[c.dept]||0) + c.score; });
  const topTeam = Object.entries(teamMap).sort((a,b)=>b[1]-a[1])[0];
  const teamHTML = topTeam
    ? `<div class="mt-3 pt-3 border-t border-gray-100">
        <p class="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Equipo top</p>
        <span class="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-[#ede9f7] text-[#3d2b56]">
          <i data-lucide="users" class="w-2.5 h-2.5"></i>${esc(topTeam[0])}
        </span>
      </div>` : '';

  el.innerHTML = `<div class="space-y-2.5">${peopleHTML}</div>${teamHTML}`;
  lucide.createIcons();
}

function openProfilePage() {
  closePointsPage();
  currentPage = 'profile';
  ['admin-page', 'analytics-page', 'store-page', 'notifications-page', 'programs-page', 'approvals-page'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  const pp = document.getElementById('profile-page');
  pp.style.display = '';
  pp.classList.remove('hidden');
  _positionOverlayPage('profile-page');
  updateProfileDisplay();
}

function closeProfilePage() {
  document.getElementById('profile-page').classList.add('hidden');
  if (currentPage === 'profile') currentPage = 'home';
  document.getElementById('profile-dropdown').classList.add('hidden');
}

async function saveSettings() {
  const saveBtn = document.getElementById('cfg-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

  try {
    // Read preferences form
    const visPublic  = document.getElementById('pref-cfg-vis-public');
    const bdayToggle = document.getElementById('pref-cfg-birthday');
    const anivToggle = document.getElementById('pref-cfg-anniversary');
    const visibility     = visPublic?.checked ? 'public' : 'private';
    const auto_birthday  = bdayToggle?.checked ?? true;
    const auto_anniversary = anivToggle?.checked ?? true;

    // Handle optional password change
    const newPw  = (document.getElementById('cfg-new-password')?.value || '').trim();
    const confPw = (document.getElementById('cfg-confirm-password')?.value || '').trim();
    const pwErr  = document.getElementById('cfg-pw-error');

    if (newPw || confPw) {
      if (newPw.length < 8) {
        if (pwErr) { pwErr.textContent = 'La contraseña debe tener al menos 8 caracteres.'; pwErr.classList.remove('hidden'); }
        return;
      }
      if (newPw !== confPw) {
        if (pwErr) { pwErr.textContent = 'Las contraseñas no coinciden.'; pwErr.classList.remove('hidden'); }
        return;
      }
      if (pwErr) pwErr.classList.add('hidden');
      const { error: pwError } = await window._sb.auth.updateUser({ password: newPw });
      if (pwError) {
        showErrorToast('No se pudo cambiar la contraseña: ' + pwError.message);
        return;
      }
      document.getElementById('cfg-new-password').value  = '';
      document.getElementById('cfg-confirm-password').value = '';
    }

    // Save preferences to DB
    const { isOk } = await window.dataSdk.updatePreferences({ recognition_visibility: visibility, auto_birthday, auto_anniversary });
    if (!isOk) {
      showErrorToast('No se pudieron guardar las preferencias. Intentá de nuevo.');
      return;
    }

    // Update in-memory user so UI stays in sync
    currentUser.recognition_visibility = visibility;
    currentUser.auto_birthday          = auto_birthday;
    currentUser.auto_anniversary       = auto_anniversary;
    const inAll = allUsers.find(u => u.__backendId === currentUser.__backendId);
    if (inAll) {
      inAll.recognition_visibility = visibility;
      inAll.auto_birthday          = auto_birthday;
      inAll.auto_anniversary       = auto_anniversary;
    }

    showSuccessToast('Cambios guardados correctamente ✓');
    closeProfilePage();
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Guardar cambios';
      lucide.createIcons({ nodes: [saveBtn] });
    }
  }
}

// Profile dropdown toggle
document.getElementById('btn-profile').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('profile-dropdown').classList.toggle('hidden');
});
document.addEventListener('click', () => { document.getElementById('profile-dropdown').classList.add('hidden'); });

function openAdmin() {
  if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
    showErrorToast('Solo administradores pueden acceder al panel de administración');
    return;
  }
  closePointsPage();
  currentPage = 'admin';
  const ap = document.getElementById('admin-page');
  ap.style.display = '';
  ap.classList.remove('hidden');
  _positionOverlayPage('admin-page');
  updateAdminVisibility();
  updateAdminQuicknav();
  loadCompanyPrograms();
  renderAutoRecognitionsAdmin();
  if (currentUser?.role === 'superadmin') { loadCompanies(); loadCsvRequests(); }
  if (currentUser?.role === 'admin') { loadAdminCsvHistory(); }
}
function openAdminPage() { openAdmin(); }

// ── Auto Recognitions Admin ───────────────────────────────────────────────────
function adminScrollTo(sectionId) {
  const section = document.getElementById(sectionId);
  const main = document.querySelector('#admin-page main');
  if (!section || !main) return;
  const offset = section.offsetTop - 60;
  main.scrollTo({ top: offset, behavior: 'smooth' });
}

function updateAdminQuicknav() {
  const isSA = currentUser?.role === 'superadmin';
  const isAdminOnly = currentUser?.role === 'admin';
  document.getElementById('qnav-my-requests')?.classList.toggle('hidden', !isAdminOnly);
  document.getElementById('qnav-companies')?.classList.toggle('hidden', !isSA);
  document.getElementById('qnav-csv-requests')?.classList.toggle('hidden', !isSA);
  document.getElementById('qnav-ar-companies')?.classList.toggle('hidden', !isSA);
}

function toggleArSection() {
  const body = document.getElementById('ar-body');
  const chevron = document.getElementById('ar-chevron');
  if (!body) return;
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

let _arSettings = null;
let _arSnapshot  = null; // form values at last load/save, used for dirty-check
let _arMonthOffset = 0; // 0 = current month

const _AR_DEFAULTS = {
  birthday_message:    '¡Feliz cumpleaños, {nombre}! Hoy el equipo entero te celebra. Gracias por ser parte de esto.',
  anniversary_message: '¡{nombre}, hoy se cumplen {años} año(s) desde que te sumaste al equipo! Gracias por todo lo que trajiste.',
};

async function renderAutoRecognitionsAdmin() {
  const companyId = currentUser?.company_id;
  if (!companyId || !window.autoRecognitionSdk) return;

  // Load settings from DB (or use defaults)
  const res = await window.autoRecognitionSdk.getSettings(companyId);
  _arSettings = res.data || { company_id: companyId, ..._AR_DEFAULTS };

  // Populate form
  const g = id => document.getElementById(id);
  const s = _arSettings;
  if (g('ar-enabled'))              g('ar-enabled').checked             = s.enabled             ?? true;
  if (g('ar-birthday-enabled'))     g('ar-birthday-enabled').checked    = s.birthday_enabled    ?? true;
  if (g('ar-anniversary-enabled'))  g('ar-anniversary-enabled').checked = s.anniversary_enabled ?? true;
  if (g('ar-birthday-message'))     g('ar-birthday-message').value      = s.birthday_message    || _AR_DEFAULTS.birthday_message;
  if (g('ar-anniversary-message'))  g('ar-anniversary-message').value   = s.anniversary_message || _AR_DEFAULTS.anniversary_message;
  if (g('ar-birthday-points'))      g('ar-birthday-points').value       = s.birthday_points    ?? 0;
  if (g('ar-anniversary-points'))   g('ar-anniversary-points').value    = s.anniversary_points ?? 0;
  if (g('ar-send-email'))           g('ar-send-email').checked          = s.send_email_notification ?? false;
  // Populate hour select (0–23) and set saved values
  const hourSel = g('ar-send-hour');
  if (hourSel && !hourSel.options.length) {
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement('option');
      opt.value = String(h).padStart(2, '0');
      opt.textContent = String(h).padStart(2, '0');
      hourSel.appendChild(opt);
    }
  }
  const [savedHour = '09'] = (s.send_time || '09:00').split(':');
  if (hourSel) hourSel.value = savedHour;

  // Snapshot form state so we can detect real changes on save
  _arSnapshot = _arFormValues();

  // Populate program selects
  _populateArProgramSelect('ar-birthday-program',    s.birthday_program);
  _populateArProgramSelect('ar-anniversary-program', s.anniversary_program);

  // Reset to current month each time the panel opens
  _arMonthOffset = 0;

  // Render month calendar + employees
  _renderArMonth();
  lucide.createIcons();
}

// ── Superadmin: Auto-recognitions per company ────────────────────────────────

let _saArSettings = {}; // { [companyId]: settingsObj }
let _saArExpanded = null; // currently expanded companyId

function openSuperadminArPage() {
  if (currentUser?.role !== 'superadmin') return;
  _saArExpanded = null;
  const page = document.getElementById('superadmin-ar-page');
  page.classList.remove('hidden');
  _positionOverlayPage('superadmin-ar-page');
  page.style.zIndex = '49'; // must be above admin-page (which also gets z-index 48)
  if (_companiesData.length) {
    renderSuperadminArSection();
  } else {
    loadCompanies().then(() => renderSuperadminArSection());
  }
  lucide.createIcons();
}

function closeSuperadminArPage() {
  const page = document.getElementById('superadmin-ar-page');
  page.classList.add('hidden');
  page.style.display = 'none';
}

async function renderSuperadminArSection() {
  const container = document.getElementById('sa-ar-list');
  if (!container) return;

  const realCompanies = _companiesData.length ? [..._companiesData] : [...companies];
  if (!realCompanies.length) {
    container.innerHTML = '<p class="text-center py-8 text-gray-400 text-sm">No hay empresas cargadas.</p>';
    return;
  }

  // Load all settings in parallel
  const results = await Promise.all(
    realCompanies.map(c => window.autoRecognitionSdk.getSettings(c.id).then(r => ({ companyId: c.id, data: r.data })))
  );
  results.forEach(({ companyId, data }) => {
    _saArSettings[companyId] = data || { company_id: companyId, ..._AR_DEFAULTS };
  });

  container.innerHTML = realCompanies.map(co => _renderSaArCompanyCard(co)).join('');
  lucide.createIcons();
}

function _renderSaArCompanyCard(co) {
  const s = _saArSettings[co.id] || { ..._AR_DEFAULTS };
  const enabled   = s.enabled  ?? true;
  const bdayOn    = s.birthday_enabled    ?? true;
  const anivOn    = s.anniversary_enabled ?? true;
  const emailOn   = s.send_email_notification ?? false;
  const isOpen    = _saArExpanded === co.id;
  const empCount = allUsers.filter(u => u.company_id === co.id).length;

  const statusDot = enabled
    ? '<span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span>'
    : '<span class="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>';

  const hourOptions = Array.from({ length: 24 }, (_, h) => {
    const v = String(h).padStart(2, '0');
    const [savedH = '09'] = (s.send_time || '09:00').split(':');
    return `<option value="${v}" ${v === savedH ? 'selected' : ''}>${v}</option>`;
  }).join('');

  return `
    <div class="px-6 py-4">
      <!-- Summary row -->
      <div class="flex items-center gap-3 cursor-pointer" onclick="_toggleSaArCompany('${co.id}')">
        <div class="w-8 h-8 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">
          ${esc(co.name.substring(0,2).toUpperCase())}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-800 flex items-center gap-2">
            ${esc(co.name)} ${statusDot}
          </p>
          <p class="text-xs text-gray-400">${empCount} empleado${empCount !== 1 ? 's' : ''} · ${bdayOn ? '🎂' : '🚫'} Cumpleaños · ${anivOn ? '🏢' : '🚫'} Aniversario</p>
        </div>
        <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}"></i>
      </div>

      <!-- Expanded form -->
      <div id="sa-ar-body-${co.id}" class="${isOpen ? '' : 'hidden'} mt-4 space-y-4 border-t border-gray-100 pt-4">

        <!-- Master toggle -->
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-700">Reconocimientos automáticos activos</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="sa-ar-enabled-${co.id}" class="sr-only peer" ${enabled ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#3d2b56]
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
              peer-checked:after:translate-x-5"></div>
          </label>
        </div>

        <!-- Two columns: Birthday | Anniversary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <!-- Birthday -->
          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <i data-lucide="cake" class="w-4 h-4 text-[#f19ac4]"></i> Cumpleaños
              </span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="sa-ar-bday-on-${co.id}" class="sr-only peer" ${bdayOn ? 'checked' : ''}>
                <div class="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#f19ac4]
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                  after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                  peer-checked:after:translate-x-4"></div>
              </label>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Mensaje <span class="font-normal text-gray-400">— variables: {nombre}</span></label>
              <textarea id="sa-ar-bday-msg-${co.id}" rows="3"
                class="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none">${esc(s.birthday_message || _AR_DEFAULTS.birthday_message)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Puntos</label>
              <input type="number" id="sa-ar-bday-pts-${co.id}" min="0" value="${s.birthday_points ?? 0}"
                class="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
          </div>

          <!-- Anniversary -->
          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <i data-lucide="building-2" class="w-4 h-4 text-violet-400"></i> Aniversario
              </span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="sa-ar-aniv-on-${co.id}" class="sr-only peer" ${anivOn ? 'checked' : ''}>
                <div class="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-violet-400
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                  after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                  peer-checked:after:translate-x-4"></div>
              </label>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Mensaje <span class="font-normal text-gray-400">— variables: {nombre} {años}</span></label>
              <textarea id="sa-ar-aniv-msg-${co.id}" rows="3"
                class="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none">${esc(s.anniversary_message || _AR_DEFAULTS.anniversary_message)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 mb-1">Puntos</label>
              <input type="number" id="sa-ar-aniv-pts-${co.id}" min="0" value="${s.anniversary_points ?? 0}"
                class="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300">
            </div>
          </div>
        </div>

        <!-- Send time -->
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-gray-700 shrink-0">Hora de envío</span>
          <select id="sa-ar-hour-${co.id}" class="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
            ${hourOptions}
          </select>
          <span class="text-sm font-semibold text-gray-400">:00 hs</span>
          <span class="text-xs text-gray-400">(UTC)</span>
        </div>

        <!-- Email notification -->
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <p class="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><i data-lucide="mail" class="w-4 h-4 text-[#3d2b56]"></i> Notificación por email</p>
            <p class="text-xs text-gray-400 mt-0.5">Enviar email al empleado con el reconocimiento y link a la plataforma</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
            <input type="checkbox" id="sa-ar-email-${co.id}" class="sr-only peer" ${emailOn ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#3d2b56]
              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
              after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
              peer-checked:after:translate-x-5"></div>
          </label>
        </div>

        <!-- Save button -->
        <div class="flex justify-end">
          <button id="sa-ar-save-btn-${co.id}" onclick="saveSuperadminArCompany('${co.id}')"
            class="btn-recognize text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow transition">
            <i data-lucide="save" class="w-4 h-4"></i> Guardar cambios
          </button>
        </div>
      </div>
    </div>
  `;
}

function _toggleSaArCompany(companyId) {
  _saArExpanded = _saArExpanded === companyId ? null : companyId;
  renderSuperadminArSection();
}

async function saveSuperadminArCompany(companyId) {
  const btn = document.getElementById(`sa-ar-save-btn-${companyId}`);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...'; lucide.createIcons({ nodes: [btn] }); }

  const g = id => { const el = document.getElementById(id); return el; };
  const hour = g(`sa-ar-hour-${companyId}`)?.value || '09';
  const min  = '00';

  const settings = {
    company_id:           companyId,
    enabled:              g(`sa-ar-enabled-${companyId}`)?.checked ?? true,
    birthday_enabled:     g(`sa-ar-bday-on-${companyId}`)?.checked ?? true,
    anniversary_enabled:  g(`sa-ar-aniv-on-${companyId}`)?.checked ?? true,
    birthday_message:     g(`sa-ar-bday-msg-${companyId}`)?.value  || _AR_DEFAULTS.birthday_message,
    anniversary_message:  g(`sa-ar-aniv-msg-${companyId}`)?.value  || _AR_DEFAULTS.anniversary_message,
    birthday_points:      parseInt(g(`sa-ar-bday-pts-${companyId}`)?.value) || 0,
    anniversary_points:   parseInt(g(`sa-ar-aniv-pts-${companyId}`)?.value) || 0,
    send_time:                 `${hour}:${min}`,
    send_email_notification:   g(`sa-ar-email-${companyId}`)?.checked ?? false,
  };

  const { isOk } = await window.autoRecognitionSdk.saveSettings(settings);

  if (isOk) {
    _saArSettings[companyId] = settings;
    showSuccessToast(`Configuración de ${companies.find(c => c.id === companyId)?.name || companyId} guardada`);
    // Re-render the card summary to reflect new state
    renderSuperadminArSection();
  } else {
    showErrorToast('No se pudo guardar la configuración. Intentá de nuevo.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Guardar cambios'; lucide.createIcons({ nodes: [btn] }); }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function _populateArProgramSelect(selectId, currentValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const programs = _visiblePrograms();
  sel.innerHTML = '<option value="">Sin programa específico</option>' +
    programs.map(p => {
      const label = `${p.emoji} ${p.name}`;
      return `<option value="${esc(label)}" ${currentValue === label ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
}

function _todayDDMM() {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
}

const _AR_MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function _arPrevMonth() { _arMonthOffset--; _renderArMonth(); }
function _arNextMonth() { _arMonthOffset++; _renderArMonth(); }

function _renderArMonth() {
  const el     = document.getElementById('ar-upcoming-list');
  const cnt    = document.getElementById('ar-upcoming-count');
  const label  = document.getElementById('ar-month-label');
  if (!el) return;

  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(today.getFullYear(), today.getMonth() + _arMonthOffset, 1);
  const month  = target.getMonth();
  const year   = target.getFullYear();

  const isCurrentMonth = (month === today.getMonth() && year === today.getFullYear());
  const isToday = (day) => isCurrentMonth && day === today.getDate();

  if (label) label.textContent = `${_AR_MONTH_NAMES[month]} ${year}`;

  const companyId = currentUser?.company_id;
  const users = allUsers.filter(u => u.company_id === companyId);
  const events = [];

  users.forEach(u => {
    if (u.birthday && u.auto_birthday !== false) {
      const [dd, mm] = u.birthday.split('/').map(Number);
      if (mm - 1 === month) {
        events.push({ type: 'birthday', name: u.name, dept: u.department || '', day: dd, years: null });
      }
    }
    if (u.anniversary_date && u.auto_anniversary !== false) {
      const base = new Date(u.anniversary_date + 'T00:00:00');
      if (base.getMonth() === month) {
        const years = year - base.getFullYear();
        events.push({ type: 'anniversary', name: u.name, dept: u.department || '', day: base.getDate(), years: years > 0 ? years : null });
      }
    }
  });

  events.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'es'));

  if (cnt) cnt.textContent = events.length;

  if (!events.length) {
    el.innerHTML = `<p class="text-xs text-gray-400 italic">Sin cumpleaños ni aniversarios en ${_AR_MONTH_NAMES[month].toLowerCase()}.</p>`;
    return;
  }

  el.innerHTML = events.map(e => {
    const isBday  = e.type === 'birthday';
    const icon    = isBday ? 'cake' : 'star';
    const iconClr = isBday ? 'text-[#f19ac4] bg-[#fff0f6]' : 'text-[#c9a7d4] bg-[#f5f0fa]';
    const typeLabel = isBday ? 'Cumpleaños' : `Aniversario${e.years ? ` · ${e.years} año${e.years > 1 ? 's' : ''}` : ''}`;
    const dayStr  = String(e.day).padStart(2, '0');
    const monStr  = String(month + 1).padStart(2, '0');

    let badge = '';
    if (isCurrentMonth) {
      const diff = e.day - today.getDate();
      if (diff === 0)        badge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold shrink-0">Hoy</span>';
      else if (diff > 0 && diff <= 3) badge = `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold shrink-0">en ${diff} día${diff > 1 ? 's' : ''}</span>`;
      else if (diff < 0)     badge = '<span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">Pasó</span>';
    }

    return `<div class="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100${isToday(e.day) ? ' border-green-200 bg-green-50/40' : ''}">
      <div class="w-8 h-8 rounded-lg bg-white border border-gray-200 flex flex-col items-center justify-center shrink-0">
        <span class="text-[11px] font-bold text-gray-800 leading-none">${dayStr}</span>
        <span class="text-[9px] text-gray-400 leading-none uppercase">${_AR_MONTH_NAMES[month].substring(0,3)}</span>
      </div>
      <div class="w-6 h-6 rounded-full ${iconClr} flex items-center justify-center shrink-0">
        <i data-lucide="${icon}" class="w-3 h-3"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800 truncate">${esc(e.name)}</p>
        <p class="text-xs text-gray-400 truncate">${esc(typeLabel)}${e.dept ? ` · ${esc(e.dept)}` : ''}</p>
      </div>
      ${badge}
    </div>`;
  }).join('');
  lucide.createIcons();
}

function _renderArEmployees() {
  const el  = document.getElementById('ar-employees-list');
  const cnt = document.getElementById('ar-employees-count');
  if (!el) return;
  const companyId = currentUser?.company_id;
  const withDates = allUsers.filter(u =>
    u.company_id === companyId && (u.birthday || u.anniversary_date)
  );
  if (cnt) cnt.textContent = withDates.length;
  if (!withDates.length) {
    el.innerHTML = '<p class="text-xs text-gray-400 italic">Ningún empleado tiene fechas configuradas aún.</p>';
    return;
  }
  el.innerHTML = withDates.map(u => {
    const bday = u.birthday
      ? `<span class="flex items-center gap-0.5 text-[10px] text-gray-500"><i data-lucide="cake" class="w-3 h-3 text-[#f19ac4]"></i> ${esc(u.birthday)}</span>`
      : '';
    const ann = u.anniversary_date
      ? `<span class="flex items-center gap-0.5 text-[10px] text-gray-500"><i data-lucide="star" class="w-3 h-3 text-[#c9a7d4]"></i> ${esc(u.anniversary_date)}</span>`
      : '';
    const initials = (u.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2);
    return `<div class="flex items-center gap-2.5 py-1.5">
      <div class="w-7 h-7 rounded-full ${getAvatarColor(u.name||'')} flex items-center justify-center text-white text-[10px] font-bold shrink-0">${esc(initials)}</div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-gray-700 truncate">${esc(u.name)}</p>
        <div class="flex items-center gap-3 mt-0.5">${bday}${ann}</div>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function _arFormValues() {
  const g = id => document.getElementById(id);
  return {
    enabled:             String(g('ar-enabled')?.checked             ?? true),
    birthday_enabled:    String(g('ar-birthday-enabled')?.checked    ?? true),
    anniversary_enabled: String(g('ar-anniversary-enabled')?.checked ?? true),
    birthday_message:    (g('ar-birthday-message')?.value?.trim()    || _AR_DEFAULTS.birthday_message),
    anniversary_message: (g('ar-anniversary-message')?.value?.trim() || _AR_DEFAULTS.anniversary_message),
    birthday_points:     String(parseInt(g('ar-birthday-points')?.value  || '0')),
    anniversary_points:  String(parseInt(g('ar-anniversary-points')?.value || '0')),
    send_time:                `${g('ar-send-hour')?.value || '09'}:00`,
    send_email_notification:  String(g('ar-send-email')?.checked ?? false),
  };
}

async function saveAutoRecognitionSettings() {
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) {
    showErrorToast('Solo administradores pueden guardar esta configuración.');
    return;
  }
  const companyId = currentUser.company_id;
  if (!companyId || !window.autoRecognitionSdk) return;

  const current = _arFormValues();

  // Compare against the snapshot taken when the form was last loaded/saved
  const hasChanges = !_arSnapshot ||
    Object.keys(current).some(k => current[k] !== _arSnapshot[k]);

  if (!hasChanges) {
    const msg = document.getElementById('ar-saved-msg');
    if (msg) {
      msg.className = 'text-xs font-semibold text-gray-400';
      msg.textContent = 'No se realizaron modificaciones.';
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 2500);
    }
    return;
  }

  const g = id => document.getElementById(id);
  const settings = {
    company_id:          companyId,
    enabled:             g('ar-enabled')?.checked             ?? true,
    birthday_enabled:    g('ar-birthday-enabled')?.checked    ?? true,
    anniversary_enabled: g('ar-anniversary-enabled')?.checked ?? true,
    birthday_message:    g('ar-birthday-message')?.value?.trim()    || _AR_DEFAULTS.birthday_message,
    anniversary_message: g('ar-anniversary-message')?.value?.trim() || _AR_DEFAULTS.anniversary_message,
    birthday_program:    '🎂 Cumpleaños',
    anniversary_program: '🎉 Aniversario',
    birthday_points:     parseInt(g('ar-birthday-points')?.value  || '0'),
    anniversary_points:  parseInt(g('ar-anniversary-points')?.value || '0'),
    send_time:                `${g('ar-send-hour')?.value || '09'}:00`,
    send_email_notification:  g('ar-send-email')?.checked ?? false,
  };

  const saveBtn = document.querySelector('[onclick="saveAutoRecognitionSettings()"]');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...'; lucide.createIcons(); }

  _arSettings  = settings;
  _arSnapshot  = current; // update snapshot so next save detects new baseline
  const res = await window.autoRecognitionSdk.saveSettings(settings);

  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Guardar configuración'; lucide.createIcons(); }

  if (res.isOk) {
    const msg = document.getElementById('ar-saved-msg');
    if (msg) {
      msg.className = 'text-xs font-semibold text-green-600';
      msg.textContent = 'Configuración guardada ✓';
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 3000);
    }
  } else {
    showErrorToast('Error al guardar. Verificá que el SQL fix_16 esté aplicado.');
  }
}

async function triggerAutoRecognitionsNow() {
  if (!_arSettings) { showErrorToast('Guardá la configuración primero.'); return; }
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) return;

  const companyId = currentUser.company_id;
  const today = (() => {
    const d = new Date();
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0');
  })();

  const btn = document.querySelector('[onclick="triggerAutoRecognitionsNow()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Enviando...'; lucide.createIcons(); }

  let sent = 0, skipped = 0;
  const errors = [];

  // Find first admin to use as sender
  const sender = allUsers.find(u => u.company_id === companyId && u.role === 'admin' && u.__backendId);
  if (!sender) { showErrorToast('No se encontró un administrador como remitente.'); if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5"></i> Probar envío de hoy'; lucide.createIcons(); } return; }

  const companyUsers = allUsers.filter(u => u.company_id === companyId);

  // Birthdays today
  if (_arSettings.birthday_enabled && _arSettings.enabled) {
    const todays = companyUsers.filter(u => u.birthday === today && u.auto_birthday !== false);
    for (const u of todays) {
      const firstName = u.name.split(' ')[0];
      const message = (_arSettings.birthday_message || _AR_DEFAULTS.birthday_message)
        .replace(/\{nombre\}/g, firstName)
        .replace(/\{nombre_completo\}/g, u.name)
        .replace(/\{equipo\}/g, u.department || '');
      const res = await window.recognitionSdk.sendAs(
        sender.__backendId, u.__backendId,
        _arSettings.birthday_points || 0,
        _arSettings.birthday_program || '⭐ Actitud',
        message, companyId
      );
      if (res.isOk) sent++; else { skipped++; errors.push(u.name); }
    }
  }

  // Anniversaries today
  if (_arSettings.anniversary_enabled && _arSettings.enabled) {
    const todays = companyUsers.filter(u => {
      if (!u.anniversary_date || u.auto_anniversary === false) return false;
      const d = new Date(u.anniversary_date);
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      return `${dd}/${mm}` === today && new Date().getFullYear() > d.getFullYear();
    });
    for (const u of todays) {
      const firstName = u.name.split(' ')[0];
      const years = new Date().getFullYear() - new Date(u.anniversary_date).getFullYear();
      const message = (_arSettings.anniversary_message || _AR_DEFAULTS.anniversary_message)
        .replace(/\{nombre\}/g, firstName)
        .replace(/\{nombre_completo\}/g, u.name)
        .replace(/\{equipo\}/g, u.department || '')
        .replace(/\{años\}/g, String(years));
      const res = await window.recognitionSdk.sendAs(
        sender.__backendId, u.__backendId,
        _arSettings.anniversary_points || 0,
        _arSettings.anniversary_program || '🏆 Trabajo en Equipo',
        message, companyId
      );
      if (res.isOk) sent++; else { skipped++; errors.push(u.name); }
    }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5"></i> Probar envío de hoy'; lucide.createIcons(); }

  if (sent > 0) {
    showSuccessToast(`${sent} reconocimiento${sent > 1 ? 's' : ''} enviado${sent > 1 ? 's' : ''} correctamente.`);
    renderFeed(true);
  } else if (skipped > 0) {
    showErrorToast(`No se pudieron enviar ${skipped} reconocimientos.`);
  } else {
    showSuccessToast('No hay cumpleaños ni aniversarios para enviar hoy.');
  }
}

function closeAdminPage() {
  document.getElementById('admin-page').classList.add('hidden');
  if (currentPage === 'admin') currentPage = 'home';
}

// ── Companies management (superadmin only) ────────────────────────────────────
const COMPANY_PAGE_SIZE = 3;
let _companiesData = [];
let _companyPage = 0;

function filterCompaniesSearch() {
  _companyPage = 0;
  renderCompaniesList();
}

async function loadCompanies() {
  const { isOk, data } = await window.companySdk.list();
  if (isOk) { _companiesData = data; _companyPage = 0; renderCompaniesList(); }
}

function renderCompaniesList() {
  const container = document.getElementById('companies-list');
  if (!container) return;

  const searchTerm = (document.getElementById('company-search')?.value || '').toLowerCase().trim();
  let filtered = searchTerm
    ? _companiesData.filter(c =>
        c.name?.toLowerCase().includes(searchTerm) ||
        c.id?.toLowerCase().includes(searchTerm) ||
        c.domain?.toLowerCase().includes(searchTerm))
    : _companiesData;

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  if (_companyPage >= totalPages) _companyPage = totalPages - 1;
  const paged = filtered.slice(_companyPage * COMPANY_PAGE_SIZE, (_companyPage + 1) * COMPANY_PAGE_SIZE);

  if (total === 0) {
    container.innerHTML = `<p class="text-center py-6 text-gray-400 text-sm">${searchTerm ? 'Sin resultados.' : 'No hay empresas registradas.'}</p>`;
    return;
  }

  const rows = paged.map(c => {
    const storeOn = c.store_enabled !== false;
    const empCount = allUsers.filter(u => u.company_id === c.id && u.role !== 'superadmin').length;
    return `
    <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50">
      <div class="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
        <i data-lucide="building-2" class="w-4 h-4 text-violet-500"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800">${esc(c.name)}</p>
        <p class="text-xs text-gray-400"><span class="font-mono bg-gray-100 px-1 rounded">${esc(c.id)}</span> &nbsp;·&nbsp; ${esc(c.domain)} &nbsp;·&nbsp; <i data-lucide="users" class="w-3 h-3 inline-block -mt-0.5"></i> ${empCount} empleado${empCount !== 1 ? 's' : ''}</p>
      </div>
      <button onclick="toggleCompanyStore('${esc(c.id)}', ${!storeOn})"
        title="${storeOn ? 'Desactivar tienda y puntos' : 'Activar tienda y puntos'}"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${storeOn ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-gray-200'}">
        <i data-lucide="${storeOn ? 'shopping-bag' : 'shopping-bag-x'}" class="w-3.5 h-3.5"></i>
        ${storeOn ? 'Tienda ON' : 'Tienda OFF'}
      </button>
      <button onclick="deleteCompany('${esc(c.id)}')" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition" title="Eliminar empresa">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>`;
  }).join('');

  const pagination = totalPages > 1 ? `
    <div class="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
      <button onclick="_companyPage--;renderCompaniesList()" ${_companyPage === 0 ? 'disabled' : ''} class="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
        <i data-lucide="chevron-left" class="w-4 h-4"></i> Anterior
      </button>
      <span class="text-xs text-gray-500">Página ${_companyPage + 1} de ${totalPages}</span>
      <button onclick="_companyPage++;renderCompaniesList()" ${_companyPage >= totalPages - 1 ? 'disabled' : ''} class="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition">
        Siguiente <i data-lucide="chevron-right" class="w-4 h-4"></i>
      </button>
    </div>` : '';

  container.innerHTML = rows + pagination;
  lucide.createIcons();
}

async function toggleCompanyStore(companyId, enable) {
  const { isOk } = await window.companySdk.update(companyId, { store_enabled: enable });
  if (!isOk) { showErrorToast('No se pudo actualizar la configuración'); return; }
  const idx = _companiesData.findIndex(c => c.id === companyId);
  if (idx !== -1) _companiesData[idx].store_enabled = enable;
  renderCompaniesList();
  showSuccessToast(enable ? `Tienda activada para ${_companiesData[idx]?.name || companyId}` : `Tienda desactivada para ${_companiesData[idx]?.name || companyId}`);
}

function toggleCreateCompanyForm() {
  const form = document.getElementById('create-company-form');
  const isHidden = form.classList.toggle('hidden');
  if (!isHidden) document.getElementById('new-company-name').focus();
}

function autoFillCompanyId() {
  const name = document.getElementById('new-company-name').value;
  const slug = 'comp-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  document.getElementById('new-company-id').value = slug;
}

async function submitCreateCompany() {
  const name   = document.getElementById('new-company-name').value.trim();
  const domain = document.getElementById('new-company-domain').value.trim();
  const id     = document.getElementById('new-company-id').value.trim();
  if (!name || !domain || !id) { showErrorToast('Completá todos los campos'); return; }
  if (!domain.startsWith('@')) { showErrorToast('El dominio debe comenzar con @'); return; }

  const btn = document.getElementById('create-company-btn');
  btn.disabled = true; btn.textContent = 'Creando...';

  const { isOk, error } = await window.companySdk.create(id, name, domain);
  btn.disabled = false; btn.textContent = 'Crear empresa';

  if (!isOk) {
    const msg = error?.message || error?.details || String(error) || '';
    if (msg.includes('duplicate') || msg.includes('unique') || error?.code === '23505')
      showErrorToast('Ya existe una empresa con ese ID.');
    else if (msg.includes('row-level security') || msg.includes('policy') || error?.code === '42501')
      showErrorToast('Sin permiso para crear empresas. Ejecutá fix_22 en Supabase SQL Editor.');
    else
      showErrorToast(`Error al crear la empresa: ${msg || 'desconocido'}`);
    return;
  }
  showSuccessToast(`Empresa "${name}" creada correctamente`);
  document.getElementById('new-company-name').value = '';
  document.getElementById('new-company-domain').value = '';
  document.getElementById('new-company-id').value = '';
  document.getElementById('create-company-form').classList.add('hidden');
  await loadCompanies();
}

async function deleteCompany(id) {
  const company = _companiesData.find(c => c.id === id);
  if (!company) return;
  if (!confirm(`¿Eliminar la empresa "${company.name}"?\n\nAtención: los empleados asociados quedarán sin empresa asignada.`)) return;
  const { isOk } = await window.companySdk.remove(id);
  if (!isOk) { showErrorToast('No se pudo eliminar la empresa. Puede tener empleados o datos asociados.'); return; }
  showSuccessToast(`Empresa "${company.name}" eliminada`);
  await loadCompanies();
}

function updateAdminVisibility() {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSA = currentUser?.role === 'superadmin';
  document.getElementById('admin-nav-link')?.classList.toggle('hidden', !isAdmin);
  document.getElementById('analytics-nav-link')?.classList.toggle('hidden', !isAdmin);
  document.getElementById('points-nav-link')?.classList.toggle('hidden', !isAdmin);
  if (isAdmin) document.getElementById('points-nav-link')?.classList.add('flex');
  else document.getElementById('points-nav-link')?.classList.remove('flex');
  document.getElementById('superadmin-companies-section')?.classList.toggle('hidden', !isSA);
  document.getElementById('superadmin-csv-requests-section')?.classList.toggle('hidden', !isSA);
  const isAdminOnly = isAdmin && !isSA;
  document.getElementById('admin-csv-history-section')?.classList.toggle('hidden', !isAdminOnly);
  document.body.classList.toggle('is-admin', isAdmin);

  // Update upload button label: admin submits for approval, superadmin uploads directly
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) {
    if (isSA) {
      uploadBtn.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Cargar empleados';
    } else {
      uploadBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Enviar para aprobación';
    }
    lucide.createIcons();
  }

  updateApprovalsNavVisibility();
}

// ------------------------------------------------------------
// ------------------------------------------------------------
function impersonateEmployee(empBackendId) {
  if (currentUser?.role !== 'superadmin') { showErrorToast('Solo superadmin puede impersonar empleados'); return; }
  if (!originalSuperadminUser) originalSuperadminUser = { ...currentUser };

  const emp = allUsers.find(e => e.__backendId === empBackendId);
  if (!emp) { showErrorToast('Empleado no encontrado'); return; }

  currentUser = {
    name: emp.name, email: emp.email, department: emp.department,
    company_id: emp.company_id, role: emp.role || 'employee',
    user_id: emp.email, points_to_give: emp.points_to_give,
    points_to_redeem: emp.points_to_redeem, __backendId: emp.__backendId,
    birthday: emp.birthday || null, anniversary_date: emp.anniversary_date || null,
    auto_birthday: emp.auto_birthday ?? true, auto_anniversary: emp.auto_anniversary ?? true,
  };

  isImpersonating = true;
  document.body.classList.remove('is-superadmin');
  updateAdminVisibility();
  updateImpersonationBanner();
  closeAdminPage();

  updateProfileDisplay();
  updatePointsDisplay();
  loadCurrentCompanySettings();

  filterEmployeesByCompany();
  renderEmployeesList();
  showSuccessToast(`Usando cuenta de: ${emp.name}`);
  _rebuildCompanyMemberIds();
  switchPage('home');
  renderFeed(true);
  loadHomeSidebar();
  loadNotifications();
  _loadApprovals();
  _setupFeedRealtime();
  _setupCommentsRealtime();
  renderRecognitionBattery();
  lucide.createIcons();
}

function updateImpersonationBanner() {
  const banner   = document.getElementById('impersonation-banner');
  const userInfo = document.getElementById('impersonation-user-info');
  if (currentUser && originalSuperadminUser && currentUser.email !== originalSuperadminUser.email) {
    banner.classList.remove('hidden');
    userInfo.textContent = `Actualmente ves la plataforma como: ${currentUser.name}`;
    document.getElementById('app').style.paddingTop = banner.offsetHeight + 'px';
  } else {
    banner.classList.add('hidden');
    originalSuperadminUser = null;
    document.getElementById('app').style.paddingTop = '0';
  }
}

function returnToSuperadmin() {
  if (!originalSuperadminUser) { showErrorToast('No hay cuenta de superadmin para volver'); return; }
  currentUser = { ...originalSuperadminUser };
  originalSuperadminUser = null;
  isImpersonating = false;
  document.body.classList.add('is-superadmin');
  _storeEnabled = true;
  _applyStoreMode();
  filterEmployeesByCompany();
  renderEmployeesList();
  updateImpersonationBanner();
  updateAdminVisibility();
  updateProfileDisplay();
  showSuccessToast(`Volviste a tu cuenta: ${currentUser.name}`);
  loadNotifications();
  _setupFeedRealtime();
  renderRecognitionBattery();
  lucide.createIcons();
  setTimeout(() => openAdmin(), 50);
}

function openModal() {
  currentStep = 1; _selectedRecipients = []; selectedProgram = null;

  // Clear selected recipients bar
  const bar = document.getElementById('selected-recipients-bar');
  if (bar) { bar.innerHTML = ''; bar.classList.add('hidden'); }

  // Reset step-3 summary
  const sumName   = document.getElementById('sum-name');
  const sumProg   = document.getElementById('sum-program');
  const sumAvatar = document.getElementById('sum-avatar');
  if (sumName)   sumName.textContent   = '–';
  if (sumProg)   sumProg.textContent   = '–';
  if (sumAvatar) sumAvatar.textContent = '?';

  // Ensure next button has the span inside (may have been destroyed by finally block)
  const modalNext = document.getElementById('modal-next');
  if (modalNext && !document.getElementById('next-text')) {
    modalNext.innerHTML = '<span id="next-text">Siguiente</span>';
  }

  document.getElementById('recognize-modal').classList.remove('hidden');
  // Reset assistant panel
  document.getElementById('assistant-panel')?.classList.add('hidden');
  document.getElementById('btn-assistant')?.classList.remove('hidden');
  if (document.getElementById('assistant-example')) document.getElementById('assistant-example').value = '';
  if (document.getElementById('assistant-why'))     document.getElementById('assistant-why').value = '';
  // Reset private toggle
  const privEl = document.getElementById('recognition-private');
  if (privEl) { privEl.checked = false; onPrivateToggle(); }
  showStep(1);
  document.getElementById('person-search').value = '';
  renderPeopleList();
  filterPeople('');
  renderProgramsInModal();

  const msgEl = document.getElementById('recog-message');
  if (msgEl) { msgEl.value = ''; msgEl.blur(); }

  const availPts = currentUser?.points_to_give ?? 0;
  const initPts  = Math.min(25, availPts);
  const slider = document.getElementById('points-slider');
  slider.min   = 5;
  slider.max   = availPts;
  slider.value = initPts;
  document.getElementById('points-val').value = initPts;
  document.getElementById('points-warning').classList.add('hidden');
  const modalPtsAvail = document.getElementById('modal-pts-available');
  if (modalPtsAvail) modalPtsAvail.textContent = availPts;

  // Disable toggle if user has no points
  const toggleBtn = document.getElementById('points-toggle');
  if (toggleBtn) {
    const noPoints = availPts === 0;
    toggleBtn.disabled = noPoints;
    toggleBtn.style.opacity = noPoints ? '0.4' : '';
    toggleBtn.style.cursor  = noPoints ? 'not-allowed' : '';
    const noPointsMsg = document.getElementById('no-points-msg');
    if (noPointsMsg) noPointsMsg.classList.toggle('hidden', !noPoints);
  }
  document.getElementById('program-budget-info')?.classList.add('hidden');
  const cb = document.getElementById('use-program-budget');
  if (cb) cb.checked = false;
  _setPointsSwitch(false);
  clearRecogImage();
  updateModalBtn();
}

function _setPointsSwitch(on) {
  const btn  = document.getElementById('points-toggle');
  const dot  = document.getElementById('points-toggle-dot');
  const wrap = document.getElementById('points-slider-wrap');
  if (!btn) return;
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  btn.classList.toggle('bg-violet-500', on);
  btn.classList.toggle('bg-gray-300', !on);
  dot.classList.toggle('translate-x-6', on);
  dot.classList.toggle('translate-x-1', !on);
  wrap.classList.toggle('hidden', !on);
}

function togglePointsSwitch() {
  const btn = document.getElementById('points-toggle');
  if (btn.disabled) return;
  const isOn = btn.getAttribute('aria-checked') === 'true';
  _setPointsSwitch(!isOn);
  if (!isOn) {
    // Turning ON: start at 10 pts (or max available if less than 10)
    const avail  = currentUser?.points_to_give ?? 0;
    const start  = Math.min(10, avail);
    const slider = document.getElementById('points-slider');
    slider.value = start;
    document.getElementById('points-val').value = start;
    updatePointsSlider(start);
  } else {
    document.getElementById('modal-next').disabled = false;
  }
}

function closeModal() {
  document.getElementById('recognize-modal').classList.add('hidden');
  closeMessageAssistant();
}

function openMessageAssistant() {
  const panel = document.getElementById('assistant-panel');
  if (!panel) return;

  // Show the panel
  panel.classList.remove('hidden');
  document.getElementById('btn-assistant')?.classList.add('hidden');

  // Populate the value dropdown from companyPrograms
  const sel = document.getElementById('assistant-value');
  if (sel) {
    const progs = _visiblePrograms();
    sel.innerHTML = '<option value="">Elegí un valor...</option>' +
      progs.map(p => `<option value="${esc(p.id)}">${esc(p.emoji)} ${esc(p.name)}</option>`).join('');
  }

  // Update the recipient name in Q1
  const nameEl = document.getElementById('assistant-recipient-name');
  if (nameEl && _selectedRecipients.length > 0) {
    const names = _selectedRecipients.map(r => r.name.split(' ')[0]).join(' y ');
    nameEl.textContent = names;
  }

  lucide.createIcons();
}

function closeMessageAssistant() {
  document.getElementById('assistant-panel')?.classList.add('hidden');
  document.getElementById('btn-assistant')?.classList.remove('hidden');
}

function _generateRecognitionMessage(recipientName, _valueName, _valueEmoji, example, why) {
  const firstName = recipientName.split(' ')[0];
  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const low = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : '';

  const wh = why.trim().replace(/[.!?,]+$/, '').trim();

  const opening = rnd([
    `${firstName}, queria reconocerte algo.`,
    `Esto te lo queria decir, ${firstName}.`,
    `${firstName}, no quiero que esto quede sin decirse.`,
  ]);

  // ------------------------------------------------------------
  const actionFrames = [
    `${cap(ex)}.`,
    `Lo que vi fue esto: ${low(ex)}.`,
    `Esta semana pasó algo que vale reconocer: ${low(ex)}.`,
  ];
  const action = ex ? rnd(actionFrames) : '';

  const impactFrames = [
    `Lo que mas me llamo la atencion fue que ${low(wh)}.`,
    `Eso me importo especialmente porque ${low(wh)}.`,
    `Me quedo pensando en eso porque ${low(wh)}.`,
  ];
  const impact = wh ? rnd(impactFrames) : '';

  const closing = rnd([
    `Eso habla muy bien de vos. Gracias, ${firstName}.`,
    `Gracias por eso. El equipo lo nota.`,
    `Me alegra trabajar con alguien asi. Gracias.`,
    `Eso no es algo que todos hacen. Gracias, ${firstName}.`,
  ]);

  return [opening, action, impact, closing].filter(Boolean).join(' ');
}

function generateMessageWithAssistant() {
  const valueId  = document.getElementById('assistant-value')?.value;
  const example  = document.getElementById('assistant-example')?.value?.trim();
  const why      = document.getElementById('assistant-why')?.value?.trim();

  if (!valueId) { showErrorToast('Elegí un valor primero'); return; }
  if (!example) { showErrorToast('Describí un ejemplo de lo que hizo'); return; }
  if (!why)     { showErrorToast('Contá por qué ese momento te llamó la atención'); return; }

  // Find the program object
  const prog = companyPrograms.find(p => p.id === valueId);
  if (!prog) { showErrorToast('Programa no encontrado'); return; }

  // Get recipient name(s)
  const recipientName = _selectedRecipients.length > 0
    ? _selectedRecipients.map(r => r.name).join(' y ')
    : 'esta persona';

  // Generate the message
  const message = _generateRecognitionMessage(recipientName, prog.name, prog.emoji, example, why);

  // Set the message textarea
  const msgEl = document.getElementById('recog-message');
  if (msgEl) {
    msgEl.value = message;
    msgEl.dispatchEvent(new Event('input'));
  }

  // Auto-select the matching program
  const programLabel = `${prog.emoji} ${prog.name}`;
  const grid = document.getElementById('programs-grid');
  if (grid) {
    const items = grid.querySelectorAll('.program-item');
    items.forEach(item => {
      const itemName = item.querySelector('p')?.textContent?.trim();
      const itemEmoji = item.querySelector('span')?.textContent?.trim();
      const fullLabel = `${itemEmoji} ${itemName}`;
      if (fullLabel === programLabel || itemName === prog.name) {
        selectProgram(item, programLabel);
      }
    });
  }
  // Update the step-3 summary display
  const sumProg = document.getElementById('sum-program');
  if (sumProg) sumProg.textContent = programLabel;

  // Close assistant and show success
  closeMessageAssistant();
  showSuccessToast(`Mensaje generado con el valor "${prog.emoji} ${prog.name}"`);
  lucide.createIcons();
}

document.getElementById('btn-recognize-top').addEventListener('click', openModal);
document.getElementById('btn-recognize-mobile').addEventListener('click', openModal);
document.getElementById('quick-recognize').addEventListener('click', openModal);

function showStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById('step-' + i).classList.toggle('hidden', i !== n);
    const ind   = document.getElementById('step-ind-' + i);
    const dot   = ind.querySelector('div');
    const label = ind.querySelector('span');
    if (i < n) {
      dot.className = 'w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center';
      dot.innerHTML = '✓';
      if (label) label.className = 'text-xs font-medium text-violet-600 hidden sm:inline';
    } else if (i === n) {
      dot.className = 'w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center';
      dot.textContent = i;
      if (label) label.className = 'text-xs font-medium text-violet-600 hidden sm:inline';
    } else {
      dot.className = 'w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center';
      dot.textContent = i;
      if (label) label.className = 'text-xs font-medium text-gray-400 hidden sm:inline';
    }
  });
  document.getElementById('prog-1').style.width = n > 1 ? '100%' : '0%';
  document.getElementById('prog-2').style.width = n > 2 ? '100%' : '0%';
  document.getElementById('modal-back').classList.toggle('hidden', n === 1);
  currentStep = n;
  updateModalBtn();
  if (n === 3) _updatePrivacyHint();
}

function updateModalBtn() {
  const btn = document.getElementById('modal-next');
  const txt = document.getElementById('next-text');
  if (currentStep === 3)      { txt.textContent = 'Enviar'; btn.disabled = false; }
  else if (currentStep === 2) { btn.disabled = !selectedProgram; txt.textContent = 'Siguiente'; }
  else                        { btn.disabled = _selectedRecipients.length === 0; txt.textContent = 'Siguiente'; }
}

function nextStep() {
  if (currentStep === 3) { sendRecognition(); return; }
  if (currentStep === 2) {
    const names = _selectedRecipients.map(r => r.name);
    const displayName = names.length === 1
      ? names[0]
      : names.length === 2
        ? names.join(' y ')
        : names.slice(0, 2).join(', ') + ` y ${names.length - 2} más`;
    document.getElementById('sum-name').textContent    = displayName;
    document.getElementById('sum-program').textContent = selectedProgram;
    const sumAvatar = document.getElementById('sum-avatar');
    sumAvatar.textContent = _selectedRecipients.length > 1 ? _selectedRecipients.length : (names[0]?.charAt(0) || '?');
  }
  showStep(currentStep + 1);
}

function prevStep() { if (currentStep > 1) showStep(currentStep - 1); }

function updatePointsSlider(value) {
  const inp = document.getElementById('points-val');
  if (inp) inp.value = value;
  _checkPointsValidity(parseInt(value));
}

function updatePointsFromInput(raw) {
  const avail  = currentUser?.points_to_give ?? 0;
  const parsed = parseInt(raw);
  if (isNaN(parsed)) return;
  const clamped = Math.max(5, Math.min(parsed, avail));
  const slider  = document.getElementById('points-slider');
  if (slider) slider.value = clamped;
  _checkPointsValidity(clamped);
}

function clampPointsInput() {
  const avail  = currentUser?.points_to_give ?? 0;
  const inp    = document.getElementById('points-val');
  const slider = document.getElementById('points-slider');
  if (!inp) return;
  let v = parseInt(inp.value);
  if (isNaN(v) || v < 5) v = 5;
  if (v > avail) v = avail;
  inp.value = v;
  if (slider) slider.value = v;
  _checkPointsValidity(v);
}

function _checkPointsValidity(value) {
  const usingBudget = document.getElementById('use-program-budget')?.checked;
  const prog        = _getProgramByLabel(selectedProgram);
  const n           = Math.max(1, _selectedRecipients.length);
  let ok;
  if (usingBudget && prog?.custom) {
    ok = _getProgramRemainingBudget(prog) >= value * n;
  } else {
    ok = currentUser && currentUser.points_to_give >= value * n;
  }
  document.getElementById('points-warning').classList.toggle('hidden', ok || !currentUser);
  document.getElementById('modal-next').disabled = !ok && !!currentUser;
}

function filterPeople(q) {
  _renderPeopleResults(q);
}

function selectProgram(el, name) {
  document.querySelectorAll('.program-item').forEach(e => {
    e.classList.remove('border-violet-500', 'bg-violet-50');
    e.classList.add('border-gray-200');
  });
  el.classList.add('border-violet-500', 'bg-violet-50');
  el.classList.remove('border-gray-200');
  selectedProgram = name;
  updateModalBtn();
  _updateBudgetBanner();
}

function _updateBudgetBanner() {
  const banner   = document.getElementById('program-budget-info');
  const checkbox = document.getElementById('use-program-budget');
  const prog     = _getProgramByLabel(selectedProgram);
  if (prog?.custom && prog.budget > 0) {
    const remaining = _getProgramRemainingBudget(prog);
    document.getElementById('budget-remaining').textContent = remaining;
    banner.classList.remove('hidden');
    checkbox.checked = false;
  } else {
    banner.classList.add('hidden');
    if (checkbox) checkbox.checked = false;
  }
}

function toggleBudgetSource() {
  const using  = document.getElementById('use-program-budget').checked;
  const prog   = _getProgramByLabel(selectedProgram);
  const slider = document.getElementById('points-slider');
  const n      = Math.max(1, _selectedRecipients.length);
  if (using && prog) {
    const remaining  = _getProgramRemainingBudget(prog);
    const maxPerPerson = Math.floor(remaining / n);
    slider.max   = maxPerPerson;
    slider.value = Math.min(parseInt(slider.value), maxPerPerson);
    document.getElementById('points-val').value = slider.value;
    document.getElementById('points-warning').classList.add('hidden');
    document.getElementById('modal-next').disabled = false;
  } else {
    slider.max = 50;
    updatePointsSlider(slider.value);
  }
}

function _updatePrivacyHint() {
  const hint     = document.getElementById('privacy-pref-hint');
  const hintText = document.getElementById('privacy-pref-hint-text');
  if (!hint || !hintText || !_selectedRecipients.length) { hint?.classList.add('hidden'); return; }

  const preferPrivate = [];
  const preferPublic  = [];

  _selectedRecipients.forEach(r => {
    const user = allUsers.find(u => u.__backendId === r.id);
    if (!user) return;
    const pref = user.recognition_visibility || 'public';
    if (pref === 'private') preferPrivate.push(user.name.split(' ')[0]);
    else preferPublic.push(user.name.split(' ')[0]);
  });

  if (preferPrivate.length === 0) { hint.classList.add('hidden'); return; }

  let msg = '';
  if (preferPrivate.length === _selectedRecipients.length) {
    msg = preferPrivate.length === 1
      ? `${preferPrivate[0]} prefiere recibir reconocimientos de forma privada.`
      : `${preferPrivate.join(', ')} prefieren recibir reconocimientos de forma privada.`;
  } else {
    msg = `${preferPrivate.join(', ')} prefiere${preferPrivate.length > 1 ? 'n' : ''} recibir reconocimientos de forma privada.`;
  }

  hintText.textContent = msg;
  hint.classList.remove('hidden');
  if (window.lucide) lucide.createIcons({ nodes: [hint] });
}

function onPrivateToggle() {
  const isPrivate = document.getElementById('recognition-private')?.checked;
  const icon      = document.getElementById('icon-private');
  const label     = document.getElementById('label-private');
  const card      = icon?.closest('.flex.items-start.justify-between');
  if (icon)  icon.className  = `w-4 h-4 mt-0.5 shrink-0 ${isPrivate ? 'text-[#3d2b56]' : 'text-gray-400'}`;
  if (label) label.textContent = isPrivate
    ? 'Solo visible para vos, el destinatario y los administradores. Aparece en reportes.'
    : 'Solo visible para vos, el destinatario y los administradores.';
  if (card)  card.className = card.className.replace(isPrivate ? 'border-gray-100 bg-gray-50' : 'border-[#3d2b56] bg-violet-50',
    isPrivate ? 'border-[#3d2b56] bg-violet-50' : 'border-gray-100 bg-gray-50');
  lucide.createIcons();
}

async function sendRecognition() {
  const message      = document.getElementById('recog-message').value.trim();
  const pointsOn     = document.getElementById('points-toggle')?.getAttribute('aria-checked') === 'true';
  const points       = pointsOn ? parseInt(document.getElementById('points-slider').value) : 0;
  const usingBudget  = document.getElementById('use-program-budget')?.checked;
  const isPrivate    = document.getElementById('recognition-private')?.checked || false;
  const selectedProg = _getProgramByLabel(selectedProgram);
  const n            = _selectedRecipients.length;

  if (!message) {
    showErrorToast('El mensaje es obligatorio');
    document.getElementById('recog-message').focus();
    return;
  }

  if (n === 0) { showErrorToast('Seleccioná al menos un destinatario'); return; }

  if (pointsOn && points > 0) {
    if (usingBudget && selectedProg?.custom) {
      const remaining = _getProgramRemainingBudget(selectedProg);
      if (points * n > remaining) {
        showErrorToast('El programa no tiene suficiente presupuesto');
        return;
      }
    } else if (!currentUser || currentUser.points_to_give < points * n) {
      showErrorToast('No tenés suficientes puntos para enviar');
      return;
    }
  }

  const sendBtn = document.getElementById('modal-next');
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando...';
  lucide.createIcons();

  try {
    // Upload image once and append to message
    let baseMessage = message;
    if (_recogImageUrl) {
      baseMessage = message + '\n' + _recogImageUrl;
    } else if (_recogImageBase64) {
      sendBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Subiendo imagen...';
      lucide.createIcons();
      const { isOk: imgOk, url } = await window.storageSdk.uploadRecognitionImage(_recogImageBase64);
      if (imgOk && url) {
        baseMessage = message + '\n' + url;
      } else {
        showErrorToast('No se pudo subir la imagen – el reconocimiento se enviará sin ella');
      }
    }

    // Build group marker for multi-recipient (one card in feed per group)
    const gid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const groupMarker = n > 1
      ? '\n' + _GROUP_PREFIX + JSON.stringify({ gid, recipients: _selectedRecipients.map(r => ({ id: r.id, name: r.name })) }) + ']'
      : '';
    const finalMessage = baseMessage + groupMarker;

    // Budget path: pre-credit total points so the RPC balance check passes
    if (pointsOn && usingBudget && selectedProg?.custom && points > 0) {
      const topped = { ...currentUser, points_to_give: currentUser.points_to_give + points * n };
      await window.dataSdk.update(topped);
    }

    sendBtn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando (0/${n})...`;
    lucide.createIcons();

    let sentCount = 0;
    for (const recip of _selectedRecipients) {
      const recipUser = allUsers.find(u => u.__backendId === recip.id);
      if (!recipUser) continue;
      const recCompanyId = recipUser.company_id || currentUser.company_id;
      const { isOk, error } = await window.recognitionSdk.sendAs(
        currentUser.__backendId, recipUser.__backendId, points, selectedProgram, finalMessage, recCompanyId, isPrivate
      );
      if (isOk) {
        sentCount++;
        sendBtn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando (${sentCount}/${n})...`;
        lucide.createIcons();
      } else {
        _log('sendAs error for', recip.name, error);
      }
    }

    if (sentCount === 0) {
      // Revert pre-credit if nothing was sent
      if (pointsOn && usingBudget && selectedProg?.custom && points > 0) {
        await window.dataSdk.update(currentUser);
      }
      showErrorToast('Error al enviar el reconocimiento');
      return;
    }

    // Descontar puntos según la fuente (based on how many actually sent)
    if (pointsOn && points > 0) {
      if (usingBudget && selectedProg?.custom) {
        _deductProgramBudget(selectedProg.id, points * sentCount);
        // Revert any over-credited points if some sends failed
        if (sentCount < n) {
          const diff = (n - sentCount) * points;
          currentUser.points_to_give += diff;
          await window.dataSdk.update(currentUser);
        }
      } else {
        currentUser.points_to_give -= points * sentCount;
      }
    }

    // NOTE: recognition notifications are created by the DB RPC (send_recognition_as).
    // Do NOT call sendRecognitionNotifications here — it would create a duplicate.

    await window.dataSdk.refresh();
    updateAllPointsDisplays();
    _incrementWeeklyRecap();
    await renderFeed(true);
    loadHomeSidebar();
    loadNotifications();
    closeModal();
    renderRecognitionBattery();
    const plural = sentCount > 1 ? `a ${sentCount} personas` : `a ${_selectedRecipients[0]?.name}`;
    const successMsg = (usingBudget && selectedProg?.custom)
      ? `¡Reconocimiento enviado ${plural}! -${points * sentCount} puntos del programa`
      : `¡Reconocimiento enviado ${plural}!`;
    showSuccessToast(successMsg);
  } catch (err) {
    _log('Error sending recognition:', err);
    showErrorToast('Error al enviar reconocimiento');
  } finally {
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span id="next-text">Enviar</span>';
  }
}

function updateAllPointsDisplays() {
  if (!currentUser) return;
  const toGive   = currentUser.points_to_give;
  const toRedeem = currentUser.points_to_redeem;

  const giveEl   = document.getElementById('pts-give');
  const redeemEl = document.getElementById('pts-redeem');
  if (giveEl)   giveEl.textContent   = toGive;
  if (redeemEl) redeemEl.textContent = toRedeem;

  const pGive   = document.getElementById('profile-points-give');
  const pRedeem = document.getElementById('profile-points-redeem');
  if (pGive)   pGive.textContent   = toGive;
  if (pRedeem) pRedeem.textContent = toRedeem;

  lucide.createIcons();
}

function updatePointsDisplay() { updateAllPointsDisplays(); }

function _weeklyKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `weekly_v1_${currentUser?.email || 'anon'}_${d.getFullYear()}_W${week}`;
}

function _getWeeklyData() {
  try {
    const raw = localStorage.getItem(_weeklyKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old 7-day arrays to 5-day
      if (parsed.days && parsed.days.length > 5) parsed.days = parsed.days.slice(0, 5);
      return parsed;
    }
  } catch (_) {}
  return { days: [false, false, false, false, false], count: 0 };
}

function _saveWeeklyData(data) {
  try { localStorage.setItem(_weeklyKey(), JSON.stringify(data)); } catch (_) {}
}

function _todayIndex() {
  const d = (new Date().getDay() + 6) % 7; // 0=L … 6=D
  return d < 5 ? d : null; // null on weekends
}

const WEEKLY_LABELS = ['L', 'M', 'X', 'J', 'V'];
const WEEKLY_DAY_PHRASES = [
  'Sin días activos aún',
  '1 día activo 🕑',
  '2 días activos 🌱',
  '3 días activos 🚀',
  '4 días activos 💪',
  '¡Semana perfecta! 🌟',
];

function renderWeeklyRecap() {
  const textEl = document.getElementById('weekly-recap-text');
  const barsEl = document.getElementById('weekly-recap-bars');
  if (!textEl || !barsEl) return;
  const data       = _getWeeklyData();
  const today      = _todayIndex(); // null on weekends
  const activeDays = (data.days || []).filter(Boolean).length;
  textEl.textContent = WEEKLY_DAY_PHRASES[Math.min(activeDays, WEEKLY_DAY_PHRASES.length - 1)];
  barsEl.innerHTML = WEEKLY_LABELS.map((label, i) => {
    const filled  = data.days[i];
    const isToday = i === today;
    const bar = filled
      ? 'w-full h-5 rounded-sm bg-[#e8588a]'
      : isToday
        ? 'w-full h-5 rounded-sm bg-pink-50 border border-pink-200'
        : 'w-full h-5 rounded-sm bg-gray-100';
    return `<div class="flex flex-col items-center gap-1 flex-1">
      <div class="${bar}"></div>
      <span class="text-[9px] font-medium ${filled ? 'text-[#e8588a]' : isToday ? 'text-pink-300' : 'text-gray-300'}">${label}</span>
    </div>`;
  }).join('');
}

function _incrementWeeklyRecap() {
  if (!currentUser) return;
  const todayIdx = _todayIndex();
  if (todayIdx === null) return; // weekend — don't track
  const data  = _getWeeklyData();
  data.days[todayIdx] = true;
  data.count = (data.count || 0) + 1;
  _saveWeeklyData(data);
  renderWeeklyRecap();
}

function toggleReaction(btn, emoji) {
  if (!currentUser) return;
  const countEl = btn.querySelector('.count');
  let n = parseInt(countEl.textContent);
  if (btn.classList.contains('reacted')) {
    n--; btn.classList.remove('reacted'); btn.style.fontWeight = '';
  } else {
    n++; btn.classList.add('reacted'); btn.style.fontWeight = '700';
  }
  countEl.textContent = n;

  const recognitionId = btn.closest('article')?.dataset.recognitionId;
  if (recognitionId) {
    window.recognitionSdk.toggleReaction(recognitionId, emoji, currentUser.__backendId);
  }
}

function parseCommentMessage(message) {
  if (!message) return { text: '', imgs: [] };
  const lines = message.split('\n');
  const imgs = [], textLines = [];
  for (const line of lines) {
    const t = line.trim();
    // Match image URLs: extension, Supabase storage, or known image CDNs
    if (/^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(t) ||
        /^https?:\/\/\S+\/storage\/v1\/object\/public\/\S+$/i.test(t) ||
        /^https?:\/\/images\.unsplash\.com\/\S+$/i.test(t) ||
        /^https?:\/\/\S+\?(.*&)?(fit=crop|auto=format|fm=jpg|fm=png)(&.*)?$/i.test(t)) {
      imgs.push(t);
    } else if (t) {
      textLines.push(t);
    }
  }
  return { text: textLines.join('\n'), imgs };
}

function selectCommentImage(input) {
  const section = input.closest('.comments-section');
  const preview = section.querySelector('.comment-img-preview');
  const file    = input.files[0];
  if (!file) { preview.innerHTML = ''; preview.classList.add('hidden'); return; }
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<div class="relative inline-block">
    <img src="${url}" class="h-16 rounded-lg object-cover border border-gray-200">
    <button onclick="clearCommentImage(this)" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none">×</button>
  </div>`;
  preview.classList.remove('hidden');
}

function clearCommentImage(btn) {
  const section = btn.closest('.comments-section');
  section.querySelector('input[type="file"]').value = '';
  const preview = section.querySelector('.comment-img-preview');
  preview.innerHTML = '';
  preview.classList.add('hidden');
}

function loadMoreComments(btn) {
  const card   = btn.closest('article');
  const list   = card.querySelector('.comments-list');
  const all    = JSON.parse(card.dataset.allComments || '[]');
  const shown  = parseInt(card.dataset.shownComments || '0');
  const rest   = all.slice(shown);

  rest.forEach(c => {
    const ci      = esc((c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase());
    const time    = c.created_at ? formatTimeAgo(c.created_at) : '';
    const isOwner = c.user?.id && currentUser?.__backendId && c.user.id === currentUser.__backendId;
    const div  = document.createElement('div');
    div.className = 'flex items-start gap-2.5';
    if (c.id) div.dataset.commentId = c.id;
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
      <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-700">${esc(c.user?.name || 'Usuario')}</p>
          <div class="flex items-center gap-1.5 shrink-0">
            ${time ? `<span class="text-[10px] text-gray-400">${time}</span>` : ''}
            ${isOwner && c.id ? `<button onclick="deleteComment('${esc(c.id)}',this)" class="text-gray-300 hover:text-red-400 transition" title="Eliminar comentario"><i data-lucide="x" class="w-3 h-3"></i></button>` : ''}
          </div>
        </div>
        ${(() => { const { text, imgs } = parseCommentMessage(c.message); return (text ? `<p class="text-xs text-gray-600 mt-0.5">${esc(text)}</p>` : '') + imgs.map(u => `<img src="${esc(u)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join(''); })()}
      </div>`;
    list.appendChild(div);
  });

  card.dataset.shownComments = all.length;
  btn.innerHTML = '<i data-lucide="chevron-up" class="w-3 h-3"></i> Colapsar';
  btn.setAttribute('onclick', 'loadLessComments(this)');
  if (window.lucide) lucide.createIcons({ nodes: [btn] });
}

function loadLessComments(btn) {
  const INIT  = 3;
  const card  = btn.closest('article');
  const list  = card.querySelector('.comments-list');
  const all   = JSON.parse(card.dataset.allComments || '[]');

  const items = list.querySelectorAll(':scope > div');
  for (let i = items.length - 1; i >= INIT; i--) {
    items[i].remove();
  }

  card.dataset.shownComments = INIT;
  const hidden = all.length - INIT;
  btn.innerHTML = `<i data-lucide="chevron-down" class="w-3 h-3"></i> Ver ${hidden} comentario${hidden !== 1 ? 's' : ''} más`;
  btn.setAttribute('onclick', 'loadMoreComments(this)');
  if (window.lucide) lucide.createIcons({ nodes: [btn] });
}

async function deleteComment(commentId, btn) {
  const commentEl = btn.closest('[data-comment-id], .flex.items-start');
  const card      = btn.closest('article');

  // Optimistic removal
  if (commentEl) commentEl.remove();

  // Update counters and dataset
  if (card) {
    const countSpan = card.querySelector('.comment-count');
    if (countSpan) countSpan.textContent = Math.max(0, (parseInt(countSpan.textContent) || 1) - 1);

    const allC = JSON.parse(card.dataset.allComments || '[]');
    const idx  = commentId ? allC.findIndex(c => c.id === commentId) : -1;
    if (idx !== -1) allC.splice(idx, 1);
    card.dataset.allComments  = JSON.stringify(allC);
    const shownNow = card.querySelectorAll('.comments-list > div').length;
    card.dataset.shownComments = shownNow;

    // If shown ≤ COMMENTS_INITIAL, hide or update the collapse button
    const CINIT  = 3;
    const verBtn = card.querySelector('.ver-mas-comments');
    if (verBtn) {
      const hidden = allC.length - shownNow;
      if (allC.length <= CINIT) {
        verBtn.remove();
      } else if (hidden > 0) {
        verBtn.innerHTML = `<i data-lucide="chevron-down" class="w-3 h-3"></i> Ver ${hidden} comentario${hidden !== 1 ? 's' : ''} más`;
        verBtn.setAttribute('onclick', 'loadMoreComments(this)');
        if (window.lucide) lucide.createIcons({ nodes: [verBtn] });
      }
    }
  }

  if (!commentId || !window.recognitionSdk?.deleteComment) return;
  const { isOk } = await window.recognitionSdk.deleteComment(commentId);
  if (!isOk) showErrorToast('No se pudo eliminar el comentario');
}

async function addComment(btn) {
  const card       = btn.closest('article');
  const input      = card.querySelector('.comment-editable');
  const text       = (input?.innerText || input?.textContent || '').trim();
  const fileInput  = card.querySelector('input[type="file"]');
  const file       = fileInput?.files[0] || null;

  if (!text && !file) return;
  if (!currentUser) return;

  let container = card.querySelector('.comments-list');
  if (!container) {
    container = document.createElement('div');
    container.className = 'px-4 pt-3 pb-1 space-y-3 comments-list';
    card.querySelector('.comments-section').before(container);
  }

  const initials    = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 1);
  const avatarColor = getAvatarColor(currentUser.name);
  const localImgUrl = file ? URL.createObjectURL(file) : null;

  const newComment = document.createElement('div');
  newComment.className = 'flex items-start gap-2.5';
  newComment.innerHTML = `
    <div class="w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0">${esc(initials)}</div>
    <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold text-gray-700">${esc(currentUser.name)}</p>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] text-gray-400">Ahora</span>
          <button onclick="deleteComment(null,this)" class="text-gray-300 hover:text-red-400 transition" title="Eliminar comentario"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>
      </div>
      ${text ? `<p class="text-xs text-gray-600 mt-0.5">${esc(text)}</p>` : ''}
      ${localImgUrl ? `<img src="${esc(localImgUrl)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">` : ''}
    </div>`;
  container.appendChild(newComment);

  // Once the server returns the real comment id, attach it to the DOM node
  (async () => {
    const recognitionId = card.dataset.recognitionId;
    if (!recognitionId) return;
    let remoteImgUrl = null;
    if (file && window.storageSdk) {
      const result = await window.storageSdk.uploadCommentImage(file);
      if (result.isOk) remoteImgUrl = result.url;
    }
    const fullMessage = [text, remoteImgUrl].filter(Boolean).join('\n');
    if (fullMessage) {
      const { isOk, data } = await window.recognitionSdk.addComment(recognitionId, currentUser.__backendId, fullMessage);
      if (!isOk) {
        // Save failed — roll back the optimistic comment and tell the user
        newComment.remove();
        const countSpan = card.querySelector('.comment-count');
        if (countSpan) countSpan.textContent = Math.max(0, (parseInt(countSpan.textContent) || 1) - 1);
        const allCRollback = JSON.parse(card.dataset.allComments || '[]');
        allCRollback.pop();
        card.dataset.allComments = JSON.stringify(allCRollback);
        card.dataset.shownComments = Math.max(0, (parseInt(card.dataset.shownComments || '1') || 1) - 1);
        showErrorToast('No se pudo guardar el comentario. Intentá de nuevo.');
        return;
      }
      if (data?.id) {
        newComment.dataset.commentId = data.id;
        const delBtn = newComment.querySelector('button[onclick*="deleteComment"]');
        if (delBtn) delBtn.setAttribute('onclick', `deleteComment('${data.id}',this)`);
        const allC2 = JSON.parse(card.dataset.allComments || '[]');
        const last = allC2[allC2.length - 1];
        if (last && !last.id) { last.id = data.id; last.user = { id: currentUser.__backendId, name: currentUser.name }; }
        card.dataset.allComments = JSON.stringify(allC2);
      }
    }
  })();


  // Keep allComments dataset in sync so collapse/expand stays consistent
  const allC = JSON.parse(card.dataset.allComments || '[]');
  allC.push({ user: { name: currentUser.name }, message: text || '', created_at: new Date().toISOString() });
  card.dataset.allComments = JSON.stringify(allC);
  const newShown = (parseInt(card.dataset.shownComments || '0') || 0) + 1;
  card.dataset.shownComments = newShown;

  // If now more than 3 visible, show/update the collapse button
  const CINIT = 3;
  if (newShown > CINIT) {
    const verMasBtn = card.querySelector('.ver-mas-comments');
    if (verMasBtn) {
      verMasBtn.innerHTML = '<i data-lucide="chevron-up" class="w-3 h-3"></i> Colapsar';
      verMasBtn.setAttribute('onclick', 'loadLessComments(this)');
    } else {
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'ver-mas-comments text-xs text-violet-500 hover:text-violet-700 font-medium px-4 pb-2 transition flex items-center gap-1';
      collapseBtn.setAttribute('onclick', 'loadLessComments(this)');
      collapseBtn.innerHTML = '<i data-lucide="chevron-up" class="w-3 h-3"></i> Colapsar';
      container.after(collapseBtn);
    }
  }

  if (input) input.innerHTML = '';
  if (fileInput) fileInput.value = '';
  const preview = card.querySelector('.comment-img-preview');
  if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }

  const scrollEl = card.closest('.overflow-y-auto') || document.querySelector('main');
  if (scrollEl) setTimeout(() => {
    const cardRect = card.getBoundingClientRect();
    const scrollRect = scrollEl.getBoundingClientRect();
    if (cardRect.bottom > scrollRect.bottom) {
      scrollEl.scrollBy({ top: cardRect.bottom - scrollRect.bottom + 16, behavior: 'smooth' });
    }
  }, 50);

  const countSpan = card.querySelector('.comment-count');
  if (countSpan) countSpan.textContent = (parseInt(countSpan.textContent) || 0) + 1;

  // Sync all other cards in the DOM that show the same recognition
  const recId = card.dataset.recognitionId;
  if (recId) {
    document.querySelectorAll(`article[data-recognition-id="${recId}"]`).forEach(otherCard => {
      if (otherCard === card) return;
      const otherCount = otherCard.querySelector('.comment-count');
      if (otherCount) otherCount.textContent = (parseInt(otherCount.textContent) || 0) + 1;
      // Mirror the new comment into the other card's comments list
      const otherSection = otherCard.querySelector('.comments-section');
      if (otherSection) {
        let otherList = otherCard.querySelector('.comments-list');
        if (!otherList) {
          otherList = document.createElement('div');
          otherList.className = 'px-4 pt-3 pb-1 space-y-3 comments-list';
          otherSection.before(otherList);
        }
        otherList.appendChild(newComment.cloneNode(true));
      }
    });
  }

  lucide.createIcons();
}

function switchPage(page) {
  currentPage = page;

  // Cerrar cualquier página overlay abierta
  ['admin-page', 'analytics-page', 'store-page', 'profile-page', 'notifications-page', 'programs-page', 'approvals-page', 'points-page'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
  });
  destroyCharts();

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active', 'text-violet-600', 'bg-violet-50');
    link.classList.add('text-gray-600', 'hover:bg-gray-50');
  });

  const activeLink = page === 'home'
    ? document.querySelector('.nav-link[onclick*="home"]')
    : page === 'feed'
    ? document.querySelector('.nav-link[onclick*="feed"]')
    : null;

  if (activeLink) {
    activeLink.classList.add('active', 'text-violet-600', 'bg-violet-50');
    activeLink.classList.remove('text-gray-600', 'hover:bg-gray-50');
  }

  const homeStrip    = document.getElementById('home-strip');
  const homeRightCol = document.getElementById('home-right-col');
  const quickRecognize = document.getElementById('quick-recognize');
  const isHome = page !== 'feed';

  if (homeStrip)     homeStrip.style.display     = isHome ? '' : 'none';
  if (homeRightCol)  homeRightCol.style.display  = isHome ? '' : 'none';
  if (quickRecognize) quickRecognize.style.display = 'flex';
  const feedCol = document.getElementById('feed-col');
  if (feedCol) feedCol.style.flex = isHome ? '0 1 58%' : '1 1 auto';

  if (isHome) renderWeeklyRecap();

  if (page === 'store') openStore();
  else if (page === 'programs') openProgramsPage();
  else if (page === 'approvals') openApprovalsPage();
  else if (page === 'points') openPointsPage();
}

const defaultConfig = {
  platform_name:         'Allay',
  welcome_message:       '¡Hola, María!',
  recognize_button_text: 'Reconocer',
  store_button_text:     'Ir al Store',
  empty_state_text:      '¡Sé el primero en reconocer a alguien!',
  background_color:      '#f9fafb',
  surface_color:         '#ffffff',
  text_color:            '#1f2937',
  primary_color:         '#7c3aed',
  accent_color:          '#ec4899',
  font_family:           'Plus Jakarta Sans',
  font_size:             14
};

function applyConfig(config) {
  const c = { ...defaultConfig, ...config };
  const logo = document.getElementById('logo-text');
  if (logo) logo.textContent = c.platform_name;
  const welcome = document.getElementById('welcome-text');
  if (welcome && isLoggedIn) welcome.textContent = c.welcome_message + ' 👋';
  const recognizeBtn = document.getElementById('recognize-btn-text');
  if (recognizeBtn) recognizeBtn.textContent = c.recognize_button_text;
  const storeBtn = document.getElementById('store-btn-text');
  if (storeBtn) storeBtn.textContent = c.store_button_text;
  document.body.style.backgroundColor = c.background_color;
  document.body.style.color            = c.text_color;
  document.body.style.fontFamily       = c.font_family + ', Plus Jakarta Sans, sans-serif';
  const base = c.font_size || 14;
  document.querySelectorAll('article p.text-sm, .feed-card p.text-sm').forEach(el => el.style.fontSize = base + 'px');
  document.querySelectorAll('h2, h3').forEach(el => el.style.fontSize = (base * 1.3) + 'px');
}

window.elementSdk.init({
  defaultConfig,
  onConfigChange: async (config) => applyConfig(config),
  mapToCapabilities: (config) => {
    const c = { ...defaultConfig, ...config };
    function colorMut(key) {
      return {
        get: () => c[key] || defaultConfig[key],
        set: (v) => { c[key] = v; window.elementSdk.setConfig({ [key]: v }); }
      };
    }
    return {
      recolorables: [colorMut('background_color'), colorMut('surface_color'), colorMut('text_color'), colorMut('primary_color'), colorMut('accent_color')],
      borderables:  [],
      fontEditable: { get: () => c.font_family, set: (v) => { c.font_family = v; window.elementSdk.setConfig({ font_family: v }); } },
      fontSizeable: { get: () => c.font_size,   set: (v) => { c.font_size   = v; window.elementSdk.setConfig({ font_size:   v }); } }
    };
  },
  mapToEditPanelValues: (config) => {
    const c = { ...defaultConfig, ...config };
    return new Map([
      ['platform_name',         c.platform_name],
      ['welcome_message',       c.welcome_message],
      ['recognize_button_text', c.recognize_button_text],
      ['store_button_text',     c.store_button_text],
      ['empty_state_text',      c.empty_state_text]
    ]);
  }
});

// ------------------------------------------------------------
// ------------------------------------------------------------
const FEED_LIMIT = 10;

let _feedRealtimeChannel     = null;
let _feedRefreshTimer        = null;
let _feedRealtimeSetupId     = 0;
let _commentsRealtimeChannel = null;

function _debouncedFeedRefresh() {
  clearTimeout(_feedRefreshTimer);
  _feedRefreshTimer = setTimeout(() => {
    if (currentPage === 'home') {
      renderFeed(true);
      loadHomeSidebar();
    }
  }, 600);
}

function _setupFeedRealtime() {
  // Cancel any in-flight setup
  _feedRealtimeSetupId++;
  const myId = _feedRealtimeSetupId;

  // Tear down the old channel synchronously before subscribing to the new one
  if (_feedRealtimeChannel) {
    window.recognitionSdk.unsubscribeChannel(_feedRealtimeChannel);
    _feedRealtimeChannel = null;
  }

  // If another setup call arrived while we were cleaning up, bail out
  if (myId !== _feedRealtimeSetupId) return;

  const companyId = (currentUser?.role === 'superadmin' && !isImpersonating)
    ? null
    : currentUser?.company_id;

  _feedRealtimeChannel = window.recognitionSdk.subscribeToNew(companyId, _debouncedFeedRefresh);
}

function _setupCommentsRealtime() {
  if (_commentsRealtimeChannel) {
    window.recognitionSdk.unsubscribeChannel(_commentsRealtimeChannel);
    _commentsRealtimeChannel = null;
  }
  _commentsRealtimeChannel = window.recognitionSdk.subscribeToComments(_handleRealtimeComment);
}

function _handleRealtimeComment(payload) {
  const c = payload.new;
  if (!c) return;
  // Skip own comments — already shown via the optimistic update in addComment()
  if (c.user_id === currentUser?.__backendId) return;

  const author = allUsers.find(u => u.__backendId === c.user_id);
  const commentObj = {
    id: c.id,
    message: c.message,
    created_at: c.created_at,
    user: { id: c.user_id, name: author?.name || 'Usuario' },
  };

  // Update every rendered card that matches (feed + modal)
  document.querySelectorAll(`[data-recognition-id="${c.recognition_id}"]`).forEach(card => {
    _appendCommentToCard(card, commentObj);
  });
}

function _appendCommentToCard(card, c) {
  const { text: msgText, imgs } = parseCommentMessage(c.message);
  const imgHtml = imgs.map(u => `<img src="${esc(u)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join('');
  const ci = esc((c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase());
  const isOwner = c.user?.id && currentUser?.__backendId && c.user.id === currentUser.__backendId;

  let container = card.querySelector('.comments-list');
  if (!container) {
    container = document.createElement('div');
    container.className = 'px-4 pt-3 pb-1 space-y-3 comments-list';
    const section = card.querySelector('.comments-section');
    if (section) section.before(container);
    else card.appendChild(container);
  }

  const div = document.createElement('div');
  div.className = 'flex items-start gap-2.5';
  if (c.id) div.dataset.commentId = c.id;
  div.innerHTML = `
    <div class="w-7 h-7 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
    <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold text-gray-700">${esc(c.user?.name || 'Usuario')}</p>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] text-gray-400">${c.created_at ? formatTimeAgo(c.created_at) : 'Ahora'}</span>
          ${isOwner && c.id ? `<button onclick="deleteComment('${esc(c.id)}',this)" class="text-gray-300 hover:text-red-400 transition" title="Eliminar comentario"><i data-lucide="x" class="w-3 h-3"></i></button>` : ''}
        </div>
      </div>
      ${msgText ? `<p class="text-xs text-gray-600 mt-0.5">${esc(msgText)}</p>` : ''}
      ${imgHtml}
    </div>`;
  container.appendChild(div);

  const allC = JSON.parse(card.dataset.allComments || '[]');
  allC.push(c);
  card.dataset.allComments = JSON.stringify(allC);
  card.dataset.shownComments = (parseInt(card.dataset.shownComments || '0') || 0) + 1;

  const countSpan = card.querySelector('.comment-count');
  if (countSpan) countSpan.textContent = (parseInt(countSpan.textContent) || 0) + 1;

  if (window.lucide) lucide.createIcons({ nodes: [div] });
}

const PROGRAM_COLORS = {
  '🏆 Trabajo en Equipo': 'bg-[#3d2b56]',
  '🎯 Liderazgo': 'bg-[#3d2b56]',
  '💡 Innovación': 'bg-[#c9a7d4]',
  '🤝 Colaboración': 'bg-[#f19ac4]',
  '⭐ Actitud':                   'bg-[#f19ac4]',
  '✅ Cumplimiento de objetivos': 'bg-[#c9a7d4]',
};
const AVATAR_COLORS = ['bg-[#3d2b56]', 'bg-[#f19ac4]', 'bg-[#c9a7d4]'];

function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60)    return 'Ahora';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} días`;
}

function _getProgramByLabel(label) {
  return companyPrograms.find(p => `${p.emoji} ${p.name}` === label) || null;
}

const _PRIVATE_MARKER = '[allay_private]';

function _isPrivateRec(rec) {
  return rec.is_private === true || (rec.message || '').includes(_PRIVATE_MARKER);
}

function _cleanPrivateMarker(msg) {
  return (msg || '').replace(/\n?\[allay_private\]/g, '').trim();
}

function _canViewRecognition(rec) {
  if (!_isPrivateRec(rec)) return true;
  const uid  = currentUser?.__backendId;
  const role = currentUser?.role;
  return rec.from_user?.id === uid
    || rec.to_user?.id     === uid
    || role === 'admin'
    || role === 'superadmin';
}

function buildFeedCard(rec) {
  const fromUserProfile = allUsers.find(u => u.__backendId === rec.from_user?.id);
  const isAutoRec = fromUserProfile
    && ['admin', 'superadmin'].includes(fromUserProfile.role)
    && (rec.program?.startsWith('🎂') || rec.program?.startsWith('🎉'));
  let senderName;
  if (isAutoRec && rec.company_id) {
    const co = (_companiesData || []).find(c => c.id === rec.company_id)
            || companies.find(c => c.id === rec.company_id);
    senderName = co?.name || rec.from_user?.name || 'Desconocido';
  } else {
    senderName = rec.from_user?.name || rec.from_user_name || 'Desconocido';
  }
  const senderInactive = !rec.from_user && !!rec.from_user_name;
  const initials       = esc(senderName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2));
  const avatarColor    = rec.from_user ? AVATAR_COLORS[senderName.length % AVATAR_COLORS.length] : 'bg-gray-300';
  const gradient       = PROGRAM_COLORS[rec.program] || 'bg-[#3d2b56]';
  const programData    = _getProgramByLabel(rec.program);

  // Parse multi-recipient group marker
  const groupData = _parseGroupMarker(rec.message);
  const rawMessage   = _cleanPrivateMarker(rec.message || '');
  const groupIdx    = rawMessage ? rawMessage.indexOf('\n' + _GROUP_PREFIX) : -1;
  const cleanMessage = groupIdx !== -1 ? rawMessage.slice(0, groupIdx) : rawMessage;
  const toName = rec.to_user?.name || rec.to_user_name || 'Desconocido';
  const toInactive = !rec.to_user && !!rec.to_user_name;
  const recipientNames = groupData?.recipients?.map(r => r.name) || [toName];
  const recipientDisplay = recipientNames.length === 1
    ? recipientNames[0]
    : recipientNames.length === 2
      ? recipientNames.join(' y ')
      : recipientNames.length <= 4
        ? recipientNames.slice(0, -1).join(', ') + ' y ' + recipientNames[recipientNames.length - 1]
        : recipientNames.slice(0, 3).join(', ') + ` y ${recipientNames.length - 3} más`;

  const reactionMap = {};
  (rec.reactions || []).forEach(r => {
    if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, mine: false };
    reactionMap[r.emoji].count++;
    if (r.user_id === currentUser?.__backendId) reactionMap[r.emoji].mine = true;
  });

  const rBtn = (emoji, hover) => {
    const d = reactionMap[emoji] || { count: 0, mine: false };
    return `<button class="reaction-btn ${d.mine ? 'reacted' : ''} flex items-center gap-1.5 text-sm text-gray-500 ${hover} transition" style="${d.mine ? 'font-weight:700' : ''}" onclick="toggleReaction(this,'${emoji}')"><span class="text-base">${emoji}</span><span class="count">${d.count}</span></button>`;
  };

  const COMMENTS_INITIAL = 3;
  const allComments      = rec.comments || [];

  const buildCommentHtml = (c) => {
    const ci      = esc((c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase());
    const time    = c.created_at ? formatTimeAgo(c.created_at) : '';
    const isOwner = c.user?.id && currentUser?.__backendId && c.user.id === currentUser.__backendId;
    const { text: msgText, imgs } = parseCommentMessage(c.message);
    const imgHtml = imgs.map(u => `<img src="${esc(u)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join('');
    return `<div class="flex items-start gap-2.5" data-comment-id="${esc(c.id || '')}">
      <div class="w-7 h-7 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
      <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-700">${esc(c.user?.name || 'Usuario')}</p>
          <div class="flex items-center gap-1.5 shrink-0">
            ${time ? `<span class="text-[10px] text-gray-400">${time}</span>` : ''}
            ${isOwner && c.id ? `<button onclick="deleteComment('${esc(c.id)}',this)" class="text-gray-300 hover:text-red-400 transition" title="Eliminar comentario"><i data-lucide="x" class="w-3 h-3"></i></button>` : ''}
          </div>
        </div>
        ${msgText ? `<p class="text-xs text-gray-600 mt-0.5">${esc(msgText)}</p>` : ''}
        ${imgHtml}
      </div>
    </div>`;
  };

  const visibleComments  = allComments.slice(0, COMMENTS_INITIAL);
  const hiddenCount      = allComments.length - visibleComments.length;
  const commentsHtml     = visibleComments.map(buildCommentHtml).join('');
  const verMasHtml       = hiddenCount > 0
    ? `<button class="ver-mas-comments text-xs text-violet-500 hover:text-violet-700 font-medium px-4 pb-2 transition flex items-center gap-1" onclick="loadMoreComments(this)"><i data-lucide="chevron-down" class="w-3 h-3"></i> Ver ${hiddenCount} comentario${hiddenCount !== 1 ? 's' : ''} más</button>`
    : '';

  const card = document.createElement('article');
  card.className = 'feed-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition';
  card.style.animation = 'slideUp 0.4s ease both';
  card.dataset.recognitionId = rec.id;
  card.dataset.recId = rec.id;
  card.dataset.allComments   = JSON.stringify(allComments);
  card.dataset.shownComments = visibleComments.length;
  const bannerHtml = programData?.image
    ? `<div class="w-full h-36 overflow-hidden">
         <img src="${esc(programData.image)}" class="w-full h-full object-cover" alt="${esc(programData.name)}">
       </div>`
    : '';

  const pointsBadgeHtml2 = rec.points > 0
    ? `<span class="points-badge ${gradient} text-white text-xs font-bold px-2.5 py-1 rounded-full">+${Number(rec.points)} puntos</span>`
    : '';

  const { text: msgText, imgs: msgImgs } = parseCommentMessage(cleanMessage);
  const recogImgHtml = msgImgs.length > 0
    ? `<img src="${esc(msgImgs[0])}" class="w-full rounded-xl object-cover max-h-60 mb-3 border border-gray-100" loading="lazy">`
    : '';

  card.innerHTML = `
    ${bannerHtml}
    <div class="p-5">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold shrink-0">${initials}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm">${
            senderInactive || !rec.from_user?.id
              ? `<span class="font-bold text-gray-800">${esc(senderName)}</span>${senderInactive ? ' <span class="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full align-middle">inactivo</span>' : ''}`
              : `<button onclick="openPeekById('${rec.from_user.id}')" class="font-bold text-gray-800 hover:text-violet-600 transition">${esc(senderName)}</button>`
          } <span class="text-gray-400">reconoció a</span> ${
            toInactive || !rec.to_user?.id
              ? `<span class="font-bold text-violet-600">${esc(toInactive ? toName : recipientDisplay)}</span>${toInactive ? ' <span class="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full align-middle">inactivo</span>' : ''}`
              : groupData
                ? `<span class="font-bold text-violet-600">${esc(recipientDisplay)}</span>`
                : `<button onclick="openPeekById('${rec.to_user.id}')" class="font-bold text-violet-600 hover:text-violet-800 transition">${esc(recipientDisplay)}</button>`
          }</p>
          <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1 flex-wrap"><i data-lucide="clock" class="w-3 h-3 shrink-0"></i> ${formatTimeAgo(rec.created_at)} · <span class="text-violet-500 font-medium">${esc(rec.program)}</span>${programData?.tag ? `<span class="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">#${esc(programData.tag)}</span>` : ''}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${_isPrivateRec(rec) ? `<span class="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Privado</span>` : ''}
          ${pointsBadgeHtml2}
          ${currentUser?.role === 'superadmin' ? `<div class="feed-admin-menu relative">
            <button onclick="toggleFeedMenu(event,'${rec.id}')" class="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600 font-bold text-base leading-none">···</button>
            <div id="feedmenu-${rec.id}" class="hidden absolute right-0 top-7 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px] z-10">
              <button onclick="openDeleteRecognitionModal('${rec.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 shrink-0"></i> Eliminar
              </button>
            </div>
          </div>` : ''}
        </div>
      </div>
      ${recogImgHtml}<p class="text-sm text-gray-700 leading-relaxed">${esc(msgText || '')}</p>
    </div>
    <div class="bg-violet-50 px-5 py-3 flex items-center justify-between">
      <div class="flex gap-3">
        ${rBtn('❤️','hover:text-rosa-500')}
        ${rBtn('🎉','hover:text-violet-500')}
        ${rBtn('👏','hover:text-lila-500')}
      </div>
      <button class="flex items-center gap-1.5 text-sm text-gray-400 cursor-default"><i data-lucide="message-circle" class="w-4 h-4"></i> <span class="comment-count">${(rec.comments || []).length}</span></button>
    </div>
    ${allComments.length > 0 ? `<div class="border-t border-gray-100 px-4 pt-3 pb-1 space-y-3 comments-list">${commentsHtml}</div>${verMasHtml}` : ''}
    <div class="comments-section border-t border-gray-100">
      <div class="comment-img-preview px-4 pt-2 hidden"></div>
      <div class="px-4 py-3 flex gap-2 items-center">
        <label class="cursor-pointer p-1.5 rounded-full hover:bg-gray-100 transition text-gray-400 hover:text-violet-500 shrink-0">
          <input type="file" accept="image/*" class="hidden" onchange="selectCommentImage(this)">
          <i data-lucide="image" class="w-4 h-4"></i>
        </label>
        <div contenteditable="true" data-placeholder="Escribí un comentario..." class="comment-editable flex-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-2 focus:ring-2 focus:ring-violet-300 cursor-text overflow-hidden" onkeydown="if(event.key==='Enter'){event.preventDefault();this.closest('.comments-section').querySelector('.comment-send-btn').click();}"></div>
        <button class="comment-send-btn p-2 rounded-full bg-violet-500 text-white hover:bg-violet-600 transition shrink-0" onclick="addComment(this)"><i data-lucide="send" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>`;
  return card;
}

// ------------------------------------------------------------

function isSuperadmin() {
  return currentUser?.role === 'superadmin';
}


function toggleFeedMenu(e, id) {
  if (!isSuperadmin()) return;
  e.stopPropagation();
  const menu = document.getElementById(`feedmenu-${id}`);
  const isOpen = !menu.classList.contains('hidden');
  document.querySelectorAll('[id^="feedmenu-"]').forEach(m => m.classList.add('hidden'));
  if (!isOpen) menu.classList.remove('hidden');
}
document.addEventListener('click', () => {
  document.querySelectorAll('[id^="feedmenu-"]').forEach(m => m.classList.add('hidden'));
});

let _deletingRecognitionId = null;

function openDeleteRecognitionModal(id) {
  if (!isSuperadmin()) return;
  _deletingRecognitionId = id;
  document.getElementById('delete-recognition-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeDeleteRecognitionModal() {
  document.getElementById('delete-recognition-modal').classList.add('hidden');
  _deletingRecognitionId = null;
}

async function confirmDeleteRecognition() {
  if (!isSuperadmin()) { showErrorToast('Sin permisos para eliminar reconocimientos'); return; }
  if (!_deletingRecognitionId) return;
  try {
    const { isOk, error } = await window.recognitionSdk.delete(_deletingRecognitionId);
    if (!isOk) {
      closeDeleteRecognitionModal();
      showErrorToast('Error al eliminar: ' + (error || 'intenta de nuevo'));
      return;
    }
    closeDeleteRecognitionModal();
    await renderFeed(true);
    showSuccessToast('Reconocimiento eliminado');
  } catch (e) {
    closeDeleteRecognitionModal();
    showErrorToast('Error inesperado al eliminar');
    _log('confirmDeleteRecognition error:', e);
  }
}

async function renderFeed(reset = true) {
  const container = document.getElementById('feed-container');
  if (!container) return;

  if (reset) {
    feedOffset = 0;
    container.innerHTML = '<div class="text-center py-10"><i data-lucide="loader" class="w-8 h-8 animate-spin text-violet-400 mx-auto"></i></div>';
    lucide.createIcons();
  }

  const isSuperadminView = currentUser?.role === 'superadmin' && !isImpersonating;
  const companyFilter    = isSuperadminView ? null : currentUser?.company_id;

  // During impersonation use the edge function (bypasses RLS, already company-filtered).
  // The edge function does the filtering server-side, so we skip the client-side member check.
  const usingEdgeFn = isImpersonating && !!companyFilter;
  const { isOk, data: rawData } = usingEdgeFn
    ? await window.recognitionSdk.listForCompany(companyFilter, feedOffset, FEED_LIMIT)
    : await window.recognitionSdk.list(feedOffset, FEED_LIMIT, companyFilter);

  let data = rawData || [];

  // Use pre-computed Set (rebuilt only when allUsers changes, not on every render)
  if (!usingEdgeFn && companyFilter && _companyMemberIds) {
    data = data.filter(r => _companyMemberIds.has(r.from_user?.id));
  }

  if (reset) { container.innerHTML = ''; window._allRecognitions = []; }
  document.getElementById('load-more-feed')?.remove();

  if (!isOk) { container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Error al cargar el feed.</p>'; return; }

  window._allRecognitions = (window._allRecognitions || []).concat(data);
  if (data.length === 0 && feedOffset === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">¡Sé el primero en reconocer a alguien! 🎉</p>';
    return;
  }

  // Deduplicate multi-recipient groups (show only the first recognition per gid)
  const seenGids = new Set();
  const deduped  = data.filter(rec => {
    const g = _parseGroupMarker(rec.message);
    if (!g) return true;
    if (seenGids.has(g.gid)) return false;
    seenGids.add(g.gid);
    return true;
  });
  deduped.forEach(rec => {
    if (!_canViewRecognition(rec)) return;
    try { container.appendChild(buildFeedCard(rec)); }
    catch(e) { _log('[feed] buildFeedCard error:', e, rec); }
  });
  feedOffset += data.length;

  if (data.length === FEED_LIMIT) {
    const btn = document.createElement('button');
    btn.id = 'load-more-feed';
    btn.className = 'w-full py-3 text-sm font-medium text-violet-600 hover:text-violet-700 transition';
    btn.textContent = 'Cargar más';
    btn.onclick = () => renderFeed(false);
    container.appendChild(btn);
  }
  lucide.createIcons();
  // Auto-update connections if profile page is open
  const pp = document.getElementById('user-profile-page');
  if (pp && !pp.classList.contains('hidden')) _renderConnections();
}

// ------------------------------------------------------------
// ------------------------------------------------------------

async function loadNotifications() {
  // When impersonating, use the privileged endpoint to get the employee's notifications
  const result = isImpersonating && currentUser?.__backendId
    ? await window.notificationSdk.listForUser(currentUser.__backendId)
    : await window.notificationSdk.list();
  _notificationsData = result.data || [];
  updateNotificationBadge();
  if (currentPage === 'notifications') renderNotificationsPage();
  renderNotificationsDropdown();
}

function renderNotificationsDropdown() {
  const list = document.getElementById('notifications-list');
  if (!list) return;
  const recent = _notificationsData.slice(0, 5);
  if (recent.length === 0) {
    list.innerHTML = '<div class="p-6 text-center text-gray-400 text-sm">No hay notificaciones</div>';
    return;
  }
  list.innerHTML = recent.map(n => {
    const fromName = allUsers.find(u => u.__backendId === n.data?.from_user_id)?.name || 'Usuario eliminado';
    let icon, iconColor, text;
    if (n.type === 'recognition') {
      icon = 'heart'; iconColor = 'rose';
      text = `<span class="font-semibold">${esc(fromName)}</span> te reconoció (+${Number(n.data?.points)} puntos)`;
    } else if (n.type === 'reaction') {
      icon = 'smile'; iconColor = 'violet';
      text = `<span class="font-semibold">${esc(fromName)}</span> reaccionó ${esc(n.data?.emoji)} a tu reconocimiento`;
    } else if (n.type === 'program_approval_request') {
      icon = 'check-square'; iconColor = 'amber';
      text = `${n.data?.program_emoji || '🏆'} <span class="font-semibold">${esc(n.data?.requester_name)}</span> solicita aprobación para <strong>${esc(n.data?.program_name)}</strong> (${Number(n.data?.points)} puntos)`;
    } else if (n.type === 'program_approved') {
      icon = 'check-circle'; iconColor = 'green';
      text = `${n.data?.program_emoji || '🏆'} Tu programa <strong>${esc(n.data?.program_name)}</strong> fue aprobado por <span class="font-semibold">${esc(n.data?.approved_by)}</span>`;
    } else if (n.type === 'program_rejected') {
      icon = 'x-circle'; iconColor = 'red';
      text = `${n.data?.program_emoji || '🏆'} Tu solicitud de <strong>${esc(n.data?.program_name)}</strong> fue rechazada`;
    } else if (n.type === 'program_deleted_by_superadmin') {
      icon = 'shield-off'; iconColor = 'red';
      text = `El programa <strong>${esc(n.data?.program_name)}</strong> fue eliminado por <span class="font-semibold">${esc(n.data?.deleted_by)}</span>. Motivo: "${esc(n.data?.reason)}"${n.data?.refund_note ? ` <span class="text-green-600">${esc(n.data.refund_note)}</span>` : ''}`;
    } else if (n.type === 'points_purchase_request') {
      icon = 'coins'; iconColor = 'violet';
      text = `<span class="font-semibold">${esc(n.data?.requester_name || 'Admin')}</span> solicitó comprar <strong>${Number(n.data?.points || 0).toLocaleString('es-AR')} puntos</strong> para ${esc(n.data?.company_name || n.data?.company_id || 'su empresa')}`;
    } else if (n.type === 'points_purchase_approved') {
      icon = 'check-circle'; iconColor = 'green';
      text = `Tu solicitud de <strong>${Number(n.data?.points || 0).toLocaleString('es-AR')} puntos</strong> fue aprobada`;
    } else if (n.type === 'points_purchase_rejected') {
      icon = 'x-circle'; iconColor = 'red';
      text = `Tu solicitud de <strong>${Number(n.data?.points || 0).toLocaleString('es-AR')} puntos</strong> fue rechazada`;
    } else if (n.type === 'csv_request') {
      icon = 'file-up'; iconColor = 'amber';
      text = `<span class="font-semibold">${esc(n.data?.requester_name || 'Admin')}</span> solicitó cargar <strong>${n.data?.row_count || '?'} empleados</strong> (${esc(n.data?.file_name || 'CSV')})`;
    } else if (n.type === 'csv_approved') {
      icon = 'file-check'; iconColor = 'green';
      text = `Tu CSV <strong>${esc(n.data?.file_name || 'archivo')}</strong> fue aprobado — ${n.data?.ok_count || 0} empleados creados`;
    } else if (n.type === 'csv_rejected') {
      icon = 'file-x'; iconColor = 'red';
      text = `Tu CSV <strong>${esc(n.data?.file_name || 'archivo')}</strong> fue rechazado`;
    } else {
      icon = 'message-circle'; iconColor = 'blue';
      text = `<span class="font-semibold">${esc(fromName)}</span> comentó en tu reconocimiento`;
    }
    return `<div class="notif-item p-3 rounded-lg ${n.read ? '' : 'bg-violet-50'} hover:bg-gray-50 cursor-pointer transition border border-transparent hover:border-gray-200" onclick='handleNotificationClick(${JSON.stringify(n.id)})'>
      <div class="flex items-start gap-2.5">
        <div class="w-8 h-8 rounded-full bg-${iconColor}-100 flex items-center justify-center shrink-0 mt-0.5"><i data-lucide="${icon}" class="w-4 h-4 text-${iconColor}-500"></i></div>
        <div class="min-w-0 flex-1"><p class="text-xs text-gray-700">${text}</p><p class="text-[11px] text-gray-400 mt-0.5">${formatTimeAgo(n.created_at)}</p></div>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function renderNotificationsPage() {
  const container = document.getElementById('notifications-list-page');
  if (!container) return;
  const filtered = notificationsTab === 'unread'
    ? _notificationsData.filter(n => !n.read)
    : _notificationsData;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center py-16"><i data-lucide="inbox" class="w-16 h-16 mx-auto text-gray-300 mb-4"></i><p class="text-gray-500 font-medium">${notificationsTab === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}</p></div>`;
    lucide.createIcons(); return;
  }

  container.innerHTML = filtered.map(n => {
    const fromName = allUsers.find(u => u.__backendId === n.data?.from_user_id)?.name || 'Usuario eliminado';
    const unread = !n.read ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white';
    let avatarContent, text;
    if (n.type === 'recognition') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0">${esc((fromName[0] || '?').toUpperCase())}</div>`;
      text = `<span class="font-semibold">${esc(fromName)}</span> te reconoció con <strong>+${Number(n.data?.points)} puntos</strong> · ${esc(n.data?.program)}`;
    } else if (n.type === 'reaction') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0">${esc((fromName[0] || '?').toUpperCase())}</div>`;
      text = `<span class="font-semibold">${esc(fromName)}</span> reaccionó ${esc(n.data?.emoji)} a tu reconocimiento`;
    } else if (n.type === 'program_approval_request') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><i data-lucide="check-square" class="w-5 h-5 text-amber-500"></i></div>`;
      text = `${n.data?.program_emoji || '🏆'} <span class="font-semibold">${esc(n.data?.requester_name)}</span> solicita aprobación para el ${n.data?.is_recharge ? 'recarga del' : 'nuevo'} programa <strong>${esc(n.data?.program_name)}</strong> · ${Number(n.data?.points)} puntos`;
    } else if (n.type === 'program_approved') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><i data-lucide="check-circle" class="w-5 h-5 text-green-500"></i></div>`;
      text = `${n.data?.program_emoji || '🏆'} Tu ${n.data?.is_recharge ? 'recarga del' : 'nuevo'} programa <strong>${esc(n.data?.program_name)}</strong> fue aprobado por <span class="font-semibold">${esc(n.data?.approved_by)}</span>`;
    } else if (n.type === 'program_rejected') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><i data-lucide="x-circle" class="w-5 h-5 text-red-500"></i></div>`;
      text = `${n.data?.program_emoji || '🏆'} Tu solicitud del ${n.data?.is_recharge ? 'recarga del' : 'nuevo'} programa <strong>${esc(n.data?.program_name)}</strong> fue rechazada por <span class="font-semibold">${esc(n.data?.rejected_by)}</span>`;
    } else if (n.type === 'program_deleted_by_superadmin') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><i data-lucide="shield-off" class="w-5 h-5 text-red-500"></i></div>`;
      text = `El programa <strong>${esc(n.data?.program_name)}</strong> fue eliminado por <span class="font-semibold">${esc(n.data?.deleted_by)}</span>.<br><span class="text-gray-500">Motivo: "${esc(n.data?.reason)}"</span>${n.data?.refund_note ? `<br><span class="text-green-600 text-xs">${esc(n.data.refund_note)}</span>` : ''}`;
    } else if (n.type === 'points_purchase_request') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0"><i data-lucide="coins" class="w-5 h-5 text-violet-500"></i></div>`;
      text = `<span class="font-semibold">${esc(n.data?.requester_name || 'Admin')}</span> solicitó comprar <strong>${Number(n.data?.points || 0).toLocaleString('es-AR')} puntos</strong> para <strong>${esc(n.data?.company_name || n.data?.company_id || 'su empresa')}</strong>`;
    } else if (n.type === 'points_purchase_approved') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><i data-lucide="check-circle" class="w-5 h-5 text-green-500"></i></div>`;
      text = `Tu solicitud de <strong>${Number(n.data?.points || 0).toLocaleString('es-AR')} puntos</strong> fue aprobada. Los puntos se acreditarán a la brevedad.`;
    } else if (n.type === 'points_purchase_rejected') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><i data-lucide="x-circle" class="w-5 h-5 text-red-500"></i></div>`;
      text = `Tu solicitud de <strong>${Number(n.data?.points || 0).toLocaleString('es-AR')} puntos</strong> fue rechazada.`;
    } else if (n.type === 'csv_request') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><i data-lucide="file-up" class="w-5 h-5 text-amber-500"></i></div>`;
      text = `<span class="font-semibold">${esc(n.data?.requester_name || 'Admin')}</span> solicitó cargar <strong>${n.data?.row_count || '?'} empleados</strong> · ${esc(n.data?.file_name || 'CSV')} · ${esc(n.data?.company_id || '')}`;
    } else if (n.type === 'csv_approved') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><i data-lucide="file-check" class="w-5 h-5 text-green-500"></i></div>`;
      text = `Tu CSV <strong>${esc(n.data?.file_name || 'archivo')}</strong> fue aprobado — <strong>${n.data?.ok_count || 0}</strong> empleados creados${n.data?.fail_count > 0 ? `, ${n.data.fail_count} con errores` : ''}`;
    } else if (n.type === 'csv_rejected') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><i data-lucide="file-x" class="w-5 h-5 text-red-500"></i></div>`;
      text = `Tu CSV <strong>${esc(n.data?.file_name || 'archivo')}</strong> fue rechazado${n.data?.rejection_reason ? ` · <em>${esc(n.data.rejection_reason)}</em>` : ''}`;
    } else {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0">${esc((fromName[0] || '?').toUpperCase())}</div>`;
      text = `<span class="font-semibold">${esc(fromName)}</span> comentó en tu reconocimiento`;
    }
    const idJson = JSON.stringify(n.id);
    return `<div class="p-4 rounded-xl border ${unread} hover:shadow-md transition group">
      <div class="flex items-start gap-3">
        ${avatarContent}
        <div class="flex-1 min-w-0 cursor-pointer" onclick='handleNotificationClick(${idJson})'>
          <p class="text-sm text-gray-800">${text}</p>
          <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${formatTimeAgo(n.created_at)}</p>
        </div>
        <div class="flex gap-1 shrink-0">
          ${(n.type === 'points_purchase_request' && !n.read && n.data?.request_id) ? `
            <button onclick='event.stopPropagation(); rejectPointsPurchaseRequest(${JSON.stringify(n.data.request_id)}); markNotificationRead(${idJson})' class="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Rechazar</button>
            <button onclick='event.stopPropagation(); approvePointsPurchaseRequest(${JSON.stringify(n.data.request_id)}); markNotificationRead(${idJson})' class="px-2.5 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:opacity-90 transition">Aprobar</button>
          ` : ''}
          ${!n.read ? `<button onclick='event.stopPropagation(); markNotificationRead(${idJson})' class="p-1.5 rounded-lg hover:bg-violet-100 transition" title="Marcar como leída"><i data-lucide="check" class="w-3.5 h-3.5 text-violet-500"></i></button>` : ''}
          <button onclick='event.stopPropagation(); handleNotificationClick(${idJson})' class="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Ir al contenido"><i data-lucide="arrow-right" class="w-3.5 h-3.5 text-gray-400"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function closeRecognitionModal() {
  const modal = document.getElementById('recognition-detail-modal');
  modal.classList.add('hidden');
  delete modal.dataset.currentRecognitionId;
}

async function openRecognitionModal(recognitionId) {
  const modal = document.getElementById('recognition-detail-modal');
  const content = document.getElementById('recognition-detail-content');

  // If already showing this exact recognition, just ensure it's visible — don't wipe & re-fetch
  if (!modal.classList.contains('hidden') && modal.dataset.currentRecognitionId === String(recognitionId)) {
    return;
  }

  modal.dataset.currentRecognitionId = String(recognitionId);
  content.innerHTML = `<div class="bg-white rounded-2xl p-8 flex items-center justify-center"><i data-lucide="loader-2" class="w-6 h-6 text-violet-400 animate-spin"></i></div>`;
  modal.classList.remove('hidden');
  lucide.createIcons();

  const { isOk, data: rec } = await window.recognitionSdk.getById(recognitionId);
  if (!isOk || !rec) {
    content.innerHTML = `<div class="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">No se pudo cargar el reconocimiento.</div>`;
    return;
  }
  const card = buildFeedCard(rec);
  card.style.animation = '';
  content.innerHTML = '';
  content.appendChild(card);
  lucide.createIcons();
}

async function handleNotificationClick(id) {
  const n = _notificationsData.find(n => n.id === id);

  // Marcar como leída
  if (n && !n.read) {
    n.read = true;
    updateNotificationBadge();
    renderNotificationsDropdown();
    renderNotificationsPage();
    window.notificationSdk.markRead(id);
  }

  // Cerrar dropdown y página
  document.getElementById('notifications-dropdown')?.classList.add('hidden');
  closeNotificationsPage();

  if (!n) return;

  // Navegar al contenido correspondiente
  if (n.type === 'program_approval_request') {
    _closeAllOverlays();
    openApprovalsPage();
  } else if (n.type === 'program_approved' || n.type === 'program_rejected') {
    _closeAllOverlays();
    openProgramsPage();
  } else if (n.type === 'points_purchase_request' || n.type === 'points_purchase_approved' || n.type === 'points_purchase_rejected') {
    _closeAllOverlays();
    openPointsPage();
  } else if (n.type === 'recognition' || n.type === 'reaction' || n.type === 'comment') {
    const recId = n.data?.recognition_id;
    if (recId) {
      openRecognitionModal(recId);
    }
  } else if (n.type === 'csv_request' || n.type === 'csv_approved' || n.type === 'csv_rejected') {
    _closeAllOverlays();
    openAdmin();
    if (n.type === 'csv_request') {
      setTimeout(() => { setCsvRequestTab('pending'); }, 300);
    } else if (n.type === 'csv_approved' || n.type === 'csv_rejected') {
      setTimeout(() => {
        const body = document.getElementById('admin-csv-history-body');
        const chevron = document.getElementById('admin-csv-history-chevron');
        if (body && body.classList.contains('hidden')) {
          body.classList.remove('hidden');
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
      }, 300);
    }
  }
}

async function openStore() {
  closePointsPage();
  const sp = document.getElementById('store-page');
  sp.style.display = '';
  sp.classList.remove('hidden');
  _positionOverlayPage('store-page');
  if (currentUser) {
    const pts = currentUser.points_to_redeem || 0;
    document.getElementById('store-points-display').textContent = `${pts} puntos`;
    document.getElementById('store-hero-block').innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tus puntos disponibles</p>
        <div class="flex items-baseline gap-2 mb-1">
          <span id="store-hero-points" class="text-5xl font-black text-gray-900">${pts}</span>
          <span class="text-lg font-bold text-violet-500">puntos</span>
        </div>
        <p class="text-sm text-gray-400 mt-1">Elegí cómo disfrutar tu reconocimiento.</p>
      </div>`;
  }
  await renderStore();
}

function closeStore() {
  document.getElementById('store-page').classList.add('hidden');
}

function _updateStoreHeaderPoints() {
  if (!currentUser) return;
  const pts = currentUser.points_to_redeem || 0;
  const headerEl = document.getElementById('store-points-display');
  if (headerEl) headerEl.textContent = `${pts} puntos`;
  const heroEl = document.getElementById('store-hero-points');
  if (heroEl) heroEl.textContent = pts;
}

async function renderStore() {
  const container = document.getElementById('store-rewards-container');
  if (!container || !currentUser) return;
  container.innerHTML = '<div class="text-center py-10"><i data-lucide="loader" class="w-8 h-8 animate-spin text-violet-400 mx-auto"></i></div>';
  lucide.createIcons();

  const isSuperadmin = currentUser.role === 'superadmin' && !isImpersonating;
  const { isOk, data } = isSuperadmin
    ? await window.rewardSdk.listAll()
    : await window.rewardSdk.list(currentUser.company_id);
  const redemptionCounts = isSuperadmin ? await window.rewardSdk.redemptionCounts() : {};
  const pts = currentUser.points_to_redeem || 0;

  const CATS = [
    { key: 'escritorio',    label: 'Para tu escritorio', emoji: '☕', bg: '#ede9fe', desc: 'Para tu día a día en la oficina o en casa', dbKeys: ['merch', 'desk'] },
    { key: 'productividad', label: 'Productividad',      emoji: '📝', bg: '#dbeafe', desc: 'Para organizarte mejor',                    dbKeys: ['office', 'productivity'] },
    { key: 'kits',          label: 'Kits de bienestar',  emoji: '🌿', bg: '#dcfce7', desc: 'Combos pensados para vos',                  dbKeys: ['wellness'] },
    { key: 'tiempo',        label: 'Tiempo libre',       emoji: '⏰', bg: '#fef3c7', desc: 'Recuperá espacio para vos',                  dbKeys: ['time_off'] },
    { key: 'giftcards',     label: 'Gift cards',         emoji: '🎁', bg: '#fce7f3', desc: 'Para gastar donde quieras',                 dbKeys: ['gift_card', 'experience', 'growth', 'learning', 'general'] },
  ];

  const PH = {
    escritorio: [
      { name: 'Taza',                                  desc: 'Una taza para acompañar tus mates, cafés o té.',                     pts: 80,  emoji: '☕' },
      { name: 'Vaso Térmico',                          desc: 'Mantené tu bebida fría o caliente por horas.',                       pts: 150, emoji: '🥤' },
      { name: 'Botella Térmica',                       desc: 'Hidratate todo el día, dentro y fuera de la oficina.',               pts: 180, emoji: '💧' },
      { name: 'Mate con bombilla',                     desc: 'El combo infaltable para los materos del equipo.',                   pts: 200, emoji: '🧉', badge: 'Muy elegido' },
      { name: 'Hornito con vela y esencias aromáticas',desc: 'Sumá un toque de aroma y relax a tu espacio.',                       pts: 220, emoji: '🕯️' },
      { name: 'Apoya muñecas nube',                    desc: 'Comodidad para tus largas jornadas frente a la compu.',              pts: 120, emoji: '☁️' },
    ],
    productividad: [
      { name: 'Anotador con lapicera',                 desc: 'Para anotar tus ideas, siempre a mano.',                             pts: 100, emoji: '🖊️' },
      { name: 'Cuadernos',                             desc: 'Set de cuadernos para organizar tu día a día.',                      pts: 90,  emoji: '📓' },
      { name: 'Lapicero con post-it notes',            desc: 'Todo lo que necesitás para tu escritorio en un solo lugar.',         pts: 110, emoji: '🗒️' },
    ],
    kits: [
      { name: 'Kit Energía',                           desc: 'Taza, té, sahumerios y bolitas de sahumación para recargar energía.',pts: 350, emoji: '🔋' },
      { name: 'Kit Bienestar',                         desc: 'Vela, journal y snacks para tu momento de relax.',                   pts: 380, emoji: '🧘', badge: 'Recomendado' },
      { name: 'Kit Sport',                             desc: 'Riñonera runner, snacks, vincha runner y bandas de resistencia para entrenar.', pts: 420, emoji: '🏃' },
    ],
    tiempo: [
      { name: 'Medio día libre',                       desc: 'Tomate la tarde o la mañana, vos elegís.',                           pts: 250, emoji: '🌤️' },
      { name: 'Un día extra de homeoffice en la semana',desc: 'Sumá un día de trabajo remoto extra a tu semana.',                  pts: 200, emoji: '🏠' },
      { name: 'Salida temprana el viernes',            desc: 'Arrancá el finde un poco antes.',                                    pts: 150, emoji: '🚪' },
      { name: 'Día libre completo',                    desc: 'Un día entero para vos, sin justificación.',                         pts: 400, emoji: '🌴', badge: 'Más pedido' },
    ],
    giftcards: [
      { name: 'Gift card MercadoLibre $10.000',        desc: 'Para comprar lo que quieras en MercadoLibre.',                       pts: 800,  emoji: '🛒' },
      { name: 'Gift card MercadoLibre $20.000',        desc: 'El doble de opciones para vos.',                                     pts: 1600, emoji: '🛍️' },
      { name: 'Gift card Carrefour $10.000',           desc: 'Para tus compras de supermercado.',                                  pts: 800,  emoji: '🛒' },
      { name: 'Netflix 1 mes',                         desc: 'Un mes de series y películas.',                                      pts: 300,  emoji: '🎬' },
      { name: 'Spotify Premium 1 mes',                 desc: 'Un mes de música sin límites ni anuncios.',                          pts: 250,  emoji: '🎧' },
      { name: 'Gift card multimarca',                  desc: 'Elegí entre múltiples marcas para tu canje.',                        pts: 800,  emoji: '🎁', badge: 'Recomendado' },
    ],
  };

  const hasRewards = isOk && data.length > 0;
  const grouped = {};
  CATS.forEach(c => { grouped[c.key] = []; });

  if (hasRewards) {
    data.forEach(r => {
      const cat = CATS.find(c => c.dbKeys.includes(r.category)) || CATS[CATS.length - 1];
      grouped[cat.key].push({ ...r, isPlaceholder: false });
    });
  } else {
    CATS.forEach(cat => {
      grouped[cat.key] = PH[cat.key].map(item => ({ ...item, isPlaceholder: true }));
    });
  }

  const catBarHtml = `
    <div class="flex gap-2 overflow-x-auto pb-2 mb-5" style="scrollbar-width:none">
      <button onclick="filterStoreCategory('all',this)" class="store-cat-btn shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold bg-violet-600 text-white transition">Todas</button>
      ${CATS.map(c => `<button onclick="filterStoreCategory('${c.key}',this)" class="store-cat-btn shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 transition">${c.emoji} ${c.label}</button>`).join('')}
    </div>`;

  const sectionsHtml = CATS
    .filter(cat => grouped[cat.key].length > 0)
    .map(cat => `
      <section class="store-section mb-8" data-cat="${cat.key}">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-base">${cat.emoji}</span>
          <h3 class="font-bold text-gray-800 text-sm">${cat.label}</h3>
          <span class="text-xs text-gray-400">· ${cat.desc}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          ${grouped[cat.key].map(r => isSuperadmin
            ? buildSuperadminRewardCard(r, redemptionCounts[r.id] || 0, cat)
            : buildStoreRewardCard(r, pts, r.isPlaceholder, cat)).join('')}
        </div>
      </section>
    `).join('');

  const adminBannerHtml = isSuperadmin ? `
    <div class="bg-violet-50 border border-violet-100 text-violet-700 text-xs font-semibold rounded-xl px-4 py-3 mb-5">
      Vista de administración: gestioná el stock de cada producto y mirá cuántos pedidos tuvo.
    </div>` : '';

  const _isAdmin = currentUser?.role === 'admin' || (currentUser?.role === 'superadmin' && isImpersonating);
  const lockedBannerHtml = !_storeEnabled ? `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3">
      <i data-lucide="lock" class="w-5 h-5 text-amber-500 shrink-0 mt-0.5"></i>
      <div>
        <p class="text-sm font-semibold text-amber-800">La tienda de beneficios no está disponible aún</p>
        ${_isAdmin ? `<p class="text-xs text-amber-600 mt-1">Contactá a tu ejecutivo de Allay para activarla y comenzar a canjear tus puntos.</p>` : ''}
      </div>
    </div>` : '';

  container.innerHTML = lockedBannerHtml + adminBannerHtml + catBarHtml + sectionsHtml;
  lucide.createIcons();
}

// Genera una imagen genérica (SVG) para usar como placeholder hasta que se suba una foto real
function _storePlaceholderImg(emoji, bg) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='${bg || '#f3f4f6'}'/><text x='50%' y='50%' font-size='110' text-anchor='middle' dominant-baseline='central'>${emoji || '🎁'}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function filterStoreCategory(key, btn) {
  document.querySelectorAll('.store-cat-btn').forEach(b => {
    b.className = b.className
      .replace('bg-violet-600 text-white', 'bg-white border border-gray-200 text-gray-600');
  });
  btn.className = btn.className
    .replace('bg-white border border-gray-200 text-gray-600', 'bg-violet-600 text-white');
  document.querySelectorAll('.store-section').forEach(s => {
    s.style.display = (key === 'all' || s.dataset.cat === key) ? '' : 'none';
  });
}

function buildStoreRewardCard(r, userPts, isPlaceholder, cat) {
  const cost       = r.points_cost ?? r.pts ?? 0;
  const canAfford  = userPts >= cost;
  const missing    = cost - userPts;
  const badge      = r.badge || null;
  const name       = (r.name || '').replace(/'/g, '&#39;');
  const desc       = r.description || r.desc || '';
  const id         = r.id || '';
  const imgSrc     = r.image_url || r.img || _storePlaceholderImg(r.emoji || cat?.emoji, cat?.bg);
  const outOfStock = !isPlaceholder && r.stock !== null && r.stock !== undefined && r.stock <= 0;
  const canRedeem  = !isPlaceholder && !outOfStock && canAfford;

  if (!_storeEnabled) {
    return `<div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 relative grayscale opacity-60 select-none">
      <img src="${imgSrc}" alt="${name}" class="w-full h-28 object-cover rounded-lg bg-gray-100">
      <div>
        <h4 class="font-bold text-gray-400 text-sm leading-snug">${name}</h4>
        <p class="text-xs text-gray-300 mt-1.5 leading-relaxed line-clamp-2">${esc(desc)}</p>
      </div>
      <div class="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
        <div class="h-4 w-16 bg-gray-200 rounded-full"></div>
        <div class="px-4 py-1.5 rounded-full text-xs font-bold bg-gray-100 text-gray-300 cursor-not-allowed">Bloqueado</div>
      </div>
    </div>`;
  }

  return `<div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition relative">
    ${badge ? `<span class="absolute top-4 right-4 text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full z-10">${badge}</span>` : ''}
    <img src="${imgSrc}" alt="${name}" class="w-full h-28 object-cover rounded-lg bg-gray-50">
    <div>
      <h4 class="font-bold text-gray-800 text-sm leading-snug">${name}</h4>
      <p class="text-xs text-gray-400 mt-1.5 leading-relaxed">${desc}</p>
    </div>
    <div class="flex items-end justify-between mt-auto pt-3 border-t border-gray-50">
      <div>
        <div class="flex items-baseline gap-1">
          <span class="font-black text-violet-600 text-lg">${cost}</span>
          <span class="text-xs text-gray-400">puntos</span>
        </div>
        ${!isPlaceholder && outOfStock ? `<p class="text-[10px] text-pink-500 font-medium mt-0.5">Sin stock</p>` : ''}
        ${!isPlaceholder && !outOfStock && !canAfford  ? `<p class="text-[10px] text-pink-500 font-medium mt-0.5">Te faltan ${missing} puntos</p>` : ''}
        ${!isPlaceholder && !outOfStock &&  canAfford  ? `<p class="text-[10px] text-emerald-500 font-medium mt-0.5">Podés canjear esto ✓</p>` : ''}
      </div>
      <button ${canRedeem ? `onclick="redeemReward('${id}', '${name}', ${cost})"` : 'disabled'}
        class="px-4 py-1.5 rounded-full text-xs font-bold transition ${canRedeem ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
        ${isPlaceholder ? 'Próximamente' : outOfStock ? 'Sin stock' : canAfford ? 'Canjear' : 'Sin puntos'}
      </button>
    </div>
  </div>`;
}

function buildSuperadminRewardCard(r, redemptionCount, cat) {
  const cost      = r.points_cost ?? 0;
  const name      = (r.name || '').replace(/'/g, '&#39;');
  const desc      = r.description || '';
  const id        = r.id || '';
  const imgSrc    = r.image_url || _storePlaceholderImg(r.emoji || cat?.emoji, cat?.bg);
  const stock     = r.stock;
  const stockLabel = (stock === null || stock === undefined) ? 'Sin límite' : `${stock} unidades`;

  return `<div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition relative">
    <div class="relative">
      <img id="reward-img-${id}" src="${imgSrc}" alt="${name}" class="w-full h-28 object-cover rounded-lg bg-gray-50">
      <label class="absolute bottom-1.5 right-1.5 bg-white/95 hover:bg-white text-violet-600 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer shadow-sm transition">
        📷 Cambiar foto
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden" onchange='uploadRewardImage(${JSON.stringify(id)}, this)'>
      </label>
    </div>
    <div>
      <h4 class="font-bold text-gray-800 text-sm leading-snug">${name}</h4>
      <p class="text-xs text-gray-400 mt-1.5 leading-relaxed">${desc}</p>
    </div>
    <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50 text-xs">
      <div>
        <span class="font-black text-violet-600 text-lg">${cost}</span>
        <span class="text-gray-400">puntos</span>
      </div>
      <div class="text-right text-gray-500">
        <p>Pedidos: <span class="font-bold text-gray-800">${redemptionCount}</span></p>
        <p>Stock: <span class="font-bold text-gray-800" id="stock-label-${id}">${stockLabel}</span></p>
      </div>
    </div>
    <div class="flex items-center gap-2 pt-2 border-t border-gray-50">
      <input id="stock-input-${id}" type="number" min="0" placeholder="Sin límite" value="${stock ?? ''}"
        class="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300">
      <button onclick='updateRewardStock(${JSON.stringify(id)})'
        class="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition">
        Actualizar stock
      </button>
    </div>
  </div>`;
}

async function uploadRewardImage(rewardId, inputEl) {
  const file = inputEl.files?.[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    showErrorToast('Formato no soportado. Usá jpg, png, gif o webp.');
    return;
  }

  const path = `rewards/${rewardId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await _sb.storage
    .from('image-library')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.error('[uploadRewardImage] upload error:', uploadError);
    showErrorToast(`Error al subir la imagen: ${uploadError.message || uploadError}`);
    return;
  }

  const { data } = _sb.storage.from('image-library').getPublicUrl(path);
  const url = data.publicUrl;

  const { isOk } = await window.rewardSdk.updateImage(rewardId, url);
  if (!isOk) {
    showErrorToast('Error al guardar la imagen del producto');
    return;
  }

  const img = document.getElementById(`reward-img-${rewardId}`);
  if (img) img.src = url;
  showSuccessToast('Imagen actualizada');
}

async function updateRewardStock(rewardId) {
  const input = document.getElementById(`stock-input-${rewardId}`);
  if (!input) return;
  const raw = input.value.trim();
  const stock = raw === '' ? null : parseInt(raw, 10);
  if (raw !== '' && (isNaN(stock) || stock < 0)) {
    showErrorToast('Ingresá un número válido');
    return;
  }

  const { isOk } = await window.rewardSdk.updateStock(rewardId, stock);
  if (!isOk) {
    showErrorToast('Error al actualizar el stock');
    return;
  }

  const label = document.getElementById(`stock-label-${rewardId}`);
  if (label) label.textContent = stock === null ? 'Sin límite' : `${stock} unidades`;
  showSuccessToast('Stock actualizado');
}

async function redeemReward(rewardId, name, cost) {
  if (!currentUser || currentUser.points_to_redeem < cost) {
    showErrorToast('No tenés suficientes puntos para canjear');
    return;
  }

  const { isOk, error } = await window.rewardSdk.redeem(rewardId);
  if (!isOk) {
    const msg = error?.message === 'insufficient_points' ? 'No tenés suficientes puntos'
      : error?.message === 'out_of_stock' ? 'Este producto está sin stock'
      : 'Error al canjear';
    showErrorToast(msg);
    return;
  }

  currentUser.points_to_redeem -= cost;
  await window.dataSdk.refresh();
  updateAllPointsDisplays();
  _updateStoreHeaderPoints();
  await renderStore();
  showSuccessToast(`¡Canjeaste ${name}! -${cost} puntos`);
}

const DEFAULT_PROGRAMS = [
  { id: 'p1', emoji: '🏆', name: 'Trabajo en Equipo',        active: true, global: true, description: 'Para cuando alguien hizo que el equipo funcionara mejor juntos. Ideal si la persona puso al grupo por delante, mantuvo la cohesión en momentos difíciles o fue el ancla que todos necesitaban.' },
  { id: 'p2', emoji: '🎯', name: 'Liderazgo',                active: true, global: true, description: 'Para quien tomó las riendas sin que nadie se lo pidiera. Úsalo cuando alguien guió al equipo, tomó decisiones difíciles o inspiró a otros a dar lo mejor de sí.' },
  { id: 'p3', emoji: '💡', name: 'Innovación',               active: true, global: true, description: 'Para la idea que nadie había pensado, la solución creativa o la forma diferente de hacer algo. Si el reconocimiento es por pensar fuera del molde, este es el programa.' },
  { id: 'p4', emoji: '🤝', name: 'Colaboración',             active: true, global: true, description: 'Para quien cruzó fronteras: ayudó a otro equipo, sumó sin que fuera su responsabilidad o hizo que dos áreas trabajaran mejor juntas. Si el aporte fue más allá de su rol, elegí este.' },
  { id: 'p5', emoji: '⭐', name: 'Actitud',                  active: true, global: true, description: 'Para el que contagia energía positiva, mantiene el ánimo alto cuando todo es difícil o hace que trabajar sea un poco mejor cada día. A veces el mayor aporte no es técnico, es humano.' },
  { id: 'p6', emoji: '✅', name: 'Cumplimiento de objetivos', active: true, global: true, description: 'Para cuando alguien entregó lo que prometió, cumplió un hito importante o cerró algo que el equipo venía persiguiendo. Resultados concretos que merecen ser celebrados.' },
  { id: 'global-birthday',    emoji: '🎂', name: 'Cumpleaños',  active: true, global: true, description: 'Hoy es su día. Aprovechá para decirle algo genuino más allá del "feliz cumple" — contale qué valorás de tenerlo en el equipo.' },
  { id: 'global-anniversary', emoji: '🎉', name: 'Aniversario', active: true, global: true, description: 'Un nuevo año junto al equipo merece más que un silencio. Contale qué cambió desde que llegó y por qué importa que siga estando.' },
];

let companyPrograms = [...DEFAULT_PROGRAMS];
// Expuesto para que analytics.js pueda leer el array actualizado
Object.defineProperty(window, 'companyPrograms', { get: () => companyPrograms });

// Normaliza una fila de la tabla "programs" (snake_case) al shape que usa el front
function _mapDbProgram(p) {
  return {
    ...p,
    emoji:     p.emoji || '⭐',
    employees: p.target_employee_ids || [],
    image:     p.image_url || null,
    createdBy: p.created_by || null,
    custom:    true,
  };
}

async function loadCompanyPrograms() {
  companyPrograms = [...DEFAULT_PROGRAMS];

  const isSuperadminView = currentUser?.role === 'superadmin' && !isImpersonating;

  if (isSuperadminView) {
    // Superadmin: cargar programas de TODAS las empresas
    const [allRes, companiesRes] = await Promise.all([
      window.programsSdk.listAll(),
      _companiesData.length ? Promise.resolve({ isOk: true, data: _companiesData })
                            : window.companySdk.list(),
    ]);
    if (allRes.isOk) companyPrograms.push(...allRes.data.map(_mapDbProgram));
    if (companiesRes.isOk && companiesRes.data) _companiesData = companiesRes.data;

  } else if (currentUser?.company_id) {
    const { isOk, data } = await window.programsSdk.list(currentUser.company_id);
    if (isOk) companyPrograms.push(...data.map(_mapDbProgram));

    const { isOk: ovOk, data: overrides } = await window.programsSdk.listOverrides(currentUser.company_id);
    if (ovOk && overrides.length) {
      const byKey = {};
      overrides.forEach(o => { byKey[o.program_key] = o; });
      companyPrograms = companyPrograms.map(p => {
        const o = p.global && byKey[p.id];
        if (!o) return p;
        return {
          ...p,
          emoji:       o.emoji       || p.emoji,
          name:        o.name        || p.name,
          tag:         o.tag         ?? p.tag,
          description: o.description ?? p.description,
        };
      });
    }
  }

  renderProgramsInModal();
  renderHomeProgramsWidget();
  if (currentPage === 'admin') renderProgramsAdmin();
}

function openProgramsPage() {
  const page = document.getElementById('programs-page');
  if (!page) return;
  page.style.display = '';
  page.classList.remove('hidden');
  _positionOverlayPage('programs-page');
  renderProgramsPage();
}

function closeProgramsPage() {
  document.getElementById('programs-page')?.classList.add('hidden');
}

// ─────────────────────────────────────────
// APPROVALS PAGE
// ─────────────────────────────────────────

function _saveApprovals() {
  // No-op: writes go directly to DB via approvalsSdk. Cache is kept in sync.
}

async function _loadApprovals() {
  const companyId = currentUser?.company_id;
  if (!companyId || !window.approvalsSdk) { _updateApprovalsNavBadge(); return; }

  const { isOk, queue, history } = await window.approvalsSdk.load(companyId);
  if (isOk) {
    _approvalsQueue   = queue.map(r => ({ ...r.data, id: r.id, status: r.status }));
    _approvalsHistory = history.map(r => ({ ...r.data, id: r.id, status: r.status }));
    // Migrate any legacy localStorage entries still pending
    try {
      const legacy = localStorage.getItem('allay_approvals_queue');
      if (legacy) {
        const _isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        const legacyItems = JSON.parse(legacy).filter(l => !_approvalsQueue.find(q => q.id === l.id));
        for (const item of legacyItems) {
          if (!_isUuid(item.id)) item.id = crypto.randomUUID();
          await window.approvalsSdk.add(item);
        }
        localStorage.removeItem('allay_approvals_queue');
        localStorage.removeItem('allay_approvals_history');
        if (legacyItems.length) await _loadApprovals();
        return;
      }
    } catch (_) {}
  }
  // Always try to recover orphaned pending programs (runs for employees too)
  await _resyncOrphanedPendingPrograms();
  _updateApprovalsNavBadge();
  if (currentPage === 'approvals') renderApprovalsPage();
}

async function _resyncOrphanedPendingPrograms() {
  if (!currentUser?.__backendId || !window.approvalsSdk) return;
  // Only employees need this — admins already see all requests via _loadApprovals
  if (_isApprover()) return;

  const orphans = companyPrograms.filter(p =>
    p.pending === true &&
    p.createdBy === currentUser.__backendId &&
    !_approvalsQueue.some(r => r.pendingProgramId === p.id) &&
    !_approvalsHistory.some(r => r.pendingProgramId === p.id)
  );
  if (!orphans.length) return;

  const colors = ['bg-[#3d2b56]', 'bg-[#f19ac4]', 'bg-[#c9a7d4]'];
  for (const prog of orphans) {
    const req = {
      id:                crypto.randomUUID(),
      type:              'program_budget',
      employee:          currentUser.name,
      avatarInitials:    (currentUser.name || '').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
      avatarColor:       colors[(currentUser.name || '').length % colors.length],
      points:            prog.budget || 0,
      programName:       prog.name,
      programEmoji:      prog.emoji,
      programData:       { ...prog },
      rechargeFor:       null,
      pendingProgramId:  prog.id,
      requestedByUserId: currentUser.__backendId,
      company_id:        currentUser.company_id,
      requestedAt:       new Date().toISOString(),
      status:            'pending',
    };
    const { isOk } = await window.approvalsSdk.add(req);
    if (isOk) _approvalsQueue.unshift(req); // avoid resubmitting in the same session
  }
}

let _approvalsTab           = 'queue';
let _approvalsHistoryFilter = 'all';

function _isApprover() {
  return currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
}

function updateApprovalsNavVisibility() {
  const link = document.getElementById('approvals-nav-link');
  if (!link) return;
  if (_isApprover()) {
    link.classList.remove('hidden');
    link.classList.add('flex');
  } else {
    link.classList.add('hidden');
    link.classList.remove('flex');
  }
  _updateApprovalsNavBadge();
}

function _updateApprovalsNavBadge() {
  const badge = document.getElementById('approvals-nav-badge');
  if (!badge) return;
  const companyId = currentUser?.company_id;
  const pending = _approvalsQueue.filter(r =>
    r.status === 'pending' &&
    (currentUser?.role === 'superadmin' || r.company_id === companyId)
  ).length;
  badge.textContent = pending;
  badge.classList.toggle('hidden', pending === 0);
}

async function _submitProgramApprovalRequest(programData, budget, rechargeFor = null, fundingSource = 'request') {
  const name     = currentUser?.name || 'Empleado';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const colors   = ['bg-[#3d2b56]', 'bg-[#f19ac4]', 'bg-[#c9a7d4]'];
  const color    = colors[name.length % colors.length];

  // For new programs (not recharges), insert a pending row in the DB so the
  // request is visible to every device, not just this browser.
  let pendingProgramId = null;
  if (!rechargeFor) {
    const { isOk, data } = await window.programsSdk.create({
      company_id:          currentUser?.company_id,
      name:                programData.name,
      emoji:               programData.emoji,
      description:         programData.description || null,
      tag:                 programData.tag || null,
      budget,
      budget_remaining:    budget,
      target_employee_ids: programData.employees || [],
      pending:             true,
      active:              false,
      custom:              true,
      created_by:          currentUser?.__backendId || null,
    });
    if (isOk) {
      companyPrograms.push(_mapDbProgram(data));
      pendingProgramId = data.id;
    }
  }

  const req = {
    id:                crypto.randomUUID(),
    type:              'program_budget',
    employee:          name,
    avatarInitials:    initials,
    avatarColor:       color,
    points:            budget,
    programName:       programData.name,
    programEmoji:      programData.emoji,
    programData:       { ...programData },
    rechargeFor:       rechargeFor,
    pendingProgramId:  pendingProgramId,
    requestedByUserId: currentUser?.__backendId,
    company_id:        currentUser?.company_id,
    requestedAt:       new Date().toISOString(),
    status:            'pending',
    fundingSource:     fundingSource, // 'request' | 'self'
  };

  _approvalsQueue.unshift(req);
  if (window.approvalsSdk) window.approvalsSdk.add(req).catch(_log);
  _updateApprovalsNavBadge();
  if (currentPage === 'programs') renderProgramsPage();
  showSuccessToast(`Solicitud de "${programData.name}" enviada al administrador`);

  // Notify all admins of this company
  const companyAdmins = allUsers.filter(u =>
    u.company_id === currentUser?.company_id &&
    (u.role === 'admin' || u.role === 'superadmin') &&
    u.__backendId
  );
  if (companyAdmins.length > 0) {
    window.notificationSdk.send(companyAdmins.map(admin => ({
      user_id: admin.__backendId,
      type:    'program_approval_request',
      data:    {
        requester_name: name,
        program_name:   programData.name,
        program_emoji:  programData.emoji || '⭐ ',
        points:         budget,
        is_recharge:    !!rechargeFor,
        req_id:         req.id,
      },
    }))).catch(e => _log('approval notification error:', e));
  }
}

function openApprovalsPage() {
  if (!_isApprover()) { showErrorToast('Solo administradores pueden ver las aprobaciones'); return; }
  const page = document.getElementById('approvals-page');
  if (!page) return;
  page.style.display = '';
  page.classList.remove('hidden');
  _positionOverlayPage('approvals-page');
  renderApprovalsPage();
  // Reload from Supabase to get latest requests, then re-render
  _loadApprovals();
}

function closeApprovalsPage() {
  document.getElementById('approvals-page')?.classList.add('hidden');
  if (currentPage === 'approvals') currentPage = 'home';
}

function switchApprovalsTab(tab) {
  _approvalsTab = tab;
  document.getElementById('approvals-panel-queue').classList.toggle('hidden', tab !== 'queue');
  document.getElementById('approvals-panel-history').classList.toggle('hidden', tab !== 'history');
  ['queue', 'history'].forEach(t => {
    const btn = document.getElementById(`approvals-tab-${t}`);
    if (t === tab) {
      btn.classList.add('border-violet-500', 'text-violet-600', 'font-semibold');
      btn.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
    } else {
      btn.classList.remove('border-violet-500', 'text-violet-600', 'font-semibold');
      btn.classList.add('border-transparent', 'text-gray-500', 'font-medium');
    }
  });
}

function filterApprovalsHistory(filter) {
  _approvalsHistoryFilter = filter;
  ['all', 'approved', 'rejected'].forEach(f => {
    const btn = document.getElementById(`afilter-${f}`);
    if (f === filter) {
      btn.classList.add('bg-violet-500', 'text-white');
      btn.classList.remove('text-gray-500', 'hover:bg-gray-50');
    } else {
      btn.classList.remove('bg-violet-500', 'text-white');
      btn.classList.add('text-gray-500', 'hover:bg-gray-50');
    }
  });
  renderApprovalsHistory();
}

function renderApprovalsPage() {
  renderApprovalsQueue();
  renderApprovalsHistory();

  const companyId = currentUser?.company_id;
  const pending = _approvalsQueue.filter(r =>
    r.status === 'pending' &&
    (currentUser?.role === 'superadmin' || r.company_id === companyId)
  ).length;
  const badge      = document.getElementById('approvals-queue-badge');
  const badgeCount = document.getElementById('approvals-queue-count');
  if (badge && badgeCount) {
    badge.classList.toggle('hidden', pending === 0);
    badge.classList.toggle('flex', pending > 0);
    badgeCount.textContent = `${pending} pendiente${pending !== 1 ? 's' : ''}`;
  }
  lucide.createIcons();
}

function _approvalsStatusBadge(status) {
  if (status === 'approved') return '<span class="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full"><i data-lucide="check" class="w-3 h-3"></i> Aprobado</span>';
  if (status === 'rejected') return '<span class="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full"><i data-lucide="x" class="w-3 h-3"></i> Rechazado</span>';
  return '<span class="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full"><i data-lucide="clock" class="w-3 h-3"></i> Pendiente</span>';
}

function renderApprovalsQueue() {
  const container = document.getElementById('approvals-queue-list');
  if (!container) return;

  const companyId = currentUser?.company_id;
  const pending = _approvalsQueue.filter(r =>
    r.status === 'pending' &&
    (currentUser?.role === 'superadmin' || r.company_id === companyId)
  );

  if (pending.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
          <i data-lucide="check-circle-2" class="w-8 h-8 text-green-400"></i>
        </div>
        <p class="text-sm font-semibold text-gray-700 mb-1">¡Todo al día!</p>
        <p class="text-xs text-gray-400">No hay solicitudes de puntos pendientes.</p>
      </div>`;
    return;
  }

  container.innerHTML = pending.map(req => {
    const pd = req.programData || {};
    const employees = Array.isArray(pd.employees) ? pd.employees : [];
    const empNames = employees.map(id => {
      const u = allUsers.find(u => u.__backendId === id);
      return u ? esc(u.name) : null;
    }).filter(Boolean);
    const detailId = `req-detail-${req.id.replace(/[^a-z0-9]/gi,'_')}`;

    const detailRows = [];
    if (pd.tag)         detailRows.push(`<div class="flex items-center gap-2"><span class="text-xs text-gray-400 w-24 shrink-0">Etiqueta</span><span class="text-xs font-medium text-gray-700">#${esc(pd.tag)}</span></div>`);
    if (pd.description) detailRows.push(`<div class="flex items-start gap-2"><span class="text-xs text-gray-400 w-24 shrink-0">Descripción</span><span class="text-xs text-gray-700">${esc(pd.description)}</span></div>`);
    if (empNames.length) detailRows.push(`<div class="flex items-start gap-2"><span class="text-xs text-gray-400 w-24 shrink-0">Participantes</span><span class="text-xs text-gray-700">${empNames.join(', ')}</span></div>`);
    else if (employees.length === 0 && !pd.global) detailRows.push(`<div class="flex items-center gap-2"><span class="text-xs text-gray-400 w-24 shrink-0">Participantes</span><span class="text-xs text-gray-500 italic">Todos los empleados</span></div>`);
    if (req.points)     detailRows.push(`<div class="flex items-center gap-2"><span class="text-xs text-gray-400 w-24 shrink-0">Budget</span><span class="text-xs font-semibold text-violet-700">${req.points} puntos</span></div>`);

    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition" data-req-id="${req.id}">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-full ${req.avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0">${req.avatarInitials}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-0.5">
            <span class="font-bold text-sm text-gray-800">${esc(req.employee)}</span>
            <span class="text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">${req.rechargeFor ? 'Recarga de puntos' : 'Nuevo programa'}</span>
          </div>
          <p class="text-xs text-gray-400 mb-3">${formatTimeAgo(req.requestedAt)}</p>
          <!-- Program detail card — click to expand -->
          <button onclick="toggleApprovalDetail('${detailId}')"
            class="w-full bg-gray-50 hover:bg-violet-50 rounded-xl px-4 py-3 mb-1 flex items-center gap-3 transition text-left group">
            <span class="text-2xl">${req.programEmoji}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-gray-800">${esc(req.programName)}</p>
              <p class="text-xs text-gray-400">${req.rechargeFor ? 'Recarga de budget del programa' : 'Programa personalizado'}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              ${req.fundingSource === 'self' ? `<span class="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">puntos del usuario</span>` : ''}
              <div class="flex items-center gap-1 bg-white border border-violet-100 rounded-xl px-3 py-1.5">
                <i data-lucide="coins" class="w-4 h-4 text-violet-500"></i>
                <span class="text-sm font-bold text-violet-700">${req.points} puntos</span>
              </div>
              <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition req-chevron-${detailId}"></i>
            </div>
          </button>
          <!-- Expanded detail panel -->
          <div id="${detailId}" class="hidden mb-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 space-y-2">
            ${detailRows.length ? detailRows.join('') : '<p class="text-xs text-gray-400 italic">Sin detalles adicionales.</p>'}
          </div>
          <div class="flex justify-end gap-2 flex-wrap mt-3">
            <button onclick="approveRequest('${req.id}')"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:opacity-90 transition shadow-sm">
              <i data-lucide="check" class="w-4 h-4"></i> Aprobar
            </button>
            <button onclick="rejectRequest('${req.id}')"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition">
              <i data-lucide="x" class="w-4 h-4"></i> Rechazar
            </button>
            ${isSuperadmin() ? `
            <button onclick="openSaDeleteProgramModal('${req.pendingProgramId||''}','${(req.programName||'').replace(/'/g,"\\'")}','${req.id}','${req.company_id||''}')"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 transition" title="Eliminar programa (Superadmin)">
              <i data-lucide="shield-off" class="w-4 h-4"></i> Eliminar
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleApprovalDetail(detailId) {
  const panel   = document.getElementById(detailId);
  if (!panel) return;
  const isOpen  = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', isOpen);
  // Rotate chevron
  document.querySelectorAll(`.req-chevron-${detailId}`).forEach(el => {
    el.style.transform = isOpen ? '' : 'rotate(180deg)';
  });
}

function renderApprovalsHistory() {
  const container = document.getElementById('approvals-history-list');
  if (!container) return;

  const companyId = currentUser?.company_id;
  let items = _approvalsHistory.filter(r =>
    currentUser?.role === 'superadmin' || r.company_id === companyId
  );
  if (_approvalsHistoryFilter !== 'all') {
    items = items.filter(r => r.status === _approvalsHistoryFilter);
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <i data-lucide="inbox" class="w-8 h-8 text-gray-300"></i>
        </div>
        <p class="text-sm font-semibold text-gray-700 mb-1">Sin resultados</p>
        <p class="text-xs text-gray-400">No hay solicitudes procesadas${_approvalsHistoryFilter !== 'all' ? ' con este filtro' : ''}.</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(req => `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-full ${req.avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0">${req.avatarInitials}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 flex-wrap mb-0.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-sm text-gray-800">${req.employee}</span>
              <span class="text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">${req.rechargeFor ? 'Recarga de puntos' : 'Nuevo programa'}</span>
            </div>
            ${_approvalsStatusBadge(req.status)}
          </div>
          <p class="text-xs text-gray-400 mb-3">${formatTimeAgo(req.requestedAt)}</p>
          <div class="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <span class="text-2xl">${req.programEmoji}</span>
            <div>
              <p class="text-sm font-bold text-gray-800">${req.programName}</p>
              <p class="text-xs text-gray-400">${req.rechargeFor ? 'Recarga de budget del programa' : 'Programa personalizado'}</p>
            </div>
            <div class="ml-auto flex items-center gap-1.5 bg-white border border-violet-100 rounded-xl px-3 py-1.5 shrink-0">
              <i data-lucide="coins" class="w-4 h-4 text-violet-500"></i>
              <span class="text-sm font-bold text-violet-700">${req.points} puntos</span>
            </div>
          </div>
          ${req.rejectionNote ? `<p class="mt-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2"><span class="font-semibold">Motivo de rechazo:</span> ${req.rejectionNote}</p>` : ''}
          <p class="text-xs text-gray-400 mt-2 text-right">Procesado por <span class="font-medium text-gray-600">${req.resolvedBy}</span></p>
        </div>
      </div>
    </div>
  `).join('');
}

function approveRequest(reqId) {
  const idx = _approvalsQueue.findIndex(r => r.id === reqId);
  if (idx === -1) return;
  const req = _approvalsQueue[idx];

  // Block if admin doesn't have enough points (only when admin is funding)
  const cost = Number(req.points) || 0;
  if (cost > 0 && req.fundingSource !== 'self') {
    const adminPts = currentUser?.points_to_give ?? 0;
    if (adminPts < cost) {
      showErrorToast(`No tenés suficientes puntos para aprobar este programa (necesitás ${cost} puntos, tenés ${adminPts} puntos).`);
      return;
    }
  }

  req.status    = 'approved';
  req.resolvedBy = currentUser?.name || 'Admin';
  _approvalsQueue.splice(idx, 1);
  _approvalsHistory.unshift(req);

  // Deduct points from admin wallet (only if employee didn't self-fund)
  if (cost > 0 && currentUser && req.fundingSource !== 'self') {
    currentUser.points_to_give = (currentUser.points_to_give ?? 0) - cost;
    if (isImpersonating) {
      const adminRecord = allUsers.find(u => u.__backendId === currentUser.__backendId);
      if (adminRecord) {
        adminRecord.points_to_give = currentUser.points_to_give;
        window.dataSdk.update({ ...adminRecord }).catch(_log);
      }
    } else {
      window.dataSdk.deductPoints(cost).catch(_log);
    }
    updateAllPointsDisplays();
  }

  // Apply the approved action
  if (req.programData) {
    if (req.rechargeFor) {
      // Recharge existing program budget
      const prog = companyPrograms.find(p => p.id === req.rechargeFor);
      if (prog) {
        const oldRemaining  = _getProgramRemainingBudget(prog);
        prog.budget          = (prog.budget || 0) + req.points;
        prog.budget_remaining = oldRemaining + req.points;
        window.programsSdk.update(prog.id, {
          budget: prog.budget, budget_remaining: prog.budget_remaining,
        }).catch(_log);
      }
    } else if (req.pendingProgramId) {
      // Activate the pending program row that was already inserted in DB
      const prog = companyPrograms.find(p => p.id === req.pendingProgramId);
      if (prog) {
        prog.pending = false;
        prog.active  = true;
        if (!prog.createdBy && req.requestedByUserId) prog.createdBy = req.requestedByUserId;
        window.programsSdk.update(prog.id, {
          pending: false, active: true, created_by: prog.createdBy || null,
        }).catch(_log);
      }
    } else {
      // Legacy path (requests without pendingProgramId)
      window.programsSdk.create({
        company_id:  currentUser?.company_id,
        name:        req.programData.name,
        emoji:       req.programData.emoji,
        description: req.programData.description || null,
        tag:         req.programData.tag || null,
        budget:      req.points,
        budget_remaining: req.points,
        custom:      true,
        active:      true,
        created_by:  req.requestedByUserId || null,
      }).then(({ isOk, data }) => { if (isOk) companyPrograms.push(_mapDbProgram(data)); }).catch(_log);
    }
    renderHomeProgramsWidget();
    renderProgramsInModal();
    if (currentPage === 'programs') renderProgramsPage();
  }

  if (window.approvalsSdk) window.approvalsSdk.updateStatus(reqId, 'approved', currentUser?.__backendId).catch(_log);
  _updateApprovalsNavBadge();
  showSuccessToast(req.rechargeFor
    ? `Recarga de "${req.programName}" aprobada`
    : `Programa "${req.programName}" aprobado y creado`
  );

  // Notify the employee who requested it
  if (req.requestedByUserId) {
    window.notificationSdk.send([{
      user_id: req.requestedByUserId,
      type:    'program_approved',
      data:    {
        program_name:  req.programName,
        program_emoji: req.programEmoji || '⭐ ',
        points:        req.points,
        is_recharge:   !!req.rechargeFor,
        approved_by:   currentUser?.name || 'Admin',
      },
    }]).catch(e => _log('approved notification error:', e));
  }

  renderApprovalsPage();
  lucide.createIcons();
}

function rejectRequest(reqId) {
  const idx = _approvalsQueue.findIndex(r => r.id === reqId);
  if (idx === -1) return;
  const req = _approvalsQueue[idx];
  req.status        = 'rejected';
  req.resolvedBy    = currentUser?.name || 'Admin';
  req.rejectionNote = 'Rechazado por el administrador';
  _approvalsQueue.splice(idx, 1);
  _approvalsHistory.unshift(req);

  // Remove the pending program row (both locally and in the database)
  if (req.pendingProgramId) {
    const progIdx = companyPrograms.findIndex(p => p.id === req.pendingProgramId);
    if (progIdx !== -1) companyPrograms.splice(progIdx, 1);
    window.programsSdk.delete(req.pendingProgramId).catch(_log);
    if (currentPage === 'programs') renderProgramsPage();
  }

  if (window.approvalsSdk) window.approvalsSdk.updateStatus(reqId, 'rejected', currentUser?.__backendId).catch(_log);
  _updateApprovalsNavBadge();
  showSuccessToast(`Solicitud de "${req.programName}" rechazada`);

  // Notify the employee who requested it
  if (req.requestedByUserId) {
    window.notificationSdk.send([{
      user_id: req.requestedByUserId,
      type:    'program_rejected',
      data:    {
        program_name:  req.programName,
        program_emoji: req.programEmoji || '⭐ ',
        points:        req.points,
        is_recharge:   !!req.rechargeFor,
        rejected_by:   currentUser?.name || 'Admin',
      },
    }]).catch(e => _log('rejected notification error:', e));
  }

  renderApprovalsPage();
  lucide.createIcons();
}

function _visiblePrograms() {
  const userId       = currentUser?.__backendId;
  const isSuperadmin = currentUser?.role === 'superadmin';
  const isAdmin      = currentUser?.role === 'admin';
  const myCompanyId  = currentUser?.company_id;

  return companyPrograms.filter(p => {
    if (p.pending) return false;
    if (p.active === false) return false;

    if (p.custom) {
      // Nunca mostrar programas de otra empresa (sin excepciones)
      if (!isSuperadmin && p.company_id && p.company_id !== myCompanyId) return false;

      if (isSuperadmin) return true;
      if (isAdmin) return true;  // admins ven todos los programas de su empresa
      if (p.createdBy === userId) return true;
      return Array.isArray(p.employees) && p.employees.includes(userId);
    }

    // Programas globales (DEFAULT_PROGRAMS): siempre visibles para todos
    return true;
  });
}

function _buildActiveProgramCard(p) {
  const isSA      = currentUser?.role === 'superadmin';
  const remaining = _getProgramRemainingBudget(p);
  const safeName  = p.name.replace(/'/g, "\\'");
  const companyBadge = isSA && p.company_id
    ? `<span class="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">🏢 ${_companiesData.find(c => c.id === p.company_id)?.name || p.company_id}</span>`
    : '';
  const menu = p.custom ? `
    <div class="absolute top-3 right-3" style="z-index:2;">
      <button onclick="toggleProgramMenu('${p.id}',event)" class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700 font-bold text-base leading-none">···</button>
      <div id="pmenu-${p.id}" class="hidden absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[150px]">
        <button onclick="openProgramHistory('${p.id}'); closeProgramMenus()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"><i data-lucide="clock" class="w-3.5 h-3.5 shrink-0"></i> Historial</button>
        <button onclick="openEditProgramModal('${p.id}'); closeProgramMenus()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"><i data-lucide="pencil" class="w-3.5 h-3.5 shrink-0"></i> Editar</button>
        ${isSA ? `<button onclick="openSaDeleteProgramModal('${p.id}','${safeName}',null,'${p.company_id||''}'); closeProgramMenus()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left"><i data-lucide="shield-off" class="w-3.5 h-3.5 shrink-0"></i> Eliminar</button>`
          : `<div class="relative group/del"><button disabled class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed text-left"><i data-lucide="trash-2" class="w-3.5 h-3.5 shrink-0"></i> Eliminar</button><div class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover/del:opacity-100 transition-opacity z-50 text-center leading-snug shadow-lg">Solo el superadmin puede eliminar programas.<div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div></div></div>`}
      </div>
    </div>` : p.global && isSA ? `
    <div class="absolute top-3 right-3" style="z-index:2;">
      <button onclick="toggleProgramMenu('${p.id}',event)" class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700 font-bold text-base leading-none">···</button>
      <div id="pmenu-${p.id}" class="hidden absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[150px]">
        <button onclick="openEditProgramModal('${p.id}'); closeProgramMenus()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"><i data-lucide="pencil" class="w-3.5 h-3.5 shrink-0"></i> Editar</button>
        <button onclick="openSaDeleteProgramModal('${p.id}','${safeName}',null,null); closeProgramMenus()" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left"><i data-lucide="shield-off" class="w-3.5 h-3.5 shrink-0"></i> Eliminar (SA)</button>
      </div>
    </div>` : '';
  return `
  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 text-center hover:shadow-md transition relative">
    ${menu}
    <div class="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl">${p.emoji || '⭐'}</div>
    <h3 class="font-bold text-gray-800 text-sm">${p.name}</h3>
    ${p.tag ? `<span class="text-[10px] text-gray-400 font-medium">#${p.tag}</span>` : ''}
    ${p.description ? `<p class="text-[11px] text-gray-500 leading-snug">${p.description}</p>` : ''}
    <div class="flex items-center gap-2 flex-wrap justify-center">
      <span class="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">Activo</span>
      ${p.budget ? `<span class="text-[10px] font-semibold text-celeste-700 bg-celeste-50 px-2.5 py-1 rounded-full">💰 ${remaining} / ${p.budget} pts</span>` : ''}
      ${companyBadge}
    </div>
  </div>`;
}

function _buildPendingProgramCard(p) {
  const isSA    = currentUser?.role === 'superadmin';
  const reqId   = _approvalsQueue.find(r => r.pendingProgramId === p.id)?.id || null;
  const safeName = p.name.replace(/'/g, "\\'");
  const companyBadge = isSA && p.company_id
    ? `<span class="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">🏢 ${_companiesData.find(c => c.id === p.company_id)?.name || p.company_id}</span>`
    : '';
  return `
  <div class="bg-gray-50 rounded-2xl border border-amber-200 shadow-sm p-6 flex flex-col items-center gap-3 text-center relative opacity-75">
    <div class="absolute top-3 left-3">
      <span class="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Pendiente
      </span>
    </div>
    ${isSA ? `<div class="absolute top-3 right-3" style="z-index:2;"><button onclick="openSaDeleteProgramModal('${p.id}','${safeName}','${reqId||''}','${p.company_id||''}')" class="p-1.5 rounded-lg hover:bg-red-50 transition text-red-400 hover:text-red-600"><i data-lucide="shield-off" class="w-4 h-4"></i></button></div>` : ''}
    <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mt-4">${p.emoji || '⭐'}</div>
    <h3 class="font-bold text-gray-500 text-sm">${p.name}</h3>
    ${p.tag ? `<span class="text-[10px] text-gray-400 font-medium">#${p.tag}</span>` : ''}
    ${p.description ? `<p class="text-[11px] text-gray-400 leading-snug">${p.description}</p>` : ''}
    <div class="flex items-center gap-2 flex-wrap justify-center">
      ${p.budget ? `<span class="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">💰 ${p.budget} pts solicitados</span>` : ''}
      ${companyBadge}
    </div>
  </div>`;
}

function renderProgramsPage() {
  const grid = document.getElementById('programs-page-grid');
  if (!grid) return;

  const isSuperadmin = currentUser?.role === 'superadmin';

  if (isSuperadmin) {
    _renderSuperadminProgramsPage(grid);
    return;
  }

  const userId  = currentUser?.__backendId;
  const active  = _visiblePrograms();
  const pending = companyPrograms.filter(p => {
    if (!p.pending) return false;
    if (currentUser?.role === 'admin') return true;
    return p.createdBy === userId || p.company_id === currentUser?.company_id;
  });

  if (!active.length && !pending.length) {
    grid.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-12">No hay programas configurados aún.</p>';
    return;
  }

  grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
  grid.innerHTML = [
    ...active.map(p => _buildActiveProgramCard(p)),
    ...pending.map(p => _buildPendingProgramCard(p)),
  ].join('');
}

function _renderSuperadminProgramsPage(grid) {
  grid.className = '';

  const globals   = companyPrograms.filter(p => p.global && p.active !== false);
  const allCustom = companyPrograms.filter(p => p.custom && !p.global); // includes pending

  // Group all custom programs (active + pending) by company — no duplicates
  const byCompany = {};
  allCustom.forEach(p => {
    const cid = p.company_id || 'unknown';
    if (!byCompany[cid]) byCompany[cid] = [];
    byCompany[cid].push(p);
  });

  const companyGroups = Object.entries(byCompany).map(([cid, programs]) => {
    const companyName = _companiesData.find(c => c.id === cid)?.name || cid;
    const cards = programs.map(p =>
      p.pending ? _buildPendingProgramCard(p) : _buildActiveProgramCard(p)
    ).join('');
    return `
    <div class="mb-5">
      <div class="flex items-center gap-2 mb-3">
        <span class="text-base">🏢</span>
        <h4 class="font-bold text-gray-700 text-sm">${companyName}</h4>
        <span class="text-xs text-gray-400">(${programs.length})</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${cards}</div>
    </div>`;
  }).join('');

  const globalsHtml = globals.length
    ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${globals.map(p => _buildActiveProgramCard(p)).join('')}</div>`
    : '<p class="text-sm text-gray-400 py-4">Sin programas globales.</p>';

  const customsHtml = Object.keys(byCompany).length
    ? companyGroups
    : '<p class="text-sm text-gray-400 py-4">No hay programas personalizados en ninguna empresa aún.</p>';

  grid.innerHTML = `
  <div class="flex flex-col lg:flex-row gap-6 items-start">

    <!-- Columna izquierda: Globales -->
    <div class="w-full lg:w-80 shrink-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-50 bg-violet-50">
          <h3 class="font-bold text-violet-800 text-sm">Programas globales</h3>
          <p class="text-[11px] text-violet-500 mt-0.5">Predefinidos para todas las empresas</p>
        </div>
        <div class="p-4">${globalsHtml}</div>
      </div>
    </div>

    <!-- Columna derecha: Personalizados por empresa -->
    <div class="flex-1 min-w-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-50 bg-gray-50">
          <h3 class="font-bold text-gray-800 text-sm">Programas personalizados</h3>
          <p class="text-[11px] text-gray-400 mt-0.5">Organizados por empresa</p>
        </div>
        <div class="p-4 space-y-2">${customsHtml}</div>
      </div>
    </div>

  </div>`;
  lucide.createIcons();
}

function renderHomeProgramsWidget() {
  // Kept for compatibility when called after program edits; sidebar refresh handles real counts.
  loadHomeSidebar();
}

async function loadHomeSidebar() {
  if (!currentUser) return;
  try {
    const isSuperadminView = currentUser.role === 'superadmin' && !isImpersonating;
    const companyId = isSuperadminView ? null : currentUser.company_id;

    const [activityRes, redemptionsRes, companyRes] = await Promise.all([
      window.recognitionSdk.recentForUser(currentUser.__backendId, 6).catch(() => ({ data: [] })),
      window.redemptionsSdk?.recentForUser(currentUser.__backendId, 4).catch(() => ({ data: [] })) || Promise.resolve({ data: [] }),
      window.recognitionSdk.forCompany(companyId, 300).catch(() => ({ data: [] })),
    ]);

    _renderActivityWidget(activityRes.data || [], redemptionsRes.data || []);
    _renderTopGiversWidget(companyRes.data || []);
    _renderProgramsUsageWidget(companyRes.data || []);
  } catch (e) {
    _log('loadHomeSidebar error:', e);
    // Clear loading states on error
    ['home-activity-list','home-top-givers-list','home-programs-list'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="text-[10px] text-gray-400">Sin datos disponibles.</p>';
    });
  }
}

function _renderActivityWidget(recognitions, redemptions) {
  const el = document.getElementById('home-activity-list');
  if (!el) return;

  // Merge recognitions and redemptions into one timeline
  const items = [
    ...recognitions.map(r => ({ date: r.created_at, type: r._type, rec: r })),
    ...redemptions.map(r => ({ date: r.created_at, type: 'redemption', red: r })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  if (!items.length) {
    el.innerHTML = '<p class="text-[10px] text-gray-400">Sin actividad reciente.</p>';
    return;
  }

  el.innerHTML = items.map(item => {
    const time = formatTimeAgo(item.date);
    if (item.type === 'received') {
      const from = item.rec.from_user?.name || 'Usuario eliminado';
      return `<div class="flex items-start gap-2">
        <div class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center shrink-0 mt-0.5"><i data-lucide="heart" class="w-3 h-3 text-pink-400"></i></div>
        <div><p class="text-xs text-gray-700"><span class="font-semibold">${from}</span> te reconoció</p><p class="text-[10px] text-gray-400">${time}</p></div>
      </div>`;
    }
    if (item.type === 'sent') {
      const to = item.rec.to_user?.name || 'Usuario eliminado';
      return `<div class="flex items-start gap-2">
        <div class="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5"><i data-lucide="send" class="w-3 h-3 text-violet-500"></i></div>
        <div><p class="text-xs text-gray-700">Reconociste a <span class="font-semibold">${to}</span></p><p class="text-[10px] text-gray-400">${time}</p></div>
      </div>`;
    }
    // redemption
    const reward = item.red.reward?.name || 'Recompensa';
    return `<div class="flex items-start gap-2">
      <div class="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5"><i data-lucide="gift" class="w-3 h-3 text-amber-500"></i></div>
      <div><p class="text-xs text-gray-700">Canjeaste <span class="font-semibold">${reward}</span></p><p class="text-[10px] text-gray-400">${time}</p></div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function _renderTopGiversWidget(recognitions) {
  const el = document.getElementById('home-top-givers-list');
  if (!el) return;

  // Count by sender
  const counts = {};
  recognitions.forEach(r => {
    const id   = r.from_user?.id;
    const name = r.from_user?.name;
    if (!id || !name) return;
    if (!counts[id]) counts[id] = { name, count: 0 };
    counts[id].count++;
  });

  const ranked = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  if (!ranked.length) {
    el.innerHTML = '<p class="text-[10px] text-gray-400">Sin datos aún.</p>';
    return;
  }

  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
  el.innerHTML = ranked.map((u, i) => {
    const initial = (u.name[0] || '?').toUpperCase();
    const medal   = medalColors[i] || 'text-gray-300';
    const avatarGrad = AVATAR_COLORS[u.name.length % AVATAR_COLORS.length];
    return `<div class="flex items-center gap-2">
      <span class="text-xs font-bold ${medal} w-4">${i + 1}</span>
      <div class="w-6 h-6 rounded-full ${avatarGrad} flex items-center justify-center text-white text-[10px] font-bold shrink-0">${initial}</div>
      <span class="text-xs text-gray-700 flex-1 truncate">${u.name}</span>
      <span class="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">${u.count}</span>
    </div>`;
  }).join('');
}

function _renderProgramsUsageWidget(recognitions) {
  const el = document.getElementById('home-programs-list');
  if (!el) return;

  // Count usage per program label
  const counts = {};
  recognitions.forEach(r => {
    if (!r.program) return;
    counts[r.program] = (counts[r.program] || 0) + 1;
  });

  // Only show programs visible to the current user
  const visible = _visiblePrograms();
  const visibleLabels = new Set(visible.map(p => `${p.emoji} ${p.name}`));

  const ranked = Object.entries(counts)
    .filter(([label]) => visibleLabels.has(label))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!ranked.length) {
    el.innerHTML = '<p class="text-[10px] text-gray-400">Sin reconocimientos aún.</p>';
    return;
  }

  const max = ranked[0][1];
  el.innerHTML = ranked.map(([label, count]) => {
    const pct = Math.round((count / max) * 100);
    return `<div>
      <div class="flex items-center justify-between mb-0.5">
        <span class="text-[10px] font-medium text-gray-700 truncate max-w-[75%]">${label}</span>
        <span class="text-[10px] font-semibold text-violet-600">${count}</span>
      </div>
      <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full bg-[#3d2b56] rounded-full" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');
}

function _buildModalProgramCard(p) {
  return `<div class="program-item p-4 rounded-xl border-2 border-gray-200 hover:border-violet-400 cursor-pointer transition text-center relative"
       onclick="selectProgram(this,'${p.emoji} ${p.name}')"
       ${p.description ? `data-description="${esc(p.description)}" onmouseenter="showProgTooltip(this)" onmouseleave="hideProgTooltip()"` : ''}>
    <span class="text-3xl">${p.emoji}</span>
    <p class="text-sm font-semibold text-gray-800 mt-2">${p.name}</p>
    ${p.description ? `<span class="absolute top-2 right-2 w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-[9px] font-bold flex items-center justify-center leading-none pointer-events-none">i</span>` : ''}
  </div>`;
}

function renderProgramsInModal() {
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  selectedProgram = null;
  updateModalBtn();

  const isSuperadmin = currentUser?.role === 'superadmin' && !isImpersonating;

  if (isSuperadmin) {
    const globals  = DEFAULT_PROGRAMS.filter(p => p.active !== false);
    const customs  = companyPrograms.filter(p => p.custom && !p.pending && p.active !== false);

    // Group customs by company
    const byCompany = {};
    customs.forEach(p => {
      const key = p.company_id || '_unknown';
      if (!byCompany[key]) byCompany[key] = [];
      byCompany[key].push(p);
    });

    const globalsHtml = `
      <div class="col-span-full mb-1">
        <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Programas globales</p>
      </div>
      ${globals.map(_buildModalProgramCard).join('')}`;

    const customsHtml = Object.entries(byCompany).map(([companyId, progs]) => {
      const companyName = _companiesData.find(c => c.id === companyId)?.name || companyId;
      return `
        <div class="col-span-full mt-3 mb-1">
          <p class="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">🏢 ${esc(companyName)}</p>
        </div>
        ${progs.map(_buildModalProgramCard).join('')}`;
    }).join('');

    grid.innerHTML = globalsHtml + (customsHtml ? customsHtml : '');
    return;
  }

  // Non-superadmin: flat list as before
  let active = _visiblePrograms();
  if (active.length === 0) active = [...DEFAULT_PROGRAMS];
  grid.innerHTML = active.map(_buildModalProgramCard).join('');
}

function showProgTooltip(el) {
  const desc = el.dataset.description;
  if (!desc) return;
  let tip = document.getElementById('prog-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'prog-tooltip';
    tip.className = 'fixed z-[200] bg-gray-800 text-white text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none max-w-[200px] leading-relaxed';
    document.body.appendChild(tip);
  }
  tip.textContent = desc;
  tip.style.display = 'block';
  const rect = el.getBoundingClientRect();
  const tipW = 200;
  let left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  const top = rect.bottom + 6;
  tip.style.left = left + 'px';
  tip.style.top  = top + 'px';
}

function hideProgTooltip() {
  const tip = document.getElementById('prog-tooltip');
  if (tip) tip.style.display = 'none';
}

function renderProgramsAdmin() {
  const container = document.getElementById('programs-admin-list');
  if (!container) return;

  if (companyPrograms.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay programas. Agregá uno para comenzar.</p>';
    return;
  }

  container.innerHTML = companyPrograms.map(p => `
    <div class="flex items-center justify-between p-3 rounded-xl border ${p.global ? 'border-violet-100 bg-violet-50/30' : 'border-gray-200 hover:border-violet-200 hover:bg-violet-50/30'} transition">
      <div class="flex items-center gap-3">
        <span class="text-2xl">${p.emoji}</span>
        <span class="text-sm font-semibold text-gray-800">${p.name}</span>
        ${p.global ? '<span class="text-[10px] font-semibold text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full flex items-center gap-1"><i data-lucide="lock" class="w-2.5 h-2.5"></i> Global</span>' : ''}
        ${!p.active && !p.global ? '<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>' : ''}
      </div>
      <div class="flex gap-1">
        ${p.global && currentUser?.role === 'superadmin' ? `
        <button onclick="openEditProgramModal('${p.id}')"
          class="p-1.5 rounded-lg hover:bg-violet-50 transition" title="Editar">
          <i data-lucide="pencil" class="w-4 h-4 text-violet-400"></i>
        </button>` : ''}
        ${!p.global ? `
        <button onclick="toggleProgramActive('${p.id}',${p.active})"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition" title="${p.active ? 'Desactivar' : 'Activar'}">
          <i data-lucide="${p.active ? 'eye-off' : 'eye'}" class="w-4 h-4 text-gray-400"></i>
        </button>
        <button onclick="deleteProgramItem('${p.id}','${p.name}')"
          class="p-1.5 rounded-lg hover:bg-red-50 transition">
          <i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i>
        </button>` : ''}
      </div>
    </div>`).join('');
  lucide.createIcons();
}

function showAddProgramModal() {
  document.getElementById('add-program-modal').classList.remove('hidden');
  document.getElementById('program-name-input').value  = '';
  document.getElementById('program-emoji-input').value = '⭐';
}

function closeAddProgramModal() {
  document.getElementById('add-program-modal').classList.add('hidden');
}

async function saveNewProgram() {
  const name  = document.getElementById('program-name-input').value.trim();
  const emoji = document.getElementById('program-emoji-input').value.trim() || '⭐';
  if (!name) { showErrorToast('Ingresá un nombre para el programa'); return; }
  if (!currentUser?.company_id) return;

  const btn = document.getElementById('save-program-btn');
  btn.disabled = true;
  const { isOk } = await window.programsSdk.create({
    company_id: currentUser.company_id, name, emoji, custom: true, active: true,
  });
  btn.disabled = false;

  if (isOk) {
    closeAddProgramModal();
    await loadCompanyPrograms();
    showSuccessToast(`Programa "${name}" creado`);
  } else {
    showErrorToast('Error al crear el programa');
  }
}

async function toggleProgramActive(id, currentActive) {
  const { isOk } = await window.programsSdk.update(id, { active: !currentActive });
  if (isOk) { await loadCompanyPrograms(); showSuccessToast(currentActive ? 'Programa desactivado' : 'Programa activado'); }
}

async function deleteProgramItem(id, name) {
  const { isOk } = await window.programsSdk.delete(id);
  if (isOk) { await loadCompanyPrograms(); showSuccessToast(`Programa "${name}" eliminado`); }
}

// ------------------------------------------------------------
let _npSelectedEmoji = '🏆';
let _npImageBase64   = null;

const NP_EMOJI_LIST = [
  '🏆','🎯','💡','🤝','⭐','🚀','🔥','💪','🎉','✅',
  '❤️','🙌','👏','💎','🌟','🎁','🏅','🥇','💫','🌈',
  '🧠','⚡','🌱','🎨','🔑','🛡️','🎓','📈','💼','🤩',
];

function openNewProgramModal() {
  _editingProgramId    = null;
  _npSelectedEmployees = new Set();
  _npSelectedEmoji = '🏆';
  _npImageBase64       = null;
  document.getElementById('new-program-form').reset();
  document.getElementById('np-budget').value = '';
  document.getElementById('np-emp-count').textContent = '0 empleados seleccionados';
  document.getElementById('np-emoji-btn').textContent = '⭐ ';
  document.getElementById('np-emoji-picker').classList.add('hidden');
  document.getElementById('np-image-preview').classList.add('hidden');
  document.getElementById('np-image-placeholder').classList.remove('hidden');
  document.getElementById('np-image-clear').classList.add('hidden');
  document.getElementById('np-modal-title').textContent = 'Nuevo programa';
  document.getElementById('np-submit-btn').textContent  = 'Crear programa';
  document.getElementById('np-budget-status').classList.add('hidden');
  document.getElementById('np-budget-create').classList.remove('hidden');
  document.getElementById('np-budget-recharge').classList.add('hidden');
  document.getElementById('np-approval-notice').classList.add('hidden');
  document.getElementById('np-funding-source-wrap').classList.add('hidden');
  document.getElementById('np-fund-request').checked = true;
  document.getElementById('np-fund-self-error').classList.add('hidden');
  _updateNpFundingStyle();
  document.getElementById('np-emp-section').classList.remove('hidden');
  _buildEmojiGrid();
  _renderNpEmployeeList('');
  document.getElementById('new-program-modal').classList.remove('hidden');
  lucide.createIcons();
}

function _buildEmojiGrid() {
  const grid = document.getElementById('np-emoji-grid');
  if (!grid) return;
  grid.innerHTML = NP_EMOJI_LIST.map(em => `
    <button type="button" onclick="selectNpEmoji('${em}')"
      class="text-xl p-1.5 rounded-lg hover:bg-white hover:shadow transition text-center leading-none">${em}</button>
  `).join('');
}

function updateBudgetPreview() {
  const p = companyPrograms.find(x => x.id === _editingProgramId);
  if (!p) return;
  const remaining = _getProgramRemainingBudget(p);
  const added     = document.getElementById('np-budget-add').valueAsNumber || 0;
  document.getElementById('np-budget-preview').textContent = remaining + added;
}

function onNpBudgetInput() {
  if (_editingProgramId) return;
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const budget  = document.getElementById('np-budget').valueAsNumber || 0;
  const needsApproval = !isAdmin && budget > 0;

  document.getElementById('np-funding-source-wrap').classList.toggle('hidden', !needsApproval);
  document.getElementById('np-approval-notice').classList.toggle('hidden', !needsApproval);
  document.getElementById('np-submit-btn').textContent = needsApproval ? 'Solicitar aprobación' : 'Crear programa';

  if (needsApproval) {
    const avail = currentUser?.points_to_give ?? 0;
    document.getElementById('np-fund-self-balance').textContent = `Tenés ${avail} pts disponibles`;
    document.getElementById('np-fund-self-error').classList.toggle('hidden', avail >= budget);
    _updateNpFundingStyle();
  }
}

function _updateNpFundingStyle() {
  const isRequest = document.getElementById('np-fund-request').checked;
  document.getElementById('np-fund-request-lbl').className = `flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${isRequest ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'}`;
  document.getElementById('np-fund-self-lbl').className    = `flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${!isRequest ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'}`;
}

function toggleEmojiPicker() {
  document.getElementById('np-emoji-picker').classList.toggle('hidden');
}

function selectNpEmoji(emoji) {
  _npSelectedEmoji = emoji;
  document.getElementById('np-emoji-btn').textContent = emoji;
  document.getElementById('np-emoji-picker').classList.add('hidden');
}

let _cropper     = null;
let _cropContext = 'program'; // 'program' | 'recognition'
let _recogImageBase64   = null;
let _recogImageUrl      = null;
let _libraryCache = null;

// ------------------------------------------------------------
function expandImageSection() {
  document.getElementById('recog-img-collapsed').classList.add('hidden');
  document.getElementById('recog-img-placeholder').classList.remove('hidden');
  _renderImageLibrary();
}

async function _renderImageLibrary() {
  const grid = document.getElementById('img-panel-library');
  if (!grid) return;

  // Cache permanente por sesión (URLs públicas no expiran)
  if (_libraryCache) {
    grid.innerHTML = _libraryCache;
    return;
  }

  grid.innerHTML = '<div class="col-span-3 text-center py-6 text-gray-400 text-xs">Cargando imágenes...</div>';

  const { data: files, error } = await _sb.storage
    .from('image-library')
    .list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } });

  if (error || !files?.length) {
    grid.innerHTML = '<div class="col-span-3 text-center py-6 text-gray-400 text-xs">No hay imágenes en la biblioteca</div>';
    return;
  }

  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name));
  if (!imageFiles.length) {
    grid.innerHTML = '<div class="col-span-3 text-center py-6 text-gray-400 text-xs">No hay imágenes en la biblioteca</div>';
    return;
  }

  const items = imageFiles.map(f => ({
    url:  _sb.storage.from('image-library').getPublicUrl(f.name).data.publicUrl,
    name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
  }));

  grid.innerHTML = items.map(item => `
    <button type="button" onclick="selectLibraryImage('${item.url}', this)"
      class="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-violet-400 transition group aspect-video bg-gray-100"
      title="${item.name}">
      <img src="${item.url}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy">
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-end justify-start p-1">
        <span class="opacity-0 group-hover:opacity-100 text-white text-[10px] font-semibold bg-black/50 px-1.5 py-0.5 rounded-full transition capitalize">${item.name}</span>
      </div>
    </button>
  `).join('');
  _libraryCache = grid.innerHTML;

  // Disable hover effects while scrolling to prevent jank
  let _libScrollTimer = null;
  grid.addEventListener('scroll', () => {
    grid.classList.add('is-scrolling');
    clearTimeout(_libScrollTimer);
    _libScrollTimer = setTimeout(() => grid.classList.remove('is-scrolling'), 120);
  }, { passive: true });
}

function switchImageTab(tab) {
  const isLibrary = tab === 'library';
  document.getElementById('img-panel-library').classList.toggle('hidden', !isLibrary);
  document.getElementById('img-panel-upload').classList.toggle('hidden', isLibrary);
  document.getElementById('img-tab-library').className = isLibrary
    ? 'flex-1 py-1.5 text-xs font-semibold rounded-md bg-white text-violet-700 shadow-sm transition'
    : 'flex-1 py-1.5 text-xs font-semibold rounded-md text-gray-500 hover:text-gray-700 transition';
  document.getElementById('img-tab-upload').className = isLibrary
    ? 'flex-1 py-1.5 text-xs font-semibold rounded-md text-gray-500 hover:text-gray-700 transition'
    : 'flex-1 py-1.5 text-xs font-semibold rounded-md bg-white text-violet-700 shadow-sm transition';
}

function selectLibraryImage(url, btn) {
  // Highlight selected
  document.querySelectorAll('#img-panel-library button').forEach(b =>
    b.classList.remove('border-violet-500', 'ring-2', 'ring-violet-300')
  );
  btn.classList.add('border-violet-500', 'ring-2', 'ring-violet-300');
  // Show preview
  const preview = document.getElementById('recog-img-preview');
  preview.src = url;
  document.getElementById('recog-img-preview-wrap').classList.remove('hidden');
  document.getElementById('recog-img-placeholder').classList.add('hidden');
  // Las URLs de image-library son públicas permanentes — se usan directamente sin re-subir
  _recogImageUrl    = url;
  _recogImageBase64 = null;
}

function previewProgramImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => openCropModal(e.target.result, 'program');
  reader.readAsDataURL(file);
}

function handleRecogImageSelect(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => openCropModal(e.target.result, 'recognition');
  reader.readAsDataURL(file);
}

function openCropModal(src, context = 'program') {
  _cropContext = context;
  const modal = document.getElementById('crop-modal');
  const img   = document.getElementById('crop-source');
  const hint  = document.getElementById('crop-modal-hint');
  modal.classList.remove('hidden');
  lucide.createIcons();

  if (hint) hint.textContent = context === 'recognition'
    ? 'Arrastrá y ajustá el área de recorte para la imagen del reconocimiento.'
    : 'Arrastrá y ajustá el área de recorte. La proporción es fija para el banner.';

  img.src = src;
  if (_cropper) { _cropper.destroy(); _cropper = null; }

  img.onload = () => {
    _cropper = new Cropper(img, {
      aspectRatio: context === 'recognition' ? 16 / 9 : 3 / 1,
      viewMode:    1,
      dragMode:    'move',
      autoCropArea: 1,
      restore:     false,
      guides:      true,
      center:      true,
      highlight:   false,
      cropBoxMovable:   true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };
}

function closeCropModal() {
  document.getElementById('crop-modal').classList.add('hidden');
  if (_cropper) { _cropper.destroy(); _cropper = null; }
  if (_cropContext === 'program') {
    document.getElementById('np-image-input').value = '';
  } else {
    document.getElementById('file-input').value = '';
  }
}

function applyCrop() {
  if (!_cropper) return;
  const isRecog = _cropContext === 'recognition';
  const canvas  = _cropper.getCroppedCanvas(
    isRecog ? { width: 1200, height: 675 } : { width: 900, height: 300 }
  );
  const base64 = canvas.toDataURL('image/jpeg', 0.88);

  if (isRecog) {
    _recogImageBase64 = base64;
    const preview = document.getElementById('recog-img-preview');
    preview.src = base64;
    document.getElementById('recog-img-preview-wrap').classList.remove('hidden');
    document.getElementById('recog-img-placeholder').classList.add('hidden');
  } else {
    _npImageBase64 = base64;
    const preview = document.getElementById('np-image-preview');
    preview.src = base64;
    preview.classList.remove('hidden');
    document.getElementById('np-image-placeholder').classList.add('hidden');
    document.getElementById('np-image-clear').classList.remove('hidden');
  }

  document.getElementById('crop-modal').classList.add('hidden');
  _cropper.destroy();
  _cropper = null;
}

function clearRecogImage() {
  _recogImageBase64 = null;
  _recogImageUrl    = null;
  document.getElementById('file-input').value = '';
  document.getElementById('recog-img-preview-wrap').classList.add('hidden');
  document.getElementById('recog-img-placeholder').classList.add('hidden');
  document.getElementById('recog-img-collapsed').classList.remove('hidden');
  document.querySelectorAll('#img-panel-library button').forEach(b =>
    b.classList.remove('border-violet-500', 'ring-2', 'ring-violet-300')
  );
  switchImageTab('library');
}

function clearProgramImage() {
  _npImageBase64 = null;
  document.getElementById('np-image-input').value = '';
  document.getElementById('np-image-preview').classList.add('hidden');
  document.getElementById('np-image-placeholder').classList.remove('hidden');
  document.getElementById('np-image-clear').classList.add('hidden');
}

function closeNewProgramModal() {
  document.getElementById('new-program-modal').classList.add('hidden');
}

function filterProgramEmployees() {
  const q = document.getElementById('np-emp-search').value;
  _renderNpEmployeeList(q);
}

function _renderNpEmployeeList(query) {
  const list = document.getElementById('np-emp-list');
  const q = query.toLowerCase().trim();
  // Superadmin sees all users; others see only their company
  const source = currentUser?.role === 'superadmin'
    ? allUsers.filter(u => u.role !== 'superadmin')
    : allUsers.filter(u => u.company_id === currentUser?.company_id && u.email !== currentUser?.email);
  const filtered = q ? source.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  ) : source;

  if (!filtered.length) {
    list.innerHTML = '<p class="text-xs text-gray-400 text-center py-3">Sin resultados</p>';
    return;
  }

  list.innerHTML = filtered.map(u => {
    const id = u.__backendId || u.email;
    const checked = _npSelectedEmployees.has(id);
    const label = u.name || u.email;
    return `
      <label class="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition">
        <input type="checkbox" value="${id}" ${checked ? 'checked' : ''}
          onchange="toggleNpEmployee('${id}')"
          class="w-4 h-4 rounded border-gray-300 accent-celeste-500">
        <div class="w-7 h-7 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">
          ${(label[0] || '?').toUpperCase()}
        </div>
        <span class="text-sm text-gray-700">${label}</span>
      </label>`;
  }).join('');
}

function toggleNpEmployee(id) {
  if (_npSelectedEmployees.has(id)) _npSelectedEmployees.delete(id);
  else _npSelectedEmployees.add(id);
  document.getElementById('np-emp-count').textContent =
    `${_npSelectedEmployees.size} empleado${_npSelectedEmployees.size !== 1 ? 's' : ''} seleccionado${_npSelectedEmployees.size !== 1 ? 's' : ''}`;
}

async function _uploadProgramImage(dataUrl, programId) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `programs/${programId}-${Date.now()}.jpg`;
    const { error } = await _sb.storage.from('image-library')
      .upload(path, blob, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' });
    if (error) { _log('program image upload error:', error.message); return null; }
    return _sb.storage.from('image-library').getPublicUrl(path).data.publicUrl;
  } catch (err) { _log('program image upload error:', err); return null; }
}

async function submitNewProgram(e) {
  e.preventDefault();
  const name = document.getElementById('np-name').value.trim();
  const tag  = document.getElementById('np-tag').value.trim().replace(/^#/, '');
  const desc = document.getElementById('np-description').value.trim();

  let budget;
  if (_editingProgramId) {
    const p     = companyPrograms.find(x => x.id === _editingProgramId);
    const added = document.getElementById('np-budget-add').valueAsNumber || 0;
    budget      = (p?.budget || 0) + added;
  } else {
    budget = document.getElementById('np-budget').valueAsNumber || 0;
  }

  const newProgram = {
    emoji:       _npSelectedEmoji,
    name,
    tag:         tag || name.toLowerCase().replace(/\s+/g, '-'),
    description: desc,
    budget,
    employees:   [..._npSelectedEmployees],
    active:      true,
    custom:      true,
  };

  if (_editingProgramId) {
    const editingProg = companyPrograms.find(x => x.id === _editingProgramId);

    // Global program: only update name/emoji/tag/description, persisted per company
    if (editingProg?.global) {
      const idx = companyPrograms.findIndex(x => x.id === _editingProgramId);
      if (idx !== -1) {
        companyPrograms[idx] = {
          ...companyPrograms[idx],
          emoji:       _npSelectedEmoji,
          name,
          tag:         tag || name.toLowerCase().replace(/\s+/g, '-'),
          description: desc,
        };
      }
      await window.programsSdk.upsertOverride(currentUser.company_id, _editingProgramId, {
        emoji: _npSelectedEmoji, name, tag: tag || name.toLowerCase().replace(/\s+/g, '-'), description: desc,
      });
      closeNewProgramModal();
      renderProgramsPage();
      renderHomeProgramsWidget();
      renderProgramsInModal();
      if (currentPage === 'admin') renderProgramsAdmin();
      lucide.createIcons();
      showSuccessToast(`Programa "${name}" actualizado`);
      return;
    }

    const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    const added   = document.getElementById('np-budget-add').valueAsNumber || 0;

    if (!isAdmin && added > 0) {
      await _submitProgramApprovalRequest(
        { name: editingProg?.name || name, emoji: editingProg?.emoji || _npSelectedEmoji },
        added,
        _editingProgramId
      );
      closeNewProgramModal();
      return;
    }

    const idx = companyPrograms.findIndex(x => x.id === _editingProgramId);
    if (idx !== -1) {
      const old        = companyPrograms[idx];
      const newRemaining = _getProgramRemainingBudget(old) + (budget - (old.budget || 0));
      // _npImageBase64: null = cleared, data: URL = new upload, otherwise = unchanged existing URL
      const imageUrl = (_npImageBase64 && _npImageBase64.startsWith('data:'))
        ? (await _uploadProgramImage(_npImageBase64, _editingProgramId) || old.image_url || null)
        : (_npImageBase64 || null);

      const updates = {
        emoji: newProgram.emoji, name: newProgram.name, tag: newProgram.tag,
        description: newProgram.description, budget, budget_remaining: Math.max(0, newRemaining),
        target_employee_ids: newProgram.employees, image_url: imageUrl,
      };
      await window.programsSdk.update(_editingProgramId, updates);
      companyPrograms[idx] = {
        ...old, ...updates, id: _editingProgramId, employees: newProgram.employees, image: imageUrl, custom: true,
      };
    }
    closeNewProgramModal();
    renderProgramsPage();
    renderHomeProgramsWidget();
    renderProgramsInModal();
    lucide.createIcons();
    showSuccessToast(`Programa "${name}" actualizado`);
    return;
  }

  const isAdmin2 = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  if (!isAdmin2 && budget > 0) {
    const fundingSource = document.getElementById('np-fund-self')?.checked ? 'self' : 'request';
    if (fundingSource === 'self') {
      const avail = currentUser?.points_to_give ?? 0;
      if (avail < budget) {
        showErrorToast(`No tenés suficientes puntos (tenés ${avail}, necesitás ${budget}).`);
        return;
      }
      // Deduct immediately from employee wallet
      currentUser.points_to_give = avail - budget;
      if (isImpersonating) {
        // auth.uid() is the superadmin — deduct from the impersonated employee directly
        window.dataSdk.deductPointsFor(currentUser.__backendId, budget).catch(_log);
        const empRecord = allUsers.find(u => u.__backendId === currentUser.__backendId);
        if (empRecord) empRecord.points_to_give = currentUser.points_to_give;
      } else {
        window.dataSdk.deductPoints(budget).catch(_log);
      }
      updateAllPointsDisplays();
    }
    await _submitProgramApprovalRequest(newProgram, budget, null, fundingSource);
    closeNewProgramModal();
    return;
  }

  const { isOk, data } = await window.programsSdk.create({
    company_id:          currentUser?.company_id,
    name:                newProgram.name,
    emoji:               newProgram.emoji,
    tag:                 newProgram.tag,
    description:         newProgram.description,
    budget:              newProgram.budget,
    budget_remaining:    newProgram.budget,
    target_employee_ids: newProgram.employees,
    custom:              true,
    active:              true,
    created_by:          currentUser?.__backendId || null,
  });
  if (!isOk) { showErrorToast('Error al crear el programa'); return; }

  const imageUrl = await _uploadProgramImage(_npImageBase64, data.id);
  if (imageUrl) await window.programsSdk.update(data.id, { image_url: imageUrl });

  companyPrograms.push(_mapDbProgram({ ...data, image_url: imageUrl }));
  closeNewProgramModal();
  renderProgramsPage();
  renderHomeProgramsWidget();
  renderProgramsInModal();
  showSuccessToast(`Programa "${name}" creado`);
}

function toggleProgramMenu(id, e) {
  e.stopPropagation();
  const menu = document.getElementById(`pmenu-${id}`);
  const isOpen = !menu.classList.contains('hidden');
  closeProgramMenus();
  if (!isOpen) menu.classList.remove('hidden');
}

function closeProgramMenus() {
  document.querySelectorAll('[id^="pmenu-"]').forEach(m => m.classList.add('hidden'));
}

document.addEventListener('click', closeProgramMenus);

// Prevent browser autofill on the global search input
function _clearSearchInput() {
  const s = document.getElementById('global-search-input');
  if (s) { s.value = ''; s.setAttribute('readonly', ''); }
}
window.addEventListener('load',     _clearSearchInput);
window.addEventListener('pageshow', _clearSearchInput);
// Extra: clear after a short delay to catch late autofill
window.addEventListener('load', () => setTimeout(_clearSearchInput, 500));

// ------------------------------------------------------------

function openDeleteProgramModal(id, name) {
  _deletingProgramId = id;
  document.getElementById('delete-program-name').textContent = name;
  document.getElementById('delete-program-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeDeleteProgramModal() {
  document.getElementById('delete-program-modal').classList.add('hidden');
  _deletingProgramId = null;
}

async function confirmDeleteProgram() {
  if (!_deletingProgramId) return;
  companyPrograms = companyPrograms.filter(p => p.id !== _deletingProgramId);
  await window.programsSdk.delete(_deletingProgramId);
  closeDeleteProgramModal();
  renderProgramsPage();
  renderHomeProgramsWidget();
  renderProgramsInModal();
  showSuccessToast('Programa eliminado');
}

// ── Superadmin: eliminar cualquier programa con motivo ──────────────────────
let _saDeleteProgramId  = null;
let _saDeleteRequestId  = null;
let _saDeleteCompanyId  = null;

function openSaDeleteProgramModal(programId, programName, requestId = null, companyId = null) {
  _saDeleteProgramId = programId;
  _saDeleteRequestId = requestId;
  _saDeleteCompanyId = companyId;
  document.getElementById('sa-delete-program-name').textContent = programName;
  document.getElementById('sa-delete-reason').value = '';
  document.getElementById('sa-delete-reason-error').classList.add('hidden');
  document.getElementById('sa-delete-program-modal').classList.remove('hidden');
  lucide.createIcons();
  setTimeout(() => document.getElementById('sa-delete-reason').focus(), 100);
}

function closeSaDeleteProgramModal() {
  document.getElementById('sa-delete-program-modal').classList.add('hidden');
  _saDeleteProgramId = null;
  _saDeleteRequestId = null;
  _saDeleteCompanyId = null;
}

async function confirmSaDeleteProgram() {
  const reason = document.getElementById('sa-delete-reason').value.trim();
  if (!reason) {
    document.getElementById('sa-delete-reason-error').classList.remove('hidden');
    return;
  }

  const programName = document.getElementById('sa-delete-program-name').textContent;
  const prog        = companyPrograms.find(p => p.id === _saDeleteProgramId);
  const companyId   = _saDeleteCompanyId || prog?.company_id || currentUser?.company_id;
  const budget      = Number(prog?.budget) || 0;

  // Find associated request (queue or history) to determine funding source
  const allReqs   = [..._approvalsQueue, ..._approvalsHistory];
  const assocReq  = _saDeleteRequestId
    ? allReqs.find(r => r.id === _saDeleteRequestId)
    : allReqs.find(r => r.pendingProgramId === _saDeleteProgramId);
  const funding   = assocReq?.fundingSource || 'request';
  const isPending = prog?.pending === true;
  const isApproved = prog?.active === true;

  // ── Refund logic ──────────────────────────────────────────────────────────
  if (budget > 0 && window.dataSdk) {
    if (funding === 'self') {
      // Employee self-funded — always refund to creator
      const creatorId = prog?.createdBy || assocReq?.requestedByUserId;
      if (creatorId) {
        await window.dataSdk.refundPoints(creatorId, budget).catch(_log);
        const u = allUsers.find(u => u.__backendId === creatorId);
        if (u) u.points_to_give = (u.points_to_give || 0) + budget;
        if (creatorId === currentUser?.__backendId) {
          currentUser.points_to_give = (currentUser.points_to_give || 0) + budget;
          updateAllPointsDisplays();
        }
      }
    } else if (isApproved) {
      // Admin-funded and already approved — refund to company admin(s)
      const companyAdmins = allUsers.filter(u =>
        u.company_id === companyId &&
        (u.role === 'admin' || u.role === 'superadmin') &&
        u.__backendId
      );
      // Refund to first admin found (the one who would have approved)
      const adminToRefund = companyAdmins[0];
      if (adminToRefund) {
        await window.dataSdk.refundPoints(adminToRefund.__backendId, budget).catch(_log);
        adminToRefund.points_to_give = (adminToRefund.points_to_give || 0) + budget;
        if (adminToRefund.__backendId === currentUser?.__backendId) {
          currentUser.points_to_give = adminToRefund.points_to_give;
          updateAllPointsDisplays();
        }
      }
    }
    // isPending + request funding: admin never paid yet, no refund needed
  }

  // Remove from local programs and the database
  companyPrograms = companyPrograms.filter(p => p.id !== _saDeleteProgramId);
  await window.programsSdk.delete(_saDeleteProgramId);

  // Cancel the pending request in Supabase if applicable
  const reqIdToCancel = _saDeleteRequestId || assocReq?.id;
  if (reqIdToCancel && window.approvalsSdk) {
    window.approvalsSdk.updateStatus(reqIdToCancel, 'rejected', currentUser?.__backendId).catch(_log);
    _approvalsQueue   = _approvalsQueue.filter(r => r.id !== reqIdToCancel);
    _approvalsHistory = _approvalsHistory.filter(r => r.id !== reqIdToCancel);
  }

  // Notify all admins of the company
  const admins = allUsers.filter(u =>
    u.company_id === companyId &&
    (u.role === 'admin' || u.role === 'superadmin') &&
    u.__backendId !== currentUser?.__backendId
  );
  const refundNote = budget > 0 && (funding === 'self' || isApproved)
    ? ` Se devolvieron ${budget} pts a la billetera ${funding === 'self' ? 'del empleado' : 'del administrador'}.`
    : '';
  if (admins.length && window.notificationSdk) {
    window.notificationSdk.send(admins.map(a => ({
      user_id: a.__backendId,
      type:    'program_deleted_by_superadmin',
      data:    {
        program_name:  programName,
        reason,
        deleted_by:    currentUser?.name || 'Superadmin',
        refund_note:   refundNote,
      },
    }))).catch(_log);
  }

  closeSaDeleteProgramModal();
  renderProgramsPage();
  renderHomeProgramsWidget();
  renderProgramsInModal();
  if (currentPage === 'approvals') renderApprovalsPage();
  showSuccessToast(`Programa "${programName}" eliminado${refundNote}`);
}

// ------------------------------------------------------------
let _historyProgramLabel = null;
let _historyOffset      = 0;
const HISTORY_LIMIT     = 10;

async function openProgramHistory(id) {
  const p = companyPrograms.find(x => x.id === id);
  if (!p) return;
  _historyProgramId    = id;
  _historyProgramLabel = `${p.emoji} ${p.name}`;
  _historyOffset       = 0;

  document.getElementById('history-modal-title').textContent = `${p.emoji} ${p.name}`;
  document.getElementById('program-history-modal').classList.remove('hidden');
  await _renderProgramHistory(true);
}

function closeProgramHistory() {
  document.getElementById('program-history-modal').classList.add('hidden');
  _historyProgramId    = null;
  _historyProgramLabel = null;
}

async function _renderProgramHistory(reset = true) {
  const container = document.getElementById('history-feed');
  if (!container) return;

  if (reset) {
    _historyOffset = 0;
    container.innerHTML = '<div class="text-center py-10"><i data-lucide="loader" class="w-8 h-8 animate-spin text-violet-400 mx-auto"></i></div>';
    lucide.createIcons();
  }

  const companyId    = currentUser?.role === 'superadmin' && !isImpersonating
    ? null : currentUser?.company_id;
  const useEdge      = isImpersonating && !!companyId;
  const { isOk, data } = useEdge
    ? await window.recognitionSdk.listForCompany(companyId, _historyOffset, HISTORY_LIMIT, _historyProgramLabel)
    : await window.recognitionSdk.list(_historyOffset, HISTORY_LIMIT, companyId, _historyProgramLabel);

  document.getElementById('history-load-more')?.remove();

  if (reset) container.innerHTML = '';

  if (!isOk) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Error al cargar el historial.</p>';
    return;
  }
  if (!data.length && _historyOffset === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No hay reconocimientos en este programa todavía.</p>';
    return;
  }

  const seenGidsH = new Set();
  const dedupedH  = data.filter(rec => {
    const g = _parseGroupMarker(rec.message);
    if (!g) return true;
    if (seenGidsH.has(g.gid)) return false;
    seenGidsH.add(g.gid);
    return true;
  });
  dedupedH.forEach(rec => { if (_canViewRecognition(rec)) container.appendChild(buildFeedCard(rec)); });
  _historyOffset += data.length;
  lucide.createIcons();

  if (data.length === HISTORY_LIMIT) {
    const btn = document.createElement('button');
    btn.id        = 'history-load-more';
    btn.className = 'w-full py-3 text-sm font-medium text-violet-600 hover:text-violet-700 transition';
    btn.textContent = 'Cargar más';
    btn.onclick   = () => _renderProgramHistory(false);
    container.appendChild(btn);
  }
}

// ------------------------------------------------------------

function openEditProgramModal(id) {
  const p = companyPrograms.find(x => x.id === id);
  if (!p || (!p.custom && !p.global)) return;
  if (p.global && currentUser?.role !== 'superadmin') return;

  _editingProgramId    = id;
  _npSelectedEmoji     = p.emoji || '🏆';
  _npSelectedEmployees = new Set(p.employees || []);
  _npImageBase64       = p.image || null;

  document.getElementById('np-name').value        = p.name || '';
  document.getElementById('np-tag').value         = p.tag  || '';
  document.getElementById('np-description').value = p.description || '';
  document.getElementById('np-emoji-btn').textContent = _npSelectedEmoji;
  document.getElementById('np-emoji-picker').classList.add('hidden');
  document.getElementById('np-modal-title').textContent = 'Editar programa';
  document.getElementById('np-submit-btn').textContent  = 'Guardar cambios';

  if (p.global) {
    // Global programs: hide budget and employee sections
    document.getElementById('np-budget-status').classList.add('hidden');
    document.getElementById('np-budget-create').classList.add('hidden');
    document.getElementById('np-budget-recharge').classList.add('hidden');
    document.getElementById('np-emp-section').classList.add('hidden');
  } else {
    document.getElementById('np-emp-section').classList.remove('hidden');
    document.getElementById('np-emp-search').value = '';
    // Budget: mostrar estado actual y campo de recarga
    const remaining = _getProgramRemainingBudget(p);
    document.getElementById('np-budget-remaining').textContent = remaining;
    document.getElementById('np-budget-total').textContent     = p.budget || 0;
    document.getElementById('np-budget-preview').textContent   = remaining;
    document.getElementById('np-budget-add').value             = '';
    document.getElementById('np-budget-status').classList.remove('hidden');
    document.getElementById('np-budget-create').classList.add('hidden');
    document.getElementById('np-budget-recharge').classList.remove('hidden');

    _renderNpEmployeeList('');
    document.getElementById('np-emp-count').textContent =
      `${_npSelectedEmployees.size} empleado${_npSelectedEmployees.size !== 1 ? 's' : ''} seleccionado${_npSelectedEmployees.size !== 1 ? 's' : ''}`;
  }

  const preview = document.getElementById('np-image-preview');
  if (_npImageBase64) {
    preview.src = _npImageBase64;
    preview.classList.remove('hidden');
    document.getElementById('np-image-placeholder').classList.add('hidden');
    document.getElementById('np-image-clear').classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
    document.getElementById('np-image-placeholder').classList.remove('hidden');
    document.getElementById('np-image-clear').classList.add('hidden');
  }

  _buildEmojiGrid();
  document.getElementById('new-program-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeNewProgramModal() {
  document.getElementById('new-program-modal').classList.add('hidden');
  _editingProgramId = null;
}

// ------------------------------------------------------------

function _getProgramRemainingBudget(p) {
  if (!p.budget) return 0;
  return p.budget_remaining !== null && p.budget_remaining !== undefined ? p.budget_remaining : p.budget;
}

function _deductProgramBudget(id, points) {
  const p = companyPrograms.find(x => x.id === id);
  if (!p) return;
  const remaining = Math.max(0, _getProgramRemainingBudget(p) - points);
  p.budget_remaining = remaining;
  window.programsSdk.update(id, { budget_remaining: remaining }).catch(_log);
}

//    Support Widget                                                             
const _FAQ = [
  { q: '¿Cómo enviar un reconocimiento?',
    a: 'Hacé clic en algún botón de "Reconocer" o buscá a un compañero en el box de búsqueda del inicio. Elegí la persona y seguí los pasos para enviar un mensaje significativo a tu compañero.' },
  { q: '¿Cómo crear un programa personalizado?',
    a: 'En el panel lateral, hace click en "Programas". Hacé clic en el botón "+ Nuevo programa" del lado derecho y seguí los pasos para crear un programa, acordáte de leer los consejos y condiciones.' },
  { q: '¿Cómo canjear puntos?',
    a: 'Si tenés puntos para canjear podés hacer clic en tu saldo en la pantalla de inicio o en el botón de "Store" en el panel lateral para navegar por la tienda y ver todos los canjes posibles. Seleccioná el artículo que quieras y seguí los pasos para completar tu pedido.' },
  { q: '¿Qué es un reconocimiento privado?',
    a: 'Solo lo ven vos, el destinatario y los administradores de la plataforma. No aparece en el feed público. Activálo con el toggle en el paso 3 del modal.' },
  { q: '¿Cómo cambiar mi contraseña?',
    a: 'Hacé clic en tu avatar en la barra lateral. Desde Configuración de perfil encontrás la opción para actualizar la contraseña.' },
];

let _supportOpen = false;
let _supportTab  = 'faq';
let _faqOpen     = -1; // index of open FAQ item

function toggleSupport() {
  _supportOpen = !_supportOpen;
  const panel = document.getElementById('support-panel');
  const btn   = document.getElementById('support-btn');
  if (!panel) return;
  if (_supportOpen) {
    panel.classList.remove('hidden');
    panel.style.animation = 'slideUp .25s ease both';
    _renderFaqItems();
    setSupportTab('faq');
    lucide.createIcons();
    if (btn) btn.innerHTML = '<i data-lucide="x" class="w-5 h-5 shrink-0"></i><span class="text-sm font-semibold">Cerrar</span>';
  } else {
    panel.classList.add('hidden');
    if (btn) btn.innerHTML = '<i data-lucide="help-circle" class="w-5 h-5 shrink-0"></i><span class="text-sm font-semibold">Ayuda</span>';
  }
  lucide.createIcons();
}

function setSupportTab(tab) {
  _supportTab = tab;
  const isFaq = tab === 'faq';
  document.getElementById('support-faq')?.classList.toggle('hidden', !isFaq);
  document.getElementById('support-contact')?.classList.toggle('hidden', isFaq);
  const activeC = 'flex-1 py-2.5 text-xs font-semibold text-[#3d2b56] border-b-2 border-[#3d2b56] transition';
  const idleC   = 'flex-1 py-2.5 text-xs font-semibold text-gray-400 border-b-2 border-transparent transition hover:text-gray-600';
  const tfaq    = document.getElementById('support-tab-faq');
  const tcon    = document.getElementById('support-tab-contact');
  if (tfaq) tfaq.className = isFaq ? activeC : idleC;
  if (tcon) tcon.className = isFaq ? idleC   : activeC;
}

function _renderFaqItems() {
  const container = document.getElementById('support-faq');
  if (!container) return;
  container.innerHTML = _FAQ.map((item, i) => `
    <div class="rounded-xl border border-gray-100 overflow-hidden">
      <button onclick="toggleFaq(${i})"
        class="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left bg-gray-50 hover:bg-violet-50 transition">
        <span class="text-xs font-semibold text-gray-700 leading-snug">${esc(item.q)}</span>
        <i data-lucide="${_faqOpen === i ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5 text-gray-400 shrink-0"></i>
      </button>
      <div class="${_faqOpen === i ? '' : 'hidden'} px-3.5 py-3 bg-white border-t border-gray-100">
        <p class="text-xs text-gray-600 leading-relaxed">${esc(item.a)}</p>
      </div>
    </div>`).join('');
  lucide.createIcons();
}

function toggleFaq(idx) {
  _faqOpen = _faqOpen === idx ? -1 : idx;
  _renderFaqItems();
}

async function submitSupportForm() {
  const message = document.getElementById('support-message')?.value?.trim();
  const subject = document.getElementById('support-subject')?.value || 'Consulta general';
  if (!message) { showErrorToast('Escribí tu consulta antes de enviar'); return; }

  const btn = document.querySelector('#support-contact button[onclick="submitSupportForm()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando...'; lucide.createIcons(); }

  const result = await window.supportSdk?.submit({
    userId:    currentUser?.__backendId || null,
    companyId: currentUser?.company_id  || null,
    name:      currentUser?.name  || '',
    email:     currentUser?.email || '',
    subject,
    message,
  }) || { isOk: true };

  if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i> Enviar consulta'; lucide.createIcons(); }

  if (result.isOk) {
    document.getElementById('support-message').value = '';
    const sent = document.getElementById('support-sent-msg');
    if (sent) { sent.classList.remove('hidden'); setTimeout(() => sent.classList.add('hidden'), 4000); }
  } else {
    showErrorToast('No se pudo enviar. Intentá de nuevo.');
  }
}

//    Onboarding                                                                 
let _onboardingStep = 1;

function _obKey() {
  return `allay_onboarded_${currentUser?.__backendId || currentUser?.email || 'guest'}`;
}

function _checkOnboarding() {
  if (!currentUser || localStorage.getItem(_obKey())) return;
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  // Set welcome name
  const nameEl = document.getElementById('ob-welcome-name');
  if (nameEl) nameEl.textContent = currentUser.name?.split(' ')[0] || currentUser.name || '';
  _setOnboardingStep(1);
  overlay.classList.remove('hidden');
  lucide.createIcons();
}

function _setOnboardingStep(n) {
  _onboardingStep = n;
  [1, 2, 3].forEach(i => {
    document.getElementById(`ob-step-${i}`)?.classList.toggle('hidden', i !== n);
  });
  // Progress bar
  const prog = document.getElementById('ob-progress');
  if (prog) prog.style.width = `${Math.round((n / 3) * 100)}%`;
  // Dots
  document.querySelectorAll('.ob-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.className = `ob-dot w-2 h-2 rounded-full transition-all ${s <= n ? 'bg-[#3d2b56]' : 'bg-gray-200'}`;
  });
  // Buttons
  const back = document.getElementById('ob-btn-back');
  const next = document.getElementById('ob-btn-next');
  const skip = document.getElementById('ob-btn-skip');
  if (back) back.classList.toggle('hidden', n === 1);
  if (next) next.classList.toggle('hidden', n === 3);
  if (skip) skip.classList.toggle('hidden', n === 3);
}

function nextOnboardingStep() {
  if (_onboardingStep < 3) _setOnboardingStep(_onboardingStep + 1);
}

function prevOnboardingStep() {
  if (_onboardingStep > 1) _setOnboardingStep(_onboardingStep - 1);
}

function completeOnboarding(andOpenRecognition = false) {
  try { localStorage.setItem(_obKey(), '1'); } catch (_) {}
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .3s ease';
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.style.opacity = '';
      overlay.style.transition = '';
      if (andOpenRecognition) openModal();
    }, 300);
  }
}

