const savedTheme = localStorage.getItem('lockad_theme') || 'dark';
if (savedTheme === 'light') 
{
  document.body.classList.add('light-mode');
}

document.addEventListener('DOMContentLoaded', function () {
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    if (!themeToggle) return;

    if (savedTheme === 'light') 
    {
        body.classList.add('light-mode');
        themeToggle.classList.remove('active');
    }


    themeToggle.addEventListener('click', () => {
    const isLight = body.classList.contains('light-mode');
    if (isLight)
    {
        body.classList.remove('light-mode');
        themeToggle.classList.add('active');
        localStorage.setItem('lockad_theme', 'dark');
    } 
    else 
    {
        body.classList.add('light-mode');
        themeToggle.classList.remove('active');
        localStorage.setItem('lockad_theme', 'light');
    }
  });
});
