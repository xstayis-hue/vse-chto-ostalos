const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function loadLives() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('content.js', 'utf8'), context);
  return context.window.CURATED_LIVES;
}

test('catalog contains exactly 300 lives', () => {
  assert.equal(loadLives().length, 300);
});

test('all full names are unique', () => {
  const names = loadLives().map((life) => life.name);
  assert.equal(new Set(names).size, names.length);
});

test('every life has six scenes and three decisions', () => {
  for (const life of loadLives()) {
    assert.equal(life.memories.length, 6, life.name);
    assert.equal(life.memories.filter((scene) => scene.choices).length, 3, life.name);
  }
});

test('female surnames agree with female first names', () => {
  const exception = new Set(['Руденко']);
  for (const life of loadLives().filter((item) => item.gender === 'f')) {
    const surname = life.name.split(' ')[1];
    assert.ok(exception.has(surname) || surname.endsWith('а') || surname.endsWith('я'), life.name);
  }
});

test('male surnames use the masculine form', () => {
  const exception = new Set(['Руденко']);
  for (const life of loadLives().filter((item) => item.gender === 'm')) {
    const surname = life.name.split(' ')[1];
    assert.ok(exception.has(surname) || !surname.endsWith('а'), life.name);
  }
});
