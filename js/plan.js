/* الخطة: توليد المهام من المنهج، جدولتها حسب الوقت المتاح، وإعادة التوزيع مع الحفاظ على المنجز */
(function (A) {
  'use strict';
  const U = A.util;
  const EST = { learn: 45, practice: 50, review: 30, mock: 50, final: 45 };

  function topicsFor(settings, content) {
    const q = content.QUALIFICATIONS[settings.qualification] || content.QUALIFICATIONS.dipifr;
    if (q.topics) return q.topics;
    // خطة مخصصة: موضوع لكل معيار مختار
    return settings.customStds.map(id => content.STANDARDS.find(s => s.id === id)).filter(Boolean)
      .map(s => ({ id: 'c-' + s.id, title: s.code + ' — ' + s.ar, stds: [s.id], learn: 2, practice: 2, priority: 2 }));
  }

  // قوالب المهام بمفتاح ثابت (key) عشان الحفاظ على الحالة عند إعادة التوليد
  function templates(settings, content) {
    const topics = topicsFor(settings, content);
    const q = content.QUALIFICATIONS[settings.qualification] || content.QUALIFICATIONS.dipifr;
    const out = []; let order = 0;
    const push = (o) => out.push(Object.assign({ order: order++, origin: 'plan', phase: 'main' }, o));
    // المرحلة 1: شرح كل موضوع + أول تدريب عليه مباشرة
    topics.forEach(t => {
      for (let i = 1; i <= t.learn; i++) push({ key: t.id + ':learn:' + i, topicId: t.id, std: t.stds[0], type: 'learn', estMin: EST.learn, priority: t.priority, dropRank: t.priority === 3 ? 2.5 : 0, title: 'شرح ' + t.title + (t.learn > 1 ? ' (' + i + '/' + t.learn + ')' : '') });
      if (t.practice > 0) push({ key: t.id + ':practice:1', topicId: t.id, std: t.stds[0], type: 'practice', estMin: EST.practice, priority: t.priority, dropRank: 0, title: 'حل أسئلة على ' + t.title + ' (1/' + t.practice + ')' });
    });
    // المرحلة 2: باقي التدريب + مراجعة كل موضوع
    topics.forEach(t => {
      for (let i = 2; i <= t.practice; i++) push({ key: t.id + ':practice:' + i, topicId: t.id, std: t.stds[0], type: 'practice', estMin: EST.practice, priority: t.priority, dropRank: 3 + t.priority + i / 10, title: 'حل أسئلة على ' + t.title + ' (' + i + '/' + t.practice + ')' });
      push({ key: t.id + ':review:1', topicId: t.id, std: t.stds[0], type: 'review', estMin: EST.review, priority: t.priority, dropRank: 2 + t.priority, title: 'مراجعة ' + t.title + ' + بطاقاتها' });
    });
    // المرحلة 3: امتحانات تجريبية مقسمة لأجزاء
    for (let m = 1; m <= q.mocks; m++) {
      for (let p = 1; p <= 4; p++) push({ key: 'mock:' + m + ':' + p, topicId: 'mock', std: '', type: 'mock', estMin: EST.mock, priority: 1, dropRank: m === 1 ? 0 : 1 + m, title: 'امتحان تجريبي ' + m + ' — الجزء ' + p + ' من 4 بالوقت' });
      push({ key: 'mock:' + m + ':fix', topicId: 'mock', std: '', type: 'review', estMin: EST.review, priority: 1, dropRank: m === 1 ? 0 : 1 + m, title: 'تصحيح امتحان تجريبي ' + m + ' وتسجيل الأخطاء' });
    }
    // المراجعة الأخيرة (في آخر أيام قبل الامتحان)
    topics.filter(t => t.priority === 1).forEach(t => push({ key: t.id + ':final', topicId: t.id, std: t.stds[0], type: 'final', phase: 'final', estMin: EST.final, priority: 1, dropRank: 1, title: 'مراجعة نهائية: ' + t.title }));
    push({ key: 'final:mistakes', topicId: 'final', std: '', type: 'final', phase: 'final', estMin: EST.final, priority: 1, dropRank: 0, title: 'مراجعة نهائية: سجل أخطائك المتكررة' });
    return out;
  }

  // دمج القوالب مع المهام الحالية — المنجز لا يضيع
  function sync(state, content) {
    const tpl = templates(state.settings, content);
    const byKey = new Map(state.tasks.filter(t => t.key).map(t => [t.key, t]));
    const keys = new Set(tpl.map(t => t.key));
    const next = [];
    tpl.forEach(t => {
      const e = byKey.get(t.key);
      if (e) next.push(Object.assign({}, e, { title: t.title, order: t.order, priority: t.priority, dropRank: t.dropRank, phase: t.phase, std: e.std || t.std, topicId: t.topicId, type: t.type }));
      else next.push(Object.assign({ id: U.uid('t'), status: 'todo', date: null, pinned: false, dropped: false, unplaced: false, source: '', ref: '', link: '', note: '', minutesSpent: 0, doneAt: null, updatedAt: Date.now() }, t));
    });
    const removed = [];
    state.tasks.forEach(t => {
      if (t.origin !== 'plan') next.push(Object.assign({}, t, { order: t.order < 1e6 ? 1e6 + t.order : t.order }));
      else if (!keys.has(t.key)) { if (t.status === 'done' || t.minutesSpent > 0) next.push(Object.assign({}, t, { archived: true, date: t.date })); else removed.push(t); }
    });
    return { tasks: next, removed };
  }

  function capacity(settings, date) {
    if (settings.restDates.includes(date)) return 0;
    return settings.dayMinutes[U.dow(date)] || 0;
  }

  // نوافذ الخطة: رئيسية ← احتياطي ← مراجعة أخيرة ← يوم الامتحان
  function windows(settings, today) {
    const E = settings.examDate;
    const start = U.max(settings.startDate, today);
    const total = U.diff(start, E); // أيام متاحة من start لحد E−1
    if (total <= 0) return { valid: false, start, exam: E, reason: today >= E ? 'examPassed' : 'noDays' };
    const finalN = Math.min(settings.finalDays, Math.floor(total / 4));
    const bufN = Math.min(settings.bufferDays, Math.floor((total - finalN) / 6));
    const finalStart = U.add(E, -finalN);
    const bufStart = U.add(finalStart, -bufN);
    return {
      valid: true, start, exam: E, lastPrep: U.add(E, -1),
      main: U.range(start, U.add(bufStart, -1)),
      buffer: bufN ? U.range(bufStart, U.add(finalStart, -1)) : [],
      final: finalN ? U.range(finalStart, U.add(E, -1)) : [],
      finalN, bufN, total
    };
  }

  function fill(list, days, used, settings) {
    const dates = {}, over = [];
    let di = 0;
    list.forEach(t => {
      while (di < days.length) {
        const d = days[di], cap = capacity(settings, d), u = used[d] || 0;
        if (cap <= 0) { di++; continue; }
        if (u + t.estMin <= cap || u === 0) { dates[t.id] = d; used[d] = u + t.estMin; return; }
        di++;
      }
      over.push(t);
    });
    return { dates, over };
  }

  const sumMin = (days, settings) => days.reduce((a, d) => a + capacity(settings, d), 0);

  // جدولة نقية: ترجع اقتراحًا بدون تعديل الحالة
  function schedule(tasks, settings, today) {
    const w = windows(settings, today);
    const res = { valid: w.valid, w, dates: {}, dropped: [], unplaced: [], usesBuffer: false, requiredMin: 0, capacityMin: 0, deficitMin: 0 };
    const open = tasks.filter(t => t.status !== 'done' && !t.archived && t.status !== 'skipped');
    if (!w.valid) { open.forEach(t => { res.dates[t.id] = null; }); res.unplaced = open.map(t => t.id); return res; }
    const used = {};
    const inRange = d => d && d >= w.start && d <= w.lastPrep;
    open.filter(t => t.pinned && inRange(t.date)).forEach(t => { res.dates[t.id] = t.date; used[t.date] = (used[t.date] || 0) + t.estMin; });
    const free = open.filter(t => !(t.pinned && inRange(t.date)));
    let main = free.filter(t => t.phase !== 'final').sort((a, b) => a.order - b.order);
    let fin = free.filter(t => t.phase === 'final').sort((a, b) => a.order - b.order);
    res.requiredMin = free.reduce((a, t) => a + t.estMin, 0);
    res.capacityMin = sumMin(w.main.concat(w.buffer, w.final), settings) - Object.values(used).reduce((a, b) => a + b, 0);

    let r = fill(main, w.main, Object.assign({}, used), settings);
    if (r.over.length) { r = fill(main, w.main.concat(w.buffer), Object.assign({}, used), settings); res.usesBuffer = true; }
    // الوقت مش كفاية: نقترح حذف الأقل أولوية بدل ضغط الأيام
    const dropped = [];
    while (r.over.length) {
      const cand = main.filter(t => t.origin === 'plan' && t.dropRank > 0 && !t.protect).sort((a, b) => b.dropRank - a.dropRank)[0];
      if (!cand) break;
      dropped.push(cand); main = main.filter(t => t !== cand);
      r = fill(main, w.main.concat(w.buffer), Object.assign({}, used), settings);
    }
    const used2 = Object.assign({}, used);
    Object.entries(r.dates).forEach(([id, d]) => { const t = main.find(x => x.id === id); used2[d] = (used2[d] || 0) + t.estMin; });
    Object.assign(res.dates, r.dates);
    res.unplaced = r.over.map(t => t.id);
    // المراجعة الأخيرة: لو الأيام قليلة نشيل الزيادة (الأقل أولوية أولًا)
    let rf = fill(fin, w.final.length ? w.final : w.buffer, Object.assign({}, used2), settings);
    while (rf.over.length) {
      const cand = fin.filter(t => t.dropRank > 0 && !t.protect).sort((a, b) => b.order - a.order)[0];
      if (!cand) break;
      dropped.push(cand); fin = fin.filter(t => t !== cand);
      rf = fill(fin, w.final.length ? w.final : w.buffer, Object.assign({}, used2), settings);
    }
    Object.assign(res.dates, rf.dates);
    res.unplaced = res.unplaced.concat(rf.over.map(t => t.id));
    res.dropped = dropped.map(t => t.id);
    res.dropped.concat(res.unplaced).forEach(id => { res.dates[id] = null; });
    res.deficitMin = Math.max(0, res.requiredMin - res.capacityMin);
    return res;
  }

  function applySchedule(state, res) {
    const drop = new Set(res.dropped), un = new Set(res.unplaced);
    state.tasks.forEach(t => {
      if (!(t.id in res.dates)) return;
      t.date = res.dates[t.id];
      t.dropped = drop.has(t.id);
      t.unplaced = un.has(t.id);
      if (t.date === null) t.pinned = false;
      t.updatedAt = Date.now();
    });
  }

  // مقارنة الاقتراح بالوضع الحالي (للمعاينة قبل الاعتماد)
  function diffSchedule(state, res) {
    let moved = 0, newlyDropped = 0;
    state.tasks.forEach(t => {
      if (!(t.id in res.dates)) return;
      if (t.date !== res.dates[t.id]) moved++;
      if (res.dropped.includes(t.id) && !t.dropped) newlyDropped++;
    });
    const loads = {};
    Object.entries(res.dates).forEach(([id, d]) => { if (d) { const t = state.tasks.find(x => x.id === id); loads[d] = (loads[d] || 0) + t.estMin; } });
    const vals = Object.values(loads);
    return { moved, newlyDropped, days: vals.length, avgLoad: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0, maxLoad: vals.length ? Math.max.apply(null, vals) : 0 };
  }

  function activeTasks(state) { return state.tasks.filter(t => !t.archived); }

  function status(state, today) {
    const s = state.settings;
    if (!s.onboarded) return 'setup';
    if (today > s.examDate) return 'examPassed';
    if (today === s.examDate) return 'examDay';
    if (today < s.startDate) return 'notStarted';
    const live = activeTasks(state).filter(t => !t.dropped);
    if (live.length && live.every(t => t.status === 'done' || t.status === 'skipped')) return 'finished';
    return 'running';
  }

  const isOpen = t => !['done', 'skipped'].includes(t.status) && !t.archived;
  function overdue(state, today) { return activeTasks(state).filter(t => isOpen(t) && t.date && t.date < today); }

  // أول يوم دراسي متاح بعد تاريخ معين وقبل الامتحان
  function nextStudyDay(settings, from) {
    for (let d = U.add(from, 1); d < settings.examDate; d = U.add(d, 1)) if (capacity(settings, d) > 0) return d;
    return null;
  }

  A.plan = { EST, templates, sync, capacity, windows, schedule, applySchedule, diffSchedule, status, overdue, nextStudyDay, isOpen, topicsFor };
})(globalThis.App = globalThis.App || {});
