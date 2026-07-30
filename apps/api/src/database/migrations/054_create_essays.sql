-- Pathology essays: long-form clinical writing published at /pathology.
--
-- Content model (see docs/adr/ADR-0013-essay-publishing.md):
--   body_markdown is the source of truth for the in-app reader.
--   pdf_path points at an optionally uploaded PDF served for download. The two
--   are deliberately independent — editing the Markdown does not regenerate the
--   PDF, so the owner re-uploads when they want the download to match.

CREATE TABLE essays (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            VARCHAR(120) NOT NULL UNIQUE,
  title           VARCHAR(200) NOT NULL,
  subtitle        VARCHAR(300) NOT NULL DEFAULT '',
  author          VARCHAR(120) NOT NULL DEFAULT '',
  summary         TEXT         NOT NULL DEFAULT '',
  body_markdown   TEXT         NOT NULL DEFAULT '',
  hero_image_path VARCHAR(255),
  hero_image_alt  VARCHAR(300) NOT NULL DEFAULT '',
  pdf_path        VARCHAR(255),
  pdf_filename    VARCHAR(255),
  pdf_size_bytes  INTEGER,
  is_published    BOOLEAN      NOT NULL DEFAULT FALSE,
  display_order   INTEGER      NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- The public index reads published essays in display order; the owner dashboard
-- reads every essay in the same order.
CREATE INDEX idx_essays_published_order ON essays(is_published, display_order, created_at);
CREATE INDEX idx_essays_slug ON essays(slug);
