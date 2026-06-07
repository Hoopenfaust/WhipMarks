const STORAGE_KEY = 'whipmarks-theme'

export type Theme = 'dark' | 'light'

export function getTheme(): Theme {
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'light'
}

export function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
  localStorage.setItem(STORAGE_KEY, theme)
}

export function initTheme() {
  applyTheme(getTheme())
}
