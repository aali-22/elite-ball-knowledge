# Security

## What the site exposes

- The API (`api/ebk`) is read-only: GET, HEAD and OPTIONS only, one SQLite file opened read-only, no credentials,
  no outbound requests, no model calls. Each client address is rate-limited; every response carries security headers;
  an unhandled error returns a generic 500 and never a traceback.
- The web app sends a Content-Security-Policy (scripts, styles, fonts and requests from its own origin only; images
  from its own origin plus the two team-media hosts unless `NEXT_PUBLIC_TEAM_MEDIA=0`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, a strict referrer policy and HSTS. It loads no third-party script, and sets no
  cookie unless accounts are on.
- Visit counting is off unless `NEXT_PUBLIC_GA_ID` is set. Set, the line above changes in three ways and no others:
  Google Analytics 4 (gtag.js) is loaded for every visitor, the policy admits Google's analytics hosts for that
  script, its requests and its image fallback, and Google sets its `_ga` cookies. Advertising features are off
  (ad consent denied, Google signals off). A visitor who turns it off, or whose browser sends Global Privacy Control,
  gets no script, no request and no such cookie. Events carry a sport, a kind or an outlet, never a person's id.
- Accounts and plans are off by default (`NEXT_PUBLIC_ACCOUNTS`) and live in the web app only; the API still holds no
  credential. On: passwords are kept as salted hashes; the session cookie is HttpOnly; sign-in and billing calls are
  same-origin JSON checked against the site's origin; card details stay on Stripe's pages; Stripe's webhook is
  verified by its signature, and a person's plan comes only from it. Per-person responses are `private, no-store`.
- No secret is needed to run either part with accounts off. With them on, secrets come from the environment only.
  `.env` files and databases are git-ignored.

## Reporting a problem

Open a private security advisory on this repository (Security → Advisories → Report a vulnerability). Please do not
open a public issue for a vulnerability.
