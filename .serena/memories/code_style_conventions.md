# コード規約・スタイル

## TypeScript設定
- 厳格なTypeScriptチェック（typescript-eslint）
- インターフェース重視の型定義
- パスエイリアス使用（`@/` for src, `~/` for public）

## ESLint設定
- `@eslint/js` + `typescript-eslint` recommended設定
- React Hooks規約準拠
- React Refresh対応（開発時のHMR最適化）

## インポート規約
- MUIコンポーネント: named importで複数同時インポート
  ```typescript
  import { Typography, Paper, Button } from '@mui/material'
  ```
- Reactルーター: BrowserRouter as Router
- 相対パス: エイリアスを使用（`@/components/ui/table`）

## ファイル命名
- コンポーネント: PascalCase（HorseRacingTable.tsx）
- ページ: PascalCase（HorseDetail.tsx）
- ユーティリティ: camelCase（horseService.ts, horseStore.ts）
- 型定義: camelCase（horse.ts）

## コンポーネント構造
- 関数コンポーネント使用
- TypeScriptインターフェースで型定義
- MUI ThemeProviderでテーマ管理
- Zustandで状態管理

## データ型命名規約
- インターフェース名: PascalCase（Horse, RaceResult）
- プロパティ名: camelCase
- 日本語固有値: 日本語文字そのまま使用（'牡', '牝', 'セ'）

## スタイリング
- Material-UI標準スタイリング
- sx propsでカスタムスタイル
- CssBaselineでリセットCSS適用

## 状態管理パターン
- Zustand: シンプルなグローバル状態（馬データ、選択状態）
- TanStack Query: サーバー状態・キャッシング・非同期データ取得

## ファイル構成規約
- pages/: ルーティング用コンポーネント
- components/: 再利用可能コンポーネント
- components/ui/: 汎用UIコンポーネント
- services/: データアクセス層
- types/: 型定義専用
- store/: 状態管理
- lib/: ユーティリティ関数