# DK Clim monorepo

This repository contains the WhatsApp sales and service bot, the operations dashboard, and the shared business catalog.

```text
bot/        whatsapp-web.js bot, PostgreSQL pool, and V2 conversation engine
dashboard/  Next.js admin, inventory, sales, and intervention APIs
shared/     canonical business.json catalog used by both applications
```

## Local commands

- `npm start` starts the bot from `bot/`.
- `npm test` runs the bot unit tests.
- `npm run build:dashboard` builds the Next.js app.
- `npm run db:migrate:deploy` applies the shared PostgreSQL migrations.
- `npm run install:bot` and `npm run install:dashboard` install each app from its lockfile.

Copy `.env.example` to `.env` for local bot development. Configure the same PostgreSQL database in `DATABASE_URL` and `DIRECT_URL`; the dashboard deployment also needs those variables, `JWT_SECRET`, `ADMIN_PASSWORD`, `WEBHOOK_SECRET`, and `BOT_URL`. Never commit `.env`.

The bot is deployed from the root `Dockerfile`. The root `netlify.toml` configures the dashboard base directory. Run `npm run db:migrate:deploy` once against the production database before deploying code that uses the new columns.

Inventory offers and allowable catalog values live in `shared/business.json`. Actual availability is read from the shared PostgreSQL `Inventory` table. A product is not quoted or sold unless it has stock, and a sale cancellation restores one unit in the same database transaction as the status change.
