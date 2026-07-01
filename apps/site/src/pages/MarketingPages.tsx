import { useState } from "react";
import { MediaSlot } from "../components/MediaSlot";
import { PageHero } from "../components/PageHero";
import { changelogEntries } from "../site/changelog";
import { docsGroups, findDocsArticle } from "../site/docs";
import { downloadTargets, releaseNotes, selfHostedDownloadCallout, verificationSteps } from "../site/downloads";
import { findLegalPolicy, legalPolicies, legalUpdatedAt } from "../site/legal";
import { applicationNotices, fontNotices, websiteNotices } from "../site/openSourceNotices";
import { publicRoadmap } from "../site/roadmap";
import { securityPrinciples, trustMatrix } from "../site/security";
import { siteConfig } from "../site/siteConfig";
import "./MarketingPages.css";

const pillars = [
  {
    title: "Notes that stay connected",
    copy: "Write structured documents, keep rich context, and connect notes to projects, folders, tags, planner items, and canvas work."
  },
  {
    title: "Canvas and map thinking",
    copy: "Move from linear notes into visual exploration with canvas and an orbital map that keeps relationships visible."
  },
  {
    title: "Planning inside the same system",
    copy: "Tasks, habits, calendar, review, reminders, and project signals live beside the knowledge they came from."
  }
];

const trustItems = [
  "Local-first by default",
  "Client-side encrypted sync",
  "Readable ZIP and backup exports",
  "Cloud, self-hosted, or Google Drive sync"
];

const workflowSteps = [
  {
    number: "01",
    title: "Capture",
    copy: "Start with a note, an idea, a file, or a project fragment. Locoris keeps the entry point calm and fast."
  },
  {
    number: "02",
    title: "Structure",
    copy: "Use projects, folders, tags, links, and rich blocks when the thought needs shape instead of another loose page."
  },
  {
    number: "03",
    title: "Map",
    copy: "Move into canvas or orbital map when relationships matter more than a linear document."
  },
  {
    number: "04",
    title: "Plan",
    copy: "Turn context into tasks, dates, habits, and review loops without leaving the knowledge workspace."
  },
  {
    number: "05",
    title: "Sync and exit",
    copy: "Use encrypted cloud, self-hosted sync, or Google Drive, with readable backups when you need to leave."
  }
];

const homeHighlights = [
  {
    title: "Editor",
    copy: "Rich documents for serious notes, not just plain text fragments."
  },
  {
    title: "Canvas",
    copy: "A visual workspace for diagrams, sketches, and non-linear project thinking."
  },
  {
    title: "Orbital map",
    copy: "A relationship view that helps you see projects, notes, folders, and signals together."
  },
  {
    title: "Planner",
    copy: "Tasks, habits, goals, calendar, review, and temporal signals connected to the same knowledge base."
  },
  {
    title: "AI",
    copy: "Gemini-powered writing and canvas generation designed to stay native to the editor and canvas."
  },
  {
    title: "Backups",
    copy: "Exact backups plus readable ZIP exports with HTML/Markdown notes and portable structure."
  }
];

const pricingPlans = [
  {
    name: "Local",
    price: "Free",
    label: "No account required",
    items: ["Local vaults", "Notes, canvas, map, planner", "Readable backup and export", "Google Drive and self-hosted sync"]
  },
  {
    name: "Personal Cloud",
    price: "Planned",
    label: "Paid hosted sync",
    items: ["Hosted encrypted sync", "Several devices", "Private vault support", "History and recovery window"]
  },
  {
    name: "Pro",
    price: "Planned",
    label: "More cloud capacity",
    items: ["More storage", "More vaults and devices", "Advanced cloud snapshots", "Priority support"]
  }
];

const productStack = [
  "Rich notes with BlockNote editing",
  "Canvas based on Excalidraw",
  "Orbital map for relationships",
  "Planner with tasks, calendar, habits, review, and goals",
  "Gemini AI integration with deliberate user action",
  "Readable backup and export paths"
];

export function HomePage() {
  return (
    <>
      <PageHero
        eyebrow="Private local-first workspace"
        title="Locoris"
        copy="Notes, canvas, orbital map, planner, habits, AI, backups, and encrypted sync in one calm system for serious personal work."
        primaryLabel="Download"
        primaryHref="/download"
        secondaryLabel="Try in browser"
        secondaryHref={siteConfig.webAppUrl}
        mediaTitle="Locoris command center"
        mediaFile="hero-locoris-command-center.mp4"
        mediaPosterFile="hero-locoris-command-center-poster.jpg"
        mediaKind="video"
        mediaSize="1920 x 1080 px, 10-14 s, MP4, muted loop"
        mediaDescription="Capture the real app moving between notes, canvas, orbital map, and planner. Keep the cursor calm and show polished populated data."
      />

      <section className="page-section page-section--tight">
        <div className="trust-strip">
          {trustItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="page-section feature-intro">
        <div>
          <p className="section-kicker">One workspace</p>
          <h2 className="section-title">
            Think, connect, plan, and return to your work without <span className="text-marker">switching</span> systems.
          </h2>
        </div>
        <div className="feature-grid">
          {pillars.map((pillar) => (
            <article className="feature-card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-section workflow-section">
        <div className="workflow-section__intro">
          <p className="section-kicker">How it works</p>
          <h2 className="section-title">
            From scattered thought to a <span className="text-marker">system</span> you can actually return to.
          </h2>
          <p className="section-copy">
            Locoris explains itself through product surfaces: notes, canvas, map, planner, sync, and backups are one workflow, not separate apps.
          </p>
        </div>
        <div className="workflow-track">
          {workflowSteps.map((step) => (
            <article className="workflow-step" key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-section split-section">
        <div>
          <p className="section-kicker">Product flow</p>
          <h2 className="section-title">
            A workspace that moves from idea to <span className="text-marker text-marker--gold">execution</span>.
          </h2>
          <p className="section-copy">
            Locoris is designed for people who write, map, connect, schedule, review, and keep ownership of the system that holds their work.
          </p>
        </div>
        <MediaSlot
          title="Notes, canvas, planner flow"
          fileName="product-notes-canvas-planner.jpg"
          mobileFileName="product-notes-canvas-planner-mobile.jpg"
          kind="image"
          ratio="desktop"
          size="2400 x 1500 px, JPEG"
          description="Wide screenshot showing a premium populated desktop workspace: editor, canvas or map, and planner context."
        />
      </section>

      <section className="page-section highlight-section">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Feature pillars</p>
            <h2 className="section-title">
              Enough <span className="text-marker">structure</span> for complex work. Enough calm to keep using it daily.
            </h2>
          </div>
          <p>Every major surface is connected to the same vault model, so planning and thinking stay close to the notes that created them.</p>
        </div>
        <div className="highlight-grid">
          {homeHighlights.map((item) => (
            <article className="highlight-card" key={item.title}>
              <span>{item.title}</span>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-section cloud-band">
        <div>
          <p className="section-kicker">Sync your way</p>
          <h2 className="section-title">
            Hosted cloud when you want convenience. Self-hosting when you want <span className="text-marker">control</span>.
          </h2>
          <p className="section-copy">
            Locoris Cloud is the paid convenience layer. The app remains local-first, and advanced users can keep using self-hosted or Google Drive sync.
          </p>
        </div>
        <div className="sync-lanes">
          <span>Local vault</span>
          <span>Client-side encrypted payloads</span>
          <span>Locoris Cloud</span>
          <span>Self-hosted</span>
          <span>Google Drive</span>
        </div>
      </section>

      <PricingPreview />
      <DownloadPreview />
    </>
  );
}

export function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Product"
        title={
          <>
            Built for deep <span className="text-marker">personal</span> systems.
          </>
        }
        copy="Locoris combines structured notes, visual canvas, orbital mapping, planner workflows, backups, and AI without making an account the center of the product."
        mediaTitle="Desktop product overview"
        mediaFile="product-overview-desktop.jpg"
        mediaMobileFile="product-overview-mobile.jpg"
        mediaKind="image"
        mediaSize="2400 x 1500 px, JPEG"
        mediaDescription="Use a clean desktop screenshot with demo data: left vault hierarchy, editor or map center, inspector/planner context on the right."
      />
      <section className="page-section product-stack">
        {productStack.map((item) => (
          <article className="feature-card" key={item}>
            <h3>{item}</h3>
            <p>Designed as a first-class Locoris surface, not a bolted-on utility.</p>
          </article>
        ))}
      </section>
      <SecuritySummary />
    </>
  );
}

export function CloudPage() {
  return (
    <>
      <PageHero
        eyebrow="Locoris Cloud"
        title={
          <>
            Encrypted <span className="text-marker">sync</span> without surrendering your workspace.
          </>
        }
        copy="The hosted service sells convenience: automatic encrypted sync, web access, device continuity, history, recovery windows, and support."
        mediaTitle="Cloud sync connection flow"
        mediaFile="cloud-sync-flow.mp4"
        mediaPosterFile="cloud-sync-flow-poster.jpg"
        mediaKind="video"
        mediaSize="1920 x 1080 px desktop plus optional 1080 x 1920 px mobile crop"
        mediaDescription="Record the future premium flow: sign in, choose vault, upload encrypted snapshot, and show synced status."
      />
      <section className="page-section cloud-detail">
        <article className="glass-panel detail-panel">
          <h2>What the cloud sells</h2>
          <p>Hosted sync, version history, web access, device handoff, recovery, and support. The local app remains useful without an account.</p>
        </article>
        <article className="glass-panel detail-panel">
          <h2>What remains user-owned</h2>
          <p>Local data, readable backups, export paths, self-hosted sync, and Google Drive sync. Cancellation must never lock users out of local vaults.</p>
        </article>
      </section>
    </>
  );
}

export function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title={
          <>
            Free <span className="text-marker">locally</span>. Paid for hosted convenience.
          </>
        }
        copy="The commercial model keeps Locoris generous where it matters and charges for reliable cloud infrastructure, recovery, web access, and support."
      />
      <PricingPreview />
      <section className="page-section notice-panel">
        <h2>Launch pricing note</h2>
        <p>
          Paid cloud prices are intentionally marked as planned until billing, storage limits, taxes, subscription states, and refund flows are implemented.
        </p>
      </section>
    </>
  );
}

export function DownloadPage() {
  return (
    <>
      <PageHero
        eyebrow="Download"
        title={
          <>
            Official <span className="text-marker">downloads</span> without sending users through GitHub.
          </>
        }
        copy={`Latest stable: Locoris ${releaseNotes.version}. Download official release assets, verify checksums, and follow platform-specific install notes.`}
        mediaTitle="Download page platform collage"
        mediaFile="download-platforms.jpg"
        mediaMobileFile="download-platforms-mobile.jpg"
        mediaKind="image"
        mediaSize="2200 x 1300 px, JPEG"
        mediaDescription="Create a clean product collage with macOS, Windows, Android, and web surfaces. Avoid fake device frames if real screenshots are available."
      />
      <DownloadPreview full />
    </>
  );
}

export function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title={
          <>
            <span className="text-marker">Private</span> by design, precise in claims.
          </>
        }
        copy="Locoris is local-first and supports client-side encrypted sync. This page explains what the server can see, what it should not receive, and what users must protect."
        mediaTitle="Private vault and encrypted sync"
        mediaFile="security-private-vault.jpg"
        mediaMobileFile="security-private-vault-mobile.jpg"
        mediaKind="image"
        mediaSize="2200 x 1300 px, JPEG"
        mediaDescription="Screenshot or composed product capture showing private vault unlock, encrypted sync status, and a readable security explanation."
      />
      <SecuritySummary full />
    </>
  );
}

export function SelfHostingPage() {
  return (
    <>
      <PageHero
        eyebrow="Self-hosting"
        title={
          <>
            <span className="text-marker">Control</span> for advanced users.
          </>
        }
        copy="Self-hosted sync is a trust feature and a serious differentiator. It stays available, documented, and clearly separated from the paid hosted convenience layer."
      />
      <section className="page-section split-section">
        <div>
          <p className="section-kicker">Advanced path</p>
          <h2 className="section-title">
            Self-hosting should be <span className="text-marker">powerful</span>, but not the default onboarding path.
          </h2>
          <p className="section-copy">
            Normal users should connect Locoris Cloud in one polished flow. Advanced users can still run their own server and use manual tokens.
          </p>
        </div>
        <MediaSlot
          title="Self-hosted setup guide"
          fileName="self-hosted-setup.jpg"
          mobileFileName="self-hosted-setup-mobile.jpg"
          kind="image"
          ratio="desktop"
          size="2000 x 1250 px, JPEG"
          description="Capture a polished docs/setup screen or terminal-free diagram showing server URL, token, and vault binding."
        />
      </section>
    </>
  );
}

export function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Docs"
        title={
          <>
            Documentation that matches the actual <span className="text-marker">product</span>.
          </>
        }
        copy="Start with current product docs for vaults, sync, encryption, backups, installation, and data ownership. Stale architecture notes stay out of the public path."
      />
      <section className="page-section docs-hub">
        {docsGroups.map((group) => (
          <article className="docs-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="docs-list">
              {group.items.map((item) => (
                <a className="doc-row" href={item.href} key={item.title}>
                  <span>{item.title}</span>
                  <small>{item.copy}</small>
                </a>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

type DocsArticlePageProps = {
  articleSlug: string;
};

export function DocsArticlePage({ articleSlug }: DocsArticlePageProps) {
  const article = findDocsArticle(articleSlug);

  if (!article) {
    return <NotFoundPage />;
  }

  return (
    <>
      <PageHero
        eyebrow="Docs"
        title={
          <>
            {article.title} <span className="text-marker">guide</span>.
          </>
        }
        copy={article.summary}
      />
      <section className="page-section docs-article">
        <div className="docs-article__meta">
          <span>Guide</span>
          <strong>{article.title}</strong>
          <a href="/docs">All docs</a>
        </div>
        <div className="docs-article__body">
          {article.sections.map((section) => (
            <article className="glass-panel detail-panel" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
          {article.references?.length ? (
            <article className="glass-panel detail-panel docs-article__references">
              <h2>References</h2>
              <div>
                {article.references.map((reference) => (
                  <a className="premium-button premium-button--ghost" href={reference.href} key={reference.href}>
                    {reference.label}
                  </a>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function RoadmapPage() {
  return (
    <>
      <PageHero
        eyebrow="Roadmap"
        title={
          <>
            A public roadmap that builds <span className="text-marker">confidence</span>.
          </>
        }
        copy="This roadmap shows product direction without exposing private commercial planning, infrastructure details, or sensitive launch mechanics."
      />
      <section className="page-section roadmap-list">
        {publicRoadmap.map((group, index) => (
          <article className="roadmap-item" key={group.stage}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>{group.stage}</small>
              <h2>{group.title}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export function ChangelogPage() {
  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title={
          <>
            Release notes for <span className="text-marker">real</span> users.
          </>
        }
        copy="Readable release notes should explain meaningful product and distribution improvements, not only internal commit summaries."
      />
      <section className="page-section changelog-list">
        {changelogEntries.map((entry) => (
          <article className="glass-panel changelog-entry" key={entry.version}>
            <span>{entry.label}</span>
            <h2>Locoris {entry.version}</h2>
            <p>{entry.date}</p>
            <p>{entry.summary}</p>
            <div className="changelog-entry__columns">
              <div>
                <h3>New</h3>
                <ul>
                  {entry.newItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Improved</h3>
                <ul>
                  {entry.improvedItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Fixed</h3>
                <ul>
                  {entry.fixedItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Known notes</h3>
                <ul>
                  {entry.knownItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <a className="premium-button premium-button--ghost" href={entry.href}>
              View GitHub release
            </a>
          </article>
        ))}
      </section>
    </>
  );
}

type LegalPageProps = {
  policySlug?: string;
};

export function LegalPage({ policySlug }: LegalPageProps = {}) {
  const policy = policySlug ? findLegalPolicy(policySlug) : undefined;

  if (policy) {
    return (
      <>
        <PageHero
          eyebrow="Legal"
          title={
            <>
              {policy.title.replace(" Policy", "")} <span className="text-marker">policy</span>.
            </>
          }
          copy={policy.summary}
        />
        <section className="page-section legal-policy">
          <div className="legal-policy__meta">
            <span>Last updated</span>
            <strong>{legalUpdatedAt}</strong>
            <a href="/legal">All legal pages</a>
          </div>
          <div className="legal-policy__body">
            {policy.sections.map((section) => (
              <article className="glass-panel detail-panel" key={section.heading}>
                <h2>{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </article>
            ))}
            {policy.slug === "licenses" ? <OpenSourceNotices /> : null}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={
          <>
            Clear policies before paid <span className="text-marker">cloud</span>.
          </>
        }
        copy="Legal pages are part of the premium experience. Users should understand data handling, refunds, deletion, licenses, and security contact paths before paying."
      />
      <section className="page-section legal-grid">
        {legalPolicies.map((item) => (
          <a className="feature-card legal-card" href={`/legal/${item.slug}`} key={item.slug}>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <span>Read policy</span>
          </a>
        ))}
      </section>
    </>
  );
}

function OpenSourceNotices() {
  const groups = [
    { title: "Application", notices: applicationNotices },
    { title: "Website", notices: websiteNotices },
    { title: "Fonts", notices: fontNotices }
  ];

  return (
    <article className="glass-panel detail-panel notices-panel">
      <h2>Current direct notices</h2>
      <p>
        This table lists key direct dependencies from the current workspace. Transitive dependency notices should be generated as part of
        release packaging.
      </p>
      {groups.map((group) => (
        <div className="notices-panel__group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="notice-table">
            {group.notices.map((notice) => (
              <a href={notice.url} key={`${notice.name}-${notice.version}`}>
                <span>{notice.name}</span>
                <small>{notice.version}</small>
                <small>{notice.license}</small>
                <p>{notice.usage}</p>
              </a>
            ))}
          </div>
        </div>
      ))}
    </article>
  );
}

export function NotFoundPage() {
  return (
    <PageHero
      eyebrow="Not found"
      title={
        <>
          This page is not <span className="text-marker">ready</span>.
        </>
      }
      copy="Return to the product overview or download page."
      primaryLabel="Product"
      primaryHref="/product"
      secondaryLabel="Download"
      secondaryHref="/download"
    />
  );
}

function PricingPreview() {
  return (
    <section className="page-section pricing-section">
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Pricing direction</p>
          <h2 className="section-title">
            A generous app with a paid <span className="text-marker">cloud</span> layer.
          </h2>
        </div>
        <p>Pricing is visible before account creation, but paid plan numbers should wait until billing and limits are real.</p>
      </div>

      <div className="pricing-grid">
        {pricingPlans.map((plan) => (
          <article className="pricing-card" key={plan.name}>
            <span>{plan.label}</span>
            <h3>{plan.name}</h3>
            <strong>{plan.price}</strong>
            <ul>
              {plan.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

type DownloadPreviewProps = {
  full?: boolean;
};

function DownloadPreview({ full = false }: DownloadPreviewProps) {
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  const copyChecksum = async (checksum: string, title: string) => {
    try {
      await navigator.clipboard.writeText(checksum);
      setCopiedChecksum(title);
      window.setTimeout(() => setCopiedChecksum(null), 1800);
    } catch {
      setCopiedChecksum("Copy failed");
    }
  };

  return (
    <section className="page-section download-section">
      <div>
        <p className="section-kicker">Distribution</p>
        <h2 className="section-title">
          Official downloads without making GitHub the <span className="text-marker">storefront</span>.
        </h2>
        <p className="section-copy">
          GitHub Releases stay transparent, while the website gives users the polished download path, checksums, platform notes, and release context.
        </p>

        {full ? (
          <div className="release-panel glass-panel">
            <span>Latest stable</span>
            <strong>Locoris {releaseNotes.version}</strong>
            <p>{releaseNotes.summary}</p>
            <a href={releaseNotes.href}>View release notes</a>
          </div>
        ) : null}
      </div>

      <div className="download-grid">
        {downloadTargets.map((target) => (
          <article className="download-card" key={target.platform}>
            <span>{target.badge}</span>
            <h3>{target.title}</h3>
            <p>{target.copy}</p>
            <dl className="download-card__meta">
              <div>
                <dt>Requires</dt>
                <dd>{target.requirements}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{target.version}</dd>
              </div>
              {target.fileName ? (
                <div>
                  <dt>File</dt>
                  <dd>{target.fileName}</dd>
                </div>
              ) : null}
              {target.size ? (
                <div>
                  <dt>Size</dt>
                  <dd>{target.size}</dd>
                </div>
              ) : null}
            </dl>

            {target.checksum ? (
              <div className="checksum-box">
                <small>SHA-256</small>
                <code>{target.checksum}</code>
                <button type="button" onClick={() => copyChecksum(target.checksum ?? "", target.title)}>
                  {copiedChecksum === target.title ? "Copied" : "Copy"}
                </button>
              </div>
            ) : null}

            <div className="download-card__actions">
              {target.href ? (
                <a className="premium-button" href={target.href}>
                  {target.primaryLabel}
                </a>
              ) : (
                <button className="premium-button" type="button" disabled>
                  {target.primaryLabel}
                </button>
              )}
              {target.secondaryLabel && target.secondaryHref ? (
                <a className="premium-button premium-button--ghost" href={target.secondaryHref}>
                  {target.secondaryLabel}
                </a>
              ) : null}
            </div>

            {full ? (
              <ul className="install-notes">
                {target.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      {full ? (
        <>
          <div className="self-hosted-callout glass-panel">
            <div>
              <span>{selfHostedDownloadCallout.badge}</span>
              <h2>{selfHostedDownloadCallout.title}</h2>
              <p>{selfHostedDownloadCallout.copy}</p>
            </div>
            <ul>
              {selfHostedDownloadCallout.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="download-card__actions">
              <a className="premium-button" href={selfHostedDownloadCallout.href}>
                Self-hosting guide
              </a>
              <a className="premium-button premium-button--ghost" href={selfHostedDownloadCallout.secondaryHref}>
                Release assets
              </a>
            </div>
          </div>

          <div className="verification-panel glass-panel">
            <div>
              <p className="section-kicker">Verify before install</p>
              <h2>Checksum workflow</h2>
            </div>
            <ol>
              {verificationSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
    </section>
  );
}

type SecuritySummaryProps = {
  full?: boolean;
};

function SecuritySummary({ full = false }: SecuritySummaryProps) {
  return (
    <>
      <section className="page-section security-grid">
        {securityPrinciples.map((item) => (
          <article className="feature-card" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      {full ? (
        <>
          <section className="page-section trust-matrix">
            <div>
              <p className="section-kicker">Trust model</p>
              <h2 className="section-title">
                Clear claims beat vague <span className="text-marker">privacy</span> slogans.
              </h2>
              <p className="section-copy">
                Locoris can say local-first and client-side encrypted sync. It should not imply that metadata, account state, or operational logs do not exist.
              </p>
            </div>
            <div className="trust-matrix__table">
              {trustMatrix.map((row) => (
                <article key={row.subject}>
                  <h3>{row.subject}</h3>
                  <p>
                    <strong>Locoris visibility:</strong> {row.visibleToLocoris}
                  </p>
                  <p>
                    <strong>User responsibility:</strong> {row.userResponsibility}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="page-section notice-panel">
            <h2>Security contact</h2>
            <p>
              Report vulnerabilities to <a href={`mailto:${siteConfig.securityEmail}`}>{siteConfig.securityEmail}</a>. Include affected version,
              platform, reproduction steps, and expected impact.
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}
