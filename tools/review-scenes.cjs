// Local-only inspection. npm install --no-save --package-lock=false playwright
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const dir = 'C:/Users/xstay/AppData/Local/Temp/opencode/ostalos-review';
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1300 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:50039/memory-studio.html');
  await page.waitForFunction(() => window.MemoryWorld && window.CURATED_LIVES);
  const count = await page.evaluate(() => CURATED_LIVES.length);
  for (let start = 0; start < count; start += 3) {
    const result = await page.evaluate(async start => {
      generation++;
      const container = document.querySelector('#frames'); container.replaceChildren();
      container.style.gridTemplateColumns = 'repeat(6,1fr)';
      container.style.gap = '8px'; container.style.padding = '8px';
      const results = [];
      for (const life of CURATED_LIVES.slice(start, start + 3)) for (let i = 0; i < 6; i++) {
        const src = await MemoryWorld.image(life, i);
        const figure = document.createElement('figure');
        const image = new Image(); image.src = src; await image.decode();
        const caption = document.createElement('figcaption');
        caption.style.cssText = 'font:12px/16px system-ui;padding:8px';
        caption.textContent = `${life.id}/${i} · ${life.name} · ${life.memories[i].y} · ${life.memories[i].loc}\n${life.memories[i].h}`;
        figure.append(image, caption); container.append(figure);
        results.push({ id: life.id, stage: i, loaded: !!src });
      }
      return results;
    }, start);
    await page.screenshot({ path: path.join(dir, `sheet-${start / 3}.jpg`), fullPage: true, type: 'jpeg', quality: 90 });
    console.log(JSON.stringify({ sheet: start / 3, scenes: result.length, failed: result.filter(r => !r.loaded) }));
  }
  fs.writeFileSync(path.join(dir, 'errors.json'), JSON.stringify(errors));
  await browser.close();
  if (errors.length) throw Error(JSON.stringify(errors));
})();
