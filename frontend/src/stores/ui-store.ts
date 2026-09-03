import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name?: string;
  merchants: any[];
}

interface UIState {
  // Auth state
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;

  // UI state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  selectedMerchantId: string | null;
  setSelectedMerchantId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Auth state
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),

      // UI state
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      onboardingStep: 1,
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      selectedMerchantId: null,
      setSelectedMerchantId: (id) => set({ selectedMerchantId: id }),
    }),
    {
      name: 'agentic-commerce-auth',
      partialize: (state) => ({ user: state.user }), // only persist user
    }
  )
);
