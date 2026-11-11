# Security

## What the site exposes

- The API (`api/ebk`) is read-only: GET, HEAD and OPTIONS only, one SQLite file opened read-only, no credentials,
  no outbound requests, no model calls. Each client address is rate-limited; every response carries security headers;
  an unhandled error returns a generic 500 and never a traceback.
- The web app sends a Content-Security-Policy (scripts, styles, fonts and requests from its own origin only; images
  from its own origin plus the two team-media hosts unless `NEXT_PUBLIC_TEAM_MEDIA=0`), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, a strict referrer policy and HSTS. It sets no cookies and loads no third-party script.
- No secret is needed to run either part. `.env` files and databases are git-ignored.

## Reporting a problem

Open a private security advisory on this repository (Security → Advisories → Report a vulnerability). Please do not
open a public issue for a vulnerability.
