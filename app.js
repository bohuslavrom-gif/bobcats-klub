import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm'

const SUPABASE_URL = 'https://xrcgxanzbzflvpvmygrd.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BfQMClCwUxXF354tkp5F1w_meU8d5u3'
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

/* ============ stav ============ */
const S = {
  user: null, me: null,
  profiles: [], teams: [], tasks: [], events: [], lists: [], items: [], memberships: [],
  view: 'dash',
  filter: { who: 'all', team: '', status: 'open', q: '' },
  cal: new Date(),
}

/* ============ pomocné ============ */
const $ = (s, r = document) => r.querySelector(s)
const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e }
const esc = s => (s ?? '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
const iso = d => new Date(d).toISOString().slice(0, 10)
const today = () => iso(new Date())
const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

function fmtDate(d) {
  if (!d) return '—'
  const x = new Date(d)
  return `${x.getDate()}. ${x.getMonth() + 1}. ${x.getFullYear()}`
}
function fmtDateTime(d) {
  const x = new Date(d)
  const t = x.getHours() || x.getMinutes() ? ` ${x.getHours()}:${String(x.getMinutes()).padStart(2, '0')}` : ''
  return `${x.getDate()}. ${x.getMonth() + 1}.${t}`
}
function daysLeft(d) {
  if (!d) return null
  return Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000)
}
function teamName(id) { return S.teams.find(t => t.id === id)?.name || '' }
function personName(id) { const p = S.profiles.find(p => p.id === id); return p ? (p.full_name || p.email) : '' }
function toast(msg, bad) {
  const t = el('div', 'toast' + (bad ? ' bad' : ''), esc(msg))
  document.body.appendChild(t)
  setTimeout(() => t.classList.add('in'), 10)
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300) }, 3200)
}

const EVENT_KINDS = { training: 'Trénink', match: 'Zápas', meeting: 'Schůze', deadline: 'Termín', event: 'Akce', other: 'Ostatní' }
const REC = { none: 'Neopakovat', weekly: 'Každý týden', monthly: 'Každý měsíc', quarterly: 'Každé čtvrtletí', yearly: 'Každý rok' }
const PRIO = { high: 'Vysoká', normal: 'Běžná', low: 'Nízká' }
const CHK = { done: 'Máme', partial: 'Částečně', missing: 'Chybí' }

/* ============ data ============ */
async function loadAll() {
  const [pr, tm, tk, ev, cl, ci, ms] = await Promise.all([
    sb.from('bc_profile').select('*').order('full_name'),
    sb.from('bc_team').select('*').order('sort'),
    sb.from('bc_task').select('*').order('due_date', { nullsFirst: false }),
    sb.from('bc_event').select('*').order('starts_at'),
    sb.from('bc_checklist').select('*').order('sort'),
    sb.from('bc_checklist_item').select('*').order('sort'),
    sb.from('bc_membership').select('*'),
  ])
  S.profiles = pr.data || []; S.teams = tm.data || []; S.tasks = tk.data || []
  S.events = ev.data || []; S.lists = cl.data || []; S.items = ci.data || []
  S.memberships = ms.data || []
  S.me = S.profiles.find(p => p.id === S.user.id) || S.me
  S.seesAll = !!S.me.is_admin || S.memberships.some(m => m.profile_id === S.me.id && S.teams.find(t => t.id === m.team_id)?.kind === 'vybor')
  S.myTeams = S.memberships.filter(m => m.profile_id === S.me.id).map(m => m.team_id)
}
const teamsOf = id => S.memberships.filter(m => m.profile_id === id).map(m => m.team_id)

/* ============ export do kalendáře ============ */
function evEnd(e) {
  if (e.ends_at) return new Date(e.ends_at)
  return new Date(new Date(e.starts_at).getTime() + 90 * 60000)
}
function evDetail(e) {
  const parts = []
  if (e.note) parts.push(e.note)
  if (e.meet_url) parts.push('Online schůzka: ' + e.meet_url)
  if (e.team_id) parts.push('Tým: ' + teamName(e.team_id))
  parts.push('Příbram Bobcats — Řízení klubu')
  return parts.join('\n\n')
}
const gStamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
function googleCalUrl(e) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${gStamp(e.starts_at)}/${gStamp(evEnd(e))}`,
    details: evDetail(e),
    location: e.location || '',
  })
  return 'https://calendar.google.com/calendar/render?' + p.toString()
}
function downloadIcs(e) {
  const fold = s => (s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pribram Bobcats//Rizeni klubu//CS',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.id || Math.random().toString(36).slice(2)}@bobcats`,
    `DTSTAMP:${gStamp(new Date())}`,
    `DTSTART:${gStamp(e.starts_at)}`,
    `DTEND:${gStamp(evEnd(e))}`,
    `SUMMARY:${fold(e.title)}`,
    `DESCRIPTION:${fold(evDetail(e))}`,
    e.location ? `LOCATION:${fold(e.location)}` : '',
    e.meet_url ? `URL:${e.meet_url}` : '',
    'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', `DESCRIPTION:${fold(e.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  a.download = (e.title || 'udalost').replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60) + '.ics'
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/* ============ auth obrazovka ============ */
function renderAuth(mode = 'login') {
  document.body.className = 'auth-body'
  document.body.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <img class="auth-logo" src="./logo-red.png" alt="Bobcats">
      <div class="auth-kicker">Příbram Bobcats</div>
      <h1 class="auth-h1">Řízení klubu</h1>
      <p class="auth-sub">${mode === 'login' ? 'Přihlas se svým klubovým účtem.' : 'Vytvoř si účet — přístup ti pak schválí správce.'}</p>
      <form id="af">
        ${mode === 'signup' ? '<label>Jméno a příjmení<input id="an" required placeholder="Jan Novák"></label>' : ''}
        <label>E-mail<input id="ae" type="email" required placeholder="jan@bobcats.cz"></label>
        <label>Heslo<input id="ap" type="password" required minlength="6" placeholder="min. 6 znaků"></label>
        <button class="btn primary wide" type="submit">${mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}</button>
      </form>
      <div class="auth-alt">${mode === 'login'
        ? 'Nemáš účet? <a href="#" id="sw">Zaregistrovat se</a>'
        : 'Už máš účet? <a href="#" id="sw">Přihlásit se</a>'}</div>
      <div id="aerr" class="auth-err"></div>
    </div>
  </div>`
  $('#sw').onclick = e => { e.preventDefault(); renderAuth(mode === 'login' ? 'signup' : 'login') }
  $('#af').onsubmit = async e => {
    e.preventDefault()
    const email = $('#ae').value.trim(), pass = $('#ap').value
    const btn = $('#af button'); btn.disabled = true; btn.textContent = 'Pracuji…'
    let res
    if (mode === 'login') res = await sb.auth.signInWithPassword({ email, password: pass })
    else res = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: $('#an').value.trim() } } })
    btn.disabled = false; btn.textContent = mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'
    if (res.error) { $('#aerr').textContent = translateErr(res.error.message); return }
    if (mode === 'signup' && !res.data.session) { $('#aerr').textContent = 'Účet vytvořen. Potvrď prosím e-mail a pak se přihlas.'; return }
    boot()
  }
}
function translateErr(m) {
  if (/Invalid login/i.test(m)) return 'Nesprávný e-mail nebo heslo.'
  if (/already registered/i.test(m)) return 'Tento e-mail už je zaregistrovaný.'
  if (/Password should/i.test(m)) return 'Heslo musí mít alespoň 6 znaků.'
  if (/Email not confirmed/i.test(m)) return 'E-mail zatím není potvrzený — zkontroluj schránku.'
  return m
}

/* ============ čekání na schválení ============ */
function renderPending() {
  document.body.className = 'auth-body'
  document.body.innerHTML = `
  <div class="auth-wrap"><div class="auth-card">
    <img class="auth-logo" src="./logo-red.png">
    <div class="auth-kicker">Příbram Bobcats</div>
    <h1 class="auth-h1">Čeká na schválení</h1>
    <p class="auth-sub">Tvůj účet <b>${esc(S.user.email)}</b> byl vytvořen. Přístup ti musí potvrdit správce systému — dej mu vědět.</p>
    <button class="btn wide" id="lo">Odhlásit se</button>
  </div></div>`
  $('#lo').onclick = async () => { await sb.auth.signOut(); location.reload() }
}

/* ============ layout ============ */
const NAV = [
  ['dash', 'Přehled'], ['tasks', 'Úkoly'], ['cal', 'Kalendář'], ['check', 'Checklisty'], ['people', 'Lidé a týmy'],
]
function renderShell() {
  document.body.className = ''
  document.body.innerHTML = `
  <header class="top">
    <div class="brand"><img src="./logo-white.png"><div><b>Příbram Bobcats</b><span>Řízení klubu</span></div></div>
    <nav class="nav">${NAV.filter(([k]) => k !== 'check' || S.seesAll).map(([k, l]) => `<button data-v="${k}" class="${S.view === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
    <div class="me">
      <div class="who"><b>${esc(S.me.full_name || S.me.email)}</b><span>${esc(S.me.role_title || (S.me.is_admin ? 'správce' : 'člen'))}</span></div>
      <button class="btn ghost sm" id="logout">Odhlásit</button>
    </div>
  </header>
  <main id="main"></main>`
  document.querySelectorAll('.nav button').forEach(b => b.onclick = () => { S.view = b.dataset.v; render() })
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload() }
}
function render() {
  renderShell()
  const m = $('#main')
  if (S.view === 'dash') viewDash(m)
  if (S.view === 'tasks') viewTasks(m)
  if (S.view === 'cal') viewCal(m)
  if (S.view === 'check') { if (S.seesAll) viewCheck(m); else { S.view = 'dash'; return render() } }
  if (S.view === 'people') viewPeople(m)
}

/* ============ PŘEHLED ============ */
function viewDash(m) {
  const open = S.tasks.filter(t => t.status !== 'done')
  const over = open.filter(t => t.due_date && t.due_date < today())
  const soon = open.filter(t => t.due_date && daysLeft(t.due_date) >= 0 && daysLeft(t.due_date) <= 7)
  const mine = open.filter(t => t.assignee_id === S.me.id)
  const doneMonth = S.tasks.filter(t => t.status === 'done' && t.completed_at && new Date(t.completed_at).getMonth() === new Date().getMonth() && new Date(t.completed_at).getFullYear() === new Date().getFullYear())
  const upcoming = S.events.filter(e => new Date(e.starts_at) >= new Date(today())).slice(0, 6)

  m.appendChild(el('div', 'head', `<h2>Přehled</h2><p>${new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>`))

  const st = el('div', 'stats')
  const cards = [
    [over.length, 'Po termínu', over.length ? 'red' : ''],
    [soon.length, 'Termín do 7 dnů', ''],
    [mine.length, 'Moje otevřené úkoly', ''],
    [doneMonth.length, 'Hotovo tento měsíc', 'green'],
  ]
  cards.forEach(([n, l, c]) => st.appendChild(el('div', 'stat ' + c, `<b>${n}</b><span>${l}</span>`)))
  m.appendChild(st)

  const grid = el('div', 'grid2')

  // po termínu + tento týden
  const c1 = el('section', 'card')
  c1.appendChild(el('div', 'card-h', '<h3>Vyžaduje pozornost</h3>'))
  const list = [...over.sort((a, b) => a.due_date.localeCompare(b.due_date)), ...soon.sort((a, b) => a.due_date.localeCompare(b.due_date))]
  if (!list.length) c1.appendChild(el('div', 'empty', 'Nic po termínu ani tento týden. Dobrá práce.'))
  list.slice(0, 8).forEach(t => c1.appendChild(taskRow(t, true)))
  grid.appendChild(c1)

  // události
  const c2 = el('section', 'card')
  c2.appendChild(el('div', 'card-h', '<h3>Nejbližší události</h3>'))
  if (!upcoming.length) c2.appendChild(el('div', 'empty', 'Zatím žádné naplánované události.'))
  upcoming.forEach(e => {
    const r = el('div', 'evrow', `<div class="evd"><b>${new Date(e.starts_at).getDate()}.</b><span>${MONTHS[new Date(e.starts_at).getMonth()].slice(0, 3)}</span></div>
      <div class="evb"><b>${esc(e.title)}</b><span>${EVENT_KINDS[e.kind] || ''}${e.team_id ? ' · ' + esc(teamName(e.team_id)) : ''}${e.location ? ' · ' + esc(e.location) : ''}</span></div>
      <div class="evt">${fmtDateTime(e.starts_at)}${e.meet_url ? `<a class="btn meet xs" href="${esc(e.meet_url)}" target="_blank" rel="noopener" title="Připojit se ke schůzce">Připojit se</a>` : ''}</div>`)
    r.querySelector('.evb').onclick = () => openEvent(e)
    c2.appendChild(r)
  })
  grid.appendChild(c2)
  m.appendChild(grid)

  // plnění po týmech
  const sec = el('section', 'card')
  sec.appendChild(el('div', 'card-h', '<h3>Plnění úkolů po týmech</h3>'))
  const rows = S.teams.map(t => {
    const all = S.tasks.filter(x => x.team_id === t.id)
    const done = all.filter(x => x.status === 'done').length
    const late = all.filter(x => x.status !== 'done' && x.due_date && x.due_date < today()).length
    return { t, all: all.length, done, late, pct: all.length ? Math.round(done / all.length * 100) : 0 }
  }).filter(r => r.all > 0)
  if (!rows.length) sec.appendChild(el('div', 'empty', 'Zatím nejsou žádné úkoly přiřazené týmům.'))
  rows.forEach(r => {
    sec.appendChild(el('div', 'prow', `
      <div class="pn">${esc(r.t.name)}</div>
      <div class="bar"><i style="width:${r.pct}%"></i></div>
      <div class="pv">${r.done}/${r.all}${r.late ? ` <em>· ${r.late} po termínu</em>` : ''}</div>`))
  })
  m.appendChild(sec)

  // checklist souhrn — jen správci a výbor
  if (S.seesAll) {
    const cs = el('section', 'card')
    cs.appendChild(el('div', 'card-h', '<h3>Audit klubu — stav</h3>'))
    const cg = el('div', 'chips')
    S.lists.forEach(l => {
      const its = S.items.filter(i => i.checklist_id === l.id)
      const d = its.filter(i => i.status === 'done').length
      cg.appendChild(el('div', 'chip', `<b>${esc(l.title)}</b><span>${d} z ${its.length} splněno</span><div class="bar sm"><i style="width:${its.length ? d / its.length * 100 : 0}%"></i></div>`))
    })
    cs.appendChild(cg)
    m.appendChild(cs)
  }
}

function taskRow(t, compact) {
  const dl = daysLeft(t.due_date)
  const late = t.status !== 'done' && t.due_date && t.due_date < today()
  const r = el('div', 'trow' + (t.status === 'done' ? ' done' : '') + (late ? ' late' : ''))
  r.innerHTML = `
    <button class="chk" title="Označit jako hotové">${t.status === 'done' ? '✓' : ''}</button>
    <div class="tb">
      <b>${esc(t.title)}</b>
      <span>${t.team_id ? esc(teamName(t.team_id)) : 'Bez týmu'}${t.assignee_id ? ' · ' + esc(personName(t.assignee_id)) : ''}${t.recurrence !== 'none' ? ' · ' + REC[t.recurrence].toLowerCase() : ''}</span>
    </div>
    <div class="td ${late ? 'l' : ''}">${t.due_date ? fmtDate(t.due_date) : '—'}${!compact || !t.due_date ? '' : `<em>${late ? `${-dl} dní po` : dl === 0 ? 'dnes' : `za ${dl} dní`}</em>`}</div>`
  r.querySelector('.chk').onclick = e => { e.stopPropagation(); toggleTask(t) }
  r.onclick = () => openTask(t)
  return r
}

async function toggleTask(t) {
  const done = t.status !== 'done'
  const patch = done
    ? { status: 'done', completed_at: new Date().toISOString(), completed_by: S.me.id }
    : { status: 'todo', completed_at: null, completed_by: null }
  const { error } = await sb.from('bc_task').update(patch).eq('id', t.id)
  if (error) return toast(error.message, true)
  if (done && t.recurrence !== 'none' && t.due_date) {
    const d = new Date(t.due_date + 'T00:00:00')
    if (t.recurrence === 'weekly') d.setDate(d.getDate() + 7)
    if (t.recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
    if (t.recurrence === 'quarterly') d.setMonth(d.getMonth() + 3)
    if (t.recurrence === 'yearly') d.setFullYear(d.getFullYear() + 1)
    await sb.from('bc_task').insert({
      title: t.title, detail: t.detail, team_id: t.team_id, assignee_id: t.assignee_id,
      due_date: iso(d), priority: t.priority, recurrence: t.recurrence, created_by: S.me.id,
    })
    toast('Hotovo — vytvořen další opakovaný úkol na ' + fmtDate(iso(d)))
  } else if (done) toast('Úkol splněn')
  await loadAll(); render()
}

/* ============ ÚKOLY ============ */
function viewTasks(m) {
  const h = el('div', 'head')
  h.innerHTML = '<h2>Úkoly</h2><p>Zadávání úkolů týmům a lidem, kontrola termínů a plnění.</p>'
  const add = el('button', 'btn primary', '+ Nový úkol'); add.onclick = () => openTask(null)
  h.appendChild(add); m.appendChild(h)

  const f = el('div', 'filters')
  f.innerHTML = `
    <div class="seg" id="fs">
      ${[['open', 'Otevřené'], ['late', 'Po termínu'], ['done', 'Hotové'], ['all', 'Vše']].map(([k, l]) => `<button data-k="${k}" class="${S.filter.status === k ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <div class="seg" id="fw">
      ${[['all', 'Všichni'], ['mine', 'Moje'], ['unassigned', 'Bez odpovědné osoby']].map(([k, l]) => `<button data-k="${k}" class="${S.filter.who === k ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <select id="ft"><option value="">Všechny týmy</option>${S.teams.map(t => `<option value="${t.id}" ${S.filter.team === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
    <input id="fq" placeholder="Hledat…" value="${esc(S.filter.q)}">`
  m.appendChild(f)
  f.querySelectorAll('#fs button').forEach(b => b.onclick = () => { S.filter.status = b.dataset.k; render() })
  f.querySelectorAll('#fw button').forEach(b => b.onclick = () => { S.filter.who = b.dataset.k; render() })
  $('#ft', f).onchange = e => { S.filter.team = e.target.value; render() }
  $('#fq', f).oninput = e => { S.filter.q = e.target.value; renderTaskList() }

  const wrap = el('section', 'card'); wrap.id = 'tl'; m.appendChild(wrap)
  renderTaskList()
}
function filteredTasks() {
  let a = [...S.tasks]
  const F = S.filter
  if (F.status === 'open') a = a.filter(t => t.status !== 'done')
  if (F.status === 'done') a = a.filter(t => t.status === 'done')
  if (F.status === 'late') a = a.filter(t => t.status !== 'done' && t.due_date && t.due_date < today())
  if (F.who === 'mine') a = a.filter(t => t.assignee_id === S.me.id)
  if (F.who === 'unassigned') a = a.filter(t => !t.assignee_id)
  if (F.team) a = a.filter(t => t.team_id === F.team)
  if (F.q) { const q = F.q.toLowerCase(); a = a.filter(t => (t.title + ' ' + (t.detail || '')).toLowerCase().includes(q)) }
  return a.sort((x, y) => (x.due_date || '9999').localeCompare(y.due_date || '9999'))
}
function renderTaskList() {
  const w = $('#tl'); if (!w) return
  w.innerHTML = ''
  const a = filteredTasks()
  w.appendChild(el('div', 'card-h', `<h3>${a.length} úkolů</h3>`))
  if (!a.length) w.appendChild(el('div', 'empty', 'Žádné úkoly neodpovídají filtru.'))
  a.forEach(t => w.appendChild(taskRow(t, true)))
}

/* ============ detail úkolu ============ */
async function openTask(t) {
  const isNew = !t
  const cmts = isNew ? [] : (await sb.from('bc_task_comment').select('*').eq('task_id', t.id).order('created_at')).data || []
  modal(`${isNew ? 'Nový úkol' : 'Úkol'}`, `
    <label>Název úkolu<input id="m_title" value="${esc(t?.title)}" placeholder="Co je potřeba udělat"></label>
    <label>Popis<textarea id="m_detail" rows="3" placeholder="Doplňující informace">${esc(t?.detail)}</textarea></label>
    <div class="row">
      <label>Tým / sekce<select id="m_team"><option value="">— žádný —</option>${S.teams.map(x => `<option value="${x.id}" ${t?.team_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Odpovědná osoba<select id="m_ass"><option value="">— nikdo —</option>${S.profiles.filter(p => p.approved).map(p => `<option value="${p.id}" ${t?.assignee_id === p.id ? 'selected' : ''}>${esc(p.full_name || p.email)}</option>`).join('')}</select></label>
    </div>
    <div class="row">
      <label>Termín<input id="m_due" type="date" value="${t?.due_date || ''}"></label>
      <label>Priorita<select id="m_prio">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${(t?.priority || 'normal') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Opakování<select id="m_rec">${Object.entries(REC).map(([k, v]) => `<option value="${k}" ${(t?.recurrence || 'none') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    ${isNew ? '' : `
    <div class="cmts">
      <h4>Poznámky ke kontrole plnění</h4>
      <div id="cl">${cmts.map(c => `<div class="cmt"><b>${esc(personName(c.author_id) || '—')}</b><span>${fmtDateTime(c.created_at)}</span><p>${esc(c.body)}</p></div>`).join('') || '<div class="empty sm">Zatím bez poznámek.</div>'}</div>
      <div class="row"><input id="m_cmt" placeholder="Napsat poznámku (např. stav plnění)…"><button class="btn sm" id="m_cadd">Přidat</button></div>
    </div>`}
  `, [
    !isNew && { label: t.status === 'done' ? 'Vrátit rozpracované' : 'Označit jako hotové', cls: 'ok', act: async () => { closeModal(); toggleTask(t) } },
    !isNew && { label: 'Smazat', cls: 'danger', act: async () => { if (!confirm('Opravdu smazat tento úkol?')) return; await sb.from('bc_task').delete().eq('id', t.id); closeModal(); await loadAll(); render(); toast('Úkol smazán') } },
    { label: 'Uložit', cls: 'primary', act: saveTask },
  ].filter(Boolean))

  if (!isNew) {
    $('#m_cadd').onclick = async () => {
      const body = $('#m_cmt').value.trim(); if (!body) return
      await sb.from('bc_task_comment').insert({ task_id: t.id, author_id: S.me.id, body })
      closeModal(); openTask(t)
    }
  }
  async function saveTask() {
    const payload = {
      title: $('#m_title').value.trim(),
      detail: $('#m_detail').value.trim(),
      team_id: $('#m_team').value || null,
      assignee_id: $('#m_ass').value || null,
      due_date: $('#m_due').value || null,
      priority: $('#m_prio').value,
      recurrence: $('#m_rec').value,
    }
    if (!payload.title) return toast('Vyplň název úkolu', true)
    const r = isNew
      ? await sb.from('bc_task').insert({ ...payload, created_by: S.me.id })
      : await sb.from('bc_task').update(payload).eq('id', t.id)
    if (r.error) return toast(r.error.message, true)
    closeModal(); await loadAll(); render(); toast(isNew ? 'Úkol vytvořen' : 'Úkol uložen')
  }
}

/* ============ KALENDÁŘ ============ */
function viewCal(m) {
  const h = el('div', 'head')
  h.innerHTML = '<h2>Kalendář</h2><p>Tréninky, zápasy, schůze a hlídané termíny na jednom místě.</p>'
  const add = el('button', 'btn primary', '+ Nová událost'); add.onclick = () => openEvent(null)
  h.appendChild(add); m.appendChild(h)

  const c = new Date(S.cal)
  const bar = el('div', 'calbar')
  bar.innerHTML = `<button class="btn ghost sm" id="pv">‹</button><b>${MONTHS[c.getMonth()]} ${c.getFullYear()}</b><button class="btn ghost sm" id="nx">›</button><button class="btn ghost sm" id="tdy">Dnes</button>`
  m.appendChild(bar)
  $('#pv', bar).onclick = () => { S.cal = new Date(c.getFullYear(), c.getMonth() - 1, 1); render() }
  $('#nx', bar).onclick = () => { S.cal = new Date(c.getFullYear(), c.getMonth() + 1, 1); render() }
  $('#tdy', bar).onclick = () => { S.cal = new Date(); render() }

  const first = new Date(c.getFullYear(), c.getMonth(), 1)
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
  const g = el('div', 'cal')
  DAYS.forEach(d => g.appendChild(el('div', 'cdh', d)))
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = iso(d)
    const out = d.getMonth() !== c.getMonth()
    const cell = el('div', 'cd' + (out ? ' out' : '') + (key === today() ? ' now' : ''))
    cell.appendChild(el('div', 'cdn', String(d.getDate())))
    S.events.filter(e => iso(e.starts_at) === key).forEach(e => {
      const it = el('div', 'ce k-' + e.kind, `<b>${new Date(e.starts_at).getHours() ? new Date(e.starts_at).getHours() + ':' + String(new Date(e.starts_at).getMinutes()).padStart(2, '0') + ' ' : ''}</b>${e.meet_url ? '<i class="camic" title="Online schůzka">▶</i>' : ''}${esc(e.title)}`)
      it.onclick = ev => { ev.stopPropagation(); openEvent(e) }
      cell.appendChild(it)
    })
    S.tasks.filter(t => t.status !== 'done' && t.due_date === key).forEach(t => {
      const it = el('div', 'ce k-task', '⚑ ' + esc(t.title))
      it.onclick = ev => { ev.stopPropagation(); openTask(t) }
      cell.appendChild(it)
    })
    cell.onclick = () => openEvent(null, key)
    g.appendChild(cell)
  }
  m.appendChild(g)

  const leg = el('div', 'legend')
  leg.innerHTML = Object.entries(EVENT_KINDS).map(([k, v]) => `<span class="lg k-${k}">${v}</span>`).join('') + '<span class="lg k-task">Termín úkolu</span>'
  m.appendChild(leg)
}
function openEvent(e, presetDate) {
  const isNew = !e
  const dt = e ? new Date(e.starts_at) : null
  const dval = e ? iso(e.starts_at) : (presetDate || today())
  const tval = e ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '18:00'
  const end = e ? evEnd(e) : null
  const eval_ = end ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '19:30'
  modal(isNew ? 'Nová událost' : 'Událost', `
    <label>Název<input id="e_t" value="${esc(e?.title)}" placeholder="Např. Trénink U15"></label>
    <div class="row">
      <label>Typ<select id="e_k">${Object.entries(EVENT_KINDS).map(([k, v]) => `<option value="${k}" ${(e?.kind || 'training') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Datum<input id="e_d" type="date" value="${dval}"></label>
      <label>Od<input id="e_h" type="time" value="${tval}"></label>
      <label>Do<input id="e_e" type="time" value="${eval_}"></label>
    </div>
    <div class="row">
      <label>Tým<select id="e_team"><option value="">— klubová akce, vidí všichni —</option>${S.teams.map(x => `<option value="${x.id}" ${e?.team_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label>Místo<input id="e_l" value="${esc(e?.location)}" placeholder="Hřiště, adresa"></label>
    </div>
    <label>Odkaz na online schůzku
      <input id="e_m" value="${esc(e?.meet_url)}" placeholder="https://meet.google.com/...">
      <small class="hint">Vytvoř si schůzku na <a href="https://meet.new" target="_blank" rel="noopener">meet.new</a> a odkaz sem vlož. Funguje i Zoom nebo Teams.</small>
    </label>
    <label>Poznámka<textarea id="e_n" rows="2">${esc(e?.note)}</textarea></label>
    ${isNew ? '' : `<div class="expbar">
      <a class="btn ghost sm" id="e_gc" href="${esc(googleCalUrl(e))}" target="_blank" rel="noopener">Přidat do Google kalendáře</a>
      <button class="btn ghost sm" id="e_ics" type="button">Stáhnout .ics</button>
      ${e.meet_url ? `<a class="btn meet sm" href="${esc(e.meet_url)}" target="_blank" rel="noopener">Připojit se ke schůzce</a>` : ''}
    </div>`}
  `, [
    !isNew && { label: 'Smazat', cls: 'danger', act: async () => { if (!confirm('Smazat událost?')) return; await sb.from('bc_event').delete().eq('id', e.id); closeModal(); await loadAll(); render() } },
    {
      label: 'Uložit', cls: 'primary', act: async () => {
        const d = $('#e_d').value
        const st = new Date(d + 'T' + ($('#e_h').value || '00:00'))
        let en = $('#e_e').value ? new Date(d + 'T' + $('#e_e').value) : null
        if (en && en <= st) en = new Date(en.getTime() + 86400000) // přes půlnoc
        const p = {
          title: $('#e_t').value.trim(), kind: $('#e_k').value,
          starts_at: st.toISOString(), ends_at: en ? en.toISOString() : null,
          team_id: $('#e_team').value || null, location: $('#e_l').value.trim(),
          meet_url: $('#e_m').value.trim() || null, note: $('#e_n').value.trim(),
        }
        if (!p.title) return toast('Vyplň název události', true)
        if (p.meet_url && !/^https?:\/\//i.test(p.meet_url)) p.meet_url = 'https://' + p.meet_url
        if (isNew) p.created_by = S.me.id
        const r = isNew ? await sb.from('bc_event').insert(p) : await sb.from('bc_event').update(p).eq('id', e.id)
        if (r.error) return toast(r.error.message, true)
        closeModal(); await loadAll(); render(); toast('Uloženo')
      }
    },
  ].filter(Boolean))
  if (!isNew) $('#e_ics').onclick = () => downloadIcs(e)
}

/* ============ CHECKLISTY ============ */
function viewCheck(m) {
  const h = el('div', 'head')
  h.innerHTML = '<h2>Checklisty</h2><p>Živý audit klubu — co máme hotové, co chybí a kdo to má na starost.</p>'
  m.appendChild(h)
  S.lists.forEach(l => {
    const its = S.items.filter(i => i.checklist_id === l.id)
    const d = its.filter(i => i.status === 'done').length
    const sec = el('section', 'card')
    sec.appendChild(el('div', 'card-h', `<h3>${esc(l.title)}</h3><div class="pill">${d} / ${its.length}</div>`))
    its.forEach(i => {
      const r = el('div', 'irow')
      r.innerHTML = `
        <button class="st s-${i.status}" title="Změnit stav">${i.status === 'done' ? '✓' : i.status === 'partial' ? '~' : '×'}</button>
        <div class="ib"><b>${esc(i.title)}</b>${i.note ? `<span>${esc(i.note)}</span>` : ''}</div>
        <select class="own">${['<option value="">— vlastník —</option>', ...S.profiles.filter(p => p.approved).map(p => `<option value="${p.id}" ${i.owner_id === p.id ? 'selected' : ''}>${esc(p.full_name || p.email)}</option>`)].join('')}</select>
        <button class="btn ghost sm nt">Pozn.</button>`
      r.querySelector('.st').onclick = async () => {
        const nx = { missing: 'partial', partial: 'done', done: 'missing' }[i.status]
        await sb.from('bc_checklist_item').update({ status: nx }).eq('id', i.id)
        await loadAll(); render()
      }
      r.querySelector('.own').onchange = async ev => {
        await sb.from('bc_checklist_item').update({ owner_id: ev.target.value || null }).eq('id', i.id)
        await loadAll()
      }
      r.querySelector('.nt').onclick = async () => {
        const v = prompt('Poznámka k položce:', i.note || ''); if (v === null) return
        await sb.from('bc_checklist_item').update({ note: v }).eq('id', i.id)
        await loadAll(); render()
      }
      sec.appendChild(r)
    })
    const addw = el('div', 'addrow')
    addw.innerHTML = '<input placeholder="Přidat vlastní položku…"><button class="btn sm">Přidat</button>'
    addw.querySelector('button').onclick = async () => {
      const v = addw.querySelector('input').value.trim(); if (!v) return
      await sb.from('bc_checklist_item').insert({ checklist_id: l.id, title: v, sort: 999 })
      await loadAll(); render()
    }
    sec.appendChild(addw)
    m.appendChild(sec)
  })
}

/* ============ LIDÉ A TÝMY ============ */
function viewPeople(m) {
  const h = el('div', 'head')
  h.innerHTML = '<h2>Lidé a týmy</h2><p>Kdo je v systému, jakou drží roli a které týmy klub vede.</p>'
  m.appendChild(h)

  const pend = S.profiles.filter(p => !p.approved)
  if (pend.length && S.me.is_admin) {
    const sec = el('section', 'card warn')
    sec.appendChild(el('div', 'card-h', '<h3>Čeká na schválení</h3>'))
    pend.forEach(p => {
      const r = el('div', 'prow2', `<div><b>${esc(p.full_name || '—')}</b><span>${esc(p.email)}</span></div>`)
      const ok = el('button', 'btn primary sm', 'Schválit')
      ok.onclick = async () => { await sb.from('bc_profile').update({ approved: true }).eq('id', p.id); await loadAll(); render(); toast('Přístup schválen') }
      const no = el('button', 'btn ghost sm', 'Odmítnout')
      no.onclick = async () => { if (!confirm('Smazat tuto žádost?')) return; await sb.from('bc_profile').delete().eq('id', p.id); await loadAll(); render() }
      const b = el('div', 'ba'); b.append(ok, no); r.appendChild(b)
      sec.appendChild(r)
    })
    m.appendChild(sec)
  }

  const sec = el('section', 'card')
  sec.appendChild(el('div', 'card-h', '<h3>Členové systému</h3>'))
  S.profiles.filter(p => p.approved).forEach(p => {
    const open = S.tasks.filter(t => t.assignee_id === p.id && t.status !== 'done').length
    const late = S.tasks.filter(t => t.assignee_id === p.id && t.status !== 'done' && t.due_date && t.due_date < today()).length
    const mine = teamsOf(p.id)
    const board = mine.some(id => S.teams.find(t => t.id === id)?.kind === 'vybor')
    const r = el('div', 'prow2')
    r.innerHTML = `<div><b>${esc(p.full_name || p.email)}${p.is_admin ? ' <i class="tag">správce</i>' : ''}${board && !p.is_admin ? ' <i class="tag">výbor</i>' : ''}</b><span>${esc(p.role_title || '—')} · ${esc(p.email)}</span>
        <span class="tms">${mine.length ? mine.map(id => `<i class="tm">${esc(teamName(id))}</i>`).join('') : '<i class="tm none">bez týmu — vidí jen klubové akce</i>'}</span></div>
      <div class="cnt">${open} otevřených${late ? ` <em>· ${late} po termínu</em>` : ''}</div>`
    const b = el('div', 'ba')
    if (S.seesAll) {
      const tb = el('button', 'btn ghost sm', 'Týmy')
      tb.onclick = () => modal(`Týmy — ${p.full_name || p.email}`, `
        <p class="hint">Zaškrtnutá zařazení určují, co člen v aplikaci uvidí: úkoly a události svých týmů plus vše klubové. Členství ve Výkonném výboru odemyká plný přehled včetně auditu.</p>
        <div class="tmgrid">${S.teams.map(t => `<label class="chkline"><input type="checkbox" class="tmx" value="${t.id}" ${mine.includes(t.id) ? 'checked' : ''}> ${esc(t.name)}${t.kind === 'vybor' ? ' <i class="tag">plný přístup</i>' : ''}</label>`).join('')}</div>`,
        [{
          label: 'Uložit', cls: 'primary', act: async () => {
            const want = [...document.querySelectorAll('.tmx')].filter(x => x.checked).map(x => x.value)
            const add = want.filter(id => !mine.includes(id))
            const rem = mine.filter(id => !want.includes(id))
            if (rem.length) await sb.from('bc_membership').delete().eq('profile_id', p.id).in('team_id', rem)
            if (add.length) await sb.from('bc_membership').insert(add.map(team_id => ({ profile_id: p.id, team_id })))
            closeModal(); await loadAll(); render(); toast('Zařazení uloženo')
          }
        }])
      b.appendChild(tb)
    }
    if (S.me.is_admin || p.id === S.me.id) {
      const ed = el('button', 'btn ghost sm', 'Upravit')
      ed.onclick = () => modal('Upravit člena', `
        <label>Jméno a příjmení<input id="p_n" value="${esc(p.full_name)}"></label>
        <label>Role v klubu<input id="p_r" value="${esc(p.role_title)}" placeholder="např. Sportovní ředitel"></label>
        <label>Telefon<input id="p_t" value="${esc(p.phone)}"></label>
        ${S.me.is_admin ? `<label class="chkline"><input type="checkbox" id="p_a" ${p.is_admin ? 'checked' : ''}> Správce systému (může schvalovat přístupy)</label>` : ''}`,
        [{
          label: 'Uložit', cls: 'primary', act: async () => {
            const up = { full_name: $('#p_n').value.trim(), role_title: $('#p_r').value.trim(), phone: $('#p_t').value.trim() }
            if (S.me.is_admin) up.is_admin = $('#p_a').checked
            await sb.from('bc_profile').update(up).eq('id', p.id)
            closeModal(); await loadAll(); render(); toast('Uloženo')
          }
        }])
      b.appendChild(ed)
    }
    r.appendChild(b)
    sec.appendChild(r)
  })
  m.appendChild(sec)

  const ts = el('section', 'card')
  ts.appendChild(el('div', 'card-h', '<h3>Týmy a sekce</h3>'))
  const tg = el('div', 'teams')
  S.teams.forEach(t => {
    const n = S.tasks.filter(x => x.team_id === t.id && x.status !== 'done').length
    const c = el('div', 'tcard', `<b>${esc(t.name)}</b><span>${t.kind === 'vybor' ? 'Orgán klubu' : t.kind === 'sekce' ? 'Sekce' : 'Tým'} · ${n} otevřených úkolů</span>`)
    tg.appendChild(c)
  })
  ts.appendChild(tg)
  const addw = el('div', 'addrow')
  addw.innerHTML = '<input placeholder="Název nového týmu / sekce…"><button class="btn sm">Přidat</button>'
  addw.querySelector('button').onclick = async () => {
    const v = addw.querySelector('input').value.trim(); if (!v) return
    await sb.from('bc_team').insert({ name: v, sort: 900 }); await loadAll(); render()
  }
  ts.appendChild(addw)
  m.appendChild(ts)
}

/* ============ modal ============ */
function modal(title, body, actions) {
  closeModal()
  const w = el('div', 'mw'); w.id = 'mw'
  w.innerHTML = `<div class="mc"><div class="mh"><h3>${esc(title)}</h3><button class="x">×</button></div><div class="mb">${body}</div><div class="mf"></div></div>`
  const f = w.querySelector('.mf')
  actions.forEach(a => { const b = el('button', 'btn ' + (a.cls || ''), a.label); b.onclick = a.act; f.appendChild(b) })
  w.querySelector('.x').onclick = closeModal
  w.onclick = e => { if (e.target === w) closeModal() }
  document.body.appendChild(w)
}
function closeModal() { $('#mw')?.remove() }

/* ============ start ============ */
async function boot() {
  const { data } = await sb.auth.getSession()
  if (!data.session) return renderAuth()
  S.user = data.session.user
  let { data: prof } = await sb.from('bc_profile').select('*').eq('id', S.user.id).maybeSingle()
  if (!prof) {
    const { data: made } = await sb.rpc('bc_claim_profile', { p_name: S.user.user_metadata?.full_name || '' })
    prof = made
  }
  if (!prof) { S.me = { id: S.user.id, email: S.user.email }; return renderPending() }
  S.me = prof
  if (!prof.approved) return renderPending()
  await loadAll()
  render()
}
boot()
