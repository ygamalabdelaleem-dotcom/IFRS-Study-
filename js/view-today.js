/* شاشة النهارده: المهمة الحالية + التايمر + المراجعات المستحقة */
(function (A) {
  'use strict';
  const U = A.util, esc = U.esc;

  function countdown(today) {
    const s = A.S.settings;
    if (!s.showCountdown) return '';
    const n = U.diff(today, s.examDate);
    return `<div class="stack" style="align-items:flex-start;gap:2px" data-hide-focus>
      <div class="count"><b class="num">${Math.max(0, n)}</b><span class="muted">يوم على الامتحان</span></div>
      <span class="small muted">${U.fmtDate(s.examDate, { day: 'numeric', month: 'long', year: 'numeric' })} ${s.examConfirmed ? '<span class="chip good">✓ مؤكد</span>' : '<a href="#prefs" class="chip warn">تاريخ غير مؤكد — أكّده</a>'}</span></div>`;
  }

  function statusBanner(st, today) {
    const s = A.S.settings;
    if (st === 'notStarted') return `<div class="alert info"><b>الخطة لسه مابدأتش.</b><span>البداية ${U.fmtDate(s.startDate, { day: 'numeric', month: 'long' })} (بعد ${U.diff(today, s.startDate)} يوم). تقدر تبدأ بدري بأي مهمة.</span><a class="btn btn-sm" href="#prefs">غيّر تاريخ البداية</a></div>`;
    if (st === 'examDay') return `<div class="alert good"><b>النهارده يوم الامتحان. بالتوفيق 🤍</b><span>متذاكرش حاجة جديدة. اقرأ ملخص أخطائك بس لو حابب.</span></div>`;
    if (st === 'examPassed') return `<div class="alert info"><b>موعد الامتحان عدّى.</b><span>لو هتدخل دورة جديدة، حدّث تاريخ الامتحان وهتتعمل خطة للمتبقي مع الحفاظ على المنجز.</span><a class="btn btn-sm" href="#prefs">حدّث الموعد</a></div>`;
    if (st === 'finished') return `<div class="alert good"><b>خلصت كل مهام الخطة 🎉</b><span>كمّل بالبطاقات المستحقة وإعادة محاولة الأخطاء لحد الامتحان.</span></div>`;
    return '';
  }

  A.timerPanel = function () {
    const S = A.S, t = S.timer, st = t ? t.state : 'idle';
    const isBreak = t && t.kind === 'break';
    const label = { idle: isBreak ? 'استراحة — جاهزة' : 'جاهز', running: isBreak ? 'استراحة شغالة' : 'شغال', paused: 'متوقف مؤقتًا', finished: isBreak ? 'الاستراحة خلصت' : 'الجلسة خلصت ✓' }[st];
    const curMin = t ? Math.round(t.plannedMs / 60000) : S.settings.sessionMin;
    const lens = [...new Set([10, 15, S.settings.sessionMin, 25, 45])].sort((a, b) => a - b);
    const linked = t && t.taskId ? A.task(t.taskId) : null;
    const ts = A.study.todayStats(S, U.today());
    const goal = S.settings.dailyGoal;
    return `<section id="timer" aria-labelledby="timer-h">
      <h2 id="timer-h">تايمر التركيز</h2>
      <div class="panel timer${st === 'finished' ? ' done' : ''}">
        <div class="ring" role="timer" aria-label="الوقت المتبقي">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--line)" stroke-width="8"/>
          <circle id="arc" cx="50" cy="50" r="44" fill="none" stroke="${isBreak ? 'var(--good)' : 'var(--accent)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="276.46" stroke-dashoffset="0"/></svg>
          <div class="t"><b id="clock">--:--</b><span id="tstate">${label}</span></div>
        </div>
        <div class="stack" style="min-width:0;gap:12px">
          <div class="row" role="group" aria-label="مدة الجلسة">
            ${lens.map(m => `<button type="button" class="chip" data-act="tlen" data-min="${m}" aria-pressed="${!isBreak && curMin === m}">${m} د</button>`).join('')}
            <button type="button" class="chip" data-act="tlen" data-min="${S.settings.breakMin}" data-break="1" aria-pressed="${!!isBreak}">استراحة ${S.settings.breakMin} د</button>
          </div>
          <div class="row">
            <button type="button" class="btn-main" data-act="ttoggle">${st === 'running' ? '⏸ إيقاف مؤقت' : st === 'paused' ? '▶ استئناف' : st === 'finished' ? '▶ جلسة جديدة' : '▶ ابدأ'}</button>
            ${st === 'running' || st === 'paused' ? '<button type="button" data-act="tcancel" title="يوقف الجلسة ويسجل الوقت الفعلي كجلسة غير مكتملة">⏹ إنهاء وتسجيل الوقت</button><button type="button" class="btn-ghost" data-act="treset" title="يرجع الوقت للبداية بدون تسجيل">↺ إعادة ضبط</button>' : ''}
            ${st === 'finished' && t.kind === 'focus' ? `<button type="button" data-act="tlen" data-min="${S.settings.breakMin}" data-break="1">☕ استراحة ${S.settings.breakMin} د</button>` : ''}
          </div>
          <p class="small muted">${isBreak ? 'الاستراحة مش بتتحسب جلسة مذاكرة.' : linked ? 'مرتبطة بـ: ' + esc(linked.title) : 'مش مرتبطة بمهمة — اختار مهمة من فوق.'}</p>
          <div class="stack" style="gap:4px">
            <div class="row between small"><span>جلسات النهارده: <b class="num">${ts.sessions}</b> من <span class="num">${goal}</span></span><span class="num muted">${U.fmtMin(ts.minutes)}</span></div>
            <div class="progress-line" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${ts.sessions}" aria-label="هدف الجلسات اليومي"><i style="width:${Math.min(100, ts.sessions / goal * 100)}%"></i></div>
          </div>
        </div>
      </div></section>`;
  };
  A.act.ttoggle = () => A.timerAction('toggle');
  A.act.tcancel = () => A.timerAction('cancel');
  A.act.treset = () => A.timerAction('reset');
  A.act.tlen = el => A.setTimerLength(+el.dataset.min, !!el.dataset.break);

  function nowCard(t, today) {
    const S = A.S;
    if (!t) {
      const c = A.srs.counts(A.study.allCards(S, A.content), S.cards.srs, today);
      return `<div class="now" id="now"><div class="label">مهمة واحدة دلوقتي</div>
        <p class="task">${c.due ? 'راجع ' + c.due + ' بطاقة مستحقة' : 'مفيش مهام مفتوحة في الخطة'}</p>
        <div class="row">${c.due ? '<a class="btn btn-main" href="#cards">ابدأ المراجعة</a>' : ''}<a class="btn" href="#plan">افتح الخطة</a></div></div>`;
    }
    const link = t.link ? `<a href="${esc(t.link)}" target="_blank" rel="noopener">افتح الدرس ↗</a>` : '';
    const running = S.timer && S.timer.state === 'running' && S.timer.taskId === t.id;
    const hasQ = t.std && A.study.allQuestions(S, A.content).some(q => q.std === t.std);
    return `<div class="now" id="now" aria-live="polite"><div class="label">مهمة واحدة دلوقتي</div>
      <p class="task">${esc(t.title)}</p>
      <p class="meta">${A.taskMeta(t, today)} ${link}</p>
      ${t.status === 'partial' ? '<p class="meta">◐ بدأتها قبل كده ومحتاج تكملها.</p>' : ''}
      ${t.status === 'hard' ? '<p class="meta">! علّمتها صعبة. جرّب سؤال أو اكتب اللي مش واضح.</p>' : ''}
      <div class="row">
        ${running ? '<button type="button" class="btn-main" data-act="ttoggle">⏸ إيقاف مؤقت</button>' : `<button type="button" class="btn-main" data-act="startTask" data-id="${t.id}">▶ ابدأ ${S.settings.sessionMin} دقيقة</button>`}
        <button type="button" data-act="outcome" data-id="${t.id}" data-o="done">✓ أكملت</button>
        <button type="button" data-act="outcome" data-id="${t.id}" data-o="partial">◐ محتاج أكمل</button>
        <button type="button" data-act="outcome" data-id="${t.id}" data-o="hard">! صعبة</button>
        <button type="button" data-act="outcome" data-id="${t.id}" data-o="postpone">↷ أجّل</button>
      </div>
      <div class="row" data-hide-focus>
        <button type="button" class="btn-sm" data-act="otherTask">مهمة تانية</button>
        <button type="button" class="btn-sm" data-act="editTask" data-id="${t.id}">المصدر والتفاصيل</button>
        ${hasQ ? `<button type="button" class="btn-sm" data-act="quickQ" data-std="${t.std}">سؤال على ${esc(A.stdCode(t.std))}</button>` : ''}
      </div></div>`;
  }

  A.act.otherTask = () => {
    const today = U.today();
    const list = A.study.candidates(A.S, today);
    if (list.length < 2) { A.toast('مفيش مهمة تانية متاحة.'); return; }
    const i = list.findIndex(t => t.id === A.S.currentTaskId);
    const next = list[(i + 1) % Math.min(list.length, 6)];
    A.commit(S => { S.currentTaskId = next.id; });
  };

  A.views.today = {
    title: 'النهارده',
    render(arg, today) {
      const S = A.S, st = A.plan.status(S, today);
      const t = A.currentTask(today);
      const overdue = A.plan.overdue(S, today);
      const cc = A.srs.counts(A.study.allCards(S, A.content), S.cards.srs, today);
      const md = A.study.mistakesDue(S, today);
      const todays = S.tasks.filter(x => !x.archived && x.date === today);
      const focus = document.body.classList.contains('focus');
      const awaiting = S.timer && S.timer.awaitingOutcome && A.task(S.timer.taskId);
      return `<div class="head"><div><h1>النهارده</h1><p class="muted">${U.fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        ${countdown(today)}
        <button type="button" class="btn-sm" data-act="focusMode" aria-pressed="${focus}">${focus ? 'خروج من وضع التركيز' : '◎ وضع التركيز'}</button></div>
        <div data-hide-focus class="stack">${statusBanner(st, today)}
        ${overdue.length ? `<div class="alert warn"><b>عندك ${overdue.length} مهمة متأخرة.</b><span>مش هنضغطها عليك تلقائيًا. شوف اقتراح توزيع واقعي على الأيام الباقية واعتمده لو مناسب.</span><button type="button" class="btn-sm" data-act="proposeReschedule">اعرض اقتراح التوزيع</button></div>` : ''}
        ${awaiting ? `<div class="alert info"><b>آخر جلسة خلصت ولسه ماسجلتش نتيجتها.</b><button type="button" class="btn-sm" data-act="askOutcome">سجّل النتيجة</button></div>` : ''}</div>
        ${nowCard(t, today)}
        ${A.timerPanel()}
        <section data-hide-focus><h2>مراجعات مستحقة</h2>
          <div class="grid2">
            <div class="panel"><div class="row between"><span>بطاقات مستحقة</span><b class="num">${cc.due}</b></div><p class="small muted">${cc.overdue ? cc.overdue + ' متأخرة · ' : ''}${cc.weak} ضعيفة · ${cc.fresh} جديدة</p><a class="btn" href="#cards">راجع البطاقات</a></div>
            <div class="panel"><div class="row between"><span>أخطاء محتاجة إعادة محاولة</span><b class="num">${md.length}</b></div><p class="small muted">${S.mistakes.filter(m => !m.resolved).length} خطأ مفتوح إجمالًا</p><a class="btn" href="#mistakes">افتح سجل الأخطاء</a></div>
          </div></section>
        <section data-hide-focus><div class="row between"><h2>مهام النهارده</h2><a class="btn btn-sm" href="#plan">الخطة كاملة</a></div>
          ${todays.length ? '<div class="list">' + todays.map(x => `<div class="item${x.status === 'done' ? ' is-done' : ''}">${A.statusBadge(x, today)}<div class="main"><div class="title">${esc(x.title)}</div><div class="sub">${A.taskMeta(x, today)}</div></div>${A.plan.isOpen(x) ? `<button type="button" class="btn-sm" data-act="setCurrent" data-id="${x.id}">اختارها</button>` : ''}</div>`).join('') + '</div>' : '<p class="muted">مفيش مهام متجدولة النهارده' + (A.plan.capacity(S.settings, today) ? '.' : ' — يوم راحة 🌿') + '</p>'}
        </section>`;
    },
    after() { if (A.S.timer && A.S.timer.awaitingOutcome && !document.getElementById('dlg').open && !A.mem.askedOutcome) { A.mem.askedOutcome = true; A.askOutcome(); } }
  };
  A.act.askOutcome = () => A.askOutcome();
  A.act.setCurrent = el => A.commit(S => { S.currentTaskId = el.dataset.id; });
  A.act.quickQ = el => { A.mem.qFilter = { std: el.dataset.std }; A.startAttempt(A.pickQuestion(el.dataset.std), 'practice'); };
})(globalThis.App = globalThis.App || {});
