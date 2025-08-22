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
} from '@mui/material';
import { Upload, FileText, Check, X } from 'lucide-react';
import { createAdminService } from '../../services/adminService';
import { generateRaceId, VENUE_ID_MAP } from '../../utils/raceUtils';

interface RaceData {
  raceId: string;
  date: string;
  venue: string;
  meetingNumber: number; // 開催回数
  dayNumber: number;     // 開催日数  
  raceNo: number;
  raceName: string;
  className: string;
  surface: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左';
  courseConf?: string;
  trackCond: '良' | '稍' | '重' | '不良';
  cushionValue?: number;
  fieldSize?: number;
  offAt?: string;
  grade?: 'OP' | 'G3' | 'G2' | 'G1';
  weather?: string;
}

export default function RaceCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState<RaceData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      const errors: string[] = [];
      const expectedHeaders = ['date', 'venue', 'meetingNumber', 'dayNumber', 'raceNo', 'raceName', 'className', 'surface', 'distance', 'direction', 'trackCond'];
      
      if (!expectedHeaders.every(header => headers.includes(header))) {
        errors.push(`必要なヘッダー: ${expectedHeaders.join(', ')}`);
      }
      
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
      
      const data: RaceData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= expectedHeaders.length) {
          try {
            const date = values[headers.indexOf('date')];
            const shortVenue = values[headers.indexOf('venue')];
            const venue = venueMapping[shortVenue] || shortVenue; // 短縮名を完全名に変換
            const meetingNumber = parseInt(values[headers.indexOf('meetingNumber')]);
            const dayNumber = parseInt(values[headers.indexOf('dayNumber')]);
            const raceNo = parseInt(values[headers.indexOf('raceNo')]);
            
            // レースIDを自動生成
            const year = new Date(date).getFullYear();
            const raceId = generateRaceId(year, venue, meetingNumber, dayNumber, raceNo);
            
            const raceData: RaceData = {
              raceId,
              date,
              venue,
              meetingNumber,
              dayNumber,
              raceNo,
              raceName: values[headers.indexOf('raceName')],
              className: values[headers.indexOf('className')],
              surface: values[headers.indexOf('surface')] as '芝' | 'ダート',
              distance: parseInt(values[headers.indexOf('distance')]),
              direction: values[headers.indexOf('direction')] as '右' | '左',
              courseConf: headers.includes('courseConf') ? values[headers.indexOf('courseConf')] : undefined,
              trackCond: values[headers.indexOf('trackCond')] as '良' | '稍' | '重' | '不良',
              cushionValue: headers.includes('cushionValue') ? parseFloat(values[headers.indexOf('cushionValue')]) : undefined,
              fieldSize: headers.includes('fieldSize') ? parseInt(values[headers.indexOf('fieldSize')]) : undefined,
              offAt: headers.includes('offAt') ? values[headers.indexOf('offAt')] : undefined,
              grade: headers.includes('grade') ? values[headers.indexOf('grade')] as 'OP' | 'G3' | 'G2' | 'G1' : undefined,
              weather: headers.includes('weather') ? values[headers.indexOf('weather')] : undefined,
            };
            
            if (!VENUE_ID_MAP[venue]) {
              errors.push(`行 ${i + 1}: 不明な競馬場「${venue}」です`);
            }
            
            if (!['芝', 'ダート'].includes(raceData.surface)) {
              errors.push(`行 ${i + 1}: コース種別は「芝」「ダート」のいずれかである必要があります`);
            }
            
            if (!['右', '左'].includes(raceData.direction)) {
              errors.push(`行 ${i + 1}: 回り方向は「右」「左」のいずれかである必要があります`);
            }
            
            if (!['良', '稍', '重', '不良'].includes(raceData.trackCond)) {
              errors.push(`行 ${i + 1}: 馬場状態は「良」「稍」「重」「不良」のいずれかである必要があります`);
            }
            
            if (meetingNumber < 1 || meetingNumber > 6) {
              errors.push(`行 ${i + 1}: 開催回数は1-6の範囲である必要があります`);
            }
            
            if (dayNumber < 1 || dayNumber > 12) {
              errors.push(`行 ${i + 1}: 開催日数は1-12の範囲である必要があります`);
            }
            
            data.push(raceData);
          } catch (error) {
            errors.push(`行 ${i + 1}: データの解析に失敗しました`);
          }
        }
      }
      
      setPreviewData(data);
      setValidationErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      const adminService = createAdminService(true); // APIモードで呼び出し
      await adminService.insertRaces(previewData.map(race => ({
        ...race,
        win5: false,
        status: '発売中' as const,
      })));
      
      setUploadStatus('success');
      setMessage(`${previewData.length}件のレースデータをアップロードしました`);
      setFile(null);
      setPreviewData([]);
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
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            レース情報 CSV アップロード
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            必須項目: date, venue, meetingNumber, dayNumber, raceNo, raceName, className, surface, distance, direction, trackCond
            <br />
            オプション項目: courseConf, cushionValue, fieldSize, offAt, grade, weather
            <br />
            ※ raceIdは自動生成されます (YYYY + 競馬場ID + 開催回数 + 開催日数 + R数)
          </Typography>

          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="race-csv-upload"
            />
            <label htmlFor="race-csv-upload">
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

          {previewData.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                データプレビュー (最初の10件)
              </Typography>
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
                      <TableCell>距離</TableCell>
                      <TableCell>馬場</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((race, index) => (
                      <TableRow key={index}>
                        <TableCell>{race.raceId}</TableCell>
                        <TableCell>{race.date}</TableCell>
                        <TableCell>{race.meetingNumber}回{race.venue}{race.dayNumber}日</TableCell>
                        <TableCell>{race.raceNo}R</TableCell>
                        <TableCell>{race.raceName}</TableCell>
                        <TableCell>{race.className}</TableCell>
                        <TableCell>
                          <Chip 
                            label={`${race.surface}${race.direction}`} 
                            size="small"
                            color={race.surface === '芝' ? 'success' : 'warning'}
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
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}