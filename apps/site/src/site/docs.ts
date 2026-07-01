import { siteConfig } from "./siteConfig";

const docsBase = `${siteConfig.repoUrl}/blob/main/docs`;

export type DocsArticle = {
  slug: string;
  title: string;
  summary: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
  references?: Array<{
    label: string;
    href: string;
  }>;
};

export const docsArticles: DocsArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Install Locoris, open the demo vault, understand the main surfaces, and make the first safe backup.",
    sections: [
      {
        heading: "First run",
        body: [
          "Locoris starts as a local-first workspace. You can use notes, canvas, map, planner, backups, and exports without creating an account.",
          "The first useful action is to explore the demo vault, then create or rename a local vault for real work."
        ]
      },
      {
        heading: "Core surfaces",
        body: [
          "Use notes for structured writing, canvas for visual thinking, orbital map for relationships, and planner for commitments, habits, calendar, and review.",
          "Backups and readable exports are part of the first-run mental model: they explain that the user keeps an exit path."
        ]
      }
    ],
    references: [{ label: "Product overview", href: `${docsBase}/product/overview.md` }]
  },
  {
    slug: "vaults-local-data",
    title: "Vaults and local data",
    summary: "How local vaults, private vaults, backups, exports, and compatibility keys fit together.",
    sections: [
      {
        heading: "Local vaults",
        body: [
          "A vault is the user's working container for projects, folders, notes, canvases, planner data, tags, assets, settings, and sync state.",
          "Local vaults remain useful without cloud registration. Sync is an explicit layer, not the default storage owner."
        ]
      },
      {
        heading: "Compatibility",
        body: [
          "Some internal keys still use legacy names for existing data compatibility. Product UI and public docs should continue to use Locoris naming.",
          "Any migration of legacy keys must read old and new state, preserve private vault passphrase validation, and remain rollback-safe."
        ]
      }
    ],
    references: [
      { label: "Glossary", href: `${docsBase}/product/glossary.md` },
      { label: "Storage compatibility", href: `${docsBase}/product/storage-compatibility.md` }
    ]
  },
  {
    slug: "notes-editor",
    title: "Notes and editor",
    summary: "Structured rich notes for long-term knowledge, project context, exports, and AI-assisted writing.",
    sections: [
      {
        heading: "Editor role",
        body: [
          "Notes are the main structured writing surface. They can carry project context, links, files, tags, and planner references.",
          "The editor should feel native to Locoris: AI and exports are useful when they preserve undo, structure, and readable output."
        ]
      },
      {
        heading: "Readable exports",
        body: [
          "Readable ZIP exports should include HTML/Markdown notes, attachments, and allowed bundled fonts with licenses.",
          "Exact .locorisbackup files remain the full restore format; readable ZIP is the no-lock-in inspection path."
        ]
      }
    ],
    references: [{ label: "Backups and export", href: `${docsBase}/product/backups-and-export.md` }]
  },
  {
    slug: "canvas",
    title: "Canvas",
    summary: "Visual thinking with Excalidraw-backed canvases and export-friendly canvas data.",
    sections: [
      {
        heading: "Canvas role",
        body: [
          "Canvas is for diagrams, sketches, spatial notes, and visual planning that does not fit a linear document.",
          "Canvas files should remain connected to the same vault model as notes, projects, and planner context."
        ]
      },
      {
        heading: "Export behavior",
        body: [
          "Readable exports can include canvas JSON and PNG previews when rendering is available.",
          "Exact backups include canvas data for full Locoris recovery."
        ]
      }
    ],
    references: [{ label: "Backups and export", href: `${docsBase}/product/backups-and-export.md` }]
  },
  {
    slug: "planner-calendar",
    title: "Planner and calendar",
    summary: "Tasks, calendar, recurring work, habits, review, and temporal map signals inside the same workspace.",
    sections: [
      {
        heading: "Planner model",
        body: [
          "Tasks are commitments. Habits are rhythms and check-ins. Calendar is an aggregation surface, not just another task tab.",
          "The planner belongs beside notes, projects, folders, and the map because commitments often come from knowledge work."
        ]
      },
      {
        heading: "Habits and review",
        body: [
          "Today habits can be checked directly. Future habits should be visually quieter and not checkable by default.",
          "Review surfaces should help the user understand overdue, today, upcoming, project, and habit signals without flooding the map."
        ]
      }
    ]
  },
  {
    slug: "sync-options",
    title: "Sync options",
    summary: "Choose Locoris Cloud, self-hosted sync, or Google Drive based on convenience, control, and account requirements.",
    sections: [
      {
        heading: "Locoris Cloud",
        body: [
          "Locoris Cloud is the hosted convenience path for encrypted sync, device continuity, account access, history, recovery windows, and support.",
          "Normal hosted sync should eventually avoid manual token copying and use an app-driven sign-in flow."
        ]
      },
      {
        heading: "Self-hosted and Google Drive",
        body: [
          "Self-hosted sync is the advanced server path for users who want to operate their own remote infrastructure.",
          "Google Drive sync stores Locoris sync data in the user's hidden Drive appDataFolder and uses the user's Google account as the remote provider."
        ]
      }
    ],
    references: [
      { label: "Sync model", href: `${docsBase}/product/sync.md` },
      { label: "Google Drive setup", href: `${docsBase}/setup/google-drive.md` }
    ]
  },
  {
    slug: "private-vaults-e2ee",
    title: "Private vaults and E2EE",
    summary: "Client-side encrypted sync, passphrase responsibility, metadata limits, and recovery expectations.",
    sections: [
      {
        heading: "Encryption model",
        body: [
          "Encrypted sync payloads are encrypted before upload. The hosted server should not receive the private vault passphrase.",
          "It is accurate to say client-side encrypted sync when describing private/encrypted vault flows."
        ]
      },
      {
        heading: "Recovery limits",
        body: [
          "Locoris Cloud cannot recover a lost private vault passphrase. Recovery depends on another unlocked device, a local copy, or a backup.",
          "Security copy should explain metadata visibility and passphrase loss instead of making vague zero-knowledge claims."
        ]
      }
    ],
    references: [
      { label: "Client-side encryption", href: `${docsBase}/product/e2ee.md` },
      { label: "Security terminology", href: `${docsBase}/product/security-terminology.md` }
    ]
  },
  {
    slug: "backups-export",
    title: "Backups and export",
    summary: "Exact .locorisbackup restore files versus readable ZIP/HTML/Markdown exports.",
    sections: [
      {
        heading: "Exact restore",
        body: [
          ".locorisbackup is the full Locoris recovery format. Restoring it can replace the active local vault after explicit confirmation.",
          "Use exact backups before risky imports, destructive cleanup, device migration, or major sync changes."
        ]
      },
      {
        heading: "Readable ZIP",
        body: [
          "Readable ZIP is for inspection outside Locoris. It can include vault hierarchy, Markdown and HTML notes, attachments, canvas JSON, PNG previews, and planner markdown files.",
          "Readable ZIP is not the full recovery format; it is the no-lock-in export path."
        ]
      }
    ],
    references: [{ label: "Backups and export", href: `${docsBase}/product/backups-and-export.md` }]
  },
  {
    slug: "install-notes",
    title: "Install notes",
    summary: "macOS Gatekeeper, Windows SmartScreen, Android sideloading, checksums, and direct release downloads.",
    sections: [
      {
        heading: "Verify first",
        body: [
          "Download installers from the official website or linked GitHub Release, then compare SHA-256 checksums before bypassing operating-system warnings.",
          "If a checksum does not match, delete the file and report it to the security contact."
        ]
      },
      {
        heading: "Platform friction",
        body: [
          "macOS may show Gatekeeper warnings until signing and notarization are complete. Windows may show SmartScreen warnings for young unsigned installers.",
          "Android APK installation requires allowing installs from the browser or file manager until Play Store distribution is available."
        ]
      }
    ],
    references: [{ label: "Download Locoris", href: "/download" }]
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    summary: "Install, sync, private vault, export, and support recovery paths.",
    sections: [
      {
        heading: "Install and update",
        body: [
          "If install warnings appear, verify the checksum and confirm the file came from the official download page.",
          "If update assets fail, download the latest installer manually and keep a fresh .locorisbackup before major changes."
        ]
      },
      {
        heading: "Sync and private vaults",
        body: [
          "If sync is disconnected, confirm provider type, account/session state, remote vault binding, and whether the private vault is locked.",
          "If a private vault passphrase is lost, Locoris Cloud cannot recover it. Try another unlocked device, a local copy, or a backup."
        ]
      },
      {
        heading: "Export and recovery",
        body: [
          "Use .locorisbackup for exact restore. Use readable ZIP when the goal is external inspection or migration.",
          `For support, contact ${siteConfig.supportEmail}. For vulnerability or suspicious installer reports, contact ${siteConfig.securityEmail}.`
        ]
      }
    ]
  }
];

export const docsGroups = [
  {
    title: "Start here",
    items: [
      { title: "Getting started", copy: "Install Locoris, explore the demo vault, and understand the main surfaces.", href: "/docs/getting-started" },
      { title: "Vaults and local data", copy: "Local vaults, private vaults, backups, exports, and compatibility keys.", href: "/docs/vaults-local-data" },
      { title: "Install notes", copy: "Gatekeeper, SmartScreen, Android sideloading, and checksum verification.", href: "/docs/install-notes" }
    ]
  },
  {
    title: "Product surfaces",
    items: [
      { title: "Notes and editor", copy: "Structured rich notes, readable exports, and AI-assisted writing.", href: "/docs/notes-editor" },
      { title: "Canvas", copy: "Visual thinking, diagrams, canvas JSON, and PNG preview exports.", href: "/docs/canvas" },
      { title: "Planner and calendar", copy: "Tasks, habits, review, recurring work, and temporal signals.", href: "/docs/planner-calendar" }
    ]
  },
  {
    title: "Privacy and sync",
    items: [
      { title: "Sync options", copy: "Locoris Cloud, self-hosted sync, and Google Drive sync.", href: "/docs/sync-options" },
      { title: "Private vaults and E2EE", copy: "Client-side encryption, metadata limits, and passphrase recovery.", href: "/docs/private-vaults-e2ee" },
      { title: "Backups and export", copy: "Exact restore files versus readable ZIP/HTML/Markdown export.", href: "/docs/backups-export" }
    ]
  },
  {
    title: "Support",
    items: [
      { title: "Troubleshooting", copy: "Install, sync, private vault, export, and support recovery paths.", href: "/docs/troubleshooting" },
      { title: "Public references", copy: "Current repository docs for technical users and contributors.", href: `${docsBase}/product/overview.md` }
    ]
  }
];

export function findDocsArticle(slug: string): DocsArticle | undefined {
  return docsArticles.find((article) => article.slug === slug);
}
