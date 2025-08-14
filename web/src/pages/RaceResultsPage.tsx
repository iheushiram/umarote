import { useMemo } from 'react';
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

type Row = {
  pos: number;
  frame: number;
  num: number;
  name: string;
  sexAge: string;
  carried: number; // 斤量
  jockey: string;
  time: string;
  diff: string;
  pass: string;
  last3F: string;
  odds: number;
  pop: number; // 人気
  body: string; // 体重(+増減)
  trainer: string;
  owner: string;
  prize: number; // 万円
};

const MOCK_RESULTS: Record<string, Row[]> = {
  default: [
    {pos:1, frame:6, num:6, name:'コトリノサエズリ', sexAge:'牡3', carried:55, jockey:'田口貫太', time:'1:27.5', diff:'',   pass:'3-2-1', last3F:'38.2', odds:1.6,  pop:1, body:'468(+2)', trainer:'吉田勝利', owner:'吉田勝利', prize:70.0},
    {pos:2, frame:3, num:3, name:'インビッシュ',     sexAge:'牡3', carried:55, jockey:'西塚洸二', time:'1:27.8', diff:'0.1', pass:'5-3-2', last3F:'38.3', odds:8.4,  pop:3, body:'471(+7)', trainer:'小林真也', owner:'(株)ノルマンディ', prize:28.0},
    {pos:3, frame:5, num:5, name:'フェアリアルギフト', sexAge:'牡3', carried:55, jockey:'岡部誠',   time:'1:28.1', diff:'0.6', pass:'4-4-3', last3F:'38.6', odds:10.8, pop:4, body:'400(0)',   trainer:'緒方努',   owner:'谷嶋泰吾',     prize:17.5},
    {pos:4, frame:7, num:7, name:'ルルーディ',       sexAge:'牡3', carried:55, jockey:'城戸義政', time:'1:28.9', diff:'1.4', pass:'8-6-4', last3F:'39.8', odds:36.6, pop:6, body:'452(0)',   trainer:'宮地謙祐', owner:'吉野功寿代',   prize:10.5},
    {pos:5, frame:4, num:4, name:'ラーンノヴァイン', sexAge:'牡3', carried:55, jockey:'藤原幹生', time:'1:29.2', diff:'1.7', pass:'2-1-2', last3F:'40.2', odds:9.4,  pop:2, body:'490(+8)', trainer:'大野貴義', owner:'伊藤達',       prize:7.0},
    {pos:6, frame:1, num:1, name:'オールザマタイム', sexAge:'牡3', carried:53, jockey:'枝本一城', time:'1:29.8', diff:'2.3', pass:'6-7-7', last3F:'40.7', odds:26.2, pop:7, body:'482(+3)', trainer:'加藤義章', owner:'同川秀守',     prize:5.0},
    {pos:7, frame:1, num:2, name:'アイズグレッソ',   sexAge:'牡3', carried:55, jockey:'渡辺竜也', time:'1:31.1', diff:'3.6', pass:'9-9-8', last3F:'41.8', odds:34.8, pop:5, body:'479(+2)', trainer:'鈴木慎太', owner:'(株)ノルマンディ', prize:4.0},
    {pos:8, frame:2, num:8, name:'ユズモフィネス',   sexAge:'牡3', carried:53, jockey:'深澤杏花', time:'1:35.3', diff:'大',  pass:'7-8-9', last3F:'—',   odds:48.2, pop:9, body:'436(+1)', trainer:'柴田高志', owner:'小橋亮太',     prize:0.0},
  ],
};

export default function RaceResultsPage() {
  const { raceId } = useParams<{ raceId: string }>();
  const navigate = useNavigate();

  const rows = useMemo(() => {
    // raceId毎のデータ拡張は必要に応じて
    return MOCK_RESULTS.default;
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
    <Box sx={{ pb: 4, maxWidth: 1100, mx: 'auto', px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate(-1)} variant="outlined" size="small">
          戻る
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>レース結果</Typography>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small" stickyHeader aria-label="race results table">
          <TableHead>
            <TableRow>
              <TableCell>着順</TableCell>
              <TableCell>枠</TableCell>
              <TableCell>馬番</TableCell>
              <TableCell sx={{ textAlign: 'left' }}>馬名</TableCell>
              <TableCell>性齢</TableCell>
              <TableCell>斤量</TableCell>
              <TableCell>騎手</TableCell>
              <TableCell>タイム</TableCell>
              <TableCell>着差</TableCell>
              <TableCell>通過</TableCell>
              <TableCell>上り</TableCell>
              <TableCell>単勝</TableCell>
              <TableCell>人気</TableCell>
              <TableCell>馬体重</TableCell>
              <TableCell>調教師</TableCell>
              <TableCell>馬主</TableCell>
              <TableCell>賞金(万円)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{posChip(r.pos)}</TableCell>
                <TableCell>{r.frame}</TableCell>
                <TableCell>{r.num}</TableCell>
                <TableCell sx={{ textAlign: 'left' }}>{r.name}</TableCell>
                <TableCell>{r.sexAge}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.carried}</TableCell>
                <TableCell>{r.jockey}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.time}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.diff}</TableCell>
                <TableCell>{r.pass}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.last3F}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.odds}</TableCell>
                <TableCell>{r.pop}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.body}</TableCell>
                <TableCell>{r.trainer}</TableCell>
                <TableCell>{r.owner}</TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{r.prize.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

