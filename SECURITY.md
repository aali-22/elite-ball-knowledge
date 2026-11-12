# Security

## What the site exposes

- The API (`api/ebk`) is read-only: GET, HEAD and OPTIONS only, one SQLite file opened read-only, no credentials,
  no outbound requests, no model calls. Each client address is rate-limited; every response carries security headers;
  an unhandled error returns a generic 500 and never a traceback.
- The web app sends a Content-Security-Policy (scripts, styles, fonts and requests from its own origin only; images
  from its own origin plus the two team-media hosts unless `NEXT_PUBLIC_TEAM_MEDIA=0`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, a strict referrer policy and HSTS. It loads no third-party script, and sets no
  cookie unless accounts are on.
- Accounts and plans are off by default (`NEXT_PUBLIC_ACCOUNTS`) and live in the web app only; the API still holds no
  credential. On: passwords are kept as salted hashes; the session cookie is HttpOnly; sign-in and billing calls are
  same-origin JSON checked against the site's origin; card details stay on Stripe's pages; Stripe's webhook is
  verified by its signature, and a person's plan comes only from it. Per-person responses are `private, no-store`.
- No secret is needed to run either part with accounts off. With them on, secrets come from the environment only.
  `.env` files and databases are git-ignored.

## Reporting a problem

Open a private security advisory on this repository (Security → Advisories → Report a vulnerability). Please do not
open a public issue for a vulnerability.
