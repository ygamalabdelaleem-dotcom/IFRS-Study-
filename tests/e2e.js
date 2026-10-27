/* اختبار المتصفح — تشغيل: node tests/e2e.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n     ' + (e.message || e).split('\n')[0]); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };

(async () => {
  const browser = await chromium.launch();
  const T0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-EG' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const clock = async () => page.textContent('#clock');
  const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('ifrsStudy.v2')));

  // ترحيل من النسخة الأولى
  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ifrs27', JSON.stringify({ exam: '2027-06-12', levels: { 'IFRS 16': 2 }, day: 'x', sessions: 1 })); });
  await page.reload();

  await t('الترحيل + الإعداد الأولي يظهر', async () => {
    ok(await page.isVisible('form[data-form="setupSave"]'), 'setup form');
    ok((await page.inputValue('input[name="examDate"]')) === '2027-06-12', 'exam date migrated');
    ok(await page.isVisible('text=لقينا بياناتك من النسخة الأولى'));
  });
  await t('عمل الخطة', async () => {
    await page.click('form[data-form="setupSave"] button[type="submit"]');
    await page.waitForSelector('#now');
    const s = await S();
    ok(s.settings.onboarded && s.tasks.length > 50, 'tasks ' + s.tasks.length);
    ok(s.coverage.ifrs16.practiced, 'coverage migrated');
    ok(s.tasks.every(x => !x.date || x.date < s.settings.examDate), 'before exam');
    ok(await page.evaluate(() => !!localStorage.getItem('ifrs27')), 'old key kept');
  });
  await t('المهمة الحالية ثابتة بعد التحديث', async () => {
    const a = await page.textContent('#now .task'); await page.reload(); await page.waitForSelector('#now');
    ok(a === await page.textContent('#now .task'));
  });
  await t('التايمر: بدء ← تحديث ← لسه شغال بالوقت الصح', async () => {
    await page.click('#now [data-act="startTask"]');
    await page.waitForTimeout(1200);
    await page.reload(); await page.waitForSelector('#clock');
    const c = await clock(); ok(/^19:5\d$/.test(c), c);
    const s = await S(); ok(s.timer.state === 'running');
  });
  await t('إيقاف مؤقت واستئناف', async () => {
    await page.click('[data-act="ttoggle"]'); const c1 = await clock();
    await page.waitForTimeout(1500); ok(c1 === await clock(), 'متوقف');
    await page.click('[data-act="ttoggle"]'); ok((await S()).timer.state === 'running');
  });
  await t('سكون الجهاز: الانتهاء أثناء الغياب يسجل جلسة واحدة بمدتها فقط', async () => {
    // نحاكي إن الوقت عدى: نرجّع endAt للماضي
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('ifrsStudy.v2')); s.timer.endAt = Date.now() - 3600e3; s.timer.segStart = s.timer.endAt - 60000; s.timer.activeMs = 19 * 60000; localStorage.setItem('ifrsStudy.v2', JSON.stringify(s)); });
    await page.reload(); await page.waitForSelector('#clock');
    let s = await S();
    ok(s.timer.state === 'finished' && s.sessions.length === 1, 'sessions ' + s.sessions.length);
    ok(Math.round(s.sessions[0].activeMs / 60000) === 20, 'activeMs ' + s.sessions[0].activeMs);
    await page.reload(); await page.waitForSelector('#clock');
    s = await S(); ok(s.sessions.length === 1, 'لا تكرار بعد تحديث تاني');
    ok(await clock() === '00:00');
  });
  await t('بعد الانتهاء: سؤال عن نتيجة المهمة (مش إكمال تلقائي)', async () => {
    ok(await page.isVisible('dialog[open] >> text=المهمة وصلت لفين'));
    const s = await S(); const t0 = s.tasks.find(x => x.id === s.timer.taskId); ok(t0.status !== 'done');
    await page.click('dialog[open] [data-o="partial"]');
    const s2 = await S(); ok(s2.tasks.find(x => x.id === s2.timer.taskId).status === 'partial'); ok(!s2.timer.awaitingOutcome);
  });
  await t('جلسة جديدة بعد الانتهاء تبدأ بالوقت الكامل', async () => {
    await page.click('[data-act="ttoggle"]'); await page.waitForTimeout(300);
    const c = await clock(); ok(/^(20:00|19:59)$/.test(c), c);
    await page.click('[data-act="treset"]');
  });
  await t('الاستراحة لا تُحسب جلسة', async () => {
    await page.click('[data-act="tlen"][data-break="1"]');
    await page.click('[data-act="ttoggle"]');
    await page.evaluate(() => { App.S.timer.endAt = Date.now() - 10; App.tick(); });
    const s = await S(); ok(s.sessions.length === 1, 'sessions ' + s.sessions.length); ok(s.timer.kind === 'break' && s.timer.state === 'finished');
    await page.click('#flash [data-act="hideFlash"]').catch(() => {});
  });
  await t('عبور منتصف الليل يحدّث الشاشة', async () => {
    await page.evaluate(() => { App.mem.day = '2000-01-01'; App.tick(); });
    ok(await page.isVisible('#now'));
  });
  await t('أكملت ← المهمة التالية تتقترح', async () => {
    const before = await page.textContent('#now .task');
    await page.click('#now [data-o="done"]');
    ok(before !== await page.textContent('#now .task'));
  });
  await t('البطاقات: تقييم ويُحفظ الموعد الجاي', async () => {
    await page.goto(URL + '#cards'); await page.click('[data-act="reveal"]'); await page.click('[data-act="rate"][data-g="4"]');
    const s = await S(); const k = Object.keys(s.cards.srs); ok(k.length === 1 && s.cards.srs[k[0]].due, 'srs');
    ok(s.cards.queue.idx === 1);
  });
  await t('سؤال حسابي غلط ← تسجيل خطأ ← إعادة محاولة صح ← اتحل', async () => {
    await page.goto(URL + '#questions');
    await page.click('[data-act="qStart"][data-id="q03"][data-mode="practice"]');
    await page.fill('input[name="ans"]', '70'); await page.click('button[type="submit"]');
    ok(await page.isVisible('text=مش صح'));
    await page.click('[data-act="mAdd"]'); await page.check('input[name="cause"][value="calc"]'); await page.fill('textarea[name="correction"]', 'RA = الأعلى');
    await page.check('input[name="mkCard"]'); await page.click('dialog[open] button[type="submit"]');
    let s = await S(); ok(s.mistakes.length === 1 && s.mistakes[0].cause === 'calc' && s.mistakes[0].cardId, 'mistake');
    await page.goto(URL + '#mistakes'); await page.click('[data-act="mRetry"]');
    await page.fill('input[name="ans"]', '50'); await page.click('button[type="submit"]');
    s = await S(); ok(s.mistakes[0].resolved && s.mistakes[0].retries.length === 1, 'resolved');
  });
  await t('سؤال كتابي بالتصحيح الذاتي', async () => {
    await page.goto(URL + '#questions'); await page.click('[data-act="qStart"][data-id="q15"][data-mode="timed"]');
    ok(await page.isVisible('#qclock'));
    await page.fill('textarea[name="ans"]', 'لا مخصص لأن ...'); await page.click('button[type="submit"]');
    await page.check('input[name="r0"]'); await page.check('input[name="r1"]'); await page.click('form[data-form="qSelfGrade"] button');
    const s = await S(); const a = s.attempts.find(x => x.qid === 'q15'); ok(a.score === 2, 'score ' + a.score);
  });
  await t('امتحان تجريبي: بناء ← إجابة ← تسليم تلقائي عند انتهاء الوقت', async () => {
    await page.goto(URL + '#mock'); await page.fill('input[name="count"]', '3'); await page.click('form[data-form="mockBuild"] button');
    await page.waitForSelector('#mclock');
    await page.evaluate(() => { App.S.activeMock.endAt = Date.now() - 1; App.tick(); });
    await page.waitForSelector('text=نتيجة الامتحان التجريبي');
    const s = await S(); ok(s.mocks.length === 1 && s.attempts.filter(a => a.mode === 'mock').length === 3);
  });
  await t('تغيير موعد الامتحان يحافظ على المنجز', async () => {
    await page.goto(URL + '#prefs');
    const before = await S(); const done = before.tasks.filter(x => x.status === 'done').map(x => x.id);
    await page.fill('input[name="examDate"]', '2027-02-01'); await page.click('form[data-form="prefsSave"] button[type="submit"]');
    const s = await S(); ok(done.every(id => s.tasks.find(x => x.id === id).status === 'done'), 'done kept');
    ok(s.tasks.filter(x => x.date && x.status !== 'done').every(x => x.date < '2027-02-01'), 'before exam');
  });
  await t('التقدم: "بيانات غير كافية" للمعايير قليلة المحاولات', async () => {
    await page.goto(URL + '#progress'); ok(await page.isVisible('text=بيانات غير كافية'));
  });
  await t('استيراد ملف تالف يظهر رسالة ولا يغيّر البيانات', async () => {
    const before = await S();
    await page.goto(URL + '#prefs'); await page.click('[data-act="importOpen"]');
    await page.fill('dialog textarea[name="text"]', '{not json'); await page.click('dialog button[type="submit"]');
    ok(await page.isVisible('#toast >> text=JSON'));
    const after = await S(); ok(after.tasks.length === before.tasks.length);
    await page.keyboard.press('Escape');
  });
  await t('تصدير ← استيراد بالدمج بدون تكرار', async () => {
    const txt = await page.evaluate(() => App.store.exportData(App.S));
    await page.click('[data-act="importOpen"]'); await page.$eval('dialog textarea[name="text"]', (el, v) => { el.value = v; }, txt); await page.click('dialog button[type="submit"]');
    await page.click('[data-act="importDo"][data-mode="merge"]');
    const s = await S(); ok(s.sessions.length === JSON.parse(txt).data.sessions.length, 'no dup');
  });
  await t('فشل التخزين يظهر للمستخدم', async () => {
    await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('q'); e.name = 'QuotaExceededError'; throw e; }; App.commit(null); Storage.prototype.setItem = o; });
    ok(await page.isVisible('text=المساحة المتاحة للتخزين خلصت'));
    await page.evaluate(() => App.commit(null));
  });
  await t('بدون تمرير أفقي على الموبايل في كل الأقسام', async () => {
    for (const h of ['today', 'plan', 'standards', 'std-ifrs16', 'cards', 'questions', 'mistakes', 'progress', 'prefs']) {
      await page.goto(URL + '#' + h); await page.waitForTimeout(80);
      const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(w <= 0, h + ' overflow ' + w);
    }
  });
  await t('شريط التنقل لا يغطي آخر المحتوى', async () => {
    await page.goto(URL + '#prefs'); await page.evaluate(() => window.scrollTo(0, 1e6));
    const r = await page.evaluate(() => { const last = [...document.querySelectorAll('#view > *')].pop().getBoundingClientRect(); const bar = document.getElementById('tabbar').getBoundingClientRect(); return last.bottom <= bar.top + 1; });
    ok(r);
  });
  await t('لوحة المفاتيح: Space يشغّل/يوقف التايمر', async () => {
    await page.goto(URL + '#today'); await page.click('h1');
    await page.keyboard.press('Space'); ok((await S()).timer.state === 'running');
    await page.keyboard.press('Space'); ok((await S()).timer.state === 'paused');
  });
  await t('وضع التركيز يخفي غير المهمة والتايمر', async () => {
    await page.click('[data-act="focusMode"]');
    ok(!(await page.isVisible('#tabbar'))); ok(await page.isVisible('#now')); ok(await page.isVisible('#clock'));
    await page.click('[data-act="focusMode"]');
  });
  await t('التقويم يفتح', async () => {
    await page.goto(URL + '#plan'); await page.click('[data-act="planMode"][data-cal="1"]'); ok(await page.isVisible('.cal'));
  });
  await t('سطح المكتب: الشريط الجانبي', async () => {
    await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(URL + '#today');
    ok(await page.isVisible('#side')); ok(!(await page.isVisible('#tabbar')));
    await page.screenshot({ path: path.join(process.env.SHOT_DIR || '.', 'desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(URL + '#today');
    await page.screenshot({ path: path.join(process.env.SHOT_DIR || '.', 'mobile.png'), fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: path.join(process.env.SHOT_DIR || '.', 'mobile-dark.png') });
  });
  await t('لا أخطاء JavaScript', async () => { ok(!errors.length, errors.join(' | ')); });
  console.log('\n' + pass + ' نجح، ' + fail + ' فشل');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
