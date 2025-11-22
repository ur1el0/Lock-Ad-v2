const savedTheme = localStorage.getItem('lockad_theme') || 'dark';
if (savedTheme === 'light') 
{
  document.body.classList.add('light-mode');
}
