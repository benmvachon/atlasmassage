import { getPool } from '../database/pool.js';
import { AuditLogRepository } from '../repositories/auditLogRepository.js';
import { logger } from '../logging/logger.js';

// Canonical action names. Keep these stable — they are queried by the owner
// dashboard and are the vocabulary any future incident review will search on.
export const AuditAction = {
  PHI_READ:   'phi.read',
  PHI_WRITE:  'phi.write',
  PHI_CREATE: 'phi.create',
};

export const AuditEntity = {
  CLIENT_HISTORY: 'client_history',
  SOAP_NOTES:     'soap_notes',
  HEALTH_RECORD:  'health_record',
};

// Express may hand back a comma-separated forwarded chain or an IPv4-mapped
// IPv6 address; INET rejects the former and renders the latter unreadably.
function normalizeIp(ip) {
  if (!ip) return null;
  const first = String(ip).split(',')[0].trim();
  if (!first) return null;
  return first.startsWith('::ffff:') ? first.slice(7) : first;
}

/**
 * Append an entry to the audit trail.
 *
 * Never pass PHI in `oldData`/`newData`. The audit log has a different
 * retention policy and a different audience than the clinical tables; copying
 * record contents into it would widen the exposure it exists to detect. Log
 * the identifier of what was touched, not its contents.
 */
export async function recordAudit(req, { action, entity, entityId, oldData = null, newData = null }) {
  try {
    const repo = new AuditLogRepository(getPool());
    await repo.create({
      userId: req.user?.sub ?? null,
      action,
      entity,
      entityId,
      oldData,
      newData,
      ipAddress: normalizeIp(req.ip),
    });
  } catch (err) {
    // A failed audit write must not take down a clinical read — a therapist
    // mid-session should still see the chart. Fail loudly in the logs instead
    // so the gap is visible rather than silent.
    logger.error('audit_write_failed', {
      action,
      entity,
      entity_id: entityId,
      user_id: req.user?.sub ?? null,
      message: err.message,
    });
  }
}
