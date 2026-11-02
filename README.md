# The Tsukasa Picks

Beyond the Box Score. NBA research website built with Next.js and Supabase. Supports Philippine-time schedules, configurable prop lines, historical hit rates, and saved research picks.

## Production and NBA data
Production: https://the-tsukasa-picks.vercel.app/

The production deployment uses the existing BALLDONTLIE adapter until this SportAPI integration is reviewed and deployed. The SportAPI implementation is prepared on a feature branch; **do not claim it is active without a successful real-data sync**.

Current free-data source target: https://sportapi.ai/basketball-api. SportAPI documents NBA game schedules, player box scores, rosters, and game histories. Free usage is subject to 2,000 requests/day and 14,000/month (check current provider terms). It **does not provide** player tracking or live betting odds.

### Activate safely
1. Create an API key in the SportAPI dashboard at https://sportapi.ai/.
2. Verify legitimate public-web usage rights and account quota.
3. In the Supabase dashboard for this existing project, add Edge Function secret named **SPORTAPI_API_KEY** (not to GitHub or chat).
4. Apply the new SportAPI migration using the normal reviewed database migration workflow.
5. Deploy the new \`sync-nba\` Edge Function including both \`index.ts\` and \`sportapi.ts\` while retaining its existing scheduler-token authentication.
6. Verify \`public.data_health\` turns \`current\`, \`last_success\` becomes non-null, and genuine rows appear in \`teams\`, \`players\`, \`games\`, and \`box_scores\`.
7. Verify charts, home/away and H2H using actual final game records; check sample sizes and DNP handling.
8. Merge/deploy the frontend branch only after checks pass. Automatic GitHub-to-Vercel deployments may require installation of Vercel's GitHub integration.

The existing 15-minute Supabase cron continues independently of visitors. This adapter fetches at most two Eastern-date scoreboards per sync, refreshes box scores on discovery and only every six hours after that, refreshes team rosters at most daily, and backfills at most four NBA dates a day. It explicitly avoids repeatedly requesting every old final game. These strategies target low usage, but **do not provide a hard monthly quota enforcement**; monitor API usage and adjust schedules as needed.

SportAPI response examples in documentation are not a substitute for actual authenticated response testing. No fictional NBA data should be seeded. Injury or defender metrics remain unavailable unless another licensed source is integrated.

## Development
Use a supported Node.js version. Run \`npm ci\`, copy \`.env.example\` to \`.env.local\`, configure the Supabase public URL and publishable key, then run \`npm run dev\`. Verify with \`npm test\`, \`npm run typecheck\`, and \`npm run build\`.

Do not expose service-role keys or SportAPI credentials in browser-visible variables.

## Remaining limitations
Model baselines are experimental and unvalidated. Historical hit rates are not predictive probabilities. Real App and Stake.com are not automatically integrated; user-entered lines and odds remain independent. Public analytics access requires no account, but saved-pick auth flows still need production verification.
