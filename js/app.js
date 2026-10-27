/* النواة: الحالة، الحفظ، التنقل، الحوارات، التايمر، والإجراءات المشتركة */
(function (A) {
  'use strict';
  const U = A.util, C = A.content;
  A.views = {}; A.act = {};
  A.mem = {}; // حالة مؤقتة للواجهة (لا تُحفظ)

  // ---------- الحالة والحفظ ----------
  A.commit = function (fn, opts) {
    opts = opts || {};
    if (fn) fn(A.S);
    A.store.save(A.S);
    if (opts.render !== false) A.render();
    else A.renderSave();
  };

  // ---------- مساعدات العرض ----------
  const esc = U.esc;
  A.h = { esc };
  A.std = id => C.STANDARDS.find(s => s.id === id) || null;
  A.stdCode = id => { const s = A.std(id); return s ? s.code : (id || 'عام'); };
  A.stdOptions = (sel, withAll) => (withAll ? '<option value="">كل المعايير</option>' : '<option value="">بدون معيار</option>') + A.qualStds().map(s => `<option value="${s.id}"${s.id === sel ? ' selected' : ''}>${esc(s.code)} — ${esc(s.ar)}</option>`).join('');
  A.qual = () => C.QUALIFICATIONS[A.S.settings.qualification] || C.QUALIFICATIONS.dipifr;
  A.qualStds = () => {
    const ids = new Set();
    A.plan.topicsFor(A.S.settings, C).forEach(t => t.stds.forEach(id => ids.add(id)));
    return C.STANDARDS.filter(s => ids.has(s.id));
  };
  A.STATUS = {
    todo: ['○', 'لسه'], doing: ['▶', 'جارية'], done: ['✓', 'مكتملة'], partial: ['◐', 'محتاج أكمل'], hard: ['!', 'واجهت صعوبة'], skipped: ['–', 'اتشالت']
  };
  A.TYPE = { learn: 'شرح', practice: 'تدريب', review: 'مراجعة', mock: 'امتحان تجريبي', final: 'مراجعة أخيرة', custom: 'مهمة' };
  A.statusBadge = (t, today) => {
    const s = A.STATUS[t.status] || A.STATUS.todo;
    const over = A.plan.isOpen(t) && t.date && t.date < today;
    return `<span class="st ${over ? 'over' : t.status}" title="${s[1]}${over ? ' — متأخرة' : ''}" aria-hidden="true">${over ? '⏰' : s[0]}</span><span class="sr">${s[1]}${over ? '، متأخرة' : ''}</span>`;
  };
  A.taskMeta = (t, today) => {
    const bits = [];
    if (t.std) bits.push(`<span class="ltr">${esc(A.stdCode(t.std))}</span>`);
    bits.push(A.TYPE[t.type] || 'مهمة');
    bits.push('<span class="num">' + U.fmtMin(t.estMin) + '</span>');
    if (t.date) {
      const d = U.diff(today, t.date);
      bits.push(d === 0 ? 'النهارده' : d === 1 ? 'بكرة' : d < 0 && A.plan.isOpen(t) ? `<b>متأخرة ${-d} يوم</b>` : U.fmtDate(t.date));
    } else if (t.dropped) bits.push('مقترح حذفها لضيق الوقت');
    else if (t.unplaced) bits.push('مش لاقية مكان في الخطة');
    const src = t.source || (A.S.stdSources[t.std] || [])[0] && (A.S.stdSources[t.std] || [])[0].text;
    if (src) bits.push('📖 ' + esc(src));
    if (t.ref) bits.push('🔖 ' + esc(t.ref));
    return bits.join(' · ');
  };
  A.icon = name => ({
    today: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
    plan: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    standards: '<svg viewBox="0 0 24 24"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 9h8M8 13h6"/></svg>',
    cards: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="14" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v11"/></svg>',
    questions: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5"/></svg>',
    mistakes: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>',
    progress: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    prefs: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>'
  }[name] || '');

  // ---------- التنقل ----------
  const NAV = [['today', 'النهارده'], ['plan', 'الخطة'], ['standards', 'المعايير'], ['cards', 'البطاقات'], ['questions', 'الأسئلة'], ['mistakes', 'الأخطاء'], ['progress', 'التقدم'], ['prefs', 'الإعدادات']];
  const TAB = ['today', 'plan', 'cards', 'questions'];
  const PARENT = { std: 'standards', attempt: 'questions', mock: 'questions', setup: 'prefs' };
  A.route = { view: 'today', arg: null };
  function parseHash() {
    const h = (location.hash || '').replace(/^#/, '');
    const m = h.match(/^std-([a-z0-9]+)$/);
    if (m) return { view: 'std', arg: m[1] };
    return { view: A.views[h] ? h : 'today', arg: null };
  }
  A.go = function (hash) { if (location.hash === '#' + hash) A.render(); else location.hash = hash; };

  function renderNav() {
    const cur = PARENT[A.route.view] || A.route.view;
    document.getElementById('side').innerHTML = `<div class="brand">منظّم مذاكرة <span class="ltr">IFRS</span><small>${esc(A.qual().name)}</small></div>` +
      NAV.map(([id, label]) => `<a href="#${id}"${cur === id ? ' aria-current="page"' : ''}>${A.icon(id)}${label}</a>`).join('') +
      `<div class="savestate" id="savestate"></div>`;
    const more = !TAB.includes(cur);
    document.getElementById('tabbar').innerHTML = TAB.map(id => `<a href="#${id}"${cur === id ? ' aria-current="page"' : ''}>${A.icon(id)}${NAV.find(n => n[0] === id)[1]}</a>`).join('') +
      `<button type="button" data-act="moreMenu"${more ? ' aria-current="page"' : ''}>${A.icon('more')}المزيد</button>`;
  }
  A.act.moreMenu = () => A.dialog(`<div class="dlg"><h2 id="dlg-title">المزيد</h2><div class="stack">${NAV.filter(n => !TAB.includes(n[0])).map(([id, l]) => `<a class="btn" href="#${id}" data-act="closeDlg">${A.icon(id)} ${l}</a>`).join('')}</div><button type="button" data-act="closeDlg">إغلاق</button></div>`);

  A.renderSave = function () {
    const st = A.store.status, el = document.getElementById('savestate');
    const txt = !st.available ? '⚠ الحفظ غير متاح' : !st.ok ? '⚠ فشل الحفظ' : st.at ? '✓ اتحفظ ' + U.fmtTime(st.at) : 'محلي على الجهاز ده';
    if (el) el.textContent = txt;
    const tel = document.getElementById('savestate-top');
    if (tel) tel.textContent = txt;
  };

  A.render = function () {
    A.route = parseHash();
    const today = U.today();
    if (!A.S.settings.onboarded && A.route.view !== 'setup' && A.route.view !== 'prefs') { A.route = { view: 'setup', arg: null }; }
    renderNav();
    const v = A.views[A.route.view];
    const el = document.getElementById('view');
    let html = '';
    try { html = v.render(A.route.arg, today); }
    catch (e) { console.error(e); html = `<div class="alert bad"><b>حصل خطأ في عرض الصفحة.</b><span>${esc(e.message)}</span><a class="btn" href="#today">رجوع للنهارده</a></div>`; }
    el.innerHTML = globalBanners(today) + html + `<p class="note small" data-hide-focus><span id="savestate-top"></span> · البيانات محفوظة على الجهاز ده بس — صدّر نسخة احتياطية من الإعدادات.</p>`;
    A.renderSave();
    if (v.after) v.after(A.route.arg, today);
    A.updateTimerDom();
    document.title = (v.title ? v.title + ' · ' : '') + 'منظّم مذاكرة IFRS';
  };

  function globalBanners() {
    const st = A.store.status, out = [];
    if (!st.ok && st.error) out.push(`<div class="alert bad" role="alert"><b>⚠ ${esc(st.error)}</b><a class="btn btn-sm" href="#prefs">صدّر نسخة احتياطية</a></div>`);
    (A.S.meta.warnings || []).forEach((w, i) => out.push(`<div class="alert warn"><span>${esc(w)}</span><button class="btn-sm" type="button" data-act="dismissWarn" data-i="${i}">تمام</button></div>`));
    return out.join('');
  }
  A.act.dismissWarn = el => A.commit(S => { S.meta.warnings.splice(+el.dataset.i, 1); });

  // ---------- حوار ورسائل ----------
  const dlg = () => document.getElementById('dlg');
  A.dialog = function (html, onSubmit) {
    const d = dlg();
    d.innerHTML = html;
    A.mem.dlgSubmit = onSubmit || null;
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } }
    const f = d.querySelector('input,select,textarea,button');
    if (f) f.focus();
  };
  A.closeDialog = () => { const d = dlg(); if (d.open) d.close(); d.innerHTML = ''; };
  A.act.closeDlg = () => A.closeDialog();
  A.toast = function (msg) {
    const t = document.getElementById('toast');
    t.innerHTML = `<div>${esc(msg)}</div>`;
    clearTimeout(A.mem.toastT); A.mem.toastT = setTimeout(() => { t.innerHTML = ''; }, 4200);
  };
  A.confirmInPage = function (title, body, okLabel, fn, danger) {
    A.dialog(`<div class="dlg"><h2 id="dlg-title">${esc(title)}</h2><p>${body}</p><div class="row"><button type="button" class="${danger ? 'btn-danger' : 'btn-main'}" data-act="dlgOk">${esc(okLabel)}</button><button type="button" data-act="closeDlg">إلغاء</button></div></div>`);
    A.mem.dlgOk = fn;
  };
  A.act.dlgOk = () => { const fn = A.mem.dlgOk; A.closeDialog(); if (fn) fn(); };

  // ---------- المهام ----------
  A.task = id => A.S.tasks.find(t => t.id === id) || null;
  A.currentTask = function (today) {
    let t = A.task(A.S.currentTaskId);
    if (!t || !A.plan.isOpen(t) || t.dropped) {
      t = A.study.suggestNext(A.S, today);
      A.S.currentTaskId = t ? t.id : null;
      A.store.save(A.S);
    }
    return t;
  };
  A.pickNext = function (today) { const t = A.study.suggestNext(A.S, today); A.S.currentTaskId = t ? t.id : null; };

  A.setOutcome = function (id, outcome, today) {
    const t = A.task(id); if (!t) return;
    t.updatedAt = Date.now();
    if (outcome === 'done') { t.status = 'done'; t.doneAt = Date.now(); }
    else if (outcome === 'partial') t.status = 'partial';
    else if (outcome === 'hard') t.status = 'hard';
    else if (outcome === 'postpone') {
      const nd = A.plan.nextStudyDay(A.S.settings, U.max(today, t.date || today));
      if (nd) { t.date = nd; t.pinned = true; } else A.toast('مفيش يوم مذاكرة متاح قبل الامتحان للتأجيل.');
      if (t.status === 'doing') t.status = 'todo';
    }
    if ((outcome === 'done' || outcome === 'postpone') && A.S.currentTaskId === id) A.pickNext(today);
  };
  A.act.outcome = el => {
    const today = U.today(), id = el.dataset.id, o = el.dataset.o;
    A.commit(S => {
      A.setOutcome(id, o, today);
      if (S.timer && S.timer.awaitingOutcome && S.timer.taskId === id) {
        S.timer.awaitingOutcome = false;
        const ses = S.sessions.find(s => s.id === S.timer.sessionId); if (ses) ses.outcome = o;
      }
    });
    A.closeDialog();
    const msg = { done: 'برافو ✓ المهمة اتسجلت مكتملة.', partial: 'تمام، المهمة هتفضل معاك لحد ما تكملها.', hard: 'اتسجلت كصعبة. جرّب سؤال عليها أو سجّل اللي مش واضح في الأخطاء.', postpone: 'اتأجلت لأقرب يوم مذاكرة.' }[o];
    if (msg) A.toast(msg);
  };
  A.act.startTask = el => {
    const id = el.dataset.id, t = A.task(id), now = Date.now();
    if (A.S.timer && A.S.timer.state === 'running') { A.toast('فيه جلسة شغالة بالفعل. وقّفها الأول.'); return; }
    unlockAudio();
    A.commit(S => {
      S.currentTaskId = id;
      if (t && t.status === 'todo') t.status = 'doing';
      S.timer = A.timer.start(A.timer.create('focus', S.settings.sessionMin, id, t ? t.std : ''), now);
    }, { render: false });
    A.go('today'); A.render(); A.armTimer();
  };

  // ---------- التايمر ----------
  let audioCtx = null;
  function unlockAudio() { try { if (!audioCtx && A.S.settings.sound) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; } }
  A.unlockAudio = unlockAudio;
  function beep() {
    if (!A.S.settings.sound || !audioCtx) return;
    try { [0, .35, .7].forEach(off => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 660; g.gain.value = .15; o.connect(g); g.connect(audioCtx.destination); o.start(audioCtx.currentTime + off); o.stop(audioCtx.currentTime + off + .22); }); } catch (e) { /* */ }
  }
  function sysNotify(msg) {
    try { if (A.S.settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('منظّم مذاكرة IFRS', { body: msg }); } catch (e) { /* */ }
  }
  function flash(msg) {
    const f = document.getElementById('flash');
    f.innerHTML = `<div class="flashbar">⏰ ${esc(msg)} <button class="btn-sm" type="button" data-act="hideFlash" style="margin-inline-start:8px">تمام</button></div>`;
    if (document.hidden) { A.mem.titleBak = document.title; document.title = '⏰ ' + msg; }
  }
  A.act.hideFlash = () => { document.getElementById('flash').innerHTML = ''; };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.mem.titleBak) { document.title = A.mem.titleBak; A.mem.titleBak = null; } });

  function recordSession(t, activeMs, complete) {
    const ses = { id: U.uid('s'), taskId: t.taskId, std: t.std, start: t.startedAt, end: complete ? t.finishedAt : Date.now(), activeMs, plannedMin: Math.round(t.plannedMs / 60000), day: U.today(t.startedAt), complete, outcome: null };
    A.S.sessions.push(ses);
    const task = A.task(t.taskId); if (task) { task.minutesSpent += activeMs / 60000; task.updatedAt = Date.now(); }
    return ses;
  }

  function onFinished() {
    const t = A.S.timer;
    if (t.kind === 'focus' && !t.counted) {
      const ses = recordSession(t, t.activeMs, true);
      t.counted = true; t.sessionId = ses.id; t.awaitingOutcome = !!t.taskId;
    } else t.counted = true;
    A.store.save(A.S);
    beep();
    const msg = t.kind === 'focus' ? 'الجلسة خلصت — سجّل نتيجة المهمة' : 'الاستراحة خلصت';
    flash(msg); sysNotify(msg);
    A.render();
    if (t.kind === 'focus' && t.awaitingOutcome && A.route.view === 'today') A.askOutcome();
  }

  A.askOutcome = function () {
    const t = A.S.timer; if (!t || !t.awaitingOutcome) return;
    const task = A.task(t.taskId); if (!task) { t.awaitingOutcome = false; A.store.save(A.S); return; }
    A.dialog(`<div class="dlg"><h2 id="dlg-title">الجلسة خلصت. المهمة وصلت لفين؟</h2>
      <p><b>${esc(task.title)}</b></p><p class="note">انتهاء التايمر مش معناه إن المهمة خلصت. اختار اللي حصل فعلًا.</p>
      <div class="grid2">
        <button type="button" class="btn-main" data-act="outcome" data-id="${task.id}" data-o="done">✓ أكملت المهمة</button>
        <button type="button" data-act="outcome" data-id="${task.id}" data-o="partial">◐ محتاج أكمل</button>
        <button type="button" data-act="outcome" data-id="${task.id}" data-o="hard">! واجهت صعوبة</button>
        <button type="button" data-act="outcome" data-id="${task.id}" data-o="postpone">↷ أجّل</button>
      </div><button type="button" data-act="closeDlg">بعدين</button></div>`);
  };

  A.timerAction = function (kind) {
    const now = Date.now(), S = A.S;
    let t = S.timer;
    if (kind === 'toggle') {
      unlockAudio();
      if (!t) t = A.timer.create('focus', S.settings.sessionMin, S.currentTaskId, (A.task(S.currentTaskId) || {}).std);
      if (t.state === 'finished' && t.awaitingOutcome) { A.askOutcome(); return; }
      if (t.state === 'running') t = A.timer.pause(t, now);
      else {
        if (t.state === 'idle' || t.state === 'finished') { t = Object.assign({}, t, { taskId: t.kind === 'focus' ? S.currentTaskId : null, std: t.kind === 'focus' ? (A.task(S.currentTaskId) || {}).std || '' : '' }); const ct = A.task(S.currentTaskId); if (t.kind === 'focus' && ct && ct.status === 'todo') ct.status = 'doing'; }
        t = A.timer.start(t, now);
      }
    } else if (kind === 'cancel') {
      if (!t) return;
      const r = A.timer.cancel(t, now);
      if (t.kind === 'focus' && r.activeMs >= 60000) { recordSession(t, r.activeMs, false); A.toast('اتسجل ' + U.fmtMin(r.activeMs / 60000) + ' كوقت مذاكرة فعلي (جلسة غير مكتملة).'); }
      t = r.t;
    } else if (kind === 'reset') {
      if (!t) return;
      t = A.timer.reset(t);
    }
    S.timer = t;
    A.commit(null);
    A.armTimer();
  };
  A.setTimerLength = function (min, isBreak) {
    const S = A.S;
    if (S.timer && (S.timer.state === 'running' || S.timer.state === 'paused')) { A.toast('وقّف الجلسة الحالية أو ألغِها الأول.'); return; }
    if (S.timer && S.timer.awaitingOutcome) { A.askOutcome(); return; }
    S.timer = A.timer.create(isBreak ? 'break' : 'focus', min, isBreak ? null : S.currentTaskId, isBreak ? '' : (A.task(S.currentTaskId) || {}).std);
    A.commit(null);
  };

  A.armTimer = function () {
    clearTimeout(A.mem.endT);
    const t = A.S.timer;
    if (t && t.state === 'running') A.mem.endT = setTimeout(A.tick, Math.max(0, t.endAt - Date.now()) + 30);
  };

  A.updateTimerDom = function () {
    const t = A.S.timer, now = Date.now();
    const clock = document.getElementById('clock'); if (!clock) return;
    const planned = t ? t.plannedMs : A.S.settings.sessionMin * 60000;
    const rem = t ? A.timer.remaining(t, now) : planned;
    clock.textContent = U.clock(rem);
    const arc = document.getElementById('arc'); if (arc) arc.setAttribute('stroke-dashoffset', String(276.46 * (1 - rem / planned)));
  };

  A.tick = function () {
    const now = Date.now(), t = A.S.timer;
    if (t && t.state === 'running') {
      const r = A.timer.check(t, now);
      if (r.finished) { A.S.timer = r.t; onFinished(); }
    }
    A.updateTimerDom();
    // عبور منتصف الليل: التاريخ والإحصاءات تتحدث
    const d = U.today();
    if (d !== A.mem.day) { A.mem.day = d; if (A.mem.booted) A.render(); }
    if (A.views.mockTick) A.views.mockTick(now);
  };

  // ---------- ربط الأحداث ----------
  function bind() {
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const fn = A.act[b.dataset.act];
      if (fn) { if (b.tagName !== 'A') e.preventDefault(); fn(b, e); }
    });
    document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && A.act[el.dataset.change]) A.act[el.dataset.change](el, e); });
    document.addEventListener('input', e => { const el = e.target.closest('[data-input]'); if (el && A.act[el.dataset.input]) A.act[el.dataset.input](el, e); });
    document.addEventListener('submit', e => {
      const f = e.target;
      if (f.closest('dialog') && A.mem.dlgSubmit) { e.preventDefault(); const fn = A.mem.dlgSubmit; fn(f, e.submitter); return; }
      if (f.dataset.form && A.act[f.dataset.form]) { e.preventDefault(); A.act[f.dataset.form](f, e); }
    });
    dlg().addEventListener('close', () => { A.mem.dlgSubmit = null; });
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button', 'a'].includes(tag) || dlg().open) return;
      if (e.code === 'Space' && document.getElementById('clock')) { e.preventDefault(); A.timerAction('toggle'); }
      if (e.key === 'Escape' && document.body.classList.contains('focus')) A.act.focusMode();
    });
    window.addEventListener('hashchange', () => { A.render(); const m = document.getElementById('main'); if (m) { m.focus({ preventScroll: true }); window.scrollTo(0, 0); } });
    document.addEventListener('visibilitychange', A.tick);
    window.addEventListener('focus', A.tick);
    window.addEventListener('pageshow', A.tick);
    window.addEventListener('storage', e => { if (e.key === A.store.KEY) A.toast('البيانات اتغيرت في تبويب تاني. حدّث الصفحة عشان متضيعش تعديلات.'); });
  }

  A.act.focusMode = () => { document.body.classList.toggle('focus'); A.render(); };

  A.boot = function () {
    const today = U.today();
    A.mem.day = today;
    const r = A.store.load(today);
    A.S = r.state;
    if (r.migrated) A.S.meta.warnings.push('اتنقلت بياناتك من النسخة الأولى (تاريخ الامتحان والتقدم في المعايير). البيانات القديمة لسه محفوظة زي ما هي.');
    // استعادة التايمر بعد التحديث: لو الوقت خلص والصفحة مقفولة، نقفل الجلسة مرة واحدة
    if (A.S.timer && A.S.timer.state === 'running') {
      const c = A.timer.check(A.S.timer, Date.now());
      if (c.finished) { A.S.timer = c.t; onFinishedSilent(); }
    }
    A.store.onStatus(A.renderSave);
    bind();
    if (r.fresh && r.migrated) A.store.save(A.S);
    A.render();
    A.mem.booted = true;
    A.armTimer();
    setInterval(A.tick, 500);
  };
  function onFinishedSilent() {
    const t = A.S.timer;
    if (t.kind === 'focus' && !t.counted) { const ses = recordSession(t, t.activeMs, true); t.counted = true; t.sessionId = ses.id; t.awaitingOutcome = !!t.taskId; }
    t.counted = true;
    A.store.save(A.S);
  }

  // جدولة بعد تغيير الإعدادات
  A.reschedule = function () {
    const today = U.today();
    const r = A.plan.schedule(A.S.tasks, A.S.settings, today);
    A.plan.applySchedule(A.S, r);
    return r;
  };
})(globalThis.App = globalThis.App || {});
