export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "uca-theme";
export const DEFAULT_THEME: Theme = "dark";

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : DEFAULT_THEME;
}
