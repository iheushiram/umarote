export interface Horse {
  id: string;
  name: string;
  birthDate: string;
  sex: '牡' | '牝' | 'セ';
  color: string;
  father: string;
  mother: string;
  trainer: string;
  owner: string;
  breeder: string;
  earnings: number;
}

export interface RaceResult {
  id: string;
  date: string;
  raceName: string;
  venue: string; // 競馬場名（札幌/東京/等）
  courseType: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左'; // 周り方
  courseConf?: string; // A/B/C等のコース区分
  weather: string;
  courseCondition: '良' | '稍' | '重' | '不良';
  cushionValue?: number; // クッション値（芝のみ）
  pos1c?: number; // 1角通過順
  finishPosition: number;
  jockey: string;
  weight: number;
  time: string;
  margin: string;
  pos2c?: number; // 2角通過順
  pos3c?: number; // 3角通過順  
  pos4c?: number; // 4角通過順
  cornerPassings?: string; // ｺｰﾅｰ（通過順まとめ）
  averagePosition: number;
  lastThreeFurlong: string;
  averageThreeFurlong?: string; // Ave-3F
  odds: number;
  popularity: number;
}

export interface HorseWithResults extends Horse {
  results: RaceResult[];
} 

// レース基本情報
export interface Race {
  raceId: string; // YYYY + 競馬場ID + 開催回数 + 開催日数 + R数 (例: 202505010811)
  date: string; // YYYY-MM-DD
  venue: string; // 札幌/東京/等
  meetingNumber: number; // 開催回数（1-6）
  dayNumber: number; // 開催日数（1-12）
  raceNo: number; // 1-12
  raceName: string;
  className: string; // 3歳未勝利, 2勝クラス, OP, G3等
  surface: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左';
  courseConf?: string; // A/B/C/内/外等
  trackCond: '良' | '稍' | '重' | '不良';
  cushionValue?: number; // 芝のみ
  fieldSize?: number; // 頭数
  offAt: string; // 'HH:mm'
  grade?: 'OP' | 'G3' | 'G2' | 'G1';
  win5?: boolean;
  status: '発売中' | '発走前' | '確定';
  weather?: string;
}

// 開催情報
export interface VenueBoard {
  venue: '札幌' | '函館' | '新潟' | '東京' | '中山' | '中京' | '京都' | '阪神' | '小倉';
  meetStr: string; // 1回札幌8日 等
  weather?: string; // 晴/曇/雨/雪
  track: { 
    turf?: '良' | '稍' | '重' | '不良';
    dirt?: '良' | '稍' | '重' | '不良';
  };
  cushion?: number; // 芝のみ
  cushionLabel?: '硬め' | 'やや硬め' | '標準' | 'やや軟' | '軟';
  races: Race[];
}

// 出馬表エントリー情報
export interface RaceEntry {
  raceId: string;
  horseId: string;
  frameNo: number; // 枠番
  horseNo: number; // 馬番
  horse: Horse;
  age: number;
  jockey: string;
  weight: number; // 斤量
  trainer: string;
  affiliation: string; // (栗)/(美)等
  popularity?: number; // 人気
  bodyWeight?: number;
  bodyWeightDiff?: number;
  blinkers?: boolean;
}

// 条件別成績統計
export interface HorseStats {
  horseId: string;
  n: number; // 母数
  win: number; // 1着回数
  place2: number; // 2着以内回数
  place3: number; // 3着以内回数
  winRate: number; // 勝率
  place2Rate: number; // 連対率
  place3Rate: number; // 複勝率
  avgFinish: number; // 平均着順
  avgLast3f: number; // 平均上り3F
  last3fTop3Rate: number; // 上り3F上位率
}

// 血統情報
export interface Blood {
  sire: string; // 父
  dam: string; // 母
  damsire: string; // 母父
}

// 馬体重情報
export interface BodyWeight {
  value: number; // 体重
  diff: number; // 前回比増減
}

// レース詳細情報（馬柱用）
export interface RaceDetail {
  raceId: string;
  date: string; // YYYY-MM-DD
  track: string; // 競馬場名
  distance: number;
  surface: '芝' | 'ダート';
  going: '良' | '稍' | '重' | '不良';
  class: string; // レースクラス（例: 3歳1勝）
  fieldSize: number; // 頭数
  barrier: number; // 枠番
  position: number; // 着順
  time: string; // タイム
  timeRaw?: number; // 計算用タイム（1439形式）
  last3F: string; // 上り3F
  passing: string; // 通過順（例: 13-7-5）
  jockey: string;
  weightCarried: number;
  margin: string; // 着差
  notes?: string; // メモ
  isFeature: boolean; // 重賞・特別レースか
}

// 馬柱用馬情報
export interface HorseEntry {
  horseId: string;
  frameNo: number; // 枠番
  horseNo: number; // 馬番
  name: string; // 馬名
  sexAge: string; // 性齢（例: 牡3）
  weightCarried: number; // 斤量
  trainer: string; // 調教師
  jockey: string; // 騎手
  stable: string; // 厩舎
  silksUrl?: string; // 勝負服画像URL
  bodyWeight: BodyWeight;
  runningStyle: '逃げ' | '先行' | '差し' | '追込'; // 脚質
  blood: Blood; // 血統
  odds?: number; // オッズ
  popularity?: number; // 人気
  recentForm: number[]; // 最近5走の着順
  races: RaceDetail[]; // レース履歴
  stats?: HorseStats; // 条件別成績
}

// 列プリセット
export type ColumnPreset = 'standard' | 'time' | 'position';
