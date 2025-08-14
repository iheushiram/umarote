// API Base URL - 環境に応じて変更
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface HorseData {
  id: string;
  name: string;
  birthYear: number;
  sex: '牡' | '牝' | 'セ';
  color: string;
  father: string;
  mother: string;
  trainer: string;
  owner: string;
  breeder: string;
  earnings: number;
}

export interface RaceData {
  raceId: string;
  date: string;
  venue: string;
  raceNo: number;
  raceName: string;
  className: string;
  surface: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左';
  trackCond: '良' | '稍' | '重' | '不良';
  cushionValue?: number;
  fieldSize?: number;
  offAt?: string;
  grade?: 'OP' | 'G3' | 'G2' | 'G1';
  weather?: string;
  win5?: boolean;
  status?: string;
}

export interface RaceResultData {
  id: string;
  raceId: string;
  horseId: string;
  date: string;
  raceName: string;
  venue: string;
  courseType: '芝' | 'ダート';
  distance: number;
  direction: '右' | '左';
  courseCondition: '良' | '稍' | '重' | '不良';
  finishPosition: number;
  jockey: string;
  weight: number;
  time: string;
  margin: string;
  averagePosition: number;
  lastThreeFurlong: string;
  odds: number;
  popularity: number;
}

// API呼び出しサービス
export class AdminService {
  async insertHorses(horsesData: HorseData[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/horses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(horsesData),
      });

      if (!response.ok) {
        throw new Error('API呼び出しに失敗しました');
      }
    } catch (error) {
      console.error('Error inserting horses:', error);
      throw new Error('馬データの挿入に失敗しました');
    }
  }

  async insertRaces(racesData: RaceData[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/races`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(racesData),
      });

      if (!response.ok) {
        throw new Error('API呼び出しに失敗しました');
      }
    } catch (error) {
      console.error('Error inserting races:', error);
      throw new Error('レースデータの挿入に失敗しました');
    }
  }

  async insertRaceResults(resultsData: RaceResultData[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/race-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resultsData),
      });

      if (!response.ok) {
        throw new Error('API呼び出しに失敗しました');
      }
    } catch (error) {
      console.error('Error inserting race results:', error);
      throw new Error('レース結果データの挿入に失敗しました');
    }
  }

  async getStats(): Promise<{horses: number; races: number; results: number}> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (!response.ok) {
        throw new Error('統計情報の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting stats:', error);
      return { horses: 0, races: 0, results: 0 };
    }
  }
}

// ブラウザ環境でのモック実装（開発用）
export class MockAdminService {
  async insertHorses(horsesData: HorseData[]): Promise<void> {
    console.log('Mock: Inserting horses:', horsesData);
    const existing = JSON.parse(localStorage.getItem('horses') || '[]');
    localStorage.setItem('horses', JSON.stringify([...existing, ...horsesData]));
  }

  async insertRaces(racesData: RaceData[]): Promise<void> {
    console.log('Mock: Inserting races:', racesData);
    const existing = JSON.parse(localStorage.getItem('races') || '[]');
    localStorage.setItem('races', JSON.stringify([...existing, ...racesData]));
  }

  async insertRaceResults(resultsData: RaceResultData[]): Promise<void> {
    console.log('Mock: Inserting race results:', resultsData);
    const existing = JSON.parse(localStorage.getItem('raceResults') || '[]');
    localStorage.setItem('raceResults', JSON.stringify([...existing, ...resultsData]));
  }

  async getStats(): Promise<{horses: number; races: number; results: number}> {
    const horses = JSON.parse(localStorage.getItem('horses') || '[]');
    const races = JSON.parse(localStorage.getItem('races') || '[]');
    const results = JSON.parse(localStorage.getItem('raceResults') || '[]');
    return { horses: horses.length, races: races.length, results: results.length };
  }
}

// 環境に応じたサービスインスタンスを返すファクトリー関数
export function createAdminService(useAPI = false) {
  if (useAPI) {
    return new AdminService();
  } else {
    // デフォルトでは MockAdminService を使用
    return new MockAdminService();
  }
}