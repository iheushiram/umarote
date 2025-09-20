import { describe, expect, it, beforeEach, beforeAll, vi } from 'vitest';
import type { Hono } from 'hono';
import { raceEntries, raceResults, races, horses } from '../db/schema';

type TableData = Map<any, any[]>;

class FakeDb {
  constructor(private readonly tableData: TableData) {}

  select(selection?: Record<string, any>) {
    return new SelectQuery(this.tableData, selection ?? null);
  }
}

class SelectQuery {
  private rows: any[] = [];
  private selection: Record<string, any> | null;

  constructor(private readonly tableData: TableData, selection: Record<string, any> | null) {
    this.selection = selection;
  }

  from(table: any) {
    const source = this.tableData.get(table) ?? [];
    this.rows = source.map((row: any) => ({ ...row }));
    return this;
  }

  where(condition: any) {
    if (!condition) return this;
    this.rows = this.rows.filter((row) => evaluateCondition(condition, row));
    return this;
  }

  orderBy(...orders: any[]) {
    this.rows.sort((a, b) => compareRows(a, b, orders));
    return this;
  }

  limit(n: number) {
    this.rows = this.rows.slice(0, n);
    return this;
  }

  groupBy(column: any) {
    this.rows = groupRows(this.rows, column, this.selection);
    this.selection = null;
    return this;
  }

  get() {
    const [first] = applySelection(this.rows, this.selection);
    return Promise.resolve(first);
  }

  then(onFulfilled?: (value: any) => unknown, onRejected?: (reason: unknown) => unknown) {
    try {
      const result = applySelection(this.rows, this.selection);
      return Promise.resolve(result).then(onFulfilled, onRejected);
    } catch (error) {
      if (onRejected) {
        return Promise.reject(error).catch(onRejected);
      }
      throw error;
    }
  }
}

function evaluateCondition(condition: any, row: any): boolean {
  if (!condition) return true;
  if (typeof condition === 'function') return condition(row);

  switch (condition.type) {
    case 'eq':
      return getColumnValue(row, condition.column) === condition.value;
    case 'in': {
      const value = getColumnValue(row, condition.column);
      return condition.values.includes(value);
    }
    case 'lt':
      return getColumnValue(row, condition.column) < condition.value;
    case 'gt':
      return getColumnValue(row, condition.column) > condition.value;
    case 'lte':
      return getColumnValue(row, condition.column) <= condition.value;
    case 'gte':
      return getColumnValue(row, condition.column) >= condition.value;
    case 'and':
      return (condition.conditions || []).every((cond: any) => evaluateCondition(cond, row));
    default:
      return true;
  }
}

function compareRows(a: any, b: any, orders: any[]): number {
  for (const order of orders) {
    const descriptor = resolveOrderDescriptor(order);
    const aValue = getColumnValue(a, descriptor.column);
    const bValue = getColumnValue(b, descriptor.column);

    if (aValue === bValue) continue;
    if (aValue === undefined || aValue === null) return descriptor.direction === 'asc' ? -1 : 1;
    if (bValue === undefined || bValue === null) return descriptor.direction === 'asc' ? 1 : -1;

    if (aValue > bValue) return descriptor.direction === 'asc' ? 1 : -1;
    if (aValue < bValue) return descriptor.direction === 'asc' ? -1 : 1;
  }
  return 0;
}

function resolveOrderDescriptor(order: any) {
  if (order && order.direction && order.column) {
    return order;
  }
  const column = getColumnName(order);
  return { direction: 'asc', column };
}

function groupRows(rows: any[], column: any, selection: Record<string, any> | null) {
  const columnName = getColumnName(column);
  const groups = new Map<any, any[]>();

  rows.forEach((row) => {
    const key = getColumnValue(row, columnName);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  });

  const aggregated: any[] = [];

  for (const [key, groupRows] of groups.entries()) {
    if (selection) {
      const output: Record<string, any> = {};
      Object.entries(selection).forEach(([alias, sel]) => {
        if (isAggregate(sel, 'count')) {
          output[alias] = groupRows.length;
        } else if (isAggregate(sel, 'sum')) {
          output[alias] = groupRows.reduce(
            (total, row) => total + (Number(getColumnValue(row, sel.column)) || 0),
            0
          );
        } else if (isColumn(sel)) {
          output[alias] = getColumnValue(groupRows[0], sel.name);
        } else {
          output[alias] = null;
        }
      });
      aggregated.push(output);
    } else {
      aggregated.push({ [toCamelCase(columnName)]: key });
    }
  }

  return aggregated;
}

function applySelection(rows: any[], selection: Record<string, any> | null) {
  if (!selection) {
    return rows.map((row) => ({ ...row }));
  }

  return rows.map((row) => {
    const result: Record<string, any> = {};
    Object.entries(selection).forEach(([alias, sel]) => {
      if (isAggregate(sel, 'count') || isAggregate(sel, 'sum')) {
        result[alias] = row[alias];
      } else if (isColumn(sel)) {
        result[alias] = getColumnValue(row, sel.name);
      } else {
        result[alias] = null;
      }
    });
    return result;
  });
}

function isColumn(selector: any): selector is { name: string } {
  return selector && typeof selector === 'object' && typeof selector.name === 'string';
}

function isAggregate(selector: any, type: 'count' | 'sum') {
  return selector && selector.__type === type;
}

function getColumnName(column: any): string {
  if (!column) return '';
  if (typeof column === 'string') return column;
  if (typeof column.name === 'string') return column.name;
  if (typeof column.column === 'string') return column.column;
  return '';
}

function getColumnValue(row: any, columnName: string | undefined) {
  if (!columnName) return undefined;
  if (columnName in row) return row[columnName];

  const camel = toCamelCase(columnName);
  if (camel in row) return row[camel];

  const snake = toSnakeCase(columnName);
  if (snake in row) return row[snake];

  return undefined;
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

let fakeDb: FakeDb;

vi.mock('../db/db', () => ({
  createDb: () => fakeDb,
}));

vi.mock('drizzle-orm', () => {
  const eq = (column: any, value: any) => ({ type: 'eq', column: getColumnName(column), value });
  const inArray = (column: any, values: any[]) => ({ type: 'in', column: getColumnName(column), values });
  const lt = (column: any, value: any) => ({ type: 'lt', column: getColumnName(column), value });
  const gt = (column: any, value: any) => ({ type: 'gt', column: getColumnName(column), value });
  const lte = (column: any, value: any) => ({ type: 'lte', column: getColumnName(column), value });
  const gte = (column: any, value: any) => ({ type: 'gte', column: getColumnName(column), value });
  const and = (...conditions: any[]) => ({ type: 'and', conditions });
  const desc = (column: any) => ({ direction: 'desc', column: getColumnName(column) });
  const sql = (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join('').toUpperCase();
    if (text.includes('COUNT')) return { __type: 'count' };
    if (text.includes('SUM')) return { __type: 'sum', column: getColumnName(values[0]) };
    return { __type: 'raw', text };
  };

  return { eq, inArray, lt, gt, lte, gte, and, desc, sql };
});

const MAIN_RACE = 'RID_MAIN';
const PREV_RACE = 'RID_PREV';
const NEXT_RACE_H1 = 'RID_NEXT1';
const NEXT_RACE_H2 = 'RID_NEXT2';
const OLDER_RACE = 'RID_OLD';
const HORSE_1 = 'H1';
const HORSE_2 = 'H2';

function createTableData(): TableData {
  const horsesData = [
    {
      id: HORSE_1,
      name: 'ホースワン',
      birthDate: '20200101',
      sex: '牡',
      color: '鹿毛',
      father: 'サイヤーA',
      mother: 'ダムA',
      maternalGrandfather: 'マテグラA',
      trainer: '調教師A',
      owner: '馬主A',
      breeder: '生産者A',
      earnings: 0,
    },
    {
      id: HORSE_2,
      name: 'ホースツー',
      birthDate: '20200101',
      sex: '牝',
      color: '青鹿毛',
      father: 'サイヤーB',
      mother: 'ダムB',
      maternalGrandfather: 'マテグラB',
      trainer: '調教師B',
      owner: '馬主B',
      breeder: '生産者B',
      earnings: 0,
    },
  ];

  const racesData = [
    {
      raceId: MAIN_RACE,
      date: '20250101',
      venue: '東京',
      meetingNumber: 1,
      dayNumber: 1,
      raceNo: 1,
      raceName: 'メインレース',
      className: '1勝クラス',
      surface: '芝',
      distance: 1200,
      direction: '右',
      trackCond: '良',
      fieldSize: 2,
      status: '発売中',
    },
    {
      raceId: PREV_RACE,
      date: '20241220',
      venue: '中山',
      meetingNumber: 1,
      dayNumber: 2,
      raceNo: 8,
      raceName: '前走レース',
      className: '1勝クラス',
      surface: '芝',
      distance: 1200,
      direction: '右',
      trackCond: '稍',
      fieldSize: 2,
      status: '確定',
    },
    {
      raceId: NEXT_RACE_H1,
      date: '20250210',
      venue: '東京',
      meetingNumber: 1,
      dayNumber: 3,
      raceNo: 6,
      raceName: '次走H1',
      className: '1勝クラス',
      surface: '芝',
      distance: 1400,
      direction: '右',
      trackCond: '良',
      fieldSize: 12,
      status: '確定',
    },
    {
      raceId: NEXT_RACE_H2,
      date: '20250215',
      venue: '京都',
      meetingNumber: 1,
      dayNumber: 4,
      raceNo: 9,
      raceName: '次走H2',
      className: '1勝クラス',
      surface: '芝',
      distance: 1600,
      direction: '右',
      trackCond: '良',
      fieldSize: 16,
      status: '確定',
    },
    {
      raceId: OLDER_RACE,
      date: '20241010',
      venue: '阪神',
      meetingNumber: 1,
      dayNumber: 5,
      raceNo: 3,
      raceName: '古いレース',
      className: '1勝クラス',
      surface: '芝',
      distance: 1400,
      direction: '右',
      trackCond: '良',
      fieldSize: 10,
      status: '確定',
    },
  ];

  const raceEntriesData = [
    {
      id: 1,
      raceId: MAIN_RACE,
      horseId: HORSE_1,
      date: '20250101',
      frameNo: 1,
      horseNo: 1,
      age: 3,
      jockey: '騎手A',
      weight: 55,
      trainer: '調教師A',
      affiliation: '美',
      popularity: 1,
      bodyWeight: 480,
      bodyWeightDiff: 0,
      blinkers: false,
      raceName: 'メインレース',
      surface: '芝',
      distance: 1200,
      horseName: 'ホースワン',
      sex: '牡',
      color: '鹿毛',
      father: 'サイヤーA',
      mother: 'ダムA',
      owner: '馬主A',
      breeder: '生産者A',
      maternalGrandfather: 'マテグラA',
      prizeMoney: 800,
      earnedMoney: 400,
    },
    {
      id: 2,
      raceId: MAIN_RACE,
      horseId: HORSE_2,
      date: '20250101',
      frameNo: 2,
      horseNo: 2,
      age: 3,
      jockey: '騎手B',
      weight: 54,
      trainer: '調教師B',
      affiliation: '栗',
      popularity: 2,
      bodyWeight: 460,
      bodyWeightDiff: 2,
      blinkers: false,
      raceName: 'メインレース',
      surface: '芝',
      distance: 1200,
      horseName: 'ホースツー',
      sex: '牝',
      color: '青鹿毛',
      father: 'サイヤーB',
      mother: 'ダムB',
      owner: '馬主B',
      breeder: '生産者B',
      maternalGrandfather: 'マテグラB',
      prizeMoney: 400,
      earnedMoney: 200,
    },
    {
      id: 3,
      raceId: PREV_RACE,
      horseId: HORSE_1,
      date: '20241220',
      frameNo: 1,
      horseNo: 1,
      age: 3,
      jockey: '騎手A',
      weight: 55,
      trainer: '調教師A',
      affiliation: '美',
      popularity: 1,
      bodyWeight: 482,
      bodyWeightDiff: 2,
      blinkers: false,
      raceName: '前走レース',
      surface: '芝',
      distance: 1200,
      horseName: 'ホースワン',
      sex: '牡',
      color: '鹿毛',
      father: 'サイヤーA',
      mother: 'ダムA',
      owner: '馬主A',
      breeder: '生産者A',
      maternalGrandfather: 'マテグラA',
      prizeMoney: 600,
      earnedMoney: 300,
    },
    {
      id: 4,
      raceId: PREV_RACE,
      horseId: HORSE_2,
      date: '20241220',
      frameNo: 2,
      horseNo: 2,
      age: 3,
      jockey: '騎手B',
      weight: 54,
      trainer: '調教師B',
      affiliation: '栗',
      popularity: 2,
      bodyWeight: 462,
      bodyWeightDiff: 1,
      blinkers: false,
      raceName: '前走レース',
      surface: '芝',
      distance: 1200,
      horseName: 'ホースツー',
      sex: '牝',
      color: '青鹿毛',
      father: 'サイヤーB',
      mother: 'ダムB',
      owner: '馬主B',
      breeder: '生産者B',
      maternalGrandfather: 'マテグラB',
      prizeMoney: 300,
      earnedMoney: 150,
    },
  ];

  const raceResultsData = [
    {
      id: 'RR_MAIN_1',
      raceId: MAIN_RACE,
      horseId: HORSE_1,
      date: '20250101',
      raceName: 'メインレース',
      venue: '東京',
      courseType: '芝',
      distance: 1200,
      direction: '右',
      courseCondition: '良',
      finishPosition: 1,
      jockey: '騎手A',
      weight: 55,
      time: '1:12.0',
      margin: '0.0',
      pos2c: 1,
      pos3c: 1,
      pos4c: 1,
      averagePosition: 1,
      lastThreeFurlong: '34.5',
      odds: 2.5,
      popularity: 1,
      prizeMoney: 800,
      earnedMoney: 400,
    },
    {
      id: 'RR_MAIN_2',
      raceId: MAIN_RACE,
      horseId: HORSE_2,
      date: '20250101',
      raceName: 'メインレース',
      venue: '東京',
      courseType: '芝',
      distance: 1200,
      direction: '右',
      courseCondition: '良',
      finishPosition: 2,
      jockey: '騎手B',
      weight: 54,
      time: '1:13.2',
      margin: '0.2',
      pos2c: 2,
      pos3c: 2,
      pos4c: 2,
      averagePosition: 2,
      lastThreeFurlong: '35.0',
      odds: 3.5,
      popularity: 2,
      prizeMoney: 400,
      earnedMoney: 200,
    },
    {
      id: 'RR_PREV_1',
      raceId: PREV_RACE,
      horseId: HORSE_1,
      date: '20241220',
      raceName: '前走レース',
      venue: '中山',
      courseType: '芝',
      distance: 1200,
      direction: '右',
      courseCondition: '稍',
      finishPosition: 2,
      jockey: '騎手A',
      weight: 55,
      time: '1:10.0',
      margin: '0.1',
      pos2c: 2,
      pos3c: 2,
      pos4c: 2,
      averagePosition: 2,
      lastThreeFurlong: '34.2',
      odds: 2.0,
      popularity: 1,
      prizeMoney: 600,
      earnedMoney: 300,
    },
    {
      id: 'RR_PREV_2',
      raceId: PREV_RACE,
      horseId: HORSE_2,
      date: '20241220',
      raceName: '前走レース',
      venue: '中山',
      courseType: '芝',
      distance: 1200,
      direction: '右',
      courseCondition: '稍',
      finishPosition: 3,
      jockey: '騎手B',
      weight: 54,
      time: '1:11.0',
      margin: '0.3',
      pos2c: 3,
      pos3c: 3,
      pos4c: 3,
      averagePosition: 3,
      lastThreeFurlong: '34.8',
      odds: 5.0,
      popularity: 2,
      prizeMoney: 300,
      earnedMoney: 150,
    },
    {
      id: 'RR_NEXT_1',
      raceId: NEXT_RACE_H1,
      horseId: HORSE_1,
      date: '20250210',
      raceName: '次走H1',
      venue: '東京',
      courseType: '芝',
      distance: 1400,
      direction: '右',
      courseCondition: '良',
      finishPosition: 3,
      jockey: '騎手A',
      weight: 55,
      time: '1:21.5',
      margin: '0.5',
      pos2c: 3,
      pos3c: 3,
      pos4c: 3,
      averagePosition: 3,
      lastThreeFurlong: '35.0',
      odds: 6.0,
      popularity: 3,
      prizeMoney: 200,
      earnedMoney: 100,
    },
    {
      id: 'RR_NEXT_2',
      raceId: NEXT_RACE_H2,
      horseId: HORSE_2,
      date: '20250215',
      raceName: '次走H2',
      venue: '京都',
      courseType: '芝',
      distance: 1600,
      direction: '右',
      courseCondition: '良',
      finishPosition: 1,
      jockey: '騎手B',
      weight: 54,
      time: '1:34.0',
      margin: '0.0',
      pos2c: 1,
      pos3c: 1,
      pos4c: 1,
      averagePosition: 1,
      lastThreeFurlong: '34.0',
      odds: 4.0,
      popularity: 2,
      prizeMoney: 700,
      earnedMoney: 350,
    },
    {
      id: 'RR_OLD_1',
      raceId: OLDER_RACE,
      horseId: HORSE_1,
      date: '20241010',
      raceName: '古いレース',
      venue: '阪神',
      courseType: '芝',
      distance: 1400,
      direction: '右',
      courseCondition: '良',
      finishPosition: 5,
      jockey: '騎手A',
      weight: 55,
      time: '1:21.0',
      margin: '0.7',
      pos2c: 5,
      pos3c: 5,
      pos4c: 5,
      averagePosition: 5,
      lastThreeFurlong: '35.8',
      odds: 10.0,
      popularity: 5,
      prizeMoney: 100,
      earnedMoney: 50,
    },
  ];

  return new Map<any, any[]>([
    [horses, horsesData],
    [races, racesData],
    [raceEntries, raceEntriesData],
    [raceResults, raceResultsData],
  ]);
}

let app: Hono<any, any, any>;

beforeAll(async () => {
  app = (await import('../index')).default;
});

beforeEach(() => {
  fakeDb = new FakeDb(createTableData());
});

const fetchWithEnv = (path: string, init?: RequestInit) => {
  const url = `http://localhost${path}`;
  const request = new Request(url, init);
  return app.fetch(request, { DB: {} } as any);
};

describe('Umarote API (mocked DB)', () => {
  it('returns race entries with recent history', async () => {
    const res = await fetchWithEnv(`/api/races/${MAIN_RACE}/entries-with-history`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.raceId).toBe(MAIN_RACE);
    expect(body.entries).toHaveLength(2);

    const horseOne = body.entries.find((entry: any) => entry.horseId === HORSE_1);
    expect(horseOne).toBeTruthy();
    expect(horseOne.recentResults).toHaveLength(2);
    expect(horseOne.recentResults[0].raceId).toBe(PREV_RACE);
    expect(horseOne.recentResults[1].raceId).toBe(OLDER_RACE);
    expect(horseOne.horse.name).toBe('ホースワン');
  });

  it('aggregates race basics with counts and prize sums', async () => {
    const res = await fetchWithEnv('/api/races/batch-basic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raceIds: [MAIN_RACE, PREV_RACE] }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.races).toHaveLength(2);

    const main = body.races.find((r: any) => r.raceId === MAIN_RACE);
    expect(main.entryCount).toBe(2);
    expect(main.resultCount).toBe(2);
    expect(main.totalPrizeMoney).toBe(1200);

    const prev = body.races.find((r: any) => r.raceId === PREV_RACE);
    expect(prev.entryCount).toBe(2);
    expect(prev.resultCount).toBe(2);
    expect(prev.totalPrizeMoney).toBe(900);
  });

  it('returns the next race info for co-runners', async () => {
    const res = await fetchWithEnv('/api/races/co-runners/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raceIds: [PREV_RACE], beforeDate: '20250301' }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.races).toHaveLength(1);

    const info = body.races[0];
    expect(info.totalCoRunners).toBe(2);

    const nextForH1 = info.runners.find((r: any) => r.horseId === HORSE_1);
    expect(nextForH1.nextRaceId).toBe(MAIN_RACE);
    expect(nextForH1.nextFinish).toBe(1);

    const nextForH2 = info.runners.find((r: any) => r.horseId === HORSE_2);
    expect(nextForH2.nextRaceId).toBe(MAIN_RACE);
    expect(nextForH2.nextFinish).toBe(2);
  });

  it('excludes co-runner results on or after the specified beforeDate', async () => {
    const res = await fetchWithEnv('/api/races/co-runners/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raceIds: [PREV_RACE], beforeDate: '20250101' }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.races).toHaveLength(1);

    const info = body.races[0];
    expect(info.totalCoRunners).toBe(2);

    info.runners.forEach((runner: any) => {
      expect(runner.nextRaceId).toBeNull();
      expect(runner.nextFinish).toBeNull();
    });
  });

  it('computes speed metrics for multiple horses', async () => {
    const res = await fetchWithEnv('/api/races/speed-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raceIds: [MAIN_RACE] }),
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.races).toHaveLength(1);

    const metrics = body.races[0];
    expect(metrics.raceId).toBe(MAIN_RACE);
    expect(metrics.winnerKmh).toBeCloseTo(60.0, 5);
    expect(metrics.actualAvg).toBeCloseTo(59.5, 5);
    expect(metrics.prevAvg).toBeCloseTo(61.3, 1);
    expect(metrics.countActual).toBe(2);
    expect(metrics.countPrev).toBe(2);
  });
});
