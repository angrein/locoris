import { readPersistentString, writePersistentString } from "./persistentClientStorage";

export type AppAccentThemeId =
  | "classic"
  | "graphite"
  | "nocturne"
  | "verdant"
  | "ember"
  | "aster";

export type AppAccentThemePreviewRole =
  | "background"
  | "surface"
  | "emphasis"
  | "primary"
  | "secondary"
  | "warm";

type AppAccentThemePreviewSwatch = {
  role: AppAccentThemePreviewRole;
  color: string;
};

type AppAccentTheme = {
  id: AppAccentThemeId;
  labelKey: string;
  preview: AppAccentThemePreviewSwatch[];
  cssVars: Record<string, string>;
};

export const APP_ACCENT_THEME_STORAGE_KEY = "zen-notes.appAccentThemeId";
export const DEFAULT_APP_ACCENT_THEME_ID: AppAccentThemeId = "classic";

const makeThemePreview = (
  colors: Record<AppAccentThemePreviewRole, string>
): AppAccentThemePreviewSwatch[] => [
  { role: "background", color: colors.background },
  { role: "surface", color: colors.surface },
  { role: "emphasis", color: colors.emphasis },
  { role: "primary", color: colors.primary },
  { role: "secondary", color: colors.secondary },
  { role: "warm", color: colors.warm }
];

export const APP_ACCENT_THEMES: AppAccentTheme[] = [
  {
    id: "classic",
    labelKey: "settings.accentThemeClassic",
    preview: makeThemePreview({
      background: "#161338",
      surface: "#261f56",
      emphasis: "#ffe6a3",
      primary: "#73f7ff",
      secondary: "#d189ff",
      warm: "#ffe08a"
    }),
    cssVars: {
      "--accent-theme-primary": "#73f7ff",
      "--accent-theme-secondary": "#d189ff",
      "--accent-theme-tertiary": "#ffe08a",
      "--accent-primary": "#73f7ff",
      "--accent-secondary": "#d189ff",
      "--accent-warm": "#ffe08a",
      "--focus-ring": "#73f7ff",
      "--bg": "#161338",
      "--bg-deep": "#0d0a24",
      "--panel": "rgba(26, 21, 64, 0.88)",
      "--panel-strong": "rgba(38, 31, 86, 0.94)",
      "--line": "rgba(147, 173, 255, 0.22)",
      "--line-strong": "rgba(149, 179, 255, 0.34)",
      "--surface-rgb": "26 21 64",
      "--surface-strong-rgb": "38 31 86",
      "--surface-deep-rgb": "9 10 28",
      "--line-rgb": "147 173 255",
      "--line-strong-rgb": "149 179 255",
      "--surface-glow-rgb": "115 247 255",
      "--gold-rgb": "255 224 138",
      "--orange-rgb": "255 164 92",
      "--red-rgb": "255 103 140",
      "--cyan-rgb": "115 247 255",
      "--green-rgb": "102 240 164",
      "--violet-rgb": "209 137 255",
      "--blue-rgb": "92 162 255",
      "--text-heading": "#ffe6a3",
      "--text-emphasis": "#ffe08a",
      "--text-primary": "#f7f2ff",
      "--text-secondary": "#ddd5f4",
      "--text-muted": "#b7b0d8",
      "--text-faint": "#7d749d",
      "--text": "#f7f2ff",
      "--text-dim": "#b7b0d8",
      "--gold": "#ffe08a",
      "--orange": "#ffa45c",
      "--red": "#ff678c",
      "--cyan": "#73f7ff",
      "--green": "#66f0a4",
      "--violet": "#d189ff",
      "--blue": "#5ca2ff"
    }
  },
  {
    id: "graphite",
    labelKey: "settings.accentThemeGraphite",
    preview: makeThemePreview({
      background: "#101113",
      surface: "#23262d",
      emphasis: "#f6d58f",
      primary: "#e7ecf2",
      secondary: "#8792a3",
      warm: "#f0b95e"
    }),
    cssVars: {
      "--accent-theme-primary": "#e7ecf2",
      "--accent-theme-secondary": "#8792a3",
      "--accent-theme-tertiary": "#f0b95e",
      "--accent-primary": "#e7ecf2",
      "--accent-secondary": "#8792a3",
      "--accent-warm": "#f0b95e",
      "--focus-ring": "#e7ecf2",
      "--bg": "#101113",
      "--bg-deep": "#060708",
      "--panel": "rgba(24, 26, 31, 0.9)",
      "--panel-strong": "rgba(35, 38, 45, 0.95)",
      "--line": "rgba(135, 146, 163, 0.24)",
      "--line-strong": "rgba(231, 236, 242, 0.34)",
      "--surface-rgb": "24 26 31",
      "--surface-strong-rgb": "35 38 45",
      "--surface-deep-rgb": "6 7 8",
      "--line-rgb": "135 146 163",
      "--line-strong-rgb": "231 236 242",
      "--surface-glow-rgb": "231 236 242",
      "--gold-rgb": "240 185 94",
      "--orange-rgb": "203 140 82",
      "--red-rgb": "238 99 122",
      "--cyan-rgb": "166 214 220",
      "--green-rgb": "134 198 155",
      "--violet-rgb": "170 164 186",
      "--blue-rgb": "142 166 204",
      "--text-heading": "#f6d58f",
      "--text-emphasis": "#f0b95e",
      "--text-primary": "#eef1f5",
      "--text-secondary": "#ccd2dc",
      "--text-muted": "#a7afbc",
      "--text-faint": "#747c89",
      "--text": "#eef1f5",
      "--text-dim": "#a7afbc",
      "--gold": "#f0b95e",
      "--orange": "#cb8c52",
      "--red": "#ee637a",
      "--cyan": "#a6d6dc",
      "--green": "#86c69b",
      "--violet": "#aaa4ba",
      "--blue": "#8ea6cc"
    }
  },
  {
    id: "nocturne",
    labelKey: "settings.accentThemeNocturne",
    preview: makeThemePreview({
      background: "#081321",
      surface: "#163150",
      emphasis: "#ffd6b0",
      primary: "#78b8ff",
      secondary: "#a7a4ff",
      warm: "#ffb784"
    }),
    cssVars: {
      "--accent-theme-primary": "#78b8ff",
      "--accent-theme-secondary": "#a7a4ff",
      "--accent-theme-tertiary": "#ffb784",
      "--accent-primary": "#78b8ff",
      "--accent-secondary": "#a7a4ff",
      "--accent-warm": "#ffb784",
      "--focus-ring": "#78b8ff",
      "--bg": "#081321",
      "--bg-deep": "#030813",
      "--panel": "rgba(13, 33, 56, 0.9)",
      "--panel-strong": "rgba(22, 49, 80, 0.95)",
      "--line": "rgba(89, 141, 210, 0.25)",
      "--line-strong": "rgba(167, 216, 255, 0.36)",
      "--surface-rgb": "13 33 56",
      "--surface-strong-rgb": "22 49 80",
      "--surface-deep-rgb": "3 8 19",
      "--line-rgb": "89 141 210",
      "--line-strong-rgb": "167 216 255",
      "--surface-glow-rgb": "120 184 255",
      "--gold-rgb": "255 183 132",
      "--orange-rgb": "221 148 82",
      "--red-rgb": "240 121 141",
      "--cyan-rgb": "120 184 255",
      "--green-rgb": "141 230 183",
      "--violet-rgb": "167 164 255",
      "--blue-rgb": "100 155 244",
      "--text-heading": "#ffd6b0",
      "--text-emphasis": "#ffb784",
      "--text-primary": "#eef6ff",
      "--text-secondary": "#cfdef1",
      "--text-muted": "#9fb4cc",
      "--text-faint": "#667d99",
      "--text": "#eef6ff",
      "--text-dim": "#9fb4cc",
      "--gold": "#ffb784",
      "--orange": "#dd9452",
      "--red": "#f0798d",
      "--cyan": "#78b8ff",
      "--green": "#8de6b7",
      "--violet": "#a7a4ff",
      "--blue": "#649bf4"
    }
  },
  {
    id: "verdant",
    labelKey: "settings.accentThemeVerdant",
    preview: makeThemePreview({
      background: "#0b2119",
      surface: "#183d2f",
      emphasis: "#f2d7ff",
      primary: "#57ddb5",
      secondary: "#a7ef93",
      warm: "#dfadff"
    }),
    cssVars: {
      "--accent-theme-primary": "#57ddb5",
      "--accent-theme-secondary": "#a7ef93",
      "--accent-theme-tertiary": "#dfadff",
      "--accent-primary": "#57ddb5",
      "--accent-secondary": "#a7ef93",
      "--accent-warm": "#dfadff",
      "--focus-ring": "#57ddb5",
      "--bg": "#0b2119",
      "--bg-deep": "#04100b",
      "--panel": "rgba(16, 43, 33, 0.9)",
      "--panel-strong": "rgba(24, 61, 47, 0.95)",
      "--line": "rgba(96, 210, 168, 0.24)",
      "--line-strong": "rgba(152, 238, 193, 0.36)",
      "--surface-rgb": "16 43 33",
      "--surface-strong-rgb": "24 61 47",
      "--surface-deep-rgb": "4 16 11",
      "--line-rgb": "96 210 168",
      "--line-strong-rgb": "152 238 193",
      "--surface-glow-rgb": "87 221 181",
      "--gold-rgb": "223 173 255",
      "--orange-rgb": "213 143 83",
      "--red-rgb": "241 103 116",
      "--cyan-rgb": "87 221 181",
      "--green-rgb": "167 239 147",
      "--violet-rgb": "160 176 221",
      "--blue-rgb": "93 166 220",
      "--text-heading": "#f2d7ff",
      "--text-emphasis": "#dfadff",
      "--text-primary": "#eef5e7",
      "--text-secondary": "#cfdfd3",
      "--text-muted": "#a6cabd",
      "--text-faint": "#638577",
      "--text": "#eef5e7",
      "--text-dim": "#a6cabd",
      "--gold": "#dfadff",
      "--orange": "#d58f53",
      "--red": "#f16774",
      "--cyan": "#57ddb5",
      "--green": "#a7ef93",
      "--violet": "#a0b0dd",
      "--blue": "#5da6dc"
    }
  },
  {
    id: "ember",
    labelKey: "settings.accentThemeEmber",
    preview: makeThemePreview({
      background: "#2a1118",
      surface: "#451e2f",
      emphasis: "#c3fff5",
      primary: "#ff7890",
      secondary: "#d49aff",
      warm: "#83f4e1"
    }),
    cssVars: {
      "--accent-theme-primary": "#ff7890",
      "--accent-theme-secondary": "#d49aff",
      "--accent-theme-tertiary": "#83f4e1",
      "--accent-primary": "#ff7890",
      "--accent-secondary": "#d49aff",
      "--accent-warm": "#83f4e1",
      "--focus-ring": "#ff7890",
      "--bg": "#2a1118",
      "--bg-deep": "#11060a",
      "--panel": "rgba(48, 22, 34, 0.9)",
      "--panel-strong": "rgba(69, 30, 47, 0.95)",
      "--line": "rgba(255, 116, 147, 0.25)",
      "--line-strong": "rgba(255, 186, 131, 0.38)",
      "--surface-rgb": "48 22 34",
      "--surface-strong-rgb": "69 30 47",
      "--surface-deep-rgb": "18 7 13",
      "--line-rgb": "255 116 147",
      "--line-strong-rgb": "255 186 131",
      "--surface-glow-rgb": "255 120 144",
      "--gold-rgb": "131 244 225",
      "--orange-rgb": "255 145 89",
      "--red-rgb": "255 120 144",
      "--cyan-rgb": "133 218 207",
      "--green-rgb": "165 214 133",
      "--violet-rgb": "212 154 255",
      "--blue-rgb": "141 173 255",
      "--text-heading": "#c3fff5",
      "--text-emphasis": "#83f4e1",
      "--text-primary": "#fff0e8",
      "--text-secondary": "#e7c8c1",
      "--text-muted": "#d4adb8",
      "--text-faint": "#956f7b",
      "--text": "#fff0e8",
      "--text-dim": "#d4adb8",
      "--gold": "#83f4e1",
      "--orange": "#ff9159",
      "--red": "#ff7890",
      "--cyan": "#85dacf",
      "--green": "#a5d685",
      "--violet": "#d49aff",
      "--blue": "#8dadff"
    }
  },
  {
    id: "aster",
    labelKey: "settings.accentThemeAster",
    preview: makeThemePreview({
      background: "#210c30",
      surface: "#331746",
      emphasis: "#e2ffad",
      primary: "#ce8cff",
      secondary: "#76e7d5",
      warm: "#c8f778"
    }),
    cssVars: {
      "--accent-theme-primary": "#ce8cff",
      "--accent-theme-secondary": "#76e7d5",
      "--accent-theme-tertiary": "#c8f778",
      "--accent-primary": "#ce8cff",
      "--accent-secondary": "#76e7d5",
      "--accent-warm": "#c8f778",
      "--focus-ring": "#ce8cff",
      "--bg": "#210c30",
      "--bg-deep": "#0c0615",
      "--panel": "rgba(38, 15, 54, 0.9)",
      "--panel-strong": "rgba(51, 23, 70, 0.95)",
      "--line": "rgba(206, 140, 255, 0.25)",
      "--line-strong": "rgba(118, 231, 213, 0.34)",
      "--surface-rgb": "38 15 54",
      "--surface-strong-rgb": "51 23 70",
      "--surface-deep-rgb": "12 6 21",
      "--line-rgb": "206 140 255",
      "--line-strong-rgb": "118 231 213",
      "--surface-glow-rgb": "206 140 255",
      "--gold-rgb": "200 247 120",
      "--orange-rgb": "223 157 115",
      "--red-rgb": "244 167 202",
      "--cyan-rgb": "118 231 213",
      "--green-rgb": "157 226 168",
      "--violet-rgb": "206 140 255",
      "--blue-rgb": "143 184 255",
      "--text-heading": "#e2ffad",
      "--text-emphasis": "#c8f778",
      "--text-primary": "#f8efff",
      "--text-secondary": "#dfcdf0",
      "--text-muted": "#c4b3d2",
      "--text-faint": "#846d99",
      "--text": "#f8efff",
      "--text-dim": "#c4b3d2",
      "--gold": "#c8f778",
      "--orange": "#df9d73",
      "--red": "#f4a7ca",
      "--cyan": "#76e7d5",
      "--green": "#9de2a8",
      "--violet": "#ce8cff",
      "--blue": "#8fb8ff"
    }
  }
];

const APP_ACCENT_THEME_IDS = new Set<AppAccentThemeId>(
  APP_ACCENT_THEMES.map((theme) => theme.id)
);

export function isAppAccentThemeId(value: unknown): value is AppAccentThemeId {
  return typeof value === "string" && APP_ACCENT_THEME_IDS.has(value as AppAccentThemeId);
}

export function resolveAppAccentThemeId(value: unknown): AppAccentThemeId {
  return isAppAccentThemeId(value) ? value : DEFAULT_APP_ACCENT_THEME_ID;
}

export function readStoredAppAccentThemeId() {
  return resolveAppAccentThemeId(readPersistentString(APP_ACCENT_THEME_STORAGE_KEY));
}

export function writeStoredAppAccentThemeId(themeId: AppAccentThemeId) {
  writePersistentString(APP_ACCENT_THEME_STORAGE_KEY, resolveAppAccentThemeId(themeId));
}

export function getAppAccentTheme(themeId: unknown) {
  const resolvedThemeId = resolveAppAccentThemeId(themeId);
  return (
    APP_ACCENT_THEMES.find((theme) => theme.id === resolvedThemeId) ??
    APP_ACCENT_THEMES[0]
  );
}

export function applyAppAccentThemeToRoot(
  themeId: unknown,
  root: HTMLElement | null =
    typeof document === "undefined" ? null : document.documentElement
) {
  if (!root) {
    return;
  }

  const theme = getAppAccentTheme(themeId);
  root.dataset.accentTheme = theme.id;

  Object.entries(theme.cssVars).forEach(([name, value]) => {
    root.style.setProperty(name, value);
  });
}
