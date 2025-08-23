import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './db/db';
import { horses, races, raceResults, raceEntries, trackConditions } from './db/schema';
import type { NewHorse, NewRace, NewRaceResult, NewRaceEntry } from './db/schema';
import { eq, sql, and, inArray, desc } from 'drizzle-orm';

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
  const limit = limitParam ? parseInt(limitParam) : undefined;

  let whereClause: any = undefined;
  if (raceId && horseId) {
    whereClause = and(eq(raceResults.raceId, raceId), eq(raceResults.horseId, horseId));
  } else if (raceId) {
    whereClause = eq(raceResults.raceId, raceId);
  } else if (horseId) {
    whereClause = eq(raceResults.horseId, horseId);
  }

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
    
    // 1. レース情報を抽出して登録（既に登録済みの場合はスキップ）
    const raceMap = new Map<string, NewRace>();
    
    for (const resultData of resultsData) {
      if (resultData.raceId && !raceMap.has(resultData.raceId)) {
        // レース結果からレース情報を推定
        const raceData: NewRace = {
          raceId: resultData.raceId,
          date: resultData.date,
          venue: (resultData as any).venueNormalized || resultData.venue, // 正規化された開催地
          meetingNumber: (resultData as any).meetingNumber || 1,
          dayNumber: (resultData as any).dayNumber || 1,
          raceNo: (resultData as any).raceNo || 1,
          raceName: resultData.raceName,
          className: (resultData as any).className || '未勝利',
          surface: resultData.courseType,
          distance: resultData.distance,
          direction: resultData.direction || '右',
          trackCond: resultData.courseCondition,
          fieldSize: (resultData as any).fieldSize,
          win5: false,
          status: '確定',
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
            trainer: horseData.trainer,
            owner: horseData.owner,
            breeder: horseData.breeder,
            earnings: horseData.earnings,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }
        });
    }
    
    // 3. レース結果をUPSERT
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
      
      // レースIDの生成（年月日 + 場所 + 開催回数 + 日数 + レース番号）
      // 例: 2025年4月2日 新潟 2回7日目 1R → 202504020701
      const date = normalizedDate;
      const venue = row['場所'];
      const raceNo = row['R'];
      
      // 場所を数値に変換
      const venueMap: Record<string, string> = {
        '札幌': '01', '函館': '02', '福島': '03', '新潟': '04', '東京': '05',
        '中山': '06', '中京': '07', '京都': '08', '阪神': '09', '小倉': '10'
      };
      const venueCode = venueMap[venue] || '00';
      
      // CSVのレースIDからrace_idを正しい形式に変換
      const fullRaceId = row['レースID'];
      const venueCodeFromId = fullRaceId.substring(0, 2);
      const year = fullRaceId.substring(2, 4);
      const meeting = fullRaceId.substring(4, 5).padStart(2, '0');
      const day = fullRaceId.substring(5, 6).padStart(2, '0');
      const raceNoFromId = fullRaceId.substring(6, 8);
      const raceId = `20${year}${venueCodeFromId}${meeting}${day}${raceNoFromId}`;
      
      // 馬IDの生成（血統登録番号の頭に20を追加）
      const horseId = `20${row['血統登録番号']}`;
      
      // レース情報の作成
      const raceData: NewRace = {
        raceId: raceId,
        date: normalizedDate,
        venue: row['場所'],
        meetingNumber: 1, // デフォルト値
        dayNumber: 1,     // デフォルト値
        raceNo: parseInt(row['R']),
        raceName: row['レース名'],
        className: row['レース名'].includes('未勝利') ? '未勝利' : 
                  row['レース名'].includes('1勝') ? '1勝クラス' :
                  row['レース名'].includes('2勝') ? '2勝クラス' :
                  row['レース名'].includes('3勝') ? '3勝クラス' : 'OP',
        surface: row['芝・ダ'] === '芝' ? '芝' : 'ダート',
        distance: parseInt(row['距離']),
        direction: '右', // デフォルト値
        trackCond: '良', // デフォルト値
        fieldSize: parseInt(row['頭数']) || 0,
        win5: false,
        status: '発売中',
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
        maternalGrandfather: row['母父'] || '',
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

    // 出馬表データをINSERT（重複チェックなし）
    for (const entryData of entriesData) {
      await db.insert(raceEntries)
        .values({
          ...entryData,
          updatedAt: sql`CURRENT_TIMESTAMP`
        });
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

    const enriched = entries.map(e => ({
      ...e,
      horse: horseMap.get(e.horseId) || null
    }));

    return c.json(enriched);
  } catch (error) {
    console.error('Error getting race entries:', error);
    return c.json({ error: '出馬表の取得に失敗しました' }, 500);
  }
});

// レースIDから情報を抽出するヘルパー関数
function getVenueFromRaceId(raceId: string): string {
  const venueCode = raceId.substring(6, 8);
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
            offAt: '00:00', // デフォルト値
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