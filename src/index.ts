import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './db/db';
import { horses, races, raceResults, raceEntries } from './db/schema';
import type { NewHorse, NewRace, NewRaceResult, NewRaceEntry } from './db/schema';

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
    await db.insert(horses).values(horsesData);
    return c.json({ message: `${horsesData.length}件の馬データを追加しました` });
  } catch (error) {
    return c.json({ error: '馬データの追加に失敗しました' }, 500);
  }
});

app.get('/api/horses/:id', async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const horse = await db.select().from(horses).where(horses.id.eq(id)).get();
  
  if (!horse) {
    return c.json({ error: '馬が見つかりません' }, 404);
  }
  
  return c.json(horse);
});

// レースデータのCRUD操作
app.get('/api/races', async (c) => {
  const db = createDb(c.env.DB);
  const allRaces = await db.select().from(races);
  return c.json(allRaces);
});

app.post('/api/races', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const racesData: NewRace[] = await c.req.json();
    await db.insert(races).values(racesData);
    return c.json({ message: `${racesData.length}件のレースデータを追加しました` });
  } catch (error) {
    return c.json({ error: 'レースデータの追加に失敗しました' }, 500);
  }
});

// レース結果のCRUD操作
app.get('/api/race-results', async (c) => {
  const db = createDb(c.env.DB);
  const results = await db.select().from(raceResults);
  return c.json(results);
});

app.post('/api/race-results', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const resultsData: NewRaceResult[] = await c.req.json();
    await db.insert(raceResults).values(resultsData);
    return c.json({ message: `${resultsData.length}件のレース結果データを追加しました` });
  } catch (error) {
    return c.json({ error: 'レース結果データの追加に失敗しました' }, 500);
  }
});

// 馬のレース結果を取得
app.get('/api/horses/:id/results', async (c) => {
  const db = createDb(c.env.DB);
  const id = c.req.param('id');
  const results = await db.select().from(raceResults).where(raceResults.horseId.eq(id));
  return c.json(results);
});

// 出馬表のCRUD操作
app.post('/api/race-entries', async (c) => {
  try {
    const db = createDb(c.env.DB);
    const entriesData: NewRaceEntry[] = await c.req.json();
    await db.insert(raceEntries).values(entriesData);
    return c.json({ message: `${entriesData.length}件の出馬表データを追加しました` });
  } catch (error) {
    return c.json({ error: '出馬表データの追加に失敗しました' }, 500);
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