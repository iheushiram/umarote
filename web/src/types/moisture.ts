// web/src/types/moisture.ts
// 含水率分析ページとAPIの共有データ型を定義します。
// UIとバックエンドのプロトコルを揃えるための型置き場です。
// RELEVANT FILES:web/src/services/horseService.ts,web/src/pages/MoisturePerformancePage.tsx,src/routes/moistureAnalysis.ts

export interface MoistureSample {
  raceId: string;
  date: string;
  venue: string;
  raceName: string;
  horseName: string;
  finishPosition: number | null;
  time: string | null;
  odds: number | null;
  popularity: number | null;
  moisture: number;
}

export interface MoistureRange {
  min: number;
  max: number;
  average: number | null;
}

export interface MoistureOutcomeBucket {
  moistureRange: MoistureRange;
  raceCount: number;
  runnerCount: number;
  winRate: number;
  top3Rate: number;
  averageFinish: number | null;
  averageOdds: number | null;
  averageWinningTime: string | null;
  averageWinningSeconds: number | null;
  samples: MoistureSample[];
}

export interface MoistureOutcomeFilters {
  surface: 'all' | 'turf' | 'dirt';
  venue: string | 'all';
  distance: number | null;
  metric: 'goal' | 'corner';
  bucket: number;
  limit: number;
  focus: 'all' | 'winners' | 'top3';
  from: string | null;
  to: string | null;
}

export interface MoistureOutcomeResponse {
  buckets: MoistureOutcomeBucket[];
  overall: {
    raceCount: number;
    runnerCount: number;
    averageMoisture: number | null;
  };
  filters: MoistureOutcomeFilters;
}

export interface MoistureRaceFinisher {
  horseId: string;
  horseName: string;
  finishPosition: number;
  time: string | null;
  odds: number | null;
  popularity: number | null;
}

export interface MoistureRacePerformance {
  raceId: string;
  date: string;
  venue: string;
  raceName: string;
  surface: 'turf' | 'dirt';
  surfaceLabel: string;
  distance: number | null;
  raceNo: number | null;
  className: string | null;
  trackCondition: string | null;
  moisture: number;
  metric: 'goal' | 'corner';
  topFinishers: MoistureRaceFinisher[];
  averageFinish: number | null;
  runnerCount: number;
}

export interface MoistureRacePerformanceFilters {
  surface: 'all' | 'turf' | 'dirt';
  venue: string | 'all';
  distance: number | null;
  metric: 'goal' | 'corner';
  limit: number;
  top: number;
  from: string | null;
  to: string | null;
}

export interface MoistureRacePerformanceResponse {
  races: MoistureRacePerformance[];
  total: number;
  filters: MoistureRacePerformanceFilters;
}
