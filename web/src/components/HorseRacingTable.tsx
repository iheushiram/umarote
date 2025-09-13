import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Tabs,
  Tab,
  Divider,
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
import PrevRankSidebar from './PrevRankSidebar';

function HorseRacingTable() {
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
  const [rankPanelOpen, setRankPanelOpen] = useState(false);
  const [rankMode, setRankMode] = useState<'prev' | 'prev2'>('prev');
  const [analysisSidebarOpen, setAnalysisSidebarOpen] = useState(false);
  const [avgTimeSec, setAvgTimeSec] = useState<number | null>(null);
  const [avgTimeCount, setAvgTimeCount] = useState<number>(0);
  const [prevAvgSpeed, setPrevAvgSpeed] = useState<number | null>(null);
  const [prevAvgSpeedCount, setPrevAvgSpeedCount] = useState<number>(0);
  const [showStickyStats, setShowStickyStats] = useState<boolean>(false);
  const headerSentinelRef = useRef<HTMLDivElement | null>(null);
  const stickyOffset = useMemo(() => {
    if (!showStickyStats) return 0;
    const lines = (avgTimeSec !== null ? 1 : 0) + (prevAvgSpeed !== null ? 1 : 0);
    if (lines >= 2) return 64;
    if (lines === 1) return 40;
    return 0;
  }, [showStickyStats, avgTimeSec, prevAvgSpeed]);

  // スクロールでヘッダ領域が外れたら固定バーを表示
  useEffect(() => {
    const el = headerSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setShowStickyStats(!e.isIntersecting);
      },
      { root: null, threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  
  const [activeTab, setActiveTab] = useState<'entries' | 'results'>('entries');
  const [hasResults, setHasResults] = useState(false);
  type ResultRow = {
    pos: number;
    frame?: number;
    num?: number;
    name: string;
    carried: number;
    jockey: string;
    time: string | number;
    distance: number;
    diff?: string;
    pass?: string;
    last3F?: string;
    odds?: number;
    pop?: number;
  };
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);

  const [raceInfo, setRaceInfo] = useState<{
    raceId: string;
    raceName: string;
    className?: string;
    venue: string;
    distance: number;
    surface: '芝' | 'ダート';
    direction: '右' | '左';
    cushionValue?: number;
    date?: string;
  }>({
    raceId: raceId || '',
    raceName: '',
    className: undefined,
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
  // レース時速（前走平均/実測平均）キャッシュ
  type RaceSpeedInfo = {
    prevAvg?: number;
    countPrev?: number;
    actualAvg?: number;
    countActual?: number;
    winnerKmh?: number;
  };
  const [raceSpeedCache, setRaceSpeedCache] = useState<Map<string, RaceSpeedInfo>>(new Map());
  const [loadingRaceSpeed, setLoadingRaceSpeed] = useState<Set<string>>(new Set());

  // 蛍光ペン風ハイライト色を賞金合計で切替
  const highlightColorFor = (total: number) => {
    if (!isFinite(total) || total <= 0) return 'rgba(203, 213, 225, 0.35)'; // slate-300
    if (total >= 8000) return 'rgba(245, 158, 11, 0.45)';   // amber-500
    if (total >= 4000) return 'rgba(250, 204, 21, 0.40)';   // yellow-400
    if (total >= 2000) return 'rgba(132, 204, 22, 0.35)';   // lime-500
    return 'rgba(56, 189, 248, 0.35)';                      // sky-400
  };

  // 単一レースのレースレベル（賞金）情報を取得してキャッシュへ反映
  const fetchRaceLevelInfo = async (targetRaceId: string) => {
    // 既にキャッシュ済み（有効値あり）なら何もしない
    if (prizeMoneyCache.has(targetRaceId)) {
      const cached = prizeMoneyCache.get(targetRaceId);
      if ((cached?.prizeMoney !== undefined) || (cached?.earnedMoney !== undefined)) return;
    }
    // ローディング中なら何もしない
    if (loadingPrizeMoney.has(targetRaceId)) return;

    setLoadingPrizeMoney(prev => new Set(prev).add(targetRaceId));
    try {
      const admin = new AdminService();
      const entries = await admin.getRaceEntries(targetRaceId);
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
          setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, info));
        } else {
          // フォールバック: 各参加馬の前走までの累計を算出
          const raceDate: string | undefined = entries[0]?.date;
          if (raceDate) {
            const allResults = await Promise.all(entries.map(async (en: any) => {
              try {
                const rs = await new AdminService().getRaceResults(undefined, en.horseId, undefined, raceDate);
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
            setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, info));
          } else {
            // 日付無し → 空キャッシュ（再試行抑制）
            setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, {}));
          }
        }
      } else {
        // エントリ無し → 空キャッシュ
        setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, {}));
      }
    } catch (error) {
      console.error(`Error fetching prize money for race ${targetRaceId}:`, error);
    } finally {
      setLoadingPrizeMoney(prev => {
        const ns = new Set(prev);
        ns.delete(targetRaceId);
        return ns;
      });
    }
  };

  // レースの前走平均時速／実測平均時速を算出しキャッシュ
  const fetchRaceSpeedInfo = async (targetRaceId: string) => {
    if (raceSpeedCache.has(targetRaceId)) {
      const cached = raceSpeedCache.get(targetRaceId);
      if ((cached?.prevAvg !== undefined) || (cached?.actualAvg !== undefined)) return;
    }
    if (loadingRaceSpeed.has(targetRaceId)) return;
    setLoadingRaceSpeed(prev => new Set(prev).add(targetRaceId));
    try {
      const admin = new AdminService();
      // 実測平均（当該レースの結果から）
      let actualSum = 0; let actualCnt = 0;
      let winnerKmh: number | undefined = undefined;
      try {
        const results = await admin.getRaceResults(targetRaceId);
        for (const r of results || []) {
          const v = calculateAverageSpeed(r.distance as any, (r as any).time as any);
          if (isFinite(v) && v > 0) { actualSum += v; actualCnt += 1; }
          if ((r as any).finishPosition === 1 && isFinite(v) && v > 0) {
            winnerKmh = Math.round(v * 10) / 10;
          }
        }
      } catch {}
      // 前走平均（当該レースの出馬表から、レース当日より前の直近1走）
      let prevSum = 0; let prevCnt = 0;
      try {
        const entries = await admin.getRaceEntries(targetRaceId);
        const raceDate = entries[0]?.date; // 期待フォーマット: YYYYMMDD
        await Promise.all((entries || []).map(async (en: any) => {
          try {
            const rs = await admin.getRaceResults(undefined, en.horseId, 1, raceDate);
            const last = (rs || [])[0];
            if (last && last.distance && last.time) {
              const v = calculateAverageSpeed(last.distance as any, (last as any).time as any);
              if (isFinite(v) && v > 0) { prevSum += v; prevCnt += 1; }
            }
          } catch {}
        }));
      } catch {}
      const info: RaceSpeedInfo = {
        actualAvg: actualCnt > 0 ? Math.round((actualSum / actualCnt) * 10) / 10 : undefined,
        countActual: actualCnt || undefined,
        prevAvg: prevCnt > 0 ? Math.round((prevSum / prevCnt) * 10) / 10 : undefined,
        countPrev: prevCnt || undefined,
        winnerKmh: winnerKmh,
      };
      setRaceSpeedCache(prev => new Map(prev).set(targetRaceId, info));
    } finally {
      setLoadingRaceSpeed(prev => { const ns = new Set(prev); ns.delete(targetRaceId); return ns; });
    }
  };

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
            className: race.className,
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

        // 前走平均時速（出走馬の直近1走の時速の平均）
        try {
          let sum = 0;
          let cnt = 0;
          es.forEach((e) => {
            const recent = (resultsMap.get(e.horseId) || []);
            const r0 = recent[0];
            if (r0 && r0.distance && r0.time) {
              const sp = calculateAverageSpeed(r0.distance as any, r0.time as any);
              if (isFinite(sp) && sp > 0) {
                sum += sp;
                cnt += 1;
              }
            }
          });
          setPrevAvgSpeed(cnt > 0 ? Math.round((sum / cnt) * 10) / 10 : null);
          setPrevAvgSpeedCount(cnt);
        } catch (e) {
          console.warn('前走平均時速の算出に失敗:', e);
          setPrevAvgSpeed(null);
          setPrevAvgSpeedCount(0);
        }

        // 現在レースの確定結果があればタブ表示用に取得
        try {
          const currResults = await admin.getRaceResults(raceId as string);
          const has = Array.isArray(currResults) && currResults.length > 0;
          setHasResults(has);
          if (has) {
            const entryMap = new Map<string, any>(es.map(e => [e.horseId, e] as const));
            const formatPassing = (r: RaceResultData) => {
              const vals = [r.pos1c, r.pos2c, r.pos3c, r.pos4c].map(v => (v === undefined || v === null) ? '' : String(v));
              const anyPos = vals.some(v => v !== '');
              if (anyPos) return vals.join('-');
              const cp = (r as any).cornerPassings as string | undefined;
              if (cp && cp.trim() !== '') {
                const parts = cp.split('-');
                while (parts.length < 4) parts.push('');
                return parts.slice(0, 4).join('-');
              }
              return '';
            };
            const rows: ResultRow[] = currResults
              .slice()
              .sort((a, b) => (a.finishPosition ?? 9999) - (b.finishPosition ?? 9999))
              .map(r => {
                const ent = entryMap.get(r.horseId);
                const name = (ent as any)?.horseName || ent?.horse?.name || r.horseId;
                return {
                  pos: r.finishPosition ?? 0,
                  frame: ent?.frameNo,
                  num: ent?.horseNo,
                  name,
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
            setResultRows(rows);
          }
        } catch (e) {
          console.warn('結果取得に失敗（タブ非表示継続）:', e);
          setHasResults(false);
        }

        // 追加: 前走レースの賞金情報をページ読み込み時に一括取得
        // 過度な同時接続を避けるため、6件ずつ並列化
        (async () => {
          const chunkSize = 6;
          for (let i = 0; i < prevRaceIds.length; i += chunkSize) {
            const chunk = prevRaceIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(rid => fetchRaceLevelInfo(rid)));
          }
        })();

        // 追加: 前走レースの前走平均時速・実測平均時速を一括取得
        (async () => {
          const chunkSize = 6;
          for (let i = 0; i < prevRaceIds.length; i += chunkSize) {
            const chunk = prevRaceIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(rid => fetchRaceSpeedInfo(rid)));
          }
        })();

        // 平均タイム（過去1年・同クラス/同距離/同馬場）
        try {
          const dateStr = (race?.date || '').replace(/-/g, '');
          const inferredClass = inferClassFromName(race?.raceName);
          const effectiveClassCond = inferredClass || race?.className;
          if (dateStr && dateStr.length >= 8 && effectiveClassCond && race?.distance && race?.surface) {
            const to = dateStr; // 当日を除外（lt）
            const fromDate = (() => {
              const y = parseInt(dateStr.slice(0,4));
              const m = parseInt(dateStr.slice(4,6)) - 1;
              const d = parseInt(dateStr.slice(6,8));
              const dt = new Date(y, m, d);
              dt.setDate(dt.getDate() - 365);
              const yy = dt.getFullYear();
              const mm = String(dt.getMonth()+1).padStart(2,'0');
              const dd = String(dt.getDate()).padStart(2,'0');
              return `${yy}${mm}${dd}`;
            })();

            // クラス名の補正（レース名から推定を優先）
            const inferred = inferClassFromName(race.raceName);
            const effectiveClass = inferred || race.className;
            const statsRes = await admin.getDistanceTimeStats({
              distance: race.distance,
              surface: race.surface,
              className: effectiveClass,
              from: fromDate,
              to,
              winnersOnly: true,
              limit: 2000,
            });
            if (statsRes?.stats) {
              setAvgTimeSec(statsRes.stats.average || null);
              setAvgTimeCount(statsRes.stats.count || 0);
            }
          } else {
            setAvgTimeSec(null);
            setAvgTimeCount(0);
          }
        } catch (e) {
          console.warn('平均タイム取得に失敗:', e);
          setAvgTimeSec(null);
          setAvgTimeCount(0);
        }
      } catch (err) {
        console.error(err);
        setError('出馬表の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [raceId]);

  // レース名からクラス名を推定（全角数字対応）
  const inferClassFromName = (name?: string): string | undefined => {
    if (!name) return undefined;
    const z2h = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const n = z2h(name);
    if (/G\s*1|Ｇ\s*1/i.test(n)) return 'G1';
    if (/G\s*2|Ｇ\s*2/i.test(n)) return 'G2';
    if (/G\s*3|Ｇ\s*3/i.test(n)) return 'G3';
    if (/オープン|ＯＰ|OP/i.test(n)) return 'OP';
    if (/新馬/.test(n)) return '新馬';
    if (/未勝利/.test(n)) return '未勝利';
    if (/1\s*勝/.test(n)) return '1勝クラス';
    if (/2\s*勝/.test(n)) return '2勝クラス';
    if (/3\s*勝/.test(n)) return '3勝クラス';
    return undefined;
  };

  const formatSecondsToRace = (sec: number | null): string => {
    if (sec === null || !isFinite(sec) || sec <= 0) return '-';
    const m = Math.floor(sec / 60);
    const s = (sec - m * 60);
    const sFixed = s.toFixed(1).padStart(4, '0');
    return m > 0 ? `${m}:${sFixed}` : `${sFixed}`;
  };

  const speedFromSeconds = (distanceM: number, sec: number | null): number | null => {
    if (!distanceM || !isFinite(distanceM) || !sec || !isFinite(sec) || sec <= 0) return null;
    const v = (distanceM / sec) * 3.6;
    return Math.round(v * 10) / 10;
  };

  // 前走レベル（平均賞金/頭）ランキング（テーブル外に表示）
  type PrevRankItem = { rank: number; horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string };
  const prevRankList: PrevRankItem[] = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const items = entries.map((h) => {
      const prev = h.races?.[0];
      if (!prev) return null;
      const info = prizeMoneyCache.get(prev.raceId);
      const avg = info?.avgPrize;
      if (typeof avg !== 'number') return null;
      return { horseId: h.horseId, horseNo: h.horseNo, name: h.name, avg, raceId: prev.raceId, margin: prev.margin || undefined };
    }).filter(Boolean) as {horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string}[];
    items.sort((a, b) => b.avg - a.avg);
    return items.map((it, idx) => ({ ...it, rank: idx + 1 }));
  }, [entries, prizeMoneyCache]);

  const prev2RankList: PrevRankItem[] = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const items = entries.map((h) => {
      const prev2 = h.races?.[1];
      if (!prev2) return null;
      const info = prizeMoneyCache.get(prev2.raceId);
      const avg = info?.avgPrize;
      if (typeof avg !== 'number') return null;
      return { horseId: h.horseId, horseNo: h.horseNo, name: h.name, avg, raceId: prev2.raceId, margin: prev2.margin || undefined };
    }).filter(Boolean) as {horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string}[];
    items.sort((a, b) => b.avg - a.avg);
    return items.map((it, idx) => ({ ...it, rank: idx + 1 }));
  }, [entries, prizeMoneyCache]);

  // モックのクッション値別成績（horseId -> range -> [1,2,3,other]）
  const cushionStats: Record<string, Record<CushionRange, [number, number, number, number]>> = {} as any;

  // 周り方選択とモック成績
  type Turn = 'none' | 'left' | 'right';
  const turnLabels: Record<Turn, string> = { none: 'なし', left: '左回り', right: '右回り' };
  const [selectedTurn, setSelectedTurn] = useState<Turn>('left');
  const turnStats: Record<string, Record<Turn, [number, number, number, number]>> = {} as any;

  // ツールチップ廃止に伴いホバー用関数は未使用

  return (
    <Box 
      sx={{ 
        pb: 4, maxWidth: '1680px', mx: 'auto', px: 3,
        '--rankw': { xs: '28px', sm: '32px' },
        '--framew': { xs: '44px', sm: '60px' },
        '--horsenow': { xs: '44px', sm: '60px' },
        // 馬名は少し狭める
        '--namew': { xs: '120px', sm: '200px', md: '220px' },
        // 前走セルを広げる
        '--rcw': { xs: '150px', sm: '160px', md: '170px' },
        '--cellw': { xs: '160px', sm: '170px', md: '180px' }
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
          onClick={() => { setRankMode('prev'); setRankPanelOpen(true); }} 
          variant="contained"
          color="primary"
        >
          前走ランキング
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {(() => {
              const cls = (inferClassFromName(raceInfo.raceName) || raceInfo.className) || '-';
              const has = avgTimeSec !== null && avgTimeCount > 0;
              const timePart = has ? formatSecondsToRace(avgTimeSec) : 'データなし';
              const countPart = has ? `（${avgTimeCount}件）` : '';
              const speedPart = has ? ` ／ 平均時速: ${speedFromSeconds(raceInfo.distance, avgTimeSec) ?? '-'} km/h` : '';
              return `平均タイム(過去1年・${cls} ${raceInfo.distance}m): ${timePart}${countPart}${speedPart}`;
            })()}
          </Typography>
          {prevAvgSpeed !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              前走平均時速(出走馬): {prevAvgSpeed} km/h{prevAvgSpeedCount ? `（${prevAvgSpeedCount}頭）` : ''}
            </Typography>
          )}
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

      {/* 前走/前前走 レベルランキング（横から出す） */}
      <PrevRankSidebar 
        open={rankPanelOpen} 
        onClose={() => setRankPanelOpen(false)} 
        itemsPrev={prevRankList}
        itemsPrev2={prev2RankList}
        mode={rankMode}
        onModeChange={setRankMode}
      />

      {/* スクロール監視用センチネル */}
      <Box ref={headerSentinelRef} sx={{ height: 1 }} />

      {/* 固定ステータスバー（平均タイム/平均時速/前走平均時速） */}
      {showStickyStats && (
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 1200,
          bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider',
          py: 0.5, px: { xs: 1, sm: 2 }
        }}>
          <Typography variant="body2" color="text.secondary">
            {(() => {
              const cls = (inferClassFromName(raceInfo.raceName) || raceInfo.className) || '-';
              const has = avgTimeSec !== null && avgTimeCount > 0;
              const timePart = has ? formatSecondsToRace(avgTimeSec) : 'データなし';
              const countPart = has ? `（${avgTimeCount}件）` : '';
              const speedPart = has ? ` ／ 平均時速: ${speedFromSeconds(raceInfo.distance, avgTimeSec) ?? '-'} km/h` : '';
              return `平均タイム(過去1年・${cls} ${raceInfo.distance}m): ${timePart}${countPart}${speedPart}`;
            })()}
          </Typography>
          {prevRankList.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                {(() => {
                  const top = prevRankList.slice(0, 3);
                  const fmt = (it: any) => ` ${it.rank}位 ${it.horseNo}-${it.name} 平 ${it.avg}万${it.margin ? ` / 着差 ${it.margin}` : ''}`;
                  return `前走レベル上位:` + top.map(fmt).join(' /');
                })()}
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setRankPanelOpen(true)}>
                前走ランキング
              </Button>
            </Box>
          )}
          {prevAvgSpeed !== null && (
            <Typography variant="body2" color="text.secondary">
              前走平均時速(出走馬): {prevAvgSpeed} km/h{prevAvgSpeedCount ? `（${prevAvgSpeedCount}頭）` : ''}
            </Typography>
          )}
        </Box>
      )}

      {hasResults && (
        <Box sx={{ mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            aria-label="race tabs"
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab value="entries" label="出馬表" />
            <Tab value="results" label="レース結果" />
          </Tabs>
          <Divider />
        </Box>
      )}

      {(activeTab === 'entries' || !hasResults) && (
      <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
        <Table size="small" stickyHeader aria-label="race entries table" sx={{ minWidth: 850, '& td, & th': { px: { xs: 0.25, sm: 0.5 } }, '& .MuiTableCell-stickyHeader': { top: `${stickyOffset}px !important` } }}>
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
                    {(() => {
                      // 前走と現走の馬場（芝/ダート）が異なる場合を表示（周り方の下）
                      const curr = raceInfo?.surface as ('芝' | 'ダート' | undefined);
                      const prev = h.races?.[0]?.surface as ('芝' | 'ダート' | undefined);
                      if (!curr || !prev || curr === prev) return null;
                      const label = curr === '芝' ? '芝替' : 'ダート替';
                      return <div className="horse-info__surface">{label}</div>;
                    })()}
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
                  // debug removed
                  
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
                        {/* 賞金情報（本賞金+収得賞金の合算を表示：蛍光ペン風ハイライト） */}
                        <Box>
                          {(() => {
                            if (isLoading) {
                              return (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>賞金: 算出中...</Typography>
                              );
                            }
                            if (prizeInfo && (prizeInfo.prizeMoney !== undefined || prizeInfo.earnedMoney !== undefined)) {
                              const total = (prizeInfo.prizeMoney ?? 0) + (prizeInfo.earnedMoney ?? 0);
                              const avg = prizeInfo.horseCount && prizeInfo.horseCount > 0
                                ? Math.round((total / prizeInfo.horseCount) * 10) / 10
                                : undefined;
                              const hl = highlightColorFor(total);
                              return (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'text.primary',
                                    display: 'inline-block',
                                    px: 0.25,
                                    borderRadius: 0.5,
                                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 62%, ${hl} 62%)`,
                                    backgroundSize: '100% 100%',
                                    backgroundRepeat: 'no-repeat'
                                  }}
                                >
                                  {`賞金 ${total}万${avg !== undefined ? ` (平${avg})` : ''}`}
                                </Typography>
                              );
                            }
                            return (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>賞金: -</Typography>
                            );
                          })()}
                        </Box>

                        {/* そのレースの平均時速（前走平均／実測平均） */}
                        <Box>
                          {(() => {
                            const sp = raceSpeedCache.get(r.raceId);
                            const isLoadingSp = loadingRaceSpeed.has(r.raceId);
                            if (isLoadingSp) {
                              return (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  時速: 算出中...
                                </Typography>
                              );
                            }
                            const prev = sp?.prevAvg;
                            const prevCnt = sp?.countPrev;
                            const win = sp?.winnerKmh;
                            if (prev || win) {
                              const parts: string[] = [];
                              if (prev) parts.push(`前走平均 ${prev} km/h${prevCnt ? `（${prevCnt}頭）` : ''}`);
                              if (win) parts.push(`勝ち馬 ${win} km/h`);
                              return (
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {parts.join(' ／ ')}
                                </Typography>
                              );
                            }
                            return (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                時速: データなし
                              </Typography>
                            );
                          })()}
                        </Box>

                        {/* 出走情報・通過・上り・着差 */}
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
                          {r.margin && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              着差{r.margin}
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
      )}

      {hasResults && activeTab === 'results' && (
        <TableContainer component={Paper} sx={{ mt: 2, overflowX: 'auto' }}>
          <Table size="small" stickyHeader aria-label="race results table" sx={{ minWidth: 980, '& .MuiTableCell-stickyHeader': { top: `${stickyOffset}px !important` } }}>
            <TableHead>
              <TableRow>
                <TableCell>着順</TableCell>
                <TableCell>枠</TableCell>
                <TableCell>馬番</TableCell>
                <TableCell>馬名</TableCell>
                <TableCell>斤量</TableCell>
                <TableCell>騎手</TableCell>
                <TableCell>タイム</TableCell>
                <TableCell>平均速度</TableCell>
                <TableCell>着差</TableCell>
                <TableCell>通過(1C-2C-3C-4C)</TableCell>
                <TableCell>上り</TableCell>
                <TableCell>単勝</TableCell>
                <TableCell>人気</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resultRows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontWeight: 800 }}>{r.pos || '-'}</TableCell>
                  <TableCell>{r.frame ?? '-'}</TableCell>
                  <TableCell>{r.num ?? '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</TableCell>
                  <TableCell>{r.carried}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.jockey}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRaceTime(r.time)}</TableCell>
                  <TableCell>{calculateAverageSpeed(r.distance, r.time)} km/h</TableCell>
                  <TableCell>{r.diff || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.pass || '-'}</TableCell>
                  <TableCell>{r.last3F || '-'}</TableCell>
                  <TableCell>{typeof r.odds === 'number' && r.odds > 0 ? r.odds.toFixed(1) : '-'}</TableCell>
                  <TableCell>{r.pop ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

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

export default HorseRacingTable
