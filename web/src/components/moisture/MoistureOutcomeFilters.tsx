// web/src/components/moisture/MoistureOutcomeFilters.tsx
// 含水率アウトカム分析ページ用の絞り込みフォームを構成します。
// ページ本体の行数と責務を抑え、状態管理に集中させるために存在します。
// RELEVANT FILES:web/src/pages/MoisturePerformancePage.tsx,web/src/services/horseService.ts,web/src/types/moisture.ts,web/src/components/moisture/MoistureOutcomeSummary.tsx

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

export type DraftFilters = {
  surface: 'all' | 'turf' | 'dirt';
  metric: 'goal' | 'corner';
  focus: 'all' | 'winners' | 'top3';
  venue: string;
  distance: string;
  from: string;
  to: string;
  bucket: string;
  limit: string;
};

type MoistureOutcomeFiltersProps = {
  draft: DraftFilters;
  onDraftChange: <Key extends keyof DraftFilters>(key: Key, value: DraftFilters[Key]) => void;
  onApply: () => void;
};

const MoistureOutcomeFilters: React.FC<MoistureOutcomeFiltersProps> = ({
  draft,
  onDraftChange,
  onApply,
}) => {
  // selectとtextの処理を最小限で親へ伝える小さなヘルパーです。
  const handleSelect =
    <Key extends 'surface' | 'metric' | 'focus'>(key: Key) =>
    (event: SelectChangeEvent<DraftFilters[Key]>) => {
      onDraftChange(key, event.target.value as DraftFilters[Key]);
    };

  const handleText =
    <Key extends Exclude<keyof DraftFilters, 'surface' | 'metric' | 'focus'>>(key: Key) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onDraftChange(key, event.target.value as DraftFilters[Key]);
    };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="surface-label">コース</InputLabel>
        <Select
          labelId="surface-label"
          label="コース"
          value={draft.surface}
          onChange={handleSelect('surface')}
        >
          <MenuItem value="all">芝＋ダート</MenuItem>
          <MenuItem value="turf">芝のみ</MenuItem>
          <MenuItem value="dirt">ダートのみ</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="metric-label">参照位置</InputLabel>
        <Select
          labelId="metric-label"
          label="参照位置"
          value={draft.metric}
          onChange={handleSelect('metric')}
        >
          <MenuItem value="goal">ゴール前含水率</MenuItem>
          <MenuItem value="corner">4コーナー含水率</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 160 }}>
        <InputLabel id="focus-label">対象</InputLabel>
        <Select
          labelId="focus-label"
          label="対象"
          value={draft.focus}
          onChange={handleSelect('focus')}
        >
          <MenuItem value="all">全出走</MenuItem>
          <MenuItem value="winners">勝ち馬のみ</MenuItem>
          <MenuItem value="top3">3着以内</MenuItem>
        </Select>
      </FormControl>

      <TextField
        size="small"
        label="開催場"
        value={draft.venue}
        onChange={handleText('venue')}
        placeholder="例: 東京競馬場"
        sx={{ minWidth: 200 }}
      />

      <TextField
        size="small"
        label="距離 (m)"
        type="number"
        value={draft.distance}
        onChange={handleText('distance')}
        sx={{ minWidth: 140 }}
      />

      <TextField
        size="small"
        label="開始日"
        type="date"
        value={draft.from}
        onChange={handleText('from')}
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        size="small"
        label="終了日"
        type="date"
        value={draft.to}
        onChange={handleText('to')}
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        size="small"
        label="含水率ビン幅"
        type="number"
        value={draft.bucket}
        onChange={handleText('bucket')}
        sx={{ minWidth: 140 }}
      />

      <TextField
        size="small"
        label="最大取得件数"
        type="number"
        value={draft.limit}
        onChange={handleText('limit')}
        sx={{ minWidth: 160 }}
      />

      <Button variant="contained" onClick={onApply} sx={{ alignSelf: { xs: 'stretch', md: 'flex-end' } }}>
        絞り込み反映
      </Button>
    </Stack>
  );
};

export default MoistureOutcomeFilters;

