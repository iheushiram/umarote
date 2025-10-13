// web/src/components/moisture/MoistureRaceTable.tsx
// 含水率レース成績の結果テーブルを描画します。
// ページ本体の責務を減らしつつUIの見通しを良くするために存在します。
// RELEVANT FILES:web/src/pages/MoistureRacePerformancePage.tsx,web/src/components/moisture/MoistureRaceFilters.tsx,web/src/services/horseService.ts,web/src/types/moisture.ts

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
import type { MoistureRaceFinisher, MoistureRacePerformanceResponse } from '../../types/moisture';

type MoistureRaceTableProps = {
  data: MoistureRacePerformanceResponse;
};

const formatSurface = (surface: 'turf' | 'dirt'): string => (surface === 'turf' ? '芝' : 'ダート');

const formatFinishers = (finishers: MoistureRaceFinisher[]): React.ReactNode => {
  if (finishers.length === 0) return '-';

  return (
    <Stack spacing={0.5}>
      {finishers.map((finisher) => {
        const oddsLabel = finisher.odds !== null ? `${finisher.odds.toFixed(1)}倍` : '-';
        const popLabel = finisher.popularity !== null ? `${finisher.popularity}番人気` : '-';
        const timeLabel = finisher.time ?? '-';

        return (
          <Typography key={`${finisher.horseId}-${finisher.finishPosition}`} variant="body2">
            {`${finisher.finishPosition}着 ${finisher.horseName} / ${timeLabel} / ${oddsLabel} / ${popLabel}`}
          </Typography>
        );
      })}
    </Stack>
  );
};

const MoistureRaceTable: React.FC<MoistureRaceTableProps> = ({ data }) => {
  // テーブル描画に専念してコード密度を下げています。
  return (
    <Paper variant="outlined" sx={{ p: 3, overflowX: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">レース一覧</Typography>
        <Typography variant="body2" color="text.secondary">
          {`表示件数: ${data.total}`}
        </Typography>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>日付</TableCell>
            <TableCell>競馬場 / レース名</TableCell>
            <TableCell align="right">距離</TableCell>
            <TableCell align="right">馬場</TableCell>
            <TableCell align="right">含水率 (%)</TableCell>
            <TableCell align="right">馬場状態</TableCell>
            <TableCell align="right">出走頭数</TableCell>
            <TableCell align="right">平均着順</TableCell>
            <TableCell>上位成績</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.races.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center">
                条件に合致するレースが見つかりませんでした。
              </TableCell>
            </TableRow>
          ) : (
            data.races.map((race) => (
              <TableRow key={race.raceId} hover>
                <TableCell>{race.date}</TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {race.venue} {race.raceName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {race.className ?? '-'} / {race.trackCondition ?? '-'}
                  </Typography>
                </TableCell>
                <TableCell align="right">{race.distance ? `${race.distance}m` : '-'}</TableCell>
                <TableCell align="right">{formatSurface(race.surface)}</TableCell>
                <TableCell align="right">{race.moisture.toFixed(2)}</TableCell>
                <TableCell align="right">{race.trackCondition ?? '-'}</TableCell>
                <TableCell align="right">{race.runnerCount}</TableCell>
                <TableCell align="right">
                  {race.averageFinish ? race.averageFinish.toFixed(2) : '-'}
                </TableCell>
                <TableCell>{formatFinishers(race.topFinishers)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary">
        含水率はリクエスト時の指標に基づく値です。表示値は小数第2位まで丸めています。
      </Typography>
    </Paper>
  );
};

export default MoistureRaceTable;

