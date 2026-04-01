export const COLOR_OPTIONS = [
  { value: "green", label: "Vert" },
  { value: "blue", label: "Bleu" },
  { value: "red", label: "Rouge" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" },
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
  primaryColor: "green",
  secondaryColor: "green",
  accentColor: "green",
};

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

  return {
    theme: appearance.theme === "dark" ? "dark" : "light",
    primaryColor,
    secondaryColor,
    accentColor,
    primary: COLOR_PRESETS[primaryColor],
    secondary: COLOR_PRESETS[secondaryColor],
    accent: COLOR_PRESETS[accentColor],
  };
};

export const applyAppearance = (appearance = {}) => {
  if (typeof document === "undefined") return resolveAppearance(appearance);

  const root = document.documentElement;
  const resolved = resolveAppearance(appearance);
  root.classList.toggle("dark", resolved.theme === "dark");
  root.style.setProperty("--primary", resolved.primary.primary);
  root.style.setProperty("--secondary", resolved.secondary.secondary);
  root.style.setProperty("--accent", resolved.accent.accent);
  root.style.setProperty("--header", resolved.secondary.header);
  root.style.setProperty("--dark-background", resolved.primary.darkBackground);
  root.style.setProperty("--dark-surface", resolved.primary.darkSurface);
  root.style.setProperty("--dark-border", resolved.primary.darkBorder);
  root.style.setProperty("--success", resolved.secondary.success);
  root.style.setProperty("--warning", resolved.secondary.warning);
  root.style.setProperty("--danger", resolved.secondary.danger);
  return resolved;
};
