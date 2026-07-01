export const siteConfig = {
  name: "Locoris",
  version: "1.0.39",
  releaseTag: "app-v1.0.39",
  siteUrl: "https://locoris.app",
  webAppUrl: "https://app.locoris.app",
  cloudUrl: "https://cloud.locoris.app",
  downloadBaseUrl: "https://github.com/angrein/locoris/releases/download/app-v1.0.39",
  repoUrl: "https://github.com/angrein/locoris",
  releasesUrl: "https://github.com/angrein/locoris/releases",
  latestReleaseUrl: "https://github.com/angrein/locoris/releases/tag/app-v1.0.39",
  supportEmail: "hello@locoris.app",
  securityEmail: "security@locoris.app"
} as const;

export const SITE_URL = siteConfig.siteUrl;
export const WEB_APP_URL = siteConfig.webAppUrl;
export const CLOUD_URL = siteConfig.cloudUrl;
export const DOWNLOAD_BASE_URL = siteConfig.downloadBaseUrl;
export const GITHUB_RELEASES_URL = siteConfig.releasesUrl;
export const CURRENT_VERSION = siteConfig.version;

export function releaseAssetUrl(fileName: string): string {
  return `${DOWNLOAD_BASE_URL}/${fileName}`;
}
