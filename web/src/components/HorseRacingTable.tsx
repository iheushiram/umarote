import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from "@mui/material";
import './race-cell.css';
import './horse-info.css';
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { HorseEntry } from '../types/horse';

export default function HorseRacingTable() {
  const { raceId } = useParams<{ raceId: string }>();
  const navigate = useNavigate();
  type CushionRange = 'none' | 'lte_7_9' | '8_0_8_9' | '9_0_9_9' | 'gte_10_0';
  const rangeLabels: Record<CushionRange, string> = {
    none: 'なし',
    lte_7_9: '～7.9',
    '8_0_8_9': '8.0–8.9',
    '9_0_9_9': '9.0–9.9',
    gte_10_0: '10.0～'
  };
  const [selectedRange, setSelectedRange] = useState<CushionRange>('9_0_9_9');

  const raceInfo = useMemo(() => ({
    raceId: raceId || '20250813-TOKYO-11',
    raceName: 'フェブラリーS(G1)',
    venue: '東京',
    distance: 1600,
    surface: 'ダート' as const,
    direction: '左',
    cushionValue: 9.4
  }), [raceId]);

  // サンプル馬データ（テーブル表示用）
  const sampleEntries: HorseEntry[] = [
    {
      horseId: 'H001',
      frameNo: 1,
      horseNo: 1,
      name: 'レモンポップ',
      sexAge: '牡4',
      weightCarried: 56.0,
      trainer: '池江泰郎',
      jockey: '武豊',
      stable: '栗東・○○厩舎',
      bodyWeight: { value: 480, diff: -4 },
      runningStyle: '先行',
      blood: {
        sire: 'ディープインパクト',
        dam: 'レモンティー',
        damsire: 'サンデーサイレンス'
      },
      odds: 3.2,
      popularity: 1,
      recentForm: [1, 2, 1, 3, 2],
      races: [
        {
          raceId: 'R001',
          date: '2024-12-29',
          track: '中山',
          distance: 2000,
          surface: 'ダート',
          going: '良',
          class: '東京大賞典(G1)',
          fieldSize: 16,
          barrier: 3,
          position: 1,
          time: '2:03.2',
          last3F: '37.8',
          passing: '4-3-2',
          jockey: '武豊',
          weightCarried: 57.0,
          margin: '1 1/4馬身',
          notes: '直線で力強く抜け出す',
          isFeature: true
        },
        {
          raceId: 'R002',
          date: '2024-11-03',
          track: '東京',
          distance: 1600,
          surface: 'ダート',
          going: '良',
          class: '武蔵野S(G3)',
          fieldSize: 16,
          barrier: 5,
          position: 2,
          time: '1:36.8',
          last3F: '37.2',
          passing: '8-6-4',
          jockey: '武豊',
          weightCarried: 56.0,
          margin: 'クビ',
          notes: '惜しい2着',
          isFeature: true
        }
      ],
      stats: { winRate: 0.30, place2Rate: 0.60, place3Rate: 0.80, n: 10 }
    },
    {
      horseId: 'H002',
      frameNo: 2,
      horseNo: 3,
      name: 'ゴールドシップ',
      sexAge: '牡5',
      weightCarried: 57.0,
      trainer: '友道康夫',
      jockey: '川田将雅',
      stable: '栗東・△△厩舎',
      bodyWeight: { value: 520, diff: +8 },
      runningStyle: '追込',
      blood: {
        sire: 'ステイゴールド',
        dam: 'ポイントフラッグ',
        damsire: 'マルゼンスキー'
      },
      odds: 4.5,
      popularity: 2,
      recentForm: [2, 1, 1, 5, 3],
      races: [
        {
          raceId: 'R003',
          date: '2024-12-28',
          track: '中山',
          distance: 2000,
          surface: '芝',
          going: '良',
          class: 'ホープフルS(G1)',
          fieldSize: 18,
          barrier: 7,
          position: 2,
          time: '1:59.8',
          last3F: '33.8',
          passing: '12-10-6',
          jockey: '川田将雅',
          weightCarried: 55.0,
          margin: 'ハナ',
          notes: '最後方から豪脚',
          isFeature: true
        }
      ],
      stats: { winRate: 0.25, place2Rate: 0.50, place3Rate: 0.75, n: 12 }
    }
  ];

  // モックのクッション値別成績（horseId -> range -> [1,2,3,other]）
  const cushionStats: Record<string, Record<CushionRange, [number, number, number, number]>> = {
    H001: {
      lte_7_9: [1, 0, 1, 2],
      '8_0_8_9': [2, 1, 0, 1],
      '9_0_9_9': [3, 2, 1, 0],
      gte_10_0: [1, 1, 0, 2]
    },
    H002: {
      lte_7_9: [0, 1, 0, 3],
      '8_0_8_9': [1, 1, 1, 1],
      '9_0_9_9': [2, 0, 1, 2],
      gte_10_0: [0, 0, 1, 3]
    }
  };

  // 周り方選択とモック成績
  type Turn = 'none' | 'left' | 'right';
  const turnLabels: Record<Turn, string> = { none: 'なし', left: '左回り', right: '右回り' };
  const [selectedTurn, setSelectedTurn] = useState<Turn>('left');
  const turnStats: Record<string, Record<Turn, [number, number, number, number]>> = {
    H001: {
      left: [4, 1, 0, 2],
      right: [2, 1, 2, 2]
    },
    H002: {
      left: [1, 2, 1, 3],
      right: [2, 0, 1, 2]
    }
  };

  return (
    <Box 
      sx={{ 
        pb: 4, maxWidth: '1536px', mx: 'auto', px: 3,
        '--framew': { xs: '44px', sm: '64px' },
        '--horsenow': { xs: '44px', sm: '64px' },
        '--namew': { xs: '140px', sm: '260px', md: '280px' },
        '--rcw': { xs: '136px', sm: '132px', md: '140px' },
        '--cellw': { xs: '144px', sm: '140px', md: '148px' }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/')} variant="outlined">
          トップに戻る
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {raceInfo.raceName}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {raceInfo.venue} {raceInfo.surface}{raceInfo.distance}m {raceInfo.direction}回り
            {raceInfo.surface === '芝' && ` クッション値:${raceInfo.cushionValue}`}
          </Typography>
        </Box>
      </Stack>

      {/* クッション値レンジ選択（チップボタン） */}
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        {(Object.keys(rangeLabels) as CushionRange[]).map((key) => (
          <Chip
            key={key}
            label={rangeLabels[key]}
            clickable
            color={selectedRange === key ? 'primary' : 'default'}
            variant={selectedRange === key ? 'filled' : 'outlined'}
            onClick={() => setSelectedRange(key)}
            size="small"
          />
        ))}
      </Stack>

      {/* 周り方選択（チップボタン） */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {(Object.keys(turnLabels) as Turn[]).map((t) => (
          <Chip
            key={t}
            label={turnLabels[t]}
            clickable
            color={selectedTurn === t ? 'primary' : 'default'}
            variant={selectedTurn === t ? 'filled' : 'outlined'}
            onClick={() => setSelectedTurn(t)}
            size="small"
          />
        ))}
      </Stack>

      <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" stickyHeader aria-label="race entries table" sx={{ minWidth: 900, '& td, & th': { px: { xs: 0.25, sm: 0.5 } } }}>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper', minWidth: 'var(--framew)', width: 'var(--framew)' }}>枠</TableCell>
              <TableCell align="center" sx={{ position: 'sticky', left: 'var(--framew)', zIndex: 3, bgcolor: 'background.paper', minWidth: 'var(--horsenow)', width: 'var(--horsenow)' }}>馬番</TableCell>
              <TableCell sx={{ position: { xs: 'static', sm: 'sticky' }, left: { sm: 'calc(var(--framew) + var(--horsenow))' }, zIndex: 3, bgcolor: 'background.paper', minWidth: 'var(--namew)', width: 'var(--namew)' }}>馬名</TableCell>
              <TableCell align="center">騎手</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 } }}>前走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 } }}>2走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 }, display: { xs: 'none', sm: 'table-cell' } }}>3走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 }, display: { xs: 'none', sm: 'none', md: 'table-cell' } }}>4走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 }, display: { xs: 'none', sm: 'none', md: 'table-cell' } }}>5走</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sampleEntries.map((h) => (
              <TableRow key={h.horseId}>
                <TableCell align="center" sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 'var(--framew)', width: 'var(--framew)' }}>
                  <Chip 
                    label={h.frameNo} 
                    size="small" 
                    sx={() => {
                      const base = { fontWeight: 700 } as const;
                      switch (h.frameNo) {
                        case 1: return { ...base, bgcolor: '#ffffff', color: '#111827', border: '1px solid #d1d5db' };
                        case 2: return { ...base, bgcolor: '#111827', color: '#ffffff' };
                        case 3: return { ...base, bgcolor: '#ef4444', color: '#ffffff' };
                        case 4: return { ...base, bgcolor: '#3b82f6', color: '#ffffff' };
                        case 5: return { ...base, bgcolor: '#f59e0b', color: '#111827' };
                        case 6: return { ...base, bgcolor: '#10b981', color: '#ffffff' };
                        case 7: return { ...base, bgcolor: '#f97316', color: '#ffffff' };
                        case 8: return { ...base, bgcolor: '#ec4899', color: '#ffffff' };
                        default: return base;
                      }
                    }}
                  />
                </TableCell>
                <TableCell align="center" sx={{ position: 'sticky', left: 'var(--framew)', zIndex: 2, bgcolor: 'background.paper', minWidth: 'var(--horsenow)', width: 'var(--horsenow)' }}>{h.horseNo}</TableCell>
                <TableCell sx={{ position: { xs: 'static', sm: 'sticky' }, left: { sm: 'calc(var(--framew) + var(--horsenow))' }, zIndex: 2, bgcolor: 'background.paper', minWidth: 'var(--namew)', width: 'var(--namew)' }}>
                  <div className="horse-info">
                    <div className="horse-info__blood">
                      <div className="horse-info__sire">{h.blood.sire}</div>
                      <div className="horse-info__name">
                        <a onClick={() => navigate(`/horse/${h.horseId}/results`)} style={{ cursor: 'pointer' }}>{h.name}</a>
                      </div>
                      <div className="horse-info__dam">母: {h.blood.dam} / 母父: {h.blood.damsire}</div>
                    </div>
                    <div className="horse-info__stable">{h.stable}・{h.trainer}</div>
                    <div className="horse-info__meta">
                      <span className="hi-chip">{h.sexAge}</span>
                      <span className="hi-chip">{h.weightCarried}kg</span>
                      <span className="hi-chip">{h.runningStyle}</span>
                    </div>
                    <div className="horse-info__numbers">
                      <div className="horse-info__weight">
                        {h.bodyWeight.value}kg
                        <span className={h.bodyWeight.diff > 0 ? 'hi-weight-diff hi-up' : h.bodyWeight.diff < 0 ? 'hi-weight-diff hi-down' : 'hi-weight-diff hi-flat'}>
                          {h.bodyWeight.diff > 0 ? `(+${h.bodyWeight.diff})` : `(${h.bodyWeight.diff >= 0 ? `(+${h.bodyWeight.diff})` : `${h.bodyWeight.diff}`})`}
                        </span>
                      </div>
                      <div />
                      <div>
                        <span className="horse-info__odds">{h.odds ? `${h.odds.toFixed(1)}倍` : '-'}</span>
                        <span className="horse-info__pop"> {h.popularity ? `(${h.popularity}人気)` : ''}</span>
                      </div>
                    </div>
                    {/* クッション値別成績（選択レンジ）: 非表示時も高さ確保 */}
                    <div className="horse-info__cushion" style={{ visibility: selectedRange === 'none' ? 'hidden' as const : 'visible' as const }}>
                      {(() => {
                        if (selectedRange === 'none') return 'クッション: -';
                        const rec = cushionStats[h.horseId]?.[selectedRange as Exclude<CushionRange, 'none'>];
                        if (!rec) return 'クッション: -';
                        return `クッション: ${rec[0]}-${rec[1]}-${rec[2]}-${rec[3]}`;
                      })()}
                    </div>
                    {/* 周り方別成績（選択周り）: 非表示時も高さ確保 */}
                    <div className="horse-info__turn" style={{ visibility: selectedTurn === 'none' ? 'hidden' as const : 'visible' as const }}>
                      {(() => {
                        if (selectedTurn === 'none') return '左回り: -';
                        const rec = turnStats[h.horseId]?.[selectedTurn as Exclude<Turn, 'none'>];
                        const tLabel = selectedTurn === 'left' ? '左回り' : '右回り';
                        if (!rec) return `${tLabel}: -`;
                        return `${tLabel}: ${rec[0]}-${rec[1]}-${rec[2]}-${rec[3]}`;
                      })()}
                    </div>
                  </div>
                </TableCell>
                <TableCell align="center" sx={{ whiteSpace: 'nowrap', p: { xs: 0.25, sm: 0.5 } }}>
                  <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2, fontSize: '0.85rem' }}>
                    <span>{h.sexAge}</span>
                    <span>{h.jockey}</span>
                    <span>{h.weightCarried.toFixed(1)}</span>
                  </Box>
                </TableCell>
                {h.races.slice(0, 5).map((r, idx) => {
                  const surfaceClass = r.surface === '芝' ? 'rc-chip--turf' : 'rc-chip--dirt';
                  const goingClass = r.going === '良' ? 'rc-chip--good' : (r.going === '不良' ? 'rc-chip--bad' : 'rc-chip--heavy');
                  const dateLabel = new Date(r.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                  return (
                    <TableCell 
                      key={idx} 
                      align="left" 
                      sx={{ 
                        display: { xs: idx < 2 ? 'table-cell' : 'none', sm: idx < 3 ? 'table-cell' : 'none', md: 'table-cell' },
                        whiteSpace: 'normal', 
                        p: { xs: 0.25, sm: 0.5 }, 
                        width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)',
                        cursor: idx === 0 ? 'pointer' : 'default'
                      }}
                      onClick={idx === 0 ? () => navigate(`/races/${r.raceId}/results`) : undefined}
                      title={idx === 0 ? 'このレース結果ページへ' : undefined}
                    >
                      <div className="race-cell race-cell--sm">
                        <div className="race-cell__corner">
                          <span className="race-cell__replay">R</span>
                          <span className="race-cell__frame">{r.barrier}</span>
                        </div>
                        <div className="race-cell__date">{dateLabel} {r.track}</div>
                        <div className="race-cell__name">{r.class}</div>
                        <div className="race-cell__meta">
                          <span className={`rc-chip ${surfaceClass}`}>{r.surface}</span>
                          <span className="rc-chip">{r.distance}m</span>
                          {r.time && <span className="rc-chip">{r.time}</span>}
                          <span className={`rc-chip ${goingClass}`}>{r.going}</span>
                        </div>
                        <div className="race-cell__info">{r.fieldSize}頭 {r.jockey} {r.weightCarried}kg</div>
                        <div className="race-cell__passing">通過 {r.passing} ・ 上り {r.last3F}</div>
                        <div className="race-cell__winner">{r.position}着</div>
                      </div>
                    </TableCell>
                  );
                })}
                {Array.from({ length: Math.max(0, 5 - h.races.length) }).map((_, vIdx) => (
                  <TableCell 
                    key={`empty-${vIdx}`} 
                    align="center" 
                    sx={{ 
                      display: { xs: vIdx < 2 ? 'table-cell' : 'none', sm: vIdx < 3 ? 'table-cell' : 'none', md: 'table-cell' },
                      width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', 
                      px: { xs: 0.25, sm: 0.5 }
                    }}
                  >
                    -
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
