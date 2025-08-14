import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export interface Env {
  DB: D1Database;
}

export function createDb(db: D1Database) {
  return drizzle(db, { schema });
}

export type Database = ReturnType<typeof createDb>;