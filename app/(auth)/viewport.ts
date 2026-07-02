/**
 * Shared auth-page viewport classes. The 73px is the marketing header height
 * (2px border + 71px bar) — previously hardcoded independently in the login,
 * signup, and reset-password pages, where a header change would silently
 * mis-centre all three. One spelling lives here; if the header ever changes,
 * update this constant (or mint a real `--header-h` token in globals.css —
 * recorded as an optional backbone follow-up).
 */
export const AUTH_SECTION_MIN_H = "min-h-[calc(100dvh-73px)]"
