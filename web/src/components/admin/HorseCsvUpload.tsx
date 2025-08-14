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

interface HorseData {
  id: string;
  name: string;
  birthYear: number;
  sex: '牡' | '牝' | 'セ';
  color: string;
  father: string;
  mother: string;
  trainer: string;
  owner: string;
  breeder: string;
  earnings: number;
}

export default function HorseCsvUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState<HorseData[]>([]);
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
      const expectedHeaders = ['id', 'name', 'birthYear', 'sex', 'color', 'father', 'mother', 'trainer', 'owner', 'breeder', 'earnings'];
      
      if (!expectedHeaders.every(header => headers.includes(header))) {
        errors.push(`必要なヘッダー: ${expectedHeaders.join(', ')}`);
      }
      
      const data: HorseData[] = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          try {
            const horseData: HorseData = {
              id: values[headers.indexOf('id')],
              name: values[headers.indexOf('name')],
              birthYear: parseInt(values[headers.indexOf('birthYear')]),
              sex: values[headers.indexOf('sex')] as '牡' | '牝' | 'セ',
              color: values[headers.indexOf('color')],
              father: values[headers.indexOf('father')],
              mother: values[headers.indexOf('mother')],
              trainer: values[headers.indexOf('trainer')],
              owner: values[headers.indexOf('owner')],
              breeder: values[headers.indexOf('breeder')],
              earnings: parseFloat(values[headers.indexOf('earnings')] || '0'),
            };
            
            if (!['牡', '牝', 'セ'].includes(horseData.sex)) {
              errors.push(`行 ${i + 1}: 性別は「牡」「牝」「セ」のいずれかである必要があります`);
            }
            
            data.push(horseData);
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
      await adminService.insertHorses(previewData);
      
      setUploadStatus('success');
      setMessage(`${previewData.length}件の馬データをアップロードしました`);
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
            馬情報 CSV アップロード
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            CSV形式: id, name, birthYear, sex, color, father, mother, trainer, owner, breeder, earnings
          </Typography>

          <Box sx={{ mb: 2 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="horse-csv-upload"
            />
            <label htmlFor="horse-csv-upload">
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
                      <TableCell>ID</TableCell>
                      <TableCell>馬名</TableCell>
                      <TableCell>生年</TableCell>
                      <TableCell>性別</TableCell>
                      <TableCell>毛色</TableCell>
                      <TableCell>父</TableCell>
                      <TableCell>母</TableCell>
                      <TableCell>調教師</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((horse, index) => (
                      <TableRow key={index}>
                        <TableCell>{horse.id}</TableCell>
                        <TableCell>{horse.name}</TableCell>
                        <TableCell>{horse.birthYear}</TableCell>
                        <TableCell>
                          <Chip 
                            label={horse.sex} 
                            size="small"
                            color={horse.sex === '牡' ? 'primary' : horse.sex === '牝' ? 'secondary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{horse.color}</TableCell>
                        <TableCell>{horse.father}</TableCell>
                        <TableCell>{horse.mother}</TableCell>
                        <TableCell>{horse.trainer}</TableCell>
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