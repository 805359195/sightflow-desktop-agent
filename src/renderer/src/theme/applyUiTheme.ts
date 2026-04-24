export type UiThemeSetting = 'light' | 'dark' | 'system'

export function resolveUiTheme(theme: UiThemeSetting): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/** 将解析后的亮/暗写到 html[data-ui-mode] 供 CSS 使用 */
export function applyUiTheme(theme: UiThemeSetting): void {
  const resolved = resolveUiTheme(theme)
  document.documentElement.setAttribute('data-ui-mode', resolved)
  document.documentElement.setAttribute('data-ui-theme-pref', theme)
}

export function watchSystemTheme(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
