import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Slide,
  Switch,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import './horse-info.css';
import '../styles/focus-highlight.css';
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Layers, List, X } from "lucide-react";
import { HorseEntry, RaceDetail } from '../types/horse';
import { parseRaceId, formatRaceIdDisplay } from '../utils/raceUtils';
import { AdminService, RaceResultData, RaceData, RaceBasicInfo, CoRunnerNextResponse, TrainingRecordResponse } from '../services/adminService';
import { formatRaceTime, calculateAverageSpeed } from '../utils/timeUtils';
import HorseListSidebar from './HorseListSidebar';
import AnalysisSidebar from './AnalysisSidebar';
import PrevRankSidebar from './PrevRankSidebar';
import RaceLevelSidebar from './RaceLevelSidebar';
import PrevRaceSpeedSummary, { PrevRaceSpeedSummaryItem } from './PrevRaceSpeedSummary';
import { useRaceUiStore } from '../store/raceUiStore';
import { useRaceLevelStore } from '../store/raceLevelStore';
import { useHorseFocusStore } from '../store/horseFocusStore';

const TRAINING_WINDOW_DAYS = 14;
const TRAINING_WINDOW_MS = TRAINING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const TRAINING_RANKING_LIMIT = 15;
const LEFT_TURN_TRACKS = new Set(['東京', '中京', '新潟']);
const RIGHT_TURN_TRACKS = new Set(['札幌', '函館', '福島', '中山', '阪神', '京都', '小倉']);

type TurnKey = 'left' | 'right';

type TrainingRankingItem = {
  entry: HorseEntry;
  record: TrainingRecordResponse;
  fourFTime: number;
};

import RacePageLayout from '../layouts/RacePageLayout';

const normalizeDateStr = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 8) return undefined;
  return digits.slice(0, 8);
};

const isBeforeDate = (target: string | undefined, reference: string | undefined): boolean => {
  if (!reference) return true;
  if (!target) return false;
  return target < reference;
};

const normalizeDigitsAscii = (value: string): string => value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

const parseMarginToLength = (margin?: string | null): number | null => {
  if (!margin) return null;
  let raw = margin.trim();
  if (!raw || raw === '-' || raw === '----') return null;

  if (/同着/.test(raw)) return 0;

  const map: Record<string, number> = {
    'ハナ': 0.1,
    '鼻': 0.1,
    'アタマ': 0.2,
    '頭': 0.2,
    'クビ': 0.3,
    '首': 0.3,
    'タイム差なし': 0,
    'タイム差無': 0,
    '大差': 6,
  };

  if (map[raw] !== undefined) {
    return map[raw];
  }

  raw = raw.replace(/差$/, '');
  raw = raw.replace(/[()（）]/g, '');
  raw = raw.replace(/[＋+]/g, ' ');
  raw = raw.replace(/[・･]/g, ' ');
  raw = raw.replace(/－/g, ' ');
  raw = normalizeDigitsAscii(raw);
  raw = raw.replace(/([0-9])\.([0-9]\/\d)/g, '$1 $2');
  raw = raw.replace(/([0-9])\-([0-9]\/\d)/g, '$1 $2');
  raw = raw.replace(/半馬身/g, '0.5');
  raw = raw.replace(/馬身半/g, ' 0.5');
  raw = raw.replace(/馬身/g, '');
  raw = raw.replace(/ｺﾞ/, 'ゴ');
  raw = raw.replace(/,/g, ' ');
  raw = raw.trim();

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return map[raw] ?? null;
  }

  let total = 0;
  let matched = false;

  for (const token of tokens) {
    if (map[token] !== undefined) {
      total += map[token];
      matched = true;
      continue;
    }

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      total += parseFloat(token);
      matched = true;
      continue;
    }

    if (/^\d+\/\d+$/.test(token)) {
      const [n, d] = token.split('/').map(Number);
      if (d) {
        total += n / d;
        matched = true;
      }
      continue;
    }
  }

  if (matched) {
    return total;
  }

  return map[raw] ?? null;
};

const LAST_THREE_F_DISTANCE_M = 600;

const parseLastThreeFToSeconds = (value?: string | null): number | null => {
  if (!value) return null;
  const normalized = normalizeDigitsAscii(String(value)).replace(/[^0-9:\.]/g, '').trim();
  if (!normalized) return null;
  let seconds: number;
  if (normalized.includes(':')) {
    const [mPart, sPart] = normalized.split(':');
    const minutes = parseFloat(mPart);
    const secValue = parseFloat(sPart);
    if (!isFinite(minutes) || !isFinite(secValue)) return null;
    seconds = minutes * 60 + secValue;
  } else {
    seconds = parseFloat(normalized);
  }
  if (!isFinite(seconds) || seconds <= 0) return null;
  return seconds;
};

const calcAveragePrizeBeforeRace = (results: RaceResultData[], raceDate?: string): number => {
  if (!Array.isArray(results) || results.length === 0) return 0;
  const normalizedRaceDate = raceDate ? normalizeDateStr(raceDate) : undefined;
  let totalPrize = 0;
  let startCount = 0;

  results.forEach(res => {
    const resultDate = normalizeDateStr(res.date);
    if (!isBeforeDate(resultDate, normalizedRaceDate)) return;
    startCount += 1;
    const prize = typeof res.prizeMoney === 'number' && isFinite(res.prizeMoney) ? res.prizeMoney : 0;
    totalPrize += prize;
  });

  if (startCount === 0) return 0;
  return totalPrize / startCount;
};

const normalizeTrackLabel = (value?: string | null): string => {
  if (!value) return '';
  return value
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[・]/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const inferTurnKeyFromName = (value?: string | null): TurnKey | null => {
  const normalized = normalizeTrackLabel(value);
  if (!normalized) return null;
  for (const label of LEFT_TURN_TRACKS) {
    if (normalized.includes(label)) return 'left';
  }
  for (const label of RIGHT_TURN_TRACKS) {
    if (normalized.includes(label)) return 'right';
  }
  return null;
};

const renderWeekdayHighlight = (weekday?: string | null) => {
  if (!weekday) return null;
  const chars = Array.from(weekday);
  return (
    <Box component="span" sx={{ ml: 0.25 }}>
      (
      {chars.map((char, idx) => {
        const color = char === '土' ? '#2563eb' : char === '日' ? '#dc2626' : undefined;
        return (
          <Box
            component="span"
            key={`${char}-${idx}`}
            sx={color ? { color, fontWeight: 600 } : undefined}
          >
            {char}
          </Box>
        );
      })}
      )
    </Box>
  );
};

function HorseRacingTable() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isUltraWide = useMediaQuery('(min-width:1900px)');
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { raceId } = useParams<{ raceId: string }>();
  const navigate = useNavigate();
  type CushionRange = 'none' | 'lte_7_9' | '8_0_8_9' | '9_0_9_9' | 'gte_10_0';
  type CushionRangeBin = Exclude<CushionRange, 'none'>;

  type FinishCounts = [number, number, number, number];

  const formatFinishCounts = (counts?: FinishCounts | null): string => {
    if (!counts) return '-';
    const total = counts.reduce((sum, value) => sum + value, 0);
    if (total === 0) return '-';
    return `${counts[0]}-${counts[1]}-${counts[2]}-${counts[3]}`;
  };

  const getCushionRange = (value?: number | null): CushionRange => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'none';
    if (value <= 7.9) return 'lte_7_9';
    if (value < 9.0) return '8_0_8_9';
    if (value < 10.0) return '9_0_9_9';
    return 'gte_10_0';
  };

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
  const [raceLevelOpen, setRaceLevelOpen] = useState(false);
  const [rankMode, setRankMode] = useState<'prev' | 'prev2'>('prev');
  const [analysisSidebarOpen, setAnalysisSidebarOpen] = useState(false);
  const [hudOpen, setHudOpen] = useState(false);
  const [hudTab, setHudTab] = useState<'individual' | 'ranking'>('individual');
  const [speedSummaryMode, setSpeedSummaryMode] = useState<'avg' | 'minus3f'>('avg');
  // 同日・同会場のレース一覧
  const [siblingRaces, setSiblingRaces] = useState<RaceData[]>([]);
  const [allRacesSameDate, setAllRacesSameDate] = useState<RaceData[]>([]);
  const [venuesOnDate, setVenuesOnDate] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [avgTimeSec, setAvgTimeSec] = useState<number | null>(null);
  const [avgTimeCount, setAvgTimeCount] = useState<number>(0);
  const [avgMinus3FSpeed, setAvgMinus3FSpeed] = useState<number | null>(null);
  const [avgMinus3FCount, setAvgMinus3FCount] = useState<number>(0);
  const [prevAvgSpeed, setPrevAvgSpeed] = useState<number | null>(null);
  const [prevAvgSpeedCount, setPrevAvgSpeedCount] = useState<number>(0);
  const [prevMinus3FAvgSpeed, setPrevMinus3FAvgSpeed] = useState<number | null>(null);
  const [prevMinus3FAvgSpeedCount, setPrevMinus3FAvgSpeedCount] = useState<number>(0);
  const [showStickyStats, setShowStickyStats] = useState<boolean>(false);
  const headerSentinelRef = useRef<HTMLDivElement | null>(null);
  const stickyOffset = useMemo(() => {
    if (!showStickyStats) return 0;
    const lines = (avgTimeSec !== null ? 1 : 0) + (prevAvgSpeed !== null ? 1 : 0) + (prevMinus3FAvgSpeed !== null ? 1 : 0);
    if (lines >= 2) return 64;
    if (lines === 1) return 40;
    return 0;
  }, [showStickyStats, avgTimeSec, prevAvgSpeed, prevMinus3FAvgSpeed]);

  const nameColumnOverlayWidth = 'calc(var(--framew) + var(--horsenow) + var(--namew))';
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [hudRowPositions, setHudRowPositions] = useState<Array<{ horseId: string; top: number; height: number }>>([]);
  const [entries, setEntries] = useState<HorseEntry[]>([]);
  const [trainingMap, setTrainingMap] = useState<Record<string, TrainingRecordResponse[]>>({});
  const [trainingFetchError, setTrainingFetchError] = useState<string | null>(null);
  const [expandedCoRunnerMap, setExpandedCoRunnerMap] = useState<Record<string, boolean>>({});
  const [coRunnerDetails, setCoRunnerDetails] = useState<Record<string, { status: 'idle' | 'loading' | 'loaded' | 'error'; raceId?: string; data?: RaceResultData[]; error?: string }>>({});
  const coRunnerRaceCache = useRef<Map<string, RaceResultData[]>>(new Map());


  // スクロールでヘッダ領域が外れたら固定バーを表示
  useEffect(() => {
    const el = headerSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setShowStickyStats(!e.isIntersecting);
      },
      { root: null, threshold: 0, rootMargin: '0px 0px -1px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!hudOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHudOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hudOpen]);

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setTrainingMap({});
      setTrainingFetchError(null);
      setHudRowPositions([]);
      return;
    }

    const horseNames = Array.from(new Set(entries.map(entry => entry.name).filter((name): name is string => Boolean(name))));
    if (horseNames.length === 0) {
      setTrainingMap({});
      setTrainingFetchError(null);
      setHudRowPositions([]);
      return;
    }

    const controller = new AbortController();
    const admin = new AdminService();

    (async () => {
      try {
        const records = await admin.getTrainingRecordsByHorseNames(horseNames, 20, controller.signal);
        if (!controller.signal.aborted) {
          setTrainingMap(records);
          setTrainingFetchError(null);
        }
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
        setTrainingMap({});
        setTrainingFetchError('調教データの取得に失敗しました');
      }
    })();

    return () => controller.abort();
  }, [entries]);

  const updateHudPositions = useCallback(() => {
    if (!hudOpen || !tableContainerRef.current) {
      if (!hudOpen) setHudRowPositions([]);
      return;
    }
    const container = tableContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const positions: Array<{ horseId: string; top: number; height: number }> = [];
    for (const entry of entries) {
      const rowEl = rowRefs.current[entry.horseId];
      if (!rowEl) continue;
      const rect = rowEl.getBoundingClientRect();
      const top = rect.top - containerRect.top + scrollTop;
      positions.push({ horseId: entry.horseId, top, height: rect.height });
    }
    setHudRowPositions(positions);
  }, [entries, hudOpen]);

  useLayoutEffect(() => {
    if (!hudOpen) {
      setHudRowPositions([]);
      return;
    }
    updateHudPositions();
    const container = tableContainerRef.current;
    if (!container) return;

    const handle = () => updateHudPositions();
    container.addEventListener('scroll', handle, { passive: true });
    window.addEventListener('resize', handle);

    const ResizeObs = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null;
    const resizeObserver = ResizeObs ? new ResizeObs(() => updateHudPositions()) : null;
    resizeObserver?.observe(container);
    if (resizeObserver) {
      for (const entry of entries) {
        const rowEl = rowRefs.current[entry.horseId];
        if (rowEl) resizeObserver.observe(rowEl);
      }
    }

    const raf = requestAnimationFrame(updateHudPositions);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', handle);
      window.removeEventListener('resize', handle);
      resizeObserver?.disconnect();
    };
  }, [entries, hudOpen, trainingMap, updateHudPositions]);

  // 固定バーの表示条件: ヘッダーが隠れた時のみ表示
  const shouldShowSticky = showStickyStats;

  
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

  const lastRaceSpeedItems = useMemo(() => {
    if (!entries || entries.length === 0) {
      return [] as PrevRaceSpeedSummaryItem[];
    }

    const items: PrevRaceSpeedSummaryItem[] = [];
    for (const entry of entries) {
      const lastRace = entry.races?.[0];
      if (!lastRace || !lastRace.distance || !lastRace.time) {
        continue;
      }
      if (!lastRace.date) {
        continue;
      }
      const speed = calculateAverageSpeed(lastRace.distance, lastRace.time);
      if (!speed || !isFinite(speed) || speed <= 0) {
        continue;
      }
      items.push({
        horseId: entry.horseId,
        horseNo: entry.horseNo,
        name: entry.name,
        speed,
        track: lastRace.track,
        distance: lastRace.distance,
        surface: lastRace.surface,
        date: lastRace.date ?? undefined,
        raceName: lastRace.class ?? undefined,
      });
    }

    if (items.length === 0) {
      return [] as PrevRaceSpeedSummaryItem[];
    }

    return [...items].sort((a, b) => b.speed - a.speed);
  }, [entries]);

  const lastRaceMinus3FItems = useMemo(() => {
    if (!entries || entries.length === 0) {
      return [] as PrevRaceSpeedSummaryItem[];
    }

    const items: PrevRaceSpeedSummaryItem[] = [];
    for (const entry of entries) {
      const lastRace = entry.races?.[0];
      const minus = lastRace?.minus3FAvgSpeed;
      if (!lastRace || minus === undefined || minus === null) continue;
      if (!isFinite(minus)) continue;

      items.push({
        horseId: entry.horseId,
        horseNo: entry.horseNo,
        name: entry.name,
        speed: minus,
        track: lastRace.track,
        distance: lastRace.distance,
        surface: lastRace.surface,
        date: lastRace.date ?? undefined,
        raceName: lastRace.class ?? undefined,
      });
    }

    return items.sort((a, b) => b.speed - a.speed);
  }, [entries]);

  const speedSummaryItems = speedSummaryMode === 'avg' ? lastRaceSpeedItems : lastRaceMinus3FItems;
  const speedSummaryTitle = speedSummaryMode === 'avg' ? '前走平均時速' : '前走-3F平均速度';
  const canShowMinus3FSummary = lastRaceMinus3FItems.length > 0;
  // 前走同走馬の次走平均着順（レースレベル）: horseId -> { avg|null, used, total }
  const [prevRaceCohortAvgMap, setPrevRaceCohortAvgMap] = useState<Map<string, { avg: number | null; avgMargin: number | null; used: number; total: number; marginUsed: number }>>(new Map());
  // 前走レベルの前処理キャッシュ（prevRaceId単位）
  type PrevRaceLevelStats = {
    prevRaceId: string;
    prevDate?: string; // YYYYMMDD
    coRunners: Map<string, { nextFinish: number | null; marginLength: number | null; nextRaceId?: string }>; // 同走馬ごとの最初の次走の着順・着差
    totalCoRunners: number; // 対象馬を含む同走馬総数
  };
  const prevRaceLevelStatsCache = useRef<Map<string, PrevRaceLevelStats>>(new Map());
  // 前走レースID -> 頭数
  const [fieldSizeCache, setFieldSizeCache] = useState<Map<string, number>>(new Map());
  const [raceBasicsCache, setRaceBasicsCache] = useState<Map<string, RaceBasicInfo>>(new Map());
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
  type PreRaceLevelInfo = {
    avg: number | null;      // レース参加馬の前走以前平均賞金（万円/頭）
    used: number;            // 集計に利用した頭数
    total: number;           // レース頭数
  };
  const [preRaceLevelCache, setPreRaceLevelCache] = useState<Map<string, PreRaceLevelInfo>>(new Map());
  const [loadingPreRaceLevel, setLoadingPreRaceLevel] = useState<Set<string>>(new Set());
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
  const focusedHorseId = useHorseFocusStore(state => state.focusedHorseId);
  const focusHorse = useHorseFocusStore(state => state.focus);

  // 蛍光ペン風ハイライト色を賞金合計で切替
  const highlightColorFor = (total: number) => {
    if (!isFinite(total) || total <= 0) return 'rgba(203, 213, 225, 0.35)'; // slate-300
    if (total >= 8000) return 'rgba(245, 158, 11, 0.45)';   // amber-500
    if (total >= 4000) return 'rgba(250, 204, 21, 0.40)';   // yellow-400
    if (total >= 2000) return 'rgba(132, 204, 22, 0.35)';   // lime-500
    return 'rgba(56, 189, 248, 0.35)';                      // sky-400
  };

  // 単一レースのレースレベル（賞金）情報を取得してキャッシュへ反映
  const fetchRaceLevelInfo = async (targetRaceId: string, basics?: RaceBasicInfo) => {
    // 既にキャッシュ済み（有効値あり）なら何もしない
    if (prizeMoneyCache.has(targetRaceId)) {
      const cached = prizeMoneyCache.get(targetRaceId);
      if ((cached?.prizeMoney !== undefined) || (cached?.earnedMoney !== undefined)) return;
    }
    // ローディング中なら何もしない
    if (loadingPrizeMoney.has(targetRaceId)) return;

    setLoadingPrizeMoney(prev => new Set(prev).add(targetRaceId));
    try {
      const cachedBasics = basics ?? raceBasicsCache.get(targetRaceId);
      if (cachedBasics && (cachedBasics.totalPrizeMoney !== null && cachedBasics.totalPrizeMoney !== undefined || cachedBasics.totalEarnedMoney !== null && cachedBasics.totalEarnedMoney !== undefined)) {
        const horseCount = cachedBasics.fieldSize ?? cachedBasics.entryCount ?? cachedBasics.resultCount ?? 0;
        const info: RaceLevelInfo = {
          prizeMoney: cachedBasics.totalPrizeMoney ?? undefined,
          earnedMoney: cachedBasics.totalEarnedMoney ?? undefined,
          horseCount,
          avgPrize: horseCount > 0 && cachedBasics.totalPrizeMoney !== null && cachedBasics.totalPrizeMoney !== undefined
            ? Math.round((cachedBasics.totalPrizeMoney / horseCount) * 10) / 10
            : undefined,
          avgEarned: horseCount > 0 && cachedBasics.totalEarnedMoney !== null && cachedBasics.totalEarnedMoney !== undefined
            ? Math.round((cachedBasics.totalEarnedMoney / horseCount) * 10) / 10
            : undefined,
        };
        setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, info));
        return;
      }

      const admin = new AdminService();
      const entries = await admin.getRaceEntries(targetRaceId);
      if (entries.length === 0) {
        setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, {}));
        return;
      }

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
        return;
      }

      const raceDate: string | undefined = entries[0]?.date;
      if (!raceDate) {
        setPrizeMoneyCache(prev => new Map(prev).set(targetRaceId, {}));
        return;
      }

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
    } catch (error) {
    } finally {
      setLoadingPrizeMoney(prev => {
        const ns = new Set(prev);
        ns.delete(targetRaceId);
        return ns;
      });
    }
  };

  const fetchPreRaceLevelInfo = async (targetRaceId: string, raceDate?: string, fieldSizeHint?: number) => {
    if (!targetRaceId) return;
    if (preRaceLevelCache.has(targetRaceId)) return;
    if (loadingPreRaceLevel.has(targetRaceId)) return;

    setLoadingPreRaceLevel(prev => {
      const next = new Set(prev);
      next.add(targetRaceId);
      return next;
    });

    try {
      const admin = new AdminService();
      const beforeDate = raceDate ? normalizeDateStr(raceDate) : undefined;
      const limit = (() => {
        if (fieldSizeHint && fieldSizeHint > 0) {
          const padded = fieldSizeHint + 2;
          return Math.min(Math.max(padded, 18), 100);
        }
        return 100;
      })();
      const response = await admin.getRaceEntriesWithHistory(targetRaceId, {
        limit,
        beforeDate,
      });
      const entries = Array.isArray(response.entries) ? response.entries : [];
      const effectiveRaceDate = beforeDate || normalizeDateStr(response.raceDate || undefined);
      const perHorseAvgs = entries.map(entry => {
        const history = Array.isArray(entry.recentResults) ? entry.recentResults : [];
        return calcAveragePrizeBeforeRace(history, effectiveRaceDate);
      });
      const total = entries.length;
      const sum = perHorseAvgs.reduce((acc, val) => acc + (isFinite(val) ? val : 0), 0);
      const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : null;

      setPreRaceLevelCache(prev => {
        const next = new Map(prev);
        next.set(targetRaceId, { avg, used: total, total });
        return next;
      });
    } catch (error) {
      setPreRaceLevelCache(prev => {
        if (prev.has(targetRaceId)) return prev;
        const next = new Map(prev);
        next.set(targetRaceId, { avg: null, used: 0, total: 0 });
        return next;
      });
    } finally {
      setLoadingPreRaceLevel(prev => {
        const next = new Set(prev);
        next.delete(targetRaceId);
        return next;
      });
    }
  };

  // レースの前走平均時速／実測平均時速を算出しキャッシュ
  const fetchRaceSpeedMetricsBatch = async (raceIds: string[]) => {
    const idsToFetch = raceIds.filter((rid) => {
      if (!rid) return false;
      if (loadingRaceSpeed.has(rid)) return false;
      const cached = raceSpeedCache.get(rid);
      if (!cached) return true;
      const hasMetrics = (cached.actualAvg !== undefined && cached.actualAvg !== null)
        || (cached.prevAvg !== undefined && cached.prevAvg !== null)
        || (cached.winnerKmh !== undefined && cached.winnerKmh !== null);
      return !hasMetrics;
    });

    if (idsToFetch.length === 0) return;

    setLoadingRaceSpeed(prev => {
      const ns = new Set(prev);
      idsToFetch.forEach(id => ns.add(id));
      return ns;
    });

    try {
      const admin = new AdminService();
      const metrics = await admin.getRaceSpeedMetrics(idsToFetch, { limit: 1 });
      const metricMap = new Map(metrics.map(m => [m.raceId, m] as const));

      setRaceSpeedCache(prev => {
        const next = new Map(prev);
        idsToFetch.forEach(id => {
          const row = metricMap.get(id);
          if (row) {
            next.set(id, {
              actualAvg: row.actualAvg ?? undefined,
              countActual: row.countActual || undefined,
              prevAvg: row.prevAvg ?? undefined,
              countPrev: row.countPrev || undefined,
              winnerKmh: row.winnerKmh ?? undefined,
            });
          } else {
            next.set(id, {} as RaceSpeedInfo);
          }
        });
        return next;
      });
    } finally {
      setLoadingRaceSpeed(prev => {
        const ns = new Set(prev);
        idsToFetch.forEach(id => ns.delete(id));
        return ns;
      });
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
            cushionValue: typeof race.cushionValue === 'number' ? race.cushionValue : undefined,
            date: race.date
          });

          // 同日・同会場の他レースを取得
          try {
            const sameDate = race.date; // YYYYMMDD
            const racesSameDate = await admin.getRaces(sameDate);
            setAllRacesSameDate(racesSameDate || []);
            const venues = Array.from(new Set((racesSameDate || []).map(r => r.venue)));
            setVenuesOnDate(venues);
            setSelectedVenue(race.venue);
            const sameVenue = (racesSameDate || []).filter(r => r.venue === race.venue);
            sameVenue.sort((a, b) => a.raceNo - b.raceNo);
            setSiblingRaces(sameVenue);
          } catch (e) {
            setAllRacesSameDate([]);
            setVenuesOnDate([]);
            setSelectedVenue("");
            setSiblingRaces([]);
          }
        }

        const beforeDate = (race && typeof race.date === 'string') ? race.date.replace(/-/g, '') : undefined;
        const historyResponse = await admin.getRaceEntriesWithHistory(raceId as string, {
          limit: 5,
          beforeDate,
        });
        const es = historyResponse.entries;
        const resultsMap = new Map<string, RaceResultData[]>(
          es.map(e => [e.horseId, (e.recentResults || []).slice(0, 5)])
        );

        // 前走のユニークなレースIDを収集
        const prevRaceDateMapForPreLevel = new Map<string, string>();
        const prevRaceIdSetAll = new Set<string>();
        const prevRaceIdSetForPreLevel = new Set<string>();
        es.forEach(e => {
          const recentList = resultsMap.get(e.horseId) || [];
          recentList.forEach((r, idx) => {
            if (!r?.raceId) return;
            prevRaceIdSetAll.add(r.raceId);
            if (idx < 2) {
              prevRaceIdSetForPreLevel.add(r.raceId);
              const normalized = normalizeDateStr(r.date);
              if (normalized && !prevRaceDateMapForPreLevel.has(r.raceId)) {
                prevRaceDateMapForPreLevel.set(r.raceId, normalized);
              }
            }
          });
        });

        const prevRaceIds = Array.from(prevRaceIdSetAll);
        const prevRaceIdsForPreLevel = Array.from(prevRaceIdSetForPreLevel);

        // 頭数を一括取得（races.fieldSize → race_results件数 → race_entries件数 の順でフォールバック）
        let basicsMap = new Map<string, RaceBasicInfo>();
        if (prevRaceIds.length > 0) {
          const basics = await admin.getRaceBasics(prevRaceIds);
          basicsMap = new Map(basics.map(item => [item.raceId, item] as const));
          setRaceBasicsCache(basicsMap);
        } else {
          setRaceBasicsCache(new Map());
        }

        const fsMap = new Map<string, number>();
        prevRaceIds.forEach(rid => {
          const info = basicsMap.get(rid);
          const val = info?.fieldSize ?? info?.entryCount ?? info?.resultCount ?? fieldSizeCache.get(rid) ?? 0;
          fsMap.set(rid, val || 0);
        });
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
              isFeature: !!(r.raceName?.match(/G[1-3]|重賞|特別/)),
              direction: r.direction,
              minus3FAvgSpeed: (typeof r.minusThreeFurlongAvgSpeed === 'number' && isFinite(r.minusThreeFurlongAvgSpeed))
                ? r.minusThreeFurlongAvgSpeed
                : null,
              cushionValue: (typeof r.cushionValue === 'number' && Number.isFinite(r.cushionValue))
                ? r.cushionValue
                : undefined
            };
          });

          return {
            horseId: e.horseId,
            frameNo: e.frameNo,
            horseNo: e.horseNo,
            name: horse?.name || `馬${e.horseNo || e.horseId}`,
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

        // --- レースレベル（前走同走馬の次走平均着順）算出 ---
        try {
          const normalize = (s?: string) => (s || '').replace(/[^0-9]/g, '').slice(0, 8);
          const calcDate = beforeDate ? normalize(beforeDate) : normalize(raceInfo?.date); // beforeDate 未指定時も当日までに制限
          // horseId -> 前走の {raceId, date}
          const prev1ByHorse = new Map<string, { raceId: string; date?: string }>();
          es.forEach(e => {
            const r0 = (resultsMap.get(e.horseId) || [])[0];
            if (r0) prev1ByHorse.set(e.horseId, { raceId: r0.raceId, date: normalize(r0.date) });
          });

          // 直近1走（「前走」）のユニークなレースID
          const prev1RaceIds = Array.from(new Set(Array.from(prev1ByHorse.values()).map(v => v.raceId)));

          // 各レースIDに対して個別にAPIを呼び出し（当該レース日以前のみを対象）
          const coRunnerStats: any[] = [];
          for (const raceId of prev1RaceIds) {
            try {
              const appliedBeforeDate = calcDate || undefined;
              const results = await admin.getCoRunnerNextResults(raceId, calcDate || undefined); // 平均算出も当日以前で揃える

              // 新しいAPIのレスポンス形式に合わせて変換
              if (results) {
                // 新しいAPIレスポンス形式をチェック
                const nextResults = (results as any).nextResults || results; // 後方互換性
                const totalPrevRaceEntries = (results as any).totalPrevRaceEntries || (nextResults.length + 1);

                if (Array.isArray(nextResults) && nextResults.length > 0) {
                const runners = nextResults.map((r: any) => ({
                  horseId: r.horseId,
                  nextFinish: r.finishPosition,
                  nextRaceId: r.raceId,
                  marginLength: parseMarginToLength(r.margin ?? r.nextMargin ?? null),
                }));
                  coRunnerStats.push({
                    raceId: raceId,
                    runners: runners,
                    totalCoRunners: totalPrevRaceEntries
                  });
                } else if (totalPrevRaceEntries > 0) {
                  // 次走結果がない場合でも前走の頭数情報は保持
                  coRunnerStats.push({
                    raceId: raceId,
                    runners: [],
                    totalCoRunners: totalPrevRaceEntries
                  });
                }
              }
            } catch (error) {
            }
          }

          coRunnerStats.forEach(item => {
            const map = new Map<string, { nextFinish: number | null; marginLength: number | null; nextRaceId?: string }>();
            item.runners.forEach(r => {
              map.set(r.horseId, {
                nextFinish: typeof r.nextFinish === 'number' && isFinite(r.nextFinish) && r.nextFinish > 0 ? r.nextFinish : null,
                marginLength: typeof r.marginLength === 'number' && isFinite(r.marginLength) && r.marginLength >= 0 ? r.marginLength : null,
                nextRaceId: r.nextRaceId ?? undefined,
              });
            });
            prevRaceLevelStatsCache.current.set(item.raceId, {
              prevRaceId: item.raceId,
              prevDate: item.prevDate ?? undefined,
              coRunners: map,
              totalCoRunners: item.totalCoRunners,
            });
          });

          // APIから返らなかったレースは空データとしてキャッシュ
          prev1RaceIds.forEach(rid => {
            if (!prevRaceLevelStatsCache.current.has(rid)) {
              prevRaceLevelStatsCache.current.set(rid, {
                prevRaceId: rid,
                prevDate: undefined,
                coRunners: new Map(),
                totalCoRunners: 0,
              });
            }
          });

          // 馬ごとの平均値を算出
          const perHorse = new Map<string, { avg: number | null; avgMargin: number | null; used: number; total: number; marginUsed: number }>();
          es.forEach(e => {
            const p = prev1ByHorse.get(e.horseId);
            if (!p) return;
            const stats = prevRaceLevelStatsCache.current.get(p.raceId);
            if (!stats) return;
            const total = Math.max(0, stats.totalCoRunners - 1); // 自馬を除く
            let sum = 0; let used = 0;
            let marginSum = 0; let marginUsed = 0;
            for (const [hid, st] of stats.coRunners.entries()) {
              if (hid === e.horseId) continue; // 自馬を除外
              if (typeof st.nextFinish === 'number' && isFinite(st.nextFinish) && st.nextFinish > 0) {
                sum += st.nextFinish;
                used += 1;
              }
              if (st.marginLength !== null && st.marginLength !== undefined && isFinite(st.marginLength) && st.marginLength >= 0) {
                marginSum += st.marginLength;
                marginUsed += 1;
              }
            }
            const avg = used > 0 ? Math.round((sum / used) * 10) / 10 : null;
            const avgMargin = marginUsed > 0 ? Math.round((marginSum / marginUsed) * 100) / 100 : null;
            perHorse.set(e.horseId, { avg, avgMargin, used, total, marginUsed });
          });

          setPrevRaceCohortAvgMap(perHorse);

          // ランキング項目生成（平均着順が小さいほど上位）。平均未算出(null)は末尾へ。
          const items = sortedEntries.map(h => {
            const m = perHorse.get(h.horseId) || { avg: null, avgMargin: null, used: 0, total: 0, marginUsed: 0 };
            const prevId = (h.races?.[0]?.raceId) || '';
            // entryByHorseIdから馬名を取得し、取得できない場合はフォールバック
            const entry = entryByHorseId.get(h.horseId);
            const horseName = entry?.name || h.name || `馬${h.horseNo}`;
            return {
              horseId: h.horseId,
              horseNo: h.horseNo,
              name: horseName,
              avgPlace: m.avg,
              avgMargin: m.avgMargin ?? null,
              used: m.used,
              total: m.total,
              marginUsed: m.marginUsed ?? 0,
              prevRaceId: prevId,
            };
          });
          const ranked = items
            .slice()
            .sort((a, b) => {
              const av = a.avgPlace === null ? Number.POSITIVE_INFINITY : a.avgPlace;
              const bv = b.avgPlace === null ? Number.POSITIVE_INFINITY : b.avgPlace;
              if (av !== bv) return av - bv; // 小さい方が上
              if (a.used !== b.used) return b.used - a.used; // サンプル数で優先
              return a.horseNo - b.horseNo;
            })
            .map((it, idx) => ({ rank: idx + 1, ...it }));

          // 左カラム / サイドバーへ供給
          useRaceLevelStore.getState().setItems(ranked);
        } catch (e) {
          setPrevRaceCohortAvgMap(new Map());
          useRaceLevelStore.getState().setItems([]);
        }

        // 前走平均時速（出走馬の直近1走の時速の平均）
        try {
          let sum = 0;
          let cnt = 0;
          let sumMinus = 0;
          let cntMinus = 0;
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
            const minus = (r0 as any)?.minusThreeFurlongAvgSpeed;
            if (typeof minus === 'number' && isFinite(minus)) {
              sumMinus += minus;
              cntMinus += 1;
            }
          });
          setPrevAvgSpeed(cnt > 0 ? Math.round((sum / cnt) * 10) / 10 : null);
          setPrevAvgSpeedCount(cnt);
          setPrevMinus3FAvgSpeed(cntMinus > 0 ? Math.round((sumMinus / cntMinus) * 10) / 10 : null);
          setPrevMinus3FAvgSpeedCount(cntMinus);
        } catch (e) {
          setPrevAvgSpeed(null);
          setPrevAvgSpeedCount(0);
          setPrevMinus3FAvgSpeed(null);
          setPrevMinus3FAvgSpeedCount(0);
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
          setHasResults(false);
        }

        // 追加: 前走レースの賞金情報をページ読み込み時に一括取得
        // 過度な同時接続を避けるため、6件ずつ並列化
        (async () => {
          const chunkSize = 6;
          for (let i = 0; i < prevRaceIds.length; i += chunkSize) {
            const chunk = prevRaceIds.slice(i, i + chunkSize);
            await Promise.all(chunk.map(rid => fetchRaceLevelInfo(rid, basicsMap.get(rid))));
          }
        })();

        (async () => {
          const chunkSize = 4;
          for (let i = 0; i < prevRaceIdsForPreLevel.length; i += chunkSize) {
            const chunk = prevRaceIdsForPreLevel.slice(i, i + chunkSize);
            await Promise.all(chunk.map(rid => {
              const fieldSizeHint = fsMap.get(rid) ?? basicsMap.get(rid)?.fieldSize ?? basicsMap.get(rid)?.entryCount ?? basicsMap.get(rid)?.resultCount;
              return fetchPreRaceLevelInfo(rid, prevRaceDateMapForPreLevel.get(rid), fieldSizeHint ?? undefined);
            }));
          }
        })();

        // 追加: 前走レースの前走平均時速・実測平均時速を一括取得
        (async () => {
          const chunkSize = 12;
          for (let i = 0; i < prevRaceIds.length; i += chunkSize) {
            const chunk = prevRaceIds.slice(i, i + chunkSize);
            await fetchRaceSpeedMetricsBatch(chunk);
          }
        })();

        // 平均タイム（過去1年・同クラス/同距離/同馬場）
        try {
          const dateStr = (race?.date || '').replace(/-/g, '');
          const inferredClass = inferClassFromName(race?.raceName);
          const effectiveClassCond = inferredClass || race?.className;
          setAvgMinus3FSpeed(null);
          setAvgMinus3FCount(0);
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
              const results = Array.isArray((statsRes as any).results) ? (statsRes as any).results : [];
              const last3fSeconds = results
                .map((r: any) => parseLastThreeFToSeconds(r.lastThreeFurlong ?? r.last3f ?? r.lastThreeF ?? r.last_three_f ?? null))
                .filter((sec: number | null): sec is number => sec !== null && isFinite(sec) && sec > 0);
              if (last3fSeconds.length > 0) {
                const avgLast3F = last3fSeconds.reduce((acc, cur) => acc + cur, 0) / last3fSeconds.length;
                const speed = speedFromSeconds(LAST_THREE_F_DISTANCE_M, avgLast3F);
                setAvgMinus3FSpeed(speed);
                setAvgMinus3FCount(last3fSeconds.length);
              }
            }
          } else {
            setAvgTimeSec(null);
            setAvgTimeCount(0);
            setAvgMinus3FSpeed(null);
            setAvgMinus3FCount(0);
          }
        } catch (e) {
          setAvgTimeSec(null);
          setAvgTimeCount(0);
          setAvgMinus3FSpeed(null);
          setAvgMinus3FCount(0);
        }
      } catch (err) {
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

  const formatKmh = (value: number | null | undefined): string => {
    if (value === null || value === undefined || !isFinite(value)) return '-';
    return `${Math.round(value * 10) / 10}`;
  };

  const formatTrainingDate = (date: string | null | undefined): string => {
    if (!date) return '';
    if (date.includes('-')) {
      const [y, m, d] = date.split('-');
      return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
    }
    if (date.length === 8) {
      return `${parseInt(date.slice(4, 6), 10)}/${parseInt(date.slice(6, 8), 10)}`;
    }
    return date;
  };

  const formatTrainingTime = (time: string | null | undefined): string => {
    if (!time) return '';
    const trimmed = time.trim();
    if (!trimmed) return '';
    if (trimmed.includes(':')) {
      const [h, m] = trimmed.split(':');
      return `${String(parseInt(h || '0', 10)).padStart(2, '0')}:${String(parseInt(m || '0', 10)).padStart(2, '0')}`;
    }
    if (/^\d{3,4}$/.test(trimmed)) {
      const h = trimmed.length === 3 ? trimmed.slice(0, 1) : trimmed.slice(0, trimmed.length - 2);
      const m = trimmed.slice(-2);
      return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
    }
    return trimmed;
  };

  const parseTrainingRecordDate = (record: TrainingRecordResponse): Date | null => {
    const rawDate = record.trainingDate;
    if (!rawDate) return null;
    let normalizedDate: string | null = null;
    if (rawDate.includes('-')) {
      normalizedDate = rawDate;
    } else if (/^\d{8}$/.test(rawDate)) {
      normalizedDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    }

    if (!normalizedDate) return null;

    const formattedTime = formatTrainingTime(record.trainingTime);
    let hours = 0;
    let minutes = 0;
    if (formattedTime) {
      const [h, m] = formattedTime.split(':');
      hours = Number.parseInt(h, 10) || 0;
      minutes = Number.parseInt(m, 10) || 0;
    }

    const isoString = `${normalizedDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const getTrainingRecordTimestamp = (record: TrainingRecordResponse): number | null => {
    const date = parseTrainingRecordDate(record);
    return date ? date.getTime() : null;
  };

  const formatTimeValue = (value: number | null | undefined): string | null => {
    if (value === null || value === undefined || !isFinite(value)) return null;
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded.toFixed(1)}` : `${rounded}`;
  };

  const formatLapValue = (value: number | null | undefined): string | null => {
    return formatTimeValue(value);
  };

  const formatTrainingDisplay = (record: TrainingRecordResponse): string => {
    const parts: string[] = [];
    const date = formatTrainingDate(record.trainingDate);
    const time = formatTrainingTime(record.trainingTime);
    if (date || time || record.weekday) {
      const dateSegments: string[] = [];
      if (date) dateSegments.push(date);
      if (record.weekday) dateSegments.push(`(${record.weekday})`);
      if (time) dateSegments.push(time);
      parts.push(dateSegments.join(' ').trim());
    }

    const locationParts = [record.facility || ''];
    if (record.course) locationParts.push(record.course);
    if (record.turn) locationParts.push(record.turn);
    const location = locationParts.filter(Boolean).join(' ');
    if (location) parts.push(location);

    const snippets: string[] = [];
    const pushSegment = (label: string, timeValue: unknown, lapValue: unknown) => {
      const formattedTime = formatTimeValue(extractNumber(timeValue));
      if (!formattedTime) return;
      const formattedLap = formatLapValue(extractNumber(lapValue));
      snippets.push(`${label} ${formattedTime}${formattedLap ? ` (${formattedLap})` : ''}`);
    };

    const woodOrder: Array<[string, unknown, unknown]> = [
      ['6F', record.time6f, record.lap6],
      ['5F', record.time5f, record.lap5],
      ['4F', record.time4f, record.lap4],
      ['3F', record.time3f, record.lap3],
      ['2F', record.time2f, record.lap2],
      ['1F', record.time1f, record.lap1],
    ];

    const defaultOrder: Array<[string, unknown, unknown]> = [
      ['4F', record.time4f ?? record.time5f ?? record.time6f, record.lap4],
      ['3F', record.time3f, record.lap3],
      ['2F', record.time2f, record.lap2],
      ['1F', record.time1f, record.lap1],
    ];

    const segments = record.trainingType === 'wood' ? woodOrder : defaultOrder;
    segments.forEach(([label, t, lap]) => pushSegment(label, t, lap));
    if (snippets.length > 0) parts.push(snippets.join(' / '));

    return parts.join(' ｜ ');
  };

  const renderTrainingRecordsTable = (records: TrainingRecordResponse[]) => {
    return (
      <Table size="small" sx={{ '& th': { fontSize: '0.75rem', py: 0.5, px: 0.75, whiteSpace: 'nowrap' }, '& td': { fontSize: '0.75rem', py: 0.5, px: 0.75, whiteSpace: 'nowrap' } }}>
        <TableHead>
          <TableRow>
            <TableCell>日付</TableCell>
            <TableCell>時刻</TableCell>
            <TableCell>区分</TableCell>
            <TableCell>コース</TableCell>
            <TableCell align="center">6F</TableCell>
            <TableCell align="center">5F</TableCell>
            <TableCell align="center">4F</TableCell>
            <TableCell align="center">3F</TableCell>
            <TableCell align="center">2F</TableCell>
            <TableCell align="center">1F</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {records.map((record) => {
            const dateLabel = formatTrainingDate(record.trainingDate) || '-';
            const weekdayNode = renderWeekdayHighlight(record.weekday);
            const timeLabel = formatTrainingTime(record.trainingTime) || '-';
            const typeLabel = record.trainingType === 'hill' ? '坂路' : 'ウッド';
            const courseLabel = [record.facility, record.course, record.turn].filter(Boolean).join(' ') || '-';
            return (
              <TableRow key={record.id}>
                <TableCell>
                  <Box component="span">{dateLabel}</Box>
                  {weekdayNode}
                </TableCell>
                <TableCell>{timeLabel}</TableCell>
                <TableCell>{typeLabel}</TableCell>
                <TableCell>{courseLabel}</TableCell>
                <TableCell align="center">{formatSectionTime(record, 'time6f', 'lap6')}</TableCell>
                <TableCell align="center">{formatSectionTime(record, 'time5f', 'lap5')}</TableCell>
                <TableCell align="center">{formatSectionTime(record, 'time4f', 'lap4')}</TableCell>
                <TableCell align="center">{formatSectionTime(record, 'time3f', 'lap3')}</TableCell>
                <TableCell align="center">{formatSectionTime(record, 'time2f', 'lap2')}</TableCell>
                <TableCell align="center">{formatSectionTime(record, 'time1f', 'lap1')}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  const extractNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const formatSectionTime = (
    record: TrainingRecordResponse,
    timeKey: keyof TrainingRecordResponse,
    lapKey: keyof TrainingRecordResponse
  ): string => {
    const time = formatTimeValue(extractNumber(record[timeKey]));
    const lap = formatLapValue(extractNumber(record[lapKey]));
    if (!time) return '-';
    return lap ? `${time} (${lap})` : time;
  };

  const handleToggleCoRunners = async (entry: HorseEntry) => {
    const horseId = entry.horseId;
    const isCurrentlyExpanded = !!expandedCoRunnerMap[horseId];
    const nextExpanded = !isCurrentlyExpanded;

    setExpandedCoRunnerMap(prev => {
      const next = { ...prev };
      if (nextExpanded) {
        next[horseId] = true;
      } else {
        delete next[horseId];
      }
      return next;
    });

    if (!nextExpanded) {
      return;
    }

    const prevRace = entry.races?.[0];
    if (!prevRace || !prevRace.raceId) {
      setCoRunnerDetails(prev => ({
        ...prev,
        [horseId]: {
          status: 'error',
          error: '前走データがありません',
        },
      }));
      return;
    }

    const cached = coRunnerRaceCache.current.get(prevRace.raceId);
    if (cached) {
      setCoRunnerDetails(prev => ({
        ...prev,
        [horseId]: {
          status: 'loaded',
          raceId: prevRace.raceId,
          data: cached,
        },
      }));
      return;
    }

    const currentDetail = coRunnerDetails[horseId];
    if (currentDetail && currentDetail.status === 'loading') {
      return;
    }

    setCoRunnerDetails(prev => ({
      ...prev,
      [horseId]: {
        status: 'loading',
        raceId: prevRace.raceId,
      },
    }));

    try {
      const admin = new AdminService();
      const currentRaceDate = raceInfo?.date; // 現在のレースの日付を取得
      const response = await admin.getCoRunnerNextResults(prevRace.raceId, currentRaceDate);

      // 新しいAPIレスポンス形式に対応
      const results = (response as any)?.nextResults || response || [];

      const sorted = (Array.isArray(results) ? results : []).slice().sort((a, b) => {
        const aPos = a.finishPosition ?? 9999;
        const bPos = b.finishPosition ?? 9999;
        if (aPos !== bPos) return aPos - bPos;
        // 次走結果なので人気順ソートは削除
        return 0;
      });
      coRunnerRaceCache.current.set(prevRace.raceId, sorted);
      setCoRunnerDetails(prev => ({
        ...prev,
        [horseId]: {
          status: 'loaded',
          raceId: prevRace.raceId,
          data: sorted,
        },
      }));
    } catch (error) {
      setCoRunnerDetails(prev => ({
        ...prev,
        [horseId]: {
          status: 'error',
          raceId: prevRace.raceId,
          error: '同走馬データの取得に失敗しました',
        },
      }));
    }
  };

  const collapseAllCoRunners = useCallback(() => {
    setExpandedCoRunnerMap({});
  }, []);

  const renderCoRunnerSection = (entry: HorseEntry) => {
    const prevRace = entry.races?.[0];
    if (!prevRace || !prevRace.raceId) {
      return (
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          前走データがありません。
        </Typography>
      );
    }

    const detail = coRunnerDetails[entry.horseId];
    if (!detail || detail.status === 'loading') {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ color: '#475569' }}>
            読み込み中...
          </Typography>
        </Box>
      );
    }

    if (detail.status === 'error') {
      return (
        <Typography variant="body2" color="error">
          {detail.error || '同走馬データの取得に失敗しました。'}
        </Typography>
      );
    }

    const rows = detail.data || [];
    if (rows.length === 0) {
      return (
        <Typography variant="body2" sx={{ color: '#64748b' }}>
          同走馬データがありません。
        </Typography>
      );
    }

    const raceLabel = formatRaceMeta(prevRace);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
          前走同走馬の次走成績: {raceLabel}
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
          <Table size="small" sx={{ minWidth: 400, '& th, & td': { px: 1, py: 0.5, fontSize: '0.8rem' } }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 30, maxWidth: 30 }}>着</TableCell>
                <TableCell sx={{ width: 70, maxWidth: 70 }}>馬名</TableCell>
                <TableCell align="center" sx={{ width: 10, maxWidth: 10 }}>クラス</TableCell>
                <TableCell align="center" sx={{ width: 60, maxWidth: 60 }}>着差</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const isSelf = row.horseId === entry.horseId;
                const alsoRunning = !isSelf && currentRaceHorseIds.has(row.horseId);
                const displayName = getResultHorseName(row);
                const oddsLabel = row.odds ? `${row.odds.toFixed(1)}倍` : '-';
                const popularityLabel = (typeof row.popularity === 'number' && row.popularity > 0)
                  ? `${row.popularity}人気`
                  : oddsLabel;
                return (
                  <TableRow
                    key={`${row.raceId}-${row.horseId}`}
                    sx={{
                      bgcolor: isSelf
                        ? 'rgba(59, 130, 246, 0.12)'
                        : alsoRunning
                          ? 'rgba(234, 179, 8, 0.12)'
                          : undefined,
                    }}
                  >
                    <TableCell align="center" sx={{ fontWeight: isSelf ? 700 : undefined }}>{row.finishPosition ?? '-'}</TableCell>
                    <TableCell sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      fontWeight: isSelf ? 700 : 600,
                      minWidth: 80
                    }}>
                      <span style={{
                        flex: 1
                      }}>{displayName}</span>
                      {alsoRunning && (
                        <Chip label="出走中" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ width: 60, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(row as any).className || '-'}</TableCell>
                    <TableCell align="center" sx={{ width: 60, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.margin || '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const toggleCoRunnerByHorseId = (horseId: string) => {
    const entry = entryByHorseId.get(horseId);
    if (entry) {
      handleToggleCoRunners(entry);
    }
  };

  const renderCoRunnerByHorseId = (horseId: string) => {
    const entry = entryByHorseId.get(horseId);
    if (!entry) {
      return <Typography variant="body2" sx={{ color: '#64748b' }}>対象馬のデータがありません。</Typography>;
    }
    return renderCoRunnerSection(entry);
  };

  const trainingRecordsWithinWindow = useMemo(() => {
    const now = Date.now();
    const result: Record<string, TrainingRecordResponse[]> = {};
    for (const [horseName, records] of Object.entries(trainingMap)) {
      if (!records || records.length === 0) continue;
      const enriched = records
        .map((record) => ({ record, timestamp: getTrainingRecordTimestamp(record) }))
        .filter((item) => item.timestamp !== null && Math.abs(now - (item.timestamp as number)) <= TRAINING_WINDOW_MS)
        .sort((a, b) => (b.timestamp! - a.timestamp!))
        .map((item) => item.record);
      if (enriched.length > 0) {
        result[horseName] = enriched;
      }
    }
    return result;
  }, [trainingMap]);

  const entriesWithTraining = useMemo(() => {
    return entries.map((entry) => ({ entry, records: trainingRecordsWithinWindow[entry.name] || [] }));
  }, [entries, trainingRecordsWithinWindow]);

  const hasAnyTrainingData = useMemo(() => entriesWithTraining.some(item => item.records.length > 0), [entriesWithTraining]);

  const hudRowHeightMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const { horseId, height } of hudRowPositions) {
      map.set(horseId, height);
    }
    return map;
  }, [hudRowPositions]);

  const entryByHorseId = useMemo(() => {
    const map = new Map<string, HorseEntry>();
    for (const entry of entries) {
      map.set(entry.horseId, entry);
    }
    return map;
  }, [entries]);

  const currentRaceHorseIds = useMemo(() => new Set(entries.map(entry => entry.horseId)), [entries]);

  const getResultHorseName = (result: RaceResultData): string => {
    return (
      (result as any).horseName ||
      (result as any).horse?.name ||
      (result as any).name ||
      result.horseId
    );
  };

  const formatRaceMeta = (race?: RaceDetail): string => {
    if (!race) return '前走情報なし';
    const dateLabel = formatTrainingDate(race.date ?? '') || '-';
    const parts = [
      dateLabel ? `${dateLabel}` : null,
      race.track || null,
      race.surface ? `${race.surface}` : null,
      race.distance ? `${race.distance}m` : null,
      race.class || null,
    ].filter(Boolean);
    return parts.join(' ');
  };

  const top4fByType = useMemo(() => {
    const rankings: Record<'hill' | 'wood', TrainingRankingItem[]> = { hill: [], wood: [] };

    for (const entry of entries) {
      const records = trainingRecordsWithinWindow[entry.name] || [];
      if (!records.length) continue;

      (['wood', 'hill'] as const).forEach((type) => {
        let best: TrainingRankingItem | null = null;
        for (const record of records) {
          if (record.trainingType !== type) continue;
          const fourF = extractNumber(record.time4f ?? record.time5f ?? record.time6f ?? null);
          if (fourF === null) continue;
          const candidate: TrainingRankingItem = { entry, record, fourFTime: fourF };
          if (!best) {
            best = candidate;
            continue;
          }
          if (fourF < best.fourFTime) {
            best = candidate;
            continue;
          }
          if (fourF === best.fourFTime) {
            const tsCurrent = getTrainingRecordTimestamp(record) ?? 0;
            const tsBest = getTrainingRecordTimestamp(best.record) ?? 0;
            if (tsCurrent > tsBest) {
              best = candidate;
            }
          }
        }

        if (best) {
          rankings[type].push(best);
        }
      });
    }

    const comparator = (a: TrainingRankingItem, b: TrainingRankingItem) => {
      if (a.fourFTime !== b.fourFTime) return a.fourFTime - b.fourFTime;
      return a.entry.horseNo - b.entry.horseNo;
    };

    return {
      wood: rankings.wood.sort(comparator).slice(0, TRAINING_RANKING_LIMIT),
      hill: rankings.hill.sort(comparator).slice(0, TRAINING_RANKING_LIMIT),
    };
  }, [entries, trainingRecordsWithinWindow]);

  const renderRankingTable = (type: 'wood' | 'hill', label: string) => {
    const items = top4fByType[type];
    if (!items.length) return null;
    const includeSixF = type === 'wood';
    const includeFiveF = type === 'wood';
    return (
      <Box sx={{ flex: 1, minWidth: { xs: '100%', sm: 0 } }} key={`ranking-${type}`}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1f2937', mb: 0.5 }}>
          {label}
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto' }}>
          <Table size="small" sx={{ '& th, & td': { whiteSpace: 'nowrap', fontSize: '0.8rem', py: 0.5, px: 0.75 } }}>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: 56 }}>順位</TableCell>
                <TableCell>馬名</TableCell>
                {includeSixF && <TableCell align="center">6F</TableCell>}
                {includeFiveF && <TableCell align="center">5F</TableCell>}
                <TableCell align="center">4F</TableCell>
                <TableCell align="center">3F</TableCell>
                <TableCell align="center">2F</TableCell>
                <TableCell align="center">1F</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={`ranking-${type}-${item.entry.horseId}-${item.record.id ?? idx}` }>
                  <TableCell align="center">{idx + 1}</TableCell>
                  <TableCell>{`${item.entry.horseNo}-${item.entry.name}`}</TableCell>
                  {includeSixF && (
                    <TableCell align="center">{formatSectionTime(item.record, 'time6f', 'lap6')}</TableCell>
                  )}
                  {includeFiveF && (
                    <TableCell align="center">{formatSectionTime(item.record, 'time5f', 'lap5')}</TableCell>
                  )}
                  <TableCell align="center">{formatSectionTime(item.record, 'time4f', 'lap4')}</TableCell>
                  <TableCell align="center">{formatSectionTime(item.record, 'time3f', 'lap3')}</TableCell>
                  <TableCell align="center">{formatSectionTime(item.record, 'time2f', 'lap2')}</TableCell>
                  <TableCell align="center">{formatSectionTime(item.record, 'time1f', 'lap1')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // 前走レベル（前走以前の平均賞金/頭ベース）ランキング（テーブル外に表示）
  type PrevRankItem = { rank: number; horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string };
  const prevRankList: PrevRankItem[] = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const items = entries.map((h) => {
      const prev = h.races?.[0];
      if (!prev) return null;
      const info = preRaceLevelCache.get(prev.raceId);
      const avg = info?.avg;
      if (typeof avg !== 'number' || !isFinite(avg)) return null;
      return { horseId: h.horseId, horseNo: h.horseNo, name: h.name, avg, raceId: prev.raceId, margin: prev.margin || undefined };
    }).filter(Boolean) as {horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string}[];
    items.sort((a, b) => b.avg - a.avg);
    return items.map((it, idx) => ({ ...it, rank: idx + 1 }));
  }, [entries, preRaceLevelCache]);

  const prev2RankList: PrevRankItem[] = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    const items = entries.map((h) => {
      const prev2 = h.races?.[1];
      if (!prev2) return null;
      const info = preRaceLevelCache.get(prev2.raceId);
      const avg = info?.avg;
      if (typeof avg !== 'number' || !isFinite(avg)) return null;
      return { horseId: h.horseId, horseNo: h.horseNo, name: h.name, avg, raceId: prev2.raceId, margin: prev2.margin || undefined };
    }).filter(Boolean) as {horseId: string; horseNo: number; name: string; avg: number; raceId: string; margin?: string}[];
    items.sort((a, b) => b.avg - a.avg);
    return items.map((it, idx) => ({ ...it, rank: idx + 1 }));
  }, [entries, preRaceLevelCache]);

  // 右サイド用ストアに反映（PC常時表示用）
  useEffect(() => {
    const setPrev = useRaceUiStore.getState().setItemsPrev;
    const setPrev2 = useRaceUiStore.getState().setItemsPrev2;
    setPrev(prevRankList);
    setPrev2(prev2RankList);
    return () => {
      // クリアは不要だが、別レース遷移時のチラつきを抑えるために維持
    };
  }, [prevRankList, prev2RankList]);

  const cushionStats = useMemo(() => {
    const createEmptyBuckets = (): Record<CushionRangeBin, FinishCounts> => ({
      lte_7_9: [0, 0, 0, 0],
      '8_0_8_9': [0, 0, 0, 0],
      '9_0_9_9': [0, 0, 0, 0],
      gte_10_0: [0, 0, 0, 0],
    });

    const increment = (counts: FinishCounts, finish?: number | null) => {
      if (!finish || finish <= 0) {
        counts[3] += 1;
        return;
      }
      if (finish === 1) {
        counts[0] += 1;
      } else if (finish === 2) {
        counts[1] += 1;
      } else if (finish === 3) {
        counts[2] += 1;
      } else {
        counts[3] += 1;
      }
    };

    const result: Record<string, Record<CushionRangeBin, FinishCounts>> = {};

    for (const entry of entries) {
      let hasData = false;
      const buckets = createEmptyBuckets();
      for (const race of entry.races) {
        if (race.surface !== '芝') continue;
        const cushion = typeof race.cushionValue === 'number' && Number.isFinite(race.cushionValue)
          ? race.cushionValue
          : null;
        if (cushion === null) continue;
        const range = getCushionRange(cushion);
        if (range === 'none') continue;
        increment(buckets[range as CushionRangeBin], race.position);
        hasData = true;
      }
      if (hasData) {
        result[entry.horseId] = buckets;
      }
    }

    return result;
  }, [entries]);

  type TurnKey = 'left' | 'right';
  const formatTurnCounts = (counts?: FinishCounts): string => formatFinishCounts(counts);

  const turnStatsMap = useMemo(() => {
    const map = new Map<string, Record<TurnKey, [number, number, number, number]>>();

    const increment = (target: [number, number, number, number], finish: number | undefined) => {
      if (!finish || finish <= 0) {
        target[3] += 1;
        return;
      }
      if (finish === 1) {
        target[0] += 1;
      } else if (finish === 2) {
        target[1] += 1;
      } else if (finish === 3) {
        target[2] += 1;
      } else {
        target[3] += 1;
      }
    };

    const detectTurnKey = (race: RaceDetail): TurnKey | null => {
      const dir = race.direction?.trim();
      if (dir?.includes('左')) return 'left';
      if (dir?.includes('右')) return 'right';
      return inferTurnKeyFromName(race.track);
    };

    for (const entry of entries) {
      const stats: Record<TurnKey, [number, number, number, number]> = {
        left: [0, 0, 0, 0],
        right: [0, 0, 0, 0]
      };

      for (const race of entry.races) {
        const key = detectTurnKey(race);
        if (!key) continue;
        increment(stats[key], race.position);
      }

      map.set(entry.horseId, stats);
    }

    return map;
  }, [entries]);

  const raceTurnKey: TurnKey | null = useMemo(() => {
    const direction = raceInfo.direction?.trim();
    if (direction?.includes('左')) return 'left';
    if (direction?.includes('右')) return 'right';
    return inferTurnKeyFromName(raceInfo.venue);
  }, [raceInfo.direction, raceInfo.venue]);

  const venueStatsMap = useMemo(() => {
    const map = new Map<string, Map<string, [number, number, number, number]>>();

    const increment = (target: [number, number, number, number], finish: number | undefined) => {
      if (!finish || finish <= 0) {
        target[3] += 1;
        return;
      }
      if (finish === 1) {
        target[0] += 1;
      } else if (finish === 2) {
        target[1] += 1;
      } else if (finish === 3) {
        target[2] += 1;
      } else {
        target[3] += 1;
      }
    };

    for (const entry of entries) {
      const venueMap = new Map<string, [number, number, number, number]>();
      for (const race of entry.races) {
        const venue = race.track?.trim();
        if (!venue) continue;
        const current = venueMap.get(venue) ?? [0, 0, 0, 0];
        increment(current, race.position);
        venueMap.set(venue, current);
      }
      map.set(entry.horseId, venueMap);
    }

    return map;
  }, [entries]);

  // ツールチップ廃止に伴いホバー用関数は未使用

  return (
    <RacePageLayout
      onToggleCoRunners={toggleCoRunnerByHorseId}
      expandedMap={expandedCoRunnerMap}
      renderCoRunnerContent={renderCoRunnerByHorseId}
      onCollapseAllCoRunners={collapseAllCoRunners}
    >
      <Box
        sx={{
          pb: 4, maxWidth: '100%', mx: 'auto', px: 3,
          position: 'relative', zIndex: 0,
          // PCでサイドメニュー(persistent)が出ている間はその幅だけ余白を取り、
          // 中央カラムと重ならないようにする
          ml: (!isMobile && raceLevelOpen && !isUltraWide) ? { xs: 0, md: '380px' } : 0,
          mr: (!isMobile && rankPanelOpen && !isUltraWide) ? { xs: 0, md: '380px' } : 0,
        transition: 'margin 200ms ease',
        '--rankw': { xs: '28px', sm: '32px' },
        '--framew': { xs: '44px', sm: '52px', md: '56px', lg: '56px', xl: '60px' },
        '--horsenow': { xs: '44px', sm: '52px', md: '56px', lg: '56px', xl: '60px' },
        // 馬名は少し狭める（lgで圧縮、xlでゆるめ）
        '--namew': { xs: '120px', sm: '160px', md: '180px', lg: '180px', xl: '220px' },
        // 走ごとのセル幅（lgで圧縮、xlで拡張）
        '--rcw': { xs: '140px', sm: '150px', md: '160px', lg: '160px', xl: '180px' },
        '--cellw': { xs: '140px', sm: '150px', md: '160px', lg: '160px', xl: '180px' }
      }}
    >
      {error && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">{error}</Typography>
        </Box>
      )}
      {trainingFetchError && (
        <Box sx={{ mb: 1 }}>
          <Typography color="warning.main" variant="caption">{trainingFetchError}</Typography>
        </Box>
      )}
      {/* 同日・競馬場切替 + レース選択（ページ最上段・折り返し表示、スクロールなし） */}
      {(venuesOnDate.length > 0 || siblingRaces.length > 0) && (
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, alignItems: 'center' }}>
            {venuesOnDate.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedVenue || ''}
                  onChange={(e) => {
                    const v = String(e.target.value || '');
                    setSelectedVenue(v);
                    const list = (allRacesSameDate || []).filter(r => r.venue === v).sort((a, b) => a.raceNo - b.raceNo);
                    setSiblingRaces(list);
                    // 同じR番号へ自動遷移（存在しない場合は先頭）
                    const currentNo = (() => {
                      const id = raceInfo?.raceId || (raceId as string) || '';
                      const tail = id.slice(-2);
                      const n = parseInt(tail, 10);
                      return isNaN(n) ? undefined : n;
                    })();
                    const target = (currentNo !== undefined)
                      ? list.find(r => r.raceNo === currentNo) || list[0]
                      : list[0];
                    if (target && target.raceId && target.raceId !== raceInfo.raceId) {
                      navigate(`/races/${target.raceId}`);
                    }
                  }}
                  displayEmpty
                >
                  {venuesOnDate.map(v => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {siblingRaces.map(sr => {
              const selected = sr.raceId === (raceInfo.raceId || '');
              const label = `${sr.raceNo}R${sr.offAt ? ` ${sr.offAt}` : ''}`;
              return (
                <Button
                  key={sr.raceId}
                  size="small"
                  variant={selected ? 'contained' : 'outlined'}
                  color={selected ? 'primary' : 'inherit'}
                  onClick={() => navigate(`/races/${sr.raceId}`)}
                  sx={{ whiteSpace: 'nowrap', minWidth: 72, flexShrink: 0 }}
                  aria-label={`${sr.venue} ${sr.raceNo}レース${sr.offAt ? ` 発走 ${sr.offAt}` : ''}へ移動`}
                >
                  {label}
                </Button>
              );
            })}
          </Stack>
        </Box>
      )}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/')} variant="outlined"
          sx={{ whiteSpace: 'nowrap', minWidth: { xs: 108, sm: 140 }, flexShrink: 0 }}>
          トップに戻る
        </Button>
        <Button 
          startIcon={<List />} 
          onClick={() => { setRankMode('prev'); setRankPanelOpen(true); }} 
          variant="contained"
          color="primary"
          sx={{ whiteSpace: 'nowrap', minWidth: { xs: 120, sm: 150 }, flexShrink: 0, display: { xs: 'inline-flex', lg: 'none' } }}
        >
          前走ランキング
        </Button>
        <Button 
          startIcon={<BarChart3 />} 
          onClick={() => setAnalysisSidebarOpen(true)} 
          variant="contained"
          color="secondary"
          sx={{ whiteSpace: 'nowrap', minWidth: { xs: 108, sm: 130 }, flexShrink: 0 }}
        >
          レース分析
        </Button>
        {!shouldShowSticky && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ pl: 1, pr: 1 }}>
            <Switch
              checked={hudOpen}
              onChange={(_, checked) => setHudOpen(checked)}
              color="secondary"
              inputProps={{ 'aria-label': 'HUD表示切替' }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Layers size={18} />
              <Typography component="span" sx={{ fontSize: '0.95rem' }}>
                HUD
              </Typography>
            </Box>
          </Stack>
        )}
        <Box sx={{ flex: 1, minWidth: { xs: '100%', md: 0 } }}>
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
            {raceInfo.surface === '芝'
              && typeof raceInfo.cushionValue === 'number'
              && Number.isFinite(raceInfo.cushionValue)
              && ` クッション値:${raceInfo.cushionValue}`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {(() => {
              const cls = (inferClassFromName(raceInfo.raceName) || raceInfo.className) || '-';
              const has = avgTimeSec !== null && avgTimeCount > 0;
              const timePart = has ? formatSecondsToRace(avgTimeSec) : 'データなし';
              const countPart = has ? `（${avgTimeCount}件）` : '';
              const speedVal = has ? speedFromSeconds(raceInfo.distance, avgTimeSec) : null;
              const speedPart = speedVal !== null ? ` ／ 平均時速: ${speedVal} km/h` : '';
              const minus3FPart = avgMinus3FSpeed !== null
                ? ` ／ -3F平均時速: ${avgMinus3FSpeed.toFixed(1)} km/h${avgMinus3FCount ? `（${avgMinus3FCount}件）` : ''}`
                : '';
              return `平均タイム(過去1年・${cls} ${raceInfo.distance}m): ${timePart}${countPart}${speedPart}${minus3FPart}`;
            })()}
          </Typography>
          {prevAvgSpeed !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              前走平均時速(出走馬): {formatKmh(prevAvgSpeed)} km/h{prevAvgSpeedCount ? `（${prevAvgSpeedCount}頭）` : ''}
            </Typography>
          )}
          {prevMinus3FAvgSpeed !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              前走-3F平均速度(出走馬): {formatKmh(prevMinus3FAvgSpeed)} km/h{prevMinus3FAvgSpeedCount ? `（${prevMinus3FAvgSpeedCount}頭）` : ''}
            </Typography>
          )}
        </Box>
      </Stack>

      {/* 右サイド（3カラムレイアウトに移行のため削除） */}

      {/* クッション値レンジ選択（チップボタン） + ランキングボタン（<1900pxで表示） */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 1 }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
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
        {!isUltraWide && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setRaceLevelOpen(true)}>
              レベルランキング
            </Button>
            {isDesktop && (
              <Button size="small" variant="outlined" startIcon={<BarChart3 size={16} />} onClick={() => setRankPanelOpen(true)}>
                前走ランキング
              </Button>
            )}
          </Box>
        )}
      </Stack>

      {/* 前走/前前走 レベルランキング（サイドメニュー） */}
      {!isUltraWide && (
        <PrevRankSidebar 
          open={rankPanelOpen} 
          onClose={() => setRankPanelOpen(false)} 
          itemsPrev={prevRankList}
          itemsPrev2={prev2RankList}
          mode={rankMode}
          onModeChange={setRankMode}
          variant={isMobile ? 'temporary' : 'persistent'}
          onToggleCoRunners={toggleCoRunnerByHorseId}
          expandedMap={expandedCoRunnerMap}
          renderCoRunnerContent={renderCoRunnerByHorseId}
        />
      )}

      {/* レースレベル ランキング（左サイドメニュー） */}
      {!isUltraWide && (
        <RaceLevelSidebar 
          open={raceLevelOpen}
          onClose={() => setRaceLevelOpen(false)}
          variant={isMobile ? 'temporary' : 'persistent'}
          onToggleCoRunners={toggleCoRunnerByHorseId}
          expandedMap={expandedCoRunnerMap}
          renderCoRunnerContent={renderCoRunnerByHorseId}
          onCollapseAll={collapseAllCoRunners}
        />
      )}

      {/* スクロール監視用センチネル（ヘッダ直下に設置） */}
      <Box ref={headerSentinelRef} sx={{ height: 2, width: '100%' }} />

      {/* 固定ステータスバー（平均タイム/平均時速/前走平均時速） */}
      {shouldShowSticky && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          // 中央カラムの収縮に追従（PCでサイドメニュー表示時のみ左右を詰める）
          left: (!isMobile && raceLevelOpen && !isUltraWide) ? { xs: 0, md: 380 } : 0,
          right: (!isMobile && rankPanelOpen && !isUltraWide) ? { xs: 0, md: 380 } : 0,
          zIndex: 1200,
          bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', boxShadow: 2,
          py: 0.75, px: { xs: 1, sm: 2 },
          transition: 'left 200ms ease, right 200ms ease'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: { xs: 1, sm: 1.5 } }}>
            <Typography variant="body2" color="text.secondary">
              {(() => {
                const cls = (inferClassFromName(raceInfo.raceName) || raceInfo.className) || '-';
                const has = avgTimeSec !== null && avgTimeCount > 0;
                const timePart = has ? formatSecondsToRace(avgTimeSec) : 'データなし';
                const countPart = has ? `（${avgTimeCount}件）` : '';
                const speedVal = has ? speedFromSeconds(raceInfo.distance, avgTimeSec) : null;
                const speedPart = speedVal !== null ? ` ／ 平均時速: ${speedVal} km/h` : '';
                const minus3FPart = avgMinus3FSpeed !== null
                  ? ` ／ -3F平均時速: ${avgMinus3FSpeed.toFixed(1)} km/h${avgMinus3FCount ? `（${avgMinus3FCount}件）` : ''}`
                  : '';
                return `平均タイム(過去1年・${cls} ${raceInfo.distance}m): ${timePart}${countPart}${speedPart}${minus3FPart}`;
              })()}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 'fit-content' }}>
              <Switch
                checked={hudOpen}
                onChange={(_, checked) => setHudOpen(checked)}
                color="secondary"
                inputProps={{ 'aria-label': 'HUD表示切替' }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Layers size={18} />
                <Typography component="span" sx={{ fontSize: '0.95rem' }}>
                  HUD
                </Typography>
              </Box>
            </Stack>
          </Box>
          {prevRankList.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                {(() => {
                  const top = prevRankList.slice(0, 3);
                  const fmt = (it: any) => ` ${it.rank}位 ${it.horseNo}-${it.name} 平 ${it.avg}万${it.margin ? ` / 着差 ${it.margin}` : ''}`;
                  return `前走レベル上位:` + top.map(fmt).join(' /');
                })()}
              </Typography>
              {!isUltraWide && (
                <Button size="small" variant="outlined" onClick={() => setRankPanelOpen(true)}>
                  前走ランキング
                </Button>
              )}
            </Box>
          )}
          {prevAvgSpeed !== null && (
            <Typography variant="body2" color="text.secondary">
              前走平均時速(出走馬): {formatKmh(prevAvgSpeed)} km/h{prevAvgSpeedCount ? `（${prevAvgSpeedCount}頭）` : ''}
            </Typography>
          )}
          {prevMinus3FAvgSpeed !== null && (
            <Typography variant="body2" color="text.secondary">
              前走-3F平均速度(出走馬): {formatKmh(prevMinus3FAvgSpeed)} km/h{prevMinus3FAvgSpeedCount ? `（${prevMinus3FAvgSpeedCount}頭）` : ''}
            </Typography>
          )}
        </Box>
      )}

      {!loading && (lastRaceSpeedItems.length > 0 || canShowMinus3FSummary) && (
        <Box sx={{ mt: 1.5, mb: hasResults ? 1.5 : 1 }}>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.75 }}>
            <ToggleButtonGroup
              value={speedSummaryMode}
              exclusive
              size="small"
              onChange={(_, value) => {
                if (value) setSpeedSummaryMode(value);
              }}
            >
              <ToggleButton value="avg">平均時速</ToggleButton>
              <ToggleButton value="minus3f" disabled={!canShowMinus3FSummary}>
                -3F平均速度
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {speedSummaryItems.length > 0 ? (
            <PrevRaceSpeedSummary
              items={speedSummaryItems}
              focusedHorseId={focusedHorseId}
              onSelect={focusHorse}
              title={speedSummaryTitle}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              -3F平均速度のデータがありません。
            </Typography>
          )}
        </Box>
      )}

      {hasResults && (
        <Box sx={{ mt: 1.5 }}>
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
      <>
      <Box sx={{ position: 'relative' }}>
      <TableContainer
        component={Paper}
        sx={{ maxWidth: '100%', overflowX: 'auto' }}
        ref={tableContainerRef}
      >
        <Table size="small" stickyHeader aria-label="race entries table" sx={{ minWidth: 850, '& td, & th': { px: { xs: 0.25, sm: 0.5 } }, '& .MuiTableCell-stickyHeader': { top: `${stickyOffset}px !important` } }}>
          <TableHead>
            <TableRow>
              <TableCell align="center" sx={{ position: 'sticky', left: 0, zIndex: 0, bgcolor: 'background.paper', minWidth: 'var(--framew)', width: 'var(--framew)' }}>枠</TableCell>
              <TableCell align="center" sx={{ position: 'sticky', left: 'var(--framew)', zIndex: 0, bgcolor: 'background.paper', minWidth: 'var(--horsenow)', width: 'var(--horsenow)' }}>馬番</TableCell>
              <TableCell sx={{ position: { xs: 'static', sm: 'sticky' }, left: { sm: 'calc(var(--framew) + var(--horsenow))' }, zIndex: 0, bgcolor: 'background.paper', minWidth: 'var(--namew)', width: 'var(--namew)' }}>馬名</TableCell>
              <TableCell align="center">騎手</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 } }}>前走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 } }}>2走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 }, display: { xs: 'none', sm: 'table-cell' } }}>3走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 }, display: { xs: 'none', sm: 'none', md: 'table-cell' } }}>4走</TableCell>
              <TableCell align="center" sx={{ width: 'var(--cellw)', minWidth: 'var(--cellw)', maxWidth: 'var(--cellw)', px: { xs: 0.25, sm: 0.5 }, display: 'none', '@media (min-width:1900px)': { display: 'table-cell' } }}>5走</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(loading ? [] : entries).map((h) => {
              const isFocused = focusedHorseId === h.horseId;
              const rowClassName = isFocused ? 'focus-active-row' : undefined;

              return (
                <TableRow
                  key={h.horseId}
                  className={rowClassName}
                  ref={(el) => {
                    if (el) {
                      rowRefs.current[h.horseId] = el;
                    } else {
                      delete rowRefs.current[h.horseId];
                    }
                  }}
                >
                <TableCell align="center" sx={{ position: 'sticky', left: 0, zIndex: 0, bgcolor: 'background.paper', minWidth: 'var(--framew)', width: 'var(--framew)' }}>
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
                <TableCell align="center" sx={{ position: 'sticky', left: 'var(--framew)', zIndex: 0, bgcolor: 'background.paper', minWidth: 'var(--horsenow)', width: 'var(--horsenow)' }}>{h.horseNo}</TableCell>
                <TableCell sx={{ position: { xs: 'static', sm: 'sticky' }, left: { sm: 'calc(var(--framew) + var(--horsenow))' }, zIndex: 0, bgcolor: 'background.paper', minWidth: 'var(--namew)', width: 'var(--namew)' }}>
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
                    {/* クッション値別成績（自動レンジ推定対応） */}
                    <div className="horse-info__cushion">
                      {(() => {
                        const horseStats = cushionStats[h.horseId];
                        const rawRange = selectedRange === 'none'
                          ? getCushionRange(raceInfo.surface === '芝' ? raceInfo.cushionValue : undefined)
                          : selectedRange;
                        const effectiveRange = rawRange === 'none' ? undefined : rawRange;
                        const counts = effectiveRange ? horseStats?.[effectiveRange as CushionRangeBin] : undefined;
                        const formatted = formatFinishCounts(counts);
                        const label = effectiveRange ? rangeLabels[effectiveRange] : undefined;
                        const prefix = label ? `クッション(${label})` : 'クッション';
                        return `${prefix}: ${formatted}`;
                      })()}
                    </div>
                    {/* 周り方別成績 */}
                    <div className="horse-info__turn" style={{ visibility: 'visible' }}>
                      {(() => {
                        const stats = turnStatsMap.get(h.horseId);
                        const leftCounts = formatTurnCounts(stats?.left);
                        const rightCounts = formatTurnCounts(stats?.right);
                        const leftStyle = raceTurnKey === 'left' ? { color: '#dc2626' } : { color: '#111827' };
                        const rightStyle = raceTurnKey === 'right' ? { color: '#dc2626' } : { color: '#111827' };
                        const venueName = raceInfo.venue?.trim();
                        const venueCounts = venueName ? formatTurnCounts(venueStatsMap.get(h.horseId)?.get(venueName)) : '-';
                        const venueLabel = venueName ? `${venueName}: ${venueCounts}` : `開催: ${venueCounts}`;
                        return (
                          <>
                            <span style={leftStyle}>左回り: {leftCounts}</span>
                            <span style={rightStyle}>右回り: {rightCounts}</span>
                            <span style={{ color: '#0f172a' }}>{venueLabel}</span>
                          </>
                        );
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
                        display: { 
                          xs: idx < 2 ? 'table-cell' : 'none',
                          sm: idx < 3 ? 'table-cell' : 'none',
                          md: idx < 4 ? 'table-cell' : 'none'
                        },
                        ...(idx === 4 ? { '@media (min-width:1900px)': { display: 'table-cell' } } : {}),
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
                          {typeof r.minus3FAvgSpeed === 'number' && isFinite(r.minus3FAvgSpeed) && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              -3F平均速度 {formatKmh(r.minus3FAvgSpeed)} km/h
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
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          pointerEvents: hudOpen ? 'auto' : 'none',
          visibility: hudOpen ? 'visible' : 'hidden'
        }}
        onClick={() => setHudOpen(false)}
      >
        <Slide direction="down" in={hudOpen} mountOnEnter unmountOnExit appear>
          <Paper
            elevation={8}
            onClick={(event) => event.stopPropagation()}
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              bgcolor: 'transparent',
              color: 'common.white',
              borderRadius: (theme) => theme.shape.borderRadius,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              boxShadow: 'none',
              p: 0
            }}
            role="dialog"
            aria-modal="true"
            aria-label="出馬表HUD"
          >
            <Box
              sx={{
                flex: `0 0 ${nameColumnOverlayWidth}`,
                maxWidth: nameColumnOverlayWidth,
                height: '100%',
                position: 'relative',
                bgcolor: 'transparent',
                pointerEvents: 'none',
                px: 0,
                py: 0
              }}
            >
              {hudRowPositions.map(({ horseId, top, height }) => {
                const entry = entryByHorseId.get(horseId);
                if (!entry) return null;
                const records = trainingRecordsWithinWindow[entry.name] || [];
                if (records.length === 0) return null;
                return (
                  <Box
                    key={`hud-overlay-${horseId}`}
                    sx={{
                      position: 'absolute',
                      top,
                      height,
                      left: 0,
                      right: 0,
                      display: 'flex',
                      alignItems: 'stretch'
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        pointerEvents: 'none'
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 1,
                          bgcolor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(148, 163, 184, 0.18)',
                          boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)'
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box
              sx={{
                flex: 1,
                height: '100%',
                px: 0,
                py: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                bgcolor: 'rgba(255,255,255,0.92)',
                color: '#111827',
                backdropFilter: 'blur(6px)',
                pointerEvents: 'auto'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.25 }}>
                <Chip label="HUD" size="small" sx={{ bgcolor: 'rgba(59, 130, 246, 0.15)', color: 'rgba(37, 99, 235, 1)', fontWeight: 600 }} />
                <Tabs
                  value={hudTab}
                  onChange={(_, value) => setHudTab(value)}
                  textColor="primary"
                  indicatorColor="primary"
                  sx={{ flex: 1, minHeight: 32, '& .MuiTab-root': { fontSize: '0.8rem', minHeight: 32, py: 0 } }}
                >
                  <Tab value="individual" label="個別" />
                  <Tab value="ranking" label="ランキング" />
                </Tabs>
                <IconButton
                  aria-label="HUDを閉じる"
                  onClick={() => setHudOpen(false)}
                  size="small"
                  sx={{ color: 'text.primary', bgcolor: 'rgba(148, 163, 184, 0.2)', '&:hover': { bgcolor: 'rgba(148, 163, 184, 0.35)' } }}
                >
                  <X size={16} />
                </IconButton>
              </Box>
              <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.35)' }} />
              <Stack spacing={0} sx={{ flexGrow: 1, overflowY: 'auto', pr: 0.5 }}>
                {trainingFetchError && (
                  <Alert severity="warning" sx={{ bgcolor: 'rgba(253, 230, 138, 0.35)', color: '#854d0e' }}>
                    {trainingFetchError}
                  </Alert>
                )}
                {hudTab === 'individual' ? (
                  hasAnyTrainingData ? (
                    <Stack spacing={0}>
                      {entriesWithTraining.map(({ entry, records }) => (
                        <Box
                          key={`hud-training-${entry.horseId}`}
                          sx={{
                            border: '1px solid rgba(148, 163, 184, 0.4)',
                            borderRadius: 1,
                            px: 1,
                            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)',
                            height: hudRowHeightMap.get(entry.horseId) ?? 'auto',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            mx: 0.75,
                            my: 0,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                            {entry.horseNo}-{entry.name}
                          </Typography>
                          {records.length > 0 ? (
                            <TableContainer sx={{ mt: 0.5, borderRadius: 1, border: '1px solid rgba(148, 163, 184, 0.35)', overflowX: 'auto' }}>
                              {renderTrainingRecordsTable(records)}
                            </TableContainer>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              調教データなし
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ color: '#64748b', px: 1, py: 1 }}>
                      調教データが登録されていません。
                    </Typography>
                  )
                ) : (
                  <Stack spacing={1.25} sx={{ px: 1, py: 1 }}>
                    {(top4fByType.wood.length > 0 || top4fByType.hill.length > 0) && (
                      <>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1f2937', mb: 0.75 }}>
                          4F上位タイム
                        </Typography>
                        <Stack spacing={1.5}>
                          {renderRankingTable('wood', 'ウッド')}
                          {renderRankingTable('hill', '坂路')}
                        </Stack>
                      </>
                    )}
                    {top4fByType.wood.length === 0 && top4fByType.hill.length === 0 && (
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        ランキングを表示できる調教データがありません。
                      </Typography>
                    )}
                  </Stack>
                )}
              </Stack>
            </Box>
          </Paper>
        </Slide>
      </Box>
      </Box>
      </>
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
    </RacePageLayout>
  );
}

export default HorseRacingTable;


