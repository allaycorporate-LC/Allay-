// ����������������������������������������������������������������������������������
// ANALYTICS
// ����������������������������������������������������������������������������������
let _analyticsCharts = {};
const _analyticsCache = {};

// ���� CSV helpers ������������������������������������������������������������������������������������������������������������������������������
// headers: string[] � primera fila
// rows:    any[][]  � datos
function _downloadCSV(filename, headers, rows) {
  const q = v => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = ['sep=,', headers.map(q).join(','), ...rows.map(r => r.map(q).join(','))];
  const blob  = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url   = URL.createObjectURL(blob);
  const a     = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _csvPeriod(fromId, toId) {
  const f = document.getElementById(fromId)?.value || '';
  const t = document.getElementById(toId)?.value   || '';
  return (f && t) ? `${f}_${t}` : (f || t || 'total');
}

function toggleSectionMenu(id, e) {
  e?.stopPropagation();
  const menu = document.getElementById(id);
  const open = menu && !menu.classList.contains('hidden');
  document.querySelectorAll('.section-dropdown-menu').forEach(m => m.classList.add('hidden'));
  if (!open) menu?.classList.remove('hidden');
}

document.addEventListener('click', () => {
  document.querySelectorAll('.section-dropdown-menu').forEach(m => m.classList.add('hidden'));
});

// ���� Download functions ����������������������������������������������������������������������������������������������������������������
function _closeMenus() { document.querySelectorAll('.section-dropdown-menu').forEach(m => m.classList.add('hidden')); }

function downloadSummaryCSV() {
  _closeMenus();
  const d = _analyticsCache.summary;
  if (!d) { showErrorToast('Aún no hay datos cargados'); return; }
  _downloadCSV(`allay_resumen_${_csvPeriod('summary-from','summary-to')}.csv`,
    ['metrica', 'valor'],
    [
      ['total_reconocimientos', d.total_recognitions],
      ['total_puntos_dados',    d.total_points],
      ['personas_activas',      d.active_senders],
      ['este_mes',              d.this_month],
    ]
  );
}

function downloadTopCSV() {
  _closeMenus();
  const d = _analyticsCache.top;
  if (!d?.length) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_top_reconocidos_${_csvPeriod('top-from','top-to')}.csv`,
    ['posicion', 'persona', 'puntos_recibidos', 'reconocimientos_recibidos'],
    d.map((r, i) => [i + 1, r.name, r.total_points, r.count])
  );
}

function downloadDeptCSV() {
  _closeMenus();
  const d = _analyticsCache.dept;
  if (!d?.length) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_por_area_${_csvPeriod('dept-from','dept-to')}.csv`,
    ['area', 'reconocimientos'],
    d.map(r => [r.department, r.recognition_count])
  );
}

function downloadMonthCSV() {
  _closeMenus();
  const d = _analyticsCache.month;
  if (!d?.length) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_engagement_mensual_${_csvPeriod('analytics-from-month','analytics-to-month')}.csv`,
    ['mes', 'reconocimientos', 'puntos_dados'],
    d.map(r => [r.month, r.recognition_count, r.total_points])
  );
}

function downloadEngagementCSV() {
  _closeMenus();
  const d = _analyticsCache.engagement;
  if (!d) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_engagement_equipo_${_csvPeriod('eng-from','eng-to')}.csv`,
    ['equipo', 'total_personas', 'pct_enviaron', 'pct_recibieron'],
    d.deptStats.map(t => [t.dept, t.total, t.senderPct + '%', t.receiverPct + '%'])
  );
}

function downloadEngagementLowCSV() {
  _closeMenus();
  const d = _analyticsCache.engagement;
  if (!d) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_baja_participacion_${_csvPeriod('eng-from','eng-to')}.csv`,
    ['nombre', 'email', 'departamento'],
    d.lowParticipation.map(u => [u.name || '', u.email || '', u.department || 'Sin área'])
  );
}

function downloadInteractionCSV() {
  _closeMenus();
  const d = _analyticsCache.interaction;
  if (!d) { showErrorToast('Sin datos para exportar'); return; }
  const matrixRows = [];
  d.depts.forEach(from => {
    d.depts.forEach(to => {
      const val = d.matrix[from]?.[to] || 0;
      if (from !== to && val > 0) matrixRows.push([from, to, val]);
    });
  });
  matrixRows.sort((a, b) => b[2] - a[2]);
  _downloadCSV(`allay_interaccion_equipos_${_csvPeriod('interact-from','interact-to')}.csv`,
    ['equipo_origen', 'equipo_destino', 'reconocimientos'],
    matrixRows.length ? matrixRows : [['sin_datos', '', 0]]
  );
}

function downloadProgramsCSV() {
  _closeMenus();
  const d = _analyticsCache.programs;
  if (!d) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_categorias_${_csvPeriod('prog-from','prog-to')}.csv`,
    ['programa', 'tipo', 'reconocimientos', 'pct_del_total'],
    d.distribution.map(p => [
      p.label,
      p.isCustom ? 'personalizado' : 'default',
      p.count,
      d.total > 0 ? Math.round((p.count / d.total) * 100) + '%' : '0%'
    ])
  );
}

// ���� PDF helpers ������������������������������������������������������������������������������������������������������������������������������
function _periodLabel(fromId, toId) {
  const f = document.getElementById(fromId)?.value || '';
  const t = document.getElementById(toId)?.value   || '';
  if (f && t) return `${f} → ${t}`;
  return f || t || 'Todo el período';
}

function _chartImg(id) {
  const c = document.getElementById(id);
  if (!c || c.style.display === 'none') return '';
  try { return `<img src="${c.toDataURL('image/png')}" style="width:100%;max-width:660px;border-radius:8px;margin-bottom:14px;" alt="">`; }
  catch(e) { return ''; }
}

function _pdfTbl(headers, rows) {
  const e = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if (!rows?.length) return '<p style="color:#9ca3af;font-size:11px;font-style:italic;margin-bottom:14px;">Sin datos en el período seleccionado.</p>';
  return `<table><thead><tr>${headers.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r=>`<tr>${r.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function _pdfMetrics(items) {
  return `<div class="metrics">${items.map(m=>`<div class="metric"><div class="lbl">${m.label}</div><div class="val">${m.value}</div></div>`).join('')}</div>`;
}

function _openPDF(title, period, body) {
  const now = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const w = window.open('','_blank');
  if (!w) { showErrorToast('Activá los pop-ups del navegador para el PDF'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Allay · ${title}</title><style>
*{box-sizing:border-box}body{font-family:Calibri,Arial,sans-serif;margin:0;padding:0;color:#1f2937;font-size:13px;background:#fff}
.hdr{background:#3d2b56;color:#fff;padding:22px 32px}.badge{font-size:9px;opacity:.65;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
.hdr h1{margin:0 0 5px;font-size:21px;font-weight:800}.hdr .period{font-size:11px;opacity:.75}
.body{padding:24px 32px}.sec{margin-bottom:22px}.sec h2{font-size:13px;font-weight:700;color:#3d2b56;margin:0 0 10px;padding-bottom:5px;border-bottom:2px solid #ede9f7}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px}
.metric{background:#f5f0fa;border:1px solid #ede9f7;border-radius:10px;padding:11px 13px}
.metric .lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:3px}
.metric .val{font-size:24px;font-weight:800;color:#3d2b56;line-height:1}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:14px}
th{background:#ede9f7;color:#3d2b56;padding:6px 9px;text-align:left;font-weight:700;border-bottom:2px solid #c9a7d4}
td{padding:5px 9px;border-bottom:1px solid #f3f4f6;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
.icard{display:flex;gap:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:9px 11px;margin-bottom:7px}
.icard .icon{width:28px;height:28px;background:#3d2b56;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;color:#fff}
.icard .it{font-size:11px;font-weight:700;color:#3d2b56;margin-bottom:2px}
.icard .ib{font-size:11px;color:#4b5563;line-height:1.5}
.spike{background:#f5f0fa;border:1px solid #c9a7d4;border-radius:7px;padding:7px 11px;margin-bottom:5px;font-size:11px}
.ftr{border-top:1px solid #e5e7eb;padding:10px 32px;text-align:center;font-size:10px;color:#9ca3af}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:.45in}}
</style></head><body>
<div class="hdr"><div class="badge">Allay · Analytics</div><h1>${title}</h1><div class="period">Período: ${period} &nbsp;·&nbsp; Generado el ${now}</div></div>
<div class="body">${body}</div>
<div class="ftr">Allay · Reporte generado automáticamente · ${now}</div>
<script>window.onload=()=>setTimeout(()=>window.print(),500)</script>
</body></html>`);
  w.document.close();
}

// ���� PDF per section ����������������������������������������������������������������������������������������������������������������������
async function downloadRecognitionsCSV() {
  _closeMenus();
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('summary-from', 'summary-to');
  showSuccessToast('Preparando exportación⬦');
  const result = await window.analyticsSdk.rawList(companyId, fromISO, toISO);
  if (!result.isOk || !result.data.length) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(
    `allay_reconocimientos_${_csvPeriod('summary-from','summary-to')}.csv`,
    ['fecha', 'emisor', 'area_emisor', 'receptor', 'area_receptor', 'programa', 'puntos', 'visibilidad', 'mensaje'],
    result.data.map(r => [
      new Date(r.createdAt).toLocaleDateString('es-AR'),
      r.from, r.fromDept, r.to, r.toDept, r.program, r.points,
      r.isPrivate ? 'Privado' : 'Público',
      r.message,
    ])
  );
}

function downloadSummaryPDF() {
  _closeMenus();
  const d = _analyticsCache.summary;
  if (!d) { showErrorToast('Sin datos cargados'); return; }
  _openPDF('Resumen', _periodLabel('summary-from','summary-to'),
    `<div class="sec"><h2>KPIs del período</h2>${_pdfMetrics([
      {label:'Reconocimientos', value:d.total_recognitions},
      {label:'Puntos dados',    value:d.total_points},
      {label:'Personas activas',value:d.active_senders},
      {label:'Este mes',        value:d.this_month},
    ])}</div>`);
}

function downloadTopPDF() {
  _closeMenus();
  const d = _analyticsCache.top;
  if (!d?.length) { showErrorToast('Sin datos'); return; }
  _openPDF('Top reconocidos', _periodLabel('top-from','top-to'),
    `<div class="sec"><h2>Ranking</h2>${_chartImg('chart-top-recognized')}
    ${_pdfTbl(['Pos.','Persona','Puntos recibidos','Reconocimientos recibidos'],
      d.map((r,i)=>[i+1,r.name,r.total_points,r.count]))}</div>`);
}

function downloadDeptPDF() {
  _closeMenus();
  const d = _analyticsCache.dept;
  if (!d?.length) { showErrorToast('Sin datos'); return; }
  _openPDF('Reconocimientos por área', _periodLabel('dept-from','dept-to'),
    `<div class="sec"><h2>Distribución por área</h2>${_chartImg('chart-by-department')}
    ${_pdfTbl(['Área / Departamento','Reconocimientos'],
      d.map(r=>[r.department,r.recognition_count]))}</div>`);
}

function downloadMonthPDF() {
  _closeMenus();
  const d = _analyticsCache.month;
  if (!d?.length) { showErrorToast('Sin datos'); return; }
  _openPDF('Engagement por mes', _periodLabel('analytics-from-month','analytics-to-month'),
    `<div class="sec"><h2>Evolución mensual</h2>${_chartImg('chart-by-month')}
    ${_pdfTbl(['Mes','Reconocimientos','Puntos dados'],
      d.map(r=>[r.month,r.recognition_count,r.total_points]))}</div>`);
}

function downloadEngagementPDF() {
  _closeMenus();
  const d = _analyticsCache.engagement;
  if (!d) { showErrorToast('Sin datos'); return; }
  _openPDF('Engagement del equipo', _periodLabel('eng-from','eng-to'),
    `<div class="sec"><h2>KPIs</h2>${_pdfMetrics([
      {label:'Dieron reconocimiento',    value:d.pctSenders+'%'},
      {label:'Recibieron reconocimiento',value:d.pctReceivers+'%'},
      {label:'Promedio por usuario',     value:d.avgPerUser},
      {label:'Total usuarios',           value:d.totalUsers},
    ])}</div>
    <div class="sec"><h2>Evolución de participación</h2>${_chartImg('chart-engagement-evolution')}</div>
    <div class="sec"><h2>Participación por equipo</h2>
    ${_pdfTbl(['Equipo','Personas','% Enviaron','% Recibieron'],
      d.deptStats.map(t=>[t.dept,t.total,t.senderPct+'%',t.receiverPct+'%']))}</div>
    <div class="sec"><h2>Baja participación</h2>
    ${_pdfTbl(['Nombre','Email','Departamento'],
      d.lowParticipation.map(u=>[u.name||'',u.email||'',u.department||'Sin área']))}</div>`);
}

function downloadInteractionPDF() {
  _closeMenus();
  const d = _analyticsCache.interaction;
  if (!d) { showErrorToast('Sin datos'); return; }
  const rows = [];
  d.depts.forEach(f => d.depts.forEach(t => { const v=d.matrix[f]?.[t]||0; if(f!==t&&v>0) rows.push([f,t,v]); }));
  rows.sort((a,b)=>b[2]-a[2]);
  _openPDF('Interacción entre equipos', _periodLabel('interact-from','interact-to'),
    `<div class="sec"><h2>Resumen por equipo</h2>
    ${_pdfTbl(['Equipo','Enviados','Recibidos','Total'],
      d.teamStats.map(t=>[t.dept,t.sent,t.received,t.total]))}</div>
    <div class="sec"><h2>Detalle de interacciones</h2>
    ${_pdfTbl(['Equipo origen','Equipo destino','Reconocimientos'],
      rows.length ? rows : [['Sin interacciones cross-equipo','—','—']])}</div>`);
}

function downloadProgramsPDF() {
  _closeMenus();
  const d = _analyticsCache.programs;
  if (!d) { showErrorToast('Sin datos'); return; }
  _openPDF('Programas de reconocimiento', _periodLabel('prog-from','prog-to'),
    `<div class="sec"><h2>Resumen</h2>${_pdfMetrics([
      {label:'Total reconocimientos',value:d.total},
      {label:'Programas con actividad',value:d.withActivity?.length??0},
      {label:'Sin uso en el período', value:d.unused?.length??0},
    ])}${_chartImg('chart-programs')}
    ${_pdfTbl(['Programa','Tipo','Reconocimientos','% del Total'],
      d.distribution.map(p=>[p.label,p.isCustom?'Personalizado':'Default',p.count,
        d.total>0?Math.round((p.count/d.total)*100)+'%':'0%']))}</div>`);
}

function downloadUsersPDF() {
  _closeMenus();
  const d = _analyticsCache.userActivity;
  if (!d) { showErrorToast('Sin datos'); return; }
  _openPDF('Actividad por usuario', _periodLabel('user-from','user-to'),
    `<div class="sec"><h2>Comparativo de actividad</h2>${_chartImg('chart-user-activity')}</div>
    <div class="sec"><h2>Más reconocidos</h2>
    ${_pdfTbl(['Persona','Área','Recibidos','Enviados','Puntos'],
      d.mostRecognized.map(u=>[u.name,u.dept,u.received,u.sent,u.pointsReceived]))}</div>
    <div class="sec"><h2>Menos reconocidos</h2>
    ${_pdfTbl(['Persona','Área','Recibidos','Enviados'],
      d.leastRecognized.map(u=>[u.name,u.dept,u.received,u.sent]))}</div>
    <div class="sec"><h2>Sin actividad en el período</h2>
    ${_pdfTbl(['Persona','Email','Departamento'],
      d.inactive.map(u=>[u.name||'',u.email||'',u.dept]))}</div>`);
}

function downloadPatternPDF() {
  _closeMenus();
  const d = _analyticsCache.patterns;
  if (!d) { showErrorToast('Sin datos'); return; }
  const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const peakDay  = d.byDOW.indexOf(Math.max(...d.byDOW));
  const peakHour = d.byHour.indexOf(Math.max(...d.byHour));
  const n = d.weeklyEvolution.length, t3 = Math.max(1,Math.floor(n/3));
  const recent = n>=3 ? d.weeklyEvolution.slice(-t3).reduce((s,w)=>s+w.count,0)/t3 : 0;
  const early  = n>=3 ? d.weeklyEvolution.slice(0,t3).reduce((s,w)=>s+w.count,0)/t3 : 0;
  const trend  = recent>early*1.15 ? '↑ en aumento' : recent<early*0.85 ? '↓ en descenso' : '→ estable';
  const slot   = peakHour<12 ? 'mañana' : peakHour<18 ? 'tarde' : 'noche';

  const insights = [
    {icon:'📅', title:'Día más activo', text:`${DAYS[peakDay]} concentra la mayor cantidad de reconocimientos del período.`},
    {icon:'🕐', title:'Horario pico',   text:`La actividad se concentra a la ${slot}, alrededor de las ${String(peakHour).padStart(2,'0')}:00.`},
    {icon:'📈', title:'Tendencia',      text:`La participación está ${trend} comparando el inicio vs el final del período.`},
    {icon:'👥', title:'Líderes',        text:`El ${d.adminPct}% de los reconocimientos son enviados por líderes (rol admin).`},
  ].map(i=>`<div class="icard"><div class="icon">${i.icon}</div><div><div class="it">${i.title}</div><div class="ib">${i.text}</div></div></div>`).join('');

  _openPDF('Patrones de participación', _periodLabel('pat-from','pat-to'),
    `<div class="sec"><h2>Actividad por día</h2>${_chartImg('chart-pat-dow')}
    ${_pdfTbl(['Día','Reconocimientos'],d.byDOW.map((c,i)=>[DAYS[i],c]))}</div>
    <div class="sec"><h2>Actividad por horario</h2>${_chartImg('chart-pat-hour')}</div>
    <div class="sec"><h2>Evolución semanal</h2>${_chartImg('chart-pat-weekly')}</div>
    <div class="sec"><h2>Comparación entre equipos</h2>${_chartImg('chart-pat-teams')}</div>
    <div class="sec"><h2>Insights</h2>${insights}</div>
    ${d.spikes.length?`<div class="sec"><h2>Momentos de alta actividad</h2>${
      d.spikes.map(s=>`<div class="spike">⚡ <strong>${s.label}</strong> · ${s.count} reconocimientos (${d.mean>0?(s.count/d.mean).toFixed(1):'—'}× el promedio)</div>`).join('')
    }</div>`:''}`);
}

function destroyCharts() {
  Object.values(_analyticsCharts).forEach(c => c?.destroy());
  _analyticsCharts = {};
}

// ���� Analytics tabs ������������������������������������������������������������������������������������������������������������������������
let _analyticsTabObserver = null;

function scrollTabBar(dir) {
  const bar = document.getElementById('analytics-tab-bar');
  if (bar) bar.scrollBy({ left: dir * 160, behavior: 'smooth' });
}

function scrollToAnalyticsSection(sectionId) {
  const section = document.getElementById(sectionId);
  const main    = document.getElementById('analytics-main');
  if (!section || !main) return;
  const delta = section.getBoundingClientRect().top - main.getBoundingClientRect().top;
  main.scrollBy({ top: delta, behavior: 'smooth' });
  _setActiveAnalyticsTab('tab-' + sectionId.replace('section-', ''));
}

function _setActiveAnalyticsTab(activeId) {
  const BASE   = 'analytics-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition';
  const ACTIVE = `${BASE} bg-[#3d2b56] text-white`;
  const IDLE   = `${BASE} text-gray-500 hover:bg-gray-100 hover:text-gray-800`;
  document.querySelectorAll('.analytics-tab').forEach(t => {
    t.className = t.id === activeId ? ACTIVE : IDLE;
  });
}

function _setupAnalyticsTabObserver() {
  if (_analyticsTabObserver) { _analyticsTabObserver.disconnect(); _analyticsTabObserver = null; }
  const sections = [
    'section-resumen', 'section-charts', 'section-engagement-mes',
    'section-engagement-equipo', 'section-interaccion', 'section-categorias', 'section-usuarios', 'section-patrones'
  ];
  const page = document.getElementById('analytics-page');
  if (!page) return;
  const main = document.getElementById('analytics-main');
  _analyticsTabObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        _setActiveAnalyticsTab('tab-' + entry.target.id.replace('section-', ''));
      }
    });
  }, { root: main, rootMargin: '-10% 0px -70% 0px', threshold: 0 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) _analyticsTabObserver.observe(el);
  });
}

async function openAnalyticsPage() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
    showErrorToast('Solo administradores pueden ver analytics'); return;
  }
  closePointsPage();
  destroyCharts();
  _positionOverlayPage('analytics-page');
  document.getElementById('analytics-page').classList.remove('hidden');
  _setActiveAnalyticsTab('tab-resumen');
  _initAnalyticsFilters();
  await renderAnalytics();
  _setupAnalyticsTabObserver();
  lucide.createIcons();
}

function _initAnalyticsFilters() {
  const now  = new Date();
  const to   = now.toISOString().substring(0, 7);
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().substring(0, 7);
  // Set all independent date filters to the same default (last 6 months)
  ['summary-from','top-from','dept-from','analytics-from-month','eng-from','interact-from','prog-from','user-from','pat-from']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = from; });
  ['summary-to','top-to','dept-to','analytics-to-month','eng-to','interact-to','prog-to','user-to','pat-to']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = to; });

  // Company selector — only for superadmin not impersonating
  const sel = document.getElementById('analytics-company-filter');
  if (currentUser?.role === 'superadmin' && !isImpersonating) {
    sel.classList.remove('hidden');
    const realCompanies = companies.filter(c => c.id !== 'comp-0');
    sel.innerHTML = realCompanies.map(c =>
      `<option value="${c.id}">${c.name}</option>`
    ).join('');
    sel.value = realCompanies[0]?.id || '';
  } else {
    sel.classList.add('hidden');
    sel.value = currentUser?.company_id || '';
  }
}

function _analyticsCompanyId() {
  return document.getElementById('analytics-company-filter').value || currentUser?.company_id || '';
}

async function onAnalyticsCompanyChange() {
  destroyCharts();
  await renderAnalytics();
}

async function onAnalyticsDateChange() {
  await refreshEngagementChart();
}

function closeAnalyticsPage() {
  destroyCharts();
  const el = document.getElementById('analytics-page');
  if (!el) return;
  el.classList.add('hidden');
  el.style.display = 'none';
}

// ���� Insights page ��������������������������������������������������������������������������������������������������������������������������
function openInsightsPage() {
  _positionOverlayPage('insights-page');
  document.getElementById('insights-page').classList.remove('hidden');
  renderInsights();
}
function closeInsightsPage() {
  document.getElementById('insights-page').classList.add('hidden');
}

// ���� Insights Inteligentes � completo ����������������������������������������������������������������������������������
function _calculateHealthScore({ engagement, users, patterns, interaction }) {
  let s = 50;
  if (engagement) {
    s += engagement.pctSenders >= 60 ? 20 : engagement.pctSenders >= 40 ? 10 : engagement.pctSenders >= 20 ? 0 : -15;
    s += engagement.pctReceivers >= 70 ? 10 : engagement.pctReceivers >= 50 ? 5 : 0;
  }
  if (patterns?.weeklyEvolution?.length >= 4) {
    const n=patterns.weeklyEvolution.length, t3=Math.max(1,Math.floor(n/3));
    const r=patterns.weeklyEvolution.slice(-t3).reduce((a,w)=>a+w.count,0)/t3;
    const e=patterns.weeklyEvolution.slice(0,t3).reduce((a,w)=>a+w.count,0)/t3;
    s += r>e*1.1 ? 10 : r<e*0.9 ? -10 : 5;
    s += (patterns.adminPct||0) >= 20 ? 10 : (patterns.adminPct||0) >= 10 ? 5 : 0;
  }
  if (users && (engagement?.totalUsers||0) > 0) {
    const pct = (users.inactive?.length||0) / engagement.totalUsers * 100;
    s += pct < 10 ? 10 : pct < 30 ? 0 : -10;
  }
  if (interaction?.depts?.length > 1) {
    const ip = (interaction.isolated?.length||0) / interaction.depts.length * 100;
    s += ip < 20 ? 5 : ip > 50 ? -5 : 0;
  }
  return Math.max(10, Math.min(100, Math.round(s)));
}

function _healthScoreHTML(score) {
  const labels = [[80,'Excelente','#16a34a'],[65,'Buena','#3d2b56'],[50,'En desarrollo','#d97706'],[35,'Necesita atención','#dc2626'],[0,'Crítica','#dc2626']];
  const [,label,color] = labels.find(([min]) => score >= min) || labels[labels.length-1];
  const dash=251.2, off=(dash-(score/100)*dash).toFixed(1);
  return `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
    <div class="flex flex-wrap items-center gap-6">
      <div class="relative w-24 h-24 shrink-0">
        <svg class="w-full h-full" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
          <circle cx="50" cy="50" r="40" stroke="#f3f4f6" stroke-width="12" fill="none"/>
          <circle cx="50" cy="50" r="40" stroke="${color}" stroke-width="12" fill="none"
            stroke-dasharray="${dash}" stroke-dashoffset="${off}" stroke-linecap="round"/>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-2xl font-extrabold" style="color:${color}">${score}</span>
          <span class="text-[8px] text-gray-400 font-semibold uppercase tracking-wide">/100</span>
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Score de salud cultural</p>
        <p class="text-2xl font-extrabold text-gray-800 mb-1">${label}</p>
        <p class="text-xs text-gray-500 leading-relaxed">Calculado a partir de engagement, participación, liderazgo, interacción entre equipos y tendencias del período analizado.</p>
      </div>
    </div>
  </div>`;
}

function _insightCard(ins) {
  const cfg = {
    warning:  {bg:'bg-amber-50',  b:'border-amber-200', ib:'bg-amber-100', ic:'text-amber-600', lc:'text-amber-600', lbl:'Alerta'},
    positive: {bg:'bg-green-50',  b:'border-green-100', ib:'bg-green-100', ic:'text-green-600', lc:'text-green-600', lbl:'Positivo'},
    info:     {bg:'bg-blue-50',   b:'border-blue-100',  ib:'bg-blue-100',  ic:'text-blue-600',  lc:'text-blue-600',  lbl:'Informativo'},
    risk:     {bg:'bg-red-50',    b:'border-red-200',   ib:'bg-red-100',   ic:'text-red-600',   lc:'text-red-600',   lbl:'Riesgo'},
    tip:      {bg:'bg-violet-50', b:'border-violet-100',ib:'bg-violet-100',ic:'text-[#3d2b56]', lc:'text-[#3d2b56]',lbl:'Oportunidad'},
  };
  const c = cfg[ins.type] || cfg.info;
  const rec = ins.recommendation
    ? `<div class="mt-2 pt-2 border-t border-black/5 flex items-start gap-1.5">
        <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5"></i>
        <p class="text-xs text-gray-500 leading-relaxed">${esc(ins.recommendation)}</p>
       </div>` : '';
  return `<div class="rounded-xl p-4 border ${c.bg} ${c.b}">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg ${c.ib} flex items-center justify-center shrink-0 mt-0.5">
        <i data-lucide="${ins.icon}" class="w-4 h-4 ${c.ic}"></i>
      </div>
      <div class="flex-1 min-w-0">
        <span class="text-[10px] font-bold uppercase tracking-wide ${c.lc}">${c.lbl}</span>
        <p class="text-sm font-semibold text-gray-800 mt-0.5 mb-0.5">${esc(ins.title)}</p>
        <p class="text-xs text-gray-600 leading-relaxed">${esc(ins.text)}</p>
        ${rec}
      </div>
    </div>
  </div>`;
}

function _generateAllInsights({ engagement, users, interaction, patterns, programs }) {
  const cats = { engagement:[], liderazgo:[], conexion:[], cultura:[], participacion:[], riesgos:[], positivos:[] };
  const total = engagement?.totalUsers || 0;
  const DAYS  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  if (engagement) {
    if (engagement.pctSenders >= 70)
      cats.positivos.push({ type:'positive', icon:'zap', title:`${engagement.pctSenders}% del equipo envió reconocimientos`, text:'La gran mayoría está participando activamente. El hábito de reconocimiento está bien instalado.', recommendation:'Mantené la frecuencia y diversificá los programas utilizados.' });
    else if (engagement.pctSenders >= 40)
      cats.engagement.push({ type:'info', icon:'activity', title:`${engagement.pctSenders}% de participación general`, text:'Más de la mitad del equipo está activo. Hay margen para crecer y profundizar el hábito.', recommendation:'Comunicá el impacto del reconocimiento para motivar a quienes aún no participan.' });
    else
      cats.riesgos.push({ type:'risk', icon:'alert-triangle', title:`Solo el ${engagement.pctSenders}% envió reconocimientos`, text:'La participación es baja. El reconocimiento aún no está integrado como hábito cultural.', recommendation:'Lanzá una campaña de activación o sesión breve con líderes sobre cómo y por qué reconocer.' });
    if (engagement.pctReceivers < 50 && total > 3)
      cats.participacion.push({ type:'warning', icon:'user-minus', title:`Solo el ${engagement.pctReceivers}% recibió reconocimientos`, text:'Muchos miembros no fueron reconocidos. Esto puede afectar la motivación y el sentido de pertenencia.', recommendation:'Invitá a los líderes a identificar personas que no han sido reconocidas recientemente.' });
    const sorted = [...(engagement.deptStats||[])].sort((a,b)=>b.senderPct-a.senderPct);
    if (sorted.length >= 2) {
      const best=sorted[0], worst=sorted[sorted.length-1];
      if (best.senderPct - worst.senderPct > 40)
        cats.engagement.push({ type:'info', icon:'bar-chart', title:`Brecha entre equipos: ${best.dept} (${best.senderPct}%) vs ${worst.dept} (${worst.senderPct}%)`, text:'Los equipos más activos pueden servir como modelo para los demás.', recommendation:`Conectá al líder de ${best.dept} con el de ${worst.dept} para compartir prácticas.` });
      const consistent = engagement.deptStats.filter(t=>t.senderPct>=60&&t.total>=2);
      if (consistent.length > 0)
        cats.positivos.push({ type:'positive', icon:'check-circle', title:`${consistent.length} equipo${consistent.length>1?'s':''} con actividad consistente`, text:`${consistent.slice(0,2).map(t=>t.dept).join(', ')} mantienen más del 60% de participación. Son referentes culturales.`, recommendation:'Visibilizá estos equipos como ejemplos para el resto.' });
    }
    const lowTeams = engagement.deptStats?.filter(t=>t.senderPct<30&&t.total>=2)||[];
    if (lowTeams.length > 0)
      cats.riesgos.push({ type:'warning', icon:'alert-circle', title:`Baja participación en ${lowTeams.length>1?lowTeams.length+' equipos':lowTeams[0].dept}`, text:`${lowTeams.slice(0,2).map(t=>t.dept).join(', ')} tienen menos del 30% de participación.`, recommendation:'Agendá conversaciones con los líderes de estos equipos para entender las barreras.' });
  }

  if (patterns?.total > 5) {
    if (patterns.adminPct === 0)
      cats.riesgos.push({ type:'risk', icon:'users', title:'Los líderes no participaron en el período', text:'Ningún reconocimiento fue iniciado por managers. Esto puede limitar el impacto cultural.', recommendation:'Compartí con los managers datos sobre cómo su participación impacta en el engagement del equipo.' });
    else if (patterns.adminPct >= 25)
      cats.positivos.push({ type:'positive', icon:'user-check', title:`Liderazgo activo: ${patterns.adminPct}% de reconocimientos de managers`, text:'Los equipos con managers que reconocen muestran mayor motivación y cohesión.', recommendation:'Reconocé públicamente a los managers que lideran con el ejemplo.' });
    else if (patterns.adminPct < 10)
      cats.liderazgo.push({ type:'info', icon:'user-check', title:`Managers con baja participación (${patterns.adminPct}%)`, text:'Los líderes aportan poco al reconocimiento total. Su ejemplo puede multiplicar el impacto en todo el equipo.', recommendation:'Incluí a los líderes en las próximas campañas como protagonistas.' });
  }

  if (interaction) {
    if (interaction.isolated?.length > 0) {
      const names = interaction.isolated.slice(0,2).join(', ');
      cats.riesgos.push({ type:'warning', icon:'wifi-off', title:`${interaction.isolated.length} equipo${interaction.isolated.length>1?'s':''} sin interacción cross-equipo`, text:`${names}${interaction.isolated.length>2?' y otros':''} no tuvieron reconocimientos con otras áreas.`, recommendation:'Promové proyectos cross-funcionales que generen visibilidad entre equipos.' });
    }
    const pairs=[];
    interaction.depts?.forEach(f=>interaction.depts.forEach(t=>{const v=interaction.matrix?.[f]?.[t]||0;if(f!==t&&v>0)pairs.push({from:f,to:t,count:v});}));
    pairs.sort((a,b)=>b.count-a.count);
    if (pairs.length > 0)
      cats.conexion.push({ type:'positive', icon:'arrow-right-left', title:`${pairs[0].from} y ${pairs[0].to} son los equipos más conectados`, text:`Intercambiaron ${pairs[0].count} reconocimientos. Una conexión fuerte entre áreas indica cultura colaborativa saludable.`, recommendation:'Visibilizá estas colaboraciones como modelos de trabajo cross-funcional.' });
    const totalInt = (interaction.teamStats||[]).reduce((s,t)=>s+t.total,0);
    if (totalInt > 0)
      cats.conexion.push({ type:'info', icon:'network', title:`${totalInt} interacciones cross-equipo registradas`, text: totalInt >= 10 ? 'El reconocimiento entre áreas muestra una tendencia positiva de colaboración.' : 'Hay interacciones cross-equipo, aunque pueden crecer más.', recommendation:'Fomentá el reconocimiento hacia otras áreas con programas de colaboración.' });
  }

  if (programs?.distribution?.length > 0 && programs.total > 0) {
    const top=programs.distribution[0], topPct=Math.round((top.count/programs.total)*100);
    if (topPct >= 50)
      cats.cultura.push({ type:'info', icon:'tag', title:`"${top.name}" es el valor más reconocido (${topPct}%)`, text:'Un programa concentra la mayoría de los reconocimientos. Otros valores pueden estar subrepresentados.', recommendation:'Comunicá ejemplos concretos de los otros programas para diversificar el reconocimiento cultural.' });
    else
      cats.positivos.push({ type:'positive', icon:'layers', title:'Los valores están distribuidos de forma equilibrada', text:`El reconocimiento abarca múltiples programas. Esto refleja una cultura multidimensional y rica.`, recommendation:'Celebrá esta diversidad en las comunicaciones internas del equipo.' });
    const customUsed = programs.withActivity?.filter(p=>p.isCustom)||[];
    if (customUsed.length > 0)
      cats.cultura.push({ type:'positive', icon:'star', title:`${customUsed.length} programa${customUsed.length>1?'s':''} personalizado${customUsed.length>1?'s':''} activo${customUsed.length>1?'s':''}`, text:'El equipo usa programas creados internamente. Esto muestra que la cultura se adapta a sus propias necesidades.', recommendation:'Mostrá estos programas como ejemplos de cultura viva y en evolución.' });
  }

  if (users && total > 0) {
    if (users.inactive?.length > 0) {
      const pct = Math.round((users.inactive.length/total)*100);
      cats.participacion.push({ type:pct>=30?'risk':'warning', icon:'user-x', title:`${users.inactive.length} persona${users.inactive.length>1?'s':''} sin actividad en el período (${pct}%)`, text:'Pueden estar desconectadas de la dinámica del equipo.', recommendation:'Coordiná check-ins con sus líderes y fomentá su integración.' });
    }
    if (users.mostRecognized?.length>0 && users.leastRecognized?.length>0 && users.mostRecognized[0].received >= users.leastRecognized[0].received*4)
      cats.participacion.push({ type:'info', icon:'git-branch', title:'Concentración de reconocimientos en pocas personas', text:'Hay una brecha importante entre quienes más y menos reciben. Una distribución más equitativa fortalece la cultura.', recommendation:'Invitá al equipo a reconocer a personas que habitualmente no están en el centro de atención.' });
    if (users.mostRecognized?.[0])
      cats.positivos.push({ type:'positive', icon:'award', title:`${users.mostRecognized[0].name} lidera en reconocimientos recibidos`, text:`Con ${users.mostRecognized[0].received} reconocimientos, es un referente de cultura en el equipo.`, recommendation:'Celebrá públicamente a quienes son más reconocidos como modelos de los valores.' });
  }

  if (patterns?.total > 0) {
    const peakDOW=patterns.byDOW.indexOf(Math.max(...patterns.byDOW));
    cats.positivos.push({ type:'info', icon:'calendar', title:`La actividad de reconocimiento es más alta los ${DAYS[peakDOW]}`, text:`${DAYS[peakDOW]} concentra la mayor cantidad de reconocimientos. El mejor día para celebrar logros.`, recommendation:`Aprovechá los ${DAYS[peakDOW]} para comunicaciones internas sobre cultura y valores.` });
    const afterH=patterns.byHour.slice(18,24).concat(patterns.byHour.slice(0,7)).reduce((s,c)=>s+c,0);
    const afterPct=Math.round((afterH/patterns.total)*100);
    if (afterPct >= 25)
      cats.riesgos.push({ type:'warning', icon:'moon', title:`${afterPct}% de los reconocimientos fuera del horario laboral`, text:'Una parte significativa se envía fuera de horario, lo que puede generar presión implícita.', recommendation:'Normalizá el reconocimiento durante el horario de trabajo con el ejemplo de los líderes.' });
    if (patterns.spikes?.length > 0) {
      const avg=patterns.mean||1, s0=patterns.spikes[0];
      cats.positivos.push({ type:'positive', icon:'zap', title:`Las campañas internas aumentan la participación significativamente`, text:`En ${patterns.spikes.slice(0,2).map(s=>s.label).join(' y ')} se registró actividad ${Math.round(s0.count/avg)}× el promedio. Las iniciativas cortas son muy efectivas.`, recommendation:'Planificá campañas periódicas de 1-2 semanas para mantener el engagement alto todo el año.' });
    }
  }

  if (patterns?.weeklyEvolution?.length >= 4) {
    const n=patterns.weeklyEvolution.length, t3=Math.max(1,Math.floor(n/3));
    const recent=patterns.weeklyEvolution.slice(-t3).reduce((s,w)=>s+w.count,0)/t3;
    const early=patterns.weeklyEvolution.slice(0,t3).reduce((s,w)=>s+w.count,0)/t3;
    const gPct=early>0?Math.round((recent/early-1)*100):0;
    if (recent > early*1.15)
      cats.positivos.push({ type:'positive', icon:'trending-up', title:`Participación en aumento: +${gPct}%`, text:'El reconocimiento creció de forma sostenida. El hábito se está consolidando en la organización.', recommendation:'Compartí esta tendencia positiva con los líderes para reforzar el comportamiento.' });
    else if (recent < early*0.85)
      cats.riesgos.push({ type:'warning', icon:'trending-down', title:`Caída de engagement detectada: -${Math.abs(gPct)}%`, text:'La actividad bajó comparada con el inicio del período. Puede estar relacionado con fatiga o cierres de campaña.', recommendation:'Identificá qué cambió durante este período y preparás una iniciativa de reactivación.' });
    else
      cats.positivos.push({ type:'info', icon:'minus', title:'Participación estable en el período', text:'La actividad se mantiene constante. El hábito está instalado; el próximo desafío es seguir creciendo.', recommendation:'Considerá nuevos programas o reconocimientos grupales para dar el siguiente paso.' });
  }

  return cats;
}

function _generateInsights(data) {
  const cats = _generateAllInsights(data);
  const all = Object.values(cats).flat();
  const order = {risk:0, warning:1, positive:2, info:3, tip:4};
  all.sort((a,b) => (order[a.type]??5)-(order[b.type]??5));
  return all.slice(0, 5); // fallback: keep old behavior
}

// ���� legacy _generateInsights (kept for compatibility) ����
function _legacyGen({ engagement }) {
  if (engagement?.deptStats) {
    const low = engagement.deptStats.filter(t => t.senderPct < 30 && t.total >= 2);
    if (low.length > 0) {
      const names = low.slice(0,2).map(t=>t.dept).join(', ');
      out.push({ type:'warning', icon:'alert-triangle', category:'Engagement',
        title: `Baja participación en ${low.length > 1 ? low.length + ' equipos' : low[0].dept}`,
        text: `${names}${low.length > 2 ? ` y ${low.length-2} más` : ''} tienen menos del 30% del equipo enviando reconocimientos. Es un buen momento para activar conversaciones sobre reconocimiento en esos espacios.` });
    }
  }

  // Usuarios sin actividad
  if (users?.inactive?.length > 0 && total > 0) {
    const pct = Math.round((users.inactive.length / total) * 100);
    if (pct >= 20)
      out.push({ type:'warning', icon:'user-x', category:'Participación',
        title: `${users.inactive.length} usuario${users.inactive.length!==1?'s':''} sin actividad`,
        text: `El ${pct}% de los usuarios no envió ni recibió reconocimientos en el período. Conversaciones 1:1 o iniciativas focalizadas pueden revertir esta tendencia.` });
  }

  // Managers inactivos
  if (patterns?.total > 5) {
    if (patterns.adminPct === 0)
      out.push({ type:'warning', icon:'users', category:'Liderazgo',
        title: 'Los líderes no están participando',
        text: 'Ningún reconocimiento fue iniciado por líderes en este período. El ejemplo desde arriba es uno de los factores más importantes para instalar el hábito en el equipo.' });
    else if (patterns.adminPct < 10)
      out.push({ type:'info', icon:'user-check', category:'Liderazgo',
        title: `Baja participación de líderes (${patterns.adminPct}%)`,
        text: `Solo el ${patterns.adminPct}% de los reconocimientos los inician los líderes. Cuando los managers reconocen más, el equipo los sigue naturalmente.` });
  }

  // Tendencia
  if (patterns?.weeklyEvolution?.length >= 4) {
    const n = patterns.weeklyEvolution.length;
    const t3 = Math.max(1, Math.floor(n/3));
    const recent = patterns.weeklyEvolution.slice(-t3).reduce((s,w)=>s+w.count,0)/t3;
    const early  = patterns.weeklyEvolution.slice(0,t3).reduce((s,w)=>s+w.count,0)/t3;
    if (recent > early * 1.2)
      out.push({ type:'positive', icon:'trending-up', category:'Tendencia',
        title: 'La actividad de reconocimiento está creciendo',
        text: `Los reconocimientos aumentaron un ${Math.round((recent/Math.max(early,1)-1)*100)}% comparando el inicio y el final del período. El equipo está construyendo un hábito sostenible de valoración mutua.` });
    else if (recent < early * 0.8)
      out.push({ type:'warning', icon:'trending-down', category:'Tendencia',
        title: 'Caída de engagement detectada',
        text: `La actividad cayó un ${Math.round((1-recent/Math.max(early,1))*100)}% hacia el final del período. Puede ser un buen momento para lanzar una campaña o recordatorio de reconocimiento.` });
  }

  // Concentración en un programa
  if (programs?.distribution?.length > 0 && programs.total > 0) {
    const top = programs.distribution[0];
    const pct = Math.round((top.count / programs.total) * 100);
    if (pct >= 60)
      out.push({ type:'info', icon:'tag', category:'Programas',
        title: `"${top.name}" concentra el ${pct}% de los reconocimientos`,
        text: 'Un solo programa domina. Diversificar el uso de otros valores puede enriquecer la cultura y ampliar los comportamientos celebrados.' });
  }

  // Equipos aislados
  if (interaction?.isolated?.length > 0) {
    const names = interaction.isolated.slice(0,2).join(', ');
    out.push({ type:'info', icon:'network', category:'Colaboración',
      title: `${interaction.isolated.length} equipo${interaction.isolated.length!==1?'s':''} sin interacción cross-equipo`,
      text: `${names}${interaction.isolated.length > 2 ? ' y otros' : ''} no tuvieron reconocimientos hacia o desde otros equipos. Promover la colaboración entre áreas fortalece la cultura global.` });
  }

  // Campaña / pico detectado
  if (patterns?.spikes?.length > 0)
    out.push({ type:'positive', icon:'zap', category:'Campaña',
      title: `${patterns.spikes.length} momento${patterns.spikes.length>1?'s':''} de alta actividad`,
      text: `${patterns.spikes.slice(0,2).map(s=>s.label).join(' y ')} registraron actividad inusualmente alta. Estos momentos pueden ser un modelo a repetir o amplificar.` });

  return [];
} // end _legacyGen (unused)

function _insightSection(title, icon, color, list) {
  if (!list?.length) return '';
  return `<div class="mb-5">
    <h3 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2.5">
      <i data-lucide="${icon}" class="w-4 h-4 ${color}"></i>${title}
    </h3>
    <div class="space-y-2">${list.map(_insightCard).join('')}</div>
  </div>`;
}

function _timelineHTML(patterns) {
  if (!patterns?.weeklyEvolution?.length) return '';
  const weeks = patterns.weeklyEvolution;
  const counts = weeks.map(w=>w.count);
  const mean = counts.reduce((s,c)=>s+c,0)/counts.length;
  const stddev = Math.sqrt(counts.reduce((s,c)=>s+(c-mean)**2,0)/counts.length);
  const events = [{ week:weeks[0].label, type:'start', title:'Inicio del período analizado', text:`${weeks[0].count} reconocimientos en la primera semana.` }];
  patterns.spikes?.forEach(s => events.push({ week:s.label, type:'spike', title:'Pico de actividad — posible campaña', text:`${s.count} reconocimientos (${Math.round(s.count/Math.max(mean,1))}× el promedio).` }));
  weeks.filter(w=>w.count < mean - 1.5*stddev && w.count < mean*0.5).forEach(d => events.push({ week:d.label, type:'drop', title:'Caída de actividad', text:`${d.count} reconocimientos — por debajo del promedio.` }));
  events.push({ week:weeks[weeks.length-1].label, type:'current', title:'Última semana del período', text:`${weeks[weeks.length-1].count} reconocimientos registrados.` });
  events.sort((a,b)=>a.week<b.week?-1:a.week>b.week?1:0);
  const cfg = { start:{c:'bg-blue-100 text-blue-600',i:'play'}, spike:{c:'bg-violet-100 text-[#3d2b56]',i:'zap'}, drop:{c:'bg-amber-100 text-amber-600',i:'alert-triangle'}, current:{c:'bg-green-100 text-green-600',i:'flag'} };
  return `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
    <h2 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4"><i data-lucide="clock" class="w-4 h-4 text-[#c9a7d4]"></i> Timeline de eventos</h2>
    <div class="space-y-0">${events.map((e,i)=>`
      <div class="flex gap-3">
        <div class="flex flex-col items-center">
          <div class="w-7 h-7 rounded-full ${cfg[e.type]?.c||'bg-gray-100 text-gray-500'} flex items-center justify-center shrink-0">
            <i data-lucide="${cfg[e.type]?.i||'circle'}" class="w-3 h-3"></i>
          </div>
          ${i<events.length-1?'<div class="w-px flex-1 min-h-[16px] bg-gray-200 my-0.5"></div>':''}
        </div>
        <div class="pb-3 flex-1 min-w-0 pt-0.5">
          <div class="flex items-center gap-2 mb-0.5">
            <p class="text-xs font-semibold text-gray-800">${esc(e.title)}</p>
            <span class="text-[10px] text-gray-400 shrink-0">${esc(e.week)}</span>
          </div>
          <p class="text-xs text-gray-500">${esc(e.text)}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

// ���� Cultural Health Analysis ����������������������������������������������������������������������������������������������������
function _detailedScore(data) {
  const comp = [
    { key:'engagement',   label:'Engagement',     icon:'activity',       weight:0.25, score:50 },
    { key:'alcance',      label:'Alcance',         icon:'users',          weight:0.20, score:50 },
    { key:'colaboracion', label:'Colaboración',    icon:'arrow-right-left',weight:0.15,score:50 },
    { key:'liderazgo',    label:'Liderazgo',       icon:'user-check',     weight:0.15, score:50 },
    { key:'tendencia',    label:'Tendencia',       icon:'trending-up',    weight:0.15, score:50 },
    { key:'retencion',    label:'Retención',       icon:'heart',          weight:0.10, score:50 },
  ];
  if (data.engagement) {
    comp[0].score = Math.min(100, data.engagement.pctSenders  * 1.4);
    comp[1].score = Math.min(100, data.engagement.pctReceivers* 1.3);
  }
  if (data.interaction?.depts?.length > 1) {
    const iso = (data.interaction.isolated?.length||0) / data.interaction.depts.length;
    comp[2].score = Math.max(0, Math.round((1-iso)*100));
  }
  if (data.patterns?.total > 5)
    comp[3].score = Math.min(100, (data.patterns.adminPct||0) * 3.5);
  if (data.patterns?.weeklyEvolution?.length >= 4) {
    const n=data.patterns.weeklyEvolution.length, t3=Math.max(1,Math.floor(n/3));
    const r=data.patterns.weeklyEvolution.slice(-t3).reduce((a,w)=>a+w.count,0)/t3;
    const e=data.patterns.weeklyEvolution.slice(0,t3).reduce((a,w)=>a+w.count,0)/t3;
    comp[4].score = Math.max(0,Math.min(100, 50+(e>0?((r/e)-1)*80:0)));
  }
  if (data.users && data.engagement?.totalUsers > 0) {
    const ip = (data.users.inactive?.length||0) / data.engagement.totalUsers;
    comp[5].score = Math.max(0, Math.round((1-ip)*100));
  }
  comp.forEach(c => c.score = Math.round(c.score));
  const score = Math.max(10, Math.min(100,
    Math.round(comp.reduce((s,c) => s + c.score*c.weight, 0))
  ));
  return { score, components: comp };
}

function _healthAnalysisText(score, comp, prevScore, data) {
  const sl = score>=80?'Excelente':score>=65?'Buena':score>=50?'En desarrollo':score>=35?'Necesita atención':'Crítica';
  const delta = prevScore !== null ? score - prevScore : null;

  // Summary
  const summary = score >= 65
    ? `Tu organización muestra una cultura de reconocimiento activa. Los índices de participación y colaboración indican que el hábito está instalado y creciendo.`
    : score >= 45
    ? `La cultura está en proceso de consolidación. Hay señales positivas pero también oportunidades claras de mejora en algunos equipos y dimensiones.`
    : `La cultura organizacional necesita atención. La participación y el reconocimiento están por debajo de los niveles recomendados para sostener el engagement.`;

  // Fortalezas
  const fortalezas = [];
  const bestComp = [...comp].sort((a,b)=>b.score-a.score).slice(0,2);
  bestComp.forEach(c => {
    if (c.score >= 60) {
      if (c.key==='engagement')   fortalezas.push(`El ${data.engagement?.pctSenders||0}% del equipo participa activamente en el reconocimiento.`);
      if (c.key==='alcance')      fortalezas.push(`El ${data.engagement?.pctReceivers||0}% de las personas recibieron reconocimiento en el período.`);
      if (c.key==='colaboracion') fortalezas.push('Hay interacción cross-equipo activa, señal de una cultura colaborativa saludable.');
      if (c.key==='liderazgo')    fortalezas.push(`Los líderes participan activamente (${data.patterns?.adminPct||0}% de los reconocimientos).`);
      if (c.key==='tendencia')    fortalezas.push('La tendencia de participación es creciente en las últimas semanas.');
      if (c.key==='retencion')    fortalezas.push('La mayoría de los usuarios mantienen actividad regular en la plataforma.');
    }
  });
  if (!fortalezas.length) fortalezas.push('El equipo tiene una base de reconocimiento sobre la cual construir.');

  // Riesgos
  const riesgos = [];
  const worstComp = [...comp].sort((a,b)=>a.score-b.score).slice(0,2);
  worstComp.forEach(c => {
    if (c.score < 50) {
      if (c.key==='engagement')   riesgos.push(`Solo el ${data.engagement?.pctSenders||0}% del equipo envió reconocimientos. Se necesita mayor activación.`);
      if (c.key==='alcance')      riesgos.push('Muchos miembros no recibieron reconocimiento, lo que puede afectar la motivación.');
      if (c.key==='colaboracion') riesgos.push('Baja interacción entre equipos. Pueden existir silos organizacionales.');
      if (c.key==='liderazgo')    riesgos.push('Los líderes participan poco. Su ejemplo es clave para instalar el hábito cultural.');
      if (c.key==='tendencia')    riesgos.push('La actividad muestra una tendencia descendente en el período reciente.');
      if (c.key==='retencion')    riesgos.push('Alto porcentaje de usuarios sin actividad. Pueden estar desconectados de la cultura.');
    }
  });
  if (!riesgos.length) riesgos.push('No se detectaron riesgos críticos en el período actual.');

  return { sl, summary, fortalezas, riesgos, delta };
}

function _buildHealthSectionHTML(score, comp, analysis, weeklyData, prevScore) {
  const V = '#3d2b56', L = '#c9a7d4';
  const scoreColor = score>=80?'#16a34a':score>=65?V:score>=50?'#d97706':'#dc2626';
  const dash=251.2, off=(dash-(score/100)*dash).toFixed(1);

  // Score arc
  const arc = `<div class="relative w-20 h-20 shrink-0">
    <svg class="w-full h-full" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
      <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,.2)" stroke-width="12" fill="none"/>
      <circle cx="50" cy="50" r="40" stroke="white" stroke-width="12" fill="none"
        stroke-dasharray="${dash}" stroke-dashoffset="${off}" stroke-linecap="round"/>
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-xl font-extrabold text-white leading-none">${score}</span>
      <span class="text-[9px] text-white/60 font-semibold">/100</span>
    </div>
  </div>`;

  // Delta badge
  const deltaHTML = analysis.delta !== null
    ? `<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${analysis.delta>=0?'bg-green-400/20 text-green-200':'bg-red-400/20 text-red-200'}">
        <i data-lucide="${analysis.delta>=0?'arrow-up':'arrow-down'}" class="w-3 h-3"></i>
        ${analysis.delta>=0?'+':''}${analysis.delta} puntos vs período anterior
       </span>` : '';

  // Breakdown bars
  const barMax = Math.max(...comp.map(c=>c.score), 1);
  const bars = comp.map(c => {
    const w = Math.round((c.score/100)*100);
    const color = c.score>=70?'bg-[#3d2b56]':c.score>=50?'bg-[#c9a7d4]':'bg-amber-400';
    return `<div class="flex items-center gap-3">
      <div class="flex items-center gap-1.5 w-28 shrink-0">
        <i data-lucide="${c.icon}" class="w-3.5 h-3.5 text-gray-400 shrink-0"></i>
        <span class="text-xs text-gray-600 truncate">${c.label}</span>
      </div>
      <div class="flex-1 bg-gray-100 rounded-full h-2">
        <div class="${color} h-2 rounded-full transition-all" style="width:${w}%"></div>
      </div>
      <span class="text-xs font-bold text-gray-700 w-8 text-right shrink-0">${c.score}</span>
    </div>`;
  }).join('');

  // Fortalezas + Riesgos
  const fItems = analysis.fortalezas.map(f=>`<li class="flex items-start gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5"></i><span class="text-xs text-gray-600 leading-relaxed">${esc(f)}</span></li>`).join('');
  const rItems = analysis.riesgos.map(r=>`<li class="flex items-start gap-2"><i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5"></i><span class="text-xs text-gray-600 leading-relaxed">${esc(r)}</span></li>`).join('');

  return `<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">

    <!-- Header -->
    <div class="bg-[#3d2b56] p-6">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="sparkles" class="w-4 h-4 text-[#c9a7d4]"></i>
        <span class="text-xs font-bold uppercase tracking-widest text-[#c9a7d4]">Análisis de Salud Cultural · IA</span>
      </div>
      <div class="flex items-start gap-4">
        ${arc}
        <div class="flex-1 min-w-0">
          <p class="text-3xl font-extrabold text-white leading-none mb-1">${analysis.sl}</p>
          <p class="text-sm text-white/70 leading-relaxed mb-2">${esc(analysis.summary)}</p>
          ${deltaHTML}
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="p-6 space-y-6">

      <!-- Score breakdown -->
      <div>
        <h3 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <i data-lucide="sliders" class="w-4 h-4 text-[#c9a7d4]"></i> Componentes del score
        </h3>
        <div class="space-y-2.5">${bars}</div>
      </div>

      <!-- Fortalezas + Riesgos -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-green-50 rounded-xl p-4 border border-green-100">
          <h4 class="text-xs font-bold text-green-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Fortalezas
          </h4>
          <ul class="space-y-1.5">${fItems}</ul>
        </div>
        <div class="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <h4 class="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Oportunidades de mejora
          </h4>
          <ul class="space-y-1.5">${rItems}</ul>
        </div>
      </div>

      <!-- Evolution chart -->
      <div>
        <h3 class="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
          <i data-lucide="line-chart" class="w-4 h-4 text-[#3d2b56]"></i> Evolución del score
        </h3>
        <p class="text-xs text-gray-400 mb-3">Score estimado semana a semana en base a la actividad del período</p>
        <canvas id="chart-health-evo" height="110"></canvas>
        <p id="chart-health-evo-empty" class="hidden text-xs text-gray-400 text-center py-4">Sin suficientes datos para mostrar la evolución.</p>
      </div>

      <!-- Comparison with prev period -->
      ${analysis.delta !== null ? `<div class="rounded-xl p-4 border ${analysis.delta>=0?'bg-green-50 border-green-100':'bg-amber-50 border-amber-100'}">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg ${analysis.delta>=0?'bg-green-100':'bg-amber-100'} flex items-center justify-center shrink-0">
            <i data-lucide="${analysis.delta>=0?'trending-up':'trending-down'}" class="w-5 h-5 ${analysis.delta>=0?'text-green-600':'text-amber-600'}"></i>
          </div>
          <div>
            <p class="text-sm font-bold text-gray-800">Comparación con período anterior</p>
            <p class="text-xs text-gray-600">${analysis.delta>=0
              ? `El score mejoró <strong>${analysis.delta} puntos</strong> respecto a los 6 meses anteriores. La cultura está progresando.`
              : `El score bajó <strong>${Math.abs(analysis.delta)} puntos</strong> respecto al período anterior. Es un momento para reactivar el programa.`}</p>
          </div>
        </div>
      </div>` : ''}

    </div>
  </div>`;
}

function _renderHealthEvoChart(weeklyEvolution, mean) {
  if (_analyticsCharts.healthEvo) { _analyticsCharts.healthEvo.destroy(); delete _analyticsCharts.healthEvo; }
  const ctx = document.getElementById('chart-health-evo');
  if (!ctx || !weeklyEvolution?.length || weeklyEvolution.length < 3) {
    document.getElementById('chart-health-evo-empty')?.classList.remove('hidden');
    if (ctx) ctx.style.display='none';
    return;
  }
  document.getElementById('chart-health-evo-empty')?.classList.add('hidden');
  ctx.style.display='';
  const m = mean || weeklyEvolution.reduce((s,w)=>s+w.count,0)/weeklyEvolution.length || 1;
  const scores = weeklyEvolution.map(w => {
    const base = 50, ratio = w.count/m;
    return Math.max(10, Math.min(100, Math.round(base + (ratio-1)*40)));
  });
  _analyticsCharts.healthEvo = new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeklyEvolution.map(w => w.label),
      datasets: [
        { label:'Score cultural', data:scores,
          borderColor:'#3d2b56', backgroundColor:'rgba(61,43,86,0.08)', fill:true,
          tension:0.4, pointRadius:3, pointBackgroundColor:'#3d2b56' },
        { label:'Promedio', data:weeklyEvolution.map(()=>50),
          borderColor:'rgba(201,167,212,.6)', borderDash:[4,4], pointRadius:0, fill:false }
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{display:true,position:'top',labels:{usePointStyle:true,padding:12,font:{size:11}}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.parsed.y}/100`}} },
      scales:{
        y:{ min:0,max:100,ticks:{callback:v=>v+'/100'},grid:{color:'#f3f4f6'} },
        x:{ grid:{display:false},ticks:{font:{size:10},maxTicksLimit:8} }
      }
    }
  });
}

// ���� Resumen Ejecutivo ������������������������������������������������������������������������������������������������������������������
function _generateExecSummary(data, score, components, fromM, toM) {
  const eng  = data.engagement;
  const pat  = data.patterns;
  const int_ = data.interaction;
  const prog = data.programs;
  const usr  = data.users;
  const total = eng?.totalUsers || 0;
  const DAYS  = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  // ���� Highlights ����������������������������������������������������������������������������������������������������������������������������
  const highlights = [];
  if (eng?.pctSenders != null)
    highlights.push({ icon:'activity', color:'text-[#3d2b56]', bg:'bg-violet-50',
      text:`${eng.pctSenders}% del equipo envió reconocimientos en el período` });
  if (pat?.total != null)
    highlights.push({ icon:'award', color:'text-[#e87cb4]', bg:'bg-rosa-50',
      text:`${pat.total} reconocimiento${pat.total!==1?'s':''} registrado${pat.total!==1?'s':''} en total` });
  if (prog?.distribution?.[0]?.count > 0)
    highlights.push({ icon:'tag', color:'text-blue-600', bg:'bg-blue-50',
      text:`"${prog.distribution[0].name}" fue el valor más celebrado (${Math.round((prog.distribution[0].count/(prog.total||1))*100)}%)` });
  if (pat?.weeklyEvolution?.length >= 4) {
    const n=pat.weeklyEvolution.length, t3=Math.max(1,Math.floor(n/3));
    const r=pat.weeklyEvolution.slice(-t3).reduce((a,w)=>a+w.count,0)/t3;
    const e=pat.weeklyEvolution.slice(0,t3).reduce((a,w)=>a+w.count,0)/t3;
    const up=r>e*1.1, dn=r<e*0.9;
    highlights.push({ icon:up?'trending-up':dn?'trending-down':'minus',
      color:up?'text-green-600':dn?'text-amber-600':'text-gray-500',
      bg:up?'bg-green-50':dn?'bg-amber-50':'bg-gray-50',
      text:`Tendencia de participación: ${up?'creciente':dn?'en descenso':'estable'}` });
  }

  // ���� Párrafos por sección ��������������������������������������������������������������������������������������������������������
  let pEngagement = '';
  if (eng) {
    const participation = eng.pctSenders >= 70 ? `una participación destacada del ${eng.pctSenders}%, señal de que el hábito de reconocimiento está consolidado.`
      : eng.pctSenders >= 40 ? `una participación del ${eng.pctSenders}%. Si bien existe una base activa, hay margen significativo para profundizar el hábito organizacional.`
      : `una participación del ${eng.pctSenders}%, por debajo del umbral recomendado. Este indicador requiere atención prioritaria por parte del equipo de RRHH y los líderes.`;
    const reception = eng.pctReceivers >= 70 ? ` El ${eng.pctReceivers}% de los colaboradores recibió al menos un reconocimiento, reflejo de una distribución saludable.`
      : ` El ${eng.pctReceivers}% de los colaboradores fue reconocido, lo que indica que una parte importante del equipo aún no experimenta el valor de la plataforma.`;
    const avgNote = eng.avgPerUser ? ` El promedio fue de ${eng.avgPerUser} reconocimientos por usuario activo.` : '';
    pEngagement = `En el período evaluado (${fromM} → ${toM}), la organización registró ${participation}${reception}${avgNote}`;
  }

  let pReconocimiento = '';
  if (prog?.total > 0) {
    const top = prog.distribution[0];
    const topPct = Math.round((top.count/(prog.total||1))*100);
    const diversity = topPct >= 60
      ? `La concentración del ${topPct}% en "${top.name}" sugiere que los demás valores podrían necesitar mayor visibilidad y comunicación interna.`
      : `La distribución equilibrada entre programas refleja que la organización celebra múltiples dimensiones de su cultura.`;
    const customNote = prog.withActivity?.some(p=>p.isCustom)
      ? ` Además, se evidencia actividad en programas personalizados, indicando que la cultura se adapta a las necesidades propias del equipo.` : '';
    pReconocimiento = `Se registraron ${prog.total} reconocimientos en el período. El programa "${top.name}" fue el más utilizado, concentrando el ${topPct}% de los reconocimientos. ${diversity}${customNote}`;
  }

  let pLiderazgo = '';
  if (pat?.total > 5) {
    const ap = pat.adminPct || 0;
    pLiderazgo = ap >= 20
      ? `Los líderes demonstraron un compromiso visible con la cultura, siendo responsables del ${ap}% de los reconocimientos. Cuando el liderazgo reconoce activamente, el equipo lo replica. Este indicador es positivo para la sostenibilidad del programa.`
      : ap >= 10
      ? `Los líderes iniciaron el ${ap}% de los reconocimientos. Si bien existe participación, ampliarla tendría un impacto multiplicador en el engagement del equipo. Se recomienda incorporar métricas de reconocimiento en la evaluación del desempeño gerencial.`
      : `Los líderes iniciaron solo el ${ap}% de los reconocimientos en el período. El liderazgo es el principal predictor de adopción cultural; su baja participación puede estar limitando el alcance del programa. Se recomienda priorizar esta dimensión en la próxima fase de implementación.`;
    const peakDay = pat.byDOW?.indexOf(Math.max(...(pat.byDOW||[])));
    if (peakDay >= 0) pLiderazgo += ` El ${DAYS[peakDay]} concentra la mayor actividad de reconocimiento de la semana.`;
  }

  let pConexion = '';
  if (int_) {
    const isolated = int_.isolated?.length || 0;
    const totalTeams = int_.depts?.length || 0;
    if (isolated === 0 && totalTeams > 1)
      pConexion = `Se observa interacción cross-equipo activa entre todas las áreas analizadas. Este indicador es señal de una organización colaborativa y de baja fragmentación cultural.`;
    else if (isolated > 0 && totalTeams > 1) {
      const pct = Math.round((isolated/totalTeams)*100);
      const names = int_.isolated?.slice(0,2).join(' y ') || '';
      pConexion = `El ${pct}% de los equipos (${names}${isolated>2?', entre otros':''}) no registró reconocimientos hacia otras áreas. La ausencia de interacción cross-funcional puede ser indicador de silos organizacionales. Se recomienda revisar las dinámicas de colaboración en estas áreas.`;
    } else {
      pConexion = `Los datos de interacción entre equipos son limitados para este período. A medida que crezca el uso de la plataforma, este indicador ofrecerá mayor valor analítico.`;
    }
  }

  // ���� Recomendaciones ejecutivas ��������������������������������������������������������������������������������������������
  const worstComp = [...components].sort((a,b)=>a.score-b.score).slice(0,2);
  const recs = worstComp.map(c => {
    if (c.key==='engagement')   return 'Activar una campaña de reconocimiento con objetivos claros de participación para el próximo mes.';
    if (c.key==='alcance')      return 'Incorporar reconocimiento dirigido a colaboradores que aún no han sido reconocidos en el período.';
    if (c.key==='colaboracion') return 'Diseñar iniciativas cross-funcionales que incentiven el reconocimiento entre áreas con baja interacción.';
    if (c.key==='liderazgo')    return 'Presentar a los líderes el impacto de su participación en el engagement y establecer mínimos de actividad mensual.';
    if (c.key==='tendencia')    return 'Revisar qué cambios ocurrieron al inicio del período de baja actividad y planificar una iniciativa de reactivación.';
    if (c.key==='retencion')    return 'Identificar a los usuarios inactivos y diseñar un programa de incorporación gradual al hábito de reconocimiento.';
    return null;
  }).filter(Boolean).slice(0,2);

  return { highlights, pEngagement, pReconocimiento, pLiderazgo, pConexion, recs };
}

function _buildExecSummaryHTML(summary, score, fromM, toM) {
  const now = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
  const companyName = (typeof companies !== 'undefined' && companies?.find(c=>c.id===currentUser?.company_id)?.name) || currentUser?.company_id || 'tu empresa';
  const sl = score>=80?'Excelente':score>=65?'Buena':score>=50?'En desarrollo':score>=35?'Necesita atención':'Crítica';

  const chips = summary.highlights.map(h =>
    `<span class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${h.bg} border border-gray-200">
      <i data-lucide="${h.icon}" class="w-3 h-3 ${h.color} shrink-0"></i>
      <span class="text-gray-700">${esc(h.text)}</span>
    </span>`
  ).join('');

  const secStyle = 'border-l-2 border-[#c9a7d4] pl-4';
  const secTitle = t => `<h3 class="text-xs font-bold uppercase tracking-widest text-[#3d2b56] mb-1.5">${t}</h3>`;

  const sections = [
    summary.pEngagement   && `<div class="${secStyle}">${secTitle('Engagement y Participación')}<p class="text-sm text-gray-700 leading-relaxed">${esc(summary.pEngagement)}</p></div>`,
    summary.pReconocimiento && `<div class="${secStyle}">${secTitle('Reconocimiento y Valores')}<p class="text-sm text-gray-700 leading-relaxed">${esc(summary.pReconocimiento)}</p></div>`,
    summary.pLiderazgo     && `<div class="${secStyle}">${secTitle('Liderazgo')}<p class="text-sm text-gray-700 leading-relaxed">${esc(summary.pLiderazgo)}</p></div>`,
    summary.pConexion      && `<div class="${secStyle}">${secTitle('Conexión entre Equipos')}<p class="text-sm text-gray-700 leading-relaxed">${esc(summary.pConexion)}</p></div>`,
  ].filter(Boolean).join('');

  const recItems = summary.recs.map((r,i) =>
    `<div class="flex items-start gap-3 p-3 rounded-lg bg-[#f5f0fa] border border-[#ede9f7]">
      <div class="w-5 h-5 rounded-full bg-[#3d2b56] flex items-center justify-center shrink-0 mt-0.5">
        <span class="text-[9px] font-extrabold text-white">${i+1}</span>
      </div>
      <p class="text-sm text-gray-700 leading-relaxed">${esc(r)}</p>
    </div>`
  ).join('');

  return `<div class="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 overflow-hidden" id="exec-summary-card">

    <!-- Report header -->
    <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <i data-lucide="file-text" class="w-4 h-4 text-[#3d2b56]"></i>
            <span class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Resumen Ejecutivo · Generado por IA</span>
          </div>
          <p class="text-base font-bold text-gray-900">${esc(companyName)} · Estado Cultural</p>
          <p class="text-xs text-gray-500 mt-0.5">Período: ${fromM} → ${toM} &nbsp;·&nbsp; Generado el ${now}</p>
        </div>
        <button onclick="downloadExecSummaryPDF()" class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#3d2b56] bg-[#ede9f7] rounded-lg hover:bg-violet-200 transition">
          <i data-lucide="download" class="w-3.5 h-3.5"></i> Exportar PDF
        </button>
      </div>
    </div>

    <!-- Score banner -->
    <div class="px-6 py-3 bg-[#3d2b56] flex items-center gap-3">
      <span class="text-white/60 text-xs font-semibold uppercase tracking-wide">Score de Salud Cultural</span>
      <span class="text-white font-extrabold text-lg">${score}/100</span>
      <span class="text-xs font-bold px-2 py-0.5 rounded-full ${score>=65?'bg-green-400/20 text-green-200':score>=50?'bg-amber-400/20 text-amber-200':'bg-red-400/20 text-red-200'}">${sl}</span>
    </div>

    <!-- Highlights -->
    <div class="px-6 py-4 border-b border-gray-100">
      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Puntos clave del período</p>
      <div class="flex flex-wrap gap-2">${chips}</div>
    </div>

    <!-- Narrative sections -->
    <div class="px-6 py-5 space-y-4">${sections}</div>

    <!-- Recommendations -->
    ${recItems ? `<div class="px-6 pb-5">
      <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Acciones recomendadas para RRHH y Liderazgo</p>
      <div class="space-y-2">${recItems}</div>
    </div>` : ''}

    <!-- Footer -->
    <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
      <span class="text-xs text-gray-400">Confidencial · Solo para uso interno</span>
      <span class="text-xs text-gray-300">Generado automáticamente por Allay</span>
    </div>

  </div>`;
}

function downloadExecSummaryPDF() {
  const card = document.getElementById('exec-summary-card');
  if (!card) { showErrorToast('Sin datos para exportar'); return; }
  const w = window.open('', '_blank');
  if (!w) { showErrorToast('Activá los pop-ups del navegador para el PDF'); return; }
  const clone = card.cloneNode(true);
  clone.querySelector('button[onclick]')?.remove();
  clone.querySelectorAll('i[data-lucide]').forEach(el => el.remove());
  const now = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });
  const css = [
    '*{box-sizing:border-box}',
    'body{font-family:Calibri,Arial,sans-serif;margin:0;padding:32px;background:#fff;color:#1f2937;font-size:13px}',
    '.bg-gray-50{background:#f9fafb!important}.bg-white{background:#fff!important}',
    '.bg-\\[\\#3d2b56\\]{background:#3d2b56!important}',
    '.bg-\\[\\#f5f0fa\\]{background:#f5f0fa!important}',
    '.bg-green-50{background:#f0fdf4!important}.bg-amber-50{background:#fffbeb!important}',
    '.text-white{color:#fff!important}.text-gray-900{color:#111827!important}',
    '.text-gray-700{color:#374151!important}.text-gray-500{color:#6b7280!important}',
    '.text-gray-400{color:#9ca3af!important}.text-\\[\\#3d2b56\\]{color:#3d2b56!important}',
    '.text-green-200{color:#bbf7d0!important}.text-amber-200{color:#fde68a!important}.text-red-200{color:#fecaca!important}',
    '.bg-green-400\\/20{background:rgba(74,222,128,.2)!important}.bg-amber-400\\/20{background:rgba(251,191,36,.2)!important}',
    '.font-bold{font-weight:700!important}.font-extrabold{font-weight:800!important}.font-semibold{font-weight:600!important}',
    '.text-xs{font-size:12px!important}.text-sm{font-size:13px!important}.text-base{font-size:15px!important}.text-lg{font-size:18px!important}',
    '.text-\\[10px\\]{font-size:10px!important}.text-\\[9px\\]{font-size:9px!important}',
    '.uppercase{text-transform:uppercase!important}.tracking-widest{letter-spacing:.1em!important}',
    '.px-6{padding-left:24px!important;padding-right:24px!important}.py-5{padding-top:20px!important;padding-bottom:20px!important}',
    '.py-4{padding-top:16px!important;padding-bottom:16px!important}.py-3{padding-top:12px!important;padding-bottom:12px!important}',
    '.pb-5{padding-bottom:20px!important}.px-4{padding-left:16px!important;padding-right:16px!important}',
    '.pb-4{padding-bottom:16px!important}.px-3{padding-left:12px!important;padding-right:12px!important}',
    '.py-2{padding-top:8px!important;padding-bottom:8px!important}.py-0\\.5{padding-top:2px!important;padding-bottom:2px!important}',
    '.mb-1{margin-bottom:4px!important}.mb-2{margin-bottom:8px!important}.mb-2\\.5{margin-bottom:10px!important}.mb-6{margin-bottom:24px!important}',
    '.mt-0\\.5{margin-top:2px!important}',
    '.gap-2{gap:8px!important}.gap-3{gap:12px!important}.gap-1\\.5{gap:6px!important}',
    '.flex{display:flex!important}.flex-wrap{flex-wrap:wrap!important}.items-center{align-items:center!important}',
    '.items-start{align-items:flex-start!important}.justify-between{justify-content:space-between!important}.shrink-0{flex-shrink:0!important}',
    '.space-y-4>*+*{margin-top:16px}.space-y-2>*+*{margin-top:8px}',
    '.rounded-2xl{border-radius:16px!important}.rounded-full{border-radius:9999px!important}.rounded-lg{border-radius:8px!important}',
    '.border{border:1px solid #e5e7eb!important}.border-b{border-bottom:1px solid #e5e7eb!important}',
    '.border-\\[\\#ede9f7\\]{border-color:#ede9f7!important}',
    '.overflow-hidden{overflow:hidden!important}.shadow-sm{box-shadow:0 1px 3px rgba(0,0,0,.08)!important}',
    '.leading-relaxed{line-height:1.6!important}.leading-none{line-height:1!important}',
    '.w-\\[3px\\]{width:3px!important}.self-stretch{align-self:stretch!important}.pl-4{padding-left:16px!important}',
    '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0}@page{margin:.4in}}',
  ].join('\n');
  const body = clone.outerHTML;
  const footer = `<div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:8px;text-align:center;font-size:10px;color:#9ca3af">Allay · Resumen Ejecutivo generado el ${now}</div>`;
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Resumen Ejecutivo · Allay</title><style>' + css + '</style></head><body>' + body + footer + '<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>');
  w.document.close();
}

async function renderInsights() {
  const container = document.getElementById('insights-container');
  if (!container) return;
  // Destroy any existing health chart
  if (_analyticsCharts.healthEvo) { _analyticsCharts.healthEvo.destroy(); delete _analyticsCharts.healthEvo; }
  container.innerHTML = '<div class="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Analizando datos⬦</div>';
  lucide.createIcons();

  const companyId = _analyticsCompanyId() || currentUser?.company_id || '';
  const now   = new Date();
  const toM   = now.toISOString().substring(0,7);
  const fromM = new Date(now.getFullYear(), now.getMonth()-5, 1).toISOString().substring(0,7);
  const mkISO = m => m+'-01T00:00:00.000Z';
  const mkEndISO = m => { const b=new Date(m+'-01T00:00:00.000Z'); b.setUTCMonth(b.getUTCMonth()+1); b.setUTCMilliseconds(-1); return b.toISOString(); };
  const fromISO = mkISO(fromM), toISO = mkEndISO(toM);

  // Previous period: 12–6 months ago
  const prevToM   = new Date(now.getFullYear(), now.getMonth()-6, 1).toISOString().substring(0,7);
  const prevFromM = new Date(now.getFullYear(), now.getMonth()-11, 1).toISOString().substring(0,7);
  const prevFromISO = mkISO(prevFromM), prevToISO = mkEndISO(prevToM);

  const [engR, userR, intR, patR, progR, prevEngR, prevPatR] = await Promise.all([
    window.analyticsSdk.engagement(companyId, fromISO, toISO),
    window.analyticsSdk.byUser(companyId, fromISO, toISO),
    window.analyticsSdk.teamInteraction(companyId, fromISO, toISO),
    window.analyticsSdk.participationPatterns(companyId, fromISO, toISO),
    window.analyticsSdk.byProgram(companyId, fromISO, toISO),
    window.analyticsSdk.engagement(companyId, prevFromISO, prevToISO),
    window.analyticsSdk.participationPatterns(companyId, prevFromISO, prevToISO),
  ]);

  const data = {
    engagement:  engR.isOk  ? engR.data  : null,
    users:       userR.isOk ? userR.data  : null,
    interaction: intR.isOk  ? intR.data   : null,
    patterns:    patR.isOk  ? patR.data   : null,
    programs:    progR.isOk ? progR.data  : null,
  };
  const prevData = {
    engagement:  prevEngR.isOk ? prevEngR.data : null,
    patterns:    prevPatR.isOk ? prevPatR.data  : null,
    users: null, interaction: null, programs: null,
  };

  // Scores
  const { score, components } = _detailedScore(data);
  const prevScore = prevData.engagement ? _detailedScore(prevData).score : null;
  const analysis  = _healthAnalysisText(score, components, prevScore, data);

  const cats  = _generateAllInsights(data);
  const total = Object.values(cats).flat().length;

  if (total === 0) {
    container.innerHTML = '<p class="text-sm text-gray-500 text-center py-12">No hay suficientes datos para generar insights en este momento.</p>';
    return;
  }

  // ���� Equipos que necesitan atención ����
  const attentionTeams = (data.engagement?.deptStats||[]).filter(t=>t.senderPct<30&&t.total>=2);
  const attentionHTML  = attentionTeams.length ? `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
    <h2 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3"><i data-lucide="alert-circle" class="w-4 h-4 text-amber-500"></i> Equipos que necesitan atención</h2>
    <div class="space-y-2">${attentionTeams.map(t=>`
      <div class="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><i data-lucide="users" class="w-4 h-4 text-amber-600"></i></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">${esc(t.dept)}</p>
          <p class="text-xs text-gray-500">${t.total} personas · ${t.senderPct}% envió · ${t.receiverPct}% recibió reconocimientos</p>
        </div>
        <span class="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Baja actividad</span>
      </div>`).join('')}
    </div>
  </div>` : '';

  // ���� Aspectos positivos ����
  const positiveHTML = cats.positivos.length ? `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
    <h2 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3"><i data-lucide="sparkles" class="w-4 h-4 text-green-500"></i> Aspectos positivos destacados</h2>
    <div class="space-y-2">${cats.positivos.map(_insightCard).join('')}</div>
  </div>` : '';

  // ���� Tendencias emergentes ����
  const trendInsights = [...(cats.engagement||[]), ...(cats.riesgos||[])].filter(i=>i.icon==='trending-up'||i.icon==='trending-down'||i.icon==='zap'||i.icon==='minus');
  const trendsHTML = trendInsights.length ? `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
    <h2 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3"><i data-lucide="trending-up" class="w-4 h-4 text-[#3d2b56]"></i> Tendencias emergentes</h2>
    <div class="space-y-2">${trendInsights.map(_insightCard).join('')}</div>
  </div>` : '';

  // Build executive summary
  const execSummary = _generateExecSummary(data, score, components, fromM, toM);

  container.innerHTML =
    // AI Health Analysis (new prominent section)
    _buildHealthSectionHTML(score, components, analysis, data.patterns?.weeklyEvolution, prevScore) +
    // Executive Summary
    _buildExecSummaryHTML(execSummary, score, fromM, toM) +
    // Period header
    `<div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 flex items-center justify-between gap-3">
      <div>
        <p class="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Período analizado</p>
        <p class="text-sm font-semibold text-gray-800">${fromM} → ${toM}</p>
      </div>
      <span class="text-xs bg-[#ede9f7] text-[#3d2b56] font-semibold px-3 py-1 rounded-full">${total} insight${total!==1?'s':''} detectado${total!==1?'s':''}</span>
    </div>` +
    // Riesgos first
    (cats.riesgos.length ? `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
      <h2 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3"><i data-lucide="shield-alert" class="w-4 h-4 text-red-500"></i> Riesgos detectados</h2>
      <div class="space-y-2">${cats.riesgos.map(_insightCard).join('')}</div>
    </div>` : '') +
    // Categorized insights
    `<div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
      <h2 class="text-sm font-bold text-gray-700 flex items-center gap-2 mb-4"><i data-lucide="list" class="w-4 h-4 text-[#c9a7d4]"></i> Insights por categoría</h2>
      ${_insightSection('Engagement', 'activity', 'text-[#3d2b56]', cats.engagement)}
      ${_insightSection('Liderazgo', 'user-check', 'text-blue-600', cats.liderazgo)}
      ${_insightSection('Conexión entre equipos', 'network', 'text-[#c9a7d4]', cats.conexion)}
      ${_insightSection('Cultura y valores', 'tag', 'text-[#f19ac4]', cats.cultura)}
      ${_insightSection('Participación', 'users', 'text-violet-500', cats.participacion)}
    </div>` +
    trendsHTML +
    attentionHTML +
    positiveHTML +
    _timelineHTML(data.patterns);

  lucide.createIcons();
  // Render health evolution chart AFTER innerHTML is set
  _renderHealthEvoChart(data.patterns?.weeklyEvolution, data.patterns?.mean);
}

function _populateEngagementDeptFilter() {
  const sel = document.getElementById('engagement-dept-filter');
  if (!sel) return;
  const companyId = _analyticsCompanyId();
  const depts = [...new Set(
    (allUsers || [])
      .filter(u => u.role !== 'superadmin' && (companyId ? u.company_id === companyId : true))
      .map(u => u.department || 'Sin área')
  )].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los equipos</option>' +
    depts.map(d => `<option value="${esc(d)}"${current === d ? ' selected' : ''}>${esc(d)}</option>`).join('');
}

function _monthRangeToISO(fromId, toId) {
  const from = document.getElementById(fromId)?.value || '';
  const to   = document.getElementById(toId)?.value   || '';
  const fromISO = from ? from + '-01T00:00:00.000Z' : null;
  const toISO   = to ? (() => {
    const b = new Date(to + '-01T00:00:00.000Z');
    b.setUTCMonth(b.getUTCMonth() + 1);
    b.setUTCMilliseconds(-1);
    return b.toISOString();
  })() : null;
  return { fromISO, toISO };
}

async function renderEngagementSection() {
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('eng-from', 'eng-to');
  const dept               = document.getElementById('engagement-dept-filter')?.value || '';

  ['eng-pct-senders', 'eng-pct-receivers', 'eng-avg'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '⬦';
  });

  const result = await window.analyticsSdk.engagement(companyId, fromISO, toISO, dept);
  if (!result.isOk) return;
  _analyticsCache.engagement = result.data;
  const { pctSenders, pctReceivers, avgPerUser, deptStats, lowParticipation, evolution } = result.data;

  document.getElementById('eng-pct-senders').textContent   = pctSenders   + '%';
  document.getElementById('eng-pct-receivers').textContent = pctReceivers + '%';
  document.getElementById('eng-avg').textContent           = avgPerUser;

  // Evolution chart
  if (_analyticsCharts.engEvol) { _analyticsCharts.engEvol.destroy(); delete _analyticsCharts.engEvol; }
  const evolCtx = document.getElementById('chart-engagement-evolution');
  if (evolCtx && evolution.length > 0) {
    document.getElementById('chart-engagement-empty')?.classList.add('hidden');
    evolCtx.style.display = '';
    const fmt = ym => {
      const [y, m] = ym.split('-');
      return new Date(+y, +m - 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
    };
    _analyticsCharts.engEvol = new Chart(evolCtx, {
      type: 'line',
      data: {
        labels: evolution.map(d => fmt(d.period)),
        datasets: [
          { label: '% Enviaron', data: evolution.map(d => d.senderPct),
            borderColor: '#3d2b56', backgroundColor: 'rgba(61,43,86,0.07)', fill: true,
            tension: 0.4, pointBackgroundColor: '#3d2b56', pointRadius: 4 },
          { label: '% Recibieron', data: evolution.map(d => d.receiverPct),
            borderColor: '#f19ac4', backgroundColor: 'transparent', fill: false,
            tension: 0.4, pointBackgroundColor: '#f19ac4', pointRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } }
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#f3f4f6' } },
          x: { grid: { display: false } }
        }
      }
    });
  } else {
    document.getElementById('chart-engagement-empty')?.classList.remove('hidden');
    if (evolCtx) evolCtx.style.display = 'none';
  }

  // Department table
  const deptTableEl = document.getElementById('eng-dept-table');
  if (deptTableEl) {
    if (deptStats.length > 0) {
      deptTableEl.innerHTML = deptStats.map(d => {
        const isLow = d.senderPct < 30;
        return `<div class="flex items-center gap-4 p-3 rounded-xl ${isLow ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}">
          <div class="w-28 shrink-0">
            <p class="text-xs font-semibold text-gray-700 truncate">${esc(d.dept)}</p>
            <p class="text-[10px] text-gray-400">${d.total} persona${d.total !== 1 ? 's' : ''}</p>
          </div>
          <div class="flex-1 space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-500 w-16 shrink-0">Enviaron</span>
              <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                <div class="bg-[#3d2b56] h-1.5 rounded-full" style="width:${d.senderPct}%"></div>
              </div>
              <span class="text-xs font-bold text-[#3d2b56] w-9 text-right">${d.senderPct}%</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-gray-500 w-16 shrink-0">Recibieron</span>
              <div class="flex-1 bg-gray-200 rounded-full h-1.5">
                <div class="bg-[#f19ac4] h-1.5 rounded-full" style="width:${d.receiverPct}%"></div>
              </div>
              <span class="text-xs font-bold text-[#e87cb4] w-9 text-right">${d.receiverPct}%</span>
            </div>
          </div>
          ${isLow ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Baja</span>' : ''}
        </div>`;
      }).join('');
    } else {
      deptTableEl.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Sin datos de equipos.</p>';
    }
  }

  // Low participation list
  const lowListEl  = document.getElementById('eng-low-list');
  const lowEmptyEl = document.getElementById('eng-low-empty');
  const lowCountEl = document.getElementById('eng-low-count');
  if (lowCountEl) lowCountEl.textContent = lowParticipation.length;

  if (lowParticipation.length === 0) {
    if (lowListEl)  lowListEl.innerHTML = '';
    lowEmptyEl?.classList.remove('hidden');
  } else {
    lowEmptyEl?.classList.add('hidden');
    if (lowListEl) {
      lowListEl.innerHTML = lowParticipation.slice(0, 10).map(u => {
        const initials = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        return `<div class="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <div class="w-8 h-8 rounded-full ${getAvatarColor(u.name || '')} flex items-center justify-center text-white text-xs font-bold shrink-0">${esc(initials)}</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">${esc(u.name || u.email)}</p>
            <p class="text-xs text-gray-500">${esc(u.department || 'Sin área')} · No envió ni recibió en el período</p>
          </div>
          <span class="text-[10px] font-bold text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200 shrink-0">Sin actividad</span>
        </div>`;
      }).join('');
      if (lowParticipation.length > 10) {
        lowListEl.innerHTML += `<p class="text-xs text-gray-400 text-center pt-2">y ${lowParticipation.length - 10} más⬦</p>`;
      }
    }
  }

  lucide.createIcons();
}

function _programInsightText({ distribution, total, top, least, unused, withActivity }) {
  if (total === 0) return 'Sin reconocimientos en el período seleccionado.';
  const parts = [];

  if (top) {
    const pct = Math.round((top.count / total) * 100);
    if (pct >= 50) {
      parts.push(`${top.label} concentra más de la mitad de los reconocimientos del período (${pct}%).`);
    } else {
      parts.push(`${top.label} es la categoría más usada con ${top.count} reconocimiento${top.count !== 1 ? 's' : ''} (${pct}% del total).`);
    }
  }

  if (withActivity.length >= 3) {
    const top3pct = Math.round((withActivity.slice(0, 3).reduce((s, d) => s + d.count, 0) / total) * 100);
    if (top3pct >= 80) {
      parts.push(`El ${top3pct}% del total se concentra en solo 3 categorías; considerá impulsar las demás.`);
    } else if (top3pct < 60) {
      parts.push('La distribución es bastante equilibrada entre categorías.');
    }
  }

  const customUsed = withActivity.filter(d => d.isCustom);
  if (customUsed.length > 0) {
    parts.push(`${customUsed.length} programa${customUsed.length !== 1 ? 's' : ''} personalizado${customUsed.length !== 1 ? 's' : ''} con actividad este período.`);
  }

  if (unused.length > 0 && total > 0) {
    const names = unused.slice(0, 2).map(u => u.name).join(', ');
    const extra = unused.length > 2 ? ` y ${unused.length - 2} más` : '';
    parts.push(`Sin actividad: ${names}${extra}.`);
  }

  return parts.join(' ') || 'Sin datos suficientes para generar un insight.';
}

async function renderProgramsSection() {
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('prog-from', 'prog-to');

  document.getElementById('prog-insight-text').textContent = 'Cargando⬦';
  document.getElementById('prog-top-label').textContent    = '⬦';
  document.getElementById('prog-least-label').textContent  = '⬦';

  const result = await window.analyticsSdk.byProgram(companyId, fromISO, toISO);
  if (!result.isOk) return;
  _analyticsCache.programs = result.data;
  const { distribution, total, top, least, unused, withActivity } = result.data;

  // Insight
  document.getElementById('prog-insight-text').textContent = _programInsightText(result.data);

  // Top / least cards
  if (top) {
    document.getElementById('prog-top-label').textContent  = top.label;
    document.getElementById('prog-top-count').textContent  = `${top.count} reconocimiento${top.count !== 1 ? 's' : ''} · ${Math.round((top.count / total) * 100)}%`;
  } else {
    document.getElementById('prog-top-label').textContent  = '—';
    document.getElementById('prog-top-count').textContent  = '';
  }
  if (least) {
    document.getElementById('prog-least-label').textContent  = least.label;
    document.getElementById('prog-least-count').textContent  = `${least.count} reconocimiento${least.count !== 1 ? 's' : ''} · ${Math.round((least.count / total) * 100)}%`;
  } else {
    document.getElementById('prog-least-label').textContent  = top ? '(solo una categoría activa)' : '—';
    document.getElementById('prog-least-count').textContent  = '';
  }

  // Bar chart
  if (_analyticsCharts.programs) { _analyticsCharts.programs.destroy(); delete _analyticsCharts.programs; }
  const chartCtx = document.getElementById('chart-programs');
  if (chartCtx && withActivity.length > 0) {
    document.getElementById('chart-programs-empty')?.classList.add('hidden');
    chartCtx.style.display = '';
    const colors = withActivity.map(d =>
      d.isCustom ? 'rgba(241,154,196,0.85)' : 'rgba(61,43,86,0.80)'
    );
    _analyticsCharts.programs = new Chart(chartCtx, {
      type: 'bar',
      data: {
        labels: withActivity.map(d => d.label),
        datasets: [{
          label: 'Reconocimientos',
          data:  withActivity.map(d => d.count),
          backgroundColor: colors,
          borderRadius: 8,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = total > 0 ? Math.round((ctx.parsed.x / total) * 100) : 0;
                return ` ${ctx.parsed.x} reconocimientos (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false } }
        }
      }
    });

    // Custom legend
    const legendEl = document.getElementById('prog-legend');
    if (legendEl) {
      const hasCustom = withActivity.some(d => d.isCustom);
      legendEl.classList.toggle('hidden', !hasCustom);
    }
  } else {
    document.getElementById('chart-programs-empty')?.classList.remove('hidden');
    if (chartCtx) chartCtx.style.display = 'none';
  }

  // Unused programs
  const unusedSection = document.getElementById('prog-unused-section');
  const unusedList    = document.getElementById('prog-unused-list');
  const unusedCount   = document.getElementById('prog-unused-count');
  if (unused.length > 0) {
    unusedSection?.classList.remove('hidden');
    if (unusedCount) unusedCount.textContent = unused.length;
    if (unusedList) {
      unusedList.innerHTML = unused.map(u =>
        `<span class="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
          ${esc(u.emoji)} ${esc(u.name)}${u.isCustom ? ' <span class="text-[10px] text-[#e87cb4]">personalizado</span>' : ''}
        </span>`
      ).join('');
    }
  } else {
    unusedSection?.classList.add('hidden');
  }

  lucide.createIcons();
}

async function renderTeamInteractionSection() {
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('interact-from', 'interact-to');

  const result = await window.analyticsSdk.teamInteraction(companyId, fromISO, toISO);
  if (!result.isOk) return;
  _analyticsCache.interaction = result.data;
  const { depts, matrix, maxVal, teamStats, isolated } = result.data;
  const shortLabel = d => String(d).length > 10 ? String(d).substring(0, 9) + '⬦' : String(d);

  // ���� Matriz ��������������������������������������������������������������������������������������������������������������������������������
  const wrap = document.getElementById('team-matrix-wrap');
  if (!wrap) return;

  if (depts.length === 0) {
    wrap.innerHTML = '<p class="text-sm text-gray-400 text-center py-6">Sin datos de equipos en el período.</p>';
  } else {
    const cellSize = 'min-width:2.8rem;height:2.8rem;';

    const headerCells = depts.map(d =>
      `<th class="text-center px-1 pb-2" style="min-width:2.8rem">
        <span class="text-[10px] font-semibold text-gray-500 writing-mode-vertical" title="${esc(d)}">${esc(shortLabel(d))}</span>
      </th>`
    ).join('');

    const rows = depts.map(fromDept => {
      const cells = depts.map(toDept => {
        const val  = matrix[fromDept][toDept] || 0;
        const same = fromDept === toDept;
        let bg, textColor;
        if (same) {
          bg        = 'repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 2px,#e5e7eb 2px,#e5e7eb 4px)';
          textColor = '#9ca3af';
        } else if (val === 0) {
          bg        = '#f9fafb';
          textColor = '#d1d5db';
        } else {
          const intensity = Math.max(0.10, (val / maxVal) * 0.90);
          bg        = `rgba(61,43,86,${intensity.toFixed(2)})`;
          textColor = intensity > 0.45 ? '#ffffff' : '#3d2b56';
        }
        const display = same ? '' : (val > 0 ? val : '');
        return `<td class="text-center text-xs font-bold rounded-sm" style="${cellSize}background:${bg};color:${textColor}" title="${esc(fromDept)} → ${esc(toDept)}: ${val}">${display}</td>`;
      }).join('');

      return `<tr>
        <td class="pr-2 text-right shrink-0" style="min-width:7rem">
          <span class="text-[10px] font-semibold text-gray-600 truncate block max-w-[7rem]" title="${esc(fromDept)}">${esc(shortLabel(fromDept))}</span>
        </td>
        ${cells}
      </tr>`;
    }).join('');

    wrap.innerHTML = `
      <table class="border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th style="min-width:7rem"></th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ���� Resumen por equipo ��������������������������������������������������������������������������������������������������������
  const statsList = document.getElementById('team-stats-list');
  if (statsList) {
    const maxTotal = Math.max(...teamStats.map(t => t.total), 1);
    statsList.innerHTML = teamStats.length === 0
      ? '<p class="text-xs text-gray-400 text-center py-4">Sin datos.</p>'
      : teamStats.map(t => {
          const isLow = t.total < 2 && depts.length > 1;
          const barW  = Math.round((t.total / maxTotal) * 100);
          return `<div class="flex items-center gap-3 p-3 rounded-xl ${isLow ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}">
            <div class="w-28 shrink-0">
              <p class="text-xs font-semibold text-gray-700 truncate" title="${esc(t.dept)}">${esc(shortLabel(t.dept))}</p>
              <p class="text-[10px] text-gray-400 mt-0.5">
                <span class="text-[#3d2b56] font-semibold">${t.sent}</span> enviados ·
                <span class="text-[#e87cb4] font-semibold">${t.received}</span> recibidos
              </p>
            </div>
            <div class="flex-1">
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div class="bg-[#c9a7d4] h-1.5 rounded-full transition-all" style="width:${barW}%"></div>
              </div>
              <p class="text-[10px] text-gray-400 mt-0.5">${t.total} interacciones cross-equipo</p>
            </div>
            ${isLow ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Baja</span>' : ''}
          </div>`;
        }).join('');
  }

  // ���� Equipos aislados ������������������������������������������������������������������������������������������������������������
  const isolatedCount = document.getElementById('team-isolated-count');
  const isolatedList  = document.getElementById('team-isolated-list');
  const isolatedEmpty = document.getElementById('team-isolated-empty');
  if (isolatedCount) isolatedCount.textContent = isolated.length;

  if (isolated.length === 0) {
    if (isolatedList)  isolatedList.innerHTML = '';
    isolatedEmpty?.classList.remove('hidden');
  } else {
    isolatedEmpty?.classList.add('hidden');
    if (isolatedList) {
      isolatedList.innerHTML = isolated.map(dept => {
        const members = (window.allUsers || (typeof allUsers !== 'undefined' ? allUsers : []))
          .filter(u => (u.department || 'Sin área') === dept && u.role !== 'superadmin').length;
        return `<div class="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <div class="w-9 h-9 rounded-full bg-[#c9a7d4] flex items-center justify-center shrink-0">
            <i data-lucide="users" class="w-4 h-4 text-white"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800 truncate">${esc(dept)}</p>
            <p class="text-xs text-gray-500">${members} persona${members !== 1 ? 's' : ''} · Sin reconocimientos hacia otros equipos en el período</p>
          </div>
          <span class="text-[10px] font-bold text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200 shrink-0">Aislado</span>
        </div>`;
      }).join('');
    }
  }

  lucide.createIcons();
}

async function renderSummarySection() {
  ['analytics-total-recognitions','analytics-total-points','analytics-active-senders','analytics-this-month']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '⬦'; });
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('summary-from', 'summary-to');
  const res = await window.analyticsSdk.summary(companyId, fromISO, toISO);
  if (res.isOk && res.data) {
    _analyticsCache.summary = res.data;
    const s = res.data;
    document.getElementById('analytics-total-recognitions').textContent = (s.total_recognitions || 0).toLocaleString('es-AR');
    document.getElementById('analytics-total-points').textContent       = (s.total_points       || 0).toLocaleString('es-AR');
    document.getElementById('analytics-active-senders').textContent     = (s.active_senders     || 0).toLocaleString('es-AR');
    document.getElementById('analytics-this-month').textContent         = (s.this_month         || 0).toLocaleString('es-AR');
  }
}

async function renderTopSection() {
  _analyticsCharts.top?.destroy(); delete _analyticsCharts.top;
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('top-from', 'top-to');
  const res = await window.analyticsSdk.topRecognized(companyId, 8, fromISO, toISO);
  const VIOLET_SHADES = n => Array.from({length: n}, (_, i) => `hsla(${265 - i * 12}, 70%, ${62 + i * 3}%, 0.85)`);
  const topCtx = document.getElementById('chart-top-recognized');
  _analyticsCache.top = res.isOk ? res.data : [];
  if (topCtx && res.isOk && res.data.length > 0) {
    _analyticsCharts.top = new Chart(topCtx, {
      type: 'bar',
      data: {
        labels: res.data.map(d => d.name),
        datasets: [{ label: 'Puntos recibidos', data: res.data.map(d => Number(d.total_points)),
          backgroundColor: VIOLET_SHADES(res.data.length), borderRadius: 8 }]
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
}

async function renderDeptSection() {
  _analyticsCharts.dept?.destroy(); delete _analyticsCharts.dept;
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('dept-from', 'dept-to');
  const res = await window.analyticsSdk.byDepartment(companyId, fromISO, toISO);
  const PALETTE = ['#7c3aed','#ec4899','#a855f7','#f472b6','#8b5cf6','#db2777','#6d28d9','#be185d'];
  _analyticsCache.dept = res.isOk ? res.data : [];
  const deptCtx = document.getElementById('chart-by-department');
  if (deptCtx && res.isOk && res.data.length > 0) {
    _analyticsCharts.dept = new Chart(deptCtx, {
      type: 'doughnut',
      data: {
        labels: res.data.map(d => d.department),
        datasets: [{ data: res.data.map(d => Number(d.recognition_count)),
          backgroundColor: PALETTE.slice(0, res.data.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } } } }
    });
    document.getElementById('chart-by-department-empty')?.classList.add('hidden');
  } else {
    document.getElementById('chart-by-department-empty')?.classList.remove('hidden');
  }
}

function _userCard(u, showPoints = false) {
  const initials = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const sub = showPoints
    ? `${u.received} recibidos · ${u.pointsReceived} puntos`
    : `${u.received} recibidos · ${u.sent} enviados`;
  return `<div class="flex items-center gap-2">
    <div class="w-7 h-7 rounded-full ${getAvatarColor(u.name || '')} flex items-center justify-center text-white text-[10px] font-bold shrink-0">${esc(initials)}</div>
    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold text-gray-800 truncate">${esc(u.name || u.email)}</p>
      <p class="text-[10px] text-gray-400 truncate">${esc(u.dept)} · ${sub}</p>
    </div>
  </div>`;
}

async function renderUserActivitySection() {
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('user-from', 'user-to');

  const result = await window.analyticsSdk.byUser(companyId, fromISO, toISO);
  if (!result.isOk) return;
  const { mostRecognized, leastRecognized, inactive, topChart } = result.data;
  _analyticsCache.userActivity = result.data;

  // Chart
  if (_analyticsCharts.userActivity) { _analyticsCharts.userActivity.destroy(); delete _analyticsCharts.userActivity; }
  const chartCtx = document.getElementById('chart-user-activity');
  if (chartCtx && topChart.some(u => u.received > 0 || u.sent > 0)) {
    document.getElementById('chart-user-activity-empty')?.classList.add('hidden');
    chartCtx.style.display = '';
    const active = topChart.filter(u => u.received > 0 || u.sent > 0);
    _analyticsCharts.userActivity = new Chart(chartCtx, {
      type: 'bar',
      data: {
        labels: active.map(u => u.name.split(' ')[0] + (u.name.split(' ')[1] ? ' ' + u.name.split(' ')[1][0] + '.' : '')),
        datasets: [
          { label: 'Recibidos', data: active.map(u => u.received),
            backgroundColor: 'rgba(241,154,196,0.85)', borderRadius: 4 },
          { label: 'Enviados',  data: active.map(u => u.sent),
            backgroundColor: 'rgba(61,43,86,0.80)',    borderRadius: 4 },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { precision: 0 } }
        }
      }
    });
  } else {
    document.getElementById('chart-user-activity-empty')?.classList.remove('hidden');
    if (chartCtx) chartCtx.style.display = 'none';
  }

  // Más reconocidos
  const mostEl = document.getElementById('user-most-list');
  if (mostEl) {
    mostEl.innerHTML = mostRecognized.length
      ? mostRecognized.map(u => _userCard(u, true)).join('')
      : '<p class="text-xs text-gray-400">Sin datos.</p>';
  }

  // Menos reconocidos
  const leastEl = document.getElementById('user-least-list');
  if (leastEl) {
    leastEl.innerHTML = leastRecognized.length
      ? leastRecognized.map(u => _userCard(u)).join('')
      : '<p class="text-xs text-gray-400">Sin datos.</p>';
  }

  // Sin actividad
  const inactiveEl    = document.getElementById('user-inactive-list');
  const inactiveEmpty = document.getElementById('user-inactive-empty');
  const inactiveCount = document.getElementById('user-inactive-count');
  if (inactiveCount) inactiveCount.textContent = inactive.length;
  if (inactive.length === 0) {
    if (inactiveEl) inactiveEl.innerHTML = '';
    inactiveEmpty?.classList.remove('hidden');
  } else {
    inactiveEmpty?.classList.add('hidden');
    if (inactiveEl) {
      inactiveEl.innerHTML = inactive.slice(0, 8).map(u => {
        const initials = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        return `<div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-gray-300 flex items-center justify-center text-white text-[10px] font-bold shrink-0">${esc(initials)}</div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-gray-700 truncate">${esc(u.name || u.email)}</p>
            <p class="text-[10px] text-gray-400 truncate">${esc(u.dept)}</p>
          </div>
        </div>`;
      }).join('');
      if (inactive.length > 8) {
        inactiveEl.innerHTML += `<p class="text-[10px] text-gray-400 text-center pt-1">y ${inactive.length - 8} más⬦</p>`;
      }
    }
  }

  lucide.createIcons();
}

function downloadUserActivityCSV() {
  _closeMenus();
  const d = _analyticsCache.userActivity;
  if (!d) { showErrorToast('Sin datos para exportar'); return; }
  _downloadCSV(`allay_actividad_usuarios_${_csvPeriod('user-from','user-to')}.csv`,
    ['nombre', 'email', 'departamento', 'reconocimientos_recibidos', 'reconocimientos_enviados', 'puntos_recibidos'],
    d.all.map(u => [u.name, u.email, u.dept, u.received, u.sent, u.pointsReceived])
  );
}

// ���� Patrones de participación ������������������������������������������������������������������������������������������������
function _generatePatternInsights({ byDOW, byHour, weeklyEvolution, adminPct, total }) {
  if (total === 0) return [];
  const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const maxDOW  = Math.max(...byDOW);
  const peakDay = byDOW.indexOf(maxDOW);
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const slot = peakHour < 6 ? 'de madrugada' : peakHour < 12 ? 'a la mañana' : peakHour < 18 ? 'a la tarde' : 'a la noche';

  const n       = weeklyEvolution.length;
  const third   = Math.max(1, Math.floor(n / 3));
  const recent  = n >= 3 ? weeklyEvolution.slice(-third).reduce((s,w)=>s+w.count,0)/third : 0;
  const early   = n >= 3 ? weeklyEvolution.slice(0, third).reduce((s,w)=>s+w.count,0)/third : 0;
  const trendUp = early > 0 && recent > early * 1.15;
  const trendDn = early > 0 && recent < early * 0.85;

  const COLORS = {
    violet: 'bg-violet-50 border-violet-100 text-[#3d2b56]',
    lila:   'bg-[#f5f0fa] border-[#c9a7d4]/40 text-[#7c3aed]',
    green:  'bg-green-50 border-green-100 text-green-700',
    amber:  'bg-amber-50 border-amber-100 text-amber-700',
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
  };
  const iconBg = { violet:'bg-[#3d2b56]', lila:'bg-[#c9a7d4]', green:'bg-green-600', amber:'bg-amber-500', blue:'bg-blue-500' };

  const card = (color, icon, title, text) =>
    `<div class="flex items-start gap-3 p-4 rounded-xl border ${COLORS[color]}">
      <div class="w-8 h-8 rounded-lg ${iconBg[color]} flex items-center justify-center shrink-0">
        <i data-lucide="${icon}" class="w-4 h-4 text-white"></i>
      </div>
      <div>
        <p class="text-sm font-semibold text-gray-800 mb-0.5">${title}</p>
        <p class="text-xs text-gray-600 leading-relaxed">${text}</p>
      </div>
    </div>`;

  return [
    card('violet', 'calendar', 'Día más activo',
      `<strong>${DAYS[peakDay]}</strong> concentra la mayor actividad de reconocimiento. Es el mejor momento para reforzar mensajes de cultura y visibilizar logros.`),
    card('lila', 'clock', 'Horario pico',
      `Los reconocimientos se envían principalmente <strong>${slot}</strong>, alrededor de las ${String(peakHour).padStart(2,'0')}:00. El equipo celebra en plena jornada laboral.`),
    card(trendUp ? 'green' : trendDn ? 'amber' : 'blue',
      trendUp ? 'trending-up' : trendDn ? 'trending-down' : 'minus',
      'Tendencia del período',
      trendUp
        ? 'La actividad de reconocimiento <strong>viene creciendo</strong>. El equipo está construyendo un hábito sostenible de valoración mutua.'
        : trendDn
        ? 'La participación <strong>cayó hacia el final del período</strong>. Puede ser un buen momento para lanzar una iniciativa o campaña de reconocimiento.'
        : 'La participación se mantuvo <strong>estable</strong> durante todo el período. El hábito está instalado — el próximo desafío es seguir creciendo.'),
    card('blue', 'user-check', 'Líderes y cultura',
      adminPct >= 30
        ? `El <strong>${adminPct}%</strong> de los reconocimientos los inician los líderes. Su participación activa es clave para instalar y escalar la cultura.`
        : adminPct > 0
        ? `El <strong>${adminPct}%</strong> de los reconocimientos proviene de líderes. Cuando los managers reconocen más, el equipo los sigue naturalmente.`
        : 'No se registraron reconocimientos de líderes en este período. El reconocimiento entre pares está activo — sumar el ejemplo desde arriba potencia el impacto.'),
  ];
}

async function renderPatternSection() {
  const companyId          = _analyticsCompanyId();
  const { fromISO, toISO } = _monthRangeToISO('pat-from', 'pat-to');

  const result = await window.analyticsSdk.participationPatterns(companyId, fromISO, toISO);
  if (!result.isOk) return;
  const d = result.data;
  _analyticsCache.patterns = d;

  const VIOLET = 'rgba(61,43,86,0.80)';
  const LILA   = 'rgba(201,167,212,0.70)';
  const ROSA   = 'rgba(241,154,196,0.85)';
  const TEAM_COLORS = ['#3d2b56','#f19ac4','#c9a7d4','#7c3aed','#ec4899','#8b5cf6'];

  const destroyPat = key => { if (_analyticsCharts[key]) { _analyticsCharts[key].destroy(); delete _analyticsCharts[key]; } };

  // ���� Day of week ������������������������������������������������������������������������������������������������������������������������
  destroyPat('patDow');
  const ctxDow = document.getElementById('chart-pat-dow');
  if (ctxDow && d.total > 0) {
    document.getElementById('chart-pat-dow-empty')?.classList.add('hidden');
    ctxDow.style.display = '';
    const maxDOW = Math.max(...d.byDOW);
    _analyticsCharts.patDow = new Chart(ctxDow, {
      type: 'bar',
      data: {
        labels: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],
        datasets: [{ data: d.byDOW,
          backgroundColor: d.byDOW.map(v => v === maxDOW ? VIOLET : LILA),
          borderRadius: 6 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color:'#f3f4f6' }, ticks: { precision:0 } }, x: { grid: { display:false } } } }
    });
  } else {
    document.getElementById('chart-pat-dow-empty')?.classList.remove('hidden');
    if (ctxDow) ctxDow.style.display = 'none';
  }

  // ���� Hour ������������������������������������������������������������������������������������������������������������������������������������
  destroyPat('patHour');
  const ctxHour = document.getElementById('chart-pat-hour');
  if (ctxHour && d.total > 0) {
    document.getElementById('chart-pat-hour-empty')?.classList.add('hidden');
    ctxHour.style.display = '';
    const maxH = Math.max(...d.byHour);
    _analyticsCharts.patHour = new Chart(ctxHour, {
      type: 'bar',
      data: {
        labels: d.byHour.map((_, i) => i % 3 === 0 ? `${String(i).padStart(2,'0')}h` : ''),
        datasets: [{ data: d.byHour,
          backgroundColor: d.byHour.map(v => v === maxH && maxH > 0 ? ROSA : 'rgba(241,154,196,0.40)'),
          borderRadius: 3 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color:'#f3f4f6' }, ticks: { precision:0 } }, x: { grid: { display:false }, ticks: { font: { size: 10 } } } } }
    });
  } else {
    document.getElementById('chart-pat-hour-empty')?.classList.remove('hidden');
    if (ctxHour) ctxHour.style.display = 'none';
  }

  // ���� Weekly evolution ������������������������������������������������������������������������������������������������������������
  destroyPat('patWeekly');
  const ctxW = document.getElementById('chart-pat-weekly');
  const spikesSet = new Set(d.spikes.map(s => s.week));
  if (ctxW && d.weeklyEvolution.length >= 2) {
    document.getElementById('chart-pat-weekly-empty')?.classList.add('hidden');
    ctxW.style.display = '';
    _analyticsCharts.patWeekly = new Chart(ctxW, {
      type: 'line',
      data: {
        labels: d.weeklyEvolution.map(w => w.label),
        datasets: [
          { label: 'Reconocimientos', data: d.weeklyEvolution.map(w => w.count),
            borderColor: VIOLET, backgroundColor: 'rgba(61,43,86,0.07)', fill: true,
            tension: 0.4, pointBackgroundColor: d.weeklyEvolution.map(w => spikesSet.has(w.week) ? ROSA : VIOLET),
            pointRadius: d.weeklyEvolution.map(w => spikesSet.has(w.week) ? 6 : 3),
            pointHoverRadius: 6 },
          { label: 'Promedio', data: d.weeklyEvolution.map(() => d.mean),
            borderColor: 'rgba(201,167,212,0.6)', borderDash: [4,4], pointRadius: 0, fill: false }
        ]
      },
      options: { responsive: true,
        plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, grid: { color:'#f3f4f6' }, ticks: { precision:0 } }, x: { grid: { display:false }, ticks: { font: { size: 10 }, maxTicksLimit: 10 } } } }
    });
  } else {
    document.getElementById('chart-pat-weekly-empty')?.classList.remove('hidden');
    if (ctxW) ctxW.style.display = 'none';
  }

  // ���� Team comparison ��������������������������������������������������������������������������������������������������������������
  destroyPat('patTeams');
  const ctxT = document.getElementById('chart-pat-teams');
  if (ctxT && d.teamTotals.length > 0 && d.allMonths.length >= 2) {
    document.getElementById('chart-pat-teams-empty')?.classList.add('hidden');
    ctxT.style.display = '';
    const fmt = ym => { const [y, m] = ym.split('-'); return new Date(+y, +m-1).toLocaleDateString('es-AR', { month:'short', year:'2-digit' }); };
    _analyticsCharts.patTeams = new Chart(ctxT, {
      type: 'line',
      data: {
        labels: d.allMonths.map(fmt),
        datasets: d.teamTotals.map((t, i) => ({
          label: t.dept,
          data: d.allMonths.map(m => t.months[m] || 0),
          borderColor: TEAM_COLORS[i % TEAM_COLORS.length],
          backgroundColor: 'transparent',
          tension: 0.4, pointRadius: 4, fill: false,
        }))
      },
      options: { responsive: true,
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, grid: { color:'#f3f4f6' }, ticks: { precision:0 } }, x: { grid: { display:false } } } }
    });
  } else {
    document.getElementById('chart-pat-teams-empty')?.classList.remove('hidden');
    if (ctxT) ctxT.style.display = 'none';
  }

  // ���� Insights ����������������������������������������������������������������������������������������������������������������������������
  const insightsEl = document.getElementById('pat-insights');
  if (insightsEl) {
    const cards = _generatePatternInsights(d);
    insightsEl.innerHTML = cards.join('');
  }

  // ���� Spikes / campaigns ��������������������������������������������������������������������������������������������������������
  const spikesSection = document.getElementById('pat-spikes-section');
  const spikesList    = document.getElementById('pat-spikes-list');
  const spikesCount   = document.getElementById('pat-spikes-count');
  if (d.spikes.length > 0 && spikesSection) {
    spikesSection.classList.remove('hidden');
    if (spikesCount) spikesCount.textContent = d.spikes.length;
    if (spikesList) {
      spikesList.innerHTML = d.spikes.map(s => {
        const ratio = d.mean > 0 ? (s.count / d.mean).toFixed(1) : '—';
        return `<div class="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
          <div class="w-8 h-8 rounded-lg bg-[#3d2b56] flex items-center justify-center text-white text-xs font-bold shrink-0">⚡</div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-gray-800">${esc(s.label)}</p>
            <p class="text-xs text-gray-500">${s.count} reconocimientos · ${ratio}× el promedio del período</p>
          </div>
        </div>`;
      }).join('');
    }
  } else if (spikesSection) {
    spikesSection.classList.add('hidden');
  }

  lucide.createIcons();
}

function downloadPatternCSV() {
  _closeMenus();
  const d = _analyticsCache.patterns;
  if (!d) { showErrorToast('Sin datos para exportar'); return; }
  const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  _downloadCSV(`allay_patrones_${_csvPeriod('pat-from','pat-to')}.csv`,
    ['dia_semana', 'reconocimientos'],
    d.byDOW.map((c, i) => [DAYS[i], c])
  );
}

async function renderAnalytics() {
  await Promise.all([
    renderSummarySection(),
    renderTopSection(),
    renderDeptSection(),
  ]);
  await refreshEngagementChart();
  _populateEngagementDeptFilter();
  await renderEngagementSection();
  await renderTeamInteractionSection();
  await renderProgramsSection();
  await renderUserActivitySection();
  await renderPatternSection();
  lucide.createIcons();
}

async function refreshEngagementChart() {
  if (_analyticsCharts.month) { _analyticsCharts.month.destroy(); delete _analyticsCharts.month; }

  const companyId = _analyticsCompanyId();
  const fromMonth = document.getElementById('analytics-from-month')?.value || '';
  const toMonth   = document.getElementById('analytics-to-month')?.value   || '';

  const fromDate = fromMonth ? fromMonth + '-01' : null;
  const toDate   = toMonth   ? (() => { const d = new Date(toMonth + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth()+1); d.setUTCDate(0); return d.toISOString().slice(0,10); })() : null;

  const monthRes = await window.analyticsSdk.byRange(companyId, fromDate, toDate);

  const monthCtx = document.getElementById('chart-by-month');
  _analyticsCache.month = monthRes.isOk ? monthRes.data : [];
  if (monthCtx && monthRes.isOk && monthRes.data.length > 0) {
    const fmt = (ym) => {
      const [y, m] = ym.split('-');
      return new Date(y, m - 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
    };
    _analyticsCharts.month = new Chart(monthCtx, {
      type: 'line',
      data: {
        labels: monthRes.data.map(d => fmt(d.month)),
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
    document.getElementById('chart-by-month').style.display = '';
  } else {
    document.getElementById('chart-by-month-empty')?.classList.remove('hidden');
    document.getElementById('chart-by-month').style.display = 'none';
  }
}

// ����������������������������������������������������������������������������������
// GESTIÓN DE PUNTOS
// ����������������������������������������������������������������������������������
function openPointsPage() {
  if (!_isApprover()) { showErrorToast('Solo administradores pueden ver la gestión de puntos'); return; }
  const page = document.getElementById('points-page');
  if (!page) return;
  page.classList.remove('hidden');
  _positionOverlayPage('points-page');
  renderPointsPage();
}

function closePointsPage() {
  ['points-page', 'pts-orders-page'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.style.display = 'none'; }
  });
  if (currentPage === 'points') currentPage = 'home';
}

async function openPtsOrdersPage() {
  const page = document.getElementById('pts-orders-page');
  if (!page) return;
  page.classList.remove('hidden');
  page.style.display = 'flex';
  _positionOverlayPage('pts-orders-page');

  const isSA = currentUser?.role === 'superadmin' && !isImpersonating;
  const title = document.querySelector('#pts-orders-page h2');
  if (title) title.textContent = isSA ? 'Historial de solicitudes' : 'Mis solicitudes de puntos';

  // Show/hide "Nueva solicitud" button — only for admins
  const newBtn = document.querySelector('#pts-orders-page button[onclick="openBuyPointsModal()"]');
  if (newBtn) newBtn.classList.toggle('hidden', isSA);

  lucide.createIcons();

  if (!window.pointsRequestSdk) return;

  if (isSA) {
    if (!_superadminPointsCompanies) {
      const { data } = await window.companySdk.list();
      _superadminPointsCompanies = data || [];
    }
    const { data: reqs } = await window.pointsRequestSdk.getAll();
    _renderSAPointsHistory(reqs);
  } else {
    const companyId = currentUser?.company_id;
    if (!companyId) return;
    const { data: reqs } = await window.pointsRequestSdk.getAllForCompany(companyId);
    _renderAdminPointsRequestsList(reqs);
  }
}

function closePtsOrdersPage() {
  const page = document.getElementById('pts-orders-page');
  if (page) { page.classList.add('hidden'); page.style.display = 'none'; }
}

async function renderPointsPage() {
  const companyId = currentUser?.company_id;
  const isSuperadmin = currentUser?.role === 'superadmin' && !isImpersonating;

  // Company name
  const companyName = isSuperadmin ? 'Todas las empresas' :
    (allUsers.find(u => u.company_id === companyId)?.company_id || companyId || 'Mi empresa');
  document.getElementById('wallet-company-name').textContent = companyId || 'Mi empresa';

  // "Mis solicitudes / Historial" nav button
  const ptsOrdersBtn   = document.getElementById('pts-orders-nav-btn');
  const ptsOrdersLabel = document.getElementById('pts-orders-nav-label');
  if (ptsOrdersBtn) {
    ptsOrdersBtn.classList.replace('hidden', 'flex');
    if (ptsOrdersLabel) ptsOrdersLabel.textContent = isSuperadmin ? 'Historial' : 'Mis solicitudes';
  }

  // Pending requests across companies (superadmin view)
  if (isSuperadmin && window.pointsRequestSdk) {
    const { data: pending } = await window.pointsRequestSdk.getAllPending();
    _renderSuperadminPointsRequests(pending);
  } else {
    document.getElementById('points-superadmin-requests')?.classList.add('hidden');
  }

  // Points available = sum of points_to_give for company employees
  const companyUsers = isSuperadmin
    ? allUsers
    : allUsers.filter(u => u.company_id === companyId && u.role !== 'superadmin');
  const available = companyUsers.reduce((s, u) => s + (u.points_to_give || 0), 0);

  // Points used = from recognitions
  const { data: recs } = await window.recognitionSdk.forCompany(isSuperadmin ? null : companyId, 5000);
  const used = (recs || []).reduce((s, r) => s + (r.points || 0), 0);

  const total = available + used;
  const pct   = total > 0 ? Math.round((used / total) * 100) : 0;

  document.getElementById('wallet-total').textContent     = total.toLocaleString('es-AR');
  document.getElementById('wallet-used').textContent      = used.toLocaleString('es-AR');
  document.getElementById('wallet-available').textContent = available.toLocaleString('es-AR');
  document.getElementById('wallet-pct').textContent       = pct + '%';
  document.getElementById('wallet-bar').style.width       = pct + '%';

  const empCount = companyUsers.filter(u => u.role !== 'superadmin').length;
  const avgUsed  = empCount > 0 ? Math.round(used / empCount) : 0;
  const avgAvail = empCount > 0 ? Math.round(available / empCount) : 0;

  document.getElementById('wallet-employees').textContent = empCount;
  document.getElementById('wallet-avg').textContent       = avgUsed.toLocaleString('es-AR') + ' puntos';
  document.getElementById('wallet-per-emp').textContent   = avgAvail.toLocaleString('es-AR') + ' puntos';

  // Employee distribution table
  const list = document.getElementById('wallet-employee-list');
  const sorted = [...companyUsers]
    .filter(u => u.role !== 'superadmin')
    .sort((a, b) => (b.points_to_give || 0) - (a.points_to_give || 0));

  if (!sorted.length) {
    list.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No hay empleados en esta empresa.</p>';
    return;
  }

  const maxPts = sorted[0]?.points_to_give || 1;
  list.innerHTML = sorted.map(u => {
    const pts     = u.points_to_give || 0;
    const barPct  = Math.round((pts / maxPts) * 100);
    const initials = (u.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const color    = _avatarColorFor(u.name || '');
    return `
    <div class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition">
      <div class="w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0">${initials}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 truncate">${u.name || u.email}</p>
        <div class="flex items-center gap-2 mt-1">
          <div class="flex-1 bg-gray-100 rounded-full h-1.5">
            <div class="bg-[#3d2b56] h-1.5 rounded-full" style="width:${barPct}%"></div>
          </div>
        </div>
      </div>
      <span class="text-sm font-bold text-violet-700 shrink-0">${pts.toLocaleString('es-AR')} puntos</span>
    </div>`;
  }).join('');

  // Programs budget section
  _renderPointsPrograms();

  // Movements section
  _renderPointsMovements(recs || []);
}

function _renderPointsPrograms() {
  const section = document.getElementById('wallet-programs-section');
  const listEl  = document.getElementById('wallet-programs-list');
  if (!section || !listEl) return;

  const isSuperadmin = currentUser?.role === 'superadmin' && !isImpersonating;
  const myCompanyId  = currentUser?.company_id;
  const programs = (window.companyPrograms || []).filter(p =>
    p.custom && p.active && !p.pending && (p.budget || 0) > 0 &&
    (isSuperadmin || !p.company_id || p.company_id === myCompanyId)
  );

  if (!programs.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  const maxBudget = Math.max(...programs.map(p => p.budget || 0), 1);

  listEl.innerHTML = programs.map(p => {
    const total     = p.budget || 0;
    const remaining = p.budget_remaining !== null && p.budget_remaining !== undefined
      ? p.budget_remaining : total;
    const used      = Math.max(0, total - remaining);
    const pct       = total > 0 ? Math.round((used / total) * 100) : 0;
    const barPct    = Math.round((total / maxBudget) * 100);

    return `
    <div class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition">
      <div class="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-lg shrink-0">${p.emoji || '⭐'}</div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 truncate">${p.name}</p>
        <div class="flex items-center gap-2 mt-1">
          <div class="flex-1 bg-gray-100 rounded-full h-1.5">
            <div class="bg-violet-400 h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
          </div>
          <span class="text-[10px] text-gray-400 shrink-0">${pct}% usado</span>
        </div>
      </div>
      <div class="text-right shrink-0">
        <p class="text-sm font-bold text-violet-700">${remaining.toLocaleString('es-AR')} puntos</p>
        <p class="text-[10px] text-gray-400">de ${total.toLocaleString('es-AR')} totales</p>
      </div>
    </div>`;
  }).join('');
}

function _renderPointsMovements(recs) {
  const section = document.getElementById('wallet-movements-section');
  const listEl  = document.getElementById('wallet-movements-list');
  if (!section || !listEl) return;

  const recent = recs.slice(0, 20);

  if (!recent.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');

  listEl.innerHTML = recent.map(r => {
    const fromName = r.from_user?.name || '—';
    const toName   = r.to_user?.name   || '—';
    const pts      = r.points || 0;
    const prog     = r.program || '';
    const date     = r.created_at
      ? new Date(r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '';
    const fromInitials = fromName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    const color        = _avatarColorFor(fromName);

    return `
    <div class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition">
      <div class="w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0">${fromInitials}</div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-gray-800">
          ${r.from_user?.id
            ? `<button onclick="openPeekById('${r.from_user.id}')" class="font-semibold hover:text-violet-600 transition">${fromName}</button>`
            : `<span class="font-semibold">${fromName}</span>`}
          <span class="text-gray-400 mx-1">→</span>
          ${r.to_user?.id
            ? `<button onclick="openPeekById('${r.to_user.id}')" class="font-semibold hover:text-violet-600 transition">${toName}</button>`
            : `<span class="font-semibold">${toName}</span>`}
        </p>
        <p class="text-[10px] text-gray-400 mt-0.5 truncate">${prog}</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-xs font-bold text-violet-700">-${pts.toLocaleString('es-AR')} puntos</p>
        <p class="text-[10px] text-gray-400">${date}</p>
      </div>
    </div>`;
  }).join('');
}

function _avatarColorFor(name) {
  const colors = ['bg-[#3d2b56]', 'bg-[#f19ac4]', 'bg-[#c9a7d4]'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

// ���� Buy points modal ��������������������������������������������
let _selectedPkg = 0;

function openBuyPointsModal() {
  _selectedPkg = 0;
  document.getElementById('buy-points-input').value = '';
  document.getElementById('buy-points-message').value = '';
  document.getElementById('buy-points-summary').classList.add('hidden');
  document.getElementById('buy-points-btn').disabled = true;
  document.querySelectorAll('.points-pkg').forEach(b => b.classList.remove('border-violet-500', 'bg-violet-50'));
  document.getElementById('buy-points-modal').classList.remove('hidden');
  lucide.createIcons();
}

function closeBuyPointsModal() {
  document.getElementById('buy-points-modal').classList.add('hidden');
}

function selectPointsPackage(pts) {
  _selectedPkg = pts;
  document.getElementById('buy-points-input').value = '';
  document.querySelectorAll('.points-pkg').forEach(b => {
    const selected = parseInt(b.dataset.pts) === pts;
    b.classList.toggle('border-violet-500', selected);
    b.classList.toggle('bg-violet-50', selected);
  });
  _updateBuyPointsSummary(pts);
}

function onBuyPointsInput() {
  _selectedPkg = 0;
  document.querySelectorAll('.points-pkg').forEach(b => b.classList.remove('border-violet-500', 'bg-violet-50'));
  const val = document.getElementById('buy-points-input').valueAsNumber || 0;
  _updateBuyPointsSummary(val);
}

function _updateBuyPointsSummary(pts) {
  const valid = pts >= 1000;
  document.getElementById('buy-points-summary').classList.toggle('hidden', !valid);
  document.getElementById('buy-pts-qty').textContent = pts.toLocaleString('es-AR') + ' puntos';
  document.getElementById('buy-points-btn').disabled = !valid;
}

async function submitBuyPoints() {
  const pts = _selectedPkg || (document.getElementById('buy-points-input').valueAsNumber || 0);
  if (pts < 1000) return;
  closeBuyPointsModal();

  let ok = false;
  try {
    const { data: { session } } = await _sb.auth.getSession();
    const token = session?.access_token || SUPABASE_ANON_KEY;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-points-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        points: pts,
        message: document.getElementById('buy-points-message').value.trim() || null,
        ...(isImpersonating && currentUser?.__backendId
          ? { impersonated_user_id: currentUser.__backendId }
          : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[submitBuyPoints] error:', res.status, body);
      showErrorToast('No se pudo enviar la solicitud. Intentá de nuevo o contactá a Allay.');
      return;
    }
    ok = true;
  } catch (e) {
    console.error('[submitBuyPoints] fetch error:', e);
    showErrorToast('Error de conexión al enviar la solicitud.');
    return;
  }

  if (ok) {
    showSuccessToast(`Solicitud de ${pts.toLocaleString('es-AR')} puntos enviada. El equipo de Allay te contactará pronto.`);
    renderPointsPage();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Points purchase requests — panel (admin) & queue (superadmin)
// ──────────────────────────────────────────────────────────────────────────────
const _PTS_REQ_STATUS = {
  pending:        { label: 'Solicitado',      chipCls: 'bg-amber-100 text-amber-700',   icon: 'clock',        step: 0 },
  en_facturacion: { label: 'En facturación',  chipCls: 'bg-blue-100 text-blue-700',     icon: 'file-text',    step: 1 },
  facturado:      { label: 'Facturado',       chipCls: 'bg-violet-100 text-violet-700', icon: 'receipt',      step: 2 },
  acreditado:     { label: 'Acreditado',      chipCls: 'bg-green-100 text-green-700',   icon: 'check-circle', step: 3 },
  approved:       { label: 'Acreditado',      chipCls: 'bg-green-100 text-green-700',   icon: 'check-circle', step: 3 },
  rechazado:      { label: 'Rechazado',       chipCls: 'bg-red-100 text-red-700',       icon: 'x-circle',     step: -1 },
  rejected:       { label: 'Rechazado',       chipCls: 'bg-red-100 text-red-700',       icon: 'x-circle',     step: -1 },
};

const _PTS_REQ_STEPS = ['pending', 'en_facturacion', 'facturado', 'acreditado'];
const _PTS_REQ_STEP_LABELS = ['Solicitado', 'En facturación', 'Facturado', 'Acreditado'];

function _renderAdminPointsRequestsList(requests) {
  const list  = document.getElementById('pts-orders-list');
  const empty = document.getElementById('pts-orders-empty');
  if (!list) return;

  if (!requests || requests.length === 0) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    lucide.createIcons();
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = requests.map(req => {
    const st = _PTS_REQ_STATUS[req.status] || _PTS_REQ_STATUS.pending;
    const date = new Date(req.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    const isRejected = st.step === -1;

    let tracker = '';
    if (!isRejected) {
      const stepIdx = st.step;
      const nodes = _PTS_REQ_STEPS.map((_, i) => {
        const done    = i < stepIdx;
        const current = i === stepIdx;
        const nodeC   = done || current ? 'bg-violet-500 border-violet-500' : 'bg-white border-gray-300';
        const textC   = done || current ? 'text-violet-600 font-semibold' : 'text-gray-400';
        const inner   = done    ? '<i data-lucide="check" class="w-2.5 h-2.5 text-white"></i>'
                      : current ? '<div class="w-1.5 h-1.5 bg-white rounded-full"></div>'
                      : '';
        const line    = i < _PTS_REQ_STEPS.length - 1
          ? `<div class="flex-1 h-0.5 mb-3.5 ${i < stepIdx ? 'bg-violet-400' : 'bg-gray-200'}"></div>`
          : '';
        return `
          <div class="flex flex-col items-center">
            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center ${nodeC}">${inner}</div>
            <span class="text-[9px] mt-1 text-center leading-tight ${textC} w-14">${_PTS_REQ_STEP_LABELS[i]}</span>
          </div>${line}`;
      }).join('');
      tracker = `<div class="flex items-center mt-3 px-1">${nodes}</div>`;
    }

    const rejectionBadge = isRejected && req.rejection_reason
      ? `<div class="mt-3 flex gap-2 items-start bg-red-50 rounded-xl px-3 py-2">
           <i data-lucide="message-circle-x" class="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5"></i>
           <p class="text-xs text-red-600 leading-relaxed">${esc(req.rejection_reason)}</p>
         </div>`
      : '';

    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-base font-bold text-gray-800">${req.points.toLocaleString('es-AR')} puntos</p>
          <p class="text-xs text-gray-400 mt-0.5">${date}</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${st.chipCls}">${st.label}</span>
      </div>
      ${tracker}
      ${rejectionBadge}
    </div>`;
  }).join('');

  lucide.createIcons();
}

function _renderSAPointsHistory(requests) {
  const list  = document.getElementById('pts-orders-list');
  const empty = document.getElementById('pts-orders-empty');
  if (!list) return;

  if (!requests || requests.length === 0) {
    list.innerHTML = '';
    empty?.classList.remove('hidden');
    lucide.createIcons();
    return;
  }
  empty?.classList.add('hidden');

  list.innerHTML = requests.map(req => {
    const st      = _PTS_REQ_STATUS[req.status] || _PTS_REQ_STATUS.pending;
    const company = (_superadminPointsCompanies || []).find(c => c.id === req.company_id);
    const user    = allUsers.find(u => u.__backendId === req.requested_by);
    const date    = new Date(req.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    const procDate = req.processed_at
      ? new Date(req.processed_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
      : null;

    const saRejection = (req.status === 'rechazado' || req.status === 'rejected') && req.rejection_reason
      ? `<div class="mt-2 flex gap-2 items-start bg-red-50 rounded-xl px-3 py-2">
           <i data-lucide="message-circle-x" class="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5"></i>
           <p class="text-xs text-red-600 leading-relaxed">${esc(req.rejection_reason)}</p>
         </div>`
      : '';

    return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-base font-bold text-gray-800">${req.points.toLocaleString('es-AR')} puntos</p>
          <p class="text-sm font-medium text-gray-600 truncate mt-0.5">${esc(company?.name || req.company_id)}</p>
          <p class="text-xs text-gray-400 mt-0.5">${esc(user?.name || 'Admin')} · ${date}${procDate ? ` · procesado ${procDate}` : ''}</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${st.chipCls}">${st.label}</span>
      </div>
      ${saRejection}
    </div>`;
  }).join('');

  lucide.createIcons();
}

let _superadminPointsCompanies = null;

const _PTS_REQ_SA_OPTIONS = [
  { value: 'en_facturacion', label: 'En facturación' },
  { value: 'facturado',      label: 'Facturado' },
  { value: 'acreditado',     label: 'Acreditado' },
  { value: 'rechazado',      label: 'Rechazado' },
];

async function _renderSuperadminPointsRequests(pending) {
  const wrap = document.getElementById('points-superadmin-requests');
  const list = document.getElementById('points-superadmin-requests-list');
  if (!wrap || !list) return;

  if (!pending || pending.length === 0) {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  wrap.classList.remove('hidden');

  if (!_superadminPointsCompanies) {
    const { data } = await window.companySdk.list();
    _superadminPointsCompanies = data || [];
  }

  _log('[pts-requests] first row sample:', JSON.stringify(pending[0]));

  list.innerHTML = pending.map(req => {
    const company   = _superadminPointsCompanies.find(c => c.id === req.company_id);
    const requester = allUsers.find(u => u.__backendId === req.requested_by);
    const st        = _PTS_REQ_STATUS[req.status] || _PTS_REQ_STATUS.pending;
    const opts      = _PTS_REQ_SA_OPTIONS
      .filter(o => o.value !== req.status)
      .map(o => `<option value="${o.value}">${o.label}</option>`)
      .join('');
    return `
    <div class="flex items-center gap-3 px-5 py-3 flex-wrap">
      <div class="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
        <i data-lucide="coins" class="w-4 h-4 text-violet-500"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-800 truncate">${esc(company?.name || req.company_id)}</p>
        <p class="text-xs text-gray-400 truncate">${esc(requester?.name || 'Admin')} · ${formatTimeAgo(req.created_at)}</p>
      </div>
      <span class="text-sm font-bold text-violet-700 shrink-0">${req.points.toLocaleString('es-AR')} pts</span>
      <span class="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${st.chipCls}">${st.label}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-xs text-gray-400">Cambiar a</span>
        <select
          data-req-id="${req.id}"
          data-requested-by="${req.requested_by || ''}"
          onchange="_onPtsStatusChangeByEl(this, this.value)"
          class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer">
          <option value="">— Estado —</option>
          ${opts}
        </select>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function _onPtsStatusChangeByEl(selectEl, status) {
  selectEl.value = '';
  if (!status) return;
  const id          = selectEl.getAttribute('data-req-id');
  const requestedBy = selectEl.getAttribute('data-requested-by') || null;
  if (!id || id === 'null' || id === 'undefined') { showErrorToast('No se pudo identificar la solicitud'); return; }
  _onPtsStatusChange(id, status, requestedBy, selectEl);
}

let _rejectPtsRequestId   = null;
let _rejectPtsRequestedBy = null;

function _onPtsStatusChange(id, status, requestedBy, selectEl) {
  if (!status) return;
  selectEl.value = '';
  if (status === 'rechazado') {
    _openRejectPtsModal(id, requestedBy);
  } else {
    updatePointsRequestStatus(id, status, requestedBy);
  }
}

function _openRejectPtsModal(id, requestedBy) {
  _rejectPtsRequestId   = id;
  _rejectPtsRequestedBy = requestedBy;
  const modal = document.getElementById('reject-pts-modal');
  const textarea = document.getElementById('reject-pts-reason');
  const btn = document.getElementById('reject-pts-confirm-btn');
  if (!modal) return;
  textarea.value = '';
  btn.disabled = true;
  modal.classList.remove('hidden');
  lucide.createIcons();
  setTimeout(() => textarea.focus(), 50);
}

function closeRejectPtsModal() {
  document.getElementById('reject-pts-modal')?.classList.add('hidden');
  _rejectPtsRequestId   = null;
  _rejectPtsRequestedBy = null;
}

async function confirmRejectPtsRequest() {
  const reason = document.getElementById('reject-pts-reason').value.trim();
  if (!reason || !_rejectPtsRequestId) return;
  const id          = _rejectPtsRequestId;
  const requestedBy = _rejectPtsRequestedBy;
  closeRejectPtsModal();
  await updatePointsRequestStatus(id, 'rechazado', requestedBy, reason);
}

async function approvePointsPurchaseRequest(id) {
  await updatePointsRequestStatus(id, 'acreditado');
}

async function rejectPointsPurchaseRequest(id) {
  _openRejectPtsModal(id, null);
}

async function updatePointsRequestStatus(id, status, requestedBy, rejectionReason) {
  _log('[updatePtsStatus] id:', id, 'status:', status);
  if (!status) return;
  if (!id || typeof id !== 'string') { showErrorToast('No se pudo identificar la solicitud'); return; }
  const processedBy = currentUser?.__backendId || null;

  // Fetch BEFORE updating so we know the previous status (to avoid double-crediting)
  const { data: ptsRow } = await _sb
    .from('points_purchase_requests')
    .select('requested_by, points, status')
    .eq('id', id)
    .maybeSingle();

  const { isOk, errorMsg } = await window.pointsRequestSdk.updateStatus(id, status, processedBy, rejectionReason || null);
  if (!isOk) { showErrorToast('No se pudo actualizar la solicitud: ' + (errorMsg || 'error desconocido')); return; }

  // Credit points to the admin's wallet when transitioning to acreditado for the first time
  const isApproval      = status === 'acreditado' || status === 'approved';
  const wasAlreadyApproved = ptsRow?.status === 'acreditado' || ptsRow?.status === 'approved';
  if (isApproval && !wasAlreadyApproved && ptsRow?.requested_by && ptsRow?.points) {
    const { isOk: credited } = await window.dataSdk.refundPoints(ptsRow.requested_by, ptsRow.points);
    if (!credited) _log('[updatePtsStatus] Error al acreditar puntos para solicitud', id);
  }

  const st = _PTS_REQ_STATUS[status] || _PTS_REQ_STATUS.pending;

  const targetUserId = requestedBy || ptsRow?.requested_by;
  if (targetUserId) {
    const notifType = (status === 'acreditado' || status === 'approved') ? 'points_purchase_approved'
                    : (status === 'rechazado'  || status === 'rejected')  ? 'points_purchase_rejected'
                    : 'points_purchase_status_update';
    await window.notificationSdk.send([{
      user_id: targetUserId,
      type:    notifType,
      data:    { points: ptsRow?.points, status, status_label: st.label, rejection_reason: rejectionReason || null },
    }]);
  }

  showSuccessToast(`Solicitud marcada como: ${st.label}`);
  renderPointsPage();
}

// ����������������������������������������������������������������������������������
// INIT
// ����������������������������������������������������������������������������������
lucide.createIcons();
