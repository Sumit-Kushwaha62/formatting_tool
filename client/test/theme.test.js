import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DARK_THEME,
  LIGHT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveStorageEventTheme,
  resolveThemePreference,
  writeStoredTheme,
} from '../src/theme/themeUtils.js';

const darkSystem = () => ({ matches: true });
const lightSystem = () => ({ matches: false });

test('missing preference follows the system theme', () => {
  assert.deepEqual(resolveThemePreference({ storage: null, matchMedia: darkSystem }), {
    theme: DARK_THEME,
    hasExplicitPreference: false,
  });
  assert.deepEqual(resolveThemePreference({ storage: null, matchMedia: lightSystem }), {
    theme: LIGHT_THEME,
    hasExplicitPreference: false,
  });
});

test('valid stored preference overrides the system and invalid values do not', () => {
  const darkStorage = { getItem: () => DARK_THEME };
  const invalidStorage = { getItem: () => 'sepia' };

  assert.deepEqual(resolveThemePreference({ storage: darkStorage, matchMedia: lightSystem }), {
    theme: DARK_THEME,
    hasExplicitPreference: true,
  });
  assert.equal(readStoredTheme(invalidStorage), null);
  assert.deepEqual(resolveThemePreference({ storage: invalidStorage, matchMedia: darkSystem }), {
    theme: DARK_THEME,
    hasExplicitPreference: false,
  });
});

test('storage failures fall back safely and writes never throw', () => {
  const throwingStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };

  assert.deepEqual(resolveThemePreference({ storage: throwingStorage, matchMedia: darkSystem }), {
    theme: DARK_THEME,
    hasExplicitPreference: false,
  });
  assert.equal(writeStoredTheme(throwingStorage, LIGHT_THEME), false);
  assert.equal(writeStoredTheme(null, DARK_THEME), false);
  assert.equal(writeStoredTheme({ setItem() {} }, 'invalid'), false);
});

test('storage events synchronize valid values and resume system mode when cleared', () => {
  assert.deepEqual(resolveStorageEventTheme(LIGHT_THEME, darkSystem), {
    theme: LIGHT_THEME,
    hasExplicitPreference: true,
  });
  assert.deepEqual(resolveStorageEventTheme(null, darkSystem), {
    theme: DARK_THEME,
    hasExplicitPreference: false,
  });
});

test('theme application updates the root attribute and native color scheme', () => {
  const root = { dataset: {}, style: {} };
  assert.equal(applyTheme(root, DARK_THEME), true);
  assert.equal(root.dataset.theme, DARK_THEME);
  assert.equal(root.style.colorScheme, DARK_THEME);
  assert.equal(applyTheme(root, 'invalid'), false);
});

test('theme persistence uses the product-specific key', () => {
  const writes = [];
  const storage = { setItem: (...args) => writes.push(args) };
  assert.equal(writeStoredTheme(storage, LIGHT_THEME), true);
  assert.deepEqual(writes, [[THEME_STORAGE_KEY, LIGHT_THEME]]);
});
