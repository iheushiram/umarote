import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core';

export const horses = sqliteTable('horses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  birthDate: text('birth_date').notNull(),
  sex: text('sex', { enum: ['牡', '牝', 'セ'] }).notNull(),
  color: text('color').notNull(),
  father: text('father').notNull(),
  mother: text('mother').notNull(),
  trainer: text('trainer').notNull(),
  owner: text('owner').notNull(),
  breeder: text('breeder').notNull(),
  earnings: real('earnings').notNull().default(0),
  currentRaceId: text('current_race_id'), // 現在出走予定のレースID（任意）
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const trackConditions = sqliteTable('track_conditions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),           // 開催日
  venue: text('venue').notNull(),         // 会場
  surface: text('surface', { enum: ['芝', 'ダート'] }).notNull(),
  trackCond: text('track_cond', { enum: ['良', '稍', '重', '不良'] }).notNull(),
  cushionValue: real('cushion_value'),    // クッション値
  moistureContent: real('moisture_content'), // 含水率（将来用）
  temperature: real('temperature'),       // 気温（将来用）
  humidity: real('humidity'),             // 湿度（将来用）
  notes: text('notes'),                   // 備考
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const races = sqliteTable('races', {
  raceId: text('race_id').primaryKey(),
  date: text('date').notNull(),
  venue: text('venue').notNull(),
  meetingNumber: integer('meeting_number').notNull(), // 開催回数
  dayNumber: integer('day_number').notNull(),         // 開催日数
  raceNo: integer('race_no').notNull(),
  raceName: text('race_name').notNull(),
  className: text('class_name').notNull(),
  surface: text('surface', { enum: ['芝', 'ダート'] }).notNull(),
  distance: integer('distance').notNull(),
  direction: text('direction', { enum: ['右', '左'] }).notNull(),
  courseConf: text('course_conf'),
  trackCond: text('track_cond', { enum: ['良', '稍', '重', '不良'] }).notNull(),
  trackConditionId: text('track_condition_id').references(() => trackConditions.id), // 外部キー（NULL許容）
  fieldSize: integer('field_size'),
  offAt: text('off_at'),
  grade: text('grade', { enum: ['OP', 'G3', 'G2', 'G1'] }),
  win5: integer('win5', { mode: 'boolean' }).default(false),
  status: text('status', { enum: ['発売中', '発走前', '確定'] }).notNull().default('発売中'),
  weather: text('weather'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const raceResults = sqliteTable('race_results', {
  id: text('id').primaryKey(),
  raceId: text('race_id').notNull().references(() => races.raceId),
  horseId: text('horse_id').notNull().references(() => horses.id),
  date: text('date').notNull(),
  raceName: text('race_name').notNull(),
  venue: text('venue').notNull(),
  courseType: text('course_type', { enum: ['芝', 'ダート'] }).notNull(),
  distance: integer('distance').notNull(),
  direction: text('direction', { enum: ['右', '左'] }).notNull(),
  courseConf: text('course_conf'),
  weather: text('weather'),
  courseCondition: text('course_condition', { enum: ['良', '稍', '重', '不良'] }).notNull(),
  trackConditionId: text('track_condition_id').references(() => trackConditions.id), // 外部キー（NULL許容）
  finishPosition: integer('finish_position'),
  jockey: text('jockey').notNull(),
  weight: real('weight').notNull(),
  time: text('time').notNull(),
  margin: text('margin').notNull(),
  pos2c: integer('pos2c'),
  pos3c: integer('pos3c'),
  pos4c: integer('pos4c'),
  averagePosition: real('average_position').notNull(),
  lastThreeFurlong: text('last_three_furlong').notNull(),
  odds: real('odds').notNull(),
  popularity: integer('popularity').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const raceEntries = sqliteTable('race_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  raceId: text('race_id').notNull(),
  horseId: text('horse_id').notNull(),
  date: text('date').notNull(),
  frameNo: integer('frame_no').notNull(),
  horseNo: integer('horse_no').notNull(),
  age: integer('age').notNull(),
  jockey: text('jockey').notNull(),
  weight: real('weight').notNull(),
  trainer: text('trainer').notNull(),
  affiliation: text('affiliation').notNull(),
  popularity: integer('popularity'),
  bodyWeight: integer('body_weight'),
  bodyWeightDiff: integer('body_weight_diff'),
  blinkers: integer('blinkers', { mode: 'boolean' }).default(false),
  // レース基本情報
  raceName: text('race_name'),
  surface: text('surface', { enum: ['芝', 'ダート'] }),
  distance: integer('distance'),
  // 馬の基本情報
  horseName: text('horse_name'),
  sex: text('sex', { enum: ['牡', '牝', 'セ'] }),
  color: text('color'),
  father: text('father'),
  mother: text('mother'),
  owner: text('owner'),
  breeder: text('breeder'),
  maternalGrandfather: text('maternal_grandfather'),
  // レース結果情報
  previousPopularity: integer('previous_popularity'),
  previousFinishPosition: integer('previous_finish_position'),
  previousOdds: real('previous_odds'),
  previousFinishOrder: integer('previous_finish_order'),
  // その他の情報
  dayNumber: integer('day_number'),
  interval: integer('interval'),
  prizeMoney: integer('prize_money'),
  earnedMoney: integer('earned_money'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type Horse = typeof horses.$inferSelect;
export type NewHorse = typeof horses.$inferInsert;
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type RaceResult = typeof raceResults.$inferSelect;
export type NewRaceResult = typeof raceResults.$inferInsert;
export type RaceEntry = typeof raceEntries.$inferSelect;
export type NewRaceEntry = typeof raceEntries.$inferInsert;