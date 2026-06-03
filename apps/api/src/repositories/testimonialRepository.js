export class TestimonialRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findPublished() {
    const { rows } = await this.pool.query(
      `SELECT id, author_name, body, rating, display_order
       FROM testimonials
       WHERE is_published = TRUE
       ORDER BY display_order ASC, created_at ASC`
    );
    return rows;
  }

  async findAll() {
    const { rows } = await this.pool.query(
      `SELECT id, author_name, body, rating, is_published, display_order, created_at, updated_at
       FROM testimonials
       ORDER BY display_order ASC, created_at ASC`
    );
    return rows;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM testimonials WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  async create({ authorName, body, rating, isPublished, displayOrder }) {
    const { rows } = await this.pool.query(
      `INSERT INTO testimonials (author_name, body, rating, is_published, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [authorName, body, rating ?? null, isPublished ?? true, displayOrder ?? 0]
    );
    return rows[0];
  }

  async update(id, { authorName, body, rating, isPublished, displayOrder }) {
    const { rows } = await this.pool.query(
      `UPDATE testimonials
       SET author_name = $1, body = $2, rating = $3,
           is_published = $4, display_order = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [authorName, body, rating ?? null, isPublished, displayOrder ?? 0, id]
    );
    return rows[0] ?? null;
  }

  async delete(id) {
    const { rows } = await this.pool.query(
      'DELETE FROM testimonials WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] ?? null;
  }
}
