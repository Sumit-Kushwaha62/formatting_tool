import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  DARK_THEME,
  LIGHT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  isValidTheme,
  resolveStorageEventTheme,
  resolveThemePreference,
  writeStoredTheme,
} from './themeUtils.js';
import ThemeContext from './themeContext.js';

function getBrowserStorage() {
  try {
    return globalThis.window?.localStorage;
  } catch {
    return undefined;
  }
}

function getBrowserMatchMedia() {
  try {
    return globalThis.window?.matchMedia?.bind(globalThis.window);
  } catch {
    return undefined;
  }
}

function getInitialThemeState() {
  const bootstrapped = globalThis.window?.__FORMAT_STUDIO_INITIAL_THEME__;
  if (bootstrapped && isValidTheme(bootstrapped.theme)) {
    return {
      theme: bootstrapped.theme,
      hasExplicitPreference: Boolean(bootstrapped.hasExplicitPreference),
    };
  }

  return resolveThemePreference({
    storage: getBrowserStorage(),
    matchMedia: getBrowserMatchMedia(),
  });
}

export function ThemeProvider({ children }) {
  const [themeState, setThemeState] = useState(getInitialThemeState);
  const { theme, hasExplicitPreference } = themeState;

  useLayoutEffect(() => {
    applyTheme(globalThis.document?.documentElement, theme);
  }, [theme]);

  useEffect(() => {
    if (hasExplicitPreference) return undefined;

    const matchMedia = getBrowserMatchMedia();
    const mediaQuery = matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return undefined;

    const handleSystemChange = (event) => {
      setThemeState({
        theme: event.matches ? DARK_THEME : LIGHT_THEME,
        hasExplicitPreference: false,
      });
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }

    mediaQuery.addListener?.(handleSystemChange);
    return () => mediaQuery.removeListener?.(handleSystemChange);
  }, [hasExplicitPreference]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextState = resolveStorageEventTheme(
        event.newValue,
        getBrowserMatchMedia(),
      );
      applyTheme(globalThis.document?.documentElement, nextState.theme);
      setThemeState(nextState);
    };

    globalThis.window?.addEventListener?.('storage', handleStorage);
    return () => globalThis.window?.removeEventListener?.('storage', handleStorage);
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme() {
      const nextTheme = theme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
      writeStoredTheme(getBrowserStorage(), nextTheme);
      applyTheme(globalThis.document?.documentElement, nextTheme);
      setThemeState({ theme: nextTheme, hasExplicitPreference: true });
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
