# Production performance baseline

Measured against `https://beyx-system.com` on 2026-07-19. The test was
read-only. Each stage lasted 5 seconds, required an HTTP error rate no greater
than 1%, and required p95 response time no greater than 2,000 ms.

| Journey | Highest passing users | Next measured level | Result at next level |
| --- | ---: | ---: | --- |
| Organizer / judges sharing one account | 25 | 50 | Failed: p95 5,161 ms, 0% errors |
| Public bucket / bracket / standings | 10 | 25 | Failed: p95 2,194 ms, 0% errors |
| NMM registration | 25 | 50 | Failed: p95 3,307 ms, 0% errors |
| U10 registration | 25 | 50 | Failed: p95 3,423 ms, 0% errors |
| U10CUSTOM registration | 25 | 50 | Failed: p95 2,795 ms, 0% errors |
| Standalone scoreboard | At least 50 | Not measured | Passed: p95 434 ms, 0% errors |
| Supabase Realtime open connections | At least 50 | Not measured | 50/50 connected, p95 359 ms |

These figures are measured bounds, not theoretical maxima. The HTTP virtual
users repeatedly execute their full journey every 1-1.5 seconds, which is more
aggressive than a spectator who opens a page and then waits for Realtime
updates. Run 30-60 second stages three times on staging before using these
figures for event planning.

## Observed hot paths

- The public bucket resolves a short ID by loading every tournament owned by
  the organizer and matching the ID in application code. Its initial page load
  also loads all registrations, followed by separate matches and standings
  requests.
- Registration configuration reloads the complete Beyblade catalog and the
  organizer's overrides for each visitor.
- The scoreboard is client-side after its initial static page load and is not a
  meaningful database bottleneck.

For the current usage pattern, 5-6 judges sharing one organizer account is
inside the measured passing range. The public bucket initial-load burst is the
first path to optimize or cache.
