# BeyX Supabase Call Migration Matrix

เอกสารฉบับนี้เป็นตารางจับคู่ (Mapping Matrix) การเรียกใช้งาน Supabase ทั้งหมดใน Source Code ไปยังโมดูลเป้าหมาย (PostgreSQL 17, `pg.Pool`, SSE, และ Local Session) ตามแผนงานใน `docs/SUPABASE_EXIT_MIGRATION_PLAN.md`

> **ข้อกำหนดสำคัญ**: ห้ามเริ่มการ Refactor หรือเปลี่ยน Runtime โค้ดใน Phase 0 และ Phase 1 ให้ใช้เอกสารนี้เป็นพิมพ์เขียวสำหรับ Phase 2, Phase 3 และ Phase 4

---

## 1. Inventory & Auditing Methodology (วิธีจำแนกและนับไฟล์ให้ตรวจซ้ำได้)

สามารถรันคำสั่ง Audit อัตโนมัติเพื่อตรวจสอบซ้ำได้ตลอดเวลา:
```bash
node scripts/setup/audit-supabase-files.cjs
```

ผลการจำแนกไฟล์ในไดเรกทอรี `src/` ทั้งหมด:
1. **Direct Imports & Runtime Usage (44 ไฟล์)**: ไฟล์ที่มีการ Import จาก `@supabase/supabase-js`, `@supabase/ssr`, `@/lib/supabase`, หรือ `@/utils/supabase` และมีการเรียกใช้งาน Database / Auth / Realtime
   - เมื่อตรวจด้วย Multiline Regex (`supabaseAdmin\s*\.\s*from\s*\(`) พบ **29 ไฟล์ที่มีการเรียก `supabaseAdmin.from(...)` โดยตรง** (เช่น `src/lib/repository.ts`, `src/lib/player-rankings.ts`, `src/app/api/auth/login/route.ts` ฯลฯ) ส่วนที่เหลือเรียกผ่าน Helper, Client หรือ Channel
2. **Environment Variable Dependency Only (2 ไฟล์)**: ไฟล์ที่ไม่ได้ Import library แต่พึ่งพา `process.env.SUPABASE_JWT_SECRET` (`src/lib/auth.ts` และ `src/middleware.ts`)
3. **Indirect Repository Dependencies (7 ไฟล์)**: ไฟล์ที่ไม่ได้แตะ Supabase โดยตรง แต่ Import `@/lib/repository` (จะได้รับประโยชน์ทันทีเมื่อย้าย Repository ใน Phase 2)
4. **Comments & Text-Only References (2 ไฟล์)**: ไฟล์ที่มีเพียง Comment กล่าวถึง Supabase (`src/app/api/setup-db/route.ts` และ `src/scripts/create_large_tournament.ts`)

### รายการ 29 ไฟล์ที่เรียก `supabaseAdmin.from(...)` โดยตรง:
1. `src/app/api/admin/beyblades/route.ts`
2. `src/app/api/admin/events/route.ts`
3. `src/app/api/admin/matches/route.ts`
4. `src/app/api/admin/players/route.ts`
5. `src/app/api/admin/players/[id]/history/route.ts`
6. `src/app/api/admin/profile/beyblades/route.ts`
7. `src/app/api/admin/profile/password/route.ts`
8. `src/app/api/admin/profile/route.ts`
9. `src/app/api/admin/rankings/tournaments/route.ts`
10. `src/app/api/admin/registrations/route.ts`
11. `src/app/api/admin/tournaments/route.ts`
12. `src/app/api/admin/tournaments/[id]/standings/route.ts`
13. `src/app/api/admin/users/manage/route.ts`
14. `src/app/api/admin/users/route.ts`
15. `src/app/api/auth/callback/route.ts`
16. `src/app/api/auth/login/route.ts`
17. `src/app/api/migrate-password/route.ts`
18. `src/app/api/public/players/suggestions/route.ts`
19. `src/app/api/public/players/[id]/history/route.ts`
20. `src/app/api/public/rankings/route.ts`
21. `src/app/api/public/tournaments/[id]/matches/route.ts`
22. `src/app/api/public/tournaments/[id]/standings/route.ts`
23. `src/app/api/register/config/route.ts`
24. `src/app/api/register/route.ts`
25. `src/lib/player-rankings.ts`
26. `src/lib/ranking-badges.ts`
27. `src/lib/ranking-eligibility.ts`
28. `src/lib/repository.ts`
29. `src/lib/tournament-badge-snapshot.ts`

---

## 2. Detailed File-by-File Migration Matrix (Direct & Env Dependencies)

| # | Source File | Category | Current Supabase Operation (ตรวจสอบจากโค้ดจริง) | Target Replacement (PostgreSQL / Local) | Required Test Coverage | Migration Phase |
| :-: | :--- | :---: | :--- | :--- | :--- | :-: |
| 1 | `src/lib/supabase.ts` | **Database (Core)** | `createClient` (`supabase`, `supabaseAdmin`) จาก `@supabase/supabase-js` | Deprecate; export compatibility shim ในช่วงเปลี่ยนผ่าน แล้วแทนที่ด้วย `src/lib/db.ts` (`pg.Pool`) | `test:functional`, DB ping test | Phase 2 |
| 2 | `src/utils/supabase/server.ts` | **Auth/DB (Core)** | `createServerClient` (`@supabase/ssr`) | Deprecate; เปลี่ยนไปใช้ Local session cookie parser และ `db.ts` | Server component tests | Phase 2 / 3 |
| 3 | `src/utils/supabase/client.ts` | **Auth/Realtime (Core)** | `createBrowserClient` (`@supabase/ssr`) | Deprecate; เปลี่ยนไปใช้ standard `fetch` wrapper และ SSE subscriber | Client hook tests | Phase 3 / 4 |
| 4 | `src/lib/repository.ts` | **Database (Core)** | `supabaseAdmin.from(...)` (Tournaments, Matches, Locks, Users, Registrations) | แยกระดับ Domain เป็น `repositories/tournaments.ts`, `repositories/matches.ts` ฯลฯ ด้วย Parameterized SQL | Unit/Integration with local PostgreSQL | Phase 2 |
| 5 | `src/app/api/public/tournaments/[id]/matches/route.ts` | **Database (Public)** | `supabaseAdmin.from('matches').select(...)` | `matchRepository.getByTournamentId(id)` | `GET /api/public/tournaments/:id/matches` | Phase 2 |
| 6 | `src/app/api/public/tournaments/[id]/standings/route.ts` | **Database (Public)** | `supabaseAdmin.from('registrations').select(...)`, `supabaseAdmin.from('tournaments')` | `standingRepository.getPublicStandings(tournamentId)` | `GET /api/public/tournaments/:id/standings` | Phase 2 |
| 7 | `src/app/api/public/rankings/route.ts` | **Database (Public)** | `supabaseAdmin.from('player_ranking_totals').select(...)` | `rankingRepository.getRankingTotals(...)` query บน SQL view/table | `GET /api/public/rankings` | Phase 2 |
| 8 | `src/app/api/public/players/[id]/history/route.ts` | **Database (Public)** | `supabaseAdmin.from('matches').select(...)`, `player_aliases` | `playerRepository.getPlayerHistory(playerId)` | `GET /api/public/players/:id/history` | Phase 2 |
| 9 | `src/app/api/public/players/suggestions/route.ts` | **Database (Public)** | `supabaseAdmin.from('players').select(...)` | `playerRepository.getSuggestions(query)` | `GET /api/public/players/suggestions?q=` | Phase 2 |
| 10 | `src/app/api/register/config/route.ts` | **Database (Public)** | `supabaseAdmin.from('tournaments').select(...)`, `beyblades`, `system_settings` | `tournamentRepository.getRegistrationConfig(id)` | `GET /api/register/config?tournamentId=` | Phase 2 |
| 11 | `src/app/register/[id]/opengraph-image.tsx` | **Database (Public)** | `supabaseAdmin.from('tournaments').select(...)` | `tournamentRepository.getById(id)` | OpenGraph image generation test | Phase 2 |
| 12 | `src/app/api/og/route.tsx` | **Database (Public)** | `supabaseAdmin.from('tournaments').select(...)` | `tournamentRepository.getById(id)` | OG Image API test | Phase 2 |
| 13 | `src/app/api/register/route.ts` | **Database (Registration)** | `supabaseAdmin.from('registrations').insert(...)`, `upsert(...)` | `registrationRepository.createRegistration(data)` | `POST /api/register` with validation | Phase 2 |
| 14 | `src/app/api/admin/registrations/route.ts` | **Database (Admin)** | `supabaseAdmin.from('registrations').select/insert/update/delete` | `registrationRepository` admin CRUD methods | `GET/POST/PUT/DELETE /api/admin/registrations` | Phase 2 |
| 15 | `src/app/api/admin/profile/route.ts` | **Database (Admin)** | `supabaseAdmin.from('users').select/update` | `userRepository.getProfile(id)`, `updateProfile(id, data)` | Profile API test | Phase 2 |
| 16 | `src/app/api/admin/profile/beyblades/route.ts` | **Database (Admin)** | `supabaseAdmin.from('user_beyblade_points').select/upsert` | `beybladeRepository.getUserPoints(userId)`, `saveUserPoints(...)` | Beyblade points API test | Phase 2 |
| 17 | `src/app/api/admin/users/route.ts` | **Database (Admin)** | `supabaseAdmin.from('users').select(...)` | `userRepository.listUsers()` | `GET /api/admin/users` | Phase 2 |
| 18 | `src/app/api/admin/users/manage/route.ts` | **Database (Admin)** | `supabaseAdmin.from('users').insert/update/delete` | `userRepository.manageUser(data)` | `POST /api/admin/users/manage` | Phase 2 |
| 19 | `src/app/api/admin/tournaments/route.ts` | **Database (Admin)** | `supabaseAdmin.from('tournaments').select/insert/update/delete` | `tournamentRepository` admin CRUD methods | `GET/POST/PUT/DELETE /api/admin/tournaments` | Phase 2 |
| 20 | `src/app/api/admin/tournaments/[id]/standings/route.ts` | **Database (Admin)** | `supabaseAdmin.from('tournament_results').select/upsert` | `tournamentRepository.updateStandings(...)` | Admin standings update test | Phase 2 |
| 21 | `src/app/api/admin/matches/route.ts` | **Database (Admin)** | `supabaseAdmin.from('matches').update(...)`, `match_locks` | `matchRepository.updateMatchScore(id, score)` + `pg_notify` trigger | Match scoring E2E test | Phase 2 / 4 |
| 22 | `src/app/api/generate-bracket/route.ts` | **Database (Bracket)** | Multi-step `supabaseAdmin.from('matches').insert(...)`, `delete(...)` | `bracketRepository.generateBracket(...)` ครอบด้วย PostgreSQL `BEGIN ... COMMIT` transaction | Multi-round bracket generation test | Phase 2 |
| 23 | `src/lib/tournament-badge-snapshot.ts` | **Database (Rankings)** | `supabaseAdmin.from('tournaments').update(...)`, `registrations` | `rankingBadgeRepository.takeSnapshot(tournamentId)` | Badge snapshot calculation test | Phase 2 |
| 24 | `src/lib/player-rankings.ts` | **Database (Rankings)** | `supabaseAdmin.from('tournament_results')`, `player_aliases`, `players` | `playerRankingRepository.calculateRankings()` | Ranking calculation comparison | Phase 2 |
| 25 | `src/lib/player-win-rate-totals.ts` | **Database (Rankings)** | `supabaseAdmin.rpc('refresh_player_win_rate_totals')` | `db.query('SELECT public.refresh_player_win_rate_totals()')` | Function execution & win-rate test | Phase 2 |
| 26 | `src/lib/ranking-badges.ts` | **Database (Rankings)** | `supabaseAdmin.from('system_settings').select(...)` | `systemSettingRepository.getSettings()` | Badge rule evaluation test | Phase 2 |
| 27 | `src/lib/ranking-eligibility.ts` | **Database (Rankings)** | `supabaseAdmin.from('tournaments').select(...)` | `tournamentRepository.getEligibleTournaments()` | Eligibility criteria test | Phase 2 |
| 28 | `src/app/api/admin/rankings/tournaments/route.ts` | **Database (Rankings)** | `supabaseAdmin.from('tournaments').select(...)` | `rankingRepository.getRankedTournaments()` | Ranked tournaments list test | Phase 2 |
| 29 | `src/app/api/admin/players/route.ts` | **Database (Admin)** | `supabaseAdmin.from('players').select/insert/update` | `playerRepository` CRUD methods | Players management test | Phase 2 |
| 30 | `src/app/api/admin/players/[id]/history/route.ts` | **Database (Admin)** | `supabaseAdmin.from('matches').select(...)`, `player_aliases` | `playerRepository.getAdminPlayerHistory(id)` | Player history admin test | Phase 2 |
| 31 | `src/app/api/admin/beyblades/route.ts` | **Database (Admin)** | `supabaseAdmin.from('beyblades').select/insert/update/delete` | `beybladeRepository` CRUD methods | Catalog CRUD test | Phase 2 |
| 32 | `src/app/api/admin/events/route.ts` | **Database (Admin)** | `supabaseAdmin.from('events').select/insert/update/delete` | `eventRepository` CRUD methods | Events API test | Phase 2 |
| 33 | `src/app/api/admin/migrate-events/route.ts` | **Database (Admin)** | `supabaseAdmin.from('events').upsert(...)` | `eventRepository.migrateEvents(...)` | Event migration script test | Phase 2 |
| 34 | `src/app/api/migrate-challonge/route.ts` | **Database (Utility)** | `supabaseAdmin.from('tournaments')`, `matches` | `challongeMigrationRepository` | Challonge import test | Phase 2 |
| 35 | `src/app/api/webhooks/challonge/route.ts` | **Database (Utility)** | `supabaseAdmin.from('matches').upsert(...)` | `webhookRepository.handleChallongeWebhook(...)` | Webhook verification test | Phase 2 |
| 36 | `src/app/api/auth/login/route.ts` | **Auth (API Route)** | **ไม่ได้ใช้ Supabase Auth Client**; ใช้ `supabaseAdmin.from('users').select('*')` ดึง user จาก `public.users`, ตรวจสอบ password ด้วย `verifyPassword` (`bcryptjs`/PBKDF2), และสร้าง session token ด้วย `createSession` (`src/lib/auth.ts`) | แทนที่ `supabaseAdmin.from('users')` ด้วย `userRepository.findByUsernameOrEmail($1)` ผ่าน `pg.Pool` | Login credential verification test | Phase 3 |
| 37 | `src/app/login/page.tsx` | **Auth (Client Page)** | **Password submit เรียก `/api/auth/login` ผ่าน fetch**; เรียกใช้ Supabase **เฉพาะ Google OAuth** ผ่าน `supabaseClient.auth.signInWithOAuth({ provider: 'google' })` | เปลี่ยน Google login button ให้ redirect ไปยัง Next.js OAuth route (`/api/auth/oauth/google` หรือ Auth.js provider) โดยตรง | Login UI + Google OAuth flow test | Phase 3 |
| 38 | `src/app/api/auth/callback/route.ts` | **Auth (OAuth Callback)** | `supabaseAdmin.auth.exchangeCodeForSession(code)` และค้นหา/สร้าง user ใน `public.users` | เปลี่ยนเป็น Direct Google OAuth token exchange + ค้นหา normalized email ใน `public.users` + สร้าง session cookie | OAuth callback & duplicate prevention test | Phase 3 |
| 39 | `src/lib/auth.ts` | **Auth (Session Library)** | เซ็น/ตรวจสอบ JWT Session โดยใช้ `SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET` | เปลี่ยน Secret เป็น `APP_SESSION_SECRET` (พร้อม fallback dual-read ช่วง transition) | JWT sign & verify unit test | Phase 3 |
| 40 | `src/middleware.ts` | **Auth (Middleware)** | ตรวจสอบ Session Cookie โดยใช้ `SUPABASE_JWT_SECRET` | ตรวจสอบ Session Cookie โดยใช้ `APP_SESSION_SECRET` | Protected route redirect test | Phase 3 |
| 41 | `src/app/api/migrate-password/route.ts` | **Auth (Utility)** | `supabaseAdmin.from('users').update(...)` สำหรับ migrate password hash | `userRepository.updatePasswordHash(...)` ด้วย `pg.Pool` | Password hash upgrade test | Phase 3 |
| 42 | `src/app/api/admin/profile/password/route.ts` | **Auth/DB (Admin)** | `supabaseAdmin.from('users').update(...)` สำหรับเปลี่ยนรหัสผ่าน | `userRepository.changePassword(...)` ด้วย `pg.Pool` | Change password API test | Phase 3 |
| 43 | `src/components/RealtimeTournamentWrapper.tsx` | **Realtime (Client)** | `supabase.channel(...)` (`matches`, `tournaments`) | `useTournamentSSE(tournamentId)` เชื่อมต่อไปยัง `/api/realtime/sse?tournamentId=` | Realtime tournament update test | Phase 4 |
| 44 | `src/components/public/PublicTournamentView.tsx` | **Realtime (Client)** | `supabaseClient.channel(...)` (`public_bracket_*`) | `usePublicBracketSSE(tournamentId)` เชื่อมต่อไปยัง `/api/realtime/sse` | Public bracket sync test | Phase 4 |
| 45 | `src/components/LiveMatches.tsx` | **Realtime (Client)** | `supabase.channel('realtime-matches')` | `useLiveMatchesSSE()` เชื่อมต่อไปยัง `/api/realtime/sse` | Live scoreboard stream test | Phase 4 |
| 46 | `src/app/admin/tournament/[id]/page.tsx` | **Realtime (Client)** | `supabaseClient.channel('admin-tournament-*')` | `useAdminTournamentSSE(id)` เชื่อมต่อไปยัง `/api/realtime/sse` | Admin score & match sync test | Phase 4 |

---

## 3. Indirect Repository Dependencies (7 Files)
ไฟล์เหล่านี้เรียกใช้ฟังก์ชันใน `@/lib/repository` (ไม่ได้เรียก Supabase API ตรงๆ แต่จะเปลี่ยนไปใช้ PostgreSQL อัตโนมัติเมื่อย้าย Repository):
1. `src/app/api/admin/tournaments/order/route.ts`
2. `src/app/api/admin/tournaments/reset/route.ts`
3. `src/app/api/settings/route.ts`
4. `src/app/events/page.tsx`
5. `src/app/page.tsx`
6. `src/app/register/[id]/page.tsx`
7. `src/app/[shopName]/[id]/page.tsx`

---

## 4. Migration Guardrails

1. **Parameterization Requirement**: ทุก query ต้องใช้ `$1, $2, ...` ห้ามทำ string interpolation
2. **Transaction Scope**: การจัดการ Bracket generation, match results update, และ tournament lock ต้องครอบด้วย `BEGIN ... COMMIT`
3. **No Direct Client Database Access**: ห้าม Client/Browser เชื่อมต่อ PostgreSQL โดยตรง การเข้าถึงข้อมูลต้องผ่าน Next.js API Routes / Server Actions เท่านั้น
4. **Clean Cutover Compatibility**: เก็บ Feature flags `DATA_BACKEND`, `AUTH_BACKEND`, `REALTIME_BACKEND` ไว้จนกว่าจะผ่าน Phase 6 Validation ครบถ้วน
