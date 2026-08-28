# Anti Gravity Dev Command — Supabase Exit

คัดลอกข้อความในหัวข้อ “Master command” ไปสั่ง Anti Gravity Dev ได้โดยตรง

## Master command

```text
คุณทำหน้าที่เป็น Senior Full-stack and Database Migration Engineer ของโปรเจกต์ BeyX

เป้าหมายคือย้าย runtime ทั้งหมดออกจาก Supabase Managed Platform ไปใช้ PostgreSQL 17 บนเซิร์ฟเวอร์ของเรา โดยคง Next.js, Redis, R2/Vercel Blob, ฟังก์ชันทั้งหมด และข้อมูลเดิมไว้

ก่อนเริ่ม:
1. อ่าน docs/SUPABASE_EXIT_MIGRATION_PLAN.md ให้ครบ
2. ตรวจ repository, git status, environment variable names, migrations, schema และ tests ที่มีอยู่
3. สรุป current-state/gap report และ mapping ของทุก Supabase call ก่อนแก้โค้ด
4. ใช้แผนในเอกสารเป็น source of truth หากพบข้อมูลจริงขัดกับแผน ให้หยุดและรายงานหลักฐาน ห้ามเดา

ข้อบังคับด้านความปลอดภัย:
- ห้ามลบ ปิด หรือแก้ Production Supabase project
- ห้ามเขียนข้อมูลลง Production Supabase นอกเหนือจาก flow ปกติของแอป
- การตรวจ Production database ต้อง read-only ยกเว้นได้รับอนุมัติชัดเจน
- ห้ามแสดงหรือ commit secrets, database URLs, JWT keys, OAuth secrets หรือ database dump
- ห้าม commit .env.local-db หรือไฟล์ใน backups/
- ห้ามเปิด PostgreSQL port 5432 ออก Internet
- ห้ามใช้ database superuser เป็น runtime credential
- ห้ามใช้ string interpolation ใน SQL; ใช้ parameterized queries เท่านั้น
- ห้ามทำ cutover, rotate keys, revoke keys, delete volume หรือ decommission จนได้รับคำสั่ง explicit
- รักษา user data, UUID, primary keys, password hashes และ foreign keys เดิม
- Preserve user changes and unrelated dirty-worktree files

สถาปัตยกรรมเป้าหมาย:
- Next.js API/server code -> pg.Pool -> PostgreSQL 17
- Redis คงเดิม
- Username/password ใช้ public.users และ JWT session ของแอป
- Google OAuth เปลี่ยนจาก Supabase Auth เป็น Auth.js หรือ direct Google OAuth
- Realtime เปลี่ยนเป็น SSE + PostgreSQL LISTEN/NOTIFY
- Browser ห้ามเชื่อม PostgreSQL โดยตรง
- ไม่เพิ่ม PostgREST เว้นแต่มีหลักฐานว่าจำเป็นและได้รับอนุมัติ

วิธีทำงาน:
- ทำทีละ phase ตาม docs/SUPABASE_EXIT_MIGRATION_PLAN.md
- หลังแต่ละ phase ให้รายงานไฟล์ที่เปลี่ยน, tests ที่รัน, ผลลัพธ์, ความเสี่ยง และสิ่งที่ยังค้าง
- รักษา feature flags DATA_BACKEND, AUTH_BACKEND และ REALTIME_BACKEND จนกว่าจะผ่าน staging
- หลีกเลี่ยง big-bang rewrite; ย้ายผ่าน repository/data-access layer เป็น module
- ทุก database/schema change ต้องอยู่ใน versioned migration file
- ทุก fix ต้องมี verification ที่เหมาะสม

Phase 0 — Inventory and baseline:
- สร้างรายการทุกไฟล์และทุก call ที่พึ่ง Supabase แยกเป็น Database, Auth, Realtime, Storage
- สร้าง migration matrix: source file -> current Supabase operation -> target repository/API -> test coverage
- บันทึก baseline build, functional, load, realtime
- ห้ามแก้ Production state

Phase 1 — Local database foundation:
- ตรวจและปรับ docker-compose.local-db.yml, .env.local-db.example และ docker/postgres/*
- ยืนยัน PostgreSQL 17 healthcheck, persistent volume, roles, extensions, log rotation และ localhost-only port
- เพิ่ม migration mechanism ที่ repeatable
- เพิ่มคำสั่งตรวจ readiness โดยไม่พิมพ์ secret

Phase 2 — Data access:
- เพิ่ม src/lib/db.ts เป็น singleton pg.Pool; default pool max 5 และ configurable
- เพิ่ม typed repository modules
- แทน server-side supabaseAdmin/supabase data calls ด้วย parameterized SQL
- ใช้ transactions กับ multi-row bracket/match operations
- รักษา behavior และ response contracts เดิม
- เพิ่ม integration tests กับ PostgreSQL container

Phase 3 — Auth:
- เปลี่ยน SUPABASE_JWT_SECRET เป็น APP_SESSION_SECRET พร้อม backward-compatible transition ที่มีวันถอด
- ใช้ password hashes เดิมใน public.users
- เปลี่ยน Google OAuth และ link บัญชีด้วย normalized email
- ป้องกัน duplicate account, CSRF, open redirect และ session fixation
- บังคับ re-login ใน cutover plan

Phase 4 — Realtime:
- เพิ่ม versioned migration สำหรับ safe pg_notify triggers บน matches, match_locks, internal_matches, tournaments
- payload ต้องมีเฉพาะ event/table/id/tournamentId
- เพิ่ม authorized SSE endpoint, heartbeat, reconnect และ cleanup listener
- หาก app scale มากกว่าหนึ่ง instance ให้ใช้ Redis Pub/Sub bridge
- แทน Supabase channel subscriptions ใน client ทั้งหมด

Phase 5 — Migration tooling:
- เพิ่ม scripts แบบ read-only สำหรับ export public schema/data จาก Supabase
- ใช้ pg_dump/pg_restore version 17 และตรวจ --help ก่อนกำหนด flags
- dump ต้อง exclude Supabase-managed schemas/roles
- เพิ่ม restore script, post-restore grants และ reconciliation script
- reconciliation ต้องตรวจ tables, counts, PK/FK, sequences, view, functions และ aggregates
- scripts ต้องหยุดทันทีเมื่อเกิด error และห้าม echo credentials

Phase 6 — Validation:
- npm run lint
- npm run build
- npm run test:functional
- npm run test:load
- SSE realtime capacity test อย่างน้อย 50 clients
- restore drill ลง database ว่าง
- security review และ connection-leak test

Acceptance criteria:
1. ทุก feature ทำงานกับ DATA_BACKEND=postgres
2. rg ไม่พบ runtime Supabase Database/Auth/Realtime calls
3. @supabase packages ถูกถอดได้หลัง compatibility flags ถูกลบ
4. public tables 14 ตาราง, view และ functions ถูกย้ายครบ
5. row counts/checksums/constraints ตรงกับ source snapshot
6. login เดิมและ Google OAuth ผ่านโดยไม่สร้าง user ซ้ำ
7. SSE scoring/bracket/locks/status ผ่าน 50 concurrent clients
8. HTTP error rate <= 1% และ p95 <= 2 seconds ใน measured tests
9. backup/restore drill ผ่าน
10. ไม่มี secret, dump หรือ Production mutation ใน git/history/log output

อย่าทำ Production cutover ในงานนี้ ให้จบที่ implementation + staging rehearsal + cutover-ready report แล้วรออนุมัติจากเจ้าของระบบ
```

## Suggested phase command

ถ้าต้องการสั่งทีละ phase ให้ใช้รูปแบบนี้:

```text
อ่าน docs/SUPABASE_EXIT_MIGRATION_PLAN.md และ docs/ANTIGRAVITY_SUPABASE_EXIT_PROMPT.md แล้วดำเนินการเฉพาะ Phase <หมายเลขและชื่อ> เท่านั้น ตรวจงานเดิมก่อนแก้ รักษา feature flags และห้ามแตะ Production state เมื่อเสร็จให้รายงาน files changed, tests, evidence, risks และ next gate โดยยังไม่เริ่ม phase ถัดไป
```

ลำดับที่แนะนำสำหรับการอนุมัติ:

1. Phase 0 Inventory/Baseline
2. Phase 1 Docker/PostgreSQL Foundation
3. Phase 2 Public Read APIs
4. Phase 2 Registration/Admin Data Access
5. Phase 2 Matches/Rankings/Webhooks
6. Phase 3 Auth
7. Phase 4 Realtime
8. Phase 5 Migration Tooling/Rehearsal
9. Phase 6 Full Validation

