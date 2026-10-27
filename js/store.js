/* التخزين: بنية بيانات بإصدار، تحقق، ترحيل من النسخة الأولى، حفظ مع حالة، نسخ احتياطي */
(function (A) {
  'use strict';
  const U = A.util;
  const KEY = 'ifrsStudy.v2';
  const OLD_KEY = 'ifrs27'; // مفتاح النسخة الأولى — لا يُحذف أبدًا
  const PRE_IMPORT = 'ifrsStudy.v2.preImport';
  const SCHEMA = 2;

  const TASK_STATUS = ['todo', 'doing', 'done', 'partial', 'hard', 'skipped'];
  const TASK_TYPES = ['learn', 'practice', 'review', 'mock', 'final', 'custom'];
  const CAUSES = ['concept', 'calc', 'reading', 'presentation', 'time'];

  function defaultSettings(today) {
    return {
      qualification: 'dipifr', customStds: [],
      startDate: today, examDate: '2027-06-10', examConfirmed: false,
      // دقائق متاحة لكل يوم من أيام الأسبوع: الأحد ← السبت (0 = يوم راحة)
      dayMinutes: [60, 60, 60, 60, 60, 120, 120],
      restDates: [],
      sessionMin: 20, breakMin: 5, dailyGoal: 3,
      bufferDays: 7, finalDays: 10,
      showCountdown: true, theme: 'system', sound: true, notify: false,
      onboarded: false
    };
  }

  function defaultState(today) {
    return {
      schema: SCHEMA, createdAt: Date.now(), updatedAt: Date.now(),
      settings: defaultSettings(today),
      tasks: [], currentTaskId: null,
      sessions: [], timer: null,
      cards: { custom: [], edits: {}, srs: {}, notes: {}, queue: null },
      questions: { custom: [] },
      attempts: [], mocks: [], activeMock: null, activeAttempt: null,
      mistakes: [], coverage: {}, stdSources: {},
      meta: { migratedFrom: null, warnings: [] }
    };
  }

  // ---------- تحقق وتطبيع ----------
  const arr = x => (Array.isArray(x) ? x : []);
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const str = (x, d) => (typeof x === 'string' ? x : d);
  const numIn = (x, lo, hi, d) => (typeof x === 'number' && isFinite(x) && x >= lo && x <= hi ? x : d);
  const hasId = x => x && typeof x === 'object' && typeof x.id === 'string' && x.id;

  function normSettings(s, today) {
    const d = defaultSettings(today); s = obj(s);
    const out = Object.assign({}, d);
    if (['dipifr', 'sbr', 'custom'].includes(s.qualification)) out.qualification = s.qualification;
    out.customStds = arr(s.customStds).filter(x => typeof x === 'string');
    if (U.isDate(s.startDate)) out.startDate = s.startDate;
    if (U.isDate(s.examDate)) out.examDate = s.examDate;
    out.examConfirmed = !!s.examConfirmed;
    if (Array.isArray(s.dayMinutes) && s.dayMinutes.length === 7) out.dayMinutes = s.dayMinutes.map(m => numIn(m, 0, 960, 0));
    out.restDates = arr(s.restDates).filter(U.isDate);
    out.sessionMin = numIn(s.sessionMin, 5, 120, d.sessionMin);
    out.breakMin = numIn(s.breakMin, 1, 60, d.breakMin);
    out.dailyGoal = numIn(s.dailyGoal, 1, 20, d.dailyGoal);
    out.bufferDays = numIn(s.bufferDays, 0, 60, d.bufferDays);
    out.finalDays = numIn(s.finalDays, 0, 60, d.finalDays);
    ['showCountdown', 'sound', 'notify', 'onboarded'].forEach(k => { if (typeof s[k] === 'boolean') out[k] = s[k]; });
    if (['system', 'light', 'dark'].includes(s.theme)) out.theme = s.theme;
    return out;
  }

  function normTask(t) {
    if (!hasId(t)) return null;
    return {
      id: t.id, key: str(t.key, null), title: str(t.title, 'مهمة'), std: str(t.std, ''), topicId: str(t.topicId, ''),
      type: TASK_TYPES.includes(t.type) ? t.type : 'custom',
      phase: t.phase === 'final' ? 'final' : 'main',
      estMin: numIn(t.estMin, 5, 600, 30), priority: numIn(t.priority, 1, 3, 2), dropRank: numIn(t.dropRank, 0, 99, 0),
      order: numIn(t.order, 0, 1e9, 0),
      status: TASK_STATUS.includes(t.status) ? t.status : 'todo',
      date: U.isDate(t.date) ? t.date : null, pinned: !!t.pinned, archived: !!t.archived, protect: !!t.protect, dropped: !!t.dropped, unplaced: !!t.unplaced,
      source: str(t.source, ''), ref: str(t.ref, ''), link: str(t.link, ''), note: str(t.note, ''),
      origin: ['plan', 'user', 'mistake'].includes(t.origin) ? t.origin : 'user',
      mistakeId: str(t.mistakeId, null), minutesSpent: numIn(t.minutesSpent, 0, 1e6, 0),
      doneAt: typeof t.doneAt === 'number' ? t.doneAt : null, updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : 0
    };
  }

  function normSession(s) {
    if (!hasId(s) || typeof s.start !== 'number') return null;
    return {
      id: s.id, taskId: str(s.taskId, null), std: str(s.std, ''), start: s.start, end: typeof s.end === 'number' ? s.end : s.start,
      activeMs: numIn(s.activeMs, 0, 864e5, 0), plannedMin: numIn(s.plannedMin, 0, 600, 0),
      day: U.isDate(s.day) ? s.day : U.today(s.start), complete: s.complete !== false, outcome: str(s.outcome, null)
    };
  }

  function normCard(c) {
    if (!hasId(c) || typeof c.q !== 'string' || typeof c.a !== 'string') return null;
    return { id: c.id, std: str(c.std, ''), q: c.q, a: c.a, example: str(c.example, ''), conditions: str(c.conditions, ''), exceptions: str(c.exceptions, ''), source: str(c.source, ''), origin: 'user', fromMistake: str(c.fromMistake, null) };
  }

  function normSrs(s) {
    s = obj(s);
    return {
      ef: numIn(s.ef, 1.3, 5, 2.5), reps: numIn(s.reps, 0, 1e4, 0), interval: numIn(s.interval, 0, 36500, 0), lapses: numIn(s.lapses, 0, 1e4, 0),
      due: U.isDate(s.due) ? s.due : null, last: U.isDate(s.last) ? s.last : null,
      history: arr(s.history).filter(h => h && U.isDate(h.d) && typeof h.q === 'number').slice(-50)
    };
  }

  function normQuestion(q) {
    if (!hasId(q) || typeof q.prompt !== 'string' || !['mcq', 'numeric', 'written'].includes(q.type)) return { error: 'سؤال ناقص: لازم id و prompt و type (mcq / numeric / written)' };
    const out = { id: q.id, std: str(q.std, ''), topic: str(q.topic, ''), type: q.type, difficulty: numIn(q.difficulty, 1, 3, 2), marks: numIn(q.marks, 1, 100, 2), prompt: q.prompt, explanation: str(q.explanation, ''), model: str(q.model, ''), sourceNote: str(q.sourceNote, ''), origin: q.origin === 'imported' ? 'imported' : 'user' };
    if (q.type === 'mcq') {
      out.options = arr(q.options).filter(o => typeof o === 'string');
      out.correct = Number.isInteger(q.correct) ? q.correct : -1;
      if (out.options.length < 2 || out.correct < 0 || out.correct >= out.options.length) return { error: 'سؤال اختيار من متعدد "' + q.id + '": لازم خيارين على الأقل ورقم correct صحيح (يبدأ من 0)' };
    } else if (q.type === 'numeric') {
      out.answer = typeof q.answer === 'number' ? q.answer : U.num(q.answer);
      out.tolerance = numIn(q.tolerance, 0, 1e9, 0); out.unit = str(q.unit, '');
      if (!isFinite(out.answer)) return { error: 'سؤال حسابي "' + q.id + '": لازم answer رقم' };
    } else {
      out.rubric = arr(q.rubric).filter(r => r && typeof r.point === 'string').map(r => ({ point: r.point, marks: numIn(r.marks, 0, 100, 1) }));
    }
    return { q: out };
  }

  function normAttempt(a) {
    if (!hasId(a) || typeof a.qid !== 'string') return null;
    return {
      id: a.id, qid: a.qid, std: str(a.std, ''), mode: ['practice', 'timed', 'mock'].includes(a.mode) ? a.mode : 'practice', mockId: str(a.mockId, null),
      start: typeof a.start === 'number' ? a.start : 0, durationMs: numIn(a.durationMs, 0, 864e5, 0), limitMs: numIn(a.limitMs, 0, 864e5, 0),
      answer: a.answer == null ? null : a.answer, correct: typeof a.correct === 'boolean' ? a.correct : null,
      score: typeof a.score === 'number' ? a.score : null, max: numIn(a.max, 0, 1000, 0), day: U.isDate(a.day) ? a.day : U.today(a.start || 0)
    };
  }

  function normMistake(m) {
    if (!hasId(m)) return null;
    return {
      id: m.id, qid: str(m.qid, null), attemptId: str(m.attemptId, null), std: str(m.std, ''), title: str(m.title, ''),
      cause: CAUSES.includes(m.cause) ? m.cause : 'concept', note: str(m.note, ''), correction: str(m.correction, ''),
      created: U.isDate(m.created) ? m.created : U.today(), nextRetry: U.isDate(m.nextRetry) ? m.nextRetry : null,
      retries: arr(m.retries).filter(r => r && U.isDate(r.d)).map(r => ({ d: r.d, correct: !!r.correct, attemptId: str(r.attemptId, null) })),
      resolved: !!m.resolved, taskId: str(m.taskId, null), cardId: str(m.cardId, null)
    };
  }

  function normTimer(t) {
    t = obj(t);
    if (!['idle', 'running', 'paused', 'finished'].includes(t.state)) return null;
    return {
      state: t.state, kind: t.kind === 'break' ? 'break' : 'focus', plannedMs: numIn(t.plannedMs, 6e4, 72e5, 12e5),
      remainingMs: numIn(t.remainingMs, 0, 72e5, 0), endAt: typeof t.endAt === 'number' ? t.endAt : null, segStart: typeof t.segStart === 'number' ? t.segStart : null,
      activeMs: numIn(t.activeMs, 0, 864e5, 0), startedAt: typeof t.startedAt === 'number' ? t.startedAt : null, finishedAt: typeof t.finishedAt === 'number' ? t.finishedAt : null,
      taskId: str(t.taskId, null), std: str(t.std, ''), counted: !!t.counted, sessionId: str(t.sessionId, null), awaitingOutcome: !!t.awaitingOutcome
    };
  }

  function uniqById(list) { const seen = new Set(); return list.filter(x => x && !seen.has(x.id) && seen.add(x.id)); }

  function normalize(raw, today) {
    raw = obj(raw);
    const s = defaultState(today);
    const warn = [];
    s.createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : s.createdAt;
    s.settings = normSettings(raw.settings, today);
    const clean = (list, fn, label) => { const a = arr(list); const out = uniqById(a.map(fn).filter(Boolean)); if (out.length < a.length) warn.push('تم تجاهل ' + (a.length - out.length) + ' عنصر غير صالح في ' + label); return out; };
    s.tasks = clean(raw.tasks, normTask, 'المهام');
    s.currentTaskId = typeof raw.currentTaskId === 'string' && s.tasks.some(t => t.id === raw.currentTaskId) ? raw.currentTaskId : null;
    s.sessions = clean(raw.sessions, normSession, 'الجلسات');
    s.timer = raw.timer ? normTimer(raw.timer) : null;
    const c = obj(raw.cards);
    s.cards.custom = clean(c.custom, normCard, 'البطاقات');
    s.cards.edits = {}; Object.entries(obj(c.edits)).forEach(([k, v]) => { const n = normCard(Object.assign({ id: k }, obj(v))); if (n) s.cards.edits[k] = { q: n.q, a: n.a, example: n.example, conditions: n.conditions, exceptions: n.exceptions, std: n.std }; });
    s.cards.srs = {}; Object.entries(obj(c.srs)).forEach(([k, v]) => { s.cards.srs[k] = normSrs(v); });
    s.cards.notes = {}; Object.entries(obj(c.notes)).forEach(([k, v]) => { if (typeof v === 'string') s.cards.notes[k] = v; });
    const qd = obj(c.queue);
    s.cards.queue = Array.isArray(qd.ids) ? { ids: qd.ids.filter(x => typeof x === 'string'), idx: numIn(qd.idx, 0, 1e5, 0), day: str(qd.day, ''), fkey: str(qd.fkey, '') } : null;
    const qs = arr(obj(raw.questions).custom).map(normQuestion);
    s.questions.custom = uniqById(qs.filter(x => x.q).map(x => x.q));
    if (qs.some(x => x.error)) warn.push('تم تجاهل أسئلة غير صالحة');
    s.attempts = clean(raw.attempts, normAttempt, 'المحاولات');
    s.mocks = arr(raw.mocks).filter(hasId).map(m => ({ id: m.id, created: typeof m.created === 'number' ? m.created : 0, qids: arr(m.qids).filter(x => typeof x === 'string'), minutes: numIn(m.minutes, 1, 600, 60), start: m.start || null, end: m.end || null, attemptIds: arr(m.attemptIds).filter(x => typeof x === 'string') }));
    const am = obj(raw.activeMock);
    s.activeMock = am.id && Array.isArray(am.qids) ? { id: am.id, qids: am.qids, idx: numIn(am.idx, 0, 999, 0), start: am.start, endAt: am.endAt, minutes: am.minutes, answers: obj(am.answers) } : null;
    const aa = obj(raw.activeAttempt);
    s.activeAttempt = aa.qid ? { qid: aa.qid, mode: aa.mode === 'timed' ? 'timed' : 'practice', start: aa.start, endAt: aa.endAt || null, retryOf: str(aa.retryOf, null) } : null;
    s.mistakes = clean(raw.mistakes, normMistake, 'سجل الأخطاء');
    s.coverage = {}; Object.entries(obj(raw.coverage)).forEach(([k, v]) => { v = obj(v); s.coverage[k] = { explained: !!v.explained, practiced: !!v.practiced, reviewed: !!v.reviewed }; });
    s.stdSources = {}; Object.entries(obj(raw.stdSources)).forEach(([k, v]) => { s.stdSources[k] = arr(v).filter(x => x && typeof x.text === 'string').map(x => ({ text: x.text, url: str(x.url, '') })); });
    s.meta = { migratedFrom: obj(raw.meta).migratedFrom || null, warnings: warn };
    return s;
  }

  // ---------- ترحيل من النسخة الأولى (ifrs27) ----------
  // النسخة الأولى كانت تحفظ: exam، levels {المعيار: 1..3}، day، sessions (عدد جلسات اليوم)
  const OLD_STD_MAP = { 'Conceptual Framework': 'cf' };
  function migrateV1(old, today) {
    old = obj(old);
    const s = defaultState(today);
    if (U.isDate(old.exam)) s.settings.examDate = old.exam;
    Object.entries(obj(old.levels)).forEach(([name, lv]) => {
      const id = OLD_STD_MAP[name] || name.toLowerCase().replace(/\s+/g, '');
      lv = Number(lv) || 0;
      if (lv > 0) s.coverage[id] = { explained: lv >= 1, practiced: lv >= 2, reviewed: lv >= 3 };
    });
    s.meta.migratedFrom = { version: 1, at: Date.now(), legacySessionsToday: Number(old.sessions) || 0, legacyDay: str(old.day, '') };
    return s;
  }

  // ---------- قراءة وحفظ ----------
  const status = { ok: true, at: null, error: null, available: true };
  const listeners = [];
  function storage() { try { const ls = globalThis.localStorage; ls.getItem('__probe'); return ls; } catch (e) { return null; } }

  function load(today) {
    const ls = storage();
    if (!ls) { status.available = false; status.ok = false; status.error = 'التخزين المحلي غير متاح في المتصفح ده (ممكن وضع التصفح الخفي). البيانات هتضيع لما تقفل الصفحة — صدّر نسخة احتياطية.'; return { state: defaultState(today), fresh: true }; }
    let raw = null;
    try { raw = ls.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.schema !== SCHEMA) throw new Error('schema');
        return { state: normalize(parsed, today), fresh: false };
      } catch (e) {
        // لا مسح صامت: نحتفظ بالنسخة التالفة بمفتاح منفصل
        const bk = KEY + '.corrupt.' + Date.now();
        try { ls.setItem(bk, raw); } catch (e2) { /* لا مساحة */ }
        const st = defaultState(today);
        st.meta.warnings.push('البيانات المحفوظة كانت تالفة. اتحفظت نسخة منها باسم ' + bk + ' وبدأنا بيانات جديدة.');
        return { state: st, fresh: true, corrupt: bk };
      }
    }
    let old = null;
    try { old = ls.getItem(OLD_KEY); } catch (e) { old = null; }
    if (old) {
      try { return { state: migrateV1(JSON.parse(old), today), fresh: true, migrated: true }; }
      catch (e) { const st = defaultState(today); st.meta.warnings.push('ما قدرناش نقرأ بيانات النسخة الأولى. لسه محفوظة بدون تغيير تحت المفتاح ' + OLD_KEY + '.'); return { state: st, fresh: true }; }
    }
    return { state: defaultState(today), fresh: true };
  }

  function save(state) {
    const ls = storage();
    state.updatedAt = Date.now();
    if (!ls) { status.ok = false; status.available = false; notify(); return false; }
    try {
      ls.setItem(KEY, JSON.stringify(state));
      status.ok = true; status.at = Date.now(); status.error = null;
    } catch (e) {
      status.ok = false;
      status.error = (e && (e.name === 'QuotaExceededError' || e.code === 22)) ? 'المساحة المتاحة للتخزين خلصت. صدّر نسخة احتياطية وامسح محاولات قديمة.' : 'فشل الحفظ: ' + (e && e.message || e);
    }
    notify();
    return status.ok;
  }
  function notify() { listeners.forEach(fn => { try { fn(status); } catch (e) { /* */ } }); }

  // ---------- نسخ احتياطي ----------
  function exportData(state) {
    return JSON.stringify({ app: 'ifrs-study', schema: SCHEMA, exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  function summarize(st) {
    return { tasks: st.tasks.length, done: st.tasks.filter(t => t.status === 'done').length, sessions: st.sessions.length, cardsReviewed: Object.keys(st.cards.srs).length, customCards: st.cards.custom.length, questions: st.questions.custom.length, attempts: st.attempts.length, mistakes: st.mistakes.length, exam: st.settings.examDate, qualification: st.settings.qualification };
  }

  function parseImport(text, today) {
    let j;
    try { j = JSON.parse(text); } catch (e) { return { ok: false, error: 'الملف مش JSON صالح. اتأكد إنه ملف نسخة احتياطية من التطبيق.' }; }
    if (!j || typeof j !== 'object') return { ok: false, error: 'محتوى الملف فاضي أو غير مفهوم.' };
    // ملف أسئلة فقط: { questions: [...] } أو مصفوفة أسئلة
    if (Array.isArray(j) || (Array.isArray(j.questions) && !j.data)) {
      const list = Array.isArray(j) ? j : j.questions;
      const res = list.map(q => normQuestion(Object.assign({}, q, { origin: 'imported' })));
      const good = res.filter(r => r.q).map(r => r.q), errs = res.filter(r => r.error).map(r => r.error);
      if (!good.length) return { ok: false, error: 'مفيش أسئلة صالحة في الملف. ' + (errs[0] || '') };
      return { ok: true, kind: 'questions', questions: good, errors: errs };
    }
    if (j.app !== 'ifrs-study' || !j.data) return { ok: false, error: 'الملف ده مش نسخة احتياطية من التطبيق (ناقص app أو data).' };
    let data = j.data;
    if (j.schema === 1 || (data && data.levels)) data = migrateV1(data, today);
    else if (j.schema !== SCHEMA) return { ok: false, error: 'إصدار بنية البيانات (' + j.schema + ') غير مدعوم.' };
    const st = normalize(data, today);
    return { ok: true, kind: 'backup', state: st, summary: summarize(st), warnings: st.meta.warnings, exportedAt: j.exportedAt };
  }

  // دمج بدون تكرار: العناصر بنفس id تأخذ الأحدث
  function merge(cur, inc) {
    const out = U.clone(cur);
    const byId = (a, b, newer) => { const m = new Map(a.map(x => [x.id, x])); b.forEach(x => { const e = m.get(x.id); if (!e || (newer && newer(x, e))) m.set(x.id, x); }); return [...m.values()]; };
    out.tasks = byId(out.tasks, inc.tasks, (x, e) => (x.updatedAt || 0) > (e.updatedAt || 0));
    out.sessions = byId(out.sessions, inc.sessions);
    out.attempts = byId(out.attempts, inc.attempts);
    out.mistakes = byId(out.mistakes, inc.mistakes, (x, e) => x.retries.length > e.retries.length || (x.resolved && !e.resolved));
    out.mocks = byId(out.mocks, inc.mocks);
    out.questions.custom = byId(out.questions.custom, inc.questions.custom);
    out.cards.custom = byId(out.cards.custom, inc.cards.custom);
    Object.entries(inc.cards.srs).forEach(([k, v]) => { const e = out.cards.srs[k]; if (!e || (v.last || '') > (e.last || '')) out.cards.srs[k] = v; });
    Object.entries(inc.cards.edits).forEach(([k, v]) => { if (!out.cards.edits[k]) out.cards.edits[k] = v; });
    Object.entries(inc.cards.notes).forEach(([k, v]) => { out.cards.notes[k] = out.cards.notes[k] && out.cards.notes[k] !== v ? out.cards.notes[k] + '\n— ' + v : v; });
    Object.entries(inc.coverage).forEach(([k, v]) => { const e = out.coverage[k] || {}; out.coverage[k] = { explained: e.explained || v.explained, practiced: e.practiced || v.practiced, reviewed: e.reviewed || v.reviewed }; });
    Object.entries(inc.stdSources).forEach(([k, v]) => { const e = out.stdSources[k] || []; const seen = new Set(e.map(x => x.text + '|' + x.url)); out.stdSources[k] = e.concat(v.filter(x => !seen.has(x.text + '|' + x.url))); });
    return out;
  }

  function keepPreImport(state) {
    const ls = storage(); if (!ls) return false;
    try { ls.setItem(PRE_IMPORT, JSON.stringify(state)); return true; } catch (e) { return false; }
  }

  A.store = { KEY, OLD_KEY, SCHEMA, CAUSES, defaultState, defaultSettings, normalize, normQuestion, normCard, migrateV1, load, save, status, onStatus: fn => listeners.push(fn), exportData, parseImport, merge, summarize, keepPreImport };
})(globalThis.App = globalThis.App || {});
