import { createTheme, type MantineColorsTuple } from "@mantine/core";

const nando: MantineColorsTuple = [
  "#f5f5f5",
  "#e5e5e5",
  "#d4d4d4",
  "#a3a3a3",
  "#737373",
  "#525252",
  "#404040",
  "#262626",
  "#171717",
  "#0a0a0a",
];

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const theme = createTheme({
  primaryColor: "nando",
  primaryShade: { light: 7, dark: 0 },
  colors: { nando },
  fontFamily,
  fontSizes: {
    xs: "12px",
    sm: "13px",
    md: "14px",
    lg: "16px",
    xl: "20px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
  },
  radius: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "8px",
    xl: "12px",
  },
  defaultRadius: "md",
  headings: {
    fontFamily,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "28px", lineHeight: "1.3" },
      h2: { fontSize: "20px", lineHeight: "1.4" },
      h3: { fontSize: "16px", lineHeight: "1.5" },
    },
  },
  other: {
    sidebarWidth: 248,
    railWidth: 64,
    topbarHeight: 56,
  },
});
