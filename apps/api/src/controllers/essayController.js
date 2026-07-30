import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { getPool } from '../database/pool.js';
import { EssayRepository } from '../repositories/essayRepository.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../logging/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ESSAY_PUBLIC_DIR = path.join(__dirname, '..', '..', 'public', 'essays');

function repo() {
  return new EssayRepository(getPool());
}

// Mirrors slugify() in packages/shared-utils — duplicated because the API does
// not consume that TypeScript package.
function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Resolves a stored /essays/... path to a real file inside the essays directory,
// refusing anything that escapes it.
function resolveEssayFile(storedPath) {
  const relative = storedPath.replace(/^\/essays\//, '');
  const absolute = path.resolve(ESSAY_PUBLIC_DIR, relative);
  if (absolute !== ESSAY_PUBLIC_DIR && !absolute.startsWith(ESSAY_PUBLIC_DIR + path.sep)) {
    return null;
  }
  return absolute;
}

// The dashboard sends a date-only value (YYYY-MM-DD). Anchoring it to midnight
// UTC keeps the stored timestamp from drifting a day when it is formatted back,
// which is why the reader renders published_at in UTC too.
function normalizePublishedAt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
  return new Date(value);
}

// An essay that goes live without an explicit date is published today; one that
// already carries a date keeps it across edits and unpublish/republish cycles.
function resolvePublishedAt(requested, isPublished, current = null) {
  if (requested !== undefined) return requested;
  if (current) return current;
  return isPublished ? new Date() : null;
}

async function assertSlugAvailable(slug, excludeId = null) {
  const existing = await repo().findBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError('An essay with that slug already exists', 409, 'SLUG_TAKEN');
  }
}

// Best-effort removal of a file the essay no longer points at. A leftover orphan
// is harmless next to failing the request the owner just completed.
async function removeEssayFile(storedPath) {
  if (!storedPath) return;
  const absolute = resolveEssayFile(storedPath);
  if (!absolute) return;
  await fs.unlink(absolute).catch(err => {
    logger.warn('essay_file_cleanup_failed', { path: storedPath, error: err.message });
  });
}

// ── Public ────────────────────────────────────────────────────────────────────

export async function listPublished(_req, res, next) {
  try {
    const essays = await repo().findPublished();
    res.json({ success: true, data: essays });
  } catch (err) {
    next(err);
  }
}

export async function getPublishedBySlug(req, res, next) {
  try {
    const essay = await repo().findPublishedBySlug(req.params.slug);
    if (!essay) throw new AppError('Essay not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: essay });
  } catch (err) {
    next(err);
  }
}

// Streams the attached PDF as an attachment so the browser saves it under the
// readable filename rather than the on-disk one.
export async function downloadPdf(req, res, next) {
  try {
    const essay = await repo().findPublishedBySlug(req.params.slug);
    if (!essay) throw new AppError('Essay not found', 404, 'NOT_FOUND');
    if (!essay.pdf_path) {
      throw new AppError('This essay has no PDF available', 404, 'NO_PDF');
    }

    const absolute = resolveEssayFile(essay.pdf_path);
    if (!absolute) throw new AppError('This essay has no PDF available', 404, 'NO_PDF');

    try {
      await fs.access(absolute);
    } catch {
      logger.error('essay_pdf_missing_on_disk', { slug: essay.slug, path: essay.pdf_path });
      throw new AppError('This essay has no PDF available', 404, 'NO_PDF');
    }

    res.download(absolute, essay.pdf_filename || `${essay.slug}.pdf`);
  } catch (err) {
    next(err);
  }
}

// ── Owner dashboard ───────────────────────────────────────────────────────────

export async function listAll(_req, res, next) {
  try {
    const essays = await repo().findAll();
    res.json({ success: true, data: essays });
  } catch (err) {
    next(err);
  }
}

export async function getEssay(req, res, next) {
  try {
    const essay = await repo().findById(req.params.id);
    if (!essay) throw new AppError('Essay not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: essay });
  } catch (err) {
    next(err);
  }
}

export async function createEssay(req, res, next) {
  try {
    const {
      slug, title, subtitle, author, summary, bodyMarkdown,
      heroImagePath, heroImageAlt, isPublished, displayOrder, publishedAt,
    } = req.body;

    const finalSlug = slugify(slug || title);
    if (!finalSlug) throw new AppError('Could not derive a slug from the title', 400, 'INVALID_SLUG');
    await assertSlugAvailable(finalSlug);

    const essay = await repo().create({
      slug: finalSlug,
      title,
      subtitle,
      author,
      summary,
      bodyMarkdown,
      heroImagePath,
      heroImageAlt,
      isPublished,
      publishedAt: resolvePublishedAt(normalizePublishedAt(publishedAt), isPublished),
      displayOrder: Number.isInteger(displayOrder)
        ? displayOrder
        : await repo().nextDisplayOrder(),
    });

    res.status(201).json({ success: true, data: essay });
  } catch (err) {
    next(err);
  }
}

export async function updateEssay(req, res, next) {
  try {
    const {
      slug, title, subtitle, author, summary, bodyMarkdown,
      heroImagePath, heroImageAlt, isPublished, displayOrder, publishedAt,
    } = req.body;

    const current = await repo().findById(req.params.id);
    if (!current) throw new AppError('Essay not found', 404, 'NOT_FOUND');

    const finalSlug = slugify(slug || title);
    if (!finalSlug) throw new AppError('Could not derive a slug from the title', 400, 'INVALID_SLUG');
    await assertSlugAvailable(finalSlug, current.id);

    const essay = await repo().update(req.params.id, {
      slug: finalSlug,
      title,
      subtitle,
      author,
      summary,
      bodyMarkdown,
      // The image is owned by the upload endpoint, not the form, so a payload
      // that omits it must leave the existing one alone rather than clear it.
      heroImagePath: heroImagePath === undefined ? current.hero_image_path : heroImagePath,
      heroImageAlt,
      isPublished,
      publishedAt: resolvePublishedAt(
        normalizePublishedAt(publishedAt),
        isPublished,
        current.published_at
      ),
      displayOrder: Number.isInteger(displayOrder) ? displayOrder : current.display_order,
    });

    res.json({ success: true, data: essay });
  } catch (err) {
    next(err);
  }
}

export async function reorderEssays(req, res, next) {
  try {
    const { orderedIds } = req.body;

    const all = await repo().findAll();
    const known = new Set(all.map(e => e.id));
    const unknown = orderedIds.filter(id => !known.has(id));
    if (unknown.length > 0) {
      throw new AppError('orderedIds contains unknown essay ids', 400, 'INVALID_ORDER');
    }
    if (orderedIds.length !== all.length) {
      throw new AppError('orderedIds must list every essay exactly once', 400, 'INVALID_ORDER');
    }

    const essays = await repo().reorder(orderedIds);
    res.json({ success: true, data: essays });
  } catch (err) {
    next(err);
  }
}

export async function uploadEssayPdf(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('A PDF file is required', 400, 'NO_FILE');
    }

    const essay = await repo().findById(req.params.id);
    if (!essay) {
      await fs.unlink(req.file.path).catch(() => {});
      throw new AppError('Essay not found', 404, 'NOT_FOUND');
    }

    const previousPath = essay.pdf_path;
    const updated = await repo().setPdf(req.params.id, {
      pdfPath: `/essays/pdfs/${req.file.filename}`,
      pdfFilename: req.body.filename?.trim() || req.file.originalname,
      pdfSizeBytes: req.file.size,
    });

    if (previousPath && previousPath !== updated.pdf_path) {
      await removeEssayFile(previousPath);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function uploadEssayHeroImage(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('An image file is required', 400, 'NO_FILE');
    }

    const essay = await repo().findById(req.params.id);
    if (!essay) {
      await fs.unlink(req.file.path).catch(() => {});
      throw new AppError('Essay not found', 404, 'NOT_FOUND');
    }

    const previousPath = essay.hero_image_path;
    const updated = await repo().setHeroImage(req.params.id, {
      heroImagePath: `/essays/images/${req.file.filename}`,
    });

    if (previousPath && previousPath !== updated.hero_image_path) {
      await removeEssayFile(previousPath);
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteEssay(req, res, next) {
  try {
    const result = await repo().delete(req.params.id);
    if (!result) throw new AppError('Essay not found', 404, 'NOT_FOUND');

    await removeEssayFile(result.pdf_path);
    await removeEssayFile(result.hero_image_path);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
