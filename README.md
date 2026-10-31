# PropsPro IQ

Beyond the Box Score. NBA research dashboard built with Next.js and Supabase, with Philippine-time schedules, configurable prop thresholds, historical hit rates, player context, and saved research selections.

## Current status

The application builds locally and its 26 analytics/provider tests pass. Supabase migrations and the sync Edge Function are deployed; a 15-minute scheduled worker is running. Real NBA ingestion is awaiting a permitted provider API key. The production site is deployed at https://propspro-iq.vercel.app/ (Vercel READY, app commit f62cc83c41dc883e0b697c3a8f2480741809dcc2). Public overview, lab, health, picks, slate API, and sitemap returned HTTP 200 on November 1, 2026 PHT. The live Supabase read connection is verified; the initial runtime error scan returned no matching logs. Empty and unavailable states are intentional: the app does not seed fabricated sports data.

Experimental rolling baselines are unvalidated. Historical hit rates are not predictive probabilities. Calibrated probabilities, expected-value recommendations, and direct defender tracking are not represented as available.

## Development

Use a current supported Node.js runtime. Run `npm ci`, copy `.env.example` to `.env.local`, supply the public Supabase URL and publishable key, then run `npm run dev`. Run `npm test`, `npm run typecheck`, and `npm run build` for verification.

## Deployment

The current project was deployed through the Vercel source API. Vercel GitHub integration is not installed, so repository pushes do not automatically redeploy. Connect the integration to this repository to enable that workflow. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the public publishable key), and `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin. Confirm the exact variable names in `.env.example`. Never put a service-role or provider API key in browser-visible variables.

The Supabase schema and scheduler are in `supabase/migrations`. The `sync-nba` Edge Function uses Supabase's native server credentials and a Vault-backed bearer secret for scheduled calls. Configure `BALLDONTLIE_API_KEY` and `BDL_PLAN` only as Edge Function secrets. Default free mode covers schedule data; player box scores and injuries require a provider plan that includes those endpoints. Do not purchase a plan without the owner's approval.

Optional email authentication requires the production site URL and redirect allowlist in Supabase Auth. Email delivery and cloud-pick sign-in still need end-to-end verification after deployment. Public analytics does not require an account.

`tests/database.sql` is a rollback-only integration check for an already migrated database. Tests use isolated fixtures; no example records are published to the live data tables.

## Data and limitations

The provider adapter uses the documented BALLDONTLIE API. ESPN and Real Sports are not scraped. Refresh attempts and successful data retrieval are reported separately. Missing values remain unknown, pushes are counted separately, and DNPs are excluded from historical played-game samples. Game-level teammate splits are not on-court lineup measurements. Saved picks are research records, not wager placement.

Remaining launch checks: activate provider ingestion and verify schedule freshness, actual player charts, email authentication, and saved-pick behavior with real records. The public application is available; NBA data activation remains incomplete.
