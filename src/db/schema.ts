import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core';

export const horses = sqliteTable('horses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  birthYear: integer('birth_year').notNull(),
  sex: text('sex', { enum: ['牡', '牝', 'セ'] }).notNull(),
  color: text('color').notNull(),
  father: text('father').notNull(),
  mother: text('mother').notNull(),
  trainer: text('trainer').notNull(),
  owner: text('owner').notNull(),
  breeder: text('breeder').notNull(),
  earnings: real('earnings').notNull().default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const races = sqliteTable('races', {
  raceId: text('race_id').primaryKey(),
  date: text('date').notNull(),
  venue: text('venue').notNull(),
  raceNo: integer('race_no').notNull(),
  raceName: text('race_name').notNull(),
  className: text('class_name').notNull(),
  surface: text('surface', { enum: ['芝', 'ダート'] }).notNull(),
  distance: integer('distance').notNull(),
  direction: text('direction', { enum: ['右', '左'] }).notNull(),
  courseConf: text('course_conf'),
  trackCond: text('track_cond', { enum: ['良', '稍', '重', '不良'] }).notNull(),
  cushionValue: real('cushion_value'),
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
  cushionValue: real('cushion_value'),
  finishPosition: integer('finish_position').notNull(),
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
  id: text('id').primaryKey(),
  raceId: text('race_id').notNull().references(() => races.raceId),
  horseId: text('horse_id').notNull().references(() => horses.id),
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