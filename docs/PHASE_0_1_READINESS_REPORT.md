# BeyX Phase 0 & Phase 1 Readiness Report

**สถานะโครงการ**: 
- **Phase 0 (Baseline, Safety & Inventory)**: ⚠️ **IN PROGRESS / BLOCKED ON PRODUCTION DUMP AUTHORIZATION** (ห้ามประกาศ Complete จนกว่าจะได้รับอนุญาตทำ Production logical dump & restore drill)
- **Phase 1 (Local PostgreSQL Foundation)**: ✅ **READY & VERIFIED**
**Git Branch**: `feat/supabase-exit-migration`  
**วันที่บันทึก**: 2026-08-28  
**ระบบเป้าหมาย**: Local PostgreSQL 17.11-alpine บน Docker (`127.0.0.1:5433`)

---

## 1. Production Supabase Unchanged Statement

> [!IMPORTANT]
> **การยืนยันสถานะความปลอดภัยของ Production Supabase**:
> - ตลอดการทำงาน **ไม่มีการส่งคำสั่งเขียน, แก้ไข, ลบ, หรือปิดการทำงานใดๆ ไปยัง Production Supabase**
> - **ไม่มีการรันคำสั่ง `pg_dump` หรือดึงข้อมูลออกจาก Production** เนื่องจากยังไม่ได้รับอนุญาตแบบ Explicit จากเจ้าของระบบ
> - Application Runtime ยังคงใช้ค่าเดิม 100% ไม่มีการเปลี่ยน Environment flag ใดๆ ใน Production
> - พอร์ต PostgreSQL ของ Local Container ถูกจำกัดให้ Bind เฉพาะ `127.0.0.1:5433` (Loopback Only) ไม่เปิดออกสู่ภายนอก
> - ไม่มีการบันทึก Secret, Credential หรือ Dump ลงใน Git

---

## 2. Reconciled Current-State Inventory

จากการตรวจสอบ Source Code ใน `src/` ทั้งหมดอย่างละเอียดด้วยคำสั่ง:
```bash
node scripts/setup/audit-supabase-files.cjs
```

ผลการจำแนกประเภทไฟล์และหลักฐานการใช้งานจริงใน Source Code:
1. **Direct Imports & Runtime Usage (44 ไฟล์)**:
   - เมื่อตรวจด้วย Multiline Regex (`supabaseAdmin\s*\.\s*from\s*\(`) พบ **29 ไฟล์ที่เรียกคำสั่ง `supabaseAdmin.from(...)` โดยตรง**:
     - `src/lib/repository.ts` (ศูนย์กลาง Data access)
     - `src/lib/player-rankings.ts`, `src/lib/ranking-badges.ts`, `src/lib/ranking-eligibility.ts`, `src/lib/tournament-badge-snapshot.ts`
     - `src/app/api/auth/login/route.ts` (ดึง user จาก `public.users` เพื่อ verify password)
     - `src/app/api/auth/callback/route.ts`
     - `src/app/api/admin/beyblades/route.ts`, `src/app/api/admin/events/route.ts`, `src/app/api/admin/matches/route.ts`
     - `src/app/api/admin/players/route.ts`, `src/app/api/admin/players/[id]/history/route.ts`
     - `src/app/api/admin/profile/beyblades/route.ts`, `src/app/api/admin/profile/password/route.ts`, `src/app/api/admin/profile/route.ts`
     - `src/app/api/admin/rankings/tournaments/route.ts`, `src/app/api/admin/registrations/route.ts`, `src/app/api/admin/tournaments/route.ts`, `src/app/api/admin/tournaments/[id]/standings/route.ts`
     - `src/app/api/admin/users/manage/route.ts`, `src/app/api/admin/users/route.ts`
     - `src/app/api/migrate-password/route.ts`
     - `src/app/api/public/players/suggestions/route.ts`, `src/app/api/public/players/[id]/history/route.ts`, `src/app/api/public/rankings/route.ts`
     - `src/app/api/public/tournaments/[id]/matches/route.ts`, `src/app/api/public/tournaments/[id]/standings/route.ts`
     - `src/app/api/register/config/route.ts`, `src/app/api/register/route.ts`
   - ไฟล์ Direct Imports/Runtime อื่นๆ (15 ไฟล์): รวมถึง Core client helpers (`src/lib/supabase.ts`, `src/utils/supabase/server.ts`, `src/utils/supabase/client.ts`), API routes อื่นๆ ที่เรียกผ่าน helper/RPC, และ Realtime Channel Subscriptions (4 ไฟล์: `RealtimeTournamentWrapper.tsx`, `PublicTournamentView.tsx`, `LiveMatches.tsx`, `admin/tournament/[id]/page.tsx`)
2. **Environment Variable Dependencies Only (2 ไฟล์)**:
   - `src/lib/auth.ts`: ใช้ `process.env.SUPABASE_JWT_SECRET` เซ็นและตรวจสอบ Session token
   - `src/middleware.ts`: ใช้ `process.env.SUPABASE_JWT_SECRET` ตรวจสอบ Session token
3. **Indirect Repository Dependencies (7 ไฟล์)**:
   - เรียกใช้ Repository functions ใน `@/lib/repository` โดยไม่ได้แตะ Supabase API ตรงๆ (เช่น `src/app/events/page.tsx`, `src/app/page.tsx`, `src/app/register/[id]/page.tsx` ฯลฯ)
4. **Comments & Text-Only References (2 ไฟล์)**:
   - `src/app/api/setup-db/route.ts`, `src/scripts/create_large_tournament.ts`
5. **Storage**: **0 ไฟล์** (ระบบใช้ Cloudflare R2 และ Vercel Blob)

---

## 3. Docker & PostgreSQL 17 Verification Evidence

### 3.1 Container & Port Binding
- **Container Name**: `beyx-postgres`
- **Image**: `postgres:17.11-alpine`
- **Port Mapping**: `127.0.0.1:5433 -> 5432/tcp` (ยืนยันว่า bind เฉพาะ `127.0.0.1`)
- **Healthcheck**: `healthy` (ผ่านคำสั่ง `pg_isready -U beyx_admin -d beyx`)

### 3.2 Database Engine & Extension Query Evidence
```text
$ docker exec beyx-postgres psql -U beyx_admin -d beyx -c "SELECT version();"
PostgreSQL 17.11 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit

$ docker exec beyx-postgres psql -U beyx_admin -d beyx -c "SELECT extname, extversion FROM pg_extension;"
 plpgsql            | 1.0
 pgcrypto           | 1.3
 uuid-ossp          | 1.1
 pg_stat_statements | 1.11
```

### 3.3 Roles & Permissions Verification
```text
$ docker exec beyx-postgres psql -U beyx_admin -d beyx -c "SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname IN ('beyx_admin', 'beyx_app', 'beyx_backup');"
 beyx_admin  | t | t | t | t | t | t
 beyx_app    | f | f | f | f | t | t
 beyx_backup | f | f | f | f | t | f

$ docker exec beyx-postgres psql -U beyx_admin -d beyx -c "SELECT r.rolname, s.setconfig FROM pg_db_role_setting s JOIN pg_roles r ON s.setrole = r.oid;"
 beyx_app    | {statement_timeout=30s,idle_in_transaction_session_timeout=30s}
 beyx_backup | {default_transaction_read_only=on,statement_timeout=10min}
```

### 3.4 Runtime Configuration Parameters
- `max_connections`: `30`
- `shared_buffers`: `128MB`
- `work_mem`: `2MB`
- `statement_timeout`: `30s`
- `log_min_duration_statement`: `500ms`
- `password_encryption`: `scram-sha-256`
- `wal_compression`: `pglz`

### 3.5 Persistent Volume & Restart Drill
- เขียนข้อมูลลงตารางทดสอบ `_volume_test`
- สั่งรัน `docker compose --env-file .env --env-file .env.local-db -f docker-compose.yml -f docker-compose.local-db.yml restart postgres` โดย**ไม่ลบ volume**
- ข้อมูลในตารางทดสอบคงอยู่ครบถ้วน 100% หลัง Container กลับมาอยู่ในสถานะ `healthy`

---

## 4. Exact Commands, Exit Codes & Test Durations (Reproducible Rerun)

| Command | Exit Code | Duration | Status & Summary |
| :--- | :---: | :---: | :--- |
| `npm run build` | **0** | **33.4s** | ล้าง `.next` แล้วรัน Build ใหม่ผ่าน 100% (31/31 Static pages และ Dynamic routes ทั้งหมด ไม่มี Route type error) |
| `npm run test:functional` | **0** | **15.6s** | **3 passed, 9 skipped** (**Supported Command** รันผ่าน `scripts/testing/test-server-harness.cjs` ด้วย `shell: false`, Preflight port check, ควบคุม Lifecycle ของ Next dev, ทำ Controlled Process-Tree Termination, ตรวจสอบ Port Release และคืน Exit Code 0 ทันที) |
| `node scripts/testing/test-server-harness.cjs --grep "health endpoint"` | **0** | **1.3s** | **1 passed** (รองรับการส่ง Argument สำหรับเลือก Test เฉพาะจุด พร้อม Preflight และ Teardown สมบูรณ์) |
| `npm run lint` | **1** | ~20s | บันทึก Technical Debt เดิม 264 errors (ส่วนใหญ่เป็น `@typescript-eslint/no-explicit-any`) และ 156 warnings (ไม่มี error ใหม่) |
| `npm run setup:local-db-env` | **0** | <1s | ตรวจสอบ `.env.local-db` ไม่ regenerate secrets ซ้ำ และรายงาน `[ACL CHECK] Result: PASS` |
| `node scripts/setup/audit-supabase-files.cjs` | **0** | <1s | รายงานจำแนกประเภทไฟล์ 4 หมวดหมู่ (29 ไฟล์เรียก `supabaseAdmin.from(...)` โดยตรง) ถูกต้องตามหลักฐานโค้ด |

### 4.1 รายละเอียด Functional E2E Test Results & Supported Commands
- **Supported Test Execution**:
  - รัน Full Suite: `npm run test:functional`
  - รันเลือกเฉพาะ Test: `node scripts/testing/test-server-harness.cjs --grep "health endpoint"` หรือ `npm run test:functional -- --grep "health endpoint"`
- **Harness Guarantees**:
  1. **Preflight**: ตรวจสอบว่าพอร์ต 3333 ว่าง หากมี Server อื่นค้างอยู่จะ Fail ทันทีเพื่อป้องกันการรันบน Unowned Server
  2. **Process Execution**: รัน Next.js dev server และ Playwright CLI ผ่าน Node Binary (`shell: false`) โดยตรง
  3. **Controlled Teardown**: สั่ง `taskkill /PID <PID> /T /F` (Windows) หรือ `SIGKILL` (Unix) บน Process Tree ที่ Harness เป็นเจ้าของ
  4. **Verification**: รอจน Server Process emit `exit/close` และ probe socket ยืนยันว่าพอร์ต 3333 ถูก Release ก่อนส่ง Exit Code
  5. **Signal Cleanup**: มี Async Handler สำหรับ `SIGINT` / `SIGTERM` จัดการ Teardown ครบถ้วนก่อนออก
- **Passed (3)**:
  1. `health endpoint is ready` (411ms)
  2. `protected organizer page redirects without a session` (10.7s)
  3. `scoreboard supports scoring and correction` (11.6s)
- **Skipped (9)**:
  1. `six judges can open one organizer account concurrently` (ขาด `TEST_ORGANIZER_TOURNAMENT_ID`, `TEST_SESSION_COOKIE`)
  2. `registration page works for NMM` (ขาด `TEST_TOURNAMENT_NMM_ID`)
  3. `registration page works for U10` (ขาด `TEST_TOURNAMENT_U10_ID`)
  4. `registration page works for U10CUSTOM` (ขาด `TEST_TOURNAMENT_U10CUSTOM_ID`)
  5. `shared bucket page loads its bracket and standings APIs` (ขาด `TEST_BUCKET_PATH`, `TEST_BUCKET_TOURNAMENT_ID`)
  6–9. 4 tests เดียวกันบน `[mobile-chromium]` viewport

---

## 5. Security & Secret Protection

- **File ACL Hardening**: ตรวจสอบและตั้งค่า Restrictive ACL ให้ `.env.local-db` ผ่าน `execFileSync` argument array โดยบังคับ Whitelist เฉพาะ User เจ้าของ, `SYSTEM`, และ `Administrators` (หากมี Principal อื่นที่ไม่ได้รับอนุญาตจะคืน Non-zero exit code):
  ```text
  .env.local-db BUILTIN\Administrators:(F)
                NT AUTHORITY\SYSTEM:(F)
                DESKTOP-KB4HMJQ\teera:(R,W)
  ```
- **Git Ignore Verification**:
  ```text
  .gitignore:34:.env              .env
  .gitignore:33:.env*             .env.local-db
  .gitignore:44:/backups/         backups/beyx-public.dump
  .gitignore:45:*.dump            test.dump
  ```
- **Source Control Readiness**: `.gitignore`, `.env.local-db.example`, `docker-compose.local-db.yml`, `docker/`, `docs/`, `scripts/setup/`, และ `scripts/testing/` พร้อมเข้าสู่ Source Control โดยไม่มี Secrets หลุดรั่ว

---

## 6. Blockers & Outstanding Items Before Phase 0 Can Be Closed

1. 🛑 **BLOCKED — Production Logical Dump Authorization**:
   - การทำ Logical dump schema & data จาก Production Supabase และการ Rehearsal restore ลง Staging DB ยังไม่ได้รับอนุญาต
   - **กฎความปลอดภัย**: ห้ามทำ Production dump หรือต่อเขียนฐานข้อมูล Production จนกว่าจะได้รับคำสั่ง Explicit
   - **สถานะ Phase 0**: คงสถานะ In Progress / Ready for Drill จนกว่าจะได้รับสิทธิ์และคำสั่งให้ดำเนินการใน Phase 5 (Rehearsal Data Migration)
2. 🛑 **BLOCKED — Staging Test Fixtures & Credentials**:
   - การรัน 9 functional tests ที่ถูกข้ามต้องใช้ Staging Data เท่านั้น ห้ามนำ Production IDs มาใส่ในตัวแปรทดสอบ
