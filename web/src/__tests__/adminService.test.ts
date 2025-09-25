import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AdminService, MockAdminService, createAdminService, type RaceData, type RaceEntryData, type RaceResultData } from '../services/adminService'

const createMemoryStorage = () => {
  const store = new Map<string, string>()
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    get length() {
      return store.size
    },
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  })
}

const toUrl = (input: any) => new URL(String(input))

describe('AdminService HTTP', () => {
  const service = new AdminService()
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getRaces attaches query params and parses response', async () => {
    const sample: RaceData[] = [
      {
        raceId: '20250812SAPP11', date: '20250812', venue: '札幌', meetingNumber: 2, dayNumber: 2,
        raceNo: 11, raceName: '札幌記念', className: 'G2', surface: '芝', distance: 2000,
        direction: '右', trackCond: '良', fieldSize: 16
      }
    ]
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races')
      expect(url.searchParams.get('date')).toBe('20250101')
      expect(url.searchParams.get('venue')).toBe('東京')
      return { ok: true, json: async () => sample } as any
    })
    global.fetch = spy as any

    const res = await service.getRaces('20250101', '東京')
    expect(res).toEqual(sample)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('getRaceEntries hits /api/races/:id/entries', async () => {
    const sample: RaceEntryData[] = [
      { id: 'E1', raceId: 'RID', horseId: 'H1', frameNo: 1, horseNo: 1, age: 4, jockey: 'A', weight: 56, trainer: 'T', affiliation: '栗東' }
    ]
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races/RID/entries')
      return { ok: true, json: async () => sample } as any
    })
    global.fetch = spy as any

    const res = await service.getRaceEntries('RID')
    expect(res).toEqual(sample)
  })

  it('getRace returns object on OK and null on non-OK', async () => {
    const okSample: RaceData = {
      raceId: 'RID1', date: '20250812', venue: '東京', meetingNumber: 1, dayNumber: 1, raceNo: 1,
      raceName: '新馬', className: '新馬', surface: '芝', distance: 1600, direction: '左', trackCond: '良'
    }

    // OK case
    global.fetch = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races/RID1')
      return { ok: true, json: async () => okSample } as any
    }) as any
    const okRes = await service.getRace('RID1')
    expect(okRes).toEqual(okSample)

    // non-OK case
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as any
    const ngRes = await service.getRace('RID1')
    expect(ngRes).toBeNull()
  })

  it('getRaces returns [] on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    const res = await service.getRaces('20250101', '東京')
    expect(res).toEqual([])
  })

  it('insertHorses throws on non-OK and on fetch error', async () => {
    // non-OK
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.insertHorses([] as any)).rejects.toThrow()
    // fetch error
    global.fetch = vi.fn(async () => { throw new Error('boom') }) as any
    await expect(service.insertHorses([] as any)).rejects.toThrow()
  })

  it('getRaceEntries returns [] on error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network') }) as any
    const res = await service.getRaceEntries('RID')
    expect(res).toEqual([])
  })

  it('getRaceResults returns [] on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    const res = await service.getRaceResults('RID')
    expect(res).toEqual([])
  })

  it('getDistanceTimeStats returns null on error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('boom') }) as any
    const res = await service.getDistanceTimeStats({ distance: 1200 })
    expect(res).toBeNull()
  })

  it('getDistanceTimeStats returns null on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    const res = await service.getDistanceTimeStats({ distance: 1200 })
    expect(res).toBeNull()
  })

  it('getRaceResults builds correct querystring (no date normalization)', async () => {
    const sample: RaceResultData[] = [
      { id: 'R1', raceId: 'RID', horseId: 'H1', date: '20240101', raceName: '条件', venue: '東京', courseType: '芝', distance: 1600, direction: '左', courseCondition: '良', pos1c: 3, finishPosition: 2, jockey: 'J', weight: 56, time: '1322', margin: '0.2', averagePosition: 3, lastThreeFurlong: '34.0', odds: 5.1, popularity: 2 }
    ]
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/race-results')
      expect(url.searchParams.get('raceId')).toBe('RID')
      expect(url.searchParams.get('horseId')).toBe('H1')
      expect(url.searchParams.get('limit')).toBe('5')
      // AdminServiceは呼び出し値をそのままクエリに載せる（正規化しない）
      expect(url.searchParams.get('beforeDate')).toBe('2025-08-12')
      return { ok: true, json: async () => sample } as any
    })
    global.fetch = spy as any

    const res = await service.getRaceResults('RID', 'H1', 5, '2025-08-12')
    expect(res).toEqual(sample)
  })

  it('getRaceResults works without optional params', async () => {
    const sample: RaceResultData[] = []
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.searchParams.has('limit')).toBe(false)
      expect(url.searchParams.has('beforeDate')).toBe(false)
      return { ok: true, json: async () => sample } as any
    })
    global.fetch = spy as any
    const res = await service.getRaceResults('RID', 'H1')
    expect(res).toEqual([])
  })

  it('updateRacePartial PATCHes JSON body', async () => {
    const spy = vi.fn(async (input: any, init?: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races/RID')
      expect(init?.method).toBe('PATCH')
      expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
      expect(init?.body).toBeDefined()
      const body = JSON.parse(String(init!.body))
      expect(body).toEqual({ cushionValue: 9.5 })
      return { ok: true, json: async () => ({}) } as any
    })
    global.fetch = spy as any

    await service.updateRacePartial('RID', { cushionValue: 9.5 } as any)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('getDistanceTimeStats maps to /api/analysis/distance-times', async () => {
    const sample = { stats: { count: 10, average: 90.5, fastest: 85.0, slowest: 100.2, median: 91.0 } }
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/analysis/distance-times')
      expect(url.searchParams.get('distance')).toBe('1800')
      expect(url.searchParams.get('surface')).toBe('芝')
      expect(url.searchParams.get('class')).toBe('G2')
      expect(url.searchParams.get('from')).toBe('20240101')
      expect(url.searchParams.get('to')).toBe('20250101')
      expect(url.searchParams.get('winnersOnly')).toBe('1')
      expect(url.searchParams.get('limit')).toBe('2000')
      return { ok: true, json: async () => sample } as any
    })
    global.fetch = spy as any

    const res = await service.getDistanceTimeStats({ distance: 1800, surface: '芝', className: 'G2', from: '20240101', to: '20250101', winnersOnly: true })
    expect(res).toEqual(sample)
  })

  it('getDistanceTimeStats omits winnersOnly when false', async () => {
    const sample = { stats: { count: 0, average: 0, fastest: 0, slowest: 0, median: 0 } }
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.searchParams.get('winnersOnly')).toBeNull()
      return { ok: true, json: async () => sample } as any
    })
    global.fetch = spy as any
    const res = await service.getDistanceTimeStats({ distance: 1000, winnersOnly: false })
    expect(res).toEqual(sample)
  })

  it('updatePrizeMoney PATCHes to /api/races/:id/prize-money', async () => {
    const spy = vi.fn(async (input: any, init?: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races/RID/prize-money')
      expect(init?.method).toBe('PATCH')
      const body = JSON.parse(String(init!.body))
      expect(body).toEqual({ prizeMoney: 1234, earnedMoney: 567 })
      return { ok: true, json: async () => ({}) } as any
    })
    global.fetch = spy as any

    await service.updatePrizeMoney('RID', 1234, 567)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('updatePrizeMoney throws on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.updatePrizeMoney('RID', 1, 2)).rejects.toThrow()
  })

  it('updateRaceCushion throws on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.updateRaceCushion('RID', 9.9)).rejects.toThrow()
  })

  it('updateHorsePartial throws on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.updateHorsePartial('H1', { trainer: 'X' })).rejects.toThrow()
  })

  it('insert APIs send POST and handle errors', async () => {
    // insertHorses OK
    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = toUrl(input)
      if (url.pathname === '/api/horses' && init?.method === 'POST') return { ok: true } as any
      throw new Error('unexpected')
    }) as any
    await service.insertHorses([{ id: 'H', name: 'N', birthDate: '20200101', sex: '牡', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 }])

    // insertRaces non-OK
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.insertRaces([] as any)).rejects.toThrow()

    // insertRaceResults non-OK
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.insertRaceResults([] as any)).rejects.toThrow()

    // insertRaceEntries non-OK
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    await expect(service.insertRaceEntries([] as any)).rejects.toThrow()

    // insertRaceEntriesCsv non-OK with error json
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'bad csv' }) })) as any
    await expect(service.insertRaceEntriesCsv([] as any)).rejects.toThrow()

    // insertRaceEntriesCsv OK
    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = toUrl(input)
      if (url.pathname === '/api/race-entries-csv' && init?.method === 'POST') return { ok: true } as any
      throw new Error('unexpected')
    }) as any
    await service.insertRaceEntriesCsv([] as any)
  })

  it('getHorses returns [] on error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('boom') }) as any
    const res = await service.getHorses()
    expect(res).toEqual([])
  })

  it('getHorses returns list on OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ id: 'H', name: 'N', birthDate: '20200101', sex: '牡', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 }] }) as any) as any
    const res = await service.getHorses()
    expect(res).toHaveLength(1)
  })

  it('getVenueData returns [] on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false })) as any
    const res = await service.getVenueData('20250101')
    expect(res).toEqual([])
  })

  it('getRace non-OK and thrown error paths', async () => {
    // non-OK → null
    global.fetch = vi.fn(async () => ({ ok: false, status: 404 })) as any
    const a = await service.getRace('RID')
    expect(a).toBeNull()
    // thrown error → null（catch）
    global.fetch = vi.fn(async () => { throw new Error('boom') }) as any
    const b = await service.getRace('RID')
    expect(b).toBeNull()
  })

  it('getRaceEntries non-OK returns []', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    const res = await service.getRaceEntries('RID')
    expect(res).toEqual([])
  })

  it('getHorses non-OK returns []', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as any
    const res = await service.getHorses()
    expect(res).toEqual([])
  })

  it('getVenueData returns data on OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => [{ venue: '東京' }] }) as any) as any
    const res = await service.getVenueData('20250101')
    expect(res).toEqual([{ venue: '東京' }])
  })

  it('getStats returns zeros on error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('boom') }) as any
    const res = await service.getStats()
    expect(res).toEqual({ horses: 0, races: 0, results: 0 })
  })

  it('updateRacePartial throws on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false })) as any
    await expect(service.updateRacePartial('RID', { raceName: 'x' } as any)).rejects.toThrow()
  })

  it('insertRaceResultsWithHorses OK and error', async () => {
    // OK
    global.fetch = vi.fn(async (input: any, init?: any) => {
      const url = toUrl(input)
      if (url.pathname === '/api/race-results-with-horses' && init?.method === 'POST') return { ok: true } as any
      throw new Error('unexpected')
    }) as any
    await service.insertRaceResultsWithHorses([] as any)
    // error
    global.fetch = vi.fn(async () => ({ ok: false })) as any
    await expect(service.insertRaceResultsWithHorses([] as any)).rejects.toThrow()
  })

  it('MockAdminService.insertRaceResultsWithHorses builds horses and saves results', async () => {
    const m = new MockAdminService()
    localStorage.clear()
    await m.insertRaceResultsWithHorses([
      { id: 'RID1', raceId: 'R1', horseId: 'H1', date: '2024-06-01', raceName: 'Name・X', venue: '東京', courseType: '芝', distance: 1600, direction: '左', courseCondition: '良', pos1c: 1, finishPosition: 1, jockey: 'J', weight: 56, time: '1333', margin: '0.0', averagePosition: 2, lastThreeFurlong: '34.5', odds: 2.0, popularity: 1 } as any,
      { id: 'RID2', raceId: 'R1', horseId: 'H2', date: '2024-06-01', raceName: 'Name・Y', venue: '東京', courseType: '芝', distance: 1600, direction: '左', courseCondition: '良', pos1c: 1, finishPosition: 2, jockey: 'J', weight: 54, time: '1340', margin: '0.7', averagePosition: 3, lastThreeFurlong: '34.9', odds: 3.1, popularity: 2 } as any,
    ])
    const horses = JSON.parse(localStorage.getItem('horses') || '[]')
    const results = JSON.parse(localStorage.getItem('raceResults') || '[]')
    expect(horses.length).toBeGreaterThan(0)
    expect(results).toHaveLength(2)
  })

  it('getAvailableDates returns [] on non-OK', async () => {
    const spy = vi.fn(async () => ({ ok: false, status: 500 } as any))
    global.fetch = spy as any

    const res = await service.getAvailableDates()
    expect(res).toEqual([])
  })

  it('getAvailableDates returns array on OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ['2025-08-12'] }) as any) as any
    const res = await service.getAvailableDates()
    expect(res).toEqual(['2025-08-12'])
  })
})

describe('MockAdminService (localStorage-backed)', () => {
  const mock = new MockAdminService()

  beforeEach(() => {
    localStorage.clear()
  })

  it('insertRaceResults + getRaceResults filters by beforeDate and limit', async () => {
    // 3レース結果を保存（同一馬）
    const base: Omit<RaceResultData, 'id'> = {
      raceId: 'R', horseId: 'H1', date: '2024-01-01', raceName: 'Name', venue: '中山', courseType: '芝', distance: 1600, direction: '右', courseCondition: '良', pos1c: 1, finishPosition: 1, jockey: 'J', weight: 56, time: '1322', margin: '0.0', averagePosition: 2, lastThreeFurlong: '34.5', odds: 2.0, popularity: 1
    }
    await mock.insertRaceResults([
      { ...base, id: 'A', date: '2024-06-01' },
      { ...base, id: 'B', date: '2024-07-01' },
      { ...base, id: 'C', date: '2024-08-01' }
    ])

    const all = await mock.getRaceResults(undefined, 'H1')
    expect(all).toHaveLength(3)

    const before = await mock.getRaceResults(undefined, 'H1', undefined, '2024-07-15')
    expect(before).toHaveLength(2) // 6/1, 7/1のみ（7/15未満）

    const limited = await mock.getRaceResults(undefined, 'H1', 1, '2024-07-15')
    expect(limited).toHaveLength(1)
  })

  it('covers other mock methods (insert/update/get)', async () => {
    localStorage.clear()
    // insert horses
    await mock.insertHorses([
      { id: 'H1', name: 'N1', birthDate: '20200101', sex: '牡', color: '', father: '', mother: '', trainer: 'T1', owner: '', breeder: '', earnings: 0 },
      { id: 'H2', name: 'N2', birthDate: '20200101', sex: '牝', color: '', father: '', mother: '', trainer: 'T2', owner: '', breeder: '', earnings: 0 },
    ])
    // insert races
    await mock.insertRaces([
      { raceId: 'R202401010101', date: '20240101', venue: '東京', meetingNumber: 1, dayNumber: 1, raceNo: 1, raceName: '新馬', className: '新馬', surface: '芝', distance: 1600, direction: '左', trackCond: '良' },
      { raceId: 'R202401020101', date: '20240102', venue: '中山', meetingNumber: 1, dayNumber: 1, raceNo: 1, raceName: '未勝利', className: '未勝利', surface: 'ダート', distance: 1200, direction: '右', trackCond: '良' },
    ])
    // insert race entries
    await mock.insertRaceEntries([
      { id: 'E1', raceId: 'R202401010101', horseId: 'H1', frameNo: 1, horseNo: 1, age: 3, jockey: 'J', weight: 55, trainer: 'T1', affiliation: '美浦' },
    ])
    // insert race results
    await mock.insertRaceResults([
      { id: 'RR1', raceId: 'R202401010101', horseId: 'H1', date: '2024-01-01', raceName: '新馬', venue: '東京', courseType: '芝', distance: 1600, direction: '左', courseCondition: '良', pos1c: 1, finishPosition: 1, jockey: 'J', weight: 55, time: '1345', margin: '0.0', averagePosition: 1, lastThreeFurlong: '34.5', odds: 2.1, popularity: 1 }
    ])

    // updates
    await mock.updateRaceCushion('R202401010101', 9.9)
    await mock.updateRacePartial('R202401010101', { raceName: '新馬(更新)' })
    await mock.updateHorsePartial('H1', { trainer: 'T1-upd' })

    // getters
    const racesTokyo = await mock.getRaces('20240101', '東京')
    expect(racesTokyo).toHaveLength(1)
    const horses = await mock.getHorses()
    expect(horses).toHaveLength(2)
    const rr = await mock.getRaceResults('R202401010101')
    expect(rr).toHaveLength(1)
    const stats = await mock.getStats()
    expect(stats.horses).toBeGreaterThan(0)
    // venues + dates
    const venues = await mock.getVenueData('20240101')
    expect(venues).toEqual([])
    const dates = await mock.getAvailableDates()
    expect(Array.isArray(dates)).toBe(true)
  })

  it('factory createAdminService returns expected instances', () => {
    const a = createAdminService(true)
    const b = createAdminService(false)
    expect(typeof (a as any).getRaces).toBe('function')
    expect(typeof (b as any).getRaces).toBe('function')
    // 異なる実装（toString上のクラス名）をざっくり確認
    expect(a.constructor.name).toBe('AdminService')
    expect(b.constructor.name).toBe('MockAdminService')
  })
})
