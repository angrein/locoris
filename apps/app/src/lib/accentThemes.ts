import { readPersistentString, writePersistentString } from "./persistentClientStorage";

export type AppAccentThemeId = "classic" | "graphite" | "verdant" | "ember";

type AppAccentTheme = {
  id: AppAccentThemeId;
  labelKey: string;
  preview: [string, string, string];
  cssVars: Record<string, string>;
};

export const APP_ACCENT_THEME_STORAGE_KEY = "zen-notes.appAccentThemeId";
export const DEFAULT_APP_ACCENT_THEME_ID: AppAccentThemeId = "classic";

export const APP_ACCENT_THEMES: AppAccentTheme[] = [
  {
    id: "classic",
    labelKey: "settings.accentThemeClassic",
    preview: ["#ffe08a", "#73f7ff", "#d189ff"],
    cssVars: {
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
      "--gold-rgb": "255 224 138",
      "--orange-rgb": "255 164 92",
      "--red-rgb": "255 103 140",
      "--cyan-rgb": "115 247 255",
      "--green-rgb": "102 240 164",
      "--violet-rgb": "209 137 255",
      "--blue-rgb": "92 162 255",
      "--text": "#f6e7b8",
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
    preview: ["#f0c96a", "#9aa7b8", "#e8edf4"],
    cssVars: {
      "--bg": "#111216",
      "--bg-deep": "#07080b",
      "--panel": "rgba(22, 24, 29, 0.9)",
      "--panel-strong": "rgba(35, 38, 45, 0.95)",
      "--line": "rgba(154, 167, 184, 0.24)",
      "--line-strong": "rgba(220, 226, 236, 0.34)",
      "--surface-rgb": "22 24 29",
      "--surface-strong-rgb": "35 38 45",
      "--surface-deep-rgb": "7 8 11",
      "--line-rgb": "154 167 184",
      "--line-strong-rgb": "220 226 236",
      "--gold-rgb": "240 201 106",
      "--orange-rgb": "221 150 85",
      "--red-rgb": "238 99 122",
      "--cyan-rgb": "164 214 222",
      "--green-rgb": "134 198 155",
      "--violet-rgb": "178 168 198",
      "--blue-rgb": "142 166 204",
      "--text": "#f2eee6",
      "--text-dim": "#b8bdc7",
      "--gold": "#f0c96a",
      "--orange": "#dd9655",
      "--red": "#ee637a",
      "--cyan": "#a4d6de",
      "--green": "#86c69b",
      "--violet": "#b2a8c6",
      "--blue": "#8ea6cc"
    }
  },
  {
    id: "verdant",
    labelKey: "settings.accentThemeVerdant",
    preview: ["#d9c47b", "#55d8b0", "#91f29a"],
    cssVars: {
      "--bg": "#0e221b",
      "--bg-deep": "#06110d",
      "--panel": "rgba(16, 43, 33, 0.9)",
      "--panel-strong": "rgba(24, 61, 47, 0.95)",
      "--line": "rgba(96, 210, 168, 0.24)",
      "--line-strong": "rgba(152, 238, 193, 0.36)",
      "--surface-rgb": "16 43 33",
      "--surface-strong-rgb": "24 61 47",
      "--surface-deep-rgb": "6 17 13",
      "--line-rgb": "96 210 168",
      "--line-strong-rgb": "152 238 193",
      "--gold-rgb": "217 196 123",
      "--orange-rgb": "213 143 83",
      "--red-rgb": "241 103 116",
      "--cyan-rgb": "85 216 176",
      "--green-rgb": "145 242 154",
      "--violet-rgb": "160 176 221",
      "--blue-rgb": "93 166 220",
      "--text": "#f1ead6",
      "--text-dim": "#accdc1",
      "--gold": "#d9c47b",
      "--orange": "#d58f53",
      "--red": "#f16774",
      "--cyan": "#55d8b0",
      "--green": "#91f29a",
      "--violet": "#a0b0dd",
      "--blue": "#5da6dc"
    }
  },
  {
    id: "ember",
    labelKey: "settings.accentThemeEmber",
    preview: ["#ffb36b", "#ff6f91", "#d6a2ff"],
    cssVars: {
      "--bg": "#28131c",
      "--bg-deep": "#12070d",
      "--panel": "rgba(48, 22, 34, 0.9)",
      "--panel-strong": "rgba(69, 30, 47, 0.95)",
      "--line": "rgba(255, 116, 147, 0.25)",
      "--line-strong": "rgba(255, 186, 131, 0.38)",
      "--surface-rgb": "48 22 34",
      "--surface-strong-rgb": "69 30 47",
      "--surface-deep-rgb": "18 7 13",
      "--line-rgb": "255 116 147",
      "--line-strong-rgb": "255 186 131",
      "--gold-rgb": "255 179 107",
      "--orange-rgb": "255 145 89",
      "--red-rgb": "255 111 145",
      "--cyan-rgb": "133 218 207",
      "--green-rgb": "165 214 133",
      "--violet-rgb": "214 162 255",
      "--blue-rgb": "141 173 255",
      "--text": "#faeadf",
      "--text-dim": "#d6b9c4",
      "--gold": "#ffb36b",
      "--orange": "#ff9159",
      "--red": "#ff6f91",
      "--cyan": "#85dacf",
      "--green": "#a5d685",
      "--violet": "#d6a2ff",
      "--blue": "#8dadff"
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
