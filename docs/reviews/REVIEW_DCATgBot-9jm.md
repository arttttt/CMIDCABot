# Review: Handle Enter key press on private key import page

**Task:** DCATgBot-9jm
**Status:** Approved
**Date:** 2026-01-12

## Findings

### Critical

None.

### Should Fix

None.

### Consider

- [N1] Minor: `requestSubmit()` requires browser support (IE/old Edge unsupported). Modern browsers are fine, but consider fallback `btn.click()` if legacy support ever needed. Not blocking since target audience uses modern Telegram WebView. — `/Users/artem/Projects/DCATgBot/src/presentation/web/ImportPageHandler.ts:330`

## Verdict

**Approved.** The implementation is correct and follows requirements:

1. **Correctness:** Enter key triggers form submission, Shift+Enter preserved for multiline input.
2. **Architecture:** Change is within presentation layer (HTML/JS in web handler) — no violations.
3. **Security:** No exposure of secrets, uses existing form submission flow with CSRF protection.
4. **Code quality:** Clean, minimal diff. Event listener properly placed before form submit handler.

The code correctly uses:
- `e.key === 'Enter'` (standard key detection)
- `!e.shiftKey` (preserves multiline input)
- `e.preventDefault()` (prevents default textarea behavior)
- `form.requestSubmit()` (triggers validation and submit event)

No action required. Ready to merge.
