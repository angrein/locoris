import { CURRENT_VERSION, GITHUB_RELEASES_URL, releaseAssetUrl, siteConfig } from "./siteConfig";

export type DownloadTarget = {
  platform: string;
  title: string;
  version: string;
  badge: string;
  copy: string;
  fileName?: string;
  size?: string;
  checksum?: string;
  href?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  notes: string[];
  requirements: string;
};

export const downloadTargets: DownloadTarget[] = [
  {
    platform: "macOS",
    title: "macOS Apple Silicon",
    version: CURRENT_VERSION,
    badge: "DMG",
    copy: "Official desktop build for Apple Silicon Macs. Intel macOS builds can be added when the release matrix includes x64 runners.",
    fileName: "Locoris_1.0.39_aarch64.dmg",
    size: "12.8 MB",
    checksum: "a81997e6f32d838a7106563b03e0485fefe6757c76fd7f086fc64915cb7b2f97",
    href: releaseAssetUrl("Locoris_1.0.39_aarch64.dmg"),
    primaryLabel: "Download DMG",
    secondaryLabel: "Release page",
    secondaryHref: siteConfig.latestReleaseUrl,
    requirements: "macOS on Apple Silicon",
    notes: [
      "Open the DMG, drag Locoris to Applications, then launch it from Applications.",
      "If macOS shows a Gatekeeper warning, open System Settings > Privacy & Security and allow Locoris only if the checksum matches this page.",
      "Code signing and notarization should become part of the release path as soon as certificates are available."
    ]
  },
  {
    platform: "Windows",
    title: "Windows installer",
    version: CURRENT_VERSION,
    badge: "EXE",
    copy: "Recommended installer for Windows x64. The MSI is kept as an advanced alternate artifact.",
    fileName: "Locoris_1.0.39_x64-setup.exe",
    size: "10.0 MB",
    checksum: "c376f372aa36c5f9fb74243ed89002a2f1fc032d3bb43037a2706bbbc9e37d46",
    href: releaseAssetUrl("Locoris_1.0.39_x64-setup.exe"),
    primaryLabel: "Download EXE",
    secondaryLabel: "MSI alternate",
    secondaryHref: releaseAssetUrl("Locoris_1.0.39_x64_en-US.msi"),
    requirements: "Windows x64",
    notes: [
      "Use the EXE installer for the normal setup path. The MSI is available for users who prefer Windows Installer packages.",
      "SmartScreen can warn on young unsigned apps. Verify the checksum, then choose More info > Run anyway only if the file matches.",
      "Windows code signing should be prioritized before broad non-technical distribution."
    ]
  },
  {
    platform: "Android",
    title: "Android APK",
    version: CURRENT_VERSION,
    badge: "APK",
    copy: "Direct signed APK while Play Store distribution is not available. The app can still use the normal Locoris vault model.",
    fileName: "Locoris-Android-1.0.39.apk",
    size: "94.8 MB",
    checksum: "1785a057dabe34675029a00ce031f74a5f0565252df0fa08294db6c582ece9d0",
    href: releaseAssetUrl("Locoris-Android-1.0.39.apk"),
    primaryLabel: "Download APK",
    secondaryLabel: "SHA-256 file",
    secondaryHref: releaseAssetUrl("Locoris-Android-1.0.39.apk.sha256"),
    requirements: "Android with APK sideloading enabled",
    notes: [
      "Download the APK on the device, then allow installs from the browser or file manager when Android asks.",
      "Keep the APK from this official page or GitHub Releases; do not install reposted builds from third-party mirrors.",
      "Play Store distribution can replace sideloading once a developer account is available."
    ]
  },
  {
    platform: "Web",
    title: "Web app",
    version: "Planned",
    badge: "Planned",
    copy: "The web app is planned as a browser entry point for demo mode and Locoris Cloud vault access.",
    href: siteConfig.webAppUrl,
    primaryLabel: "Web app planned",
    requirements: "Modern Chromium, Safari, or Firefox",
    notes: [
      "Browser-local mode should explain that clearing browser data can remove local web vault data.",
      "Cloud mode should sign in through Locoris Cloud and behave like another synced device.",
      "Until launch, desktop and Android builds remain the primary production path."
    ]
  }
];

export const verificationSteps = [
  "Download the file from this page or the linked GitHub Release.",
  "Compute SHA-256 locally with shasum -a 256 on macOS/Linux or Get-FileHash -Algorithm SHA256 on Windows.",
  "Compare the full checksum before bypassing any operating-system warning.",
  "If the checksum does not match, delete the file and contact security@locoris.app."
];

export const releaseNotes = {
  version: siteConfig.version,
  publishedAt: "June 24, 2026",
  href: siteConfig.latestReleaseUrl,
  summary:
    "Current public build with desktop update assets for macOS and Windows plus a signed Android APK uploaded by the unified release workflow."
};

export const selfHostedDownloadCallout = {
  title: "Self-hosted sync",
  badge: "Advanced",
  copy:
    "Self-hosted sync is not an app installer. It is the advanced server path for users who want to operate their own remote vault infrastructure instead of Locoris Cloud.",
  href: "/self-hosting",
  secondaryHref: `${GITHUB_RELEASES_URL}/tag/${siteConfig.releaseTag}`,
  items: [
    "Keep local app downloads separate from server setup.",
    "Use manual server URL and token flows for advanced or recovery scenarios.",
    "Prefer Locoris Cloud for the normal non-technical hosted sync path."
  ]
};
