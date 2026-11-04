import { Platform } from "react-native";

// Bloomberg-terminal inspired look: monospace type, square corners, amber
// labels, white values, green/red P&L. Dark is the classic terminal (Pro only);
// light is a paper-white variant that keeps the black/amber header strip.

export const TERMINAL_FONT = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "Menlo, Consolas, 'Courier New', monospace",
}) as string;

export type TerminalPalette = {
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  amber: string;
  header: string;
  headerText: string;
  blue: string;
  green: string;
  red: string;
  yellow: string;
  overlay: string;
};

export const TERMINAL_DARK: TerminalPalette = {
  bg: "#000000",
  panel: "#0a0a0a",
  panelAlt: "#161616",
  border: "#2a2a2a",
  borderStrong: "#4d4d4d",
  text: "#f2f2f2",
  textDim: "#9a9a9a",
  amber: "#ff9e1b",
  header: "#ff9e1b",
  headerText: "#000000",
  blue: "#2f7bff",
  green: "#25d07d",
  red: "#ff4b4b",
  yellow: "#ffd400",
  overlay: "rgba(0,0,0,0.88)",
};

export const TERMINAL_LIGHT: TerminalPalette = {
  bg: "#f7f6f2",
  panel: "#ffffff",
  panelAlt: "#ecebe5",
  border: "#d4d2c9",
  borderStrong: "#8f8c82",
  text: "#111111",
  textDim: "#5e5c55",
  amber: "#c25f00",
  header: "#111111",
  headerText: "#ff9e1b",
  blue: "#0b57d0",
  green: "#0a8a4a",
  red: "#d12a22",
  yellow: "#9a7400",
  overlay: "rgba(247,246,242,0.92)",
};

export const getTerminalPalette = (darkMode: boolean | undefined): TerminalPalette =>
  darkMode ? TERMINAL_DARK : TERMINAL_LIGHT;
