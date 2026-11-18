# Global handoff: withdraw Liubov Lukina's old LinkedIn invitations

Global search key: `GLOBAL-HANDOFF-LINKEDIN-LIUBOV-WITHDRAW-INVITATIONS`

For sending or resuming Sales Navigator connection invitations, search for
`GLOBAL-HANDOFF-LINKEDIN-LIUBOV-SALESNAV-OUTREACH` and open
`C:\git-local-26-06\im-bot\data\linkedin_web_state\SALESNAV_CONNECTION_HANDOFF.md`.

Search aliases: LinkedIn outgoing invitations, sent invitations, cancel old
requests, withdraw invitations, Liubov Lukina, Zurückziehen, Einladung
zurückziehen, Vor 2 Wochen gesendet, исходящие заявки, отменить приглашения.

## Purpose

In Liubov Lukina's real external Chrome, open LinkedIn's sent-invitations page
and withdraw only invitations whose card contains the exact German age label
`Vor 2 Wochen gesendet`.

Do not infer the target from spoken wording such as `Vor zwei Wochen`. The live
DOM observed on 2026-08-09 used the digit `2`; match the exact visible text.

## Account and browser isolation

- LinkedIn account: **Liubov Lukina**
- LinkedIn profile: `https://www.linkedin.com/in/liubov-lukina/`
- Chrome launcher: `C:\git-local-26-06\im-bot\scripts\start-linkedin-chrome.ps1`
- Chrome data: `C:\git-local-26-06\im-bot\data\linkedin_web_state\liubov-lukina\chrome_profile_liubov_lukina`
- CDP: `http://127.0.0.1:9333`
- Target page: `https://www.linkedin.com/mynetwork/invitation-manager/sent/`
- Worker: `C:\git-local-26-06\im-bot\scripts\withdraw-linkedin-two-weeks.mjs`

Never use the in-app browser or Nikolay's separate Chrome on port `9222`.
Ignore any open DevTools target and select the ordinary HTTPS target page.

## Authorization and scope

The action is externally visible and removes pending invitations. A fresh user
request must authorize withdrawing the matching invitations. For this operator,
an instruction such as "отмени все двухнедельные" or "делай" authorizes the
whole exact-match set; do not ask for a redundant numeric confirmation. Still
perform a compact read-only count before the run and report the result.

Only withdraw cards containing the exact label:

```text
Vor 2 Wochen gesendet
```

Do not touch invitations labelled one week, three weeks, a date, or any other
text. Do not withdraw a row merely because its position or CSS class resembles
another row.

## Stable DOM contract

CSS classes are obfuscated and must not be used. Associate the exact age text
with the withdrawal control inside the same card. The observed link contract is:

```html
<a aria-label="Einladung an Dr.-Ing. Ilya Arsenyev zurückziehen">
  <span>Zurückziehen</span>
</a>
```

After the first click, LinkedIn opens a confirmation dialog. Its visible text is
`Zurückziehen`, but its accessible name contains the person's name:

```html
<button aria-label="Einladung an Dr.-Ing. Ilya Arsenyev zurückziehen">
  Zurückziehen
</button>
```

Therefore match both controls using an accessible-label prefix/suffix, not an
exact accessible name of `Zurückziehen`:

```css
[aria-label^="Einladung an "][aria-label$=" zurückziehen"]
```

## Runbook

From `C:\git-local-26-06\im-bot`:

1. Start or reuse Liubov's Chrome:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-linkedin-chrome.ps1
   ```

2. The operator opens the sent-invitations page in that Chrome.

3. Count exact matches without withdrawing anything:

   ```powershell
   node .\scripts\withdraw-linkedin-two-weeks.mjs --inspect
   ```

4. Run the withdrawals:

   ```powershell
   node .\scripts\withdraw-linkedin-two-weeks.mjs
   ```

5. Verify that the exact-match count is zero:

   ```powershell
   node .\scripts\withdraw-linkedin-two-weeks.mjs --inspect
   ```

The worker scrolls and activates `Mehr anzeigen`, `Weitere anzeigen`, or
`Show more` when present. It waits 1-3 seconds between visible actions. It stops
on login, checkpoint, security verification, an unexpected dialog, or a changed
confirmation contract.

If a confirmation dialog is unexpectedly left open, inspect only that dialog:

```powershell
node .\scripts\withdraw-linkedin-two-weeks.mjs --inspect-dialog
```

Do not blindly press a generic `Zurückziehen` elsewhere on the page.

## Journal and audit

The worker appends one JSON object per result to:

```text
C:\git-local-26-06\im-bot\data\linkedin_web_state\liubov-lukina\withdrawn-invitations-two-weeks-YYYY-MM-DD.jsonl
```

Audit unique records with `status: "withdrawn"`; an earlier `blocked` diagnostic
for the same name is not a withdrawal. A complete run requires both:

- the worker exits with an empty `stop_reason`;
- a final `--inspect` returns `"matches": 0`.

## Proven checkpoint

On 2026-08-09, the procedure found and withdrew 26 invitations. The final
inspection returned zero remaining cards labelled `Vor 2 Wochen gesendet`.
