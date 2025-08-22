import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { FileText, Upload, Check, X } from 'lucide-react';
import { AdminService } from '../../services/adminService';

interface RaceEntryCsvData {
  年月日: string;
  場所: string;
  R: string;
  馬番: string;
  レース名: string;
  '芝・ダ': string;
  距離: string;
  馬名: string;
  性別: string;
  年齢: string;
  騎手: string;
  斤量: string;
  調教師: string;
  所属: string;
  馬主: string;
  生産者: string;
  種牡馬: string;
  母: string;
  血統登録番号: string;
  日次: string;
  母父: string;
  毛色: string;
  枠: string;
  間隔: string;
  前人気: string;
  前着: string;
  頭数: string;
  本賞金: string;
  収得賞金: string;
  本人気: string;
  本オッズ: string;
  本着順: string;
  レースID: string;
}

export default function RaceEntryCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState<RaceEntryCsvData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return;
    
    // クォート対応の簡易CSV分割
    const split = (line: string) => {
      const out: string[] = [];
      let cur = '';
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (q && line[i + 1] === '"') { cur += '"'; i++; }
          else { q = !q; }
        } else if (ch === ',' && !q) {
          out.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };

    const headers = split(lines[0]).map(h => h.trim());
    const requiredHeaders = [
      '年月日', '場所', 'R', '馬番', 'レース名', '芝・ダ', '距離', '馬名', 
      '性別', '年齢', '騎手', '斤量', '調教師', '所属', '馬主', '生産者', 
      '種牡馬', '母', '血統登録番号', '日次', '母父', '毛色', '枠', '間隔', 
      '前人気', '前着', '頭数', '本賞金', '収得賞金', '本人気', '本オッズ', '本着順', 'レースID'
    ];

    const errors: string[] = [];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push(`不足しているヘッダー: ${missingHeaders.join(', ')}`);
    }

    const data: RaceEntryCsvData[] = [];
    for (let r = 1; r < lines.length; r++) {
      const row = split(lines[r]);
      if (row.length < headers.length) {
        errors.push(`行 ${r + 1}: カラム数が不足しています`);
        continue;
      }

      try {
        const rowData: any = {};
        headers.forEach((header, index) => {
          let value = row[index] || '';
          
          // 日付の正規化（6桁形式を8桁形式に変換）
          if (header === '年月日' && value && value.length === 6) {
            value = `20${value}`;
          }
          
          rowData[header] = value;
        });
        data.push(rowData as RaceEntryCsvData);
      } catch (e) {
        errors.push(`行 ${r + 1}: 解析に失敗しました`);
      }
    }

    setPreviewData(data);
    setValidationErrors(errors);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => parseCsvText(String(ev.target?.result || ''));
    reader.readAsText(f, 'Shift-JIS');
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const api = new AdminService();
      await api.insertRaceEntriesCsv(previewData);
      setUploadStatus('success');
      setMessage(`${previewData.length}件の出馬表データを登録しました`);
      setFile(null);
      setPreviewData([]);
      setValidationErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadStatus('error');
      setMessage(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>出馬表 CSV アップロード</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            出馬表CSVファイルをアップロードして、レース情報、馬の基本情報、出馬表情報を一括登録します。
          </Typography>

          <Box sx={{ mb: 2 }}>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} style={{ display: 'none' }} id="entry-csv-upload" />
            <label htmlFor="entry-csv-upload">
              <Button variant="outlined" component="span" startIcon={<FileText />} sx={{ mr: 2 }}>CSVファイルを選択</Button>
            </label>
            {file && (
              <Button variant="contained" onClick={handleUpload} disabled={isUploading || validationErrors.length > 0} startIcon={isUploading ? <CircularProgress size={16} /> : <Upload />}>{isUploading ? 'アップロード中...' : 'アップロード'}</Button>
            )}
          </Box>

          {validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {validationErrors.map((e, i) => (
                <Typography key={i} variant="body2">• {e}</Typography>
              ))}
            </Alert>
          )}

          {uploadStatus && (
            <Alert severity={uploadStatus} sx={{ mb: 2 }} icon={uploadStatus === 'success' ? <Check /> : <X />}>{message}</Alert>
          )}

          {previewData.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: 420 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>年月日</TableCell>
                    <TableCell>場所</TableCell>
                    <TableCell>R</TableCell>
                    <TableCell>馬番</TableCell>
                    <TableCell>レース名</TableCell>
                    <TableCell>馬名</TableCell>
                    <TableCell>性別</TableCell>
                    <TableCell>年齢</TableCell>
                    <TableCell>騎手</TableCell>
                    <TableCell>斤量</TableCell>
                    <TableCell>調教師</TableCell>
                    <TableCell>所属</TableCell>
                                         <TableCell>馬ID（血統登録番号）</TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {previewData.slice(0, 30).map((d, i) => (
                     <TableRow key={i}>
                       <TableCell>{d.年月日}</TableCell>
                       <TableCell>{d.場所}</TableCell>
                       <TableCell>{d.R}</TableCell>
                       <TableCell>{d.馬番}</TableCell>
                       <TableCell>{d.レース名}</TableCell>
                       <TableCell>{d.馬名}</TableCell>
                       <TableCell>{d.性別}</TableCell>
                       <TableCell>{d.年齢}</TableCell>
                       <TableCell>{d.騎手}</TableCell>
                       <TableCell>{d.斤量}</TableCell>
                       <TableCell>{d.調教師}</TableCell>
                       <TableCell>{d.所属}</TableCell>
                       <TableCell>20{d.血統登録番号}</TableCell>
                     </TableRow>
                   ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}


