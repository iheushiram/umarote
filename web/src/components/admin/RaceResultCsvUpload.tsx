import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import { formatRaceTime } from '../../utils/timeUtils';
import { Upload, FileText, Check, X } from 'lucide-react';
import { createAdminService } from '../../services/adminService';
import { processJapaneseCsvRow, extractHorsesFromCsvData, extractRacesFromCsvData, extractRaceEntriesFromCsvData } from '../../utils/csvMapping';

interface RaceResultData {
  id: string;
  raceId: string;
  horseId: string;
  date: string;
  raceName: string;
  venue: string;
  courseType: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左';
  courseCondition: '良' | '稍' | '重' | '不良';
  finishPosition: number;
  jockey: string;
  weight: number;
  time: string;
  margin: string;
  averagePosition: number;
  lastThreeFurlong: string;
  odds: number;
  popularity: number;
}

export default function RaceResultCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState<RaceResultData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [includeHorseData, setIncludeHorseData] = useState(true);
  const [includeRaceData, setIncludeRaceData] = useState(true);
  const [previewHorses, setPreviewHorses] = useState<any[]>([]);
  const [previewRaces, setPreviewRaces] = useState<any[]>([]);
  const [previewEntries, setPreviewEntries] = useState<any[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCsvFile(selectedFile);
    } else {
      setUploadStatus('error');
      setMessage('CSVファイルを選択してください');
    }
  };
  const handleHorseDataToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeHorseData(event.target.checked);
    // Re-parse the file if already selected
    if (file) {
      parseCsvFile(file);
    }
  };
  const handleRaceDataToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeRaceData(event.target.checked);
    // Re-parse the file if already selected
    if (file) {
      parseCsvFile(file);
    }
  };

  const parseCsvFile = (file: File) => {
    // まずShift-JISで試す（日本の競馬データはShift-JISが多い）
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      
      // 文字化けチェック
      const hasGarbledText = !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(csvText);
      
      if (hasGarbledText) {
        // UTF-8で再読み込み
        const utf8Reader = new FileReader();
        utf8Reader.onload = (e2) => {
          const utf8Text = e2.target?.result as string;
          processCsvText(utf8Text);
        };
        utf8Reader.readAsText(file, 'UTF-8');
      } else {
        processCsvText(csvText);
      }
    };
    
    // 日本語CSVファイルはShift-JISの可能性が高い
    reader.readAsText(file, 'Shift-JIS');
    
    function processCsvText(decodedText: string) {
      const lines = decodedText.split(/\r?\n/).filter(line => line.trim());

      // 会場名の変換マッピング
      const venueMapping: Record<string, string> = {
        '札': '札幌',
        '函': '函館',
        '新': '新潟',
        '東': '東京',
        '中': '中山',
        '中京': '中京',
        '京': '京都',
        '阪': '阪神',
        '小': '小倉'
      };

      // シンプルなCSV分割（クォート対応）
      const splitCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      };

      const rawHeaders = splitCsvLine(lines[0]).map(h => h.trim());
      
      // 実際のCSVヘッダーをそのまま使用（文字化け対策は必要に応じて個別対応）
      const headers = rawHeaders.map(header => {
        // 日付形式の正規化のみ行う
        if (header.includes('日付')) {
          return '日付';
        }
        return header;
      });
      
      console.log('Raw headers:', rawHeaders);
      console.log('Fixed headers:', headers);
      
      const errors: string[] = [];
      const expectedHeaders = [
        'id', 'raceId', 'horseId', 'date', 'raceName', 'venue', 'courseType',
        'distance', 'direction', 'courseCondition', 'finishPosition', 'jockey',
        'weight', 'time', 'margin', 'averagePosition', 'lastThreeFurlong', 'odds', 'popularity'
      ];
      
      // Check if this is a Japanese CSV format
      const japaneseHeaders = ['日付', 'レース名', '馬名', '芝・ダ', '距離', '馬場状態'];
      const headerLine = lines[0];
      const isJapaneseCsv = /[^\x00-\x7F]/.test(headerLine) || japaneseHeaders.some(header => headers.includes(header));
      
      if (!isJapaneseCsv) {
        // Original validation for English format
        if (!expectedHeaders.every(header => headers.includes(header))) {
          errors.push(`必要なヘッダー: ${expectedHeaders.join(', ')}`);
        }
      } else {
        // 日本語CSVはヘッダー名の揺れが大きいため、必須ヘッダー検証はスキップ
      }
      
      const data: RaceResultData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i]);
        if (values.length >= Math.min(headers.length, 5)) { // At least 5 columns needed
          try {
            let resultData: any;

            if (isJapaneseCsv) {
              // 日本語CSVの処理
              const { raceResult } = processJapaneseCsvRow(headers, values, i);
              resultData = raceResult;
            } else {
              // 英語CSVの処理
              const shortVenue = values[headers.indexOf('venue')];
              const venue = venueMapping[shortVenue] || shortVenue; // 短縮名を完全名に変換
              
              resultData = {
                id: values[headers.indexOf('id')],
                raceId: values[headers.indexOf('raceId')],
                horseId: values[headers.indexOf('horseId')],
                date: values[headers.indexOf('date')],
                raceName: values[headers.indexOf('raceName')],
                venue: venue,
                courseType: values[headers.indexOf('courseType')] as '芝' | 'ダート',
                distance: parseInt(values[headers.indexOf('distance')]),
                direction: values[headers.indexOf('direction')] as '右' | '左',
                courseCondition: values[headers.indexOf('courseCondition')] as '良' | '稍' | '重' | '不良',
                finishPosition: parseInt(values[headers.indexOf('finishPosition')]),
                jockey: values[headers.indexOf('jockey')],
                weight: parseFloat(values[headers.indexOf('weight')]),
                time: values[headers.indexOf('time')],
                margin: values[headers.indexOf('margin')],
                averagePosition: parseFloat(values[headers.indexOf('averagePosition')]),
                lastThreeFurlong: values[headers.indexOf('lastThreeFurlong')],
                odds: parseFloat(values[headers.indexOf('odds')]),
                popularity: parseInt(values[headers.indexOf('popularity')]),
              };
            }
            
            // バリデーション
            if (!isJapaneseCsv) {
              if (!['芝', 'ダート'].includes(resultData.courseType)) {
                errors.push(`行 ${i + 1}: コース種別は「芝」「ダート」のいずれかである必要があります`);
              }
              if (!['右', '左'].includes(resultData.direction)) {
                errors.push(`行 ${i + 1}: 回り方向は「右」「左」のいずれかである必要があります`);
              }
              if (!['良', '稍', '重', '不良'].includes(resultData.courseCondition)) {
                errors.push(`行 ${i + 1}: 馬場状態は「良」「稍」「重」「不良」のいずれかである必要があります`);
              }
              if (resultData.finishPosition < 1 || resultData.finishPosition > 18) {
                errors.push(`行 ${i + 1}: 着順は1-18の範囲である必要があります`);
              }
            } else {
              // 日本語CSVは不足値は空文字のまま許容（範囲チェックは値がある場合のみ）
              const rawFinish = (resultData as any).finishPosition;
              if (rawFinish !== '' && rawFinish !== undefined && rawFinish !== null) {
                const fp = Number(rawFinish);
                if (Number.isFinite(fp) && (fp < 1 || fp > 18)) {
                  errors.push(`行 ${i + 1}: 着順は1-18の範囲である必要があります`);
                }
              }
            }
            
            data.push(resultData);
                      } catch (error) {
              const errorMessage = error instanceof Error ? error.message : '不明なエラー';
              errors.push(`行 ${i + 1}: データの解析に失敗しました - ${errorMessage}`);
              console.error(`行 ${i + 1} の解析エラー:`, error);
            }
        }
      }
      
      setPreviewData(data);
      
      console.log('Preview data set:', data.slice(0, 2)); // 最初の2件をログ出力
      
      // Extract horse data if Japanese CSV format
      if (isJapaneseCsv && includeHorseData) {
        try {
          const csvRows = lines.slice(1).map(line => splitCsvLine(line));
          const horses = extractHorsesFromCsvData(headers, csvRows);
          setPreviewHorses(horses);
          console.log('Extracted horses:', horses.slice(0, 2)); // 最初の2件をログ出力
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          errors.push(`馬データの抽出に失敗しました - ${errorMessage}`);
          console.error('馬データ抽出エラー:', error);
          setPreviewHorses([]);
        }
      } else {
        setPreviewHorses([]);
      }
      
      // Extract race data if Japanese CSV format and race data checkbox is checked
      if (isJapaneseCsv && includeRaceData) {
        try {
          console.log('レース抽出開始 - ヘッダー:', headers);
          console.log('レース抽出開始 - データ行数:', lines.length - 1);
          
          const csvRows = lines.slice(1).map(line => splitCsvLine(line));
          const races = extractRacesFromCsvData(headers, csvRows);
          
          console.log('レース抽出結果:', races.length, '件');
          if (races.length > 0) {
            console.log('抽出されたレース例:', races.slice(0, 2));
          } else {
            console.warn('レースが抽出されませんでした。ヘッダー確認:', headers);
            console.warn('CSVの最初の行例:', csvRows[0]);
            
            // レース抽出に失敗した場合の警告メッセージ
            const raceExtractionWarning = 'レース情報の抽出ができませんでした。CSVファイルに「日付」「レース名」「開催」などのヘッダーが含まれているか確認してください。';
            errors.push(raceExtractionWarning);
          }
          
          setPreviewRaces(races);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '不明なエラー';
          console.error('レースデータ抽出エラー:', error);
          console.error('エラー発生時のヘッダー:', headers);
          setPreviewRaces([]);
        }
              } else {
          console.log('レース抽出スキップ - 日本語CSV:', isJapaneseCsv, ', レースデータ有効:', includeRaceData);
          setPreviewRaces([]);
        }
        
        // 出馬表データの抽出を追加
        if (isJapaneseCsv) {
          try {
            const csvRows = lines.slice(1).map(line => splitCsvLine(line));
            const entries = extractRaceEntriesFromCsvData(headers, csvRows);
            setPreviewEntries(entries);
            console.log('Extracted entries:', entries.slice(0, 2)); // 最初の2件をログ出力
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '不明なエラー';
            errors.push(`出馬表データの抽出に失敗しました - ${errorMessage}`);
            console.error('出馬表データ抽出エラー:', error);
            setPreviewEntries([]);
          }
        } else {
          setPreviewEntries([]);
        }
        
        // 全ての処理が完了した後にエラーを設定
        setValidationErrors(errors);
    };
  };

  // Helper function to get the correct tab index for each content
  const getTabIndex = () => {
    let index = 0;
    const tabs: Array<{ content: string; index: number }> = [];
    
    // Tab 0: Always race results
    tabs.push({ content: 'raceResults', index: index++ });
    
    // Tab 1: Race info (if available)
    if (previewRaces.length > 0) {
      tabs.push({ content: 'raceInfo', index: index++ });
    }
    
    // Tab 2: Horse info (if available)  
    if (previewHorses.length > 0) {
      tabs.push({ content: 'horseInfo', index: index++ });
    }
    
    // Tab 3: Race entries (if available)
    if (previewEntries.length > 0) {
      tabs.push({ content: 'raceEntries', index: index++ });
    }
    
    return tabs.reduce((acc, tab) => {
      acc[tab.content] = tab.index;
      return acc;
    }, {} as Record<string, number>);
  };

  const tabIndices = getTabIndex();
  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      const adminService = createAdminService(true); // APIモードで呼び出し
      
      // 1. レース情報を先に登録
      if (previewRaces.length > 0) {
        await adminService.insertRaces(previewRaces.map(race => ({
          ...race,
          win5: false,
          status: '確定' as const,
        })));
      }
      
      // 2. 馬の基本情報を登録
      if (previewHorses.length > 0) {
        await adminService.insertHorses(previewHorses);
      }
      
      // 3. 出馬表を登録（レースと馬が存在することを前提）
      if (previewEntries.length > 0) {
        await adminService.insertRaceEntries(previewEntries);
      }
      
      // 4. レース結果を登録
      await adminService.insertRaceResultsWithHorses(previewData);
      
      const messageParts: string[] = [];
      if (previewRaces.length > 0) {
        messageParts.push(`${previewRaces.length}件のレース情報`);
      }
      if (previewHorses.length > 0) {
        messageParts.push(`${previewHorses.length}件の馬情報`);
      }
      if (previewEntries.length > 0) {
        messageParts.push(`${previewEntries.length}件の出馬表`);
      }
      messageParts.push(`${previewData.length}件のレース結果データ`);
      
      setUploadStatus('success');
      setMessage(`${messageParts.join('、')}をアップロードしました`);
      setFile(null);
      setPreviewData([]);
      setPreviewRaces([]);
      setPreviewHorses([]);
      setPreviewEntries([]);
      setValidationErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadStatus('error');
      setMessage(error instanceof Error ? error.message : 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };;

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            レース結果 CSV アップロード
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>対応形式:</strong>
            <br />
            <strong>1. 日本語競馬CSV:</strong> 日付, レース名, 馬名, 着順, 騎手, 芝・ダ, 距離, 馬場状態, 走破タイム, 着差, 上り3F, 単勝配当, 人気 等
            <br />
            <strong>2. 英語形式CSV:</strong> id, raceId, horseId, date, raceName, venue, courseType, distance, direction, courseCondition, finishPosition, jockey, weight, time, margin, averagePosition, lastThreeFurlong, odds, popularity
            <br />
            <em>※ 日本語形式では不足データは自動生成されます</em>
          </Typography>

          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="result-csv-upload"
            />
            <label htmlFor="result-csv-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<FileText />}
                sx={{ mr: 2 }}
              >
                CSVファイルを選択
              </Button>
            </label>

            {file && (
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={isUploading || validationErrors.length > 0}
                startIcon={isUploading ? <CircularProgress size={16} /> : <Upload />}
              >
                {isUploading ? 'アップロード中...' : 'アップロード'}
              </Button>
            )}
          </Box>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeHorseData}
                  onChange={handleHorseDataToggle}
                  name="includeHorseData"
                />
              }
              label="馬情報も同時に登録する（日本語CSVのみ）"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeRaceData}
                  onChange={handleRaceDataToggle}
                  name="includeRaceData"
                />
              }
              label="レース情報も同時に登録する"
            />
          </Box>

          {file && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2">
                選択ファイル: {file.name}
              </Typography>
            </Box>
          )}

          {validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">バリデーションエラー:</Typography>
              {validationErrors.map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error}
                </Typography>
              ))}
            </Alert>
          )}

          {uploadStatus && (
            <Alert 
              severity={uploadStatus} 
              sx={{ mb: 2 }}
              icon={uploadStatus === 'success' ? <Check /> : <X />}
            >
              {message}
            </Alert>
          )}

          {(previewData.length > 0 || previewHorses.length > 0 || previewRaces.length > 0) && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                データプレビュー (最初の10件のみ表示、登録時は全件登録)
              </Typography>
              
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
                  <Tab label={`レース結果 (${previewData.length}件)`} />
                  {previewRaces.length > 0 && (
                    <Tab label={`レース情報 (${previewRaces.length}件)`} />
                  )}
                  {previewHorses.length > 0 && (
                    <Tab label={`馬情報 (${previewHorses.length}件)`} />
                  )}
                  {previewEntries.length > 0 && (
                    <Tab label={`出馬表 (${previewEntries.length}件)`} />
                  )}
                </Tabs>
              </Box>
              
              {tabValue === tabIndices.raceResults && previewData.length > 0 && (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>レースID</TableCell>
                        <TableCell>馬ID</TableCell>
                        <TableCell>日付</TableCell>
                        <TableCell>レース名</TableCell>
                        <TableCell>着順</TableCell>
                        <TableCell>騎手</TableCell>
                        <TableCell>タイム</TableCell>
                        <TableCell>人気</TableCell>
                        <TableCell>オッズ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewData.slice(0, 10).map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>{result.raceId}</TableCell>
                          <TableCell>{result.horseId}</TableCell>
                          <TableCell>{result.date}</TableCell>
                          <TableCell>{result.raceName}</TableCell>
                          <TableCell>
                            <Chip 
                              label={`${result.finishPosition}着`} 
                              size="small"
                              color={result.finishPosition === 1 ? 'primary' : result.finishPosition <= 3 ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{result.jockey}</TableCell>
                          <TableCell>{formatRaceTime(result.time)}</TableCell>
                          <TableCell>{result.popularity}番人気</TableCell>
                          <TableCell>{result.odds}倍</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              
              {tabIndices.raceInfo !== undefined && tabValue === tabIndices.raceInfo && previewRaces.length > 0 && (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>レースID</TableCell>
                        <TableCell>日付</TableCell>
                        <TableCell>開催</TableCell>
                        <TableCell>R</TableCell>
                        <TableCell>レース名</TableCell>
                        <TableCell>クラス</TableCell>
                        <TableCell>コース</TableCell>
                        <TableCell>周り</TableCell>
                        <TableCell>距離</TableCell>
                        <TableCell>馬場</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewRaces.slice(0, 10).map((race, index) => (
                        <TableRow key={index}>
                          <TableCell>{race.raceId}</TableCell>
                          <TableCell>{race.date}</TableCell>
                          <TableCell>{race.meetingNumber}回{race.venue}{race.dayNumber}日</TableCell>
                          <TableCell>{race.raceNo}R</TableCell>
                          <TableCell>{race.raceName}</TableCell>
                          <TableCell>{race.className}</TableCell>
                          <TableCell>
                            <Chip 
                              label={race.surface} 
                              size="small"
                              color={race.surface === '芝' ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={race.direction} 
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{race.distance}m</TableCell>
                          <TableCell>
                            <Chip 
                              label={race.trackCond} 
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              
              {tabIndices.horseInfo !== undefined && tabValue === tabIndices.horseInfo && previewHorses.length > 0 && (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>馬ID</TableCell>
                        <TableCell>馬名</TableCell>
                        <TableCell>生年月日</TableCell>
                        <TableCell>性別</TableCell>
                        <TableCell>父</TableCell>
                        <TableCell>母</TableCell>
                        <TableCell>調教師</TableCell>
                        <TableCell>獲得賞金</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewHorses.slice(0, 10).map((horse, index) => (
                        <TableRow key={index}>
                          <TableCell>{horse.id}</TableCell>
                          <TableCell>{horse.name}</TableCell>
                          <TableCell>{horse.birthDate}</TableCell>
                          <TableCell>
                            <Chip 
                              label={horse.sex} 
                              size="small"
                              color={horse.sex === '牡' ? 'primary' : horse.sex === '牝' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{horse.father}</TableCell>
                          <TableCell>{horse.mother}</TableCell>
                          <TableCell>{horse.trainer}</TableCell>
                          <TableCell>{horse.earnings.toLocaleString()}万円</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              
              {tabIndices.raceEntries !== undefined && tabValue === tabIndices.raceEntries && previewEntries.length > 0 && (
                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>出馬ID</TableCell>
                        <TableCell>レースID</TableCell>
                        <TableCell>馬ID</TableCell>
                        <TableCell>騎手</TableCell>
                        <TableCell>馬番</TableCell>
                        <TableCell>枠番</TableCell>
                        <TableCell>年齢</TableCell>
                        <TableCell>斤量</TableCell>
                        <TableCell>調教師</TableCell>
                        <TableCell>人気</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewEntries.slice(0, 10).map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{entry.id}</TableCell>
                          <TableCell>{entry.raceId}</TableCell>
                          <TableCell>{entry.horseId}</TableCell>
                          <TableCell>{entry.jockey}</TableCell>
                          <TableCell>{entry.horseNo}番</TableCell>
                          <TableCell>{entry.frameNo}枠</TableCell>
                          <TableCell>{entry.age}歳</TableCell>
                          <TableCell>{entry.weight}kg</TableCell>
                          <TableCell>{entry.trainer}</TableCell>
                          <TableCell>{entry.popularity ? `${entry.popularity}番人気` : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}