/**
 * Telegram webhook for @pxaxspase_bot.
 *
 * The only thing it does: when someone presses START, it says one line and
 * attaches a button that opens the mini app. No state, no database, no
 * conversations — the bot is a doorway, not a chat partner.
 *
 * Secrets (set with `wrangler secret put`, never in this file):
 *   BOT_TOKEN     — the bot token from BotFather
 *   WEBHOOK_TOKEN — a random string Telegram echoes back in the webhook path,
 *                   so a stranger cannot POST fake updates to this worker
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
  });
  return r.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check, and a way to confirm the route without touching Telegram.
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, worker: 'vse-chto-ostalos-bot' }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // Telegram is the only caller that should reach the POST path, and it must
    // know the secret segment of the URL.
    if (env.WEBHOOK_TOKEN && url.pathname !== `/webhook/${env.WEBHOOK_TOKEN}`) {
      return new Response('not found', { status: 404 });
    }
    if (!env.BOT_TOKEN) {
      return new Response('bot token is not configured', { status: 500 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response('bad request', { status: 400 });
    }

    const appUrl = env.APP_URL || 'https://vse-chto-ostalos.xstayis.workers.dev/';
    const message = update.message || update.edited_message;
    const text = message?.text || '';
    const chatId = message?.chat?.id;

    // /start (with or without a payload) is the only trigger. Other commands get
    // the same line, because silence in a doorway is confusing.
    if (chatId) {
      const cmd = text.split(/\s+/)[0].split('@')[0];
      if (cmd === '/start' || cmd === '/app' || cmd.startsWith('/')) {
        await telegram(env.BOT_TOKEN, 'sendMessage', answer(chatId, appUrl));
      }
    }

    // Always 200: a non-2xx makes Telegram retry the same update for hours.
    return new Response('ok', { status: 200 });
  },
};
