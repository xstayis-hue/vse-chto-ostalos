// Reads the bot's current Telegram configuration. Never prints the token.
const fs = require('fs');
const raw = fs.readFileSync('C:/Users/xstay/Desktop/Текстовый документ.txt', 'utf8').trim();
const token = raw.match(/\d{8,12}:[A-Za-z0-9_-]{30,}/)[0];
const API = `https://api.telegram.org/bot${token}`;
const call = async (method, params) => {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  return r.json();
};
const show = async (m, p) => {
  const j = await call(m, p);
  console.log(m, '→', JSON.stringify(j).slice(0, 400));
};
(async () => {
  await show('getMe');
  await show('getMyName');
  await show('getMyDescription');
  await show('getMyShortDescription');
  await show('getMyCommands');
  await show('getChatMenuButton');
  const info = await call('getWebhookInfo');
  console.log('getWebhookInfo →', { configured: Boolean(info.result?.url), pending: info.result?.pending_update_count, deliveryError: Boolean(info.result?.last_error_date) });
})();
