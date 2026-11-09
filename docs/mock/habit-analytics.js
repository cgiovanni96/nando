/*
 * NAS-60 — dettaglio Habit del prototipo.
 * Storico per periodo, forza, streak, fonti attive ed evidenze.
 * Throwaway: nessun backend, nessun test, solo DOM e dati del mock.
 */

let habitAnalyticsYear = 2026;
let habitEvidenceDay = '';
let habitEvidenceLimit = 10;
let habitEvidenceTrigger = null;
let habitCheckReturn = null;
let habitCheckHabitId = null;
let habitConfigReturn = null;

function habitTaskForBinding(binding) {
  return state.tasks.find((task) => task.id === Number(binding.taskId)) || null;
}

function habitSourceStateLabel(sourceState) {
  return { active: 'Attiva', disabled: 'Spenta', closed: 'Chiusa' }[sourceState] || sourceState;
}

function habitCloseReasonLabel(reason) {
  return {
    target_completed: 'Task completato',
    target_cancelled: 'Task cancellato',
    series_ended: 'Serie terminata'
  }[reason] || 'Chiusa';
}

function habitEvidenceSourceLabel(evidence) {
  if (evidence.provenance === 'task') return 'Task collegato';
  if (evidence.provenance === 'capability_event') return 'Evento Space';
  if (evidence.provenance === 'manual') return evidence.occurredAt ? 'Check-in manuale' : 'Origine non disponibile';
  return 'Origine non disponibile';
}

function habitRangeText(start, end) {
  if (!start || !end) return '—';
  if (start === end) return habitFormatDate(start);
  return `${habitFormatShortDate(start)} – ${habitFormatDate(end)}`;
}

function habitRectificationLabel(rectification) {
  return {
    task_reopened: 'Task riaperto',
    task_cancelled: 'Task cancellato',
    manual_revocation: 'Revoca manuale',
    activity_split: 'Attività separata',
    duplicate: 'Duplicato'
  }[rectification?.reason] || 'Rettificata';
}

/* --------------------------------------------------------------------------
 * Fonti attive
 * ----------------------------------------------------------------------- */

function habitSourceRow(binding) {
  const task = habitTaskForBinding(binding);
  const title = task ? task.title : binding.taskTitle;
  const titleHtml = task
    ? `<button class="habit-source-title" data-nav="task" data-arg="${task.id}">${esc(title)}</button>`
    : `<strong>${esc(title)}</strong>`;
  const kind = binding.targetKind === 'series'
    ? `Serie${binding.recurrence ? ' · ' + binding.recurrence : ''}`
    : 'Task';
  const meta = binding.state === 'closed'
    ? `${kind} · chiusa il ${habitFormatDate(binding.closedAt)} · ${habitCloseReasonLabel(binding.closeReason)}`
    : `${kind} · dal ${habitFormatDate(binding.createdAt)}`;
  const action = binding.state === 'active'
    ? `<button class="text-btn" data-habit-source-state="disabled" data-habit-binding="${binding.id}">Disattiva</button>`
    : binding.state === 'disabled'
      ? `<button class="text-btn" data-habit-source-state="active" data-habit-binding="${binding.id}">Riattiva</button>`
      : '';
  return `<div class="habit-source-row is-${binding.state}"><span class="habit-source-icon" aria-hidden="true">${icon(binding.targetKind === 'series' ? 'habit' : 'check')}</span><span class="od-field od-fill"><span class="habit-source-title-wrap">${titleHtml}</span><small>${esc(meta)}</small></span><span class="pill">${habitSourceStateLabel(binding.state)}</span>${action}</div>`;
}

function habitSourcesSection(habit) {
  const groups = { active: [], disabled: [], closed: [] };
  (habit.bindings || []).forEach((binding) => {
    if (groups[binding.state]) groups[binding.state].push(binding);
  });
  return `<section class="habit-sources" aria-labelledby="habit-sources-title"><div class="section-head"><h2 id="habit-sources-title">Fonti attive</h2><span class="number">${groups.active.length}</span></div><p class="small muted">Una fonte attiva è una regola: produce un'evidenza quando completi il task. Non è una storia.</p>${groups.active.length ? `<div class="habit-source-list">${groups.active.map(habitSourceRow).join('')}</div>` : '<div class="habit-source-empty"><strong>Nessuna fonte attiva</strong><p>Il check-in manuale resta disponibile.</p></div>'}${groups.disabled.length ? `<div class="habit-source-group"><h3>Spente</h3>${groups.disabled.map(habitSourceRow).join('')}</div>` : ''}${groups.closed.length ? `<details class="habit-source-history"><summary>Storico fonti (${groups.closed.length})</summary>${groups.closed.map(habitSourceRow).join('')}</details>` : ''}</section>`;
}

/* --------------------------------------------------------------------------
 * Storico per periodo
 * ----------------------------------------------------------------------- */

function habitPeriodCell(period, previous, isCurrent, index = 0) {
  const state = period.state;
  const stateLabel = habitEntryStateLabel(state);
  const strengthLabel = period.strength == null ? 'forza non disponibile' : `forza ${period.strength}${isCurrent ? ' provvisoria' : ''}`;
  const pauseLabel = period.pause
    ? `, pausa ${habitFormatShortDate(period.pause.from)}–${period.pause.to ? habitFormatShortDate(period.pause.to) : 'in corso'}`
    : '';
  const configStart = Boolean(previous) && previous.configVersionId !== period.configVersionId;
  const label = `${habitPeriodLabelFor(period.granularity, period.periodKey)}: ${stateLabel}, ${period.evidenceCount}/${period.target} evidenze, ${strengthLabel}${pauseLabel}${configStart ? ', cambio configurazione' : ''}`;
  const short = habitPeriodShortLabelFor(period.granularity, period.periodKey);
  const showLabel = period.granularity !== 'day' || isCurrent || !previous || previous.granularity !== period.granularity || index % 3 === 0;
  const style = isCurrent && period.strength != null ? `style="--strength:${period.strength}"` : '';
  return `<div class="habit-period-cell is-${state} ${isCurrent ? 'is-current' : ''} ${configStart ? 'is-config-start' : ''}" role="img" aria-label="${esc(label)}" title="${esc(label)}" ${style}><span class="habit-period-cell-inner">${isCurrent && period.strength != null ? '<span class="habit-strength-now" aria-hidden="true"></span>' : ''}<span class="habit-period-icon" aria-hidden="true">${habitEntryStateIcon(state)}</span></span><span class="habit-period-label ${showLabel ? '' : 'is-empty'}" aria-hidden="true">${showLabel ? esc(short) : ''}</span></div>`;
}

function habitStrengthOverlay(periods) {
  if (!periods.length) return '';
  const points = periods.map((period, index) => period.strength == null
    ? null
    : { x: index + 0.5, y: 6 + (100 - period.strength) * 0.44 });
  const segments = [];
  let current = [];
  points.forEach((point) => {
    if (!point) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push(point);
  });
  if (current.length) segments.push(current);
  if (!segments.length) return '';
  const lines = segments.map((segment, index) => {
    const isProvisional = index === segments.length - 1 && periods[periods.length - 1]?.isCurrent;
    return `<polyline points="${segment.map((point) => `${point.x},${point.y}`).join(' ')}" vector-effect="non-scaling-stroke" ${isProvisional ? 'class="is-provisional"' : ''}></polyline>`;
  }).join('');
  return `<svg class="habit-strength-overlay" viewBox="0 0 ${periods.length} 56" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
}

function habitHistoryTable(periods, history) {
  return `<details class="habit-history-data"><summary>Dati dello storico</summary><table class="habit-period-table"><thead><tr><th>Periodo</th><th>Stato</th><th>Evidenze</th><th>Obiettivo</th><th>Forza</th><th>Configurazione</th></tr></thead><tbody>${periods.map((period, index) => {
    const isCurrent = period === history.current;
    const strength = period.strength == null ? '—' : `${period.strength}${isCurrent ? ' (provvisoria)' : ''}`;
    const pause = period.pause ? ` · pausa ${habitFormatShortDate(period.pause.from)}–${period.pause.to ? habitFormatShortDate(period.pause.to) : 'in corso'}` : '';
    return `<tr><td data-label="Periodo">${esc(habitPeriodLabelFor(period.granularity, period.periodKey))}${isCurrent ? ' · corrente' : ''}</td><td data-label="Stato">${esc(habitEntryStateLabel(period.state))}${pause}</td><td data-label="Evidenze">${period.evidenceCount}</td><td data-label="Obiettivo">${period.target}</td><td data-label="Forza">${strength}</td><td data-label="Configurazione">${period.target} per ${habitGranularityLabel(period.granularity)}${index > 0 && periods[index - 1].configVersionId !== period.configVersionId ? ' · nuova configurazione' : ''}</td></tr>`;
  }).join('')}</tbody></table></details>`;
}

function habitHistorySection(history) {
  const periods = history.periods.concat(history.current ? [history.current] : []);
  if (!periods.length) {
    return `<section class="habit-history" aria-labelledby="habit-history-title"><div class="section-head"><h2 id="habit-history-title">Storico per periodo</h2></div><div class="empty"><h3>Nessun periodo valutato</h3><p>Il primo periodo utile non è ancora iniziato.</p></div></section>`;
  }
  return `<section class="habit-history" aria-labelledby="habit-history-title"><div class="section-head"><h2 id="habit-history-title">Storico per periodo</h2><span class="pill">${habitCapitalize(habitGranularityLabel(history.granularity))}</span></div><p class="small muted">Una cella per periodo. Lo score è binario; la linea è la forza, campionata a fine periodo. Il periodo corrente è provvisorio.</p><div class="habit-period-history" style="--periods:${periods.length}"><div class="habit-period-cells">${periods.map((period, index) => habitPeriodCell(period, periods[index - 1], period === history.current, index)).join('')}</div>${habitStrengthOverlay(periods)}</div><div class="habit-history-legend"><span><b aria-hidden="true">✓</b> raggiunto</span><span><b aria-hidden="true">—</b> non raggiunto</span><span><b aria-hidden="true">Ⅱ</b> pausa</span><span><b aria-hidden="true">·</b> non valutato</span><span><b aria-hidden="true">○</b> in corso</span><span>linea = forza 0–100</span><span>barra verticale = cambio configurazione</span></div>${habitHistoryTable(periods, history)}</section>`;
}

function habitCurrentSummary(habit, history) {
  const current = history.current;
  const closed = history.periods;
  const last = closed[closed.length - 1];
  const archived = habitState(habit) === 'archived';
  const lastEvaluated = closed.slice().reverse().find((period) => period.state === 'met' || period.state === 'missed' || period.state === 'paused');
  const focus = current || (archived ? (lastEvaluated || last) : last);
  const strength = focus ? focus.strength : null;
  const streak = habitStreakLabel(history.streak, history.granularity);
  const progress = current && current.state === 'open' ? `${current.evidenceCount} / ${current.target}` : '—';
  const score = focus ? habitEntryStateLabel(focus.state) : 'Non valutato';
  const scoreNote = current
    ? current.state === 'open'
      ? (current.evidenceCount >= current.target ? 'Obiettivo raggiunto, provvisorio fino alla chiusura.' : 'Provvisorio fino alla chiusura del periodo.')
      : current.state === 'paused'
        ? 'Periodo neutro: non entra nello score.'
        : 'Periodo parziale di nascita.'
    : archived
      ? `Archiviato il ${habitFormatDate(habit.archivedAt)}.`
      : last
        ? 'Ultimo periodo chiuso.'
        : 'Nessun periodo chiuso.';
  const range = focus ? habitRangeText(focus.start, focus.end) : '—';
  const periodLabel = current ? 'Periodo corrente' : (archived && lastEvaluated ? 'Ultimo periodo valutato' : 'Ultimo periodo');
  const strengthLabel = strength == null ? '—' : String(strength);
  const strengthNote = strength == null
    ? 'Nessun periodo valutato'
    : current
      ? 'Trend · provvisoria'
      : 'Trend · campionata a fine periodo';
  const streakTitle = `${streak.days} giorni: ${history.streak.evaluatedDays} valutati, ${history.streak.pausedDays} in pausa, ${history.streak.notEvaluatedDays} non valutati.`;
  return `<section class="habit-current-summary" aria-label="Riepilogo del periodo"><div class="od-stat"><span>${periodLabel}</span><strong>${progress}</strong><small>${range}</small></div><div class="od-stat"><span>Score del periodo</span><strong>${esc(score)}</strong><small>${scoreNote}</small></div><div class="od-stat"><span>Forza</span><strong title="${strength == null ? 'Nessun periodo valutato: la forza non è disponibile.' : `Forza ${strength} su 100. Misura la costanza recente; non è lo score.`}">${strengthLabel}</strong><small>${strengthNote}</small></div><div class="od-stat"><span>Streak</span><strong class="stat-text" title="${esc(streakTitle)}">${esc(streak.value)}</strong><small>${esc(streak.detail)}</small></div></section>`;
}

function habitStateNotice(habit, history) {
  const sourceState = habitState(habit);
  const current = history.current;
  if (sourceState === 'archived') {
    return `<div class="notice habit-notice"><strong>Archiviato il ${habitFormatDate(habit.archivedAt)}</strong><p>Lo storico resta; non produce nuove evidenze. La riattivazione non è nel prototipo.</p></div>`;
  }
  if (sourceState === 'paused') {
    const pause = habitPauseForDay(habit, HABIT_TODAY);
    return `<div class="notice habit-notice"><strong>In pausa dal ${habitFormatDate(pause?.from)}</strong><p>I periodi intersecati sono neutri; la serie non si interrompe. Le evidenze già registrate restano.</p></div>`;
  }
  if (current && current.state === 'not_evaluated') {
    const next = habitNextPeriod(habit);
    return `<div class="notice habit-notice"><strong>Periodo di nascita non valutato</strong><p>Il primo periodo utile è ${habitRangeText(next?.start, next?.end)}. Il check-in si attiva da lì.</p></div>`;
  }
  if (current && current.state === 'paused') {
    return `<div class="notice habit-notice"><strong>Periodo corrente neutro</strong><p>Una pausa interseca questo periodo: non entra nello score. Il prossimo periodo valutato riparte dal calendario.</p></div>`;
  }
  return '';
}

/* --------------------------------------------------------------------------
 * Evidenze: calendario annuale e ultime 12 settimane
 * ----------------------------------------------------------------------- */

function habitHeatCell(habit, day, options = {}) {
  const count = habitDailyCount(habit, day);
  const records = habitEvidenceOnDay(habit, day);
  const rectified = records.filter((evidence) => evidence.rectifiedBy).length;
  const paused = habitIsPausedOn(habit, day);
  const future = day > HABIT_TODAY;
  const before = day < habit.createdAt;
  const after = Boolean(habit.archivedAt && day > habit.archivedAt);
  const label = future ? 'Futuro' : before ? 'Prima della nascita' : after ? 'Archiviato' : paused ? 'In pausa' : count ? `${count} ${count === 1 ? 'evidenza' : 'evidenze'}${rectified ? `, ${rectified} rettificata` : ''}` : 'Nessuna evidenza';
  const className = [future ? 'future' : '', before || after ? 'unknown' : '', paused ? 'paused' : '', count && !future ? 'evidence level-' + Math.min(count, 3) : '', rectified ? 'has-rectified' : '', day === HABIT_TODAY ? 'heat-today' : ''].filter(Boolean).join(' ');
  const content = future ? '·' : paused ? 'Ⅱ' : count ? String(count) : String(Number(day.slice(-2)));
  return `<button class="habit-heat-cell ${className}" data-habit-day="${day}" aria-label="${esc(habitFormatDate(day))}: ${esc(label)}" title="${esc(habitFormatDate(day))}: ${esc(label)}">${content}</button>`;
}

function habitAnnualGrid(habit) {
  const year = habitAnalyticsYear;
  const start = habitIsoWeekStart(`${year}-W01`);
  const end = `${year}-12-31`;
  const weeks = Math.ceil(habitDaysBetween(start, end) / 7);
  return `<div class="habit-year-header"><div><h2>Calendario delle registrazioni</h2><p class="muted small">Seleziona una giornata per vedere le evidenze.</p></div><div class="od-row"><button class="icon-btn" data-habit-year="-1" aria-label="Anno precedente">‹</button><strong aria-live="polite">${year}</strong><button class="icon-btn" data-habit-year="1" aria-label="Anno successivo">›</button></div></div><div class="habit-annual-scroll" role="region" aria-label="Calendario annuale delle evidenze"><div class="habit-annual-labels" aria-hidden="true"><span></span>${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day) => `<span>${day}</span>`).join('')}</div><div class="habit-annual-weeks">${Array.from({ length: weeks }, (_, week) => {
    const dates = Array.from({ length: 7 }, (_, day) => {
      const date = habitParse(start);
      date.setDate(date.getDate() + week * 7 + day);
      return date;
    });
    const monthDate = dates.find((date) => date.getFullYear() === year && (date.getDate() === 1 || week === 0));
    return `<div class="habit-annual-week"><span class="habit-month-label">${monthDate ? esc(monthDate.toLocaleDateString('it-IT', { month: 'short' })) : ''}</span>${dates.map((date) => {
      const key = habitIso(date);
      if (date.getFullYear() !== year) return '<span class="habit-heat-blank"></span>';
      return habitHeatCell(habit, key);
    }).join('')}</div>`;
  }).join('')}</div></div><div class="habit-grid-legend"><span>Numero = giorno; fondo pieno = evidenze</span><span>Ⅱ pausa</span><span>· futuro o prima della nascita</span></div>`;
}

function habitRecentWeeksGrid(habit) {
  const start = habitAddDays(habitStartOfIsoWeek(HABIT_TODAY), -11 * 7);
  const weeks = 12;
  return `<div class="habit-recent-header"><div><h2>Ultime 12 settimane</h2><p class="muted small">Seleziona una giornata per vedere le evidenze.</p></div><span class="pill">${habitFormatShortDate(start)} – ${habitFormatShortDate(HABIT_TODAY)}</span></div><div class="habit-recent-grid" role="region" aria-label="Evidenze delle ultime dodici settimane"><div class="habit-recent-labels" aria-hidden="true">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day) => `<span>${day}</span>`).join('')}</div><div class="habit-recent-weeks">${Array.from({ length: weeks }, (_, week) => `<div class="habit-recent-week">${Array.from({ length: 7 }, (_, day) => {
    const date = habitParse(start);
    date.setDate(date.getDate() + week * 7 + day);
    return habitHeatCell(habit, habitIso(date));
  }).join('')}</div>`).join('')}</div></div><div class="habit-grid-legend"><span>Numero = giorno; fondo pieno = evidenze</span><span>Ⅱ pausa</span><span>· futuro o prima della nascita</span></div>`;
}

function habitEvidenceSection(habit) {
  return `<section class="habit-evidence" aria-labelledby="habit-evidence-title"><div class="section-head"><h2 id="habit-evidence-title">Storico evidenze</h2></div><p class="small muted">Le evidenze sono fatti. Le rettifiche restano visibili ma non contano nello score.</p><div class="habit-annual-desktop">${habitAnnualGrid(habit)}</div><div class="habit-recent-mobile">${habitRecentWeeksGrid(habit)}</div><p class="small muted habit-evidence-note">Sotto 1320 px il calendario mostra le ultime 12 settimane; lo storico per periodo resta completo sopra.</p></section>`;
}

/* --------------------------------------------------------------------------
 * Dettaglio Habit
 * ----------------------------------------------------------------------- */

function renderHabitAnalytics() {
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit) return heading('Abitudine non trovata', '', '<button class="btn" data-nav="habits">Torna agli Habit</button>');
  const config = habitCurrentConfig(habit);
  const sourceState = habitState(habit);
  const history = habitHistory(habit, config.granularity === 'day' ? 21 : 12);
  const current = history.current;
  const complete = current && current.state === 'open' && current.evidenceCount >= current.target;
  const notEvaluated = current && current.state === 'not_evaluated';
  const paused = sourceState === 'paused';
  const disabled = sourceState !== 'active' || !current || current.state !== 'open' || complete;
  const actionLabel = sourceState === 'archived' ? 'Archiviato' : paused ? 'In pausa' : notEvaluated ? 'Non valutato' : complete ? 'Obiettivo raggiunto' : 'Check-in';
  const actionIcon = sourceState === 'archived' ? 'archive' : paused ? 'pause' : notEvaluated ? 'calendar' : complete ? 'check' : 'plus';
  const scheduled = (habit.configVersions || []).filter((version) => version.effectiveFromDay > HABIT_TODAY).sort((a, b) => a.effectiveFromDay.localeCompare(b.effectiveFromDay))[0];
  const scheduledNotice = scheduled ? `<div class="notice habit-notice"><strong>Nuova configurazione dal ${habitFormatDate(scheduled.effectiveFromDay)}</strong><p>${scheduled.target} check-in per ${habitGranularityLabel(scheduled.granularity)}. Vale dal periodo successivo; lo storico non cambia.</p></div>` : '';
  return `<article class="habit-detail-page habit-analytics" data-screen="habit-detail"><button class="text-btn habit-back" data-nav="habits">← Tutti gli Habit</button><div class="eyebrow">${esc(habit.area)} / Habit</div><div class="page-heading habit-detail-heading"><div><h1>${esc(habit.name)}</h1><p>${config.target} check-in per ${habitGranularityLabel(config.granularity)} · ${esc(config.timeZone)}</p></div><div class="od-row habit-detail-actions"><button class="btn" data-habit-config="${habit.id}" ${sourceState === 'archived' ? 'disabled' : ''}>Configurazione</button><button class="btn primary" data-check-habit="${habit.id}" ${disabled ? 'disabled' : ''}>${icon(actionIcon)} ${actionLabel}</button></div></div>${habitStateNotice(habit, history)}${scheduledNotice}${habitCurrentSummary(habit, history)}${habitHistorySection(history)}${habitSourcesSection(habit)}${habitEvidenceSection(habit)}<p class="habit-data-note">Forza e score sono derivati: nessuno snapshot. La forza misura la costanza recente; lo score misura il periodo. Le fonti sono regole; le evidenze sono fatti.</p></article>`;
}

/* --------------------------------------------------------------------------
 * Dialogo del giorno
 * ----------------------------------------------------------------------- */

function habitDayDialog() {
  let dialog = document.getElementById('habit-day-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'habit-day-dialog';
    dialog.className = 'habit-day-drawer';
    dialog.setAttribute('aria-labelledby', 'habit-day-title');
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      if (habitEvidenceTrigger?.isConnected) habitEvidenceTrigger.focus();
      else document.querySelector('.habit-back, [data-habit-config]')?.focus();
    });
  }
  return dialog;
}

function renderHabitDay() {
  const habit = state.habits.find((item) => item.id === habitId);
  const dialog = habitDayDialog();
  if (!habit) return;
  const day = habitEvidenceDay;
  const records = habitEvidenceOnDay(habit, day).slice().sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')));
  const count = records.length;
  const rectifiedCount = records.filter((evidence) => evidence.rectifiedBy).length;
  const config = habitConfigAt(habit, day);
  const periodLabel = habitPeriodLabelFor(config.granularity, habitPeriodKeyFor(config.granularity, day));
  const future = day > HABIT_TODAY;
  const before = day < habit.createdAt;
  const after = Boolean(habit.archivedAt && day > habit.archivedAt);
  const paused = habitIsPausedOn(habit, day);
  const current = habitCurrentPeriod(habit);
  const stateLabel = future ? 'Futuro' : before ? 'Prima della nascita' : after ? 'Archiviato' : paused ? 'In pausa' : day === HABIT_TODAY ? 'Oggi' : 'Storico';
  const showCheckIn = day === HABIT_TODAY && current && current.state === 'open' && current.evidenceCount < current.target && habitState(habit) === 'active';
  dialog.innerHTML = `<header class="od-row"><div class="od-fill"><p class="small muted">${esc(habit.name)} · ${esc(periodLabel)}</p><h2 id="habit-day-title">${habitFormatDate(day)}</h2></div><button class="icon-btn" data-habit-day-close aria-label="Chiudi storico">×</button></header><div class="habit-day-body"><div class="od-row"><strong>${count} ${count === 1 ? 'evidenza' : 'evidenze'}${rectifiedCount ? ` · ${rectifiedCount} rettificata${rectifiedCount === 1 ? '' : 'e'}` : ''}</strong><span class="pill">${stateLabel}</span></div>${future ? '<p class="muted">Questa giornata è futura. Non ci sono evidenze da valutare.</p>' : records.length ? records.slice(0, habitEvidenceLimit).map((evidence) => {
    const taskId = evidence.sourceRef?.taskId ? Number(evidence.sourceRef.taskId) : null;
    const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
    const source = habitEvidenceSourceLabel(evidence);
    const rectified = evidence.rectifiedBy;
    return `<div class="habit-day-evidence"><div class="od-row">${icon(evidence.provenance === 'task' ? 'check' : evidence.provenance === 'capability_event' ? 'calendar' : 'plus')}<strong>${esc(source)}</strong><span class="pill">+1</span>${rectified ? '<span class="pill">Rettificata</span>' : ''}</div>${evidence.occurredAt ? `<p class="small muted">${esc(new Date(evidence.occurredAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))}</p>` : '<p class="small muted">Origine e orario non disponibili. Questa registrazione precede lo storico dettagliato.</p>'}${task ? `<button class="link-btn" data-evidence-task="${task.id}">${esc(task.title)} →</button>` : evidence.provenance === 'task' ? '<p class="small muted">Task non più disponibile.</p>' : ''}${evidence.description ? `<p class="small muted">${esc(evidence.description)}</p>` : ''}${rectified ? `<p class="small muted">${esc(habitRectificationLabel(rectified))} · non conta nello score</p>` : ''}</div>`;
  }).join('') : `<p class="muted">Nessuna evidenza. L'assenza di dati non indica un obiettivo mancato.</p>`}${records.length > habitEvidenceLimit ? '<button class="btn" data-evidence-more>Carica altre</button>' : ''}${showCheckIn ? `<button class="btn primary" data-day-check="${habit.id}">${icon('plus')} Check-in oggi</button>` : ''}</div>`;
}

/* --------------------------------------------------------------------------
 * Dialogo di check-in
 * ----------------------------------------------------------------------- */

function habitCheckDialog() {
  let dialog = document.getElementById('habit-check-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'habit-check-dialog';
    dialog.className = 'habit-check-dialog';
    dialog.setAttribute('aria-labelledby', 'habit-check-title');
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      if (habitCheckReturn?.isConnected) {
        habitCheckReturn.focus();
        return;
      }
      const target = document.querySelector(`[data-check-habit="${habitCheckHabitId}"]`)
        || document.querySelector('[data-check-habit], [data-habit-config], .habit-back');
      target?.focus();
    });
  }
  return dialog;
}

function openHabitCheck(habit) {
  const current = habitCurrentPeriod(habit);
  const bindings = (habit.bindings || []).filter((binding) => binding.state === 'active');
  if (!current || habitState(habit) !== 'active' || current.state !== 'open' || current.evidenceCount >= current.target) {
    checkHabit(habit.id, { type: 'manual' });
    return;
  }
  if (!bindings.length) {
    checkHabit(habit.id, { type: 'manual' });
    return;
  }
  habitCheckHabitId = habit.id;
  habitCheckReturn = document.activeElement;
  const dialog = habitCheckDialog();
  dialog.innerHTML = `<header class="od-row"><div class="od-fill"><h2 id="habit-check-title">Cosa hai fatto?</h2><p class="small muted">Scegli l'attività collegata per non contarla due volte. Se hai fatto altro, registra un check-in manuale.</p></div><button class="icon-btn" data-habit-check-close aria-label="Chiudi">×</button></header><form id="habit-check-form"><fieldset class="habit-check-options"><legend class="sr-only">Attività da registrare</legend>${bindings.map((binding, index) => {
    const task = habitTaskForBinding(binding);
    const title = task ? task.title : binding.taskTitle;
    const kind = binding.targetKind === 'series' ? `Serie${binding.recurrence ? ' · ' + binding.recurrence : ''}` : 'Task';
    return `<label class="habit-check-option"><input type="radio" name="habit-source" value="task:${binding.id}" ${index === 0 ? 'checked' : ''}><span><strong>${esc(title)}</strong><small>${esc(kind)}${task?.done ? ' · completato' : ''}</small></span></label>`;
  }).join('')}<label class="habit-check-option"><input type="radio" name="habit-source" value="manual" ${bindings.length ? '' : 'checked'}><span><strong>Altra azione</strong><small>Check-in manuale</small></span></label></fieldset><div class="dialog-actions"><button type="button" class="btn" data-habit-check-close>Annulla</button><button type="submit" class="btn primary">Registra</button></div></form>`;
  dialog.showModal();
  dialog.querySelector('input[name="habit-source"]:checked')?.focus();
}

/* --------------------------------------------------------------------------
 * Dialogo di configurazione
 * ----------------------------------------------------------------------- */

function habitConfigDialog() {
  let dialog = document.getElementById('habit-config-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.id = 'habit-config-dialog';
    dialog.className = 'habit-config-dialog';
    dialog.setAttribute('aria-labelledby', 'habit-config-title');
    document.body.appendChild(dialog);
    dialog.addEventListener('close', () => {
      if (habitConfigReturn?.isConnected) habitConfigReturn.focus();
      else document.querySelector('[data-habit-config], .habit-back')?.focus();
    });
  }
  return dialog;
}

function openHabitConfig(habit) {
  if (habitState(habit) === 'archived') return;
  habitConfigReturn = document.activeElement;
  const config = habitCurrentConfig(habit);
  const next = habitNextPeriod(habit);
  const versions = (habit.configVersions || []).slice().sort((a, b) => a.effectiveFromDay.localeCompare(b.effectiveFromDay));
  const dialog = habitConfigDialog();
  dialog.innerHTML = `<header class="od-row"><div class="od-fill"><h2 id="habit-config-title">Configurazione</h2><p class="small muted">${esc(habit.name)}</p></div><button class="icon-btn" data-habit-config-close aria-label="Chiudi">×</button></header><form id="habit-config-form"><div class="habit-config-summary"><p><strong>${config.target} check-in per ${habitGranularityLabel(config.granularity)}</strong></p><p class="small muted">${esc(config.timeZone)} · periodo corrente dal ${habitFormatShortDate(habitCurrentPeriod(habit)?.start)}</p></div><label for="habit-config-target">Obiettivo per periodo<input id="habit-config-target" type="number" min="1" step="1" value="${config.target}" required></label><p class="small muted">Il nuovo obiettivo vale dal periodo successivo: ${habitRangeText(next?.start, next?.end)}. Non riscrive lo storico.</p><p class="small muted">La granularità è fissa nel prototipo; cambia solo dal periodo successivo nel modello reale.</p><div class="dialog-actions">${habitState(habit) === 'paused' ? '<button type="button" class="btn" data-habit-resume>Riprendi</button>' : '<button type="button" class="btn" data-habit-pause>Metti in pausa</button>'}<button type="button" class="btn" data-habit-config-close>Annulla</button><button type="submit" class="btn primary">Salva</button></div></form><details class="habit-config-history"><summary>Versioni di configurazione (${versions.length})</summary><ul>${versions.map((version) => `<li><strong>${version.target} per ${habitGranularityLabel(version.granularity)}</strong> <span class="muted">dal ${habitPeriodLabelFor(version.granularity, version.effectiveFromPeriod)}</span></li>`).join('')}</ul></details>`;
  dialog.showModal();
  document.getElementById('habit-config-target')?.focus();
}

/* --------------------------------------------------------------------------
 * Eventi
 * ----------------------------------------------------------------------- */

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const habit = state.habits.find((item) => item.id === Number(habitId));
  if (button.dataset.checkHabit) {
    const target = state.habits.find((item) => item.id === Number(button.dataset.checkHabit));
    if (target) openHabitCheck(target);
    return;
  }
  if (button.dataset.habitConfig) {
    if (habit) openHabitConfig(habit);
    return;
  }
  if (button.hasAttribute('data-habit-config-close')) {
    habitConfigDialog().close();
    return;
  }
  if (button.hasAttribute('data-habit-check-close')) {
    habitCheckDialog().close();
    return;
  }
  if (button.dataset.habitPause !== undefined) {
    if (!habit) return;
    habitPause(habit);
    habitConfigDialog().close();
    persist();
    render();
    toast('Habit in pausa. I periodi intersecati sono neutri.');
    return;
  }
  if (button.dataset.habitResume !== undefined) {
    if (!habit) return;
    habitResume(habit);
    habitConfigDialog().close();
    persist();
    render();
    toast('Pausa conclusa. Il periodo corrente può restare neutro se la pausa lo interseca.');
    return;
  }
  if (button.dataset.habitSourceState) {
    if (!habit) return;
    habitSetBindingState(habit, button.dataset.habitBinding, button.dataset.habitSourceState);
    persist();
    render();
    toast(button.dataset.habitSourceState === 'disabled' ? 'Fonte disattivata' : 'Fonte riattivata');
    return;
  }
  if (button.dataset.habitDay) {
    habitEvidenceDay = button.dataset.habitDay;
    habitEvidenceLimit = 10;
    habitEvidenceTrigger = button;
    renderHabitDay();
    habitDayDialog().showModal();
    return;
  }
  if (button.hasAttribute('data-habit-day-close')) {
    habitDayDialog().close();
    return;
  }
  if (button.dataset.habitYear) {
    habitAnalyticsYear += Number(button.dataset.habitYear);
    render();
    document.querySelector(`[data-habit-year="${button.dataset.habitYear}"]`)?.focus();
    return;
  }
  if (button.hasAttribute('data-evidence-more')) {
    habitEvidenceLimit += 10;
    renderHabitDay();
    habitDayDialog().querySelector('[data-evidence-more]')?.focus();
    return;
  }
  if (button.dataset.evidenceTask) {
    habitDayDialog().close();
    nav('task', button.dataset.evidenceTask);
    return;
  }
  if (button.dataset.dayCheck) {
    const dayHabit = state.habits.find((item) => item.id === Number(button.dataset.dayCheck));
    habitDayDialog().close();
    if (dayHabit) openHabitCheck(dayHabit);
  }
});

document.addEventListener('submit', (event) => {
  if (event.target.id === 'habit-check-form') {
    event.preventDefault();
    const habit = state.habits.find((item) => item.id === Number(habitCheckHabitId));
    const selected = event.target.querySelector('input[name="habit-source"]:checked')?.value;
    if (!habit || !selected) return;
    habitCheckDialog().close();
    if (selected === 'manual') {
      checkHabit(habit.id, { type: 'manual' });
    } else {
      const binding = (habit.bindings || []).find((item) => `task:${item.id}` === selected);
      if (binding) checkHabit(habit.id, { type: 'task', taskId: binding.taskId, targetKind: binding.targetKind });
    }
    return;
  }
  if (event.target.id === 'habit-config-form') {
    event.preventDefault();
    const habit = state.habits.find((item) => item.id === Number(habitId));
    const input = document.getElementById('habit-config-target');
    const target = Number(input?.value);
    if (!habit || !Number.isInteger(target) || target < 1) {
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
      }
      toast('Inserisci un obiettivo intero maggiore di zero.');
      return;
    }
    const version = habitAddConfigVersion(habit, target);
    habitConfigDialog().close();
    persist();
    render();
    toast(version ? `Obiettivo ${target} dal periodo successivo` : 'Configurazione non aggiornata');
  }
});
