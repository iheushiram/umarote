import { create } from 'zustand'

export type PrevRankItem = {
  rank: number
  horseId: string
  horseNo: number
  name: string
  avg: number // 前走時点の参加馬平均獲得賞金（万円/頭）
  raceId: string
  margin?: string
}

interface RaceUiStore {
  itemsPrev: PrevRankItem[]
  itemsPrev2: PrevRankItem[]
  mode: 'prev' | 'prev2'
  setItemsPrev: (items: PrevRankItem[]) => void
  setItemsPrev2: (items: PrevRankItem[]) => void
  setMode: (m: 'prev' | 'prev2') => void
  reset: () => void
}

export const useRaceUiStore = create<RaceUiStore>((set) => ({
  itemsPrev: [],
  itemsPrev2: [],
  mode: 'prev',
  setItemsPrev: (items) => set({ itemsPrev: items }),
  setItemsPrev2: (items) => set({ itemsPrev2: items }),
  setMode: (m) => set({ mode: m }),
  reset: () => set({ itemsPrev: [], itemsPrev2: [], mode: 'prev' })
}))
