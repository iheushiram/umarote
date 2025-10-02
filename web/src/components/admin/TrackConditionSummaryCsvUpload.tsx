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

interface TrackConditionSummaryRow {
  venue: string;
  meeting: string;
  date: string;
  weekday: string;
  turf_goal_percent: string;
  turf_corner_percent: string;
  dirt_goal_percent: string;
  dirt_corner_percent: string;
  cushion_value: string;
}

const REQUIRED_HEADERS = [
  'venue',
  'meeting',
  'date',
  'weekday',
  'turf_goal_percent',
  'turf_corner_percent',
  'dirt_goal_percent',
  'dirt_corner_percent',
  'cushion_value'
];

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
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
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
};

export default function TrackConditionSummaryCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<TrackConditionSummaryRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) {
      setPreviewData([]);
      setValidationErrors(['CSVが空です']);
      return;
    }

    const headers = splitCsvLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
    const errors: string[] = [];
    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push(`不足しているヘッダー: ${missingHeaders.join(', ')}`);
    }

    const data: TrackConditionSummaryRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = splitCsvLine(lines[i]);
      if (row.length === 0 || row.every(cell => cell === '')) continue;
      if (row.length < headers.length) {
        errors.push(`行 ${i + 1}: カラム数が不足しています`);
        continue;
      }

      const rowData: Partial<TrackConditionSummaryRow> = {};
      headers.forEach((header, idx) => {
        if (REQUIRED_HEADERS.includes(header)) {
          rowData[header as keyof TrackConditionSummaryRow] = row[idx]?.trim() ?? '';
        }
      });

      const typed = rowData as TrackConditionSummaryRow;
      if (!typed.date) {
        errors.push(`行 ${i + 1}: date が空です`);
      }
      data.push(typed);
    }

    setPreviewData(data);
    setValidationErrors(errors);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') {
        parseCsvText(result);
      }
    };
    reader.readAsText(selected, 'utf-8');
  };

  const handleUpload = async () => {
    if (!file || previewData.length === 0) return;
    setIsUploading(true);
    setUploadStatus(null);
    setMessage('');
    try {
      const api = new AdminService();
      await api.insertTrackConditionDailySummaries(previewData, file.name);
      setUploadStatus('success');
      setMessage(`${previewData.length}件の日次馬場サマリーを登録しました`);
      setFile(null);
      setPreviewData([]);
      setValidationErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
            馬場サマリー CSV アップロード
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            venue, meeting, date などの列を含む馬場サマリーCSVをアップロードし、`track_condition_daily_summaries` テーブルへ登録します。
          </Typography>

          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="track-condition-summary-upload"
            />
            <label htmlFor="track-condition-summary-upload">
              <Button variant="outlined" component="span" startIcon={<FileText />} sx={{ mr: 2 }}>
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

          {validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
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

          {previewData.length > 0 && (
            <TableContainer component={Paper} sx={{ maxHeight: 420 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>venue</TableCell>
                    <TableCell>meeting</TableCell>
                    <TableCell>date</TableCell>
                    <TableCell>weekday</TableCell>
                    <TableCell align="right">turf_goal_percent</TableCell>
                    <TableCell align="right">turf_corner_percent</TableCell>
                    <TableCell align="right">dirt_goal_percent</TableCell>
                    <TableCell align="right">dirt_corner_percent</TableCell>
                    <TableCell align="right">cushion_value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.map((row, idx) => (
                    <TableRow key={`${row.venue}-${row.date}-${idx}`}>
                      <TableCell>{row.venue}</TableCell>
                      <TableCell>{row.meeting}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.weekday}</TableCell>
                      <TableCell align="right">{row.turf_goal_percent}</TableCell>
                      <TableCell align="right">{row.turf_corner_percent}</TableCell>
                      <TableCell align="right">{row.dirt_goal_percent}</TableCell>
                      <TableCell align="right">{row.dirt_corner_percent}</TableCell>
                      <TableCell align="right">{row.cushion_value}</TableCell>
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

