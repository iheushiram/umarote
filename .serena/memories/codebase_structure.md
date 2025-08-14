# コードベース構造

## ディレクトリ構造
```
src/
├── assets/          # 静的アセット（SVGファイルなど）
├── components/      # 再利用可能なコンポーネント
│   └── ui/         # 共通UIコンポーネント（table, select）
├── lib/            # ユーティリティ関数
├── pages/          # ページレベルコンポーネント（ルーティング用）
├── services/       # データ取得・API関連
├── store/          # Zustand状態管理
└── types/          # TypeScript型定義
```

## 主要ファイル
- `App.tsx` - アプリケーションのルート、TanStack Query・MUI設定
- `main.tsx` - エントリーポイント
- `types/horse.ts` - 馬データの型定義（Horse, RaceResult, HorseWithResults）
- `store/horseStore.ts` - Zustandによる馬データの状態管理
- `services/horseService.ts` - 現在はサンプルデータを提供

## ルーティング構成
- `/` - メイン馬競走テーブル表示（HorseRacingTable）
- `/horse/:id` - 個別馬詳細ページ（HorseDetail）

## TypeScript設定
- パスエイリアス: `@/*` → `src/*`, `~/*` → `public/*`
- vite-tsconfig-pathsプラグインで解決

## データ構造
- `Horse` - 基本馬情報（名前・生年・血統など）
- `RaceResult` - 個別レース成績データ
- `HorseWithResults` - 馬データとレース結果の組み合わせ

## 日本語対応
- 性別値: '牡'（stallion）, '牝'（mare）, 'セ'（gelding）
- コース種別: '芝'（turf）, 'ダート'（dirt）
- UI・データラベルすべて日本語