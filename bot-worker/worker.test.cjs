const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const source = readFileSync(`${__dirname}/worker.js`, 'utf8');
const env = { BOT_TOKEN: 'mock', WEBHOOK_HEADER_TOKEN: 'test-only', WEBHOOK_TOKEN: 'legacy-test' };
const update = { message: { text: '/start payload', chat: { id: 42, type: 'private' } } };
const request = (message = update, path = '/webhook', key = 'test-only') => new Request(`https://bot.example${path}`, {
  method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': key }, body: JSON.stringify(message),
});
const makeWorker = (fetch = () => { throw new Error('Unexpected call'); }) => {
  const calls = [];
  const worker = new Function('fetch', source.replace('export default {', 'return {'))((...args) => { calls.push(args); return fetch(...args); });
  return { worker, calls };
};

test('webhook fails closed when unconfigured or unauthenticated', async () => {
  const { worker, calls } = makeWorker();
  assert.equal((await worker.fetch(request(), { BOT_TOKEN: 'mock' })).status, 404);
  assert.equal((await worker.fetch(request(update, '/webhook', 'invalid'), env)).status, 404);
  assert.equal((await worker.fetch(request(update, '/webhook/legacy-test'), env)).status, 404);
  assert.equal(calls.length, 0);
});

test('legacy configuration still supports migration', async () => {
  const { worker, calls } = makeWorker(() => Response.json({ ok: true }));
  assert.equal((await worker.fetch(request(update, '/webhook/legacy-test'), { ...env, WEBHOOK_HEADER_TOKEN: undefined })).status, 200);
  assert.equal(calls.length, 1);
});

test('authenticated private command opens the configured Mini App', async () => {
  const { worker, calls } = makeWorker(() => Response.json({ ok: true }));
  assert.equal((await worker.fetch(request(), env)).status, 200);
  assert.equal((await worker.fetch(request(null), env)).status, 200);
  assert.equal((await worker.fetch(request({ message: { ...update.message, chat: { id: 42, type: 'group' } } }), env)).status, 200);
  assert.equal(calls.length, 1);
  const { chat_id, reply_markup } = JSON.parse(calls[0][1].body);
  assert.equal(chat_id, 42);
  assert.match(reply_markup.inline_keyboard[0][0].web_app.url, /^https:/);
});

test('transient delivery failure is retryable; permanent failure is acknowledged', async () => {
  for (const [code, status] of [[429, 503], [500, 503], [403, 200]]) {
    const { worker } = makeWorker(() => Response.json({ ok: false, error_code: code }, { status: code }));
    assert.equal((await worker.fetch(request(), env)).status, status);
  }
});
