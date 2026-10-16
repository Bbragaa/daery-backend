# 0003. JWT authentication with admin-approved privileged roles

Status: Accepted

## Context

Until Phase 01 every route was public: anyone could create an `ADMIN` through
`POST /api/users`, list every user's name and email, and set `reportedById` to
any user when reporting a case. Phase 02 connects the frontend, so the API
needs authentication and role-based authorization first.

The team decided (decisions D1–D3, 2026-10-09) that:

- the general public can sign up as `CITIZEN`;
- health professionals sign up with their regional council, registration
  number and state; institutions sign up with a CNPJ;
- only health professionals and institutions report cases.

Letting a user pick a privileged role at sign-up would recreate the original
privilege-escalation problem, since a council number cannot be verified
automatically.

## Decision

- Stateless JWT (HS256, `JWT_SECRET` with 32+ characters, `JWT_EXPIRES_IN`)
  issued by `POST /api/auth/login` and `POST /api/auth/register`.
- `authenticate` reloads the user from the database on every request, so a
  deactivation or an approval takes effect immediately instead of when the
  token expires. This costs one indexed lookup by primary key per request.
- `authorize(...roles)` guards each route. `/api/users` is `ADMIN`-only.
- Every public sign-up is created with `role = CITIZEN`. Professional and
  institution sign-ups also store `requestedRole` and
  `verificationStatus = PENDING`; an `ADMIN` approves or rejects them with
  `PATCH /api/users/{id}/verification`.
- The author of a case notification is always the authenticated user.
- Login answers the same `401 Invalid credentials` for unknown email, wrong
  password and inactive account, and runs a bcrypt comparison even when the
  email does not exist, so responses do not reveal which emails are registered.
- Login and sign-up are rate-limited per IP (`AUTH_RATE_LIMIT_MAX` per 15 min).

## Consequences

- The frontend must send `Authorization: Bearer <token>` and handle 401/403.
- A seed (`npx prisma db seed`) is required to create the first `ADMIN`.
- Tokens cannot be revoked individually before they expire; deactivating the
  user is the revocation mechanism, which the per-request lookup makes effective.
- Storing the token in `sessionStorage` on the frontend keeps it exposed to XSS;
  an `httpOnly` cookie is a possible future hardening (requires CSRF handling).
