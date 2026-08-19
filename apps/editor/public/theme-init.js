// Apply the saved theme before first paint to avoid a flash. Lives in an
// external file (not inline) so the CSP can stay strict: script-src 'self'.
try {
  if (localStorage.getItem('altweb.editor.theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch {
  /* storage unavailable — default to light */
}
