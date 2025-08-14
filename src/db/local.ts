import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export function createLocalDb() {
  const sqlite = new Database('./local.db');
  const db = drizzle(sqlite, { schema });
  
  // マイグレーションを実行
  migrate(db, { migrationsFolder: './src/db/migrations' });
  
  return db;
}

export type LocalDatabase = ReturnType<typeof createLocalDb>;