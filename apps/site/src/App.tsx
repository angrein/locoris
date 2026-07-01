import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import {
  ChangelogPage,
  CloudPage,
  DocsArticlePage,
  DocsPage,
  DownloadPage,
  HomePage,
  LegalPage,
  NotFoundPage,
  PricingPage,
  ProductPage,
  RoadmapPage,
  SecurityPage,
  SelfHostingPage
} from "./pages/MarketingPages";
import { applyPageMeta, softwareApplicationJsonLd } from "./site/pageMeta";
import "./App.css";

export type SitePath =
  | "/"
  | "/product"
  | "/cloud"
  | "/pricing"
  | "/download"
  | "/security"
  | "/self-hosting"
  | "/docs"
  | "/docs/getting-started"
  | "/docs/vaults-local-data"
  | "/docs/notes-editor"
  | "/docs/canvas"
  | "/docs/planner-calendar"
  | "/docs/sync-options"
  | "/docs/private-vaults-e2ee"
  | "/docs/backups-export"
  | "/docs/install-notes"
  | "/docs/troubleshooting"
  | "/roadmap"
  | "/changelog"
  | "/legal"
  | "/legal/terms"
  | "/legal/privacy"
  | "/legal/cookies"
  | "/legal/refund"
  | "/legal/acceptable-use"
  | "/legal/data-deletion"
  | "/legal/licenses"
  | "/legal/security-contact";

export type Navigate = (path: string) => void;

const pageByPath: Record<SitePath, () => JSX.Element> = {
  "/": HomePage,
  "/product": ProductPage,
  "/cloud": CloudPage,
  "/pricing": PricingPage,
  "/download": DownloadPage,
  "/security": SecurityPage,
  "/self-hosting": SelfHostingPage,
  "/docs": DocsPage,
  "/docs/getting-started": () => <DocsArticlePage articleSlug="getting-started" />,
  "/docs/vaults-local-data": () => <DocsArticlePage articleSlug="vaults-local-data" />,
  "/docs/notes-editor": () => <DocsArticlePage articleSlug="notes-editor" />,
  "/docs/canvas": () => <DocsArticlePage articleSlug="canvas" />,
  "/docs/planner-calendar": () => <DocsArticlePage articleSlug="planner-calendar" />,
  "/docs/sync-options": () => <DocsArticlePage articleSlug="sync-options" />,
  "/docs/private-vaults-e2ee": () => <DocsArticlePage articleSlug="private-vaults-e2ee" />,
  "/docs/backups-export": () => <DocsArticlePage articleSlug="backups-export" />,
  "/docs/install-notes": () => <DocsArticlePage articleSlug="install-notes" />,
  "/docs/troubleshooting": () => <DocsArticlePage articleSlug="troubleshooting" />,
  "/roadmap": RoadmapPage,
  "/changelog": ChangelogPage,
  "/legal": LegalPage,
  "/legal/terms": () => <LegalPage policySlug="terms" />,
  "/legal/privacy": () => <LegalPage policySlug="privacy" />,
  "/legal/cookies": () => <LegalPage policySlug="cookies" />,
  "/legal/refund": () => <LegalPage policySlug="refund" />,
  "/legal/acceptable-use": () => <LegalPage policySlug="acceptable-use" />,
  "/legal/data-deletion": () => <LegalPage policySlug="data-deletion" />,
  "/legal/licenses": () => <LegalPage policySlug="licenses" />,
  "/legal/security-contact": () => <LegalPage policySlug="security-contact" />
};

function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path in pageByPath ? path : "/404";
}

function getInitialPathname(): string {
  const fallbackKey = "locoris.site.redirect";

  try {
    const redirected = window.sessionStorage.getItem(fallbackKey);
    if (redirected) {
      window.sessionStorage.removeItem(fallbackKey);
      const url = new URL(redirected, window.location.origin);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return url.pathname;
    }
  } catch {
    return window.location.pathname;
  }

  return window.location.pathname;
}

export default function App() {
  const [path, setPath] = useState(() => normalizePath(getInitialPathname()));

  useEffect(() => {
    applyPageMeta(path);
  }, [path]);

  useEffect(() => {
    const handlePopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = softwareApplicationJsonLd();
    document.head.append(script);

    return () => {
      script.remove();
    };
  }, []);

  const navigate = useMemo<Navigate>(
    () => (nextPath) => {
      if (nextPath.startsWith("http") || nextPath.startsWith("mailto:")) {
        window.location.href = nextPath;
        return;
      }

      const normalized = normalizePath(nextPath);
      window.history.pushState({}, "", normalized === "/404" ? nextPath : normalized);
      setPath(normalized);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    []
  );

  const CurrentPage = path in pageByPath ? pageByPath[path as SitePath] : NotFoundPage;

  return (
    <div className="site-shell">
      <SiteHeader activePath={path} onNavigate={navigate} />
      <main className="site-main">
        <CurrentPage />
      </main>
      <SiteFooter onNavigate={navigate} />
    </div>
  );
}
