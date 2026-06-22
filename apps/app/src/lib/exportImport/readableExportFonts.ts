import type JSZip from "jszip";

import golosTextCyrillicExtUrl from "@fontsource-variable/golos-text/files/golos-text-cyrillic-ext-wght-normal.woff2?url";
import golosTextCyrillicUrl from "@fontsource-variable/golos-text/files/golos-text-cyrillic-wght-normal.woff2?url";
import golosTextLatinExtUrl from "@fontsource-variable/golos-text/files/golos-text-latin-ext-wght-normal.woff2?url";
import golosTextLatinUrl from "@fontsource-variable/golos-text/files/golos-text-latin-wght-normal.woff2?url";
import golosTextLicense from "@fontsource-variable/golos-text/LICENSE?raw";
import onestCyrillicExtUrl from "@fontsource-variable/onest/files/onest-cyrillic-ext-wght-normal.woff2?url";
import onestCyrillicUrl from "@fontsource-variable/onest/files/onest-cyrillic-wght-normal.woff2?url";
import onestLatinExtUrl from "@fontsource-variable/onest/files/onest-latin-ext-wght-normal.woff2?url";
import onestLatinUrl from "@fontsource-variable/onest/files/onest-latin-wght-normal.woff2?url";
import onestLicense from "@fontsource-variable/onest/LICENSE?raw";
import unboundedCyrillicExtUrl from "@fontsource-variable/unbounded/files/unbounded-cyrillic-ext-wght-normal.woff2?url";
import unboundedCyrillicUrl from "@fontsource-variable/unbounded/files/unbounded-cyrillic-wght-normal.woff2?url";
import unboundedLatinExtUrl from "@fontsource-variable/unbounded/files/unbounded-latin-ext-wght-normal.woff2?url";
import unboundedLatinUrl from "@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2?url";
import unboundedVietnameseUrl from "@fontsource-variable/unbounded/files/unbounded-vietnamese-wght-normal.woff2?url";
import unboundedLicense from "@fontsource-variable/unbounded/LICENSE?raw";
import ibmPlexMonoCyrillic400ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-400-italic.woff2?url";
import ibmPlexMonoCyrillic400NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-400-normal.woff2?url";
import ibmPlexMonoCyrillic500ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-italic.woff2?url";
import ibmPlexMonoCyrillic500NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-500-normal.woff2?url";
import ibmPlexMonoCyrillic600ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-600-italic.woff2?url";
import ibmPlexMonoCyrillic600NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-600-normal.woff2?url";
import ibmPlexMonoCyrillic700ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-700-italic.woff2?url";
import ibmPlexMonoCyrillic700NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-cyrillic-700-normal.woff2?url";
import ibmPlexMonoLatin400ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-italic.woff2?url";
import ibmPlexMonoLatin400NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url";
import ibmPlexMonoLatin500ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-italic.woff2?url";
import ibmPlexMonoLatin500NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url";
import ibmPlexMonoLatin600ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-italic.woff2?url";
import ibmPlexMonoLatin600NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url";
import ibmPlexMonoLatin700ItalicUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-italic.woff2?url";
import ibmPlexMonoLatin700NormalUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2?url";
import ibmPlexMonoLicense from "@fontsource/ibm-plex-mono/LICENSE?raw";
import ibmPlexSansCyrillic400ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-400-italic.woff2?url";
import ibmPlexSansCyrillic400NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-400-normal.woff2?url";
import ibmPlexSansCyrillic500ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-500-italic.woff2?url";
import ibmPlexSansCyrillic500NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-500-normal.woff2?url";
import ibmPlexSansCyrillic600ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-600-italic.woff2?url";
import ibmPlexSansCyrillic600NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-600-normal.woff2?url";
import ibmPlexSansCyrillic700ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-700-italic.woff2?url";
import ibmPlexSansCyrillic700NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-cyrillic-700-normal.woff2?url";
import ibmPlexSansLatin400ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2?url";
import ibmPlexSansLatin400NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url";
import ibmPlexSansLatin500ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-italic.woff2?url";
import ibmPlexSansLatin500NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url";
import ibmPlexSansLatin600ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-italic.woff2?url";
import ibmPlexSansLatin600NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url";
import ibmPlexSansLatin700ItalicUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-italic.woff2?url";
import ibmPlexSansLatin700NormalUrl from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2?url";
import ibmPlexSansLicense from "@fontsource/ibm-plex-sans/LICENSE?raw";
import ibmPlexSerifCyrillic400ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-400-italic.woff2?url";
import ibmPlexSerifCyrillic400NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-400-normal.woff2?url";
import ibmPlexSerifCyrillic500ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-500-italic.woff2?url";
import ibmPlexSerifCyrillic500NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-500-normal.woff2?url";
import ibmPlexSerifCyrillic600ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-600-italic.woff2?url";
import ibmPlexSerifCyrillic600NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-600-normal.woff2?url";
import ibmPlexSerifCyrillic700ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-700-italic.woff2?url";
import ibmPlexSerifCyrillic700NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-cyrillic-700-normal.woff2?url";
import ibmPlexSerifLatin400ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-400-italic.woff2?url";
import ibmPlexSerifLatin400NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-400-normal.woff2?url";
import ibmPlexSerifLatin500ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-500-italic.woff2?url";
import ibmPlexSerifLatin500NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-500-normal.woff2?url";
import ibmPlexSerifLatin600ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-600-italic.woff2?url";
import ibmPlexSerifLatin600NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-600-normal.woff2?url";
import ibmPlexSerifLatin700ItalicUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-700-italic.woff2?url";
import ibmPlexSerifLatin700NormalUrl from "@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-700-normal.woff2?url";
import ibmPlexSerifLicense from "@fontsource/ibm-plex-serif/LICENSE?raw";

const FONT_DIR = "_locoris/fonts";
const FONT_LICENSE_DIR = "_locoris/licenses/fonts";
const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT_RANGE =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const CYRILLIC_RANGE = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
const CYRILLIC_EXT_RANGE = "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F";
const VIETNAMESE_RANGE = "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB";

type ReadableExportFontAsset = {
  fileName: string;
  url: string;
};

type FontFaceDescriptor = ReadableExportFontAsset & {
  family: string;
  style: "normal" | "italic";
  weight: string;
  format: "woff2" | "woff2-variations";
  unicodeRange?: string;
};

type FontLicense = {
  fileName: string;
  family: string;
  sourcePackage: string;
  licenseText: string;
};

type StaticFontWeight = 400 | 500 | 600 | 700;
type StaticFontStyle = "normal" | "italic";
type StaticFontKey = `${StaticFontWeight}-${StaticFontStyle}`;

function variableFaces(input: {
  fileName: string;
  url: string;
  families: string[];
  weight: string;
  unicodeRange: string;
}): FontFaceDescriptor[] {
  return input.families.map((family) => ({
    fileName: input.fileName,
    url: input.url,
    family,
    style: "normal",
    weight: input.weight,
    format: "woff2-variations",
    unicodeRange: input.unicodeRange
  }));
}

function staticFace(input: {
  family: string;
  fileName: string;
  url: string;
  weight: StaticFontWeight;
  style: StaticFontStyle;
  unicodeRange: string;
}): FontFaceDescriptor {
  return {
    fileName: input.fileName,
    url: input.url,
    family: input.family,
    style: input.style,
    weight: String(input.weight),
    format: "woff2",
    unicodeRange: input.unicodeRange
  };
}

function ibmFaces(input: {
  family: string;
  name: "sans" | "serif" | "mono";
  latin: Record<StaticFontKey, string>;
  cyrillic: Record<StaticFontKey, string>;
}) {
  const faces: FontFaceDescriptor[] = [];

  ([400, 500, 600, 700] as const).forEach((weight) => {
    (["normal", "italic"] as const).forEach((style) => {
      const suffix = `${weight}-${style}` as StaticFontKey;

      faces.push(
        staticFace({
          family: input.family,
          fileName: `ibm-plex-${input.name}-latin-${suffix}.woff2`,
          url: input.latin[suffix],
          weight,
          style,
          unicodeRange: LATIN_RANGE
        }),
        staticFace({
          family: input.family,
          fileName: `ibm-plex-${input.name}-cyrillic-${suffix}.woff2`,
          url: input.cyrillic[suffix],
          weight,
          style,
          unicodeRange: CYRILLIC_RANGE
        })
      );
    });
  });

  return faces;
}

const FONT_FACE_DESCRIPTORS: FontFaceDescriptor[] = [
  ...variableFaces({
    fileName: "onest-cyrillic-ext-wght-normal.woff2",
    url: onestCyrillicExtUrl,
    families: ["Onest Variable", "Onest"],
    weight: "100 900",
    unicodeRange: CYRILLIC_EXT_RANGE
  }),
  ...variableFaces({
    fileName: "onest-cyrillic-wght-normal.woff2",
    url: onestCyrillicUrl,
    families: ["Onest Variable", "Onest"],
    weight: "100 900",
    unicodeRange: CYRILLIC_RANGE
  }),
  ...variableFaces({
    fileName: "onest-latin-ext-wght-normal.woff2",
    url: onestLatinExtUrl,
    families: ["Onest Variable", "Onest"],
    weight: "100 900",
    unicodeRange: LATIN_EXT_RANGE
  }),
  ...variableFaces({
    fileName: "onest-latin-wght-normal.woff2",
    url: onestLatinUrl,
    families: ["Onest Variable", "Onest"],
    weight: "100 900",
    unicodeRange: LATIN_RANGE
  }),
  ...variableFaces({
    fileName: "golos-text-cyrillic-ext-wght-normal.woff2",
    url: golosTextCyrillicExtUrl,
    families: ["Golos Text Variable", "Golos Text"],
    weight: "400 900",
    unicodeRange: CYRILLIC_EXT_RANGE
  }),
  ...variableFaces({
    fileName: "golos-text-cyrillic-wght-normal.woff2",
    url: golosTextCyrillicUrl,
    families: ["Golos Text Variable", "Golos Text"],
    weight: "400 900",
    unicodeRange: CYRILLIC_RANGE
  }),
  ...variableFaces({
    fileName: "golos-text-latin-ext-wght-normal.woff2",
    url: golosTextLatinExtUrl,
    families: ["Golos Text Variable", "Golos Text"],
    weight: "400 900",
    unicodeRange: LATIN_EXT_RANGE
  }),
  ...variableFaces({
    fileName: "golos-text-latin-wght-normal.woff2",
    url: golosTextLatinUrl,
    families: ["Golos Text Variable", "Golos Text"],
    weight: "400 900",
    unicodeRange: LATIN_RANGE
  }),
  ...variableFaces({
    fileName: "unbounded-cyrillic-ext-wght-normal.woff2",
    url: unboundedCyrillicExtUrl,
    families: ["Unbounded Variable", "Unbounded"],
    weight: "200 900",
    unicodeRange: CYRILLIC_EXT_RANGE
  }),
  ...variableFaces({
    fileName: "unbounded-cyrillic-wght-normal.woff2",
    url: unboundedCyrillicUrl,
    families: ["Unbounded Variable", "Unbounded"],
    weight: "200 900",
    unicodeRange: CYRILLIC_RANGE
  }),
  ...variableFaces({
    fileName: "unbounded-vietnamese-wght-normal.woff2",
    url: unboundedVietnameseUrl,
    families: ["Unbounded Variable", "Unbounded"],
    weight: "200 900",
    unicodeRange: VIETNAMESE_RANGE
  }),
  ...variableFaces({
    fileName: "unbounded-latin-ext-wght-normal.woff2",
    url: unboundedLatinExtUrl,
    families: ["Unbounded Variable", "Unbounded"],
    weight: "200 900",
    unicodeRange: LATIN_EXT_RANGE
  }),
  ...variableFaces({
    fileName: "unbounded-latin-wght-normal.woff2",
    url: unboundedLatinUrl,
    families: ["Unbounded Variable", "Unbounded"],
    weight: "200 900",
    unicodeRange: LATIN_RANGE
  }),
  ...ibmFaces({
    family: "IBM Plex Sans",
    name: "sans",
    latin: {
      "400-normal": ibmPlexSansLatin400NormalUrl,
      "400-italic": ibmPlexSansLatin400ItalicUrl,
      "500-normal": ibmPlexSansLatin500NormalUrl,
      "500-italic": ibmPlexSansLatin500ItalicUrl,
      "600-normal": ibmPlexSansLatin600NormalUrl,
      "600-italic": ibmPlexSansLatin600ItalicUrl,
      "700-normal": ibmPlexSansLatin700NormalUrl,
      "700-italic": ibmPlexSansLatin700ItalicUrl
    },
    cyrillic: {
      "400-normal": ibmPlexSansCyrillic400NormalUrl,
      "400-italic": ibmPlexSansCyrillic400ItalicUrl,
      "500-normal": ibmPlexSansCyrillic500NormalUrl,
      "500-italic": ibmPlexSansCyrillic500ItalicUrl,
      "600-normal": ibmPlexSansCyrillic600NormalUrl,
      "600-italic": ibmPlexSansCyrillic600ItalicUrl,
      "700-normal": ibmPlexSansCyrillic700NormalUrl,
      "700-italic": ibmPlexSansCyrillic700ItalicUrl
    }
  }),
  ...ibmFaces({
    family: "IBM Plex Serif",
    name: "serif",
    latin: {
      "400-normal": ibmPlexSerifLatin400NormalUrl,
      "400-italic": ibmPlexSerifLatin400ItalicUrl,
      "500-normal": ibmPlexSerifLatin500NormalUrl,
      "500-italic": ibmPlexSerifLatin500ItalicUrl,
      "600-normal": ibmPlexSerifLatin600NormalUrl,
      "600-italic": ibmPlexSerifLatin600ItalicUrl,
      "700-normal": ibmPlexSerifLatin700NormalUrl,
      "700-italic": ibmPlexSerifLatin700ItalicUrl
    },
    cyrillic: {
      "400-normal": ibmPlexSerifCyrillic400NormalUrl,
      "400-italic": ibmPlexSerifCyrillic400ItalicUrl,
      "500-normal": ibmPlexSerifCyrillic500NormalUrl,
      "500-italic": ibmPlexSerifCyrillic500ItalicUrl,
      "600-normal": ibmPlexSerifCyrillic600NormalUrl,
      "600-italic": ibmPlexSerifCyrillic600ItalicUrl,
      "700-normal": ibmPlexSerifCyrillic700NormalUrl,
      "700-italic": ibmPlexSerifCyrillic700ItalicUrl
    }
  }),
  ...ibmFaces({
    family: "IBM Plex Mono",
    name: "mono",
    latin: {
      "400-normal": ibmPlexMonoLatin400NormalUrl,
      "400-italic": ibmPlexMonoLatin400ItalicUrl,
      "500-normal": ibmPlexMonoLatin500NormalUrl,
      "500-italic": ibmPlexMonoLatin500ItalicUrl,
      "600-normal": ibmPlexMonoLatin600NormalUrl,
      "600-italic": ibmPlexMonoLatin600ItalicUrl,
      "700-normal": ibmPlexMonoLatin700NormalUrl,
      "700-italic": ibmPlexMonoLatin700ItalicUrl
    },
    cyrillic: {
      "400-normal": ibmPlexMonoCyrillic400NormalUrl,
      "400-italic": ibmPlexMonoCyrillic400ItalicUrl,
      "500-normal": ibmPlexMonoCyrillic500NormalUrl,
      "500-italic": ibmPlexMonoCyrillic500ItalicUrl,
      "600-normal": ibmPlexMonoCyrillic600NormalUrl,
      "600-italic": ibmPlexMonoCyrillic600ItalicUrl,
      "700-normal": ibmPlexMonoCyrillic700NormalUrl,
      "700-italic": ibmPlexMonoCyrillic700ItalicUrl
    }
  })
];

const FONT_LICENSES: FontLicense[] = [
  {
    fileName: "Onest-OFL-1.1.txt",
    family: "Onest",
    sourcePackage: "@fontsource-variable/onest",
    licenseText: onestLicense
  },
  {
    fileName: "Golos-Text-OFL-1.1.txt",
    family: "Golos Text",
    sourcePackage: "@fontsource-variable/golos-text",
    licenseText: golosTextLicense
  },
  {
    fileName: "Unbounded-OFL-1.1.txt",
    family: "Unbounded",
    sourcePackage: "@fontsource-variable/unbounded",
    licenseText: unboundedLicense
  },
  {
    fileName: "IBM-Plex-Sans-OFL-1.1.txt",
    family: "IBM Plex Sans",
    sourcePackage: "@fontsource/ibm-plex-sans",
    licenseText: ibmPlexSansLicense
  },
  {
    fileName: "IBM-Plex-Serif-OFL-1.1.txt",
    family: "IBM Plex Serif",
    sourcePackage: "@fontsource/ibm-plex-serif",
    licenseText: ibmPlexSerifLicense
  },
  {
    fileName: "IBM-Plex-Mono-OFL-1.1.txt",
    family: "IBM Plex Mono",
    sourcePackage: "@fontsource/ibm-plex-mono",
    licenseText: ibmPlexMonoLicense
  }
];

function getUniqueFontAssets() {
  const byFileName = new Map<string, ReadableExportFontAsset>();

  FONT_FACE_DESCRIPTORS.forEach((font) => {
    byFileName.set(font.fileName, {
      fileName: font.fileName,
      url: font.url
    });
  });

  return [...byFileName.values()];
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchBundledAsset(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`READABLE_EXPORT_FONT_FETCH_FAILED:${url}`);
  }

  return response.blob();
}

function buildThirdPartyFontsNotice() {
  return [
    "# Third-party fonts",
    "",
    "This readable Locoris export includes local webfont files so HTML notes render consistently on other devices without network access.",
    "",
    "Included font families:",
    "",
    ...FONT_LICENSES.map((license) => `- ${license.family} (${license.sourcePackage}) — SIL Open Font License 1.1`),
    "",
    "The font files are redistributed as unmodified WOFF2 files from Fontsource packages. They are not sold separately.",
    "Full license texts are included in this folder."
  ].join("\n");
}

export async function addReadableExportFontPack(zip: JSZip) {
  zip.folder(FONT_DIR);
  zip.folder(FONT_LICENSE_DIR);

  try {
    const bundledFonts = await Promise.all(
      getUniqueFontAssets().map(async (font) => ({
        font,
        blob: await fetchBundledAsset(font.url)
      }))
    );

    bundledFonts.forEach(({ font, blob }) => {
      zip.file(`${FONT_DIR}/${font.fileName}`, blob);
    });
  } catch {
    zip.file(
      "_locoris/fonts-unavailable.txt",
      [
        "Locoris could not package local webfonts for this readable export.",
        "HTML notes remain readable and will use system fallback fonts on this device."
      ].join("\n")
    );
    return false;
  }

  zip.file(`${FONT_LICENSE_DIR}/THIRD_PARTY_FONTS.md`, buildThirdPartyFontsNotice());
  FONT_LICENSES.forEach((license) => {
    zip.file(`${FONT_LICENSE_DIR}/${license.fileName}`, license.licenseText);
  });

  return true;
}

function buildFontFaceCss(resolveUrl: (font: FontFaceDescriptor) => string) {
  return FONT_FACE_DESCRIPTORS.map((font) =>
    [
      "@font-face {",
      `  font-family: "${escapeCssString(font.family)}";`,
      `  font-style: ${font.style};`,
      "  font-display: swap;",
      `  font-weight: ${font.weight};`,
      `  src: url("${escapeCssString(resolveUrl(font))}") format("${font.format}");`,
      font.unicodeRange ? `  unicode-range: ${font.unicodeRange};` : "",
      "}"
    ]
      .filter(Boolean)
      .join("\n")
  ).join("\n\n");
}

export function getReadableExportFontCss(htmlPath: string) {
  const depth = Math.max(0, htmlPath.split("/").filter(Boolean).length - 1);
  const rootPrefix = depth > 0 ? "../".repeat(depth) : "";
  const fontBasePath = `${rootPrefix}${FONT_DIR}`;

  return buildFontFaceCss((font) => `${fontBasePath}/${font.fileName}`);
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  const chunks: string[] = [];

  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
  }

  return btoa(chunks.join(""));
}

async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || "font/woff2"};base64,${bytesToBase64(bytes)}`;
}

let selfContainedFontCssPromise: Promise<string> | null = null;

export function getSelfContainedReadableExportFontCss() {
  selfContainedFontCssPromise ??= (async () => {
    try {
      const fontDataUrls = new Map(
        await Promise.all(
          getUniqueFontAssets().map(async (font) => [
            font.fileName,
            await blobToDataUrl(await fetchBundledAsset(font.url))
          ] as const)
        )
      );

      return buildFontFaceCss((font) => fontDataUrls.get(font.fileName) ?? "");
    } catch {
      return "";
    }
  })();

  return selfContainedFontCssPromise;
}
