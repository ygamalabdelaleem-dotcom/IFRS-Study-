/*
  التايمر: الوقت المتبقي يُحسب دائمًا من توقيت الانتهاء الفعلي (endAt) وليس بالعد التنازلي مع setInterval،
  فيفضل صحيح بعد خمول التبويب أو سكون الجهاز أو تحديث الصفحة.
  الدوال نقية: تاخد حالة وترجع حالة جديدة.
*/
(function (A) {
  'use strict';

  function create(kind, minutes, taskId, std) {
    const ms = Math.round(minutes * 60000);
    return { state: 'idle', kind: kind === 'break' ? 'break' : 'focus', plannedMs: ms, remainingMs: ms, endAt: null, segStart: null, activeMs: 0, startedAt: null, finishedAt: null, taskId: taskId || null, std: std || '', counted: false, sessionId: null, awaitingOutcome: false };
  }

  function remaining(t, now) {
    if (!t) return 0;
    if (t.state === 'running') return Math.max(0, t.endAt - now);
    if (t.state === 'finished') return 0;
    return Math.max(0, t.remainingMs);
  }

  // تشغيل من الصفر (لو الجلسة السابقة خلصت يبدأ بالوقت الكامل من جديد)
  function start(t, now) {
    const base = (!t || t.state === 'finished') ? create(t ? t.kind : 'focus', (t ? t.plannedMs : 12e5) / 60000, t && t.taskId, t && t.std) : Object.assign({}, t);
    if (base.state === 'running') return base;
    if (base.state === 'paused') return resume(base, now);
    base.state = 'running'; base.startedAt = now; base.segStart = now; base.endAt = now + base.remainingMs; base.activeMs = 0; base.counted = false; base.finishedAt = null;
    return base;
  }

  function pause(t, now) {
    if (!t || t.state !== 'running') return t;
    const end = Math.min(now, t.endAt);
    return Object.assign({}, t, { state: 'paused', remainingMs: Math.max(0, t.endAt - now), activeMs: t.activeMs + Math.max(0, end - t.segStart), segStart: null, endAt: null });
  }

  function resume(t, now) {
    if (!t || t.state !== 'paused') return t;
    return Object.assign({}, t, { state: 'running', segStart: now, endAt: now + t.remainingMs });
  }

  // لو الوقت خلص: نقفل الجلسة مرة واحدة فقط. الوقت الفعلي لا يتعدى لحظة الانتهاء حتى لو الجهاز كان نايم.
  function check(t, now) {
    if (!t || t.state !== 'running' || now < t.endAt) return { t, finished: false };
    const activeMs = t.activeMs + Math.max(0, t.endAt - t.segStart);
    return { t: Object.assign({}, t, { state: 'finished', remainingMs: 0, activeMs, segStart: null, finishedAt: t.endAt }), finished: true };
  }

  // إلغاء: يرجع للبداية، ويرجّع الوقت الفعلي اللي اتذاكر عشان يتسجل كجلسة جزئية
  function cancel(t, now) {
    if (!t) return { t, activeMs: 0 };
    let activeMs = t.activeMs;
    if (t.state === 'running') activeMs += Math.max(0, Math.min(now, t.endAt) - t.segStart);
    if (t.state === 'finished') activeMs = 0; // اتسجلت قبل كده
    return { t: create(t.kind, t.plannedMs / 60000, t.taskId, t.std), activeMs };
  }

  // إعادة الضبط: بدون تسجيل أي وقت
  function reset(t) { return t ? create(t.kind, t.plannedMs / 60000, t.taskId, t.std) : t; }

  function elapsedActive(t, now) {
    if (!t) return 0;
    if (t.state === 'running') return t.activeMs + Math.max(0, Math.min(now, t.endAt) - t.segStart);
    return t.activeMs;
  }

  A.timer = { create, remaining, start, pause, resume, check, cancel, reset, elapsedActive };
})(globalThis.App = globalThis.App || {});
