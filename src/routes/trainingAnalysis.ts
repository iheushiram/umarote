// src/routes/trainingAnalysis.ts
// 調教ラップとレース成績を集計するAPIを提供します。
// 既存データで調教パターン分析を素早く試すための暫定実装です。
// RELEVANT FILES:src/index.ts,src/db/schema.ts,src/routes/moistureAnalysis.ts

import type { Hono } from 'hono';
import { createDb } from '../db/db';
import { horses, raceResults, trainingRecords } from '../db/schema';
import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';

type AppBindings = { Bindings: { DB: D1Database } };
type TrainingType = 'wood' | 'hill';
type LapField = '5f' | '4f' | '2f' | '1f';
type LapAcc = Record<LapField, { sum: number; count: number }>; 
type Example = { raceId: string; horseName: string; finishPosition: number | null; raceDate: string; trainingDate: string };
type TrainingSample = { horseName: string; trainingType: TrainingType; trainingDateRaw: string; trainingTime?: string | null; timestamp: number; laps: Partial<Record<LapField, number | null>> };
type RaceSample = { raceId: string; raceName: string; raceDateRaw: string; venue: string; surface: '芝' | 'ダート'; distance: number; horseName: string; finishPosition: number | null };
type PatternAccumulator = { key: string; label: string; sampleCount: number; top3Count: number; finishSum: number; laps: LapAcc; examples: Example[] };
type TrainingTypeAccumulator = { trainingType: TrainingType; displayLabel: string; sampleCount: number; top3Count: number; finishSum: number; laps: LapAcc; patterns: Map<string, PatternAccumulator> };
type TrainingPatternsRequest = { venue?: string; surface?: string; distance?: number; from?: string; to?: string; lookbackDays?: number; minSamples?: number; maxPatternsPerType?: number };

const TRAINING_TYPE_LABEL: Record<TrainingType, string> = { wood: 'ウッド', hill: '坂路' };
const LAP_FIELDS: LapField[] = ['5f', '4f', '2f', '1f'];
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MIN_SAMPLES = 3;
const DEFAULT_MAX_PATTERNS = 8;
const MS_PER_DAY = 86_400_000;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const normalizeDateDigits = (raw?: string | null): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (digits.length === 8) return digits;
  if (digits.length === 6) return '20' + digits;
  return null;
};

const toUtcTimestamp = (digits: string): number | null => {
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Date.UTC(year, month - 1, day);
};

const toDateLabel = (digits: string): string => (digits.length === 8 ? digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6, 8) : digits);

const parseTrainingTimestamp = (dateRaw?: string | null, timeRaw?: string | null): number | null => {
  const digits = normalizeDateDigits(dateRaw);
  if (!digits) return null;
  const base = toUtcTimestamp(digits);
  if (base === null) return null;
  if (!timeRaw) return base;
  const match = /^([0-2]?\d):([0-5]\d)$/.exec(String(timeRaw).trim());
  if (!match) return base;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return base;
  return base + (hours * 60 + minutes) * 60_000;
};

const bucketTime = (value: number | null | undefined, size: number): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '不明';
  const lower = Math.floor(value / size) * size;
  return lower.toFixed(1) + '-' + (lower + size).toFixed(1);
};

const createLapAcc = (): LapAcc => ({ '5f': { sum: 0, count: 0 }, '4f': { sum: 0, count: 0 }, '2f': { sum: 0, count: 0 }, '1f': { sum: 0, count: 0 } });

const updateLapAcc = (acc: LapAcc, values: Partial<Record<LapField, number | null | undefined>>): void => {
  for (const field of LAP_FIELDS) {
    const v = values[field];
    if (typeof v === 'number' && Number.isFinite(v)) {
      acc[field].sum += v;
      acc[field].count += 1;
    }
  }
};

const pickAverage = (acc: LapAcc, field: LapField): number | null => (acc[field].count === 0 ? null : Number((acc[field].sum / acc[field].count).toFixed(2)));

const formatAverage = (sum: number, count: number): number | null => (count === 0 ? null : Number((sum / count).toFixed(2)));
const formatRate = (count: number, total: number): number | null => (total === 0 ? null : Number(((count / total) * 100).toFixed(1)));

const createTypeAccumulator = (trainingType: TrainingType): TrainingTypeAccumulator => ({ trainingType, displayLabel: TRAINING_TYPE_LABEL[trainingType], sampleCount: 0, top3Count: 0, finishSum: 0, laps: createLapAcc(), patterns: new Map() });
const createPatternAccumulator = (key: string, label: string): PatternAccumulator => ({ key, label, sampleCount: 0, top3Count: 0, finishSum: 0, laps: createLapAcc(), examples: [] });

export const registerTrainingAnalysisRoutes = (app: Hono<AppBindings>): void => {
  app.post('/api/analysis/training-patterns', async (c) => {
    try {
      const body: TrainingPatternsRequest = await c.req.json();
      const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
      const surfaceRaw = typeof body.surface === 'string' ? body.surface.trim() : '';
      const surface = surfaceRaw === '芝' ? '芝' : surfaceRaw === 'ダート' ? 'ダート' : surfaceRaw === 'turf' ? '芝' : surfaceRaw === 'dirt' ? 'ダート' : null;
      const distance = typeof body.distance === 'number' && Number.isFinite(body.distance) ? Math.round(body.distance) : null;
      if (!venue || !surface || !distance) return c.json({ error: 'venue, surface, distance は必須です。' }, 400);

      const fromDate = body.from ? normalizeDateDigits(body.from) : null;
      const toDate = body.to ? normalizeDateDigits(body.to) : null;
      const lookbackDaysRaw = typeof body.lookbackDays === 'number' && Number.isFinite(body.lookbackDays) ? body.lookbackDays : DEFAULT_LOOKBACK_DAYS;
      const lookbackDays = Math.max(1, Math.min(60, Math.round(lookbackDaysRaw)));
      const lookbackWindowMs = lookbackDays * MS_PER_DAY;
      const minSamplesRaw = typeof body.minSamples === 'number' && Number.isFinite(body.minSamples) ? body.minSamples : DEFAULT_MIN_SAMPLES;
      const minSamples = Math.max(1, Math.min(20, Math.round(minSamplesRaw)));
      const maxPatternsRaw = typeof body.maxPatternsPerType === 'number' && Number.isFinite(body.maxPatternsPerType) ? body.maxPatternsPerType : DEFAULT_MAX_PATTERNS;
      const maxPatternsPerType = Math.max(1, Math.min(20, Math.round(maxPatternsRaw)));

      const db = createDb(c.env.DB);
      const conditions: any[] = [eq(raceResults.venue, venue), eq(raceResults.courseType, surface), eq(raceResults.distance, distance)];
      if (fromDate) conditions.push(gte(raceResults.date, fromDate));
      if (toDate) conditions.push(lte(raceResults.date, toDate));

      const raceRows = await db
        .select({ raceId: raceResults.raceId, raceName: raceResults.raceName, raceDate: raceResults.date, venue: raceResults.venue, surface: raceResults.courseType, distance: raceResults.distance, horseName: horses.name, finishPosition: raceResults.finishPosition })
        .from(raceResults)
        .leftJoin(horses, eq(raceResults.horseId, horses.id))
        .where(and(...conditions as any))
        .orderBy(asc(raceResults.date), asc(raceResults.raceId));

      const raceSamples: RaceSample[] = [];
      const horseNames: string[] = [];
      let earliestRaceTimestamp = Number.POSITIVE_INFINITY;
      for (const row of raceRows) {
        const raceDateDigits = normalizeDateDigits(row.raceDate);
        if (!raceDateDigits) continue;
        const raceTimestamp = toUtcTimestamp(raceDateDigits);
        if (raceTimestamp === null) continue;
        const horseName = row.horseName ? row.horseName.trim() : '';
        if (!horseName) continue;
        raceSamples.push({ raceId: row.raceId, raceName: row.raceName, raceDateRaw: raceDateDigits, venue: row.venue, surface: row.surface as '芝' | 'ダート', distance: row.distance, horseName, finishPosition: row.finishPosition ?? null });
        horseNames.push(horseName);
        if (raceTimestamp < earliestRaceTimestamp) earliestRaceTimestamp = raceTimestamp;
      }

      if (raceSamples.length === 0) return c.json({ filters: { venue, surface, distance, lookbackDays }, totalRaces: 0, matchedRaces: 0, trainingTypes: [] });

      const trainingSamplesByHorse = new Map<string, TrainingSample[]>();
      for (const chunk of chunkArray(Array.from(new Set(horseNames)), 80)) {
        const rows = await db
          .select({ horseName: trainingRecords.horseName, trainingType: trainingRecords.trainingType, trainingDate: trainingRecords.trainingDate, trainingTime: trainingRecords.trainingTime, time5f: trainingRecords.time5f, time4f: trainingRecords.time4f, time2f: trainingRecords.time2f, time1f: trainingRecords.time1f })
          .from(trainingRecords)
          .where(inArray(trainingRecords.horseName, chunk as any))
          .orderBy(desc(trainingRecords.trainingDate), desc(trainingRecords.trainingTime));

        for (const row of rows) {
          const horseName = row.horseName ? row.horseName.trim() : '';
          if (!horseName) continue;
          const trainingType = row.trainingType as TrainingType;
          const timestamp = parseTrainingTimestamp(row.trainingDate, row.trainingTime);
          if (timestamp === null) continue;
          const sample: TrainingSample = {
            horseName,
            trainingType,
            trainingDateRaw: row.trainingDate ?? '',
            trainingTime: row.trainingTime,
            timestamp,
            laps: { '5f': row.time5f ?? null, '4f': row.time4f ?? null, '2f': row.time2f ?? null, '1f': row.time1f ?? null },
          };
          if (!trainingSamplesByHorse.has(horseName)) trainingSamplesByHorse.set(horseName, []);
          trainingSamplesByHorse.get(horseName)!.push(sample);
        }
      }

      for (const list of trainingSamplesByHorse.values()) list.sort((a, b) => b.timestamp - a.timestamp);

      const typeAccumulators: Record<TrainingType, TrainingTypeAccumulator> = { wood: createTypeAccumulator('wood'), hill: createTypeAccumulator('hill') };
      let matchedRaces = 0;
      const earliestAllowedTimestamp = earliestRaceTimestamp - lookbackWindowMs;

      for (const race of raceSamples) {
        const trainingList = trainingSamplesByHorse.get(race.horseName);
        if (!trainingList || trainingList.length === 0) continue;
        const raceTimestamp = toUtcTimestamp(race.raceDateRaw);
        if (raceTimestamp === null) continue;
        let matchedSample: TrainingSample | null = null;
        for (const sample of trainingList) {
          if (sample.timestamp > raceTimestamp) continue;
          if (sample.timestamp < earliestAllowedTimestamp) break;
          if (raceTimestamp - sample.timestamp <= lookbackWindowMs) {
            matchedSample = sample;
            break;
          }
        }
        if (!matchedSample) continue;

        matchedRaces += 1;
        const typeAcc = typeAccumulators[matchedSample.trainingType];
        typeAcc.sampleCount += 1;
        typeAcc.finishSum += race.finishPosition ?? 0;
        if (race.finishPosition !== null && race.finishPosition > 0 && race.finishPosition <= 3) typeAcc.top3Count += 1;
        updateLapAcc(typeAcc.laps, matchedSample.laps);

        const label = matchedSample.trainingType === 'wood'
          ? '5F:' + bucketTime(matchedSample.laps['5f'], 1) + ' / 2F:' + bucketTime(matchedSample.laps['2f'], 0.5) + ' / 1F:' + bucketTime(matchedSample.laps['1f'], 0.5)
          : '4F:' + bucketTime(matchedSample.laps['4f'], 0.5) + ' / 1F:' + bucketTime(matchedSample.laps['1f'], 0.5);
        const key = matchedSample.trainingType + '|' + label;
        const patternMap = typeAcc.patterns;
        const patternAcc = patternMap.get(key) ?? createPatternAccumulator(key, label);
        patternAcc.sampleCount += 1;
        patternAcc.finishSum += race.finishPosition ?? 0;
        if (race.finishPosition !== null && race.finishPosition > 0 && race.finishPosition <= 3) patternAcc.top3Count += 1;
        updateLapAcc(patternAcc.laps, matchedSample.laps);
        if (patternAcc.examples.length < 3) {
          const trainingDigits = normalizeDateDigits(matchedSample.trainingDateRaw);
          patternAcc.examples.push({ raceId: race.raceId, horseName: race.horseName, finishPosition: race.finishPosition, raceDate: toDateLabel(race.raceDateRaw), trainingDate: trainingDigits ? toDateLabel(trainingDigits) : matchedSample.trainingDateRaw });
        }
        patternMap.set(key, patternAcc);
      }

      const trainingTypes = (Object.values(typeAccumulators) as TrainingTypeAccumulator[])
        .filter((acc) => acc.sampleCount > 0)
        .map((acc) => ({
          trainingType: acc.trainingType,
          displayLabel: acc.displayLabel,
          sampleCount: acc.sampleCount,
          top3Count: acc.top3Count,
          placeRate: formatRate(acc.top3Count, acc.sampleCount),
          averageFinish: formatAverage(acc.finishSum, acc.sampleCount),
          average5f: pickAverage(acc.laps, '5f'),
          average4f: pickAverage(acc.laps, '4f'),
          average2f: pickAverage(acc.laps, '2f'),
          average1f: pickAverage(acc.laps, '1f'),
          patterns: Array.from(acc.patterns.values())
            .filter((pattern) => pattern.sampleCount >= minSamples)
            .sort((a, b) => b.sampleCount - a.sampleCount)
            .slice(0, maxPatternsPerType)
            .map((pattern) => ({
              label: pattern.label,
              sampleCount: pattern.sampleCount,
              top3Count: pattern.top3Count,
              placeRate: formatRate(pattern.top3Count, pattern.sampleCount),
              averageFinish: formatAverage(pattern.finishSum, pattern.sampleCount),
              average5f: pickAverage(pattern.laps, '5f'),
              average4f: pickAverage(pattern.laps, '4f'),
              average2f: pickAverage(pattern.laps, '2f'),
              average1f: pickAverage(pattern.laps, '1f'),
              examples: pattern.examples,
            })),
        }));

      return c.json({
        filters: { venue, surface, distance, lookbackDays, from: fromDate ? toDateLabel(fromDate) : null, to: toDate ? toDateLabel(toDate) : null, minSamples, maxPatternsPerType },
        totalRaces: raceSamples.length,
        matchedRaces,
        trainingTypes,
      });
    } catch (error) {
      console.error('[training-patterns] failed', error);
      return c.json({ error: '調教パターン分析の集計に失敗しました' }, 500);
    }
  });
};
