-- Kinesiology & Myology educational reference dataset.
-- Static reference data describing skeletal muscles, the joints (articulations)
-- they cross, and the actions they produce. Seeded in migration 052.
--
-- Model
--   joints          one row per articulation (e.g. Glenohumeral)
--   actions         controlled vocabulary of movements, with their plane/axis
--                   and the opposing action (used to derive antagonists)
--   muscles         one row per muscle (or distinct muscle head/subdivision)
--   muscle_actions  join: a muscle produces an action at a joint. Synergists and
--                   antagonists are DERIVED from this table + actions.opposite_slug
--                   at query time, so they never drift from the source data.
--   joint_fixators  curated muscles that stabilise a proximal segment to give a
--                   movement a fixed base ("where applicable")

CREATE TABLE IF NOT EXISTS joints (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT        UNIQUE NOT NULL,
  name           TEXT        NOT NULL,
  region         TEXT,
  joint_type     TEXT,
  description    TEXT,
  display_order  INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT        UNIQUE NOT NULL,
  name           TEXT        NOT NULL,
  plane          TEXT,
  axis           TEXT,
  description    TEXT,
  -- slug of the anatomically opposing action; NULL when there is no clean
  -- opposite (e.g. lateral flexion). Antagonists are looked up through this.
  opposite_slug  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS muscles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT        UNIQUE NOT NULL,
  name           TEXT        NOT NULL,
  subdivision    TEXT,
  display_name   TEXT        NOT NULL,
  muscle_group   TEXT,
  origin         TEXT,
  insertion      TEXT,
  depth          TEXT,
  innervation    TEXT,
  blood_supply   TEXT,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS muscle_actions (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  muscle_id       UUID    NOT NULL REFERENCES muscles(id) ON DELETE CASCADE,
  joint_id        UUID    NOT NULL REFERENCES joints(id)  ON DELETE CASCADE,
  action_id       UUID    NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  is_prime_mover  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (muscle_id, joint_id, action_id)
);

CREATE TABLE IF NOT EXISTS joint_fixators (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joint_id   UUID NOT NULL REFERENCES joints(id)   ON DELETE CASCADE,
  muscle_id  UUID NOT NULL REFERENCES muscles(id)  ON DELETE CASCADE,
  note       TEXT,
  UNIQUE (joint_id, muscle_id)
);

CREATE INDEX IF NOT EXISTS idx_muscle_actions_joint  ON muscle_actions(joint_id);
CREATE INDEX IF NOT EXISTS idx_muscle_actions_action ON muscle_actions(action_id);
CREATE INDEX IF NOT EXISTS idx_muscle_actions_muscle ON muscle_actions(muscle_id);
CREATE INDEX IF NOT EXISTS idx_joint_fixators_joint  ON joint_fixators(joint_id);
