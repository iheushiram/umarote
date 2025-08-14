import { create } from 'zustand';
import { HorseWithResults } from '../types/horse';

interface HorseStore {
  selectedHorse: HorseWithResults | null;
  horses: HorseWithResults[];
  setSelectedHorse: (horse: HorseWithResults | null) => void;
  setHorses: (horses: HorseWithResults[]) => void;
  addHorse: (horse: HorseWithResults) => void;
}

export const useHorseStore = create<HorseStore>((set) => ({
  selectedHorse: null,
  horses: [],
  setSelectedHorse: (horse) => set({ selectedHorse: horse }),
  setHorses: (horses) => set({ horses }),
  addHorse: (horse) => set((state) => ({ horses: [...state.horses, horse] })),
})); 