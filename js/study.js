/* منطق المذاكرة: البطاقات والأسئلة والتصحيح والأخطاء واقتراح المهمة التالية والمؤشرات */
(function (A) {
  'use strict';
  const U = A.util;

  // ---------- البطاقات ----------
  function allCards(state, content) {
    const edits = state.cards.edits;
    return content.CARDS.map(c => (edits[c.id] ? Object.assign({}, c, edits[c.id], { edited: true }) : c)).concat(state.cards.custom);
  }

  // ---------- الأسئلة ----------
  function allQuestions(state, content) { return content.QUESTIONS.concat(state.questions.custom); }

  function grade(q, answer) {
    if (q.type === 'mcq') {
      const ok = Number(answer) === q.correct;
      return { correct: ok, score: ok ? q.marks : 0, max: q.marks };
    }
    if (q.type === 'numeric') {
      const v = U.num(answer);
      if (!isFinite(v)) return { correct: false, score: 0, max: q.marks, invalid: true };
      const ok = Math.abs(v - q.answer) <= (q.tolerance || 0) + 1e-9;
      return { correct: ok, score: ok ? q.marks : 0, max: q.marks };
    }
    return { correct: null, score: null, max: q.marks, needsSelfGrade: true };
  }

  // تصحيح ذاتي موجّه: مجموع درجات نقاط دليل التصحيح اللي المستخدم أكد إنه غطاها
  function selfGrade(q, checked) {
    const rub = q.rubric && q.rubric.length ? q.rubric : [{ point: 'الإجابة مطابقة للإجابة النموذجية', marks: q.marks }];
    const max = rub.reduce((a, r) => a + r.marks, 0) || q.marks;
    const got = rub.reduce((a, r, i) => a + (checked[i] ? r.marks : 0), 0);
    const score = Math.round((got / max) * q.marks * 10) / 10;
    return { score, max: q.marks, correct: score >= q.marks * 0.5 };
  }

  function buildMock(questions, opts, rnd) {
    let pool = questions.filter(q => !opts.stds || !opts.stds.length || opts.stds.includes(q.std));
    if (opts.difficulty) pool = pool.filter(q => q.difficulty === opts.difficulty);
    return U.shuffle(pool, rnd).slice(0, opts.count || 5).map(q => q.id);
  }

  const timeLimitMin = q => Math.max(2, Math.round(q.marks * 1.8)); // تقريبًا 1.8 دقيقة لكل درجة (إعداد تقريبي)

  // ---------- الأخطاء ----------
  const CAUSE_LABEL = { concept: 'فهم', calc: 'حساب', reading: 'قراءة السؤال', presentation: 'عرض الإجابة', time: 'إدارة الوقت' };

  function newMistake(q, attempt, cause, note, correction, today) {
    return { id: U.uid('m'), qid: q ? q.id : null, attemptId: attempt ? attempt.id : null, std: q ? q.std : '', title: q ? q.prompt.slice(0, 90) : '', cause, note: note || '', correction: correction || '', created: today, nextRetry: U.add(today, 3), retries: [], resolved: false, taskId: null, cardId: null };
  }

  function recordRetry(m, attempt, today) {
    const ok = !!attempt.correct;
    m.retries.push({ d: today, correct: ok, attemptId: attempt.id });
    if (ok) { m.resolved = true; m.nextRetry = null; } else { m.nextRetry = U.add(today, 7); }
  }

  function mistakesDue(state, today) { return state.mistakes.filter(m => !m.resolved && m.nextRetry && m.nextRetry <= today); }

  function recurring(state) {
    const by = {};
    state.mistakes.forEach(m => { const k = m.std + '|' + m.cause; by[k] = by[k] || { std: m.std, cause: m.cause, n: 0, open: 0 }; by[k].n++; if (!m.resolved) by[k].open++; });
    return Object.values(by).filter(x => x.n >= 2).sort((a, b) => b.n - a.n);
  }

  // ---------- المؤشرات ----------
  const sessionMin = s => s.activeMs / 60000;

  function commitment(state, today, days) {
    const from = U.add(today, -(days - 1));
    const ss = state.sessions.filter(s => s.day >= from && s.day <= today);
    const dayset = new Set(ss.map(s => s.day));
    let planned = 0;
    U.range(from, today).forEach(d => { if (A.plan.capacity(state.settings, d) > 0 && d >= state.settings.startDate) planned++; });
    return { days: dayset.size, plannedDays: planned, sessions: ss.filter(s => s.complete).length, partial: ss.filter(s => !s.complete).length, minutes: Math.round(ss.reduce((a, s) => a + sessionMin(s), 0)) };
  }

  function today_(state, today) {
    const ss = state.sessions.filter(s => s.day === today);
    return { sessions: ss.filter(s => s.complete).length, minutes: Math.round(ss.reduce((a, s) => a + sessionMin(s), 0)) };
  }

  // التغطية: من المهام المكتملة حسب نوعها + التعليم اليدوي
  function coverage(state, stdIds) {
    const out = {};
    stdIds.forEach(id => { const m = state.coverage[id] || {}; out[id] = { explained: !!m.explained, practiced: !!m.practiced, reviewed: !!m.reviewed, auto: { explained: false, practiced: false, reviewed: false } }; });
    state.tasks.forEach(t => {
      if (t.status !== 'done' || !out[t.std]) return;
      const a = out[t.std].auto;
      if (t.type === 'learn') a.explained = true;
      if (t.type === 'practice') a.practiced = true;
      if (t.type === 'review' || t.type === 'final') a.reviewed = true;
    });
    Object.values(out).forEach(o => { o.explained = o.explained || o.auto.explained; o.practiced = o.practiced || o.auto.practiced; o.reviewed = o.reviewed || o.auto.reviewed; });
    return out;
  }

  function planProgress(state) {
    const live = state.tasks.filter(t => !t.archived && !t.dropped && t.status !== 'skipped');
    const done = live.filter(t => t.status === 'done');
    return { total: live.length, done: done.length, minTotal: live.reduce((a, t) => a + t.estMin, 0), minDone: done.reduce((a, t) => a + t.estMin, 0) };
  }

  // الإتقان: آخر 10 محاولات مصححة خلال 60 يوم. أقل من 3 محاولات ← بيانات غير كافية
  const MIN_ATTEMPTS = 3;
  function mastery(state, std, today) {
    const from = U.add(today, -60);
    const list = state.attempts.filter(a => a.score != null && a.max > 0 && a.day >= from && (!std || a.std === std)).sort((a, b) => b.start - a.start).slice(0, 10);
    if (list.length < MIN_ATTEMPTS) return { enough: false, n: list.length };
    const s = list.reduce((x, a) => x + a.score, 0), m = list.reduce((x, a) => x + a.max, 0);
    return { enough: true, n: list.length, pct: Math.round((s / m) * 100) };
  }

  function weakStds(state, today) {
    const score = {};
    const add = (id, v) => { if (id) score[id] = (score[id] || 0) + v; };
    state.mistakes.filter(m => !m.resolved).forEach(m => add(m.std, 2));
    state.tasks.filter(t => t.status === 'hard').forEach(t => add(t.std, 2));
    state.attempts.filter(a => a.day >= U.add(today, -30) && a.correct === false).forEach(a => add(a.std, 1));
    return Object.entries(score).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  }

  function weekly(state, today) {
    const ws = U.weekStart(today), we = U.add(ws, 6);
    const tasks = state.tasks.filter(t => !t.archived && t.date && t.date >= ws && t.date <= we);
    const ss = state.sessions.filter(s => s.day >= ws && s.day <= we);
    const at = state.attempts.filter(a => a.day >= ws && a.day <= we && a.score != null);
    return {
      from: ws, to: we, planned: tasks.length, plannedMin: tasks.reduce((a, t) => a + t.estMin, 0),
      done: tasks.filter(t => t.status === 'done').length, actualMin: Math.round(ss.reduce((a, s) => a + sessionMin(s), 0)), sessions: ss.filter(s => s.complete).length,
      attempts: at.length, correct: at.filter(a => a.correct).length, newMistakes: state.mistakes.filter(m => m.created >= ws && m.created <= we).length,
      weak: weakStds(state, today).slice(0, 3)
    };
  }

  // ---------- المهمة التالية ----------
  // الأولوية: المهمة الجارية ← المتأخرة (الأقدم) ← مهام النهارده (المعايير الضعيفة أولًا) ← أقرب مهمة قادمة
  function candidates(state, today) {
    const weak = new Set(weakStds(state, today).slice(0, 5));
    const open = state.tasks.filter(t => A.plan.isOpen(t) && !t.dropped && t.date);
    const score = t => (t.status === 'doing' || t.status === 'partial' ? 0 : t.date < today ? 1 : t.date === today ? 2 : 3);
    return open.sort((a, b) => score(a) - score(b) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (weak.has(b.std) - weak.has(a.std)) || a.order - b.order);
  }

  function suggestNext(state, today, skipIds) {
    const list = candidates(state, today).filter(t => !(skipIds || []).includes(t.id));
    return list[0] || null;
  }

  A.study = { allCards, allQuestions, grade, selfGrade, buildMock, timeLimitMin, CAUSE_LABEL, newMistake, recordRetry, mistakesDue, recurring, commitment, todayStats: today_, coverage, planProgress, mastery, MIN_ATTEMPTS, weakStds, weekly, candidates, suggestNext };
})(globalThis.App = globalThis.App || {});
