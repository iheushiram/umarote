// web/src/components/moisture/MoistureRaceFilters.tsx
// 含水率レース成績ページ用の絞り込みフォームを表示します。
// ページ本体からUIロジックを切り出してコード量を抑えるために存在します。
// RELEVANT FILES:web/src/pages/MoistureRacePerformancePage.tsx,web/src/components/moisture/MoistureRaceTable.tsx,web/src/services/horseService.ts,web/src/types/moisture.ts

import React from 'react';
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  type SelectChangeEvent,
} from '@mui/material';

export type DraftRaceFilters = {
  surface: 'all' | 'turf' | 'dirt';
  metric: 'goal' | 'corner';
  venue: string;
  distance: string;
  from: string;
  to: string;
  limit: string;
  top: string;
};

type MoistureRaceFiltersProps = {
  draft: DraftRaceFilters;
  onDraftChange: <Key extends keyof DraftRaceFilters>(key: Key, value: DraftRaceFilters[Key]) => void;
  onApply: () => void;
  onReset: () => void;
};

const MoistureRaceFilters: React.FC<MoistureRaceFiltersProps> = ({
  draft,
  onDraftChange,
  onApply,
  onReset,
}) => {
  // SelectとTextFieldからの入力をシンプルに親へ伝播させる小さなヘルパーです。
  const handleSelectChange =
    <Key extends 'surface' | 'metric'>(key: Key) =>
    (event: SelectChangeEvent<DraftRaceFilters[Key]>) => {
      onDraftChange(key, event.target.value as DraftRaceFilters[Key]);
    };

  const handleTextChange =
    <Key extends Exclude<keyof DraftRaceFilters, 'surface' | 'metric'>>(key: Key) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onDraftChange(key, event.target.value as DraftRaceFilters[Key]);
    };

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={2}>
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="surface-label">馬場</InputLabel>
        <Select
          labelId="surface-label"
          value={draft.surface}
          label="馬場"
          onChange={handleSelectChange('surface')}
        >
          <MenuItem value="all">全て</MenuItem>
          <MenuItem value="turf">芝</MenuItem>
          <MenuItem value="dirt">ダート</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="metric-label">含水率指標</InputLabel>
        <Select
          labelId="metric-label"
          value={draft.metric}
          label="含水率指標"
          onChange={handleSelectChange('metric')}
        >
          <MenuItem value="goal">ゴール前</MenuItem>
          <MenuItem value="corner">4コーナー</MenuItem>
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="競馬場"
        value={draft.venue}
        onChange={handleTextChange('venue')}
        sx={{ minWidth: 200 }}
      />

      <TextField
        size="small"
        label="距離 (m)"
        type="number"
        value={draft.distance}
        onChange={handleTextChange('distance')}
        sx={{ minWidth: 140 }}
      />

      <TextField
        size="small"
        label="開始日"
        type="date"
        value={draft.from}
        onChange={handleTextChange('from')}
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        size="small"
        label="終了日"
        type="date"
        value={draft.to}
        onChange={handleTextChange('to')}
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        size="small"
        label="取得件数"
        type="number"
        value={draft.limit}
        onChange={handleTextChange('limit')}
        sx={{ minWidth: 120 }}
      />

      <TextField
        size="small"
        label="上位着順"
        type="number"
        value={draft.top}
        onChange={handleTextChange('top')}
        sx={{ minWidth: 120 }}
      />

      <Stack direction="row" spacing={1} alignItems="flex-end">
        <Button variant="contained" onClick={onApply}>
          絞り込み反映
        </Button>
        <Button variant="text" onClick={onReset}>
          リセット
        </Button>
      </Stack>
    </Stack>
  );
};

export default MoistureRaceFilters;

