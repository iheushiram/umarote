import { create } from 'zustand'

interface HorseFocusState {
  focusedHorseId: string | null
  focus: (horseId: string) => void
  clear: () => void
}

export const useHorseFocusStore = create<HorseFocusState>((set) => ({
  focusedHorseId: null,
  focus: (horseId) => set((state) => ({
    focusedHorseId: horseId,
  })),
  clear: () => set({ focusedHorseId: null }),
}))
