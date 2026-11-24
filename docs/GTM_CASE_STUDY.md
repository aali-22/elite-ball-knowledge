# GTM case study: a two-week distribution test

Elite Ball Index had been built and shown to almost nobody. This is the record of a 14-day test of how to get it in front of people: the plan, the measurements and what they showed. The results sections are empty until the test has run.

## Goal

Not revenue. A measured answer to three questions: which channel brings visitors who do something on the site, what kind of post brings them, and who the first audience is. Small numbers are expected and are still a result.

## Audience hypotheses

| Hypothesis | Evidence before the test | Verdict going in |
|---|---|---|
| Fans who argue about games | The largest group by far, gathered in large general communities with strict rules on promoting your own work | Hard to reach in 14 days from an account with no history |
| Creators and podcasters who need show prep | A small group that can be contacted one at a time. No evidence was found that they pay for charts | Distributors, not buyers |
| Analytics hobbyists | Small communities where posting your own chart with its method is normal | **First audience** |

Two starting assumptions were corrected by the research:

- "Fans will not pay for charts; creators might." Fans already pay small monthly amounts for analytics: $5 a month at one stats site ([cleaningtheglass.com/stats](https://cleaningtheglass.com/stats), seen 2026-11-23) and $9 a month at another ([Stathead plans](https://info.sports-reference.com/migration/knowledge/subscription-plans), seen 2026-11-23). No evidence was found of creators paying for charts.
- "A preview of tonight's game travels." In 63 posts from 19 analytics accounts (observed 2026-11-23), the posts that did best were single surprising numbers, and the "tonight" posts that worked were about what had just happened. The evidence is thin: one season, a few posts an account, and nothing seen on Instagram, TikTok or Reddit.

## Positioning

Working sentence before the research: "Elite Ball Index shows what the numbers say about tonight's NBA games, with every claim next to the chart that backs it."

The second half is the real difference. The first half frames the site as a preview service, which the evidence does not favour.

Tagline used for the test: **"NBA numbers that look wrong until you see the chart."**

Alternative held in reserve: "What the numbers said before tip-off, and what happened after. Every claim with its chart."

Every profile also carries: "Analysis, not advice."

## Channels and why

| Channel | Role | Why |
|---|---|---|
| Instagram | Reach | An account already exists. Feed posts cannot carry links, so visits come through the profile link and story links |
| Reddit | Clicks | The highest click potential and the highest removal risk. Used narrowly: comments first, then at most two original chart posts and two weekly threads, each only after that community's rules have been read |
| Bluesky | Clicks | Links are clickable in posts and there is no stated reach penalty for them. No native impression counts, so tagged links are the only measure |
| TikTok | Mirror, not measured | Same images, no reliable link out for a new account |

Skipped: X (weak reach reported for new unpaid accounts, and small accounts there could not be observed), Threads (weak referral traffic), YouTube Shorts (links in Shorts are not clickable, per [YouTube Help](https://support.google.com/youtube/answer/13748639), seen 2026-11-23).

## Experiment design

- Three channels, 14 days, one league (NBA).
- One or two findings a day, **chosen by hand**. Nothing is posted automatically. The evidence: an automated account posting each night's schedule and results had made 10,347 posts and had 82 followers (observed 2026-11-23).
- Three formats, in priority order:
  1. **Standing outlier.** A rank at the top or bottom of the league, or a rank that changes sharply once the schedule is taken out.
  2. **Day-after.** What the numbers said beforehand, and what happened, using the line a finished game page prints.
  3. **Tonight's preview.** Tested, not assumed.
- Every number in a post is copied from the site page it links to. The site holds no box-score lines from last night, so none appear.
- Week one uses phone screenshots of finding cards, cropped to 4:5.
- Feedback interviews with creators and fans run alongside, by individually written messages.

## Metric definitions

| Step | Definition | Where it is read in GA4 |
|---|---|---|
| Visit by channel | A session whose campaign is `gtm1` | Reports > Acquisition > Traffic acquisition, dimension "Session source / medium" |
| Engaged session | GA4's own engaged session | Same report, "Engaged sessions" |
| Activated session | A session with the `activate` event: the first real interaction on a page (open a finding, move the findings deck, open a board row, compare two teams, share, choose a search result, choose a league stat, switch the schedule view) | Same report, "Session key event rate" with `activate` marked as a key event counted once per session |
| Capture | **Not tested this sprint.** Email alerts were deferred: they would have shipped switched off with no way to send mail | n/a |
| Return within 7 days | A first-time visitor who comes back on days 1 to 7 | Explore > Cohort exploration: inclusion "first touch", return "any event", daily, breakdown "First user source" |

GA4 data arrives 12 to 48 hours late, so each day is read the following afternoon. Visitors who turned analytics off, or whose browser sends Global Privacy Control, are not counted at all.

### Tag scheme

Every part comes from a fixed list in the code (`web/lib/campaign.mjs`). Anything else is dropped before it is counted.

| Key | Values |
|---|---|
| `utm_source` | `instagram`, `reddit`, `bluesky`, `tiktok`, `outreach` |
| `utm_medium` | `social`, `email`, `referral` |
| `utm_campaign` | `gtm1` |
| `utm_content` | `bio`, `story`, `post`, `comment`, `link` |

Individual posts are told apart by landing page and date, so no label for a post or a person is ever sent.

## Day-zero baseline

| Measure | Value | Date read |
|---|---|---|
| Sessions, previous 28 days | | |
| Engaged sessions, previous 28 days | | |
| Instagram followers | | |
| Bluesky followers | | |
| TikTok followers | | |
| Reddit account age and karma | | |
| Pages indexed (Search Console) | | |

## Daily log

| Day | Date | Posts (channel, format) | Sessions | Engaged | Activated | Returned visitors | Notes |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
| 9 | | | | | | | |
| 10 | | | | | | | |
| 11 | | | | | | | |
| 12 | | | | | | | |
| 13 | | | | | | | |
| 14 | | | | | | | |

Per-post rows are in [`gtm/post-tracker.csv`](gtm/post-tracker.csv). Choices and the evidence for them are in [`gtm/DECISIONS.md`](gtm/DECISIONS.md).

## Results

*Filled in after the sprint.*

## What failed

*Filled in after the sprint.*

## What I would do next

*Filled in after the sprint.*
