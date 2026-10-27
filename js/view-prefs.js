/* الإعداد الأولي + الإعدادات + النسخ الاحتياطي + معلومات المحتوى */
(function (A) {
  'use strict';
  const U = A.util, esc = U.esc, C = A.content;
  const DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

  function qualFields(s) {
    return `<fieldset><legend>المؤهل أو الامتحان</legend>
      ${Object.values(C.QUALIFICATIONS).map(q => `<label class="inline"><input type="radio" name="qualification" value="${q.id}" ${s.qualification === q.id ? 'checked' : ''} data-change="qualPick"> <span><b>${esc(q.name)}</b> <span class="muted small">— ${esc(q.nameAr)}${q.cycle !== '—' ? ' · ' + esc(q.cycle) : ''}</span></span></label>`).join('')}
      <div id="customStds" ${s.qualification === 'custom' ? '' : 'hidden'}><p class="small">اختار المعايير اللي هتذاكرها:</p><div class="grid4">${C.STANDARDS.map(x => `<label class="inline"><input type="checkbox" name="customStds" value="${x.id}" ${s.customStds.includes(x.id) ? 'checked' : ''}> <span class="ltr">${esc(x.code)}</span></label>`).join('')}</div></div>
      <p class="note">كل مؤهل له مواضيع وأوزان مختلفة. القوائم هنا تقديرية ولم يتم التحقق منها مقابل الـ Syllabus الرسمي — راجعها من المصادر تحت.</p></fieldset>`;
  }
  function dateFields(s, today) {
    return `<fieldset><legend>التواريخ</legend><div class="grid2">
      <label>تاريخ البداية<input type="date" name="startDate" value="${s.startDate}" required></label>
      <label>تاريخ الامتحان<input type="date" name="examDate" value="${s.examDate}" min="${U.add(today, 1)}" required></label></div>
      <label class="inline"><input type="checkbox" name="examConfirmed" ${s.examConfirmed ? 'checked' : ''}> أكدت الموعد من الجهة المنظمة (موقع ACCA / حجز الامتحان)</label>
      <p class="note">10 يونيو 2027 تاريخ افتراضي مش موعد رسمي. حط موعدك الفعلي.</p></fieldset>`;
  }
  function timeFields(s) {
    return `<fieldset><legend>الوقت المتاح (بالدقائق لكل يوم — 0 = راحة)</legend>
      <div class="days7">${DAYS.map((d, i) => `<label>${d}<input type="number" name="dm${i}" min="0" max="960" step="5" value="${s.dayMinutes[i]}"></label>`).join('')}</div></fieldset>`;
  }
  function sessionFields(s) {
    return `<fieldset><legend>الجلسات</legend><div class="grid4">
      <label>مدة الجلسة (دقيقة)<input type="number" name="sessionMin" min="5" max="120" value="${s.sessionMin}"></label>
      <label>الاستراحة (دقيقة)<input type="number" name="breakMin" min="1" max="60" value="${s.breakMin}"></label>
      <label>الهدف اليومي (جلسات)<input type="number" name="dailyGoal" min="1" max="20" value="${s.dailyGoal}"></label></div></fieldset>`;
  }

  A.act.qualPick = el => { const box = document.getElementById('customStds'); if (box) box.hidden = el.value !== 'custom'; };

  function readSettings(f, base) {
    const fd = new FormData(f), s = U.clone(base);
    if (fd.has('qualification')) s.qualification = fd.get('qualification');
    if (fd.has('qualification')) s.customStds = fd.getAll('customStds');
    ['startDate', 'examDate'].forEach(k => { if (fd.has(k) && U.isDate(fd.get(k))) s[k] = fd.get(k); });
    if (fd.has('dm0')) s.dayMinutes = [0, 1, 2, 3, 4, 5, 6].map(i => Math.max(0, Math.min(960, +fd.get('dm' + i) || 0)));
    [['sessionMin', 5, 120], ['breakMin', 1, 60], ['dailyGoal', 1, 20], ['bufferDays', 0, 60], ['finalDays', 0, 60]].forEach(([k, lo, hi]) => { if (fd.has(k)) s[k] = Math.max(lo, Math.min(hi, Math.round(+fd.get(k)) || base[k])); });
    if (fd.has('examDate')) s.examConfirmed = fd.has('examConfirmed');
    if (fd.has('theme')) { s.theme = fd.get('theme'); s.showCountdown = fd.has('showCountdown'); s.sound = fd.has('sound'); s.notify = fd.has('notify'); }
    return s;
  }
  function validate(s, today) {
    if (s.examDate <= today) return 'تاريخ الامتحان لازم يكون بعد النهارده.';
    if (s.startDate >= s.examDate) return 'تاريخ البداية لازم يكون قبل الامتحان.';
    if (!s.dayMinutes.some(m => m > 0)) return 'لازم يوم واحد على الأقل فيه وقت مذاكرة.';
    if (s.qualification === 'custom' && !s.customStds.length) return 'اختار معيار واحد على الأقل للخطة المخصصة.';
    return null;
  }

  // ---------- الإعداد الأولي ----------
  A.views.setup = {
    title: 'الإعداد',
    render(arg, today) {
      const s = A.S.settings, mig = A.S.meta.migratedFrom;
      return `<div class="head"><div><h1>أهلًا 👋 نجهّز خطتك في دقيقة</h1><p class="muted">كل حاجة هنا تتغير بعدين من الإعدادات.</p></div></div>
        ${mig ? '<div class="alert good">لقينا بياناتك من النسخة الأولى واتنقلت. راجع التاريخ تحت.</div>' : ''}
        <form data-form="setupSave" class="stack">${qualFields(s)}${dateFields(s, today)}${timeFields(s)}${sessionFields(s)}
          <button type="submit" class="btn-main">اعمل الخطة</button></form>`;
    }
  };
  A.act.setupSave = f => {
    const today = U.today(), s = readSettings(f, A.S.settings), err = validate(s, today);
    if (err) { A.toast(err); return; }
    s.onboarded = true;
    let r;
    A.commit(S => { S.settings = s; S.tasks = A.plan.sync(S, C).tasks; r = A.reschedule(); A.pickNext(today); }, { render: false });
    A.go('today');
    A.toast(r && (r.dropped.length || r.unplaced.length) ? 'الخطة اتعملت، بس الوقت مش كفاية لكل المهام — شوف التفاصيل في الخطة.' : 'الخطة اتعملت ✓');
  };

  // ---------- الإعدادات ----------
  A.views.prefs = {
    title: 'الإعدادات',
    render(arg, today) {
      const S = A.S, s = S.settings, st = A.store.status, q = A.qual();
      return `<div class="head"><div><h1>الإعدادات</h1></div></div>
        <form data-form="prefsSave" class="stack">
          ${qualFields(s)}${dateFields(s, today)}${timeFields(s)}
          <fieldset><legend>هوامش الخطة</legend><div class="grid2">
            <label>أيام احتياطية قبل المراجعة الأخيرة<input type="number" name="bufferDays" min="0" max="60" value="${s.bufferDays}"></label>
            <label>أيام المراجعة الأخيرة قبل الامتحان<input type="number" name="finalDays" min="0" max="60" value="${s.finalDays}"></label></div>
            <p class="note">أيام الراحة المحددة بالتاريخ: ${s.restDates.length ? s.restDates.map(d => `<button type="button" class="chip" data-act="unrest" data-d="${d}" aria-label="شيل ${d}">${U.fmtDate(d)} ✕</button>`).join(' ') : 'مفيش'} — تقدر تضيف من تقويم الخطة.</p></fieldset>
          ${sessionFields(s)}
          <fieldset><legend>الواجهة والتنبيهات</legend>
            <label>المظهر<select name="theme">${[['system', 'حسب النظام'], ['light', 'فاتح'], ['dark', 'داكن']].map(([k, v]) => `<option value="${k}"${s.theme === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="inline"><input type="checkbox" name="showCountdown" ${s.showCountdown ? 'checked' : ''}> اعرض العد التنازلي للامتحان</label>
            <label class="inline"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}> صوت عند انتهاء الجلسة (التنبيه المرئي شغال دايمًا)</label>
            <label class="inline"><input type="checkbox" name="notify" ${s.notify ? 'checked' : ''} data-change="notifyAsk"> إشعار من النظام لما الجلسة تخلص والصفحة في الخلفية</label>
            <p class="note">الإشعار بيوصل طول ما الصفحة مفتوحة (حتى لو في تبويب تاني). لو قفلت الصفحة أو المتصفح، مفيش تنبيه — ولما ترجع، الجلسة بتتقفل بالوقت الصح.${'Notification' in window ? ' حالة الإذن: ' + ({ granted: 'مسموح', denied: 'مرفوض من المتصفح', default: 'لسه ماتطلبش' }[Notification.permission] || '') : ' المتصفح ده مش بيدعم الإشعارات.'}</p></fieldset>
          <div class="row"><button type="submit" class="btn-main">احفظ الإعدادات</button></div>
          <p class="note">تغيير التواريخ أو الوقت أو المؤهل بيعيد توزيع المهام المتبقية تلقائيًا. المنجز مش بيتغير.</p></form>

        <section><h2>البيانات والنسخ الاحتياطي</h2><div class="panel">
          <p>${!st.available ? '⚠ التخزين غير متاح — البيانات هتضيع لما تقفل الصفحة.' : st.ok ? '✓ محفوظ على الجهاز ده' + (st.at ? ' — آخر حفظ ' + U.fmtTime(st.at) : '') : '⚠ ' + esc(st.error)}</p>
          <p class="note">البيانات بتتحفظ في متصفحك بس (localStorage، بنية بيانات إصدار ${A.store.SCHEMA}). مفيش حساب ولا مزامنة مع سيرفر. عشان تنقلها لجهاز تاني أو تحميها: صدّر نسخة احتياطية.</p>
          <div class="row"><button type="button" class="btn-main" data-act="exportFile">⬇ صدّر ملف</button><button type="button" data-act="exportText">انسخ كنص</button><button type="button" data-act="importOpen">⬆ استيراد نسخة</button></div>
          <div id="exportBox"></div>
          <hr><button type="button" class="btn-danger" data-act="resetAsk">امسح كل البيانات وابدأ من جديد</button></div></section>

        <section><h2>عن المحتوى</h2><div class="panel small">
          <p>إصدار المحتوى <span class="num">${esc(C.META.contentVersion)}</span> · آخر مراجعة ${U.fmtDate(C.META.lastReviewed, { day: 'numeric', month: 'long', year: 'numeric' })} · ${esc(C.META.reviewStatus)}</p>
          <p><b>${esc(q.name)}:</b> ${esc(q.examInfo)}</p>
          <p><b>IFRS 18 و IAS 1:</b> ${esc(A.std('ifrs18').note)}</p>
          <p>الأسئلة "تدريبية أصلية" اتكتبت للتطبيق ومش منسوبة لأي جهة امتحان. البطاقات ملخصات وليست منهجًا كاملًا. المحتوى في <span class="ltr">content/content.js</span> وتقدر تحدّثه بدون تعديل باقي التطبيق.</p>
          <p><b>مصادر رسمية للتحقق:</b></p><ul>${C.META.officialSources.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)} ↗</a></li>`).join('')}</ul></div></section>`;
    }
  };
  A.act.unrest = el => { A.commit(S => { S.settings.restDates = S.settings.restDates.filter(d => d !== el.dataset.d); A.reschedule(); }); };
  A.act.notifyAsk = el => {
    if (!el.checked) return;
    if (!('Notification' in window)) { el.checked = false; A.toast('المتصفح ده مش بيدعم إشعارات النظام.'); return; }
    if (Notification.permission === 'granted') return;
    try {
      Notification.requestPermission().then(p => { if (p !== 'granted') { el.checked = false; A.toast('الإذن مترفضش أو اتقفل. التنبيه المرئي والصوت هيفضلوا شغالين.'); } });
    } catch (e) { el.checked = false; A.toast('ما قدرناش نطلب الإذن هنا.'); }
  };

  A.act.prefsSave = f => {
    const today = U.today(), S = A.S, old = S.settings, s = readSettings(f, old), err = validate(s, today);
    if (err) { A.toast(err); return; }
    const planKeys = ['qualification', 'startDate', 'examDate', 'bufferDays', 'finalDays'];
    const changedPlan = planKeys.some(k => old[k] !== s[k]) || JSON.stringify(old.dayMinutes) !== JSON.stringify(s.dayMinutes) || JSON.stringify(old.customStds) !== JSON.stringify(s.customStds);
    const apply = () => {
      let r = null;
      A.commit(S2 => {
        S2.settings = s;
        if (changedPlan) { S2.tasks = A.plan.sync(S2, C).tasks; r = A.reschedule(); A.pickNext(today); }
      });
      document.documentElement.toggleAttribute('data-theme', s.theme !== 'system');
      if (s.theme !== 'system') document.documentElement.setAttribute('data-theme', s.theme);
      A.toast(changedPlan ? 'اتحفظت واتعاد توزيع المتبقي' + (r && (r.dropped.length || r.unplaced.length) ? ' — الوقت مش كفاية لكل المهام، شوف الخطة.' : ' ✓') : 'اتحفظت الإعدادات ✓');
    };
    if (old.qualification !== s.qualification || JSON.stringify(old.customStds) !== JSON.stringify(s.customStds)) {
      const tmp = Object.assign({}, S, { settings: s });
      const removed = A.plan.sync(tmp, C).removed;
      if (removed.length) { A.confirmInPage('تغيير المنهج', `هيتشال <b>${removed.length}</b> مهمة مش مكتملة من الخطة القديمة. المكتمل هيفضل محفوظ في سجلك.`, 'غيّر المنهج', apply, true); return; }
    }
    apply();
  };

  // ---------- تصدير واستيراد ----------
  const fname = () => 'ifrs-study-backup-' + U.today() + '.json';
  A.act.exportFile = () => {
    try {
      const blob = new Blob([A.store.exportData(A.S)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = fname(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      A.toast('لو الملف ما نزلش (بعض المتصفحات بتمنع التنزيل)، استخدم "انسخ كنص".');
    } catch (e) { A.act.exportText(); }
  };
  A.act.exportText = () => {
    const box = document.getElementById('exportBox');
    box.innerHTML = `<label>انسخ النص ده واحفظه في ملف .json<textarea id="exportTxt" class="ltr" rows="6" readonly>${esc(A.store.exportData(A.S))}</textarea></label><button type="button" class="btn-sm" data-act="copyExport">انسخ</button>`;
    const t = document.getElementById('exportTxt'); t.focus(); t.select();
  };
  A.act.copyExport = () => {
    const t = document.getElementById('exportTxt');
    const done = () => A.toast('اتنسخ ✓');
    try { navigator.clipboard.writeText(t.value).then(done, () => { t.select(); A.toast('حدد النص وانسخه يدويًا.'); }); } catch (e) { t.select(); A.toast('حدد النص وانسخه يدويًا.'); }
  };
  A.act.importOpen = () => {
    A.dialog(`<form><h2 id="dlg-title">استيراد نسخة احتياطية</h2>
      <label>الملف<input type="file" name="file" accept=".json,application/json"></label>
      <label>أو الصق النص<textarea name="text" class="ltr" rows="5"></textarea></label>
      <div class="row"><button type="submit" class="btn-main">معاينة</button><button type="button" data-act="closeDlg">إلغاء</button></div></form>`,
    async f => {
      const fd = new FormData(f); let text = fd.get('text'); const file = fd.get('file');
      try { if (file && file.size) text = await file.text(); } catch (e) { A.toast('ما قدرناش نقرأ الملف.'); return; }
      const p = A.store.parseImport(text || '', U.today());
      if (!p.ok) { A.toast(p.error); return; }
      if (p.kind === 'questions') { A.toast('ده ملف أسئلة — استورده من قسم الأسئلة.'); return; }
      A.mem.importState = p.state;
      const cur = A.store.summarize(A.S), inc = p.summary;
      const row = (l, k) => `<tr><td>${l}</td><td class="num">${cur[k]}</td><td class="num">${inc[k]}</td></tr>`;
      A.dialog(`<div class="dlg"><h2 id="dlg-title">معاينة النسخة</h2>
        <p class="small muted">${p.exportedAt ? 'اتصدرت ' + esc(new Date(p.exportedAt).toLocaleString('ar-EG-u-nu-latn')) : ''}</p>
        <div class="table-wrap"><table><thead><tr><th></th><th>الحالي</th><th>الملف</th></tr></thead><tbody>
          ${row('المهام', 'tasks')}${row('المكتمل', 'done')}${row('الجلسات', 'sessions')}${row('بطاقات اتراجعت', 'cardsReviewed')}${row('بطاقاتك', 'customCards')}${row('أسئلتك', 'questions')}${row('المحاولات', 'attempts')}${row('الأخطاء', 'mistakes')}
          <tr><td>الامتحان</td><td class="num">${cur.exam}</td><td class="num">${inc.exam}</td></tr></tbody></table></div>
        ${p.warnings.length ? `<div class="alert warn small">${esc(p.warnings.join(' · '))}</div>` : ''}
        <p class="note"><b>دمج:</b> يضيف الجديد من الملف بدون تكرار (نفس المعرف = الأحدث). إعداداتك الحالية تفضل. <b>استبدال:</b> يحط الملف مكان بياناتك — هنحتفظ بنسخة من بياناتك الحالية في المتصفح قبلها.</p>
        <div class="row"><button type="button" class="btn-main" data-act="importDo" data-mode="merge">دمج</button><button type="button" class="btn-danger" data-act="importDo" data-mode="replace">استبدال</button><button type="button" data-act="closeDlg">إلغاء</button></div></div>`);
    });
  };
  A.act.importDo = el => {
    const inc = A.mem.importState; if (!inc) return;
    A.closeDialog();
    if (el.dataset.mode === 'replace') {
      if (!A.store.keepPreImport(A.S)) { A.toast('ما قدرناش نحفظ نسخة من بياناتك الحالية — صدّرها الأول.'); return; }
      A.S = inc; if (!A.S.settings.onboarded) A.S.settings.onboarded = true;
    } else A.S = A.store.merge(A.S, inc);
    A.S.meta.warnings = [];
    A.commit(null);
    A.toast(el.dataset.mode === 'replace' ? 'اتستبدلت البيانات ✓' : 'اتدمجت البيانات ✓');
  };
  A.act.resetAsk = () => A.confirmInPage('مسح كل البيانات؟', 'هتتمسح الخطة والجلسات والبطاقات والأسئلة والأخطاء من الجهاز ده. هنحتفظ بنسخة أخيرة في المتصفح، بس الأفضل تصدّر ملف الأول.', 'امسح كل حاجة', () => {
    A.store.keepPreImport(A.S);
    A.S = A.store.defaultState(U.today());
    A.commit(null, { render: false });
    A.go('setup');
  }, true);
})(globalThis.App = globalThis.App || {});
