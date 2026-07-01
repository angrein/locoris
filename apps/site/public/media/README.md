# Locoris Site Media Slots

Put final screenshots and motion captures in this folder. The site already references these file names and will automatically replace the placeholder cards when the assets exist.

## Required Launch Assets

### `hero-locoris-command-center.mp4`

- Type: muted autoplay loop.
- Size: 1920 x 1080 px.
- Length: 10-14 seconds.
- Format: MP4 or WebM.
- Content: move through the real Locoris app with polished demo data. Show notes, canvas, orbital map, and planner. Keep cursor movement calm and avoid unfinished UI.

Also provide:

- `hero-locoris-command-center-poster.jpg` as the video poster.

### `product-notes-canvas-planner.jpg`

- Type: desktop screenshot.
- Size: 2400 x 1500 px.
- Format: JPEG.
- Content: wide workspace view showing editor, canvas or map, and planner context.

Also provide:

- `product-notes-canvas-planner-mobile.jpg` as the mobile-optimized JPEG variant.

### `product-overview-desktop.jpg`

- Type: desktop screenshot.
- Size: 2400 x 1500 px.
- Format: JPEG.
- Content: populated product overview with vault hierarchy, central work surface, and right-side context.

Also provide:

- `product-overview-mobile.jpg` as the mobile-optimized JPEG variant.

### `cloud-sync-flow.mp4`

- Type: muted autoplay loop.
- Size: 1920 x 1080 px. A 1080 x 1920 mobile crop can be added later if the page splits desktop/mobile media.
- Length: 8-12 seconds.
- Format: MP4 or WebM.
- Content: sign in, choose hosted vault, upload encrypted snapshot, and show synced status.

Also provide:

- `cloud-sync-flow-poster.jpg` as the video poster.

### `download-platforms.jpg`

- Type: product collage.
- Size: 2200 x 1300 px.
- Format: JPEG.
- Content: macOS, Windows, Android, and web surfaces. Prefer real product screenshots over decorative device mockups.

Also provide:

- `download-platforms-mobile.jpg` as the mobile-optimized JPEG variant.

### `security-private-vault.jpg`

- Type: product/security screenshot.
- Size: 2200 x 1300 px.
- Format: JPEG.
- Content: private vault unlock, encrypted sync status, or security explanation screen.

Also provide:

- `security-private-vault-mobile.jpg` as the mobile-optimized JPEG variant.

### `self-hosted-setup.jpg`

- Type: docs/setup screenshot or product capture.
- Size: 2000 x 1250 px.
- Format: JPEG.
- Content: server URL, token, and vault binding flow. Keep it calm and non-technical where possible.

Also provide:

- `self-hosted-setup-mobile.jpg` as the mobile-optimized JPEG variant.

## Social Preview

The site root also references `apps/site/public/social-preview.jpg` for OpenGraph and Twitter cards. It should be a 1200 x 630 px or larger branded JPEG with the product name, promise, and a clean app screenshot.

## Capture Guidelines

- Use the latest polished app build.
- Use populated demo data, not empty screens.
- Avoid personal data, local file paths, debug panels, and browser developer tools.
- Hide unfinished or experimental controls.
- Prefer dark glass theme unless a section specifically needs theme comparison.
- Keep text readable at 1440 px wide.
- For motion, use slow transitions and no shaky cursor movement.
