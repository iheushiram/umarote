## スタイル案

### 前走情報

```/* ========== Race Cell (CSS only) ===========================================
期待するDOM例（クラス名だけ合わせればOK）
.race-cell
  .race-cell__corner        右上の枠: リプレイ / 枠番
  .race-cell__date          日付と場名
  .race-cell__name          レース名（リンクでもdivでも可）
  .race-cell__meta          条件チップ群（芝/ダ・距離・タイム・馬場）
  .race-cell__info          出走情報（頭数/人気/騎手/斤量など）
  .race-cell__passing       通過順・上がり・馬体重
  .race-cell__winner        勝ち馬とオッズ
--------------------------------------------------------------------------- */

:root {
  --rc-bg: #fff;
  --rc-border: #e5e7eb;          /* gray-200 */
  --rc-shadow: 0 1px 3px rgba(0,0,0,.06);
  --rc-shadow-hover: 0 4px 12px rgba(0,0,0,.10);
  --rc-text: #111827;            /* gray-900 */
  --rc-muted: #6b7280;           /* gray-500 */
  --rc-accent: #0369a1;          /* sky-700 */
  --rc-chip-bg: #f3f4f6;         /* gray-100 */
  --rc-chip-fg: #374151;         /* gray-700 */
  --rc-radius: 12px;

  /* semantic */
  --rc-turf-bg: #dcfce7;         /* emerald-100 */
  --rc-turf-fg: #047857;         /* emerald-700 */
  --rc-dirt-bg: #fef3c7;         /* amber-100 */
  --rc-dirt-fg: #92400e;         /* amber-800 */
  --rc-going-good-bg: #ecfdf5;   /* emerald-50 */
  --rc-going-good-fg: #047857;
  --rc-going-heavy-bg: #fff7ed;  /* orange-50 */
  --rc-going-heavy-fg: #9a3412;
  --rc-going-bad-bg: #fee2e2;    /* rose-100 */
  --rc-going-bad-fg: #b91c1c;
}

/* コンテナ */
.race-cell {
  position: relative;
  width: 180px;           /* コンパクト幅 */
  min-width: 180px;
  background: var(--rc-bg);
  color: var(--rc-text);
  border: 1px solid var(--rc-border);
  border-radius: var(--rc-radius);
  box-shadow: var(--rc-shadow);
  padding: 12px;
  line-height: 1.5;
  font-size: 13px;
  font-feature-settings: "tnum" 1, "lnum" 1; /* tabular numbers */
  transition: box-shadow .2s ease, transform .2s ease;
}
.race-cell:hover {
  box-shadow: var(--rc-shadow-hover);
}

/* 右上コーナー（リプレイ・枠番） */
.race-cell__corner {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  gap: 8px;
  align-items: center;
}
.race-cell__replay {
  display: inline-grid;
  place-items: center;
  width: 20px; height: 20px;
  font-size: 10px;
  border: 1px solid #d1d5db;     /* gray-300 */
  border-radius: 4px;
  background: #fff;
  color: #4b5563;                 /* gray-600 */
}
.race-cell__frame {
  display: inline-grid;
  place-items: center;
  width: 28px; height: 28px;
  font-weight: 700;
  font-size: 13px;
  border-radius: 6px;
  background: #f3f4f6;           /* gray-100 */
  color: #111827;
}

/* 上段 */
.race-cell__date {
  font-size: 12px;
  color: var(--rc-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* レース名 */
.race-cell__name {
  margin-top: 2px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.race-cell__name a {
  color: var(--rc-accent);
  text-decoration: none;
}
.race-cell__name a:hover { text-decoration: underline; }

/* 条件チップ */
.race-cell__meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: #374151; /* gray-700 */
}
.rc-chip {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--rc-chip-bg);
  color: var(--rc-chip-fg);
  font-size: 11px;
  line-height: 1.2;
}
.rc-chip--turf   { background: var(--rc-turf-bg); color: var(--rc-turf-fg); }
.rc-chip--dirt   { background: var(--rc-dirt-bg); color: var(--rc-dirt-fg); }
.rc-chip--good   { background: var(--rc-going-good-bg); color: var(--rc-going-good-fg); }
.rc-chip--heavy  { background: var(--rc-going-heavy-bg); color: var(--rc-going-heavy-fg); }
.rc-chip--bad    { background: var(--rc-going-bad-bg);  color: var(--rc-going-bad-fg); }

/* 出走情報・通過・勝ち馬 */
.race-cell__info,
.race-cell__passing,
.race-cell__winner {
  margin-top: 4px;
  font-size: 13px;
  color: #374151;
}

/* 体重の増減色 */
.race-cell__weight-up   { color: #dc2626; }  /* red-600 */
.race-cell__weight-down { color: #2563eb; }  /* blue-600 */

/* 勝ち馬リンク＆オッズ */
.race-cell__winner a {
  color: var(--rc-accent);
  text-decoration: none;
}
.race-cell__winner a:hover { text-decoration: underline; }
.race-cell__odds { color: var(--rc-muted); }

/* 余白が原因で横スクロールが出ないよう、内側のテキストは省略可 */
.race-cell, .race-cell * { min-width: 0; }

/* ---- サイズバリアント（任意） ---- */
.race-cell--sm { width: 160px; min-width: 160px; padding: 10px; font-size: 12px; }
.race-cell--lg { width: 220px; min-width: 220px; padding: 14px; font-size: 14px; }

/* ---- ダークモード（任意） ---- */
@media (prefers-color-scheme: dark) {
  :root {
    --rc-bg: #0b0f14;
    --rc-border: #1f2937;
    --rc-text: #e5e7eb;
    --rc-muted: #9ca3af;
    --rc-chip-bg: #111827;
    --rc-chip-fg: #d1d5db;
    --rc-accent: #7dd3fc;
  }
  .race-cell__replay { background: #111827; border-color: #374151; color: #cbd5e1; }
  .race-cell__frame  { background: #111827; color: #e5e7eb; }
}
```

### 出馬表馬情報
```
/* ===========================================================
  Horse Info (個別情報)
  期待DOM例
  .horse-info
    .horse-info__blood         （父/母/母父の縦並び）
      .horse-info__sire
      .horse-info__name        （馬名リンク想定）
      .horse-info__dam
    .horse-info__stable        （栗東・宮地 など）
    .horse-info__meta          （差/中〇週 等の小ラベル群）
    .horse-info__numbers       （体重・オッズ・人気）
       .horse-info__weight
       .horse-info__odds
       .horse-info__pop
=========================================================== */

:root{
  --hi-text: #111827;           /* gray-900 */
  --hi-muted:#6b7280;           /* gray-500 */
  --hi-accent:#0369a1;          /* sky-700 */
  --hi-border:#e5e7eb;          /* gray-200 */
  --hi-danger:#dc2626;          /* red-600 */
  --hi-info:#2563eb;            /* blue-600 */
  --hi-chip-bg:#f3f4f6;         /* gray-100 */
  --hi-chip-fg:#374151;         /* gray-700 */
  --hi-radius:12px;
}

.horse-info{
  display:grid;
  grid-template-rows:auto auto auto auto;
  row-gap:6px;
  color:var(--hi-text);
  font-size:13px;
  line-height:1.5;
  font-feature-settings:"tnum" 1,"lnum" 1; /* 等幅数字 */
  min-width:0;
}

/* --- 血統/馬名ブロック ---------------------------------- */
.horse-info__blood{min-width:0}
.horse-info__sire{
  color:var(--hi-muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.horse-info__name{
  font-weight:700;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.horse-info__name a{
  color:var(--hi-accent);
  text-decoration:none;
}
.horse-info__name a:hover{text-decoration:underline}
.horse-info__dam{
  color:var(--hi-muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* --- 厩舎/所属 ------------------------------------------- */
.horse-info__stable{
  color:var(--hi-accent);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}

/* --- メタ（差/中〇週 等）--------------------------------- */
.horse-info__meta{
  display:flex; flex-wrap:wrap; gap:6px;
}
.hi-chip{
  display:inline-block; padding:2px 6px;
  border-radius:999px;
  background:var(--hi-chip-bg); color:var(--hi-chip-fg);
  font-size:11px; line-height:1.2;
}

## 実装反映メモ（2025-08）

### Race Cell（前走カード）幅の可変化
- `.race-cell`/`.race-cell--sm`の幅はCSS変数`--rcw`で制御（デフォルト140px）。
- 例: `width: var(--rcw, 140px); min-width: var(--rcw, 140px);` とし、`box-sizing: border-box`を指定。
- テーブルセル幅`--cellw`はカード幅より+8px程度広く設定し、左右に薄い余白を作る。

推奨変数値の目安:
- xs: `--rcw:136px`, `--cellw:144px`
- sm: `--rcw:132px`, `--cellw:140px`
- md+: `--rcw:140px`, `--cellw:148px`

### 出馬表テーブルのレスポンシブ指針
- 固定列: xsは「枠・馬番」のみ固定。sm以上で「枠・馬番・馬名（馬情報）」を固定。
- 履歴の表示本数: xsは前走・2走、smは前走〜3走、md+は前走〜5走。
- 代表的な固定列幅（CSS変数）:
  - `--framew`: 枠列幅（xs:44px, sm:64px）
  - `--horsenow`: 馬番列幅（xs:44px, sm:64px）
  - `--namew`: 馬名セル幅（xs:140px, sm:260px, md:280px）
- 行ホバー: 行ホバー時の背景ハイライトは無効（グレー反転はしない）。

### 騎手情報（カードなしテキスト版）
カード装飾は使わず、以下の3行構成を推奨。

推奨DOM（例）:
```
<td class="jockey-text">
  <span class="jockey-type">牡4</span>
  <span class="jockey-name">武豊</span>
  <span class="jockey-weight">56.0</span>
</td>
```

推奨スタイル（必要に応じて適用）:
```
.jockey-text{ display:flex; flex-direction:column; align-items:center; line-height:1.2; font-size:.85rem; white-space:nowrap; }
.jockey-text .jockey-type{ color:#444; }
.jockey-text .jockey-name{ color:#0369a1; font-weight:600; }
.jockey-text .jockey-weight{ color:#333; }
@media (max-width: 600px){ .jockey-text{ font-size:.8rem; } }
```

/* --- 数値群（体重・オッズ・人気）------------------------ */
.horse-info__numbers{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:baseline;
  column-gap:12px;
}

/* 体重 例: 452kg(+0) / 増減色付け */
.horse-info__weight{
  white-space:nowrap;
}
.horse-info__weight .hi-weight-diff{
  margin-left:2px;
}
.hi-up   { color:var(--hi-danger); } /* 増 */
.hi-down { color:var(--hi-info);   } /* 減 */
.hi-flat { color:var(--hi-muted);  } /* 変化なし */

/* オッズ */
.horse-info__odds{
  text-align:right; color:var(--hi-text);
  white-space:nowrap;
}

/* 人気 ( ) 内の小さめトーン */
.horse-info__pop{
  color:var(--hi-muted);
  white-space:nowrap;
}

/* --- 仕切り線が欲しい場合（任意） ----------------------- */
.horse-info--card{
  border:1px solid var(--hi-border);
  border-radius:var(--hi-radius);
  padding:10px 12px;
}

/* --- ダークモード（任意） -------------------------------- */
@media (prefers-color-scheme: dark){
  :root{
    --hi-text:#e5e7eb; --hi-muted:#9ca3af; --hi-accent:#7dd3fc;
    --hi-border:#1f2937; --hi-chip-bg:#111827; --hi-chip-fg:#d1d5db;
  }
}
```

### 出馬表騎手情報
```
  body {
    font-family: sans-serif;
    background-color: #f7f7f7;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  .jockey-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.9rem;
    line-height: 1.4;
    padding: 6px 8px;
    border: 1px solid #ddd;
    background-color: #fff;
    width: 60px; /* 幅をコンパクトに */
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .jockey-cell .jockey-type {
    font-weight: 500;
    color: #444;
    margin-bottom: 2px;
  }

  .jockey-cell .jockey-name {
    color: #0066cc;
    font-weight: 500;
  }

  .jockey-cell .jockey-weight {
    font-size: 0.85rem;
    color: #333;
    margin-top: 2px;
  }
</style>
</head>
<body>

<div class="jockey-cell">
  <div class="jockey-type">牡3栗</div>
  <div class="jockey-name">城戸</div>
  <div class="jockey-weight">55.0</div>
</div>
```

### レース成績馬個別ページ
```<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>馬の個別レース結果 – Playground</title>
<style>
  :root{ --bg:#f8fafc;--card:#fff;--border:#e5e7eb;--text:#0f172a;--muted:#64748b }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text)}
  .wrap{max-width:1100px;margin:20px auto;padding:0 16px}
  h1{font-size:18px;margin:0 0 12px}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
  .chip{padding:6px 10px;border:1px solid var(--border);border-radius:999px;font-size:12px;cursor:pointer;background:#fff}
  .chip.active{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
  table{width:100%;border-collapse:collapse;background:var(--card)}
  th,td{border:1px solid var(--border);padding:6px;font-size:12px;text-align:center}
  th{background:#f1f5f9}
</style>
</head>
<body>
<main class="wrap">
  <h1>馬の個別レース結果</h1>
  <div class="toolbar" id="toolbar"></div>
  <table>
    <thead>
      <tr>
        <th>日付</th>
        <th>開催</th>
        <th>レース名</th>
        <th>距離</th>
        <th>馬場</th>
        <th>着順</th>
        <th>人気</th>
        <th>オッズ</th>
        <th>通過</th>
        <th>上り</th>
        <th>斤量</th>
        <th>馬体重</th>
      </tr>
    </thead>
    <tbody id="raceBody"></tbody>
  </table>
</main>
<script>
const FILTERS = ['すべて','良','稍重','重','不良'];
const RESULTS = [
  {date:'2025/08/10',place:'中京',race:'5歳未勝利',dist:'ダ1400',track:'良',rank:16,pop:12,odds:266.2,pass:'16-16',last3F:39.7,weight:52,body:444},
  {date:'2025/06/01',place:'東京',race:'5歳未勝利',dist:'芝1600',track:'良',rank:14,pop:9,odds:73.8,pass:'2-2',last3F:37.1,weight:55,body:486},
  {date:'2025/05/18',place:'京都',race:'5歳未勝利',dist:'ダ1400',track:'重',rank:16,pop:15,odds:214.0,pass:'16-16',last3F:44.0,weight:53,body:440}
];
let currentFilter='すべて';
const tb=document.getElementById('toolbar');
FILTERS.forEach(f=>{
  const b=document.createElement('button');
  b.textContent=f;
  b.className='chip'+(f===currentFilter?' active':'');
  b.onclick=()=>{currentFilter=f;setActive(b);render()};
  tb.appendChild(b);
});
function setActive(active){
  tb.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
  active.classList.add('active');
}
function render(){
  const tbody=document.getElementById('raceBody');
  tbody.innerHTML='';
  RESULTS.filter(r=>currentFilter==='すべて'||r.track===currentFilter)
    .forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${r.date}</td>
        <td>${r.place}</td>
        <td>${r.race}</td>
        <td>${r.dist}</td>
        <td>${r.track}</td>
        <td>${r.rank}</td>
        <td>${r.pop}</td>
        <td>${r.odds}</td>
        <td>${r.pass}</td>
        <td>${r.last3F}</td>
        <td>${r.weight}</td>
        <td>${r.body}</td>`;
      tbody.appendChild(tr);
    });
}
render();
</script>
</body>
</html>
```

### レース結果ページ
```
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>レース結果 – Playground</title>
<style>
  :root{ --bg:#f8fafc;--card:#fff;--border:#e5e7eb;--text:#0f172a;--muted:#64748b;--p1:#16a34a;--p2:#2563eb;--p3:#64748b;--px:#e5e7eb }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text)}
  .wrap{max-width:1100px;margin:20px auto;padding:0 16px}
  h1{font-size:18px;margin:0 0 12px}

  table{width:100%;border-collapse:separate;border-spacing:0;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  thead th{position:sticky;top:0;background:#f1f5f9;border-bottom:1px solid var(--border)}
  th,td{padding:8px 10px;font-size:12px;border-bottom:1px solid var(--border);text-align:center}
  tbody tr:last-child td{border-bottom:0}
  td.name{text-align:left}
  .pos{display:inline-grid;place-items:center;min-width:28px;height:24px;border-radius:8px;color:#fff;font-weight:800;margin:auto}
  .p1{background:var(--p1)} .p2{background:var(--p2)} .p3{background:var(--p3)} .px{background:var(--px); color:#111827}
  .small{font-size:11px;color:var(--muted)}
  .mono{font-variant-numeric: tabular-nums}
</style>
</head>
<body>
<main class="wrap">
  <h1>レース結果</h1>
  <div class="twrap">
    <table id="raceTable" aria-describedby="desc">
      <thead>
        <tr>
          <th>着順</th>
          <th>枠</th>
          <th>馬番</th>
          <th style="text-align:left">馬名</th>
          <th>性齢</th>
          <th>斤量</th>
          <th>騎手</th>
          <th>タイム</th>
          <th>着差</th>
          <th>通過</th>
          <th>上り</th>
          <th>単勝</th>
          <th>人気</th>
          <th>馬体重</th>
          <th>調教師</th>
          <th>馬主</th>
          <th>賞金(万円)</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
</main>

<script>
// モックデータ（スクショを参考にした例）
const rows=[
 {pos:1, frame:6, num:6, name:'コトリノサエズリ', sexAge:'牡3', carried:55, jockey:'田口貫太', time:'1:27.5', diff:'', pass:'3-2-1', last3F:'38.2', odds:1.6, pop:1, body:'468(+2)', trainer:'吉田勝利', owner:'吉田勝利', prize:70.0},
 {pos:2, frame:3, num:3, name:'インビッシュ',     sexAge:'牡3', carried:55, jockey:'西塚洸二', time:'1:27.8', diff:'0.1', pass:'5-3-2', last3F:'38.3', odds:8.4, pop:3, body:'471(+7)', trainer:'小林真也', owner:'(株)ノルマンディ', prize:28.0},
 {pos:3, frame:5, num:5, name:'フェアリアルギフト', sexAge:'牡3', carried:55, jockey:'岡部誠',   time:'1:28.1', diff:'0.6', pass:'4-4-3', last3F:'38.6', odds:10.8, pop:4, body:'400(0)',   trainer:'緒方努',   owner:'谷嶋泰吾', prize:17.5},
 {pos:4, frame:7, num:7, name:'ルルーディ',       sexAge:'牡3', carried:55, jockey:'城戸義政', time:'1:28.9', diff:'1.4', pass:'8-6-4', last3F:'39.8', odds:36.6, pop:6, body:'452(0)',   trainer:'宮地謙祐', owner:'吉野功寿代', prize:10.5},
 {pos:5, frame:4, num:4, name:'ラーンノヴァイン', sexAge:'牡3', carried:55, jockey:'藤原幹生', time:'1:29.2', diff:'1.7', pass:'2-1-2', last3F:'40.2', odds:9.4, pop:2, body:'490(+8)', trainer:'大野貴義', owner:'伊藤達', prize:7.0},
 {pos:6, frame:1, num:1, name:'オールザマタイム', sexAge:'牡3', carried:53, jockey:'枝本一城', time:'1:29.8', diff:'2.3', pass:'6-7-7', last3F:'40.7', odds:26.2, pop:7, body:'482(+3)', trainer:'加藤義章', owner:'同川秀守', prize:5.0},
 {pos:7, frame:1, num:2, name:'アイズグレッソ',   sexAge:'牡3', carried:55, jockey:'渡辺竜也', time:'1:31.1', diff:'3.6', pass:'9-9-8', last3F:'41.8', odds:34.8, pop:5, body:'479(+2)', trainer:'鈴木慎太', owner:'(株)ノルマンディ', prize:4.0},
 {pos:8, frame:2, num:8, name:'ユズモフィネス',   sexAge:'牡3', carried:53, jockey:'深澤杏花', time:'1:35.3', diff:'大',  pass:'7-8-9', last3F:'—',   odds:48.2, pop:9, body:'436(+1)', trainer:'柴田高志', owner:'小橋亮太', prize:0.0},
];

const tb=document.getElementById('tbody');
const posCls = p => p===1? 'p1': p===2? 'p2': p===3? 'p3': 'px';

rows.forEach(r=>{
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><span class="pos ${posCls(r.pos)}">${r.pos<=3?r.pos:'–'}</span></td>
    <td>${r.frame}</td>
    <td>${r.num}</td>
    <td class="name">${r.name}</td>
    <td>${r.sexAge}</td>
    <td class="mono">${r.carried}</td>
    <td>${r.jockey}</td>
    <td class="mono">${r.time}</td>
    <td class="mono">${r.diff}</td>
    <td>${r.pass}</td>
    <td class="mono">${r.last3F}</td>
    <td class="mono">${r.odds}</td>
    <td>${r.pop}</td>
    <td class="mono">${r.body}</td>
    <td>${r.trainer}</td>
    <td>${r.owner}</td>
    <td class="mono">${r.prize.toFixed(1)}</td>`;
  tb.appendChild(tr);
});
</script>
</body>
</html>
```