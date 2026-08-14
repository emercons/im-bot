# Sales Navigator outreach runbook

This runbook describes a safe, resumable workflow for invitation campaigns in
Sales Navigator. Keep browser profiles, exports, journals, names, message
contents, and referral links outside version control.

## Preflight

1. Use only the explicitly selected external browser session and confirm the
   intended account.
2. Export the active people search into an account-local directory.
3. Reconcile permanent exclusions, pending invitations, previously sent leads,
   and recent withdrawn invitations.
4. Report the selected count, the maximum free-invitation count, and that the
   action consumes a real LinkedIn invitation quota.
5. Review a compact sample for company and role relevance; search filters can
   otherwise include unrelated employers or junior profiles.

## Invitation rules

- Use `Vernetzen` only; never replace a missing free action with InMail.
- Treat second- and third-degree contacts as potential free candidates. A
  missing/unclassified connection degree is not a free-route guarantee.
- Keep notes under 300 characters, address the person naturally, and vary the
  templates.
- Select the message language only from the current campaign's explicit user
  instruction or verified search filters. Do not inherit it from an earlier
  campaign.
- Stop on a security checkpoint, CAPTCHA, restriction, weekly limit, account
  mismatch, or changed invitation dialog.

## Long runs and recovery

- Use a bounded worker with an append-only, account-local JSONL journal.
- For deliberate slow clicking, configure human-like pauses and run the worker
  in the background so a foreground shell timeout cannot interrupt it.
- Monitor compact journal counts rather than page-wide DOM dumps.
- On a stop request, terminate only the matching worker PID. Resume with the
  same export, drafts, and journal; this prevents duplicate invitations.
- Leave the browser open unless the operator explicitly asks to close it.
