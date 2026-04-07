export const COLOR_OPTIONS = [
  { value: "green", label: "Vert" },
  { value: "blue", label: "Bleu" },
  { value: "red", label: "Rouge" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Violet" },
];

export const COLOR_PRESETS = {
  green: {
    primary: "0 46 49",
    secondary: "29 71 63",
    accent: "216 242 116",
    header: "169 189 182",
    darkBackground: "19 22 23",
    darkSurface: "26 30 31",
    darkBorder: "76 84 85",
    success: "22 163 74",
    warning: "217 119 6",
    danger: "220 38 38",
  },
  blue: {
    primary: "30 64 175",
    secondary: "37 99 235",
    accent: "191 219 254",
    header: "147 197 253",
    darkBackground: "20 23 28",
    darkSurface: "28 32 38",
    darkBorder: "82 92 108",
    success: "5 150 105",
    warning: "217 119 6",
    danger: "220 38 38",
  },
  red: {
    primary: "153 27 27",
    secondary: "220 38 38",
    accent: "254 202 202",
    header: "252 165 165",
    darkBackground: "24 20 21",
    darkSurface: "32 26 27",
    darkBorder: "96 80 82",
    success: "22 163 74",
    warning: "234 88 12",
    danger: "185 28 28",
  },
  orange: {
    primary: "154 52 18",
    secondary: "234 88 12",
    accent: "254 215 170",
    header: "253 186 116",
    darkBackground: "25 22 19",
    darkSurface: "33 29 25",
    darkBorder: "101 90 79",
    success: "22 163 74",
    warning: "234 88 12",
    danger: "220 38 38",
  },
  purple: {
    primary: "91 33 182",
    secondary: "124 58 237",
    accent: "221 214 254",
    header: "196 181 253",
    darkBackground: "22 20 28",
    darkSurface: "29 27 37",
    darkBorder: "88 84 104",
    success: "5 150 105",
    warning: "217 119 6",
    danger: "220 38 38",
  },
};

export const DEFAULT_APPEARANCE = {
  theme: "light",
  primaryColor: "orange",
  secondaryColor: "orange",
  accentColor: "orange",
};

const toRgb = (value) => `rgb(${value})`;

export const normalizeColorChoice = (value, fallback = "green") =>
  COLOR_PRESETS[value] ? value : fallback;

export const resolveAppearance = (appearance = {}) => {
  const primaryColor = normalizeColorChoice(
    appearance.primaryColor,
    DEFAULT_APPEARANCE.primaryColor,
  );
  const secondaryColor = normalizeColorChoice(
    appearance.secondaryColor,
    DEFAULT_APPEARANCE.secondaryColor,
  );
  const accentColor = normalizeColorChoice(
    appearance.accentColor,
    DEFAULT_APPEARANCE.accentColor,
  );
  const theme = appearance.theme === "dark" ? "dark" : "light";

  const primary = COLOR_PRESETS[primaryColor];
  const secondary = COLOR_PRESETS[secondaryColor];
  const accent = COLOR_PRESETS[accentColor];

  return {
    theme,
    primaryColor,
    secondaryColor,
    accentColor,
    background: theme === "dark" ? toRgb(primary.darkBackground) : "#FFFFFF",
    surface: theme === "dark" ? toRgb(primary.darkSurface) : "#FFFFFF",
    border:
      theme === "dark"
        ? "rgba(255,255,255,0.08)"
        : "rgba(243,244,246,0.5)",
    card: theme === "dark" ? toRgb(primary.darkSurface) : "#FFFDFB",
    softCard: theme === "dark" ? "rgba(255,255,255,0.04)" : "#FFF1E8",
    mutedSurface: theme === "dark" ? "rgba(255,255,255,0.06)" : "#FFF8F3",
    tabBar: theme === "dark" ? toRgb(primary.primary) : toRgb(primary.primary),
    tabBarActive: "#FFFFFF",
    tabBarInactive: theme === "dark" ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.72)",
    mapPanel: theme === "dark" ? "#121212" : "#171717",
    header: toRgb(secondary.header),
    textPrimary: theme === "dark" ? "#F7FAFA" : "#0E1718",
    textSecondary: theme === "dark" ? "#B7C5C4" : "#7E6F68",
    primaryValue: toRgb(primary.primary),
    secondaryValue: toRgb(secondary.secondary),
    accentValue: toRgb(accent.accent),
    success: toRgb(secondary.success),
    warning: toRgb(secondary.warning),
    danger: toRgb(secondary.danger),
    overlay: theme === "dark" ? "rgba(0,0,0,0.35)" : "rgba(15,23,42,0.08)",
  };
};
