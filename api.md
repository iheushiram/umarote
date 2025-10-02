# API エンドポイント一覧

本ドキュメントは `src/index.ts` に定義されている主要な HTTP API の概要をまとめたものです。基本的にすべてのレスポンスは JSON 形式で返され、日付は `YYYYMMDD` 形式の文字列を想定しています（`YYYY-MM-DD` を渡した場合はサーバー側で正規化されます）。

## 目次

- [馬データ (Horses)](#馬データ-horses)
- [レース情報 (Races)](#レース情報-races)
- [出馬表 (Race-Entries)](#出馬表-race-entries)
- [レース結果 (Race-Results)](#レース結果-race-results)
- [同走馬・速度系ユーティリティ](#同走馬速度系ユーティリティ)
- [調教データ (Training-Records)](#調教データ-training-records)
- [分析系 API](#分析系-api)
- [会場・統計関連](#会場統計関連)
- [デバッグ用エンドポイント](#デバッグ用エンドポイント)

---

## 馬データ (Horses)

### GET `/api/horses`
- **概要**: 登録済みの全馬レコードを取得します。
- **クエリ**: なし
- **レスポンス**: `horses` テーブルの各列を含む配列。

### POST `/api/horses`
- **概要**: 馬データのバッチ UPSERT。`id` が既存なら更新、未存在なら挿入します。
- **ボディ**: `NewHorse[]`（JSON 配列）。
- **レスポンス**: `{ "message": "X件の馬データを処理しました" }`

### GET `/api/horses/:id`
- **概要**: 指定 ID の馬データを1件取得。存在しなければ 404。

### GET `/api/horses/:id/results`
- **概要**: 指定馬の直近レース結果を取得します。
- **クエリ**: `limit` (既定 20, 最大 50)、`beforeDate`
- **レスポンス**: 日付降順で整列した結果配列。

---

## レース情報 (Races)

### GET `/api/races`
- **概要**: レース一覧。`date` を指定するとその日のレースのみ返します。
- **クエリ**: `date` (`YYYYMMDD` または `YYYY-MM-DD`)

### POST `/api/races`
- **概要**: レース情報のバッチ UPSERT。
- **ボディ**: `NewRace[]`
- **レスポンス**: `{ "message": "X件のレースデータを処理しました" }`

### GET `/api/races/:raceId`
- **概要**: レース詳細を取得。存在しなければ 404。

### PATCH `/api/races/:raceId`
- **概要**: 指定レースの部分更新。ボディに含めたフィールドのみ上書きされます。

### PATCH `/api/races/:raceId/prize-money`
- **概要**: 本賞金・収得賞金情報を更新します。
- **ボディ**: `{ "prizeMoney": number, "earnedMoney": number }`

### PATCH `/api/races/:raceId/cushion`
- **概要**: クッション値を更新します。
- **ボディ**: `{ "cushionValue": number }`

### GET `/api/races/entries/by-date/:date`
- **概要**: 指定日のレースと出馬表をまとめて取得します。
- **パラメータ**: `:date` は `YYYYMMDD` 推奨。

### POST `/api/races/batch-basic`
- **概要**: 複数レースの基本情報（頭数、賞金合計など）をまとめて取得。
- **ボディ**: `{ "raceIds": string[] }`
- **レスポンス**: `{ "races": [{ raceId, fieldSize, totalPrizeMoney, ... }] }`

---

## 出馬表 (Race-Entries)

### GET `/api/races/:raceId/entries`
- **概要**: 指定レースの出馬表データを取得。

### GET `/api/races/:raceId/entries-with-history`
- **概要**: 出馬表に加え、各馬の直近レース結果（既定5件）を同梱。
- **クエリ**: `limit` (1〜10)、`beforeDate`
- **レスポンス**: `{ raceId, raceDate, entries: [{ ...entry, horse, recentResults: [] }] }`

### POST `/api/race-entries`
- **概要**: 出馬表データのバッチ UPSERT。
- **ボディ**: `NewRaceEntry[]`

### POST `/api/race-entries-csv`
- **概要**: CSV 由来のレース・出馬表・馬データを一括取り込み。
- **ボディ**: `{ "races": [...], "entries": [...], "horses": [...] }`（CSV を展開した JSON）
- **レスポンス**: `{ "message": "...", "processed": { races, horses, entries } }`

---

## レース結果 (Race-Results)

### GET `/api/race-results`
- **概要**: レース結果を条件付きで取得します。
- **クエリ**: `raceId`, `horseId`, `beforeDate`, `limit`
- **レスポンス**: 人気昇順で整列した結果配列。

### POST `/api/race-results`
- **概要**: レース結果のバッチ UPSERT。対象レースIDの既存データを削除してから挿入・更新します。
- **ボディ**: `{ "results": NewRaceResult[] }`

### POST `/api/race-results-with-horses`
- **概要**: レース結果と紐付く馬データをまとめて登録するヘルパー。
- **ボディ**: `{ "results": [...], "horses": [...] }`

### GET `/api/co-runner-next-results/:raceId`
- **概要**: 指定レースの同走馬が「次走でどう走ったか」を取得。`beforeDate` で上限制御可能。

---

## 同走馬・速度系ユーティリティ

### POST `/api/races/co-runners/next`
- **概要**: 複数レースについて同走馬の次走結果をまとめて取得。
- **ボディ例**:
  ```json
  {
    "raceIds": ["202503010605", "202503010505"],
    "beforeDate": "20250630"
  }
  ```
- **レスポンス**: `{ "races": [{ raceId, prevDate, totalCoRunners, runners: [{ horseId, nextRaceId, nextDate, nextFinish }] }] }`

### POST `/api/races/speed-metrics`
- **概要**: レース毎の勝ち時計・実測平均速度・前走平均速度をまとめて取得。
- **ボディ**: `{ "raceIds": string[], "beforeDate"?: string, "limit"?: number }`
- **レスポンス**: `{ "races": [{ raceId, winnerKmh, actualAvg, countActual, prevAvg, countPrev }] }`

---

## 調教データ (Training-Records)

### POST `/api/training-records`
- **概要**: 調教タイムのバッチ登録/更新。
- **ボディ**: `{ "records": [...]} ` または `{ "csvData": [...] }`
- **レスポンス**: `{ "message": "...", "inserted": n, "updated": m }`

### POST `/api/training-records/search`
- **概要**: 指定した馬名の最新調教をまとめて取得します。
- **ボディ**: `{ "horseNames": string[], "limit"?: number }`
- **レスポンス**: `{ "records": { "馬名": [調教レコード...] } }`

---

## 分析系 API

### GET `/api/analysis/distance-times`
- **概要**: 距離・馬場・クラスなどを指定し、過去データから勝ち時計統計を取得します。
- **主なクエリ**: `distance`, `surface`, `class`, `venue`, `from`, `to`, `winnersOnly`, `limit`
- **レスポンス**: `{ "stats": { count, average, fastest, slowest, median }, "results": [...] }`

### GET `/api/analysis/class-analysis`
- **概要**: クラス名を軸に、レース結果を取得する分析用エンドポイント。
- **クエリ**: `className` (必須)、`surface`, `venue`, `limit`

---

## 会場・統計関連

### GET `/api/venues`
- **概要**: `date` クエリで指定した日の会場ボード情報を返します。

### GET `/api/venues/dates`
- **概要**: データベース内で利用可能な開催日一覧を取得します。

### GET `/api/stats`
- **概要**: テーブルごとの件数など、簡易メトリクスを返す管理向けエンドポイント。

---

## デバッグ用エンドポイント

| メソッド / パス                   | 概要                                   |
|----------------------------------|----------------------------------------|
| GET `/api/debug/race-results`    | `race_results` の先頭 N 件を確認 (既定 10) |
| GET `/api/debug/races`           | `races` の先頭 N 件を確認                |
| GET `/api/debug/race-entries`    | `race_entries` の先頭 N 件を確認         |

---

## 注意事項

- **日付フォーマット**: クエリやボディでは `YYYYMMDD` を推奨。`YYYY-MM-DD` やスラッシュ区切りでも内部で正規化されます。
- **バッチ更新**: 多くの POST/PATCH は一括更新を想定しているため、大量データ投入時は分割やトランザクション順序に注意してください。
- **認証**: 現状は未実装です。外部公開する場合は別途保護が必要です。

以上が主要エンドポイントの一覧です。詳細なフィールドや補助関数は `src/index.ts` の実装を参照してください。
