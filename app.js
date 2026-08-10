import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm'

const SUPABASE_URL = 'https://xrcgxanzbzflvpvmygrd.supabase.co'
const SUPABASE_KEY = 'sb_publishable_BfQMClCwUxXF354tkp5F1w_meU8d5u3'
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

/* ============ stav ============ */
const S = {
  user: null, me: null,
  profiles: [], teams: [], tasks: [], events: [], lists: [], items: [], memberships: [], notes: [], docs: [], people: [], rubrics: [], posts: [],
  view: 'dash',
  filter: { who: 'all', team: '', status: 'open', q: '' },
  docFilter: { team: '', q: '' },
  mktFilter: { status: 'plan', rubric: '' },
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
function personName(id) { const p = S.people.find(p => p.id === id) || S.profiles.find(p => p.id === id); return p ? (p.full_name || p.email) : '' }
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
const DOC_CATS = {
  smernice: 'Směrnice a řády',
  propozice: 'Propozice a rozpisy soutěží',
  formular: 'Formuláře a přihlášky',
  zapis: 'Zápisy a usnesení',
  smlouva: 'Smlouvy a dotace',
  ostatni: 'Ostatní',
}
const CHANNELS = { ig: 'Instagram', fb: 'Facebook', tt: 'TikTok', yt: 'YouTube', web: 'Web' }
const POST_STATUS = { napad: 'Nápad', psani: 'Připravuje se', schvaleni: 'Ke schválení', naplanovano: 'Naplánováno', zverejneno: 'Zveřejněno' }
const CADENCE = { tydne: 'Každý týden', dvakrat: '2× měsíčně', mesicne: 'Každý měsíc', sezonne: 'Sezónně / nárazově' }
const fmtSize = b => !b ? '' : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' kB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB'
const fileIcon = n => {
  const e = (n || '').split('.').pop().toLowerCase()
  if (['pdf'].includes(e)) return 'PDF'
  if (['doc', 'docx', 'odt', 'rtf'].includes(e)) return 'DOC'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(e)) return 'XLS'
  if (['ppt', 'pptx'].includes(e)) return 'PPT'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(e)) return 'IMG'
  if (['zip', 'rar', '7z'].includes(e)) return 'ZIP'
  return e.slice(0, 3).toUpperCase() || 'SOU'
}

/* ============ data ============ */
async function loadAll() {
  const [pr, tm, tk, ev, cl, ci, ms, nt, dc, pe, ru, po] = await Promise.all([
    sb.from('bc_profile').select('*').order('full_name'),
    sb.from('bc_team').select('*').order('sort'),
    sb.from('bc_task').select('*').order('due_date', { nullsFirst: false }),
    sb.from('bc_event').select('*').order('starts_at'),
    sb.from('bc_checklist').select('*').order('sort'),
    sb.from('bc_checklist_item').select('*').order('sort'),
    sb.from('bc_membership').select('*'),
    sb.from('bc_notification').select('*').order('created_at', { ascending: false }).limit(40),
    sb.from('bc_document').select('*').order('created_at', { ascending: false }),
    sb.rpc('bc_people'),
    sb.from('bc_post_rubric').select('*').order('sort'),
    sb.from('bc_post').select('*').order('publish_on', { nullsFirst: false }),
  ])
  S.rubrics = ru.data || []; S.posts = po.data || []
  S.docs = dc.data || []
  // jména všech členů bez kontaktních údajů — kvůli popiskům u úkolů, poznámek a dokumentů
  S.people = (pe.data || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'cs'))
  S.profiles = pr.data || []; S.teams = tm.data || []; S.tasks = tk.data || []
  S.events = ev.data || []; S.lists = cl.data || []; S.items = ci.data || []
  S.memberships = ms.data || []; S.notes = nt.data || []
  S.me = S.profiles.find(p => p.id === S.user.id) || S.me
  S.seesAll = !!S.me.is_admin || S.memberships.some(m => m.profile_id === S.me.id && S.teams.find(t => t.id === m.team_id)?.kind === 'vybor')
  S.myTeams = S.memberships.filter(m => m.profile_id === S.me.id).map(m => m.team_id)
  S.isMkt = S.seesAll || S.myTeams.some(id => S.teams.find(t => t.id === id)?.name === 'Sekce marketing')
}
const teamsOf = id => S.memberships.filter(m => m.profile_id === id).map(m => m.team_id)
// odpovědné osoby úkolu — může jich být víc
const assignees = t => (t?.assignee_ids && t.assignee_ids.length ? t.assignee_ids : (t?.assignee_id ? [t.assignee_id] : []))
const hasAssignee = (t, id) => assignees(t).includes(id)
const assigneeLabel = t => {
  const a = assignees(t)
  if (!a.length) return ''
  if (a.length <= 2) return a.map(personName).join(', ')
  return `${personName(a[0])} a další ${a.length - 1}`
}
// týmy, se kterými má smysl pracovat: správci a výbor všechny, ostatní jen svoje
const myTeams = () => S.seesAll ? S.teams : S.teams.filter(t => S.myTeams.includes(t.id))
const teamOptions = (sel, extra) => `<option value="">${extra}</option>` +
  myTeams().map(t => `<option value="${t.id}" ${sel === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('') +
  // tým, který už je nastavený, ale do výběru nepatří, ať se nastavení omylem nepřepíše
  (sel && !myTeams().some(t => t.id === sel) ? `<option value="${sel}" selected>${esc(teamName(sel))}</option>` : '')

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
  parts.push('Příbram Bobcats — Management klubu')
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
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pribram Bobcats//Management klubu//CS',
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
      <h1 class="auth-h1">Management klubu</h1>
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
  ['dash', 'Přehled'], ['tasks', 'Úkoly'], ['cal', 'Kalendář'], ['docs', 'Dokumenty'], ['mkt', 'Marketing'], ['check', 'Checklisty'], ['people', 'Lidé a týmy'],
]
function renderShell() {
  document.body.className = ''
  document.body.innerHTML = `
  <header class="top">
    <div class="brand"><img src="./logo-white.png"><div><b>Příbram Bobcats</b><span>Management klubu</span></div></div>
    <nav class="nav">${NAV.filter(([k]) => k === 'mkt' ? S.isMkt : ((k !== 'check' && k !== 'people') || S.seesAll)).map(([k, l]) => `<button data-v="${k}" class="${S.view === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
    <div class="me">
      <div class="bell" id="bell" title="Upozornění">
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path fill="currentColor" d="M12 22a2.1 2.1 0 0 0 2.1-2.1H9.9A2.1 2.1 0 0 0 12 22Zm6.3-6.3v-5.2c0-3.2-1.7-5.9-4.7-6.6v-.7a1.6 1.6 0 0 0-3.2 0v.7c-3 .7-4.7 3.4-4.7 6.6v5.2L3.6 17.5v.9h16.8v-.9Z"/></svg>
        ${unreadCount() ? `<i class="dot">${unreadCount() > 9 ? '9+' : unreadCount()}</i>` : ''}
      </div>
      <div class="who"><b>${esc(S.me.full_name || S.me.email)}</b><span>${esc(S.me.role_title || (S.me.is_admin ? 'správce' : 'člen'))}</span></div>
      <button class="btn ghost sm" id="logout">Odhlásit</button>
    </div>
  </header>
  <main id="main"></main>`
  document.querySelectorAll('.nav button').forEach(b => b.onclick = () => { S.view = b.dataset.v; render() })
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload() }
  $('#bell').onclick = e => { e.stopPropagation(); toggleNotes() }
}

/* ============ upozornění ============ */
const unreadCount = () => S.notes.filter(n => !n.read_at).length
async function refreshNotes(rerender) {
  const { data } = await sb.from('bc_notification').select('*').order('created_at', { ascending: false }).limit(40)
  const before = unreadCount()
  S.notes = data || []
  if (rerender && unreadCount() !== before) render()
}
function noteText(n) {
  const who = personName(n.actor_id) || 'Někdo'
  if (n.kind === 'assigned') return `<b>${esc(who)}</b> ti přidělil úkol <em>${esc(n.task_title)}</em>`
  return `<b>${esc(who)}</b> okomentoval úkol <em>${esc(n.task_title)}</em>${n.body ? `<span class="q">„${esc(n.body)}"</span>` : ''}`
}
function toggleNotes() {
  const open = $('#npanel')
  if (open) return open.remove()
  const p = el('div', 'npanel'); p.id = 'npanel'
  const unread = unreadCount()
  p.innerHTML = `<div class="nph"><b>Upozornění</b>${unread ? '<button class="lnk" id="nall">Označit vše jako přečtené</button>' : ''}</div>`
  const list = el('div', 'nlist')
  if (!S.notes.length) list.appendChild(el('div', 'empty sm', 'Zatím nic nového.'))
  S.notes.forEach(n => {
    const r = el('div', 'nrow' + (n.read_at ? '' : ' new'), `<div class="nb">${noteText(n)}</div><span class="nt">${fmtDateTime(n.created_at)}</span>`)
    r.onclick = async () => {
      p.remove()
      if (!n.read_at) { await sb.from('bc_notification').update({ read_at: new Date().toISOString() }).eq('id', n.id); await refreshNotes() }
      const t = S.tasks.find(x => x.id === n.task_id)
      if (t) { S.view = 'tasks'; render(); openTask(t) }
      else { render(); toast('Úkol už není dostupný', true) }
    }
    list.appendChild(r)
  })
  p.appendChild(list)
  document.body.appendChild(p)
  const close = ev => { if (!p.contains(ev.target)) { p.remove(); document.removeEventListener('click', close) } }
  setTimeout(() => document.addEventListener('click', close), 0)
  if (unread) $('#nall', p).onclick = async ev => {
    ev.stopPropagation(); p.remove()
    await sb.from('bc_notification').update({ read_at: new Date().toISOString() }).is('read_at', null)
    await refreshNotes(); render()
  }
}
function render() {
  renderShell()
  const m = $('#main')
  if (S.view === 'dash') viewDash(m)
  if (S.view === 'tasks') viewTasks(m)
  if (S.view === 'cal') viewCal(m)
  if (S.view === 'docs') viewDocs(m)
  if (S.view === 'mkt') { if (S.isMkt) viewMkt(m); else { S.view = 'dash'; return render() } }
  if (S.view === 'check') { if (S.seesAll) viewCheck(m); else { S.view = 'dash'; return render() } }
  if (S.view === 'people') { if (S.seesAll) viewPeople(m); else { S.view = 'dash'; return render() } }
}

/* ============ PŘEHLED ============ */
function viewDash(m) {
  const open = S.tasks.filter(t => t.status !== 'done')
  const over = open.filter(t => t.due_date && t.due_date < today())
  const soon = open.filter(t => t.due_date && daysLeft(t.due_date) >= 0 && daysLeft(t.due_date) <= 7)
  const mine = open.filter(t => hasAssignee(t, S.me.id))
  const given = open.filter(t => t.created_by === S.me.id)
  const givenLate = given.filter(t => t.due_date && t.due_date < today())
  const upcoming = S.events.filter(e => new Date(e.starts_at) >= new Date(today())).slice(0, 6)

  m.appendChild(el('div', 'head', `<h2>Přehled</h2><p>${new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>`))

  // dlaždice vedou po kliknutí do Úkolů na odpovídající filtr
  const st = el('div', 'stats')
  const cards = [
    [over.length, 'Po termínu', over.length ? 'red' : '', { status: 'late', who: 'all' }],
    [soon.length, 'Termín do 7 dnů', '', { status: 'open', who: 'all' }],
    [mine.length, 'Moje otevřené úkoly', '', { status: 'open', who: 'mine' }],
    [given.length, 'Úkoly, které jsem zadal', '', { status: 'open', who: 'created' }],
    [givenLate.length, 'Ze zadaných po termínu', givenLate.length ? 'red' : '', { status: 'late', who: 'created' }],
  ]
  cards.forEach(([n, l, c, f]) => {
    const card = el('div', 'stat go ' + c, `<b>${n}</b><span>${l}</span>`)
    card.onclick = () => { S.filter = { ...S.filter, ...f, team: '', q: '' }; S.view = 'tasks'; render() }
    st.appendChild(card)
  })
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

  // co jsem zadal a čeká to na ostatní
  const waiting = given.filter(t => !hasAssignee(t, S.me.id))
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  const gs = el('section', 'card')
  gs.appendChild(el('div', 'card-h', `<h3>Zadal jsem — čeká na ostatní</h3>${givenLate.length ? `<span class="pill">${givenLate.length} po termínu</span>` : ''}`))
  if (!waiting.length) gs.appendChild(el('div', 'empty', 'Nikomu jsi teď nic nezadal, nebo je vše hotové.'))
  waiting.slice(0, 8).forEach(t => gs.appendChild(taskRow(t, true)))
  if (waiting.length > 8) {
    const more = el('div', 'moreline', `<button class="lnk">Zobrazit všech ${waiting.length}</button>`)
    more.querySelector('button').onclick = () => { S.filter = { ...S.filter, status: 'open', who: 'created', team: '', q: '' }; S.view = 'tasks'; render() }
    gs.appendChild(more)
  }
  m.appendChild(gs)

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

// upravovat a mazat smí jen zadavatel, správce navíc pro případ nouze
const canEdit = t => !t || !t.created_by || t.created_by === S.me.id || S.me.is_admin
const prioTag = p => p === 'high' ? '<i class="pr hi" title="Vysoká priorita">Vysoká</i>'
  : p === 'low' ? '<i class="pr lo" title="Nízká priorita">Nízká</i>' : ''

function taskRow(t, compact) {
  const dl = daysLeft(t.due_date)
  const late = t.status !== 'done' && t.due_date && t.due_date < today()
  const r = el('div', 'trow p-' + (t.priority || 'normal') + (t.status === 'done' ? ' done' : '') + (late ? ' late' : ''))
  r.innerHTML = `
    <button class="chk" title="Označit jako hotové">${t.status === 'done' ? '✓' : ''}</button>
    <div class="tb">
      <b>${prioTag(t.priority)}${esc(t.title)}</b>
      <span>${t.team_id ? esc(teamName(t.team_id)) : 'Bez týmu'}${assignees(t).length ? ' · ' + esc(assigneeLabel(t)) : ''}${t.recurrence !== 'none' ? ' · ' + REC[t.recurrence].toLowerCase() : ''}</span>
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
      title: t.title, detail: t.detail, team_id: t.team_id, assignee_ids: assignees(t),
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
      ${[['all', 'Všichni'], ['mine', 'Moje'], ['created', 'Zadal jsem'], ['unassigned', 'Bez odpovědné osoby']].map(([k, l]) => `<button data-k="${k}" class="${S.filter.who === k ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <select id="ft">${teamOptions(S.filter.team, S.seesAll ? 'Všechny týmy' : 'Vše, co mi patří')}</select>
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
  if (F.who === 'mine') a = a.filter(t => hasAssignee(t, S.me.id))
  if (F.who === 'created') a = a.filter(t => t.created_by === S.me.id)
  if (F.who === 'unassigned') a = a.filter(t => !assignees(t).length)
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
  const ro = !canEdit(t)
  const d = ro ? ' disabled' : ''
  const cmts = isNew ? [] : (await sb.from('bc_task_comment').select('*').eq('task_id', t.id).order('created_at')).data || []
  modal(`${isNew ? 'Nový úkol' : 'Úkol'}`, `
    ${ro ? `<p class="ronote">Úkol zadal <b>${esc(personName(t.created_by) || 'někdo jiný')}</b>, takže ho může upravovat a mazat jen on. Ty k němu můžeš psát poznámky a odškrtnout ho v seznamu jako hotový.</p>` : ''}
    ${isNew ? '' : `<p class="stnote">${t.status === 'done' ? 'Úkol je splněný.' : 'Úkol je otevřený.'} Stav se přepíná čtverečkem u úkolu v seznamu.</p>`}
    <label>Název úkolu<input id="m_title" value="${esc(t?.title)}" placeholder="Co je potřeba udělat"${d}></label>
    <label>Popis<textarea id="m_detail" rows="3" placeholder="Doplňující informace"${d}>${esc(t?.detail)}</textarea></label>
    <label>Tým / sekce<select id="m_team"${d}>${teamOptions(t?.team_id, '— klubové, vidí všichni —')}</select></label>
    <label>Odpovědné osoby
      <div class="asswrap">
        <input id="m_assq" class="assq" placeholder="Hledat jméno…"${d}>
        <div class="assgrid" id="m_assgrid">${S.people.filter(p => p.approved).map(p =>
          `<label class="chkline asso" data-n="${esc((p.full_name || '').toLowerCase())}"><input type="checkbox" class="assx" value="${p.id}" ${assignees(t).includes(p.id) ? 'checked' : ''}${d}> ${esc(p.full_name)}</label>`).join('')}</div>
      </div>
      <small class="hint">Zaškrtni všechny, kdo úkol dostanou. Upozornění přijde každému z nich a úkol se jim objeví mezi „Moje“.</small>
    </label>
    <div class="row">
      <label>Termín<input id="m_due" type="date" value="${t?.due_date || ''}"${d}></label>
      <label>Priorita<select id="m_prio"${d}>${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${(t?.priority || 'normal') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Opakování<select id="m_rec"${d}>${Object.entries(REC).map(([k, v]) => `<option value="${k}" ${(t?.recurrence || 'none') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    ${isNew ? '' : `
    <div class="cmts">
      <h4>Poznámky ke kontrole plnění</h4>
      <div id="cl">${cmts.map(c => `<div class="cmt"><b>${esc(personName(c.author_id) || '—')}</b><span>${fmtDateTime(c.created_at)}</span><p>${esc(c.body)}</p></div>`).join('') || '<div class="empty sm">Zatím bez poznámek.</div>'}</div>
      <div class="row"><input id="m_cmt" placeholder="Napsat poznámku (např. stav plnění)…"><button class="btn sm" id="m_cadd">Přidat</button></div>
    </div>`}
  `, [
    !isNew && !ro && { label: 'Smazat', cls: 'danger', act: async () => { if (!confirm('Opravdu smazat tento úkol?')) return; const { error } = await sb.from('bc_task').delete().eq('id', t.id); if (error) return toast(error.message, true); closeModal(); await loadAll(); render(); toast('Úkol smazán') } },
    !ro && { label: 'Uložit', cls: 'primary', act: saveTask },
  ].filter(Boolean))

  if (!isNew) {
    $('#m_cadd').onclick = async () => {
      const body = $('#m_cmt').value.trim(); if (!body) return
      const { error } = await sb.from('bc_task_comment').insert({ task_id: t.id, author_id: S.me.id, body })
      if (error) return toast(error.message, true)
      closeModal(); openTask(t)
    }
  }
  // hledání ve jménech + zaškrtnutí se drží nahoře
  const q = $('#m_assq')
  if (q) q.oninput = () => {
    const v = q.value.trim().toLowerCase()
    document.querySelectorAll('.asso').forEach(l => {
      l.style.display = !v || l.dataset.n.includes(v) || l.querySelector('input').checked ? '' : 'none'
    })
  }
  async function saveTask() {
    const payload = {
      title: $('#m_title').value.trim(),
      detail: $('#m_detail').value.trim(),
      team_id: $('#m_team').value || null,
      assignee_ids: [...document.querySelectorAll('.assx')].filter(x => x.checked).map(x => x.value),
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

/* ============ MARKETING ============ */
const CHAN_ICON = {
  fb: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 21.9v-8.4h2.8l.42-3.26H13.5V8.16c0-.94.26-1.58 1.61-1.58h1.72V3.66c-.3-.04-1.32-.13-2.51-.13-2.49 0-4.19 1.52-4.19 4.3v2.4H7.32v3.27h2.81v8.4h3.37z"/></svg>',
  ig: '<svg viewBox="0 0 24 24"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="2.1"/><circle cx="17.4" cy="6.6" r="1.35" fill="currentColor"/></svg>',
  tt: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.56c.26 0 .52.04.77.11V9.7a5.67 5.67 0 0 0-.77-.05 5.66 5.66 0 1 0 5.66 5.65V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.22-1.48z"/></svg>',
  yt: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21.6 7.2s-.2-1.4-.8-2c-.75-.8-1.6-.8-2-.85C16 4.2 12 4.2 12 4.2s-4 0-6.8.15c-.4.05-1.25.05-2 .85-.6.6-.8 2-.8 2S2.2 8.85 2.2 10.5v1.54c0 1.65.2 3.3.2 3.3s.2 1.4.8 2c.75.8 1.74.78 2.2.86 1.6.15 6.8.2 6.8.2s4 0 6.8-.21c.4-.05 1.25-.05 2-.85.6-.6.8-2 .8-2s.2-1.65.2-3.3V10.5c0-1.65-.2-3.3-.2-3.3zM9.9 14.2V8.9l5.15 2.66-5.15 2.64z"/></svg>',
  web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" d="M3.1 12h17.8M12 3.1c2.3 2.4 3.5 5.5 3.5 8.9s-1.2 6.5-3.5 8.9c-2.3-2.4-3.5-5.5-3.5-8.9s1.2-6.5 3.5-8.9z"/></svg>',
}
const chanTags = a => (a || []).map(c =>
  `<i class="ch c-${c}" title="${CHANNELS[c] || c}" aria-label="${CHANNELS[c] || c}">${CHAN_ICON[c] || ''}</i>`).join('')
const chanBoxes = (id, sel) => Object.entries(CHANNELS).map(([k, v]) =>
  `<label class="chkline inline"><input type="checkbox" class="${id}" value="${k}" ${(sel || []).includes(k) ? 'checked' : ''}> <i class="ch c-${k}">${CHAN_ICON[k] || ''}</i> ${v}</label>`).join('')

// každá rubrika dostane vlastní barvu, ať se v plánu poznají na první pohled
const RUB_COLORS = ['#C00000', '#1B5FA8', '#1B7F3B', '#6A3FA0', '#C2660A', '#0F7C7C', '#A81B63', '#4A5568']
const rubColor = id => RUB_COLORS[Math.max(0, S.rubrics.findIndex(r => r.id === id)) % RUB_COLORS.length]
const rubChip = id => {
  const r = S.rubrics.find(x => x.id === id)
  if (!r) return ''
  const c = rubColor(id)
  return `<i class="rchip" style="color:${c};border-color:${c}33;background:${c}12">${esc(r.title)}</i>`
}
const picked = cls => [...document.querySelectorAll('.' + cls)].filter(x => x.checked).map(x => x.value)

function viewMkt(m) {
  const h = el('div', 'head')
  h.innerHTML = '<h2>Marketing</h2><p>Stálé rubriky a plán příspěvků na sociální sítě.</p>'
  const ar = el('button', 'btn ghost', '+ Rubrika'); ar.onclick = () => openRubric(null)
  const ap = el('button', 'btn primary', '+ Příspěvek'); ap.onclick = () => openPost(null)
  h.append(ar, ap); m.appendChild(h)

  // ---- rubriky ----
  const rs = el('section', 'card')
  rs.appendChild(el('div', 'card-h', '<h3>Rubriky — co pravidelně vydáváme</h3>'))
  if (!S.rubrics.length) rs.appendChild(el('div', 'empty', 'Zatím žádné rubriky. Rubrika je stálý typ obsahu, třeba „Sestřih ze zápasu" nebo „Představení hráče" — určíš u ní sítě, jak často vychází a kdo ji má na starost.'))
  const rg = el('div', 'rubs')
  S.rubrics.forEach(r => {
    const cnt = S.posts.filter(p => p.rubric_id === r.id).length
    const c = el('div', 'rub')
    c.style.setProperty('--rc', rubColor(r.id))
    c.innerHTML = `<b>${esc(r.title)}</b>
      <span class="rc">${chanTags(r.channels)}</span>
      <span class="rm">${r.cadence ? esc(CADENCE[r.cadence] || r.cadence) : 'bez pevné frekvence'}${r.owner_id ? ' · ' + esc(personName(r.owner_id)) : ''} · ${cnt} příspěvků</span>
      ${r.description ? `<span class="rd">${esc(r.description)}</span>` : ''}`
    c.onclick = () => openRubric(r)
    rg.appendChild(c)
  })
  if (S.rubrics.length) rs.appendChild(rg)
  m.appendChild(rs)

  // ---- plán ----
  const f = el('div', 'filters')
  f.innerHTML = `
    <div class="seg" id="ps">
      ${[['plan', 'V plánu'], ['all', 'Vše'], ...Object.entries(POST_STATUS)].map(([k, l]) => `<button data-k="${k}" class="${(S.mktFilter.status || 'plan') === k ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <select id="pr"><option value="">Všechny rubriky</option>${S.rubrics.map(r => `<option value="${r.id}" ${S.mktFilter.rubric === r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select>`
  m.appendChild(f)
  f.querySelectorAll('#ps button').forEach(b => b.onclick = () => { S.mktFilter.status = b.dataset.k; render() })
  $('#pr', f).onchange = e => { S.mktFilter.rubric = e.target.value; render() }

  let a = [...S.posts]
  const st = S.mktFilter.status || 'plan'
  if (st === 'plan') a = a.filter(p => p.status !== 'zverejneno')
  else if (st !== 'all') a = a.filter(p => p.status === st)
  if (S.mktFilter.rubric) a = a.filter(p => p.rubric_id === S.mktFilter.rubric)
  a.sort((x, y) => (x.publish_on || '9999').localeCompare(y.publish_on || '9999'))

  const sec = el('section', 'card')
  sec.appendChild(el('div', 'card-h', `<h3>Plán příspěvků</h3><span class="pill">${a.length}</span>`))
  if (!a.length) sec.appendChild(el('div', 'empty', S.posts.length ? 'Žádný příspěvek neodpovídá filtru.' : 'Zatím tu nic není. Přidej první příspěvek tlačítkem nahoře.'))

  let lastMonth = null
  a.forEach(p => {
    const key = p.publish_on ? p.publish_on.slice(0, 7) : 'bez'
    if (key !== lastMonth) {
      lastMonth = key
      const lbl = p.publish_on
        ? `${MONTHS[+p.publish_on.slice(5, 7) - 1]} ${p.publish_on.slice(0, 4)}`
        : 'Bez data'
      sec.appendChild(el('div', 'mhead', esc(lbl)))
    }
    sec.appendChild(postRow(p))
  })
  m.appendChild(sec)
}
function postRow(p) {
  const late = p.publish_on && p.publish_on < today() && p.status !== 'zverejneno'
  const r = el('div', 'porow' + (late ? ' late' : ''))
  const d = p.publish_on ? new Date(p.publish_on + 'T00:00:00') : null
  r.innerHTML = `
    <div class="pod">${d ? `<b>${d.getDate()}.</b><span>${DAYS[(d.getDay() + 6) % 7]}</span>` : '<b>—</b>'}</div>
    <div class="pob">
      <b>${esc(p.title)}</b>
      <span>${chanTags(p.channels)}${rubChip(p.rubric_id)}${p.owner_id ? ' ' + esc(personName(p.owner_id)) : ''}${p.publish_time ? ' · ' + p.publish_time.slice(0, 5) : ''}</span>
      ${p.body ? `<span class="pox">${esc(p.body.slice(0, 120))}${p.body.length > 120 ? '…' : ''}</span>` : ''}
    </div>
    <button class="post-st go s-${p.status}" title="Klepnutím změníš stav">${POST_STATUS[p.status] || p.status}</button>`
  r.onclick = () => openPost(p)
  r.querySelector('.post-st').onclick = e => { e.stopPropagation(); statusMenu(e.currentTarget, p) }
  return r
}
// změna stavu přímo v seznamu, bez otevírání příspěvku
function statusMenu(anchor, p) {
  $('#stmenu')?.remove()
  const box = anchor.getBoundingClientRect()
  const menu = el('div', 'stmenu'); menu.id = 'stmenu'
  Object.entries(POST_STATUS).forEach(([k, v]) => {
    const b = el('button', 'sti s-' + k + (k === p.status ? ' on' : ''), `<i></i>${v}`)
    b.onclick = async ev => {
      ev.stopPropagation(); menu.remove()
      if (k === p.status) return
      const { error } = await sb.from('bc_post').update({ status: k }).eq('id', p.id)
      if (error) return toast(error.message, true)
      await loadAll(); render(); toast('Stav změněn na „' + v + '"')
    }
    menu.appendChild(b)
  })
  document.body.appendChild(menu)
  const h = menu.offsetHeight
  menu.style.top = (box.bottom + h + 8 > innerHeight ? Math.max(8, box.top - h - 6) : box.bottom + 6) + 'px'
  menu.style.left = Math.max(8, Math.min(box.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px'
  const close = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close) } }
  setTimeout(() => document.addEventListener('click', close), 0)
  document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', esc) } })
}
function openRubric(r) {
  const isNew = !r
  modal(isNew ? 'Nová rubrika' : 'Rubrika', `
    <label>Název rubriky<input id="r_t" value="${esc(r?.title)}" placeholder="Např. Sestřih ze zápasu"></label>
    <label>K čemu je<textarea id="r_d" rows="2" placeholder="Co se v rubrice vydává a proč">${esc(r?.description)}</textarea></label>
    <label>Sítě<div class="chks">${chanBoxes('rch', r?.channels)}</div></label>
    <div class="row">
      <label>Jak často<select id="r_c"><option value="">— neurčeno —</option>${Object.entries(CADENCE).map(([k, v]) => `<option value="${k}" ${r?.cadence === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Kdo má na starost<select id="r_o"><option value="">— nikdo —</option>${S.people.filter(p => p.approved).map(p => `<option value="${p.id}" ${r?.owner_id === p.id ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('')}</select></label>
    </div>
  `, [
    !isNew && {
      label: 'Smazat', cls: 'danger', act: async () => {
        if (!confirm('Smazat rubriku? Příspěvky zůstanou, jen ztratí zařazení.')) return
        const { error } = await sb.from('bc_post_rubric').delete().eq('id', r.id)
        if (error) return toast(error.message, true)
        closeModal(); await loadAll(); render(); toast('Rubrika smazána')
      }
    },
    {
      label: 'Uložit', cls: 'primary', act: async () => {
        const up = {
          title: $('#r_t').value.trim(), description: $('#r_d').value.trim() || null,
          channels: picked('rch'), cadence: $('#r_c').value || null, owner_id: $('#r_o').value || null,
        }
        if (!up.title) return toast('Vyplň název rubriky', true)
        const q = isNew ? await sb.from('bc_post_rubric').insert({ ...up, sort: 100 + S.rubrics.length })
          : await sb.from('bc_post_rubric').update(up).eq('id', r.id)
        if (q.error) return toast(q.error.message, true)
        closeModal(); await loadAll(); render(); toast('Uloženo')
      }
    },
  ].filter(Boolean))
}
function openPost(p) {
  const isNew = !p
  modal(isNew ? 'Nový příspěvek' : 'Příspěvek', `
    <label>Název / téma<input id="p_t" value="${esc(p?.title)}" placeholder="Např. Sestřih ze zápasu s Ostravou"></label>
    <div class="row">
      <label>Rubrika<select id="p_r"><option value="">— bez rubriky —</option>${S.rubrics.map(r => `<option value="${r.id}" ${p?.rubric_id === r.id ? 'selected' : ''}>${esc(r.title)}</option>`).join('')}</select></label>
      <label>Stav<select id="p_s">${Object.entries(POST_STATUS).map(([k, v]) => `<option value="${k}" ${(p?.status || 'napad') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <label>Sítě<div class="chks">${chanBoxes('pch', p?.channels)}</div></label>
    <div class="row">
      <label>Datum vydání<input id="p_d" type="date" value="${p?.publish_on || ''}"></label>
      <label>Čas<input id="p_h" type="time" value="${p?.publish_time ? p.publish_time.slice(0, 5) : ''}"></label>
      <label>Kdo připraví<select id="p_o"><option value="">— nikdo —</option>${S.people.filter(x => x.approved).map(x => `<option value="${x.id}" ${p?.owner_id === x.id ? 'selected' : ''}>${esc(x.full_name)}</option>`).join('')}</select></label>
    </div>
    <label>Text příspěvku<textarea id="p_b" rows="4" placeholder="Návrh textu, hashtagy, popisek…">${esc(p?.body)}</textarea></label>
    <label>Odkaz na fotky nebo video<input id="p_a" value="${esc(p?.asset_url)}" placeholder="Odkaz na Disk, Dropbox…"></label>
    <label>Poznámka<textarea id="p_n" rows="2" placeholder="Co ještě chybí, na co si dát pozor">${esc(p?.note)}</textarea></label>
  `, [
    !isNew && {
      label: 'Smazat', cls: 'danger', act: async () => {
        if (!confirm('Opravdu smazat tento příspěvek?')) return
        const { error } = await sb.from('bc_post').delete().eq('id', p.id)
        if (error) return toast(error.message, true)
        closeModal(); await loadAll(); render(); toast('Příspěvek smazán')
      }
    },
    {
      label: 'Uložit', cls: 'primary', act: async () => {
        let url = $('#p_a').value.trim()
        if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url
        const up = {
          title: $('#p_t').value.trim(), body: $('#p_b').value.trim() || null,
          rubric_id: $('#p_r').value || null, status: $('#p_s').value,
          channels: picked('pch'),
          publish_on: $('#p_d').value || null, publish_time: $('#p_h').value || null,
          owner_id: $('#p_o').value || null, asset_url: url || null,
          note: $('#p_n').value.trim() || null,
        }
        if (!up.title) return toast('Vyplň název příspěvku', true)
        const q = isNew ? await sb.from('bc_post').insert({ ...up, created_by: S.me.id })
          : await sb.from('bc_post').update(up).eq('id', p.id)
        if (q.error) return toast(q.error.message, true)
        closeModal(); await loadAll(); render(); toast('Uloženo')
      }
    },
  ].filter(Boolean))
}

/* ============ DOKUMENTY ============ */
function viewDocs(m) {
  const h = el('div', 'head')
  h.innerHTML = '<h2>Dokumenty</h2><p>Směrnice, propozice soutěží, formuláře a zápisy na jednom místě.</p>'
  if (S.seesAll) {
    const add = el('button', 'btn primary', '+ Nahrát dokument')
    add.onclick = () => openDoc(null)
    h.appendChild(add)
  }
  m.appendChild(h)

  const f = el('div', 'filters')
  f.innerHTML = `
    <select id="dt">${teamOptions(S.docFilter.team, S.seesAll ? 'Všechny týmy' : 'Vše, co mi patří')}</select>
    <input id="dq" placeholder="Hledat v názvech…" value="${esc(S.docFilter.q)}">`
  m.appendChild(f)
  $('#dt', f).onchange = e => { S.docFilter.team = e.target.value; render() }
  $('#dq', f).oninput = e => { S.docFilter.q = e.target.value; renderDocList() }

  const wrap = el('div'); wrap.id = 'dl'; m.appendChild(wrap)
  renderDocList()
}
function renderDocList() {
  const w = $('#dl'); if (!w) return
  w.innerHTML = ''
  let a = [...S.docs]
  if (S.docFilter.team) a = a.filter(d => d.team_id === S.docFilter.team)
  if (S.docFilter.q) {
    const q = S.docFilter.q.toLowerCase()
    a = a.filter(d => (d.title + ' ' + (d.description || '') + ' ' + d.file_name).toLowerCase().includes(q))
  }
  if (!a.length) {
    const c = el('section', 'card')
    c.appendChild(el('div', 'empty', S.docs.length ? 'Žádný dokument neodpovídá filtru.'
      : S.seesAll ? 'Zatím tu nic není. Nahraj první dokument tlačítkem nahoře.'
        : 'Zatím tu pro tebe nejsou žádné dokumenty.'))
    return w.appendChild(c)
  }
  Object.entries(DOC_CATS).forEach(([key, label]) => {
    const items = a.filter(d => (d.category || 'ostatni') === key)
    if (!items.length) return
    const sec = el('section', 'card')
    sec.appendChild(el('div', 'card-h', `<h3>${label}</h3><span class="pill">${items.length}</span>`))
    items.forEach(d => sec.appendChild(docRow(d)))
    w.appendChild(sec)
  })
}
function docRow(d) {
  const r = el('div', 'drow')
  r.innerHTML = `
    <div class="dic">${fileIcon(d.file_name)}</div>
    <div class="db">
      <b>${esc(d.title)}</b>
      <span>${d.team_id ? `<i class="tm">${esc(teamName(d.team_id))}</i>` : '<i class="tm all">celý klub</i>'}
        ${esc(d.file_name)}${d.size_bytes ? ' · ' + fmtSize(d.size_bytes) : ''} · ${fmtDate(d.created_at)}${d.uploaded_by ? ' · ' + esc(personName(d.uploaded_by)) : ''}</span>
      ${d.description ? `<span class="dd">${esc(d.description)}</span>` : ''}
    </div>
    <div class="ba"></div>`
  const b = r.querySelector('.ba')
  const dl = el('button', 'btn sm', 'Stáhnout')
  dl.onclick = () => downloadDoc(d)
  b.appendChild(dl)
  if (S.seesAll) {
    const ed = el('button', 'btn ghost sm', 'Upravit')
    ed.onclick = () => openDoc(d)
    b.appendChild(ed)
  }
  return r
}
async function downloadDoc(d) {
  const { data, error } = await sb.storage.from('bc-docs').createSignedUrl(d.file_path, 60, { download: d.file_name })
  if (error) return toast('Soubor se nepodařilo otevřít: ' + error.message, true)
  const a = document.createElement('a')
  a.href = data.signedUrl; a.rel = 'noopener'; a.click()
}
function openDoc(d) {
  const isNew = !d
  modal(isNew ? 'Nahrát dokument' : 'Upravit dokument', `
    ${isNew ? `<label>Soubor<input id="d_f" type="file">
      <small class="hint">PDF, Word, Excel, obrázky i ZIP. Nejvýše 25 MB na soubor.</small></label>` :
      `<p class="stnote">Soubor: <b>${esc(d.file_name)}</b>${d.size_bytes ? ' · ' + fmtSize(d.size_bytes) : ''}. Sám soubor vyměnit nejde — nahraj nový a starý smaž.</p>`}
    <label>Název<input id="d_t" value="${esc(d?.title)}" placeholder="Např. Směrnice o členských příspěvcích 2027"></label>
    <div class="row">
      <label>Zařazení<select id="d_c">${Object.entries(DOC_CATS).map(([k, v]) => `<option value="${k}" ${(d?.category || 'smernice') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Zobrazit komu<select id="d_team">${teamOptions(d?.team_id, '— celému klubu —')}</select></label>
    </div>
    <label>Popis<textarea id="d_d" rows="2" placeholder="K čemu dokument je, od kdy platí…">${esc(d?.description)}</textarea></label>
    <small class="hint">Když vybereš tým, dokument uvidí jen jeho členové (a správci s výborem). Bez týmu ho uvidí každý schválený člen klubu.</small>
  `, [
    !isNew && {
      label: 'Smazat', cls: 'danger', act: async () => {
        if (!confirm('Opravdu smazat dokument i soubor?')) return
        const { error } = await sb.from('bc_document').delete().eq('id', d.id)
        if (error) return toast(error.message, true)
        await sb.storage.from('bc-docs').remove([d.file_path])
        closeModal(); await loadAll(); render(); toast('Dokument smazán')
      }
    },
    { label: isNew ? 'Nahrát' : 'Uložit', cls: 'primary', act: isNew ? uploadDoc : saveDoc },
  ].filter(Boolean))

  if (isNew) $('#d_f').onchange = e => {
    const f = e.target.files[0]
    if (f && !$('#d_t').value.trim()) $('#d_t').value = f.name.replace(/\.[^.]+$/, '')
  }

  async function saveDoc() {
    const up = {
      title: $('#d_t').value.trim(), category: $('#d_c').value,
      team_id: $('#d_team').value || null, description: $('#d_d').value.trim() || null,
    }
    if (!up.title) return toast('Vyplň název dokumentu', true)
    const { error } = await sb.from('bc_document').update(up).eq('id', d.id)
    if (error) return toast(error.message, true)
    closeModal(); await loadAll(); render(); toast('Uloženo')
  }
  async function uploadDoc(ev) {
    const file = $('#d_f').files[0]
    const title = $('#d_t').value.trim()
    if (!file) return toast('Vyber soubor', true)
    if (!title) return toast('Vyplň název dokumentu', true)
    if (file.size > 25 * 1024 * 1024) return toast('Soubor je větší než 25 MB', true)
    const btn = ev.target; btn.disabled = true; btn.textContent = 'Nahrávám…'
    const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]/g, '_').slice(-120)
    const path = `${crypto.randomUUID()}/${safe}`
    const up = await sb.storage.from('bc-docs').upload(path, file, { contentType: file.type || undefined })
    if (up.error) { btn.disabled = false; btn.textContent = 'Nahrát'; return toast('Nahrání selhalo: ' + up.error.message, true) }
    const { error } = await sb.from('bc_document').insert({
      title, category: $('#d_c').value, team_id: $('#d_team').value || null,
      description: $('#d_d').value.trim() || null,
      file_path: path, file_name: file.name, mime: file.type || null, size_bytes: file.size,
      uploaded_by: S.me.id,
    })
    if (error) {
      await sb.storage.from('bc-docs').remove([path])
      btn.disabled = false; btn.textContent = 'Nahrát'
      return toast(error.message, true)
    }
    closeModal(); await loadAll(); render(); toast('Dokument nahrán')
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

  m.appendChild(agendaMonth(c))
}

// na mobilu je měsíční mřížka nečitelná, proto výpis po dnech
const KIND_COLOR = { training: '#1B5FA8', match: '#C00000', meeting: '#6A3FA0', deadline: '#C2660A', event: '#0F7C7C', other: '#6B6B6B' }
function agendaMonth(c) {
  const wrap = el('section', 'card agenda')
  const y = c.getFullYear(), mo = c.getMonth()
  const inMonth = d => { const x = new Date(d); return x.getFullYear() === y && x.getMonth() === mo }

  const items = [
    ...S.events.filter(e => inMonth(e.starts_at)).map(e => ({
      key: iso(e.starts_at), time: new Date(e.starts_at),
      title: e.title, color: KIND_COLOR[e.kind] || '#6B6B6B',
      meta: [EVENT_KINDS[e.kind], e.team_id ? teamName(e.team_id) : '', e.location].filter(Boolean).join(' · '),
      at: new Date(e.starts_at).getHours() || new Date(e.starts_at).getMinutes()
        ? `${new Date(e.starts_at).getHours()}:${String(new Date(e.starts_at).getMinutes()).padStart(2, '0')}` : '',
      open: () => openEvent(e),
    })),
    ...S.tasks.filter(t => t.status !== 'done' && t.due_date && inMonth(t.due_date + 'T00:00:00')).map(t => ({
      key: t.due_date, time: new Date(t.due_date + 'T23:59:59'),
      title: t.title, color: '#111',
      meta: ['Termín úkolu', t.team_id ? teamName(t.team_id) : '', assigneeLabel(t)].filter(Boolean).join(' · '),
      at: '', open: () => openTask(t),
    })),
  ].sort((a, b) => a.time - b.time)

  if (!items.length) {
    wrap.appendChild(el('div', 'empty', 'V tomto měsíci nic naplánovaného.'))
    return wrap
  }
  let last = null
  items.forEach(it => {
    if (it.key !== last) {
      last = it.key
      const d = new Date(it.key + 'T00:00:00')
      wrap.appendChild(el('div', 'adh' + (it.key === today() ? ' today' : ''),
        `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}. ${d.getMonth() + 1}.${it.key === today() ? ' — dnes' : ''}`))
    }
    const r = el('div', 'arow', `<div class="abar"></div>
      <div class="ab"><b>${esc(it.title)}</b><span>${esc(it.meta)}</span></div>
      ${it.at ? `<div class="at">${it.at}</div>` : ''}`)
    r.style.setProperty('--ac', it.color)
    r.onclick = it.open
    wrap.appendChild(r)
  })
  return wrap
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
      <label>Tým<select id="e_team">${teamOptions(e?.team_id, '— klubová akce, vidí všichni —')}</select></label>
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
    const open = S.tasks.filter(t => hasAssignee(t, p.id) && t.status !== 'done').length
    const late = S.tasks.filter(t => hasAssignee(t, p.id) && t.status !== 'done' && t.due_date && t.due_date < today()).length
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
  // upozornění se doptáváme každou minutu, ať se objeví i bez obnovení stránky
  setInterval(() => { if (!document.hidden) refreshNotes(true) }, 60000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNotes(true) })
}
boot()
