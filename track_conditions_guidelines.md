# 東京第5回（2020年）クッション値抽出ワークフロー

## 概要
- JRA公式サイトの東京競馬場第5回開催PDFから芝・ダートの含水率とクッション値を抽出し、CSV化した手順。
- 取得した知見を他開催にも再利用できるよう、ディレクトリ運用と作業上の注意点を整理。

## 作業環境
- 作業ディレクトリ: C:/Users/shmri/workspace/umarote
- 主なツール: Python 3.10.6、pandas、Chrome DevTools MCP、PyMuPDF、pdfminer.six
- 対象PDF: track_conditions/2020/tokyo/support/tokyo05.pdf

## 作業手順
1. PDF取得: Chrome DevTools MCPで https://www.jra.go.jp/keiba/baba/archive/2020pdf/tokyo05.pdf をダウンロードし、track_conditions/2020/tokyo/support/ に保存。
2. テキスト抽出検証: PyPDF2 / pdfminer.six / PyMuPDF を試行。フォント未埋め込みのため日本語が文字化けする課題を確認し、画像書き出し (tokyo05_page1.png) で目視確認。
3. CSV生成: track_conditions/2020/tokyo/support/build_csv.py で数値を手入力し、pandasで track_conditions/2020/tokyo/tokyo05_cushion.csv をUTF-8(BOM付き)で出力。
4. 結果確認: tokyo05_cushion.csv を目視で検算し、芝／ダート含水率・クッション値がPDFと一致することを確認。

## ディレクトリ運用ルール
- ルート直下に track_conditions/ を置き、年度・競馬場ごとに track_conditions/<year>/<venue>/ 形式で管理（例: track_conditions/2020/tokyo/）。
- 最終成果物は競馬場直下（例: track_conditions/2020/tokyo/）に配置し、中間生成物やスクリプトは support/ サブフォルダへ集約。
- venue フォルダ名はローマ字表記（tokyo, nakayama, kyoto など）とし、漢字は使用しない。
- 複数開催を扱う場合も同ルールを踏襲し、不要ファイルの削除は任意。必要に応じて support/ 配下で整理する。

## 今後の検討事項
- OCR導入や別フォント対応ライブラリの調査により、手入力を排除した自動抽出フローの整備。
- build_csv.py の入力テンプレート化と入力値検証ロジックの追加（開催数増加時の誤入力防止）。

---

# 2021年以降の馬場情報CSV生成フロー

## 使用スクリプト
- 共通パーサ: track_conditions/pdf_parser.py
- 2020年集約: python3 -m track_conditions.2020.support.build_all_csvs
- 2021年集約: python3 -m track_conditions.2021.support.build_all_csvs

## 手順概要
1. pip / 依存導入
   - python3 get-pip.py でユーザーディレクトリに pip を導入。
   - python3 -m pip install PyMuPDF を実行（import fitz 用）。
2. PDF取得と配置
   - Chrome DevTools MCP等で https://www.jra.go.jp/keiba/baba/archive/<year>pdf/ から各PDFをダウンロード。
   - track_conditions/<year>/<venue>/support/<venue><NN>.pdf 形式で保存。
   - 年度ごとのフォルダ構成は 2020年と同様（例: sapporo/hakodate/.../support）。
3. リンクリスト更新
   - 2021年: track_conditions/2021_pdf_links.json
   - 2022年: track_conditions/2022_pdf_links.json
4. CSV生成
   - 2021年: python3 -m track_conditions.2021.support.build_all_csvs
   - 2022年: python3 -m track_conditions.2022.support.build_all_csvs
   - 出力例: track_conditions/<year>/<venue>/<venue><NN>_cushion.csv、<year>_track_conditions_all.csv、<year>_track_conditions_summary.csv。
5. フォルダ構成
   - support/ 配下にPDFや補助スクリプトを置き、CSVは競馬場ディレクトリ直下に出力。

## 手動補正
- 2021年 中京第6回 (chukyo06.pdf) は画像のみのPDFだったため、2021/support/build_all_csvs.py の MANUAL_OVERRIDES['chukyo06'] に固定値を登録。
- 同様の事象が発生した場合は該当年度の MANUAL_OVERRIDES に日付・数値を追加して再生成。

## 検証観点
- 集約CSVの行数: 2021年は 432 行（ヘッダー込みで 433 行）、2022年も同様にヘッダー+432行。
- 各 *_cushion.csv が UTF-8(BOM) で保存されていることを確認（Excel互換）。
- summary CSV で各PDFの行数が期待通りか再確認。

## トラブルシューティング
- pip 不在エラー: python3 get-pip.py を先に実行。
- 403 Forbidden: urllib.request.Request(..., headers={'User-Agent': 'Mozilla/5.0'}) でUser-Agentを付与して再試行。
- テキスト抽出0件: support/ にPNGを書き出して値を目視確認し、必要に応じて MANUAL_OVERRIDES を更新。

---

# 2022年対応メモ
- 2022年分のPDFリンクは track_conditions/2022_pdf_links.json に記載。csv生成コマンド: python3 -m track_conditions.2022.support.build_all_csvs。
- 2022_track_conditions_all.csv は433行（ヘッダー1 + データ432）。summary CSVでPDFごとの行数と一致。
- PyMuPDF抽出で稀に「8..8」のように小数点が二重化されるため、track_conditions/pdf_parser.py に _normalize_token を追加し、連続ドットを単一ドットへ正規化してから数値判定する。
- 2021年に追加したヘッダー部クッション値先読みロジックは2022年PDFでも有効（曜日直後の値を抽出）。
- 2022年では手動補正は不要だったが、画像PDFが見つかった場合は 2022/support/build_all_csvs.py の MANUAL_OVERRIDES に追記して対応する。
# 2023年対応メモ
- PDFリンク一覧: `track_conditions/2023_pdf_links.json` （36件）
- PDF保存先: `track_conditions/2023/<venue>/support/<venueNN>.pdf` （Chrome DevTools MCPとUser-Agent付きPythonスクリプトで取得）
- CSV生成: PowerShellで `PYTHONPATH=. python track_conditions/2023/support/build_all_csvs.py`
- 出力ファイル: `track_conditions/2023/2023_track_conditions_all.csv`（431行）と `track_conditions/2023/2023_track_conditions_summary.csv`
- 備考: 中京は第4回まで、京都は第3回までの開催。2023年PDFはすべてクッション値欄が埋まっている。
# 2024年対応メモ
- PDFリンク一覧: `track_conditions/2024_pdf_links.json` （36件）
- PDF保存先: `track_conditions/2024/<venue>/support/<venueNN>.pdf`
- CSV生成: PowerShellで `PYTHONPATH=. python track_conditions/2024/support/build_all_csvs.py`
- 出力ファイル: `track_conditions/2024/2024_track_conditions_all.csv`（433行）と `track_conditions/2024/2024_track_conditions_summary.csv`
- 備考: 京都は第7回まで、阪神は第2回まで、他場は2023年同様の開催数。すべてクッション値取得済み。
# 2025年対応メモ
- PDFリンク一覧: `track_conditions/2025_pdf_links.json` （25件、2025年10月1日現在）
- PDF保存先: `track_conditions/2025/<venue>/support/<venueNN>.pdf`
- CSV生成: `PYTHONPATH=. python track_conditions/2025/support/build_all_csvs.py`
- 出力ファイル: `track_conditions/2025/2025_track_conditions_all.csv`（299行）と `track_conditions/2025/2025_track_conditions_summary.csv`
- 備考: 2025年PDFは時刻列付きの新レイアウト。`pdf_parser.py` にモダン形式のパーサ `_parse_modern` を追加し、曜日は漢字（例: 金曜日）から英略称へ変換。欠損値は現時点で確認されず。
