# ADR-0008 — Winston Structured Logging

**Status**: Accepted

**Date**: 2026-05-31

## Context

Production debugging requires structured logs that can be parsed by log aggregation tools. Development requires human-readable, colorized output. We need a single logging solution that adapts to both environments without changing application code.

## Decision

Use **Winston** for all logging.

Configuration (`apps/api/src/logging/logger.js`):
- **Development**: colorized single-line format with timestamp, level, message, and metadata
- **Production**: JSON format with timestamp and stack traces — suitable for Loki, Datadog, or CloudWatch

Log levels: `error > warn > info > debug` (configurable via `LOG_LEVEL` env var, default `info`).

All log calls use an **event-name + metadata object** pattern:
```js
logger.info('appointment_created', { appointmentId, clientId, therapistId });
logger.error('db_query_failed', { message: err.message, stack: err.stack });
```

This makes logs machine-parseable and searchable by event name.

Request logging middleware emits one `http_request` log entry per response with `method`, `url`, `status`, `duration_ms`, and `ip`.

## Consequences

### Positive

- JSON production logs are immediately consumable by log aggregation tools
- Event-name pattern enables structured queries (e.g., `event = "appointment_created"`)
- Winston transports are pluggable — adding a file or external transport requires no application changes
- `exitOnError: false` prevents Winston from crashing the process on transport errors

### Negative / Trade-offs

- Winston is a moderately heavy dependency for a logging library
- Developers must follow the event-name convention; enforced by code review, not tooling

## Alternatives Considered

| Alternative | Why Rejected |
|-------------|-------------|
| `console.log` | Not structured; no levels; not suitable for production |
| Pino | Faster than Winston; would be preferred at high throughput but Winston is sufficient here |
| Morgan (standalone) | HTTP-only; does not handle application-level logging |
| Bunyan | Unmaintained |
