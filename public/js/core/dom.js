// public/js/core/dom.js
// Helpers DOM globaux + mirroring dans window.HOL
(function () {
  // Accepte: "#id" / ".class" / "div > span"  OU  "id" nu sans '#'
  const pick = (s, root = document) => {
    if (!s) return null;
    const looksLikeSelector = s.startsWith('#') || s.startsWith('.') || /[>\[\]:\s]/.test(s);
    return looksLikeSelector ? root.querySelector(s) : root.getElementById(s);
  };
  const pickAll = (s, root = document) => {
    if (!s) return [];
    const looksLikeSelector = s.startsWith('#') || s.startsWith('.') || /[>\[\]:\s]/.test(s);
    return looksLikeSelector ? Array.from(root.querySelectorAll(s)) : (root.getElementById(s) ? [root.getElementById(s)] : []);
  };
  const on = (el, type, handler, opts) => el && el.addEventListener(type, handler, opts);

  // Expose global
  window.$  = pick;
  window.$$ = pickAll;
  window.on = on;

  // Expose aussi dans window.HOL (ton code fait: const { $, … } = window.HOL)
  window.HOL = window.HOL || {};
  window.HOL.$  = window.HOL.$  || pick;
  window.HOL.$$ = window.HOL.$$ || pickAll;
  window.HOL.on = window.HOL.on || on;
})();
