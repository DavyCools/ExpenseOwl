(function() {
    const theme = localStorage.getItem('theme') || 'system';
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();