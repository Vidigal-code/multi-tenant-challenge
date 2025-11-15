import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  if (savedTheme) {
    return savedTheme;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

const initialState: ThemeState = {
  theme: getInitialTheme(),
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
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      state.theme = newTheme;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme);
        const root = document.documentElement;
        if (newTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    },
    initializeTheme(state) {
      const initialTheme = getInitialTheme();
      state.theme = initialTheme;
      if (typeof window !== 'undefined') {
        const root = document.documentElement;
        if (initialTheme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    },
  },
});

export const { setTheme, toggleTheme, initializeTheme } = themeSlice.actions;
export default themeSlice.reducer;

