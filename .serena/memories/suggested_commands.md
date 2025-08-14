# 推奨開発コマンド

## 基本開発コマンド

### 開発サーバー起動
```bash
npm run dev
```
- Vite開発サー�ーを起動
- 自動的にブラウザが開く（設定済み）
- ホットリロード対応

### ビルド
```bash
npm run build
```
- TypeScriptコンパイル → Viteビルドの順で実行
- 本番用に最適化されたアセットを生成

### リント
```bash
npm run lint
```
- ESLint実行（TypeScript/React対応）
- **重要**: タスク完了時に必ず実行すべき

### プレビュー
```bash
npm run preview
```
- ビルド後のアプリケーションをローカルでプレビュー

## Cloudflare開発（将来）

### D1データベース（ローカル）
```bash
wrangler d1 migrations apply KEIBA_DB --local
wrangler d1 execute KEIBA_DB --local --file ./scripts/seed.sql
```

### Workers開発
```bash
wrangler dev --local
wrangler deploy
```

### 環境管理
```bash
# ステージング
wrangler d1 migrations apply KEIBA_DB --remote
wrangler deploy

# 本番（要注意）
wrangler deploy --env production
```

## Git関連
```bash
git status
git add .
git commit -m "メッセージ"
```

## システムコマンド（Linux環境）
```bash
ls -la          # ファイル一覧表示
cd <directory>  # ディレクトリ移動  
grep -r <pattern> src/  # ファイル内検索
find . -name "*.ts*"    # ファイル検索
```

## 重要な作業完了チェック
1. `npm run lint` でコード品質確認
2. `npm run build` でビルド成功確認  
3. 変更内容をgit commitする前に上記2点を実施

## 注意事項
- **テストフレームワーク未設定**: 自動テスト実行は現在不可
- **Cloudflareインフラ未実装**: 現在はサンプルデータでの開発段階
- D1/Workers等のコマンドは将来のインフラ構築時に使用