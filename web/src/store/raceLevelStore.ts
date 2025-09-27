import { create } from 'zustand'

export type RaceLevelRankItem = {
  rank: number
  horseId: string
  horseNo: number
  name: string
  avgPlace: number | null // 小数1桁丸め済み。nullは算出不可
  avgMargin: number | null // 平均着差（馬身換算、小数2桁想定）
  used: number            // 平均に使用した同走馬の頭数（着順用）
  total: number           // 元の同走馬の総数（対象馬を除く）
  marginUsed: number      // 平均着差算出に使用した同走馬数
  prevRaceId: string
}

interface RaceLevelStore {
  items: RaceLevelRankItem[]
  setItems: (items: RaceLevelRankItem[]) => void
  reset: () => void
}

export const useRaceLevelStore = create<RaceLevelStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  reset: () => set({ items: [] })
}))
