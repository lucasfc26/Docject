import { create } from "zustand";

type Theme = "light" | "dark";

type ThemeStore = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
};

const savedTheme = typeof localStorage !== "undefined" ? (localStorage.getItem("projectfy-theme") as Theme | null) : null;

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: savedTheme ?? "light",
  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === "light" ? "dark" : "light";
      localStorage.setItem("projectfy-theme", theme);
      return { theme };
    }),
  setTheme: (theme) => {
    localStorage.setItem("projectfy-theme", theme);
    set({ theme });
  }
}));
