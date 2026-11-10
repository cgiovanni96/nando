import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Menu,
  Modal,
  NavLink,
  Paper,
  Progress,
  Switch,
  Table,
  Tabs,
  Tooltip,
} from "@mantine/core";

export const componentDefaults = {
  ActionIcon: ActionIcon.extend({
    defaultProps: {
      variant: "subtle",
      color: "gray",
      size: "lg",
    },
  }),
  Alert: Alert.extend({
    defaultProps: {
      variant: "light",
      radius: "sm",
    },
  }),
  Anchor: Anchor.extend({
    defaultProps: {
      underline: "hover",
    },
  }),
  Badge: Badge.extend({
    defaultProps: {
      variant: "light",
      color: "gray",
      size: "sm",
      radius: "xs",
    },
  }),
  Button: Button.extend({
    defaultProps: {
      variant: "default",
      size: "sm",
    },
  }),
  Card: Card.extend({
    defaultProps: {
      withBorder: true,
      shadow: "none",
      padding: "lg",
      radius: "md",
    },
  }),
  Checkbox: Checkbox.extend({
    defaultProps: {
      size: "sm",
      radius: "xs",
    },
  }),
  Menu: Menu.extend({
    defaultProps: {
      shadow: "md",
      radius: "sm",
      withArrow: true,
    },
  }),
  Modal: Modal.extend({
    defaultProps: {
      radius: "xl",
      padding: "xl",
      centered: true,
    },
  }),
  NavLink: NavLink.extend({
    vars: () => ({
      root: {
        "--nl-bg": "var(--nando-tint)",
        "--nl-hover": "var(--nando-soft)",
        "--nl-color": "var(--mantine-primary-color-filled)",
      },
      children: {},
    }),
  }),
  Paper: Paper.extend({
    defaultProps: {
      withBorder: true,
      radius: "md",
    },
  }),
  Progress: Progress.extend({
    defaultProps: {
      size: "xs",
      radius: "xl",
    },
  }),
  Switch: Switch.extend({
    defaultProps: {
      size: "sm",
    },
  }),
  Table: Table.extend({
    defaultProps: {
      horizontalSpacing: "md",
      verticalSpacing: "md",
      highlightOnHover: true,
      tabularNums: true,
    },
  }),
  Tabs: Tabs.extend({
    defaultProps: {
      radius: "sm",
    },
  }),
  Tooltip: Tooltip.extend({
    defaultProps: {
      withArrow: true,
      openDelay: 200,
      radius: "sm",
    },
  }),
};
