# ADR-0013 — Essay Publishing (Pathology)

**Status**: Accepted

**Date**: 2026-07-29

## Context

The practice has written long-form clinical essays about the conditions it treats most often (low back pain, IT band syndrome, chronic headaches). They were authored in Google Docs and exported as PDFs: a title and subtitle, an author byline, an annotated hero photograph, `##`/`###` section structure, superscript citation markers, and a numbered reference list with DOIs.

Two things had to be true at once:

1. **Readers** need to read the essays in the app and take a copy away with them.
2. **The owner** needs to edit existing essays, reorder them, and publish new ones from the admin dashboard — without a deploy and without an export/import round trip.

Requirement 2 rules out storing only PDFs: "editing" would mean re-exporting from a word processor and re-uploading, and a PDF embedded in an `<iframe>` is a poor mobile reading experience with no styling continuity with the rest of the site.

## Decision

Store the essay body as **Markdown in Postgres** as the source of truth for the in-app reader, and serve an **owner-uploaded PDF file** for the download.

**The two are deliberately independent.** Editing the Markdown does not regenerate the PDF; the owner re-uploads when they want the download to match. This was an explicit product choice — see Alternatives.

**Database** (migration `054`): an `essays` table keyed by `slug`, with `body_markdown`, presentation fields (`title`, `subtitle`, `author`, `summary`, `hero_image_path`, `hero_image_alt`), PDF attachment fields (`pdf_path`, `pdf_filename`, `pdf_size_bytes`), and publishing fields (`is_published`, `display_order`, `published_at`). Migration `055` seeds the three existing essays, transcribed from their PDFs.

**Markdown conventions.** Plain Markdown plus two rules that reproduce the source documents' citation apparatus:

- `[^N]` renders as a superscript link to reference N.
- The ordered list following a `## References` heading becomes the reference list; its items receive `id="ref-N"` and a backlink to the citation.

These are implemented in `apps/web/src/utils/essayMarkdown.js` (`marked` → `DOMPurify` → DOM post-processing for heading ids, reference ids, and backlinks). It returns both the sanitized HTML and the heading outline, which drives the reader's contents nav.

**Rendering happens on the client**, and the same `renderEssayMarkdown` powers both the public reader and the owner dashboard's live preview — so what an author sees while editing is what readers get. Output is sanitized even though the author is trusted, because a compromised owner session would otherwise be stored XSS against every reader.

**PDF downloads go through the API, not static hosting.** `apps/api/public/essays/pdfs` is *not* served by `express.static`; `GET /api/v1/essays/:slug/pdf` looks the essay up, refuses unless it is published, resolves the stored path while rejecting anything escaping the essays directory, and sends the file with `Content-Disposition: attachment` under the readable `pdf_filename` ("Atlas Bodywork - Low Back Pain.pdf"). Hero images under `apps/api/public/essays/images` *are* served statically — they are inert and belong to published pages.

**Reordering** is an explicit `PUT /admin/essays/reorder` taking the full ordered id list, applied in one transaction, so the list never reads back half-reordered. The controller rejects orders that reference unknown essays or omit any.

**Hero images are uploaded, not path-edited.** `POST /admin/essays/:id/hero-image` takes a JPEG/PNG/WebP up to 8 MB, stores it under a generated filename in `apps/api/public/essays/images`, and deletes the image it replaced. Alt text stays a form field on the essay itself, since it is prose about the image rather than a property of the file. Uploading needs an essay id, so — as with the PDF — the panel appears only once the essay has been saved.

**`published_at` is owner-editable rather than auto-stamped.** The date is displayed on the index card and the reader byline, so the owner needs to control it: essays are often written well before they go on the site, and a first-publish timestamp would misdate them. The API stores exactly what it is given. It only supplies a default — today — when an essay is published with no date ever set; unpublishing and republishing does not restamp it, and clearing the field hides the date entirely.

The dashboard sends a date-only `YYYY-MM-DD` value, which the API anchors to **midnight UTC**, and the client formats `published_at` back **in UTC**. Both halves are needed: formatting a midnight-UTC timestamp in local time renders the previous day for every reader west of Greenwich.

## Consequences

### Positive

- The owner writes and edits in one place, with a live preview, and publishes without a deploy.
- The reader is a real responsive web page: styled to the site, linkable per section, readable on a phone.
- The download preserves the exact typography of the authored PDFs, which no generated document would reproduce.
- No PDF-generation dependency (no headless Chromium) in the API or CI.

### Negative / Trade-offs

- **The Markdown and the PDF can drift.** Editing the text silently leaves the downloadable file stale. This is the accepted cost of preserving the original documents; the dashboard states it plainly next to the upload control, but nothing enforces it. If drift becomes a real problem, generating the PDF from the Markdown (making it the single source of truth) is the natural follow-up and would supersede this ADR.
- Essay content is transcribed from the PDFs by hand, so the Markdown is a faithful-but-not-byte-identical rendering of the source documents.
- Markdown rendering adds `marked` + `dompurify` to the web bundle, and `marked` is ESM-only, which required a `transformIgnorePatterns` entry in the web Jest config.
- Uploaded PDFs live on the API filesystem alongside headshots, so they need the same treatment as headshots in any future deployment that assumes ephemeral disks.

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| Markdown as source of truth, PDF generated on demand (pdfkit) | Single source of truth and no drift, but adds a PDF-generation dependency and would not reproduce the authored documents' typography or annotated figures. Chosen against deliberately; the natural successor if drift becomes painful |
| PDF only, embedded in a viewer | No in-app text editing — "editing" means re-exporting and re-uploading; poor mobile reading; no styling continuity with the site |
| Rich-text/WYSIWYG editor storing HTML | Larger dependency, and storing HTML makes sanitization and the citation/reference conventions harder to keep consistent |
| Structured section editor (repeatable heading/body blocks) | More guardrails but rigid; anything not shaped like heading+body becomes awkward to author |
| Server-side Markdown rendering | Would duplicate the renderer for the dashboard's live preview, or require a round trip per keystroke |
| Static essays committed as files in the repo | Fails the core requirement: the owner could not publish or edit without a developer and a deploy |
