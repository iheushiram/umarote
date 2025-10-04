import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Save } from 'lucide-react';
import { createAdminService } from '../../services/adminService';

const VENUE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '札幌競馬場', label: '札幌競馬場' },
  { value: '函館競馬場', label: '函館競馬場' },
  { value: '福島競馬場', label: '福島競馬場' },
  { value: '新潟競馬場', label: '新潟競馬場' },
  { value: '東京競馬場', label: '東京競馬場' },
  { value: '中山競馬場', label: '中山競馬場' },
  { value: '中京競馬場', label: '中京競馬場' },
  { value: '京都競馬場', label: '京都競馬場' },
  { value: '阪神競馬場', label: '阪神競馬場' },
  { value: '小倉競馬場', label: '小倉競馬場' },
];

const weekdayFromDate = (dateIso: string): string => {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '';
  // CSV形式と揃えるため英語3文字表記に統一
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const formatMeetingLabel = (meeting: number): string => `第${meeting}回`;

const toFixedOrEmpty = (value: string): string => {
  if (!value.trim()) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return num.toFixed(1);
};

const validateInputs = (inputs: TrackConditionFormState): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!inputs.venue) errors.venue = '競馬場を選択してください';

  const meetingNum = Number(inputs.meeting);
  if (!inputs.meeting) {
    errors.meeting = '開催回数を入力してください';
  } else if (!Number.isInteger(meetingNum) || meetingNum < 1 || meetingNum > 12) {
    errors.meeting = '1〜12の整数で入力してください';
  }

  if (!inputs.date) {
    errors.date = '日付を入力してください';
  } else if (!weekdayFromDate(inputs.date)) {
    errors.date = '日付形式が正しくありません';
  }

  if (!inputs.cushionValue) {
    errors.cushionValue = 'クッション値を入力してください';
  } else {
    const cushionNum = Number(inputs.cushionValue);
    if (!Number.isFinite(cushionNum)) {
      errors.cushionValue = '数値で入力してください';
    } else if (cushionNum < 4 || cushionNum > 13) {
      errors.cushionValue = '4.0〜13.0の範囲で入力してください';
    }
  }

  const checkOptionalPercent = (key: keyof Pick<TrackConditionFormState, 'turfGoal' | 'turfCorner' | 'dirtGoal' | 'dirtCorner'>) => {
    const value = inputs[key];
    if (!value) return;
    const num = Number(value);
    if (!Number.isFinite(num)) {
      errors[key] = '数値で入力してください';
    }
  };

  checkOptionalPercent('turfGoal');
  checkOptionalPercent('turfCorner');
  checkOptionalPercent('dirtGoal');
  checkOptionalPercent('dirtCorner');

  return errors;
};

interface TrackConditionFormState {
  venue: string;
  meeting: string;
  date: string;
  turfGoal: string;
  turfCorner: string;
  dirtGoal: string;
  dirtCorner: string;
  cushionValue: string;
}

const initialState: TrackConditionFormState = {
  venue: '',
  meeting: '',
  date: '',
  turfGoal: '',
  turfCorner: '',
  dirtGoal: '',
  dirtCorner: '',
  cushionValue: '',
};

export default function TrackConditionManualForm() {
  const [form, setForm] = useState<TrackConditionFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const adminService = useMemo(() => createAdminService(true), []);

  const weekday = weekdayFromDate(form.date);

  const handleChange = (field: keyof TrackConditionFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: event.target.value }));
      setErrors(prev => ({ ...prev, [field]: '' }));
      setSubmitError(null);
    };

  const handleSelectChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, venue: event.target.value }));
    setErrors(prev => ({ ...prev, venue: '' }));
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSuccessMessage(null);
    setSubmitError(null);

    const validation = validateInputs(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    const meetingNum = Number(form.meeting);
    const payload = {
      venue: form.venue,
      meeting: formatMeetingLabel(meetingNum),
      date: form.date,
      weekday: weekday || '',
      turf_goal_percent: toFixedOrEmpty(form.turfGoal),
      turf_corner_percent: toFixedOrEmpty(form.turfCorner),
      dirt_goal_percent: toFixedOrEmpty(form.dirtGoal),
      dirt_corner_percent: toFixedOrEmpty(form.dirtCorner),
      cushion_value: toFixedOrEmpty(form.cushionValue),
    };

    setLoading(true);
    try {
      await adminService.insertTrackConditionDailySummaries([payload], 'manual-ui');
      setSuccessMessage(`${form.date} ${form.venue} のクッション値を登録しました`);
      setForm(prev => ({
        ...prev,
        turfGoal: '',
        turfCorner: '',
        dirtGoal: '',
        dirtCorner: '',
        cushionValue: '',
      }));
    } catch (error) {
      console.error('Failed to insert track condition summary:', error);
      setSubmitError(error instanceof Error ? error.message : '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ mt: 4 }}>
      <CardHeader
        title={<Typography variant="h6">馬場サマリー手動入力</Typography>}
        subheader="CSVを使わずに日次のクッション値・含水率を登録できます"
      />
      <CardContent>
        <Box component="form" noValidate onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="競馬場"
                  value={form.venue}
                  onChange={handleSelectChange}
                  fullWidth
                  required
                  error={Boolean(errors.venue)}
                  helperText={errors.venue || ' '}
                >
                  {VENUE_OPTIONS.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}>
                <TextField
                  label="開催回"
                  type="number"
                  inputProps={{ min: 1, max: 12, step: 1 }}
                  value={form.meeting}
                  onChange={handleChange('meeting')}
                  fullWidth
                  required
                  error={Boolean(errors.meeting)}
                  helperText={errors.meeting || '1〜12'}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="日付"
                  type="date"
                  value={form.date}
                  onChange={handleChange('date')}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  required
                  error={Boolean(errors.date)}
                  helperText={errors.date || ' '}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="曜日"
                  value={weekday}
                  InputProps={{ readOnly: true }}
                  fullWidth
                  helperText="日付から自動計算"
                />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary">
              芝・ダート含水率（パーセント）
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <TextField
                  label="芝 ゴール前 (%)"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={form.turfGoal}
                  onChange={handleChange('turfGoal')}
                  fullWidth
                  error={Boolean(errors.turfGoal)}
                  helperText={errors.turfGoal || '任意入力'}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="芝 4コーナー (%)"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={form.turfCorner}
                  onChange={handleChange('turfCorner')}
                  fullWidth
                  error={Boolean(errors.turfCorner)}
                  helperText={errors.turfCorner || '任意入力'}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="ダート ゴール前 (%)"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={form.dirtGoal}
                  onChange={handleChange('dirtGoal')}
                  fullWidth
                  error={Boolean(errors.dirtGoal)}
                  helperText={errors.dirtGoal || '任意入力'}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  label="ダート 4コーナー (%)"
                  type="number"
                  inputProps={{ step: 0.1 }}
                  value={form.dirtCorner}
                  onChange={handleChange('dirtCorner')}
                  fullWidth
                  error={Boolean(errors.dirtCorner)}
                  helperText={errors.dirtCorner || '任意入力'}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  label="クッション値"
                  type="number"
                  inputProps={{ step: 0.1, min: 4, max: 13 }}
                  value={form.cushionValue}
                  onChange={handleChange('cushionValue')}
                  fullWidth
                  required
                  error={Boolean(errors.cushionValue)}
                  helperText={errors.cushionValue || '4.0〜13.0'}
                />
              </Grid>
            </Grid>

            {submitError && (
              <Alert severity="error">{submitError}</Alert>
            )}
            {successMessage && (
              <Alert severity="success">{successMessage}</Alert>
            )}

            <Box>
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={loading}
                startIcon={<Save size={16} />}
              >
                {loading ? '登録中...' : '登録する'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

