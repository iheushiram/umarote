import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './db/db';
import { horses, races, raceResults, raceEntries, trackConditions, trainingRecords } from './db/schema';
import { buildRaceId, parseMeetingDayFromLegacy } from './utils/raceId';
import type { NewHorse, NewRace, NewRaceResult, NewRaceEntry, NewTrainingRecord } from './db/schema';
import { eq, sql, and, inArray, desc, lt, lte, gte, gt } from 'drizzle-orm';

type EntryForDedup = {
  id: number;
  horseId: string | null;
  horseNo: number | null;
};

export function resolveDuplicateRaceEntryIds(entries: EntryForDedup[]): number[] {
  const seen = new Map<string, EntryForDedup>();
  const duplicates: number[] = [];

  for (const entry of entries) {
    if (!entry.horseId) continue;

    const currentNo = entry.horseNo ?? 0;
    const existing = seen.get(entry.horseId);

    if (!existing) {
      seen.set(entry.horseId, entry);
      continue;
    }

    const existingNo = existing.horseNo ?? 0;

    if (existingNo === 0 && currentNo !== 0) {
      duplicates.push(existing.id);
      seen.set(entry.horseId, entry);
    } else if (currentNo === 0 && existingNo !== 0) {
      duplicates.push(entry.id);
    } else {
      duplicates.push(entry.id);
    }
  }

  return duplicates;
}

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use('/*', cors());

// ヘルスチェック
app.get('/', (c) => {
  return c.json({ message: 'Umarote API is running' });
});

// ===== ヘルパー =====
function toSecondsFromRaceTime(value: string | number): number {
  if (value === null || value === undefined) return 0;
  const s = String(value).trim();
  if (!s) return 0;
  if (s.includes(':')) {
    const [m, rest] = s.split(':');
    const sec = parseFloat(rest);
    const min = parseInt(m, 10) || 0;
    return min * 60 + (isNaN(sec) ? 0 : sec);
  }
  // 数値形式（例: 1457 → 1分45秒7）
  const n = parseInt(s, 10);
  if (isNaN(n) || n <= 0) return 0;
  const minutes = Math.floor(n / 1000);
  const secTenth = n % 1000;
  const seconds = Math.floor(secTenth / 10);
  const tenth = secTenth % 10;
  return minutes * 60 + seconds + tenth / 10;
}

function normalizeDigits(input: string): string {
  const z2h: Record<string, string> = {
    '０':'0','１':'1','２':'2','３':'3','４':'4','５':'5','６':'6','７':'7','８':'8','９':'9'
  };
  return input.replace(/[０-９]/g, (ch) => z2h[ch] || ch);
}

function inferClassNameFromRaceName(name?: string): string | undefined {
  if (!name) return undefined;
  const n = normalizeDigits(name);
  if (/G\s*1|Ｇ\s*1/i.test(n)) return 'G1';
  if (/G\s*2|Ｇ\s*2/i.test(n)) return 'G2';
  if (/G\s*3|Ｇ\s*3/i.test(n)) return 'G3';
  if (/オープン|ＯＰ|OP/i.test(n)) return 'OP(L)';
  if (/新馬/.test(n)) return '新馬';
  if (/未勝利/.test(n)) return '未勝利';
  if (/1\s*勝/.test(n)) return '1勝';
  if (/2\s*勝/.test(n)) return '2勝';
  if (/3\s*勝/.test(n)) return '3勝';
  return undefined;
}

// CSVのクラス名を正規化（要求仕様）とgrade算出
function normalizeCsvClass(input?: string): { className?: string; grade?: 'OP' | 'G3' | 'G2' | 'G1' } {
  if (!input) return {};
  const s = normalizeDigits(String(input)).replace(/\s+/g, '').toUpperCase();
  if (s.includes('G1') || s.includes('Ｇ1') || s.includes('ＧＩ')) return { className: 'G1', grade: 'G1' };
  if (s.includes('G2') || s.includes('Ｇ2') || s.includes('ＧＩＩ')) return { className: 'G2', grade: 'G2' };
  if (s.includes('G3') || s.includes('Ｇ3') || s.includes('ＧＩＩＩ')) return { className: 'G3', grade: 'G3' };
  if (s.includes('OP') || s.includes('ＯＰ') || s.includes('オープン')) return { className: 'OP(L)', grade: 'OP' };
  if (s.includes('重賞')) return { className: '重賞', grade: undefined };
  if (s.includes('新馬')) return { className: '新馬', grade: undefined };
  if (s.includes('未勝利')) return { className: '未勝利', grade: undefined };
  if (s.includes('1勝')) return { className: '1勝', grade: undefined };
  if (s.includes('2勝')) return { className: '2勝', grade: undefined };
  if (s.includes('3勝')) return { className: '3勝', grade: undefined };
  return {};
}

function normalizeOffAt(input?: string): string | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const hh = String(parseInt(m[1], 10)).padStart(2, '0');
    const mm = m[2];
    return `${hh}:${mm}`;
  }
  // 例: 1640 → 16:40
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length === 4) {
    return `${digits.slice(0,2)}:${digits.slice(2)}`;
  }
  return undefined;
}

function classNameSynonyms(input: string): string[] {
  const s = normalizeDigits(input || '').replace(/\s+/g, '');
  const syn = new Set<string>();
  if (!s) return [];

  if (s.includes('1勝')) {
    ['1勝','1勝クラス','1勝ｸﾗｽ','１勝','１勝クラス','１勝ｸﾗｽ'].forEach(v => syn.add(v));
  } else if (s.includes('2勝')) {
    ['2勝','2勝クラス','2勝ｸﾗｽ','２勝','２勝クラス','２勝ｸﾗｽ'].forEach(v => syn.add(v));
  } else if (s.includes('3勝')) {
    ['3勝','3勝クラス','3勝ｸﾗｽ','３勝','３勝クラス','３勝ｸﾗｽ'].forEach(v => syn.add(v));
  } else if (/G\s*1|Ｇ\s*1/i.test(s) || s.toUpperCase()==='G1') {
    ['G1','Ｇ1','ＧＩ'].forEach(v => syn.add(v));
  } else if (/G\s*2|Ｇ\s*2/i.test(s) || s.toUpperCase()==='G2') {
    ['G2','Ｇ2','ＧＩＩ'].forEach(v => syn.add(v));
  } else if (/G\s*3|Ｇ\s*3/i.test(s) || s.toUpperCase()==='G3') {
    ['G3','Ｇ3','ＧＩＩＩ'].forEach(v => syn.add(v));
  } else if (s.includes('OP') || s.includes('ＯＰ') || s.includes('オープン')) {
    ['OP(L)','OP','ＯＰ','オープン'].forEach(v => syn.add(v));
  } else if (s.includes('重賞')) {
    ['G1','G2','G3','重賞'].forEach(v => syn.add(v));
  } else if (s.includes('新馬')) {
    ['新馬'].forEach(v => syn.add(v));
  } else if (s.includes('未勝利')) {
    ['未勝利'].forEach(v => syn.add(v));
  } else {
    syn.add(s);
  }
  return Array.from(syn);
}

// 馬データのCRUD操作
app.get('/api/horses', async (c) => {
  const db = createDb(c.env.DB);
  const allHorses = await db.select().from(horses);
  return c.json(allHorses);
});

app.post('/api/horses', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const horsesData: NewHorse[] = await c.req.json();
    
    // UPSERT: 既存データがあれば更新、なければ挿入
    for (const horseData of horsesData) {
      await db.insert(horses)
        .values({
          ...horseData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: horses.id,
          set: {
            name: horseData.name,
            birthDate: horseData.birthDate,
            sex: horseData.sex,
            color: horseData.color,
            father: horseData.father,
            mother: horseData.mother,
            maternalGrandfather: (horseData as any).maternalGrandfather || horses.maternalGrandfather,
            trainer: horseData.trainer,
            owner: horseData.owner,
            breeder: horseData.breeder,
            earnings: horseData.earnings,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }
    
    return c.json({ message: `${horsesData.length}件の馬データを処理しました` });
  } catch (error) {
    console.error('Error upserting horses:', error);
    return c.json({ error: '馬データの処理に失敗しました' }, 500);
  }
});

app.get('/api/horses/:id', async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const horse = await db.select().from(horses).where(eq(horses.id, id)).get();
  
  if (!horse) {
    return c.json({ error: '馬が見つかりません' }, 404);
  }
  
  return c.json(horse);
});

// レースデータのCRUD操作
app.get('/api/races', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const date = c.req.query('date');
    

    if (date) {
      // 日付パラメータがある場合は、YYYY-MM-DD形式をYYYYMMDD形式に変換
      const dateStr = date.replace(/-/g, '');

      const filteredRaces = await db.select().from(races).where(eq(races.date, dateStr));

      return c.json(filteredRaces);
    } else {
      // 日付パラメータがない場合は全レースを取得
      const allRaces = await db.select().from(races);
      return c.json(allRaces);
    }
  } catch (error) {
    console.error('Error fetching races:', error);
    return c.json({ error: 'レース情報の取得に失敗しました' }, 500);
  }
});

app.post('/api/races', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const racesData: NewRace[] = await c.req.json();
    
    // UPSERT: 既存データがあれば更新、なければ挿入
    for (const raceData of racesData) {
      await db.insert(races)
        .values({
          ...raceData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: races.raceId,
          set: {
            date: raceData.date,
            venue: raceData.venue,
            meetingNumber: raceData.meetingNumber,
            dayNumber: raceData.dayNumber,
            raceNo: raceData.raceNo,
            raceName: raceData.raceName,
            className: raceData.className,
            surface: raceData.surface,
            distance: raceData.distance,
            direction: raceData.direction,
            courseConf: raceData.courseConf,
            trackCond: raceData.trackCond,
            fieldSize: raceData.fieldSize,
            offAt: raceData.offAt,
            grade: raceData.grade,
            win5: raceData.win5,
            status: raceData.status,
            weather: raceData.weather,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }
    
    return c.json({ message: `${racesData.length}件のレースデータを処理しました` });
  } catch (error) {
    console.error('Error upserting races:', error);
    return c.json({ error: 'レースデータの処理に失敗しました' }, 500);
  }
});

// レース結果のCRUD操作
app.get('/api/race-results', async (c) => {
  const db = createDb(c.env.DB);
  const raceId = c.req.query('raceId');
  const horseId = c.req.query('horseId');
  const limitParam = c.req.query('limit');
  const beforeDate = c.req.query('beforeDate');
  const limit = limitParam ? parseInt(limitParam) : undefined;

  // 条件組み立て
  const conditions: any[] = [];
  if (raceId) conditions.push(eq(raceResults.raceId, raceId));
  if (horseId) conditions.push(eq(raceResults.horseId, horseId));
  if (beforeDate) conditions.push(lt(raceResults.date, beforeDate)); // 当日より前のみ
  const whereClause: any = conditions.length > 0 ? and(...conditions as any) : undefined;

  // 並び替え: 日付降順 → 人気昇順
  const query = db.select().from(raceResults)
    .where(whereClause as any)
    .orderBy(desc(raceResults.date), raceResults.popularity);

  const all = await query;
  const sliced = typeof limit === 'number' && limit > 0 ? all.slice(0, limit) : all;
  

  
  return c.json(sliced);
});

app.post('/api/race-results', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const { results } = await c.req.json();
    const resultsData: NewRaceResult[] = results;

    const targetRaceIds = Array.from(
      new Set(
        resultsData
          .map((r) => r.raceId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    if (targetRaceIds.length > 0) {
      await db.delete(raceResults)
        .where(inArray(raceResults.raceId, targetRaceIds));
      await db.delete(raceEntries)
        .where(and(
          inArray(raceEntries.raceId, targetRaceIds as any),
          eq(raceEntries.horseNo, 0)
        ));

      for (const raceId of targetRaceIds) {
        const entries = await db.select({ id: raceEntries.id, horseId: raceEntries.horseId, horseNo: raceEntries.horseNo })
          .from(raceEntries)
          .where(eq(raceEntries.raceId, raceId));

        const duplicateIds = resolveDuplicateRaceEntryIds(entries as EntryForDedup[]);
        if (duplicateIds.length > 0) {
          await db.delete(raceEntries)
            .where(inArray(raceEntries.id, duplicateIds));
        }
      }
    }
    
    // UPSERT: 既存データがあれば更新、なければ挿入
    for (const resultData of resultsData) {
      await db.insert(raceResults)
        .values({
          ...resultData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: raceResults.id,
          set: {
            raceId: resultData.raceId,
            horseId: resultData.horseId,
            date: resultData.date,
            raceName: resultData.raceName,
            venue: resultData.venue,
            courseType: resultData.courseType,
            distance: resultData.distance,
            direction: resultData.direction,
            courseConf: resultData.courseConf,
            weather: resultData.weather,
            courseCondition: resultData.courseCondition,

            pos1c: (resultData as any).pos1c,
            finishPosition: resultData.finishPosition,
            jockey: resultData.jockey,
            weight: resultData.weight,
            time: resultData.time,
            margin: resultData.margin,
            pos2c: resultData.pos2c,
            pos3c: resultData.pos3c,
            pos4c: resultData.pos4c,
            cornerPassings: (resultData as any).cornerPassings,
            averagePosition: resultData.averagePosition,
            lastThreeFurlong: resultData.lastThreeFurlong,
            averageThreeFurlong: (resultData as any).averageThreeFurlong,
            odds: resultData.odds,
            popularity: resultData.popularity,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }
    
    return c.json({ message: `${resultsData.length}件のレース結果データを処理しました` });
  } catch (error) {
    console.error('Error upserting race results:', error);
    return c.json({ error: 'レース結果データの処理に失敗しました' }, 500);
  }
});

// データベースの中身を確認するためのデバッグエンドポイント
app.get('/api/debug/race-results', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
    
    const results = await db.select({
      id: raceResults.id,
      raceId: raceResults.raceId,
      horseId: raceResults.horseId,
      pos2c: raceResults.pos2c,
      pos3c: raceResults.pos3c,
      pos4c: raceResults.pos4c,
      finishPosition: raceResults.finishPosition,
      date: raceResults.date
    })
    .from(raceResults)
    .limit(limit);
    

    
    return c.json({
      message: `${results.length}件のレコードを確認しました`,
      results: results
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return c.json({ error: 'デバッグデータの取得に失敗しました' }, 500);
  }
});

// racesテーブルのデバッグエンドポイント
app.get('/api/debug/races', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
    
    const racesData = await db.select({
      raceId: races.raceId,
      date: races.date,
      venue: races.venue,
      raceName: races.raceName,
      surface: races.surface,
      distance: races.distance,
      direction: races.direction,
      trackCond: races.trackCond,
      status: races.status
    })
    .from(races)
    .limit(limit);
    

    
    return c.json({
      message: `${racesData.length}件のレコードを確認しました`,
      races: racesData
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return c.json({ error: 'デバッグデータの取得に失敗しました' }, 500);
  }
});

// race-entriesのデバッグエンドポイント
app.get('/api/debug/race-entries', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : 10;
    
    const entries = await db.select({
      id: raceEntries.id,
      raceId: raceEntries.raceId,
      horseId: raceEntries.horseId,
      frameNo: raceEntries.frameNo,
      horseNo: raceEntries.horseNo,
      jockey: raceEntries.jockey,
      weight: raceEntries.weight,
      trainer: raceEntries.trainer,
      affiliation: raceEntries.affiliation,
      popularity: raceEntries.popularity,
      bodyWeight: raceEntries.bodyWeight,
      bodyWeightDiff: raceEntries.bodyWeightDiff,
      date: raceEntries.date
    })
    .from(raceEntries)
    .limit(limit);
    

    
    return c.json({
      message: `${entries.length}件のレコードを確認しました`,
      entries: entries
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return c.json({ error: 'デバッグデータの取得に失敗しました' }, 500);
  }
});

app.post('/api/race-results-with-horses', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const { results } = await c.req.json();
    const resultsData: NewRaceResult[] = results;

    const targetRaceIds = Array.from(
      new Set(
        resultsData
          .map((r) => r.raceId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    if (targetRaceIds.length > 0) {
      await db.delete(raceResults)
        .where(inArray(raceResults.raceId, targetRaceIds));
      await db.delete(raceEntries)
        .where(and(
          inArray(raceEntries.raceId, targetRaceIds as any),
          eq(raceEntries.horseNo, 0)
        ));

      for (const raceId of targetRaceIds) {
        const entries = await db.select({ id: raceEntries.id, horseId: raceEntries.horseId, horseNo: raceEntries.horseNo })
          .from(raceEntries)
          .where(eq(raceEntries.raceId, raceId));

        const duplicateIds = resolveDuplicateRaceEntryIds(entries as EntryForDedup[]);
        if (duplicateIds.length > 0) {
          await db.delete(raceEntries)
            .where(inArray(raceEntries.id, duplicateIds));
        }
      }
    }
    
    // 1. レース情報を抽出して登録（既に登録済みの場合はスキップ）
    const raceMap = new Map<string, NewRace>();
    
    for (const resultData of resultsData) {
      if (resultData.raceId && !raceMap.has(resultData.raceId)) {
        // レース結果からレース情報を推定
        const classFromResult = (resultData as any).className || (resultData as any).class || undefined;
        const offAtFromResult = (resultData as any).offAt || (resultData as any).発走時刻 || undefined;
        const { className: clsCsv, grade: gradeCsv } = normalizeCsvClass(classFromResult);
        const offAtCsv = normalizeOffAt(offAtFromResult);

        const raceData: NewRace = {
          raceId: resultData.raceId,
          date: resultData.date,
          venue: (resultData as any).venueNormalized || resultData.venue, // 正規化された開催地
          meetingNumber: (resultData as any).meetingNumber || 1,
          dayNumber: (resultData as any).dayNumber || 1,
          raceNo: (resultData as any).raceNo || 1,
          raceName: resultData.raceName,
          className: clsCsv || (resultData as any).className || inferClassNameFromRaceName(resultData.raceName) || '未勝利',
          surface: resultData.courseType,
          distance: resultData.distance,
          direction: resultData.direction || '右',
          trackCond: resultData.courseCondition,
          fieldSize: (resultData as any).fieldSize,
          win5: false,
          status: '確定',
          offAt: offAtCsv,
          grade: gradeCsv,
        };
        raceMap.set(resultData.raceId, raceData);
      }
    }
    
    // レースデータをUPSERT
    for (const raceData of raceMap.values()) {
      await db.insert(races)
        .values({
          ...raceData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: races.raceId,
          set: {
            date: raceData.date,
            venue: raceData.venue,
            meetingNumber: raceData.meetingNumber,
            dayNumber: raceData.dayNumber,
            raceNo: raceData.raceNo,
            raceName: raceData.raceName,
            className: raceData.className,
            surface: raceData.surface,
            distance: raceData.distance,
            direction: raceData.direction,
            trackCond: raceData.trackCond,
            fieldSize: raceData.fieldSize,
            offAt: raceData.offAt,
            grade: raceData.grade,
            win5: raceData.win5,
            status: raceData.status,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }
    
    // 2. 馬の基本情報を抽出して登録（既に登録済みの場合はスキップ）
    const horseMap = new Map<string, NewHorse>();
    
  for (const resultData of resultsData) {
      if (resultData.horseId && !horseMap.has(resultData.horseId)) {
        // レース結果から馬の基本情報を推定
        const horseData: NewHorse = {
          id: resultData.horseId,
          name: (resultData as any).horseName || resultData.raceName.split('・')[1] || resultData.raceName, // 馬名を優先
          birthDate: (resultData as any).horseBirthDate || ((resultData as any).horseAge ? 
            `${new Date(resultData.date).getFullYear() - parseInt((resultData as any).horseAge) + 1}0101`.padStart(8, '0') : 
            `${new Date(resultData.date).getFullYear() - 2}0101`.padStart(8, '0')), // 年齢から生年を計算
          sex: (resultData as any).horseSex || '牝', // 性別を優先
          color: '',
          father: (resultData as any).horseFather || '',
          mother: (resultData as any).horseMother || '',
          maternalGrandfather: (resultData as any).horseMaternalGrandfather || '',
          trainer: (resultData as any).horseTrainer || resultData.jockey || '', // 調教師を優先
          owner: (resultData as any).horseOwner || '',
          breeder: (resultData as any).horseBreeder || '',
          earnings: (resultData as any).horseEarnings || 0, // 賞金を優先
        };
        horseMap.set(resultData.horseId, horseData);
      }
    }
    
    // 馬データをUPSERT
    for (const horseData of horseMap.values()) {
      await db.insert(horses)
        .values({
          ...horseData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
    .onConflictDoUpdate({
      target: horses.id,
      set: {
        name: horseData.name,
        birthDate: horseData.birthDate,
        sex: horseData.sex,
        color: horseData.color,
        father: horseData.father,
        mother: horseData.mother,
        maternalGrandfather: (horseData as any).maternalGrandfather || horses.maternalGrandfather,
        trainer: horseData.trainer,
        owner: horseData.owner,
        breeder: horseData.breeder,
        earnings: horseData.earnings,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });
    }
    
    // 3. 出馬表データを既存レコードに対してのみ更新
    for (const resultData of resultsData) {
      const existing = await db
        .select({ id: raceEntries.id })
        .from(raceEntries)
        .where(and(
          eq(raceEntries.raceId, resultData.raceId),
          eq(raceEntries.horseId, resultData.horseId)
        ))
        .get();

      if (existing?.id !== undefined && existing?.id !== null) {
        await db.update(raceEntries)
          .set({
            popularity: resultData.popularity,
            jockey: resultData.jockey,
            weight: resultData.weight,
            prizeMoney: (resultData as any).prizeMoney || null,
            earnedMoney: (resultData as any).earnedMoney || null,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(raceEntries.id, existing.id));
      }
    }

    // 4. レース結果をUPSERT
    for (const resultData of resultsData) {
      await db.insert(raceResults)
        .values({
          ...resultData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: raceResults.id,
          set: {
            raceId: resultData.raceId,
            horseId: resultData.horseId,
            date: resultData.date,
            raceName: resultData.raceName,
            venue: resultData.venue,
            courseType: resultData.courseType,
            distance: resultData.distance,
            direction: resultData.direction,
            courseConf: resultData.courseConf,
            weather: resultData.weather,
            courseCondition: resultData.courseCondition,

            pos1c: (resultData as any).pos1c,
            finishPosition: resultData.finishPosition,
            jockey: resultData.jockey,
            weight: resultData.weight,
            time: resultData.time,
            margin: resultData.margin,
            pos2c: resultData.pos2c,
            pos3c: resultData.pos3c,
            pos4c: resultData.pos4c,
            cornerPassings: (resultData as any).cornerPassings,
            averagePosition: resultData.averagePosition,
            lastThreeFurlong: resultData.lastThreeFurlong,
            averageThreeFurlong: (resultData as any).averageThreeFurlong,
            odds: resultData.odds,
            popularity: resultData.popularity,
            // 賞金情報
            prizeMoney: (resultData as any).prizeMoney || null,
            earnedMoney: (resultData as any).earnedMoney || null,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }
    
    return c.json({ 
      message: `${raceMap.size}件のレースデータ、${horseMap.size}件の馬データ、${resultsData.length}件のレース結果データを処理しました` 
    });
  } catch (error) {
    console.error('Error upserting race results with horses:', error);
    return c.json({ error: 'レース結果と馬データの処理に失敗しました' }, 500);
  }
});

// 馬のレース結果を取得
app.get('/api/horses/:id/results', async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const results = await db.select().from(raceResults).where(eq(raceResults.horseId, id));
  return c.json(results);
});

// 出馬表のCRUD操作
app.post('/api/race-entries', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const entriesData: NewRaceEntry[] = await c.req.json();
    
    // INSERT（1件ずつ）+ 詳細ログ
    for (const e of entriesData) {
      try {
        await db.insert(raceEntries)
          .values({
            raceId: e.raceId,
            horseId: e.horseId,
            date: e.date || new Date().toISOString().split('T')[0].replace(/-/g, ''),
            frameNo: e.frameNo,
            horseNo: e.horseNo,
            age: e.age,
            jockey: e.jockey,
            weight: e.weight,
            trainer: e.trainer,
            affiliation: e.affiliation,
            popularity: e.popularity,
            bodyWeight: e.bodyWeight,
            bodyWeightDiff: e.bodyWeightDiff,
            blinkers: e.blinkers,
            maternalGrandfather: (e as any).maternalGrandfather || null,
            updatedAt: sql`CURRENT_TIMESTAMP`
          });
      } catch (err) {
        console.error('Failed to insert race entry', { raceId: e.raceId, horseId: e.horseId, error: err });
        throw err;
      }
    }

    return c.json({ message: `${entriesData.length}件の出馬表データを処理しました` });
  } catch (error) {
    console.error('Error inserting race entries:', error);
    return c.json({ error: '出馬表データの追加に失敗しました' }, 500);
  }
});

// 出馬表CSVアップロード用エンドポイント
app.post('/api/race-entries-csv', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const { csvData } = await c.req.json();
    
    if (!Array.isArray(csvData) || csvData.length === 0) {
      return c.json({ error: 'CSVデータが無効です' }, 400);
    }

    const entriesData: NewRaceEntry[] = [];
    const horsesData: NewHorse[] = [];
    const racesData: NewRace[] = [];

    // CSVデータを処理
    for (const row of csvData) {
      // 日付の正規化
      let normalizedDate = row['年月日'];

      if (normalizedDate && normalizedDate.length === 6) {
        // 6桁形式（YYMMDD）を8桁形式（YYYYMMDD）に変換
        normalizedDate = `20${normalizedDate}`;
      } else if (normalizedDate && normalizedDate.includes('.')) {
        // ドット区切り形式（2025. 8.10）を8桁形式に変換
        const parts = normalizedDate.replace(/\s+/g, '').split('.');
        if (parts.length >= 3) {
          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          normalizedDate = `${year}${month}${day}`;
        }
      }
      
      // レースIDの生成（YYYY + 会場2桁 + 開催2桁 + 日次2桁 + R2桁 = 12桁）
      // 入力CSV: 日付(yyyy.mm.dd) or 年月日, 開催(例: 1札6), R
      const rawDate = row['年月日'] || row['日付'] || row['日付(yyyy.mm.dd)'] || '';
      let date = rawDate;
      if (typeof date === 'string' && date.includes('.')) {
        const parts = date.replace(/\s+/g, '').split('.');
        if (parts.length >= 3) {
          const y = parts[0];
          const m = parts[1].padStart(2, '0');
          const d = parts[2].padStart(2, '0');
          date = `${y}${m}${d}`;
        }
      }
      const raceNo = row['R'];
      const venueComposite = row['開催'] || row['場所'] || '';
      const legacyId = row['レースID'] || '';

      const { parseFromVenueField, normalizeVenueName } = await import('./utils/raceId');
      const mdLegacy = parseMeetingDayFromLegacy(String(legacyId));
      const fromVenue = parseFromVenueField(String(venueComposite));
      const venuePlace = fromVenue.venueName || normalizeVenueName(String(venueComposite));
      const meeting = fromVenue.meeting || mdLegacy.meeting || '01';
      const day = fromVenue.day || mdLegacy.day || '01';

      const raceId = buildRaceId({
        date: String(date || ''),
        place: String(venuePlace || ''),
        raceNo: String(raceNo || ''),
        meeting,
        day
      });
      
      // 馬IDの生成（血統登録番号の頭に20を追加）
      const horseId = `20${row['血統登録番号']}`;
      
      // レース情報の作成
      const csvClassRaw = row['クラス名'] || row['クラス'] || '';
      const { className: clsCsv, grade: gradeCsv } = normalizeCsvClass(csvClassRaw);
      const offAtCsv = normalizeOffAt(row['発走時刻'] || row['発走'] || row['発走時間']);

      const raceData: NewRace = {
        raceId: raceId,
        date: normalizedDate,
        venue: venuePlace, // 正式名称で保存（例: 福島）
        meetingNumber: parseInt(String(meeting)),
        dayNumber: parseInt(String(day)),
        raceNo: parseInt(row['R']),
        raceName: row['レース名'],
        className: clsCsv || inferClassNameFromRaceName(row['レース名']) || '未勝利',
        surface: (() => {
          const sd = row['芝・ダ'];
          if (sd === '芝') return '芝';
          if (sd === 'ダート' || sd === 'ダ') return 'ダート';
          const distStr = String(row['距離'] || '');
          if (/^芝/.test(distStr)) return '芝';
          if (/^ダ/.test(distStr)) return 'ダート';
          return 'ダート';
        })(),
        distance: (() => {
          const d = String(row['距離'] || '').replace(/[^0-9]/g, '');
          return d ? parseInt(d) : 0;
        })(),
        direction: '右', // デフォルト値
        trackCond: '良', // デフォルト値
        fieldSize: parseInt(row['頭数']) || 0,
        win5: false,
        status: '発売中',
        offAt: offAtCsv,
        grade: gradeCsv,
      };
      
      // 馬の基本情報の作成
      const horseData: NewHorse = {
        id: horseId,
        name: row['馬名'],
        birthDate: `${new Date().getFullYear() - parseInt(row['年齢']) + 1}0101`, // 年齢から生年を推定
        sex: row['性別'],
        color: row['毛色'] || '',
        father: row['種牡馬'] || '',
        mother: row['母'] || '',
        maternalGrandfather: row['母父馬'] || row['母父'] || '',
        trainer: row['調教師'] || '',
        owner: row['馬主'] || '',
        breeder: row['生産者'] || '',
        earnings: 0,
      };
      
      // 出馬表情報の作成
      const entryData: NewRaceEntry = {
        raceId: raceId,
        horseId: horseId,
        date: normalizedDate,
        frameNo: parseInt(row['枠']) || 0,
        horseNo: parseInt(row['馬番']) || 0,
        age: parseInt(row['年齢']) || 0,
        jockey: row['騎手'] || '',
        weight: parseFloat(row['斤量']) || 0,
        trainer: row['調教師'] || '',
        affiliation: row['所属'] || '',
        popularity: parseInt(row['本人気']) || 0,
        bodyWeight: 0,
        bodyWeightDiff: 0,
        blinkers: false,
        // レース基本情報
        raceName: row['レース名'] || '',
        surface: (row['芝・ダ'] as '芝' | 'ダート') || '芝',
        distance: parseInt(row['距離']) || 0,
        // 馬の基本情報
        horseName: row['馬名'] || '',
        sex: (row['性別'] as '牡' | '牝' | 'セ') || '牡',
        color: row['毛色'] || '',
        father: row['種牡馬'] || '',
        mother: row['母'] || '',
        owner: row['馬主'] || '',
        breeder: row['生産者'] || '',
        maternalGrandfather: row['母父馬'] || row['母父'] || '',
        // レース結果情報
        previousPopularity: row['前人気'] ? parseInt(row['前人気']) : null,
        previousFinishPosition: row['前着'] ? parseInt(row['前着']) : null,
        previousOdds: row['前オッズ'] ? parseFloat(row['前オッズ']) : null,
        previousFinishOrder: row['前着順'] ? parseInt(row['前着順']) : null,
        // その他の情報
        dayNumber: row['日次'] ? parseInt(row['日次']) : null,
        interval: row['間隔'] ? parseInt(row['間隔']) : null,
        prizeMoney: row['本賞金'] ? parseInt(row['本賞金']) : null,
        earnedMoney: row['収得賞金'] ? parseInt(row['収得賞金']) : null
      };
      
      entriesData.push(entryData);
      horsesData.push(horseData);
      racesData.push(raceData);
    }

    // レースデータをUPSERT
    for (const raceData of racesData) {
      await db.insert(races)
        .values({
          ...raceData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: races.raceId,
          set: {
            date: raceData.date,
            venue: raceData.venue,
            meetingNumber: raceData.meetingNumber,
            dayNumber: raceData.dayNumber,
            raceNo: raceData.raceNo,
            raceName: raceData.raceName,
            className: raceData.className,
            surface: raceData.surface,
            distance: raceData.distance,
            direction: raceData.direction,
            trackCond: raceData.trackCond,
            fieldSize: raceData.fieldSize,
            offAt: raceData.offAt,
            grade: raceData.grade,
            win5: raceData.win5,
            status: raceData.status,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }

    // 馬データをUPSERT
    for (const horseData of horsesData) {
      await db.insert(horses)
        .values({
          ...horseData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .onConflictDoUpdate({
          target: horses.id,
          set: {
            name: horseData.name,
            birthDate: horseData.birthDate,
            sex: horseData.sex,
            color: horseData.color,
            father: horseData.father,
            mother: horseData.mother,
            trainer: horseData.trainer,
            owner: horseData.owner,
            breeder: horseData.breeder,
            earnings: horseData.earnings,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }

    // 出馬表データをUPSERT（重複時は上書き）※ UNIQUE制約なしのため手動UPSERT
    for (const entryData of entriesData) {
      const existing = await db
        .select({ id: raceEntries.id })
        .from(raceEntries)
        .where(and(
          eq(raceEntries.raceId, entryData.raceId),
          eq(raceEntries.horseId, entryData.horseId)
        ))
        .get();

      if (existing?.id !== undefined && existing?.id !== null) {
        await db.update(raceEntries)
          .set({
            date: entryData.date,
            frameNo: entryData.frameNo,
            horseNo: entryData.horseNo,
            age: entryData.age,
            jockey: entryData.jockey,
            weight: entryData.weight,
            trainer: entryData.trainer,
            affiliation: entryData.affiliation,
            popularity: entryData.popularity,
            bodyWeight: entryData.bodyWeight,
            bodyWeightDiff: entryData.bodyWeightDiff,
            blinkers: entryData.blinkers,
            maternalGrandfather: entryData.maternalGrandfather,
            // レース基本情報
            raceName: entryData.raceName,
            surface: entryData.surface,
            distance: entryData.distance,
            // 馬の基本情報
            horseName: entryData.horseName,
            sex: entryData.sex,
            color: entryData.color,
            father: entryData.father,
            mother: entryData.mother,
            owner: entryData.owner,
            breeder: entryData.breeder,
            // レース結果情報
            previousPopularity: entryData.previousPopularity,
            previousFinishPosition: entryData.previousFinishPosition,
            previousOdds: entryData.previousOdds,
            previousFinishOrder: entryData.previousFinishOrder,
            // その他の情報
            dayNumber: entryData.dayNumber,
            interval: entryData.interval,
            prizeMoney: entryData.prizeMoney,
            earnedMoney: entryData.earnedMoney,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(raceEntries.id, existing.id));
      } else {
        await db.insert(raceEntries)
          .values({
            ...entryData,
            updatedAt: sql`CURRENT_TIMESTAMP`
          });
      }
    }

    return c.json({ 
      message: `${entriesData.length}件の出馬表データを処理しました`,
      processed: {
        races: racesData.length,
        horses: horsesData.length,
        entries: entriesData.length
      }
    });
  } catch (error) {
    console.error('Error processing race entries CSV:', error);
    return c.json({ error: '出馬表CSVデータの処理に失敗しました' }, 500);
  }
});

app.post('/api/training-records', async (c) => {
  try {
    const body = await c.req.json();
    const recordsInput = Array.isArray(body?.records) ? body.records : Array.isArray(body?.csvData) ? body.csvData : null;
    if (!recordsInput || recordsInput.length === 0) {
      return c.json({ error: '調教データが空です' }, 400);
    }

    const toNullableNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'number' && !isNaN(value)) return value;
      const normalized = String(value).trim();
      if (!normalized) return null;
      const replaced = normalized.replace(/[^0-9\.\-]/g, '');
      if (!replaced) return null;
      const num = parseFloat(replaced);
      return Number.isFinite(num) ? num : null;
    };

    const ensureTimeString = (value: unknown): string => {
      const raw = String(value ?? '').trim();
      if (!raw) return '';
      if (!raw.includes(':')) {
        const n = parseInt(raw, 10);
        if (!isNaN(n)) {
          const h = Math.floor(n / 100);
          const m = n % 100;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      const [h, m] = raw.split(':');
      const hh = String(Number(h)).padStart(2, '0');
      const mm = String(Number(m)).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const sanitizeRecord = (record: any): Omit<NewTrainingRecord, 'id' | 'createdAt' | 'updatedAt'> => {
      const sexValue = record?.sex === '牝' ? '牝' : record?.sex === 'セ' ? 'セ' : '牡';
      const ageValue = typeof record?.age === 'number' && Number.isFinite(record.age)
        ? record.age
        : parseInt(String(record?.age ?? '0'), 10) || 0;

      const base: Omit<NewTrainingRecord, 'id' | 'createdAt' | 'updatedAt'> = {
        trainingType: record?.trainingType === 'wood' ? 'wood' : 'hill',
        facility: String(record?.facility ?? ''),
        course: record?.course ? String(record.course) : null,
        turn: record?.turn ? String(record.turn) : null,
        trainingDate: String(record?.trainingDate ?? ''),
        weekday: String(record?.weekday ?? ''),
        trainingTime: ensureTimeString(record?.trainingTime ?? ''),
        horseName: String(record?.horseName ?? ''),
        classCode: record?.classCode ? String(record.classCode) : null,
        sex: sexValue,
        age: ageValue,
        trainer: String(record?.trainer ?? ''),
        time10f: toNullableNumber(record?.time10f),
        time9f: toNullableNumber(record?.time9f),
        time8f: toNullableNumber(record?.time8f),
        time7f: toNullableNumber(record?.time7f),
        time6f: toNullableNumber(record?.time6f),
        time5f: toNullableNumber(record?.time5f),
        time4f: toNullableNumber(record?.time4f),
        time3f: toNullableNumber(record?.time3f),
        time2f: toNullableNumber(record?.time2f),
        time1f: toNullableNumber(record?.time1f),
        lap9: toNullableNumber(record?.lap9),
        lap8: toNullableNumber(record?.lap8),
        lap7: toNullableNumber(record?.lap7),
        lap6: toNullableNumber(record?.lap6),
        lap5: toNullableNumber(record?.lap5),
        lap4: toNullableNumber(record?.lap4),
        lap3: toNullableNumber(record?.lap3),
        lap2: toNullableNumber(record?.lap2),
        lap1: toNullableNumber(record?.lap1),
        registrationNumber: record?.registrationNumber ? String(record.registrationNumber) : null,
        affiliation: record?.affiliation ? String(record.affiliation) : null,
      };
      return base;
    };

    const sanitizedRecords = recordsInput.map(sanitizeRecord);

    const db = createDb(c.env.DB);
    const chunkSize = 5;
    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < sanitizedRecords.length; i += chunkSize) {
      const chunk = sanitizedRecords.slice(i, i + chunkSize);
      for (const record of chunk) {
        const existing = await db.select({ id: trainingRecords.id })
          .from(trainingRecords)
          .where(and(
            eq(trainingRecords.horseName, record.horseName),
            eq(trainingRecords.trainingDate, record.trainingDate),
            eq(trainingRecords.trainingTime, record.trainingTime)
          ))
          .limit(1)
          .get();

        if (existing?.id) {
          await db.update(trainingRecords)
            .set({
              trainingType: record.trainingType,
              facility: record.facility,
              course: record.course ?? null,
              turn: record.turn ?? null,
              trainingDate: record.trainingDate,
              weekday: record.weekday,
              trainingTime: record.trainingTime,
              horseName: record.horseName,
              classCode: record.classCode ?? null,
              sex: record.sex,
              age: record.age,
              trainer: record.trainer,
              time10f: record.time10f ?? null,
              time9f: record.time9f ?? null,
              time8f: record.time8f ?? null,
              time7f: record.time7f ?? null,
              time6f: record.time6f ?? null,
              time5f: record.time5f ?? null,
              time4f: record.time4f ?? null,
              time3f: record.time3f ?? null,
              time2f: record.time2f ?? null,
              time1f: record.time1f ?? null,
              lap9: record.lap9 ?? null,
              lap8: record.lap8 ?? null,
              lap7: record.lap7 ?? null,
              lap6: record.lap6 ?? null,
              lap5: record.lap5 ?? null,
              lap4: record.lap4 ?? null,
              lap3: record.lap3 ?? null,
              lap2: record.lap2 ?? null,
              lap1: record.lap1 ?? null,
              registrationNumber: record.registrationNumber ?? null,
              affiliation: record.affiliation ?? null,
              updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(eq(trainingRecords.id, existing.id));
          updated += 1;
        } else {
          await db.insert(trainingRecords).values(record as any);
          inserted += 1;
        }
      }
    }

    return c.json({
      message: `${sanitizedRecords.length}件の調教データを処理しました`,
      inserted,
      updated
    });
  } catch (error) {
    console.error('Error inserting training records:', error);
    return c.json({ error: '調教データの登録に失敗しました' }, 500);
  }
});

app.post('/api/training-records/search', async (c) => {
  try {
    const body = await c.req.json();
    const namesRaw = Array.isArray(body?.horseNames) ? body.horseNames : [];
    const horseNames = namesRaw
      .map((name: unknown) => String(name ?? '').trim())
      .filter((name: string) => name.length > 0);

    if (horseNames.length === 0) {
      return c.json({ records: {} });
    }

    const limitRaw = parseInt(String(body?.limit ?? '3'), 10);
    const limit = Math.min(Math.max(limitRaw || 3, 1), 5);

    const db = createDb(c.env.DB);
    const rows = await db.select({
      id: trainingRecords.id,
      horseName: trainingRecords.horseName,
      trainingType: trainingRecords.trainingType,
      facility: trainingRecords.facility,
      course: trainingRecords.course,
      turn: trainingRecords.turn,
      trainingDate: trainingRecords.trainingDate,
      weekday: trainingRecords.weekday,
      trainingTime: trainingRecords.trainingTime,
      trainer: trainingRecords.trainer,
      time10f: trainingRecords.time10f,
      time9f: trainingRecords.time9f,
      time8f: trainingRecords.time8f,
      time7f: trainingRecords.time7f,
      time6f: trainingRecords.time6f,
      time5f: trainingRecords.time5f,
      time4f: trainingRecords.time4f,
      time3f: trainingRecords.time3f,
      time2f: trainingRecords.time2f,
      time1f: trainingRecords.time1f,
      lap9: trainingRecords.lap9,
      lap8: trainingRecords.lap8,
      lap7: trainingRecords.lap7,
      lap6: trainingRecords.lap6,
      lap5: trainingRecords.lap5,
      lap4: trainingRecords.lap4,
      lap3: trainingRecords.lap3,
      lap2: trainingRecords.lap2,
      lap1: trainingRecords.lap1,
      registrationNumber: trainingRecords.registrationNumber,
      affiliation: trainingRecords.affiliation,
    })
      .from(trainingRecords)
      .where(inArray(trainingRecords.horseName, horseNames as any))
      .orderBy(desc(trainingRecords.trainingDate), desc(trainingRecords.trainingTime))
      .limit(horseNames.length * limit * 2);

    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      const key = row.horseName;
      if (!grouped[key]) grouped[key] = [];
      if (grouped[key].length >= limit) continue;
      grouped[key].push(row);
    }

    return c.json({ records: grouped });
  } catch (error) {
    console.error('Error fetching training records:', error);
    return c.json({ error: '調教データの取得に失敗しました' }, 500);
  }
});

// レース詳細の取得
app.get('/api/races/:raceId', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const raceId = c.req.param('raceId');
    const race = await db.select().from(races).where(eq(races.raceId, raceId)).get();
    if (!race) {
      return c.json({ error: 'レースが見つかりません' }, 404);
    }
    return c.json(race);
  } catch (error) {
    console.error('Error getting race:', error);
    return c.json({ error: 'レース情報の取得に失敗しました' }, 500);
  }
});

// 出馬表の取得（レースID指定）
app.get('/api/races/:raceId/entries', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const raceId = c.req.param('raceId');

    const entries = await db.select().from(raceEntries).where(eq(raceEntries.raceId, raceId));
    if (entries.length === 0) return c.json([]);

    const horseIds = Array.from(new Set(entries.map(e => e.horseId)));
    // horsesテーブルから必要項目をまとめて取得
    const horsesRows = await db.select().from(horses).where(inArray(horses.id, horseIds as any));
    const horseMap = new Map(horsesRows.map(h => [h.id, h] as const));

    // race_resultsテーブルから過去の総賞金情報を取得（そのレース以前の累積）
    const raceDate = entries[0]?.date; // レースの日付を取得
    
    // 仕様: 「各馬の前走まで（当日以前）の累計」を求め、その合計をレースレベルとする
    const perHorseTotals = await db.select({
      horseId: raceResults.horseId,
      prize: sql<number>`SUM(${raceResults.prizeMoney})`,
      earned: sql<number>`SUM(${raceResults.earnedMoney})`
    })
    .from(raceResults)
    .where(and(inArray(raceResults.horseId, horseIds as any), lt(raceResults.date, raceDate)))
    .groupBy(raceResults.horseId);

    const totalPrizeMoney = perHorseTotals.reduce((acc, r) => acc + (r.prize || 0), 0);
    const totalEarnedMoney = perHorseTotals.reduce((acc, r) => acc + (r.earned || 0), 0);

    const enriched = entries.map(e => {
      return {
        ...e,
        horse: horseMap.get(e.horseId) || null,
        // そのレース全体の過去の総賞金情報を追加
        prizeMoney: totalPrizeMoney,
        earnedMoney: totalEarnedMoney
      };
    });

    return c.json(enriched);
  } catch (error) {
    console.error('Error getting race entries:', error);
    return c.json({ error: '出馬表の取得に失敗しました' }, 500);
  }
});

// 出馬表＋各馬の直近レース結果をまとめて取得
app.get('/api/races/:raceId/entries-with-history', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const raceId = c.req.param('raceId');
    const limitParam = c.req.query('limit') ?? c.req.query('recentLimit');
    const beforeDateParam = c.req.query('beforeDate');
    const limit = limitParam ? Math.max(1, Math.min(10, parseInt(limitParam, 10) || 5)) : 5;

    const entries = await db.select().from(raceEntries).where(eq(raceEntries.raceId, raceId));
    if (entries.length === 0) {
      return c.json({ raceId, raceDate: null, entries: [] });
    }

    const horseIds = Array.from(new Set(entries.map(e => e.horseId).filter((id): id is string => Boolean(id))));
    const horsesRows = horseIds.length > 0
      ? await db.select().from(horses).where(inArray(horses.id, horseIds as any))
      : [];
    const horseMap = new Map(horsesRows.map(h => [h.id, h] as const));

    let raceDate = entries[0]?.date || null;
    if (!raceDate) {
      const raceRow = await db.select({ date: races.date }).from(races).where(eq(races.raceId, raceId)).get();
      raceDate = raceRow?.date || null;
    }

    const effectiveBeforeDate = typeof beforeDateParam === 'string' && beforeDateParam.trim().length > 0
      ? beforeDateParam.trim()
      : raceDate;

    let recentResultsMap = new Map<string, any[]>();
    if (horseIds.length > 0) {
      const condition = effectiveBeforeDate
        ? and(
            inArray(raceResults.horseId, horseIds as any),
            lt(raceResults.date, effectiveBeforeDate)
          )
        : inArray(raceResults.horseId, horseIds as any);

      const maxRows = limit * horseIds.length;
      const rows = await db.select().from(raceResults)
        .where(condition)
        .orderBy(raceResults.horseId, desc(raceResults.date), raceResults.popularity)
        .limit(maxRows);

      recentResultsMap = rows.reduce((map, row) => {
        const key = row.horseId;
        if (!key) return map;
        const arr = map.get(key) ?? [];
        if (arr.length < limit) {
          arr.push(row);
          map.set(key, arr);
        }
        return map;
      }, new Map<string, any[]>());
    }

    const enriched = entries.map(entry => {
      return {
        ...entry,
        horse: horseMap.get(entry.horseId) || null,
        recentResults: recentResultsMap.get(entry.horseId) ?? []
      };
    });

    return c.json({ raceId, raceDate, entries: enriched });
  } catch (error) {
    console.error('Error getting race entries with history:', error);
    return c.json({ error: '出馬表＋直近結果の取得に失敗しました' }, 500);
  }
});

// 複数レースの基本情報（頭数、賞金合計など）をまとめて取得
app.post('/api/races/batch-basic', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const raceIdsInput = Array.isArray(body?.raceIds) ? body.raceIds : [];
    if (raceIdsInput.length === 0) {
      return c.json({ races: [] });
    }

    const filteredIds = raceIdsInput.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    const raceIds = Array.from(new Set<string>(filteredIds));
    if (raceIds.length === 0) {
      return c.json({ races: [] });
    }

    const raceRows = await db.select({
      raceId: races.raceId,
      date: races.date,
      fieldSize: races.fieldSize,
    }).from(races).where(inArray(races.raceId, raceIds as any));

    const entryCounts = await db.select({
      raceId: raceEntries.raceId,
      count: sql<number>`COUNT(*)`,
    })
      .from(raceEntries)
      .where(inArray(raceEntries.raceId, raceIds as any))
      .groupBy(raceEntries.raceId);

    const resultAgg = await db.select({
      raceId: raceResults.raceId,
      count: sql<number>`COUNT(*)`,
      prize: sql<number>`SUM(${raceResults.prizeMoney})`,
      earned: sql<number>`SUM(${raceResults.earnedMoney})`,
    })
      .from(raceResults)
      .where(inArray(raceResults.raceId, raceIds as any))
      .groupBy(raceResults.raceId);

    const entryMap = new Map(entryCounts.map(row => [row.raceId, Number(row.count) || 0] as const));
    const resultMap = new Map(resultAgg.map(row => [row.raceId, {
      count: Number(row.count) || 0,
      prize: row.prize !== null && row.prize !== undefined ? Number(row.prize) : null,
      earned: row.earned !== null && row.earned !== undefined ? Number(row.earned) : null,
    }] as const));
    const raceMap = new Map(raceRows.map(row => [row.raceId, row] as const));

    const response = raceIds.map((raceId) => {
      const raceRow = raceMap.get(raceId);
      const entries = entryMap.get(raceId) ?? 0;
      const resultRow = resultMap.get(raceId);
      const resultsCount = resultRow?.count ?? 0;
      return {
        raceId,
        date: raceRow?.date ?? null,
        fieldSize: raceRow?.fieldSize ?? null,
        entryCount: entries,
        resultCount: resultsCount,
        totalPrizeMoney: resultRow?.prize ?? null,
        totalEarnedMoney: resultRow?.earned ?? null,
      };
    });

    return c.json({ races: response });
  } catch (error) {
    console.error('Error getting race basics:', error);
    return c.json({ error: 'レース基本情報の取得に失敗しました' }, 500);
  }
});

// 複数レースの同走馬と次走結果をまとめて取得
app.post('/api/races/co-runners/next', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const raceIdsInput = Array.isArray(body?.raceIds) ? body.raceIds : [];
    const beforeDateInput: string | undefined = typeof body?.beforeDate === 'string' ? body.beforeDate : undefined;

    const filteredIds = raceIdsInput.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    const raceIds = Array.from(new Set<string>(filteredIds));
    if (raceIds.length === 0) {
      return c.json({ races: [] });
    }

    const normalize = (value?: string | null): string | undefined => {
      if (!value) return undefined;
      const digits = value.replace(/[^0-9]/g, '');
      if (digits.length === 6) return `20${digits}`;
      if (digits.length >= 8) return digits.slice(0, 8);
      return undefined;
    };

    const beforeDate = normalize(beforeDateInput);

    const responses = [] as Array<{
      raceId: string;
      prevDate: string | null;
      totalCoRunners: number;
      runners: Array<{ horseId: string; nextRaceId: string | null; nextDate: string | null; nextFinish: number | null }>;
    }>;

    for (const raceId of raceIds) {
      let prevDate: string | undefined;
      let participants: string[] = [];

      try {
        const resultRows = await db.select({
          horseId: raceResults.horseId,
          date: raceResults.date,
        }).from(raceResults)
          .where(eq(raceResults.raceId, raceId));

        if (resultRows.length > 0) {
          participants = Array.from(new Set(resultRows.map(r => r.horseId).filter(Boolean) as string[]));
          prevDate = normalize(resultRows[0]?.date);
        }
      } catch {}

      if (participants.length === 0) {
        try {
          const entryRows = await db.select({
            horseId: raceEntries.horseId,
            date: raceEntries.date,
          }).from(raceEntries)
            .where(eq(raceEntries.raceId, raceId));
          if (entryRows.length > 0) {
            participants = Array.from(new Set(entryRows.map(e => e.horseId).filter(Boolean) as string[]));
            prevDate = prevDate || normalize(entryRows[0]?.date);
          }
        } catch {}
      }

      if (!prevDate) {
        try {
          const raceRow = await db.select({ date: races.date }).from(races).where(eq(races.raceId, raceId)).get();
          prevDate = normalize(raceRow?.date);
        } catch {}
      }

      const totalCoRunners = participants.length;
      if (participants.length === 0) {
        responses.push({ raceId, prevDate: prevDate ?? null, totalCoRunners, runners: [] });
        continue;
      }

      const conditions: any[] = [inArray(raceResults.horseId, participants as any)];
      if (prevDate) conditions.push(gt(raceResults.date, prevDate));
      if (beforeDate) conditions.push(lt(raceResults.date, beforeDate));

      const nextRows = await db.select({
        horseId: raceResults.horseId,
        raceId: raceResults.raceId,
        date: raceResults.date,
        finishPosition: raceResults.finishPosition,
      })
        .from(raceResults)
        .where(and(...conditions as any))
        .orderBy(raceResults.horseId, raceResults.date)
        .limit(participants.length * 20);

      const bestMap = new Map<string, { raceId: string | null; date: string | null; finishPosition: number | null }>();
      nextRows.forEach(row => {
        if (!row.horseId) return;
        if (!bestMap.has(row.horseId)) {
          bestMap.set(row.horseId, {
            raceId: row.raceId,
            date: row.date ?? null,
            finishPosition: typeof row.finishPosition === 'number' ? row.finishPosition : null,
          });
        }
      });

      const runners = participants.map(horseId => {
        const best = bestMap.get(horseId);
        return {
          horseId,
          nextRaceId: best?.raceId ?? null,
          nextDate: best?.date ?? null,
          nextFinish: best?.finishPosition ?? null,
        };
      });

      responses.push({ raceId, prevDate: prevDate ?? null, totalCoRunners, runners });
    }

    return c.json({ races: responses });
  } catch (error) {
    console.error('Error getting co-runner next results:', error);
    return c.json({ error: '同走馬の次走情報の取得に失敗しました' }, 500);
  }
});

// 複数レースの速度関連指標をまとめて取得
app.post('/api/races/speed-metrics', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const raceIdsInput = Array.isArray(body?.raceIds) ? body.raceIds : [];
    const beforeDateInput: string | undefined = typeof body?.beforeDate === 'string' ? body.beforeDate : undefined;
    const limitInput = typeof body?.limit === 'number' ? body.limit : undefined;
    const limit = limitInput && limitInput > 0 ? Math.min(limitInput, 10) : 1;

    const filteredIds = raceIdsInput.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
    const raceIds = Array.from(new Set<string>(filteredIds));
    if (raceIds.length === 0) {
      return c.json({ races: [] });
    }

    const normalize = (value?: string | null): string | undefined => {
      if (!value) return undefined;
      const digits = value.replace(/[^0-9]/g, '');
      if (digits.length === 6) return `20${digits}`;
      if (digits.length >= 8) return digits.slice(0, 8);
      return undefined;
    };

    const beforeDate = normalize(beforeDateInput);

    const resultsRows = await db.select({
      raceId: raceResults.raceId,
      horseId: raceResults.horseId,
      distance: raceResults.distance,
      time: raceResults.time,
      finishPosition: raceResults.finishPosition,
    }).from(raceResults)
      .where(inArray(raceResults.raceId, raceIds as any));

    const entriesRows = await db.select({
      raceId: raceEntries.raceId,
      horseId: raceEntries.horseId,
      date: raceEntries.date,
      weight: raceEntries.weight,
      frameNo: raceEntries.frameNo,
      horseNo: raceEntries.horseNo,
    }).from(raceEntries)
      .where(inArray(raceEntries.raceId, raceIds as any));

    const entryMap = entriesRows.reduce((map, row) => {
      const list = map.get(row.raceId) ?? [];
      list.push(row);
      map.set(row.raceId, list);
      return map;
    }, new Map<string, typeof entriesRows>());

    const resultMap = resultsRows.reduce((map, row) => {
      const list = map.get(row.raceId) ?? [];
      list.push(row);
      map.set(row.raceId, list);
      return map;
    }, new Map<string, typeof resultsRows>());

    const raceRows = await db.select({ raceId: races.raceId, date: races.date }).from(races)
      .where(inArray(races.raceId, raceIds as any));
    const raceDateMap = new Map<string, string | undefined>(raceRows.map(r => [r.raceId, r.date] as const));

    const normalizeResults = (rows: typeof resultsRows[number][]) => {
      return rows.map(row => {
        const distance = row.distance ?? 0;
        const timeVal = toSecondsFromRaceTime(row.time ?? '');
        const speed = distance > 0 && timeVal > 0 ? Math.round((distance / timeVal) * 3.6 * 10) / 10 : null;
        return { ...row, speed };
      });
    };

    const responses = [] as Array<{
      raceId: string;
      winnerKmh: number | null;
      actualAvg: number | null;
      countActual: number;
      prevAvg: number | null;
      countPrev: number;
    }>;

    for (const raceId of raceIds) {
      const results = normalizeResults(resultMap.get(raceId) ?? []);
      const entries = entryMap.get(raceId) ?? [];

      let winnerKmh: number | null = null;
      let actualSum = 0;
      let actualCnt = 0;
      results.forEach(r => {
        if (typeof r.speed === 'number' && isFinite(r.speed) && r.speed > 0) {
          actualSum += r.speed;
          actualCnt += 1;
          if ((r.finishPosition ?? null) === 1) {
            winnerKmh = r.speed;
          }
        }
      });

      const raceDateRaw = entries[0]?.date || raceDateMap.get(raceId) || null;
      const raceDate = normalize(raceDateRaw);

      const horseIds = entries.map(e => e.horseId).filter(Boolean) as string[];
      let prevAvg: number | null = null;
      let countPrev = 0;
      if (horseIds.length > 0 && raceDate) {
        const conditions = beforeDate
          ? and(
              inArray(raceResults.horseId, horseIds as any),
              lt(raceResults.date, beforeDate),
              lt(raceResults.date, raceDate)
            )
          : and(
              inArray(raceResults.horseId, horseIds as any),
              lt(raceResults.date, raceDate)
            );

        const prevRows = await db.select({
          horseId: raceResults.horseId,
          raceId: raceResults.raceId,
          date: raceResults.date,
          distance: raceResults.distance,
          time: raceResults.time,
        })
          .from(raceResults)
          .where(conditions as any)
          .orderBy(desc(raceResults.date), raceResults.horseId)
          .limit(horseIds.length * limit);

        const bestByHorse = new Map<string, { distance: number | null; time: string | null }>();
        prevRows.forEach(row => {
          if (!row.horseId || bestByHorse.has(row.horseId)) return;
          bestByHorse.set(row.horseId, { distance: row.distance, time: row.time });
        });

        let prevSum = 0;
        bestByHorse.forEach(v => {
          const dist = v.distance ?? 0;
          const timeSec = toSecondsFromRaceTime(v.time ?? '');
          const sp = dist > 0 && timeSec > 0 ? (dist / timeSec) * 3.6 : null;
          if (sp && isFinite(sp) && sp > 0) {
            prevSum += sp;
            countPrev += 1;
          }
        });
        if (countPrev > 0) {
          prevAvg = Math.round((prevSum / countPrev) * 10) / 10;
        }
      }

      const actualAvg = actualCnt > 0 ? Math.round((actualSum / actualCnt) * 10) / 10 : null;

      responses.push({
        raceId,
        winnerKmh: winnerKmh,
        actualAvg,
        countActual: actualCnt,
        prevAvg,
        countPrev,
      });
    }

    return c.json({ races: responses });
  } catch (error) {
    console.error('Error getting speed metrics:', error);
    return c.json({ error: 'レース速度情報の取得に失敗しました' }, 500);
  }
});

// テスト用：賞金情報を手動で更新
app.patch('/api/races/:raceId/prize-money', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const raceId = c.req.param('raceId');
    const { prizeMoney, earnedMoney } = await c.req.json();

    // 指定されたレースの全てのエントリーを更新
    await db.update(raceEntries)
      .set({
        prizeMoney: prizeMoney || null,
        earnedMoney: earnedMoney || null,
        updatedAt: new Date().toISOString()
      })
      .where(eq(raceEntries.raceId, raceId));

    return c.json({ success: true, message: '賞金情報を更新しました' });
  } catch (error) {
    console.error('Error updating prize money:', error);
    return c.json({ error: '賞金情報の更新に失敗しました' }, 500);
  }
});

// 分析用API: 距離別過去時間分析
app.get('/api/analysis/distance-times', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const { distance, surface, venue, class: className, limit = '50', from, to, winnersOnly } = c.req.query();
    
    if (!distance) {
      return c.json({ error: '距離パラメータが必要です' }, 400);
    }
    
    const limitNum = parseInt(limit);
    
    // フィルター条件を構築
    const conditions = [eq(raceResults.distance, parseInt(distance))];
    
    if (surface && surface !== 'all') {
      conditions.push(eq(raceResults.courseType, surface as '芝' | 'ダート'));
    }
    
    if (venue && venue !== 'all') {
      conditions.push(eq(raceResults.venue, venue));
    }
    
    if (className && className !== 'all') {
      const syn = classNameSynonyms(className);
      if (syn.length > 0) {
        conditions.push(inArray(races.className, syn as any));
      } else {
        conditions.push(eq(races.className, className));
      }
    }
    if (from) {
      conditions.push(gte(raceResults.date, from));
    }
    if (to) {
      conditions.push(lt(raceResults.date, to));
    }
    if (winnersOnly === '1' || winnersOnly === 'true') {
      conditions.push(eq(raceResults.finishPosition, 1));
    }
    
    const query = db.select({
      raceId: raceResults.raceId,
      date: raceResults.date,
      raceName: raceResults.raceName,
      venue: raceResults.venue,
      surface: raceResults.courseType,
      distance: raceResults.distance,
      time: raceResults.time,
      finishPosition: raceResults.finishPosition,
      courseCondition: raceResults.courseCondition,
      weather: raceResults.weather,
      pos1c: raceResults.pos1c,
      pos2c: raceResults.pos2c,
      pos3c: raceResults.pos3c,
      pos4c: raceResults.pos4c,
      horseName: horses.name,
      weight: raceResults.weight,
      lastThreeFurlong: raceResults.lastThreeFurlong
    })
    .from(raceResults)
    .innerJoin(races, eq(raceResults.raceId, races.raceId))
    .innerJoin(horses, eq(raceResults.horseId, horses.id))
    .where(and(...conditions))
    .orderBy(desc(raceResults.date))
    .limit(limitNum);
    
    const results = await query;
    
    // 統計情報を計算
    const times = results
      .map(r => toSecondsFromRaceTime(r.time as any))
      .filter(t => !isNaN(t) && t > 0);
    
    const stats = {
      count: times.length,
      average: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      fastest: times.length > 0 ? Math.min(...times) : 0,
      slowest: times.length > 0 ? Math.max(...times) : 0,
      median: times.length > 0 ? times.sort((a, b) => a - b)[Math.floor(times.length / 2)] : 0
    };
    
    return c.json({
      results,
      stats,
      filters: { distance, surface, venue, class: className, limit: limitNum }
    });
  } catch (error) {
    console.error('Error getting distance times analysis:', error);
    return c.json({ error: '距離別時間分析の取得に失敗しました' }, 500);
  }
});

// 分析用API: クラス別分析
app.get('/api/analysis/class-analysis', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const { className, surface, venue, limit = '50' } = c.req.query();
    
    if (!className) {
      return c.json({ error: 'クラス名パラメータが必要です' }, 400);
    }
    
    const limitNum = parseInt(limit);
    
    // フィルター条件を構築
    const conditions = [eq(races.className, className)];
    
    if (surface && surface !== 'all') {
      conditions.push(eq(raceResults.courseType, surface as '芝' | 'ダート'));
    }
    
    if (venue && venue !== 'all') {
      conditions.push(eq(raceResults.venue, venue));
    }
    
    const query = db.select({
      raceId: raceResults.raceId,
      date: raceResults.date,
      raceName: raceResults.raceName,
      venue: raceResults.venue,
      surface: raceResults.courseType,
      distance: raceResults.distance,
      time: raceResults.time,
      finishPosition: raceResults.finishPosition,
      courseCondition: raceResults.courseCondition,
      weather: raceResults.weather,
      pos1c: raceResults.pos1c,
      pos2c: raceResults.pos2c,
      pos3c: raceResults.pos3c,
      pos4c: raceResults.pos4c,
      horseName: horses.name,
      weight: raceResults.weight,
      lastThreeFurlong: raceResults.lastThreeFurlong
    })
    .from(raceResults)
    .innerJoin(races, eq(raceResults.raceId, races.raceId))
    .innerJoin(horses, eq(raceResults.horseId, horses.id))
    .where(and(...conditions))
    .orderBy(desc(raceResults.date))
    .limit(limitNum);
    
    const results = await query;
    
    // 距離別にグループ化
    const byDistance = results.reduce((acc, result) => {
      const distance = result.distance;
      if (!acc[distance]) {
        acc[distance] = [];
      }
      acc[distance].push(result);
      return acc;
    }, {} as Record<number, typeof results>);
    
    // 各距離の統計を計算
    const distanceStats = Object.entries(byDistance).map(([distance, races]) => {
      const times = races
        .map(r => toSecondsFromRaceTime(r.time as any))
        .filter(t => !isNaN(t) && t > 0);
      
      return {
        distance: parseInt(distance),
        count: times.length,
        average: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        fastest: times.length > 0 ? Math.min(...times) : 0,
        slowest: times.length > 0 ? Math.max(...times) : 0
      };
    });
    
    return c.json({
      results,
      distanceStats,
      filters: { className, surface, venue, limit: limitNum }
    });
  } catch (error) {
    console.error('Error getting class analysis:', error);
    return c.json({ error: 'クラス別分析の取得に失敗しました' }, 500);
  }
});

// レースIDから情報を抽出するヘルパー関数
function getVenueFromRaceId(raceId: string): string {
  // YYYY(0-3) + venue(4-5) + meeting(6-7) + day(8-9) + R(10-11)
  const venueCode = raceId.substring(4, 6);
  const venueMap: Record<string, string> = {
    '01': '札幌', '02': '函館', '03': '福島', '04': '新潟', '05': '東京',
    '06': '中山', '07': '中京', '08': '京都', '09': '阪神', '10': '小倉'
  };
  return venueMap[venueCode] || '不明';
}

function getMeetingNumberFromRaceId(raceId: string): number {
  return parseInt(raceId.substring(6, 8));
}

function getDayNumberFromRaceId(raceId: string): number {
  return parseInt(raceId.substring(8, 10));
}

function getRaceNoFromRaceId(raceId: string): number {
  const raceNo = parseInt(raceId.substring(raceId.length - 2));
  return raceNo;
}

// 日付ごとの出馬表情報を取得
app.get('/api/races/entries/by-date/:date', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const date = c.req.param('date');
    

    // 日付形式を統一（データベースは8桁形式で保存されている）
    let dateForQuery = date;
    // 6桁形式（YYMMDD）が来た場合は8桁形式（YYYYMMDD）に変換
    if (dateForQuery.length === 6) {
      dateForQuery = `20${dateForQuery}`; // 20を先頭に追加
    }
    // YYYY-MM-DD形式が来た場合はYYYYMMDD形式に変換
    if (dateForQuery.includes('-')) {
      dateForQuery = dateForQuery.replace(/-/g, '');
    }
    
    // 直接race_entriesテーブルから日付で検索
    const entries = await db.select().from(raceEntries).where(eq(raceEntries.date, dateForQuery));
    
    if (entries.length === 0) return c.json({});

    // 対象レースの offAt 等を races テーブルから取得してマージ
    const uniqueRaceIds = Array.from(new Set(entries.map(e => e.raceId)));
    const raceRows = await db.select().from(races).where(inArray(races.raceId, uniqueRaceIds as any));
    const raceMap = new Map(raceRows.map(r => [r.raceId, r] as const));

    // レースごとに出馬表をグループ化し、レース情報も含める
    const entriesByRace = entries.reduce((acc, entry) => {
      if (!acc[entry.raceId]) {
        const raceNo = getRaceNoFromRaceId(entry.raceId);
        
        acc[entry.raceId] = {
          entries: [],
          raceInfo: {
            raceId: entry.raceId,
            date: entry.date,
            venue: getVenueFromRaceId(entry.raceId),
            meetingNumber: getMeetingNumberFromRaceId(entry.raceId),
            dayNumber: getDayNumberFromRaceId(entry.raceId),
            raceNo: raceNo,
            raceName: entry.raceName || `レース${raceNo}`,
            className: '未勝利', // デフォルト値
            surface: entry.surface || '芝',
            distance: entry.distance || 1600,
            direction: '右', // デフォルト値
            courseConf: undefined,
            trackCond: '良', // デフォルト値
            offAt: (() => {
              const r = raceMap.get(entry.raceId);
              return (r && r.offAt) ? r.offAt : '00:00';
            })(),
            grade: undefined,
            status: '発売中', // デフォルト値
            weather: undefined,
            fieldSize: 0
          }
        };
      }
      acc[entry.raceId].entries.push({
        ...entry,
        horse: {
          id: entry.horseId,
          name: entry.horseName || '不明',
          birthDate: '',
          sex: entry.sex || '牡',
          color: entry.color || '',
          father: entry.father || '',
          mother: entry.mother || '',
          trainer: entry.trainer || '',
          owner: entry.owner || '',
          breeder: entry.breeder || '',
          earnings: 0
        }
      });
      acc[entry.raceId].raceInfo.fieldSize = acc[entry.raceId].entries.length;
      return acc;
    }, {} as Record<string, { entries: any[], raceInfo: any }>);

    // 馬番順にソート
    Object.values(entriesByRace).forEach(raceData => {
      raceData.entries.sort((a, b) => a.horseNo - b.horseNo);
    });

    // race_idの順序を保つために、ソートされたオブジェクトを作成
    const sortedEntriesByRace: Record<string, { entries: any[], raceInfo: any }> = {};
    const sortedRaceIds = Object.keys(entriesByRace).sort();
    
    sortedRaceIds.forEach(raceId => {
      sortedEntriesByRace[raceId] = entriesByRace[raceId];
    });

    return c.json(sortedEntriesByRace);
  } catch (error) {
    console.error('Error getting race entries by date:', error);
    return c.json({ error: '出馬表の取得に失敗しました' }, 500);
  }
});

// レースの部分更新（クッション値など特定フィールドのみ）
app.patch('/api/races/:raceId', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const raceId = c.req.param('raceId');
    const updateData = await c.req.json();
    
    const updateFields: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
    
    // 送信されたフィールドのみ更新対象に追加
    // cushionValue は専用エンドポイントで更新するため、ここでは処理しない
    if (updateData.weather !== undefined) updateFields.weather = updateData.weather;
    if (updateData.trackCond !== undefined) updateFields.trackCond = updateData.trackCond;
    if (updateData.status !== undefined) updateFields.status = updateData.status;
    if (updateData.offAt !== undefined) updateFields.offAt = updateData.offAt;
    
    const result = await db.update(races)
      .set(updateFields)
      .where(eq(races.raceId, raceId));
    
    return c.json({ message: `レース ${raceId} を更新しました` });
  } catch (error) {
    console.error('Error updating race:', error);
    return c.json({ error: 'レースの更新に失敗しました' }, 500);
  }
});

// 馬の部分更新（出走予定レースなど特定フィールドのみ）
app.patch('/api/horses/:horseId', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const horseId = c.req.param('horseId');
    const updateData = await c.req.json();
    
    const updateFields: any = { updatedAt: sql`CURRENT_TIMESTAMP` };
    
    // 送信されたフィールドのみ更新対象に追加
    if (updateData.currentRaceId !== undefined) updateFields.currentRaceId = updateData.currentRaceId;
    if (updateData.trainer !== undefined) updateFields.trainer = updateData.trainer;
    if (updateData.owner !== undefined) updateFields.owner = updateData.owner;
    if (updateData.earnings !== undefined) updateFields.earnings = updateData.earnings;
    
    const result = await db.update(horses)
      .set(updateFields)
      .where(eq(horses.id, horseId));
    
    return c.json({ message: `馬 ${horseId} を更新しました` });
  } catch (error) {
    console.error('Error updating horse:', error);
    return c.json({ error: '馬の更新に失敗しました' }, 500);
  }
});

// クッション値専用更新エンドポイント
app.patch('/api/races/:raceId/cushion', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const raceId = c.req.param('raceId');
    const { cushionValue } = await c.req.json();

    // まずレース情報を取得
    const race = await db.select().from(races).where(eq(races.raceId, raceId)).get();
    if (!race) {
      return c.json({ error: 'レースが見つかりません' }, 404);
    }

    // trackCondition レコードの作成または更新
    const trackConditionId = `${race.date}_${race.venue}_${race.surface}`;

    await db.insert(trackConditions)
      .values({
        id: trackConditionId,
        date: race.date,
        venue: race.venue,
        surface: race.surface,
        trackCond: race.trackCond,
        cushionValue: cushionValue,
        createdAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .onConflictDoUpdate({
        target: trackConditions.id,
        set: {
          cushionValue: cushionValue,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      });

    // races テーブルで trackConditionId を更新
    await db.update(races)
      .set({
        trackConditionId: trackConditionId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      })
      .where(eq(races.raceId, raceId));

    return c.json({ message: `レース ${raceId} のクッション値を更新しました` });
  } catch (error) {
    console.error('Error updating cushion value:', error);
    return c.json({ error: 'クッション値の更新に失敗しました' }, 500);
  }
});

// 会場データ（指定日のレース情報を会場ごとに取得）
app.get('/api/venues', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const date = c.req.query('date');
    
    if (!date) {
      return c.json({ error: '日付が指定されていません' }, 400);
    }
    
    // 指定日のレースを取得（trackConditions と JOIN）
    const raceData = await db.select({
      raceId: races.raceId,
      date: races.date,
      venue: races.venue,
      meetingNumber: races.meetingNumber,
      dayNumber: races.dayNumber,
      raceNo: races.raceNo,
      raceName: races.raceName,
      className: races.className,
      surface: races.surface,
      distance: races.distance,
      direction: races.direction,
      courseConf: races.courseConf,
      trackCond: races.trackCond,
      trackConditionId: races.trackConditionId,
      fieldSize: races.fieldSize,
      offAt: races.offAt,
      grade: races.grade,
      win5: races.win5,
      status: races.status,
      weather: races.weather,
      createdAt: races.createdAt,
      updatedAt: races.updatedAt,
      cushionValue: trackConditions.cushionValue,
      trackConditionData: trackConditions
    })
    .from(races)
    .leftJoin(trackConditions, eq(races.trackConditionId, trackConditions.id))
    .where(eq(races.date, date));
    
    // 会場ごとにグループ化
    const venueMap = new Map();
    
    for (const race of raceData) {
      if (!venueMap.has(race.venue)) {
        venueMap.set(race.venue, {
          venue: race.venue,
          meetStr: `${race.meetingNumber}回${race.venue}${race.dayNumber}日`,
          weather: race.weather,
          track: {
            turf: race.surface === '芝' ? race.trackCond : undefined,
            dirt: race.surface === 'ダート' ? race.trackCond : undefined
          },
          cushion: race.cushionValue,
          races: []
        });
      }
      
      const venueData = venueMap.get(race.venue);
      venueData.races.push({
        raceId: race.raceId,
        date: race.date,
        venue: race.venue,
        meetingNumber: race.meetingNumber,
        dayNumber: race.dayNumber,
        raceNo: race.raceNo,
        raceName: race.raceName,
        className: race.className,
        surface: race.surface,
        distance: race.distance,
        direction: race.direction,
        courseConf: race.courseConf,
        trackCond: race.trackCond,
        cushionValue: race.cushionValue,
        fieldSize: race.fieldSize,
        offAt: race.offAt || '00:00',
        grade: race.grade,
        win5: race.win5,
        status: race.status,
        weather: race.weather
      });
      
      // トラック状態を更新（複数のレースがある場合は最新の状態を使用）
      if (race.surface === '芝') {
        venueData.track.turf = race.trackCond;
      } else {
        venueData.track.dirt = race.trackCond;
      }
    }
    
    // レースを時間順にソート
    for (const venue of venueMap.values()) {
      venue.races.sort((a: any, b: any) => a.raceNo - b.raceNo);
    }
    
    return c.json(Array.from(venueMap.values()));
  } catch (error) {
    console.error('Error getting venue data:', error);
    return c.json({ error: '会場情報の取得に失敗しました' }, 500);
  }
});

// 利用可能な開催日を取得
app.get('/api/venues/dates', async (c) => {
  try {
    const db = createDb(c.env.DB);
    
    // race_entriesテーブルからユニークな日付を取得
    const dates = await db.select({ date: raceEntries.date }).from(raceEntries)
      .groupBy(raceEntries.date);
    

    
    // 有効な日付のみをフィルタリングして日本語形式に変換
    const validDates = dates
      .map(d => d.date)
      .filter(dateStr => {
        // 空文字やnullをチェック
        if (!dateStr || typeof dateStr !== 'string') return false;
        
        // YYYYMMDD形式をチェック（6桁も許可）
        const dateRegex = /^\d{6,8}$/;
        if (!dateRegex.test(dateStr)) return false;
        
        // 6桁の場合は20を前に付ける
        let fullDateStr = dateStr;
        if (dateStr.length === 6) {
          fullDateStr = `20${dateStr}`;
        }
        
        // 有効な日付かチェック
        const year = parseInt(fullDateStr.substring(0, 4));
        const month = parseInt(fullDateStr.substring(4, 6));
        const day = parseInt(fullDateStr.substring(6, 8));
        const date = new Date(year, month - 1, day);
        return date instanceof Date && !isNaN(date.getTime()) && 
               date.getFullYear() === year && 
               date.getMonth() === month - 1 && 
               date.getDate() === day;
      })
      .map(dateStr => {
        // 6桁の場合は20を前に付ける
        let fullDateStr = dateStr;
        if (dateStr.length === 6) {
          fullDateStr = `20${dateStr}`;
        }
        
        // YYYYMMDD形式をYYYY-MM-DD形式に変換
        const year = fullDateStr.substring(0, 4);
        const month = fullDateStr.substring(4, 6);
        const day = fullDateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
      })
      .sort((a: string, b: string) => a.localeCompare(b)); // 日付順にソート

    return c.json(validDates);
  } catch (error) {
    console.error('Error getting available dates:', error);
    return c.json({ error: '開催日の取得に失敗しました' }, 500);
  }
});

// 統計情報
app.get('/api/stats', async (c) => {
  const db = createDb(c.env.DB);
  
  const [horsesCount, racesCount, resultsCount] = await Promise.all([
    db.select().from(horses).then(r => r.length),
    db.select().from(races).then(r => r.length),
    db.select().from(raceResults).then(r => r.length)
  ]);
  
  return c.json({
    horses: horsesCount,
    races: racesCount,
    results: resultsCount
  });
});

export default app;
import { count, sum } from 'drizzle-orm/sql';
