// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let sidebarCollapsed = false;

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
  } else {
    // 1. First expand width (transition plays)
    sidebar.style.width    = '16rem';
    sidebar.style.minWidth = '16rem';
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

function sidebarNav(callback) { callback(); }

function _positionOverlayPage(pageId) {
  const page    = document.getElementById(pageId);
  const sidebar = document.getElementById('left-sidebar');
  if (!page || !sidebar) return;
  const w = sidebar.style.width || '16rem';
  page.style.left = w;
  page.style.position = 'fixed';
  page.style.top = '0';
  page.style.right = '0';
  page.style.bottom = '0';
  page.style.zIndex = '40';
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
let selectedPerson = null;
let selectedProgram = null;
let currentPage = 'home';
let employees = [];
let selectedFile = null;
let currentUser = null;
let originalSuperadminUser = null;
let allUsers = [];
let isLoggedIn = false;
let notificationsTab = 'all';

let notificationsList = [
  { id: 1, type: 'recognition',      name: 'Carlos Ruiz',         action: 'reaccionó a tu reconocimiento',  emoji: '❤️', time: '2 horas',  read: false },
  { id: 2, type: 'comment',          name: 'Ana López',            action: 'comentó en tu reconocimiento',   message: '¡Totalmente merecido! María es increíble 💜', time: '2 horas',  read: false },
  { id: 3, type: 'reaction_multiple',name: 'Diego Torres y otros', action: 'reaccionaron ❤️ a tu reconocimiento', time: '3 horas',  read: true  },
  { id: 4, type: 'recognition',      name: 'Lucas Méndez',         action: 'te reconoció',                   emoji: '⭐', time: '5 horas',  read: true  },
  { id: 5, type: 'milestone',        name: 'Sistema',              action: 'Alcanzaste 500 puntos acumulados', emoji: '🎉', time: '1 día',   read: true  }
];

let companies = [
  { id: 'comp-1', name: 'Tech Corp',      domain: '@techcorp.com'      },
  { id: 'comp-2', name: 'Design Studio',  domain: '@designstudio.com'  },
  { id: 'comp-3', name: 'Marketing Pro',  domain: '@marketingpro.com'  },
  { id: 'comp-0', name: 'Superadmin',     domain: '@superadmin.com'    }
];

// ─────────────────────────────────────────
// AUTH — LOGIN / LOGOUT
// ─────────────────────────────────────────
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
      password_changed: profile.password_changed || false
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
      document.getElementById('login-page').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('change-password-modal').classList.add('hidden');
      filterEmployeesByCompany();
      renderEmployeesList();
      updateAdminVisibility();
      updateProfileDisplay();
      updatePointsDisplay();
      renderFeed(true);
      loadNotifications();
      loadCompanyPrograms();
      _applySidebarState();
      _initSidebarTooltip();
      showSuccessToast(`¡Bienvenido, ${currentUser.name}!`);
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Login error:', err);
    errorText.textContent = 'Error de conexión. Recargá la página e intentá de nuevo.';
    errorDiv.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalHTML;
    lucide.createIcons();
  }
}

function logout() {
  window.authSdk.logout();
  currentUser = null;
  isLoggedIn  = false;
  document.body.classList.remove('is-superadmin');
  originalSuperadminUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('change-password-modal').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('impersonation-banner').classList.add('hidden');
  document.getElementById('login-form').reset();
  document.getElementById('login-error').classList.add('hidden');
  showSuccessToast('Sesión cerrada correctamente');
}

// ─────────────────────────────────────────
// PASSWORD CHANGE (FIRST LOGIN)
// ─────────────────────────────────────────
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
    el.textContent = ok ? '✓' : '○';
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
    console.error('Error saving password:', error);
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
  navigator.clipboard.writeText(text).then(() => showSuccessToast('Contraseña copiada')).catch(console.error);
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function getCompanyFromEmail(email) {
  const domain = '@' + email.split('@')[1];
  return companies.find(c => c.domain === domain) || null;
}

function getUserRole(email) {
  if (email.includes('superadmin')) return 'superadmin';
  if (email.includes('admin'))      return 'admin';
  return 'employee';
}

function getAvatarColor(name) {
  const colors = [
    'from-violet-500 to-lila-400', 'from-rosa-400 to-rosa-500',
    'from-lila-400 to-violet-500', 'from-rosa-300 to-lila-400',
    'from-violet-400 to-rosa-400', 'from-lila-300 to-rosa-400',
    'from-violet-600 to-lila-500', 'from-rosa-500 to-lila-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─────────────────────────────────────────
// DATA SDK
// ─────────────────────────────────────────
const dataHandler = {
  onDataChanged(data) {
    allUsers  = data || [];
    employees = [...allUsers];
    if (isLoggedIn && currentUser) {
      filterEmployeesByCompany();
      renderEmployeesList();
      renderPeopleList();
    }
  }
};

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
  if (!result.isOk) console.error('Failed to initialize Data SDK');
}

initDataSDK();


// ─────────────────────────────────────────
// EMPLOYEE LIST (ADMIN PANEL)
// ─────────────────────────────────────────
function filterEmployeesSearch() {
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

  countEl.textContent = `${displayEmployees.length} ${displayEmployees.length === 1 ? 'empleado' : 'empleados'}`;

  if (displayEmployees.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">No hay empleados cargados. Sube un archivo CSV para comenzar.</p>';
    return;
  }

  const canManage = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  container.innerHTML = displayEmployees.map(emp => `
    <div class="p-4 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 transition flex items-center justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <p class="text-sm font-semibold text-gray-800">${emp.name}</p>
          <span class="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">${emp.company_id}</span>
        </div>
        <p class="text-xs text-gray-500 mt-0.5">${emp.email} · ${emp.department}</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="text-right">
          <div class="flex items-center gap-1 text-sm">
            <span class="font-semibold text-violet-600">${emp.points_to_give}</span>
            <span class="text-xs text-gray-400">para dar</span>
          </div>
          <div class="flex items-center gap-1 text-sm mt-1">
            <span class="font-semibold text-green-600">${emp.points_to_redeem}</span>
            <span class="text-xs text-gray-400">para canjear</span>
          </div>
        </div>
        ${canManage ? `
        <button onclick="openPointsModal('${emp.__backendId}', '${emp.name.replace(/'/g,"\\'")}', ${emp.points_to_give}, ${emp.points_to_redeem})" class="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition" title="Gestionar puntos">
          <i data-lucide="coins" class="w-4 h-4"></i>
        </button>` : ''}
        ${currentUser?.role === 'superadmin' ? `
        <button onclick="impersonateEmployee('${emp.__backendId}')" class="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition" title="Usar cuenta de este empleado">
          <i data-lucide="user-check" class="w-4 h-4"></i>
        </button>
        <button onclick="openRoleModal('${emp.__backendId}', '${emp.name.replace(/'/g,"\\'")}', '${emp.email}', '${emp.role}')" class="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-600 transition" title="Cambiar rol">
          <i data-lucide="shield" class="w-4 h-4"></i>
        </button>` : ''}
        ${canManage ? `
        <button onclick="deleteEmployee('${emp.__backendId}')" class="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition" title="Eliminar empleado">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>` : ''}
      </div>
    </div>
  `).join('');

  renderPeopleList();
  lucide.createIcons();
}

// ─────────────────────────────────────────
// PEOPLE LIST (RECOGNITION MODAL)
// ─────────────────────────────────────────
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
    return `
      <div class="person-item flex items-center gap-3 p-3 rounded-xl hover:bg-violet-50 cursor-pointer transition border border-transparent hover:border-violet-200"
           data-name="${emp.name}" data-email="${emp.email}" onclick="selectPerson(this)">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold">
          ${initials}
        </div>
        <div>
          <p class="text-sm font-semibold text-gray-800">${emp.name}</p>
          <p class="text-xs text-gray-500">${emp.department} · ${emp.email}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────
// CSV UPLOAD
// ─────────────────────────────────────────
function handleFileUpload(input) {
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
  const nameIdx    = idx(['nombre', 'name']);
  const emailIdx   = idx(['email', 'correo']);
  const passwordIdx= idx(['contraseña', 'password', 'pass']);
  const deptIdx    = idx(['departamento', 'department', 'depto']);
  const companyIdx = idx(['empresa', 'company_id', 'company']);
  const roleIdx    = idx(['rol', 'role']);
  const giveIdx    = idx(['para_dar', 'to_give', 'puntos_dar']);
  const redeemIdx  = idx(['para_canjear', 'to_redeem', 'puntos_canjear']);

  const newEmployees = [];
  const duplicates   = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length >= 5 && cols[0]) {
      const email = cols[emailIdx] || cols[1];
      if (allUsers.find(emp => emp.email === email)) { duplicates.push(email); continue; }
      const rawRole = (roleIdx !== -1 ? cols[roleIdx] : '') || 'employee';
      const validRole = ['employee', 'admin', 'superadmin'].includes(rawRole) ? rawRole : 'employee';
      newEmployees.push({
        name:             cols[nameIdx]    || cols[0],
        email,
        password:         cols[passwordIdx] || 'Allay2024!',
        department:       cols[deptIdx]    || cols[2] || 'General',
        company_id:       cols[companyIdx] || currentUser?.company_id || 'comp-1',
        points_to_give:   parseInt(cols[giveIdx]   || cols[3]) || 100,
        points_to_redeem: parseInt(cols[redeemIdx] || cols[4]) || 0,
        user_id:          email,
        role:             validRole
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

    const btn = document.getElementById('upload-btn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Cargando...';

    const results = [];
    for (const emp of newEmps) {
      const result = await window.dataSdk.create(emp);
      results.push({ emp, ok: result.isOk, error: result.error || null });
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
          <p class="text-sm font-semibold text-gray-800 truncate">${r.emp.name}</p>
          <p class="text-xs text-gray-500 truncate">${r.emp.email}</p>
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
          <p class="text-xs text-amber-600 mt-0.5">Ya existe en la plataforma — omitido</p>
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

// ─────────────────────────────────────────
// ROLE MANAGEMENT
// ─────────────────────────────────────────
let selectedEmployeeForRole = null;

// ─────────────────────────────────────────
// POINTS MODAL
// ─────────────────────────────────────────
let _pointsTargetId = null;

function openPointsModal(empId, name, currentGive, currentRedeem) {
  _pointsTargetId = empId;
  document.getElementById('points-modal-name').textContent  = name;
  document.getElementById('points-give-current').textContent    = currentGive;
  document.getElementById('points-redeem-current').textContent  = currentRedeem;
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

function openRoleModal(empId, name, email, currentRole) {
  if (!currentUser || currentUser.role !== 'superadmin') { showErrorToast('Solo superadmins pueden cambiar roles de usuarios'); return; }
  selectedEmployeeForRole = empId;
  document.getElementById('role-modal-user-name').textContent  = name;
  document.getElementById('role-modal-user-email').textContent = email;
  document.querySelector(`input[name="new-role"][value="${currentRole}"]`).checked = true;
  document.getElementById('role-modal').classList.remove('hidden');
}

function closeRoleModal() { document.getElementById('role-modal').classList.add('hidden'); }

async function saveRoleChange() {
  if (!currentUser || currentUser.role !== 'superadmin') { showErrorToast('Solo superadmins pueden cambiar roles de usuarios'); return; }
  if (!selectedEmployeeForRole) { showErrorToast('No hay empleado seleccionado'); return; }

  const newRole  = document.querySelector('input[name="new-role"]:checked')?.value;
  if (!newRole) { showErrorToast('Por favor selecciona un rol'); return; }

  const employee = allUsers.find(emp => emp.__backendId === selectedEmployeeForRole);
  if (!employee) { showErrorToast('Empleado no encontrado'); return; }

  const saveBtn = document.getElementById('save-role-btn');
  saveBtn.disabled = true;
  const originalText = saveBtn.textContent;
  saveBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
  lucide.createIcons();

  try {
    const result = await window.dataSdk.update({ ...employee, role: newRole });
    if (result.isOk) { showSuccessToast(`Rol de ${employee.name} actualizado a ${newRole}`); closeRoleModal(); }
    else showErrorToast('Error al guardar el cambio de rol');
  } catch { showErrorToast('Error al guardar el cambio de rol'); }
  finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

// ─────────────────────────────────────────
// TOASTS
// ─────────────────────────────────────────
function showSuccessToast(msg) {
  const toast = document.getElementById('success-toast');
  toast.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> <span>${msg}</span>`;
  toast.classList.remove('hidden');
  lucide.createIcons();
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showErrorToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-gradient-to-r from-red-600 to-red-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold';
  toast.style.animation = 'scaleIn 0.3s ease';
  toast.innerHTML = `<i data-lucide="alert-circle" class="w-5 h-5"></i> <span>${msg}</span>`;
  document.body.appendChild(toast);
  lucide.createIcons();
  setTimeout(() => toast.remove(), 3000);
}

// ─────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────
function toggleNotifications(e) {
  e.stopPropagation();
  document.getElementById('notifications-dropdown').classList.toggle('hidden');
}

function openNotificationsPage() {
  currentPage = 'notifications';
  document.getElementById('notifications-page').classList.remove('hidden');
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
    const actions = `
      <div class="flex gap-2 shrink-0">
        <button onclick="markNotificationRead(${notif.id})" class="p-2 rounded-lg hover:bg-gray-100 transition" title="Marcar como leída">
          <i data-lucide="check" class="w-4 h-4 text-gray-400 hover:text-violet-600"></i>
        </button>
        <button onclick="deleteNotification(${notif.id})" class="p-2 rounded-lg hover:bg-red-50 transition" title="Eliminar">
          <i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i>
        </button>
      </div>`;

    if (notif.type === 'comment') {
      return `
        <div class="p-4 rounded-xl border ${notif.read ? 'border-gray-200 bg-white' : 'border-blue-300 bg-blue-50'} hover:shadow-md transition cursor-pointer group">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center text-white font-bold shrink-0 group-hover:scale-105 transition">${notif.name.charAt(0)}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-800"><span class="font-semibold">${notif.name}</span> ${notif.action}</p>
              <p class="text-xs text-gray-600 mt-1.5 italic">"${notif.message}"</p>
              <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${notif.time}</p>
            </div>${actions}
          </div>
        </div>`;
    }
    if (notif.type === 'milestone') {
      return `
        <div class="p-4 rounded-xl border ${notif.read ? 'border-gray-200 bg-white' : 'border-yellow-300 bg-yellow-50'} hover:shadow-md transition cursor-pointer group">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center text-white font-bold shrink-0 group-hover:scale-105 transition">🎯</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-800"><span class="font-semibold">${notif.name}</span> ${notif.action}</p>
              <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${notif.time}</p>
            </div>
            <span class="text-2xl shrink-0">${notif.emoji}</span>
            ${actions}
          </div>
        </div>`;
    }
    // recognition / reaction_multiple
    const avatarGrad = notif.type === 'reaction_multiple'
      ? 'from-purple-400 to-rosa-400'
      : 'from-violet-400 to-rosa-400';
    const avatarContent = notif.type === 'reaction_multiple'
      ? `+${Math.floor(Math.random() * 5) + 2}`
      : notif.name.charAt(0);
    const borderCol = notif.type === 'reaction_multiple'
      ? (notif.read ? 'border-gray-200 bg-white' : 'border-purple-300 bg-purple-50')
      : unreadClass;
    return `
      <div class="p-4 rounded-xl border ${borderCol} hover:shadow-md transition cursor-pointer group">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarGrad} flex items-center justify-center text-white font-bold shrink-0 group-hover:scale-105 transition text-xs">${avatarContent}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-800"><span class="font-semibold">${notif.name}</span> ${notif.action}</p>
            <p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${notif.time}</p>
          </div>
          ${notif.emoji ? `<span class="text-2xl shrink-0">${notif.emoji}</span>` : ''}
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
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold';
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
// PROFILE
// ─────────────────────────────────────────
function updateProfileDisplay() {
  if (!currentUser) return;
  const initials  = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const firstName = currentUser.name.split(' ')[0];

  const avatar = document.getElementById('btn-profile')?.querySelector('div');
  if (avatar) avatar.textContent = initials;

  const welcomeText = document.getElementById('welcome-text');
  if (welcomeText) welcomeText.textContent = `¡Hola, ${firstName}! 👋`;

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

function openProfilePage() {
  currentPage = 'profile';
  document.getElementById('profile-page').classList.remove('hidden');
  _positionOverlayPage('profile-page');
  document.getElementById('admin-page').classList.add('hidden');
  updateProfileDisplay();
}

function closeProfilePage() {
  document.getElementById('profile-page').classList.add('hidden');
  if (currentPage === 'profile') currentPage = 'home';
  document.getElementById('profile-dropdown').classList.add('hidden');
}

function saveSettings() {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-gradient-to-r from-green-600 to-emerald-500 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-semibold';
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

// ─────────────────────────────────────────
// ADMIN PAGE
// ─────────────────────────────────────────
function openAdminPage() {
  if (!currentUser || (currentUser.role !== 'superadmin' && currentUser.role !== 'admin')) {
    showErrorToast('Solo administradores pueden acceder al panel de administración');
    return;
  }
  currentPage = 'admin';
  _positionOverlayPage('admin-page');
  document.getElementById('admin-page').classList.remove('hidden');
  updateAdminVisibility();
  loadCompanyPrograms();
}

function closeAdminPage() {
  document.getElementById('admin-page').classList.add('hidden');
  if (currentPage === 'admin') currentPage = 'home';
}

function updateAdminVisibility() {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  document.getElementById('admin-nav-link')?.classList.toggle('hidden', !isAdmin);
  document.getElementById('analytics-nav-link')?.classList.toggle('hidden', !isAdmin);
  document.body.classList.toggle('is-admin', isAdmin);
}

// ─────────────────────────────────────────
// IMPERSONATION
// ─────────────────────────────────────────

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

  document.body.classList.remove('is-superadmin');
  updateAdminVisibility();
  updateImpersonationBanner();
  closeAdminPage();

  const initials  = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const firstName = currentUser.name.split(' ')[0];
  const avatarDiv = document.getElementById('btn-profile')?.querySelector('div');
  if (avatarDiv) avatarDiv.textContent = initials;
  document.getElementById('welcome-text').textContent = `¡Hola, ${firstName}! 👋`;

  document.querySelector('.points-card').innerHTML = `
    <div class="flex items-center gap-2 mb-4"><i data-lucide="coins" class="w-5 h-5"></i> <span class="text-sm font-medium opacity-90">Mis puntos</span></div>
    <div class="flex gap-4">
      <div class="flex-1"><p class="text-2xl font-extrabold">${emp.points_to_give}</p><p class="text-xs opacity-80 mt-0.5">Para dar</p></div>
      <div class="w-px bg-white/30"></div>
      <div class="flex-1"><p class="text-2xl font-extrabold">${emp.points_to_redeem}</p><p class="text-xs opacity-80 mt-0.5">Para canjear</p></div>
    </div>`;

  filterEmployeesByCompany();
  renderEmployeesList();
  showSuccessToast(`Usando cuenta de: ${emp.name}`);
  switchPage('home');
  renderFeed(true);
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
  lucide.createIcons();
}

// ─────────────────────────────────────────
// RECOGNITION MODAL
// ─────────────────────────────────────────
function openModal() {
  currentStep = 1; selectedPerson = null; selectedProgram = null;
  document.getElementById('recognize-modal').classList.remove('hidden');
  showStep(1);
  document.getElementById('person-search').value = '';
  renderPeopleList();
  filterPeople('');
  renderProgramsInModal();
  document.getElementById('recog-message').value = '';
  document.getElementById('points-slider').value = 25;
  document.getElementById('points-slider').max   = 50;
  document.getElementById('points-val').textContent = '25';
  document.getElementById('points-warning').classList.add('hidden');
  document.getElementById('program-budget-info')?.classList.add('hidden');
  const cb = document.getElementById('use-program-budget');
  if (cb) cb.checked = false;
  // Reset points switch to OFF
  _setPointsSwitch(false);
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
    // Just turned on — validate current slider value
    updatePointsSlider(document.getElementById('points-slider').value);
  } else {
    // Turned off — clear warning, re-enable button
    document.getElementById('points-warning').classList.add('hidden');
    document.getElementById('modal-next').disabled = false;
  }
}

function closeModal() { document.getElementById('recognize-modal').classList.add('hidden'); }

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
  if (currentStep === 3)      { txt.textContent = 'Enviar ✨'; btn.disabled = false; }
  else if (currentStep === 2) { btn.disabled = !selectedProgram; txt.textContent = 'Siguiente'; }
  else                        { btn.disabled = !selectedPerson;  txt.textContent = 'Siguiente'; }
}

function nextStep() {
  if (currentStep === 3) { sendRecognition(); return; }
  if (currentStep === 2) {
    document.getElementById('sum-name').textContent    = selectedPerson;
    document.getElementById('sum-program').textContent = selectedProgram;
    document.getElementById('sum-avatar').textContent  = selectedPerson.charAt(0);
  }
  showStep(currentStep + 1);
}

function prevStep() { if (currentStep > 1) showStep(currentStep - 1); }

function updatePointsSlider(value) {
  document.getElementById('points-val').textContent = value;
  const usingBudget = document.getElementById('use-program-budget')?.checked;
  const prog        = _getProgramByLabel(selectedProgram);
  let ok;
  if (usingBudget && prog?.custom) {
    ok = _getProgramRemainingBudget(prog) >= parseInt(value);
  } else {
    ok = currentUser && currentUser.points_to_give >= parseInt(value);
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

function selectPerson(el) {
  document.querySelectorAll('.person-item').forEach(e => {
    e.classList.remove('bg-violet-50', 'border-violet-300');
    e.classList.add('border-transparent');
  });
  el.classList.add('bg-violet-50', 'border-violet-300');
  el.classList.remove('border-transparent');
  selectedPerson = el.dataset.name;
  updateModalBtn();
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
  const using = document.getElementById('use-program-budget').checked;
  const prog  = _getProgramByLabel(selectedProgram);
  const slider = document.getElementById('points-slider');
  if (using && prog) {
    const remaining = _getProgramRemainingBudget(prog);
    slider.max   = remaining;
    slider.value = Math.min(parseInt(slider.value), remaining);
    document.getElementById('points-val').textContent = slider.value;
    document.getElementById('points-warning').classList.add('hidden');
    document.getElementById('modal-next').disabled = false;
  } else {
    slider.max = 50;
    updatePointsSlider(slider.value);
  }
}

// ─────────────────────────────────────────
// SEND RECOGNITION
// ─────────────────────────────────────────
async function sendRecognition() {
  const message       = document.getElementById('recog-message').value;
  const pointsOn      = document.getElementById('points-toggle')?.getAttribute('aria-checked') === 'true';
  const points        = pointsOn ? parseInt(document.getElementById('points-slider').value) : 0;
  const usingBudget   = document.getElementById('use-program-budget')?.checked;
  const selectedProg  = _getProgramByLabel(selectedProgram);

  if (pointsOn) {
    if (usingBudget && selectedProg?.custom) {
      const remaining = _getProgramRemainingBudget(selectedProg);
      if (points > remaining) {
        showErrorToast('El programa no tiene suficiente presupuesto');
        return;
      }
    } else if (!currentUser || currentUser.points_to_give < points) {
      showErrorToast('No tienes suficientes puntos para enviar');
      return;
    }
  }

  const sendBtn = document.getElementById('modal-next');
  sendBtn.disabled = true;
  const originalText = sendBtn.textContent;
  sendBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Enviando...';
  lucide.createIcons();

  try {
    let recipient = allUsers.find(e => e.name === selectedPerson && e.company_id === currentUser.company_id);
    if (!recipient && currentUser.role === 'superadmin') recipient = allUsers.find(e => e.name === selectedPerson);
    if (!recipient) { showErrorToast('Destinatario no encontrado.'); return; }

    // Cuando se usa budget del programa, acreditamos los puntos al usuario en la BD
    // para que el RPC los pueda descontar normalmente
    if (pointsOn && usingBudget && selectedProg?.custom && points > 0) {
      const topped = { ...currentUser, points_to_give: currentUser.points_to_give + points };
      await window.dataSdk.update(topped);
    }

    const { isOk, error } = await window.recognitionSdk.send(
      recipient.__backendId, points, selectedProgram, message, currentUser.company_id
    );

    if (!isOk) {
      // Si falló y habíamos creditado, revertir
      if (pointsOn && usingBudget && selectedProg?.custom && points > 0) {
        await window.dataSdk.update(currentUser);
      }
      const msg = error?.message === 'insufficient_points'
        ? 'No tenés suficientes puntos'
        : 'Error al enviar el reconocimiento';
      showErrorToast(msg);
      return;
    }

    // Descontar puntos según la fuente
    if (pointsOn && points > 0) {
      if (usingBudget && selectedProg?.custom) {
        _deductProgramBudget(selectedProg.id, points);
      } else {
        currentUser.points_to_give -= points;
      }
    }

    await window.dataSdk.refresh();
    updateAllPointsDisplays();
    await renderFeed(true);
    closeModal();
    showSuccessToast(`¡Reconocimiento enviado! -${points} puntos del programa`);
  } catch (err) {
    console.error('Error sending recognition:', err);
    showErrorToast('Error al enviar reconocimiento');
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = originalText;
  }
}

// ─────────────────────────────────────────
// POINTS DISPLAY
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// REACTIONS & COMMENTS
// ─────────────────────────────────────────
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
    if (/^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(t)) imgs.push(t);
    else if (t) textLines.push(t);
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
  const card       = btn.closest('article');
  const list       = card.querySelector('.comments-list');
  const all        = JSON.parse(card.dataset.allComments || '[]');
  const shown      = parseInt(card.dataset.shownComments || '0');
  const STEP       = 3;
  const next       = all.slice(shown, shown + STEP);

  next.forEach(c => {
    const ci   = (c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase();
    const time = c.created_at ? formatTimeAgo(c.created_at) : '';
    const div  = document.createElement('div');
    div.className = 'flex items-start gap-2.5';
    div.innerHTML = `
      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-rosita-400 flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
      <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-700">${c.user?.name || 'Usuario'}</p>
          ${time ? `<span class="text-[10px] text-gray-400 shrink-0">${time}</span>` : ''}
        </div>
        ${(() => { const { text, imgs } = parseCommentMessage(c.message); return (text ? `<p class="text-xs text-gray-600 mt-0.5">${text}</p>` : '') + imgs.map(u => `<img src="${u}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join(''); })()}
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
    <div class="w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0">${initials}</div>
    <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold text-gray-700">${currentUser.name}</p>
        <span class="text-[10px] text-gray-400 shrink-0">Ahora</span>
      </div>
      ${text ? `<p class="text-xs text-gray-600 mt-0.5">${text}</p>` : ''}
      ${localImgUrl ? `<img src="${localImgUrl}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">` : ''}
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

// ─────────────────────────────────────────
// PAGE SWITCHING
// ─────────────────────────────────────────
function switchPage(page) {
  currentPage = page;

  // Cerrar cualquier página overlay abierta
  ['admin-page', 'analytics-page', 'store-page', 'profile-page', 'notifications-page', 'programs-page'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
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

  if (page === 'store') openStore();
  else if (page === 'programs') openProgramsPage();
}

// ─────────────────────────────────────────
// ELEMENT SDK CONFIG
// ─────────────────────────────────────────
const defaultConfig = {
  platform_name:         'Allays',
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

// ─────────────────────────────────────────
// FEED — carga dinámica desde Supabase
// ─────────────────────────────────────────
let feedOffset = 0;
const FEED_LIMIT = 10;

const PROGRAM_COLORS = {
  '🏆 Trabajo en Equipo':         'from-violet-500 to-rosa-500',
  '🎯 Liderazgo':                 'from-blue-500 to-violet-500',
  '💡 Innovación':                'from-lila-500 to-violet-500',
  '🤝 Colaboración':              'from-rosa-500 to-lila-500',
  '⭐ Actitud':                   'from-yellow-400 to-orange-400',
  '✅ Cumplimiento de objetivos':  'from-green-400 to-teal-500',
};
const AVATAR_COLORS = ['from-violet-500 to-lila-400', 'from-rosa-400 to-rosa-500', 'from-lila-400 to-violet-500'];

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

function buildFeedCard(rec) {
  const senderName    = rec.from_user?.name || 'Alguien';
  const recipientName = rec.to_user?.name   || 'Alguien';
  const initials      = senderName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const avatarColor   = AVATAR_COLORS[senderName.length % AVATAR_COLORS.length];
  const gradient      = PROGRAM_COLORS[rec.program] || 'from-violet-500 to-rosa-500';
  const programData   = _getProgramByLabel(rec.program);

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
    const ci   = (c.user?.name || '?').split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase();
    const time = c.created_at ? formatTimeAgo(c.created_at) : '';
    const { text: msgText, imgs } = parseCommentMessage(c.message);
    const imgHtml = imgs.map(u => `<img src="${u}" class="mt-1.5 rounded-lg max-w-full max-h-40 object-cover border border-gray-100">`).join('');
    return `<div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-rosita-400 flex items-center justify-center text-white text-xs font-bold shrink-0">${ci}</div>
      <div class="bg-gray-50 rounded-xl px-3 py-2 flex-1">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs font-semibold text-gray-700">${c.user?.name || 'Usuario'}</p>
          ${time ? `<span class="text-[10px] text-gray-400 shrink-0">${time}</span>` : ''}
        </div>
        ${msgText ? `<p class="text-xs text-gray-600 mt-0.5">${msgText}</p>` : ''}
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
         <img src="${programData.image}" class="w-full h-full object-cover" alt="${programData.name}">
       </div>`
    : '';

  card.innerHTML = `
    ${bannerHtml}
    <div class="p-5">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-bold shrink-0">${initials}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm"><span class="font-bold text-gray-800">${senderName}</span> <span class="text-gray-400">reconoció a</span> <span class="font-bold text-violet-600">${recipientName}</span></p>
          <p class="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${formatTimeAgo(rec.created_at)} · <span class="text-violet-500 font-medium">${rec.program}</span></p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="bg-gradient-to-r ${gradient} text-white text-xs font-bold px-2.5 py-1 rounded-full">+${rec.points} pts</span>
          <div class="feed-admin-menu relative">
            <button onclick="toggleFeedMenu(event,'${rec.id}')" class="p-1 rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600 font-bold text-base leading-none">···</button>
            <div id="feedmenu-${rec.id}" class="hidden absolute right-0 top-7 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px] z-10">
              <button onclick="openDeleteRecognitionModal('${rec.id}')" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left">
                🗑️ Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
      <p class="text-sm text-gray-700 leading-relaxed">${rec.message || ''}</p>
    </div>
    <div class="bg-gradient-to-r from-violet-50 to-rosa-50 px-5 py-3 flex items-center justify-between">
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

// ── Feed card menu (superadmin) ───────────
const isSuperadmin = () => currentUser?.role === 'superadmin';

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
  const { isOk } = await window.recognitionSdk.delete(_deletingRecognitionId);
  if (!isOk) { showErrorToast('Error al eliminar el reconocimiento'); return; }
  closeDeleteRecognitionModal();
  await renderFeed(true);
  showSuccessToast('Reconocimiento eliminado');
}

async function renderFeed(reset = true) {
  const container = document.getElementById('feed-container');
  if (!container) return;

  if (reset) {
    feedOffset = 0;
    container.innerHTML = '<div class="text-center py-10"><i data-lucide="loader" class="w-8 h-8 animate-spin text-violet-400 mx-auto"></i></div>';
    lucide.createIcons();
  }

  const isImpersonating = !!originalSuperadminUser;
  const isSuperadminView = currentUser?.role === 'superadmin' && !isImpersonating;
  const companyFilter = isSuperadminView ? null : currentUser?.company_id;
  const { isOk, data } = await window.recognitionSdk.list(feedOffset, FEED_LIMIT, companyFilter);

  if (reset) container.innerHTML = '';
  document.getElementById('load-more-feed')?.remove();

  if (!isOk) { container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">Error al cargar el feed.</p>'; return; }
  if (data.length === 0 && feedOffset === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">¡Sé el primero en reconocer a alguien! 🌟</p>';
    return;
  }

  data.forEach(rec => container.appendChild(buildFeedCard(rec)));
  feedOffset += data.length;

  if (data.length === FEED_LIMIT) {
    const btn = document.createElement('button');
    btn.id = 'load-more-feed';
    btn.className = 'w-full py-3 text-sm font-medium text-violet-600 hover:text-violet-700 transition';
    btn.textContent = 'Cargar más →';
    btn.onclick = () => renderFeed(false);
    container.appendChild(btn);
  }
  lucide.createIcons();
}

// ─────────────────────────────────────────
// NOTIFICATIONS — DB-driven
// ─────────────────────────────────────────
let _notificationsData = [];

async function loadNotifications() {
  const { data } = await window.notificationSdk.list();
  _notificationsData = data;
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
    const icon = n.type === 'recognition' ? 'heart' : n.type === 'reaction' ? 'smile' : 'message-circle';
    const iconColor = n.type === 'recognition' ? 'rose' : n.type === 'reaction' ? 'violet' : 'blue';
    const text = n.type === 'recognition'
      ? `<span class="font-semibold">${fromName}</span> te reconoció (+${n.data?.points} pts)`
      : n.type === 'reaction'
      ? `<span class="font-semibold">${fromName}</span> reaccionó ${n.data?.emoji} a tu reconocimiento`
      : `<span class="font-semibold">${fromName}</span> comentó en tu reconocimiento`;
    return `<div class="notif-item p-3 rounded-lg ${n.read ? '' : 'bg-violet-50'} hover:bg-gray-50 cursor-pointer transition border border-transparent hover:border-gray-200">
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
    const text = n.type === 'recognition'
      ? `<span class="font-semibold">${fromName}</span> te reconoció con <strong>+${n.data?.points} pts</strong> · ${n.data?.program}`
      : n.type === 'reaction'
      ? `<span class="font-semibold">${fromName}</span> reaccionó ${n.data?.emoji} a tu reconocimiento`
      : `<span class="font-semibold">${fromName}</span> comentó en tu reconocimiento`;
    return `<div class="p-4 rounded-xl border ${unread} hover:shadow-md transition cursor-pointer group" onclick="markNotificationRead('${n.id}')">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-rosa-400 flex items-center justify-center text-white font-bold shrink-0">${(fromName[0] || '?').toUpperCase()}</div>
        <div class="flex-1 min-w-0"><p class="text-sm text-gray-800">${text}</p><p class="text-xs text-gray-400 mt-1"><i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${formatTimeAgo(n.created_at)}</p></div>
        <button onclick="event.stopPropagation(); deleteNotification('${n.id}')" class="p-2 rounded-lg hover:bg-red-50 transition"><i data-lucide="trash-2" class="w-4 h-4 text-gray-400 hover:text-red-500"></i></button>
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

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────
async function openStore() {
  document.getElementById('store-page').classList.remove('hidden');
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
    { key: 'bienestar',    label: 'Bienestar',    emoji: '🌿', desc: 'Cuidá tu energía',                 dbKeys: ['wellness'] },
    { key: 'crecimiento',  label: 'Crecimiento',  emoji: '📚', desc: 'Invertí en tu desarrollo',         dbKeys: ['growth', 'learning'] },
    { key: 'experiencias', label: 'Experiencias', emoji: '✨', desc: 'Momentos que van a quedar',        dbKeys: ['experience', 'gift_card', 'merch', 'general'] },
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
        ${!isPlaceholder &&  canAfford  ? `<p class="text-[10px] text-emerald-500 font-medium mt-0.5">Podés canjear esto ✓</p>` : ''}
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

// ─────────────────────────────────────────
// PROGRAMS — gestión de valores corporativos
// ─────────────────────────────────────────
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
  page.classList.remove('hidden');
  _positionOverlayPage('programs-page');
  renderProgramsPage();
}

function closeProgramsPage() {
  document.getElementById('programs-page')?.classList.add('hidden');
}

function renderProgramsPage() {
  const grid = document.getElementById('programs-page-grid');
  if (!grid) return;
  const active = companyPrograms.filter(p => p.active !== false);
  if (!active.length) {
    grid.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-12">No hay programas configurados aún.</p>';
    return;
  }
  grid.innerHTML = active.map(p => {
    const remaining = _getProgramRemainingBudget(p);
    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 text-center hover:shadow-md transition relative">
      ${p.custom ? `
        <div class="absolute top-3 right-3" style="z-index:2;">
          <button onclick="toggleProgramMenu(event,'${p.id}')"
            class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700 font-bold text-base leading-none">
            ···
          </button>
          <div id="pmenu-${p.id}" class="hidden absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px]">
            <button onclick="openEditProgramModal('${p.id}'); closeProgramMenus()"
              class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
              ✏️ Editar
            </button>
            <button onclick="openDeleteProgramModal('${p.id}','${p.name.replace(/'/g,"\\'")}'); closeProgramMenus()"
              class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition text-left">
              🗑️ Eliminar
            </button>
          </div>
        </div>` : ''}
      <div class="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-3xl">${p.emoji || '⭐'}</div>
      <h3 class="font-bold text-gray-800 text-sm">${p.name}</h3>
      ${p.tag ? `<span class="text-[10px] text-gray-400 font-medium">#${p.tag}</span>` : ''}
      ${p.description ? `<p class="text-[11px] text-gray-500 leading-snug">${p.description}</p>` : ''}
      <div class="flex items-center gap-2 flex-wrap justify-center">
        <span class="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">Activo</span>
        ${p.budget ? `<span class="text-[10px] font-semibold text-celeste-700 bg-celeste-50 px-2.5 py-1 rounded-full">🪙 ${remaining} / ${p.budget} pts</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderHomeProgramsWidget() {
  const container = document.getElementById('home-programs-list');
  if (!container) return;
  const active = companyPrograms.filter(p => p.active !== false);
  if (!active.length) {
    container.innerHTML = '<span class="text-[10px] text-gray-400">Sin programas configurados</span>';
    return;
  }
  container.innerHTML = active.map(p => `
    <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-50 border border-violet-100 text-[10px] font-medium text-violet-700">
      <span>${p.emoji || '⭐'}</span>${p.name}
    </span>`).join('');
}

function renderProgramsInModal() {
  const grid = document.getElementById('programs-grid');
  if (!grid) return;

  const active = companyPrograms.filter(p => p.active !== false);

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

// ── Nuevo programa modal ──────────────────
let _npSelectedEmployees = new Set();
let _npSelectedEmoji = '🏆';
let _npImageBase64   = null;

const NP_EMOJI_LIST = [
  '🏆','🎯','💡','🤝','⭐','✅','🌟','🔥','💎','🚀',
  '🎖️','💪','🙌','👑','🎗️','🧠','❤️','💬','📈','🌈',
  '🦁','🦋','🌻','⚡','🎓','🏅','🤩','💫','🛡️','🎪',
];

function openNewProgramModal() {
  _editingProgramId    = null;
  _npSelectedEmployees = new Set();
  _npSelectedEmoji     = '🏆';
  _npImageBase64       = null;
  document.getElementById('new-program-form').reset();
  document.getElementById('np-emp-count').textContent = '0 empleados seleccionados';
  document.getElementById('np-emoji-btn').textContent = '🏆';
  document.getElementById('np-emoji-picker').classList.add('hidden');
  document.getElementById('np-image-preview').classList.add('hidden');
  document.getElementById('np-image-placeholder').classList.remove('hidden');
  document.getElementById('np-image-clear').classList.add('hidden');
  document.getElementById('np-modal-title').textContent = 'Nuevo programa';
  document.getElementById('np-submit-btn').textContent  = 'Crear programa';
  document.getElementById('np-budget-status').classList.add('hidden');
  document.getElementById('np-budget-create').classList.remove('hidden');
  document.getElementById('np-budget-recharge').classList.add('hidden');
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
  const added     = parseInt(document.getElementById('np-budget-add').value) || 0;
  document.getElementById('np-budget-preview').textContent = remaining + added;
}

function toggleEmojiPicker() {
  document.getElementById('np-emoji-picker').classList.toggle('hidden');
}

function selectNpEmoji(emoji) {
  _npSelectedEmoji = emoji;
  document.getElementById('np-emoji-btn').textContent = emoji;
  document.getElementById('np-emoji-picker').classList.add('hidden');
}

let _cropper = null;

function previewProgramImage(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => openCropModal(e.target.result);
  reader.readAsDataURL(file);
}

function openCropModal(src) {
  const modal = document.getElementById('crop-modal');
  const img   = document.getElementById('crop-source');
  modal.classList.remove('hidden');
  lucide.createIcons();

  img.src = src;
  if (_cropper) { _cropper.destroy(); _cropper = null; }

  img.onload = () => {
    _cropper = new Cropper(img, {
      aspectRatio: 3 / 1,
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
  document.getElementById('np-image-input').value = '';
}

function applyCrop() {
  if (!_cropper) return;
  const canvas = _cropper.getCroppedCanvas({ width: 900, height: 300 });
  _npImageBase64 = canvas.toDataURL('image/jpeg', 0.88);

  const preview = document.getElementById('np-image-preview');
  preview.src = _npImageBase64;
  preview.classList.remove('hidden');
  document.getElementById('np-image-placeholder').classList.add('hidden');
  document.getElementById('np-image-clear').classList.remove('hidden');

  document.getElementById('crop-modal').classList.add('hidden');
  _cropper.destroy();
  _cropper = null;
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
  const source = allUsers.filter(u => u.company_id === currentUser?.company_id);
  const filtered = q ? source.filter(u =>
    (u.name || u.email || '').toLowerCase().includes(q) ||
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
        <div class="w-7 h-7 rounded-full bg-gradient-to-br from-celeste-400 to-rosita-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
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
    const added     = parseInt(document.getElementById('np-budget-add').value) || 0;
    budget          = (p?.budget || 0) + added;
    // Actualizar el remaining sumando los puntos recargados
    if (added > 0) {
      try { localStorage.setItem(_getBudgetKey(_editingProgramId), remaining + added); } catch (_) {}
    }
  } else {
    budget = parseInt(document.getElementById('np-budget').value) || 0;
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
    const idx = companyPrograms.findIndex(x => x.id === _editingProgramId);
    if (idx !== -1) {
      const old = companyPrograms[idx];
      // Si aumentaron el budget, ajustar el remaining proporcionalmente
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

// ── Menú de programa (···) ────────────────
function toggleProgramMenu(e, id) {
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

// ── Eliminar programa custom ──────────────
let _deletingProgramId = null;

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

// ── Editar programa custom ────────────────
let _editingProgramId = null;

function openEditProgramModal(id) {
  const p = companyPrograms.find(x => x.id === id);
  if (!p || !p.custom) return;

  _editingProgramId    = id;
  _npSelectedEmoji     = p.emoji || '🏆';
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

// ── Budget helpers ────────────────────────
function _getBudgetKey(id) { return `allay_budget_${id}`; }

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

// ─────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────
let _analyticsCharts = {};

function destroyCharts() {
  Object.values(_analyticsCharts).forEach(c => c?.destroy());
  _analyticsCharts = {};
}

async function openAnalyticsPage() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showErrorToast('Solo administradores pueden ver analytics'); return;
  }
  destroyCharts();
  _positionOverlayPage('analytics-page');
  document.getElementById('analytics-page').classList.remove('hidden');
  await renderAnalytics();
}

function closeAnalyticsPage() {
  destroyCharts();
  document.getElementById('analytics-page').classList.add('hidden');
}

async function renderAnalytics() {
  ['analytics-total-recognitions','analytics-total-points','analytics-active-senders','analytics-this-month']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '…'; });

  const [summaryRes, topRes, deptRes, monthRes] = await Promise.all([
    window.analyticsSdk.summary(),
    window.analyticsSdk.topRecognized(8),
    window.analyticsSdk.byDepartment(),
    window.analyticsSdk.byMonth(6)
  ]);

  if (summaryRes.isOk && summaryRes.data) {
    const s = summaryRes.data;
    document.getElementById('analytics-total-recognitions').textContent = s.total_recognitions || 0;
    document.getElementById('analytics-total-points').textContent       = s.total_points       || 0;
    document.getElementById('analytics-active-senders').textContent     = s.active_senders     || 0;
    document.getElementById('analytics-this-month').textContent         = s.this_month         || 0;
  }

  const VIOLET_SHADES = (n) => Array.from({length: n}, (_, i) =>
    `hsla(${265 - i * 12}, 70%, ${62 + i * 3}%, 0.85)`);
  const PALETTE = ['#7c3aed','#ec4899','#a855f7','#f472b6','#8b5cf6','#db2777','#6d28d9','#be185d'];

  // Chart: Top reconocidos (horizontal bar)
  const topCtx = document.getElementById('chart-top-recognized');
  if (topCtx && topRes.isOk && topRes.data.length > 0) {
    _analyticsCharts.top = new Chart(topCtx, {
      type: 'bar',
      data: {
        labels: topRes.data.map(d => d.name),
        datasets: [{ label: 'Puntos recibidos', data: topRes.data.map(d => Number(d.total_points)),
          backgroundColor: VIOLET_SHADES(topRes.data.length), borderRadius: 8 }]
      },
      options: {
        indexAxis: 'y', responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, beginAtZero: true }, y: { grid: { display: false } } }
      }
    });
    document.getElementById('chart-top-recognized-empty')?.classList.add('hidden');
  } else {
    document.getElementById('chart-top-recognized-empty')?.classList.remove('hidden');
  }

  // Chart: Por área (donut)
  const deptCtx = document.getElementById('chart-by-department');
  if (deptCtx && deptRes.isOk && deptRes.data.length > 0) {
    _analyticsCharts.dept = new Chart(deptCtx, {
      type: 'doughnut',
      data: {
        labels: deptRes.data.map(d => d.department),
        datasets: [{ data: deptRes.data.map(d => Number(d.recognition_count)),
          backgroundColor: PALETTE.slice(0, deptRes.data.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } } }
    });
    document.getElementById('chart-by-department-empty')?.classList.add('hidden');
  } else {
    document.getElementById('chart-by-department-empty')?.classList.remove('hidden');
  }

  // Chart: Engagement por mes (line)
  const monthCtx = document.getElementById('chart-by-month');
  if (monthCtx && monthRes.isOk && monthRes.data.length > 0) {
    _analyticsCharts.month = new Chart(monthCtx, {
      type: 'line',
      data: {
        labels: monthRes.data.map(d => d.month),
        datasets: [
          { label: 'Reconocimientos', data: monthRes.data.map(d => Number(d.recognition_count)),
            borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)', fill: true,
            tension: 0.4, pointBackgroundColor: '#7c3aed', pointRadius: 5 },
          { label: 'Puntos dados', data: monthRes.data.map(d => Number(d.total_points)),
            borderColor: '#ec4899', backgroundColor: 'transparent', fill: false,
            tension: 0.4, pointBackgroundColor: '#ec4899', pointRadius: 5 }
        ]
      },
      options: {
        responsive: true, plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } }
      }
    });
    document.getElementById('chart-by-month-empty')?.classList.add('hidden');
  } else {
    document.getElementById('chart-by-month-empty')?.classList.remove('hidden');
  }

  lucide.createIcons();
}

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
lucide.createIcons();
