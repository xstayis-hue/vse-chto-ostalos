const fs = require('fs');
const p = 'app.js';
const lines = fs.readFileSync(p, 'utf8').split('\n');
// find the chooseScreen block
const start = lines.findIndex((l) => l.startsWith('async function chooseScreen()'));
let end = start;
while (!/^}/.test(lines[end])) end++;
const replacement = `/* Not a character select. These are fragments surfacing in the last seconds:
   the mind does not offer a menu, it hands over whatever it can still reach. */
async function chooseScreen() {
  const current = LIFE;
  render(\`
    <div class="screen archive-screen">
      <div class="archive-list">
        <div class="archive-header"><span>последние секунды</span><span>\${observerLabel()}</span></div>
        <div class="archive-title serif">Что всплывает<br><i>первым?</i></div>
        <div class="archive-hint">пять жизней. одна из них — та, которую ты сейчас доживаешь.</div>
        <ol class="archive-items">
          \${offeredLives.map((person, i) => \`
            <li><button class="archive-item \${person.id === current.id ? "is-chosen" : ""}" data-life="\${person.id}" aria-pressed="\${person.id === current.id}">
              <span class="archive-num">\${String(i + 1).padStart(2, "0")}</span>
              <span class="archive-name">\${person.name}</span>
              <span class="archive-meta">\${person.year} · \${person.place}</span>
              <span class="archive-kept">\${person.symbol}</span>
            </button></li>\`).join("")}
        </ol>
        <div class="archive-foot">
          <div class="archive-last"><span class="archive-last-label">последняя мысль · запись повреждена</span>«\${current.last}»</div>
          <div class="archive-actions">
            <button class="button primary" data-go="mem">Вспомнить <span>↗</span></button>
          </div>
        </div>
      </div>
    </div>\`);
}`.split('\n');
lines.splice(start, end - start + 1, ...replacement);
fs.writeFileSync(p, lines.join('\n'));
console.log('replaced lines', start + 1, '-', end + 1);
