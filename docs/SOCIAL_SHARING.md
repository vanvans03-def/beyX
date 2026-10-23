# Social previews and Facebook sharing

## Artwork

- `public/beyx-share-v2.png`: site identity, custom typography and geometric arena mark.
- `public/beyx-bracket-v2.png`: bracket identity with a vector tournament diagram.
- Both are 1200 × 630 PNGs, approximately 52 KB / 38 KB. SVG source artwork is beside them. No AI-generated illustration, external image/font requests, image-generation API, or runtime database query is needed for these images.
- Regenerate with `node scripts/setup/generate-social-images.mjs` (uses the existing Sharp dependency).

## Metadata and controls

`src/lib/share-metadata.ts` supplies absolute public image URLs, image dimensions/type/alt text, Open Graph URL/title/description, canonical URL and Twitter large cards. Set `NEXT_PUBLIC_BASE_URL` to the public HTTPS origin **at build time and runtime** when deploying.

The shared tournament page has its own OG URL and organizer name in the title; registration has its own OG URL. Neither borrows the home URL nor performs extra database reads for metadata. The bracket picture is a branded illustration, not a live screenshot or a claim about current tournament status. Events now use the same static brand artwork rather than the legacy image-rendering API.

Removed the two Next file-convention image handlers, which otherwise override configured OG images. Temporary redirects keep `/opengraph-image` and `/register/:id/opengraph-image` resolving to the new static images, including previously cached query-string variants.

The dedicated Facebook share buttons were removed from home and the public bracket page at the user's request. Users can still paste the public page URL directly into Facebook; Open Graph previews and the new artwork remain intact. The homepage Bey playground also has no decorative rectangular border/background; its interactive controls and layout space remain.

## Verification and release

`tests/migration/social-sharing.spec.ts` checks raw HTML with the `facebookexternalhit` User-Agent (without JavaScript), absolute OG URLs in `<head>`, PNG response/content type/dimensions/size and legacy image URLs. Browser tests check that Facebook share buttons are absent, the Bey area is borderless/transparent, its canvas still mounts, and both pages fit desktop, mobile and iPad-sized Chromium. Bracket data in browser tests is stubbed: this does not prove a real Facebook post or Meta's remote crawler/WAF behavior.

Run with the isolated local test environment described in `UX_MOTION_REDESIGN.md`:

```powershell
node scripts/testing/run-migration-e2e.mjs --production social-sharing.spec.ts
```

No production deployment or real Facebook post is part of this change. After deployment, use [Meta Sharing Debugger](https://developers.facebook.com/tools/debug/) for the home URL and a real public tournament URL, select **Scrape Again**, and verify the new preview. A versioned image filename avoids reusing the old image URL, but existing Facebook posts/previews can remain cached. If Meta gets 403/challenge responses, inspect Cloudflare crawler/WAF events for that request rather than disabling protection globally.

Verified 2026-10-22 after removing the buttons/frame: isolated production build passed; final Playwright run **9/9 passed in 1.3 minutes**, across desktop, mobile and iPad-sized Chromium. TypeScript and targeted ESLint passed. OG tags, static images and legacy image redirects still pass; the updated UI assertions confirm no share buttons and a transparent borderless Bey area. Raw final report: `test-results/social-sharing-results.json`; UI screenshots: `test-results/migration/social-sharing-*/`. Local test server/proxy and the task-owned test database container were stopped afterward.

References: [Open Graph protocol](https://ogp.me/), [Next.js metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images).
