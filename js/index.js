document.addEventListener('DOMContentLoaded', function () {
  var startBtn = document.getElementById('startBtn');
  if (!startBtn) return;

  startBtn.addEventListener('click', function ()
  {
    window.location.href = 'pages/map-fastest.html';
  });
});