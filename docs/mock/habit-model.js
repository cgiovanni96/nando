/*
 * NAS-60 — modello derivato degli Habit per il prototipo.
 * Throwaway: nessun backend, nessuna tabella di periodi, nessuno snapshot.
 * I dati sono deterministici e servono solo a provare la UI e il contratto.
 */

const HABIT_TODAY = '2026-10-28';
const HABIT_TIME_ZONE = 'Europe/Rome';
const HABIT_WINDOW_DAYS = { day: 1, week: 7, month: 30, year: 365 };
const HABIT_GRANULARITY = {
  day: { one: 'giorno', many: 'giorni', short: 'giorno' },
  week: { one: 'settimana', many: 'settimane', short: 'sett.' },
  month: { one: 'mese', many: 'mesi', short: 'mese' },
  year: { one: 'anno', many: 'anni', short: 'anno' }
};

function habitParse(day) {
  return new Date(day + 'T12:00:00');
}

function habitIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function habitAddDays(day, amount) {
  const date = habitParse(day);
  date.setDate(date.getDate() + amount);
  return habitIso(date);
}

function habitDaysBetween(from, to) {
  return Math.round((habitParse(to) - habitParse(from)) / 86400000) + 1;
}

function habitStartOfIsoWeek(day) {
  const date = habitParse(day);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return habitIso(date);
}

function habitIsoWeekKey(day) {
  const date = habitParse(day);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4, 12);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${target.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function habitIsoWeekStart(periodKey) {
  const [year, week] = periodKey.split('-W').map(Number);
  const january4 = new Date(year, 0, 4, 12);
  const january4Day = (january4.getDay() + 6) % 7;
  const monday = new Date(january4);
  monday.setDate(january4.getDate() - january4Day + (week - 1) * 7);
  return habitIso(monday);
}

function habitPeriodKeyFor(granularity, day) {
  if (granularity === 'day') return day;
  if (granularity === 'week') return habitIsoWeekKey(day);
  if (granularity === 'month') return day.slice(0, 7);
  return day.slice(0, 4);
}

function habitPeriodRangeFor(granularity, periodKey) {
  if (granularity === 'day') return { start: periodKey, end: periodKey };
  if (granularity === 'week') {
    const start = habitIsoWeekStart(periodKey);
    return { start, end: habitAddDays(start, 6) };
  }
  if (granularity === 'month') {
    const [year, month] = periodKey.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = new Date(year, month, 0, 12);
    return { start, end: habitIso(last) };
  }
  return { start: `${periodKey}-01-01`, end: `${periodKey}-12-31` };
}

function habitFormatDayMonth(day) {
  if (!day) return '';
  return habitParse(day).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
}

function habitFormatDate(day) {
  if (!day) return '';
  return habitParse(day).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function habitFormatShortDate(day) {
  if (!day) return '';
  return habitParse(day).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function habitCapitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function habitGranularityLabel(granularity) {
  return HABIT_GRANULARITY[granularity]?.one || granularity;
}

function habitGranularityPlural(granularity) {
  return HABIT_GRANULARITY[granularity]?.many || granularity;
}

function habitGranularityShort(granularity) {
  return HABIT_GRANULARITY[granularity]?.short || granularity;
}

function habitPeriodLabelFor(granularity, periodKey) {
  const range = habitPeriodRangeFor(granularity, periodKey);
  if (granularity === 'day') return habitFormatDate(range.start);
  if (granularity === 'week') return `${habitFormatDayMonth(range.start)} – ${habitFormatDayMonth(range.end)}`;
  if (granularity === 'month') {
    return habitParse(range.start).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }
  return periodKey;
}

function habitPeriodShortLabelFor(granularity, periodKey) {
  if (granularity === 'day') return String(Number(periodKey.slice(-2)));
  if (granularity === 'week') return periodKey.slice(-3);
  if (granularity === 'month') {
    return habitCapitalize(habitParse(habitPeriodRangeFor(granularity, periodKey).start).toLocaleDateString('it-IT', { month: 'short' }));
  }
  return periodKey;
}

function habitEntryStateLabel(state) {
  return {
    met: 'Raggiunto',
    missed: 'Non raggiunto',
    paused: 'In pausa',
    not_evaluated: 'Non valutato',
    open: 'In corso'
  }[state] || state;
}

function habitEntryStateIcon(state) {
  return {
    met: '✓',
    missed: '—',
    paused: 'Ⅱ',
    not_evaluated: '·',
    open: '○'
  }[state] || '·';
}

/* --------------------------------------------------------------------------
 * Configurazione, pause, stato
 * ----------------------------------------------------------------------- */

function habitConfigAt(habit, day = HABIT_TODAY) {
  const versions = (habit.configVersions || []).slice().sort((a, b) => a.effectiveFromDay.localeCompare(b.effectiveFromDay));
  let current = versions[0];
  for (const version of versions) {
    if (version.effectiveFromDay <= day) current = version;
  }
  return current || { target: 1, granularity: 'day', timeZone: HABIT_TIME_ZONE };
}

function habitCurrentConfig(habit) {
  return habitConfigAt(habit, HABIT_TODAY);
}

function habitTimeZone(habit) {
  return habitCurrentConfig(habit).timeZone || HABIT_TIME_ZONE;
}

function habitPauseForDay(habit, day) {
  return (habit.pauses || []).find((pause) => pause.from <= day && (!pause.to || day <= pause.to)) || null;
}

function habitIsPausedOn(habit, day) {
  return Boolean(habitPauseForDay(habit, day));
}

function habitPauseForRange(habit, start, end) {
  return (habit.pauses || []).find((pause) => pause.from <= end && (!pause.to || pause.to >= start)) || null;
}

function habitState(habit) {
  if (habit.archivedAt) return 'archived';
  if (habitIsPausedOn(habit, HABIT_TODAY)) return 'paused';
  return 'active';
}

/* --------------------------------------------------------------------------
 * Evidenze
 * ----------------------------------------------------------------------- */

function habitEvidenceValid(habit) {
  return (habit.evidences || []).filter((evidence) => !evidence.rectifiedBy);
}

function habitEvidenceOnDay(habit, day) {
  return (habit.evidences || []).filter((evidence) => evidence.date === day);
}

function habitEvidenceInPeriod(habit, granularity, periodKey) {
  return (habit.evidences || []).filter((evidence) => evidence.granularity === granularity && evidence.periodKey === periodKey);
}

function habitDailyCount(habit, day) {
  return habitEvidenceOnDay(habit, day).length;
}

function habitDailyValidCount(habit, day) {
  return habitEvidenceOnDay(habit, day).filter((evidence) => !evidence.rectifiedBy).length;
}

function habitPeriodCount(habit, granularity, periodKey) {
  return habitEvidenceInPeriod(habit, granularity, periodKey).filter((evidence) => !evidence.rectifiedBy).length;
}

/* --------------------------------------------------------------------------
 * Periodi derivati
 * ----------------------------------------------------------------------- */

function habitAllPeriodEntries(habit) {
  const versions = (habit.configVersions || []).slice().sort((a, b) => a.effectiveFromDay.localeCompare(b.effectiveFromDay));
  const entries = [];
  const endDay = habit.archivedAt || HABIT_TODAY;
  versions.forEach((version, index) => {
    const next = versions[index + 1];
    const startDay = version.effectiveFromDay > habit.createdAt ? version.effectiveFromDay : habit.createdAt;
    const segmentEnd = next ? habitAddDays(next.effectiveFromDay, -1) : endDay;
    if (startDay > segmentEnd) return;
    let periodKey = habitPeriodKeyFor(version.granularity, startDay);
    let range = habitPeriodRangeFor(version.granularity, periodKey);
    let guard = 0;
    while (range.start <= segmentEnd && guard < 500) {
      guard += 1;
      const entry = {
        periodKey,
        granularity: version.granularity,
        start: range.start,
        end: range.end,
        configVersionId: version.id,
        target: version.target
      };
      if (!entries.some((item) => item.granularity === entry.granularity && item.periodKey === entry.periodKey)) {
        entries.push(entry);
      }
      if (range.end >= segmentEnd) break;
      periodKey = habitPeriodKeyFor(version.granularity, habitAddDays(range.end, 1));
      range = habitPeriodRangeFor(version.granularity, periodKey);
    }
  });
  return entries.sort((a, b) => a.start.localeCompare(b.start));
}

function habitEvaluateEntry(habit, entry) {
  const count = habitPeriodCount(habit, entry.granularity, entry.periodKey);
  const pause = habitPauseForRange(habit, entry.start, entry.end);
  const birthPartial = habit.createdAt > entry.start
    || (habit.createdAt === entry.start && (habit.createdAtTime || '00:00') > '00:00');
  const archivePartial = Boolean(habit.archivedAt && habit.archivedAt < entry.end);
  const isCurrent = !habit.archivedAt && entry.start <= HABIT_TODAY && entry.end >= HABIT_TODAY;
  let state;
  if (pause) state = 'paused';
  else if (birthPartial || archivePartial) state = 'not_evaluated';
  else if (isCurrent) state = 'open';
  else state = count >= entry.target ? 'met' : 'missed';
  return {
    ...entry,
    state,
    evidenceCount: count,
    target: entry.target,
    progress: count,
    pause,
    birthPartial,
    archivePartial,
    isCurrent
  };
}

function habitCurrentPeriod(habit) {
  if (habit.archivedAt) return null;
  const config = habitCurrentConfig(habit);
  const periodKey = habitPeriodKeyFor(config.granularity, HABIT_TODAY);
  const range = habitPeriodRangeFor(config.granularity, periodKey);
  const entry = {
    periodKey,
    granularity: config.granularity,
    start: range.start,
    end: range.end,
    configVersionId: config.id,
    target: config.target
  };
  return habitEvaluateEntry(habit, entry);
}

function habitNextPeriod(habit) {
  const current = habitCurrentPeriod(habit);
  if (!current) return null;
  const start = habitAddDays(current.end, 1);
  const config = habitCurrentConfig(habit);
  const periodKey = habitPeriodKeyFor(config.granularity, start);
  const range = habitPeriodRangeFor(config.granularity, periodKey);
  return { periodKey, granularity: config.granularity, start: range.start, end: range.end, target: config.target };
}

/* --------------------------------------------------------------------------
 * Forza: EMA su finestra mobile, derivata giorno per giorno
 * ----------------------------------------------------------------------- */

function habitStrengthSeries(habit) {
  const entries = habitAllPeriodEntries(habit).map((entry) => habitEvaluateEntry(habit, entry));
  const evaluated = entries.find((entry) => entry.state === 'met' || entry.state === 'missed' || entry.state === 'open');
  if (!evaluated) return { values: {}, first: null, last: null };
  const first = evaluated.start;
  const last = habit.archivedAt ? habitAddDays(habit.archivedAt, -1) : HABIT_TODAY;
  if (first > last) return { values: {}, first: null, last: null };
  const validEvidence = habitEvidenceValid(habit);
  const values = {};
  let strength = 0;
  for (let day = first; day <= last; day = habitAddDays(day, 1)) {
    const config = habitConfigAt(habit, day);
    const windowDays = HABIT_WINDOW_DAYS[config.granularity] || 1;
    const windowStart = habitAddDays(day, -windowDays);
    const count = validEvidence.filter((evidence) => evidence.date > windowStart && evidence.date <= day).length;
    const target = Math.max(1, config.target);
    const coverage = Math.min(1, count / target);
    const frequency = target / windowDays;
    const decay = Math.pow(0.5, Math.sqrt(frequency) / 13);
    if (!habitIsPausedOn(habit, day)) {
      strength = strength * decay + coverage * (1 - decay);
    }
    values[day] = strength;
  }
  return { values, first, last };
}

function habitStrengthAt(series, day) {
  if (!series || !day) return null;
  const value = series.values[day];
  return value == null ? null : Math.round(value * 100);
}

/* --------------------------------------------------------------------------
 * Streak
 * ----------------------------------------------------------------------- */

function habitStreak(habit, closedPeriods) {
  const periods = (closedPeriods || habitAllPeriodEntries(habit)
    .map((entry) => habitEvaluateEntry(habit, entry))
    .filter((entry) => entry.end < HABIT_TODAY || habit.archivedAt)).slice().sort((a, b) => a.start.localeCompare(b.start));
  const met = [];
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    const period = periods[index];
    if (period.state === 'paused' || period.state === 'not_evaluated') continue;
    if (period.state === 'met') {
      met.push(period);
      continue;
    }
    break;
  }
  met.reverse();
  if (!met.length) {
    return { periods: 0, days: 0, from: null, to: null, evaluatedDays: 0, pausedDays: 0, notEvaluatedDays: 0 };
  }
  const from = met[0].start;
  const to = met[met.length - 1].end;
  const days = habitDaysBetween(from, to);
  let evaluatedDays = 0;
  let pausedDays = 0;
  let notEvaluatedDays = 0;
  for (let day = from; day <= to; day = habitAddDays(day, 1)) {
    if (habitIsPausedOn(habit, day)) {
      pausedDays += 1;
      continue;
    }
    const period = periods.find((item) => item.start <= day && item.end >= day);
    if (!period || period.state === 'not_evaluated' || period.state === 'paused') notEvaluatedDays += 1;
    else evaluatedDays += 1;
  }
  return { periods: met.length, days, from, to, evaluatedDays, pausedDays, notEvaluatedDays };
}

function habitStreakLabel(streak, granularity) {
  if (!streak || streak.periods === 0) {
    return { value: 'Nessuna serie', detail: 'Nessun periodo chiuso raggiunto' };
  }
  if (granularity === 'day') {
    return {
      value: `${streak.periods} ${streak.periods === 1 ? 'giorno' : 'giorni'}`,
      detail: `dal ${habitFormatDayMonth(streak.from)}`
    };
  }
  const unit = streak.periods === 1 ? habitGranularityLabel(granularity) : habitGranularityPlural(granularity);
  return {
    value: `${streak.periods} ${unit} · ${streak.days} giorni`,
    detail: `dal ${habitFormatDayMonth(streak.from)}`
  };
}

/* --------------------------------------------------------------------------
 * Storia completa per la UI e per il contratto
 * ----------------------------------------------------------------------- */

function habitHistory(habit, limit = 12) {
  const allEntries = habitAllPeriodEntries(habit);
  const current = habitCurrentPeriod(habit);
  const series = habitStrengthSeries(habit);
  const closed = [];
  allEntries.forEach((entry) => {
    if (current && entry.granularity === current.granularity && entry.periodKey === current.periodKey) return;
    if (!habit.archivedAt && entry.end >= HABIT_TODAY) return;
    const evaluated = habitEvaluateEntry(habit, entry);
    closed.push({
      ...evaluated,
      strength: habitStrengthAt(series, entry.end)
    });
  });
  closed.sort((a, b) => a.start.localeCompare(b.start));
  const capacity = Math.max(0, limit - (current ? 1 : 0));
  const periods = closed.slice(-capacity);
  const currentOut = current ? {
    ...current,
    strength: habitStrengthAt(series, HABIT_TODAY),
    strengthProvisional: true
  } : null;
  return {
    habitId: habit.id,
    granularity: current ? current.granularity : (periods[periods.length - 1]?.granularity || habitCurrentConfig(habit).granularity),
    timeZone: habitTimeZone(habit),
    periods,
    current: currentOut,
    streak: habitStreak(habit, closed),
    configVersions: (habit.configVersions || []).slice().sort((a, b) => a.effectiveFromDay.localeCompare(b.effectiveFromDay)),
    pauses: (habit.pauses || []).slice(),
    limit
  };
}

/* --------------------------------------------------------------------------
 * Comandi del prototipo
 * ----------------------------------------------------------------------- */

let habitSeedEvidenceCounter = 0;
let habitCheckCounter = 0;
let habitCreateCounter = 0;

function habitAddConfigVersion(habit, target) {
  const current = habitCurrentPeriod(habit);
  if (!current) return null;
  const nextStart = habitAddDays(current.end, 1);
  const config = habitCurrentConfig(habit);
  const version = {
    id: `cfg-${habit.id}-${(habit.configVersions || []).length + 1}`,
    effectiveFromDay: nextStart,
    effectiveFromPeriod: habitPeriodKeyFor(config.granularity, nextStart),
    target,
    granularity: config.granularity,
    timeZone: config.timeZone
  };
  const existing = (habit.configVersions || []).find((item) => item.effectiveFromDay === nextStart);
  if (existing) existing.target = target;
  else habit.configVersions.push(version);
  return version;
}

function habitPause(habit) {
  if (habitState(habit) !== 'active') return null;
  const pause = { id: `pause-${habit.id}-${Date.now()}`, from: HABIT_TODAY, to: null };
  habit.pauses = habit.pauses || [];
  habit.pauses.push(pause);
  return pause;
}

function habitResume(habit) {
  const pause = (habit.pauses || []).filter((item) => !item.to).pop();
  if (!pause) return null;
  if (pause.from >= HABIT_TODAY) habit.pauses = habit.pauses.filter((item) => item !== pause);
  else pause.to = habitAddDays(HABIT_TODAY, -1);
  return pause;
}

function habitSetBindingState(habit, bindingId, nextState) {
  const binding = (habit.bindings || []).find((item) => item.id === bindingId);
  if (!binding || binding.state === 'closed' || !['active', 'disabled'].includes(nextState)) return null;
  binding.state = nextState;
  return binding;
}

function habitCheckIn(habit, source = {}) {
  const current = habitCurrentPeriod(habit);
  if (!current) return { ok: false, reason: 'archived' };
  if (habitState(habit) === 'paused' || current.state === 'paused') return { ok: false, reason: 'paused' };
  if (current.state === 'not_evaluated') return { ok: false, reason: 'not_evaluated' };
  if (current.evidenceCount >= current.target) return { ok: false, reason: 'complete' };
  const taskId = source.taskId ? Number(source.taskId) : null;
  const series = source.targetKind === 'series';
  habitCheckCounter += 1;
  const activityId = taskId
    ? (series ? `task-${taskId}-${HABIT_TODAY}` : `task-${taskId}`)
    : `manual-${habit.id}-${HABIT_TODAY}-${habitCheckCounter}`;
  const duplicate = (habit.evidences || []).some((evidence) => evidence.activityId === activityId && evidence.periodKey === current.periodKey);
  if (duplicate) return { ok: false, reason: 'duplicate' };
  const evidence = {
    id: `ev-${habit.id}-${Date.now()}-${habitCheckCounter}`,
    activityId,
    date: HABIT_TODAY,
    occurredAt: new Date().toISOString(),
    periodKey: current.periodKey,
    granularity: current.granularity,
    quantity: 1,
    provenance: taskId ? 'task' : 'manual',
    sourceRef: taskId ? { taskId } : null,
    description: source.description || '',
    rectifiedBy: null
  };
  habit.evidences = habit.evidences || [];
  habit.evidences.push(evidence);
  return { ok: true, evidence };
}

function habitCreate({ name, area, target, granularity }) {
  habitCreateCounter += 1;
  const id = Date.now() + habitCreateCounter;
  return {
    id,
    name,
    area,
    createdAt: HABIT_TODAY,
    createdAtTime: '09:00',
    archivedAt: null,
    configVersions: [{
      id: `cfg-${id}-1`,
      effectiveFromDay: HABIT_TODAY,
      effectiveFromPeriod: habitPeriodKeyFor(granularity, HABIT_TODAY),
      target,
      granularity,
      timeZone: HABIT_TIME_ZONE
    }],
    pauses: [],
    bindings: [],
    evidences: []
  };
}

/* --------------------------------------------------------------------------
 * Dati dimostrativi deterministici
 * ----------------------------------------------------------------------- */

function habitSeedDays(start, end, predicate = () => true) {
  const days = [];
  for (let day = start; day <= end; day = habitAddDays(day, 1)) {
    if (predicate(day)) days.push(day);
  }
  return days;
}

function habitSeedHabit(id, name, area, createdAt, configs, extra = {}) {
  return {
    id,
    name,
    area,
    createdAt,
    createdAtTime: extra.createdAtTime || '00:00',
    archivedAt: extra.archivedAt || null,
    configVersions: configs.map((config, index) => ({
      id: `cfg-${id}-${index + 1}`,
      effectiveFromDay: config.from,
      effectiveFromPeriod: habitPeriodKeyFor(config.granularity, config.from),
      target: config.target,
      granularity: config.granularity,
      timeZone: HABIT_TIME_ZONE
    })),
    pauses: extra.pauses || [],
    bindings: extra.bindings || [],
    evidences: []
  };
}

function habitSeedEvidence(habit, day, options = {}) {
  const config = habitConfigAt(habit, day);
  habitSeedEvidenceCounter += 1;
  const taskId = options.taskId ? Number(options.taskId) : null;
  const legacy = Boolean(options.legacy);
  const evidence = {
    id: `ev-${habit.id}-${String(habitSeedEvidenceCounter).padStart(3, '0')}`,
    activityId: options.activityId || (taskId
      ? (options.series ? `task-${taskId}-${day}` : `task-${taskId}`)
      : `manual-${habit.id}-${day}-${habitSeedEvidenceCounter}`),
    date: day,
    occurredAt: legacy ? null : `${day}T${options.time || '09:30'}:00`,
    periodKey: habitPeriodKeyFor(config.granularity, day),
    granularity: config.granularity,
    quantity: 1,
    provenance: legacy ? 'manual' : (options.provenance || (taskId ? 'task' : 'manual')),
    sourceRef: taskId ? { taskId } : (options.sourceRef || null),
    description: options.description || '',
    rectifiedBy: options.rectifiedBy || null
  };
  habit.evidences.push(evidence);
  return evidence;
}

function habitSeedMany(habit, days, options = {}) {
  days.forEach((day) => habitSeedEvidence(habit, day, typeof options === 'function' ? options(day) : options));
}

/* Atti d'amore — mensile, target 3, quattro mesi chiusi raggiunti. */
const seedAtti = habitSeedHabit(1, "Atti d'amore", 'Relazioni', '2026-06-01', [
  { from: '2026-06-01', target: 3, granularity: 'month' }
], {
  bindings: [
    {
      id: 'bind-atti-flori', taskId: 2, taskTitle: 'Comprare fiori', targetKind: 'task',
      state: 'active', createdAt: '2026-10-20', closedAt: null, closeReason: null
    },
    {
      id: 'bind-atti-cena', taskId: 102, taskTitle: 'Cena anniversario', targetKind: 'task',
      state: 'closed', createdAt: '2026-07-01', closedAt: '2026-07-12', closeReason: 'target_completed'
    }
  ]
});
[
  ['2026-06-05', {}],
  ['2026-06-12', {}],
  ['2026-06-20', { legacy: true }],
  ['2026-07-03', {}],
  ['2026-07-12', { taskId: 102, time: '20:15' }],
  ['2026-07-28', {}],
  ['2026-08-02', {}],
  ['2026-08-10', { provenance: 'capability_event', sourceRef: { entityRef: 'space:anniversari' }, description: 'Evento Space: anniversario', time: '19:00' }],
  ['2026-08-18', {}],
  ['2026-08-25', {}],
  ['2026-09-04', {}],
  ['2026-09-14', {}],
  ['2026-09-26', {}],
  ['2026-10-06', {}],
  ['2026-10-14', { rectifiedBy: { reason: 'manual_revocation', at: '2026-10-15T10:00:00' } }],
  ['2026-10-21', {}]
].forEach(([day, options]) => habitSeedEvidence(seedAtti, day, options));

/* Meditare — giornaliero, target 1, 24 giorni su 31 a ottobre. */
const seedMeditare = habitSeedHabit(2, 'Meditare', 'Salute', '2026-07-01', [
  { from: '2026-07-01', target: 1, granularity: 'day' }
]);
habitSeedMany(seedMeditare, habitSeedDays('2026-07-01', '2026-07-31', (day) => [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31].includes(Number(day.slice(-2)))));
habitSeedMany(seedMeditare, habitSeedDays('2026-08-01', '2026-08-15'));
habitSeedMany(seedMeditare, habitSeedDays('2026-09-01', '2026-09-20'));
habitSeedMany(seedMeditare, [
  ...habitSeedDays('2026-10-01', '2026-10-14'),
  ...habitSeedDays('2026-10-16', '2026-10-19'),
  ...habitSeedDays('2026-10-22', '2026-10-27')
]);
habitSeedEvidence(seedMeditare, '2026-10-20', { rectifiedBy: { reason: 'manual_revocation', at: '2026-10-21T08:00:00' } });

/* Palestra — settimanale, target 2 fino a W43, target 3 da W44. */
const seedPalestra = habitSeedHabit(3, 'Palestra', 'Salute', '2026-06-01', [
  { from: '2026-06-01', target: 2, granularity: 'week' },
  { from: '2026-10-26', target: 3, granularity: 'week' }
], {
  bindings: [
    {
      id: 'bind-palestra', taskId: 8, taskTitle: 'Allenamento', targetKind: 'series',
      state: 'active', createdAt: '2026-06-01', closedAt: null, closeReason: null,
      recurrence: 'Lun, Mer, Ven'
    }
  ]
});
habitSeedMany(seedPalestra, [
  '2026-06-02', '2026-06-04', '2026-06-09', '2026-06-11', '2026-06-16', '2026-06-18', '2026-06-23', '2026-06-25',
  '2026-06-30', '2026-07-02', '2026-07-07', '2026-07-09', '2026-07-14', '2026-07-16', '2026-07-21', '2026-07-23', '2026-07-28', '2026-07-30',
  '2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13', '2026-08-18', '2026-08-20', '2026-08-25',
  '2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-15', '2026-09-22', '2026-09-24',
  '2026-09-29', '2026-10-01', '2026-10-06', '2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22', '2026-10-26', '2026-10-27'
]);

/* Leggere — mensile, target 20; settembre chiuso sotto target. */
const seedLeggere = habitSeedHabit(4, 'Leggere', 'Formazione', '2026-06-01', [
  { from: '2026-06-01', target: 20, granularity: 'month' }
], {
  bindings: [
    {
      id: 'bind-leggere', taskId: 6, taskTitle: 'Leggere capitolo 3', targetKind: 'task',
      state: 'active', createdAt: '2026-10-20', closedAt: null, closeReason: null
    }
  ]
});
habitSeedMany(seedLeggere, habitSeedDays('2026-06-01', '2026-06-20'));
habitSeedMany(seedLeggere, habitSeedDays('2026-07-01', '2026-07-18'));
habitSeedMany(seedLeggere, habitSeedDays('2026-08-01', '2026-08-21'));
habitSeedMany(seedLeggere, habitSeedDays('2026-09-01', '2026-09-15'));
habitSeedMany(seedLeggere, [
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06',
  '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-14'
]);

/* Sonno 7h — giornaliero, in pausa dal 15 ottobre. */
const seedSonno = habitSeedHabit(5, 'Sonno 7h', 'Salute', '2026-07-01', [
  { from: '2026-07-01', target: 1, granularity: 'day' }
], {
  pauses: [{ id: 'pause-sonno', from: '2026-10-15', to: null }],
  bindings: [
    {
      id: 'bind-sonno', taskId: 104, taskTitle: 'Routine serale', targetKind: 'task',
      state: 'disabled', createdAt: '2026-07-01', closedAt: null, closeReason: null
    }
  ]
});
habitSeedMany(seedSonno, habitSeedDays('2026-07-01', '2026-07-31'));
habitSeedMany(seedSonno, habitSeedDays('2026-08-01', '2026-08-31'));
habitSeedMany(seedSonno, habitSeedDays('2026-09-01', '2026-09-30'));
habitSeedMany(seedSonno, [
  ...habitSeedDays('2026-10-01', '2026-10-07'),
  ...habitSeedDays('2026-10-09', '2026-10-14')
]);

/* Journaling — nuovo, periodo di nascita non valutato. */
const seedJournaling = habitSeedHabit(6, 'Journaling', 'Formazione', '2026-10-28', [
  { from: '2026-10-28', target: 1, granularity: 'day' }
], { createdAtTime: '09:00' });

/* Corsa — settimanale, archiviato il 30 settembre. */
const seedCorsa = habitSeedHabit(7, 'Corsa', 'Salute', '2026-06-01', [
  { from: '2026-06-01', target: 2, granularity: 'week' }
], {
  archivedAt: '2026-09-30',
  bindings: [
    {
      id: 'bind-corsa', taskId: 105, taskTitle: 'Iscrizione maratona', targetKind: 'task',
      state: 'closed', createdAt: '2026-06-01', closedAt: '2026-09-30', closeReason: 'target_completed'
    }
  ]
});
habitSeedMany(seedCorsa, [
  '2026-06-02', '2026-06-04', '2026-06-09', '2026-06-11', '2026-06-16', '2026-06-18', '2026-06-23', '2026-06-25', '2026-06-30',
  '2026-07-02', '2026-07-07', '2026-07-09', '2026-07-14', '2026-07-16', '2026-07-21', '2026-07-23', '2026-07-28', '2026-07-30',
  '2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13', '2026-08-18', '2026-08-20', '2026-08-25',
  '2026-09-01', '2026-09-03', '2026-09-08', '2026-09-10', '2026-09-15', '2026-09-17', '2026-09-22', '2026-09-24', '2026-09-28'
]);

const initialHabits = [
  seedAtti,
  seedMeditare,
  seedPalestra,
  seedLeggere,
  seedSonno,
  seedJournaling,
  seedCorsa
];
