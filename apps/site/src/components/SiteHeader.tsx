import { useEffect, useMemo, useState } from "react";
import type { Navigate } from "../App";
import "./SiteHeader.css";

type SiteHeaderProps = {
  activePath: string;
  onNavigate: Navigate;
};

const navItems = [
  { label: "Product", path: "/product" },
  { label: "Cloud", path: "/cloud" },
  { label: "Pricing", path: "/pricing" },
  { label: "Security", path: "/security" },
  { label: "Download", path: "/download" }
];

const mobileNavItems = [
  { label: "Product", path: "/product" },
  { label: "Cloud", path: "/cloud" },
  { label: "Pricing", path: "/pricing" },
  { label: "Security", path: "/security" },
  { label: "Download", path: "/download" },
  { label: "Docs", path: "/docs" },
  { label: "Self-hosting", path: "/self-hosting" },
  { label: "Changelog", path: "/changelog" },
  { label: "Roadmap", path: "/roadmap" },
  { label: "Legal", path: "/legal" }
];

export function SiteHeader({ activePath, onNavigate }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isLegalActive = activePath.startsWith("/legal");
  const isDocsActive = activePath.startsWith("/docs");

  useEffect(() => {
    document.body.classList.toggle("site-menu-open", isMenuOpen);
    return () => document.body.classList.remove("site-menu-open");
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [activePath]);

  const mobileTitle = useMemo(() => {
    if (isLegalActive) {
      return "Legal";
    }

    if (isDocsActive) {
      return "Docs";
    }

    return mobileNavItems.find((item) => item.path === activePath)?.label ?? "Home";
  }, [activePath, isDocsActive, isLegalActive]);

  const navigate = (path: string) => {
    onNavigate(path);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="site-header">
        <a
          className="site-header__brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
          aria-label="Locoris home"
        >
          <img className="site-header__mark" src="/locoris-icon.svg" alt="" aria-hidden="true" />
          <span>Locoris</span>
        </a>

        <nav className="site-header__nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              key={item.path}
              className={activePath === item.path ? "is-active" : undefined}
              href={item.path}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.path);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-header__actions">
          <a
            className="site-header__link"
            href="/docs"
            onClick={(event) => {
              event.preventDefault();
              navigate("/docs");
            }}
          >
            Docs
          </a>
          <a
            className="premium-button site-header__cta"
            href="/download"
            onClick={(event) => {
              event.preventDefault();
              navigate("/download");
            }}
          >
            Download
          </a>
          <button
            className="site-header__menu-button"
            type="button"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setIsMenuOpen((value) => !value)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className={`site-mobile-menu ${isMenuOpen ? "is-open" : ""}`}
        id="site-mobile-menu"
        aria-hidden={!isMenuOpen}
      >
        <button className="site-mobile-menu__backdrop" type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)} />
        <div className="site-mobile-menu__sheet" role="dialog" aria-modal="true" aria-label="Site navigation">
          <div className="site-mobile-menu__top">
            <div>
              <span>Navigation</span>
              <strong>{mobileTitle}</strong>
            </div>
            <button className="site-mobile-menu__close" type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>
              ×
            </button>
          </div>
          <nav className="site-mobile-menu__nav" aria-label="Mobile navigation">
            {mobileNavItems.map((item) => {
              const isActive =
                item.path === "/legal" ? isLegalActive : item.path === "/docs" ? isDocsActive : activePath === item.path;
              return (
                <a
                  key={item.path}
                  className={isActive ? "is-active" : undefined}
                  href={item.path}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.path);
                  }}
                >
                  <span>{item.label}</span>
                  <small>{item.path}</small>
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
