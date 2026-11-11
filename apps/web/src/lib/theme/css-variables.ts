import type { CSSVariablesResolver } from "@mantine/core";

/**
 * Maps Mantine semantic variables onto the neutral Nando ramps and exposes the
 * layout values from `theme.other` to CSS.
 *
 * `primaryShade.dark` is 0, so Mantine inverts every palette in dark mode, not
 * only the primary one. The `gray` and `danger` dynamic variables are restored
 * explicitly to keep them muted.
 */
export const cssVariablesResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    "--nando-sidebar-width": `${theme.other.sidebarWidth}px`,
    "--nando-rail-width": `${theme.other.railWidth}px`,
    "--nando-topbar-height": `${theme.other.topbarHeight}px`,
    "--nando-content-max": `${theme.other.contentMax}px`,
    "--nando-font-brand": `${theme.other.brandFontFamily}`,
  },
  light: {
    "--mantine-color-text": "var(--mantine-color-gray-9)",
    "--mantine-color-default-color": "var(--mantine-color-gray-9)",
    "--mantine-color-default-hover": "var(--mantine-color-gray-1)",
    "--mantine-color-default-border": "var(--mantine-color-gray-3)",
    "--mantine-color-dimmed": "var(--mantine-color-gray-6)",
    "--mantine-color-placeholder": "var(--mantine-color-gray-6)",
    "--mantine-color-anchor": "var(--mantine-color-nando-7)",
    "--mantine-color-error": "var(--mantine-color-danger-6)",
    "--mantine-color-gray-light": "var(--mantine-color-gray-1)",
    "--mantine-color-gray-light-hover": "var(--mantine-color-gray-2)",
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-6)",
    "--nando-side": "var(--mantine-color-gray-0)",
    "--nando-soft": "var(--mantine-color-gray-1)",
    "--nando-tint": "var(--mantine-color-gray-2)",
    "--nando-on": "var(--mantine-color-white)",
    "--nando-danger": "var(--mantine-color-danger-6)",
  },
  dark: {
    "--mantine-color-text": "var(--mantine-color-dark-0)",
    "--mantine-color-default-color": "var(--mantine-color-dark-0)",
    "--mantine-color-default-hover": "var(--mantine-color-dark-5)",
    "--mantine-color-default-border": "var(--mantine-color-dark-4)",
    "--mantine-color-dimmed": "var(--mantine-color-dark-2)",
    "--mantine-color-placeholder": "var(--mantine-color-dark-2)",
    "--mantine-color-anchor": "var(--mantine-color-nando-0)",
    "--mantine-color-error": "var(--mantine-color-danger-3)",
    "--mantine-color-gray-light": "var(--mantine-color-dark-6)",
    "--mantine-color-gray-light-hover": "var(--mantine-color-dark-5)",
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-5)",
    "--mantine-color-gray-outline": "var(--mantine-color-gray-5)",
    "--mantine-color-gray-text": "var(--mantine-color-gray-5)",
    "--mantine-color-nando-light": "var(--mantine-color-dark-6)",
    "--mantine-color-nando-light-hover": "var(--mantine-color-dark-5)",
    "--mantine-color-nando-light-color": "var(--mantine-color-nando-0)",
    "--mantine-color-primary-light": "var(--mantine-color-dark-6)",
    "--mantine-color-primary-light-hover": "var(--mantine-color-dark-5)",
    "--mantine-color-primary-light-color": "var(--mantine-color-nando-0)",
    "--mantine-color-danger-filled": "var(--mantine-color-danger-6)",
    "--mantine-color-danger-filled-hover": "var(--mantine-color-danger-7)",
    "--mantine-color-danger-light": "rgba(165, 62, 62, 0.16)",
    "--mantine-color-danger-light-hover": "rgba(165, 62, 62, 0.24)",
    "--mantine-color-danger-light-color": "var(--mantine-color-danger-3)",
    "--mantine-color-danger-outline": "var(--mantine-color-danger-3)",
    "--mantine-color-danger-outline-hover": "rgba(241, 161, 161, 0.08)",
    "--mantine-color-danger-text": "var(--mantine-color-danger-3)",
    "--nando-side": "var(--mantine-color-dark-8)",
    "--nando-soft": "var(--mantine-color-dark-6)",
    "--nando-tint": "var(--mantine-color-dark-5)",
    "--nando-on": "var(--mantine-color-dark-7)",
    "--nando-danger": "var(--mantine-color-danger-3)",
  },
});
