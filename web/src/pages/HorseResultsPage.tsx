import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button
} from '@mui/material';
import { ArrowLeft } from 'lucide-react';

type TrackFilter = 'すべて' | '良' | '稍重' | '重' | '不良';

interface ResultRow {
  date: string;
  place: string;     // 開催
  race: string;      // レース名
  dist: string;      // 距離（例: 芝1600 / ダ1400）
  track: TrackFilter; // 馬場
  rank: number;      // 着順
  pop: number;       // 人気
  odds: number;      // オッズ
  pass: string;      // 通過
  last3F: string;    // 上り
  weight: number;    // 斤量
  body: number;      // 馬体重
}

const MOCK_RESULTS: Record<string, ResultRow[]> = {
  H001: [
    {date:'2025/08/10', place:'中京', race:'5歳未勝利', dist:'ダ1400', track:'良', rank:1, pop:2, odds:3.8, pass:'2-2', last3F:'36.5', weight:56.0, body:480},
    {date:'2025/06/01', place:'東京', race:'OP', dist:'芝1600', track:'稍重', rank:3, pop:4, odds:9.4, pass:'3-3', last3F:'34.6', weight:57.0, body:482},
    {date:'2025/05/18', place:'京都', race:'G3', dist:'ダ1400', track:'重', rank:5, pop:6, odds:18.2, pass:'8-7', last3F:'37.9', weight:57.0, body:478},
  ],
  H002: [
    {date:'2025/12/28', place:'中山', race:'G1', dist:'芝2000', track:'良', rank:2, pop:1, odds:2.1, pass:'12-10-6', last3F:'33.8', weight:55.0, body:520},
    {date:'2025/10/30', place:'京都', race:'G1', dist:'芝3000', track:'不良', rank:1, pop:1, odds:1.8, pass:'4-3-2', last3F:'36.9', weight:56.0, body:522},
  ],
};

// フォールバック（design.mdの例を流用）
const DEFAULT_RESULTS: ResultRow[] = [
  {date:'2025/08/10', place:'中京', race:'5歳未勝利', dist:'ダ1400', track:'良', rank:16, pop:12, odds:266.2, pass:'16-16', last3F:'39.7', weight:52, body:444},
  {date:'2025/06/01', place:'東京', race:'5歳未勝利', dist:'芝1600', track:'良', rank:14, pop:9, odds:73.8, pass:'2-2', last3F:'37.1', weight:55, body:486},
  {date:'2025/05/18', place:'京都', race:'5歳未勝利', dist:'ダ1400', track:'重', rank:16, pop:15, odds:214.0, pass:'16-16', last3F:'44.0', weight:53, body:440},
];

export default function HorseResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<TrackFilter>('すべて');

  const rows = useMemo(() => {
    const list = (id && MOCK_RESULTS[id]) || DEFAULT_RESULTS;
    return list.filter(r => filter === 'すべて' || r.track === filter);
  }, [id, filter]);

  const filters: TrackFilter[] = ['すべて','良','稍重','重','不良'];

  return (
    <Box sx={{ pb: 4, maxWidth: 1100, mx: 'auto', px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate(-1)} variant="outlined" size="small">
          戻る
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>馬の個別レース結果</Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <Chip
            key={f}
            label={f}
            clickable
            color={filter === f ? 'primary' : 'default'}
            variant={filter === f ? 'filled' : 'outlined'}
            onClick={() => setFilter(f)}
            size="small"
          />
        ))}
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small" aria-label="horse results table">
          <TableHead>
            <TableRow>
              <TableCell>日付</TableCell>
              <TableCell>開催</TableCell>
              <TableCell>レース名</TableCell>
              <TableCell>距離</TableCell>
              <TableCell>馬場</TableCell>
              <TableCell>着順</TableCell>
              <TableCell>人気</TableCell>
              <TableCell>オッズ</TableCell>
              <TableCell>通過</TableCell>
              <TableCell>上り</TableCell>
              <TableCell>斤量</TableCell>
              <TableCell>馬体重</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={idx}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.place}</TableCell>
                <TableCell>{r.race}</TableCell>
                <TableCell>{r.dist}</TableCell>
                <TableCell>{r.track}</TableCell>
                <TableCell>{r.rank}</TableCell>
                <TableCell>{r.pop}</TableCell>
                <TableCell>{r.odds}</TableCell>
                <TableCell>{r.pass}</TableCell>
                <TableCell>{r.last3F}</TableCell>
                <TableCell>{r.weight}</TableCell>
                <TableCell>{r.body}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

