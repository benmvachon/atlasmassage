CREATE TABLE IF NOT EXISTS testimonials (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name    TEXT        NOT NULL,
  body           TEXT        NOT NULL,
  rating         SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  is_published   BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order  INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
