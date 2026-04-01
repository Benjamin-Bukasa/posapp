import { create } from "zustand";

const useUiStore = create((set) => ({
  isSidebarOpen: true,
  isMobileSidebarOpen: false,
  isMobileCartOpen: false,
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: Boolean(isOpen) }),
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
  toggleMobileSidebar: () =>
    set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
  openMobileCart: () => set({ isMobileCartOpen: true }),
  closeMobileCart: () => set({ isMobileCartOpen: false }),
  toggleMobileCart: () =>
    set((state) => ({ isMobileCartOpen: !state.isMobileCartOpen })),
}));

export default useUiStore;
