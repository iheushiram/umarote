// API Base URL - 環境に応じて変更
import { VenueBoard } from '../types/horse';
import { formatRaceTime } from '../utils/timeUtils';
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8787';

export interface HorseData {
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
  currentRaceId?: string; // 現在出走予定のレースID（任意）
}

export interface RaceData {
  raceId: string;
  date: string;
  venue: string;
  meetingNumber: number; // 開催回数
  dayNumber: number;     // 開催日数
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
  pos1c?: number; // 1角
  finishPosition: number;
  jockey: string;
  weight: number;
  time: string;
  timeFormatted?: string; // 表示用タイム（"1:43.9"形式）
  timeRaw?: number; // 計算用タイム（1439形式）
  margin: string;
  averagePosition: number;
  lastThreeFurlong: string;
  cornerPassings?: string; // ｺｰﾅｰ（通過順まとめ）
  averageThreeFurlong?: string; // Ave-3F
  odds: number;
  popularity: number;
  pos2c?: number;
  pos3c?: number;
  pos4c?: number;
}

export interface RaceEntryData {
  id: string;
  raceId: string;
  horseId: string;
  frameNo: number;
  horseNo: number;
  age: number;
  jockey: string;
  weight: number;
  trainer: string;
  affiliation: string;
  popularity?: number;
  bodyWeight?: number;
  bodyWeightDiff?: number;
  blinkers?: boolean;
  horse?: HorseData | null;
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

  async insertRaceEntries(entriesData: RaceEntryData[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/race-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entriesData)
      });
      if (!response.ok) {
        throw new Error('出馬表データの挿入に失敗しました');
      }
    } catch (error) {
      console.error('Error inserting race entries:', error);
      throw new Error('出馬表データの挿入に失敗しました');
    }
  }

  async insertRaceEntriesCsv(csvData: any[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/race-entries-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '出馬表CSVデータの挿入に失敗しました');
      }
    } catch (error) {
      console.error('Error inserting race entries CSV:', error);
      throw new Error('出馬表CSVデータの挿入に失敗しました');
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
        body: JSON.stringify({ results: resultsData }),
      });

      if (!response.ok) {
        throw new Error('API呼び出しに失敗しました');
      }
    } catch (error) {
      console.error('Error inserting race results:', error);
      throw new Error('レース結果データの挿入に失敗しました');
    }
  }

  async insertRaceResultsWithHorses(resultsData: RaceResultData[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/race-results-with-horses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results: resultsData }),
      });

      if (!response.ok) {
        throw new Error('API呼び出しに失敗しました');
      }
    } catch (error) {
      console.error('Error inserting race results with horses:', error);
      throw new Error('レース結果と馬データの挿入に失敗しました');
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

  // 部分更新API
  async updateRaceCushion(raceId: string, cushionValue: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/races/${raceId}/cushion`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cushionValue }),
      });

      if (!response.ok) {
        throw new Error('クッション値の更新に失敗しました');
      }
    } catch (error) {
      console.error('Error updating cushion value:', error);
      throw new Error('クッション値の更新に失敗しました');
    }
  }

  async updateRacePartial(raceId: string, updateData: Partial<RaceData>): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/races/${raceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('レース情報の更新に失敗しました');
      }
    } catch (error) {
      console.error('Error updating race:', error);
      throw new Error('レース情報の更新に失敗しました');
    }
  }

  async updateHorsePartial(horseId: string, updateData: Partial<HorseData>): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/horses/${horseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('馬情報の更新に失敗しました');
      }
    } catch (error) {
      console.error('Error updating horse:', error);
      throw new Error('馬情報の更新に失敗しました');
    }
  }

  // データ取得メソッドの追加

  async getRaces(date?: string, venue?: string): Promise<RaceData[]> {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (venue) params.append('venue', venue);

      const response = await fetch(`${API_BASE_URL}/api/races?${params}`);
      if (!response.ok) {
        throw new Error('レース情報の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting races:', error);
      return [];
    }
  }

  async getHorses(limit?: number, offset?: number): Promise<HorseData[]> {
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.append('limit', limit.toString());
      if (offset !== undefined) params.append('offset', offset.toString());

      const response = await fetch(`${API_BASE_URL}/api/horses?${params}`);
      if (!response.ok) {
        throw new Error('馬情報の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting horses:', error);
      return [];
    }
  }

  async getRaceResults(raceId?: string, horseId?: string, limit?: number): Promise<RaceResultData[]> {
    try {
      const params = new URLSearchParams();
      if (raceId) params.append('raceId', raceId);
      if (horseId) params.append('horseId', horseId);
      if (limit !== undefined) params.append('limit', String(limit));

      const response = await fetch(`${API_BASE_URL}/api/race-results?${params}`);
      if (!response.ok) {
        throw new Error('レース結果の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting race results:', error);
      return [];
    }
  }

  async getVenueData(date: string): Promise<VenueBoard[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/venues?date=${date}`);
      if (!response.ok) {
        throw new Error('会場情報の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting venue data:', error);
      return [];
    }
  }

  async getAvailableDates(): Promise<string[]> {
    try {
      console.log('=== adminService.getAvailableDates デバッグ ===');
      console.log('API URL:', `${API_BASE_URL}/api/venues/dates`);
      
      const response = await fetch(`${API_BASE_URL}/api/venues/dates`);
      console.log('レスポンスステータス:', response.status);
      
      if (!response.ok) {
        throw new Error('開催日の取得に失敗しました');
      }
      
      const dates = await response.json();
      console.log('取得した日付:', dates);
      return dates;
    } catch (error) {
      console.error('Error getting available dates:', error);
      return [];
    }
  }

  async getRace(raceId: string): Promise<RaceData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/races/${raceId}`);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting race:', error);
      return null;
    }
  }

  async getRaceEntries(raceId: string): Promise<RaceEntryData[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/races/${raceId}/entries`);
      if (!response.ok) {
        throw new Error('出馬表の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting race entries:', error);
      return [];
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

  async insertRaceEntries(entriesData: RaceEntryData[]): Promise<void> {
    console.log('Mock: Inserting race entries:', entriesData);
    const existing = JSON.parse(localStorage.getItem('raceEntries') || '[]');
    localStorage.setItem('raceEntries', JSON.stringify([...existing, ...entriesData]));
  }

  async insertRaceResultsWithHorses(resultsData: RaceResultData[]): Promise<void> {
    console.log('Mock: Inserting race results with horses:', resultsData);
    
    // 馬の基本情報を抽出
    const horsesData: HorseData[] = [];
    const horseMap = new Map<string, HorseData>();
    
    resultsData.forEach(result => {
      if (result.horseId && !horseMap.has(result.horseId)) {
        const horseData: HorseData = {
          id: result.horseId,
          name: (result as any).horseName || result.raceName.split('・')[1] || result.raceName,
          birthDate: (result as any).horseBirthDate || (result as any).horseAge ? 
            `${new Date(result.date).getFullYear() - parseInt((result as any).horseAge) + 1}0101`.padStart(8, '0') : 
            `${new Date(result.date).getFullYear() - 2}0101`.padStart(8, '0'),
          sex: (result as any).horseSex || '牝',
          color: '',
          father: (result as any).horseFather || '',
          mother: (result as any).horseMother || '',
          trainer: (result as any).horseTrainer || result.jockey || '',
          owner: (result as any).horseOwner || '',
          breeder: (result as any).horseBreeder || '',
          earnings: (result as any).horseEarnings || 0,
        };
        horseMap.set(result.horseId, horseData);
        horsesData.push(horseData);
      }
    });
    
    // 馬データを保存
    if (horsesData.length > 0) {
      const existingHorses = JSON.parse(localStorage.getItem('horses') || '[]');
      localStorage.setItem('horses', JSON.stringify([...existingHorses, ...horsesData]));
    }
    
    // レース結果を保存
    const existing = JSON.parse(localStorage.getItem('raceResults') || '[]');
    localStorage.setItem('raceResults', JSON.stringify([...existing, ...resultsData]));
  }

  async getStats(): Promise<{horses: number; races: number; results: number}> {
    const horses = JSON.parse(localStorage.getItem('horses') || '[]');
    const races = JSON.parse(localStorage.getItem('races') || '[]');
    const results = JSON.parse(localStorage.getItem('raceResults') || '[]');
    return { horses: horses.length, races: races.length, results: results.length };
  }

  // モック部分更新API
  async updateRaceCushion(raceId: string, cushionValue: number): Promise<void> {
    console.log('Mock: Updating race cushion:', raceId, cushionValue);
    const races = JSON.parse(localStorage.getItem('races') || '[]');
    const updatedRaces = races.map((race: any) => 
      race.raceId === raceId ? { ...race, cushionValue } : race
    );
    localStorage.setItem('races', JSON.stringify(updatedRaces));
  }

  async updateRacePartial(raceId: string, updateData: Partial<RaceData>): Promise<void> {
    console.log('Mock: Updating race partial:', raceId, updateData);
    const races = JSON.parse(localStorage.getItem('races') || '[]');
    const updatedRaces = races.map((race: any) => 
      race.raceId === raceId ? { ...race, ...updateData } : race
    );
    localStorage.setItem('races', JSON.stringify(updatedRaces));
  }

  async updateHorsePartial(horseId: string, updateData: Partial<HorseData>): Promise<void> {
    console.log('Mock: Updating horse partial:', horseId, updateData);
    const horses = JSON.parse(localStorage.getItem('horses') || '[]');
    const updatedHorses = horses.map((horse: any) => 
      horse.id === horseId ? { ...horse, ...updateData } : horse
    );
    localStorage.setItem('horses', JSON.stringify(updatedHorses));
  }

  async getRaces(date?: string, venue?: string): Promise<RaceData[]> {
    console.log('Mock: Getting races:', date, venue);
    const races = JSON.parse(localStorage.getItem('races') || '[]');
    return races.filter((race: any) => {
      if (date && race.date !== date) return false;
      if (venue && race.venue !== venue) return false;
      return true;
    });
  }

  async getHorses(limit?: number, offset?: number): Promise<HorseData[]> {
    console.log('Mock: Getting horses:', limit, offset);
    const horses = JSON.parse(localStorage.getItem('horses') || '[]');
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return horses.slice(start, end);
  }

  async getRaceResults(raceId?: string, horseId?: string, limit?: number): Promise<RaceResultData[]> {
    console.log('Mock: Getting race results:', raceId, horseId);
    const results = JSON.parse(localStorage.getItem('raceResults') || '[]');
    const filtered = results.filter((result: any) => {
      if (raceId && result.raceId !== raceId) return false;
      if (horseId && result.horseId !== horseId) return false;
      return true;
    });

    // 元の数値タイムを保持
    const processedResults = filtered.map((result: any) => ({
      ...result,
      timeRaw: result.time // 計算用（元の数値）
    }));

    return typeof limit === 'number' && limit > 0 ? processedResults.slice(0, limit) : processedResults;
  }

  async getVenueData(date: string): Promise<VenueBoard[]> {
    console.log('Mock: Getting venue data for date:', date);
    // Return empty for now since we're implementing real API
    return [];
  }

  async getAvailableDates(): Promise<string[]> {
    console.log('Mock: Getting available dates');
    const races = JSON.parse(localStorage.getItem('races') || '[]');
    const uniqueDates: string[] = Array.from(
      new Set<string>(races.map((race: any) => String(race.date)))
    );
    return uniqueDates.sort((a, b) => a.localeCompare(b));
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