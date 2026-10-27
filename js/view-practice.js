/* الأسئلة (تدريب / بالوقت / امتحان تجريبي) + سجل الأخطاء */
(function (A) {
  'use strict';
  const U = A.util, esc = U.esc, C = A.content;
  const TYPE = { mcq: 'اختيار من متعدد', numeric: 'حسابي', written: 'كتابي' };
  const ORIGIN = { original: 'تدريبي أصلي', user: 'أضفته انت', imported: 'مستورد' };
  const DIFF = ['', 'سهل', 'متوسط', 'صعب'];
  const allQ = () => A.study.allQuestions(A.S, C);
  const qById = id => allQ().find(q => q.id === id);

  function lastAttempt(qid) { return A.S.attempts.filter(a => a.qid === qid).sort((a, b) => b.start - a.start)[0]; }
  A.qRow = function (q, today) {
    const la = lastAttempt(q.id);
    const res = la ? (la.score == null ? '<span class="chip warn">محتاج تصحيح</span>' : la.correct ? '<span class="chip good">✓ آخر مرة صح</span>' : '<span class="chip bad">✗ آخر مرة غلط</span>') : '';
    return `<div class="item"><span class="chip ltr">${esc(A.stdCode(q.std))}</span><div class="main"><div class="title">${esc(q.prompt.length > 110 ? q.prompt.slice(0, 110) + '…' : q.prompt)}</div>
      <div class="sub"><span>${TYPE[q.type]}</span><span>${DIFF[q.difficulty]}</span><span class="num">${q.marks} درجة</span><span class="chip">${ORIGIN[q.origin] || ''}</span>${res}</div></div>
      <div class="row"><button type="button" class="btn-sm" data-act="qStart" data-id="${q.id}" data-mode="practice">تدريب</button><button type="button" class="btn-sm" data-act="qStart" data-id="${q.id}" data-mode="timed" title="${A.study.timeLimitMin(q)} دقيقة">⏱ بالوقت</button></div></div>`;
  };

  // اختيار سؤال: اللي ماتحلش أو اتغلط فيه أولًا
  A.pickQuestion = function (std) {
    const list = allQ().filter(q => !std || q.std === std);
    if (!list.length) return null;
    const score = q => { const la = lastAttempt(q.id); return !la ? 0 : la.correct === false ? 1 : 2; };
    const sorted = U.shuffle(list).sort((a, b) => score(a) - score(b));
    return sorted[0];
  };

  A.startAttempt = function (q, mode, retryOf) {
    if (!q) { A.toast('مفيش أسئلة على المعيار ده لسه.'); return; }
    const now = Date.now();
    A.mem.result = null;
    A.commit(S => { S.activeAttempt = { qid: q.id, mode, start: now, endAt: mode === 'timed' ? now + A.study.timeLimitMin(q) * 60000 : null, retryOf: retryOf || null }; }, { render: false });
    A.go('attempt');
  };
  A.act.qStart = el => A.startAttempt(qById(el.dataset.id), el.dataset.mode);

  // ---------- بنك الأسئلة ----------
  A.views.questions = {
    title: 'الأسئلة',
    render(arg, today) {
      const S = A.S, f = A.mem.qFilter || {};
      const list = allQ().filter(q => (!f.std || q.std === f.std) && (!f.type || q.type === f.type) && (!f.diff || q.difficulty === +f.diff) && (!f.origin || q.origin === f.origin));
      const recent = S.attempts.slice().sort((a, b) => b.start - a.start).slice(0, 15);
      return `<div class="head"><div><h1>الأسئلة والتدريب</h1><p class="muted"><span class="num">${allQ().length}</span> سؤال · <span class="num">${S.attempts.length}</span> محاولة</p></div>
        <div class="row"><a class="btn btn-main" href="#mock">امتحان تجريبي</a><button type="button" data-act="qAdd">+ سؤال</button><button type="button" data-act="qImport">استيراد</button></div></div>
        <div class="alert info small"><span><b>الأسئلة الموجودة "تدريبية أصلية"</b> اتكتبت للتطبيق ده، ومش من امتحانات ACCA السابقة ولا صادرة عن أي جهة امتحان. لأسئلة الامتحانات الرسمية استخدم مصادر مرخّصة (Past exams / Exam Kit) وسجّل رقم السؤال في المهمة.</span></div>
        ${S.activeMock ? '<div class="alert warn"><b>عندك امتحان تجريبي شغال.</b><a class="btn btn-sm" href="#mock">كمّله</a></div>' : ''}
        <div class="panel"><div class="grid4">
          <label>المعيار<select data-change="qf" data-k="std">${A.stdOptions(f.std, true)}</select></label>
          <label>النوع<select data-change="qf" data-k="type"><option value="">الكل</option>${Object.entries(TYPE).map(([k, v]) => `<option value="${k}"${f.type === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>الصعوبة<select data-change="qf" data-k="diff"><option value="">الكل</option>${[1, 2, 3].map(d => `<option value="${d}"${+f.diff === d ? ' selected' : ''}>${DIFF[d]}</option>`).join('')}</select></label>
          <label>المصدر<select data-change="qf" data-k="origin"><option value="">الكل</option>${Object.entries(ORIGIN).map(([k, v]) => `<option value="${k}"${f.origin === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div></div>
        ${list.length ? '<div class="list">' + list.map(q => A.qRow(q, today)).join('') + '</div>' : '<p class="muted">مفيش أسئلة بالفلتر ده.</p>'}
        <section><h2>آخر المحاولات</h2>${recent.length ? `<div class="table-wrap"><table><thead><tr><th>اليوم</th><th>المعيار</th><th>الوضع</th><th>الدرجة</th><th>الوقت</th></tr></thead><tbody>${recent.map(a => `<tr><td class="num">${U.fmtDate(a.day)}</td><td class="ltr">${esc(A.stdCode(a.std))}</td><td>${{ practice: 'تدريب', timed: 'بالوقت', mock: 'تجريبي' }[a.mode]}</td><td class="num">${a.score == null ? 'محتاج تصحيح' : a.score + '/' + a.max}${a.correct === true ? ' ✓' : a.correct === false ? ' ✗' : ''}</td><td class="num">${U.fmtMin(a.durationMs / 60000)}${a.limitMs && a.durationMs > a.limitMs ? ' (تعدّى الوقت)' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">لسه مفيش محاولات.</p>'}</section>`;
    }
  };
  A.act.qf = el => { A.mem.qFilter = Object.assign({}, A.mem.qFilter || {}, { [el.dataset.k]: el.value }); A.render(); };

  // ---------- محاولة سؤال ----------
  function answerInput(q, val, disabled, res) {
    if (q.type === 'mcq') return `<fieldset><legend>اختار إجابة</legend>${q.options.map((o, i) => `<label class="opt${res ? (i === q.correct ? ' right' : +val === i ? ' wrong' : '') : ''}"><input type="radio" name="ans" value="${i}" ${+val === i && val !== '' && val != null ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${esc(o)}${res && i === q.correct ? ' ✓ الصح' : ''}</span></label>`).join('')}</fieldset>`;
    if (q.type === 'numeric') return `<label>إجابتك (رقم${q.unit ? ' ب' + esc(q.unit) : ''})<input name="ans" inputmode="decimal" class="ltr num" value="${esc(val == null ? '' : val)}" ${disabled ? 'disabled' : ''} autocomplete="off"></label>`;
    return `<label>إجابتك<textarea name="ans" rows="8" ${disabled ? 'disabled' : ''}>${esc(val || '')}</textarea></label>`;
  }
  function rubricForm(q, prefix) {
    const rub = q.rubric && q.rubric.length ? q.rubric : [{ point: 'إجابتي مطابقة للإجابة النموذجية', marks: q.marks }];
    return `<fieldset><legend>صحّح نفسك بدليل التصحيح</legend><p class="note">علّم النقاط اللي إجابتك غطتها فعلًا. ده تصحيح ذاتي موجّه، مش تصحيح رسمي.</p>${rub.map((r, i) => `<label class="inline"><input type="checkbox" name="${prefix}${i}"> ${esc(r.point)} <span class="num muted">(${r.marks})</span></label>`).join('')}</fieldset>`;
  }

  A.views.attempt = {
    title: 'سؤال',
    render(arg, today) {
      const S = A.S, at = S.activeAttempt, res = A.mem.result;
      const q = res ? qById(res.qid) : at && qById(at.qid);
      if (!q) return '<p>مفيش سؤال مفتوح.</p><a class="btn" href="#questions">بنك الأسئلة</a>';
      const timed = !res && at.endAt;
      return `<div class="head"><div><p><a href="#questions">← الأسئلة</a></p><h1>${res ? 'النتيجة' : at.mode === 'timed' ? 'سؤال بالوقت' : 'تدريب'}</h1>
        <p class="muted"><span class="ltr">${esc(A.stdCode(q.std))}</span> · ${TYPE[q.type]} · <span class="num">${q.marks}</span> درجة · ${ORIGIN[q.origin]}</p></div>
        ${timed ? `<div class="count"><b class="num" id="qclock">--:--</b><span class="muted">متبقي</span></div>` : ''}</div>
        <div class="panel"><p style="white-space:pre-wrap">${esc(q.prompt)}</p></div>
        ${res ? resultView(q, res) : `<form data-form="qSubmit" class="stack">${answerInput(q, A.mem.draft, false)}<div class="row"><button type="submit" class="btn-main">سلّم الإجابة</button><button type="button" data-act="qQuit">خروج بدون تسجيل</button></div></form>`}`;
    }
  };
  function resultView(q, res) {
    const a = A.S.attempts.find(x => x.id === res.attemptId);
    const status = a.score == null ? '<div class="alert warn"><b>محتاج تصحيح ذاتي</b></div>' : a.correct ? `<div class="alert good"><b>✓ صح — ${a.score}/${a.max}</b></div>` : `<div class="alert bad"><b>✗ مش صح — ${a.score}/${a.max}</b>${res.invalid ? '<span>الإجابة مش رقم مفهوم.</span>' : ''}</div>`;
    const hasM = A.S.mistakes.some(m => m.attemptId === a.id);
    return `${status}
      ${answerInput(q, a.answer, true, true)}
      ${q.model ? `<section><h3>الإجابة النموذجية</h3><pre class="model">${esc(q.model)}</pre></section>` : ''}
      ${q.type === 'numeric' ? `<p class="small muted">الإجابة: <span class="num">${q.answer}</span>${q.tolerance ? ' (± ' + q.tolerance + ')' : ''}</p>` : ''}
      ${q.explanation ? `<section><h3>التفسير</h3><p>${esc(q.explanation)}</p></section>` : ''}
      ${a.score == null ? `<form data-form="qSelfGrade" data-id="${a.id}" class="stack">${rubricForm(q, 'r')}<button type="submit" class="btn-main">احسب درجتي</button></form>` : ''}
      <div class="row">${hasM ? '<span class="chip">اتسجل في الأخطاء</span>' : `<button type="button" class="${a.correct === false ? 'btn-main' : ''}" data-act="mAdd" data-attempt="${a.id}">سجّل كخطأ</button>`}
        <button type="button" data-act="qAnother" data-std="${q.std}">سؤال تاني على ${esc(A.stdCode(q.std))}</button><a class="btn" href="#questions">بنك الأسئلة</a></div>`;
  }

  function finishAttempt(q, answer, mode, extra) {
    const S = A.S, at = S.activeAttempt, now = Date.now(), today = U.today();
    const g = A.study.grade(q, answer);
    const a = Object.assign({ id: U.uid('a'), qid: q.id, std: q.std, mode, mockId: null, start: at ? at.start : now, durationMs: now - (at ? at.start : now), limitMs: at && at.endAt ? at.endAt - at.start : 0, answer, correct: g.correct, score: g.score, max: g.max, day: today }, extra || {});
    S.attempts.push(a);
    if (at && at.retryOf) { const m = S.mistakes.find(x => x.id === at.retryOf); if (m && a.correct != null) A.study.recordRetry(m, a, today); else if (m) A.mem.pendingRetry = m.id; }
    return { a, g };
  }
  A.act.qSubmit = f => {
    const S = A.S, at = S.activeAttempt, q = at && qById(at.qid); if (!q) return;
    const v = new FormData(f).get('ans');
    if (v == null || String(v).trim() === '') { A.toast('اكتب أو اختار إجابة الأول.'); return; }
    let out;
    A.commit(() => { out = finishAttempt(q, q.type === 'mcq' ? +v : String(v), at.mode); S.activeAttempt = null; A.mem.draft = null; A.mem.result = { qid: q.id, attemptId: out.a.id, invalid: out.g.invalid }; });
  };
  A.act.qSelfGrade = f => {
    const fd = new FormData(f), id = f.dataset.id;
    A.commit(S => {
      const a = S.attempts.find(x => x.id === id), q = qById(a.qid);
      const rub = q.rubric && q.rubric.length ? q.rubric : [1];
      const g = A.study.selfGrade(q, rub.map((_, i) => fd.has('r' + i)));
      a.score = g.score; a.correct = g.correct;
      const m = A.mem.pendingRetry && S.mistakes.find(x => x.id === A.mem.pendingRetry);
      if (m) { A.study.recordRetry(m, a, U.today()); A.mem.pendingRetry = null; }
    });
  };
  A.act.qQuit = () => A.commit(S => { S.activeAttempt = null; A.mem.draft = null; A.go('questions'); });
  A.act.qAnother = el => A.startAttempt(A.pickQuestion(el.dataset.std), 'practice');

  // ---------- إضافة واستيراد ----------
  A.act.qAdd = () => {
    const t = A.mem.qAddType || 'mcq';
    A.dialog(`<form><h2 id="dlg-title">سؤال جديد</h2>
      <label>النوع<select name="type" data-change="qAddType">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}"${k === t ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <div class="grid2"><label>المعيار<select name="std" required>${A.stdOptions('')}</select></label><label>الموضوع<input name="topic"></label></div>
      <div class="grid2"><label>الصعوبة<select name="difficulty">${[1, 2, 3].map(d => `<option value="${d}"${d === 2 ? ' selected' : ''}>${DIFF[d]}</option>`).join('')}</select></label><label>الدرجات<input name="marks" type="number" min="1" max="100" value="2"></label></div>
      <label>نص السؤال<textarea name="prompt" required></textarea></label>
      ${t === 'mcq' ? '<label>الخيارات (كل خيار في سطر)<textarea name="options" required></textarea></label><label>رقم الخيار الصح (1 = الأول)<input name="correct" type="number" min="1" value="1" required></label>' : ''}
      ${t === 'numeric' ? '<div class="grid2"><label>الإجابة<input name="answer" required class="ltr"></label><label>هامش السماح ±<input name="tolerance" type="number" min="0" step="any" value="0"></label></div>' : ''}
      ${t === 'written' ? '<label>دليل التصحيح (كل نقطة في سطر، وممكن الدرجة بعد | مثال: ذكر الشروط | 2)<textarea name="rubric"></textarea></label>' : ''}
      <label>الإجابة النموذجية / الحل<textarea name="model"></textarea></label>
      <label>التفسير<textarea name="explanation"></textarea></label>
      <label>مصدر السؤال<input name="sourceNote" placeholder="مثال: من تأليفي / Kit س 14 (للاستخدام الشخصي)"></label>
      <div class="row"><button type="submit" class="btn-main">حفظ</button><button type="button" data-act="closeDlg">إلغاء</button></div></form>`,
    f => {
      const v = Object.fromEntries(new FormData(f));
      const raw = { id: U.uid('uq'), type: v.type, std: v.std, topic: v.topic, difficulty: +v.difficulty, marks: +v.marks, prompt: v.prompt, model: v.model, explanation: v.explanation, sourceNote: v.sourceNote };
      if (v.type === 'mcq') { raw.options = v.options.split('\n').map(s => s.trim()).filter(Boolean); raw.correct = +v.correct - 1; }
      if (v.type === 'numeric') { raw.answer = U.num(v.answer); raw.tolerance = +v.tolerance || 0; }
      if (v.type === 'written') raw.rubric = (v.rubric || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => { const p = s.split('|'); return { point: p[0].trim(), marks: p[1] ? U.num(p[1]) || 1 : 1 }; });
      const r = A.store.normQuestion(raw);
      if (r.error) { A.toast(r.error); return; }
      A.closeDialog();
      A.commit(S => { S.questions.custom.push(r.q); });
      A.toast('اتضاف السؤال.');
    });
  };
  A.act.qAddType = el => { A.mem.qAddType = el.value; A.act.qAdd(); };

  A.act.qImport = () => {
    A.dialog(`<form><h2 id="dlg-title">استيراد أسئلة</h2>
      <p class="note">ملف JSON فيه مصفوفة أسئلة أو {"questions": [...]}. الصيغة موضحة في README. استورد بس أسئلة من تأليفك أو مسموح لك باستخدامها.</p>
      <label>ملف<input type="file" name="file" accept=".json,application/json"></label>
      <label>أو الصق النص<textarea name="text" class="ltr" rows="6"></textarea></label>
      <div class="row"><button type="submit" class="btn-main">معاينة</button><button type="button" data-act="closeDlg">إلغاء</button></div></form>`,
    async f => {
      const fd = new FormData(f); let text = fd.get('text');
      const file = fd.get('file'); if (file && file.size) text = await file.text();
      const p = A.store.parseImport(text || '', U.today());
      if (!p.ok) { A.toast(p.error); return; }
      if (p.kind !== 'questions') { A.toast('الملف ده نسخة احتياطية كاملة — استورده من الإعدادات.'); return; }
      const existing = new Set(allQ().map(q => q.id));
      const fresh = p.questions.filter(q => !existing.has(q.id));
      A.mem.importQs = fresh;
      A.dialog(`<div class="dlg"><h2 id="dlg-title">معاينة الاستيراد</h2><ul><li>أسئلة صالحة: <b class="num">${p.questions.length}</b></li><li>جديدة هتتضاف: <b class="num">${fresh.length}</b></li><li>مكررة (نفس id) هتتجاهل: <b class="num">${p.questions.length - fresh.length}</b></li>${p.errors.length ? `<li>غير صالحة: <b class="num">${p.errors.length}</b><br><span class="small">${esc(p.errors.slice(0, 3).join(' · '))}</span></li>` : ''}</ul>
        <div class="row"><button type="button" class="btn-main" data-act="qImportOk" ${fresh.length ? '' : 'disabled'}>أضف ${fresh.length} سؤال</button><button type="button" data-act="closeDlg">إلغاء</button></div></div>`);
    });
  };
  A.act.qImportOk = () => { const list = A.mem.importQs || []; A.closeDialog(); A.commit(S => { S.questions.custom = S.questions.custom.concat(list); }); A.toast('اتضاف ' + list.length + ' سؤال.'); };

  // ---------- امتحان تجريبي ----------
  A.views.mock = {
    title: 'امتحان تجريبي',
    render(arg, today) {
      const S = A.S, m = S.activeMock;
      if (m) return runMock(m);
      if (A.mem.mockResult) return mockResult(A.mem.mockResult);
      const stds = A.qualStds().filter(s => allQ().some(q => q.std === s.id));
      const past = S.mocks.slice().sort((a, b) => b.created - a.created);
      return `<div class="head"><div><p><a href="#questions">← الأسئلة</a></p><h1>امتحان تجريبي</h1><p class="muted">من الأسئلة الموجودة في البنك (تدريبية، مش امتحان رسمي).</p></div></div>
        <form data-form="mockBuild" class="panel">
          <fieldset><legend>المعايير (سيبها فاضية = الكل)</legend><div class="grid4">${stds.map(s => `<label class="inline"><input type="checkbox" name="std" value="${s.id}"> <span class="ltr">${esc(s.code)}</span></label>`).join('')}</div></fieldset>
          <div class="grid2"><label>عدد الأسئلة<input name="count" type="number" min="1" max="50" value="6"></label><label>الوقت بالدقائق (فاضي = حسب الدرجات)<input name="minutes" type="number" min="1" max="300"></label></div>
          <button type="submit" class="btn-main">ابدأ الامتحان</button></form>
        <section><h2>امتحانات سابقة</h2>${past.length ? '<div class="list">' + past.map(mk => { const at = S.attempts.filter(a => a.mockId === mk.id); const sc = at.reduce((x, a) => x + (a.score || 0), 0), mx = at.reduce((x, a) => x + a.max, 0); return `<div class="item"><span class="chip num">${U.fmtDate(U.today(mk.created))}</span><div class="main"><div class="title"><span class="num">${sc}/${mx}</span> درجة · ${mk.qids.length} سؤال</div><div class="sub">${at.some(a => a.score == null) ? 'فيه أسئلة محتاجة تصحيح ذاتي' : ''}</div></div><button type="button" class="btn-sm" data-act="mockOpen" data-id="${mk.id}">مراجعة النتيجة</button></div>`; }).join('') + '</div>' : '<p class="muted">لسه مفيش.</p>'}</section>`;
    }
  };
  A.act.mockBuild = f => {
    const fd = new FormData(f), stds = fd.getAll('std'), count = +fd.get('count') || 6;
    const qids = A.study.buildMock(allQ(), { stds, count });
    if (!qids.length) { A.toast('مفيش أسئلة كفاية بالاختيار ده.'); return; }
    const minutes = +fd.get('minutes') || qids.reduce((a, id) => a + A.study.timeLimitMin(qById(id)), 0);
    const now = Date.now();
    A.mem.mockResult = null;
    A.commit(S => { S.activeMock = { id: U.uid('mk'), qids, idx: 0, start: now, endAt: now + minutes * 60000, minutes, answers: {} }; });
  };
  function runMock(m) {
    const q = qById(m.qids[m.idx]);
    return `<div class="head"><div><h1>امتحان تجريبي</h1><p class="muted">سؤال <span class="num">${m.idx + 1}</span> من <span class="num">${m.qids.length}</span></p></div><div class="count"><b class="num" id="mclock">--:--</b><span class="muted">متبقي</span></div></div>
      <nav class="qnav" aria-label="الأسئلة">${m.qids.map((id, i) => `<button type="button" class="${m.answers[id] != null && m.answers[id] !== '' ? 'answered' : ''} ${i === m.idx ? 'cur' : ''}" data-act="mockGo" data-i="${i}" aria-label="سؤال ${i + 1}${m.answers[id] != null && m.answers[id] !== '' ? '، متجاوب' : ''}">${i + 1}</button>`).join('')}</nav>
      ${q ? `<div class="panel"><p class="small muted"><span class="ltr">${esc(A.stdCode(q.std))}</span> · ${TYPE[q.type]} · <span class="num">${q.marks}</span> درجة</p><p style="white-space:pre-wrap">${esc(q.prompt)}</p></div>
      <form data-form="mockSave" class="stack" data-change="mockAns">${answerInput(q, m.answers[q.id], false)}</form>` : '<p>السؤال ده اتشال من البنك.</p>'}
      <div class="row"><button type="button" data-act="mockGo" data-i="${m.idx - 1}" ${m.idx === 0 ? 'disabled' : ''}>→ السابق</button><button type="button" data-act="mockGo" data-i="${m.idx + 1}" ${m.idx >= m.qids.length - 1 ? 'disabled' : ''}>التالي ←</button>
      <button type="button" class="btn-main" data-act="mockSubmitAsk">سلّم الامتحان</button><button type="button" class="btn-ghost" data-act="mockAbort">إلغاء الامتحان</button></div>`;
  }
  A.act.mockAns = el => {
    const f = el.closest('form') || el, v = new FormData(f).get('ans');
    const m = A.S.activeMock; if (!m) return;
    const q = qById(m.qids[m.idx]);
    m.answers[q.id] = v == null ? null : (q.type === 'mcq' ? +v : String(v));
    A.store.save(A.S);
  };
  A.act.mockSave = f => A.act.mockAns(f);
  A.act.mockGo = el => { const f = document.querySelector('[data-form="mockSave"]'); if (f) A.act.mockAns(f); A.commit(S => { S.activeMock.idx = Math.max(0, Math.min(S.activeMock.qids.length - 1, +el.dataset.i)); }); };
  A.act.mockSubmitAsk = () => {
    const f = document.querySelector('[data-form="mockSave"]'); if (f) A.act.mockAns(f);
    const m = A.S.activeMock, left = m.qids.filter(id => m.answers[id] == null || m.answers[id] === '').length;
    A.confirmInPage('تسليم الامتحان؟', left ? `فيه <b>${left}</b> سؤال من غير إجابة.` : 'جاوبت على كل الأسئلة.', 'سلّم', submitMock);
  };
  A.act.mockAbort = () => A.confirmInPage('إلغاء الامتحان؟', 'الإجابات مش هتتسجل.', 'إلغاء الامتحان', () => A.commit(S => { S.activeMock = null; }), true);
  function submitMock(auto) {
    const S = A.S, m = S.activeMock; if (!m) return;
    const now = Date.now(), today = U.today(), ids = [];
    m.qids.forEach(id => {
      const q = qById(id); if (!q) return;
      const ans = m.answers[id];
      const g = ans == null || ans === '' ? { correct: q.type === 'written' ? null : false, score: q.type === 'written' ? null : 0, max: q.marks } : A.study.grade(q, ans);
      if ((ans == null || ans === '') && q.type === 'written') { g.correct = false; g.score = 0; }
      const a = { id: U.uid('a'), qid: id, std: q.std, mode: 'mock', mockId: m.id, start: m.start, durationMs: Math.min(now, m.endAt) - m.start, limitMs: m.endAt - m.start, answer: ans == null ? null : ans, correct: g.correct, score: g.score, max: q.marks, day: today };
      S.attempts.push(a); ids.push(a.id);
    });
    S.mocks.push({ id: m.id, created: m.start, qids: m.qids, minutes: m.minutes, start: m.start, end: now, attemptIds: ids });
    S.activeMock = null;
    A.mem.mockResult = m.id;
    A.commit(null);
    if (auto) A.toast('الوقت خلص واتسلّم الامتحان تلقائيًا.');
  }
  A.views.mockTick = now => {
    const m = A.S.activeMock;
    const el = document.getElementById('mclock');
    if (m) { if (el) el.textContent = U.clock(m.endAt - now); if (now >= m.endAt) submitMock(true); }
    const at = A.S.activeAttempt, qc = document.getElementById('qclock');
    if (at && at.endAt && qc) { qc.textContent = now >= at.endAt ? 'انتهى الوقت' : U.clock(at.endAt - now); }
  };
  A.act.mockOpen = el => { A.mem.mockResult = el.dataset.id; A.go('mock'); A.render(); };
  function mockResult(id) {
    const S = A.S, mk = S.mocks.find(x => x.id === id); if (!mk) return '';
    const at = mk.attemptIds.map(aid => S.attempts.find(a => a.id === aid)).filter(Boolean);
    const sc = at.reduce((x, a) => x + (a.score || 0), 0), mx = at.reduce((x, a) => x + a.max, 0);
    const pending = at.filter(a => a.score == null).length;
    return `<div class="head"><div><h1>نتيجة الامتحان التجريبي</h1><p class="muted">${U.fmtDate(U.today(mk.created), { day: 'numeric', month: 'long' })} · الوقت ${U.fmtMin((mk.end - mk.start) / 60000)} من ${mk.minutes} د</p></div><div class="count"><b class="num">${sc}/${mx}</b></div></div>
      ${pending ? `<div class="alert warn">فيه ${pending} سؤال كتابي محتاج تصحيح ذاتي — الدرجة النهائية هتتحدث بعده.</div>` : ''}
      ${at.map((a, i) => { const q = qById(a.qid); if (!q) return ''; const hasM = S.mistakes.some(m => m.attemptId === a.id); return `<details class="panel" ${a.correct === false || a.score == null ? 'open' : ''}><summary><b>س ${i + 1}</b> · <span class="ltr">${esc(A.stdCode(q.std))}</span> · ${a.score == null ? 'محتاج تصحيح' : a.score + '/' + a.max} ${a.correct === true ? '✓' : a.correct === false ? '✗' : ''}</summary>
        <p style="white-space:pre-wrap">${esc(q.prompt)}</p>${answerInput(q, a.answer, true, true)}${q.model ? `<pre class="model">${esc(q.model)}</pre>` : ''}${q.explanation ? `<p>${esc(q.explanation)}</p>` : ''}
        ${a.score == null ? `<form data-form="qSelfGrade" data-id="${a.id}" class="stack">${rubricForm(q, 'r')}<button type="submit">احسب الدرجة</button></form>` : ''}
        ${hasM ? '<span class="chip">اتسجل في الأخطاء</span>' : `<button type="button" class="btn-sm" data-act="mAdd" data-attempt="${a.id}">سجّل كخطأ</button>`}</details>`; }).join('')}
      <div class="row"><button type="button" data-act="mockClose">امتحان جديد</button><a class="btn" href="#mistakes">سجل الأخطاء</a></div>`;
  }
  A.act.mockClose = () => { A.mem.mockResult = null; A.render(); };

  // ---------- سجل الأخطاء ----------
  const CAUSE = A.study.CAUSE_LABEL;
  A.mistakeRow = function (m, today) {
    const due = !m.resolved && m.nextRetry && m.nextRetry <= today;
    return `<div class="item"><span class="st ${m.resolved ? 'done' : due ? 'over' : 'partial'}" aria-hidden="true">${m.resolved ? '✓' : due ? '⏰' : '!'}</span>
      <div class="main"><div class="title">${esc(m.title || 'خطأ')}</div>
      <div class="sub"><span class="ltr">${esc(A.stdCode(m.std))}</span><span>السبب: ${CAUSE[m.cause]}</span><span>${m.resolved ? 'اتحل' : due ? '<b>مستحق إعادة محاولة</b>' : m.nextRetry ? 'إعادة المحاولة ' + U.fmtDate(m.nextRetry) : ''}</span>${m.retries.length ? '<span>المحاولات: ' + m.retries.map(r => (r.correct ? '✓' : '✗')).join(' ') + '</span>' : ''}</div>
      ${m.correction ? `<div class="small">التصحيح: ${esc(m.correction)}</div>` : ''}</div>
      <div class="row">${m.qid && !m.resolved ? `<button type="button" class="btn-sm" data-act="mRetry" data-id="${m.id}">أعد المحاولة</button>` : ''}<button type="button" class="btn-sm" data-act="mEdit" data-id="${m.id}">تفاصيل</button></div></div>`;
  };

  A.views.mistakes = {
    title: 'سجل الأخطاء',
    render(arg, today) {
      const S = A.S, f = A.mem.mf || { st: 'open' };
      const list = S.mistakes.filter(m => (!f.std || m.std === f.std) && (!f.cause || m.cause === f.cause) && (f.st === 'all' || (f.st === 'open' ? !m.resolved : m.resolved))).sort((a, b) => (a.resolved - b.resolved) || ((a.nextRetry || '9') < (b.nextRetry || '9') ? -1 : 1));
      const rec = A.study.recurring(S), due = A.study.mistakesDue(S, today);
      const retried = S.mistakes.filter(m => m.retries.length), fixed = retried.filter(m => m.resolved);
      return `<div class="head"><div><h1>سجل الأخطاء</h1><p class="muted"><span class="num">${S.mistakes.filter(m => !m.resolved).length}</span> مفتوح · <span class="num">${due.length}</span> مستحق إعادة محاولة · <span class="num">${S.mistakes.filter(m => m.resolved).length}</span> اتحل</p></div>
        <button type="button" data-act="mAdd" data-attempt="">+ سجّل خطأ</button></div>
        <div class="grid2"><div class="panel"><h3>الأخطاء المتكررة</h3>${rec.length ? '<ul>' + rec.slice(0, 6).map(r => `<li><span class="ltr">${esc(A.stdCode(r.std))}</span> — ${CAUSE[r.cause]}: <b class="num">${r.n}</b> مرات (${r.open} مفتوح)</li>`).join('') + '</ul>' : '<p class="muted small">لسه مفيش نمط متكرر (خطأين أو أكتر بنفس المعيار والسبب).</p>'}</div>
          <div class="panel"><h3>التحسن بعد إعادة المحاولة</h3>${retried.length ? `<p><b class="num">${fixed.length}</b> من <b class="num">${retried.length}</b> خطأ اتحل بعد إعادة المحاولة.</p>` : '<p class="muted small">لما تعيد محاولة سؤال غلطت فيه، النتيجة هتظهر هنا.</p>'}</div></div>
        <div class="panel"><div class="grid4">
          <label>المعيار<select data-change="mf" data-k="std">${A.stdOptions(f.std, true)}</select></label>
          <label>السبب<select data-change="mf" data-k="cause"><option value="">الكل</option>${Object.entries(CAUSE).map(([k, v]) => `<option value="${k}"${f.cause === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>الحالة<select data-change="mf" data-k="st">${[['open', 'مفتوحة'], ['done', 'اتحلت'], ['all', 'الكل']].map(([k, v]) => `<option value="${k}"${f.st === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div></div>
        ${list.length ? '<div class="list">' + list.map(m => A.mistakeRow(m, today)).join('') + '</div>' : '<p class="muted">مفيش أخطاء بالفلتر ده.</p>'}`;
    }
  };
  A.act.mf = el => { A.mem.mf = Object.assign({ st: 'open' }, A.mem.mf || {}, { [el.dataset.k]: el.value }); A.render(); };
  A.act.mRetry = el => { const m = A.S.mistakes.find(x => x.id === el.dataset.id); A.startAttempt(qById(m.qid), 'practice', m.id); };

  function mistakeForm(m, a, q) {
    const today = U.today();
    return `<form><h2 id="dlg-title">${m ? 'تفاصيل الخطأ' : 'تسجيل خطأ'}</h2>
      ${q ? `<p class="small muted">${esc(q.prompt.slice(0, 160))}</p>` : `<label>وصف الخطأ<input name="title" required value="${esc(m ? m.title : '')}"></label><label>المعيار<select name="std">${A.stdOptions(m ? m.std : '')}</select></label>`}
      <fieldset><legend>سبب الخطأ</legend><div class="grid2">${Object.entries(CAUSE).map(([k, v]) => `<label class="inline"><input type="radio" name="cause" value="${k}" ${(m ? m.cause : 'concept') === k ? 'checked' : ''}> ${v}</label>`).join('')}</div></fieldset>
      <label>التصحيح (الصح إيه؟)<textarea name="correction">${esc(m ? m.correction : '')}</textarea></label>
      <label>ملاحظة<textarea name="note">${esc(m ? m.note : '')}</textarea></label>
      ${m ? `<label class="inline"><input type="checkbox" name="resolved" ${m.resolved ? 'checked' : ''}> اتحل</label>` : ''}
      <fieldset><legend>حوّله لمراجعة</legend>
        <label class="inline"><input type="checkbox" name="mkTask" ${m && m.taskId ? 'checked disabled' : ''}> أضف مهمة مراجعة في أقرب يوم مذاكرة</label>
        <label class="inline"><input type="checkbox" name="mkCard" ${m && m.cardId ? 'checked disabled' : ''}> اعمل بطاقة مراجعة من السؤال والتصحيح</label></fieldset>
      <div class="row"><button type="submit" class="btn-main">حفظ</button>${m ? `<button type="button" class="btn-danger" data-act="mDel" data-id="${m.id}">حذف</button>` : ''}<button type="button" data-act="closeDlg">إلغاء</button></div></form>`;
  }
  function saveMistake(f, m, a, q) {
    const v = Object.fromEntries(new FormData(f)), today = U.today();
    A.closeDialog();
    A.commit(S => {
      let x = m;
      if (!x) { x = A.study.newMistake(q, a, v.cause, v.note, v.correction, today); if (!q) { x.title = v.title; x.std = v.std; } S.mistakes.push(x); }
      else { x.cause = v.cause; x.note = v.note; x.correction = v.correction; x.resolved = !!v.resolved; if (!q) { x.title = v.title || x.title; x.std = v.std; } if (x.resolved) x.nextRetry = null; else if (!x.nextRetry) x.nextRetry = U.add(today, 3); }
      if (v.mkTask && !x.taskId) {
        const d = A.plan.capacity(S.settings, today) ? today : A.plan.nextStudyDay(S.settings, today);
        const t = { id: U.uid('t'), key: null, origin: 'mistake', mistakeId: x.id, type: 'review', phase: 'main', title: 'مراجعة خطأ: ' + (x.title || '').slice(0, 60), std: x.std, estMin: 20, priority: 1, dropRank: 0, order: 1e6 + S.tasks.length, status: 'todo', date: d, pinned: true, dropped: false, unplaced: !d, source: '', ref: q ? 'سؤال ' + q.id : '', link: '', note: x.correction, minutesSpent: 0, doneAt: null, updatedAt: Date.now() };
        S.tasks.push(t); x.taskId = t.id;
      }
      if (v.mkCard && !x.cardId) {
        const c = { id: U.uid('uc'), std: x.std, q: q ? q.prompt : x.title, a: x.correction || (q && q.model) || 'اكتب التصحيح', origin: 'user', source: 'من سجل الأخطاء', fromMistake: x.id, example: '', conditions: '', exceptions: '' };
        S.cards.custom.push(c); x.cardId = c.id; S.cards.queue = null;
      }
    });
    A.toast('اتحفظ في سجل الأخطاء.');
  }
  A.act.mAdd = el => {
    const a = el.dataset.attempt ? A.S.attempts.find(x => x.id === el.dataset.attempt) : null;
    const q = a ? qById(a.qid) : null;
    A.dialog(mistakeForm(null, a, q), f => saveMistake(f, null, a, q));
  };
  A.act.mEdit = el => {
    const m = A.S.mistakes.find(x => x.id === el.dataset.id), q = m.qid ? qById(m.qid) : null, a = m.attemptId ? A.S.attempts.find(x => x.id === m.attemptId) : null;
    A.dialog(mistakeForm(m, a, q), f => saveMistake(f, m, a, q));
  };
  A.act.mDel = el => { A.closeDialog(); A.confirmInPage('حذف الخطأ؟', 'هيتشال من السجل.', 'احذف', () => A.commit(S => { S.mistakes = S.mistakes.filter(m => m.id !== el.dataset.id); }), true); };
})(globalThis.App = globalThis.App || {});
