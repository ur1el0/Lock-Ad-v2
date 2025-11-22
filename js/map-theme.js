const savedTheme = localStorage.getItem('lockad_theme') || 'dark';
if (savedTheme === 'light')
{
  document.body.classList.add('light-mode');
}

window.ROUTING_PROVIDER = 'auto';
window.ORS_API_KEY = '';
window.PSGC_API_URL = '';
