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

## ภาพรวม Flow ทั้งหมด

```
[ผู้สมัคร N คน]
       │
       ▼
[Seeding Round] ← ถ้า N ไม่ใช่เลข 2^n
       │
       ▼
[Winners Bracket รอบ 1]
   ┌───┴───┐
ชนะ │       │ แพ้
   ▼       ▼
[WB R2]  [LB R1] ←─────────────────────────────────┐
   │       │                                         │
   │   ผู้แพ้ LB R1 ตกรอบ                             │
   ▼       ▼                                         │
[WB R3]  [LB R2] ← รับผู้แพ้จาก WB R2              │
   │       │                                         │
   ▼       ▼                                         │
  ...     ...                                        │
   │       │                                         │
   ▼       ▼                                         │
[WB Final] [LB Final]                               │
   │           │                                     │
   └─────┬─────┘                                     │
         ▼
   [Grand Final]
    ┌─────┴─────┐
    │           │
WB ชนะ      LB ชนะ
    │           │
    ▼           ▼
  จบ!      [GF Reset]
              │
              ▼
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