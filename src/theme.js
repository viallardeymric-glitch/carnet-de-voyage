import { useColorScheme } from 'react-native';

const palette = {
  navy: '#002B49',
  cyan: '#00A3E0',
  light: '#F4F6F8',
  ink: '#212529',
  success: '#2E9E6A',
  warning: '#E8A317',
  danger: '#D64545',
  pink: '#E2508C',
};

export const lightTheme = {
  dark: false,
  ...palette,
  bg: palette.light,
  card: '#FFFFFF',
  text: palette.ink,
  muted: '#6B7480',
  border: '#E1E5EA',
  primary: palette.navy,
  accent: palette.cyan,
  header: palette.navy,
  headerText: '#FFFFFF',
};

export const darkTheme = {
  dark: true,
  ...palette,
  bg: '#0B1520',
  card: '#13212F',
  text: '#E9EEF3',
  muted: '#93A1B0',
  border: '#24384B',
  primary: '#4FC3F7',
  accent: palette.cyan,
  header: '#001A2C',
  headerText: '#FFFFFF',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
