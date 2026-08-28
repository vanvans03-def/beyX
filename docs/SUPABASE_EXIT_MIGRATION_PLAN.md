# BeyX Supabase Exit and Local PostgreSQL Migration Plan

เอกสารฉบับนี้เป็นแผนงานระดับ Solution Architecture สำหรับย้าย BeyX ออกจาก Supabase Managed Platform ไปยัง PostgreSQL 17 ที่รันบนเซิร์ฟเวอร์ของเราเอง โดยยังคง Next.js, Redis, Cloudflare R2/Vercel Blob และพฤติกรรมของระบบเดิมไว้

สถานะเอกสาร: Implementation-ready plan  
วันที่จัดทำ: 2026-08-27  
เจ้าของระบบ: BeyX  
แนวทาง Cutover: Planned maintenance window พร้อม rollback

## 1. Executive decision

สถาปัตยกรรมเป้าหมายคือ:

```text
Internet
  -> Nginx/Caddy (TLS)
      -> Next.js
          -> PostgreSQL 17 ผ่าน pg.Pool
          -> Redis
          -> Google OAuth + JWT session ของแอป
          -> SSE + PostgreSQL LISTEN/NOTIFY สำหรับ Realtime
          -> R2/Vercel Blob สำหรับไฟล์
```

การตัดสินใจหลัก:

- ไม่ใช้ Supabase Database, Data API, Auth หรือ Realtime หลัง cutover
- ไม่ใช้ PostgREST ใน target architecture เพราะ Next.js มี API routes อยู่แล้ว
- ห้าม browser เชื่อม PostgreSQL โดยตรง
- ใช้ `pg` และ parameterized SQL จาก server-side code เท่านั้น
- เก็บ password hash ใน `public.users` เดิม จึงไม่บังคับเปลี่ยนรหัสผ่าน
- ผู้ใช้ต้อง login ใหม่หลัง cutover
- ใช้ SSE + `LISTEN/NOTIFY` แทน Supabase Realtime
- ไฟล์ยังอยู่ R2/Vercel Blob จึงไม่มีงานย้าย Supabase Storage
- ใช้ maintenance cutover แทน logical replication เพราะฐานข้อมูลมีขนาดประมาณ 24 MB

## 2. Current-state inventory

ผลตรวจฐานข้อมูล Production ก่อนจัดทำแผน:

- PostgreSQL ต้นทาง: 17.6
- ขนาดฐานข้อมูลรวม: ประมาณ 24 MB
- `public` tables: 14 ตาราง
- `public.users`: 10 rows
- Supabase Auth identities: 1 Google identity
- View: `public.player_ranking_totals`
- Functions:
  - `public.merge_player_profiles(uuid, uuid)` — ปัจจุบันเป็น `SECURITY DEFINER`
  - `public.refresh_player_win_rate_totals()`
- Supabase Realtime publication หลัก:
  - `public.matches`
  - `public.match_locks`
  - `public.internal_matches`
- โค้ดยัง subscribe การเปลี่ยนแปลง `public.tournaments` ด้วย
- RLS เปิดอยู่บางตารางและมี public read policies 5 ชุด
- Extensions ที่ต้องพิจารณา:
  - `pgcrypto`
  - `uuid-ossp`
  - `pg_stat_statements`
  - ไม่ย้าย `supabase_vault`
- มีไฟล์ใน `src` ที่พึ่ง Supabase โดยตรงประมาณ 44 ไฟล์

ตารางที่ต้องย้าย:

```text
beyblades
events
internal_matches
match_locks
matches
player_aliases
player_win_rate_totals
players
registrations
system_settings
tournament_results
tournaments
user_beyblade_points
users
```

ไม่ย้าย schema เหล่านี้:

```text
auth
realtime
storage
supabase_migrations
vault
```

## 3. Infrastructure gates

เครื่องเป้าหมายเดิมมี RAM 2 GB และ disk 49 GB ซึ่งใช้สำหรับ development/rehearsal ได้ แต่ไม่ผ่าน Production gate

Production gate ก่อน cutover:

- RAM อย่างน้อย 4 GB; แนะนำ 8 GB
- ยืนยันจำนวน vCPU ด้วย `nproc`; อย่างน้อย 2 vCPU และแนะนำ 4 vCPU
- SSD/NVMe และพื้นที่ว่างอย่างน้อย 20 GB ก่อน migration; แนะนำ disk 80 GB+
- swap 2–4 GB
- Docker image ต้อง build นอก Production host หรือยืนยันว่า build ไม่ทำให้ OOM
- PostgreSQL port 5432 bind เฉพาะ localhost/internal Docker network
- backup ต้องออกนอกเครื่องและ restore test ผ่าน

ห้าม Production cutover หาก gate ใด gate หนึ่งยังไม่ผ่าน

## 4. Delivery strategy

ใช้ strangler migration พร้อม feature flag:

```text
DATA_BACKEND=supabase   # ค่าเริ่มต้นระหว่างพัฒนา
DATA_BACKEND=postgres   # staging และ target production
REALTIME_BACKEND=supabase|sse
AUTH_BACKEND=supabase|local
```

ในช่วงพัฒนา ห้าม dual-write ไปสองฐานข้อมูลโดยไม่มี idempotency และ reconciliation เพราะเสี่ยงข้อมูลแยกกัน ให้ย้ายเป็น module และทดสอบกับ database staging แทน

## 5. Work breakdown

### Phase 0 — Baseline and safety

- [ ] สร้าง branch สำหรับ migration
- [ ] เก็บผล `npm run build`, functional, load และ realtime baseline
- [ ] ทำ Supabase logical dump แบบ read-only และเก็บนอก repository
- [ ] บันทึก row counts, schema objects, extensions, functions, views และ constraints
- [ ] สร้าง migration matrix ระหว่าง Supabase calls กับ repository methods ใหม่
- [ ] ยืนยันว่าไม่มีไฟล์ secret หรือ dump ถูก commit

Exit criteria:

- มี baseline และ dump ที่ restore ทดสอบได้
- ไม่มีการเปลี่ยน Production writes

### Phase 1 — Local PostgreSQL platform

- [ ] ใช้ `docker-compose.local-db.yml` ร่วมกับ compose เดิม
- [ ] สร้าง PostgreSQL 17 persistent volume
- [ ] สร้าง roles `beyx_admin`, `beyx_app`, `beyx_backup`
- [ ] เปิด `pgcrypto`, `uuid-ossp`, `pg_stat_statements`
- [ ] จำกัด PostgreSQL `max_connections=30`
- [ ] ตั้ง `work_mem=2MB`, `shared_buffers=128MB`, slow-query log 500 ms
- [ ] เพิ่ม healthcheck และ log rotation
- [ ] ยืนยันว่า 5432 ไม่เปิดออก Internet

หมายเหตุด้านสิทธิ์:

- `beyx_admin` ใช้ migration/restore เท่านั้น
- `beyx_app` เป็น server-only runtime role และห้ามส่ง credential ไป browser
- `beyx_backup` มี read-only access
- ระยะ compatibility สามารถให้ `beyx_app` มี `BYPASSRLS` เทียบเท่า Supabase `service_role` เดิม แต่ต้องบันทึกเป็น security debt และทบทวนก่อน Production hardening

### Phase 2 — Database access layer

- [ ] เพิ่ม singleton `pg.Pool` ที่ `src/lib/db.ts`
- [ ] `max` pool เริ่มต้นไม่เกิน 5 บนเครื่อง RAM ต่ำ
- [ ] ทุก query ต้อง parameterized
- [ ] สร้าง repository methods แทนการเรียก `supabaseAdmin.from(...)`
- [ ] ใช้ transaction กับ bracket/match operations ที่แก้หลาย row
- [ ] ทำ mapping Supabase `.select/.insert/.update/.delete/.upsert/.rpc` ให้ครบ
- [ ] แก้ hot paths ที่โหลดข้อมูลทั้งหมดโดยไม่จำเป็น
- [ ] เพิ่ม index จาก `WHERE`, `JOIN`, foreign keys และ `ORDER BY` ที่ใช้งานจริง

ลำดับ module ที่แนะนำ:

1. Public read APIs
2. Registration APIs
3. Admin tournaments/registrations
4. Matches/brackets/locks
5. Rankings/player merge/refresh functions
6. Webhooks และ migration utilities
7. OG image/server components

Exit criteria:

- `rg` ไม่พบ server-side Supabase data calls ใน module ที่ย้ายแล้ว
- unit/integration tests ของ module ผ่านทั้ง Supabase baseline และ PostgreSQL staging

### Phase 3 — Authentication

- [ ] เปลี่ยน `SUPABASE_JWT_SECRET` เป็น `APP_SESSION_SECRET`
- [ ] ใช้ `public.users` และ password hashes เดิม
- [ ] เปลี่ยน login route เป็น PostgreSQL repository
- [ ] เปลี่ยน Google OAuth เป็น Auth.js หรือ Google OAuth โดยตรง
- [ ] callback ต้อง link ด้วย normalized email กับ user เดิมก่อนสร้าง user ใหม่
- [ ] เพิ่ม unique constraint/index สำหรับ normalized username และ email
- [ ] ทำ CSRF/state/nonce validation สำหรับ OAuth
- [ ] ใช้ `HttpOnly`, `Secure`, `SameSite=Lax` session cookie
- [ ] บังคับ re-authenticate ตอน cutover

ไม่ย้าย `auth.users`, sessions, refresh tokens หรือ Supabase OAuth tables

### Phase 4 — Realtime replacement

- [ ] เพิ่ม trigger function สำหรับ `matches`, `match_locks`, `internal_matches`, `tournaments`
- [ ] trigger ส่งเฉพาะ event type, primary key และ tournament id ผ่าน `pg_notify`
- [ ] ห้ามส่ง sensitive/full row ใน NOTIFY payload
- [ ] เพิ่ม SSE endpoint ตาม tournament พร้อม authorization
- [ ] เพิ่ม heartbeat, reconnect และ backoff
- [ ] browser ได้ event แล้ว refetch เฉพาะ resource ที่เปลี่ยน
- [ ] ถ้ามี Next.js มากกว่าหนึ่ง instance ให้ bridge ผ่าน Redis Pub/Sub
- [ ] เปลี่ยน realtime performance test ให้รองรับ SSE

Exit criteria:

- 50 concurrent SSE clients เชื่อมต่อผ่าน
- คะแนน, locks, bracket และ tournament status อัปเดตถูกต้อง
- reconnect หลัง network interruption ผ่าน

### Phase 5 — Rehearsal data migration

ใช้ PostgreSQL 17 client ที่ version เท่ากับหรือใหม่กว่าต้นทาง และใช้ Supabase direct/session connection ไม่ใช้ transaction pooler 6543

ตรวจ syntax ก่อนรันเสมอ:

```bash
pg_dump --version
pg_dump --help
pg_restore --version
pg_restore --help
```

สร้าง public-only dump:

```bash
pg_dump "$SOURCE_DATABASE_URL" \
  --schema=public \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=backups/beyx-public.dump
```

เหตุผลที่ใช้ `--schema=public`: target ไม่ได้ self-host Supabase ทั้ง stack จึงต้องหลีกเลี่ยง managed schemas, reserved roles และ Supabase internals

restore เข้าฐาน staging ที่ว่าง:

```bash
pg_restore \
  --dbname="$TARGET_ADMIN_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --verbose \
  backups/beyx-public.dump
```

หลัง restore:

```bash
psql "$TARGET_ADMIN_DATABASE_URL" \
  --set=ON_ERROR_STOP=1 \
  --file=docker/postgres/post-restore/001-grants.sql
```

ตรวจและแก้ object ที่ผูกกับ Supabase roles/functions โดยเฉพาะ grants ไป `anon`, `authenticated`, `service_role`, การอ้าง `auth.*` และ `SECURITY DEFINER`

### Phase 6 — Data reconciliation

- [ ] public tables ครบ 14 ตาราง
- [ ] row counts ตรงทุกตาราง
- [ ] primary keys, UUIDs, foreign keys และ sequences ตรง
- [ ] view `player_ranking_totals` query ได้
- [ ] functions 2 ตัวให้ผลตรงต้นทาง
- [ ] login ด้วย password เดิมผ่าน
- [ ] Google OAuth link user เดิม ไม่สร้าง duplicate
- [ ] สุ่มตรวจ tournaments, registrations, matches, rankings อย่างน้อย 10 ชุด
- [ ] เปรียบเทียบ aggregate/checksum รายตารางสำหรับข้อมูลสำคัญ
- [ ] `ANALYZE` และตรวจ query plans ของ hot paths

Baseline โดยประมาณ ณ วันที่ inventory:

```text
matches                 13,120
registrations            6,525
match_locks              4,093
internal_matches         3,647
players                  2,852
public.users                10
```

ตัวเลขในวัน cutover ต้องใช้ค่าที่ query ใหม่ ไม่ใช้ baseline นี้เป็น expected final count

### Phase 7 — Validation

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:functional`
- [ ] `npm run test:load`
- [ ] realtime/SSE capacity test
- [ ] test backup และ restore ลง database ว่าง
- [ ] security review: auth, SQL injection, privileges, exposed ports, secrets
- [ ] restart test: app, Redis และ PostgreSQL ต้องกลับมาเอง
- [ ] disk-full/connection exhaustion alert ถูกกำหนด

Performance acceptance:

- HTTP error rate <= 1%
- HTTP p95 <= 2,000 ms
- SSE 50 clients success 100% ใน measured test
- ไม่มี connection leak
- PostgreSQL connections ไม่เกิน configured limit
- ไม่มี OOM หรือ swap thrashing ระหว่าง test

### Phase 8 — Production cutover

คาด maintenance window 15–30 นาทีสำหรับฐานข้อมูลขนาดปัจจุบัน แต่ให้จอง 60 นาที

1. ยืนยัน Production gates และ restore drill
2. ประกาศ maintenance
3. ปิด registration, score writes และ webhook processing
4. หยุด app instance ที่เขียน Supabase
5. ทำ final public-only dump
6. restore เข้า target production database ที่ว่าง
7. รัน post-restore grants และ verification
8. deploy app ด้วย `DATA_BACKEND=postgres`, `AUTH_BACKEND=local`, `REALTIME_BACKEND=sse`
9. เริ่ม app ใน maintenance/read-only mode
10. smoke test public pages, login, admin, registration, bracket, scoring, rankings และ SSE
11. เปิด writes
12. monitor ต่อเนื่องอย่างน้อย 2 ชั่วโมง

## 6. Rollback plan

ก่อนเปิด writes บน PostgreSQL ใหม่:

- เปลี่ยน feature flags กลับ Supabase
- start app เดิม
- rollback ได้โดยไม่ reconcile เพราะ Supabase ยังเป็น source of truth

หลังเปิด writes บน PostgreSQL ใหม่:

- ห้ามสลับกลับทันที
- ปิด writes ทั้งสองฝั่ง
- export/reconcile delta จาก PostgreSQL ใหม่กลับ Supabase ก่อน
- ตัดสินใจ rollback ภายใน observation window แรกเพื่อลด delta

เก็บ Supabase project แบบไม่ลบอย่างน้อย 14–30 วัน และเก็บ final dump แบบเข้ารหัสนอกเครื่อง

## 7. Backup and operations

- logical `pg_dump` ทุกคืนไปยัง R2/off-host storage
- retention: daily 7, weekly 4, monthly 3
- dump ต้องเข้ารหัสก่อน upload
- restore drill อย่างน้อยเดือนละครั้ง
- alert: disk > 75%, connections > 70%, repeated restarts, backup failure, p95 regression
- จำกัด Docker json logs และหมุน logs
- หากต้องการ PITR ให้เพิ่ม WAL archiving ภายหลัง ไม่ถือว่า nightly dump เทียบเท่า PITR

## 8. Decommission checklist

ทำหลัง Production stable 14–30 วันเท่านั้น:

- [ ] final Supabase archive ถูกตรวจ restore แล้ว
- [ ] ไม่มี `@supabase/supabase-js` หรือ `@supabase/ssr` ใน runtime
- [ ] ไม่มี Supabase URLs/keys ใน runtime environment
- [ ] OAuth redirect URLs ชี้ระบบใหม่
- [ ] Supabase webhooks/realtime subscriptions ถูกถอด
- [ ] rotate/revoke Supabase keys
- [ ] ลบ Supabase project หลังเจ้าของระบบอนุมัติแบบ explicit

## 9. Definition of done

งานถือว่าเสร็จเมื่อ:

1. ระบบทุก feature ใช้ PostgreSQL ในเครื่องเป็น source of truth เดียว
2. ไม่มี runtime dependency ต่อ Supabase
3. ข้อมูลผ่าน reconciliation ครบ
4. Auth และ Realtime replacement ผ่าน functional/load tests
5. backup และ restore drill ผ่าน
6. cutover และ rollback runbooks ได้รับการทบทวน
7. monitoring/alerts พร้อม
8. Supabase ยังไม่ถูกลบจนพ้น observation window และได้รับอนุมัติ

## 10. Prepared Docker files

- `docker-compose.local-db.yml` — compose overlay สำหรับ PostgreSQL และ app connection
- `.env.local-db.example` — template ตัวแปรโดยไม่มี secret จริง
- `docker/postgres/init/001-bootstrap.sql` — roles/extensions/default privileges
- `docker/postgres/post-restore/001-grants.sql` — grants หลัง restore

เริ่มเฉพาะ PostgreSQL สำหรับ rehearsal:

```powershell
Copy-Item .env.local-db.example .env.local-db
# แก้ค่ารหัสผ่านทั้งหมดก่อนรัน
docker compose --env-file .env --env-file .env.local-db `
  -f docker-compose.yml -f docker-compose.local-db.yml `
  up -d postgres
```

ตรวจ config ก่อนทุกครั้ง:

```powershell
docker compose --env-file .env --env-file .env.local-db `
  -f docker-compose.yml -f docker-compose.local-db.yml `
  config
```

อย่าสั่ง `down -v` บน Production เพราะจะลบ PostgreSQL volume

