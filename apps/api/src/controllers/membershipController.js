import { getPool } from '../database/pool.js';
import { MembershipService } from '../services/membershipService.js';

function service() {
  return new MembershipService(getPool());
}

export async function listPlans(req, res, next) {
  try {
    const plans = await service().listPlans();
    res.json({ success: true, data: { plans } });
  } catch (err) {
    next(err);
  }
}

export async function getPlan(req, res, next) {
  try {
    const plan = await service().getPlan(req.params.id);
    res.json({ success: true, data: { plan } });
  } catch (err) {
    next(err);
  }
}

export async function createPlan(req, res, next) {
  try {
    const { name, description, priceMonthlyCents, creditsPerMonth } = req.body;
    const plan = await service().createPlan({ name, description, priceMonthlyCents, creditsPerMonth });
    res.status(201).json({ success: true, data: { plan } });
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(req, res, next) {
  try {
    const plan = await service().updatePlan(req.params.id, req.body);
    res.json({ success: true, data: { plan } });
  } catch (err) {
    next(err);
  }
}

export async function listMemberships(req, res, next) {
  try {
    const memberships = await service().listMemberships(req.user.sub);
    res.json({ success: true, data: { memberships } });
  } catch (err) {
    next(err);
  }
}

export async function subscribe(req, res, next) {
  try {
    const { planId, stripePaymentMethodId } = req.body;
    const membership = await service().subscribe(req.user.sub, { planId, stripePaymentMethodId });
    res.status(201).json({ success: true, data: { membership } });
  } catch (err) {
    next(err);
  }
}

export async function getMembership(req, res, next) {
  try {
    const membership = await service().getMembership(req.params.id);
    res.json({ success: true, data: { membership } });
  } catch (err) {
    next(err);
  }
}

export async function cancelMembership(req, res, next) {
  try {
    const isOwner = req.user.roles?.includes('owner');
    const membership = await service().cancelMembership(req.params.id, req.user.sub, isOwner);
    res.json({ success: true, data: { membership } });
  } catch (err) {
    next(err);
  }
}

export async function pauseMembership(req, res, next) {
  try {
    const membership = await service().pauseMembership(req.params.id);
    res.json({ success: true, data: { membership } });
  } catch (err) {
    next(err);
  }
}

export async function getMyStatus(req, res, next) {
  try {
    const status = await service().getMyStatus(req.user.sub);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
}
