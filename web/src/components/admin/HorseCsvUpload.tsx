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
import { generateHorseId } from '../../utils/csvMapping';

interface HorseData {
  id: string;
  name: string;
  birthDate: string;
  sex: '牡' | '牝' | 'セ';
  color: string;
  father: string;
  mother: string;
  trainer: string;
  owner: string;
  breeder: string;
  earnings: number;
  currentRaceId?: string; // 現在出走予定のレースID（任意）
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

    reader.readAsText(file, 'Shift-JIS'); // 日本語CSVファイルはShift-JISの可能性が高い

    function processCsvText(decodedText: string) {
      const lines = decodedText.split(/\r?\n/).filter(line => line.trim());

      // クォート対応のCSV分割
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

      const headers = splitCsvLine(lines[0]).map(h => h.trim());
      
      const errors: string[] = [];
      const expectedHeaders = ['id', 'name', 'birthYear', 'sex', 'color', 'father', 'mother', 'trainer', 'owner', 'breeder', 'earnings'];
      
      // 日本語CSV判定
      const japaneseHeaders = ['馬名', '性別', '年齢'];
      const headerLine = lines[0];
      const isJapaneseCsv = /[^\x00-\x7F]/.test(headerLine) || japaneseHeaders.some(h => headers.includes(h));

      if (!isJapaneseCsv) {
        if (!expectedHeaders.every(header => headers.includes(header))) {
          errors.push(`必要なヘッダー: ${expectedHeaders.join(', ')}`);
        }
        
        // 英語CSVでも血統登録番号をチェック
        if (!headers.includes('pedigreeNumber') && !headers.includes('pedigree_number')) {
          errors.push('血統登録番号（pedigreeNumber）が必要です');
        }
      }
      
      const data: HorseData[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i]);
        if (values.length >= Math.min(headers.length, 3)) {
          try {
            let horseData: HorseData;

            if (isJapaneseCsv) {
              // ヘッダー->値の辞書
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

              const name = row['馬名'] || '';
              const sexRaw = (row['性別'] || '').trim();
              const sex = (sexRaw === '牡' || sexRaw === '牝') ? sexRaw : (sexRaw === '騙' ? 'セ' : ('' as any));

              // 血統登録番号を取得
              const pedigreeNumber = row['血統登録番号'] || row['血統番号'] || row['登録番号'] || '';
              if (!pedigreeNumber) {
                errors.push(`行 ${i + 1}: 血統登録番号が必要です`);
                continue;
              }

              // 生年を取得（生年月日または年齢から推定）
              const birthDate = row['生年月日'] || '';
              let birthDateValue: any = '';
              if (birthDate) {
                // 生年月日を8桁のYYYYMMDD形式に変換（YYYY.MM.DD形式、スペース対応）
                const parts = birthDate.replace(/\s+/g, '').split('.');
                if (parts.length >= 3) {
                  const year = parts[0].padStart(4, '0');
                  const month = parts[1].padStart(2, '0');
                  const day = parts[2].padStart(2, '0');
                  birthDateValue = `${year}${month}${day}`;
                } else {
                  birthDateValue = birthDate.replace(/\.\s*/g, '').replace(/\s+/g, '');
                }
              } else {
                // 年齢から推定
                const date = (row['日付'] || '').trim();
                const ageStr = (row['年齢'] || '').trim();
                if (/^\d{6}$/.test(date) && /^\d+$/.test(ageStr)) {
                  const year = 2000 + parseInt(date.slice(0, 2), 10);
                  const age = parseInt(ageStr, 10);
                  birthDateValue = `${year - age + 1}0101`.padStart(8, '0');
                }
              }

              const id = generateHorseId(pedigreeNumber);
              const trainer = (row['調教師'] || '').replace(/^\((?:栗|美)\)\s*/, '');
              const earnings = (() => { const v = (row['賞金'] || '').replace(/[^\d.]/g, ''); return v ? parseFloat(v) : 0; })();

              // 血統情報を抽出
              const father = row['種牡馬'] || row['父'] || row['父馬'] || '';
              const mother = row['母馬'] || row['母'] || '';
              const owner = row['馬主'] || row['オーナー'] || '';
              const breeder = row['生産者'] || row['ブリーダー'] || '';

              horseData = {
                id: id as any,
                name: name as any,
                birthDate: birthDateValue as any,
                sex: sex as any,
                color: '' as any,
                father: father as any,
                mother: mother as any,
                trainer: trainer as any,
                owner: owner as any,
                breeder: breeder as any,
                earnings: earnings as any,
                currentRaceId: undefined,
              };
            } else {
              // 英語CSVの場合、血統登録番号からIDを生成
              const pedigreeNumber = values[headers.indexOf('pedigreeNumber')] || values[headers.indexOf('pedigree_number')] || '';
              if (!pedigreeNumber) {
                errors.push(`行 ${i + 1}: 血統登録番号が必要です`);
                continue;
              }
              
              horseData = {
                id: generateHorseId(pedigreeNumber),
                name: values[headers.indexOf('name')],
                birthDate: values[headers.indexOf('birthDate')] || values[headers.indexOf('birth_year')] || '',
                sex: values[headers.indexOf('sex')] as '牡' | '牝' | 'セ',
                color: values[headers.indexOf('color')],
                father: values[headers.indexOf('father')],
                mother: values[headers.indexOf('mother')],
                trainer: values[headers.indexOf('trainer')],
                owner: values[headers.indexOf('owner')],
                breeder: values[headers.indexOf('breeder')],
                earnings: parseFloat(values[headers.indexOf('earnings')] || '0'),
                currentRaceId: headers.includes('currentRaceId') ? values[headers.indexOf('currentRaceId')] || undefined : undefined,
              };
            }

            if (!isJapaneseCsv) {
              if (!['牡', '牝', 'セ'].includes(horseData.sex)) {
                errors.push(`行 ${i + 1}: 性別は「牡」「牝」「セ」のいずれかである必要があります`);
              }
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
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    try {
      const adminService = createAdminService(true); // APIモードで呼び出し
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
            必須項目: id, name, birthYear, sex, color, father, mother, trainer, owner, breeder, earnings
            <br />
            オプション項目: currentRaceId（現在出走予定のレースID）
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
                        <TableCell>{horse.birthDate}</TableCell>
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