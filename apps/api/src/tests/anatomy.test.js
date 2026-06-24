import { jest } from '@jest/globals';

// Closure-captured repository mock (mockImplementation in beforeEach is unreliable
// with unstable_mockModule, so we hold a stable methods object instead).
const repo = {
  listJoints: jest.fn(),
  findJoint: jest.fn(),
  actionsForJoint: jest.fn(),
  musclesForJoint: jest.fn(),
  musclesForJointAction: jest.fn(),
  antagonistsForJointAction: jest.fn(),
  fixatorsForJoint: jest.fn(),
  findAction: jest.fn(),
  findMuscle: jest.fn(),
  actionsForMuscle: jest.fn(),
};

await jest.unstable_mockModule('../database/pool.js', () => ({
  getPool: jest.fn(() => ({ query: jest.fn() })),
  closePool: jest.fn(),
}));

await jest.unstable_mockModule('../repositories/anatomyRepository.js', () => ({
  AnatomyRepository: jest.fn(() => repo),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');

const card = (slug, name, prime = false) => ({
  slug, name, display_name: name, muscle_group: 'Grp', depth: 'Middle', is_prime_mover: prime,
});

beforeEach(() => {
  Object.values(repo).forEach(fn => fn.mockReset());
});

describe('GET /api/v1/anatomy/joints', () => {
  it('returns the joint list', async () => {
    repo.listJoints.mockResolvedValue([{ slug: 'elbow', name: 'Elbow' }]);
    const res = await request(app).get('/api/v1/anatomy/joints');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ slug: 'elbow', name: 'Elbow' }]);
  });
});

describe('GET /api/v1/anatomy/joints/:slug', () => {
  it('returns joint with its actions and muscles', async () => {
    repo.findJoint.mockResolvedValue({ slug: 'elbow', name: 'Elbow' });
    repo.actionsForJoint.mockResolvedValue([{ slug: 'flexion', name: 'Flexion' }]);
    repo.musclesForJoint.mockResolvedValue([{ slug: 'brachialis', display_name: 'Brachialis', actions: [] }]);

    const res = await request(app).get('/api/v1/anatomy/joints/elbow');
    expect(res.status).toBe(200);
    expect(res.body.data.joint.slug).toBe('elbow');
    expect(res.body.data.actions).toHaveLength(1);
    expect(res.body.data.muscles).toHaveLength(1);
  });

  it('404s for an unknown joint', async () => {
    repo.findJoint.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/anatomy/joints/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/anatomy/joints/:slug/actions/:actionSlug', () => {
  it('splits prime mover (agonist) from synergists and includes antagonists + fixators', async () => {
    repo.findJoint.mockResolvedValue({ slug: 'glenohumeral', name: 'Glenohumeral' });
    repo.findAction.mockResolvedValue({ slug: 'abduction', name: 'Abduction', opposite_name: 'Adduction' });
    repo.musclesForJointAction.mockResolvedValue([
      card('deltoid-middle', 'Deltoid - Middle', true),
      card('supraspinatus', 'Supraspinatus', false),
    ]);
    repo.antagonistsForJointAction.mockResolvedValue([card('latissimus-dorsi', 'Latissimus dorsi')]);
    repo.fixatorsForJoint.mockResolvedValue([card('trapezius-upper', 'Trapezius - Upper')]);

    const res = await request(app).get('/api/v1/anatomy/joints/glenohumeral/actions/abduction');
    expect(res.status).toBe(200);
    expect(res.body.data.agonists.map(m => m.slug)).toEqual(['deltoid-middle']);
    expect(res.body.data.synergists.map(m => m.slug)).toEqual(['supraspinatus']);
    expect(res.body.data.antagonists.map(m => m.slug)).toEqual(['latissimus-dorsi']);
    expect(res.body.data.fixators.map(m => m.slug)).toEqual(['trapezius-upper']);
  });

  it('404s when no muscle performs the action at the joint', async () => {
    repo.findJoint.mockResolvedValue({ slug: 'elbow', name: 'Elbow' });
    repo.findAction.mockResolvedValue({ slug: 'pronation', name: 'Pronation' });
    repo.musclesForJointAction.mockResolvedValue([]);
    repo.antagonistsForJointAction.mockResolvedValue([]);
    repo.fixatorsForJoint.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/anatomy/joints/elbow/actions/pronation');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/anatomy/muscles/:slug', () => {
  it('returns muscle detail with self excluded from synergists', async () => {
    repo.findMuscle.mockResolvedValue({ slug: 'brachialis', display_name: 'Brachialis' });
    repo.actionsForMuscle.mockResolvedValue([{
      joint_slug: 'elbow', joint_name: 'Elbow',
      action_slug: 'flexion', action_name: 'Flexion', plane: 'Sagittal', axis: 'Frontal',
      description: '', opposite_slug: 'extension', is_prime_mover: true,
    }]);
    repo.musclesForJointAction.mockResolvedValue([
      card('brachialis', 'Brachialis', true),
      card('biceps-brachii-long-head', 'Biceps Brachii - Long Head'),
    ]);
    repo.antagonistsForJointAction.mockResolvedValue([card('triceps-brachii-long-head', 'Triceps Brachii - Long Head')]);

    const res = await request(app).get('/api/v1/anatomy/muscles/brachialis');
    expect(res.status).toBe(200);
    expect(res.body.data.muscle.slug).toBe('brachialis');
    const action = res.body.data.actions[0];
    expect(action.synergists.map(m => m.slug)).toEqual(['biceps-brachii-long-head']);
    expect(action.antagonists.map(m => m.slug)).toEqual(['triceps-brachii-long-head']);
    expect(action.isPrimeMover).toBe(true);
  });

  it('404s for an unknown muscle', async () => {
    repo.findMuscle.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/anatomy/muscles/nope');
    expect(res.status).toBe(404);
  });
});
