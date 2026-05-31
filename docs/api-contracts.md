# API Contracts

Base URL: `/api/v1`

All responses follow the envelope structure:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

Paginated lists include:
```json
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 } }
```

---

## Auth — `/auth`

### POST `/auth/register`
**Body**: `{ email, password, firstName, lastName, phone? }`
**Response**: `{ user, accessToken, refreshToken }`

### POST `/auth/login`
**Body**: `{ email, password }`
**Response**: `{ user, accessToken, refreshToken }`

### POST `/auth/logout`
**Auth**: Bearer token required
**Body**: `{ refreshToken }`
**Response**: `{ message: "Logged out" }`

### POST `/auth/refresh`
**Body**: `{ refreshToken }`
**Response**: `{ accessToken, refreshToken }`

### POST `/auth/forgot-password`
**Body**: `{ email }`
**Response**: `{ message: "Reset email sent" }`

### POST `/auth/reset-password`
**Body**: `{ token, password }`
**Response**: `{ message: "Password updated" }`

---

## Users — `/users`

### GET `/users/me` _(auth required)_
**Response**: `{ user }`

### PUT `/users/me` _(auth required)_
**Body**: `{ firstName?, lastName?, phone? }`
**Response**: `{ user }`

### PUT `/users/me/password` _(auth required)_
**Body**: `{ currentPassword, newPassword }`
**Response**: `{ message: "Password updated" }`

### GET `/users` _(owner only)_
**Query**: `page, limit, role?, search?`
**Response**: paginated `user[]`

### GET `/users/:id` _(owner only)_
### PUT `/users/:id` _(owner only)_
### DELETE `/users/:id` _(owner only)_

---

## Appointments — `/appointments`

### GET `/appointments` _(auth required)_
**Query**: `page, limit, status?, therapistId?, clientId?, from?, to?`
**Response**: paginated `appointment[]`

### POST `/appointments` _(client)_
**Body**: `{ therapistId, serviceId, scheduledAt, notes? }`
**Response**: `{ appointment }`

### GET `/appointments/:id` _(auth required)_
### PUT `/appointments/:id` _(auth required)_
**Body**: `{ scheduledAt?, notes? }`

### POST `/appointments/:id/cancel` _(auth required)_
**Body**: `{ reason? }`

### POST `/appointments/:id/confirm` _(therapist | owner)_
**Body**: `{ bedId? }`

### POST `/appointments/:id/complete` _(therapist | owner)_

---

## Availability — `/availability`

### GET `/availability/therapists`
**Query**: `date, serviceId`
**Response**: `{ therapists: [{ therapistId, slots: [{ start, end }] }] }`

### GET `/availability/slots`
**Query**: `therapistId, date, serviceId`
**Response**: `{ slots: [{ start, end, available }] }`

### GET `/availability/therapists/:therapistId`
**Response**: `{ availability[] }`

### PUT `/availability/therapists/:therapistId` _(therapist | owner)_
**Body**: `{ availability: [{ dayOfWeek, startTime, endTime, isRecurring }] }`

---

## Payments — `/payments`

### GET `/payments/methods` _(auth required)_
### POST `/payments/methods` _(auth required)_
**Body**: `{ stripePaymentMethodId }`

### DELETE `/payments/methods/:id` _(auth required)_
### PUT `/payments/methods/:id/default` _(auth required)_

### POST `/payments/intents` _(auth required)_
**Body**: `{ appointmentId?, membershipPlanId? }`
**Response**: `{ clientSecret, paymentIntentId }`

### POST `/payments/webhook`
**Headers**: `stripe-signature`
**Body**: raw Stripe event

---

## Memberships — `/memberships`

### GET `/memberships/plans` _(public)_
### GET `/memberships/plans/:id` _(public)_
### POST `/memberships/plans` _(owner)_
### PUT `/memberships/plans/:id` _(owner)_

### GET `/memberships` _(auth required)_
### POST `/memberships` _(client)_
**Body**: `{ planId, paymentMethodId }`

### GET `/memberships/:id` _(auth required)_
### POST `/memberships/:id/cancel` _(auth required)_
### POST `/memberships/:id/pause` _(owner)_

---

## Notifications — `/notifications`

### GET `/notifications/preferences` _(auth required)_
### PUT `/notifications/preferences` _(auth required)_
**Body**: `{ emailAppointmentRemind?, emailBookingConfirm?, smsAppointmentRemind?, smsBookingConfirm? }`

### GET `/notifications` _(auth required)_

---

## Admin — `/admin` _(owner only)_

### GET `/admin/dashboard`
**Response**: `{ todayAppointments, monthRevenue, activeClients, activeMembers }`

### GET `/admin/users`
### GET `/admin/appointments`
### GET `/admin/revenue`
**Query**: `from, to, groupBy (day|week|month)`

### GET `/admin/therapists`
### PUT `/admin/settings`
### GET `/admin/audit-logs`
**Query**: `page, limit, userId?, entity?, action?, from?, to?`

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 422 | Request body/query validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `FORBIDDEN` | 403 | Insufficient role |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Scheduling conflict or duplicate |
| `NOT_IMPLEMENTED` | 501 | Endpoint not yet implemented |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
