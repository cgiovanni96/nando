import { virtualColor, type MantineColorsTuple, type MantineThemeOverride } from "@mantine/core";

/** Neutral brand ramp: shade 7 is the accent in light, shade 0 in dark. */
const nando: MantineColorsTuple = [
  "#ededed",
  "#f5f5f5",
  "#e5e5e5",
  "#d4d4d4",
  "#a3a3a3",
  "#737373",
  "#525252",
  "#262626",
  "#171717",
  "#0a0a0a",
];

/** Shared neutral chrome: light surfaces and muted text. */
const gray: MantineColorsTuple = [
  "#fafafa",
  "#f5f5f5",
  "#ededed",
  "#e5e5e5",
  "#d4d4d4",
  "#a3a3a3",
  "#666666",
  "#525252",
  "#404040",
  "#262626",
];

/** Dark scheme surfaces: shade 7 is the body, 6 the default surface, 4 the border. */
const dark: MantineColorsTuple = [
  "#ededed",
  "#d4d4d4",
  "#a6a6a6",
  "#737373",
  "#333333",
  "#2d2d2d",
  "#222222",
  "#181818",
  "#141414",
  "#0f0f0f",
];

/** Muted semantic red: shade 6 for light, shade 3 for dark. */
const danger: MantineColorsTuple = [
  "#fdf3f3",
  "#fbe4e4",
  "#f6cccc",
  "#f1a1a1",
  "#e07a7a",
  "#c95656",
  "#a53e3e",
  "#8f3333",
  "#762a2a",
  "#5f2222",
];

const fontFamily =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const fontFamilyMonospace =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/**
 * Virtual color so Mantine resolves `autoContrast` and the light variant per
 * color scheme. A plain palette with `primaryShade.dark = 0` would compute the
 * filled text color from the light shade and paint white on near-white.
 */
const primary = virtualColor({ name: "primary", light: "nando", dark: "nando" });

export const tokens: MantineThemeOverride = {
  primaryColor: "primary",
  primaryShade: { light: 7, dark: 0 },
  autoContrast: true,
  white: "#ffffff",
  black: "#000000",
  colors: { nando, primary, gray, dark, danger },
  fontFamily,
  fontFamilyMonospace,
  /**
   * `md` is 1024px, not Mantine's default 992px: the shell rail collapses at
   * 768 and the labelled sidebar returns at 1024, same as the NAS-62 mock.
   */
  breakpoints: {
    xs: "36em",
    sm: "48em",
    md: "64em",
    lg: "75em",
    xl: "88em",
  },
  fontSizes: {
    xs: "12px",
    sm: "13px",
    md: "14px",
    lg: "16px",
    xl: "20px",
  },
  lineHeights: {
    xs: "1.4",
    sm: "1.5",
    md: "1.6",
    lg: "1.6",
    xl: "1.6",
  },
  fontWeights: {
    regular: "400",
    medium: "500",
    bold: "600",
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
  defaultRadius: "sm",
  headings: {
    fontFamily,
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "28px", lineHeight: "1.3" },
      h2: { fontSize: "20px", lineHeight: "1.4" },
      h3: { fontSize: "16px", lineHeight: "1.5" },
      h4: { fontSize: "14px", lineHeight: "1.5" },
      h5: { fontSize: "13px", lineHeight: "1.5" },
      h6: { fontSize: "12px", lineHeight: "1.5" },
    },
  },
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    md: "0 8px 24px rgba(0, 0, 0, 0.08)",
    lg: "0 12px 40px rgba(0, 0, 0, 0.1)",
    xl: "0 24px 80px rgba(0, 0, 0, 0.12)",
  },
  cursorType: "pointer",
  respectReducedMotion: true,
  other: {
    sidebarWidth: 248,
    railWidth: 64,
    topbarHeight: 56,
    contentMax: 1440,
    /**
     * The only second typeface in the product: the brand monogram. Kept as a
     * theme token so it never reappears as a literal in a component; see
     * ADR-0023, "Token".
     */
    brandFontFamily: 'Georgia, "Times New Roman", serif',
  },
};
