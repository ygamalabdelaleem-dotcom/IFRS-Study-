/* اختبارات المنطق الأساسي — تشغيل: node tests/core.test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
const ctx = { console, Math, Date, JSON, Intl, localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { if (ctx.__fail) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } mem[k] = String(v); }, removeItem: k => { delete mem[k]; } } };
ctx.globalThis = ctx; vm.createContext(ctx);
['js/util.js', 'content/content.js', 'js/store.js', 'js/plan.js', 'js/timer.js', 'js/srs.js', 'js/study.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f }));
const A = ctx.App, U = A.util;
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n     ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

function freshState(today, over) {
  const s = A.store.defaultState(today);
  Object.assign(s.settings, { onboarded: true, startDate: today }, over || {});
  s.tasks = A.plan.sync(s, A.content).tasks;
  A.plan.applySchedule(s, A.plan.schedule(s.tasks, s.settings, today));
  return s;
}

console.log('التايمر');
t('الوقت المتبقي محسوب من endAt (مش بالعد)', () => {
  let tm = A.timer.start(A.timer.create('focus', 20), 1000);
  eq(A.timer.remaining(tm, 1000 + 5 * 60000), 15 * 60000);
});
t('سكون الجهاز: الجلسة تخلص مرة واحدة والوقت الفعلي لا يتعدى المدة', () => {
  let tm = A.timer.start(A.timer.create('focus', 20), 0);
  const r = A.timer.check(tm, 3 * 3600e3);
  ok(r.finished); eq(r.t.activeMs, 20 * 60000); eq(A.timer.remaining(r.t, 4e6), 0);
  const r2 = A.timer.check(r.t, 5 * 3600e3); ok(!r2.finished, 'لا يخلص مرتين');
});
t('إيقاف مؤقت واستئناف: فترة التوقف لا تُحسب', () => {
  let tm = A.timer.start(A.timer.create('focus', 10), 0);
  tm = A.timer.pause(tm, 2 * 60000);
  tm = A.timer.resume(tm, 30 * 60000); // توقف 28 دقيقة
  eq(A.timer.remaining(tm, 30 * 60000), 8 * 60000);
  const r = A.timer.check(tm, 38 * 60000); ok(r.finished); eq(r.t.activeMs, 10 * 60000);
});
t('تشغيل بعد الانتهاء يبدأ بالوقت الكامل', () => {
  let tm = A.timer.check(A.timer.start(A.timer.create('focus', 5), 0), 6 * 60000).t;
  tm = A.timer.start(tm, 7 * 60000);
  eq(tm.state, 'running'); eq(A.timer.remaining(tm, 7 * 60000), 5 * 60000); eq(tm.counted, false);
});
t('إلغاء يرجّع الوقت الفعلي فقط، وإعادة الضبط بدون تسجيل', () => {
  let tm = A.timer.start(A.timer.create('focus', 20), 0);
  const c = A.timer.cancel(tm, 7 * 60000); eq(c.activeMs, 7 * 60000); eq(c.t.state, 'idle');
  eq(A.timer.reset(tm).state, 'idle');
});
t('لا عد سالب', () => { const tm = A.timer.start(A.timer.create('focus', 1), 0); eq(A.timer.remaining(tm, 1e9), 0); });

console.log('الخطة');
const TODAY = '2026-10-27';
t('الخطة لا تمتد بعد الامتحان وتترك أيام احتياطي ومراجعة أخيرة', () => {
  const s = freshState(TODAY);
  const dates = s.tasks.filter(x => x.date).map(x => x.date).sort();
  ok(dates[dates.length - 1] < s.settings.examDate, 'آخر مهمة قبل الامتحان');
  const w = A.plan.windows(s.settings, TODAY);
  ok(w.buffer.length > 0 && w.final.length > 0);
  const mainLast = s.tasks.filter(x => x.date && x.phase === 'main').map(x => x.date).sort().pop();
  ok(mainLast < w.final[0], 'المهام الرئيسية قبل المراجعة الأخيرة');
  ok(s.tasks.filter(x => x.phase === 'final').every(x => !x.date || x.date >= w.final[0]));
});
t('لا يوم يتعدى الوقت المتاح (إلا مهمة واحدة أكبر من اليوم)', () => {
  const s = freshState(TODAY);
  const load = {}; s.tasks.forEach(x => { if (x.date) (load[x.date] = load[x.date] || []).push(x.estMin); });
  Object.entries(load).forEach(([d, l]) => { const cap = A.plan.capacity(s.settings, d); ok(l.length === 1 || l.reduce((a, b) => a + b, 0) <= cap, d); ok(cap > 0, 'يوم راحة اتحطت فيه مهمة ' + d); });
});
t('تغيير موعد الامتحان يحافظ على المنجز ويرجّع الخطة قبل الموعد الجديد', () => {
  const s = freshState(TODAY);
  const done = s.tasks.slice(0, 3); done.forEach(x => { x.status = 'done'; });
  const doneDates = done.map(x => x.date);
  s.settings.examDate = '2027-03-01';
  s.tasks = A.plan.sync(s, A.content).tasks;
  const r = A.plan.schedule(s.tasks, s.settings, TODAY); A.plan.applySchedule(s, r);
  eq(s.tasks.filter(x => x.status === 'done').length, 3);
  eq(done.map(d => s.tasks.find(x => x.id === d.id).date), doneDates, 'تواريخ المنجز ثابتة');
  ok(s.tasks.filter(x => x.date && x.status !== 'done').every(x => x.date < '2027-03-01'));
});
t('وقت غير كافٍ: يقترح حذف الأقل أولوية ويبيّن العجز', () => {
  const s = freshState(TODAY, { examDate: '2026-12-15', dayMinutes: [30, 30, 30, 30, 30, 60, 60] });
  const r = A.plan.schedule(s.tasks, s.settings, TODAY);
  ok(r.deficitMin > 0, 'فيه عجز'); ok(r.dropped.length > 0, 'فيه اقتراح حذف');
  const dropped = s.tasks.filter(x => r.dropped.includes(x.id));
  ok(dropped.every(x => x.dropRank > 0), 'لا يحذف الشرح الأساسي');
  ok(Object.values(r.dates).every(d => d === null || d < '2026-12-15'));
});
t('تغيير تاريخ البداية للمستقبل: لا مهام قبله + حالة "لم تبدأ"', () => {
  const s = freshState(TODAY, { startDate: '2026-11-15' });
  ok(s.tasks.filter(x => x.date).every(x => x.date >= '2026-11-15'));
  eq(A.plan.status(s, TODAY), 'notStarted');
});
t('حالات الخطة: جارية / يوم الامتحان / مر الموعد', () => {
  const s = freshState(TODAY);
  eq(A.plan.status(s, '2026-12-01'), 'running');
  eq(A.plan.status(s, s.settings.examDate), 'examDay');
  eq(A.plan.status(s, '2027-07-01'), 'examPassed');
});
t('المهام المتأخرة تُكتشف ولا تُنقل تلقائيًا', () => {
  const s = freshState(TODAY);
  const later = '2026-11-20';
  const od = A.plan.overdue(s, later);
  ok(od.length > 0);
  ok(od.every(x => x.date < later), 'لسه بتواريخها القديمة');
  const r = A.plan.schedule(s.tasks, s.settings, later);
  ok(od.every(x => r.dates[x.id] === null || r.dates[x.id] >= later), 'الاقتراح يوزعها من النهارده');
});
t('المهمة المثبتة (منقولة يدويًا) تفضل في تاريخها', () => {
  const s = freshState(TODAY);
  const x = s.tasks.find(y => y.date); x.date = '2027-01-05'; x.pinned = true;
  const r = A.plan.schedule(s.tasks, s.settings, TODAY); eq(r.dates[x.id], '2027-01-05');
});
t('مر موعد الامتحان: لا جدولة', () => {
  const s = freshState(TODAY); const r = A.plan.schedule(s.tasks, s.settings, '2027-07-01'); ok(!r.valid);
});

console.log('الحفظ والترحيل');
t('ترحيل بيانات النسخة الأولى (ifrs27)', () => {
  const st = A.store.migrateV1({ exam: '2027-06-12', levels: { 'IFRS 16': 2, 'Conceptual Framework': 3, 'IAS 1': 1 }, day: 'x', sessions: 2 }, TODAY);
  eq(st.settings.examDate, '2027-06-12');
  eq(st.coverage.ifrs16, { explained: true, practiced: true, reviewed: false });
  eq(st.coverage.cf.reviewed, true); eq(st.coverage.ias1.practiced, false);
  eq(st.meta.migratedFrom.legacySessionsToday, 2);
});
t('load: يقرأ النسخة الأولى ولا يمسحها', () => {
  mem['ifrs27'] = JSON.stringify({ exam: '2027-06-10', levels: { 'IAS 16': 1 } });
  delete mem['ifrsStudy.v2'];
  const r = A.store.load(TODAY); ok(r.migrated); ok(mem['ifrs27'], 'المفتاح القديم موجود');
});
t('حفظ واستعادة', () => {
  const s = freshState(TODAY); s.tasks[0].status = 'done';
  ok(A.store.save(s));
  const r = A.store.load(TODAY); eq(r.state.tasks[0].status, 'done'); eq(r.state.tasks.length, s.tasks.length);
});
t('بيانات تالفة: لا مسح صامت', () => {
  mem['ifrsStudy.v2'] = '{bad json';
  const r = A.store.load(TODAY); ok(r.corrupt); eq(mem[r.corrupt], '{bad json'); ok(r.state.meta.warnings.length);
});
t('فشل التخزين يظهر في الحالة', () => {
  ctx.__fail = true; const okk = A.store.save(A.store.defaultState(TODAY)); ctx.__fail = false;
  ok(!okk); ok(/المساحة/.test(A.store.status.error));
});
t('استيراد ملف تالف', () => {
  ok(!A.store.parseImport('not json', TODAY).ok);
  ok(!A.store.parseImport('{"app":"other"}', TODAY).ok);
  ok(!A.store.parseImport('{"app":"ifrs-study","schema":99,"data":{}}', TODAY).ok);
});
t('تصدير ← استيراد ← دمج بدون تكرار', () => {
  const s = freshState(TODAY); s.sessions.push({ id: 's1', start: 1, end: 2, activeMs: 60000, day: TODAY, complete: true });
  const p = A.store.parseImport(A.store.exportData(s), TODAY); ok(p.ok); eq(p.summary.sessions, 1);
  const m = A.store.merge(s, p.state); eq(m.sessions.length, 1); eq(m.tasks.length, s.tasks.length);
});
t('استيراد أسئلة: الصالح يدخل والغلط يتبلغ', () => {
  const p = A.store.parseImport(JSON.stringify({ questions: [{ id: 'x1', type: 'mcq', prompt: 'p', options: ['a', 'b'], correct: 1 }, { id: 'x2', type: 'mcq', prompt: 'p', options: ['a'], correct: 3 }] }), TODAY);
  ok(p.ok); eq(p.questions.length, 1); eq(p.errors.length, 1); eq(p.questions[0].origin, 'imported');
});

console.log('البطاقات (SM-2)');
t('جديدة ← جيدة: بعد يوم، ثم 6 أيام، ثم × EF', () => {
  let s = A.srs.review(null, 4, TODAY); eq(s.due, U.add(TODAY, 1));
  s = A.srs.review(s, 4, U.add(TODAY, 1)); eq(s.interval, 6);
  s = A.srs.review(s, 4, U.add(TODAY, 7)); eq(s.interval, Math.round(6 * s.ef));
});
t('نسيت: مستحقة النهارده وتزيد مرات النسيان', () => {
  let s = A.srs.review(A.srs.review(null, 4, TODAY), 0, U.add(TODAY, 1)); eq(s.due, U.add(TODAY, 1)); eq(s.lapses, 1); eq(s.reps, 0);
});
t('EF لا يقل عن 1.3', () => { let s = null; for (let i = 0; i < 10; i++) s = A.srs.review(s, 0, TODAY); eq(s.ef, 1.3); });
t('الطابور: المستحقة ثم الضعيفة ثم الجديدة', () => {
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const srs = { a: { last: '2026-10-01', due: '2026-12-01', lapses: 3, ef: 1.5 }, b: { last: '2026-10-01', due: '2026-10-20', lapses: 0, ef: 2.5 }, d: { last: '2026-10-01', due: '2026-12-01', lapses: 0, ef: 2.5 } };
  eq(A.srs.buildQueue(cards, srs, TODAY).slice(0, 3), ['b', 'a', 'c']);
  eq(A.srs.counts(cards, srs, TODAY).due, 1);
});
t('الخلط Fisher–Yates يحافظ على العناصر', () => { const a = U.shuffle([1, 2, 3, 4, 5]); eq(a.slice().sort(), [1, 2, 3, 4, 5]); });

console.log('الأسئلة والمؤشرات');
t('تصحيح اختيار من متعدد وحسابي (بفواصل وأرقام عربية)', () => {
  const q2 = A.content.QUESTIONS.find(q => q.id === 'q02');
  ok(A.study.grade(q2, '17,830').correct); ok(A.study.grade(q2, '١٧٨٣٣').correct); ok(!A.study.grade(q2, '17,700').correct);
  ok(A.study.grade(A.content.QUESTIONS[0], 1).correct);
});
t('التصحيح الذاتي حسب دليل التصحيح', () => {
  const q = A.content.QUESTIONS.find(x => x.id === 'q15');
  eq(A.study.selfGrade(q, [true, true, true, false, false]).score, 3);
});
t('الإتقان: أقل من 3 محاولات = بيانات غير كافية', () => {
  const s = A.store.defaultState(TODAY);
  s.attempts = [{ id: 'a', qid: 'q01', std: 'ifrs15', score: 2, max: 2, day: TODAY, start: 1 }];
  ok(!A.study.mastery(s, 'ifrs15', TODAY).enough);
  s.attempts.push({ id: 'b', qid: 'q05', std: 'ifrs15', score: 0, max: 3, day: TODAY, start: 2 }, { id: 'c', qid: 'q01', std: 'ifrs15', score: 2, max: 2, day: TODAY, start: 3 });
  eq(A.study.mastery(s, 'ifrs15', TODAY).pct, 57);
});
t('عبور منتصف الليل: جلسات اليوم حسب يومها', () => {
  const s = A.store.defaultState(TODAY);
  s.sessions = [{ id: 'x', day: '2026-10-27', activeMs: 20 * 60000, complete: true }, { id: 'y', day: '2026-10-28', activeMs: 10 * 60000, complete: true }];
  eq(A.study.todayStats(s, '2026-10-28'), { sessions: 1, minutes: 10 });
});
t('الأسئلة الأصلية مُعلّمة كتدريبية وليست رسمية', () => { ok(A.content.QUESTIONS.every(q => q.origin === 'original')); });
t('كل أسئلة المحتوى صالحة', () => { A.content.QUESTIONS.forEach(q => { const r = A.store.normQuestion(q); ok(r.q, q.id + ' ' + r.error); }); });

console.log('\n' + pass + ' نجح، ' + fail + ' فشل');
process.exit(fail ? 1 : 0);
