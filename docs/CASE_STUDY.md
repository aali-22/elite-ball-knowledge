# Case study: Elite Ball Knowledge

A sports analytics site where every claim sits next to the chart that proves it, and a record of public analysts'
picks graded against final scores. This is how it was built and why it was built that way.

**Status, stated plainly:** the code is complete and tested, and it runs end to end on real data locally. It has
not been deployed yet, so there are no users or traffic numbers to report. Everything below is about the engineering.

## The problem

Sports coverage is full of confident sentences nobody can check: "their defense is elite", "he feasts on this
matchup", "this analyst is hot". Three things make those sentences hard to trust:

1. **No shared scale.** Points per drive, turnover rate and expected goals can't be compared until each is placed
   within its league.
2. **Schedules lie.** A team that has only faced weak defenses looks like a good offense.
3. **Nobody keeps score on the people making picks.** An analyst's record is whatever they say it is.

The site answers each one directly: a league percentile for every trait, a second rank with the schedule taken out,
and a running record of every public pick, written down when it was made and graded when the game ended.

## What it does

- **A game, told as a scroll.** What decides it (the strongest findings, one at a time, each with its chart), where
  it tilts (every offense-against-defense matchup with an animated diagram), who they are (both identities on one
  scale), who it runs through (players against the defense they face), how it plays out (the game simulated twenty
  thousand times), how it can go (a tree of paths), and what happened the last times they met.
- **Findings.** Everything the numbers noticed across the slate, filterable by kind and sport.
- **Compare.** Any two teams set against each other with the same edges and rules a scheduled game gets.
- **League.** Every team on one plot, a power table, player leaders, any trait ranked.
- **PickLab.** Public analysts' picks as facts with a link to the article, grouped by game, by type or by player,
  graded against the final score, with each analyst's record.

## Architecture

```
            private (not in this repository)                    public (this repository)
┌──────────────────────────────────────────────┐      ┌───────────────────────────────────────────┐
│ collection → stats → models → grading        │      │  site.db  (SQLite, opened read-only)       │
│                                              │      │    board(event_id, …, body)                │
│  snapshot: allowlisted tables, stripped rows │ ───▶ │    doc(key, body)                          │
│  freeze:   public answers stored whole       │      │        │                                   │
│  checks:   fail rather than write            │      │  FastAPI (api/ebk): GET only, rate-limited │
└──────────────────────────────────────────────┘      │        │                                   │
                                                      │  Next.js (web): server-rendered pages      │
                                                      └───────────────────────────────────────────┘
```

The decision that shaped everything: **the server that faces the internet does almost nothing.** It reads one
SQLite file of finished documents. It has no write route, no credentials, no outbound requests and no model calls.
All the expensive and sensitive work happens before, somewhere else, and the result is copied over as a file.

That buys four things at once:

- **Security by construction.** There is nothing to inject into, nothing to exfiltrate and nothing to make it
  write. The file is opened read-only at the SQLite level; a test tries to delete a row and expects an error.
- **Cost.** Two small processes and a file. It fits a free tier.
- **Speed.** Every response is a lookup plus a pure function.
- **A clean boundary.** What is public is exactly what is in the file, and the file is built by an allowlist.

## Decisions worth explaining

### 1. Findings are rules, not generated text

Each finding ("a top-five offense in this trait meets a bottom-five defense at stopping it") is a fixed rule over
the board's numbers (`api/insights/engine.py`). There is no language model anywhere on the site.

- The same numbers always produce the same sentence, so a finding can be tested like any other function.
- Every rank in a sentence is a rank on the page. A test asserts exactly that for every finding on every board.
- It can't be prompted, spammed or run up a bill, because there is nothing to call.

The trade-off is range: rules only notice what they were written to notice. Nine kinds cover the cases that matter
(mismatch, schedule mirage, hidden strength, confirmed extreme, player edge, opposite ends, overall balance, form,
simulation), and a new kind is a function plus a chart type.

### 2. Private by default, checked three times

Data crosses from the private side to the public file through an allowlist, never a blocklist: a table, a source or
a field that isn't named doesn't go. Then the output is checked before it replaces the previous file:

1. the snapshot step refuses to finish if any non-allowlisted table exists or any text column contains a
   forbidden term;
2. the freeze step scans every stored document again;
3. each board passes a sanitizer on the way out, and a board that still fails is withheld rather than shown.

A failed check leaves the previous file untouched and exits non-zero. The same idea guards this repository: the
export that writes it follows imports from the public pages, copies only what they reach, and fails on any private
term, home-directory path, email address or key pattern.

### 3. One encoding for every chart

Every chart uses the same rail: league percentile, worst on the left, best on the right, for the team that owns the
number. Home is always one colour and away the other, on every chart of a page. Ranks are printed as text, so colour
is never the only carrier, and every chart has a table view of the same numbers. Once a reader has learned one
chart they can read all of them.

### 4. Motion that carries information, and stops when asked

Charts draw in from the league average to their real position, so the motion *is* the comparison. Pinned scroll
scenes redraw one chart per finding. Team crests glide from a game card to the game's page through the View
Transitions API. All of it is decoration over content that is already on the page: with "reduce motion" set, no
transition runs and nothing starts hidden.

### 5. A design system for controls, the site's own identity for everything else

Search, segmented controls, tables and badges come from a component library (Astryx) because keyboard handling,
focus management and touch behaviour are expensive to get right. Its tokens are mapped onto the site's own palette
and type, and its page-wide prose styles are switched off, so the library supplies behaviour and the site keeps its
look.

## What testing found

The parts I'm most glad were tested are the ones that looked fine:

- **The page transition was silently off for every NBA game.** The shared element's name was built from the game id,
  NBA ids contain a dot, and a dot isn't valid in a CSS identifier, so the browser ignored it without an error.
  A browser test that compares the name on both pages now covers it.
- **"Reduce motion" still hid content.** Blocks below the fold started invisible and faded in on scroll even with
  the setting on. They now render in place.
- **A test that passed alone failed in the full run.** Two test files shared a module-level data source. The fix was
  a fixture; the lesson was to run the whole suite, not the file I was editing.
- **A critical advisory in the framework** (remote code execution through image optimisation) surfaced in a
  dependency audit, fixed by a patch release. The audit now runs in CI.

### Three test passes that were told nothing

Before calling it done I ran three independent user-test passes cold. Each tester was an automated agent driving a
real browser and reading screenshots, playing a persona: a desktop bettor, a phone-first prop bettor and a sceptical
analyst. Each was given the persona and the address, nothing about what the site was for, and asked for the report a
professional user researcher would write. They filed about 120 issues between them. The ones that
mattered most were all things my own tests had passed:

- **A sentence and the chart beside it showed different ranks.** The sentence used the raw rank, the chart the
  schedule-adjusted one, and nothing said which was which. For a site whose claim is "every claim sits next to the chart
  behind it", this was the worst possible bug. Every sentence now uses the rank its chart prints, the dot sits where
  the printed rank puts it, and a test walks every finding on every board asserting exactly that.
- **Two teams were both "1st of 30".** Each team's numbers came from its own most recent board, and boards are built on
  different days, so ranks had been taken from slightly different leagues. League and team pages now rank the
  assembled league again, and a test asserts every rank from 1 to N appears once.
- **Yesterday's games led the "upcoming" list**, and a card's headline could point one way while its lean pointed the
  other. Games now drop off five hours after they start, and a card leads with a finding about the side it leans to.
- **The picks record was contaminated.** A weekly column's picks had been matched to the following week's games, which
  made analysts appear to pick both sides. Picks filed under a game too long after their article was written, markets
  from another sport and picks with no side are now left out of the feed and of every record.
- **Internal text was visible**: file names in chart footnotes. The build now fails if any stored document contains
  one, and it did fail, once, on a footnote I had missed.
- **On a phone** the pinned scroll layout wasted most of the screen, tap targets were half the size they should be,
  and the records table hid its most important columns. Phones now get stacked cards, 40px+ targets and a card
  layout for records.

### A second cold pass, after the fixes

I ran three fresh testers against the fixed build. The first round's bugs were gone; the second round found the layer
underneath them:

- **One stat still had two ranks.** A game page read the ranks stored when its board was built; the team, league and
  compare pages read the league as it stood now. A sceptical tester parsed every sentence on the site and found 91
  ranks that matched neither. An upcoming game is now read with the same league-wide numbers as every other page, and
  schedule findings are written from the traits themselves instead of a stored chain. A test walks every game, both
  team pages and the compare page and asserts the ranks are identical.
- **One game had five win probabilities.** The headline counted a tie as half a win; the histogram counted it
  separately. Every share now comes from the one margin distribution, ties are named, and a test checks they sum to 1.
- **Two seasons shared one table.** Teams with too few games fell back to last season's numbers without saying so on
  most pages, and a few players carried last season's sample into this season's leaderboards. Those teams are now
  marked wherever they appear, their findings say so, and carried-over player samples are left out of rankings.
- **Rest days were wrong for a back-to-back**, because a team's "last game" ignored a game still on the schedule. Tip
  times that were schedule placeholders now read "time to be confirmed".
- **The picks feed still had misfiles**: props under a game their player wasn't in, a combined-stat prop graded as one
  stat, a price in the text reported as "no price listed", a headline read as a pick. Each is now a rule with a reason.
- **The analyst table ranked on money from five priced picks.** Units and ROI now rank only analysts with ten or more
  priced picks; the rest are listed separately.

A third pass found subtler things, the kind that only show up when someone checks the rules against the output:

- **A hidden season rule.** A breakdown uses this season's numbers only once both teams have played ten games, so a
  team could sit on last season's numbers because of its opponent, and those numbers were ranked beside this season's.
  The rule is now stated wherever it applies, and the two seasons are never ranked together.
- **A chart quietly built on a price.** When there was no pre-game model prediction, one NBA chart was centred on the
  betting line. The site says it carries no prices, so those charts are now dropped rather than shown.
- **Rules that didn't reproduce.** The method page described the findings loosely; a tester applied the stated rules
  and got a different list. The page now states every threshold and cap exactly as the code applies them.
- **The site never graded itself.** It now does: each past game's call against the result, beside two plain rules
  (home team wins, better record wins). In the NBA the call is about as good as "better record wins", and the page
  says so.

A fourth pass, with a stronger model in two of the three seats, went after the thing I had added in the third: the
site's own track record. It did not survive contact.

- **The record graded the wrong game.** Two teams met on consecutive nights. The second game's breakdown was matched
  to the first game's score, so one result was counted twice with opposite verdicts. A result now belongs to the nearest
  game only, and never to a breakdown that already held it when it was built. A test builds exactly that pair.
- **The record's "lean" was not the page's.** The record used a weighted tilt; the game page used a count with a 60%
  threshold. Seven of sixty listed games disagreed with their own page. The record now grades the verdict the page
  shows, lists every graded game, says how many finished games are waiting for a score, and says that most of its NBA
  games were on last season's numbers.
- **"The -2th-easiest schedule."** Schedule difficulty was still ranked among thirty teams beside traits ranked among
  twenty-seven. It is now ranked among the same teams, and a test fails on any impossible ordinal.
- **One number was an average of the wrong things.** The "offense percentile" averaged every offensive trait, style
  included, so a team that shoots many threes outranked a better offense. It is now the percentile of one measure:
  points per 100 possessions, or points per drive.
- **Table views paired a raw value with an adjusted rank.** Every cell now names all four parts: value as played, rank
  as played, rank with the schedule taken out, sample.
- **A failed load read as "this page doesn't exist".** Search cached a rate-limited response as an empty index. A
  failed load is now its own state with a retry, the client waits out a 429, and unknown addresses get a real 404
  inside the site's layout.
- **Smaller, from the same pass:** rules restated exactly as the code applies them, ties drawn as ties, last-season
  teams unranked and marked wherever they appear, player pages for every player the site names, contrast on result
  badges and chart labels, and a readable league plot on a phone.

What the testers asked for that I chose not to build: the market line beside the model (the site carries no odds feed,
by design), injuries, and a graded record of the NBA score model, which has to wait until enough of its pre-game
predictions have been kept.

One thing that pass asked for I did build next, because it was structural: **the pages were empty until a script ran.**
Every page fetched its data in the browser, so a visitor without JavaScript, a crawler and a link preview all got a
shell. Each page is now rendered on the server from the same documents and taken over in the browser without asking
for them again. Three details made that harder than moving a fetch:

- **Time.** The server can't know a visitor's zone or language, and text that differs between the server's HTML and
  the browser's first render is thrown away and drawn again. The first render writes every time in US Eastern, the
  leagues' own clock; the moment the page is live, the times switch to the visitor's. A test loads the site as a
  German-language browser in Tokyo and fails on any mismatch.
- **Motion.** Blocks fade in, numbers count up and charts draw themselves, all starting from "hidden". In the
  server's HTML they are simply there: visible, at their value, fully drawn. With scripts running, a chart already on
  screen stays as it is, and one further down is reset out of sight so it still draws in when scrolled to.
- **Load, and a host that sleeps.** The web server now talks to the API on behalf of every visitor. Each document
  is kept in the framework's data cache and refreshed in the background once it is a few minutes old, so many
  visitors cost the API one request, and a page still renders from the stored copy while a free-tier API is asleep
  (the refresh is what wakes it). With nothing stored and no API, the page is sent anyway and the browser loads the
  data itself.

An unknown game, team or player is now a real 404, and each page carries its own title and description for a link
preview.

The lesson I keep: tests check what I thought to check. Someone who doesn't know what the product is supposed to do
checks whether it makes sense.

Numbers, as of the last run: 1,700+ API tests in the full private suite, about 30 in this repository's API (among them the cross-page rank check and the track-record checks), 22 browser
checks (transitions, reduce-motion, search, compare, nine pages at phone width, security headers, light theme, 404,
content in the HTML before any script, scripts off, another time zone and language),
type check, lint, a production build, and a dependency audit. The API tests, audit, type check, lint and build run in CI on every push; the browser checks run locally against the two servers.

## Security posture

| Concern | What is done |
| --- | --- |
| Writes | None exist. GET, HEAD and OPTIONS only; anything else is refused before routing. |
| Data at rest | One SQLite file, opened read-only. No user data is collected or stored, unless accounts are switched on (off by default): then the web app keeps an email and a salted password hash in its own database. |
| Abuse | Per-address rate limit (per minute and per ten seconds), `Retry-After` on refusal. |
| Error leakage | A generic 500 with security headers; tracebacks only in server logs. |
| Browser | Content-Security-Policy limited to the site's own origin plus two image hosts, `frame-ancestors 'none'`, no third-party script, no cookie unless accounts are on (then one, HttpOnly, for the sign-in). |
| Supply chain | Lockfile, `npm audit` in CI, no secret needed to build or run with accounts off. |
| Indexing | Off until an explicit setting, so a preview is never indexed by accident. |

## What I would do next

- **Server-render PickLab.** The analytics pages arrive complete; the picks section still loads in the browser, behind
  its age gate. It is also behind a switch: a public build is the analytics alone unless PickLab is turned on, and an
  analytics-only data build writes no pick, record or strategy at all.
- **Deploy** and measure: real traffic, uptime and page weight (the component library added about 145 kB to the
  first load; the search palette is already lazy-loaded, the table could be).
- **Player pages for the NFL** with photos, which need an id mapping the data doesn't carry yet.
- **Shot maps**, which need shot locations to be collected first.
- **More leagues** through the same vocabulary of traits and mechanisms: a new sport is one vocabulary file plus its
  field diagram.

## Stack

Next.js (App Router), TypeScript, Tailwind, Astryx, Framer Motion, Recharts · FastAPI, Pydantic, SQLite · pytest,
Playwright, GitHub Actions.
