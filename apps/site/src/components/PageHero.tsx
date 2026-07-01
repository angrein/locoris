import type { ReactNode } from "react";
import { MediaSlot } from "./MediaSlot";
import "./PageHero.css";

type PageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  copy: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  mediaTitle?: string;
  mediaFile?: string;
  mediaMobileFile?: string;
  mediaPosterFile?: string;
  mediaKind?: "image" | "video";
  mediaSize?: string;
  mediaDescription?: string;
};

export function PageHero({
  eyebrow,
  title,
  copy,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  mediaTitle,
  mediaFile,
  mediaMobileFile,
  mediaPosterFile,
  mediaKind = "image",
  mediaSize = "2400 x 1400 px",
  mediaDescription
}: PageHeroProps) {
  const hasMedia = mediaTitle && mediaFile && mediaDescription;

  return (
    <section className={hasMedia ? "page-hero page-hero--media" : "page-hero page-hero--plain"}>
      {hasMedia ? (
        <MediaSlot
          className="page-hero__media"
          title={mediaTitle}
          fileName={mediaFile}
          mobileFileName={mediaMobileFile}
          posterFileName={mediaPosterFile}
          kind={mediaKind}
          ratio="wide"
          size={mediaSize}
          description={mediaDescription}
          priority={true}
        />
      ) : null}

      <div className="page-hero__content">
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        {primaryLabel || secondaryLabel ? (
          <div className="page-hero__actions">
            {primaryLabel && primaryHref ? (
              <a className="premium-button" href={primaryHref}>
                {primaryLabel}
              </a>
            ) : null}
            {secondaryLabel && secondaryHref ? (
              <a className="premium-button premium-button--ghost" href={secondaryHref}>
                {secondaryLabel}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
