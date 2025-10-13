// web/src/components/moisture/MoistureOutcomeSummary.tsx
// 含水率アウトカムの集計表とサンプルレース一覧を描画します。
// ページ本体から表示処理を切り離し、可読性と再利用性を高めるために存在します。
// RELEVANT FILES:web/src/pages/MoisturePerformancePage.tsx,web/src/types/moisture.ts,web/src/components/moisture/MoistureOutcomeFilters.tsx,web/src/components/moisture/MoistureRaceTable.tsx

import React from 'react';
import {
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { MoistureOutcomeBucket, MoistureSample } from '../../types/moisture';

type MoistureOutcomeSummaryProps = {
  buckets: MoistureOutcomeBucket[];
  samples: Array<{ bucket: MoistureOutcomeBucket; sample: MoistureSample }>;
};

const toPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

const formatMoistureRange = (bucket: MoistureOutcomeBucket): string => {
  const { min, max, average } = bucket.moistureRange;
  const minLabel = min.toFixed(1);
  const maxLabel = max.toFixed(1);
  if (average === null) {
    return `${minLabel} - ${maxLabel}%`;
  }
  return `${minLabel} - ${maxLabel}% (平均 ${average.toFixed(1)}%)`;
};

const MoistureOutcomeSummary: React.FC<MoistureOutcomeSummaryProps> = ({ buckets, samples }) => {
  // 表示用の断片をまとめて返すだけの純粋なプレゼンテーション層です。
  return (
    <Paper variant="outlined" sx={{ p: 3, overflowX: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        含水率別指標
      </Typography>
      {buckets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          条件に一致するデータがありませんでした。
        </Typography>
      ) : (
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell>含水率レンジ (%)</TableCell>
              <TableCell align="right">レース数</TableCell>
              <TableCell align="right">出走頭数</TableCell>
              <TableCell align="right">勝率</TableCell>
              <TableCell align="right">複勝率</TableCell>
              <TableCell align="right">平均着順</TableCell>
              <TableCell align="right">平均オッズ</TableCell>
              <TableCell align="right">勝ち時計</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {buckets.map((bucket) => (
              <TableRow key={`${bucket.moistureRange.min}-${bucket.moistureRange.max}`}>
                <TableCell>{formatMoistureRange(bucket)}</TableCell>
                <TableCell align="right">{bucket.raceCount}</TableCell>
                <TableCell align="right">{bucket.runnerCount}</TableCell>
                <TableCell align="right">{toPercent(bucket.winRate)}</TableCell>
                <TableCell align="right">{toPercent(bucket.top3Rate)}</TableCell>
                <TableCell align="right">
                  {bucket.averageFinish ? bucket.averageFinish.toFixed(2) : '-'}
                </TableCell>
                <TableCell align="right">
                  {bucket.averageOdds ? bucket.averageOdds.toFixed(2) : '-'}
                </TableCell>
                <TableCell align="right">{bucket.averageWinningTime ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        サンプルレース
      </Typography>
      {samples.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          見本のレースはまだありません。
        </Typography>
      ) : (
        <Stack spacing={1}>
          {samples.map(({ bucket, sample }) => (
            <Paper
              key={`${sample.raceId}-${sample.horseName}`}
              variant="outlined"
              sx={{
                p: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {sample.date} {sample.venue} {sample.raceName}
              </Typography>
              <Typography variant="body2">
                {sample.horseName} / 着順 {sample.finishPosition ?? '-'} / 含水率{' '}
                {sample.moisture.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                レンジ {bucket.moistureRange.min.toFixed(1)} - {bucket.moistureRange.max.toFixed(1)}%
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
};

export default MoistureOutcomeSummary;

