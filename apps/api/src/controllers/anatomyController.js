import { getPool } from '../database/pool.js';
import { AnatomyRepository } from '../repositories/anatomyRepository.js';
import { AppError } from '../middleware/errorHandler.js';

function repo() {
  return new AnatomyRepository(getPool());
}

// GET /anatomy/joints — top-level articulation filter
export async function listJoints(_req, res, next) {
  try {
    res.json({ success: true, data: await repo().listJoints() });
  } catch (err) {
    next(err);
  }
}

// GET /anatomy/joints/:slug
// Muscles acting at the joint (each with its action(s) there) + the actions
// available at the joint (for the secondary action filter).
export async function getJoint(req, res, next) {
  try {
    const r = repo();
    const joint = await r.findJoint(req.params.slug);
    if (!joint) throw new AppError('Joint not found', 404, 'NOT_FOUND');

    const [actions, muscles] = await Promise.all([
      r.actionsForJoint(joint.slug),
      r.musclesForJoint(joint.slug),
    ]);

    res.json({ success: true, data: { joint, actions, muscles } });
  } catch (err) {
    next(err);
  }
}

// GET /anatomy/joints/:slug/actions/:actionSlug
// Agonist (prime mover), synergists, antagonists and fixators for the movement.
export async function getJointAction(req, res, next) {
  try {
    const r = repo();
    const { slug, actionSlug } = req.params;

    const joint = await r.findJoint(slug);
    if (!joint) throw new AppError('Joint not found', 404, 'NOT_FOUND');

    const action = await r.findAction(actionSlug);
    if (!action) throw new AppError('Action not found', 404, 'NOT_FOUND');

    const [movers, antagonists, fixators] = await Promise.all([
      r.musclesForJointAction(slug, actionSlug),
      r.antagonistsForJointAction(slug, actionSlug),
      r.fixatorsForJoint(slug),
    ]);

    if (movers.length === 0) {
      throw new AppError('No muscles perform that action at this joint', 404, 'NOT_FOUND');
    }

    const agonists = movers.filter(m => m.is_prime_mover);
    const synergists = movers.filter(m => !m.is_prime_mover);

    res.json({
      success: true,
      data: { joint, action, agonists, synergists, antagonists, fixators },
    });
  } catch (err) {
    next(err);
  }
}

// GET /anatomy/muscles/:slug
// Origin / insertion / actions for the muscle, plus the synergists and
// antagonists for each action it performs.
export async function getMuscle(req, res, next) {
  try {
    const r = repo();
    const muscle = await r.findMuscle(req.params.slug);
    if (!muscle) throw new AppError('Muscle not found', 404, 'NOT_FOUND');

    const rows = await r.actionsForMuscle(muscle.slug);

    const actions = await Promise.all(rows.map(async row => {
      const [movers, antagonists] = await Promise.all([
        r.musclesForJointAction(row.joint_slug, row.action_slug),
        r.antagonistsForJointAction(row.joint_slug, row.action_slug),
      ]);
      return {
        joint: { slug: row.joint_slug, name: row.joint_name },
        action: {
          slug: row.action_slug,
          name: row.action_name,
          plane: row.plane,
          axis: row.axis,
          description: row.description,
        },
        isPrimeMover: row.is_prime_mover,
        // synergists = co-contributors at this joint+action, excluding self
        synergists: movers.filter(m => m.slug !== muscle.slug),
        antagonists,
      };
    }));

    res.json({ success: true, data: { muscle, actions } });
  } catch (err) {
    next(err);
  }
}
