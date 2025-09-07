import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Button
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { formatRaceTime, calculateAverageSpeed } from '../utils/timeUtils';
import type { RaceEntryData, RaceResultData, RaceData } from '../services/adminService';
import { AdminService } from '../services/adminService';

type Row = {
  pos: number; // 着順
  frame?: number;
  num?: number;
  name: string; // 馬名
  carried: number; // 斤量
  jockey: string;
  time: string | number; // 数値 or 文字列（例: 1275 or '1275'）
  distance: number; // 距離（メートル）
  diff?: string; // 着差
  pass?: string; // 通過
  last3F?: string; // 上り
  odds?: number;
  pop?: number; // 人気
};

export default function RaceResultsPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [raceInfo, setRaceInfo] = useState<RaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const svc = new AdminService();
    let mounted = true;
    async function load() {
      if (!raceId) return;
      setLoading(true);
      setError(null);
      try {
        const [race, results, entries] = await Promise.all<[
          Promise<RaceData | null>,
          Promise<RaceResultData[]>,
          Promise<RaceEntryData[]>
        ]>([
          svc.getRace(raceId),
          svc.getRaceResults(raceId),
          svc.getRaceEntries(raceId)
        ]);

        if (!mounted) return;

        setRaceInfo(race);

        // エントリー情報をマップ化（馬ID → 枠/馬番/馬名）
        const entryMap = new Map<string, RaceEntryData>();
        (entries || []).forEach(e => entryMap.set(e.horseId, e));

        // 通過順の整形（常に 1C-2C-3C-4C の4区切り）。
        // ルール: pos1c..pos4c のいずれかが存在する場合はそれを優先して連結。
        //       全て欠損のときのみ cornerPassings を4要素にパディングして使用。
        const formatPassing = (r: RaceResultData) => {
          const vals = [r.pos1c, r.pos2c, r.pos3c, r.pos4c].map((v) =>
            v === undefined || v === null ? '' : String(v)
          );
          const anyPos = vals.some((v) => v !== '');
          if (anyPos) {
            return vals.join('-');
          }
          const cp = (r as any).cornerPassings as string | undefined;
          if (cp && cp.trim() !== '') {
            const parts = cp.split('-');
            while (parts.length < 4) parts.push('');
            return parts.slice(0, 4).join('-');
          }
          return '';
        };

        const vm: Row[] = (results || [])
          .sort((a, b) => {
            const A = a.finishPosition ?? 9999;
            const B = b.finishPosition ?? 9999;
            return A - B;
          })
          .map((r) => {
            const ent = entryMap.get(r.horseId);
            return {
              pos: r.finishPosition ?? 0,
              frame: ent?.frameNo,
              num: ent?.horseNo,
              name: (ent as any)?.horseName || ent?.horse?.name || r.horseId,
              carried: r.weight,
              jockey: r.jockey,
              time: r.time,
              distance: r.distance,
              diff: r.margin,
              pass: formatPassing(r),
              last3F: r.lastThreeFurlong,
              odds: r.odds,
              pop: r.popularity,
            };
          });

        setRows(vm);
      } catch (e: any) {
        console.error(e);
        setError('レース結果の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [raceId]);

  const posChip = (pos: number) => {
    const top = pos >= 1 && pos <= 3 ? pos : 0;
    const map: Record<number, { bg: string; color?: string; label: string }> = {
      1: { bg: '#16a34a', label: '1' },
      2: { bg: '#2563eb', label: '2' },
      3: { bg: '#64748b', label: '3' },
      0: { bg: '#e5e7eb', color: '#111827', label: '–' },
    };
    const s = map[top];
    return (
      <Box sx={{ display: 'inline-grid', placeItems: 'center', minWidth: 28, height: 24, borderRadius: 1.5, bgcolor: s.bg, color: s.color || '#fff', fontWeight: 800 }}>
        {s.label}
      </Box>
    );
  };

  return (
    <Box sx={{ pb: 4, mx: 'auto', px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate(-1)} variant="outlined" size="small">
          戻る
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          レース結果{raceInfo ? `（${raceInfo.raceName} / ${raceInfo.venue} ${raceInfo.surface}${raceInfo.distance}m）` : ''}
        </Typography>
      </Stack>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small" stickyHeader aria-label="race results table" sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>着順</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>枠</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>馬番</TableCell>
              <TableCell sx={{ textAlign: 'left', whiteSpace: 'nowrap', minWidth: 180 }}>馬名</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>斤量</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>騎手</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>タイム</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>平均速度</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>着差</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>通過(1C-2C-3C-4C)</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>上り</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>単勝</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>人気</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={13}>
                  <Typography variant="body2" color="text.secondary">読み込み中…</Typography>
                </TableCell>
              </TableRow>
            )}
            {error && !loading && (
              <TableRow>
                <TableCell colSpan={13}>
                  <Typography variant="body2" color="error.main">{error}</Typography>
                </TableCell>
              </TableRow>
            )}
            {!loading && !error && rows.map((r, i) => {
              const averageSpeed = calculateAverageSpeed(r.distance, r.time);
              return (
                <TableRow key={i}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{posChip(r.pos)}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.frame ?? '-'}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.num ?? '-'}</TableCell>
                  <TableCell sx={{ textAlign: 'left', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.carried}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.jockey}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatRaceTime(r.time)}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {averageSpeed > 0 ? `${averageSpeed} km/h` : '-'}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.diff || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.pass || '-'}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.last3F || '-'}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {typeof r.odds === 'number' && r.odds > 0 ? r.odds.toFixed(1) : '-'}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.pop ?? '-'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
