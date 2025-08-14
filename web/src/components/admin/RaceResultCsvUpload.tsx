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
      const expectedHeaders = [
        'id', 'raceId', 'horseId', 'date', 'raceName', 'venue', 'courseType',
        'distance', 'direction', 'courseCondition', 'finishPosition', 'jockey',
        'weight', 'time', 'margin', 'averagePosition', 'lastThreeFurlong', 'odds', 'popularity'
      ];
      
      if (!expectedHeaders.every(header => headers.includes(header))) {
        errors.push(`必要なヘッダー: ${expectedHeaders.join(', ')}`);
      }
      
      const data: RaceResultData[] = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= expectedHeaders.length) {
          try {
            const resultData: RaceResultData = {
              id: values[headers.indexOf('id')],
              raceId: values[headers.indexOf('raceId')],
              horseId: values[headers.indexOf('horseId')],
              date: values[headers.indexOf('date')],
              raceName: values[headers.indexOf('raceName')],
              venue: values[headers.indexOf('venue')],
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
            
            data.push(resultData);
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
      const adminService = createAdminService();
      await adminService.insertRaceResults(previewData);
      
      setUploadStatus('success');
      setMessage(`${previewData.length}件のレース結果データをアップロードしました`);
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
            レース結果 CSV アップロード
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            CSV形式: id, raceId, horseId, date, raceName, venue, courseType, distance, direction, courseCondition, finishPosition, jockey, weight, time, margin, averagePosition, lastThreeFurlong, odds, popularity
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
                    {previewData.map((result, index) => (
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
                        <TableCell>{result.time}</TableCell>
                        <TableCell>{result.popularity}番人気</TableCell>
                        <TableCell>{result.odds}倍</TableCell>
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