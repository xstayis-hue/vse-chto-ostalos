/**
 * Telegram webhook for @pxaxspase_bot.
 *
 * The only thing it does: when someone presses START, it says one line and
 * attaches a button that opens the mini app. No state, no database, no
 * conversations — the bot is a doorway, not a chat partner.
 *
 * Secrets (set with `wrangler secret put`, never in this file):
 *   BOT_TOKEN     — the bot token from BotFather
 *   WEBHOOK_HEADER_TOKEN — Telegram setWebhook secret_token
 *   WEBHOOK_TOKEN — legacy migration only; remove after switching Telegram
 */

const REPLY = 'Открой приложение.';
const BUTTON_TEXT = 'Войти';

function answer(chatId, appUrl) {
  return {
    chat_id: chatId,
    text: REPLY,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: BUTTON_TEXT, web_app: { url: appUrl } }]],
    },
  };
}

async function telegram(token, method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const result = await r.json();
  return { ok: r.ok && result?.ok === true, code: result?.error_code || r.status };
}

async function sameSecret(expected, received) {
  if (!expected || !received) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([expected, received].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check, and a way to confirm the route without touching Telegram.
    if (request.method === 'GET' && ['/', '/api/health'].includes(url.pathname)) {
      return new Response(JSON.stringify({ ok: true, worker: 'vse-chto-ostalos-bot' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.method !== 'POST') return new Response('not found', { status: 404 });
    const allowed = env.WEBHOOK_HEADER_TOKEN
      ? url.pathname === '/webhook' && await sameSecret(env.WEBHOOK_HEADER_TOKEN, request.headers.get('X-Telegram-Bot-Api-Secret-Token'))
      : await sameSecret(env.WEBHOOK_TOKEN && '/webhook/' + env.WEBHOOK_TOKEN, url.pathname);
    if (!allowed) return new Response('not found', { status: 404 });
    if (!env.BOT_TOKEN) return new Response('not configured', { status: 503 });

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('bad request', { status: 400 });
    }

    const appUrl = env.APP_URL || 'https://vse-chto-ostalos.xstayis.workers.dev/';
    const message = update?.message;
    const text = typeof message?.text === 'string' ? message.text : '';
    const chatId = message?.chat?.id;

    if (message?.chat?.type === 'private' && Number.isSafeInteger(chatId) && /^\/(start|app)(?:@pxaxspase_bot)?(?:\s|$)/i.test(text)) {
      try {
        const result = await telegram(env.BOT_TOKEN, 'sendMessage', answer(chatId, appUrl));
        if (!result.ok) {
          console.warn(JSON.stringify({ event: 'telegram_send_failed', code: result.code }));
          // Invalid requests and unreachable chats are not fixed by another delivery.
          if (![400, 403].includes(result.code)) return new Response('retry', { status: 503 });
        }
      } catch {
        console.warn(JSON.stringify({ event: 'telegram_send_unavailable' }));
        return new Response('retry', { status: 503 });
      }
    }

    return new Response('ok', { status: 200 });
  },
};
