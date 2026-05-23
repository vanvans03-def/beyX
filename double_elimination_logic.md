# ระบบจัดสายการแข่งขัน Double Elimination

## ภาพรวมระบบ

ระบบนี้รองรับการแข่งขันแบบ **Double Elimination** คือผู้เล่นจะตกรอบได้ก็ต่อเมื่อแพ้ **2 ครั้ง** เท่านั้น

---

## ขั้นตอนที่ 1: Seeding Round (Pre-Bracket / Qualifying)

### จุดประสงค์
ปรับจำนวนผู้เข้าแข่งขันให้เป็นเลข **2^n** (เช่น 8, 16, 32, 64)

### ตัวอย่าง: ผู้สมัคร 19 คน → ต้องการ 16 คน

```
จำนวนที่ต้องตัดออก = 19 - 16 = 3 คน
จำนวนคู่ Seeding   = 3 คู่ (ผู้ชนะ 3 คน เข้าสู่วงเล็บ 16 ตำแหน่งที่เหลือ)
```

### การจัดสาย Seeding Round
ผู้เล่นที่ได้ Seed สูง (อันดับต้น) จะ **ได้ Bye** (ผ่านรอบนี้โดยไม่ต้องแข่ง)

```
Seed  1  → BYE (เข้า Slot 1 โดยตรง)
Seed  2  → BYE (เข้า Slot 2 โดยตรง)
Seed  3  → BYE (เข้า Slot 3 โดยตรง)
...
Seed 13  → BYE (เข้า Slot 13 โดยตรง)

Seed 14 vs Seed 19  → ผู้ชนะเข้า Slot 14
Seed 15 vs Seed 18  → ผู้ชนะเข้า Slot 15
Seed 16 vs Seed 17  → ผู้ชนะเข้า Slot 16
```

> **หลักการ:** Seed สูงสุดจะเจอ Seed ต่ำสุด เพื่อปกป้องผู้เล่นดีไว้ในรอบหลัก

### สูตรคำนวณ Seeding Round

```
ขนาด Bracket ถัดไป (N) = 2^⌈log2(จำนวนผู้สมัคร)⌉
จำนวนคู่ Seeding       = จำนวนผู้สมัคร - N
Bye จนถึง Seed         = N - จำนวนคู่ Seeding
```

---

## ขั้นตอนที่ 2: Winners Bracket (สายบน)

### โครงสร้าง
- ผู้เล่นทุกคนเริ่มต้นที่สายบน
- ผู้ชนะในแต่ละรอบจะขยับไปรอบถัดไปในสายบน
- **ผู้แพ้** จะถูก **ตกลงมาสายล่าง** (ยังไม่ตกรอบ)

### ตัวอย่าง 16 คน (4 รอบ)

```
รอบ 1 (Round of 16): 8 คู่ → ผู้ชนะ 8 คน, ผู้แพ้ 8 คน
รอบ 2 (Quarter):      4 คู่ → ผู้ชนะ 4 คน, ผู้แพ้ 4 คน
รอบ 3 (Semi):         2 คู่ → ผู้ชนะ 2 คน, ผู้แพ้ 2 คน
รอบ 4 (Final WB):     1 คู่ → แชมป์สายบน 1 คน, ผู้แพ้ 1 คน
```

### การจัดสาย (Seeding ใน Bracket)
ใช้ระบบ Standard Bracket Seeding:

```
ตำแหน่ง:  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]  [9] [10] [11] [12] [13] [14] [15] [16]
Seed:       1   16    8    9    5   12    4   13    6   11    3   14    7   10    2   15

คู่ที่ 1:  Seed 1  vs Seed 16
คู่ที่ 2:  Seed 8  vs Seed 9
คู่ที่ 3:  Seed 5  vs Seed 12
คู่ที่ 4:  Seed 4  vs Seed 13
คู่ที่ 5:  Seed 6  vs Seed 11
คู่ที่ 6:  Seed 3  vs Seed 14
คู่ที่ 7:  Seed 7  vs Seed 10
คู่ที่ 8:  Seed 2  vs Seed 15
```

---

## ขั้นตอนที่ 3: Losers Bracket (สายล่าง)

### หลักการสำคัญ
1. ผู้แพ้จากสายบน **ตกลงมาสายล่าง** ตามรอบที่แพ้
2. ในสายล่าง ผู้แพ้ **ตกรอบทันที** (เพราะนี่คือการแพ้ครั้งที่ 2)
3. จำนวนรอบในสายล่าง = **(จำนวนรอบสายบน × 2) - 1**

### ตัวอย่าง 16 คน: สายล่างมี 7 รอบ

```
WB = Winners Bracket  |  LB = Losers Bracket
```

#### รอบ LB1 — ผู้แพ้จาก WB Round 1 (8 คน → 4 คู่)

```
ผู้แพ้ WB R1 คู่ 1  vs  ผู้แพ้ WB R1 คู่ 2
ผู้แพ้ WB R1 คู่ 3  vs  ผู้แพ้ WB R1 คู่ 4
ผู้แพ้ WB R1 คู่ 5  vs  ผู้แพ้ WB R1 คู่ 6
ผู้แพ้ WB R1 คู่ 7  vs  ผู้แพ้ WB R1 คู่ 8
```
→ ผู้ชนะ 4 คน อยู่ต่อในสายล่าง

#### รอบ LB2 — ผู้รอด LB1 (4 คน) เจอ ผู้แพ้จาก WB Round 2 (4 คน)

```
ผู้แพ้ WB R2 คู่ 1  vs  ผู้ชนะ LB1 คู่ที่เหมาะสม
ผู้แพ้ WB R2 คู่ 2  vs  ผู้ชนะ LB1 คู่ที่เหมาะสม
...
```
→ ผู้ชนะ 4 คน อยู่ต่อ

#### รอบ LB3 — ผู้รอด LB2 ชนกันเอง (4 คน → 2 คู่)

```
ผู้ชนะ LB2 คู่ 1  vs  ผู้ชนะ LB2 คู่ 2
ผู้ชนะ LB2 คู่ 3  vs  ผู้ชนะ LB2 คู่ 4
```
→ ผู้ชนะ 2 คน อยู่ต่อ

#### รอบ LB4 — ผู้รอด LB3 (2 คน) เจอ ผู้แพ้จาก WB Semi (2 คน)

```
ผู้แพ้ WB Semi 1  vs  ผู้ชนะ LB3 คู่ 1
ผู้แพ้ WB Semi 2  vs  ผู้ชนะ LB3 คู่ 2
```

#### รอบ LB5 — ผู้รอด LB4 ชนกันเอง (2 คน → 1 คู่)

```
ผู้ชนะ LB4 คู่ 1  vs  ผู้ชนะ LB4 คู่ 2
```

#### รอบ LB6 — ผู้รอด LB5 (1 คน) เจอ ผู้แพ้จาก WB Final (1 คน)

```
ผู้แพ้ WB Final  vs  ผู้ชนะ LB5
```

#### รอบ LB7 (LB Final) — ผู้รอด LB6 ชนกันเอง (ถ้ามี 2 คน)

> ในกรณีนี้ LB6 จะได้แชมป์สายล่าง 1 คนเลย เพราะเหลือ 2 คนเจอกัน

---

### ทำไมจำนวนผู้เล่นถึงเท่ากันพอดีเสมอ?

นี่คือคำถามสำคัญ — ผู้แพ้จาก WB ลงมาสายล่างในจำนวนที่ไม่แน่นอน แล้วจะจับคู่ได้อย่างไร?

คำตอบคือสายล่าง **สลับ 2 ประเภทรอบ** ตลอดเวลา:

#### Culling Round (รอบชน)
ผู้รอดในสายล่างชนกันเอง ไม่มีผู้แพ้จาก WB ลงมา ผลคือจำนวนลดลงครึ่งหนึ่ง

```
ตัวอย่าง: ผู้รอด 8 คน → ชนกันเอง 4 คู่ → เหลือ 4 คน
```

#### Mixing Round (รอบยก)
ผู้รอดในสายล่างรับผู้แพ้จาก WB มาเจอกัน จำนวนจะเท่ากันพอดีเสมอ เพราะ WB ก็ส่งออกผู้แพ้ครึ่งหนึ่งในทุกรอบ

```
ตัวอย่าง: ผู้รอด LB 4 คน + ผู้แพ้ WB 4 คน → 4 คู่ → เหลือ 4 คน
```

#### Pattern ของ 16 คน (LB 7 รอบ)

| LB รอบ | ประเภท | ผู้เล่นที่เข้า | จำนวนคู่ | ผู้รอด |
|--------|--------|--------------|---------|--------|
| LB R1  | Culling  | แพ้ WB R1 (8 คน) ชนกันเอง | 4 คู่ | 4 คน |
| LB R2  | Mixing   | รอด LB R1 (4) + แพ้ WB R2 (4) | 4 คู่ | 4 คน |
| LB R3  | Culling  | รอด LB R2 (4 คน) ชนกันเอง | 2 คู่ | 2 คน |
| LB R4  | Mixing   | รอด LB R3 (2) + แพ้ WB Semi (2) | 2 คู่ | 2 คน |
| LB R5  | Culling  | รอด LB R4 (2 คน) ชนกันเอง | 1 คู่ | 1 คน |
| LB R6  | Mixing   | รอด LB R5 (1) + แพ้ WB Final (1) | 1 คู่ | แชมป์ LB |

> **กฎจำง่าย:** LB R1 เป็น Culling เสมอ แล้วสลับ Mixing → Culling → Mixing ไปเรื่อยๆ จนถึง LB Final ซึ่งเป็น Mixing เสมอ (รับผู้แพ้จาก WB Final)

---

## ขั้นตอนที่ 4: Grand Final (รอบชิงชนะเลิศ)

### โครงสร้าง

```
แชมป์สายบน (0 แพ้)  vs  แชมป์สายล่าง (1 แพ้)
```

### กฎสำคัญ: Grand Final Reset

| ผลลัพธ์ | สถานการณ์ |
|---------|-----------|
| แชมป์สายบนชนะ | จบการแข่งขัน — แชมป์สายบนคือผู้ชนะ |
| แชมป์สายล่างชนะ | **ต้องแข่งซ้ำ (Grand Final Reset)** เพราะตอนนี้ทั้งคู่แพ้คนละ 1 ครั้ง |

### Grand Final Reset
- ถ้าแชมป์สายล่างชนะ GF นัดแรก → แข่งนัดที่ 2 (Reset Match)
- นัดที่ 2 ผู้ใดชนะ = **แชมป์** (ทั้งคู่เริ่มต้นเท่ากัน คือแพ้คนละ 1 ครั้ง)

```
Grand Final นัด 1:
  ถ้า WB Champion ชนะ  → WB Champion = แชมป์ (จบ)
  ถ้า LB Champion ชนะ  → ไป Grand Final Reset

Grand Final Reset (นัด 2):
  ผู้ชนะ = แชมป์รายการ
```

---

## การจัดลำดับรอบ (Round Scheduling)

### ปัญหา: LB เริ่มช้าเกินไป

ระบบที่รอให้ WB รอบหนึ่งเสร็จทั้งหมดก่อนจึงเริ่ม LB จะทำให้สายล่างช้ากว่าที่ควรเป็น

**ตัวอย่าง 19 คน — ผิด vs ถูก:**

```
❌ ผิด (LB เริ่มช้า):
  Phase 1: Seeding (3 คู่)
  Phase 2: WB R1  (8 คู่)
  Phase 3: WB R2  (4 คู่)  ← LB R1 เพิ่งเริ่ม (ผู้แพ้ Seeding + WB R1 รวม 11 คน)
  Phase 4: WB R3  (2 คู่) + LB R1

✅ ถูก (LB เริ่มทันที):
  Phase 1: Seeding (3 คู่)
  Phase 2: WB R1  (8 คู่) + LB R1 (ผู้แพ้ Seeding 3 คน → 1 คู่ + 1 BYE)
  Phase 3: WB R2  (4 คู่) + LB R2 (Mixing: รอด LB R1 + แพ้ WB R1)
  Phase 4: WB R3  (2 คู่) + LB R3 (Culling)
  ...
```

### หลักการจัดลำดับที่ถูกต้อง

> **ผู้แพ้จากรอบใดก็ตาม ต้องลง LB ใน Phase ถัดไปทันที ไม่รอ**

แต่ละ Phase จะประกอบด้วย:
- **WB แมตช์** ของรอบนั้น
- **LB แมตช์** ที่ใช้ผู้แพ้จาก WB Phase ก่อนหน้า

### ตาราง Phase Scheduling: 19 คน

| Phase | WB | LB | ผู้แพ้ที่ส่งต่อ |
|-------|----|----|----------------|
| 1 | Seeding (3 คู่) | — | แพ้ Seeding 3 คน → LB Phase 2 |
| 2 | WB R1 (8 คู่) | LB R1: แพ้ Seeding 3 คน (1 คู่ + 1 BYE) | แพ้ WB R1 8 คน → LB Phase 3 |
| 3 | WB R2 (4 คู่) | LB R2 Mixing: รอด LB R1 (2) + แพ้ WB R1 (8) = 5 คู่ | แพ้ WB R2 4 คน → LB Phase 4 |
| 4 | WB R3 (2 คู่) | LB R3 Culling: รอด LB R2 (5) → ไม่ลงตัว! → BYE 1 คน, 2 คู่ | แพ้ WB R3 2 คน → LB Phase 5 |
| 5 | WB Final (1 คู่) | LB R4 Mixing: รอด LB R3 (3) + แพ้ WB R3 (2) = ยังคี่อยู่ → BYE | แพ้ WB Final → LB Phase 6 |
| 6 | — | LB Final: แชมป์ LB |  |
| 7 | Grand Final | | |

### Pseudocode: Phase-based Scheduling

```typescript
interface Phase {
  phaseNumber: number
  wbMatches: Match[]
  lbMatches: Match[]
}

function buildSchedule(players: Player[]): Phase[] {
  const phases: Phase[] = []
  const N = nextPowerOf2(players.length)
  const numSeedingMatches = players.length - N

  // Phase 1: Seeding
  const seedingMatches = createSeedingRound(players)
  phases.push({ phaseNumber: 1, wbMatches: seedingMatches, lbMatches: [] })

  // เก็บผู้แพ้ที่รอลง LB
  let pendingLBDrops: Player[] = []    // ผู้แพ้ที่ยังไม่ได้ลง LB
  let lbSurvivors: Player[] = []       // ผู้รอดในสายล่างจากรอบก่อน
  let lbRoundType: 'culling' | 'mixing' = 'culling'  // LB R1 = Culling เสมอ
  let previousByeIds = new Set<number>()

  let wbPlayers = getWBStarters(players, seedingMatches)  // 16 คนที่ผ่าน Seeding
  let wbRound = 1

  while (wbPlayers.length > 1) {
    const phase: Phase = { phaseNumber: phases.length + 1, wbMatches: [], lbMatches: [] }

    // WB แมตช์รอบนี้
    const wbMatches = createWBRound(wbPlayers)
    phase.wbMatches = wbMatches

    // LB แมตช์: ใช้ผู้แพ้จาก Phase ก่อน (pendingLBDrops) + ผู้รอด LB เดิม
    if (pendingLBDrops.length > 0 || lbSurvivors.length > 0) {
      let lbPlayers: Player[]

      if (lbRoundType === 'culling') {
        // Culling: เฉพาะผู้รอด LB (หรือผู้แพ้ Seeding ครั้งแรก) ชนกันเอง
        lbPlayers = lbSurvivors.length > 0 ? lbSurvivors : pendingLBDrops
        pendingLBDrops = []
      } else {
        // Mixing: รอด LB + ผู้แพ้ WB รอบก่อน
        lbPlayers = [...lbSurvivors, ...pendingLBDrops]
        pendingLBDrops = []
      }

      const { matches: lbMatchPairs, byes } = assignByes(lbPlayers, previousByeIds)
      previousByeIds = new Set(byes.map(p => p.id))

      phase.lbMatches = lbMatchPairs.map(([p1, p2]) => createMatch(p1, p2, 'losers'))
      lbSurvivors = [...byes]  // BYE players รอดทันที

      lbRoundType = lbRoundType === 'culling' ? 'mixing' : 'culling'
    }

    // ผู้แพ้ WB รอบนี้จะลง LB ใน Phase ถัดไป
    pendingLBDrops = wbMatches.map(m => m.loser).filter(Boolean) as Player[]
    lbSurvivors = [...lbSurvivors, ...phase.lbMatches.map(m => m.winner).filter(Boolean) as Player[]]

    wbPlayers = wbMatches.map(m => m.winner).filter(Boolean) as Player[]
    wbRound++
    phases.push(phase)
  }

  return phases
}
```

### กฎสรุป: เมื่อไหร่ LB รอบไหนเริ่ม

```
LB R1 เริ่ม Phase เดียวกับ WB R1
  → ใช้ผู้แพ้จาก Seeding Round

LB R2 เริ่ม Phase เดียวกับ WB R2
  → ใช้ผู้รอด LB R1 + ผู้แพ้ WB R1

LB Rn เริ่ม Phase เดียวกับ WB Rn
  → ใช้ผู้รอด LB R(n-1) + ผู้แพ้ WB R(n-1)

LB Final เริ่ม Phase สุดท้ายก่อน Grand Final
  → ใช้ผู้รอด LB ก่อนหน้า + ผู้แพ้ WB Final
```

---

## ภาพรวม Flow ทั้งหมด

```
[ผู้สมัคร N คน]
       │
       ▼
[Phase 1: Seeding]──────────────────────────┐
       │                               แพ้ Seeding
       ▼                                    │
[Phase 2: WB R1] + [LB R1 ←────────────────┘]
       │                    ผู้แพ้ WB R1
       ▼                         │
[Phase 3: WB R2] + [LB R2 Mixing ←──────────]
       │                    ผู้แพ้ WB R2
       ▼                         │
[Phase 4: WB R3] + [LB R3 Culling]
       │                    ผู้แพ้ WB R3
       ▼                         │
      ...   + [LB R4 Mixing ←────]
       │
       ▼
[Phase n: WB Final] + [LB Rn Culling]
       │                    ผู้แพ้ WB Final
       ▼                         │
[Phase n+1: LB Final Mixing ←────]
       │
       ▼
[Grand Final]
    ┌──┴──┐
WB ชนะ  LB ชนะ
    │        │
   จบ!   [GF Reset]
              │
           แชมป์!
```

---

## ตารางสรุป: จำนวนรอบตามขนาด Bracket

| ผู้เล่น | WB Rounds | LB Rounds | Grand Final | รวมแมตช์ทั้งหมด |
|---------|-----------|-----------|-------------|-----------------|
| 4       | 2         | 3         | 1-2         | 7-8             |
| 8       | 3         | 5         | 1-2         | 15-16           |
| 16      | 4         | 7         | 1-2         | 31-32           |
| 32      | 5         | 9         | 1-2         | 63-64           |
| 64      | 6         | 11        | 1-2         | 127-128         |

> สูตร: `รวมแมตช์ = (N-1) × 2` หรือ `(N-1) × 2 + 1` ถ้ามี Reset

---

## Logic การเขียนโปรแกรม (Pseudocode)

### โครงสร้างข้อมูล

```typescript
interface Player {
  id: number
  name: string
  seed: number
  losses: number        // 0 = สายบน, 1 = สายล่าง, 2 = ตกรอบ
  bracket: 'winners' | 'losers' | 'eliminated'
}

interface Match {
  id: string
  round: number
  bracket: 'seeding' | 'winners' | 'losers' | 'grand_final'
  player1: Player | null   // null = BYE
  player2: Player | null
  winner: Player | null
  loser: Player | null
}

interface Tournament {
  players: Player[]
  matches: Match[]
  winnersRounds: Match[][]
  losersRounds: Match[][]
  grandFinal: Match[]    // อาจมี 1-2 นัด
  status: 'seeding' | 'running' | 'finished'
}
```

### ฟังก์ชันหลัก

```typescript
// 1. สร้าง Seeding Round
function createSeedingRound(players: Player[]): Match[] {
  const targetSize = nextPowerOf2(players.length)
  const byeCount = targetSize - players.length  // ไม่ใช่จำนวนคู่
  // จริงๆ คือ: byeSeeds = targetSize - numMatches, numMatches = players - targetSize/2
  // ง่ายกว่า:
  const numMatches = players.length - targetSize / 2  // ← จำนวนคู่ Seeding ที่ต้องแข่ง
  
  const matches: Match[] = []
  for (let i = 0; i < numMatches; i++) {
    matches.push({
      player1: players[targetSize - numMatches + i],     // Seed สูง (ต่ำกว่า)
      player2: players[players.length - 1 - i],          // Seed ต่ำสุด
    })
  }
  return matches
}

// 2. บันทึกผลแมตช์
function recordResult(match: Match, winner: Player): void {
  match.winner = winner
  match.loser = match.player1 === winner ? match.player2 : match.player1

  match.winner.losses = match.winner.losses  // ไม่เปลี่ยน
  match.loser.losses += 1

  if (match.loser.losses >= 2) {
    match.loser.bracket = 'eliminated'
  } else {
    match.loser.bracket = 'losers'
  }
}

// 3. Drop ผู้แพ้จาก WB ลงสายล่าง
function dropToLosers(wbRoundLosers: Player[], lbRound: Match[]): void {
  // จับคู่ผู้แพ้จาก WB เข้าสายล่าง
  // ต้อง anti-rematch: หลีกเลี่ยงให้เจอคนเดิม
  for (let i = 0; i < wbRoundLosers.length; i += 2) {
    lbRound.push({
      player1: wbRoundLosers[i],
      player2: /* ผู้รอดสายล่างที่เหมาะสม */ ...
    })
  }
}

// 4. ตรวจสอบ Grand Final Reset
function checkGrandFinalReset(gf1: Match): boolean {
  // ถ้าแชมป์สายล่างชนะ GF นัดแรก → ต้องแข่ง Reset
  return gf1.winner?.bracket === 'losers'  // ก่อน GF winner ยัง track ได้
}

// 5. หา Power of 2 ถัดไป
function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)))
}
```

---

## กรณีพิเศษ (Edge Cases)

| กรณี | การจัดการ |
|------|-----------|
| ผู้เล่นจำนวนเป็น 2^n พอดี | ไม่มี Seeding Round |
| BYE ในสายล่าง | ถ้าจำนวนผู้แพ้เป็นเลขคี่ → คนที่เหลือได้ BYE ผ่านรอบนั้น |
| Anti-rematch | พยายามไม่ให้เจอคู่เดิมในรอบถัดๆ ไป |
| Grand Final Reset | แชมป์สายล่างชนะ GF นัด 1 → แข่งนัด 2 (ทั้งคู่ 1 แพ้เท่ากัน) |
| ผู้เล่น 2 คน | ไม่มีสายล่าง, แข่งตรงๆ แบบ Bo3 แทน |

---

## การจัดการ BYE ในสายล่าง (รองรับผู้เล่นทุกขนาด)

### ปัญหา: ผู้แพ้ Seeding Round จำนวนคี่

เมื่อจำนวนผู้สมัครไม่ใช่ `2^n` พอดี จะมี Seeding Round และผู้แพ้จาก Seeding จะลงสายล่าง LB R1 แต่จำนวนอาจเป็นเลขคี่ จับคู่ไม่ลงตัว

**ตัวอย่าง: 19 คน → Seeding 3 คู่ → ผู้แพ้ Seeding 3 คน ลง LB R1**

```
LB R1 มี 3 คน → จับคู่ได้แค่ 1 คู่ → เหลือ 1 คน ไม่มีคู่  ❌
```

### วิธีแก้: ให้ BYE แก่ผู้แพ้ที่ Seed สูงที่สุด

Seed ที่สูงกว่า (อันดับดีกว่า) ใน Seeding Round ได้ BYE ผ่าน LB R1 โดยอัตโนมัติ

```
ตัวอย่าง 19 คน:

Seeding Round:
  Seed 14 vs Seed 19  → ผู้ชนะขึ้น WB, ผู้แพ้ลง LB R1
  Seed 15 vs Seed 18  → ผู้ชนะขึ้น WB, ผู้แพ้ลง LB R1
  Seed 16 vs Seed 17  → ผู้ชนะขึ้น WB, ผู้แพ้ลง LB R1

LB R1 มี 3 คน:
  แพ้(Seed14vs19) vs แพ้(Seed15vs18)  → 1 คู่
  แพ้(Seed16vs17)                      → ได้ BYE ✓ (Seed สูงที่สุดในกลุ่ม)
```

ผู้ได้ BYE ผ่านไป LB R2 โดยตรง และรอพบผู้ชนะจาก LB R1

### สูตรทั่วไป: คำนวณ BYE ในสายล่าง

```
จำนวนผู้แพ้ Seeding = S  (= จำนวนคู่ Seeding)
ถ้า S เป็นเลขคู่ → ไม่มี BYE, จับคู่ได้ทั้งหมด
ถ้า S เป็นเลขคี่ → BYE = 1 คน (Seed สูงที่สุดในกลุ่มผู้แพ้ Seeding)
```

> **ทำไม Seed สูงที่สุดถึงได้ BYE?**
> เพราะ Seed สูงกว่าแสดงว่าฝีมือดีกว่า การให้ BYE แก่คนที่ดีกว่าจะทำให้สายล่างยุติธรรมขึ้น และสอดคล้องกับหลักการ Seeding ที่ปกป้องผู้เล่นดี

### Pseudocode: จัดการ BYE ใน LB R1

```typescript
function buildLBRound1(seedingLosers: Player[]): Match[] {
  const matches: Match[] = []

  // เรียงจาก Seed ต่ำ → สูง (ฝีมือแย่ → ดี)
  const sorted = [...seedingLosers].sort((a, b) => b.seed - a.seed)
  // sorted[0] = Seed ต่ำที่สุด (ฝีมือแย่ที่สุด)
  // sorted[last] = Seed สูงที่สุด (ฝีมือดีที่สุด)

  let byePlayer: Player | null = null

  if (sorted.length % 2 !== 0) {
    // จำนวนคี่ → Seed สูงที่สุดได้ BYE
    byePlayer = sorted.pop()!
  }

  // จับคู่ที่เหลือ: Seed ต่ำสุด vs Seed สูงสุด
  let lo = 0, hi = sorted.length - 1
  while (lo < hi) {
    matches.push(createMatch(sorted[lo], sorted[hi], 'losers', 1))
    lo++
    hi--
  }

  // byePlayer ข้ามไปรอใน LB R2 โดยตรง
  if (byePlayer) {
    matches.push(createByeMatch(byePlayer, 'losers', 1))
  }

  return matches
}

// ผู้ได้ BYE ถือว่า "ชนะ" ทันที และรอพบผู้ชนะ LB R1 ใน LB R2
function createByeMatch(player: Player, bracket: string, round: number): Match {
  return {
    player1: player,
    player2: null,   // null = BYE
    winner: player,  // ชนะทันที
    loser: null,
    isBye: true
  }
}
```

### ตัวอย่างเต็ม: 19 คน — LB R1 และ LB R2

```
LB R1 (3 คน):
  แมตช์ 1:  แพ้(Seed14vs19) vs แพ้(Seed15vs18)  → ผู้ชนะ A
  BYE:       แพ้(Seed16vs17)                      → ผ่านไป LB R2 เลย

LB R2 (ผู้ชนะ LB R1 + BYE + ผู้แพ้ WB R1):
  ผู้รอดจาก LB R1 = 2 คน (A + BYE player)
  ผู้แพ้จาก WB R1  = 8 คน

  → รวม 10 คน → จับคู่ไม่ลงตัวอีก!
```

### ปัญหาที่ 2: LB R2 ยังคี่อยู่

เมื่อ LB R1 มีผู้รอด 2 คน (1 จากการแข่ง + 1 BYE) และ WB R1 ส่งผู้แพ้มา 8 คน รวมเป็น 10 คน → จับคู่ได้ 5 คู่ → ลงตัวปกติ ✓

แต่ถ้า WB R1 ส่งผู้แพ้ 8 คน และ LB R1 รอด 2 คน ต้องทำเป็น Mixing Round:

```
LB R2 Mixing (10 คน → 5 คู่):
  ผู้แพ้ WB R1 คู่ 1  vs  ผู้รอด LB R1 (BYE player)
  ผู้แพ้ WB R1 คู่ 2  vs  ผู้ชนะ LB R1 แมตช์ 1 (A)
  ผู้แพ้ WB R1 คู่ 3  vs  ผู้แพ้ WB R1 คู่ 4   ← ชนกันเอง
  ผู้แพ้ WB R1 คู่ 5  vs  ผู้แพ้ WB R1 คู่ 6   ← ชนกันเอง
  ผู้แพ้ WB R1 คู่ 7  vs  ผู้แพ้ WB R1 คู่ 8   ← ชนกันเอง
  → ผู้ชนะ 5 คน
```

### หลักการรวม: BYE Priority

กฎที่ใช้เมื่อจำนวนผู้เล่นในสายล่างเป็นเลขคี่:

```
1. Seed สูงที่สุด (ฝีมือดีที่สุด) ได้ BYE ก่อนเสมอ
2. BYE Player ข้ามรอบนั้นและรอพบผู้ชนะในรอบถัดไป
3. ถ้ายังคี่อีกในรอบถัดไป → ให้ BYE ซ้ำได้ แต่ต้องเป็นคนละคนกัน (Anti-double-BYE)
4. ห้ามให้ BYE คนเดิม 2 รอบติดกัน
```

```typescript
function assignByes(players: Player[], previousByePlayerIds: Set<number>): {
  matches: Player[][], byes: Player[]
} {
  if (players.length % 2 === 0) return { matches: chunk(players, 2), byes: [] }

  // เรียง Seed สูงสุดก่อน, แต่ข้ามคนที่เพิ่งได้ BYE ไปแล้ว
  const eligible = players
    .filter(p => !previousByePlayerIds.has(p.id))
    .sort((a, b) => b.seed - a.seed)

  const byePlayer = eligible[0] ?? players.sort((a, b) => b.seed - a.seed)[0]
  const rest = players.filter(p => p.id !== byePlayer.id)

  return { matches: chunk(rest, 2), byes: [byePlayer] }
}
```

---

## สรุป Flow สั้นๆ

```
1. รับจำนวนผู้สมัคร
2. คำนวณ Seeding Round (ถ้าจำเป็น)
3. สร้าง Winners Bracket
4. ทุกครั้งที่มีผู้แพ้ใน WB → ส่งลง LB
5. ทุกครั้งที่มีผู้แพ้ใน LB → ตกรอบ
6. วน WB และ LB สลับกันจนได้แชมป์ทั้งคู่
7. Grand Final (แชมป์ WB vs แชมป์ LB)
   - WB ชนะ → จบ
   - LB ชนะ → Reset แล้วแข่งอีกครั้ง
8. ผู้ชนะ Grand Final = แชมป์รายการ
```