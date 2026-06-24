import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { anatomyService } from '../services/anatomyService.js';

// ── Small presentational helpers ──────────────────────────────────────────────

function MuscleButton({ muscle, onSelect, note }) {
  return (
    <button type="button" className="muscle-chip" onClick={() => onSelect(muscle.slug)}>
      <span className="muscle-chip__name">{muscle.display_name}</span>
      {muscle.muscle_group && <span className="muscle-chip__group">{muscle.muscle_group}</span>}
      {muscle.depth && <span className={`muscle-chip__depth muscle-chip__depth--${muscle.depth.toLowerCase()}`}>{muscle.depth}</span>}
      {note && <span className="muscle-chip__note">{note}</span>}
    </button>
  );
}

function RoleList({ title, modifier, muscles, onSelect, emptyHint }) {
  return (
    <section className={`role-list role-list--${modifier}`}>
      <h3 className="role-list__title">
        {title} <span className="role-list__count">{muscles.length}</span>
      </h3>
      {muscles.length === 0 ? (
        <p className="role-list__empty">{emptyHint || 'None in this dataset.'}</p>
      ) : (
        <ul className="role-list__items">
          {muscles.map(m => (
            <li key={m.slug + (m.note || '')}>
              <MuscleButton muscle={m} note={m.note} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Views ─────────────────────────────────────────────────────────────────────

function JointOverview({ data, onSelectAction, onSelectMuscle }) {
  const { joint, muscles } = data;
  return (
    <div className="anatomy-view">
      <header className="anatomy-view__header">
        <h2 className="anatomy-view__title">{joint.name} joint</h2>
        <p className="anatomy-view__meta">{joint.region} · {joint.joint_type}</p>
        <p className="anatomy-view__desc">{joint.description}</p>
        <p className="anatomy-view__hint">
          Select an <strong>action</strong> below (or from the filter) to see agonists and
          antagonists, or pick a <strong>muscle</strong> to explore it in detail.
        </p>
      </header>

      <ul className="muscle-table">
        {muscles.map(m => (
          <li key={m.slug} className="muscle-table__row">
            <MuscleButton muscle={m} onSelect={onSelectMuscle} />
            <div className="muscle-table__actions">
              {m.actions.map(a => (
                <button
                  key={a.slug}
                  type="button"
                  className={`action-tag${a.isPrimeMover ? ' action-tag--prime' : ''}`}
                  onClick={() => onSelectAction(a.slug)}
                  title={a.isPrimeMover ? 'Prime mover — click to filter' : 'Click to filter by this action'}
                >
                  {a.name}{a.isPrimeMover && <span aria-label="prime mover"> ★</span>}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActionView({ data, onSelectMuscle }) {
  const { joint, action, agonists, synergists, antagonists, fixators } = data;
  return (
    <div className="anatomy-view">
      <header className="anatomy-view__header">
        <h2 className="anatomy-view__title">{action.name} at the {joint.name} joint</h2>
        <p className="anatomy-view__meta">
          {action.plane} plane · {action.axis} axis
          {action.opposite_name && <> · opposes <strong>{action.opposite_name}</strong></>}
        </p>
        {action.description && <p className="anatomy-view__desc">{action.description}</p>}
      </header>

      <div className="role-grid">
        <RoleList title="Agonist (prime mover)" modifier="agonist" muscles={agonists} onSelect={onSelectMuscle}
          emptyHint="No single prime mover designated." />
        <RoleList title="Synergists" modifier="synergist" muscles={synergists} onSelect={onSelectMuscle}
          emptyHint="No additional synergists." />
        <RoleList title="Antagonists" modifier="antagonist" muscles={antagonists} onSelect={onSelectMuscle}
          emptyHint="No opposing muscles in this dataset." />
        <RoleList title="Fixators" modifier="fixator" muscles={fixators} onSelect={onSelectMuscle}
          emptyHint="No fixators recorded." />
      </div>
    </div>
  );
}

function MuscleDetail({ data, onSelectMuscle, onSelectAction }) {
  const { muscle, actions } = data;
  return (
    <div className="anatomy-view">
      <header className="anatomy-view__header">
        <h2 className="anatomy-view__title">{muscle.display_name}</h2>
        {muscle.muscle_group && <p className="anatomy-view__meta">{muscle.muscle_group} · {muscle.depth}</p>}
        {muscle.description && <p className="anatomy-view__desc">{muscle.description}</p>}
      </header>

      <dl className="muscle-facts">
        <div><dt>Origin</dt><dd>{muscle.origin || '—'}</dd></div>
        <div><dt>Insertion</dt><dd>{muscle.insertion || '—'}</dd></div>
        {muscle.innervation && <div><dt>Innervation</dt><dd>{muscle.innervation}</dd></div>}
        {muscle.blood_supply && <div><dt>Blood supply</dt><dd>{muscle.blood_supply}</dd></div>}
      </dl>

      <h3 className="muscle-detail__subhead">Actions</h3>
      <div className="muscle-actions">
        {actions.map(a => (
          <article key={a.joint.slug + a.action.slug} className="muscle-action-card">
            <header className="muscle-action-card__head">
              <button
                type="button"
                className="muscle-action-card__title"
                onClick={() => onSelectAction(a.joint.slug, a.action.slug)}
                title="View this movement"
              >
                {a.action.name} <span className="muscle-action-card__joint">@ {a.joint.name}</span>
                {a.isPrimeMover && <span className="muscle-action-card__prime"> ★ prime mover</span>}
              </button>
              <span className="muscle-action-card__plane">{a.action.plane} plane</span>
            </header>
            <div className="muscle-action-card__roles">
              <RoleList title="Synergists" modifier="synergist" muscles={a.synergists} onSelect={onSelectMuscle}
                emptyHint="Acts alone here." />
              <RoleList title="Antagonists" modifier="antagonist" muscles={a.antagonists} onSelect={onSelectMuscle}
                emptyHint="No opposing muscles in this dataset." />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnatomyPage() {
  const [params, setParams] = useSearchParams();
  const jointSlug = params.get('joint') || '';
  const actionSlug = params.get('action') || '';
  const muscleSlug = params.get('muscle') || '';

  const [joints, setJoints] = useState([]);
  const [jointData, setJointData] = useState(null);
  const [actionData, setActionData] = useState(null);
  const [muscleData, setMuscleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // URL mutators (keep state consistent across selections)
  const selectJoint = slug => setParams(slug ? { joint: slug } : {});
  const selectAction = slug => setParams({ joint: jointSlug, action: slug });
  const clearAction = () => setParams({ joint: jointSlug });
  const selectMuscle = slug => {
    const next = { muscle: slug };
    if (jointSlug) next.joint = jointSlug;
    if (actionSlug) next.action = actionSlug;
    setParams(next);
  };
  const clearMuscle = () => {
    const next = {};
    if (jointSlug) next.joint = jointSlug;
    if (actionSlug) next.action = actionSlug;
    setParams(next);
  };
  const selectJointAction = (j, a) => setParams({ joint: j, action: a });

  useEffect(() => {
    anatomyService.listJoints().then(setJoints).catch(e => setError(e.message));
  }, []);

  // Joint overview (also feeds the action dropdown).
  useEffect(() => {
    if (!jointSlug) { setJointData(null); return; }
    let cancelled = false;
    setLoading(true); setError('');
    anatomyService.getJoint(jointSlug)
      .then(d => { if (!cancelled) setJointData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jointSlug]);

  useEffect(() => {
    if (!jointSlug || !actionSlug) { setActionData(null); return; }
    let cancelled = false;
    setLoading(true); setError('');
    anatomyService.getJointAction(jointSlug, actionSlug)
      .then(d => { if (!cancelled) setActionData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jointSlug, actionSlug]);

  useEffect(() => {
    if (!muscleSlug) { setMuscleData(null); return; }
    let cancelled = false;
    setLoading(true); setError('');
    anatomyService.getMuscle(muscleSlug)
      .then(d => { if (!cancelled) setMuscleData(d); })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [muscleSlug]);

  const availableActions = jointData?.actions || [];

  // Decide which view to render.
  let body;
  if (error) {
    body = <p className="anatomy__error">Unable to load data: {error}</p>;
  } else if (muscleSlug && muscleData) {
    body = <MuscleDetail data={muscleData} onSelectMuscle={selectMuscle} onSelectAction={selectJointAction} />;
  } else if (jointSlug && actionSlug && actionData) {
    body = <ActionView data={actionData} onSelectMuscle={selectMuscle} />;
  } else if (jointSlug && jointData) {
    body = <JointOverview data={jointData} onSelectAction={selectAction} onSelectMuscle={selectMuscle} />;
  } else if (loading) {
    body = <p className="anatomy__loading">Loading…</p>;
  } else {
    // Landing: pick an articulation.
    body = (
      <div className="anatomy-landing">
        <p className="anatomy-landing__lead">
          Start by choosing an <strong>articulation</strong> (joint). You&rsquo;ll see every
          muscle that moves it and the actions they produce — then drill into any action or
          muscle.
        </p>
        <ul className="joint-grid">
          {joints.map(j => (
            <li key={j.slug}>
              <button type="button" className="joint-card" onClick={() => selectJoint(j.slug)}>
                <span className="joint-card__name">{j.name}</span>
                <span className="joint-card__region">{j.region}</span>
                <span className="joint-card__type">{j.joint_type}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="page page--anatomy">
      <div className="anatomy__intro">
        <h1 className="anatomy__heading">Muscles &amp; Movement</h1>
        <p className="anatomy__tagline">
          An interactive reference to the skeletal muscles of the upper body — explore by joint,
          movement, or individual muscle.
        </p>
      </div>

      <div className="anatomy__filters">
        <label className="anatomy__filter">
          <span className="anatomy__filter-label">Articulation</span>
          <select
            className="anatomy__select"
            value={jointSlug}
            onChange={e => selectJoint(e.target.value)}
          >
            <option value="">Choose a joint…</option>
            {joints.map(j => <option key={j.slug} value={j.slug}>{j.name}</option>)}
          </select>
        </label>

        <label className="anatomy__filter">
          <span className="anatomy__filter-label">Action</span>
          <select
            className="anatomy__select"
            value={actionSlug}
            disabled={!jointSlug || availableActions.length === 0}
            onChange={e => (e.target.value ? selectAction(e.target.value) : clearAction())}
          >
            <option value="">{jointSlug ? 'All actions' : 'Select a joint first'}</option>
            {availableActions.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </label>
      </div>

      {/* Breadcrumb / active selections */}
      {(jointSlug || muscleSlug) && (
        <nav className="anatomy__crumbs" aria-label="Current selection">
          <button type="button" className="crumb crumb--reset" onClick={() => selectJoint('')}>All joints</button>
          {jointSlug && jointData && (
            <button type="button" className="crumb" onClick={() => selectJoint(jointSlug)}>
              {jointData.joint.name}
            </button>
          )}
          {jointSlug && actionSlug && actionData && (
            <button type="button" className="crumb" onClick={clearMuscle}>
              {actionData.action.name}
            </button>
          )}
          {muscleSlug && muscleData && (
            <span className="crumb crumb--current">{muscleData.muscle.display_name}</span>
          )}
        </nav>
      )}

      <div className="anatomy__body">
        {body}
      </div>
    </div>
  );
}
