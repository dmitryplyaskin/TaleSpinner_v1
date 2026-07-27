---
title: Accounts and Security
sidebar_position: 2
description: Isolated accounts, frictionless local access, and secure public hosting.
---

# Accounts and Security

TaleSpinner has two access modes: `local` and `public`. Both support any number
of accounts. Every account has a server-enforced data boundary covering chats,
profiles and personas, World Info, presets, LLM/RAG settings, API tokens, and
uploaded files.

## Local mode

`TALESPINNER_ACCESS_MODE=local` is intended for a trusted computer.

- An account may have an empty password.
- A single passwordless account signs in automatically.
- With multiple accounts, the app displays an account picker.
- A password can be added later in Account Manager.
- An administrator can create, disable, and configure other accounts.

Local mode removes sign-in friction; it does not disable data isolation. Do not
expose its port to the internet. The backend listens on loopback by default for
this reason.

## Public mode

Public mode starts only with its complete security configuration. For example:

```env
TALESPINNER_ACCESS_MODE=public
TALESPINNER_SESSION_SECRET=<random string with at least 32 characters>
TALESPINNER_SETUP_TOKEN=<separate random string with at least 16 characters>
TALESPINNER_TRUST_PROXY=true
TALESPINNER_LAN_MODE=true
TALESPINNER_CORS_ORIGINS=https://talespinner.example.com
TALESPINNER_ALLOW_REGISTRATION=false
TOKENS_MASTER_KEY=<strong independent key>
```

Run the backend behind a reverse proxy that terminates HTTPS. Only allow that
proxy to reach TaleSpinner's internal port. `TALESPINNER_CORS_ORIGINS` must be
the exact HTTPS origin of the web UI and must not use `*`.

During initial setup, enter `TALESPINNER_SETUP_TOKEN` in the setup-token field.
It is separate from the administrator password. Keep it outside the browser;
the same token authorizes emergency administrator password recovery.

Public mode always enables:

- passwords of at least 10 characters;
- `HttpOnly`, `Secure`, `SameSite=Strict` session cookies;
- HTTPS and trusted-proxy checks;
- CSRF validation for mutating requests;
- rate limiting of failed sign-in attempts;
- the same error for unknown, disabled, and incorrectly entered accounts.

The server fails to start if a required secret, setup token, or proxy trust is
missing.

## Managing accounts

Account Manager can:

- create a user or administrator;
- change your own password;
- let an administrator change a role, disable an account, or reset its password.

Disabling an account or changing its password revokes its active sessions. The
last active administrator cannot be disabled or demoted.

`TALESPINNER_ALLOW_REGISTRATION=true` enables the
`POST /api/auth/register` API for regular-user self-registration in public
mode. The built-in UI currently creates accounts through an administrator.
Keep it `false` when external clients must not register accounts themselves.

## Upgrading an existing installation

The first account receives the legacy `global` scope and therefore retains data
created before user accounts existed. Before the migration, TaleSpinner creates
a consistent SQLite backup at
`<database directory>/backups/db-pre-user-accounts-*.sqlite`. A successful
migration does not create another copy on later starts.

Before upgrading a hosted installation, still make an independent backup of the
entire `DATA_DIR`, including SQLite, media, and file-backed settings.
