export type ThemePreference = 'light' | 'dark';

const THEME_KEY = 'agendadocas_theme';

/** Applies (or removes) the .dark class on <html> according to the resolved theme. */
export function applyTheme(pref: ThemePreference): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', pref === 'dark');
}

export function getStoredTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    // Preferências antigas ('system') migram para o novo padrão: claro.
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage indisponível (modo privado restrito) — cai para o padrão
  }
  return 'light';
}

/** Persists the preference and applies it immediately. */
export function setTheme(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Sem persistência: aplica só para esta sessão de página
  }
  applyTheme(pref);
}

/** Aplica o tema salvo (padrão: claro). Chamar uma vez na montagem do App. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
}
