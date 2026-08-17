const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createTheme(systemDark = false) {
  const storage = new Map();
  const buttons = ['light', 'dark', 'system'].map(choice => ({
    dataset: { themeChoice: choice },
    classList: { toggle() {} },
    setAttribute() {},
    addEventListener() {}
  }));
  const documentElement = { dataset: {}, style: {} };
  const context = vm.createContext({
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    document: { documentElement, querySelectorAll: () => buttons },
    window: { matchMedia: () => ({ matches: systemDark, addEventListener() {} }) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'theme.js'), 'utf8'), context);
  return { evaluate: expression => vm.runInContext(expression, context), documentElement, storage };
}

test('uses the operating-system preference by default', () => {
  assert.equal(createTheme(true).documentElement.dataset.theme, 'dark');
  assert.equal(createTheme(false).documentElement.dataset.theme, 'light');
});

test('persists an explicit theme choice', () => {
  const theme = createTheme(false);
  theme.evaluate(`Theme.set('dark')`);
  assert.equal(theme.documentElement.dataset.theme, 'dark');
  assert.equal(theme.storage.get('gedic_theme'), 'dark');
});
