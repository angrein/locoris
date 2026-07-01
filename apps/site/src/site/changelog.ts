import { siteConfig } from "./siteConfig";

export type ChangelogEntry = {
  version: string;
  date: string;
  label: string;
  href: string;
  summary: string;
  newItems: string[];
  improvedItems: string[];
  fixedItems: string[];
  knownItems: string[];
};

export const changelogEntries: ChangelogEntry[] = [
  {
    version: "1.0.39",
    date: "June 24, 2026",
    label: "Latest stable",
    href: siteConfig.latestReleaseUrl,
    summary: "Unified desktop and Android release with official assets for direct distribution.",
    newItems: ["macOS Apple Silicon DMG asset", "Windows EXE and MSI assets", "Signed Android APK asset"],
    improvedItems: ["Release workflow uploads Android APK and checksum files", "Download page can point to the real release artifacts"],
    fixedItems: ["Release distribution now has a consistent latest stable target for the public website"],
    knownItems: ["macOS Intel distribution and code-signing polish remain launch distribution priorities"]
  },
  {
    version: "1.0.38",
    date: "June 23, 2026",
    label: "Previous",
    href: `${siteConfig.releasesUrl}/tag/app-v1.0.38`,
    summary: "Product polish track before the commercial website hardening pass.",
    newItems: ["Theme and planner refinements", "Backup/export improvements"],
    improvedItems: ["Premium settings surfaces", "Mobile sync UX direction"],
    fixedItems: ["Several UI consistency issues across settings and planner surfaces"],
    knownItems: ["Use the latest stable version unless you need to compare behavior"]
  },
  {
    version: "1.0.37",
    date: "June 22, 2026",
    label: "Archive",
    href: `${siteConfig.releasesUrl}/tag/app-v1.0.37`,
    summary: "Release in the Phase 0 cleanup and commercial-readiness track.",
    newItems: ["Updated public docs direction", "Compatibility notes for legacy storage names"],
    improvedItems: ["Locoris naming consistency across public surfaces"],
    fixedItems: ["Reduced stale product language in docs and app-facing copy"],
    knownItems: ["Public website and legal pages were still in progress"]
  },
  {
    version: "1.0.36",
    date: "June 19, 2026",
    label: "Archive",
    href: `${siteConfig.releasesUrl}/tag/app-v1.0.36`,
    summary: "Commercial-prep release around visual polish and distribution reliability.",
    newItems: ["Additional direct release artifacts"],
    improvedItems: ["Desktop and Android release workflow stability"],
    fixedItems: ["Build workflow retry behavior for network-sensitive dependency installs"],
    knownItems: ["No app store distribution yet"]
  },
  {
    version: "1.0.35",
    date: "June 19, 2026",
    label: "Archive",
    href: `${siteConfig.releasesUrl}/tag/app-v1.0.35`,
    summary: "Product polish release in the path toward a premium local-first launch.",
    newItems: ["Planner and theme polish iterations"],
    improvedItems: ["Premium visual consistency across app surfaces"],
    fixedItems: ["UI details found during manual product review"],
    knownItems: ["See GitHub release for exact asset list"]
  }
];
