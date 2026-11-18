// Configures the PXAXSPACE bot profile. Token is read from a local file and
// never printed. Dry run by default: pass --apply to actually write.
const fs = require('fs');

const RAW = 'C:/Users/xstay/Desktop/Текстовый документ.txt';
const token = fs.readFileSync(RAW, 'utf8').trim().match(/\d{8,12}:[A-Za-z0-9_-]{30,}/)[0];
const API = `https://api.telegram.org/bot${token}`;
const apply = process.argv.includes('--apply');

const APP_URL = 'https://vse-chto-ostalos.xstayis.workers.dev/';

/* The name is unchanged by request: PXAXSPACE stays. */
const NAME = 'PXAXSPACE';

/* Description shows in the empty chat, above the START button. Only the headphones
   line belongs here: the rest was written over the picture and said too much. */
const DESCRIPTION = '🎧 Для погружения в реинкарнацию надень наушники.';

/* Short description: shown in the bot's profile card and in search. 120 chars max.
   The headphones line only — the same single instruction as the full description. */
const SHORT = 'Надень наушники.';

/* No command list: the bot has no webhook, so /about would sit there unanswered.
   One button that opens the mini app is the whole interface. */
const COMMANDS = [];

async function call(method, params) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const j = await r.json();
  return j;
}

async function step(label, method, params) {
  if (!apply) {
    console.log(`· ${label} — будет отправлено (${method})`);
    return true;
  }
  const j = await call(method, params);
  if (!j.ok) {
    console.log(`✖ ${label}: ${j.error_code} ${j.description}`);
    return false;
  }
  console.log(`✓ ${label}`);
  return true;
}

(async () => {
  const me = await call('getMe');
  if (!me.ok) { console.log('✖ токен не принят:', me.description); process.exit(1); }
  console.log(`бот @${me.result.username} · id ${me.result.id}`);
  console.log(apply ? 'РЕЖИМ: запись' : 'РЕЖИМ: проверка (--apply чтобы применить)');
  console.log('');

  await step('имя', 'setMyName', { name: NAME });
  await step('описание до START', 'setMyDescription', { description: DESCRIPTION });
  await step('краткое описание', 'setMyShortDescription', { short_description: SHORT });
  await step('команды', 'setMyCommands', { commands: COMMANDS });
  await step('кнопка меню → мини-апп', 'setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Войти', web_app: { url: APP_URL } },
  });

  console.log('');
  console.log('описание:', DESCRIPTION.length, 'символов из 512');
  console.log('краткое:', SHORT.length, 'символов из 120');
  if (!apply) console.log('\nповтори с --apply');
})();
