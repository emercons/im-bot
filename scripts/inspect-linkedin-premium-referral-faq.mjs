import { chromium } from 'file:///C:/git-local-26-06/unified-contacts-private/node_modules/@playwright/test/index.mjs';

const questions = [
  'So funktioniert’s:',
  'Verfallen Empfehlungen, wenn sie nicht eingelöst werden?',
  'Die Person, die ich empfohlen habe, kann die kostenlose Testversion nicht einlösen. Warum?',
  'Ich habe alle meine Empfehlungen geteilt. Kann ich weitere teilen?',
  'Kann ich einen anderen Premium-Mitgliedschaftstarif teilen?',
];
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333', { isLocal: true, noDefaults: true, timeout: 15000 });
try {
  const page = browser.contexts()[0].pages().find((candidate) => candidate.url().includes('/premium/referrals/'));
  if (!page) throw new Error('LinkedIn Premium referrals page is not open');
  for (const question of questions) {
    const target = page.locator('[role="button"]').filter({ hasText: question });
    for (let i = 0; i < await target.count(); i += 1) {
      const item = target.nth(i);
      if (await item.isVisible()) {
        await item.click();
        await page.waitForTimeout(300);
        break;
      }
    }
  }
  const text = (await page.locator('body').innerText()).replace(/\n{3,}/g, '\n\n');
  const start = text.indexOf('Häufig gestellte Fragen');
  process.stdout.write(text.slice(start, start + 10000));
} finally {
  await browser.close();
}
