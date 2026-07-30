// Columns the public reader is allowed to see. body_markdown is included only
// by the detail query — the index would otherwise ship every essay in full.
const PUBLIC_LIST_COLUMNS = `
  id, slug, title, subtitle, author, summary,
  hero_image_path, hero_image_alt, pdf_path, pdf_filename, pdf_size_bytes,
  display_order, published_at`;

export class EssayRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findPublished() {
    const { rows } = await this.pool.query(
      `SELECT ${PUBLIC_LIST_COLUMNS}
       FROM essays
       WHERE is_published = TRUE
       ORDER BY display_order ASC, created_at ASC`
    );
    return rows;
  }

  async findPublishedBySlug(slug) {
    const { rows } = await this.pool.query(
      `SELECT ${PUBLIC_LIST_COLUMNS}, body_markdown
       FROM essays
       WHERE slug = $1 AND is_published = TRUE`,
      [slug]
    );
    return rows[0] ?? null;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT * FROM essays
       ORDER BY display_order ASC, created_at ASC`
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query('SELECT * FROM essays WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async findBySlug(slug) {
    const { rows } = await this.pool.query('SELECT * FROM essays WHERE slug = $1', [slug]);
    return rows[0] ?? null;
  }

  // New essays land at the end of the list rather than colliding on order 0.
  async nextDisplayOrder() {
    const { rows } = await this.pool.query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS next FROM essays'
    );
    return rows[0].next;
  }

  // published_at is stored exactly as given. The controller decides the default
  // for a newly published essay so the owner can always override the date from
  // the dashboard — including backdating an essay written earlier.
  async create({
    slug, title, subtitle, author, summary, bodyMarkdown,
    heroImagePath, heroImageAlt, isPublished, displayOrder, publishedAt,
  }) {
    const { rows } = await this.pool.query(
      `INSERT INTO essays (
         slug, title, subtitle, author, summary, body_markdown,
         hero_image_path, hero_image_alt, is_published, display_order, published_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        slug, title, subtitle ?? '', author ?? '', summary ?? '', bodyMarkdown ?? '',
        heroImagePath ?? null, heroImageAlt ?? '', isPublished ?? false, displayOrder,
        publishedAt ?? null,
      ]
    );
    return rows[0];
  }

  async update(id, {
    slug, title, subtitle, author, summary, bodyMarkdown,
    heroImagePath, heroImageAlt, isPublished, displayOrder, publishedAt,
  }) {
    const { rows } = await this.pool.query(
      `UPDATE essays
       SET slug = $1, title = $2, subtitle = $3, author = $4, summary = $5,
           body_markdown = $6, hero_image_path = $7, hero_image_alt = $8,
           is_published = $9, display_order = $10, published_at = $11,
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [
        slug, title, subtitle ?? '', author ?? '', summary ?? '', bodyMarkdown ?? '',
        heroImagePath ?? null, heroImageAlt ?? '', isPublished, displayOrder ?? 0,
        publishedAt ?? null, id,
      ]
    );
    return rows[0] ?? null;
  }

  async setHeroImage(id, { heroImagePath }) {
    const { rows } = await this.pool.query(
      `UPDATE essays
       SET hero_image_path = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [heroImagePath, id]
    );
    return rows[0] ?? null;
  }

  async setPdf(id, { pdfPath, pdfFilename, pdfSizeBytes }) {
    const { rows } = await this.pool.query(
      `UPDATE essays
       SET pdf_path = $1, pdf_filename = $2, pdf_size_bytes = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [pdfPath, pdfFilename, pdfSizeBytes, id]
    );
    return rows[0] ?? null;
  }

  // Applies an explicit slug -> position mapping in one transaction so the list
  // never reads back half-reordered.
  async reorder(orderedIds) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [index, id] of orderedIds.entries()) {
        await client.query(
          'UPDATE essays SET display_order = $1, updated_at = NOW() WHERE id = $2',
          [index + 1, id]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.findAll();
  }

  async delete(id) {
    const { rows } = await this.pool.query(
      'DELETE FROM essays WHERE id = $1 RETURNING id, pdf_path, hero_image_path',
      [id]
    );
    return rows[0] ?? null;
  }
}
