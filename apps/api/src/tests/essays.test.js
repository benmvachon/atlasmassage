import { jest } from '@jest/globals';
import path from 'path';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';

// multer writes through node:fs, which the fs/promises mock below does not
// cover, so successful uploads land real files in the served directories.
// Snapshot them up front and delete anything a test adds.
const PUBLIC_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'essays'
);
const UPLOAD_DIRS = [path.join(PUBLIC_DIR, 'images'), path.join(PUBLIC_DIR, 'pdfs')];
const preexisting = new Map(
  UPLOAD_DIRS.map(dir => [dir, new Set(existsSync(dir) ? readdirSync(dir) : [])])
);

afterEach(() => {
  for (const dir of UPLOAD_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!preexisting.get(dir).has(name)) unlinkSync(path.join(dir, name));
    }
  }
});

// Closure-captured repository mock — see feedback_jest_esm_mocking: setting the
// implementation in the factory keeps it alive across mockReset of the methods.
const repo = {
  findPublished: jest.fn(),
  findPublishedBySlug: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  nextDisplayOrder: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setPdf: jest.fn(),
  setHeroImage: jest.fn(),
  reorder: jest.fn(),
  delete: jest.fn(),
};

const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockAccess = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({})),
  closePool: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/essayRepository.js', () => ({
  EssayRepository: jest.fn(() => repo),
}));

await jest.unstable_mockModule('fs/promises', () => ({
  default: { unlink: mockUnlink, access: mockAccess },
  unlink: mockUnlink,
  access: mockAccess,
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { issueAccessToken } = await import('../services/tokenService.js');

const ownerBearer = () => `Bearer ${issueAccessToken({ id: 'owner-uuid', roles: ['owner'] })}`;
const clientBearer = () => `Bearer ${issueAccessToken({ id: 'client-uuid', roles: ['client'] })}`;

const ESSAY_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OTHER_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';

const essay = (over = {}) => ({
  id: ESSAY_ID,
  slug: 'low-back-pain',
  title: 'LOW BACK PAIN',
  subtitle: 'Can Massage Therapy Treat Pain In The Lower Back?',
  author: 'Ben Vachon, LMT',
  summary: 'A summary.',
  body_markdown: '## WHAT IS IT?\n\nBody text.[^1]',
  hero_image_path: '/essays/images/low-back-pain.jpg',
  hero_image_alt: 'Alt text',
  pdf_path: '/essays/pdfs/low-back-pain.pdf',
  pdf_filename: 'Atlas Bodywork - Low Back Pain.pdf',
  pdf_size_bytes: 2519541,
  is_published: true,
  display_order: 1,
  ...over,
});

const validPayload = (over = {}) => ({
  title: 'PLANTAR FASCIITIS',
  subtitle: 'Can Massage Therapy Help Heel Pain?',
  author: 'Ben Vachon, LMT',
  summary: 'A summary.',
  bodyMarkdown: '## WHAT IS IT?\n\nBody.',
  isPublished: false,
  ...over,
});

beforeEach(() => {
  Object.values(repo).forEach(fn => fn.mockReset());
  mockUnlink.mockClear().mockResolvedValue(undefined);
  mockAccess.mockClear().mockResolvedValue(undefined);
});

// ── Public ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/essays', () => {
  it('returns published essays', async () => {
    repo.findPublished.mockResolvedValue([essay()]);
    const res = await request(app).get('/api/v1/essays');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].slug).toBe('low-back-pain');
  });

  it('requires no authentication', async () => {
    repo.findPublished.mockResolvedValue([]);
    const res = await request(app).get('/api/v1/essays');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/essays/:slug', () => {
  it('returns the essay body', async () => {
    repo.findPublishedBySlug.mockResolvedValue(essay());
    const res = await request(app).get('/api/v1/essays/low-back-pain');

    expect(res.status).toBe(200);
    expect(res.body.data.body_markdown).toContain('WHAT IS IT?');
  });

  it('404s for an unknown or unpublished essay', async () => {
    repo.findPublishedBySlug.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/essays/draft-essay');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/essays/:slug/pdf', () => {
  it('404s when the essay is not published', async () => {
    repo.findPublishedBySlug.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/essays/draft/pdf');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s when the essay has no PDF attached', async () => {
    repo.findPublishedBySlug.mockResolvedValue(essay({ pdf_path: null }));
    const res = await request(app).get('/api/v1/essays/low-back-pain/pdf');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_PDF');
  });

  it('404s rather than serving a path that escapes the essays directory', async () => {
    repo.findPublishedBySlug.mockResolvedValue(
      essay({ pdf_path: '/essays/../../../../etc/passwd' })
    );
    const res = await request(app).get('/api/v1/essays/low-back-pain/pdf');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_PDF');
  });

  it('404s when the row points at a file that is gone from disk', async () => {
    repo.findPublishedBySlug.mockResolvedValue(essay());
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const res = await request(app).get('/api/v1/essays/low-back-pain/pdf');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_PDF');
  });
});

// ── Admin: authorization ──────────────────────────────────────────────────────

describe('essay admin authorization', () => {
  it('401s without a token', async () => {
    const res = await request(app).get('/api/v1/admin/essays');
    expect(res.status).toBe(401);
  });

  it('403s for a non-owner', async () => {
    const res = await request(app)
      .get('/api/v1/admin/essays')
      .set('Authorization', clientBearer());
    expect(res.status).toBe(403);
  });
});

// ── Admin: CRUD ───────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/essays', () => {
  it('returns drafts alongside published essays', async () => {
    repo.findAll.mockResolvedValue([essay(), essay({ id: OTHER_ID, slug: 'draft', is_published: false })]);

    const res = await request(app)
      .get('/api/v1/admin/essays')
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('POST /api/v1/admin/essays', () => {
  it('derives the slug from the title when none is given', async () => {
    repo.findBySlug.mockResolvedValue(null);
    repo.nextDisplayOrder.mockResolvedValue(4);
    repo.create.mockImplementation(async data => essay({ ...data, id: OTHER_ID }));

    const res = await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'plantar-fasciitis', displayOrder: 4 })
    );
  });

  it('appends new essays to the end of the running order', async () => {
    repo.findBySlug.mockResolvedValue(null);
    repo.nextDisplayOrder.mockResolvedValue(7);
    repo.create.mockImplementation(async data => essay(data));

    await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload());

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ displayOrder: 7 }));
  });

  it('stores an explicit published date at midnight UTC', async () => {
    repo.findBySlug.mockResolvedValue(null);
    repo.nextDisplayOrder.mockResolvedValue(1);
    repo.create.mockImplementation(async data => essay(data));

    await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true, publishedAt: '2026-03-04' }));

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: new Date('2026-03-04T00:00:00Z') })
    );
  });

  it('defaults a newly published essay to today', async () => {
    repo.findBySlug.mockResolvedValue(null);
    repo.nextDisplayOrder.mockResolvedValue(1);
    repo.create.mockImplementation(async data => essay(data));

    await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true }));

    const { publishedAt } = repo.create.mock.calls[0][0];
    expect(publishedAt).toBeInstanceOf(Date);
    expect(Date.now() - publishedAt.getTime()).toBeLessThan(60_000);
  });

  it('leaves a draft without a published date', async () => {
    repo.findBySlug.mockResolvedValue(null);
    repo.nextDisplayOrder.mockResolvedValue(1);
    repo.create.mockImplementation(async data => essay(data));

    await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: false }));

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt: null })
    );
  });

  it('422s for an unparseable published date', async () => {
    const res = await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ publishedAt: 'last tuesday' }));

    expect(res.status).toBe(422);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('409s when the slug is already taken', async () => {
    repo.findBySlug.mockResolvedValue(essay({ id: ESSAY_ID }));

    const res = await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ slug: 'low-back-pain' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('422s when the body is missing', async () => {
    const res = await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ bodyMarkdown: '' }));

    expect(res.status).toBe(422);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('422s for a slug with illegal characters', async () => {
    const res = await request(app)
      .post('/api/v1/admin/essays')
      .set('Authorization', ownerBearer())
      .send(validPayload({ slug: 'Not A Slug!' }));

    expect(res.status).toBe(422);
  });
});

describe('PUT /api/v1/admin/essays/:id', () => {
  it('updates an existing essay', async () => {
    repo.findById.mockResolvedValue(essay());
    repo.findBySlug.mockResolvedValue(null);
    repo.update.mockImplementation(async (_id, data) => essay(data));

    const res = await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true, title: 'LOW BACK PAIN, REVISED' }));

    expect(res.status).toBe(200);
    expect(repo.update).toHaveBeenCalledWith(ESSAY_ID, expect.objectContaining({
      slug: 'low-back-pain-revised',
      isPublished: true,
    }));
  });

  // The edit form has no hero image field — the upload endpoint owns it — so a
  // plain save must not wipe the image the owner already uploaded.
  it('keeps the existing hero image when the payload omits it', async () => {
    repo.findById.mockResolvedValue(essay({ hero_image_path: '/essays/images/kept.jpg' }));
    repo.findBySlug.mockResolvedValue(null);
    repo.update.mockImplementation(async (_id, data) => essay(data));

    await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true }));

    expect(repo.update).toHaveBeenCalledWith(ESSAY_ID, expect.objectContaining({
      heroImagePath: '/essays/images/kept.jpg',
    }));
  });

  it('overwrites the published date when the owner edits it', async () => {
    repo.findById.mockResolvedValue(essay({ published_at: new Date('2026-01-01T00:00:00Z') }));
    repo.findBySlug.mockResolvedValue(null);
    repo.update.mockImplementation(async (_id, data) => essay(data));

    await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true, publishedAt: '2026-05-20' }));

    expect(repo.update).toHaveBeenCalledWith(ESSAY_ID, expect.objectContaining({
      publishedAt: new Date('2026-05-20T00:00:00Z'),
    }));
  });

  it('clears the published date when the owner empties the field', async () => {
    repo.findById.mockResolvedValue(essay({ published_at: new Date('2026-01-01T00:00:00Z') }));
    repo.findBySlug.mockResolvedValue(null);
    repo.update.mockImplementation(async (_id, data) => essay(data));

    await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true, publishedAt: '' }));

    expect(repo.update).toHaveBeenCalledWith(ESSAY_ID, expect.objectContaining({
      publishedAt: null,
    }));
  });

  // Unpublishing and republishing should not silently restamp the date.
  it('preserves the existing published date when none is sent', async () => {
    const existing = new Date('2026-01-01T00:00:00Z');
    repo.findById.mockResolvedValue(essay({ published_at: existing }));
    repo.findBySlug.mockResolvedValue(null);
    repo.update.mockImplementation(async (_id, data) => essay(data));

    await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: false }));

    expect(repo.update).toHaveBeenCalledWith(ESSAY_ID, expect.objectContaining({
      publishedAt: existing,
    }));
  });

  it('lets an essay keep its own slug', async () => {
    repo.findById.mockResolvedValue(essay());
    repo.findBySlug.mockResolvedValue(essay());
    repo.update.mockImplementation(async (_id, data) => essay(data));

    const res = await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ slug: 'low-back-pain', isPublished: true }));

    expect(res.status).toBe(200);
  });

  it('409s when the slug belongs to a different essay', async () => {
    repo.findById.mockResolvedValue(essay());
    repo.findBySlug.mockResolvedValue(essay({ id: OTHER_ID, slug: 'headaches' }));

    const res = await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ slug: 'headaches', isPublished: true }));

    expect(res.status).toBe(409);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('404s for an unknown essay', async () => {
    repo.findById.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer())
      .send(validPayload({ isPublished: true }));

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/admin/essays/reorder', () => {
  it('applies the new order', async () => {
    repo.findAll
      .mockResolvedValueOnce([essay(), essay({ id: OTHER_ID })])
      .mockResolvedValueOnce([essay({ id: OTHER_ID }), essay()]);
    repo.reorder.mockResolvedValue([essay({ id: OTHER_ID }), essay()]);

    const res = await request(app)
      .put('/api/v1/admin/essays/reorder')
      .set('Authorization', ownerBearer())
      .send({ orderedIds: [OTHER_ID, ESSAY_ID] });

    expect(res.status).toBe(200);
    expect(repo.reorder).toHaveBeenCalledWith([OTHER_ID, ESSAY_ID]);
  });

  it('400s when an id is not a known essay', async () => {
    repo.findAll.mockResolvedValue([essay()]);

    const res = await request(app)
      .put('/api/v1/admin/essays/reorder')
      .set('Authorization', ownerBearer())
      .send({ orderedIds: [OTHER_ID] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ORDER');
    expect(repo.reorder).not.toHaveBeenCalled();
  });

  it('400s on a partial order that would drop essays', async () => {
    repo.findAll.mockResolvedValue([essay(), essay({ id: OTHER_ID })]);

    const res = await request(app)
      .put('/api/v1/admin/essays/reorder')
      .set('Authorization', ownerBearer())
      .send({ orderedIds: [ESSAY_ID] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ORDER');
  });

  it('is not swallowed by the /:id route', async () => {
    repo.findAll.mockResolvedValue([essay()]);
    await request(app)
      .put('/api/v1/admin/essays/reorder')
      .set('Authorization', ownerBearer())
      .send({ orderedIds: [ESSAY_ID] });

    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/v1/admin/essays/:id', () => {
  it('deletes the essay and its PDF', async () => {
    repo.delete.mockResolvedValue({ id: ESSAY_ID, pdf_path: '/essays/pdfs/low-back-pain.pdf' });

    const res = await request(app)
      .delete(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it('still succeeds when the PDF is already gone from disk', async () => {
    repo.delete.mockResolvedValue({ id: ESSAY_ID, pdf_path: '/essays/pdfs/low-back-pain.pdf' });
    mockUnlink.mockRejectedValue(new Error('ENOENT'));

    const res = await request(app)
      .delete(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(200);
  });

  it('404s for an unknown essay', async () => {
    repo.delete.mockResolvedValue(null);

    const res = await request(app)
      .delete(`/api/v1/admin/essays/${ESSAY_ID}`)
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/admin/essays/:id/pdf', () => {
  it('400s when no file is attached', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/essays/${ESSAY_ID}/pdf`)
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('rejects a non-PDF upload', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/essays/${ESSAY_ID}/pdf`)
      .set('Authorization', ownerBearer())
      .attach('pdf', Buffer.from('not a pdf'), {
        filename: 'essay.txt',
        contentType: 'text/plain',
      });

    // multer's fileFilter drops the file, so the controller sees no upload.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
    expect(repo.setPdf).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/admin/essays/:id/hero-image', () => {
  it('stores the uploaded image and removes the one it replaced', async () => {
    repo.findById.mockResolvedValue(essay({ hero_image_path: '/essays/images/old.jpg' }));
    repo.setHeroImage.mockImplementation(async (_id, { heroImagePath }) =>
      essay({ hero_image_path: heroImagePath })
    );

    const res = await request(app)
      .post(`/api/v1/admin/essays/${ESSAY_ID}/hero-image`)
      .set('Authorization', ownerBearer())
      .attach('heroImage', Buffer.from('fake-jpeg-bytes'), {
        filename: 'hero.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.hero_image_path).toMatch(/^\/essays\/images\/.+\.jpg$/);
    expect(mockUnlink).toHaveBeenCalledWith(
      expect.stringContaining(`public${path.sep}essays${path.sep}images${path.sep}old.jpg`)
    );
  });

  it('404s and discards the upload when the essay does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    const res = await request(app)
      .post(`/api/v1/admin/essays/${ESSAY_ID}/hero-image`)
      .set('Authorization', ownerBearer())
      .attach('heroImage', Buffer.from('fake-jpeg-bytes'), {
        filename: 'hero.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(404);
    expect(repo.setHeroImage).not.toHaveBeenCalled();
    // The orphaned temp file is cleaned up rather than left on disk.
    expect(mockUnlink).toHaveBeenCalled();
  });

  it('400s when no file is attached', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/essays/${ESSAY_ID}/hero-image`)
      .set('Authorization', ownerBearer());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('rejects a non-image upload', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/essays/${ESSAY_ID}/hero-image`)
      .set('Authorization', ownerBearer())
      .attach('heroImage', Buffer.from('%PDF-1.4'), {
        filename: 'essay.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
    expect(repo.setHeroImage).not.toHaveBeenCalled();
  });
});
