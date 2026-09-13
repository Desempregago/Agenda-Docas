export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'agendadocas_theme';
const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function systemPrefersDark(): boolean {
  return Boolean(media?.matches);
}

/** Applies (or removes) the .dark class on <html> according to the resolved theme. */
export function applyTheme(pref: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', dark);
}

export function getStoredTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // localStorage indisponível (modo privado restrito) — cai para o padrão
  }
  return 'system';
}

/** Persists the preference and applies it immediately. */
export function setTheme(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, themeStorageValue(pref));
  } catch {
    // Sem persistência: aplica só para esta sessão de página
  }
  applyTheme(pref);
}

function themeStorageValue(pref: ThemePreference): string {
  return pref;
}

/** Default = system, com reação ao SO. Chamar uma vez na montagem do App. */
export function initTheme(): void {
  const pref = getStoredTheme();
  applyTheme(pref);
  if (pref === 'system' && media) {
    media.addEventListener('change', onSystemChange);
  }
}

function onSystemChange(): void {
  if (getStoredTheme() === 'system') applyTheme('system');
}

/** Cycle used by the header toggle: system → light → dark → system. */
export function nextTheme(current: ThemePreference): ThemePreference {
  return current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
}
