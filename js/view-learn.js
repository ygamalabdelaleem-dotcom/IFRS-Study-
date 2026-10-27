/* المعايير وصفحة كل معيار + بطاقات المراجعة */
(function (A) {
  'use strict';
  const U = A.util, esc = U.esc, C = A.content;

  const covChips = cv => ['explained', 'practiced', 'reviewed'].map((k, i) => {
    const on = cv && cv[k];
    return `<span class="chip ${on ? 'good' : ''}">${on ? '✓' : '○'} ${['فهمت', 'تدرّبت', 'راجعت'][i]}</span>`;
  }).join('');
  const masteryText = m => (m.enough ? `<span class="num">${m.pct}%</span> <span class="muted small">(${m.n} محاولة)</span>` : `<span class="muted small">بيانات غير كافية (${m.n} من ${A.study.MIN_ATTEMPTS})</span>`);

  A.views.standards = {
    title: 'المعايير',
    render(arg, today) {
      const S = A.S, list = A.qualStds(), cov = A.study.coverage(S, list.map(s => s.id)), q = A.qual();
      return `<div class="head"><div><h1>المعايير</h1><p class="muted">${esc(q.name)} · دورة ${esc(q.cycle)}</p></div></div>
        ${q.syllabusVerified ? '' : `<div class="alert warn"><b>⚠ قائمة المعايير دي لم يتم التحقق منها مقابل المنهج الرسمي.</b><span>${esc(q.examInfo)}</span><a class="btn btn-sm" href="#prefs">المصادر الرسمية</a></div>`}
        <div class="list">${list.map(s => `<a class="item" href="#std-${s.id}" style="color:inherit;text-decoration:none">
          <span class="chip acc ltr">${esc(s.code)}</span>
          <div class="main"><div class="title">${esc(s.ar)} <span class="muted small ltr">${esc(s.en)}</span></div><div class="sub">${covChips(cov[s.id])} ${s.needsReview ? '<span class="chip warn">يحتاج مراجعة</span>' : ''}</div></div>
          <div class="small">${masteryText(A.study.mastery(S, s.id, today))}</div></a>`).join('')}</div>`;
    }
  };

  A.views.std = {
    title: 'معيار',
    render(id, today) {
      const S = A.S, s = A.std(id);
      if (!s) return '<p>المعيار مش موجود.</p><a class="btn" href="#standards">رجوع</a>';
      const cv = A.study.coverage(S, [id])[id];
      const tasks = S.tasks.filter(t => t.std === id && !t.archived);
      const qs = A.study.allQuestions(S, C).filter(q => q.std === id);
      const cards = A.study.allCards(S, C).filter(c => c.std === id);
      const cc = A.srs.counts(cards, S.cards.srs, today);
      const ms = S.mistakes.filter(m => m.std === id);
      const src = S.stdSources[id] || [];
      return `<div class="head"><div><p><a href="#standards">← المعايير</a></p><h1><span class="ltr">${esc(s.code)}</span> — ${esc(s.ar)}</h1><p class="muted ltr" style="text-align:right">${esc(s.en)}</p></div></div>
        ${s.note ? `<div class="alert ${s.needsReview ? 'warn' : 'info'}">${s.needsReview ? '<b>⚠ يحتاج مراجعة</b>' : ''}<span>${esc(s.note)}</span></div>` : ''}
        <section><h2>التقدم</h2><div class="panel">
          <div class="row">${['explained', 'practiced', 'reviewed'].map((k, i) => `<label class="inline"><input type="checkbox" data-change="covToggle" data-std="${id}" data-k="${k}" ${cv[k] ? 'checked' : ''} ${cv.auto[k] ? 'disabled' : ''}> ${['فهمت', 'تدرّبت', 'راجعت'][i]}${cv.auto[k] ? ' <span class="small muted">(من مهامك)</span>' : ''}</label>`).join('')}</div>
          <p class="note">"فهمت" بتتعلم تلقائيًا لما تخلص مهمة شرح، و"تدرّبت" بمهمة تدريب، و"راجعت" بمهمة مراجعة. تقدر تعلمها يدويًا كمان. ده تقييم ذاتي ومش نسبة استعداد.</p>
          <div>الإتقان في الأسئلة: ${masteryText(A.study.mastery(S, id, today))}</div></div></section>
        <section><h2>مصادرك</h2><div class="panel">
          ${src.length ? '<ul>' + src.map((x, i) => `<li>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.text)} ↗</a>` : esc(x.text)} <button type="button" class="btn-sm btn-ghost" data-act="delSrc" data-std="${id}" data-i="${i}" aria-label="حذف المصدر">✕</button></li>`).join('') + '</ul>' : '<p class="muted small">ضيف الكتاب أو الكورس اللي بتذاكر منه، وهيظهر مع مهام المعيار ده.</p>'}
          <form data-form="addSrc" data-std="${id}" class="row"><input name="text" required placeholder="مثال: Kaplan Study Text — الفصل 9" style="flex:2 1 220px"><input name="url" type="url" placeholder="رابط (اختياري)" class="ltr" style="flex:1 1 160px"><button type="submit">إضافة</button></form>
          <p class="note">نص المعيار الرسمي: <a href="https://www.ifrs.org/issued-standards/list-of-standards/" target="_blank" rel="noopener">IFRS Foundation ↗</a></p></div></section>
        <section><div class="row between"><h2>المهام (${tasks.filter(t => t.status === 'done').length}/${tasks.length})</h2></div>
          ${tasks.length ? '<div class="list">' + tasks.map(t => `<div class="item${t.status === 'done' ? ' is-done' : ''}">${A.statusBadge(t, today)}<div class="main"><div class="title">${esc(t.title)}</div><div class="sub">${A.taskMeta(t, today)}</div></div><button type="button" class="btn-sm" data-act="editTask" data-id="${t.id}">تعديل</button></div>`).join('') + '</div>' : '<p class="muted">مفيش مهام مرتبطة.</p>'}</section>
        <section><div class="row between"><h2>البطاقات (${cards.length})</h2><button type="button" class="btn-sm" data-act="cardsFor" data-std="${id}">راجع بطاقات المعيار</button></div>
          <p class="small muted">${cc.due} مستحقة · ${cc.weak} ضعيفة · ${cc.fresh} جديدة</p></section>
        <section><div class="row between"><h2>الأسئلة (${qs.length})</h2>${qs.length ? `<button type="button" class="btn-sm" data-act="quickQ" data-std="${id}">سؤال تدريبي</button>` : ''}</div>
          ${qs.length ? '<div class="list">' + qs.map(q => A.qRow(q, today)).join('') + '</div>' : '<p class="muted">مفيش أسئلة لسه. تقدر تضيف من قسم الأسئلة.</p>'}</section>
        <section><h2>الأخطاء (${ms.length})</h2>${ms.length ? '<div class="list">' + ms.map(m => A.mistakeRow(m, today)).join('') + '</div>' : '<p class="muted">مفيش أخطاء متسجلة على المعيار ده.</p>'}</section>`;
    }
  };
  A.act.covToggle = el => A.commit(S => { const c = S.coverage[el.dataset.std] = S.coverage[el.dataset.std] || {}; c[el.dataset.k] = el.checked; });
  A.act.addSrc = f => { const v = Object.fromEntries(new FormData(f)); A.commit(S => { (S.stdSources[f.dataset.std] = S.stdSources[f.dataset.std] || []).push({ text: v.text.trim(), url: /^https?:\/\//.test(v.url) ? v.url.trim() : '' }); }); };
  A.act.delSrc = el => A.commit(S => { S.stdSources[el.dataset.std].splice(+el.dataset.i, 1); });
  A.act.cardsFor = el => { A.mem.cf = Object.assign({}, A.mem.cf || {}, { std: el.dataset.std, state: '' }); A.S.cards.queue = null; A.go('cards'); };

  // ---------- البطاقات ----------
  function filtered(today) {
    const f = A.mem.cf || {}, S = A.S;
    const qtxt = (f.q || '').trim().toLowerCase();
    return A.study.allCards(S, C).filter(c => {
      if (f.std && c.std !== f.std) return false;
      if (f.state) { const lv = A.srs.level(S.cards.srs[c.id], today); if (f.state === 'due' ? !(lv === 'due' || lv === 'overdue') : lv !== f.state) return false; }
      if (qtxt && !(c.q + ' ' + c.a + ' ' + A.stdCode(c.std) + ' ' + (S.cards.notes[c.id] || '')).toLowerCase().includes(qtxt)) return false;
      return true;
    });
  }
  const fkey = () => JSON.stringify(A.mem.cf || {});
  function queue(today) {
    const S = A.S, cards = filtered(today);
    let q = S.cards.queue;
    if (!q || q.day !== today || q.fkey !== fkey()) {
      q = S.cards.queue = { ids: A.srs.buildQueue(cards, S.cards.srs, today), idx: 0, day: today, fkey: fkey() };
      A.store.save(S);
    }
    return q;
  }
  const LEVEL = { new: 'جديدة', due: 'مستحقة', overdue: 'متأخرة', weak: 'ضعيفة', learning: 'بتتعلمها', strong: 'متمكن منها' };
  const preview = (s, g, today) => { const n = A.srs.review(s, g, today); return n.interval === 0 ? 'تاني النهارده' : n.interval === 1 ? 'بكرة' : 'بعد ' + n.interval + ' يوم'; };

  A.views.cards = {
    title: 'البطاقات',
    render(arg, today) {
      const S = A.S, f = A.mem.cf || {}, q = queue(today), all = A.study.allCards(S, C);
      const cc = A.srs.counts(all, S.cards.srs, today);
      const id = q.ids[q.idx], c = id && all.find(x => x.id === id);
      const s = c && S.cards.srs[c.id], lv = c ? A.srs.level(s, today) : null;
      const open = A.mem.reveal === id;
      const listMode = A.mem.cardList;
      return `<div class="head"><div><h1>بطاقات المراجعة</h1><p class="muted"><span class="num">${cc.due}</span> مستحقة · <span class="num">${cc.weak}</span> ضعيفة · <span class="num">${cc.fresh}</span> جديدة · <span class="num">${cc.total}</span> إجمالي</p></div>
        <div class="row"><button type="button" class="btn-sm" data-act="cardEdit" data-id="">+ بطاقة جديدة</button><button type="button" class="btn-sm" data-act="cardList" aria-pressed="${!!listMode}">${listMode ? 'وضع المراجعة' : 'كل البطاقات'}</button></div></div>
        <p class="note">البطاقات ملخصات للمراجعة السريعة، مش منهج كامل ولا بديل عن نص المعيار.</p>
        <div class="panel"><div class="grid4">
          <label>بحث<input type="search" value="${esc(f.q || '')}" data-change="cfSet" data-k="q" placeholder="كلمة أو معيار"></label>
          <label>المعيار<select data-change="cfSet" data-k="std">${A.stdOptions(f.std, true)}</select></label>
          <label>الحالة<select data-change="cfSet" data-k="state"><option value="">الكل</option>${['due', 'weak', 'new', 'learning', 'strong'].map(k => `<option value="${k}"${f.state === k ? ' selected' : ''}>${LEVEL[k]}</option>`).join('')}</select></label>
          <div class="stack" style="justify-content:flex-end"><button type="button" data-act="cardsReshuffle">↻ رتّب من جديد</button></div></div></div>
        ${listMode ? cardTable(today) : c ? `<section class="panel flash" aria-live="polite">
          <div class="row between"><span class="chip acc ltr">${esc(A.stdCode(c.std))}</span><span class="small muted"><span class="num">${q.idx + 1} / ${q.ids.length}</span> · ${LEVEL[lv]}${c.origin !== 'seed' ? ' · أضفتها انت' : ''}${c.needsReview ? ' · <span class="chip warn">يحتاج مراجعة</span>' : ''}</span></div>
          <p class="q">${esc(c.q)}</p>
          ${open ? `<div class="a"><p>${esc(c.a)}</p>
            ${c.conditions ? `<p><b>شروط التطبيق:</b> ${esc(c.conditions)}</p>` : ''}
            ${c.example ? `<p><b>مثال:</b> ${esc(c.example)}</p>` : ''}
            ${c.exceptions ? `<p><b>استثناءات مهمة:</b> ${esc(c.exceptions)}</p>` : ''}
            ${c.source ? `<p class="small muted">المصدر: ${esc(c.source)}</p>` : ''}</div>
            <div class="rate" role="group" aria-label="قيّم تذكرك">
              <button type="button" data-act="rate" data-g="0">نسيت<small>${preview(s, 0, today)}</small></button>
              <button type="button" data-act="rate" data-g="3">صعبة<small>${preview(s, 3, today)}</small></button>
              <button type="button" data-act="rate" data-g="4" class="btn-main">جيدة<small style="color:inherit">${preview(s, 4, today)}</small></button>
              <button type="button" data-act="rate" data-g="5">سهلة<small>${preview(s, 5, today)}</small></button></div>
            <label>ملاحظتك<textarea data-change="cardNote" data-id="${c.id}" placeholder="اكتب اللي بيلخبطك في النقطة دي">${esc(S.cards.notes[c.id] || '')}</textarea></label>
            ${s && s.last ? `<p class="small muted">آخر مراجعة ${U.fmtDate(s.last)} · الموعد الجاي ${U.fmtDate(s.due)} · نسيتها ${s.lapses} مرة</p>` : ''}`
          : `<div class="row"><button type="button" class="btn-main" data-act="reveal" data-id="${c.id}">اكشف الإجابة</button><button type="button" data-act="cardSkip">تخطّى</button></div>`}
          <div class="row"><button type="button" class="btn-sm btn-ghost" data-act="cardEdit" data-id="${c.id}">تعديل البطاقة</button></div></section>`
        : `<div class="panel"><p><b>خلصت الطابور ✓</b></p><p class="muted">${q.ids.length ? 'راجعت كل البطاقات في الفلتر ده.' : 'مفيش بطاقات بالفلتر ده.'} البطاقات المستحقة الجاية هتظهر في موعدها.</p><button type="button" data-act="cardsReshuffle">ابدأ طابور جديد</button></div>`}`;
    }
  };

  function cardTable(today) {
    const S = A.S, list = filtered(today);
    return `<div class="table-wrap"><table><thead><tr><th>المعيار</th><th>السؤال</th><th>الحالة</th><th>الموعد الجاي</th><th></th></tr></thead><tbody>
      ${list.map(c => { const s = S.cards.srs[c.id]; return `<tr><td class="ltr">${esc(A.stdCode(c.std))}</td><td>${esc(c.q)}</td><td>${LEVEL[A.srs.level(s, today)]}</td><td class="num">${s && s.due ? U.fmtDate(s.due) : '—'}</td><td><button type="button" class="btn-sm" data-act="cardEdit" data-id="${c.id}">تعديل</button></td></tr>`; }).join('')}
      </tbody></table></div>`;
  }

  A.act.cfSet = el => { A.mem.cf = Object.assign({}, A.mem.cf || {}, { [el.dataset.k]: el.value }); A.mem.reveal = null; A.render(); };
  A.act.cardsReshuffle = () => { A.S.cards.queue = null; A.mem.reveal = null; A.store.save(A.S); A.render(); };
  A.act.cardList = () => { A.mem.cardList = !A.mem.cardList; A.render(); };
  A.act.reveal = el => { A.mem.reveal = el.dataset.id; A.render(); const b = document.querySelector('.rate button.btn-main'); if (b) b.focus(); };
  A.act.cardSkip = () => A.commit(S => { S.cards.queue.idx++; A.mem.reveal = null; });
  A.act.cardNote = el => A.commit(S => { const v = el.value.trim(); if (v) S.cards.notes[el.dataset.id] = v; else delete S.cards.notes[el.dataset.id]; }, { render: false });
  A.act.rate = el => {
    const g = +el.dataset.g, today = U.today();
    A.commit(S => {
      const q = S.cards.queue, id = q.ids[q.idx];
      S.cards.srs[id] = A.srs.review(S.cards.srs[id], g, today);
      if (g === 0) q.ids.push(id); // ترجع آخر نفس الجلسة
      q.idx++;
      A.mem.reveal = null;
    });
  };

  A.act.cardEdit = el => {
    const id = el.dataset.id, S = A.S;
    const c = id ? A.study.allCards(S, C).find(x => x.id === id) : null;
    const seed = c && c.origin === 'seed';
    A.dialog(`<form><h2 id="dlg-title">${c ? 'تعديل البطاقة' : 'بطاقة جديدة'}</h2>
      <label>المعيار<select name="std">${A.stdOptions(c ? c.std : (A.mem.cf || {}).std)}</select></label>
      <label>السؤال<textarea name="q" required>${esc(c ? c.q : '')}</textarea></label>
      <label>الإجابة<textarea name="a" required>${esc(c ? c.a : '')}</textarea></label>
      <label>شروط التطبيق (اختياري)<textarea name="conditions">${esc(c ? c.conditions || '' : '')}</textarea></label>
      <label>مثال (اختياري)<textarea name="example">${esc(c ? c.example || '' : '')}</textarea></label>
      <label>استثناءات مهمة (اختياري)<textarea name="exceptions">${esc(c ? c.exceptions || '' : '')}</textarea></label>
      ${seed ? '<p class="note">دي بطاقة من المحتوى الأساسي. تعديلك بيتحفظ عندك وتقدر ترجع للأصل.</p>' : ''}
      <div class="row"><button type="submit" class="btn-main">حفظ</button>${seed && c.edited ? `<button type="button" data-act="cardRevert" data-id="${c.id}">رجّع للأصل</button>` : ''}${c && !seed ? `<button type="button" class="btn-danger" data-act="cardDel" data-id="${c.id}">حذف</button>` : ''}<button type="button" data-act="closeDlg">إلغاء</button></div></form>`,
    f => {
      const v = Object.fromEntries(new FormData(f)); A.closeDialog();
      const data = { std: v.std, q: v.q.trim(), a: v.a.trim(), conditions: v.conditions.trim(), example: v.example.trim(), exceptions: v.exceptions.trim() };
      A.commit(S2 => {
        if (seed) S2.cards.edits[c.id] = data;
        else if (c) Object.assign(S2.cards.custom.find(x => x.id === c.id), data);
        else S2.cards.custom.push(Object.assign({ id: U.uid('uc'), origin: 'user', source: 'أضفتها انت' }, data));
        S2.cards.queue = null;
      });
      A.toast('اتحفظت البطاقة.');
    });
  };
  A.act.cardRevert = el => { A.closeDialog(); A.commit(S => { delete S.cards.edits[el.dataset.id]; }); };
  A.act.cardDel = el => { A.closeDialog(); A.confirmInPage('حذف البطاقة؟', 'هتتشال البطاقة وسجل مراجعتها.', 'احذف', () => A.commit(S => { S.cards.custom = S.cards.custom.filter(x => x.id !== el.dataset.id); delete S.cards.srs[el.dataset.id]; S.cards.queue = null; }), true); };
})(globalThis.App = globalThis.App || {});
