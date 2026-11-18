// Points the Telegram webhook at the bot worker and verifies it. The token is
// read from a local file and never printed.
//   node tools/bot-webhook.cjs            — show current webhook
//   node tools/bot-webhook.cjs --set URL  — set it (URL must be the full webhook path)
//   node tools/bot-webhook.cjs --delete   — remove it
const fs = require('fs');

const RAW = 'C:/Users/xstay/Desktop/Текстовый документ.txt';
const token = fs.readFileSync(RAW, 'utf8').trim().match(/\d{8,12}:[A-Za-z0-9_-]{30,}/)[0];
const API = `https://api.telegram.org/bot${token}`;
const post = (method, body) =>
  fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json());

(async () => {
  const setIdx = process.argv.indexOf('--set');
  if (setIdx > -1) {
    const url = process.argv[setIdx + 1];
    if (!url || !/^https:\/\//.test(url)) {
      console.log('нужен https-адрес: node tools/bot-webhook.cjs --set https://.../webhook/TOKEN');
      process.exit(1);
    }
    // dropPendingUpdates keeps old /start messages from being replayed now
    const j = await post('setWebhook', { url, drop_pending_updates: true, allowed_updates: ['message'] });
    console.log('setWebhook:', j.ok ? 'ok' : `${j.error_code} ${j.description}`);
  }
  if (process.argv.includes('--delete')) {
    const j = await post('deleteWebhook', { drop_pending_updates: true });
    console.log('deleteWebhook:', j.ok ? 'ok' : `${j.error_code} ${j.description}`);
  }
  const info = await post('getWebhookInfo');
  const r = info.result || {};
  console.log('url:', r.url || '(пусто)');
  console.log('pending:', r.pending_update_count, '· last error:', r.last_error_message || '—');
})();
