// Socket global
(function () {
  window.HOL = window.HOL || {};
  const socket = io();
  window.HOL.socket = socket;
})();
