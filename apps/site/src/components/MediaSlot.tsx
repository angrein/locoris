import { useState } from "react";
import "./MediaSlot.css";

type MediaSlotProps = {
  title: string;
  fileName: string;
  mobileFileName?: string;
  posterFileName?: string;
  kind: "image" | "video";
  ratio: "wide" | "desktop" | "portrait" | "square";
  size: string;
  description: string;
  className?: string;
  priority?: boolean;
};

const ratioClass = {
  wide: "media-slot--wide",
  desktop: "media-slot--desktop",
  portrait: "media-slot--portrait",
  square: "media-slot--square"
};

export function MediaSlot({
  title,
  fileName,
  mobileFileName,
  posterFileName,
  kind,
  ratio,
  size,
  description,
  className,
  priority = false
}: MediaSlotProps) {
  const [isMissing, setIsMissing] = useState(true);
  const src = `/media/${fileName}`;
  const mobileSrc = mobileFileName ? `/media/${mobileFileName}` : undefined;
  const posterSrc = posterFileName ? `/media/${posterFileName}` : undefined;

  return (
    <figure className={`media-slot ${ratioClass[ratio]} ${className ?? ""}`}>
      {kind === "image" ? (
        <picture>
          {mobileSrc ? <source media="(max-width: 720px)" srcSet={mobileSrc} /> : null}
          <img
            className={isMissing ? "media-slot__asset is-hidden" : "media-slot__asset"}
            src={src}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onLoad={() => setIsMissing(false)}
            onError={() => setIsMissing(true)}
          />
        </picture>
      ) : (
        <video
          className={isMissing ? "media-slot__asset is-hidden" : "media-slot__asset"}
          src={src}
          poster={posterSrc}
          muted
          playsInline
          loop
          autoPlay
          preload={priority ? "auto" : "metadata"}
          onLoadedData={() => setIsMissing(false)}
          onError={() => setIsMissing(true)}
        />
      )}

      {isMissing ? (
        <div className="media-slot__placeholder" aria-label={`${title} asset placeholder`}>
          <span className="media-slot__type">{kind === "image" ? "Screenshot" : "Motion"}</span>
          <strong>{title}</strong>
          <p>{description}</p>
          <dl>
            <div>
              <dt>File</dt>
              <dd>{fileName}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{size}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </figure>
  );
}
