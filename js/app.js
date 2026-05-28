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
                'user-profile-page'];
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
let currentUser = null;
let _companyMemberIds = null; // pre-computed Set, rebuilt only when allUsers changes
let originalSuperadminUser = null;
let isImpersonating = false;
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
  { id: 2, type: 'comment',          name: 'Ana López',            action: 'comentó en tu reconocimiento',   message: '¡Totalmente merecido! María es increíble �xS', time: '2 horas',  read: false },
  { id: 3, type: 'reaction_multiple',name: 'Diego Torres y otros', action: 'reaccionaron ❤️ a tu reconocimiento', time: '3 horas',  read: true  },
  { id: 4, type: 'recognition',      name: 'Lucas Méndez',         action: 'te reconoció',                   emoji: '⭐', time: '5 horas',  read: true  },
  { id: 5, type: 'milestone',        name: 'Sistema',              action: 'Alcanzaste 500 puntos acumulados', emoji: '�x}0', time: '1 día',   read: true  }
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
      loadCompanyPrograms();
      _loadApprovals();
      loadHomeSidebar();
      _setupFeedRealtime();
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

function logout() {
  // Tear down realtime channels before clearing session
  if (_feedRealtimeChannel) {
    window.recognitionSdk.unsubscribeChannel(_feedRealtimeChannel);
    _feedRealtimeChannel = null;
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
    el.textContent = ok ? '�S' : '�9';
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

  countEl.textContent = `${displayEmployees.length} ${displayEmployees.length === 1 ? 'empleado' : 'empleados'}`;

  if (displayEmployees.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No hay empleados cargados. Sube un archivo CSV para comenzar.</p>';
    return;
  }

  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  container.innerHTML = displayEmployees.map(emp => `
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

  renderPeopleList();
  lucide.createIcons();
}

function renderPeopleList() {
  const container = document.getElementById('people-list');
  if (!container || !currentUser) {
    if (container) container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No hay empleados disponibles</p>';
    return;
  }

  const available = allUsers.filter(emp =>
    (currentUser.role === 'superadmin' || emp.company_id === currentUser.company_id) &&
    emp.email !== currentUser.email
  );

  if (available.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No hay empleados disponibles para reconocer</p>';
    return;
  }

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
      <button type="button" onclick="removeRecipient('${esc(r.id)}')" class="text-violet-400 hover:text-violet-600 leading-none font-bold">�</button>
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
  const lines   = csvText.split('\n').filter(l => l.trim());
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());

  const idx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
  const nameIdx         = idx(['nombre', 'name']);
  const emailIdx        = idx(['email', 'correo']);
  const passwordIdx     = idx(['contraseña', 'password', 'pass']);
  const deptIdx         = idx(['departamento', 'department', 'depto']);
  const companyIdx      = idx(['empresa', 'company_id', 'company']);
  const roleIdx         = idx(['rol', 'role']);
  const giveIdx         = idx(['para_dar', 'to_give', 'puntos_dar']);
  const redeemIdx       = idx(['para_canjear', 'to_redeem', 'puntos_canjear']);
  const birthdayIdx     = idx(['cumpleaños', 'cumpleanos', 'birthday', 'nacimiento']);
  const anniversaryIdx  = idx(['aniversario', 'anniversary', 'fecha_ingreso', 'ingreso']);

  const newEmployees = [];
  const duplicates   = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length >= 5 && cols[0]) {
      const email = cols[emailIdx] || cols[1];
      if (allUsers.find(emp => emp.email === email)) { duplicates.push(email); continue; }
      const rawRole = (roleIdx !== -1 ? cols[roleIdx] : '') || 'employee';
      const validRole = ['employee', 'admin', 'superadmin'].includes(rawRole) ? rawRole : 'employee';

      // Birthday: acepta DD/MM o MM/DD o DD-MM — normaliza a DD/MM
      let birthday = null;
      if (birthdayIdx !== -1 && cols[birthdayIdx]) {
        const raw = cols[birthdayIdx].replace(/-/g, '/');
        if (/^\d{1,2}\/\d{1,2}$/.test(raw)) birthday = raw.padStart(5, '0').substring(0, 5);
      }
      // Anniversary: acepta YYYY-MM-DD o DD/MM/YYYY — normaliza a YYYY-MM-DD
      let anniversary_date = null;
      if (anniversaryIdx !== -1 && cols[anniversaryIdx]) {
        const raw = cols[anniversaryIdx];
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) anniversary_date = raw;
        else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
          const [d, m, y] = raw.split('/');
          anniversary_date = `${y}-${m}-${d}`;
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
  return { employees: newEmployees, duplicates };
}

async function uploadEmployees() {
  if (!selectedFile) return;
  if (currentUser?.role !== 'superadmin') { showErrorToast('Solo superadmin puede cargar empleados'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const { employees: newEmps, duplicates } = parseCSV(e.target.result);

    if (newEmps.length === 0) {
      showErrorToast(duplicates.length > 0 ? `${duplicates.length} empleado(s) ya existen. No se cargó nada nuevo.` : 'No se pudieron procesar empleados del archivo');
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

    await window.dataSdk.refresh();
    filterEmployeesByCompany();
    renderEmployeesList();

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
          <p class="text-xs text-amber-600 mt-0.5">Ya existe en la plataforma � omitido</p>
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

async function deleteEmployee(id) {
  const emp = allUsers.find(e => e.__backendId === id);
  if (!emp) return;
  const result = await window.dataSdk.delete(emp);
  if (result.isOk) showSuccessToast(`${emp.name} eliminado`);
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

function openNotificationsPage() {
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

function renderNotificationsPage() {
  const container = document.getElementById('notifications-list-page');
  const filtered  = notificationsTab === 'unread' ? notificationsList.filter(n => !n.read) : notificationsList;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <i data-lucide="inbox" class="w-16 h-16 mx-auto text-gray-300 mb-4"></i>
        <p class="text-gray-500 font-medium">${notificationsTab === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(notif => {
    const unreadClass = notif.read ? 'border-gray-200 bg-white' : 'border-violet-300 bg-violet-50';
    const nid   = Number.isInteger(notif.id) ? notif.id : 0;
    const nname = esc(notif.name  || '');
    const nact  = esc(notif.action || '');
    const nmsg  = esc(notif.message || '');
    const ntime = esc(notif.time  || '');
    // ------------------------------------------------------------
    const initial = esc((notif.name || '?').charAt(0).toUpperCase());

    const actions = `
      <div class="flex gap-2 shrink-0">
        <button onclick="markNotificationRead(${nid})" class="p-2 rounded-lg hover:bg-gray-100 transition" title="Marcar como leída">
          <i data-lucide="check" class="w-4 h-4 text-gray-400 hover:text-violet-600"></i>
        </button>
        <button onclick="deleteNotification(${nid})" class="p-2 rounded-lg hover:bg-red-50 transition" title="Eliminar">
          <i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i>
        </button>
      </div>`;

    if (notif.type === 'comment') {
      return `
        <div class="p-4 rounded-xl border ${notif.read ? 'border-gray-200 bg-white' : 'border-blue-300 bg-blue-50'} hover:shadow-md transition cursor-pointer group">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0 group-hover:scale-105 transition">${initial}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-800"><span class="font-semibold">${nname}</span> ${nact}</p>
              <p class="text-xs text-gray-600 mt-1.5 italic">"${nmsg}"</p>
              <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${ntime}</p>
            </div>${actions}
          </div>
        </div>`;
    }
    if (notif.type === 'milestone') {
      return `
        <div class="p-4 rounded-xl border ${notif.read ? 'border-gray-200 bg-white' : 'border-yellow-300 bg-yellow-50'} hover:shadow-md transition cursor-pointer group">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-[#f19ac4] flex items-center justify-center text-white font-bold shrink-0 group-hover:scale-105 transition">�x}�</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-800"><span class="font-semibold">${nname}</span> ${nact}</p>
              <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${ntime}</p>
            </div>
            <span class="text-2xl shrink-0">${nemoji}</span>
            ${actions}
          </div>
        </div>`;
    }
    // recognition / reaction_multiple
    const avatarGrad = notif.type === 'reaction_multiple' ? 'bg-[#c9a7d4]' : 'bg-[#3d2b56]';
    const avatarContent = notif.type === 'reaction_multiple'
      ? `+${Math.floor(Math.random() * 5) + 2}`
      : initial;
    const borderCol = notif.type === 'reaction_multiple'
      ? (notif.read ? 'border-gray-200 bg-white' : 'border-purple-300 bg-purple-50')
      : unreadClass;
    return `
      <div class="p-4 rounded-xl border ${borderCol} hover:shadow-md transition cursor-pointer group">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full ${avatarGrad} flex items-center justify-center text-white font-bold shrink-0 group-hover:scale-105 transition text-xs">${avatarContent}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-800"><span class="font-semibold">${nname}</span> ${nact}</p>
            <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${ntime}</p>
          </div>
          ${nemoji ? `<span class="text-2xl shrink-0">${nemoji}</span>` : ''}
          ${actions}
        </div>
      </div>`;
  }).join('');

  lucide.createIcons();
}

function markNotificationRead(id) {
  const n = notificationsList.find(n => n.id === id);
  if (n) { n.read = true; renderNotificationsPage(); updateNotificationBadge(); }
}

function deleteNotification(id) {
  notificationsList = notificationsList.filter(n => n.id !== id);
  renderNotificationsPage();
  updateNotificationBadge();

  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-gray-700 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold';
  toast.style.animation = 'scaleIn 0.3s ease';
  toast.innerHTML = '<i data-lucide="trash-2" class="w-5 h-5"></i> <span>Notificación eliminada</span>';
  document.body.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => toast.remove(), 2000);
}

function markAllAsRead() {
  notificationsList.forEach(n => n.read = true);
  renderNotificationsPage();
  updateNotificationBadge();
  showSuccessToast('Todas las notificaciones marcadas como leídas');
}

function updateNotificationBadge() {
  const unread  = notificationsList.filter(n => !n.read).length;
  document.getElementById('btn-notif').classList.toggle('notification-dot', unread > 0);
}

function clearNotifications() {
  document.getElementById('notifications-list').innerHTML = '<div class="p-6 text-center text-gray-400 text-sm">No hay notificaciones</div>';
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
    seg.className = `h-4 w-5 rounded transition-all duration-500 ${i <= filled ? 'bg-[#3d2b56]' : 'bg-gray-100'}`;
  }

  const label = document.getElementById('battery-label');
  const msg   = document.getElementById('battery-msg');
  if (label) label.textContent = `${filled} / ${MAX} esta semana`;
  if (msg)   msg.textContent   = MSGS[Math.min(filled, MSGS.length - 1)];
}

// ─────────────────────────────────────────
// BUDGET KEY
// ─────────────────────────────────────────
function _getBudgetKey(programId) {
  return `allay_budget_${currentUser?.company_id || 'default'}_${programId}`;
}

function updateProfileDisplay() {
  if (!currentUser) return;
  const initials  = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const firstName = currentUser.name.split(' ')[0];

  const avatar = document.getElementById('btn-profile')?.querySelector('div');
  if (avatar) avatar.textContent = initials;

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
  try {
    const raw  = localStorage.getItem(_aboutMeKey());
    const data = raw ? JSON.parse(raw) : {};
    const set  = (id, val) => {
      const el = document.getElementById(id);
      if (el) { el.value = val||''; updateAboutMeCounter(el, id.replace('up-','up-').replace(/$/,'-count'), parseInt(el.maxLength)||250); }
    };
    set('up-bio',       data.bio       || '');
    set('up-interests', data.interests || '');
    set('up-workstyle', data.workStyle  || '');
    _renderAboutMeTags('up-interests', 'up-interests-tags');
    _renderAboutMeTags('up-workstyle',  'up-workstyle-tags');
    // Load preferences
    _applyPrefButtons('vis',  data.visibility || 'public');
    _applyPrefButtons('bday', data.birthday   || 'yes');
  } catch(_) {}
}

function saveAboutMe() {
  try {
    const get  = id => document.getElementById(id)?.value?.trim() || '';
    const raw  = localStorage.getItem(_aboutMeKey());
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(_aboutMeKey(), JSON.stringify({
      bio:        get('up-bio'),
      interests:  get('up-interests'),
      workStyle:  get('up-workstyle'),
      visibility: prev.visibility || 'public',
      birthday:   prev.birthday   || 'yes',
    }));
    _renderAboutMeTags('up-interests', 'up-interests-tags');
    _renderAboutMeTags('up-workstyle',  'up-workstyle-tags');
    const s = document.getElementById('up-bio-saved');
    if (s) { s.classList.remove('hidden'); setTimeout(() => s.classList.add('hidden'), 1800); }
  } catch(_) {}
}

function setRecognitionPref(type, value) {
  try {
    const raw  = localStorage.getItem(_aboutMeKey());
    const data = raw ? JSON.parse(raw) : {};
    data[type === 'visibility' ? 'visibility' : 'birthday'] = value;
    localStorage.setItem(_aboutMeKey(), JSON.stringify(data));
    _applyPrefButtons(type === 'visibility' ? 'vis' : 'bday', value);
    const s = document.getElementById('up-bio-saved');
    if (s) { s.classList.remove('hidden'); setTimeout(() => s.classList.add('hidden'), 1800); }
  } catch(_) {}
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
    const other        = isSent ? (r.to_user?.name || 'Alguien') : (r.from_user?.name || 'Alguien');
    const otherInitial = (other[0] || '?').toUpperCase();
    const time         = formatTimeAgo(r.created_at);
    const program      = r.program || '';
    const message      = _cleanPrivateMarker(r.message || '');
    const points       = Number(r.points) || 0;
    const label = isSent
      ? `Reconociste a <span class="font-semibold text-gray-800">${esc(other)}</span>`
      : `<span class="font-semibold text-gray-800">${esc(other)}</span> te reconoció`;
    const badge = isSent
      ? `<span class="text-[10px] font-bold uppercase tracking-wide text-[#3d2b56] bg-violet-50 px-2 py-0.5 rounded-full">Dado</span>`
      : `<span class="text-[10px] font-bold uppercase tracking-wide text-[#e87cb4] bg-rosa-50 px-2 py-0.5 rounded-full">Recibido</span>`;
    const pointsBadge = points > 0
      ? isSent
        ? `<span class="text-xs font-semibold text-[#3d2b56]">��${points} pts</span>`
        : `<span class="text-xs font-semibold text-[#e87cb4]">+${points} pts</span>`
      : '';
    const messageEl = message
      ? `<p class="text-xs text-gray-500 italic mt-1 leading-relaxed">"${esc(message)}"</p>`
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
        ${messageEl}
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
  el('up-points').textContent  = (u.points_to_give ?? '�');

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

function saveSettings() {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-green-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold';
  toast.style.animation = 'scaleIn 0.3s ease';
  toast.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> <span>Cambios guardados correctamente ✓</span>';
  document.body.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => toast.remove(), 3000);
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
  loadCompanyPrograms();
  renderAutoRecognitionsAdmin();
}
function openAdminPage() { openAdmin(); }

// ── Auto Recognitions Admin ───────────────────────────────────────────────────
let _arSettings = null;

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
  if (g('ar-send-time'))            g('ar-send-time').value             = s.send_time           || '09:00';

  // Populate program selects
  _populateArProgramSelect('ar-birthday-program',    s.birthday_program);
  _populateArProgramSelect('ar-anniversary-program', s.anniversary_program);

  // Render upcoming + employees
  _renderArUpcoming();
  _renderArEmployees();
  lucide.createIcons();
}

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

function _upcomingDates(daysAhead = 30) {
  const companyId = currentUser?.company_id;
  const users = allUsers.filter(u => u.company_id === companyId);
  const today  = new Date(); today.setHours(0,0,0,0);
  const events = [];

  users.forEach(u => {
    // Birthdays
    if (u.birthday && u.auto_birthday !== false) {
      const [dd, mm] = u.birthday.split('/').map(Number);
      for (let yr = today.getFullYear(); yr <= today.getFullYear() + 1; yr++) {
        const d = new Date(yr, mm-1, dd);
        const diff = Math.round((d - today) / 86400000);
        if (diff >= 0 && diff <= daysAhead) {
          events.push({ type:'birthday', name: u.name, dept: u.department||'', date: u.birthday, daysLeft: diff, label: diff === 0 ? 'Hoy' : `en ${diff} día${diff>1?'s':''}` });
        }
      }
    }
    // Anniversaries
    if (u.anniversary_date && u.auto_anniversary !== false) {
      const base = new Date(u.anniversary_date);
      const yr   = today.getFullYear();
      const next = new Date(yr, base.getMonth(), base.getDate());
      if (next < today) next.setFullYear(yr + 1);
      const diff = Math.round((next - today) / 86400000);
      if (diff >= 0 && diff <= daysAhead) {
        const years = next.getFullYear() - base.getFullYear();
        events.push({ type:'anniversary', name: u.name, dept: u.department||'', date: u.anniversary_date, daysLeft: diff, years, label: diff === 0 ? 'Hoy' : `en ${diff} día${diff>1?'s':''}` });
      }
    }
  });

  return events.sort((a,b) => a.daysLeft - b.daysLeft);
}

function _renderArUpcoming() {
  const el  = document.getElementById('ar-upcoming-list');
  const cnt = document.getElementById('ar-upcoming-count');
  if (!el) return;
  const events = _upcomingDates(30);
  if (cnt) cnt.textContent = events.length;
  if (!events.length) {
    el.innerHTML = '<p class="text-xs text-gray-400 italic">Sin fechas próximas en los próximos 30 días.</p>';
    return;
  }
  el.innerHTML = events.map(e => {
    const isBday = e.type === 'birthday';
    const icon   = isBday ? 'cake' : 'star';
    const color  = isBday ? 'text-[#f19ac4] bg-[#fff0f6]' : 'text-[#c9a7d4] bg-[#f5f0fa]';
    const badge  = e.daysLeft === 0
      ? 'bg-green-100 text-green-700 font-bold'
      : e.daysLeft <= 3
      ? 'bg-amber-100 text-amber-700 font-semibold'
      : 'bg-gray-100 text-gray-500';
    const extra = isBday ? '' : ` · ${e.years} año${e.years>1?'s':''}`;
    return `<div class="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
      <div class="w-7 h-7 rounded-full ${color} flex items-center justify-center shrink-0">
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800 truncate">${esc(e.name)}</p>
        <p class="text-xs text-gray-400 truncate">${esc(e.dept)}${extra}</p>
      </div>
      <span class="text-[10px] px-2 py-0.5 rounded-full shrink-0 ${badge}">${esc(e.label)}</span>
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

async function saveAutoRecognitionSettings() {
  // Only admins/superadmins of this company can save
  if (!currentUser || !['admin','superadmin'].includes(currentUser.role)) {
    showErrorToast('Solo administradores pueden guardar esta configuración.');
    return;
  }
  const companyId = currentUser.company_id;
  if (!companyId || !window.autoRecognitionSdk) return;

  const saveBtn = document.querySelector('[onclick="saveAutoRecognitionSettings()"]');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...'; lucide.createIcons(); }

  const g = id => document.getElementById(id);
  const settings = {
    company_id:          companyId,                                           // always locked to this company
    enabled:             g('ar-enabled')?.checked             ?? true,
    birthday_enabled:    g('ar-birthday-enabled')?.checked    ?? true,
    anniversary_enabled: g('ar-anniversary-enabled')?.checked ?? true,
    birthday_message:    g('ar-birthday-message')?.value?.trim()    || _AR_DEFAULTS.birthday_message,
    anniversary_message: g('ar-anniversary-message')?.value?.trim() || _AR_DEFAULTS.anniversary_message,
    birthday_program:    g('ar-birthday-program')?.value     || null,
    anniversary_program: g('ar-anniversary-program')?.value  || null,
    birthday_points:     parseInt(g('ar-birthday-points')?.value  || '0'),
    anniversary_points:  parseInt(g('ar-anniversary-points')?.value || '0'),
    send_time:           g('ar-send-time')?.value             || '09:00',
  };

  _arSettings = settings;
  const res = await window.autoRecognitionSdk.saveSettings(settings);

  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Guardar configuración'; lucide.createIcons(); }

  if (res.isOk) {
    const msg = document.getElementById('ar-saved-msg');
    if (msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 3000); }
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

function updateAdminVisibility() {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  document.getElementById('admin-nav-link')?.classList.toggle('hidden', !isAdmin);
  document.getElementById('analytics-nav-link')?.classList.toggle('hidden', !isAdmin);
  document.getElementById('points-nav-link')?.classList.toggle('hidden', !isAdmin);
  if (isAdmin) document.getElementById('points-nav-link')?.classList.add('flex');
  else document.getElementById('points-nav-link')?.classList.remove('flex');
  document.body.classList.toggle('is-admin', isAdmin);
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
    points_to_redeem: emp.points_to_redeem, __backendId: emp.__backendId
  };

  isImpersonating = true;
  document.body.classList.remove('is-superadmin');
  updateAdminVisibility();
  updateImpersonationBanner();
  closeAdminPage();

  const initials  = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const firstName = currentUser.name.split(' ')[0];
  const avatarDiv = document.getElementById('btn-profile')?.querySelector('div');
  if (avatarDiv) avatarDiv.textContent = initials;
  document.getElementById('welcome-text').textContent = `¡Hola, ${firstName}! 👋`;

  updatePointsDisplay();

  filterEmployeesByCompany();
  renderEmployeesList();
  showSuccessToast(`Usando cuenta de: ${emp.name}`);
  _rebuildCompanyMemberIds();
  switchPage('home');
  renderFeed(true);
  loadHomeSidebar();
  loadNotifications();
  _setupFeedRealtime();
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
  filterEmployeesByCompany();
  renderEmployeesList();
  updateImpersonationBanner();
  updateAdminVisibility();
  const initials  = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const firstName = currentUser.name.split(' ')[0];
  const avatarDiv = document.getElementById('btn-profile')?.querySelector('div');
  if (avatarDiv) avatarDiv.textContent = initials;
  document.getElementById('welcome-text').textContent = `¡Hola, ${firstName}! 👋`;
  showSuccessToast(`Volviste a tu cuenta: ${currentUser.name}`);
  switchPage('home');
  renderFeed(true);
  loadHomeSidebar();
  loadNotifications();
  _setupFeedRealtime();
  renderRecognitionBattery();
  lucide.createIcons();
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
  if (sumName)   sumName.textContent   = '�';
  if (sumProg)   sumProg.textContent   = '�';
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

  document.getElementById('points-slider').value = 25;
  document.getElementById('points-slider').max   = currentUser?.points_to_give ?? 50;
  document.getElementById('points-val').textContent = '25';
  document.getElementById('points-warning').classList.add('hidden');
  const modalPtsAvail = document.getElementById('modal-pts-available');
  if (modalPtsAvail) modalPtsAvail.textContent = currentUser?.points_to_give ?? 0;
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
  const isOn = btn.getAttribute('aria-checked') === 'true';
  _setPointsSwitch(!isOn);
  if (!isOn) {
    // ------------------------------------------------------------
  } else {
    // ------------------------------------------------------------
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
  document.getElementById('points-val').textContent = value;
  const usingBudget = document.getElementById('use-program-budget')?.checked;
  const prog        = _getProgramByLabel(selectedProgram);
  const n           = Math.max(1, _selectedRecipients.length);
  let ok;
  if (usingBudget && prog?.custom) {
    ok = _getProgramRemainingBudget(prog) >= parseInt(value) * n;
  } else {
    ok = currentUser && currentUser.points_to_give >= parseInt(value) * n;
  }
  document.getElementById('points-warning').classList.toggle('hidden', ok || !currentUser);
  document.getElementById('modal-next').disabled = !ok && !!currentUser;
}

function filterPeople(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.person-item').forEach(el => {
    el.style.display = el.dataset.name.toLowerCase().includes(q) ? '' : 'none';
  });
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
    document.getElementById('points-val').textContent = slider.value;
    document.getElementById('points-warning').classList.add('hidden');
    document.getElementById('modal-next').disabled = false;
  } else {
    slider.max = 50;
    updatePointsSlider(slider.value);
  }
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
        showErrorToast('No se pudo subir la imagen � el reconocimiento se enviará sin ella');
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

    const notifRecipients = _selectedRecipients
      .filter(r => allUsers.find(u => u.__backendId === r.id))
      .map(r => ({ user_id: r.id, name: r.name }));
    window.notificationSdk.sendRecognitionNotifications(
      notifRecipients, currentUser.__backendId, points, selectedProgram
    ).catch(e => _log('notification send error:', e));

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
      ? `¡Reconocimiento enviado ${plural}! -${points * sentCount} pts del programa`
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
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { days: [false, false, false, false, false, false, false], count: 0 };
}

function _saveWeeklyData(data) {
  try { localStorage.setItem(_weeklyKey(), JSON.stringify(data)); } catch (_) {}
}

function _todayIndex() {
  return (new Date().getDay() + 6) % 7;
}

const WEEKLY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKLY_DAY_PHRASES = [
  'Sin días activos aún',
  '1 día activo �xR�',
  '2 días activos 🌱',
  '3 días activos 🚀',
  '4 días activos 💪',
  '5 días activos ⭐',
  '6 días activos ✨',
  '¡Semana perfecta! 🌟',
];

function renderWeeklyRecap() {
  const textEl = document.getElementById('weekly-recap-text');
  const barsEl = document.getElementById('weekly-recap-bars');
  if (!textEl || !barsEl) return;
  const data       = _getWeeklyData();
  const today      = _todayIndex();
  const activeDays = (data.days || []).filter(Boolean).length;
  textEl.textContent = WEEKLY_DAY_PHRASES[Math.min(activeDays, WEEKLY_DAY_PHRASES.length - 1)];
  barsEl.innerHTML = WEEKLY_LABELS.map((label, i) => {
    const filled  = data.days[i];
    const isToday = i === today;
    const bar = filled
      ? 'w-full h-5 rounded-sm bg-[#3d2b56]'
      : isToday
        ? 'w-full h-5 rounded-sm bg-violet-100 border border-violet-300'
        : 'w-full h-5 rounded-sm bg-gray-100';
    return `<div class="flex flex-col items-center gap-1 flex-1">
      <div class="${bar}"></div>
      <span class="text-[9px] font-medium ${filled ? 'text-[#3d2b56]' : isToday ? 'text-violet-400' : 'text-gray-300'}">${label}</span>
    </div>`;
  }).join('');
}

function _incrementWeeklyRecap() {
  if (!currentUser) return;
  const data  = _getWeeklyData();
  data.days[_todayIndex()] = true;
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
    <button onclick="clearCommentImage(this)" class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center leading-none">�</button>
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
  const card       = btn.closest('article');
  const list       = card.querySelector('.comments-list');
  const all        = JSON.parse(card.dataset.allComments || '[]');
  const shown      = parseInt(card.dataset.shownComments || '0');
  const STEP       = 3;
  const next       = all.slice(shown, shown + STEP);

  next.forEach(c => {
    const ci   = esc((c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase());
    const time = c.created_at ? formatTimeAgo(c.created_at) : '';
    const div  = document.createElement('div');
    div.className = 'flex items-start gap-2.5';
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
      <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-700">${esc(c.user?.name || 'Usuario')}</p>
          ${time ? `<span class="text-[10px] text-gray-400 shrink-0">${time}</span>` : ''}
        </div>
        ${(() => { const { text, imgs } = parseCommentMessage(c.message); return (text ? `<p class="text-xs text-gray-600 mt-0.5">${esc(text)}</p>` : '') + imgs.map(u => `<img src="${esc(u)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join(''); })()}
      </div>`;
    list.appendChild(div);
  });

  const newShown   = shown + next.length;
  card.dataset.shownComments = newShown;
  const remaining  = all.length - newShown;

  if (remaining > 0) {
    btn.textContent = `Ver ${Math.min(remaining, STEP)} comentarios más`;
  } else {
    btn.textContent = 'Ver menos comentarios';
    btn.setAttribute('onclick', 'loadLessComments(this)');
  }
}

function loadLessComments(btn) {
  const INIT = 2;
  const STEP = 3;
  const card  = btn.closest('article');
  const list  = card.querySelector('.comments-list');
  const all   = JSON.parse(card.dataset.allComments || '[]');

  const items = list.querySelectorAll(':scope > div');
  for (let i = items.length - 1; i >= INIT; i--) {
    items[i].remove();
  }

  card.dataset.shownComments = INIT;
  const remaining = all.length - INIT;

  btn.textContent = `Ver ${Math.min(remaining, STEP)} comentarios más`;
  btn.setAttribute('onclick', 'loadMoreComments(this)');
}

async function addComment(btn) {
  const card       = btn.closest('article');
  const input      = card.querySelector('input[placeholder="Escribí un comentario..."]');
  const text       = input.value.trim();
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
        <span class="text-[10px] text-gray-400 shrink-0">Ahora</span>
      </div>
      ${text ? `<p class="text-xs text-gray-600 mt-0.5">${esc(text)}</p>` : ''}
      ${localImgUrl ? `<img src="${esc(localImgUrl)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">` : ''}
    </div>`;
  container.appendChild(newComment);

  input.value = '';
  if (fileInput) fileInput.value = '';
  const preview = card.querySelector('.comment-img-preview');
  if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }

  const mainEl = document.querySelector('main');
  if (mainEl) setTimeout(() => {
    const cardRect = card.getBoundingClientRect();
    const mainRect = mainEl.getBoundingClientRect();
    if (cardRect.bottom > mainRect.bottom) {
      mainEl.scrollBy({ top: cardRect.bottom - mainRect.bottom + 16, behavior: 'smooth' });
    }
  }, 50);

  const countSpan = card.querySelector('.comment-count');
  if (countSpan) countSpan.textContent = (parseInt(countSpan.textContent) || 0) + 1;
  lucide.createIcons();

  const recognitionId = card.dataset.recognitionId;
  if (recognitionId) {
    let remoteImgUrl = null;
    if (file && window.storageSdk) {
      const result = await window.storageSdk.uploadCommentImage(file);
      if (result.isOk) remoteImgUrl = result.url;
    }
    const fullMessage = [text, remoteImgUrl].filter(Boolean).join('\n');
    if (fullMessage) window.recognitionSdk.addComment(recognitionId, currentUser.__backendId, fullMessage);
  }
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

let _feedRealtimeChannel  = null;
let _feedRefreshTimer     = null;
let _feedRealtimeSetupId  = 0; // increments on each setup call, cancels stale ones

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
  const senderName  = rec.from_user?.name || 'Alguien';
  const initials    = esc(senderName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2));
  const avatarColor = AVATAR_COLORS[senderName.length % AVATAR_COLORS.length];
  const gradient    = PROGRAM_COLORS[rec.program] || 'bg-[#3d2b56]';
  const programData = _getProgramByLabel(rec.program);

  // Parse multi-recipient group marker
  const groupData = _parseGroupMarker(rec.message);
  const rawMessage   = _cleanPrivateMarker(rec.message || '');
  const groupIdx    = rawMessage ? rawMessage.indexOf('\n' + _GROUP_PREFIX) : -1;
  const cleanMessage = groupIdx !== -1 ? rawMessage.slice(0, groupIdx) : rawMessage;
  const recipientNames = groupData?.recipients?.map(r => r.name) || [rec.to_user?.name || 'Alguien'];
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

  const COMMENTS_INITIAL = 2;
  const COMMENTS_STEP    = 3;
  const allComments      = rec.comments || [];

  const buildCommentHtml = (c) => {
    const ci   = esc((c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase());
    const time = c.created_at ? formatTimeAgo(c.created_at) : '';
    const { text: msgText, imgs } = parseCommentMessage(c.message);
    const imgHtml = imgs.map(u => `<img src="${esc(u)}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join('');
    return `<div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-full bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
      <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-700">${esc(c.user?.name || 'Usuario')}</p>
          ${time ? `<span class="text-[10px] text-gray-400 shrink-0">${time}</span>` : ''}
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
    ? `<button class="ver-mas-comments text-xs text-violet-500 hover:text-violet-700 font-medium px-4 pb-2 transition" onclick="loadMoreComments(this)">Ver ${Math.min(hiddenCount, COMMENTS_STEP)} comentarios más</button>`
    : '';

  const card = document.createElement('article');
  card.className = 'feed-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition';
  card.style.animation = 'slideUp 0.4s ease both';
  card.dataset.recognitionId = rec.id;
  card.dataset.allComments   = JSON.stringify(allComments);
  card.dataset.shownComments = visibleComments.length;
  const bannerHtml = programData?.image
    ? `<div class="w-full h-36 overflow-hidden">
         <img src="${esc(programData.image)}" class="w-full h-full object-cover" alt="${esc(programData.name)}">
       </div>`
    : '';

  const pointsBadgeHtml2 = rec.points > 0
    ? `<span class="points-badge ${gradient} text-white text-xs font-bold px-2.5 py-1 rounded-full">+${Number(rec.points)} pts</span>`
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
          <p class="text-sm"><span class="font-bold text-gray-800">${esc(senderName)}</span> <span class="text-gray-400">reconoció a</span> <span class="font-bold text-violet-600">${esc(recipientDisplay)}</span></p>
          <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${formatTimeAgo(rec.created_at)} · <span class="text-violet-500 font-medium">${esc(rec.program)}</span></p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${_isPrivateRec(rec) ? `<span class="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Privado</span>` : ''}
          ${pointsBadgeHtml2}
          <div class="feed-admin-menu relative">
            <button onclick="toggleFeedMenu(event,'${rec.id}')" class="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600 font-bold text-base leading-none">···</button>
            <div id="feedmenu-${rec.id}" class="hidden absolute right-0 top-7 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px] z-10">
              <button onclick="openDeleteRecognitionModal('${rec.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left">
                �x️ Eliminar
              </button>
            </div>
          </div>
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
        <input type="text" placeholder="Escribí un comentario..." class="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-full px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300" onkeydown="if(event.key==='Enter')addComment(this.closest('.comments-section').querySelector('button[onclick]'))">
        <button class="p-2 rounded-full bg-violet-500 text-white hover:bg-violet-600 transition shrink-0" onclick="addComment(this)"><i data-lucide="send" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>`;
  return card;
}

// ------------------------------------------------------------

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
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">¡Sé el primero en reconocer a alguien! �xRx</p>';
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
    const fromName = allUsers.find(u => u.__backendId === n.data?.from_user_id)?.name || 'Alguien';
    let icon, iconColor, text;
    if (n.type === 'recognition') {
      icon = 'heart'; iconColor = 'rose';
      text = `<span class="font-semibold">${esc(fromName)}</span> te reconoció (+${Number(n.data?.points)} pts)`;
    } else if (n.type === 'reaction') {
      icon = 'smile'; iconColor = 'violet';
      text = `<span class="font-semibold">${esc(fromName)}</span> reaccionó ${esc(n.data?.emoji)} a tu reconocimiento`;
    } else if (n.type === 'program_approval_request') {
      icon = 'check-square'; iconColor = 'amber';
      text = `${n.data?.program_emoji || '🏆'} <span class="font-semibold">${esc(n.data?.requester_name)}</span> solicita aprobación para <strong>${esc(n.data?.program_name)}</strong> (${Number(n.data?.points)} pts)`;
    } else if (n.type === 'program_approved') {
      icon = 'check-circle'; iconColor = 'green';
      text = `${n.data?.program_emoji || '🏆'} Tu programa <strong>${esc(n.data?.program_name)}</strong> fue aprobado por <span class="font-semibold">${esc(n.data?.approved_by)}</span>`;
    } else if (n.type === 'program_rejected') {
      icon = 'x-circle'; iconColor = 'red';
      text = `${n.data?.program_emoji || '🏆'} Tu solicitud de <strong>${esc(n.data?.program_name)}</strong> fue rechazada`;
    } else {
      icon = 'message-circle'; iconColor = 'blue';
      text = `<span class="font-semibold">${esc(fromName)}</span> comentó en tu reconocimiento`;
    }
    return `<div class="notif-item p-3 rounded-lg ${n.read ? '' : 'bg-violet-50'} hover:bg-gray-50 cursor-pointer transition border border-transparent hover:border-gray-200" onclick="handleNotificationClick(${JSON.stringify(n.id)})">
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
    const fromName = allUsers.find(u => u.__backendId === n.data?.from_user_id)?.name || 'Alguien';
    const unread = !n.read ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white';
    let avatarContent, text;
    if (n.type === 'recognition') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0">${esc((fromName[0] || '?').toUpperCase())}</div>`;
      text = `<span class="font-semibold">${esc(fromName)}</span> te reconoció con <strong>+${Number(n.data?.points)} pts</strong> · ${esc(n.data?.program)}`;
    } else if (n.type === 'reaction') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0">${esc((fromName[0] || '?').toUpperCase())}</div>`;
      text = `<span class="font-semibold">${esc(fromName)}</span> reaccionó ${esc(n.data?.emoji)} a tu reconocimiento`;
    } else if (n.type === 'program_approval_request') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><i data-lucide="check-square" class="w-5 h-5 text-amber-500"></i></div>`;
      text = `${n.data?.program_emoji || '🏆'} <span class="font-semibold">${esc(n.data?.requester_name)}</span> solicita aprobación para el ${n.data?.is_recharge ? 'recarga del' : 'nuevo'} programa <strong>${esc(n.data?.program_name)}</strong> · ${Number(n.data?.points)} pts`;
    } else if (n.type === 'program_approved') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0"><i data-lucide="check-circle" class="w-5 h-5 text-green-500"></i></div>`;
      text = `${n.data?.program_emoji || '🏆'} Tu ${n.data?.is_recharge ? 'recarga del' : 'nuevo'} programa <strong>${esc(n.data?.program_name)}</strong> fue aprobado por <span class="font-semibold">${esc(n.data?.approved_by)}</span>`;
    } else if (n.type === 'program_rejected') {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><i data-lucide="x-circle" class="w-5 h-5 text-red-500"></i></div>`;
      text = `${n.data?.program_emoji || '🏆'} Tu solicitud del ${n.data?.is_recharge ? 'recarga del' : 'nuevo'} programa <strong>${esc(n.data?.program_name)}</strong> fue rechazada por <span class="font-semibold">${esc(n.data?.rejected_by)}</span>`;
    } else {
      avatarContent = `<div class="w-10 h-10 rounded-full bg-[#3d2b56] flex items-center justify-center text-white font-bold shrink-0">${esc((fromName[0] || '?').toUpperCase())}</div>`;
      text = `<span class="font-semibold">${esc(fromName)}</span> comentó en tu reconocimiento`;
    }
    return `<div class="p-4 rounded-xl border ${unread} hover:shadow-md transition cursor-pointer group" onclick="handleNotificationClick(${JSON.stringify(n.id)})">
      <div class="flex items-start gap-3">
        ${avatarContent}
        <div class="flex-1 min-w-0"><p class="text-sm text-gray-800">${text}</p><p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${formatTimeAgo(n.created_at)}</p></div>
        <button onclick="event.stopPropagation(); deleteNotification(${JSON.stringify(n.id)})" class="p-2 rounded-lg hover:bg-red-50 transition"><i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i></button>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

async function markNotificationRead(id) {
  await window.notificationSdk.markRead(id);
  const n = _notificationsData.find(n => n.id === id);
  if (n) n.read = true;
  updateNotificationBadge();
  renderNotificationsPage();
  renderNotificationsDropdown();
}

async function handleNotificationClick(id) {
  await window.notificationSdk.markRead(id);
  const n = _notificationsData.find(n => n.id === id);
  if (n) n.read = true;
  updateNotificationBadge();
  renderNotificationsDropdown();

  // Close notifications panel/page
  document.getElementById('notifications-dropdown')?.classList.add('hidden');
  closeNotificationsPage();

  // Navigate based on type
  if (n?.type === 'program_approval_request') {
    sidebarNav(() => switchPage('approvals'));
  } else if (n?.type === 'program_approved' || n?.type === 'program_rejected') {
    sidebarNav(() => switchPage('programs'));
  } else if (n?.type === 'recognition' || n?.type === 'reaction' || n?.type === 'comment') {
    sidebarNav(() => switchPage('feed'));
  } else {
    renderNotificationsPage();
  }
}

async function deleteNotification(id) {
  await window.notificationSdk.remove(id);
  _notificationsData = _notificationsData.filter(n => n.id !== id);
  updateNotificationBadge();
  renderNotificationsPage();
  renderNotificationsDropdown();
  showSuccessToast('Notificación eliminada');
}

async function markAllAsRead() {
  await window.notificationSdk.markAllRead();
  _notificationsData.forEach(n => n.read = true);
  updateNotificationBadge();
  renderNotificationsPage();
  renderNotificationsDropdown();
  showSuccessToast('Todas las notificaciones marcadas como leídas');
}

function updateNotificationBadge() {
  const unread = _notificationsData.filter(n => !n.read).length;
  document.getElementById('btn-notif')?.classList.toggle('notification-dot', unread > 0);
}

async function openStore() {
  closePointsPage();
  const sp = document.getElementById('store-page');
  sp.style.display = '';
  sp.classList.remove('hidden');
  _positionOverlayPage('store-page');
  if (currentUser) {
    const pts = currentUser.points_to_redeem || 0;
    document.getElementById('store-points-display').textContent = `${pts} pts`;
    document.getElementById('store-hero-block').innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tus puntos disponibles</p>
        <div class="flex items-baseline gap-2 mb-1">
          <span class="text-5xl font-black text-gray-900">${pts}</span>
          <span class="text-lg font-bold text-violet-500">pts</span>
        </div>
        <p class="text-sm text-gray-400 mt-1">Elegí cómo disfrutar tu reconocimiento.</p>
      </div>`;
  }
  await renderStore();
}

function closeStore() {
  document.getElementById('store-page').classList.add('hidden');
}

async function renderStore() {
  const container = document.getElementById('store-rewards-container');
  if (!container || !currentUser) return;
  container.innerHTML = '<div class="text-center py-10"><i data-lucide="loader" class="w-8 h-8 animate-spin text-violet-400 mx-auto"></i></div>';
  lucide.createIcons();

  const { isOk, data } = await window.rewardSdk.list(currentUser.company_id);
  const pts = currentUser.points_to_redeem || 0;

  const CATS = [
    { key: 'tiempo',       label: 'Tiempo',       emoji: '⏰', desc: 'Recuperá espacio para vos',        dbKeys: ['time_off'] },
    { key: 'bienestar',    label: 'Bienestar',    emoji: '💪', desc: 'Cuid',                 dbKeys: ['wellness'] },
    { key: 'crecimiento',  label: 'Crecimiento',  emoji: '🌱', desc: 'Invertí en tu crecimiento',         dbKeys: ['growth', 'learning'] },
    { key: 'experiencias', label: 'Experiencias', emoji: '🎉', desc: 'Momentos que recordarás',        dbKeys: ['experience', 'gift_card', 'merch', 'general'] },
  ];

  const PH = {
    tiempo:       [{ name: 'Tomarte un día libre',       desc: 'Un día para desconectarte y recargar energía. Sin justificación.',  pts: 200, badge: 'Muy elegido' },
                   { name: 'Trabajar remoto una semana', desc: 'Elegí dónde trabajar durante 5 días hábiles.',                      pts: 350 }],
    bienestar:    [{ name: 'Sesión de bienestar',        desc: 'Una sesión de meditación, yoga o masajes a tu elección.',           pts: 150, badge: 'Recomendado' },
                   { name: 'Kit de bienestar personal',  desc: 'Productos de cuidado personal seleccionados para vos.',             pts: 180 }],
    crecimiento:  [{ name: 'Acceder a un curso',         desc: 'Cualquier curso online de tu área de interés.',                     pts: 300, badge: 'Recomendado' },
                   { name: 'Sesión de mentoría',         desc: 'Una hora con un referente de tu industria o área.',                 pts: 250 }],
    experiencias: [{ name: 'Cena para dos',              desc: 'Una experiencia gastronómica para compartir con quien quieras.',    pts: 400 },
                   { name: 'Entrada a un evento',        desc: 'Cine, teatro, recital o deporte. Vos elegís.',                     pts: 280 }],
  };

  const hasRewards = isOk && data.length > 0;
  const grouped = {};
  CATS.forEach(c => { grouped[c.key] = []; });

  if (hasRewards) {
    data.forEach(r => {
      const cat = CATS.find(c => c.dbKeys.includes(r.category)) || CATS[3];
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
          ${grouped[cat.key].map(r => buildStoreRewardCard(r, pts, r.isPlaceholder)).join('')}
        </div>
      </section>
    `).join('');

  container.innerHTML = catBarHtml + sectionsHtml;
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

function buildStoreRewardCard(r, userPts, isPlaceholder) {
  const cost      = r.points_cost ?? r.pts ?? 0;
  const canAfford = userPts >= cost;
  const missing   = cost - userPts;
  const badge     = r.badge || null;
  const name      = (r.name || '').replace(/'/g, '&#39;');
  const desc      = r.description || r.desc || '';
  const id        = r.id || '';

  return `<div class="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition relative">
    ${badge ? `<span class="absolute top-4 right-4 text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">${badge}</span>` : ''}
    <div class="${badge ? 'pr-20' : ''}">
      <h4 class="font-bold text-gray-800 text-sm leading-snug">${name}</h4>
      <p class="text-xs text-gray-400 mt-1.5 leading-relaxed">${desc}</p>
    </div>
    <div class="flex items-end justify-between mt-auto pt-3 border-t border-gray-50">
      <div>
        <div class="flex items-baseline gap-1">
          <span class="font-black text-violet-600 text-lg">${cost}</span>
          <span class="text-xs text-gray-400">pts</span>
        </div>
        ${!isPlaceholder && !canAfford  ? `<p class="text-[10px] text-pink-500 font-medium mt-0.5">Te faltan ${missing} pts</p>` : ''}
        ${!isPlaceholder &&  canAfford  ? `<p class="text-[10px] text-emerald-500 font-medium mt-0.5">Podés canjear esto �S</p>` : ''}
      </div>
      <button ${!isPlaceholder && canAfford ? `onclick="redeemReward('${id}', '${name}', ${cost})"` : 'disabled'}
        class="px-4 py-1.5 rounded-full text-xs font-bold transition ${!isPlaceholder && canAfford ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}">
        ${isPlaceholder ? 'Próximamente' : canAfford ? 'Canjear' : 'Sin puntos'}
      </button>
    </div>
  </div>`;
}

async function redeemReward(rewardId, name, cost) {
  if (!currentUser || currentUser.points_to_redeem < cost) {
    showErrorToast('No tenés suficientes puntos para canjear');
    return;
  }

  const { isOk, error } = await window.rewardSdk.redeem(rewardId);
  if (!isOk) {
    const msg = error?.message === 'insufficient_points' ? 'No tenés suficientes puntos' : 'Error al canjear';
    showErrorToast(msg);
    return;
  }

  currentUser.points_to_redeem -= cost;
  await window.dataSdk.refresh();
  updateAllPointsDisplays();
  await renderStore();
  showSuccessToast(`¡Canjeaste ${name}! -${cost} pts`);
}

const DEFAULT_PROGRAMS = [
  { id: 'p1', emoji: '🏆', name: 'Trabajo en Equipo',        active: true },
  { id: 'p2', emoji: '🎯', name: 'Liderazgo',                active: true },
  { id: 'p3', emoji: '💡', name: 'Innovación',               active: true },
  { id: 'p4', emoji: '🤝', name: 'Colaboración',             active: true },
  { id: 'p5', emoji: '⭐', name: 'Actitud',                  active: true },
  { id: 'p6', emoji: '✅', name: 'Cumplimiento de objetivos', active: true },
];

let companyPrograms = [...DEFAULT_PROGRAMS];

async function loadCompanyPrograms() {
  companyPrograms = [...DEFAULT_PROGRAMS];
  _loadCustomPrograms();
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
        const legacyItems = JSON.parse(legacy).filter(l => !_approvalsQueue.find(q => q.id === l.id));
        for (const item of legacyItems) await window.approvalsSdk.add(item);
        localStorage.removeItem('allay_approvals_queue');
        localStorage.removeItem('allay_approvals_history');
        if (legacyItems.length) await _loadApprovals();
        return;
      }
    } catch (_) {}
  }
  _updateApprovalsNavBadge();
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

function _submitProgramApprovalRequest(programData, budget, rechargeFor = null) {
  const name     = currentUser?.name || 'Empleado';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const colors   = ['bg-[#3d2b56]', 'bg-[#f19ac4]', 'bg-[#c9a7d4]'];
  const color    = colors[name.length % colors.length];

  // For new programs (not recharges), add to companyPrograms with pending flag so the employee can see it
  let pendingProgramId = null;
  if (!rechargeFor) {
    const pendingEntry = {
      ...programData,
      pending:    true,
      active:     false,
      budget,
      company_id: currentUser?.company_id,
      createdBy:  currentUser?.__backendId,
    };
    companyPrograms.push(pendingEntry);
    pendingProgramId = pendingEntry.id;
    _saveCustomPrograms();
  }

  const req = {
    id:                'apr-' + Date.now(),
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
        program_emoji:  programData.emoji || '�x� ',
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

  container.innerHTML = pending.map(req => `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition" data-req-id="${req.id}">
      <div class="flex items-start gap-4">
        <div class="w-10 h-10 rounded-full ${req.avatarColor} flex items-center justify-center text-white font-bold text-sm shrink-0">${req.avatarInitials}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-0.5">
            <span class="font-bold text-sm text-gray-800">${req.employee}</span>
            <span class="text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">${req.rechargeFor ? 'Recarga de puntos' : 'Nuevo programa'}</span>
          </div>
          <p class="text-xs text-gray-400 mb-3">${formatTimeAgo(req.requestedAt)}</p>
          <!-- Program detail card -->
          <div class="bg-gray-50 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
            <span class="text-2xl">${req.programEmoji}</span>
            <div>
              <p class="text-sm font-bold text-gray-800">${req.programName}</p>
              <p class="text-xs text-gray-400">${req.rechargeFor ? 'Recarga de budget del programa' : 'Programa personalizado · solicita budget de'}</p>
            </div>
            <div class="ml-auto flex items-center gap-1.5 bg-white border border-violet-100 rounded-xl px-3 py-1.5 shrink-0">
              <i data-lucide="coins" class="w-4 h-4 text-violet-500"></i>
              <span class="text-sm font-bold text-violet-700">${req.points} pts</span>
            </div>
          </div>
          <div class="flex justify-end gap-2">
            <button onclick="approveRequest('${req.id}')"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold hover:opacity-90 transition shadow-sm">
              <i data-lucide="check" class="w-4 h-4"></i> Aprobar
            </button>
            <button onclick="rejectRequest('${req.id}')"
              class="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition">
              <i data-lucide="x" class="w-4 h-4"></i> Rechazar
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
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
              <span class="text-sm font-bold text-violet-700">${req.points} pts</span>
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
  req.status    = 'approved';
  req.resolvedBy = currentUser?.name || 'Admin';
  _approvalsQueue.splice(idx, 1);
  _approvalsHistory.unshift(req);

  // Apply the approved action
  if (req.programData) {
    if (req.rechargeFor) {
      // Recharge existing program budget
      const prog = companyPrograms.find(p => p.id === req.rechargeFor);
      if (prog) {
        const oldRemaining = _getProgramRemainingBudget(prog);
        prog.budget = (prog.budget || 0) + req.points;
        try { localStorage.setItem(_getBudgetKey(prog.id), oldRemaining + req.points); } catch (_) {}
        _saveCustomPrograms();
      }
    } else if (req.pendingProgramId) {
      // Activate the pending program entry that was already added
      const prog = companyPrograms.find(p => p.id === req.pendingProgramId);
      if (prog) {
        prog.pending = false;
        prog.active  = true;
        if (!prog.createdBy && req.requestedByUserId) prog.createdBy = req.requestedByUserId;
        _saveCustomPrograms();
      } else {
        // Fallback: program was not found, push a fresh one
        companyPrograms.push({ ...req.programData, active: true, pending: false, createdBy: req.requestedByUserId });
        _saveCustomPrograms();
      }
    } else {
      // Legacy path (requests without pendingProgramId)
      companyPrograms.push({ ...req.programData, active: true });
      _saveCustomPrograms();
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
        program_emoji: req.programEmoji || '�x� ',
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

  // Remove the pending program entry from companyPrograms
  if (req.pendingProgramId) {
    const progIdx = companyPrograms.findIndex(p => p.id === req.pendingProgramId);
    if (progIdx !== -1) {
      companyPrograms.splice(progIdx, 1);
      _saveCustomPrograms();
    }
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
        program_emoji: req.programEmoji || '�x� ',
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
  const userId  = currentUser?.__backendId;
  const isAdmin = currentUser?.role === 'superadmin';
  return companyPrograms.filter(p => {
    if (p.pending) return false;
    if (p.active === false) return false;
    if (p.custom) {
      if (isAdmin) return true;
      if (p.createdBy === userId) return true;
      return Array.isArray(p.employees) && p.employees.includes(userId);
    }
    return true;
  });
}

function renderProgramsPage() {
  const grid = document.getElementById('programs-page-grid');
  if (!grid) return;

  const userId = currentUser?.__backendId;
  const active  = _visiblePrograms();

  // Pending programs visible to the current user (the ones they created while awaiting approval)
  const pending = companyPrograms.filter(p => {
    if (!p.pending) return false;
    if (currentUser?.role === 'superadmin' || currentUser?.role === 'admin') return true;
    return p.createdBy === userId || p.company_id === currentUser?.company_id;
  });

  if (!active.length && !pending.length) {
    grid.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-12">No hay programas configurados aún.</p>';
    return;
  }

  const activeCards = active.map(p => {
    const remaining = _getProgramRemainingBudget(p);
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 text-center hover:shadow-md transition relative">
      ${p.custom ? `
        <div class="absolute top-3 right-3" style="z-index:2;">
          <button onclick="toggleProgramMenu(event,'${p.id}')"
            class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700 font-bold text-base leading-none">
            ···
          </button>
          <div id="pmenu-${p.id}" class="hidden absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[150px]">
            <button onclick="openProgramHistory('${p.id}'); closeProgramMenus()"
              class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
              �x9 Historial
            </button>
            <button onclick="openEditProgramModal('${p.id}'); closeProgramMenus()"
              class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
              �S�️ Editar
            </button>
            <button onclick="openDeleteProgramModal('${p.id}','${p.name.replace(/'/g,"\\'")}'); closeProgramMenus()"
              class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left">
              �x️ Eliminar
            </button>
          </div>
        </div>` : ''}
      <div class="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl">${p.emoji || '⭐'}</div>
      <h3 class="font-bold text-gray-800 text-sm">${p.name}</h3>
      ${p.tag ? `<span class="text-[10px] text-gray-400 font-medium">#${p.tag}</span>` : ''}
      ${p.description ? `<p class="text-[11px] text-gray-500 leading-snug">${p.description}</p>` : ''}
      <div class="flex items-center gap-2 flex-wrap justify-center">
        <span class="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">Activo</span>
        ${p.budget ? `<span class="text-[10px] font-semibold text-celeste-700 bg-celeste-50 px-2.5 py-1 rounded-full">�x�" ${remaining} / ${p.budget} pts</span>` : ''}
      </div>
    </div>`;
  });

  const pendingCards = pending.map(p => `
    <div class="bg-gray-50 rounded-2xl border border-amber-200 shadow-sm p-6 flex flex-col items-center gap-3 text-center relative opacity-75">
      <div class="absolute top-3 left-3">
        <span class="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Pendiente de aprobación
        </span>
      </div>
      <div class="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl mt-4">${p.emoji || '⭐'}</div>
      <h3 class="font-bold text-gray-500 text-sm">${p.name}</h3>
      ${p.tag ? `<span class="text-[10px] text-gray-400 font-medium">#${p.tag}</span>` : ''}
      ${p.description ? `<p class="text-[11px] text-gray-400 leading-snug">${p.description}</p>` : ''}
      <div class="flex items-center gap-2 flex-wrap justify-center">
        ${p.budget ? `<span class="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">�x�" ${p.budget} pts solicitados</span>` : ''}
      </div>
    </div>`);

  grid.innerHTML = [...activeCards, ...pendingCards].join('');
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
      const from = item.rec.from_user?.name || 'Alguien';
      return `<div class="flex items-start gap-2">
        <div class="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center shrink-0 mt-0.5"><i data-lucide="heart" class="w-3 h-3 text-pink-400"></i></div>
        <div><p class="text-xs text-gray-700"><span class="font-semibold">${from}</span> te reconoció</p><p class="text-[10px] text-gray-400">${time}</p></div>
      </div>`;
    }
    if (item.type === 'sent') {
      const to = item.rec.to_user?.name || 'Alguien';
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

function renderProgramsInModal() {
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  const active = _visiblePrograms();

  if (active.length === 0) {
    active.push(...DEFAULT_PROGRAMS);
  }

  selectedProgram = null;
  updateModalBtn();

  grid.innerHTML = active.map(p => `
    <div class="program-item p-4 rounded-xl border-2 border-gray-200 hover:border-violet-400 cursor-pointer transition text-center"
         onclick="selectProgram(this,'${p.emoji} ${p.name}')">
      <span class="text-3xl">${p.emoji}</span>
      <p class="text-sm font-semibold text-gray-800 mt-2">${p.name}</p>
    </div>`).join('');
}

function renderProgramsAdmin() {
  const container = document.getElementById('programs-admin-list');
  if (!container) return;

  if (companyPrograms.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No hay programas. Agregá uno para comenzar.</p>';
    return;
  }

  container.innerHTML = companyPrograms.map(p => `
    <div class="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-violet-200 hover:bg-violet-50/30 transition">
      <div class="flex items-center gap-3">
        <span class="text-2xl">${p.emoji}</span>
        <span class="text-sm font-semibold text-gray-800">${p.name}</span>
        ${!p.active ? '<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>' : ''}
      </div>
      <div class="flex gap-1">
        <button onclick="toggleProgramActive('${p.id}',${p.active})"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition" title="${p.active ? 'Desactivar' : 'Activar'}">
          <i data-lucide="${p.active ? 'eye-off' : 'eye'}" class="w-4 h-4 text-gray-400"></i>
        </button>
        <button onclick="deleteProgramItem('${p.id}','${p.name}')"
          class="p-1.5 rounded-lg hover:bg-red-50 transition">
          <i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i>
        </button>
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
  const { isOk } = await window.programsSdk.create(currentUser.company_id, name, emoji);
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
  document.getElementById('np-emoji-btn').textContent = '�x� ';
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
  if (_editingProgramId) return; // editing mode doesn't need approval flow
  const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
  const budget  = document.getElementById('np-budget').valueAsNumber || 0;
  const needsApproval = !isAdmin && budget > 0;
  document.getElementById('np-approval-notice').classList.toggle('hidden', !needsApproval);
  document.getElementById('np-submit-btn').textContent = needsApproval ? 'Solicitar aprobación' : 'Crear programa';
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

function submitNewProgram(e) {
  e.preventDefault();
  const name = document.getElementById('np-name').value.trim();
  const tag  = document.getElementById('np-tag').value.trim().replace(/^#/, '');
  const desc = document.getElementById('np-description').value.trim();

  let budget;
  if (_editingProgramId) {
    const p         = companyPrograms.find(x => x.id === _editingProgramId);
    const remaining = _getProgramRemainingBudget(p);
    const added     = document.getElementById('np-budget-add').valueAsNumber || 0;
    budget          = (p?.budget || 0) + added;
    // Actualizar el remaining sumando los puntos recargados
    if (added > 0) {
      try { localStorage.setItem(_getBudgetKey(_editingProgramId), remaining + added); } catch (_) {}
    }
  } else {
    budget = document.getElementById('np-budget').valueAsNumber || 0;
  }

  const newProgram = {
    id:          'custom_' + Date.now(),
    emoji:       _npSelectedEmoji,
    name,
    tag:         tag || name.toLowerCase().replace(/\s+/g, '-'),
    description: desc,
    budget,
    image:       _npImageBase64 || null,
    employees:   [..._npSelectedEmployees],
    active:      true,
    custom:      true,
  };

  if (_editingProgramId) {
    const isAdmin = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';
    const added   = document.getElementById('np-budget-add').valueAsNumber || 0;

    if (!isAdmin && added > 0) {
      const existingProg = companyPrograms.find(x => x.id === _editingProgramId);
      _submitProgramApprovalRequest(
        { name: existingProg?.name || name, emoji: existingProg?.emoji || _npSelectedEmoji },
        added,
        _editingProgramId
      );
      closeNewProgramModal();
      return;
    }

    const idx = companyPrograms.findIndex(x => x.id === _editingProgramId);
    if (idx !== -1) {
      const old = companyPrograms[idx];
      if (newProgram.budget !== old.budget) {
        const oldRemaining = _getProgramRemainingBudget(old);
        const diff = newProgram.budget - (old.budget || 0);
        try { localStorage.setItem(_getBudgetKey(old.id), Math.max(0, oldRemaining + diff)); } catch (_) {}
      }
      newProgram.id = _editingProgramId;
      companyPrograms[idx] = newProgram;
    }
    _saveCustomPrograms();
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
    _submitProgramApprovalRequest(newProgram, budget);
    closeNewProgramModal();
    return;
  }

  companyPrograms.push(newProgram);
  _saveCustomPrograms();
  closeNewProgramModal();
  renderProgramsPage();
  renderHomeProgramsWidget();
  renderProgramsInModal();
  showSuccessToast(`Programa "${name}" creado`);
}

function _saveCustomPrograms() {
  const custom = companyPrograms.filter(p => p.custom);
  try { localStorage.setItem('allay_custom_programs', JSON.stringify(custom)); } catch (_) {}
}

function _loadCustomPrograms() {
  try {
    const stored = localStorage.getItem('allay_custom_programs');
    if (stored) companyPrograms.push(...JSON.parse(stored));
  } catch (_) {}
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

function confirmDeleteProgram() {
  if (!_deletingProgramId) return;
  companyPrograms = companyPrograms.filter(p => p.id !== _deletingProgramId);
  try { localStorage.removeItem(_getBudgetKey(_deletingProgramId)); } catch (_) {}
  _saveCustomPrograms();
  closeDeleteProgramModal();
  renderProgramsPage();
  renderHomeProgramsWidget();
  renderProgramsInModal();
  showSuccessToast('Programa eliminado');
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
  if (!p || !p.custom) return;

  _editingProgramId    = id;
  _npSelectedEmoji     = p.emoji || '�x� ';
  _npSelectedEmployees = new Set(p.employees || []);
  _npImageBase64       = p.image || null;

  document.getElementById('np-name').value        = p.name || '';
  document.getElementById('np-tag').value         = p.tag  || '';
  document.getElementById('np-description').value = p.description || '';
  document.getElementById('np-emoji-btn').textContent = _npSelectedEmoji;
  document.getElementById('np-emoji-picker').classList.add('hidden');
  document.getElementById('np-emp-search').value  = '';
  document.getElementById('np-modal-title').textContent = 'Editar programa';
  document.getElementById('np-submit-btn').textContent  = 'Guardar cambios';

  // Budget: mostrar estado actual y campo de recarga
  const remaining = _getProgramRemainingBudget(p);
  document.getElementById('np-budget-remaining').textContent = remaining;
  document.getElementById('np-budget-total').textContent     = p.budget || 0;
  document.getElementById('np-budget-preview').textContent   = remaining;
  document.getElementById('np-budget-add').value             = '';
  document.getElementById('np-budget-status').classList.remove('hidden');
  document.getElementById('np-budget-create').classList.add('hidden');
  document.getElementById('np-budget-recharge').classList.remove('hidden');

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
  _renderNpEmployeeList('');
  document.getElementById('np-emp-count').textContent =
    `${_npSelectedEmployees.size} empleado${_npSelectedEmployees.size !== 1 ? 's' : ''} seleccionado${_npSelectedEmployees.size !== 1 ? 's' : ''}`;

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
  try {
    const stored = localStorage.getItem(_getBudgetKey(p.id));
    return stored !== null ? parseInt(stored) : p.budget;
  } catch (_) { return p.budget; }
}

function _deductProgramBudget(id, points) {
  const p = companyPrograms.find(x => x.id === id);
  if (!p) return;
  const remaining = _getProgramRemainingBudget(p);
  try { localStorage.setItem(_getBudgetKey(id), Math.max(0, remaining - points)); } catch (_) {}
}

//    Support Widget                                                             
const _FAQ = [
  { q: '¿Cómo enviar un reconocimiento?',
    a: 'Hacé clic en el botón "Reconocer" en la pantalla principal. Elegí la persona, selecció un valor y escribí un mensaje.' },
  { q: '¿Cómo crear un programa personalizado?',
    a: 'Andá a "Programas" en el menú lateral. Hacé clic en "+ Nuevo programa", escribí el nombre y elegí un emoji.' },
  { q: '¿Cómo canjear puntos?',
    a: 'Andá a "Tienda" en el menú lateral. Elegí la recompensa y confirmá el canje. Los puntos se descuentan automáticamente.' },
  { q: '¿Qué son los puntos?',
    a: 'Los puntos son la moneda de reconocimiento. Cada usuario tiene puntos para dar y para canjear en la tienda.' },
  { q: '¿Qué es un reconocimiento privado?',
    a: 'Solo lo ven vos, el destinatario y los administradores. No aparece en el feed público. Activálo con el toggle en el paso 3 del modal.' },
  { q: '¿Cómo agregar empleados?',
    a: 'Si sos administrador, andá al panel Admin. Podés agregar empleados uno por uno o importar desde un CSV.' },
  { q: '¿Cómo vincular mi cuenta de Slack?',
    a: 'En Slack escribí /allay link tu@email.com. Una vez vinculado podés enviar reconocimientos con /allay @nombre Valor Mensaje.' },
  { q: '¿Cómo ver Analytics?',
    a: 'El botón Analytics aparece en la barra lateral si sos administrador. Desde ahí accedés a engagement, insights y reportes.' },
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

