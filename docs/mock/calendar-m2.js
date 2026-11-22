/* PROTOTYPE NAS-155 — M2 Giornata. Da buttare.
 *
 * Domanda: come si usano Oggi, Prossimi 7 giorni e il calendario (mese, settimana,
 * giorno, agenda) con drag, resize e pannello «senza data», secondo le decisioni
 * del grilling M2. Non verifica @mantine/schedule: è JS puro sopra app.js.
 *
 * Si carica dopo app.js e sostituisce dashboard() e calendarPage(). Il resto del
 * mock resta invariato. Ora dimostrativa: 28/10/2026 09:30, timezone dell'owner.
 */
(() => {
  const NOW = `${today}T09:30`;
  const HOURS = { start: 7, end: 22 }; // griglia oraria visibile
  const SLOT_PX = 24; // 30 minuti
  const DEMO = [
    { id: 9001, title: 'Conferenza design', space: 'Nando', area: 'Lavoro', sched: { allDay: true, from: '2026-10-27', to: '2026-10-29' } },
    { id: 9002, title: 'Call con Studio X', space: 'Cliente Studio X', area: 'Lavoro', sched: { allDay: false, from: '2026-10-28T15:00', to: '2026-10-28T15:45' } },
    { id: 9003, title: 'Pagare bolletta luce', space: 'Inbox', area: '', sched: { allDay: false, from: null, to: '2026-10-28T08:00' } },
    { id: 9004, title: 'Workshop tedesco', space: 'Tedesco B1', area: 'Formazione', sched: { allDay: false, from: '2026-10-30T14:00', to: '2026-10-30T17:00' } },
    { id: 9005, title: 'Vacanza Dolomiti', space: 'Anniversari', area: 'Relazioni', sched: { allDay: true, from: '2026-10-31', to: '2026-11-03' } },
    { id: 9006, title: 'Revisione trimestrale', space: 'Nando', area: 'Lavoro', sched: { allDay: false, from: '2026-10-29T10:00', to: '2026-10-29T11:30' } },
    { id: 9007, title: 'Rinnovare passaporto', space: 'Inbox', area: '', sched: { allDay: true, from: null, to: '2026-10-26' } },
    { id: 9008, title: 'Annaffiare le piante', space: 'Inbox', area: '', sched: { allDay: true, from: null, to: '2026-10-28' } },
    { id: 9009, title: 'Rispondere a Marta', space: 'Anniversari', area: 'Relazioni', sched: { allDay: false, from: null, to: '2026-10-28T18:00' } },
    { id: 9010, title: 'Riordinare la cantina', space: 'Inbox', area: '', sched: null },
    { id: 9011, title: 'Leggere articolo sul sonno', space: 'Inbox', area: '', sched: null },
    { id: 9012, title: 'Preparare slide di Nando', space: 'Nando', area: 'Lavoro', sched: null },
    { id: 9013, title: 'Ordinare il libro di grammatica', space: 'Tedesco B1', area: 'Formazione', sched: null },
  ];

  let calView = matchMedia('(max-width: 720px)').matches ? 'agenda' : 'week';
  let todayExpanded = false;
  let panelOpen = true;
  let panelSpace = '';
  let lastAction = 'Nessuna azione';
  let lastTaskId = null;
  let popover = null; // { id, x, y }
  let resizing = false;
  let suppressClick = false;

  // ── dati ──────────────────────────────────────────────────────────────
  function seed(reset = false) {
    if (reset) {
      state.tasks = state.tasks.filter((t) => t.id < 9000).map((t) => ({ ...t, sched: undefined, status: undefined, history: undefined }));
    }
    for (const d of DEMO) {
      if (state.tasks.some((t) => t.id === d.id)) continue;
      state.tasks.push({ ...d, done: false, props: {}, localProps: [], date: d.sched ? dayOf(d.sched.to) : '', history: [] });
    }
    persist();
  }

  const dayOf = (v) => v.slice(0, 10);
  const timeOf = (v) => v.slice(11, 16);
  const parse = (v) => new Date(v.length === 10 ? `${v}T12:00` : v);
  const fmtTs = (d) => `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const addDays = (day, n) => { const d = parse(day); d.setDate(d.getDate() + n); return isoDay(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const addMin = (ts, n) => { const d = parse(ts); d.setMinutes(d.getMinutes() + n); return fmtTs(d); };
  const diffMin = (a, b) => Math.round((parse(b) - parse(a)) / 60000);
  const minutesOfDay = (ts) => Number(ts.slice(11, 13)) * 60 + Number(ts.slice(14, 16));

  function sched(t) {
    if (t.sched && t.date === dayOf(t.sched.to)) return t.sched;
    return t.date ? { allDay: true, from: null, to: t.date } : null;
  }
  function setSched(t, s) {
    t.sched = s;
    t.date = s ? dayOf(s.to) : '';
  }
  const status = (t) => (t.done ? 'completed' : t.status === 'skipped' ? 'skipped' : t.status === 'in_progress' ? 'in_progress' : 'open');
  const isActive = (t) => ['open', 'in_progress'].includes(status(t)); // open o in corso: conta per Oggi, ritardi e drag
  const startDay = (s) => dayOf(s.from || s.to);
  const endDay = (s) => dayOf(s.to);
  function temporal(t) {
    const s = sched(t);
    if (!s || !isActive(t)) return null;
    const overdue = s.allDay ? s.to < today : s.to < NOW;
    if (overdue) return 'overdue';
    if (s.from && startDay(s) <= today && endDay(s) > today) return 'current';
    if (endDay(s) === today) return 'today';
    return 'upcoming';
  }
  function log(t, kind, detail = '') {
    t.history = t.history || [];
    t.history.push({ kind, at: NOW, detail });
    lastAction = `${kind}: «${t.title}»${detail ? ` — ${detail}` : ''}`;
    lastTaskId = t.id;
  }

  // ── comandi ───────────────────────────────────────────────────────────
  function complete(t) { t.done = true; t.status = 'completed'; log(t, 'completato'); persist(); }
  function skip(t) { t.done = false; t.status = 'skipped'; log(t, 'saltato'); persist(); }
  function reopen(t, to = 'open') { t.done = false; t.status = to; log(t, 'riaperto', 'rettifica'); persist(); }
  function start(t) { t.status = 'in_progress'; log(t, 'iniziato'); persist(); }
  function toTodo(t) { t.status = 'open'; log(t, 'rimesso da fare'); persist(); }
  /** Board: porta la card nella colonna. Fatto passa da Completion, l'uscita da Fatto da una rettifica. */
  function setColumn(t, col) {
    const st = status(t);
    if (st === col) return;
    if (col === 'completed') complete(t);
    else if (st === 'completed') reopen(t, col);
    else if (col === 'in_progress') start(t);
    else toTodo(t);
  }

  function moveTo(t, day, time = null) {
    const s = sched(t);
    let next;
    if (s.allDay) {
      const delta = diffDays(startDay(s), day);
      next = { allDay: true, from: s.from ? addDays(s.from, delta) : null, to: addDays(s.to, delta) };
    } else {
      const start = s.from || s.to;
      const target = `${day}T${time || timeOf(start)}`;
      const delta = diffMin(start, target);
      next = { allDay: false, from: s.from ? addMin(s.from, delta) : null, to: addMin(s.to, delta) };
    }
    setSched(t, next);
    log(t, 'spostato', label(next));
    persist();
  }
  function plan(t, day, time = null) {
    const next = time ? { allDay: false, from: null, to: `${day}T${time}` } : { allDay: true, from: null, to: day };
    setSched(t, next);
    log(t, 'pianificato', label(next));
    persist();
  }
  function resize(t, newTo) {
    const s = sched(t);
    if (newTo <= s.from) return;
    setSched(t, { ...s, to: newTo });
    log(t, 'durata cambiata', label(sched(t)));
    persist();
  }

  // ── formattazione ─────────────────────────────────────────────────────
  const dayName = (day, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => parse(day).toLocaleDateString('it-IT', opts);
  function label(s) {
    if (!s) return 'Senza data';
    if (s.allDay) return s.from ? `${dayName(s.from)} → ${dayName(s.to)}` : `${dayName(s.to)} · tutto il giorno`;
    if (s.from) return `${dayName(s.from)} ${timeOf(s.from)}–${dayOf(s.from) === dayOf(s.to) ? timeOf(s.to) : `${dayName(s.to)} ${timeOf(s.to)}`}`;
    return `${dayName(s.to)} · entro le ${timeOf(s.to)}`;
  }
  const TEMPORAL_PILL = { overdue: '<span class="pill m2-pill-late">In ritardo</span>', current: '<span class="pill blue">In svolgimento</span>' };
  const STATUS_LABEL = { open: 'Da fare', in_progress: 'In corso', completed: 'Fatto', skipped: 'Saltato' };

  function row(t, { note = '' } = {}) {
    const s = sched(t), st = status(t), tmp = temporal(t);
    return `<div class="task-row m2-row ${!isActive(t) ? 'is-closed' : ''}">
      <input type="checkbox" data-m2-check="${t.id}" ${st === 'completed' ? 'checked' : ''} ${st === 'skipped' ? 'disabled' : ''} aria-label="Completa ${esc(t.title)}">
      <button class="task-name ${st === 'completed' ? 'done' : ''}" data-nav="task" data-arg="${t.id}">${esc(t.title)}</button>
      <span class="task-space">${esc(t.space)}</span>
      ${note ? `<span class="pill">${note}</span>` : ''}${TEMPORAL_PILL[tmp] || ''}${st === 'in_progress' ? '<span class="pill m2-pill-progress">In corso</span>' : ''}${st === 'skipped' ? '<span class="pill">Saltato</span>' : ''}
      <span class="task-date">${esc(s.allDay ? (s.from ? label(s) : 'Tutto il giorno') : s.from ? `${timeOf(s.from)}–${timeOf(s.to)}` : `entro le ${timeOf(s.to)}`)}</span>
      <button class="icon-btn m2-menu" data-m2-skip="${t.id}" ${!isActive(t) ? 'disabled' : ''} title="Salta" aria-label="Salta ${esc(t.title)}">⤼</button>
    </div>`;
  }

  // ── varianti di «Prossimi» (?variant=A|B|C) ─────────────────────────────
  // A: striscia della settimana dentro Oggi + Agenda del calendario con orizzonte 7/15/30.
  // B: scelta dopo il primo giro: tab in dashboard (come C) + pagina «Task» a board per stato.
  // C: tab Oggi / Prossimi 7 giorni dentro il widget della dashboard, senza pagina Task.
  const VARIANTS = { A: 'Striscia + Agenda', B: 'Tab + Board Task', C: 'Tab in dashboard' };
  let variant = new URLSearchParams(location.search).get('variant')?.toUpperCase();
  if (!VARIANTS[variant]) variant = 'A';
  let stripDay = today; // A
  let dashTab = 'today'; // C
  let horizon = 7; // A (Agenda) e B (pagina Task)
  let tasksSpace = ''; // B

  // ── dashboard ─────────────────────────────────────────────────────────
  const openScheduled = () => state.tasks.filter((t) => sched(t) && isActive(t));
  const byTime = (a, b) => sched(a).to.localeCompare(sched(b).to);
  const dayEntries = (d, pool = openScheduled()) => pool.flatMap((t) => {
    const s = sched(t);
    if (endDay(s) === d) return [[t, '']];
    if (s.from && startDay(s) === d) return [[t, 'inizia']];
    return [];
  }).sort(([a], [b]) => byTime(a, b));
  const dayList = (entries, empty = 'Niente in scadenza.') => (entries.length ? `<div class="task-list">${entries.map(([t, n]) => row(t, { note: n })).join('')}</div>` : `<p class="muted small">${empty}</p>`);
  const longDay = (d) => esc(dayName(d, { weekday: 'long', day: 'numeric', month: 'long' }));

  function todayGroups() {
    const open = openScheduled();
    return [
      ['In ritardo', open.filter((t) => temporal(t) === 'overdue').sort(byTime)],
      ['In svolgimento', open.filter((t) => temporal(t) === 'current').sort(byTime)],
      ['Scade oggi', open.filter((t) => temporal(t) === 'today').sort(byTime)],
    ];
  }
  function todayBody() {
    const groups = todayGroups(), total = groups.reduce((n, [, g]) => n + g.length, 0);
    let budget = todayExpanded ? Infinity : 7;
    const html = groups.map(([name, g]) => {
      const shown = g.slice(0, Math.max(0, budget));
      budget -= shown.length;
      return shown.length ? `<h3 class="m2-group">${name} <span class="muted">${g.length}</span></h3><div class="task-list">${shown.map((t) => row(t)).join('')}</div>` : '';
    }).join('');
    return { total, html: `${total ? html : '<div class="empty"><h3>Niente per oggi</h3></div>'}${total > 7 ? `<button class="text-btn m2-more" data-m2-expand>${todayExpanded ? 'Mostra meno' : `Mostra tutte (${total})`}</button>` : ''}` };
  }
  const nextDays = (n) => Array.from({ length: n }, (_, i) => addDays(today, i + 1)); // esclude oggi

  function widgetA() {
    const days = [today, ...nextDays(6)];
    const strip = `<div class="m2-strip" role="tablist" aria-label="Settimana">${days.map((d) => {
      const n = d === today ? todayBody().total : dayEntries(d).length;
      return `<button role="tab" class="m2-strip-day ${d === stripDay ? 'is-active' : ''}" aria-selected="${d === stripDay}" data-m2-strip="${d}"><small>${d === today ? 'Oggi' : esc(dayName(d, { weekday: 'short' }))}</small><strong>${parse(d).getDate()}</strong><span class="m2-strip-count ${n ? '' : 'is-zero'}">${n || '·'}</span></button>`;
    }).join('')}</div>`;
    const isToday = stripDay === today, body = todayBody();
    return `<div class="section-head"><h2>${isToday ? 'Oggi' : longDay(stripDay)}</h2><span class="number">${isToday ? body.total : dayEntries(stripDay).length}</span><button class="text-btn" style="margin-left:auto" data-m2-to-agenda>Agenda →</button></div>
      ${strip}${isToday ? body.html : dayList(dayEntries(stripDay))}${isToday ? quickTaskRow() : ''}`;
  }
  function widgetC() {
    const body = todayBody(), week = nextDays(6);
    const weekCount = week.reduce((n, d) => n + dayEntries(d).length, 0);
    const tabs = `<div class="m2-tabs" role="tablist">${[['today', 'Oggi', body.total], ['next', 'Prossimi 7 giorni', weekCount]].map(([k, l, n]) => `<button role="tab" aria-selected="${dashTab === k}" class="m2-tab ${dashTab === k ? 'is-active' : ''}" data-m2-tab="${k}">${l} <span class="number">${n}</span></button>`).join('')}</div>`;
    const content = dashTab === 'today' ? body.html + quickTaskRow() : week.map((d) => { const e = dayEntries(d); return e.length ? `<div class="m2-day"><h3 class="m2-group">${longDay(d)}</h3>${dayList(e)}</div>` : ''; }).join('') || '<p class="muted">Niente nei prossimi giorni.</p>';
    return tabs + content;
  }

  dashboard = function dashboardM2() {
    const widget = { A: widgetA, B: widgetC, C: widgetC }[variant]();
    return `<div data-screen="dashboard">${heading('Un po’ di ordine, ogni giorno.', 'Mercoledì 28 ottobre 2026 · ore 09:30', `<button class="btn primary" data-action="capture">${icon('plus')} Cattura rapida</button>`)}
      <div class="dash-grid"><div>
        <section class="today-area">${widget}</section>
        <section class="section m2-placeholder"><p class="muted small">Spazio per i prossimi widget della dashboard (Habit, note, progetti…).</p></section>
      </div><aside><button class="inbox-panel" data-nav="inbox">${icon('inbox')}<span class="od-field"><strong>Inbox</strong><small>Un posto per iniziare, senza organizzare.</small></span><span class="number">${state.tasks.filter((t) => !t.done && t.space === 'Inbox').length}</span>${icon('arrow')}</button></aside></div>
      ${debugBar()}</div>`;
  };

  // ── B: pagina «Task», board per stato ─────────────────────────────────
  const horizonPicker = (attr) => `<div class="od-row m2-horizon">${[7, 15, 30].map((n) => `<button class="btn ${horizon === n ? 'primary' : ''}" data-${attr}="${n}">${n} giorni</button>`).join('')}</div>`;
  let boardHorizon = 0; // 0 = tutte
  const COLUMNS = [['open', 'Da fare'], ['in_progress', 'In corso'], ['completed', 'Fatto']];
  const completedAt = (t) => [...(t.history || [])].reverse().find((h) => h.kind === 'completato')?.at || (t.date ? `${t.date}T00:00` : NOW);
  function card(t) {
    const s = sched(t), st = status(t), tmp = temporal(t);
    return `<article class="m2-card st-${st}" draggable="true" data-m2-card="${t.id}">
      <button class="task-name ${st === 'completed' ? 'done' : ''}" data-nav="task" data-arg="${t.id}">${esc(t.title)}</button>
      <div class="m2-card-meta"><span class="task-space">${esc(t.space)}</span>${TEMPORAL_PILL[tmp] || ''}<span class="m2-time">${esc(s ? label(s) : 'Senza data')}</span></div>
      <div class="m2-card-actions">${COLUMNS.filter(([k]) => k !== st).map(([k, l]) => `<button class="text-btn" data-m2-col="${k}" data-m2-col-task="${t.id}">→ ${l}</button>`).join('')}</div>
    </article>`;
  }
  function tasksPage() {
    const spaces = [...new Set(state.tasks.map((t) => t.space))].sort();
    const limit = boardHorizon ? addDays(today, boardHorizon - 1) : null;
    const inScope = (t) => (!tasksSpace || t.space === tasksSpace) && (!limit || (sched(t) && endDay(sched(t)) <= limit));
    const weekAgo = `${addDays(today, -7)}T00:00`;
    const byDue = (a, b) => (sched(a) ? sched(a).to : '9999').localeCompare(sched(b) ? sched(b).to : '9999');
    const cols = COLUMNS.map(([k, l]) => {
      const items = state.tasks.filter((t) => status(t) === k && inScope(t) && (k !== 'completed' || completedAt(t) >= weekAgo)).sort(k === 'completed' ? (a, b) => completedAt(b).localeCompare(completedAt(a)) : byDue);
      return `<section class="m2-column m2-col-drop" data-m2-col-drop="${k}" aria-label="${l}"><header class="section-head"><h2>${l}</h2><span class="number">${items.length}</span>${k === 'completed' ? '<small class="muted">ultimi 7 giorni</small>' : ''}</header><div class="m2-column-body">${items.map(card).join('') || '<p class="muted small">Vuota.</p>'}</div></section>`;
    }).join('');
    return `<section data-screen="tasks">${heading('Task', '')}
      <div class="calendar-toolbar"><div class="od-row m2-horizon">${[[0, 'Tutte'], [7, '7 giorni'], [15, '15 giorni'], [30, '30 giorni']].map(([n, l]) => `<button class="btn ${boardHorizon === n ? 'primary' : ''}" data-m2-board-horizon="${n}">${l}</button>`).join('')}</div>
        <label class="small od-row">Space <select data-m2-tasks-space><option value="">Tutti</option>${spaces.map((s) => `<option ${s === tasksSpace ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
      <div class="m2-board">${cols}</div>
      ${boardHorizon ? '<p class="small muted">Con un orizzonte attivo i task senza data e quelli che scadono più avanti sono nascosti.</p>' : ''}
      ${debugBar()}</section>`;
  }
  const basePage = page;
  page = function pageM2() { return view === 'tasks' && variant === 'B' ? tasksPage() : basePage(); };
  const baseCrumb = crumb;
  crumb = function crumbM2() { return view === 'tasks' ? '<span class="current">Task</span>' : baseCrumb(); };

  // ── calendario ────────────────────────────────────────────────────────
  const canDrag = () => matchMedia('(min-width: 900px) and (pointer: fine)').matches;
  const draggable = (t) => (canDrag() && isActive(t) ? `draggable="true" data-m2-drag="${t.id}"` : '');
  const scheduled = () => state.tasks.filter((t) => sched(t));
  const coversDay = (s, d) => startDay(s) <= d && endDay(s) >= d;
  const weekStart = (d) => addDays(d, -((parse(d).getDay() + 6) % 7));

  function chip(t, d) {
    const s = sched(t), st = status(t);
    const seg = s.from && s.allDay ? (d === startDay(s) ? 'seg-start' : d === endDay(s) ? 'seg-end' : 'seg-mid') : '';
    const time = s.allDay ? '' : `<span class="m2-time">${timeOf(s.from || s.to)}</span>`;
    return `<button class="m2-chip ${s.allDay ? 'is-allday' : 'is-timed'} ${seg} st-${st} ${temporal(t) === 'overdue' ? 'is-late' : ''}" data-m2-open="${t.id}" ${draggable(t)}>${time}<span class="od-clamp-2">${esc(t.title)}</span></button>`;
  }

  function monthView() {
    const first = parse(`${calendarDay.slice(0, 7)}-01`), start = weekStart(isoDay(first));
    const cells = Math.ceil((diffDays(start, isoDay(first)) + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7) * 7;
    return `<div class="month-grid"><div class="week-head">${['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => `<div>${d}</div>`).join('')}</div><div class="month-days">${Array.from({ length: cells }, (_, i) => {
      const d = addDays(start, i), items = scheduled().filter((t) => coversDay(sched(t), d));
      return `<div class="month-cell m2-drop ${d.slice(0, 7) !== calendarDay.slice(0, 7) ? 'outside' : ''} ${d === today ? 'is-today' : ''}" data-m2-drop-day="${d}"><button class="calendar-day" data-m2-goto="${d}">${parse(d).getDate()}</button><div class="calendar-events">${items.slice(0, 4).map((t) => chip(t, d)).join('')}${items.length > 4 ? `<button class="calendar-more" data-m2-goto="${d}">+${items.length - 4}</button>` : ''}</div></div>`;
    }).join('')}</div></div>`;
  }

  function timeGrid(days) {
    const allDayRows = days.map((d) => `<div class="m2-allday-cell m2-drop" data-m2-drop-day="${d}">${scheduled().filter((t) => sched(t).allDay && coversDay(sched(t), d)).map((t) => chip(t, d)).join('')}</div>`).join('');
    const hours = Array.from({ length: HOURS.end - HOURS.start }, (_, i) => HOURS.start + i);
    const cols = days.map((d) => {
      const slots = hours.flatMap((h) => ['00', '30'].map((m) => `<div class="m2-slot m2-drop" data-m2-drop-day="${d}" data-m2-drop-time="${String(h).padStart(2, '0')}:${m}"></div>`)).join('');
      const events = scheduled().filter((t) => !sched(t).allDay && dayOf(sched(t).from || sched(t).to) === d).map((t) => {
        const s = sched(t), st = status(t);
        const top = ((minutesOfDay(s.from || s.to) - HOURS.start * 60) / 30) * SLOT_PX;
        const height = s.from ? Math.max(SLOT_PX, (diffMin(s.from, s.to) / 30) * SLOT_PX) : SLOT_PX;
        return `<button class="m2-event ${s.from ? 'is-block' : 'is-point'} st-${st} ${temporal(t) === 'overdue' ? 'is-late' : ''}" style="top:${top}px;height:${height}px" data-m2-open="${t.id}" ${draggable(t)}>
          <span class="m2-time">${s.from ? `${timeOf(s.from)}–${timeOf(s.to)}` : `entro ${timeOf(s.to)}`}</span><span class="od-clamp-2">${esc(t.title)}</span>
          ${s.from && canDrag() && isActive(t) ? `<span class="m2-resize" data-m2-resize="${t.id}" title="Trascina per cambiare la fine"></span>` : ''}</button>`;
      }).join('');
      const nowLine = d === today ? `<div class="m2-now" style="top:${((minutesOfDay(NOW) - HOURS.start * 60) / 30) * SLOT_PX}px"></div>` : '';
      return `<div class="m2-col" data-m2-col="${d}">${slots}${events}${nowLine}</div>`;
    }).join('');
    return `<div class="m2-timegrid" style="--m2-days:${days.length}">
      <div class="m2-corner"></div>${days.map((d) => `<button class="m2-dayhead ${d === today ? 'is-today' : ''}" data-m2-goto="${d}">${esc(dayName(d, { weekday: 'short', day: 'numeric' }))}</button>`).join('')}
      <div class="m2-gutter small muted">tutto il giorno</div>${allDayRows}
      <div class="m2-hours">${hours.map((h) => `<div class="small muted">${String(h).padStart(2, '0')}:00</div>`).join('')}</div>${cols}</div>`;
  }

  function agendaView() {
    const span = variant === 'A' ? horizon : 14;
    const days = Array.from({ length: span }, (_, i) => addDays(calendarDay, i));
    return (variant === 'A' ? horizonPicker('m2-horizon-a') : '') + days.map((d) => {
      const items = scheduled().filter((t) => coversDay(sched(t), d) && (isActive(t) || endDay(sched(t)) === d));
      return items.length ? `<div class="m2-day"><h3 class="m2-group">${esc(dayName(d, { weekday: 'long', day: 'numeric', month: 'long' }))}${d === today ? ' <span class="pill blue">Oggi</span>' : ''}</h3><div class="task-list">${items.map((t) => row(t, { note: sched(t).from && startDay(sched(t)) === d && endDay(sched(t)) !== d ? 'inizia' : '' })).join('')}</div></div>` : '';
    }).join('') || `<p class="muted">Niente nei prossimi ${span} giorni.</p>`;
  }

  function unscheduledPanel() {
    const all = state.tasks.filter((t) => !sched(t) && isActive(t));
    const spaces = [...new Set(all.map((t) => t.space))].sort();
    const items = all.filter((t) => !panelSpace || t.space === panelSpace).sort((a, b) => a.id - b.id);
    return `<aside class="m2-panel" aria-label="Task senza data"><div class="section-head"><h2>Senza data</h2><span class="number">${items.length}</span></div>
      <label class="small">Space<select data-m2-panel-space><option value="">Tutti</option>${spaces.map((s) => `<option ${s === panelSpace ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <div class="m2-panel-list">${items.map((t) => `<div class="m2-panel-item" draggable="true" data-m2-new="${t.id}"><strong>${esc(t.title)}</strong><small class="muted">${esc(t.space)}</small></div>`).join('') || '<p class="muted small">Tutto pianificato.</p>'}</div>
      <p class="small muted">Trascina su un giorno per una scadenza all-day, su un orario per una scadenza a quell'ora.</p></aside>`;
  }

  calendarPage = function calendarPageM2() {
    const ws = weekStart(calendarDay);
    const title = calView === 'month' ? dayName(calendarDay, { month: 'long', year: 'numeric' })
      : calView === 'week' ? `${dayName(ws, { day: 'numeric', month: 'short' })} – ${dayName(addDays(ws, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
      : dayName(calendarDay, { weekday: 'long', day: 'numeric', month: 'long' });
    const body = calView === 'month' ? monthView() : calView === 'week' ? timeGrid(Array.from({ length: 7 }, (_, i) => addDays(ws, i))) : calView === 'day' ? timeGrid([calendarDay]) : agendaView();
    const withPanel = panelOpen && calView === 'week' && canDrag();
    return `<section data-screen="calendar">${heading('Calendario', '')}
      <div class="calendar-toolbar"><div class="od-row"><button class="btn" data-m2-today>Oggi</button><button class="icon-btn" data-m2-step="-1" aria-label="Precedente">‹</button><button class="icon-btn" data-m2-step="1" aria-label="Successivo">›</button><h2>${esc(title)}</h2></div>
        <div class="od-row">${['month', 'week', 'day', 'agenda'].map((v) => `<button class="btn ${calView === v ? 'primary' : ''}" data-m2-view="${v}">${{ month: 'Mese', week: 'Settimana', day: 'Giorno', agenda: 'Agenda' }[v]}</button>`).join('')}
        ${calView === 'week' && canDrag() ? `<button class="btn" data-m2-panel>${panelOpen ? 'Nascondi' : 'Mostra'} senza data</button>` : ''}</div></div>
      <div class="m2-cal ${withPanel ? 'with-panel' : ''}"><div class="m2-cal-main">${body}</div>${withPanel ? unscheduledPanel() : ''}</div>
      ${canDrag() ? '' : '<p class="small muted">Su questo schermo il drag è disattivato: si sposta dalla pagina del task.</p>'}
      ${debugBar()}</section>`;
  };

  // ── popover, toast e stato ────────────────────────────────────────────
  function popoverHtml() {
    if (!popover) return '';
    const t = state.tasks.find((x) => x.id === popover.id);
    if (!t) return '';
    const st = status(t);
    return `<div class="m2-popover" style="left:${popover.x}px;top:${popover.y}px" role="dialog" aria-label="${esc(t.title)}">
      <strong>${esc(t.title)}</strong><small class="muted">${esc(t.space)} · ${esc(label(sched(t)))}</small>
      <small>${STATUS_LABEL[st]}${TEMPORAL_PILL[temporal(t)] ? ' · ' + (temporal(t) === 'overdue' ? 'in ritardo' : 'in svolgimento') : ''}</small>
      <div class="od-row">${isActive(t) ? `<button class="btn primary" data-m2-complete="${t.id}">Completa</button>${st === 'open' ? `<button class="btn" data-m2-col="in_progress" data-m2-col-task="${t.id}">Inizia</button>` : ''}<button class="btn" data-m2-skip="${t.id}">Salta</button>` : `<button class="btn" data-m2-reopen="${t.id}">Riapri</button>`}<button class="btn" data-nav="task" data-arg="${t.id}">Apri</button></div></div>`;
  }
  function undoToast(t) {
    let el = document.getElementById('m2-toast');
    if (!el) { el = document.createElement('div'); el.id = 'm2-toast'; document.body.append(el); }
    el.innerHTML = `Completato «${esc(t.title)}» <button class="text-btn" data-m2-undo="${t.id}">Annulla</button>`;
    el.hidden = false;
    clearTimeout(undoToast.timer);
    undoToast.timer = setTimeout(() => (el.hidden = true), 5000);
  }
  function debugBar() {
    const t = state.tasks.find((x) => x.id === lastTaskId);
    return `<details class="m2-debug"><summary>Prototype NAS-155 · ${esc(lastAction)}</summary>
      <pre>${t ? esc(JSON.stringify({ id: t.id, title: t.title, status: status(t), temporal: temporal(t), schedule: sched(t), history: t.history || [] }, null, 2)) : 'Nessun task modificato.'}</pre>
      <button class="btn" data-m2-reset>Ripristina dati demo</button></details>`;
  }

  const baseRender = render;
  function switcherHtml() {
    const keys = Object.keys(VARIANTS);
    return `<div class="m2-switcher" role="group" aria-label="Variante del prototype"><button data-m2-variant-step="-1" aria-label="Variante precedente">←</button><span>${variant} · ${VARIANTS[variant]}</span><button data-m2-variant-step="1" aria-label="Variante successiva">→</button><small>${keys.indexOf(variant) + 1}/${keys.length}</small></div>`;
  }
  function setVariant(step) {
    const keys = Object.keys(VARIANTS);
    variant = keys[(keys.indexOf(variant) + step + keys.length) % keys.length];
    const url = new URL(location.href);
    url.searchParams.set('variant', variant);
    history.replaceState(null, '', url);
    if (view === 'tasks' && variant !== 'B') view = 'dashboard';
    render();
  }

  render = function renderM2() {
    baseRender();
    if (variant === 'B') {
      const item = `<button class="nav-item ${view === 'tasks' ? 'active' : ''}" data-nav="tasks" title="Task">${icon('check')}<span class="hide-rail od-field">Task</span></button>`;
      document.querySelector('.sidebar [data-nav="calendar"]')?.insertAdjacentHTML('afterend', item);
      document.querySelector('.bottom-nav [data-nav="calendar"]')?.insertAdjacentHTML('afterend', `<button data-nav="tasks" class="${view === 'tasks' ? 'active' : ''}">${icon('check')}<span>Task</span></button>`);
    }
    document.getElementById('m2-switcher-host')?.remove();
    const sw = document.createElement('div');
    sw.id = 'm2-switcher-host';
    sw.innerHTML = switcherHtml();
    document.body.append(sw);
    document.getElementById('m2-popover-host')?.remove();
    if (popover && view === 'calendar') {
      const host = document.createElement('div');
      host.id = 'm2-popover-host';
      host.innerHTML = popoverHtml();
      document.body.append(host);
    }
  };

  // ── eventi ────────────────────────────────────────────────────────────
  const byId = (id) => state.tasks.find((t) => t.id === Number(id));
  document.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); return; }
    const b = e.target.closest('button');
    if (!b) { if (popover && !e.target.closest('.m2-popover')) { popover = null; render(); } return; }
    const d = b.dataset;
    if (d.m2Open) { const r = b.getBoundingClientRect(); popover = { id: Number(d.m2Open), x: Math.min(r.left, innerWidth - 280), y: r.bottom + 6 }; render(); return; }
    if (d.m2Complete) { const t = byId(d.m2Complete); complete(t); popover = null; render(); undoToast(t); return; }
    if (d.m2Skip) { const t = byId(d.m2Skip); skip(t); popover = null; render(); toast(`Saltato «${t.title}»`); return; }
    if (d.m2Reopen || d.m2Undo) { const t = byId(d.m2Reopen || d.m2Undo); reopen(t); popover = null; document.getElementById('m2-toast')?.setAttribute('hidden', ''); render(); return; }
    if (d.m2Expand !== undefined) { todayExpanded = !todayExpanded; render(); return; }
    if (d.m2VariantStep) { setVariant(Number(d.m2VariantStep)); return; }
    if (d.m2Strip) { stripDay = d.m2Strip; render(); return; }
    if (d.m2Tab) { dashTab = d.m2Tab; render(); return; }
    if (d.m2ToAgenda !== undefined) { calView = 'agenda'; calendarDay = today; nav('calendar'); return; }
    if (d.m2HorizonA) { horizon = Number(d.m2HorizonA); render(); return; }
    if (d.m2BoardHorizon !== undefined) { boardHorizon = Number(d.m2BoardHorizon); render(); return; }
    if (d.m2Col) { const t = byId(d.m2ColTask); setColumn(t, d.m2Col); popover = null; render(); if (d.m2Col === 'completed') undoToast(t); return; }
    if (d.m2View) { calView = d.m2View; popover = null; render(); return; }
    if (d.m2Goto) { calendarDay = d.m2Goto; calView = 'day'; render(); return; }
    if (d.m2Today !== undefined) { calendarDay = today; render(); return; }
    if (d.m2Step) { const n = Number(d.m2Step); calendarDay = calView === 'month' ? isoDay(new Date(parse(calendarDay).getFullYear(), parse(calendarDay).getMonth() + n, 1, 12)) : addDays(calendarDay, n * (calView === 'week' ? 7 : calView === 'agenda' ? 14 : 1)); render(); return; }
    if (d.m2Panel !== undefined) { panelOpen = !panelOpen; render(); return; }
    if (d.m2Reset !== undefined) { seed(true); lastAction = 'Dati demo ripristinati'; lastTaskId = null; popover = null; render(); return; }
    if (popover && !b.closest('.m2-popover')) { popover = null; }
  }, true);

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.m2Check) {
      e.stopImmediatePropagation();
      const t = byId(el.dataset.m2Check);
      if (el.checked) { complete(t); render(); undoToast(t); } else { reopen(t); render(); }
    }
    if (el.dataset.m2PanelSpace !== undefined) { panelSpace = el.value; render(); }
    if (el.dataset.m2TasksSpace !== undefined) { tasksSpace = el.value; render(); }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"]')) || document.querySelector('dialog[open]')) return;
    setVariant(e.key === 'ArrowLeft' ? -1 : 1);
  });

  // drag: occorrenze open (sposta) e task del pannello (pianifica)
  document.addEventListener('dragstart', (e) => {
    if (resizing) { e.preventDefault(); return; }
    const el = e.target.closest('[data-m2-drag],[data-m2-new],[data-m2-card]');
    if (!el) return;
    e.dataTransfer.setData('text/plain', el.dataset.m2Card ? `card:${el.dataset.m2Card}` : el.dataset.m2Drag ? `move:${el.dataset.m2Drag}` : `new:${el.dataset.m2New}`);
    e.dataTransfer.effectAllowed = 'move';
    popover = null;
  });
  document.addEventListener('dragover', (e) => { const z = e.target.closest('.m2-drop,.m2-col-drop'); if (z) { e.preventDefault(); z.classList.add('is-over'); } });
  document.addEventListener('dragleave', (e) => e.target.closest?.('.m2-drop,.m2-col-drop')?.classList.remove('is-over'));
  document.addEventListener('drop', (e) => {
    const col = e.target.closest('.m2-col-drop');
    if (col) {
      e.preventDefault();
      const [kind, id] = e.dataTransfer.getData('text/plain').split(':');
      const t = byId(id);
      if (kind !== 'card' || !t) return;
      setColumn(t, col.dataset.m2ColDrop);
      render();
      if (col.dataset.m2ColDrop === 'completed') undoToast(t);
      return;
    }
    const z = e.target.closest('.m2-drop');
    if (!z) return;
    e.preventDefault();
    const [kind, id] = e.dataTransfer.getData('text/plain').split(':');
    const t = byId(id);
    if (!t) return;
    const day = z.dataset.m2DropDay, time = z.dataset.m2DropTime || null;
    if (kind === 'new') plan(t, day, time);
    else if (sched(t).allDay) moveTo(t, day); // il tipo non cambia: un all-day resta all-day anche se cade su uno slot
    else moveTo(t, day, time); // su un giorno o sulla riga all-day mantiene l'ora
    render();
  });

  // resize dei blocchi timed: maniglia in basso, passo di 15 minuti
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-m2-resize]');
    if (!h) return;
    e.preventDefault(); e.stopPropagation();
    resizing = true;
    const t = byId(h.dataset.m2Resize), block = h.parentElement, startY = e.clientY, startH = block.offsetHeight;
    block.setAttribute('draggable', 'false');
    const onMove = (ev) => { block.style.height = `${Math.max(SLOT_PX / 2, startH + ev.clientY - startY)}px`; };
    const onUp = () => {
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
      resizing = false; suppressClick = true;
      const minutes = Math.max(15, Math.round(((block.offsetHeight / SLOT_PX) * 30) / 15) * 15);
      resize(t, addMin(sched(t).from, minutes));
      render();
    };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
  }, true);

  seed();
  render();
})();
