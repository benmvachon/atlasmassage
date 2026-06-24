/**
 * Read-only access to the kinesiology / myology reference dataset
 * (joints, actions, muscles and the muscle_actions that link them).
 *
 * Synergists, antagonists and fixators are not stored explicitly — they are
 * derived here from muscle_actions + actions.opposite_slug so the relationships
 * can never drift from the underlying muscle/action data.
 */

// Lean muscle shape used inside list responses.
const MUSCLE_CARD = `
  m.slug, m.name, m.subdivision, m.display_name, m.muscle_group, m.depth
`;

export class AnatomyRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async listJoints() {
    const { rows } = await this.pool.query(
      `SELECT slug, name, region, joint_type, description
         FROM joints
        ORDER BY display_order, name`
    );
    return rows;
  }

  async findJoint(slug) {
    const { rows } = await this.pool.query(
      `SELECT slug, name, region, joint_type, description FROM joints WHERE slug = $1`,
      [slug]
    );
    return rows[0] ?? null;
  }

  /** Actions that at least one muscle performs at the given joint. */
  async actionsForJoint(slug) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT a.slug, a.name, a.plane, a.axis, a.description, a.opposite_slug
         FROM actions a
         JOIN muscle_actions ma ON ma.action_id = a.id
         JOIN joints j ON j.id = ma.joint_id
        WHERE j.slug = $1
        ORDER BY a.name`,
      [slug]
    );
    return rows;
  }

  /** Every muscle acting at the joint, with the action(s) it performs there. */
  async musclesForJoint(slug) {
    const { rows } = await this.pool.query(
      `SELECT ${MUSCLE_CARD},
              json_agg(
                json_build_object('slug', a.slug, 'name', a.name,
                                  'isPrimeMover', ma.is_prime_mover)
                ORDER BY ma.is_prime_mover DESC, a.name
              ) AS actions
         FROM muscle_actions ma
         JOIN joints  j ON j.id = ma.joint_id AND j.slug = $1
         JOIN muscles m ON m.id = ma.muscle_id
         JOIN actions a ON a.id = ma.action_id
        GROUP BY m.id
        ORDER BY m.display_name`,
      [slug]
    );
    return rows;
  }

  /** Muscles performing a specific action at a joint (agonist + synergists). */
  async musclesForJointAction(jointSlug, actionSlug) {
    const { rows } = await this.pool.query(
      `SELECT ${MUSCLE_CARD}, ma.is_prime_mover
         FROM muscle_actions ma
         JOIN joints  j ON j.id = ma.joint_id AND j.slug = $1
         JOIN actions a ON a.id = ma.action_id AND a.slug = $2
         JOIN muscles m ON m.id = ma.muscle_id
        ORDER BY ma.is_prime_mover DESC, m.display_name`,
      [jointSlug, actionSlug]
    );
    return rows;
  }

  /** Muscles performing the OPPOSITE action at the same joint (antagonists). */
  async antagonistsForJointAction(jointSlug, actionSlug) {
    const { rows } = await this.pool.query(
      `SELECT ${MUSCLE_CARD}
         FROM actions a
         JOIN actions opp ON opp.slug = a.opposite_slug
         JOIN muscle_actions ma ON ma.action_id = opp.id
         JOIN joints  j ON j.id = ma.joint_id AND j.slug = $1
         JOIN muscles m ON m.id = ma.muscle_id
        WHERE a.slug = $2
        ORDER BY m.display_name`,
      [jointSlug, actionSlug]
    );
    return rows;
  }

  /** Curated stabiliser muscles for a joint. */
  async fixatorsForJoint(slug) {
    const { rows } = await this.pool.query(
      `SELECT ${MUSCLE_CARD}, jf.note
         FROM joint_fixators jf
         JOIN joints  j ON j.id = jf.joint_id AND j.slug = $1
         JOIN muscles m ON m.id = jf.muscle_id
        ORDER BY m.display_name`,
      [slug]
    );
    return rows;
  }

  async findAction(slug) {
    const { rows } = await this.pool.query(
      `SELECT a.slug, a.name, a.plane, a.axis, a.description,
              a.opposite_slug, opp.name AS opposite_name
         FROM actions a
         LEFT JOIN actions opp ON opp.slug = a.opposite_slug
        WHERE a.slug = $1`,
      [slug]
    );
    return rows[0] ?? null;
  }

  async findMuscle(slug) {
    const { rows } = await this.pool.query(
      `SELECT slug, name, subdivision, display_name, muscle_group,
              origin, insertion, depth, innervation, blood_supply, description
         FROM muscles WHERE slug = $1`,
      [slug]
    );
    return rows[0] ?? null;
  }

  /** Every (joint, action) a muscle performs. */
  async actionsForMuscle(slug) {
    const { rows } = await this.pool.query(
      `SELECT j.slug AS joint_slug, j.name AS joint_name,
              a.slug AS action_slug, a.name AS action_name,
              a.plane, a.axis, a.description, a.opposite_slug,
              ma.is_prime_mover
         FROM muscle_actions ma
         JOIN muscles m ON m.id = ma.muscle_id AND m.slug = $1
         JOIN joints  j ON j.id = ma.joint_id
         JOIN actions a ON a.id = ma.action_id
        ORDER BY j.display_order, a.name`,
      [slug]
    );
    return rows;
  }
}
