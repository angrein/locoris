import type { SitePath } from "../App";
import { findDocsArticle } from "./docs";
import { findLegalPolicy } from "./legal";
import { siteConfig } from "./siteConfig";

export type PageMeta = {
  title: string;
  description: string;
  image?: string;
};

export const defaultMeta: PageMeta = {
  title: "Locoris - Private local-first workspace",
  description: "Locoris is a private local-first workspace for notes, canvas, map thinking, planning, backups, and encrypted sync.",
  image: "/social-preview.jpg"
};

const metaByPath: Partial<Record<SitePath, PageMeta>> = {
  "/": defaultMeta,
  "/product": {
    title: "Product - Locoris",
    description: "Explore Locoris notes, canvas, orbital map, planner, AI, backups, and local-first vaults.",
    image: "/media/product-notes-canvas-planner.jpg"
  },
  "/cloud": {
    title: "Locoris Cloud - Encrypted hosted sync",
    description: "Hosted encrypted sync for Locoris vaults, with local-first ownership and self-hosted alternatives.",
    image: "/media/product-overview-desktop.jpg"
  },
  "/pricing": {
    title: "Pricing - Locoris",
    description: "Locoris is free locally. Paid hosted sync will sell convenience, cloud history, web access, and support."
  },
  "/download": {
    title: "Download Locoris",
    description: "Download official Locoris builds for macOS, Windows, and Android with checksums and install notes.",
    image: "/media/download-platforms.jpg"
  },
  "/security": {
    title: "Security - Locoris",
    description: "Understand Locoris local-first storage, client-side encrypted sync, metadata visibility, and private vault recovery limits.",
    image: "/media/security-private-vault.jpg"
  },
  "/self-hosting": {
    title: "Self-hosting - Locoris",
    description: "Run a personal Locoris sync server when you want control over your remote vault infrastructure.",
    image: "/media/self-hosted-setup.jpg"
  },
  "/docs": {
    title: "Docs - Locoris",
    description: "Read current Locoris docs for vaults, sync, encryption, backups, installation, and data ownership."
  },
  "/roadmap": {
    title: "Roadmap - Locoris",
    description: "See the public Locoris product roadmap without exposing private commercial planning."
  },
  "/changelog": {
    title: "Changelog - Locoris",
    description: "Read human release notes for Locoris app and distribution improvements."
  },
  "/legal": {
    title: "Legal - Locoris",
    description: "Terms, privacy, refunds, data deletion, open-source licenses, and security contact for Locoris."
  }
};

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }

  return `${siteConfig.siteUrl}${path}`;
}

function setMeta(selector: string, attribute: "content" | "href", value: string): void {
  const element = document.head.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
}

export function getPageMeta(path: string): PageMeta {
  if (path.startsWith("/docs/")) {
    const article = findDocsArticle(path.split("/").at(-1) ?? "");
    if (article) {
      return {
        title: `${article.title} - Locoris Docs`,
        description: article.summary,
        image: "/social-preview.jpg"
      };
    }
  }

  if (path.startsWith("/legal/")) {
    const policy = findLegalPolicy(path.split("/").at(-1) ?? "");
    if (policy) {
      return {
        title: `${policy.title} - Locoris`,
        description: policy.summary
      };
    }
  }

  return metaByPath[path as SitePath] ?? {
    title: "Page not found - Locoris",
    description: "Return to the Locoris product overview, download page, or documentation."
  };
}

export function applyPageMeta(path: string): void {
  const meta = getPageMeta(path);
  const canonical = path === "/404" ? siteConfig.siteUrl : absoluteUrl(path);
  const image = absoluteUrl(meta.image ?? defaultMeta.image ?? "/media/product-overview-desktop.jpg");

  document.title = meta.title;
  setMeta('meta[name="description"]', "content", meta.description);
  setMeta('meta[property="og:title"]', "content", meta.title);
  setMeta('meta[property="og:description"]', "content", meta.description);
  setMeta('meta[property="og:url"]', "content", canonical);
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[name="twitter:title"]', "content", meta.title);
  setMeta('meta[name="twitter:description"]', "content", meta.description);
  setMeta('meta[name="twitter:image"]', "content", image);
  setMeta('link[rel="canonical"]', "href", canonical);
}

export function softwareApplicationJsonLd(): string {
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Locoris",
      url: siteConfig.siteUrl,
      email: siteConfig.supportEmail,
      sameAs: [siteConfig.repoUrl]
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Locoris",
      brand: {
        "@type": "Brand",
        name: "Locoris"
      },
      description: defaultMeta.description,
      url: siteConfig.siteUrl,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        description: "The local Locoris app is free. Paid hosted cloud sync is planned."
      }
    },
    {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Locoris",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "macOS, Windows, Android, Web",
    softwareVersion: siteConfig.version,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "The local Locoris app is free. Paid hosted cloud sync is planned."
    },
    url: siteConfig.siteUrl,
    downloadUrl: `${siteConfig.siteUrl}/download`,
    description: defaultMeta.description
    }
  ]);
}
