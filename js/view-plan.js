/* الخطة: قائمة بالأسابيع + تقويم اختياري + نقل وتأجيل وتعديل + إعادة توزيع بمعاينة */
(function (A) {
  'use strict';
  const U = A.util, esc = U.esc;
  const DOW = ['أحد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت'];

  function taskRow(t, today) {
    const cls = t.status === 'done' ? ' is-done' : t.date === today ? ' is-today' : '';
    return `<div class="item${cls}">${A.statusBadge(t, today)}
      <div class="main"><div class="title">${esc(t.title)}</div><div class="sub">${A.taskMeta(t, today)}${t.pinned ? ' · 📌 متثبتة' : ''}</div></div>
      <div class="row">${A.plan.isOpen(t) ? `<button type="button" class="btn-sm" data-act="startTask" data-id="${t.id}" aria-label="ابدأ: ${esc(t.title)}">▶</button>` : ''}
      <button type="button" class="btn-sm" data-act="editTask" data-id="${t.id}" aria-label="تعديل: ${esc(t.title)}">تعديل</button></div></div>`;
  }

  function summary(today) {
    const S = A.S, s = S.settings, w = A.plan.windows(s, today), p = A.study.planProgress(S);
    if (!w.valid) return `<div class="alert info">${w.reason === 'examPassed' ? 'موعد الامتحان عدّى — حدّث الموعد من الإعدادات.' : 'مفيش أيام متاحة قبل الامتحان.'}</div>`;
    const capMin = d => A.plan.capacity(s, d);
    const days = w.main.concat(w.buffer).filter(d => capMin(d) > 0).length;
    return `<div class="grid4">
      <div class="stat"><b>${p.done}/${p.total}</b><span>مهام مكتملة</span></div>
      <div class="stat"><b>${days}</b><span>يوم مذاكرة متبقي قبل المراجعة الأخيرة</span></div>
      <div class="stat"><b>${w.bufN}</b><span>يوم احتياطي (للتأخير)</span></div>
      <div class="stat"><b>${w.finalN}</b><span>يوم مراجعة أخيرة</span></div></div>`;
  }

  function warnings(today) {
    const S = A.S;
    const dropped = S.tasks.filter(t => t.dropped && A.plan.isOpen(t));
    const unplaced = S.tasks.filter(t => t.unplaced && A.plan.isOpen(t));
    const out = [];
    if (dropped.length || unplaced.length) {
      const need = dropped.concat(unplaced).reduce((a, t) => a + t.estMin, 0);
      out.push(`<div class="alert warn"><b>الوقت المتاح مش كفاية للخطة كاملة (ناقص حوالي ${U.fmtMin(need)}).</b>
        <span>رتّبنا الأولويات: الشرح الأساسي والمواضيع عالية الأولوية ثابتين، والمقترح حذفه هو التدريب الإضافي والمواضيع الأقل أولوية. الحلول: زوّد وقت المذاكرة، أو أجّل الامتحان، أو اعتمد الحذف.</span>
        <details><summary>المهام المقترح حذفها (${dropped.length + unplaced.length})</summary><div class="list">${dropped.concat(unplaced).map(t => `<div class="item">${A.statusBadge(t, today)}<div class="main"><div class="title">${esc(t.title)}</div><div class="sub">${A.taskMeta(t, today)}</div></div><div class="row"><button type="button" class="btn-sm" data-act="protectTask" data-id="${t.id}">رجّعها للخطة</button><button type="button" class="btn-sm" data-act="skipTask" data-id="${t.id}">شيلها</button></div></div>`).join('')}</div></details>
        <a class="btn btn-sm" href="#prefs">عدّل الوقت المتاح</a></div>`);
    }
    if (S.tasks.some(t => A.plan.isOpen(t) && t.date && A.plan.windows(S.settings, today).buffer.includes(t.date))) out.push('<div class="alert info small">بعض المهام دخلت في الأيام الاحتياطية. حاول متتأخرش عشان يفضل عندك هامش.</div>');
    return out.join('');
  }

  function listView(today) {
    const S = A.S, show = A.mem.planAll;
    const tasks = S.tasks.filter(t => !t.archived && t.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));
    const weeks = new Map();
    tasks.forEach(t => { const w = U.weekStart(t.date); if (!weeks.has(w)) weeks.set(w, []); weeks.get(w).push(t); });
    const cur = U.weekStart(today);
    const keys = [...weeks.keys()];
    const visible = show ? keys : keys.filter(k => (k >= U.add(cur, -7) && k <= U.add(cur, 21)) || weeks.get(k).some(t => A.plan.isOpen(t) && t.date < today));
    const hidden = keys.length - visible.length;
    if (!tasks.length) return '<p class="muted">مفيش مهام متجدولة.</p>';
    return visible.map(k => {
      const list = weeks.get(k); const n = Math.floor(U.diff(U.weekStart(S.settings.startDate), k) / 7) + 1;
      const min = list.reduce((a, t) => a + t.estMin, 0), done = list.filter(t => t.status === 'done').length;
      return `<div class="list"><div class="week-h"><span>${n > 0 ? 'أسبوع ' + n + ' · ' : ''}${U.fmtDate(k, { day: 'numeric', month: 'short' })} – ${U.fmtDate(U.add(k, 6), { day: 'numeric', month: 'short' })}${k === cur ? ' · الأسبوع ده' : ''}</span><span class="num">${done}/${list.length} · ${U.fmtMin(min)}</span></div>${list.map(t => taskRow(t, today)).join('')}</div>`;
    }).join('') + (hidden || show ? `<button type="button" data-act="planAll">${show ? 'اعرض الأسابيع القريبة بس' : 'اعرض كل الأسابيع (' + hidden + ' كمان)'}</button>` : '');
  }

  function calView(today) {
    const S = A.S, s = S.settings;
    const m = A.mem.calMonth || today.slice(0, 7);
    const first = m + '-01';
    const startDow = U.dow(first); // الأسبوع يبدأ السبت
    const lead = (startDow + 1) % 7;
    const days = []; for (let d = first; d.slice(0, 7) === m; d = U.add(d, 1)) days.push(d);
    const by = {}; S.tasks.forEach(t => { if (!t.archived && t.date) (by[t.date] = by[t.date] || []).push(t); });
    const sel = A.mem.calSel;
    const order = [6, 0, 1, 2, 3, 4, 5];
    const prev = U.add(first, -1).slice(0, 7), next = U.add(first, 32).slice(0, 7);
    const cells = Array(lead).fill('<div class="empty"></div>').concat(days.map(d => {
      const l = by[d] || [], cap = A.plan.capacity(s, d), exam = d === s.examDate;
      const cls = [cap ? '' : 'rest', exam ? 'exam' : '', d === today ? 'today' : '', d === sel ? 'sel' : ''].join(' ');
      return `<button type="button" class="${cls}" data-act="calDay" data-d="${d}" aria-label="${U.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${exam ? 'يوم الامتحان' : l.length + ' مهام'}${cap ? '' : '، يوم راحة'}"><span class="d num">${+d.slice(8)}</span><span class="num">${exam ? 'امتحان' : l.length ? l.length + ' م' : cap ? '' : 'راحة'}</span></button>`;
    }));
    return `<div class="panel"><div class="row between"><button type="button" class="btn-sm" data-act="calNav" data-m="${prev}">→ الشهر اللي فات</button><b>${U.fmtDate(first, { month: 'long', year: 'numeric' })}</b><button type="button" class="btn-sm" data-act="calNav" data-m="${next}">الشهر الجاي ←</button></div>
      <div class="cal">${order.map(i => `<div class="dh">${DOW[i]}</div>`).join('')}${cells.join('')}</div></div>
      ${sel ? `<section><h3>${U.fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'long' })} · متاح ${U.fmtMin(A.plan.capacity(s, sel))}</h3>${(by[sel] || []).length ? '<div class="list">' + by[sel].map(t => taskRow(t, today)).join('') + '</div>' : '<p class="muted">مفيش مهام.</p>'}
        <div class="row"><button type="button" class="btn-sm" data-act="toggleRest" data-d="${sel}">${s.restDates.includes(sel) ? 'شيل يوم الراحة' : 'اعتبره يوم راحة'}</button></div></section>` : ''}`;
  }

  A.views.plan = {
    title: 'الخطة',
    render(arg, today) {
      const S = A.S, cal = A.mem.planCal;
      const q = A.qual();
      return `<div class="head"><div><h1>الخطة</h1><p class="muted">${esc(q.name)} · الامتحان ${U.fmtDate(S.settings.examDate, { day: 'numeric', month: 'long', year: 'numeric' })}${S.settings.examConfirmed ? '' : ' (غير مؤكد)'}</p></div>
        <div class="row" role="group" aria-label="طريقة العرض"><button type="button" class="chip" data-act="planMode" data-cal="0" aria-pressed="${!cal}">قائمة</button><button type="button" class="chip" data-act="planMode" data-cal="1" aria-pressed="${!!cal}">تقويم</button></div></div>
        ${summary(today)}
        ${warnings(today)}
        <div class="row"><button type="button" data-act="proposeReschedule">↻ أعد توزيع المتبقي (معاينة)</button><button type="button" data-act="editTask" data-id="">+ أضف مهمة</button></div>
        <p class="note">الخطة بتتوزع حسب وقتك المتاح لكل يوم، وبتخلص قبل الامتحان بأيام احتياطي ومراجعة أخيرة. المهام المكتملة والمنقولة يدويًا (📌) مش بتتحرك عند إعادة التوزيع.</p>
        ${cal ? calView(today) : listView(today)}`;
    }
  };
  A.act.planMode = el => { A.mem.planCal = el.dataset.cal === '1'; A.render(); };
  A.act.planAll = () => { A.mem.planAll = !A.mem.planAll; A.render(); };
  A.act.calNav = el => { A.mem.calMonth = el.dataset.m; A.mem.calSel = null; A.render(); };
  A.act.calDay = el => { A.mem.calSel = el.dataset.d; A.render(); };
  A.act.toggleRest = el => {
    const d = el.dataset.d;
    A.commit(S => { const i = S.settings.restDates.indexOf(d); if (i >= 0) S.settings.restDates.splice(i, 1); else S.settings.restDates.push(d); }, { render: false });
    A.act.proposeReschedule();
  };
  A.act.protectTask = el => A.commit(S => { const t = A.task(el.dataset.id); t.protect = true; t.dropped = false; t.dropRank = 0; A.reschedule(); });
  A.act.skipTask = el => A.commit(S => { const t = A.task(el.dataset.id); t.status = 'skipped'; t.dropped = false; t.unplaced = false; t.date = null; });

  // إعادة التوزيع: معاينة قبل الاعتماد
  A.act.proposeReschedule = () => {
    const today = U.today(), S = A.S;
    const r = A.plan.schedule(S.tasks, S.settings, today);
    if (!r.valid) { A.toast('مفيش أيام متاحة قبل الامتحان.'); return; }
    const d = A.plan.diffSchedule(S, r);
    const cap = Math.max.apply(null, S.settings.dayMinutes);
    A.mem.pendingSchedule = r;
    A.dialog(`<div class="dlg"><h2 id="dlg-title">اقتراح إعادة التوزيع</h2>
      <ul>
        <li>هيتنقل <b class="num">${d.moved}</b> مهمة لتواريخ جديدة (من النهارده لحد ${U.fmtDate(r.w.lastPrep, { day: 'numeric', month: 'long' })}).</li>
        <li>متوسط الحمل اليومي <b class="num">${U.fmtMin(d.avgLoad)}</b>، وأقصى يوم <b class="num">${U.fmtMin(d.maxLoad)}</b> (أقصى وقت متاح عندك ${U.fmtMin(cap)}).</li>
        ${r.usesBuffer ? '<li>هيستخدم جزء من الأيام الاحتياطية.</li>' : ''}
        ${r.dropped.length + r.unplaced.length ? `<li><b>الوقت مش كفاية:</b> مقترح حذف ${r.dropped.length + r.unplaced.length} مهمة أقل أولوية (عجز تقريبي ${U.fmtMin(r.deficitMin)}). تقدر ترجّع أي واحدة بعدين.</li>` : '<li>كل المهام المتبقية لاقية مكان ✓</li>'}
      </ul>
      <p class="note">المكتمل والمثبت يدويًا مش هيتغير. مفيش أي يوم هيتحمّل أكتر من وقتك المتاح.</p>
      <div class="row"><button type="button" class="btn-main" data-act="applyReschedule">اعتمد التوزيع</button><button type="button" data-act="closeDlg">سيبها زي ما هي</button></div></div>`);
  };
  A.act.applyReschedule = () => {
    const r = A.mem.pendingSchedule; if (!r) return;
    A.closeDialog();
    A.commit(S => { A.plan.applySchedule(S, r); A.pickNext(U.today()); });
    A.toast('اتوزعت المهام المتبقية.');
  };

  // تعديل/إضافة مهمة
  A.act.editTask = el => {
    const id = el.dataset.id, t = id ? A.task(id) : null, S = A.S, today = U.today();
    const st = t ? t.status : 'todo';
    A.dialog(`<form><h2 id="dlg-title">${t ? 'تعديل المهمة' : 'مهمة جديدة'}</h2>
      <label>العنوان<input name="title" required value="${esc(t ? t.title : '')}" ${t && t.origin === 'plan' ? 'readonly aria-describedby="ro-note"' : ''}></label>
      ${t && t.origin === 'plan' ? '<p class="note" id="ro-note">عنوان مهام الخطة ثابت عشان يتعرف عليها عند إعادة التوليد.</p>' : ''}
      <div class="grid2"><label>المعيار<select name="std">${A.stdOptions(t ? t.std : '')}</select></label>
      <label>المدة التقديرية (دقيقة)<input name="estMin" type="number" min="5" max="600" step="5" value="${t ? t.estMin : S.settings.sessionMin}" required></label></div>
      <div class="grid2"><label>التاريخ<input name="date" type="date" value="${t && t.date ? t.date : today}" min="${today}" max="${U.add(S.settings.examDate, -1)}"></label>
      <label>الحالة<select name="status">${Object.entries(A.STATUS).map(([k, v]) => `<option value="${k}"${k === st ? ' selected' : ''}>${v[0]} ${v[1]}</option>`).join('')}</select></label></div>
      <label>المصدر (كتاب/كورس + الفصل)<input name="source" value="${esc(t ? t.source : '')}" placeholder="مثال: Study Text — الفصل 7"></label>
      <div class="grid2"><label>رقم السؤال أو الصفحة<input name="ref" value="${esc(t ? t.ref : '')}" placeholder="مثال: Kit س 12 / ص 140"></label>
      <label>رابط الدرس<input name="link" type="url" value="${esc(t ? t.link : '')}" placeholder="https://" class="ltr"></label></div>
      <label>ملاحظة<textarea name="note">${esc(t ? t.note : '')}</textarea></label>
      <label class="inline"><input type="checkbox" name="pinned" ${!t || t.pinned ? 'checked' : ''}> ثبّت التاريخ (ما يتحركش عند إعادة التوزيع)</label>
      <div class="row"><button class="btn-main" type="submit">حفظ</button>${t ? `<button type="button" data-act="outcome" data-id="${t.id}" data-o="postpone">↷ أجّل لأقرب يوم</button>` : ''}${t && t.origin !== 'plan' ? `<button type="button" class="btn-danger" data-act="delTask" data-id="${t.id}">حذف</button>` : ''}<button type="button" data-act="closeDlg">إلغاء</button></div></form>`,
    f => {
      const v = Object.fromEntries(new FormData(f));
      const date = U.isDate(v.date) ? v.date : null;
      if (date && date >= S.settings.examDate) { A.toast('التاريخ لازم يكون قبل الامتحان.'); return; }
      A.closeDialog();
      A.commit(S2 => {
        let x = t;
        if (!x) { x = { id: U.uid('t'), key: null, origin: 'user', type: 'custom', phase: 'main', priority: 2, dropRank: 0, order: 1e6 + S2.tasks.length, minutesSpent: 0, doneAt: null, dropped: false, unplaced: false, topicId: '' }; S2.tasks.push(x); }
        if (!t || t.origin !== 'plan') x.title = v.title.trim() || 'مهمة';
        x.std = v.std; x.estMin = Math.max(5, Math.min(600, +v.estMin || 30));
        const moved = !t || date !== t.date;
        x.date = date; x.pinned = !!v.pinned || (moved && !!date && !!t);
        if (x.status !== v.status) { x.status = v.status; if (v.status === 'done') x.doneAt = Date.now(); }
        x.source = v.source.trim(); x.ref = v.ref.trim(); x.link = /^https?:\/\//.test(v.link.trim()) ? v.link.trim() : ''; x.note = v.note;
        x.dropped = false; x.unplaced = !x.date; x.updatedAt = Date.now();
      });
      A.toast('اتحفظت المهمة.');
    });
  };
  A.act.delTask = el => { A.closeDialog(); A.confirmInPage('حذف المهمة؟', 'المهمة دي هتتشال من الخطة.', 'احذف', () => A.commit(S => { S.tasks = S.tasks.filter(t => t.id !== el.dataset.id); if (S.currentTaskId === el.dataset.id) S.currentTaskId = null; }), true); };
})(globalThis.App = globalThis.App || {});
