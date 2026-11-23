// Use protected environment variables, not arguments or URLs containing secrets.
const { BOT_TOKEN, WEBHOOK_HEADER_TOKEN } = process.env;
const endpoint = 'https://vse-chto-ostalos-bot.xstayis.workers.dev/webhook';

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${method}: Telegram request failed (${result.error_code || response.status})`);
  return result.result;
}

async function main() {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');
  const action = process.argv[2] || '--status';
  if (!['--status', '--set'].includes(action) || process.argv.length > 3) throw new Error('Use --status or --set');
  const bot = await telegram('getMe', {});
  if (bot.username?.toLowerCase() !== 'pxaxspase_bot') throw new Error('Wrong bot');
  if (action === '--set') {
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(WEBHOOK_HEADER_TOKEN || '')) throw new Error('WEBHOOK_HEADER_TOKEN is required');
    await telegram('setWebhook', { url: endpoint, secret_token: WEBHOOK_HEADER_TOKEN, allowed_updates: ['message'] });
  }
  const info = await telegram('getWebhookInfo', {});
  console.log(`@${bot.username}: ${info.url === endpoint ? 'current route' : info.url ? 'other route' : 'not configured'}, pending ${info.pending_update_count}, delivery error ${info.last_error_date ? 'recorded' : 'none'}`);
}

main().catch(error => { console.error(error.cause ? 'Telegram connection failed' : error.message); process.exitCode = 1; });
