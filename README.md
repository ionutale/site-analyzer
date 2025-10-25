# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Docker Compose: MongoDB

Spin up a local MongoDB for development using the provided `docker-compose.yml`.

### Start/Stop

```sh
# start in the background
docker compose up -d

# view logs
docker compose logs -f mongodb

# stop and remove containers (volumes are preserved)
docker compose down

# remove containers and named volumes
docker compose down -v
```

### Troubleshooting

- Error: `Command update requires authentication`
  - Cause: Existing MongoDB volumes were created earlier with authentication enabled and persisted.
  - Fix options:
    - Easiest: reset volumes and start fresh
      ```sh
      docker compose down -v
      docker compose up -d
      ```
    - Non-destructive: we switched to new dev volumes (`mongo-data-dev`, `mongo-config-dev`) so `docker compose up -d` will start a fresh no-auth instance without touching older volumes.

### Connection (no-auth default)

- Default creds (dev only): username `root`, password `example`
- Local connection string (admin DB):

```
mongodb://root:example@localhost:27017/?authSource=admin
```

- If you create an app database (e.g. `app`):

```
mongodb://root:example@localhost:27017/app?authSource=admin
```

### Data and optional tools

### Auth mode (optional)

This repo includes an init script to create a non-root dev user `local-user` with password `1234567890` on DB `sv-app`.

To enable auth:

1. Ensure the compose file has these env vars (already configured):

```
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=admin
MONGO_INITDB_DATABASE=sv-app
```

2. Start fresh so the init scripts run (first-run only):

```sh
docker compose down -v
docker compose up -d
```

3. Use this connection string:

```
mongodb://local-user:1234567890@localhost:27017/sv-app?authSource=sv-app
```

If you prefer a different password or database, edit `docker/mongo-init/01-create-local-user.js` and restart with `down -v`.

- Data persists in named volumes: `mongo-data` and `mongo-config`.
- To auto-seed on first run, place `.js` or `.sh` files in `./docker/mongo-init` and
  uncomment the corresponding volume line in `docker-compose.yml`.
- Optional web UI: uncomment the `mongo-express` service in `docker-compose.yml` and open
  http://localhost:8081.
