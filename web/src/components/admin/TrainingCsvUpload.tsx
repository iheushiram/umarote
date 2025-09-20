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
  Paper,
  Chip
} from '@mui/material';
import { FileText, Upload, Check, X } from 'lucide-react';
import { AdminService, TrainingRecordPayload } from '../../services/adminService';

const REQUIRED_HILL_HEADERS = [
  '場所',
  '年月日',
  '曜日',
  '時刻',
  '馬名',
  'Ｃ',
  '性別',
  '年齢',
  '調教師',
  'Time1',
  'Time2',
  'Time3',
  'Time4',
  'Lap4',
  'Lap3',
  'Lap2',
  'Lap1',
  '血統登録番号'
];

const REQUIRED_WOOD_HEADERS = [
  '場所',
  'コース',
  '回り',
  '年月日',
  '曜日',
  '時刻',
  '馬名',
  'Ｃ',
  '性別',
  '年齢',
  '調教師',
  '10F',
  '9F',
  '8F',
  '7F',
  '6F',
  '5F',
  '4F',
  '3F',
  '2F',
  '1F',
  'Lap9',
  'Lap8',
  'Lap7',
  'Lap6',
  'Lap5',
  'Lap4',
  'Lap3',
  'Lap2',
  'Lap1',
  '血統登録番号'
];

const toDateString = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}[./]\d{1,2}[./]\d{1,2}$/.test(raw)) {
    const parts = raw.replace(/\./g, '-').split('-');
    const [y, m, d] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return raw;
};

const toTimeString = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';
  if (raw.includes(':')) {
    const [h, m] = raw.split(':');
    return `${String(parseInt(h || '0', 10)).padStart(2, '0')}:${String(parseInt(m || '0', 10)).padStart(2, '0')}`;
  }
  if (/^\d{3,4}$/.test(raw)) {
    const h = raw.length === 3 ? raw.slice(0, 1) : raw.slice(0, raw.length - 2);
    const m = raw.slice(-2);
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
  }
  return raw;
};

const toNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/未/.test(trimmed)) return null;
  const normalized = trimmed.replace(/[^0-9.+\-]/g, '');
  if (!normalized) return null;
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

const toSex = (value: string): '牡' | '牝' | 'セ' => {
  if (value === '牝') return '牝';
  if (value === 'セ') return 'セ';
  return '牡';
};

const parseHillRow = (row: Record<string, string>): TrainingRecordPayload => {
  return {
    trainingType: 'hill',
    facility: row['場所']?.trim() || '',
    course: null,
    turn: null,
    trainingDate: toDateString(row['年月日'] || ''),
    weekday: row['曜日']?.trim() || '',
    trainingTime: toTimeString(row['時刻'] || ''),
    horseName: row['馬名']?.trim() || '',
    classCode: row['Ｃ']?.trim() || null,
    sex: toSex(row['性別'] || ''),
    age: parseInt(row['年齢'] || '0', 10) || 0,
    trainer: row['調教師']?.trim() || '',
    time10f: null,
    time9f: null,
    time8f: null,
    time7f: null,
    time6f: null,
    time5f: null,
    time4f: toNumberOrNull(row['Time1'] || ''),
    time3f: toNumberOrNull(row['Time2'] || ''),
    time2f: toNumberOrNull(row['Time3'] || ''),
    time1f: toNumberOrNull(row['Time4'] || ''),
    lap9: null,
    lap8: null,
    lap7: null,
    lap6: null,
    lap5: null,
    lap4: toNumberOrNull(row['Lap4'] || ''),
    lap3: toNumberOrNull(row['Lap3'] || ''),
    lap2: toNumberOrNull(row['Lap2'] || ''),
    lap1: toNumberOrNull(row['Lap1'] || ''),
    registrationNumber: row['血統登録番号']?.trim() || null,
    affiliation: null,
  };
};

const parseWoodRow = (row: Record<string, string>): TrainingRecordPayload => {
  return {
    trainingType: 'wood',
    facility: row['場所']?.trim() || '',
    course: row['コース']?.trim() || null,
    turn: row['回り']?.trim() || null,
    trainingDate: toDateString(row['年月日'] || ''),
    weekday: row['曜日']?.trim() || '',
    trainingTime: toTimeString(row['時刻'] || ''),
    horseName: row['馬名']?.trim() || '',
    classCode: row['Ｃ']?.trim() || null,
    sex: toSex(row['性別'] || ''),
    age: parseInt(row['年齢'] || '0', 10) || 0,
    trainer: row['調教師']?.trim() || '',
    time10f: toNumberOrNull(row['10F'] || ''),
    time9f: toNumberOrNull(row['9F'] || ''),
    time8f: toNumberOrNull(row['8F'] || ''),
    time7f: toNumberOrNull(row['7F'] || ''),
    time6f: toNumberOrNull(row['6F'] || ''),
    time5f: toNumberOrNull(row['5F'] || ''),
    time4f: toNumberOrNull(row['4F'] || ''),
    time3f: toNumberOrNull(row['3F'] || ''),
    time2f: toNumberOrNull(row['2F'] || ''),
    time1f: toNumberOrNull(row['1F'] || ''),
    lap9: toNumberOrNull(row['Lap9'] || ''),
    lap8: toNumberOrNull(row['Lap8'] || ''),
    lap7: toNumberOrNull(row['Lap7'] || ''),
    lap6: toNumberOrNull(row['Lap6'] || ''),
    lap5: toNumberOrNull(row['Lap5'] || ''),
    lap4: toNumberOrNull(row['Lap4'] || ''),
    lap3: toNumberOrNull(row['Lap3'] || ''),
    lap2: toNumberOrNull(row['Lap2'] || ''),
    lap1: toNumberOrNull(row['Lap1'] || ''),
    registrationNumber: row['血統登録番号']?.trim() || null,
    affiliation: row['所属']?.trim() || null,
  };
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(v => v.trim());
};

export default function TrainingCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<TrainingRecordPayload[]>([]);
  const [previewType, setPreviewType] = useState<'hill' | 'wood' | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = String(ev.target?.result || '');
      parseCsv(text);
    };
    reader.readAsText(selected, 'Shift-JIS');
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      setValidationErrors(['CSVが空です']);
      setRecords([]);
      setPreviewType(null);
      return;
    }

    const headers = splitCsvLine(lines[0]);
    const isWood = REQUIRED_WOOD_HEADERS.every(h => headers.includes(h));
    const isHill = REQUIRED_HILL_HEADERS.every(h => headers.includes(h));

    const errors: string[] = [];
    if (!isWood && !isHill) {
      errors.push('対応していないフォーマットです（坂路またはウッドの必須ヘッダーが不足）');
    }

    const parsed: TrainingRecordPayload[] = [];
    for (let r = 1; r < lines.length; r++) {
      const rowRaw = splitCsvLine(lines[r]);
      if (rowRaw.length === 1 && rowRaw[0] === '') continue;
      if (rowRaw.length < headers.length) {
        errors.push(`行 ${r + 1}: カラム数が不足しています`);
        continue;
      }
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = rowRaw[idx] ?? '';
      });

      try {
        if (isWood) {
          parsed.push(parseWoodRow(row));
        } else if (isHill) {
          parsed.push(parseHillRow(row));
        }
      } catch (err) {
        errors.push(`行 ${r + 1}: 解析に失敗しました`);
      }
    }

    setRecords(parsed);
    setPreviewType(isWood ? 'wood' : 'hill');
    setValidationErrors(errors);
  };

  const handleUpload = async () => {
    if (records.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    setMessage('');
    try {
      const api = new AdminService();
      await api.insertTrainingRecords(records);
      setUploadStatus('success');
      setMessage(`${records.length}件の調教データを登録しました`);
      setRecords([]);
      setPreviewType(null);
      setFile(null);
      setValidationErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      setUploadStatus('error');
      setMessage(error instanceof Error ? error.message : '調教データの登録に失敗しました');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>調教 CSV アップロード</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            坂路・ウッド調教のCSVを読み込み、共通テーブルへ登録します。ファイルは坂路・ウッドいずれか単一フォーマットでアップロードしてください。
          </Typography>

          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="training-csv-upload"
            />
            <label htmlFor="training-csv-upload">
              <Button variant="outlined" component="span" startIcon={<FileText />}>
                CSVファイルを選択
              </Button>
            </label>
            {file && (
              <Button
                variant="contained"
                startIcon={isUploading ? <CircularProgress size={16} /> : <Upload />}
                disabled={isUploading || validationErrors.some(e => e.startsWith('行 '))}
                onClick={handleUpload}
              >
                {isUploading ? 'アップロード中...' : 'アップロード'}
              </Button>
            )}
          </Box>

          {file && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              選択ファイル: <strong>{file.name}</strong>
            </Typography>
          )}

          {validationErrors.length > 0 && (
            <Alert severity={validationErrors.some(e => e.startsWith('不足')) ? 'error' : 'warning'} sx={{ mb: 2 }}>
              {validationErrors.map((err, idx) => (
                <Typography key={idx} variant="body2">• {err}</Typography>
              ))}
            </Alert>
          )}

          {uploadStatus && (
            <Alert severity={uploadStatus} sx={{ mb: 2 }} icon={uploadStatus === 'success' ? <Check /> : <X />}>
              {message}
            </Alert>
          )}

          {records.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: 420 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>種別</TableCell>
                    <TableCell>場所</TableCell>
                    <TableCell>年月日</TableCell>
                    <TableCell>時刻</TableCell>
                    <TableCell>馬名</TableCell>
                    <TableCell>性齢</TableCell>
                    <TableCell>調教師</TableCell>
                    <TableCell>4F</TableCell>
                    <TableCell>3F</TableCell>
                    <TableCell>2F</TableCell>
                    <TableCell>1F</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.slice(0, 50).map((record, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Chip size="small" label={record.trainingType === 'hill' ? '坂路' : 'ウッド'} color={record.trainingType === 'hill' ? 'primary' : 'secondary'} />
                      </TableCell>
                      <TableCell>{record.facility}</TableCell>
                      <TableCell>{record.trainingDate}</TableCell>
                      <TableCell>{record.trainingTime}</TableCell>
                      <TableCell>{record.horseName}</TableCell>
                      <TableCell>{`${record.sex}${record.age}`}</TableCell>
                      <TableCell>{record.trainer}</TableCell>
                      <TableCell>{record.time4f ?? record.time10f ?? '-'}</TableCell>
                      <TableCell>{record.time3f ?? record.time9f ?? '-'}</TableCell>
                      <TableCell>{record.time2f ?? '-'}</TableCell>
                      <TableCell>{record.time1f ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {previewType && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              プレビュー: {previewType === 'hill' ? '坂路' : 'ウッド'} ({records.length}件)
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
