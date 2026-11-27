/* PROTOTYPE NAS-155 (M2 Giornata) + NAS-160 (M3 Ricorrenze e notifiche). Da buttare.
 *
 * M2: Oggi, Prossimi 7 giorni, board Task e calendario (mese, settimana, giorno,
 * agenda) con drag, resize e pannello «senza data». La variante B è quella scelta.
 * M3 (ADR-0029): serie ricorrenti, editor della regola, scope di modifica, serie
 * nella board e in Oggi, campanella con le notifiche, Impostazioni dei promemoria.
 * Non verifica @mantine/schedule: è JS puro sopra app.js.
 *
 * Si carica dopo app.js e sostituisce dashboard() e calendarPage(). Il resto del
 * mock resta invariato. Ora dimostrativa: 28/10/2026 09:30 (si cambia dal riquadro
 * del prototype), timezone dell'owner.
 */
(() => {
  let NOW = `${today}T09:30`;
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
    seedM3(reset);
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
  const status = (t) => (t.done ? 'completed' : ['skipped', 'cancelled', 'in_progress'].includes(t.status) ? t.status : 'open');
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

  /** Schedule che risulta spostando `t` su `day` (e `time` per i timed), con la stessa durata. */
  function moveTarget(t, day, time = null) {
    const s = sched(t);
    if (s.allDay) {
      const delta = diffDays(startDay(s), day);
      return { allDay: true, from: s.from ? addDays(s.from, delta) : null, to: addDays(s.to, delta) };
    }
    const start = s.from || s.to;
    const delta = diffMin(start, `${day}T${time || timeOf(start)}`);
    return { allDay: false, from: s.from ? addMin(s.from, delta) : null, to: addMin(s.to, delta) };
  }
  function moveTo(t, day, time = null) {
    const next = moveTarget(t, day, time);
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
  const STATUS_LABEL = { open: 'Da fare', in_progress: 'In corso', completed: 'Fatto', skipped: 'Saltato', cancelled: 'Annullato' };

  function row(t, { note = '', older = 0 } = {}) {
    const s = sched(t), st = status(t), tmp = temporal(t);
    return `<div class="task-row m2-row ${!isActive(t) ? 'is-closed' : ''} ${older ? 'm3-row-series' : ''}">
      <input type="checkbox" data-m2-check="${t.id}" ${st === 'completed' ? 'checked' : ''} ${['skipped', 'cancelled'].includes(st) ? 'disabled' : ''} aria-label="Completa ${esc(t.title)}">
      <button class="task-name ${st === 'completed' ? 'done' : ''}" data-nav="task" data-arg="${t.id}">${esc(t.title)}</button>${seriesMark(t)}
      <span class="task-space">${esc(t.space)}</span>
      ${note ? `<span class="pill">${note}</span>` : ''}${TEMPORAL_PILL[tmp] || ''}${st === 'in_progress' ? '<span class="pill m2-pill-progress">In corso</span>' : ''}${st === 'skipped' ? '<span class="pill">Saltato</span>' : ''}
      <span class="task-date">${esc(s.allDay ? (s.from ? label(s) : 'Tutto il giorno') : s.from ? `${timeOf(s.from)}–${timeOf(s.to)}` : `entro le ${timeOf(s.to)}`)}</span>
      <button class="icon-btn m2-menu" data-m2-skip="${t.id}" ${!isActive(t) ? 'disabled' : ''} title="Salta" aria-label="Salta ${esc(t.title)}">⤼</button>
      ${older ? `<div class="m3-row-extra"><span class="m3-tag is-late">+${older} precedenti</span><button class="text-btn m3-skip-earlier" data-m3-skip-earlier="${t.id}">Salta le precedenti</button></div>` : ''}
    </div>`;
  }

  // ── varianti di «Prossimi» (?variant=A|B|C) ─────────────────────────────
  // A: striscia della settimana dentro Oggi + Agenda del calendario con orizzonte 7/15/30.
  // B: scelta dopo il primo giro: tab in dashboard (come C) + pagina «Task» a board per stato.
  // C: tab Oggi / Prossimi 7 giorni dentro il widget della dashboard, senza pagina Task.
  const VARIANTS = { A: 'Striscia + Agenda', B: 'Tab + Board Task', C: 'Tab in dashboard' };
  // M2 ha scelto B: la barra delle varianti compare solo con ?variant= nell'URL.
  const showSwitcher = new URLSearchParams(location.search).has('variant');
  let variant = new URLSearchParams(location.search).get('variant')?.toUpperCase();
  if (!VARIANTS[variant]) variant = 'B';
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

  /** M3: i ritardi della stessa serie diventano una riga, la più recente, con il conteggio delle precedenti. */
  function collapseSeries(list) {
    const out = [], bySeries = new Map();
    for (const t of list) {
      if (!t.seriesId) { out.push({ t, older: 0 }); continue; }
      const e = bySeries.get(t.seriesId);
      if (!e) { const entry = { t, older: 0 }; bySeries.set(t.seriesId, entry); out.push(entry); }
      else if (sched(t).to > sched(e.t).to) { e.t = t; e.older += 1; } else e.older += 1;
    }
    return out;
  }
  function todayGroups() {
    const open = openScheduled();
    const plain = (g) => g.map((t) => ({ t, older: 0 }));
    return [
      ['In ritardo', collapseSeries(open.filter((t) => temporal(t) === 'overdue').sort(byTime))],
      ['In svolgimento', plain(open.filter((t) => temporal(t) === 'current').sort(byTime))],
      ['Scade oggi', plain(open.filter((t) => temporal(t) === 'today').sort(byTime))],
    ];
  }
  function todayBody() {
    const groups = todayGroups(), total = groups.reduce((n, [, g]) => n + g.length, 0);
    let budget = todayExpanded ? Infinity : 7;
    const html = groups.map(([name, g]) => {
      const shown = g.slice(0, Math.max(0, budget));
      budget -= shown.length;
      return shown.length ? `<h3 class="m2-group">${name} <span class="muted">${g.length}</span></h3><div class="task-list">${shown.map((e) => row(e.t, { older: e.older })).join('')}</div>` : '';
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
    return `<div data-screen="dashboard">${heading('Un po’ di ordine, ogni giorno.', `Mercoledì 28 ottobre 2026 · ore ${timeOf(NOW)}`, `<button class="btn primary" data-action="capture">${icon('plus')} Cattura rapida</button>`)}
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
      <div class="m2-card-meta"><span class="task-space">${esc(t.space)}</span>${seriesMark(t)}${TEMPORAL_PILL[tmp] || ''}<span class="m2-time">${esc(s ? label(s) : 'Senza data')}</span>${afterNext(t)}</div>
      <div class="m2-card-actions">${COLUMNS.filter(([k]) => k !== st).map(([k, l]) => `<button class="text-btn" data-m2-col="${k}" data-m2-col-task="${t.id}">→ ${l}</button>`).join('')}</div>
    </article>`;
  }
  function tasksPage() {
    const spaces = [...new Set(state.tasks.map((t) => t.space))].sort();
    const limit = boardHorizon ? addDays(today, boardHorizon - 1) : null;
    const inScope = (t) => (!tasksSpace || t.space === tasksSpace) && (!limit || (sched(t) && endDay(sched(t)) <= limit)) && onBoard(t);
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
  page = function pageM2() {
    if (view === 'settings') return settingsPage();
    return view === 'tasks' && variant === 'B' ? tasksPage() : basePage();
  };
  const baseCrumb = crumb;
  crumb = function crumbM2() {
    if (view === 'settings') return '<span class="current">Impostazioni</span>';
    return view === 'tasks' ? '<span class="current">Task</span>' : baseCrumb();
  };

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
    return `<button class="m2-chip ${s.allDay ? 'is-allday' : 'is-timed'} ${seg} st-${st} ${temporal(t) === 'overdue' ? 'is-late' : ''}" data-m2-open="${t.id}" ${draggable(t)}>${time}<span class="od-clamp-2">${esc(t.title)}</span>${seriesMark(t, true)}</button>`;
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
          <span class="m2-time">${s.from ? `${timeOf(s.from)}–${timeOf(s.to)}` : `entro ${timeOf(s.to)}`}${seriesMark(t, true)}</span><span class="od-clamp-2">${esc(t.title)}</span>
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
      ${isSeries(t) ? `<small class="m3-pop-series">${icon('repeat')} ${esc(ruleLabel(defOf(t).rule, defOf(t).anchor))}${t.exception ? ' · modificata' : ''}</small>` : ''}
      ${skipEarlierButton(t)}
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
    const def = defOf(t);
    const pending = notifications().pending.slice(0, 8);
    const dump = t ? { id: t.id, title: t.title, status: status(t), temporal: temporal(t), schedule: sched(t), seriesId: t.seriesId, defId: t.defId, genKey: t.genKey, exception: t.exception, rule: def?.rule, reminder: reminderOf(t), history: t.history || [] } : null;
    return `<details class="m2-debug"><summary>Prototype NAS-155 · NAS-160 · ${esc(lastAction)}</summary>
      <div class="od-row m3-debug-row"><label class="small od-row">Ora demo <select data-m3-clock>${CLOCK.map((h) => `<option ${timeOf(NOW) === h ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
        <button class="btn" data-m2-reset>Ripristina dati demo</button></div>
      <h4>Notifiche in programma</h4>
      <ul>${pending.map((n) => `<li>${esc(dayName(dayOf(n.at)))} ${timeOf(n.at)} · ${n.trigger} · ${esc(n.t.title)}</li>`).join('') || '<li>Nessuna.</li>'}</ul>
      <h4>Ultimo task modificato</h4>
      <pre>${dump ? esc(JSON.stringify(dump, null, 2)) : 'Nessun task modificato.'}</pre></details>`;
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
    if (showSwitcher) {
      const sw = document.createElement('div');
      sw.id = 'm2-switcher-host';
      sw.innerHTML = switcherHtml();
      document.body.append(sw);
    }
    decorateM3();
    document.getElementById('m2-popover-host')?.remove();
    if (popover && view === 'calendar') {
      const host = document.createElement('div');
      host.id = 'm2-popover-host';
      host.innerHTML = popoverHtml();
      document.body.append(host);
    }
  };

  // ── eventi ────────────────────────────────────────────────────────────
  const byId = (id) => findTask((t) => t.id === Number(id)); // anche la bozza di «Cattura rapida»
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
    if (d.m2Reset !== undefined) { seed(true); NOW = `${today}T09:30`; lastAction = 'Dati demo ripristinati'; lastTaskId = null; popover = null; render(); return; }
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
    if (!showSwitcher || !['ArrowLeft', 'ArrowRight'].includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
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
    if (kind !== 'new' && isSeries(t)) { openScope({ kind: 'move', t, next: moveTarget(t, day, sched(t).allDay ? null : time) }); render(); return; }
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
      if (isSeries(t)) { openScope({ kind: 'move', t, next: { ...sched(t), to: addMin(sched(t).from, minutes) } }); render(); return; }
      resize(t, addMin(sched(t).from, minutes));
      render();
    };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
  }, true);

  // ══ M3 — Ricorrenze e notifiche (NAS-160, ADR-0029) ═════════════════════
  //
  // Un Task ricorrente è una definizione in state.series ({ id, seriesId, anchor, rule,
  // reminder }); le occorrenze sono righe di state.tasks con defId, seriesId e genKey
  // (il giorno generato dalla regola). Così Oggi, board e calendario di M2 le vedono
  // senza cambiare. Le notifiche sono derivate da occorrenze, promemoria e ora demo.

  Object.assign(paths, {
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
    repeat: 'M17 2l4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3',
    settings: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  });

  const WINDOW_DAYS = 30; // materializzazione (ADR-0011)
  const CLOCK = ['09:30', '12:00', '17:45', '18:05', '19:45', '23:59'];
  const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const UNITS = { daily: ['giorno', 'giorni'], weekly: ['settimana', 'settimane'], monthly: ['mese', 'mesi'], yearly: ['anno', 'anni'] };
  const FREQS = [['none', 'Non si ripete'], ['daily', 'Ogni giorno'], ['weekly', 'Ogni settimana'], ['monthly', 'Ogni mese'], ['yearly', 'Ogni anno']];
  const ALL_DAY_OFFSETS = [[0, 'Il giorno stesso alle 08:00'], [1440, 'Il giorno prima alle 08:00'], [2880, 'Due giorni prima alle 08:00'], [10080, 'Una settimana prima alle 08:00']];
  const TIMED_OFFSETS = [[0, 'All’ora esatta'], [5, '5 minuti prima'], [10, '10 minuti prima'], [15, '15 minuti prima'], [30, '30 minuti prima'], [60, '1 ora prima'], [120, '2 ore prima'], [1440, 'Il giorno prima']];
  const SCOPES = {
    one: ['Solo questa', 'Diventa «modificata»: la serie non la cambierà più.'],
    future: ['Questa e le future', 'La serie si divide qui; le occorrenze precedenti restano com’erano.'],
    all: ['Tutta la serie', 'Cambiano le occorrenze future non modificate; passate, chiuse e modificate restano.'],
  };
  const PRIORITY = { high: 0, normal: 1, low: 2 };

  const dow = (day) => (parse(day).getDay() + 6) % 7; // 0 = lunedì
  const lastOfMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const ymd = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const newId = () => (state.m3Seq = (state.m3Seq || 20000) + 1);
  const lcFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const occ = (n) => `${n} ${n === 1 ? 'occorrenza' : 'occorrenze'}`;

  // ── serie ─────────────────────────────────────────────────────────────
  function defOf(t) { return t?.defId ? (state.series || []).find((d) => d.id === t.defId) || null : null; }
  function isSeries(t) { return Boolean(defOf(t)?.rule); }
  const occurrencesOf = (def) => state.tasks.filter((t) => t.defId === def.id);
  /** Toccata (ADR-0029): eccezione, non più open, oppure con storia. Solo le non toccate e future si rigenerano. */
  const touched = (t) => Boolean(t.exception) || status(t) !== 'open' || (t.history || []).length > 0;
  const isFuture = (t) => { const s = sched(t); return Boolean(s) && (s.allDay ? s.to >= today : s.to > NOW); };
  const weekdaysOf = (rule, anchor) => [...(rule.byday?.length ? rule.byday : [dow(startDay(anchor))])].sort((a, b) => a - b);
  const olderOpen = (t) => state.tasks.filter((o) => o.seriesId && o.seriesId === t.seriesId && o !== t && status(o) === 'open' && sched(o) && sched(o).to < sched(t).to);
  /** «Salta le precedenti» sta solo sull'ultimo ritardo della serie, come la riga di Oggi. */
  function skipEarlierButton(t) {
    if (!isSeries(t) || temporal(t) !== 'overdue') return '';
    const newerLate = state.tasks.some((o) => o.seriesId === t.seriesId && o !== t && isActive(o) && temporal(o) === 'overdue' && sched(o).to > sched(t).to);
    const n = newerLate ? 0 : olderOpen(t).length;
    return n ? `<button class="text-btn m3-skip-earlier" data-m3-skip-earlier="${t.id}">${n === 1 ? 'Salta la precedente' : `Salta le ${n} precedenti`}</button>` : '';
  }

  /** Lo stesso Schedule di `s` (durata e orario), spostato sul giorno `day`. */
  function shiftSched(s, day) {
    const delta = diffDays(startDay(s), day);
    if (s.allDay) return { allDay: true, from: s.from ? addDays(s.from, delta) : null, to: addDays(s.to, delta) };
    const at = (v) => `${addDays(dayOf(v), delta)}T${timeOf(v)}`; // ora locale costante, anche al cambio dell'ora
    return { allDay: false, from: s.from ? at(s.from) : null, to: at(s.to) };
  }

  /** Giorni generati dalla regola dall'ancora fino a `untilDay`. Mesi senza il giorno → ultimo giorno del mese. */
  function ruleDays(rule, anchorDay, untilDay, max = 400) {
    const out = [], every = Math.max(1, Number(rule.interval) || 1), end = rule.end || { type: 'never' };
    const limit = end.type === 'until' && end.until < untilDay ? end.until : untilDay;
    const a = parse(anchorDay), y0 = a.getFullYear(), m0 = a.getMonth(), d0 = a.getDate();
    const full = () => end.type === 'count' && out.length >= end.count;
    for (let k = 0; out.length < max && !full(); k++) {
      let batch;
      if (rule.freq === 'daily') batch = [addDays(anchorDay, k * every)];
      else if (rule.freq === 'weekly') { const ws = addDays(weekStart(anchorDay), k * 7 * every); batch = weekdaysOf(rule, { to: anchorDay }).map((i) => addDays(ws, i)); }
      else if (rule.freq === 'monthly') { const m = m0 + k * every, y = y0 + Math.floor(m / 12), mm = ((m % 12) + 12) % 12; batch = [ymd(y, mm, Math.min(d0, lastOfMonth(y, mm)))]; }
      else { const y = y0 + k * every; batch = [ymd(y, m0, Math.min(d0, lastOfMonth(y, m0)))]; }
      if (batch[0] > limit) break;
      for (const d of batch) if (d >= anchorDay && d <= limit && !full()) out.push(d);
    }
    return out;
  }

  function ruleLabel(rule, anchor) {
    if (!rule) return 'Non si ripete';
    const n = Math.max(1, Number(rule.interval) || 1), [one, many] = UNITS[rule.freq];
    const parts = [n === 1 ? `Ogni ${one}` : `Ogni ${n} ${many}`];
    if (rule.freq === 'weekly') parts.push(weekdaysOf(rule, anchor).map((i) => WEEKDAYS[i]).join(', '));
    if (rule.freq === 'monthly') parts.push(`il ${parse(startDay(anchor)).getDate()}`);
    if (rule.freq === 'yearly') parts.push(`il ${dayName(startDay(anchor), { day: 'numeric', month: 'long' })}`);
    if (rule.end?.type === 'count') parts.push(`${rule.end.count} volte`);
    if (rule.end?.type === 'until') parts.push(`fino al ${dayName(rule.end.until, { day: 'numeric', month: 'short', year: 'numeric' })}`);
    return parts.join(' · ');
  }

  /** Crea le occorrenze mancanti nella finestra. Un giorno già presente nella serie (anche modificato) non si rigenera. */
  function materialize(def, { onlyFuture = false } = {}) {
    if (!def.rule) return 0;
    const taken = new Set(state.tasks.filter((t) => t.seriesId === def.seriesId).map((t) => t.genKey));
    let n = 0;
    for (const day of ruleDays(def.rule, startDay(def.anchor), addDays(today, WINDOW_DAYS))) {
      if (taken.has(day)) continue;
      const s = shiftSched(def.anchor, day);
      if (onlyFuture && !(s.allDay ? s.to >= today : s.to > NOW)) continue;
      state.tasks.push({ id: newId(), title: def.title, space: def.space, area: def.area, defId: def.id, seriesId: def.seriesId, genKey: day, exception: false, sched: s, date: dayOf(s.to), done: false, props: {}, localProps: [], history: [] });
      n += 1;
    }
    return n;
  }
  function regenerate(def) {
    const drop = new Set(occurrencesOf(def).filter((t) => !touched(t) && isFuture(t)));
    state.tasks = state.tasks.filter((t) => !drop.has(t));
    return materialize(def, { onlyFuture: true });
  }
  function note(text, t) { lastAction = text; lastTaskId = t?.id ?? lastTaskId; }

  function addRule(t, rule) {
    const s = sched(t);
    const def = { id: `def-${newId()}`, seriesId: `s-${t.id}`, title: t.title, space: t.space, area: t.area, reminder: clone(t.reminder || { mode: 'default' }), anchor: { ...s }, rule };
    state.series.push(def);
    Object.assign(t, { defId: def.id, seriesId: def.seriesId, genKey: startDay(s), exception: false });
    delete t.reminder;
    const n = materialize(def, { onlyFuture: true });
    note(`serie creata: «${t.title}» — ${ruleLabel(rule, def.anchor)}`, t);
    return n;
  }
  /** Togliere la regola: le future aperte diventano annullate, tranne la prossima (ADR-0029). */
  function removeRule(def) {
    const future = occurrencesOf(def).filter((o) => status(o) === 'open' && isFuture(o)).sort(byTime);
    for (const o of future.slice(1)) { o.status = 'cancelled'; (o.history ||= []).push({ kind: 'annullato', at: NOW, detail: 'regola rimossa' }); }
    def.rule = null;
    note(`regola rimossa: «${def.title}»`, future[0]);
    return Math.max(0, future.length - 1);
  }
  function applyRuleAll(def, rule, t) {
    def.rule = rule;
    const n = regenerate(def);
    note(`tutta la serie: «${def.title}» — ${ruleLabel(rule, def.anchor)}`, t);
    toast(`Serie aggiornata: ${occ(n)} ${n === 1 ? 'futura rigenerata' : 'future rigenerate'}.`);
  }
  /** Lo spostamento di un'occorrenza cambia il giorno della settimana solo per quel giorno, se la serie ne ha più di uno. */
  function adjustedRule(def, oldDay, newDay) {
    const r = clone(def.rule);
    if (r.freq === 'weekly') r.byday = [...new Set(weekdaysOf(r, def.anchor).map((i) => (i === dow(oldDay) ? dow(newDay) : i)))].sort((a, b) => a - b);
    return r;
  }
  function seriesMoveAll(def, t, next) {
    const oldDay = startDay(sched(t)), newDay = startDay(next);
    const multi = def.rule.freq === 'weekly' && weekdaysOf(def.rule, def.anchor).length > 1;
    const anchorDay = multi ? startDay(def.anchor) : addDays(startDay(def.anchor), diffDays(oldDay, newDay));
    def.rule = adjustedRule(def, oldDay, newDay);
    def.anchor = shiftSched(next, anchorDay);
    if (touched(t)) { setSched(t, next); t.genKey = newDay; }
    const n = regenerate(def);
    note(`tutta la serie: «${def.title}» — ${ruleLabel(def.rule, def.anchor)}, ${label(next)}`, state.tasks.find((o) => o.seriesId === def.seriesId && o.genKey === newDay));
    toast(`Serie aggiornata: ${occ(n)} ${n === 1 ? 'futura rigenerata' : 'future rigenerate'}.`);
  }
  /** Split «questa e le future» al giorno `cut`: la regola vecchia finisce prima, nasce un Task nuovo con lo stesso seriesId. */
  function seriesSplit(def, cut, anchor, rule) {
    def.rule = { ...def.rule, end: { type: 'until', until: addDays(cut, -1) } };
    state.tasks = state.tasks.filter((o) => !(o.defId === def.id && o.genKey >= cut && !touched(o)));
    const nd = { id: `def-${newId()}`, seriesId: def.seriesId, title: def.title, space: def.space, area: def.area, reminder: clone(def.reminder || { mode: 'default' }), anchor, rule };
    state.series.push(nd);
    const n = materialize(nd);
    note(`serie divisa: «${def.title}» da ${dayName(startDay(anchor))} — ${ruleLabel(rule, anchor)}`, state.tasks.find((o) => o.defId === nd.id));
    toast(`Serie divisa: da ${dayName(startDay(anchor))} vale la regola nuova (${occ(n)}).`);
  }
  function seriesSplitMove(def, t, next) {
    const cut = t.genKey, oldDay = startDay(sched(t)), newDay = startDay(next);
    const before = ruleDays(def.rule, startDay(def.anchor), addDays(cut, -1)).length;
    const rule = adjustedRule(def, oldDay, newDay);
    if (rule.end?.type === 'count') rule.end = { type: 'count', count: Math.max(1, rule.end.count - before) };
    if (touched(t)) { setSched(t, next); t.genKey = newDay; t.exception = true; }
    seriesSplit(def, cut, next, rule);
  }
  function skipEarlier(t) {
    const older = olderOpen(t);
    for (const o of older) { o.status = 'skipped'; o.done = false; (o.history ||= []).push({ kind: 'saltato', at: NOW, detail: 'salta le precedenti' }); }
    note(`saltate ${older.length} precedenti: «${t.title}»`, t);
    persist();
    return older.length;
  }

  // ── viste ─────────────────────────────────────────────────────────────
  function seriesMark(t, compact = false) {
    if (!isSeries(t)) return '';
    const def = defOf(t), text = `${ruleLabel(def.rule, def.anchor)}${t.exception ? ' · modificata' : ''}`;
    return `<span class="m3-rec" title="${esc(text)}">${icon('repeat')}<span class="sr-only">Serie: ${esc(text)}</span></span>${t.exception && !compact ? '<span class="m3-tag">Modificata</span>' : ''}`;
  }
  /** Board (ADR-0029): per ogni serie i ritardi, le occorrenze in corso e la prima aperta non scaduta. */
  function onBoard(t) {
    if (!t.seriesId || !isActive(t) || status(t) === 'in_progress' || temporal(t) === 'overdue') return true;
    const next = state.tasks.filter((o) => o.seriesId === t.seriesId && status(o) === 'open' && sched(o) && temporal(o) !== 'overdue').sort(byTime)[0];
    return next === t;
  }
  function afterNext(t) {
    if (!isSeries(t) || !isActive(t)) return '';
    if (temporal(t) === 'overdue') return skipEarlierButton(t);
    const next = state.tasks.filter((o) => o.seriesId === t.seriesId && o !== t && isActive(o) && sched(o) && sched(o).to > sched(t).to).sort(byTime)[0];
    return next ? `<small class="muted">poi ${esc(dayName(startDay(sched(next))))}</small>` : '';
  }

  // ── notifiche (derivate, ADR-0006 e ADR-0029) ──────────────────────────
  function reminderOf(t) { return (defOf(t) || t || {}).reminder || { mode: 'default' }; }
  function offsetOf(t, s) {
    const r = reminderOf(t);
    if (r.mode === 'none') return null;
    if (r.mode === 'custom') return Number(r.offset) || 0;
    return s.allDay ? state.notifSettings.allDay : state.notifSettings.timed;
  }
  function triggersOf(t) {
    const s = sched(t);
    if (!s) return [];
    const out = [], off = offsetOf(t, s);
    if (off !== null) {
      const ref = s.from || s.to;
      out.push({ trigger: s.from ? 'starts' : 'dueSoon', at: addMin(s.allDay ? `${dayOf(ref)}T08:00` : ref, -off), thread: `task:${t.id}`, priority: s.from ? 'low' : 'normal' });
    }
    out.push({ trigger: 'overdue', at: s.allDay ? `${addDays(s.to, 1)}T00:00` : s.to, thread: `series:${t.seriesId || t.id}:overdue`, priority: 'high' });
    return out.map((n) => ({ ...n, key: `${t.id}:${n.trigger}`, t }));
  }
  function notifications() {
    const fired = [], pending = [], horizon = `${addDays(today, -30)}T00:00`;
    for (const n of state.tasks.flatMap(triggersOf)) {
      if (n.at > NOW) { if (isActive(n.t)) pending.push(n); continue; }
      if (n.at < horizon) continue; // retention 30 giorni
      const meta = state.notifState[n.key] || {};
      fired.push({ ...n, read: Boolean(meta.read || meta.dismissed), dismissed: Boolean(meta.dismissed), resolved: isActive(n.t) ? null : status(n.t) });
    }
    // L'overdue risolve dueSoon e starts della stessa occorrenza.
    const late = new Set(fired.filter((n) => n.trigger === 'overdue').map((n) => n.t.id));
    for (const n of fired) if (n.trigger !== 'overdue' && !n.resolved && late.has(n.t.id)) n.resolved = 'superseded';
    // Supersede nel thread dell'overdue della serie: resta solo il più recente.
    const latest = {};
    for (const n of fired) if (n.trigger === 'overdue' && !n.resolved && (!latest[n.thread] || n.at > latest[n.thread].at)) latest[n.thread] = n;
    for (const n of fired) if (n.trigger === 'overdue' && !n.resolved && latest[n.thread] !== n) n.resolved = 'superseded';
    const active = fired.filter((n) => !n.resolved && !n.dismissed).sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || b.at.localeCompare(a.at));
    return { active, pending: pending.sort((a, b) => a.at.localeCompare(b.at)), unread: active.filter((n) => !n.read).length };
  }
  function relDay(day) {
    const d = diffDays(today, day);
    return d === 0 ? 'oggi' : d === 1 ? 'domani' : d === -1 ? 'ieri' : dayName(day, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const whenOf = (s, v) => (s.allDay ? relDay(dayOf(v)) : `${relDay(dayOf(v))} alle ${timeOf(v)}`);
  function notifBody(n) {
    const s = sched(n.t);
    return n.trigger === 'overdue' ? `Scadeva ${whenOf(s, s.to)}` : n.trigger === 'starts' ? `Inizia ${whenOf(s, s.from)}` : `Scade ${whenOf(s, s.to)}`;
  }
  function ago(at) {
    const m = diffMin(at, NOW);
    if (m < 1) return 'adesso';
    if (m < 60) return `${m} min fa`;
    if (m < 1440) return `${Math.floor(m / 60)} h fa`;
    const d = Math.floor(m / 1440);
    return d === 1 ? 'ieri' : `${d} giorni fa`;
  }
  const mark = (key, patch) => { state.notifState[key] = { ...(state.notifState[key] || {}), ...patch }; };
  const offsetText = (allDay, min) => (allDay ? ALL_DAY_OFFSETS : TIMED_OFFSETS).find(([m]) => m === Number(min))?.[1] || `${min} minuti prima`;

  let bellOpen = false;
  function bellPopover(nt) {
    const rows = nt.active.map((n) => `<div class="m3-notif prio-${n.priority} ${n.read ? '' : 'is-unread'}">
        <button class="m3-notif-main" data-m3-open-notif="${n.key}"><span class="m3-dot" aria-hidden="true"></span>
          <span class="od-field"><span class="m3-notif-title">${esc(n.t.title)}</span><small class="muted">${esc(notifBody(n))} · ${ago(n.at)}</small>${n.read ? '' : '<span class="sr-only">Non letta</span>'}</span></button>
        <button class="icon-btn m3-dismiss" data-m3-dismiss="${n.key}" aria-label="Rimuovi la notifica «${esc(n.t.title)}»">×</button></div>`).join('');
    return `<div class="m3-notif-pop" id="m3-notif-pop" role="dialog" aria-label="Notifiche">
      <header class="m3-notif-head"><strong>Notifiche</strong>${nt.unread ? '<button class="text-btn" data-m3-read-all>Segna tutte come lette</button>' : ''}</header>
      <div class="m3-notif-list">${rows || '<p class="m3-notif-empty">Nessuna notifica</p>'}</div>
      <footer class="m3-notif-foot"><button class="text-btn" data-nav="settings">Impostazioni dei promemoria</button></footer></div>`;
  }

  // ── Impostazioni ──────────────────────────────────────────────────────
  function settingsPage() {
    const ns = state.notifSettings;
    const usingDefault = notifications().pending.filter((n) => n.trigger !== 'overdue' && reminderOf(n.t).mode === 'default').length;
    const select = (key, options) => `<select class="property-select" data-m3-default="${key}">${options.map(([m, l]) => `<option value="${m}" ${ns[key] === m ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    return `<section data-screen="settings">${heading('Impostazioni', '')}
      <section class="section m3-settings"><div class="section-head"><h2>Promemoria</h2></div>
        <p class="small muted">Valgono per i task con promemoria «Predefinito». Il ritardo arriva comunque.</p>
        <label class="m3-field"><span>Task di un giorno intero</span>${select('allDay', ALL_DAY_OFFSETS)}</label>
        <label class="m3-field"><span>Task con orario</span>${select('timed', TIMED_OFFSETS)}</label>
        <p class="small muted">${usingDefault} promemoria in programma usano questi valori.</p></section>
      ${debugBar()}</section>`;
  }

  // ── pagina task: Ripete e Promemoria ─────────────────────────────────
  function decorateTaskPage() {
    const t = findTask((x) => x.id === taskId);
    const group = document.querySelector('[data-screen="entity-task"] .property-group[aria-label="Campi core"]');
    if (!t || !group) return;
    const def = defOf(t), s = sched(t), r = reminderOf(t), series = isSeries(t);
    if (t.isDraft && !s) delete t.pendingRule; // senza scadenza la serie non ha una prima occorrenza
    const label = series ? ruleLabel(def.rule, def.anchor) : t.pendingRule ? ruleLabel(t.pendingRule, s) : 'Non si ripete';
    const ruleCtl = `<span class="m3-inline"><button class="m3-rule-btn" data-m3-edit-rule="${t.id}">${esc(label)}</button>${t.exception ? '<span class="m3-tag">Modificata</span>' : ''}</span>`;
    const ruleNote = t.exception ? 'la serie non la cambia più' : t.isDraft && !s ? 'serve una scadenza' : '';
    let html = propertyRow('Ripete', 'repeat', ruleCtl, ruleNote);
    if (s) {
      const fallback = s.allDay ? state.notifSettings.allDay : state.notifSettings.timed;
      const mode = `<select class="property-select" data-m3-reminder="${t.id}" aria-label="Promemoria">
        <option value="default" ${r.mode === 'default' ? 'selected' : ''}>Predefinito · ${esc(lcFirst(offsetText(s.allDay, fallback)))}</option>
        <option value="custom" ${r.mode === 'custom' ? 'selected' : ''}>Personalizzato</option>
        <option value="none" ${r.mode === 'none' ? 'selected' : ''}>Nessun promemoria</option></select>`;
      const offset = r.mode === 'custom' ? `<select class="property-select" data-m3-offset="${t.id}" aria-label="Quando arriva il promemoria">${(s.allDay ? ALL_DAY_OFFSETS : TIMED_OFFSETS).map(([m, l]) => `<option value="${m}" ${Number(r.offset) === m ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '';
      html += propertyRow('Promemoria', 'bell', `<span class="m3-inline">${mode}${offset}</span>`, r.mode === 'none' ? 'il ritardo arriva comunque' : series ? 'vale per tutta la serie' : '');
    }
    group.insertAdjacentHTML('beforeend', html);
  }

  function decorateM3() {
    const nt = notifications();
    document.querySelector('.topbar [data-action="theme"]')?.insertAdjacentHTML('beforebegin',
      `<button class="icon-btn m3-bell" data-m3-bell aria-expanded="${bellOpen}" aria-controls="m3-notif-pop" aria-label="Notifiche${nt.unread ? `, ${nt.unread} non lette` : ''}">${icon('bell')}${nt.unread ? `<span class="m3-badge" aria-hidden="true">${nt.unread > 9 ? '9+' : nt.unread}</span>` : ''}</button>`);
    document.querySelector('.sidebar .side-bottom [data-action="search"]')?.insertAdjacentHTML('beforebegin',
      `<button class="nav-item ${view === 'settings' ? 'active' : ''}" data-nav="settings" title="Impostazioni">${icon('settings')}<span class="hide-rail od-field">Impostazioni</span></button>`);
    document.getElementById('m3-bell-host')?.remove();
    if (bellOpen) {
      const host = document.createElement('div');
      host.id = 'm3-bell-host';
      host.innerHTML = bellPopover(nt);
      document.body.append(host);
    }
    if (view === 'task') decorateTaskPage();
  }

  // ── dialog: regola e scope ────────────────────────────────────────────
  const ruleDlg = Object.assign(document.createElement('dialog'), { id: 'm3-rule', className: 'm3-dialog' });
  const scopeDlg = Object.assign(document.createElement('dialog'), { id: 'm3-scope', className: 'm3-dialog' });
  ruleDlg.setAttribute('aria-labelledby', 'm3-rule-title');
  scopeDlg.setAttribute('aria-labelledby', 'm3-scope-title');
  document.body.append(ruleDlg, scopeDlg);
  let draft = null, scope = null;

  /** Riscrive il dialog mantenendo il focus sul controllo che l'utente stava usando. */
  function refill(dlg, html) {
    const a = document.activeElement;
    let key = null;
    if (a && dlg.contains(a)) {
      if (a.dataset.m3Rd) key = `[data-m3-rd="${a.dataset.m3Rd}"]${a.type === 'radio' ? `[value="${a.value}"]` : ''}`;
      else if (a.dataset.m3RdDay) key = `[data-m3-rd-day="${a.dataset.m3RdDay}"]`;
    }
    dlg.innerHTML = html;
    if (key) dlg.querySelector(key)?.focus();
  }

  function openRuleEditor(t) {
    const def = defOf(t), s = sched(t), rule = isSeries(t) ? def.rule : t.pendingRule || null;
    draft = {
      taskId: t.id, freq: rule?.freq || 'none', interval: rule?.interval || 1,
      byday: rule ? weekdaysOf(rule, def?.anchor || s) : s ? [dow(startDay(s))] : [],
      endType: rule?.end?.type || 'never', count: rule?.end?.count || 10, until: rule?.end?.until || addDays(today, 90),
    };
    fillRule();
    ruleDlg.showModal();
  }
  function draftRule() {
    if (draft.freq === 'none') return null;
    const end = draft.endType === 'count' ? { type: 'count', count: Math.max(1, Number(draft.count) || 1) } : draft.endType === 'until' ? { type: 'until', until: draft.until } : { type: 'never' };
    return { freq: draft.freq, interval: Math.max(1, Number(draft.interval) || 1), byday: draft.freq === 'weekly' ? [...draft.byday].sort((a, b) => a - b) : [], end };
  }
  function fillRule() {
    const t = byId(draft.taskId), s = sched(t), def = defOf(t), series = isSeries(t), rule = draftRule();
    const anchor = series ? def.anchor : s;
    const dayN = anchor ? parse(startDay(anchor)).getDate() : null;
    let warn = '';
    if (!s) warn = 'Serve una scadenza: la prima occorrenza parte da lì.';
    else if (draft.freq === 'weekly' && !draft.byday.length) warn = 'Scegli almeno un giorno.';
    else if (draft.freq === 'monthly' && dayN >= 29) warn = `Nei mesi senza il ${dayN} cade l’ultimo giorno del mese.`;
    else if (draft.freq === 'yearly' && startDay(anchor).slice(5) === '02-29') warn = 'Negli anni non bisestili cade il 28 febbraio.';
    let removal = '';
    if (series && !rule) {
      const future = occurrencesOf(def).filter((o) => status(o) === 'open' && isFuture(o)).sort(byTime);
      removal = future.length > 1 ? `Le ${future.length - 1} occorrenze successive diventano annullate; resta quella di ${dayName(startDay(sched(future[0])))}.` : 'Nessuna occorrenza futura da annullare.';
    }
    const preview = rule && s && !(draft.freq === 'weekly' && !draft.byday.length) ? ruleDays(rule, startDay(anchor), addDays(today, 800)).filter((d) => d >= today).slice(0, 5) : [];
    const [one, many] = UNITS[draft.freq] || UNITS.daily;
    const n = Math.max(1, Number(draft.interval) || 1);
    const checked = (v) => (draft.endType === v ? 'checked' : '');
    const blocked = !s || (draft.freq === 'weekly' && !draft.byday.length);
    refill(ruleDlg, `<h2 id="m3-rule-title">Ripetizione</h2><p class="small muted">${esc(t.title)}</p>
      <div class="m3-form">
        <label class="m3-field"><span>Frequenza</span><select class="property-select" data-m3-rd="freq">${FREQS.map(([v, l]) => `<option value="${v}" ${draft.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${draft.freq === 'none' ? '' : `<label class="m3-inline">Ogni <input class="property-input m3-num" type="number" min="1" max="99" data-m3-rd="interval" value="${n}" aria-label="Intervallo"> ${n === 1 ? one : many}</label>`}
        ${draft.freq === 'weekly' ? `<fieldset class="m3-field"><legend>Giorni</legend><div class="m3-days">${WEEKDAYS.map((w, i) => `<button type="button" class="m3-day" aria-pressed="${draft.byday.includes(i)}" data-m3-rd-day="${i}">${w}</button>`).join('')}</div></fieldset>` : ''}
        ${draft.freq === 'none' ? '' : `<fieldset class="m3-field"><legend>Fine</legend>
          <label class="m3-radio"><input type="radio" name="m3-end" value="never" data-m3-rd="endType" ${checked('never')}> Mai</label>
          <label class="m3-radio"><input type="radio" name="m3-end" value="count" data-m3-rd="endType" ${checked('count')}> Dopo <input class="property-input m3-num" type="number" min="1" max="999" data-m3-rd="count" value="${esc(draft.count)}" aria-label="Numero di occorrenze"> volte</label>
          <label class="m3-radio"><input type="radio" name="m3-end" value="until" data-m3-rd="endType" ${checked('until')}> Fino al <input class="property-input" type="date" data-m3-rd="until" value="${esc(draft.until)}" aria-label="Ultimo giorno"></label></fieldset>`}
        ${warn ? `<p class="notice m3-note">${warn}</p>` : ''}
        ${removal ? `<p class="notice m3-note">${removal}</p>` : ''}
        ${preview.length ? `<p class="m3-preview">Prossime: ${preview.map((d) => esc(dayName(d))).join(', ')}</p>` : ''}
      </div>
      <div class="dialog-actions"><button type="button" class="btn" data-m3-close>Annulla</button><button type="button" class="btn primary" data-m3-rule-save ${blocked && draft.freq !== 'none' ? 'disabled' : ''}>Salva</button></div>`);
  }
  function saveRule() {
    const t = byId(draft.taskId), def = defOf(t), series = isSeries(t), rule = draftRule();
    ruleDlg.close();
    if (t.isDraft) { if (rule) t.pendingRule = rule; else delete t.pendingRule; render(); return; } // si applica a «Crea task»
    if (!series && !rule) return;
    if (!series) { const n = addRule(t, rule); persist(); render(); toast(`Serie creata: ${occ(n + 1)} nei prossimi ${WINDOW_DAYS} giorni.`); return; }
    if (!rule) { const n = removeRule(def); persist(); render(); toast(n ? `Regola tolta: ${occ(n)} ${n === 1 ? 'annullata' : 'annullate'}.` : 'Regola tolta.'); return; }
    if (JSON.stringify(rule) === JSON.stringify({ ...def.rule, byday: def.rule.freq === 'weekly' ? weekdaysOf(def.rule, def.anchor) : [] })) return;
    if (t.genKey === startDay(def.anchor)) { applyRuleAll(def, rule, t); follow(t.seriesId, t.genKey); persist(); render(); return; } // prima occorrenza: solo «Tutta la serie»
    openScope({ kind: 'rule', t, rule });
  }

  function openScope(p) {
    const def = defOf(p.t), first = p.t.genKey === startDay(def.anchor);
    const options = p.kind === 'move' ? (first ? ['one', 'all'] : ['one', 'future', 'all']) : ['future', 'all'];
    scope = { ...p, options, first };
    const summary = p.kind === 'move' ? `${label(sched(p.t))} → ${label(p.next)}` : `${ruleLabel(def.rule, def.anchor)} → ${ruleLabel(p.rule, def.anchor)}`;
    scopeDlg.innerHTML = `<h2 id="m3-scope-title">Modifica di «${esc(p.t.title)}»</h2><p class="small muted">${esc(summary)}</p>
      <fieldset class="m3-scope"><legend class="sr-only">Cosa cambia</legend>${options.map((k, i) => `<label><input type="radio" name="m3-scope" value="${k}" ${i === 0 ? 'checked' : ''}><strong>${SCOPES[k][0]}</strong><small>${SCOPES[k][1]}</small></label>`).join('')}</fieldset>
      ${first && p.kind === 'move' ? '<p class="small muted">È la prima occorrenza: dividere qui equivale a cambiare tutta la serie.</p>' : ''}
      <div class="dialog-actions"><button type="button" class="btn" data-m3-close>Annulla</button><button type="button" class="btn primary" data-m3-scope-apply>Applica</button></div>`;
    scopeDlg.showModal();
  }
  /** Una rigenerazione può sostituire l'occorrenza aperta: la pagina task segue quella dello stesso giorno. */
  function follow(seriesId, day) {
    if (view !== 'task' || state.tasks.some((x) => x.id === taskId)) return;
    const next = state.tasks.find((o) => o.seriesId === seriesId && (o.genKey === day || (sched(o) && startDay(sched(o)) === day)));
    if (next) taskId = next.id;
    else view = 'tasks';
  }
  function applyScope() {
    const choice = scopeDlg.querySelector('input[name="m3-scope"]:checked')?.value || scope.options[0];
    const { t, kind } = scope, def = defOf(t);
    const day = kind === 'move' ? startDay(scope.next) : t.genKey;
    scopeDlg.close();
    if (kind === 'move') {
      if (choice === 'one') { setSched(t, scope.next); t.exception = true; log(t, 'spostato', `solo questa · ${label(scope.next)}`); }
      else if (choice === 'all') seriesMoveAll(def, t, scope.next);
      else seriesSplitMove(def, t, scope.next);
    } else if (choice === 'all') applyRuleAll(def, scope.rule, t);
    else seriesSplit(def, t.genKey, sched(t), scope.rule);
    follow(t.seriesId, day);
    scope = null;
    persist();
    render();
  }
  scopeDlg.addEventListener('close', () => { if (scope) { scope = null; render(); } }); // Esc o Annulla: il campo torna al valore salvato

  // ── bozza con ripetizione: la regola si applica a «Crea task» ─────────
  const createDraftBase = createTaskFromDraft;
  createTaskFromDraft = function () { // click e Ctrl+Enter di app.js la chiamano per nome
    const rule = taskDraft?.pendingRule;
    createDraftBase();
    if (taskDraft) return; // titolo mancante: la bozza resta aperta
    const t = byId(taskId);
    if (!rule || !t) return;
    delete t.pendingRule;
    const n = addRule(t, rule);
    persist();
    render();
    toast(`Serie creata: ${occ(n + 1)} nei prossimi ${WINDOW_DAYS} giorni.`);
  };

  // ── eventi M3 ─────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (bellOpen && !e.target.closest('#m3-bell-host, [data-m3-bell]')) { bellOpen = false; render(); }
    if (!b) return;
    const d = b.dataset;
    if (d.m3Bell !== undefined) { e.stopPropagation(); bellOpen = !bellOpen; render(); document.querySelector(bellOpen ? '#m3-bell-host button' : '[data-m3-bell]')?.focus(); return; }
    if (d.m3ReadAll !== undefined) { notifications().active.forEach((n) => mark(n.key, { read: true })); persist(); render(); document.querySelector('#m3-bell-host button')?.focus(); return; }
    if (d.m3Dismiss) { e.stopPropagation(); mark(d.m3Dismiss, { read: true, dismissed: true }); persist(); render(); document.querySelector('#m3-bell-host button')?.focus(); return; }
    if (d.m3OpenNotif) { e.stopPropagation(); const id = Number(d.m3OpenNotif.split(':')[0]); mark(d.m3OpenNotif, { read: true }); bellOpen = false; persist(); nav('task', id); return; }
    if (d.nav === 'settings' && bellOpen) bellOpen = false;
    if (d.m3EditRule) { openRuleEditor(byId(d.m3EditRule)); return; }
    if (d.m3RdDay) { const i = Number(d.m3RdDay); draft.byday = draft.byday.includes(i) ? draft.byday.filter((x) => x !== i) : [...draft.byday, i]; fillRule(); return; }
    if (d.m3Close !== undefined) { b.closest('dialog').close(); return; }
    if (d.m3RuleSave !== undefined) { saveRule(); return; }
    if (d.m3ScopeApply !== undefined) { applyScope(); return; }
    if (d.m3SkipEarlier) { e.stopPropagation(); const t = byId(d.m3SkipEarlier); const n = skipEarlier(t); popover = null; render(); toast(n === 1 ? `Saltata l’occorrenza precedente di «${t.title}».` : `Saltate ${n} occorrenze precedenti di «${t.title}».`); }
  }, true);

  document.addEventListener('change', (e) => {
    const el = e.target, d = el.dataset;
    if (d.m3Rd) { draft[d.m3Rd] = el.value; if (d.m3Rd === 'count' || d.m3Rd === 'until') draft.endType = d.m3Rd; fillRule(); return; }
    if (d.taskDate && taskDraft?.id === Number(d.taskDate) && Boolean(taskDraft.date) !== Boolean(el.value)) {
      setTimeout(render); // app.js salva la data senza ridisegnare: Ripete e Promemoria dipendono dalla scadenza
    }
    if (d.taskDate && el.value) {
      const t = findTask((x) => x.id === Number(d.taskDate));
      if (t && isSeries(t)) { e.stopImmediatePropagation(); openScope({ kind: 'move', t, next: moveTarget(t, el.value) }); return; }
    }
    if (d.taskTitle && el.value.trim()) {
      const t = findTask((x) => x.id === Number(d.taskTitle)), def = defOf(t);
      if (def) { // il titolo sta sul Task: vale per tutte le sue occorrenze (ADR-0029)
        e.stopImmediatePropagation();
        def.title = el.value.trim();
        occurrencesOf(def).forEach((o) => (o.title = def.title));
        persist();
        toast('Titolo aggiornato per tutta la serie.');
        return;
      }
    }
    if (d.m3Reminder) {
      const t = byId(d.m3Reminder), owner = defOf(t) || t, s = sched(t);
      owner.reminder = el.value === 'custom' ? { mode: 'custom', offset: s.allDay ? state.notifSettings.allDay : state.notifSettings.timed } : { mode: el.value };
      note(`promemoria: «${t.title}» → ${el.value}`, t);
      persist(); render(); if (!t.isDraft) toast(`Promemoria aggiornato${isSeries(t) ? ' per tutta la serie' : ''}.`);
      return;
    }
    if (d.m3Offset) {
      const t = byId(d.m3Offset), owner = defOf(t) || t;
      owner.reminder = { mode: 'custom', offset: Number(el.value) };
      note(`promemoria: «${t.title}» → ${el.value} min`, t);
      persist(); render(); if (!t.isDraft) toast(`Promemoria aggiornato${isSeries(t) ? ' per tutta la serie' : ''}.`);
      return;
    }
    if (d.m3Default) {
      state.notifSettings[d.m3Default] = Number(el.value);
      persist(); render();
      toast('Promemoria predefiniti aggiornati: le notifiche in programma si spostano.');
      return;
    }
    if (d.m3Clock !== undefined) { NOW = `${today}T${el.value}`; lastAction = `ora demo ${el.value}`; render(); }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bellOpen) { bellOpen = false; render(); document.querySelector('[data-m3-bell]')?.focus(); }
  });

  // ── dati demo M3 ──────────────────────────────────────────────────────
  const DEMO_SERIES = [
    // giornaliera ignorata da una settimana: ritardi raggruppati e «Salta le precedenti»
    { id: 'def-meditare', seriesId: 's-meditare', title: 'Meditare 10 minuti', space: 'Protocollo digiuno', area: 'Salute', reminder: { mode: 'none' },
      anchor: { allDay: true, from: null, to: '2026-10-14' }, rule: { freq: 'daily', interval: 1, byday: [], end: { type: 'never' } }, done: (d) => d <= '2026-10-20' },
    // settimanale su più giorni con orario: promemoria predefinito alle 18:00
    { id: 'def-allenamento', seriesId: 's-allenamento', title: 'Allenamento', space: 'Salute', area: 'Salute', reminder: { mode: 'default' },
      anchor: { allDay: false, from: '2026-10-19T18:30', to: '2026-10-19T19:30' }, rule: { freq: 'weekly', interval: 1, byday: [0, 2, 4], end: { type: 'never' } }, done: (d) => d < today },
    // mensile dal 31: settembre cade il 30 (fine mese)
    { id: 'def-affitto', seriesId: 's-affitto', title: 'Pagare l’affitto', space: 'Inbox', area: '', reminder: { mode: 'default' },
      anchor: { allDay: true, from: null, to: '2026-08-31' }, rule: { freq: 'monthly', interval: 1, byday: [], end: { type: 'never' } }, done: (d) => d < today },
    // settimanale con un'eccezione: giovedì 29 spostata a venerdì 30
    { id: 'def-studiox', seriesId: 's-studiox', title: 'Call settimanale Studio X', space: 'Cliente Studio X', area: 'Lavoro', reminder: { mode: 'custom', offset: 15 },
      anchor: { allDay: false, from: '2026-10-08T10:00', to: '2026-10-08T10:30' }, rule: { freq: 'weekly', interval: 1, byday: [3], end: { type: 'never' } }, done: (d) => d < today,
      exceptions: { '2026-10-29': { allDay: false, from: '2026-10-30T11:00', to: '2026-10-30T11:30' } } },
  ];
  function seedM3(reset) {
    state.notifSettings ||= { allDay: 1440, timed: 30 };
    state.notifState ||= {};
    state.series ||= [];
    if (state.m3Seeded && !reset) return;
    state.series = [];
    state.notifState = {};
    state.notifSettings = { allDay: 1440, timed: 30 };
    state.m3Seq = 20000;
    state.tasks = state.tasks.filter((t) => t.id !== 8 && !t.defId); // «Allenamento» di app.js diventa una serie vera
    for (const s of DEMO_SERIES) {
      const def = { id: s.id, seriesId: s.seriesId, title: s.title, space: s.space, area: s.area, reminder: clone(s.reminder), anchor: clone(s.anchor), rule: clone(s.rule) };
      state.series.push(def);
      materialize(def);
      for (const o of occurrencesOf(def)) {
        if (s.done(o.genKey)) Object.assign(o, { done: true, status: 'completed', history: [{ kind: 'completato', at: `${o.genKey}T20:00`, detail: '' }] });
        if (s.exceptions?.[o.genKey]) { setSched(o, s.exceptions[o.genKey]); o.exception = true; }
      }
    }
    for (const n of notifications().active) if (n.at < `${addDays(today, -1)}T12:00`) mark(n.key, { read: true });
    state.m3Seeded = true;
  }

  seed();
  render();
})();
