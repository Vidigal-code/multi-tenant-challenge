import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
}

const initialState: ThemeState = {
  theme: 'light',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', action.payload);
        const root = document.documentElement;
        if (action.payload === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    },
    toggleTheme(state) {
      if (typeof window === 'undefined') {
        return;
      }
      const root = document.documentElement;
      const isCurrentlyDark = root.classList.contains('dark');
      const currentTheme = isCurrentlyDark ? 'dark' : 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      
      state.theme = newTheme;
      localStorage.setItem('theme', newTheme);
      
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    },
    initializeTheme(state) {
      if (typeof window === 'undefined') {
        return;
      }
      
      const root = document.documentElement;
      const isDarkInDOM = root.classList.contains('dark');
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      
      let initialTheme: Theme;
      
      if (isDarkInDOM) {
        initialTheme = 'dark';
      } else if (savedTheme === 'light' || savedTheme === 'dark') {
        initialTheme = savedTheme;
        if (initialTheme === 'dark' && !isDarkInDOM) {
          root.classList.add('dark');
        } else if (initialTheme === 'light' && isDarkInDOM) {
          root.classList.remove('dark');
        }
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        initialTheme = prefersDark ? 'dark' : 'light';
        if (initialTheme === 'dark' && !isDarkInDOM) {
          root.classList.add('dark');
        } else if (initialTheme === 'light' && isDarkInDOM) {
          root.classList.remove('dark');
        }
      }
      
      state.theme = initialTheme;
    },
  },
});

export const { setTheme, toggleTheme, initializeTheme } = themeSlice.actions;
export default themeSlice.reducer;

