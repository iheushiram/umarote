import React, { useEffect, useMemo, useState } from "react";
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
import './horse-info.css';
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { HorseEntry } from '../types/horse';
import { parseRaceId, formatRaceIdDisplay } from '../utils/raceUtils';
import { AdminService, RaceResultData } from '../services/adminService';
import { formatRaceTime, calculateAverageSpeed } from '../utils/timeUtils';

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

  const [raceInfo, setRaceInfo] = useState<{
    raceId: string;
    raceName: string;
    venue: string;
    distance: number;
    surface: '芝' | 'ダート';
    direction: '右' | '左';
    cushionValue?: number;
  }>({
    raceId: raceId || '',
    raceName: '',
    venue: '',
    distance: 0,
    surface: 'ダート',
    direction: '右',
    cushionValue: undefined
  });

  const [entries, setEntries] = useState<HorseEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const admin = new AdminService();
    if (!raceId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const race = await admin.getRace(raceId as string);
        if (race) {
          setRaceInfo({
            raceId: race.raceId,
            raceName: race.raceName,
            venue: race.venue,
            distance: race.distance,
            surface: race.surface,
            direction: race.direction,
            cushionValue: race.cushionValue
          });
        }

        const es = await admin.getRaceEntries(raceId as string);
        // 各馬の直近レース(最大5件)も取得
        const resultsMap = new Map<string, RaceResultData[]>();
        await Promise.all(es.map(async (e) => {
          const res = await admin.getRaceResults(undefined, e.horseId, 5);
          resultsMap.set(e.horseId, res);
        }));

        const mapped: HorseEntry[] = es.map((e) => {
          const horse = e.horse as any;
          const sex = (horse?.sex as string) || '';
          const sexAge = `${sex}${e.age ?? ''}`;

          const recent = (resultsMap.get(e.horseId) || []).slice(0, 5);
          const raceDetails = recent.map(r => {
            return {
              raceId: r.raceId,
              date: r.date,
              track: r.venue,
              distance: r.distance,
              surface: r.courseType,
              going: r.courseCondition,
              class: r.raceName,
              fieldSize: 0,
              barrier: 0,
              position: r.finishPosition,
              time: r.time,
              timeRaw: r.timeRaw || r.time, // 計算用の元データ
              last3F: r.lastThreeFurlong,
              passing: (() => {
                const passingArray = [r.pos2c, r.pos3c, r.pos4c];
                const filtered = passingArray.filter(v => v !== undefined && v !== null);
                return filtered.length > 0 ? filtered.join('-') : null;
              })(),
              jockey: r.jockey,
              weightCarried: r.weight,
              margin: r.margin,
              isFeature: !!(r.raceName?.match(/G[1-3]|重賞|特別/))
            };
          });

          return {
            horseId: e.horseId,
            frameNo: e.frameNo,
            horseNo: e.horseNo,
            name: horse?.name || e.horseId,
            sexAge,
            weightCarried: e.weight,
            trainer: e.trainer || horse?.trainer || '',
            jockey: e.jockey,
            stable: e.affiliation || '',
            bodyWeight: { value: e.bodyWeight || 0, diff: e.bodyWeightDiff || 0 },
            runningStyle: '差し',
            blood: { sire: horse?.father || '', dam: horse?.mother || '', damsire: '' },
            odds: undefined,
            popularity: e.popularity || undefined,
            recentForm: (resultsMap.get(e.horseId) || []).map(r => r.finishPosition).slice(0, 5),
            races: raceDetails
          } as HorseEntry;
        });

        setEntries(mapped);
      } catch (err) {
        console.error(err);
        setError('出馬表の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [raceId]);

  // モックのクッション値別成績（horseId -> range -> [1,2,3,other]）
  const cushionStats: Record<string, Record<CushionRange, [number, number, number, number]>> = {} as any;

  // 周り方選択とモック成績
  type Turn = 'none' | 'left' | 'right';
  const turnLabels: Record<Turn, string> = { none: 'なし', left: '左回り', right: '右回り' };
  const [selectedTurn, setSelectedTurn] = useState<Turn>('left');
  const turnStats: Record<string, Record<Turn, [number, number, number, number]>> = {} as any;

  return (
    <Box 
      sx={{ 
        pb: 4, maxWidth: '1536px', mx: 'auto', px: 3,
        '--framew': { xs: '44px', sm: '64px' },
        '--horsenow': { xs: '44px', sm: '64px' },
        '--namew': { xs: '140px', sm: '260px', md: '280px' },
        '--rcw': { xs: '136px', sm: '132px', md: '140px' },
        '--cellw': { xs: '140px', sm: '136px', md: '144px' }
      }}
    >
      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/')} variant="outlined">
          トップに戻る
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {raceInfo.raceName}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {formatRaceIdDisplay(raceId || '')} - {raceInfo.venue} {raceInfo.surface}{raceInfo.distance}m {raceInfo.direction}回り
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
        <Table size="small" stickyHeader aria-label="race entries table" sx={{ minWidth: 850, '& td, & th': { px: { xs: 0.25, sm: 0.5 } } }}>
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
            {(loading ? [] : entries).map((h) => (
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
                  const dateLabel = (() => {
                    if (!r.date) return '-';
                    
                    // 日付文字列を正規化
                    let dateStr = r.date;
                    if (typeof dateStr === 'string') {
                      // YYYYMMDD形式（例：20250621）を処理
                      if (dateStr.match(/^\d{8}$/)) {
                        const year = dateStr.substring(0, 4);
                        const month = dateStr.substring(4, 6);
                        const day = dateStr.substring(6, 8);
                        return `${month}/${day}`;
                      }
                      // YYYY-MM-DD形式も試す
                      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                        }
                      }
                      // その他の形式も試す
                      const date = new Date(dateStr);
                      if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
                      }
                    }
                    
                    return '-';
                  })();
                  return (
                    <TableCell 
                      key={idx} 
                      align="left" 
                      sx={{ 
                        display: { xs: idx < 2 ? 'table-cell' : 'none', sm: idx < 3 ? 'table-cell' : 'none', md: 'table-cell' },
                        whiteSpace: 'normal', 
                        p: { xs: 0.25, sm: 0.5 }, 
                        width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)',
                        fontSize: '0.75rem',
                        lineHeight: 1.3
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {/* 日付・場名・レース名 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
                            {dateLabel}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {r.track}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.primary', 
                              fontWeight: 500,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              '&:hover': { color: 'primary.main' }
                            }}
                            onClick={() => navigate(`/races/${r.raceId}/results`)}
                            title="このレース結果ページへ"
                          >
                            {r.class}
                          </Typography>
                        </Box>
                        
                        {/* 条件情報 */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <Chip 
                            label={r.surface} 
                            size="small" 
                            variant="outlined"
                            sx={{ 
                              height: 16, 
                              fontSize: '0.6rem',
                              bgcolor: r.surface === '芝' ? '#dcfce7' : '#fef3c7',
                              color: r.surface === '芝' ? '#047857' : '#92400e',
                              borderColor: r.surface === '芝' ? '#047857' : '#92400e'
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {r.distance}m
                          </Typography>
                          {r.time && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {formatRaceTime(r.time)}
                              {r.distance && r.timeRaw && (
                                <span style={{ marginLeft: '4px', whiteSpace: 'nowrap' }}>
                                  ({calculateAverageSpeed(r.distance, r.time)} km/h)
                                </span>
                              )}
                            </Typography>
                          )}
                          <Chip 
                            label={r.going} 
                            size="small" 
                            variant="outlined"
                            sx={{ 
                              height: 16, 
                              fontSize: '0.6rem',
                              bgcolor: r.going === '良' ? '#ecfdf5' : r.going === '不良' ? '#fee2e2' : '#fff7ed',
                              color: r.going === '良' ? '#047857' : r.going === '不良' ? '#b91c1c' : '#9a3412',
                              borderColor: r.going === '良' ? '#047857' : r.going === '不良' ? '#b91c1c' : '#9a3412'
                            }}
                          />
                        </Box>
                        
                        {/* 出走情報・通過・上り */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {r.fieldSize}頭 {r.jockey} {r.weightCarried}kg
                          </Typography>
                          {r.passing && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              通過{r.passing} 上り{r.last3F}
                            </Typography>
                          )}
                          {!r.passing && r.last3F && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              上り{r.last3F}
                            </Typography>
                          )}
                        </Box>
                        
                        {/* 着順 */}
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 700, 
                            color: 'text.primary',
                            fontSize: '0.8rem'
                          }}
                        >
                          {r.position}着
                        </Typography>
                      </Box>
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
