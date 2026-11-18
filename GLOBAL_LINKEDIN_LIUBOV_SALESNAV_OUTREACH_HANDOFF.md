# Global handoff: Liubov Lukina Sales Navigator outreach

Global search key: `GLOBAL-HANDOFF-LINKEDIN-LIUBOV-SALESNAV-OUTREACH`

This is the portable counterpart of the operator-specific handoff at:

```text
C:\git-local-26-06\im-bot\data\linkedin_web_state\SALESNAV_CONNECTION_HANDOFF.md
```

Use the private handoff for the current Chrome profile, CDP endpoint,
account-specific journals, and saved-search state. Do not commit or copy the
browser profile, contact exports, journals, or generated personal referral
links.

## Preconditions

- Work only in the operator-designated external Chrome and confirm the intended
  LinkedIn account before sending anything.
- Run a compact export/preflight of the active Sales Navigator people search.
- Report the exact selected count, the maximum free-invitation count, and that
  the action consumes real LinkedIn invitation quota.
- Exclude permanent exclusions, existing pending requests, and recently
  withdrawn invitations before drafting.

## Invitation contract

- Use the free `Vernetzen` control only. Never replace a missing control with
  InMail or a paid message.
- Use a short note below LinkedIn's 300-character limit, address the person by
  first name, and vary templates.
- Stop on a checkpoint, CAPTCHA, account mismatch, restriction, weekly limit,
  or changed dialog.
- Write append-only outcome records to an account-specific journal.

## Language and relevance

- Do not inherit a language from an earlier campaign. Use Russian or German
  only when the user explicitly sets it for the present selection or the
  selection itself proves the language filter.
- For a German Munich Kfz-insurance campaign, say that Liubov is not selling,
  is interested in the insurance field—especially Kfz insurance and leasing
  companies—and would welcome a professional connection. Sign the first note
  `Viele Grüße, Liubov`.
- Verify company and role relevance before a large batch. Search filters can
  still include unrelated companies or junior/trainee profiles.

## Free-route and execution rules

- Treat visible connection degrees `2` and `3` as potential free candidates.
  Treat missing/unclassified degree (`-1`) as unavailable unless the UI shows
  a free `Vernetzen` action; never use InMail as fallback.
- Keep human-like 4–8 second pauses when the operator requests slow clicks.
- For a long run, launch one bounded background worker and monitor its journal
  rather than depending on a foreground shell timeout.
- On interruption, stop only the matching worker PID. Resume from the same
  export, draft file, and journal so sent and skipped leads are not repeated.
- Leave the browser open unless the user explicitly asks to close it.
