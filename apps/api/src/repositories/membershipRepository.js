export class MembershipRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findActivePlans() {
    const { rows } = await this.pool.query(
      'SELECT * FROM membership_plans WHERE is_active = TRUE ORDER BY price_monthly_cents ASC'
    );
    return rows;
  }

  async findAllPlans() {
    const { rows } = await this.pool.query(
      'SELECT * FROM membership_plans ORDER BY price_monthly_cents ASC'
    );
    return rows;
  }

  async findPlanById(id) {
    const { rows } = await this.pool.query(
      'SELECT * FROM membership_plans WHERE id = $1',
      [id]
    );
    return rows[0] ?? null;
  }

  async createPlan({ name, description, priceMonthlyCents, creditsPerMonth, stripePriceId }) {
    const { rows: [plan] } = await this.pool.query(
      `INSERT INTO membership_plans (name, description, price_monthly_cents, credits_per_month, stripe_price_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description ?? null, priceMonthlyCents, creditsPerMonth, stripePriceId ?? null]
    );
    return plan;
  }

  async updatePlan(id, { name, description, isActive, stripePriceId }) {
    const sets = ['updated_at = NOW()'];
    const vals = [];
    let i = 1;
    if (name !== undefined)          { sets.push(`name = $${i++}`);            vals.push(name); }
    if (description !== undefined)   { sets.push(`description = $${i++}`);     vals.push(description); }
    if (isActive !== undefined)      { sets.push(`is_active = $${i++}`);       vals.push(isActive); }
    if (stripePriceId !== undefined) { sets.push(`stripe_price_id = $${i++}`); vals.push(stripePriceId); }
    vals.push(id);

    const { rows: [plan] } = await this.pool.query(
      `UPDATE membership_plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return plan;
  }

  async findMembershipsByClient(clientId) {
    const { rows } = await this.pool.query(
      `SELECT m.*, mp.name AS plan_name, mp.price_monthly_cents, mp.credits_per_month
       FROM memberships m
       JOIN membership_plans mp ON mp.id = m.plan_id
       WHERE m.client_id = $1
       ORDER BY m.created_at DESC`,
      [clientId]
    );
    return rows;
  }

  async findActiveMembershipByClient(clientId) {
    const { rows } = await this.pool.query(
      `SELECT m.*, mp.name AS plan_name, mp.price_monthly_cents, mp.credits_per_month
       FROM memberships m
       JOIN membership_plans mp ON mp.id = m.plan_id
       WHERE m.client_id = $1 AND m.status = 'active'
       LIMIT 1`,
      [clientId]
    );
    return rows[0] ?? null;
  }

  async findMembershipById(id) {
    const { rows } = await this.pool.query(
      `SELECT m.*, mp.name AS plan_name, mp.price_monthly_cents, mp.credits_per_month
       FROM memberships m
       JOIN membership_plans mp ON mp.id = m.plan_id
       WHERE m.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async createMembership({ clientId, planId, startDate, endDate, stripeSubscriptionId, creditsRemaining }) {
    const { rows: [membership] } = await this.pool.query(
      `INSERT INTO memberships
         (client_id, plan_id, start_date, end_date, stripe_subscription_id, credits_remaining)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [clientId, planId, startDate, endDate ?? null, stripeSubscriptionId ?? null, creditsRemaining ?? 0]
    );
    return membership;
  }

  async updateMembership(id, { status, endDate }) {
    const sets = ['updated_at = NOW()'];
    const vals = [];
    let i = 1;
    if (status !== undefined)  { sets.push(`status = $${i++}`);   vals.push(status); }
    if (endDate !== undefined) { sets.push(`end_date = $${i++}`); vals.push(endDate); }
    vals.push(id);

    const { rows: [membership] } = await this.pool.query(
      `UPDATE memberships SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return membership;
  }
}
