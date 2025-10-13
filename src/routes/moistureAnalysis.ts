// src/routes/moistureAnalysis.ts
// Provides moisture-outcome analysis API endpoints.
// We expose this endpoint so analysts can study race results against moisture levels.
// RELEVANT FILES:src/index.ts,src/db/schema.ts,web/src/pages/MoistureAnalysisPage.tsx,web/src/services/adminService.ts

import type { Hono } from 'hono';
import { createDb } from '../db/db';
import {
  horses,
  races,
  raceResults,
  trackConditions,
  trackConditionDailySummaries,
} from '../db/schema';
import { and, asc, desc, eq, gte, inArray, lt, lte } from 'drizzle-orm';

const TURF = '芝';
const DIRT = 'ダート';

type MoistureMetric = 'goal' | 'corner';

type AppBindings = { Bindings: { DB: unknown } };

type MoistureSample = {
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
};

type BucketStats = {
  min: number;
  max: number;
  raceIds: Set<string>;
  runnerCount: number;
  winCount: number;
  top3Count: number;
  finishSum: number;
  oddsSum: number;
  oddsCount: number;
  moistureSum: number;
  moistureCount: number;
  winnerTimes: number[];
  samples: MoistureSample[];
};

const normalizeSurface = (value?: string | null): '芝' | 'ダート' | undefined => {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (trimmed === TURF) return TURF;
  if (trimmed === DIRT) return DIRT;
  return undefined;
};

const resolveSurfaceValue = (value?: string | null): '芝' | 'ダート' | undefined => {
  if (!value) return undefined;
  if (value === 'turf') return TURF;
  if (value === 'dirt') return DIRT;
  return normalizeSurface(value);
};

const toSurfaceKey = (value?: '芝' | 'ダート'): 'turf' | 'dirt' | undefined => {
  if (value === TURF) return 'turf';
  if (value === DIRT) return 'dirt';
  return undefined;
};

const normalizeDateToISO = (raw?: string | null): string | null => {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, '');
  if (!digits) return null;
  let normalized = digits;
  if (digits.length === 6) {
    normalized = `20${digits}`;
  } else if (digits.length > 8) {
    normalized = digits.slice(0, 8);
  }
  if (normalized.length !== 8) return null;
  const year = normalized.slice(0, 4);
  const month = normalized.slice(4, 6);
  const day = normalized.slice(6, 8);
  return `${year}-${month}-${day}`;
};

const buildVenueCandidates = (raw?: string | null): string[] => {
  if (!raw) return [];
  const base = String(raw).trim();
  if (!base) return [];
  const candidates = new Set<string>();
  candidates.add(base);
  if (!base.endsWith('競馬場')) {
    candidates.add(`${base}競馬場`);
  } else {
    candidates.add(base.replace(/競馬場$/, ''));
  }
  return Array.from(candidates);
};

const toSecondsFromRaceTime = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const s = String(value).trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const [m, rest] = s.split(':');
    const sec = parseFloat(rest);
    const min = parseInt(m, 10) || 0;
    return min * 60 + (Number.isNaN(sec) ? 0 : sec);
  }
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || n <= 0) return 0;
  const minutes = Math.floor(n / 1000);
  const secTenth = n % 1000;
  const seconds = Math.floor(secTenth / 10);
  const tenth = secTenth % 10;
  return minutes * 60 + seconds + tenth / 10;
};

const formatSecondsToRaceTime = (value?: number | null): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(1);
  return `${minutes}:${seconds.padStart(4, '0')}`;
};

const fetchMoistureFromSummary = async (
  db: ReturnType<typeof createDb>,
  date?: string | null,
  venue?: string | null,
  surface?: '芝' | 'ダート' | undefined,
  metric: MoistureMetric = 'goal',
  cache?: Map<string, number | null>,
  logged?: Set<string>,
): Promise<number | undefined> => {
  const key = `${surface ?? ''}|${metric}|${date ?? ''}|${venue ?? ''}`;
  if (cache?.has(key)) {
    const cached = cache.get(key);
    return cached === null ? undefined : cached;
  }

  const isoDate = normalizeDateToISO(date);
  const venues = buildVenueCandidates(venue);
  const dateCandidates = new Set<string>();
  if (isoDate) {
    dateCandidates.add(isoDate);
    dateCandidates.add(isoDate.replace(/-/g, ''));
    dateCandidates.add(isoDate.replace(/-/g, '/'));
  }
  if (date && !isoDate) {
    const trimmed = String(date).trim();
    if (trimmed) {
      dateCandidates.add(trimmed);
    }
  }
  const dateList = Array.from(dateCandidates).filter(Boolean);

  if (dateList.length === 0 || venues.length === 0) {
    cache?.set(key, null);
    return undefined;
  }

  const row = await db
    .select({
      turfGoalPercent: trackConditionDailySummaries.turfGoalPercent,
      turfCornerPercent: trackConditionDailySummaries.turfCornerPercent,
      dirtGoalPercent: trackConditionDailySummaries.dirtGoalPercent,
      dirtCornerPercent: trackConditionDailySummaries.dirtCornerPercent,
    })
    .from(trackConditionDailySummaries)
    .where(
      and(
        inArray(trackConditionDailySummaries.measurementDate, dateList as any),
        inArray(trackConditionDailySummaries.venue, venues as any),
      ),
    )
    .orderBy(desc(trackConditionDailySummaries.updatedAt))
    .limit(1)
    .get();

  const surfaceKey = surface ? normalizeSurface(surface) ?? surface : undefined;
  let value: number | undefined;
  if (surfaceKey === TURF) {
    value = metric === 'corner' ? row?.turfCornerPercent ?? undefined : row?.turfGoalPercent ?? undefined;
  } else if (surfaceKey === DIRT) {
    value = metric === 'corner' ? row?.dirtCornerPercent ?? undefined : row?.dirtGoalPercent ?? undefined;
  } else {
    value = row?.turfGoalPercent ?? row?.dirtGoalPercent ?? row?.turfCornerPercent ?? row?.dirtCornerPercent ?? undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    value = undefined;
  }

  cache?.set(key, value ?? null);

  if (value === undefined && logged && !logged.has(key)) {
    console.log('[moisture] summary not found', { date: isoDate, venueCandidates: venues, surface: surfaceKey });
    logged.add(key);
  }

  return value;
};

export const registerMoistureAnalysisRoutes = (app: Hono<AppBindings>): void => {
  app.get('/api/analysis/moisture-outcomes', async (c) => {
    try {
      const db = createDb((c.env as any).DB);
      const query = c.req.query();

      const metric: MoistureMetric = query.metric === 'corner' ? 'corner' : 'goal';
      const focus = query.focus === 'winners' ? 'winners' : query.focus === 'top3' ? 'top3' : 'all';
      const surfaceFilter = resolveSurfaceValue(query.surface);
      const venueFilter = query.venue && query.venue !== 'all' ? query.venue : undefined;
      const distanceFilter = query.distance ? parseInt(String(query.distance), 10) : undefined;
      const from = query.from;
      const to = query.to;
      const limitParam = query.limit ? parseInt(String(query.limit), 10) : undefined;
      const limit = Number.isFinite(limitParam) && limitParam ? Math.min(Math.max(limitParam, 100), 5000) : 1000;
      const bucketParam = query.bucket ? parseFloat(String(query.bucket)) : undefined;
      const bucketSize = Number.isFinite(bucketParam) && bucketParam && bucketParam > 0 ? bucketParam : 1;

      const conditions = [] as any[];
      if (surfaceFilter) {
        conditions.push(eq(raceResults.courseType, surfaceFilter));
      }
      if (venueFilter) {
        conditions.push(eq(raceResults.venue, venueFilter));
      }
      if (Number.isFinite(distanceFilter) && distanceFilter) {
        conditions.push(eq(raceResults.distance, distanceFilter));
      }
      if (from) {
        conditions.push(gte(raceResults.date, from));
      }
      if (to) {
        conditions.push(lt(raceResults.date, to));
      }

      let queryBuilder = db
        .select({
          raceId: raceResults.raceId,
          date: raceResults.date,
          venue: raceResults.venue,
          raceName: raceResults.raceName,
          surface: raceResults.courseType,
          distance: raceResults.distance,
          finishPosition: raceResults.finishPosition,
          horseName: horses.name,
          time: raceResults.time,
          odds: raceResults.odds,
          popularity: raceResults.popularity,
          trackConditionId: raceResults.trackConditionId,
        })
        .from(raceResults)
        .innerJoin(races, eq(raceResults.raceId, races.raceId))
        .innerJoin(horses, eq(raceResults.horseId, horses.id));

      if (conditions.length > 0) {
        queryBuilder = queryBuilder.where(and(...conditions));
      }

      const rows = await queryBuilder.orderBy(desc(raceResults.date)).limit(limit);

      if (rows.length === 0) {
        return c.json({ buckets: [], overall: { raceCount: 0, runnerCount: 0 }, filters: { metric, bucket: bucketSize, focus } });
      }

      const trackConditionIds = Array.from(
        new Set(
          rows
            .map((row) => row.trackConditionId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );

      const trackConditionRows = trackConditionIds.length > 0
        ? await db
            .select({
              id: trackConditions.id,
              moistureContent: trackConditions.moistureContent,
            })
            .from(trackConditions)
            .where(inArray(trackConditions.id, trackConditionIds as any))
        : [];

      const trackConditionMap = new Map(trackConditionRows.map((row) => [row.id, row.moistureContent] as const));
      const summaryCache = new Map<string, number | null>();
      const summaryLog = new Set<string>();

      const buckets = new Map<number, BucketStats>();
      const overallRaceIds = new Set<string>();
      let totalRunners = 0;
      let totalMoistureSum = 0;
      let totalMoistureCount = 0;

      for (const row of rows) {
        const finish = typeof row.finishPosition === 'number' ? row.finishPosition : parseInt(String(row.finishPosition ?? ''), 10);
        if (!Number.isFinite(finish) || finish <= 0) {
          continue;
        }
        if (focus === 'winners' && finish !== 1) continue;
        if (focus === 'top3' && finish > 3) continue;

        const resolvedSurface = resolveSurfaceValue(row.surface);
        let moisture = row.trackConditionId ? trackConditionMap.get(row.trackConditionId) ?? undefined : undefined;
        if (typeof moisture !== 'number') {
          moisture = await fetchMoistureFromSummary(db, row.date, row.venue, resolvedSurface, metric, summaryCache, summaryLog);
        }
        if (typeof moisture !== 'number') {
          continue;
        }

        const bucketIndex = Math.floor(moisture / bucketSize);
        const bucketMin = bucketIndex * bucketSize;
        const bucketMax = bucketMin + bucketSize;

        let bucket = buckets.get(bucketIndex);
        if (!bucket) {
          bucket = {
            min: bucketMin,
            max: bucketMax,
            raceIds: new Set<string>(),
            runnerCount: 0,
            winCount: 0,
            top3Count: 0,
            finishSum: 0,
            oddsSum: 0,
            oddsCount: 0,
            moistureSum: 0,
            moistureCount: 0,
            winnerTimes: [],
            samples: [],
          };
          buckets.set(bucketIndex, bucket);
        }

        bucket.runnerCount += 1;
        bucket.finishSum += finish;
        bucket.moistureSum += moisture;
        bucket.moistureCount += 1;
        bucket.raceIds.add(row.raceId);
        overallRaceIds.add(row.raceId);
        totalRunners += 1;
        totalMoistureSum += moisture;
        totalMoistureCount += 1;

        if (finish === 1) {
          bucket.winCount += 1;
          const timeSeconds = toSecondsFromRaceTime(row.time);
          if (timeSeconds > 0) {
            bucket.winnerTimes.push(timeSeconds);
          }
        }
        if (finish <= 3) {
          bucket.top3Count += 1;
        }

        const oddsValue = typeof row.odds === 'number' ? row.odds : parseFloat(String(row.odds ?? ''));
        if (Number.isFinite(oddsValue)) {
          bucket.oddsSum += oddsValue;
          bucket.oddsCount += 1;
        }

        if (bucket.samples.length < 8) {
          bucket.samples.push({
            raceId: row.raceId,
            date: row.date,
            venue: row.venue,
            raceName: row.raceName,
            horseName: row.horseName,
            finishPosition: Number.isFinite(finish) ? finish : null,
            time: row.time ?? null,
            odds: Number.isFinite(oddsValue) ? oddsValue : null,
            popularity: typeof row.popularity === 'number' ? row.popularity : null,
            moisture,
          });
        }
      }

      const bucketResults = Array.from(buckets.values())
        .map((bucket) => {
          const avgWinningSeconds = bucket.winnerTimes.length > 0
            ? bucket.winnerTimes.reduce((sum, value) => sum + value, 0) / bucket.winnerTimes.length
            : null;
          return {
            moistureRange: {
              min: Number(bucket.min.toFixed(2)),
              max: Number(bucket.max.toFixed(2)),
              average: bucket.moistureCount > 0 ? Number((bucket.moistureSum / bucket.moistureCount).toFixed(2)) : null,
            },
            raceCount: bucket.raceIds.size,
            runnerCount: bucket.runnerCount,
            winRate: bucket.runnerCount > 0 ? bucket.winCount / bucket.runnerCount : 0,
            top3Rate: bucket.runnerCount > 0 ? bucket.top3Count / bucket.runnerCount : 0,
            averageFinish: bucket.runnerCount > 0 ? bucket.finishSum / bucket.runnerCount : null,
            averageOdds: bucket.oddsCount > 0 ? bucket.oddsSum / bucket.oddsCount : null,
            averageWinningTime: formatSecondsToRaceTime(avgWinningSeconds),
            averageWinningSeconds: avgWinningSeconds,
            samples: bucket.samples,
          };
        })
        .sort((a, b) => a.moistureRange.min - b.moistureRange.min);

      return c.json({
        buckets: bucketResults,
        overall: {
          raceCount: overallRaceIds.size,
          runnerCount: totalRunners,
          averageMoisture: totalMoistureCount > 0 ? Number((totalMoistureSum / totalMoistureCount).toFixed(2)) : null,
        },
        filters: {
          surface: surfaceFilter ?? 'all',
          venue: venueFilter ?? 'all',
          distance: Number.isFinite(distanceFilter) ? distanceFilter : null,
          metric,
          bucket: bucketSize,
          limit,
          focus,
          from: from ?? null,
          to: to ?? null,
        },
      });
    } catch (error) {
      console.error('[moisture] analysis failed', error);
      return c.json({ error: 'Failed to load moisture analysis data.' }, 500);
    }
  });

  app.get('/api/analysis/moisture-race-performance', async (c) => {
    try {
      const db = createDb((c.env as AppBindings['Bindings']).DB);
      const query = c.req.query();

      const metric: MoistureMetric = query.metric === 'corner' ? 'corner' : 'goal';
      const surfaceFilter = resolveSurfaceValue(query.surface);
      const venueFilter = query.venue && query.venue !== 'all' ? query.venue : undefined;
      const distanceFilter = query.distance ? parseInt(String(query.distance), 10) : undefined;
      const from = query.from;
      const to = query.to;
      const limitParam = query.limit ? parseInt(String(query.limit), 10) : undefined;
      const limit = Number.isFinite(limitParam) && limitParam ? Math.min(Math.max(limitParam, 10), 200) : 50;
      const topParam = query.top ? parseInt(String(query.top), 10) : undefined;
      const topCount = Number.isFinite(topParam) && topParam ? Math.min(Math.max(topParam, 1), 5) : 3;

      const raceConditions = [] as any[];
      if (surfaceFilter) {
        raceConditions.push(eq(races.surface, surfaceFilter));
      }
      if (venueFilter) {
        raceConditions.push(eq(races.venue, venueFilter));
      }
      if (Number.isFinite(distanceFilter) && distanceFilter) {
        raceConditions.push(eq(races.distance, distanceFilter));
      }
      if (from) {
        raceConditions.push(gte(races.date, from));
      }
      if (to) {
        raceConditions.push(lte(races.date, to));
      }

      const fetchLimit = Math.min(limit * 3, 300);

      let raceQuery = db
        .select({
          raceId: races.raceId,
          date: races.date,
          venue: races.venue,
          raceName: races.raceName,
          surface: races.surface,
          distance: races.distance,
          raceNo: races.raceNo,
          className: races.className,
          trackCond: races.trackCond,
          trackConditionId: races.trackConditionId,
        })
        .from(races);

      if (raceConditions.length > 0) {
        raceQuery = raceQuery.where(and(...raceConditions));
      }

      const raceRows = await raceQuery.orderBy(desc(races.date), asc(races.raceNo)).limit(fetchLimit);

      if (raceRows.length === 0) {
        return c.json({
          races: [],
          total: 0,
          filters: {
            surface: surfaceFilter ? toSurfaceKey(surfaceFilter) ?? 'all' : 'all',
            venue: venueFilter ?? 'all',
            distance: Number.isFinite(distanceFilter) ? distanceFilter : null,
            metric,
            limit,
            top: topCount,
            from: from ?? null,
            to: to ?? null,
          },
        });
      }

      const trackConditionIds = Array.from(
        new Set(
          raceRows
            .map((row) => row.trackConditionId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );

      const trackConditionRows = trackConditionIds.length > 0
        ? await db
            .select({
              id: trackConditions.id,
              moistureContent: trackConditions.moistureContent,
            })
            .from(trackConditions)
            .where(inArray(trackConditions.id, trackConditionIds as any))
        : [];

      const trackConditionMap = new Map(trackConditionRows.map((row) => [row.id, row.moistureContent] as const));
      const summaryCache = new Map<string, number | null>();
      const summaryLog = new Set<string>();

      const selectedRaces: Array<{
        raceId: string;
        date: string | null;
        isoDate: string | null;
        venue: string;
        raceName: string;
        surface: '芝' | 'ダート' | undefined;
        distance: number | null;
        raceNo: number | null;
        className: string | null;
        trackCond: string | null;
        moisture: number;
      }> = [];

      for (const row of raceRows) {
        const resolvedSurface = resolveSurfaceValue(row.surface);
        let moisture = row.trackConditionId ? trackConditionMap.get(row.trackConditionId) ?? undefined : undefined;
        if (typeof moisture !== 'number') {
          moisture = await fetchMoistureFromSummary(db, row.date, row.venue, resolvedSurface, metric, summaryCache, summaryLog);
        }
        if (typeof moisture !== 'number') continue;

        selectedRaces.push({
          raceId: row.raceId,
          date: row.date ?? null,
          isoDate: normalizeDateToISO(row.date) ?? row.date ?? null,
          venue: row.venue ?? '',
          raceName: row.raceName ?? '',
          surface: resolvedSurface,
          distance: typeof row.distance === 'number' ? row.distance : Number(row.distance ?? 0) || null,
          raceNo: typeof row.raceNo === 'number' ? row.raceNo : Number(row.raceNo ?? 0) || null,
          className: row.className ?? null,
          trackCond: row.trackCond ?? null,
          moisture,
        });

        if (selectedRaces.length >= limit) break;
      }

      if (selectedRaces.length === 0) {
        return c.json({
          races: [],
          total: 0,
          filters: {
            surface: surfaceFilter ? toSurfaceKey(surfaceFilter) ?? 'all' : 'all',
            venue: venueFilter ?? 'all',
            distance: Number.isFinite(distanceFilter) ? distanceFilter : null,
            metric,
            limit,
            top: topCount,
            from: from ?? null,
            to: to ?? null,
          },
        });
      }

      const raceIds = selectedRaces.map((race) => race.raceId);

      const resultRows = await db
        .select({
          raceId: raceResults.raceId,
          finishPosition: raceResults.finishPosition,
          horseId: raceResults.horseId,
          horseName: horses.name,
          time: raceResults.time,
          odds: raceResults.odds,
          popularity: raceResults.popularity,
        })
        .from(raceResults)
        .innerJoin(horses, eq(raceResults.horseId, horses.id))
        .where(inArray(raceResults.raceId, raceIds as any))
        .orderBy(asc(raceResults.finishPosition));

      const groupedResults = new Map<
        string,
        {
          finishers: {
            horseId: string;
            horseName: string;
            finishPosition: number;
            time: string | null;
            odds: number | null;
            popularity: number | null;
          }[];
          finishSum: number;
          runnerCount: number;
        }
      >();

      for (const row of resultRows) {
        const finish = typeof row.finishPosition === 'number'
          ? row.finishPosition
          : parseInt(String(row.finishPosition ?? ''), 10);
        if (!Number.isFinite(finish) || finish <= 0) continue;

        let entry = groupedResults.get(row.raceId);
        if (!entry) {
          entry = { finishers: [], finishSum: 0, runnerCount: 0 };
          groupedResults.set(row.raceId, entry);
        }

        entry.finishSum += finish;
        entry.runnerCount += 1;

        if (entry.finishers.length >= topCount) continue;

        const oddsValue = typeof row.odds === 'number' ? row.odds : parseFloat(String(row.odds ?? ''));
        const popularityValue = typeof row.popularity === 'number'
          ? row.popularity
          : parseInt(String(row.popularity ?? ''), 10);

        entry.finishers.push({
          horseId: row.horseId ?? '',
          horseName: row.horseName ?? '',
          finishPosition: finish,
          time: row.time ?? null,
          odds: Number.isFinite(oddsValue) ? oddsValue : null,
          popularity: Number.isFinite(popularityValue) ? popularityValue : null,
        });
      }

      const races = selectedRaces.map((race) => {
        const result = groupedResults.get(race.raceId);
        return {
          raceId: race.raceId,
          date: race.isoDate ?? race.date ?? '',
          venue: race.venue,
          raceName: race.raceName,
          surface: toSurfaceKey(race.surface) ?? 'turf',
          surfaceLabel: race.surface ?? '不明',
          distance: race.distance,
          raceNo: race.raceNo,
          className: race.className,
          trackCondition: race.trackCond,
          moisture: Number(race.moisture.toFixed(2)),
          metric,
          topFinishers: result ? result.finishers : [],
          averageFinish: result && result.runnerCount > 0
            ? Number((result.finishSum / result.runnerCount).toFixed(2))
            : null,
          runnerCount: result?.runnerCount ?? 0,
        };
      });

      return c.json({
        races,
        total: races.length,
        filters: {
          surface: surfaceFilter ? toSurfaceKey(surfaceFilter) ?? 'all' : 'all',
          venue: venueFilter ?? 'all',
          distance: Number.isFinite(distanceFilter) ? distanceFilter : null,
          metric,
          limit,
          top: topCount,
          from: from ?? null,
          to: to ?? null,
        },
      });
    } catch (error) {
      console.error('[moisture] race performance failed', error);
      return c.json({ error: 'Failed to load moisture race performance data.' }, 500);
    }
  });
};

