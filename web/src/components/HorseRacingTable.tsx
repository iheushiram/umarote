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
  Chip,
  Tooltip,
} from "@mui/material";
import './horse-info.css';
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, List } from "lucide-react";
import { HorseEntry } from '../types/horse';
import { parseRaceId, formatRaceIdDisplay } from '../utils/raceUtils';
import { AdminService, RaceResultData } from '../services/adminService';
import { formatRaceTime, calculateAverageSpeed } from '../utils/timeUtils';
import HorseListSidebar from './HorseListSidebar';
import AnalysisSidebar from './AnalysisSidebar';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysisSidebarOpen, setAnalysisSidebarOpen] = useState(false);

  const [raceInfo, setRaceInfo] = useState<{
    raceId: string;
    raceName: string;
    venue: string;
    distance: number;
    surface: '芝' | 'ダート';
    direction: '右' | '左';
    cushionValue?: number;
    date?: string;
  }>({
    raceId: raceId || '',
    raceName: '',
    venue: '',
    distance: 0,
    surface: 'ダート',
    direction: '右',
    cushionValue: undefined,
    date: undefined
  });

  const [entries, setEntries] = useState<HorseEntry[]>([]);
  // 前走レースID -> 頭数
  const [fieldSizeCache, setFieldSizeCache] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // レースレベル（賞金合計/平均）キャッシュ
  type RaceLevelInfo = {
    prizeMoney?: number;     // 合計（万円）
    earnedMoney?: number;    // 合計（万円）
    horseCount?: number;     // そのレースの頭数
    avgPrize?: number;       // 平均（万円/頭）
    avgEarned?: number;      // 平均（万円/頭）
  };
  const [prizeMoneyCache, setPrizeMoneyCache] = useState<Map<string, RaceLevelInfo>>(new Map());
  const [loadingPrizeMoney, setLoadingPrizeMoney] = useState<Set<string>>(new Set());
  // デバウンス用のタイマー
  const [hoverTimers, setHoverTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

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
            cushionValue: race.cushionValue,
            date: race.date
          });
        }

        const es = await admin.getRaceEntries(raceId as string);
        // 各馬の直近レース(最大5件)も取得
        const resultsMap = new Map<string, RaceResultData[]>();
        const beforeDate = (race && typeof race.date === 'string') ? race.date.replace(/-/g, '') : undefined;
        await Promise.all(es.map(async (e) => {
          const res = await admin.getRaceResults(undefined, e.horseId, 5, beforeDate);
          resultsMap.set(e.horseId, res);
        }));

        // 前走のユニークなレースIDを収集
        const prevRaceIds = Array.from(
          new Set<string>(
            es.flatMap(e => (resultsMap.get(e.horseId) || []).map(r => r.raceId))
          )
        );

        // 頭数を一括取得（races.fieldSize → race_results件数 → race_entries件数 の順でフォールバック）
        const fsPairs = await Promise.all(prevRaceIds.map(async (rid) => {
          // 1) races.fieldSize
          try {
            const info = await admin.getRace(rid);
            if (info && typeof info.fieldSize === 'number' && info.fieldSize > 0) {
              return [rid, info.fieldSize] as const;
            }
          } catch {}
          // 2) race_results の件数
          try {
            const rs = await admin.getRaceResults(rid);
            if (Array.isArray(rs) && rs.length > 0) {
              return [rid, rs.length] as const;
            }
          } catch {}
          // 3) race_entries の件数
          try {
            const ents = await admin.getRaceEntries(rid);
            if (Array.isArray(ents) && ents.length > 0) {
              return [rid, ents.length] as const;
            }
          } catch {}
          return [rid, 0] as const;
        }));
        const fsMap = new Map<string, number>(fsPairs);
        setFieldSizeCache(fsMap);

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
              fieldSize: fsMap.get(r.raceId) ?? fieldSizeCache.get(r.raceId) ?? 0,
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

        // 馬番号順でソート
        const sortedEntries = mapped.sort((a, b) => a.horseNo - b.horseNo);
        setEntries(sortedEntries);
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

  // ホバー開始時にタイマーを設定する関数
  const handlePrizeMoneyHoverStart = (raceId: string) => {
    console.log('handlePrizeMoneyHoverStart called with raceId:', raceId);
    
    // 既に有効キャッシュがある場合は何もしない（合計が未定義の空キャッシュは除外）
    if (prizeMoneyCache.has(raceId)) {
      const cached = prizeMoneyCache.get(raceId);
      if ((cached?.prizeMoney !== undefined) || (cached?.earnedMoney !== undefined)) {
        console.log('Race level already cached for raceId:', raceId);
        return;
      }
    }

    // 既にロード中の場合は何もしない
    if (loadingPrizeMoney.has(raceId)) {
      console.log('Prize money already loading for raceId:', raceId);
      return;
    }

    // 既存のタイマーをクリア
    const existingTimer = hoverTimers.get(raceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 1秒後にAPIを呼び出すタイマーを設定（過負荷防止）
    const timer = setTimeout(async () => {
      console.log('Timer expired, fetching prize money for raceId:', raceId);
      
      // ローディング状態を設定
      setLoadingPrizeMoney(prev => new Set(prev).add(raceId));

      try {
        const admin = new AdminService();
        console.log('Calling admin.getRaceEntries for raceId:', raceId);
        const entries = await admin.getRaceEntries(raceId);
        console.log('Received entries:', entries);

        if (entries.length > 0) {
          const horseCount = entries.length;
          const e0: any = entries[0] || {};
          const apiTotalPrize: number | undefined = e0?.prizeMoney ?? undefined;
          const apiTotalEarned: number | undefined = e0?.earnedMoney ?? undefined;

          if ((apiTotalPrize !== undefined && apiTotalPrize !== null) || (apiTotalEarned !== undefined && apiTotalEarned !== null)) {
            const info: RaceLevelInfo = {
              prizeMoney: typeof apiTotalPrize === 'number' ? apiTotalPrize : undefined,
              earnedMoney: typeof apiTotalEarned === 'number' ? apiTotalEarned : undefined,
              horseCount,
              avgPrize: typeof apiTotalPrize === 'number' && horseCount > 0 ? Math.round((apiTotalPrize / horseCount) * 10) / 10 : undefined,
              avgEarned: typeof apiTotalEarned === 'number' && horseCount > 0 ? Math.round((apiTotalEarned / horseCount) * 10) / 10 : undefined,
            };
            setPrizeMoneyCache(prev => new Map(prev).set(raceId, info));
            console.log('Race level (from API total):', info);
          } else {
            // フォールバック: 参加馬ごとの過去レース結果から合計を算出
            const raceDate: string | undefined = entries[0]?.date;
            if (raceDate) {
              const allResults = await Promise.all(entries.map(async (en: any) => {
                try {
                  const rs = await admin.getRaceResults(undefined, en.horseId, undefined, raceDate);
                  return rs as any[];
                } catch {
                  return [] as any[];
                }
              }));

              let totalPrize = 0;
              let totalEarned = 0;
              for (const rs of allResults) {
                for (const r of rs) {
                  if (typeof (r as any).prizeMoney === 'number') totalPrize += (r as any).prizeMoney;
                  if (typeof (r as any).earnedMoney === 'number') totalEarned += (r as any).earnedMoney;
                }
              }

              const info: RaceLevelInfo = {
                prizeMoney: isFinite(totalPrize) ? totalPrize : undefined,
                earnedMoney: isFinite(totalEarned) ? totalEarned : undefined,
                horseCount,
                avgPrize: horseCount > 0 && isFinite(totalPrize) ? Math.round((totalPrize / horseCount) * 10) / 10 : undefined,
                avgEarned: horseCount > 0 && isFinite(totalEarned) ? Math.round((totalEarned / horseCount) * 10) / 10 : undefined,
              };
              setPrizeMoneyCache(prev => new Map(prev).set(raceId, info));
              console.log('Race level (computed fallback):', info);
            } else {
              // 日付無し → 空キャッシュとして保持（再試行抑制）
              setPrizeMoneyCache(prev => new Map(prev).set(raceId, {}));
            }
          }
        } else {
          // エントリ無し → 空キャッシュ
          setPrizeMoneyCache(prev => new Map(prev).set(raceId, {}));
        }
      } catch (error) {
        console.error(`Error fetching prize money for race ${raceId}:`, error);
      } finally {
        // ローディング状態を解除
        setLoadingPrizeMoney(prev => {
          const newSet = new Set(prev);
          newSet.delete(raceId);
          return newSet;
        });
        // タイマーをクリア
        setHoverTimers(prev => {
          const newMap = new Map(prev);
          newMap.delete(raceId);
          return newMap;
        });
      }
    }, 1000); // 1秒

    // タイマーを保存
    setHoverTimers(prev => new Map(prev).set(raceId, timer));
  };

  // ホバー終了時にタイマーをクリアする関数
  const handlePrizeMoneyHoverEnd = (raceId: string) => {
    console.log('handlePrizeMoneyHoverEnd called with raceId:', raceId);
    
    const timer = hoverTimers.get(raceId);
    if (timer) {
      clearTimeout(timer);
      setHoverTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(raceId);
        return newMap;
      });
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
        <Button 
          startIcon={<List />} 
          onClick={() => setSidebarOpen(true)} 
          variant="contained"
          color="primary"
        >
          出走馬一覧
        </Button>
        <Button 
          startIcon={<BarChart3 />} 
          onClick={() => setAnalysisSidebarOpen(true)} 
          variant="contained"
          color="secondary"
        >
          レース分析
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            {raceInfo.raceName}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {raceInfo.date && (() => {
              // YYYYMMDD形式をYYYY年MM月DD日形式に変換
              if (raceInfo.date.length === 8) {
                const year = raceInfo.date.substring(0, 4);
                const month = raceInfo.date.substring(4, 6);
                const day = raceInfo.date.substring(6, 8);
                return `${year}年${month}月${day}日 `;
              }
              return `${raceInfo.date} `;
            })()}
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
                  // 賞金情報のツールチップ内容を作成
                  const prizeInfo = prizeMoneyCache.get(r.raceId);
                  const isLoading = loadingPrizeMoney.has(r.raceId);
                  console.log(`Race ${r.raceId}: prizeInfo=`, prizeInfo, 'isLoading=', isLoading);
                  
                  const prizeTooltip = (() => {
                    if (isLoading) return 'レースレベルを算出中...';
                    if (prizeInfo && (prizeInfo.prizeMoney !== undefined || prizeInfo.earnedMoney !== undefined)) {
                      const parts: string[] = [];
                      const head = prizeInfo.horseCount ? `（頭数:${prizeInfo.horseCount}）` : '';
                      if (typeof prizeInfo.prizeMoney === 'number') {
                        const avg = typeof prizeInfo.avgPrize === 'number' ? `／平均${prizeInfo.avgPrize}万円` : '';
                        parts.push(`レースレベル（前走まで累計）${head}`);
                        parts.push(`総賞金合計: ${prizeInfo.prizeMoney}万円${avg}`);
                      }
                      if (typeof prizeInfo.earnedMoney === 'number') {
                        const avgE = typeof prizeInfo.avgEarned === 'number' ? `／平均${prizeInfo.avgEarned}万円` : '';
                        parts.push(`収得賞金合計: ${prizeInfo.earnedMoney}万円${avgE}`);
                      }
                      return parts.join('\n');
                    }
                    const hasTimer = hoverTimers.has(r.raceId);
                    return hasTimer ? '1秒後にレースレベルを算出...' : 'ホバーでレースレベルを算出';
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
                      <Tooltip 
                        title={prizeTooltip || '賞金情報を取得中...'} 
                        placement="top"
                        arrow
                        disableHoverListener={false}
                        onOpen={() => {
                          console.log('Tooltip onOpen triggered for raceId:', r.raceId);
                          handlePrizeMoneyHoverStart(r.raceId);
                        }}
                        onClose={() => {
                          console.log('Tooltip onClose triggered for raceId:', r.raceId);
                          handlePrizeMoneyHoverEnd(r.raceId);
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
                      </Tooltip>
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

      {/* 出走馬一覧サイドバー */}
      <HorseListSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        horses={entries}
        raceInfo={{
          raceName: raceInfo.raceName,
          venue: raceInfo.venue,
          distance: raceInfo.distance,
          surface: raceInfo.surface
        }}
      />

      {/* 分析サイドバー */}
      <AnalysisSidebar
        open={analysisSidebarOpen}
        onClose={() => setAnalysisSidebarOpen(false)}
        raceId={raceId || ''}
        currentDistance={raceInfo.distance}
        currentSurface={raceInfo.surface}
        currentVenue={raceInfo.venue}
      />
    </Box>
  );
}
