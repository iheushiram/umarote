// web/src/services/horseService.ts
// 競走馬やレース関連データの取得を行うサービスです。
// フロントエンドがシンプルに扱える形へAPIレスポンスを変換するために存在します。
// RELEVANT FILES:web/src/types/moisture.ts,web/src/pages/MoisturePerformancePage.tsx,web/src/pages/MoistureRacePerformancePage.tsx,src/routes/moistureAnalysis.ts
import { HorseWithResults, VenueBoard, RaceResult } from '../types/horse';
import type { MoistureOutcomeResponse, MoistureRacePerformanceResponse } from '../types/moisture';
import { AdminService, HorseData, RaceResultData, RaceData } from './adminService';
import { formatRaceTime } from '../utils/timeUtils';

const adminService = new AdminService();

// Helper function to convert database format to UI format
const convertToHorseWithResults = async (horses: HorseData[]): Promise<HorseWithResults[]> => {
  const result: HorseWithResults[] = [];
  
  for (const horse of horses) {
    try {
      // Get race results for this horse
      const raceResults = await adminService.getRaceResults(undefined, horse.id);
      
      // Convert results to UI format
      const convertedResults: RaceResult[] = raceResults.map(result => ({
        id: result.id,
        date: result.date,
        raceName: result.raceName,
        venue: result.venue,
        courseType: result.courseType,
        distance: result.distance,
        direction: result.direction,
        weather: '', // Not available in race results, could be fetched from race data
        courseCondition: result.courseCondition,
        cushionValue: 0, // Could be fetched from race data if needed
        finishPosition: result.finishPosition,
        jockey: result.jockey,
        weight: result.weight,
        time: formatRaceTime(result.time),
        margin: result.margin,
        averagePosition: result.averagePosition,
        lastThreeFurlong: result.lastThreeFurlong,
        odds: result.odds,
        popularity: result.popularity
      }));
      
      // Convert horse data to UI format - handle both camelCase and snake_case
      const birthDateField = horse.birthDate || (horse as any).birth_date;
      const birthYear = birthDateField ? parseInt(birthDateField.substring(0, 4)) : 2020;
      
      result.push({
        id: horse.id,
        name: horse.name,
        birthDate: horse.birthDate,
        sex: horse.sex,
        color: horse.color || '',
        father: horse.father || '',
        mother: horse.mother || '',
        trainer: horse.trainer || '',
        owner: horse.owner || '',
        breeder: horse.breeder || '',
        earnings: horse.earnings || 0,
        results: convertedResults
      });
    } catch (error) {
      console.error(`Error loading results for horse ${horse.id}:`, error);
      // Include horse even if results fail to load
      const birthYear = horse.birthDate ? parseInt(horse.birthDate.substring(0, 4)) : 2020;
      result.push({
        id: horse.id,
        name: horse.name,
        birthDate: horse.birthDate,
        sex: horse.sex,
        color: horse.color || '',
        father: horse.father || '',
        mother: horse.mother || '',
        trainer: horse.trainer || '',
        owner: horse.owner || '',
        breeder: horse.breeder || '',
        earnings: horse.earnings || 0,
        results: []
      });
    }
  }
  
  return result;
};

export const getHorses = async (): Promise<HorseWithResults[]> => {
  try {
    const horses = await adminService.getHorses();
    return await convertToHorseWithResults(horses);
  } catch (error) {
    console.error('Error fetching horses:', error);
    return [];
  }
};

export const getVenueData = async (date: string): Promise<VenueBoard[]> => {
  try {
    return await adminService.getVenueData(date);
  } catch (error) {
    console.error('Error fetching venue data:', error);
    return [];
  }
};

export const getAvailableDates = async (): Promise<string[]> => {
  try {
    console.log('=== getAvailableDates デバッグ ===');

    const dates = await adminService.getAvailableDates();
    console.log('取得した日付:', dates);

    return dates;
  } catch (error) {
    console.error('Error fetching available dates:', error);
    return [];
  }
};

// 日付ごとのレース取得機能を追加（race_entriesから取得）
export const getRacesByDate = async (date: string): Promise<RaceData[]> => {
  try {
    console.log('=== getRacesByDate デバッグ ===');
    console.log('リクエスト日付:', date);
    
    // YYYY-MM-DD形式をYYYYMMDD形式に変換
    const dateForRequest = date.replace(/-/g, '');
    console.log('変換後日付:', dateForRequest);
    
    // 直接レース情報を取得するAPIエンドポイントを呼び出し
    const response = await fetch(`/api/races?date=${dateForRequest}`);
    
    if (!response.ok) {
      throw new Error('レース情報の取得に失敗しました');
    }
    
    const races = await response.json();
    console.log('取得したレース数:', races.length);
    console.log('レースデータ:', races);
    
    return races;
  } catch (error) {
    console.error('Error fetching races by date:', error);
    return [];
  }
};

// 日付ごとの出馬表情報を取得
export const getRaceEntriesByDate = async (date: string): Promise<Record<string, { entries: any[], raceInfo: any }>> => {
  try {
    // YYYY-MM-DD形式をYYYYMMDD形式に変換
    const dateForRequest = date.replace(/-/g, '');
    
    const response = await fetch(`/api/races/entries/by-date/${dateForRequest}`);
    
    if (!response.ok) {
      throw new Error('出馬表情報の取得に失敗しました');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching race entries by date:', error);
    return {};
  }
};

export interface MoistureOutcomeParams {
  surface?: 'all' | 'turf' | 'dirt';
  venue?: string | null;
  distance?: number | null;
  metric?: 'goal' | 'corner';
  bucket?: number;
  limit?: number;
  focus?: 'all' | 'winners' | 'top3';
  from?: string | null;
  to?: string | null;
}

export const getMoistureOutcomes = async (
  params: MoistureOutcomeParams = {},
): Promise<MoistureOutcomeResponse | null> => {
  try {
    const search = new URLSearchParams();

    if (params.metric) search.set('metric', params.metric);
    if (params.focus) search.set('focus', params.focus);
    if (params.surface) search.set('surface', params.surface);
    if (params.venue && params.venue !== 'all') search.set('venue', params.venue);
    if (typeof params.distance === 'number' && Number.isFinite(params.distance) && params.distance > 0) {
      search.set('distance', String(params.distance));
    }
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    if (typeof params.bucket === 'number' && Number.isFinite(params.bucket) && params.bucket > 0) {
      search.set('bucket', String(params.bucket));
    }
    if (typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0) {
      search.set('limit', String(params.limit));
    }

    const query = search.toString();
    const url = query
      ? `/api/analysis/moisture-outcomes?${query}`
      : '/api/analysis/moisture-outcomes';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('含水率集計の取得に失敗しました');
    }

    const data: MoistureOutcomeResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching moisture outcomes:', error);
    return null;
  }
};


export interface MoistureRacePerformanceParams {
  surface?: 'all' | 'turf' | 'dirt';
  venue?: string | null;
  distance?: number | null;
  metric?: 'goal' | 'corner';
  limit?: number;
  top?: number;
  from?: string | null;
  to?: string | null;
}

export const getMoistureRacePerformance = async (
  params: MoistureRacePerformanceParams = {},
): Promise<MoistureRacePerformanceResponse | null> => {
  try {
    const search = new URLSearchParams();

    if (params.metric) search.set('metric', params.metric);
    if (params.surface) search.set('surface', params.surface);
    if (params.venue && params.venue !== 'all') search.set('venue', params.venue);
    if (typeof params.distance === 'number' && Number.isFinite(params.distance) && params.distance > 0) {
      search.set('distance', String(params.distance));
    }
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
    if (typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0) {
      search.set('limit', String(params.limit));
    }
    if (typeof params.top === 'number' && Number.isFinite(params.top) && params.top > 0) {
      search.set('top', String(params.top));
    }

    const query = search.toString();
    const url = query
      ? `/api/analysis/moisture-race-performance?${query}`
      : '/api/analysis/moisture-race-performance';

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('含水率レース成績の取得に失敗しました');
    }

    const data: MoistureRacePerformanceResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching moisture race performance:', error);
    return null;
  }
};


