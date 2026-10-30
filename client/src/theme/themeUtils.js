export const THEME_STORAGE_KEY = 'format-studio-theme';
export const LIGHT_THEME = 'light';
export const DARK_THEME = 'dark';

export function isValidTheme(value) {
  return value === LIGHT_THEME || value === DARK_THEME;
}

export function readStoredTheme(storage) {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isValidTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(matchMedia) {
  try {
    return matchMedia?.('(prefers-color-scheme: dark)').matches
      ? DARK_THEME
      : LIGHT_THEME;
  } catch {
    return LIGHT_THEME;
  }
}

export function resolveThemePreference({ storage, matchMedia } = {}) {
  const storedTheme = readStoredTheme(storage);
  return {
    theme: storedTheme || getSystemTheme(matchMedia),
    hasExplicitPreference: Boolean(storedTheme),
  };
}

export function resolveStorageEventTheme(value, matchMedia) {
  return isValidTheme(value)
    ? { theme: value, hasExplicitPreference: true }
    : { theme: getSystemTheme(matchMedia), hasExplicitPreference: false };
}

export function writeStoredTheme(storage, theme) {
  if (!isValidTheme(theme)) return false;
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
    return Boolean(storage);
  } catch {
    return false;
  }
}

export function applyTheme(root, theme) {
  if (!root || !isValidTheme(theme)) return false;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  return true;
}
