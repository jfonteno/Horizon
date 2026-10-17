# Commander Identity and Horizon Operations

## Clean account schema

Horizon 0.33.3 writes Commander records with account schema 3. Disk deployments migrate readable schema 2 records in place, while D1 continues to use the `horizon_accounts_v2` table with normalized schema 3 payloads. Existing recovery keys, rooms, cloud saves, statistics, emblems, and sessions remain valid.

## Required security secret

Set `HORIZON_AUTH_SECRET` to at least 32 unpredictable characters before enabling any identity provider. It signs short-lived OAuth and email-verification state and must be shared by every application instance. Keep it out of source control. The native Windows launcher generates this secret in `data/auth-secret` and includes it in self-hosted backups so outstanding identity links and provider configuration remain stable after recovery.

## Passwordless email

Horizon uses an eight-digit, ten-minute verification code. The account stores a one-way hash of the normalized address and a masked label, not the complete address or a password. The complete address is supplied again whenever the player signs in and is sent to the configured delivery service only for that verification request.

For live delivery through Resend, set:

```text
HORIZON_EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
HORIZON_EMAIL_FROM=Horizon Command <command@horizongame.us>
```

The sending domain must be verified with the delivery provider. For host-supervised development only, set `HORIZON_EMAIL_PROVIDER=console`. Codes then appear in the Horizon Server window and are never emailed. Do not use console delivery for an unattended public beta.

Email start requests are limited per address and verification attempts are limited per requesting network address. Codes and signed challenges expire after ten minutes. Responses do not reveal whether an address already belongs to a Commander.

## Operations Owner

1. Create or sign in to the Commander that should own Horizon Operations.
2. Copy its `HZN-...` Commander ID from Commander Profile.
3. Set `HORIZON_ADMIN_ACCOUNT_IDS` to that ID. Multiple IDs may be comma-separated.
4. Restart Horizon, sign in with that Commander, and open `/admin`.

Configured IDs receive the effective `owner` role without changing their stored record. Owners can delete accounts. Administrators can perform other account mutations, support staff can inspect bounded account records, and analysts receive aggregate metrics only.

## Google

Create a Google OAuth web client and register this exact callback for each deployed origin:

```text
https://your-horizon-origin.example/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Horizon validates the authorization code, Google signing key, issuer, audience, expiration, and per-request nonce.

## Apple

Create a Sign in with Apple Services ID and register:

```text
https://your-horizon-origin.example/api/auth/callback/apple
```

Set `APPLE_CLIENT_ID` to the Services ID and `APPLE_CLIENT_SECRET` to a current Apple client-secret JWT. Apple client-secret JWTs expire and must be rotated outside Horizon before expiration. Horizon validates the Apple signing key, issuer, audience, expiration, and nonce.

## Steam

Steam web sign-in uses OpenID 2.0 assertion validation and does not require a Steam Web API key. Set `HORIZON_STEAM_SIGNIN=enabled` to advertise it, or `disabled` to hide it. The deployment origin is used as the OpenID realm and callback base.

The native Windows launcher enables Steam automatically. Docker deployments use the value in `.env`.

## Native Windows configuration

The Windows launcher loads optional values from `horizon-auth.env` beside `Start-Horizon-Windows.cmd`. Copy `horizon-auth.env.example`, fill only the providers you intend to use, and restart Horizon. Never distribute the completed file.

The launcher creates `data/auth-secret` if no explicit `HORIZON_AUTH_SECRET` exists. Keep this file with account backups. Rotating or losing it invalidates email and OAuth requests that were already in progress, although existing signed-in sessions and recovery keys remain valid.

## Proxy and callback requirements

- Serve Horizon over HTTPS in production.
- Preserve the public request origin through the reverse proxy so callback URLs match provider registration.
- Keep `/api/auth/callback/*` on the same origin as the application.
- Never cache account, authentication, cloud, or Operations API responses.

## Cloud continuity

Signed-in clients synchronize interface preferences and the current First Horizon or solo save. A write includes the last observed revision. When that revision is stale, Horizon leaves the current save untouched and stores the upload as a conflict copy. An administrator can promote a conflict copy or delete a damaged save from Operations, with an audited reason.

## Support boundaries

Horizon Operations exposes only bounded account metadata. It does not show raw credentials, raw provider subjects, cloud-save payloads, private Orders, Hidden Objectives, surveys, proposals, unrevealed map state, or bot-private analysis. Every mutation is server-authorized and recorded in the target account's audit trail.
