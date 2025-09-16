import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRacesByDate, getRaceEntriesByDate, getHorses, getVenueData, getAvailableDates } from '../services/horseService'

const toUrl = (input: any) => new URL(String(input), 'http://test.local') // base for relative URLs

describe('horseService direct fetch helpers', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getRacesByDate calls /api/races?date=YYYYMMDD', async () => {
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races')
      expect(url.searchParams.get('date')).toBe('20250812')
      return { ok: true, json: async () => [{ raceId: 'RID' }] } as any
    })
    global.fetch = spy as any

    const res = await getRacesByDate('2025-08-12')
    expect(res).toEqual([{ raceId: 'RID' }])
  })

  it('getRaceEntriesByDate calls /api/races/entries/by-date/:date', async () => {
    const spy = vi.fn(async (input: any) => {
      const url = toUrl(input)
      expect(url.pathname).toBe('/api/races/entries/by-date/20250812')
      return { ok: true, json: async () => ({ RID: { entries: [], raceInfo: {} } }) } as any
    })
    global.fetch = spy as any

    const res = await getRaceEntriesByDate('2025-08-12')
    expect(res).toHaveProperty('RID')
  })

  it('getRacesByDate returns [] on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false })) as any
    const res = await getRacesByDate('2025-08-12')
    expect(res).toEqual([])
  })

  it('getRaceEntriesByDate returns {} on non-OK', async () => {
    global.fetch = vi.fn(async () => ({ ok: false })) as any
    const res = await getRaceEntriesByDate('2025-08-12')
    expect(res).toEqual({})
  })
})

describe('horseService higher-level helpers', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('getHorses maps AdminService results + race results to UI model (covers birth_date fallback)', async () => {
    global.fetch = vi.fn(async (input: any) => {
      const url = new URL(String(input), 'http://test.local')
      if (url.pathname === '/api/horses') {
        return { ok: true, json: async () => [
          { id: 'H1', name: 'A', birthDate: '20200101', sex: '牡', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 },
          { id: 'H2', name: 'B', birthDate: '20200101', sex: '牝', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 },
          // snake_case birth_date fallback branch
          { id: 'H3', name: 'C', birth_date: '20190101', sex: '牡', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 } as any
        ] } as any
      }
      if (url.pathname === '/api/race-results') {
        // return one result per horse
        const horseId = url.searchParams.get('horseId')
        return { ok: true, json: async () => (horseId ? [
          { id: 'R', raceId: 'RID', horseId, date: '2024-01-01', raceName: 'Name', venue: '中山', courseType: '芝', distance: 1600, direction: '右', courseCondition: '良', pos1c: 1, finishPosition: 3, jockey: 'J', weight: 56, time: '1322', margin: '0.2', averagePosition: 2, lastThreeFurlong: '34.5', odds: 3.4, popularity: 2 }
        ] : []) } as any
      }
      throw new Error('unexpected url: ' + url.pathname)
    }) as any

    const res = await getHorses()
    expect(res).toHaveLength(3)
    expect(res[0].results[0].raceName).toBe('Name')
  })

  it('getHorses falls back to [] on error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network') }) as any
    const res = await getHorses()
    expect(res).toEqual([])
  })

  it('getHorses handles per-horse results error (empty results for that horse)', async () => {
    global.fetch = vi.fn(async (input: any) => {
      const url = new URL(String(input), 'http://test.local')
      if (url.pathname === '/api/horses') {
        return { ok: true, json: async () => [
          { id: 'HOK', name: 'OK', birthDate: '20200101', sex: '牡', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 },
          { id: 'HBAD', name: 'BAD', birthDate: '20200101', sex: '牝', color: '', father: '', mother: '', trainer: '', owner: '', breeder: '', earnings: 0 }
        ] } as any
      }
      if (url.pathname === '/api/race-results') {
        const horseId = url.searchParams.get('horseId')
        if (horseId === 'HBAD') throw new Error('boom')
        return { ok: true, json: async () => [
          { id: 'R', raceId: 'RID', horseId, date: '2024-01-01', raceName: 'Name', venue: '中山', courseType: '芝', distance: 1600, direction: '右', courseCondition: '良', pos1c: 1, finishPosition: 3, jockey: 'J', weight: 56, time: '1322', margin: '0.2', averagePosition: 2, lastThreeFurlong: '34.5', odds: 3.4, popularity: 2 }
        ] } as any
      }
      throw new Error('unexpected')
    }) as any

    const res = await getHorses()
    const ok = res.find(h => h.id === 'HOK')!
    const bad = res.find(h => h.id === 'HBAD')!
    expect(ok.results).toHaveLength(1)
    expect(bad.results).toHaveLength(0)
  })

  it('getVenueData proxies to AdminService and returns [] on error', async () => {
    // OK path
    global.fetch = vi.fn(async (input: any) => {
      const url = new URL(String(input), 'http://test.local')
      if (url.pathname === '/api/venues') return { ok: true, json: async () => [{ venue: '東京' }] } as any
      throw new Error('unexpected')
    }) as any
    const ok = await getVenueData('2025-01-01')
    expect(ok).toEqual([{ venue: '東京' }])

    // error path
    global.fetch = vi.fn(async () => { throw new Error('boom') }) as any
    const ng = await getVenueData('2025-01-02')
    expect(ng).toEqual([])
  })

  it('getAvailableDates proxies to AdminService', async () => {
    global.fetch = vi.fn(async (input: any) => {
      const url = new URL(String(input), 'http://test.local')
      if (url.pathname === '/api/venues/dates') return { ok: true, json: async () => ['2025-08-12'] } as any
      throw new Error('unexpected')
    }) as any
    const res = await getAvailableDates()
    expect(res).toEqual(['2025-08-12'])
  })
})

describe('horseService module-level catch branches via module mocks', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('convertToHorseWithResults catch block (AdminService.getRaceResults throws)', async () => {
    vi.resetModules()

    const adminModule = await import('../services/adminService')
    const horsesMock = vi
      .spyOn(adminModule.AdminService.prototype, 'getHorses')
      .mockResolvedValue([
        {
          id: 'HX',
          name: 'X',
          birthDate: '20200101',
          sex: '牡',
          color: '',
          father: '',
          mother: '',
          trainer: '',
          owner: '',
          breeder: '',
          earnings: 0
        }
      ])
    const raceResultsMock = vi
      .spyOn(adminModule.AdminService.prototype, 'getRaceResults')
      .mockRejectedValue(new Error('boom'))

    const mod = await import('../services/horseService')
    const res = await mod.getHorses()

    expect(res).toHaveLength(1)
    expect(res[0].results).toEqual([])

    horsesMock.mockRestore()
    raceResultsMock.mockRestore()
  })

  it('getAvailableDates catch block when AdminService throws', async () => {
    vi.doMock('../services/adminService', () => {
      return {
        AdminService: class {
          async getAvailableDates() { throw new Error('boom') }
          async getHorses() { return [] }
          async getVenueData() { return [] }
          async getRaceResults() { return [] }
        }
      }
    })
    const mod = await import('../services/horseService')
    const res = await mod.getAvailableDates()
    expect(res).toEqual([])
  })
})
