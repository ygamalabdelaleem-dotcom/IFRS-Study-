/* التقدم: الالتزام · التغطية · الإتقان · المراجعة + الملخص الأسبوعي */
(function (A) {
  'use strict';
  const U = A.util, esc = U.esc, C = A.content;
  const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;

  A.views.progress = {
    title: 'التقدم',
    render(arg, today) {
      const S = A.S, stds = A.qualStds();
      const c7 = A.study.commitment(S, today, 7), c30 = A.study.commitment(S, today, 30);
      const cov = A.study.coverage(S, stds.map(s => s.id)), pp = A.study.planProgress(S);
      const n = k => stds.filter(s => cov[s.id][k]).length;
      const mAll = A.study.mastery(S, null, today);
      const cc = A.srs.counts(A.study.allCards(S, C), S.cards.srs, today);
      const md = A.study.mistakesDue(S, today);
      const wk = A.study.weekly(S, today);
      const days = U.range(U.add(today, -13), today);
      const mins = days.map(d => Math.round(S.sessions.filter(s => s.day === d).reduce((a, s) => a + s.activeMs / 60000, 0)));
      const maxM = Math.max(30, ...mins);
      const legacy = S.meta.migratedFrom && S.meta.migratedFrom.legacySessionsToday;
      return `<div class="head"><div><h1>التقدم</h1><p class="muted">أربع مؤشرات منفصلة. ولا واحد منهم نسبة استعداد للامتحان.</p></div></div>

        <section class="panel"><h2>الملخص الأسبوعي</h2><p class="small muted">${U.fmtDate(wk.from, { day: 'numeric', month: 'short' })} – ${U.fmtDate(wk.to, { day: 'numeric', month: 'short' })}</p>
          <div class="grid4">${stat(wk.done + '/' + wk.planned, 'مهام الأسبوع المنجزة')}${stat(U.fmtMin(wk.actualMin), 'وقت فعلي (المخطط ' + U.fmtMin(wk.plannedMin) + ')')}${stat(wk.attempts ? wk.correct + '/' + wk.attempts : '—', 'أسئلة صح من المحلولة')}${stat(wk.newMistakes, 'أخطاء جديدة')}</div>
          <p>${wk.weak.length ? 'نقاط محتاجة اهتمام: ' + wk.weak.map(id => `<a href="#std-${id}" class="ltr">${esc(A.stdCode(id))}</a>`).join('، ') : 'مفيش نقاط ضعف واضحة الأسبوع ده (أو البيانات لسه قليلة).'}</p></section>

        <section><h2>أ) الالتزام</h2>
          <div class="grid4">${stat(c7.days + '/' + c7.plannedDays, 'أيام ذاكرت فيها من أيام المذاكرة (آخر 7)')}${stat(c7.sessions, 'جلسات مكتملة (آخر 7)')}${stat(U.fmtMin(c7.minutes), 'وقت فعلي (آخر 7)')}${stat(U.fmtMin(c30.minutes), 'وقت فعلي (آخر 30)')}</div>
          <div class="panel"><div class="bars" role="img" aria-label="دقائق المذاكرة في آخر 14 يوم">${days.map((d, i) => `<div title="${U.fmtDate(d)}: ${mins[i]} دقيقة"><small class="num">${mins[i] || ''}</small><i style="height:${(mins[i] / maxM) * 85}%"></i><small>${U.fmtDate(d, { day: 'numeric' })}</small></div>`).join('')}</div></div>
          ${legacy ? `<p class="note">من النسخة الأولى: ${legacy} جلسة متسجلة بدون مدة، فمش داخلة في الدقائق.</p>` : ''}</section>

        <section><h2>ب) التغطية</h2>
          <div class="grid4">${stat(pp.total ? Math.round(pp.done / pp.total * 100) + '%' : '—', 'من مهام الخطة مكتمل (' + pp.done + '/' + pp.total + ')')}${stat(n('explained') + '/' + stds.length, 'معايير فهمتها')}${stat(n('practiced') + '/' + stds.length, 'معايير تدرّبت عليها')}${stat(n('reviewed') + '/' + stds.length, 'معايير راجعتها')}</div></section>

        <section><h2>ج) الإتقان</h2>
          <div class="panel">${mAll.enough ? `<p>إجمالي آخر ${mAll.n} محاولة مصححة: <b class="num">${mAll.pct}%</b></p>` : `<p><b>بيانات غير كافية</b> — محتاج ${A.study.MIN_ATTEMPTS} محاولات مصححة على الأقل (عندك ${mAll.n}).</p>`}
          <div class="table-wrap"><table><thead><tr><th>المعيار</th><th>الإتقان</th><th>المحاولات</th></tr></thead><tbody>${stds.map(s => { const m = A.study.mastery(S, s.id, today); return m.n ? `<tr><td class="ltr"><a href="#std-${s.id}">${esc(s.code)}</a></td><td>${m.enough ? '<span class="num">' + m.pct + '%</span>' : '<span class="muted">بيانات غير كافية</span>'}</td><td class="num">${m.n}</td></tr>` : ''; }).join('') || '<tr><td colspan="3" class="muted">لسه مفيش محاولات.</td></tr>'}</tbody></table></div></div></section>

        <section><h2>د) المراجعة</h2>
          <div class="grid4">${stat(cc.due, 'بطاقات مستحقة')}${stat(cc.overdue, 'منها متأخرة')}${stat(cc.weak, 'بطاقات ضعيفة')}${stat(md.length, 'أخطاء مستحق إعادة محاولتها')}</div></section>

        <details class="panel"><summary><b>طريقة الحساب</b></summary><ul class="small">
          <li><b>الالتزام:</b> من جلسات التايمر الفعلية بس. الوقت = وقت التشغيل الفعلي بدون فترات التوقف المؤقت. الجلسة المكتملة = التايمر وصل للصفر. الاستراحات مش محسوبة. "أيام المذاكرة" = الأيام اللي حطيت لها وقت في الإعدادات من تاريخ البداية.</li>
          <li><b>التغطية:</b> نسبة مهام الخطة المكتملة (من غير المهام المحذوفة). المعيار يتعلم "فهمت/تدرّبت/راجعت" لما تخلص مهمة شرح/تدريب/مراجعة عليه أو تعلمه يدويًا — ده تقييم ذاتي.</li>
          <li><b>الإتقان:</b> مجموع درجاتك ÷ الدرجات الكاملة لآخر 10 محاولات مصححة خلال 60 يوم (الكتابي بالتصحيح الذاتي). لو أقل من ${A.study.MIN_ATTEMPTS} محاولات بيظهر "بيانات غير كافية". الأسئلة تدريبية، فالنسبة مؤشر مش توقع لنتيجة الامتحان.</li>
          <li><b>المراجعة:</b> البطاقات اللي موعدها (حسب SM-2) النهارده أو فات، والأخطاء اللي موعد إعادة محاولتها جه.</li></ul></details>`;
    }
  };
})(globalThis.App = globalThis.App || {});
