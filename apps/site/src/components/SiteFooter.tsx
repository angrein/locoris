import type { Navigate } from "../App";
import { siteConfig } from "../site/siteConfig";
import "./SiteFooter.css";

type SiteFooterProps = {
  onNavigate: Navigate;
};

const columns = [
  {
    title: "Product",
    links: [
      { label: "Overview", path: "/product" },
      { label: "Cloud Sync", path: "/cloud" },
      { label: "Pricing", path: "/pricing" },
      { label: "Download", path: "/download" }
    ]
  },
  {
    title: "Trust",
    links: [
      { label: "Security", path: "/security" },
      { label: "Self-hosting", path: "/self-hosting" },
      { label: "Docs", path: "/docs" },
      { label: "Changelog", path: "/changelog" }
    ]
  },
  {
    title: "Legal",
    links: [
      { label: "Legal", path: "/legal" },
      { label: "Privacy", path: "/legal/privacy" },
      { label: "Terms", path: "/legal/terms" },
      { label: "Cookies", path: "/legal/cookies" },
      { label: "Security Contact", path: "/legal/security-contact" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "Roadmap", path: "/roadmap" },
      { label: "GitHub", path: siteConfig.repoUrl },
      { label: "Contact", path: `mailto:${siteConfig.supportEmail}` }
    ]
  }
];

export function SiteFooter({ onNavigate }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <img className="site-footer__mark" src="/locoris-icon.svg" alt="" aria-hidden="true" />
          <div>
            <strong>Locoris</strong>
            <p>Private local-first workspace for people who think in systems.</p>
          </div>
        </div>

        <div className="site-footer__columns">
          {columns.map((column) => (
            <div className="site-footer__column" key={column.title}>
              <h2>{column.title}</h2>
              {column.links.map((link) => (
                <a
                  key={link.label}
                  href={link.path}
                  onClick={(event) => {
                    if (link.path.startsWith("mailto:") || link.path.startsWith("http")) {
                      return;
                    }

                    event.preventDefault();
                    onNavigate(link.path);
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="site-footer__bottom">
        <span>Copyright 2026 Locoris.</span>
        <span>Local-first. Encrypted sync. Readable exports.</span>
      </div>
    </footer>
  );
}
