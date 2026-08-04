# ADR-0014: Handling of client health information

**Status:** Accepted
**Date:** 2026-08-03
**Supersedes:** none

## Context

The booking intake form collects date of birth, current medications, recent
surgeries, pregnancy status, and injuries (migrations `035`, `042`). This is
clinical data about identifiable people, and it accumulates indefinitely.

Three problems were found in the existing handling:

1. `GET /appointments/:id/soap-notes` and `GET /appointments/:id/client-history`
   were gated on `authorize('therapist', 'owner')` only. Neither checked that
   the requesting therapist was the one assigned to the appointment, so any
   authenticated therapist could read any client's full clinical timeline by
   guessing or enumerating appointment IDs. The corresponding *write* path
   (`upsertSoapNotes`) did check — the reads were an oversight, not a design.
2. `scripts/backup.sh` wrote unencrypted `pg_dump` output to
   `/var/backups/atlasmassage`, retaining 7 daily and 4 weekly copies. Roughly a
   month of clinical history sat readable on disk, accessible to anyone able to
   act as the `deploy` user.
3. The `audit_logs` table (migration `018`) existed but had no writer and its
   read endpoint was a stub. There was no way to determine whether problem (1)
   had ever been exploited.

### On HIPAA

Atlas is a cash-pay practice. It does not submit claims, run eligibility checks,
or transmit any covered transaction electronically, and so is **not** a HIPAA
covered entity under 45 CFR 160.103. Issuing superbills that clients submit to
their own insurers does not change this — the client is the transmitting party,
not the practice. Should the practice ever begin submitting claims itself, or
engage a billing service that does so on its behalf, that analysis changes and
this ADR must be revisited.

The decisions below are therefore **not** driven by a compliance mandate. They
are driven by the fact that we hold clinical data about identifiable people, and
state health-privacy law and professional obligation apply regardless. This
distinction matters: it means we optimise for actual risk reduction rather than
for satisfying an auditor's checklist.

## Decision

### 1. Per-record authorization on clinical reads

`authorizeClinicalAccess()` in `appointmentController.js` loads the appointment
and rejects any therapist who is not the assigned one. Owners pass through. All
clinical read paths call it before touching a repository, so an unauthorized
request never reaches a query.

### 2. Encrypted backups, not encrypted columns

`scripts/backup.sh` streams `pg_dump` directly into `age` using a **public**
recipient key (`BACKUP_AGE_RECIPIENT`). The plaintext dump never touches the
filesystem. The private key lives off the server, so compromising the host does
not expose the contents of past backups. The job fails closed: no `age` binary
or no recipient key means no backup, rather than a silent plaintext one.

We deliberately did **not** encrypt the `health_records` columns themselves.
Column encryption defends against exposure of *media* — a stolen disk, a leaked
dump — which backup encryption plus host disk encryption already covers. It does
not defend against a compromised API process or a leaked `DB_PASSWORD`, because
the application holds the key and decrypts on read. Against that it would buy
nothing while costing searchability, indexing, key rotation, and the risk that a
lost key renders clinical records unrecoverable. Revisit if the database moves
to a host we do not control.

### 3. Audit logging of PHI access

`services/auditService.js` exposes `recordAudit(req, { action, entity, entityId })`,
writing through `AuditLogRepository`. Wired into every PHI read (client history,
SOAP notes), clinical write (SOAP notes), and intake creation.

Three properties worth preserving:

- **Never log PHI contents.** Entries record *which* record was touched and by
  whom, never what it contained. The audit log has a different retention policy
  and a different audience than the clinical tables; copying record contents into
  it would widen the exposure it exists to detect.
- **Audit failure never fails the clinical read.** A therapist mid-session must
  still see the chart. `recordAudit` catches and logs at `error` level so the gap
  is visible rather than silent. This trades completeness for availability
  knowingly — if the trail must be provably complete, this is the line to change.
- **Attribution outlives the user.** Migration `056` drops the
  `audit_logs.user_id` foreign key, which used `ON DELETE SET NULL` and so erased
  "who did this" exactly when the trail mattered most. The raw UUID is retained;
  the read path `LEFT JOIN`s `users` for a display name and degrades to
  "Deleted user".

Owners view the trail at `/owner/audit-log`, filterable by action, record type,
and date range.

## Consequences

- A therapist covering for a colleague cannot open that client's history. This is
  intended. If cross-coverage becomes a real workflow, add an explicit,
  audited "break-glass" path rather than widening the default.
- Backups cannot be restored without the off-box private key. **Losing that key
  loses every backup.** This is a real operational risk accepted in exchange for
  the dumps being useless to anyone who obtains them.
- `client-history` still returns sessions with *all* therapists, not just the
  requester's. For continuity of care this is usually correct; it is a
  deliberate deviation from strict minimum-necessary and can be narrowed in
  `clientHistoryRepository.findByAppointment` if that judgement changes.
- The audit log grows without bound and has no purge job. That is correct for an
  audit trail — it should outlive the records it describes.

## Still outstanding

- No retention or disposal policy for health records. `client_id ON DELETE SET
  NULL` orphans them rather than removing them.
- No client-facing mechanism for access to or amendment of their own records.
- Guest health records are keyed to an unverified `guest_email`; anyone booking
  as a guest with another person's email links records to that address.
- `pool.js` sets `rejectUnauthorized: false` when `DB_SSL=true`, so the flag does
  not actually authenticate the server. Harmless while Postgres is on localhost;
  must be fixed before the database moves to a separate host.
