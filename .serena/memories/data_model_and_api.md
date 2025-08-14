# データモデル・API設計

## データモデル（D1 / RDB）

### races: レース基本 + 当日特性
```sql
CREATE TABLE races (
  race_id TEXT PRIMARY KEY,     -- YYYYMMDD-<venue_code>-R
  date TEXT NOT NULL,           -- YYYY-MM-DD
  venue TEXT NOT NULL,          -- 札幌/東京/…
  surface TEXT NOT NULL,        -- '芝' | 'ダ'
  distance INTEGER NOT NULL,    -- m
  direction TEXT NOT NULL,      -- '右' | '左'
  course_conf TEXT,             -- A/B/C 等
  track_cond TEXT,              -- 良/稍/重/不良
  cushion_value REAL,           -- 例: 9.4
  cushion_bucket TEXT           -- 12_plus/10_12/8_10/7_8/lte_7
);
```

### horses: 馬マスタ
```sql
CREATE TABLE horses (
  horse_id TEXT PRIMARY KEY,    -- normalize(name)+'_'+birth_year
  name TEXT NOT NULL,
  sex TEXT,                     -- 牡/牝/騙 → M/F/G
  birth_year INTEGER
);
```

### entries: 出走成績
```sql
CREATE TABLE entries (
  race_id TEXT NOT NULL,
  horse_id TEXT NOT NULL,
  frame_no INTEGER,
  horse_no INTEGER,
  age INTEGER,
  jockey TEXT,
  weight REAL,                  -- 斤量
  trainer TEXT,
  affiliation TEXT,             -- (栗)/(美) 等
  popularity INTEGER,           -- 人気
  finish_pos INTEGER,           -- 着順
  time_sec REAL,                -- 走破タイム（秒）
  margin REAL,                  -- 着差（秒差）
  pos_2c INTEGER, pos_3c INTEGER, pos_4c INTEGER,
  last3f REAL,                  -- 上り3F（秒）
  pci REAL, pci3 REAL, rpci REAL,
  last3f_pos_diff REAL,
  body_weight INTEGER,
  body_weight_diff INTEGER,
  blinkers INTEGER,             -- 0/1
  PRIMARY KEY (race_id, horse_id)
);
```

### payouts: 払戻
```sql
CREATE TABLE payouts (
  race_id TEXT NOT NULL,
  bet_type TEXT NOT NULL,  -- 単勝/複勝/枠連/馬連/馬単/三連複/三連単
  numbers TEXT NOT NULL,   -- 組み合わせ
  amount INTEGER NOT NULL, -- 円
  PRIMARY KEY (race_id, bet_type, numbers)
);
```

## API設計（Cloudflare Workers / Hono想定）

### 一覧系
- `GET /races?date=YYYY-MM-DD&venue=札幌` : 当日のレース一覧
- `GET /races/{race_id}` : 出馬表＋払戻（入稿後）
- `GET /search/horses?q=クエリ` : 馬名サジェスト

### 条件別集計（出馬表向け一括）
```
GET /races/{race_id}/horse-stats?direction=same|left|right|all&cushion=all|12_plus|10_12|8_10|7_8|lte_7&surface=auto|turf|dirt&venue_filter=same|all
```

**レスポンス例**
```json
{
  "race_id": "2025-08-10-TOKYO-11",
  "filters": { "direction":"left", "cushion":"8_10", "surface":"turf", "venue_filter":"all" },
  "stats": [
    { "horse_id":"horsex", "n":12, "win":3, "place2":5, "place3":7,
      "win_rate":0.25, "in3_rate":0.58, "avg_fin":4.1, "avg_last3f":34.4, "last3f_top3_rate":0.42 }
  ]
}
```

### トップページ用
```
GET /calendar?date=YYYY-MM-DD&surface=all|turf|dirt&grade=all|stakes|graded&win5=0|1
```

**レスポンス型**
```typescript
type RaceLite = {
  raceId: string;     // YYYYMMDD-<venue>-<R>
  no: number;         // 1..12
  className: string;  // 3歳未勝利, 2勝クラス, OP, G3...
  surface: '芝'|'ダ';
  distance: number;   // m
  courseNote?: string; // A/B/C/内/外/直千 など
  fieldSize?: number; // 頭数
  offAt: string;      // 'HH:mm'
  grade?: 'OP'|'G3'|'G2'|'G1';
  win5?: boolean;
  status: '発売中'|'発走前'|'確定';
};

type VenueBoard = {
  venue: '札幌'|'函館'|'新潟'|'東京'|'中山'|'中京'|'京都'|'阪神'|'小倉';
  meetStr: string;      // 1回札幌8日 など
  weather?: string;     // 晴/曇/雨/雪
  track: { turf?: '良'|'稍'|'重'|'不良', dirt?: '良'|'稍'|'重'|'不良' };
  cushion?: number;     // 芝のみ
  cushionLabel?: '硬め'|'やや硬め'|'標準'|'やや軟'|'軟';
  races: RaceLite[];
};
```

### 管理（CSV取込）
- `POST /admin/import` : CSVアップロード（Access認証）

## CSV仕様（入力→正規化）
**主要変換ルール**
- `日付`: `250810` → `2025-08-10`
- `開催`: `1札6` → 場=札幌, 開催回=1, 日目=6
- `芝・ダ`: `芝/ダ` → `surface`
- `性別`: `牡/牝/騙` → `M/F/G`
- `走破タイム`: `1311` → `91.1秒`（mss.d → 秒）

**ID設計**
- `race_id = {YYYYMMDD}-{venue_code}-{R}`
- `horse_id = normalize(馬名)+'_'+birth_year`