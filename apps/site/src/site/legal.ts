import { siteConfig } from "./siteConfig";

export type LegalPolicy = {
  slug: string;
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
};

export const legalPolicies: LegalPolicy[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    summary: "Rules for using the Locoris local app, direct downloads, self-hosted sync, and hosted Locoris Cloud services.",
    sections: [
      {
        heading: "Local app and ownership",
        body: [
          "Locoris can be used locally without creating an account. Local vault data remains on the user's device unless the user chooses sync, export, backup, import, support sharing, or another flow that sends data elsewhere.",
          "Users are responsible for keeping local devices, operating-system accounts, backups, exports, and private vault passphrases safe. Locoris cannot protect a device or backup file after it leaves the app's control."
        ]
      },
      {
        heading: "Direct downloads",
        body: [
          "Official desktop and Android builds should be downloaded from the Locoris website or the linked GitHub Release. Checksums are provided so users can verify files before installing.",
          "Until platform stores, notarization, and code-signing coverage are complete, operating systems may show warnings. Users should only bypass warnings after verifying the official checksum."
        ]
      },
      {
        heading: "Hosted and self-hosted services",
        body: [
          "Locoris Cloud is the hosted convenience layer for encrypted sync, account access, history, recovery windows, and future paid services. Hosted plans may enforce storage, traffic, device, vault, rate, and abuse-prevention limits.",
          "Self-hosted sync is an advanced path operated by the user or organization running the server. Locoris cannot guarantee uptime, backups, or security for infrastructure outside Locoris Cloud."
        ]
      },
      {
        heading: "No lock-in rule",
        body: [
          "Canceling a hosted subscription must not remove access to local vaults stored on the user's devices.",
          "Exact backups and readable exports are part of the product promise so users can recover or leave without depending on Locoris Cloud."
        ]
      },
      {
        heading: "Service changes and support",
        body: [
          "Locoris may change hosted features, limits, pricing, or availability with reasonable notice where practical. Local app access should remain separate from paid hosted entitlements.",
          `Support requests can be sent to ${siteConfig.supportEmail}. Security reports should use ${siteConfig.securityEmail}.`
        ]
      }
    ]
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What Locoris stores locally, what Locoris Cloud may process, and how encrypted sync changes server visibility.",
    sections: [
      {
        heading: "Controller and contact",
        body: [
          `Privacy requests can be sent to ${siteConfig.supportEmail}. Security and vulnerability reports should be sent to ${siteConfig.securityEmail}.`,
          "The public privacy copy should be reviewed before paid launch with the actual company/operator details, jurisdiction, billing provider, analytics provider, and support processor list."
        ]
      },
      {
        heading: "Local-first by default",
        body: [
          "The app can be used without an account. Notes, canvas data, planner data, attachments, local settings, backups, and exports are controlled by the user on their own device.",
          "Locoris does not need to receive local vault content unless the user chooses a hosted feature, support path, export upload, import source, or sync provider that sends data elsewhere."
        ]
      },
      {
        heading: "Cloud account data",
        body: [
          "A Locoris Cloud account may process account identifiers, email address, authentication and session metadata, subscription state, support messages, usage limits, quota state, abuse-prevention signals, and operational logs.",
          "Payment details should be handled by the payment provider. Locoris should store only payment state, customer identifiers, invoices or portal references needed to operate subscriptions."
        ]
      },
      {
        heading: "Encrypted vault payloads",
        body: [
          "Private or encrypted sync payloads are encrypted on the client before upload. The hosted service should not receive the private vault passphrase.",
          "The service may still see metadata needed to operate sync, such as account, timestamps, payload sizes, vault identifiers, sync state, device/session identifiers, and operational logs."
        ]
      },
      {
        heading: "Processors and third parties",
        body: [
          "Depending on configuration, Locoris may use infrastructure hosting, email delivery, payment processing, support tooling, and privacy-respecting analytics or error reporting.",
          "Google Drive sync is operated through the user's Google account and stores Locoris sync data in the Google Drive appDataFolder."
        ]
      },
      {
        heading: "Retention and deletion",
        body: [
          "Local data remains under user control on local devices. Hosted account and sync data should be retained only as long as needed for service operation, legal obligations, abuse prevention, billing, backups, and deletion recovery windows.",
          "Account deletion should remove hosted account data and hosted sync payloads according to the published retention policy. Local copies on user devices are not automatically deleted by cloud account deletion."
        ]
      },
      {
        heading: "User rights and requests",
        body: [
          "Users should be able to request access, correction, export, deletion, and subscription/account closure for hosted account data where applicable.",
          "Encrypted private vault content may be unreadable to Locoris, but the encrypted stored objects can still be deleted from hosted infrastructure."
        ]
      }
    ]
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    summary: "How the website and future account surfaces should use cookies, local storage, analytics, and consent.",
    sections: [
      {
        heading: "Current marketing site",
        body: [
          "The static marketing site should not require cookies for basic browsing. Browser storage may be used only for essential UI behavior such as restoring an SPA route after a static-hosting fallback.",
          "If privacy-respecting analytics are enabled, the site should disclose the provider, purpose, retention, and whether cookies or fingerprinting are used."
        ]
      },
      {
        heading: "Account and cloud surfaces",
        body: [
          "Locoris Cloud account pages may use essential cookies or equivalent storage for authentication, CSRF protection, session continuity, fraud prevention, and billing portal handoff.",
          "Non-essential analytics, marketing, or tracking cookies should be disabled until consent is collected where consent is required."
        ]
      },
      {
        heading: "User control",
        body: [
          "Users can block or clear cookies through browser settings. Blocking essential account cookies may prevent sign-in or billing portal access.",
          "If non-essential cookies are introduced, the site should include a clear consent and preference flow before broad public launch."
        ]
      }
    ]
  },
  {
    slug: "refund",
    title: "Refund Policy",
    summary: "A simple, humane refund baseline for future paid hosted cloud plans.",
    sections: [
      {
        heading: "Hosted cloud subscriptions",
        body: [
          "For the first commercial launch, Locoris should offer a clear refund window for hosted cloud subscriptions, such as 14 or 30 days from first payment.",
          "Refunds should not delete local vault data. Cloud access can move to a grace, read-only, or canceled state according to the subscription rules."
        ]
      },
      {
        heading: "Technical issues",
        body: [
          "If a paid hosted service cannot be used because of a Locoris-side service failure, support should provide a refund, credit, or extension where appropriate.",
          "Direct app downloads are not sold separately in the current model, so refunds primarily apply to hosted services."
        ]
      },
      {
        heading: "Abuse and chargebacks",
        body: [
          "Refunds may be refused for fraud, abuse, repeated policy violations, or use that violates the Acceptable Use Policy.",
          "Payment disputes should not affect the user's ability to keep local app data already stored on their own devices."
        ]
      }
    ]
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    summary: "Abuse rules for hosted infrastructure while preserving private local use.",
    sections: [
      {
        heading: "Hosted service safety",
        body: [
          "Locoris Cloud may not be used for malware distribution, unauthorized access, spam, harassment campaigns, illegal content distribution, payment fraud, credential harvesting, or attempts to disrupt service infrastructure.",
          "The policy applies to hosted infrastructure. It does not mean Locoris inspects local-only vaults on user devices."
        ]
      },
      {
        heading: "Infrastructure abuse",
        body: [
          "Hosted accounts may not intentionally overload APIs, bypass quotas, probe private infrastructure, scrape service internals, or use sync storage as a general-purpose file hosting service.",
          "Automated security research should be coordinated through the security contact unless it is limited, non-destructive, and avoids other users' data."
        ]
      },
      {
        heading: "Enforcement",
        body: [
          "Hosted accounts may be rate-limited, suspended, or terminated for abuse, payment fraud, infrastructure attacks, or legal requirements.",
          "Where possible, users should receive a recoverable path to export or delete cloud account data that is not legally restricted."
        ]
      }
    ]
  },
  {
    slug: "data-deletion",
    title: "Data Deletion Policy",
    summary: "How users should be able to delete cloud account data and what remains local.",
    sections: [
      {
        heading: "Local data",
        body: [
          "Deleting a Locoris Cloud account does not automatically remove local vault copies from a user's devices.",
          "Users can delete local vaults, backups, and exports from their devices using app controls and operating-system file tools."
        ]
      },
      {
        heading: "Cloud data",
        body: [
          "A hosted account deletion flow should remove account data and hosted sync data according to the legal retention policy.",
          "Private encrypted payloads may be unreadable to Locoris, but deletion should still remove the stored encrypted objects from hosted infrastructure."
        ]
      },
      {
        heading: "Backups, logs, and retention windows",
        body: [
          "Operational backups and logs may persist for a limited period after deletion requests where needed for security, billing, fraud prevention, legal compliance, and disaster recovery.",
          "The paid launch should publish actual retention windows for account records, billing references, operational logs, hosted sync payloads, and backups."
        ]
      }
    ]
  },
  {
    slug: "licenses",
    title: "Open Source Licenses",
    summary: "Dependency, font, and third-party notices for the app and website.",
    sections: [
      {
        heading: "Dependency notices",
        body: [
          "Locoris uses open-source libraries across the app, editor, canvas, desktop runtime, Android runtime, sync, and website.",
          "The notices below list key direct dependencies and fonts from the current workspace lockfile. A full machine-generated third-party notice bundle should be produced during release packaging."
        ]
      },
      {
        heading: "Fonts and media",
        body: [
          "Website and export fonts must respect their licenses. Bundled export fonts should include readable license files when distributed inside ZIP exports.",
          "Product screenshots and videos should be created from demo vaults and must not include private user data."
        ]
      }
    ]
  },
  {
    slug: "security-contact",
    title: "Security Contact",
    summary: "How to report vulnerabilities and privacy issues responsibly.",
    sections: [
      {
        heading: "Responsible disclosure",
        body: [
          `Send vulnerability reports to ${siteConfig.securityEmail}. Include affected version, platform, reproduction steps, expected impact, and any proof-of-concept details that are safe to share.`,
          "Please avoid accessing, modifying, deleting, or exfiltrating other users' data while investigating an issue."
        ]
      },
      {
        heading: "Response",
        body: [
          "The launch target should include an initial acknowledgement within a few business days, followed by triage, fix planning, and coordinated disclosure where appropriate.",
          "Critical hosted-service issues should be prioritized above cosmetic product issues."
        ]
      },
      {
        heading: "Scope",
        body: [
          "In-scope reports include app data loss, encrypted sync boundary issues, cloud authorization flaws, secret exposure, update/distribution integrity problems, and account/session vulnerabilities.",
          "Out-of-scope reports include purely local device compromise, social engineering, denial-of-service testing without coordination, and reports that require accessing another user's data."
        ]
      }
    ]
  }
];

export const legalUpdatedAt = "June 28, 2026";

export function findLegalPolicy(slug: string): LegalPolicy | undefined {
  return legalPolicies.find((policy) => policy.slug === slug);
}
