/* أدوات عامة: تواريخ محلية بصيغة YYYY-MM-DD، معرفات، خلط، تهريب HTML */
(function (A) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const U = {
    ds(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    today(now) { return U.ds(now != null ? new Date(now) : new Date()); },
    // الساعة 12 ظهرًا لتفادي مشاكل التوقيت الصيفي
    parse(s) { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); },
    add(s, n) { const d = U.parse(s); d.setDate(d.getDate() + n); return U.ds(d); },
    diff(a, b) { return Math.round((U.parse(b) - U.parse(a)) / 864e5); }, // b − a بالأيام
    dow(s) { return U.parse(s).getDay(); }, // 0 = الأحد
    isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && U.ds(U.parse(s)) === s; },
    max(a, b) { return a > b ? a : b; },
    min(a, b) { return a < b ? a : b; },
    range(a, b) { const out = []; for (let d = a; d <= b; d = U.add(d, 1)) out.push(d); return out; },
    weekStart(s) { return U.add(s, -((U.dow(s) + 1) % 7)); }, // الأسبوع يبدأ السبت
    uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    // Fisher–Yates
    shuffle(arr, rnd) {
      rnd = rnd || Math.random;
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    },
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    clone(o) { return JSON.parse(JSON.stringify(o)); },
    // أرقام عربية/فارسية ← لاتينية، وحذف الفواصل
    num(s) {
      if (typeof s === 'number') return s;
      const t = String(s || '').replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))
        .replace(/[,،\s]/g, '').replace('٫', '.').replace(/[()]/g, m => (m === '(' ? '-' : ''));
      if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
      return parseFloat(t);
    },
    fmtDate(s, opt) {
      try { return U.parse(s).toLocaleDateString('ar-EG-u-nu-latn', opt || { weekday: 'short', day: 'numeric', month: 'short' }); }
      catch (e) { return s; }
    },
    fmtTime(ts) {
      try { return new Date(ts).toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
    },
    fmtMin(m) {
      m = Math.round(m || 0);
      if (m < 60) return m + ' د';
      const h = Math.floor(m / 60), r = m % 60;
      return h + ' س' + (r ? ' ' + r + ' د' : '');
    },
    clock(ms) {
      const s = Math.max(0, Math.ceil(ms / 1000));
      return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    }
  };
  A.util = U;
})(globalThis.App = globalThis.App || {});
