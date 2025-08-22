#!/bin/bash

# データベース全テーブルクリアスクリプト
# 使用方法: ./clear-db.sh [--local|--remote]

# 色付き出力用の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# デフォルトはローカル環境
ENV_FLAG="--local"
ENV_NAME="ローカル"

# コマンドライン引数の処理
if [ "$1" = "--remote" ]; then
    ENV_FLAG=""
    ENV_NAME="リモート"
    echo -e "${RED}警告: リモート環境のデータベースを操作します！${NC}"
    read -p "本当に続行しますか？ (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "処理を中止しました。"
        exit 0
    fi
elif [ "$1" = "--local" ]; then
    ENV_FLAG="--local"
    ENV_NAME="ローカル"
fi

echo -e "${YELLOW}======================================${NC}"
echo -e "${YELLOW}${ENV_NAME}環境のデータベースをクリアします${NC}"
echo -e "${YELLOW}======================================${NC}"

# データベース名
DB_NAME="umarote-db"

# テーブルリスト（外部キー制約の順序を考慮）
# 子テーブルから親テーブルの順に削除
TABLES=(
    "race_results"    # races, horses に依存
    "race_entries"    # races, horses に依存
    "races"          # 独立
    "horses"         # 独立
)

# 各テーブルのデータを削除
echo ""
echo "テーブルデータの削除を開始します..."
echo ""

for table in "${TABLES[@]}"; do
    echo -e "${GREEN}► ${table} テーブルをクリア中...${NC}"
    
    # DELETEコマンドを実行
    if npx wrangler d1 execute $DB_NAME $ENV_FLAG --command "DELETE FROM ${table};" 2>/dev/null; then
        # 削除後の件数を確認
        count=$(npx wrangler d1 execute $DB_NAME $ENV_FLAG --command "SELECT COUNT(*) as count FROM ${table};" 2>/dev/null | grep -o '[0-9]\+' | tail -1)
        if [ -z "$count" ]; then
            count=0
        fi
        echo -e "  ✓ ${table} テーブルをクリアしました（残り: ${count}件）"
    else
        echo -e "${RED}  ✗ ${table} テーブルのクリアに失敗しました${NC}"
    fi
    echo ""
done

# SQLiteの場合、VACUUMで領域を解放（オプション）
echo -e "${GREEN}► データベースを最適化中...${NC}"
if npx wrangler d1 execute $DB_NAME $ENV_FLAG --command "VACUUM;" 2>/dev/null; then
    echo -e "  ✓ データベースを最適化しました"
else
    echo -e "${YELLOW}  ! VACUUMコマンドはサポートされていない可能性があります${NC}"
fi

echo ""
echo -e "${YELLOW}======================================${NC}"
echo -e "${GREEN}処理が完了しました！${NC}"
echo -e "${YELLOW}======================================${NC}"

# 最終的なテーブルの状態を表示
echo ""
echo "現在のテーブル状態:"
echo "-------------------"
for table in "${TABLES[@]}"; do
    count=$(npx wrangler d1 execute $DB_NAME $ENV_FLAG --command "SELECT COUNT(*) as count FROM ${table};" 2>/dev/null | grep -o '[0-9]\+' | tail -1)
    if [ -z "$count" ]; then
        count="取得失敗"
    fi
    printf "%-15s: %s 件\n" "$table" "$count"
done