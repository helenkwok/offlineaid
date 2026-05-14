/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { create } from 'zustand';

export interface MapPointSelection {
  id: string;
  title: string;
  subtitle?: string;
  lat: number;
  lon: number;
  category?: string;
}

export interface ActiveMapSelection {
  title: string;
  query: string;
  summary: string;
  points: MapPointSelection[];
}

interface MapState {
  activeSelection: ActiveMapSelection | null;
  setActiveSelection: (selection: ActiveMapSelection) => void;
  clearActiveSelection: () => void;
}

export const useMapStore = create<MapState>()((set) => ({
  activeSelection: null,
  setActiveSelection: (selection) => set({ activeSelection: selection }),
  clearActiveSelection: () => set({ activeSelection: null }),
}));
