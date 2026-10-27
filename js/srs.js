/*
  المراجعة المتباعدة — مبنية على خوارزمية SM-2 (Piotr Woźniak، 1987) مع تعديل بسيط للأزرار الأربعة:
  التقييم q:  نسيت = 0 · صعبة = 3 · جيدة = 4 · سهلة = 5
  - معامل السهولة EF' = EF + (0.1 − (5−q) × (0.08 + (5−q) × 0.02))، وأقل قيمة 1.3
  - نسيت: التكرار يرجع صفر، الفاصل 0 (البطاقة ترجع آخر نفس الجلسة)، ويزيد عدد مرات النسيان
  - المراجعة الأولى الناجحة بعد يوم، التانية بعد 6 أيام، وبعدها الفاصل × EF
  - صعبة: الفاصل × 1.2 فقط (مش × EF) · سهلة: الفاصل × 1.3 إضافي (والأولى بعد 3 أيام)
*/
(function (A) {
  'use strict';
  const U = A.util;
  const GRADES = { again: 0, hard: 3, good: 4, easy: 5 };

  function blank() { return { ef: 2.5, reps: 0, interval: 0, lapses: 0, due: null, last: null, history: [] }; }

  function review(s, q, today) {
    s = Object.assign(blank(), s || {});
    const ef = Math.max(1.3, s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    let reps = s.reps, interval = s.interval, lapses = s.lapses;
    if (q < 3) { reps = 0; interval = 0; lapses += 1; }
    else {
      reps += 1;
      if (q === 3) interval = reps === 1 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2));
      else {
        interval = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(interval * ef);
        if (q === 5) interval = reps === 1 ? 3 : Math.round(interval * 1.3);
      }
    }
    const history = s.history.concat([{ d: today, q }]).slice(-50);
    return { ef: Math.round(ef * 100) / 100, reps, interval, lapses, due: U.add(today, interval), last: today, history };
  }

  function level(s, today) {
    if (!s || !s.last) return 'new';
    if (s.due <= today) return s.due < today ? 'overdue' : 'due';
    if (s.lapses >= 2 || s.ef < 2.0) return 'weak';
    if (s.interval >= 21) return 'strong';
    return 'learning';
  }
  const isWeak = s => !!s && !!s.last && (s.lapses >= 2 || s.ef < 2.0);

  // ترتيب الطابور: المستحقة (الأقدم أولًا) ← الضعيفة ← الجديدة ← الباقي مخلوط
  function buildQueue(cards, srs, today, rnd) {
    const due = [], weak = [], fresh = [], rest = [];
    cards.forEach(c => {
      const s = srs[c.id];
      if (!s || !s.last) fresh.push(c);
      else if (s.due <= today) due.push(c);
      else if (isWeak(s)) weak.push(c);
      else rest.push(c);
    });
    due.sort((a, b) => (srs[a.id].due < srs[b.id].due ? -1 : srs[a.id].due > srs[b.id].due ? 1 : srs[b.id].lapses - srs[a.id].lapses));
    weak.sort((a, b) => srs[b.id].lapses - srs[a.id].lapses);
    return due.concat(weak, fresh, U.shuffle(rest, rnd)).map(c => c.id);
  }

  function counts(cards, srs, today) {
    let due = 0, overdue = 0, fresh = 0, weak = 0;
    cards.forEach(c => { const s = srs[c.id]; if (!s || !s.last) fresh++; else { if (s.due <= today) due++; if (s.due < today) overdue++; if (isWeak(s)) weak++; } });
    return { due, overdue, fresh, weak, total: cards.length };
  }

  A.srs = { GRADES, blank, review, level, isWeak, buildQueue, counts };
})(globalThis.App = globalThis.App || {});
