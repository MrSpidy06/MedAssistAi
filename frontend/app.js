const STORE = 'medassist-ai-demo-v1';
const SESSION = 'medassist-ai-session-v1';
const API_BASE = 'http://127.0.0.1:8000';
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const todayISO = () => new Date().toISOString().slice(0, 10);
const shortDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
const relative = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const initials = name => String(name || 'MA').split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
const plusDays = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

function seedData() {
  return {
    profile: { name: 'Ananya Nair', email: 'patient@medassist.demo', age: 29, bloodType: 'O+', phone: '+91 98765 43210', city: 'Kochi', conditions: ['Seasonal allergies', 'Migraine'], allergies: ['Pollen'], emergencyContact: 'Meera Nair · +91 98765 43211' },
    vitals: [
      { date: plusDays(-6), systolic: 119, diastolic: 78, glucose: 96, note: '' }, { date: plusDays(-5), systolic: 121, diastolic: 79, glucose: 101, note: '' },
      { date: plusDays(-4), systolic: 118, diastolic: 77, glucose: 98, note: '' }, { date: plusDays(-3), systolic: 120, diastolic: 80, glucose: 105, note: '' },
      { date: plusDays(-2), systolic: 117, diastolic: 76, glucose: 99, note: '' }, { date: plusDays(-1), systolic: 122, diastolic: 80, glucose: 103, note: '' },
      { date: todayISO(), systolic: 120, diastolic: 78, glucose: 100, note: 'Demo reading' }
    ],
    records: [
      { id: crypto.randomUUID(), title: 'Complete blood count', category: 'Lab report', date: plusDays(-14), status: 'On file', source: 'Sample record' },
      { id: crypto.randomUUID(), title: 'Eye screening image', category: 'Eye screening', date: plusDays(-29), status: 'Review needed', source: 'Sample record' },
      { id: crypto.randomUUID(), title: 'Visit summary', category: 'Consultation', date: plusDays(-42), status: 'On file', source: 'Sample record' }
    ],
    medications: [
      { id: crypto.randomUUID(), name: 'Cetirizine', dose: '10 mg', schedule: 'As recorded by clinician', added: plusDays(-8), source: 'Sample record' },
      { id: crypto.randomUUID(), name: 'Vitamin D3', dose: '1000 IU', schedule: 'As recorded by clinician', added: plusDays(-22), source: 'Sample record' }
    ],
    appointments: [
      { id: crypto.randomUUID(), date: plusDays(2), time: '10:30', doctor: 'Dr. Meera Thomas', specialty: 'General physician', status: 'Confirmed', reason: 'Routine follow-up' },
      { id: crypto.randomUUID(), date: plusDays(9), time: '15:00', doctor: 'Dr. Arjun Menon', specialty: 'Ophthalmology', status: 'Requested', reason: 'Eye health review' }
    ],
    chat: [{ role: 'assistant', text: 'Hello, Ananya. I can help you organize a symptom summary for your clinician. I can’t diagnose a condition or recommend treatment. What would you like to note today?', time: new Date().toISOString() }],
    prescriptionNotes: [],
    currentRole: ''
  };
}

function readStore() {
  try { const parsed = JSON.parse(localStorage.getItem(STORE)); if (parsed?.profile && Array.isArray(parsed.vitals)) return parsed; } catch { /* start with sample data */ }
  return seedData();
}
let data = readStore();
let role = localStorage.getItem(SESSION) || '';
let activePage = 'overview';
let searchText = '';
let chartMode = 'blood pressure';
let toastTimer;
let backendOnline = false;
let syncQueue = Promise.resolve();

function save() {
  const snapshot = JSON.stringify(data);
  localStorage.setItem(STORE, snapshot);
  if (!backendOnline) return;
  syncQueue = syncQueue.catch(() => {}).then(async () => {
    const response = await fetch(`${API_BASE}/api/state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: snapshot });
    if (!response.ok) throw new Error('Backend save failed');
  }).catch(() => {
    if (backendOnline) {
      backendOnline = false;
      render();
      toast('Backend disconnected. Changes remain in this browser.', true);
    }
  });
}
async function connectBackend() {
  try {
    const response = await fetch(`${API_BASE}/api/state`);
    if (!response.ok) throw new Error('Backend is unavailable');
    const remote = await response.json();
    const hasState = remote?.profile && Array.isArray(remote.vitals);
    if (hasState) data = remote;
    backendOnline = true;
    localStorage.setItem(STORE, JSON.stringify(data));
    if (!hasState) save();
  } catch {
    backendOnline = false;
  }
  render();
}
function setRole(next) { role = next; data.currentRole = next; localStorage.setItem(SESSION, next); save(); activePage = 'overview'; render(); }
function toast(message, error = false) {
  const root = $('#toast-root'); root.innerHTML = `<div class="toast ${error ? 'error' : ''}">${escapeHTML(message)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => root.innerHTML = '', 3200);
}
function pageTitle() { return ({ overview: 'Overview', records: 'Health records', assistant: 'Voice health assistant', screening: 'Retinal screening', reports: 'Lab reports', medications: role === 'doctor' ? 'Prescriptions' : 'Medications', trends: 'Health trends', appointments: role === 'doctor' ? 'Appointment management' : 'Appointments', patients: 'Patient review', profile: 'My profile' })[activePage] || 'Overview'; }

function renderAuth() {
  $('#app').innerHTML = `<main class="auth-shell">
    <section class="auth-left"><div class="brand"><div class="brand-mark">+</div><div><div class="brand-name">MedAssist<span> AI</span></div><small class="prototype-tag">Healthcare, together</small></div></div>
      <div class="auth-copy"><p class="eyebrow">Your health, in one place</p><h1>Care feels clearer when everything connects.</h1><p>A single place for health records, everyday readings and clinician review. Sign in to explore the project prototype.</p>
        <div class="demo-buttons"><button class="demo-button" data-role="patient"><span class="avatar">AN</span><span><strong>Continue as a patient</strong><small>Explore personal health tools with sample data</small></span><span style="margin-left:auto;color:#8da09f">↗</span></button>
        <button class="demo-button" data-role="doctor"><span class="avatar coral">MT</span><span><strong>Continue as a clinician</strong><small>Review the sample patient workspace</small></span><span style="margin-left:auto;color:#8da09f">↗</span></button></div>
        <button class="text-link" style="margin-top:16px;padding:0" data-action="register">Create a local patient profile</button>
      </div><div class="auth-footer">Local prototype · Use synthetic information only</div>
    </section>
    <section class="auth-art" aria-label="Preview of the health dashboard"><div class="art-orbit"></div><div class="art-card"><div class="art-card-top"><b>MedAssist AI</b><small>YOUR HEALTH OVERVIEW</small></div><p class="art-big">A little more clarity,</p><p class="art-big">every day.</p><p class="art-caption">Your recent readings at a glance</p><div class="art-bars"><div class="art-bar" style="--w:82%"></div><div class="art-bar" style="--w:61%"></div><div class="art-bar" style="--w:73%"></div><div class="art-bar" style="--w:91%"></div><div class="art-bar" style="--w:67%"></div></div><div class="art-bottom"><div class="art-mini"><strong>120/78</strong><small>latest BP · sample</small></div><div class="art-mini"><strong>100</strong><small>glucose · sample</small></div></div></div><div class="auth-note">Illustrative demo data</div></section>
    </main>`;
}

const patientNav = [
  ['overview', 'Overview', '⌂'], ['records', 'Health records', '▤'], ['assistant', 'Voice assistant', '◖'], ['screening', 'Eye screening', '◎'],
  ['reports', 'Lab reports', '▧'], ['medications', 'Medications', '✚'], ['trends', 'Health trends', '⌁'], ['appointments', 'Appointments', '▦']
];
const doctorNav = [['overview', 'Overview', '⌂'], ['patients', 'Patients', '♧'], ['records', 'Health records', '▤'], ['reports', 'Lab reports', '▧'], ['medications', 'Prescriptions', '✚'], ['appointments', 'Appointments', '▦']];

function renderShell(content) {
  const menu = role === 'doctor' ? doctorNav : patientNav;
  const name = role === 'doctor' ? 'Dr. Meera Thomas' : data.profile.name;
  $('#app').innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">+</div><div><div class="brand-name">MedAssist<span> AI</span></div><small class="prototype-tag">Healthcare, together</small></div></div>
      <div class="nav-label">Workspace</div><nav class="nav-list">${menu.map(([key,label,icon]) => `<button class="nav-item ${activePage === key ? 'active' : ''}" data-nav="${key}" title="${label}" aria-label="${label}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}</nav>
      <div class="nav-label" style="margin-top:12px">Account</div><nav class="nav-list"><button class="nav-item ${activePage === 'profile' ? 'active' : ''}" data-nav="profile"><span class="nav-icon">◉</span><span>Profile & settings</span></button><button class="nav-item" data-action="export"><span class="nav-icon">⇩</span><span>Export my data</span></button><button class="nav-item" data-action="logout"><span class="nav-icon">↪</span><span>Sign out</span></button></nav>
      <div class="side-bottom"><div class="local-note"><strong><span class="local-dot"></span>${backendOnline ? 'Backend connected' : 'Local demo workspace'}</strong>${backendOnline ? 'Records save to this computer’s SQLite backend.' : 'Data stays in this browser until the backend connects.'} Use synthetic information only.</div><div class="side-profile"><div class="avatar ${role === 'doctor' ? 'coral' : ''}">${role === 'doctor' ? 'MT' : initials(name)}</div><div class="profile-meta"><strong>${escapeHTML(name)}</strong><small>${role === 'doctor' ? 'Clinician demo' : 'Patient account'}</small></div><button class="icon-button" title="Switch demo role" data-action="switch-role">⇄</button></div></div>
    </aside><main class="main"><header class="topbar"><div class="crumb">MedAssist AI <span style="color:#c4cdd0"> / </span> <b>${pageTitle()}</b></div><div class="top-actions"><label class="search-wrap"><span class="search-symbol">⌕</span><input id="global-search" type="search" placeholder="Search records…" value="${escapeHTML(searchText)}" aria-label="Search records"></label><button class="icon-button" data-action="notifications" aria-label="Notifications">♧</button><button class="user-chip" data-action="switch-role" title="Switch demo role" aria-label="Switch between patient and clinician demo"><span class="avatar ${role === 'doctor' ? 'coral' : ''}">${role === 'doctor' ? 'MT' : initials(name)}</span><span>${role === 'doctor' ? 'Clinician' : 'Patient'}</span></button></div></header><section class="page">${content}</section></main></div>`;
}

function pageHead(eyebrow, title, subtitle, action = '') { return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div>${action ? `<div class="button-row">${action}</div>` : ''}</div>`; }
function statCard(label, value, foot, icon, tone = '') { return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${tone}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`; }
function banner(message, title = 'Prototype notice') { return `<div class="banner"><span class="banner-icon">ⓘ</span><span><strong>${title}.</strong> ${message}</span></div>`; }
function chartSVG(mode = 'blood pressure', heightClass = '') {
  const vals = data.vitals.slice(-7), key = mode === 'glucose' ? 'glucose' : 'systolic';
  const numbers = vals.map(v => Number(v[key]) || 0); const min = Math.min(...numbers), max = Math.max(...numbers), pad = (max - min) * .27 || 12;
  const lo = min - pad, hi = max + pad; const coords = numbers.map((n,i) => [42 + i * 79, 155 - ((n - lo) / (hi - lo)) * 118]);
  const points = coords.map(([x,y]) => `${x},${y}`).join(' '), area = `42,160 ${points} ${coords.at(-1)?.[0] || 42},160`;
  return `<div class="chart-wrap ${heightClass}"><svg viewBox="0 0 520 190" preserveAspectRatio="none" role="img" aria-label="${mode} over the last seven records"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#82cbbd" stop-opacity=".3"/><stop offset="1" stop-color="#82cbbd" stop-opacity="0"/></linearGradient></defs><line class="chart-grid" x1="35" y1="35" x2="510" y2="35"/><line class="chart-grid" x1="35" y1="95" x2="510" y2="95"/><line class="chart-grid" x1="35" y1="155" x2="510" y2="155"/><text class="chart-label" x="0" y="38">${Math.round(hi)}</text><text class="chart-label" x="0" y="98">${Math.round((hi+lo)/2)}</text><text class="chart-label" x="0" y="158">${Math.round(lo)}</text><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${points}"/>${coords.map(([x,y],i) => `<circle class="chart-dot" cx="${x}" cy="${y}" r="4"/><text class="chart-label" text-anchor="middle" x="${x}" y="178">${shortDate(vals[i].date)}</text>`).join('')}</svg></div>`;
}
function latestVitals() { return data.vitals.at(-1) || { systolic: '—', diastolic: '—', glucose: '—', date: '' }; }
function activityRows() {
  const items = [...data.records].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 3);
  if (!items.length) return `<div class="empty-state"><b>No records yet</b>Add a report or consultation to get started.</div>`;
  return items.map(r => `<div class="activity-item"><span class="activity-glyph ${r.category === 'Eye screening' ? 'blue' : r.category === 'Prescription' ? 'orange' : ''}">${r.category === 'Eye screening' ? '◎' : r.category === 'Prescription' ? '✚' : '▤'}</span><div class="activity-text"><strong>${escapeHTML(r.title)}</strong><small>${escapeHTML(r.category)} · ${relative(r.date)}</small></div><span class="status ${r.status === 'Needs model' || r.status === 'Review needed' ? 'review' : 'neutral'}">${escapeHTML(r.status)}</span></div>`).join('');
}
function appointmentRows(doctorView = false) {
  const rows = [...data.appointments].sort((a,b) => a.date.localeCompare(b.date)).slice(0, 3);
  if (!rows.length) return `<div class="empty-state"><b>No appointments</b>Appointments you add will show up here.</div>`;
  return rows.map(a => `<div class="appointment-card"><div class="date-tile"><b>${new Date(`${a.date}T12:00:00`).getDate()}</b><small>${new Date(`${a.date}T12:00:00`).toLocaleDateString(undefined,{month:'short'})}</small></div><div class="appointment-info"><strong>${escapeHTML(doctorView ? data.profile.name : a.doctor)}</strong><small>${escapeHTML(a.specialty)} · ${a.time} · ${escapeHTML(a.reason)}</small></div><span class="status ${a.status === 'Requested' ? 'pending' : 'neutral'}">${escapeHTML(a.status)}</span></div>`).join('');
}

function dashboard() {
  const v = latestVitals(), doctorView = role === 'doctor';
  const action = doctorView ? `<button class="btn btn-secondary" data-nav="patients">Review patient</button><button class="btn btn-primary" data-modal="appointment">+ Schedule appointment</button>` : `<button class="btn btn-secondary" data-modal="vitals">+ Add reading</button><button class="btn btn-primary" data-modal="appointment">+ Book appointment</button>`;
  const stats = doctorView ? [statCard('Patients in demo workspace','01','Sample patient record','♧'),statCard('Upcoming appointments',String(data.appointments.filter(a=>a.status!=='Cancelled').length),'Across the sample schedule','▦','blue'),statCard('Items for review',String(data.records.filter(r=>r.status==='Review needed'||r.status==='Needs model').length),'Review with the patient','◉','orange'),statCard('Recent readings',String(data.vitals.length),'Sample patient readings','⌁','pink')].join('') : [statCard('Latest blood pressure',`${v.systolic}/${v.diastolic}`,'mmHg · sample data','⌁'),statCard('Latest blood sugar',`${v.glucose} <small style="font-size:12px">mg/dL</small>`,'Demo reading · review with clinician','◈','orange'),statCard('Health records',String(data.records.length),'Stored in this browser','▤','blue'),statCard('Upcoming visits',String(data.appointments.filter(a=>a.status!=='Cancelled').length),'Appointments on your schedule','▦','pink')].join('');
  return `${pageHead(doctorView ? 'CLINICIAN WORKSPACE' : 'PATIENT WORKSPACE',doctorView ? 'Good morning, Dr. Meera' : `Good morning, ${escapeHTML(data.profile.name.split(' ')[0])}`,doctorView ? 'Review the sample patient record and upcoming care.' : 'Here’s a simple view of your health information.',action)}${banner('Demo measurements and records are illustrative. AI screening, OCR and medication interaction services are not connected.')}
    <div class="grid stats-grid">${stats}</div><div class="grid overview-grid"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Health readings</h2><p class="panel-subtitle">Latest sample entries · last 7 records</p></div><div class="chart-toggle"><button data-chart="blood pressure" class="${chartMode==='blood pressure'?'active':''}">Blood pressure</button><button data-chart="glucose" class="${chartMode==='glucose'?'active':''}">Blood sugar</button></div></div>${chartSVG(chartMode)}<div class="chart-legend"><span><i class="legend-dot"></i>${chartMode === 'glucose' ? 'Glucose · mg/dL · demo data' : 'Systolic · mmHg · demo data'}</span></div></article>
    <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Recent activity</h2><p class="panel-subtitle">Your latest records</p></div><button class="text-link" data-nav="records">View all</button></div><div class="activity-list">${activityRows()}</div></article></div>
    <div class="grid lower-grid"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Next appointments</h2><p class="panel-subtitle">The next scheduled visits</p></div><button class="text-link" data-nav="appointments">Open schedule</button></div>${appointmentRows(doctorView)}</article><article class="panel wellness-card"><p class="eyebrow">A helpful place to start</p><h3>${doctorView ? 'Keep the conversation open' : 'Have a health question?'}</h3><p>${doctorView ? 'Review patient-provided records together. AI outputs remain unavailable in this demo.' : 'Use the assistant to organize what you want to discuss with your clinician.'}</p><button class="btn" data-nav="${doctorView?'patients':'assistant'}">${doctorView ? 'Review patient' : 'Open assistant'} <span>↗</span></button></article></div>`;
}

function recordsPage() {
  const q = searchText.toLowerCase(); const items = data.records.filter(r => `${r.title} ${r.category} ${r.status}`.toLowerCase().includes(q));
  const action = role === 'doctor' ? `<button class="btn btn-secondary" data-action="print">Print view</button>` : `<button class="btn btn-secondary" data-action="print">Print view</button><button class="btn btn-primary" data-modal="report">+ Add record</button>`;
  return `${pageHead('YOUR INFORMATION','Health records','A single timeline for reports, visits and screening uploads.',action)}${banner('Records saved here are local demo data. No clinician can access this browser workspace.')}
    <div class="grid page-grid-2"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Medical history</h2><p class="panel-subtitle">Conditions and allergies recorded in your profile</p></div>${role === 'patient' ? `<button class="text-link" data-modal="profile">Edit profile</button>` : ''}</div><div class="grid page-grid-2" style="gap:20px"><div><p class="eyebrow">CONDITIONS</p><div class="condition-list">${(data.profile.conditions || []).map(x => `<div class="condition-row"><span class="checkmark">✓</span>${escapeHTML(x)}</div>`).join('') || '<small class="empty-note">No conditions listed</small>'}</div></div><div><p class="eyebrow">ALLERGIES</p><div class="condition-list">${(data.profile.allergies || []).map(x => `<div class="condition-row"><span class="checkmark" style="background:#fff2e8;color:#c77e4e">!</span>${escapeHTML(x)}</div>`).join('') || '<small class="empty-note">No allergies listed</small>'}</div></div></div><div style="margin-top:19px;padding-top:16px;border-top:1px solid var(--line)"><div class="profile-kv"><div class="profile-field"><small>Blood type</small><strong>${escapeHTML(data.profile.bloodType || 'Not recorded')}</strong></div><div class="profile-field"><small>Emergency contact</small><strong>${escapeHTML(data.profile.emergencyContact || 'Not recorded')}</strong></div></div></div></article>
    <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Health timeline</h2><p class="panel-subtitle">Reports, appointments and other records</p></div><span class="pill">${items.length} items</span></div><div class="activity-list">${items.length ? items.map(r=>`<div class="activity-item"><span class="activity-glyph">▤</span><div class="activity-text"><strong>${escapeHTML(r.title)}</strong><small>${escapeHTML(r.category)} · ${relative(r.date)} · ${escapeHTML(r.source || 'Local record')}</small></div><span class="status ${r.status === 'On file' ? 'neutral' : 'review'}">${escapeHTML(r.status)}</span></div>`).join('') : '<div class="empty-state"><b>No matching records</b>Change your search or add a record.</div>'}</div></article></div>
    <article class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="panel-title">Recent blood pressure and glucose</h2><p class="panel-subtitle">Values shown as entered; this view does not interpret results.</p></div><button class="text-link" data-nav="trends">View trends</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Blood pressure</th><th>Blood sugar</th><th>Note</th></tr></thead><tbody>${[...data.vitals].reverse().slice(0,5).map(v=>`<tr><td>${relative(v.date)}</td><td>${escapeHTML(v.systolic)}/${escapeHTML(v.diastolic)} mmHg</td><td>${escapeHTML(v.glucose)} mg/dL</td><td>${escapeHTML(v.note || '—')}</td></tr>`).join('')}</tbody></table></div></article>`;
}

function assistantPage() {
  const messages = data.chat.map((m,index) => `<div class="chat-message ${m.role === 'user' ? 'user' : ''}"><span class="avatar ${m.role==='user'?'':'coral'}">${m.role === 'user' ? initials(data.profile.name) : 'AI'}</span><div><div class="chat-bubble">${escapeHTML(m.text).replace(/\n/g,'<br>')}<small>${new Date(m.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}${m.role==='assistant' ? ` · <button class="text-link" style="color:inherit;padding:0" data-speak="${index}" aria-label="Read response aloud">Listen</button>` : ''}</small></div></div></div>`).join('');
  return `${pageHead('PRELIMINARY SUPPORT','Voice health assistant','Organize your concern into notes you can share with a healthcare professional.')} ${banner('This assistant is a non-clinical demo. It cannot assess symptoms, diagnose conditions, recommend medicines or handle emergencies.')}<div class="assistant-layout"><article class="panel chat-panel"><div class="panel-head"><div><h2 class="panel-title">A private symptom note</h2><p class="panel-subtitle">You control what you share. Demo messages stay in this browser.</p></div><span class="status neutral">Prototype</span></div><div class="chat-messages" id="chat-messages">${messages}</div><form class="chat-composer" data-form="chat"><textarea name="message" placeholder="Describe what you would like to discuss…" required aria-label="Your message"></textarea><button type="button" class="voice-button" data-action="voice" title="Use voice input" aria-label="Use voice input">◖</button><button type="submit" class="btn btn-primary" style="min-height:40px">Send</button></form><div class="chat-hints"><button class="hint-chip" data-prompt="Help me organize a symptom summary for my doctor">Prepare a symptom summary</button><button class="hint-chip" data-prompt="What details should I write down before my appointment?">Prepare for a visit</button></div></article><aside class="panel"><p class="eyebrow">WHAT TO INCLUDE</p><h2 class="panel-title" style="font-size:16px">A clear note helps a clinician</h2><p class="panel-subtitle" style="line-height:1.7">You can write down when it started, how it feels, how often it happens and what changes it. This demo won’t interpret your answers.</p><div class="condition-list" style="margin-top:17px"><div class="condition-row"><span class="checkmark">1</span>When you first noticed it</div><div class="condition-row"><span class="checkmark">2</span>How it affects your day</div><div class="condition-row"><span class="checkmark">3</span>Any medicines or allergies to mention</div></div><div class="health-warning">If you think you may be experiencing a medical emergency, contact your local emergency service now.</div></aside></div>`;
}

function screeningPage() {
  const scans = data.records.filter(r => r.category === 'Eye screening');
  return `${pageHead('EYE HEALTH','Retinal screening','Upload an image to prepare it for a future connected screening model.',`<button class="btn btn-secondary" data-nav="records">View health record</button><button class="btn btn-primary" data-modal="eye">+ Add image</button>`)}${banner('The retinal model is not connected. No image classification, confidence score or medical finding will be generated.')}
    <div class="grid page-grid-2"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Image screening workflow</h2><p class="panel-subtitle">The project scope includes five retinal conditions.</p></div><span class="status review">Model unavailable</span></div><div class="condition-list">${['Diabetic retinopathy','Glaucoma','Cataract','Age-related macular degeneration','Hypertensive retinopathy'].map((x,i)=>`<div class="condition-row"><span class="checkmark">0${i+1}</span>${x}</div>`).join('')}</div><div class="health-warning">This list describes planned model coverage only. An eye-care professional must interpret retinal images.</div><button class="btn btn-primary" style="margin-top:14px" data-modal="eye">Choose retinal image</button></article>
      <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Recent uploads</h2><p class="panel-subtitle">Images added to this local demo timeline</p></div></div>${scans.length ? scans.slice().reverse().map(r=>`<div class="activity-item"><span class="activity-glyph blue">◎</span><div class="activity-text"><strong>${escapeHTML(r.title)}</strong><small>${relative(r.date)} · ${escapeHTML(r.fileName || 'Image metadata only')}</small></div><span class="status review">Needs model</span></div>`).join('') : '<div class="empty-state"><b>No retinal images added</b>Choose an image to see the upload workflow.</div>'}</article></div>`;
}

function reportsPage() {
  const reports = data.records.filter(r => r.category === 'Lab report');
  return `${pageHead('DOCUMENT ANALYSIS','Lab reports','Add a report to your record and prepare it for OCR review.',`<button class="btn btn-primary" data-modal="report">+ Upload report</button>`)}${banner('OCR and medical-value interpretation are not connected. Text-based extraction is not enabled in this prototype; no result values are inferred from uploads.')}
    <div class="grid page-grid-2"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Report upload</h2><p class="panel-subtitle">Images and PDFs can be attached as local metadata.</p></div></div><div class="file-drop"><span class="upload-glyph">⇧</span><strong>Choose a report file</strong><small>PDF, PNG or JPG · metadata only, stays in this browser</small><button class="btn btn-secondary btn-sm" style="margin-top:12px" data-modal="report">Browse files</button></div><div class="health-warning">No OCR output is created here. Connect and validate an OCR service before relying on extracted information.</div></article><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Recent lab reports</h2><p class="panel-subtitle">Entries in your local timeline</p></div><span class="pill">${reports.length} records</span></div>${reports.length ? reports.slice().reverse().map(r=>`<div class="activity-item"><span class="activity-glyph">▧</span><div class="activity-text"><strong>${escapeHTML(r.title)}</strong><small>${relative(r.date)} · ${escapeHTML(r.fileName || r.source || 'Record')}</small></div><span class="status neutral">On file</span></div>`).join('') : '<div class="empty-state"><b>No reports on file</b>Uploaded report entries will appear here.</div>'}</article></div>`;
}

function medicationPage() {
  const meds = data.medications;
  const doctorActions = role === 'doctor' ? `<button class="btn btn-secondary" data-modal="prescription-scan">Upload prescription</button><button class="btn btn-primary" data-modal="prescription">+ Create prescription</button>` : `<button class="btn btn-secondary" data-modal="prescription-scan">Analyze prescription</button><button class="btn btn-primary" data-modal="medication">+ Add medication</button>`;
  return `${pageHead(role === 'doctor' ? 'CLINICIAN TOOLS' : 'MEDICATION LIST',role === 'doctor' ? 'Prescription review' : 'Medications','Keep medication details together for patient and clinician review.',doctorActions)}${banner('No external medicine reference or interaction database is connected. This demo only flags exact duplicate names in the list. A clinician or pharmacist should review medication safety.')}
    <div class="grid page-grid-2"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">${role === 'doctor' ? 'Current patient medications' : 'Current medications'}</h2><p class="panel-subtitle">Only add details that have been confirmed by a clinician.</p></div><span class="pill">${meds.length} listed</span></div><div class="med-cards">${meds.length ? meds.map(m=>`<div class="med-card"><div class="med-head"><strong>${escapeHTML(m.name)}</strong><button class="text-link" data-remove-med="${m.id}" aria-label="Remove ${escapeHTML(m.name)}">Remove</button></div><p>${escapeHTML(m.dose)} · ${escapeHTML(m.schedule)}</p><p>Added ${relative(m.added)} · ${escapeHTML(m.source || 'Local entry')}</p></div>`).join('') : '<div class="empty-state"><b>No medications listed</b>Add a confirmed medication record.</div>'}<div class="med-card" style="border-style:dashed;background:#fbfdfd"><div class="med-head"><strong>Prescription image analyzer</strong><span class="status review">OCR unavailable</span></div><p>Prepare a handwritten or digital prescription for OCR review. The uploaded file is not processed in this demo.</p><button class="text-link" style="padding:9px 0 0" data-modal="prescription-scan">Choose prescription ↗</button></div></div></article>
      <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Medication safety review</h2><p class="panel-subtitle">Add names to identify exact duplicates only.</p></div><span class="stat-icon orange">✚</span></div><form class="grid" data-form="interaction"><div class="field"><label for="interaction-list">Medicine names</label><textarea id="interaction-list" name="names" placeholder="Example: Medicine A, Medicine B" required></textarea></div><button class="btn btn-primary" type="submit" style="justify-self:start">Check duplicate names</button></form><div class="upload-result" id="interaction-result">This prototype cannot check clinical drug interactions, dosage, allergies or ingredient equivalence.</div></article></div>`;
}

function trendsPage() {
  const v = latestVitals();
  return `${pageHead('HEALTH MONITORING','Health trends','Review measurements you or your clinician entered.',`<button class="btn btn-primary" data-modal="vitals">+ Add reading</button>`)}${banner('Measurements are shown as entered. The charts do not diagnose or interpret a health condition.')}
    <div class="grid stats-grid">${statCard('Most recent pressure',`${v.systolic}/${v.diastolic}`,'mmHg · sample data','⌁')}${statCard('Most recent glucose',`${v.glucose} <small style="font-size:12px">mg/dL</small>`,'Sample data · confirm units','◈','orange')}${statCard('Total readings',String(data.vitals.length),'Stored in this browser','▤','blue')}${statCard('Latest entry',relative(v.date),'Date entered','▦','pink')}</div>
    <div class="grid page-grid-2"><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Systolic blood pressure</h2><p class="panel-subtitle">mmHg · recorded values</p></div></div>${chartSVG('blood pressure')}</article><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Blood sugar</h2><p class="panel-subtitle">mg/dL · confirm measurement type with your clinician</p></div></div>${chartSVG('glucose')}</article></div><article class="panel" style="margin-top:16px"><div class="panel-head"><div><h2 class="panel-title">Reading history</h2><p class="panel-subtitle">The newest entries appear first.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Systolic</th><th>Diastolic</th><th>Glucose</th><th>Notes</th></tr></thead><tbody>${data.vitals.slice().reverse().map(x=>`<tr><td>${relative(x.date)}</td><td>${escapeHTML(x.systolic)} mmHg</td><td>${escapeHTML(x.diastolic)} mmHg</td><td>${escapeHTML(x.glucose)} mg/dL</td><td>${escapeHTML(x.note || '—')}</td></tr>`).join('')}</tbody></table></div></article>`;
}

function appointmentsPage() {
  const doctorView = role === 'doctor';
  const rows = [...data.appointments].sort((a,b)=>a.date.localeCompare(b.date));
  return `${pageHead(doctorView ? 'CARE COORDINATION' : 'YOUR CARE',doctorView ? 'Appointment management' : 'Appointments',doctorView ? 'Review and update appointments in the sample schedule.' : 'Keep upcoming visits in one place.',`<button class="btn btn-primary" data-modal="appointment">+ ${doctorView ? 'Add appointment' : 'Book appointment'}</button>`)}${banner('Appointments are stored locally in this browser. They are not sent to a clinic or care team.')}
    <article class="panel"><div class="panel-head"><div><h2 class="panel-title">Appointment schedule</h2><p class="panel-subtitle">${doctorView ? 'Sample patient' : 'Your'} visits and requests</p></div><span class="pill">${rows.filter(a=>a.status!=='Cancelled').length} active</span></div>${rows.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date & time</th><th>${doctorView ? 'Patient' : 'Clinician'}</th><th>Visit</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${relative(a.date)}<br><small>${escapeHTML(a.time)}</small></td><td>${escapeHTML(doctorView ? data.profile.name : a.doctor)}</td><td>${escapeHTML(a.specialty)}</td><td>${escapeHTML(a.reason)}</td><td><span class="status ${a.status==='Requested'?'pending':a.status==='Cancelled'?'neutral':''}">${escapeHTML(a.status)}</span></td><td>${doctorView && a.status==='Requested' ? `<button class="text-link" data-appointment-action="confirm:${a.id}">Confirm</button>` : a.status==='Cancelled' ? '—' : `<button class="text-link" data-appointment-action="cancel:${a.id}">Cancel</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><b>No appointments yet</b>Use the button above to add a visit.</div>'}</article>`;
}

function patientsPage() {
  return `${pageHead('CLINICIAN WORKSPACE','Patient review','Review only the synthetic sample patient available in this prototype.',`<button class="btn btn-secondary" data-nav="appointments">Appointments</button>`)}${banner('This local demo has no real identity checks, consent workflow or clinician authorization controls. Do not use real patient information.')}
    <div class="grid stats-grid">${statCard('Patient','01','Synthetic demo profile','♧')}${statCard('Health records',String(data.records.length),'Available in this local demo','▤','blue')}${statCard('Measurements',String(data.vitals.length),'Values shown as entered','⌁','orange')}${statCard('Upcoming visits',String(data.appointments.filter(a=>a.status!=='Cancelled').length),'Sample schedule','▦','pink')}</div>
    <div class="grid page-grid-2"><article class="panel"><div class="profile-hero"><div class="avatar">${initials(data.profile.name)}</div><div><h2 class="panel-title" style="font-size:17px">${escapeHTML(data.profile.name)}</h2><p class="panel-subtitle">${escapeHTML(data.profile.age)} years · ${escapeHTML(data.profile.city)} · ${escapeHTML(data.profile.bloodType)}</p></div><span class="status neutral" style="margin-left:auto">Demo patient</span></div><div class="profile-kv"><div class="profile-field"><small>Conditions</small><strong>${escapeHTML((data.profile.conditions||[]).join(', ')||'None listed')}</strong></div><div class="profile-field"><small>Allergies</small><strong>${escapeHTML((data.profile.allergies||[]).join(', ')||'None listed')}</strong></div><div class="profile-field"><small>Contact</small><strong>${escapeHTML(data.profile.phone || 'Not recorded')}</strong></div><div class="profile-field"><small>Emergency contact</small><strong>${escapeHTML(data.profile.emergencyContact || 'Not recorded')}</strong></div></div><div class="button-row" style="margin-top:18px"><button class="btn btn-secondary" data-nav="records">Open patient record</button><button class="btn btn-primary" data-modal="prescription">Create prescription</button></div></article><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Recent records for review</h2><p class="panel-subtitle">No AI-generated findings in this demo</p></div></div><div class="activity-list">${activityRows()}</div></article></div>`;
}

function profilePage() {
  const p = data.profile;
  return `${pageHead('ACCOUNT SETTINGS','My profile','Manage the sample profile and export your local data.',`<button class="btn btn-secondary" data-action="export">Export data</button><button class="btn btn-primary" data-modal="profile">Edit profile</button>`)}${banner('This profile exists only in this browser. Sign-in does not secure or sync your information.')}
    <div class="grid page-grid-2"><article class="panel"><div class="profile-hero"><div class="avatar">${initials(p.name)}</div><div><h2 class="panel-title" style="font-size:17px">${escapeHTML(p.name)}</h2><p class="panel-subtitle">${escapeHTML(p.email)} · Patient</p></div></div><div class="profile-kv"><div class="profile-field"><small>Age</small><strong>${escapeHTML(p.age || '—')}</strong></div><div class="profile-field"><small>Blood type</small><strong>${escapeHTML(p.bloodType || '—')}</strong></div><div class="profile-field"><small>Phone</small><strong>${escapeHTML(p.phone || '—')}</strong></div><div class="profile-field"><small>Location</small><strong>${escapeHTML(p.city || '—')}</strong></div></div></article><article class="panel"><div class="panel-head"><div><h2 class="panel-title">Privacy and data</h2><p class="panel-subtitle">Browser-only prototype controls</p></div></div><div class="condition-list"><div class="condition-row"><span class="checkmark">✓</span>Data stored in this browser's local storage</div><div class="condition-row"><span class="checkmark">✓</span>Uploads are not sent to a server</div><div class="condition-row"><span class="checkmark">✓</span>Export a JSON copy to your computer</div></div><div class="button-row" style="margin-top:18px"><button class="btn btn-secondary" data-action="export">Download my data</button><button class="btn btn-danger" data-action="reset">Reset demo data</button></div></article></div>`;
}

function pageContent() {
  switch (activePage) {
    case 'records': return recordsPage(); case 'assistant': return assistantPage(); case 'screening': return screeningPage(); case 'reports': return reportsPage();
    case 'medications': return medicationPage(); case 'trends': return trendsPage(); case 'appointments': return appointmentsPage(); case 'patients': return patientsPage(); case 'profile': return profilePage(); default: return dashboard();
  }
}
function render() { if (!role) return renderAuth(); renderShell(pageContent()); }

function modalTemplate(type) {
  const definitions = {
    vitals: ['Add a health reading','Values are stored as entered. Add only your own demo data.',`<div class="field"><label>Systolic pressure (mmHg)</label><input name="systolic" type="number" min="1" max="300" required></div><div class="field"><label>Diastolic pressure (mmHg)</label><input name="diastolic" type="number" min="1" max="200" required></div><div class="field"><label>Blood sugar value</label><input name="glucose" type="number" min="1" max="2000" required></div><div class="field"><label>Recorded date</label><input name="date" type="date" value="${todayISO()}" required></div><div class="field full"><label>Note (optional)</label><input name="note" maxlength="120" placeholder="Measurement context"></div>`],
    appointment: ['Add an appointment','Local schedule entry only. This does not contact a clinic.',`<div class="field"><label>Date</label><input name="date" type="date" min="${todayISO()}" required></div><div class="field"><label>Time</label><input name="time" type="time" value="10:00" required></div><div class="field"><label>Clinician</label><input name="doctor" maxlength="80" value="Dr. Meera Thomas" required></div><div class="field"><label>Visit type</label><select name="specialty"><option>General physician</option><option>Ophthalmology</option><option>Cardiology</option><option>Follow-up</option></select></div><div class="field full"><label>Reason for visit</label><input name="reason" maxlength="120" placeholder="What would you like to discuss?" required></div>`],
    report: ['Add a lab report','The file is not uploaded. This prototype saves only its name and date.',`<div class="field full"><label>Report title</label><input name="title" maxlength="80" placeholder="Example: Complete blood count" required></div><div class="field full"><label>Choose file (optional)</label><input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"></div><div class="field full"><label>Report date</label><input name="date" type="date" value="${todayISO()}" required></div>`],
    eye: ['Add a retinal image','Image metadata stays in this browser; no retinal model is connected.',`<div class="field full"><label>Image label</label><input name="title" maxlength="80" value="Retinal image upload" required></div><div class="field full"><label>Choose image</label><input name="file" type="file" accept="image/*" required></div><div class="field full"><label>Upload date</label><input name="date" type="date" value="${todayISO()}" required></div>`],
    medication: ['Add a medication','Enter details as confirmed by a healthcare professional.',`<div class="field full"><label>Medicine name</label><input name="name" maxlength="80" required></div><div class="field"><label>Strength / dose</label><input name="dose" maxlength="60" placeholder="As prescribed" required></div><div class="field"><label>Schedule</label><input name="schedule" maxlength="80" placeholder="As prescribed" required></div>`],
    prescription: ['Create a prescription record','Clinician demo entry only. No prescription is sent to a pharmacy.',`<div class="field"><label>Medicine name</label><input name="name" maxlength="80" required></div><div class="field"><label>Strength / dose</label><input name="dose" maxlength="60" required></div><div class="field full"><label>Directions</label><textarea name="schedule" maxlength="160" placeholder="Enter verified directions" required></textarea></div><div class="field full"><label>Clinician note (optional)</label><textarea name="note" maxlength="180" placeholder="Additional instructions"></textarea></div>`],
    'prescription-scan': ['Add a prescription image','OCR and handwriting recognition are not connected. No medicine will be inferred from this file.',`<div class="field full"><label>Prescription label</label><input name="title" maxlength="80" value="Prescription image" required></div><div class="field full"><label>Choose image or PDF</label><input name="file" type="file" accept="image/*,.pdf" required></div><div class="field full"><label>Upload date</label><input name="date" type="date" value="${todayISO()}" required></div>`],
    profile: ['Edit patient profile','Local demo profile only. Do not add real personal information.',`<div class="field"><label>Full name</label><input name="name" maxlength="80" value="${escapeHTML(data.profile.name)}" required></div><div class="field"><label>Age</label><input name="age" type="number" min="1" max="120" value="${escapeHTML(data.profile.age)}"></div><div class="field"><label>Blood type</label><select name="bloodType">${['Not recorded','A+','A−','B+','B−','AB+','AB−','O+','O−'].map(t=>`<option ${data.profile.bloodType===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>Phone</label><input name="phone" maxlength="40" value="${escapeHTML(data.profile.phone||'')}"></div><div class="field"><label>City</label><input name="city" maxlength="60" value="${escapeHTML(data.profile.city||'')}"></div><div class="field"><label>Emergency contact</label><input name="emergencyContact" maxlength="100" value="${escapeHTML(data.profile.emergencyContact||'')}"></div><div class="field full"><label>Conditions (comma separated)</label><input name="conditions" value="${escapeHTML((data.profile.conditions||[]).join(', '))}"></div><div class="field full"><label>Allergies (comma separated)</label><input name="allergies" value="${escapeHTML((data.profile.allergies||[]).join(', '))}"></div>`],
    register: ['Create a local patient profile','This creates a sample profile in this browser, not a secure account.',`<div class="field full"><label>Full name</label><input name="name" maxlength="80" placeholder="Your name" required></div><div class="field full"><label>Email</label><input name="email" type="email" maxlength="120" placeholder="you@example.com" required></div><div class="field"><label>Age</label><input name="age" type="number" min="1" max="120" value="30"></div><div class="field"><label>City</label><input name="city" maxlength="60" placeholder="Your city"></div>`]
  };
  if (type === 'reset-confirm') return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Reset local demo data?</h2><p>This replaces the profile and sample records saved in this browser. Export first if you want a copy.</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div><p style="color:#70818a;font-size:12px;line-height:1.6">The reset restores the original synthetic patient data. It does not affect files outside this browser.</p><form data-form="reset-confirm"><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-danger" type="submit">Reset demo data</button></div></form></section></div>`;
  const [title, description, fields] = definitions[type] || definitions.profile;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${description}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div><form data-form="${type}"><div class="form-grid">${fields}</div><div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${type === 'register' ? 'Create profile' : type === 'profile' ? 'Save profile' : 'Save to demo'}</button></div></form></section></div>`;
}
function openModal(type) { $('#modal-root').innerHTML = modalTemplate(type); const input = $('#modal-root input'); if (input) input.focus(); }
function closeModal() { $('#modal-root').innerHTML = ''; }

function assistantReply(input) {
  const lower = input.toLowerCase();
  if (/\b(chest pain|can't breathe|cannot breathe|difficulty breathing|severe bleeding|unconscious|stroke)\b/.test(lower)) return 'I can’t assess or respond to an emergency. If you think this may be an emergency, contact your local emergency service now. This demo cannot provide emergency care.';
  if (/\b(medicine|medication|dose|dosage|prescription|interaction)\b/.test(lower)) return 'I can help you note this question for your healthcare professional, but I can’t check medicines, doses or interactions. Please ask your prescribing clinician or pharmacist before making a change.';
  return 'I can’t interpret symptoms or provide a diagnosis. I can help you prepare a clear note: when it began, how often it happens, what it feels like, and what you would like your clinician to know. If you are concerned, contact a qualified healthcare professional.';
}
async function submitForm(form) {
  const type = form.dataset.form; const fd = new FormData(form); const vals = Object.fromEntries(fd.entries());
  if (type === 'reset-confirm') { data = seedData(); save(); closeModal(); render(); toast('Demo data reset to the original sample.'); return; }
  if (type === 'register') {
    data.profile = { ...data.profile, name: vals.name.trim(), email: vals.email.trim(), age: vals.age || '', city: vals.city || '', conditions: [], allergies: [] }; save(); closeModal(); setRole('patient'); toast('Local demo profile created in this browser.'); return;
  }
  if (type === 'profile') { data.profile = { ...data.profile, ...vals, age: Number(vals.age)||'', conditions: vals.conditions.split(',').map(x=>x.trim()).filter(Boolean), allergies: vals.allergies.split(',').map(x=>x.trim()).filter(Boolean) }; save(); closeModal(); render(); toast('Profile saved in this browser.'); return; }
  if (type === 'vitals') { data.vitals.push({ date: vals.date, systolic: Number(vals.systolic), diastolic: Number(vals.diastolic), glucose: Number(vals.glucose), note: vals.note.trim() }); save(); closeModal(); render(); toast('Reading added to the local record.'); return; }
  if (type === 'appointment') { data.appointments.push({ id: crypto.randomUUID(), date: vals.date, time: vals.time, doctor: vals.doctor, specialty: vals.specialty, reason: vals.reason, status: role === 'doctor' ? 'Confirmed' : 'Requested' }); save(); closeModal(); render(); toast(role === 'doctor' ? 'Appointment added to the demo schedule.' : 'Appointment request saved locally.'); return; }
  if (type === 'report' || type === 'eye' || type === 'prescription-scan') {
    const file = fd.get('file'); const isEye = type === 'eye'; const isPrescription = type === 'prescription-scan';
    if (isEye && (!file || !file.name)) { toast('Choose an image before saving.', true); return; }
    if (isPrescription && (!file || !file.name)) { toast('Choose a prescription file before saving.', true); return; }
    const record = { id: crypto.randomUUID(), title: vals.title.trim(), category: isEye ? 'Eye screening' : isPrescription ? 'Prescription' : 'Lab report', date: vals.date || todayISO(), status: isEye || isPrescription ? 'Needs model' : 'On file', source: 'Local upload metadata', fileName: file?.name || '' };
    data.records.push(record); save(); closeModal(); render(); toast(isEye ? 'Image metadata saved. Screening model is not connected.' : isPrescription ? 'Prescription metadata saved. OCR is not connected.' : 'Report metadata saved. OCR is not connected.'); return;
  }
  if (type === 'medication' || type === 'prescription') {
    data.medications.push({ id: crypto.randomUUID(), name: vals.name.trim(), dose: vals.dose.trim(), schedule: vals.schedule.trim(), added: todayISO(), source: type === 'prescription' ? 'Clinician demo entry' : 'Patient demo entry' });
    if (type === 'prescription') { data.records.push({ id: crypto.randomUUID(), title: `Prescription: ${vals.name.trim()}`, category: 'Prescription', date: todayISO(), status: 'Review needed', source: 'Clinician demo entry' }); if (vals.note?.trim()) data.prescriptionNotes.push(vals.note.trim()); }
    save(); closeModal(); render(); toast(type === 'prescription' ? 'Prescription record added to the demo chart.' : 'Medication added to the local list.'); return;
  }
  if (type === 'chat') {
    const message = String(vals.message || '').trim(); if (!message) return;
    data.chat.push({ role: 'user', text: message, time: new Date().toISOString() }); data.chat.push({ role: 'assistant', text: assistantReply(message), time: new Date().toISOString() }); save(); render(); $('#chat-messages')?.scrollTo(0, 99999); return;
  }
  if (type === 'interaction') {
    const names = vals.names.split(',').map(x=>x.trim()).filter(Boolean); const norm = names.map(n=>n.toLowerCase()); const duplicates = norm.filter((x,i)=>norm.indexOf(x)!==i);
    const result = $('#interaction-result'); if (result) result.innerHTML = duplicates.length ? `<strong>Exact duplicate names found:</strong> ${escapeHTML([...new Set(duplicates)].join(', '))}. Please ask a pharmacist or clinician to review the list.` : 'No exact duplicate names were found in the text you entered. <strong>This does not mean the combination is safe.</strong> No clinical interaction check was performed.';
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify({ profile: data.profile, vitals: data.vitals, records: data.records, medications: data.medications, appointments: data.appointments }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'medassist-demo-data.json'; a.click(); URL.revokeObjectURL(url); toast('A local JSON export was downloaded.');
}
function updateAppointment(action) {
  const [verb,id] = action.split(':'); const appt = data.appointments.find(a=>a.id===id); if (!appt) return;
  appt.status = verb === 'confirm' ? 'Confirmed' : 'Cancelled'; save(); render(); toast(`Appointment ${appt.status.toLowerCase()}.`);
}
function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { toast('Voice recognition is unavailable in this browser. You can type your note instead.', true); return; }
  const button = $('[data-action="voice"]'); const recognition = new SpeechRecognition(); recognition.lang = navigator.language || 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1;
  button?.classList.add('listening'); button?.setAttribute('aria-label','Listening');
  recognition.onresult = event => { const input = $('textarea[name="message"]'); if (input) input.value = `${input.value}${input.value ? ' ' : ''}${event.results[0][0].transcript}`; };
  recognition.onerror = () => toast('Voice input did not complete. You can type your note instead.', true);
  recognition.onend = () => { button?.classList.remove('listening'); button?.setAttribute('aria-label','Use voice input'); };
  try { recognition.start(); } catch { toast('Voice input is already active or unavailable.', true); }
}

document.addEventListener('click', event => {
  const target = event.target.closest('button,[data-role],[data-appointment-action],[data-remove-med]'); if (!target) {
    if (event.target.classList.contains('modal-backdrop')) closeModal();
    return;
  }
  if (target.dataset.role) { setRole(target.dataset.role); return; }
  if (target.dataset.nav) { activePage = target.dataset.nav; render(); return; }
  if (target.dataset.chart) { chartMode = target.dataset.chart; render(); return; }
  if (target.dataset.modal) { openModal(target.dataset.modal); return; }
  if (target.dataset.appointmentAction) { updateAppointment(target.dataset.appointmentAction); return; }
  if (target.dataset.speak !== undefined) { const message = data.chat[Number(target.dataset.speak)]?.text; if (!message || !('speechSynthesis' in window)) { toast('Speech playback is unavailable in this browser.', true); return; } window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(message)); return; }
  if (target.dataset.removeMed) { data.medications = data.medications.filter(m=>m.id!==target.dataset.removeMed); save(); render(); toast('Medication removed from the local list.'); return; }
  const action = target.dataset.action;
  if (action === 'register') openModal('register');
  if (action === 'close-modal') closeModal();
  if (action === 'logout') { role = ''; localStorage.removeItem(SESSION); render(); }
  if (action === 'switch-role') setRole(role === 'patient' ? 'doctor' : 'patient');
  if (action === 'export') exportData();
  if (action === 'print') window.print();
  if (action === 'reset') openModal('reset-confirm');
  if (action === 'voice') startVoice();
  if (action === 'notifications') toast('You’re all caught up in this demo.');
  if (target.dataset.prompt) { const input = $('textarea[name="message"]'); if (input) input.value = target.dataset.prompt; input?.focus(); }
});

document.addEventListener('submit', event => {
  const form = event.target.closest('form[data-form]'); if (!form) return;
  event.preventDefault(); submitForm(form);
});
document.addEventListener('input', event => {
  if (event.target.id === 'global-search') { searchText = event.target.value; if (activePage === 'records') { const pos = event.target.selectionStart; render(); const input = $('#global-search'); input?.focus(); input?.setSelectionRange(pos,pos); } }
});

render();
connectBackend();
