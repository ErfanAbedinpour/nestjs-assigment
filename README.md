# NestJS Hexagonal Foundation

A production-conscious NestJS foundation with PostgreSQL, Prisma, RabbitMQ, and Redis. The repository establishes the infrastructure and module boundaries for future business capabilities without adding business entities, endpoints, or workflows.

## Technology stack

- Node.js 24 LTS and TypeScript 6
- NestJS 12
- PostgreSQL 18 and Prisma ORM 7 with the PostgreSQL driver adapter
- RabbitMQ 4 with the management plugin, using `amqplib` and `amqp-connection-manager` for connection lifecycle and reconnects
- Redis 8 using the official image, the `redis` Node client, and Nest DI through `@nestjs-redis/client`
- Docker Compose

## Architecture

Each future business capability belongs in an independent module with four inward-pointing layers:

- **Domain** holds framework-free business rules and types.
- **Application** coordinates use cases and defines the ports they need.
- **Infrastructure** implements those ports with Prisma, RabbitMQ, Redis, or other external systems.
- **Presentation** adapts external requests, such as HTTP, into application calls.

The infrastructure clients in this foundation are adapters. Business modules should depend on application/domain contracts and inject infrastructure implementations at the module boundary. Domain code must not import NestJS, Prisma, Redis, RabbitMQ, or configuration code.

## Directory structure

```text
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── config.module.ts
│   ├── configuration.ts
│   └── validation.schema.ts
├── modules/                         # Future independent business modules
├── shared/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── presentation/
└── infrastructure/
    ├── database/prisma/
    ├── messaging/rabbitmq/
    ├── cache/redis/
    └── infrastructure.module.ts

prisma/
├── schema.prisma
└── migrations/
docker/
test/
```

`PrismaService` and `RabbitMqService` manage connection startup and graceful shutdown. `@nestjs-redis/client` manages Redis connection lifecycle and is exposed through the local `RedisService` adapter. Infrastructure modules export only their infrastructure provider. No business module or HTTP controller is included.

## Prerequisites

- Node.js 24.15 or later on the 24.x LTS line
- npm 10 or later
- Docker Engine and Docker Compose v2

The Docker image uses the Node.js 24 Alpine LTS image. Copy `.env.example` to `.env` and replace all placeholder credentials with local values before starting the stack. `.env` is ignored by Git.

```sh
cp .env.example .env
npm ci
```

The example file uses Docker Compose service names (`postgres`, `rabbitmq`, and `redis`). When running the Nest process directly on the host, change those hosts and the URLs to `localhost`.

## Run with Docker Compose

```sh
docker compose up --build
```

Compose waits for PostgreSQL, RabbitMQ, and Redis health checks before starting the app. App and infrastructure ports are bound to loopback for local access. The RabbitMQ management UI is available at `http://localhost:15672` using the configured RabbitMQ credentials. Internal service traffic uses the Compose network and service names.

Other useful commands:

```sh
docker compose up -d --build
docker compose logs -f app
docker compose ps
docker compose down
```

Named volumes `postgres-data` and `redis-data` persist service data. `docker compose down` keeps those volumes. Removing volumes is a destructive operation and is intentionally not part of the normal shutdown command.

For a production deployment, supply production secrets through the deployment platform and expose the app through the intended ingress or reverse proxy. The Compose file's loopback port bindings are intended for a single-machine local stack.

## Run the app on the host

Start infrastructure, update `.env` hosts and connection URLs to `localhost`, then run the app:

```sh
docker compose up -d postgres rabbitmq redis
npm run start:dev
```

The app connects to all three infrastructure services during startup and closes those connections on shutdown.

## Prisma

Prisma 7 stores the datasource URL in `prisma.config.ts`; the schema declares only the PostgreSQL provider. The client is generated into the Prisma infrastructure folder and uses `@prisma/adapter-pg` at runtime. No business models are present.

```sh
npm run prisma:generate
npm run prisma:validate
npm run prisma:migrate:dev -- --name schema_change
npm run prisma:migrate:deploy
npm run prisma:migrate:status
npm run prisma:studio
```

Run `migrate:dev` in local development after changing the schema; it creates migration files for actual schema changes. Use `migrate:deploy` in a deployment workflow to apply committed migrations. No migration is run automatically at application startup.

## Available npm scripts

| Script                                 | Purpose                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `npm run start:dev`                    | Start NestJS with watch mode                                       |
| `npm run build`                        | Generate Prisma Client and build the NestJS app                    |
| `npm run start:prod`                   | Run the compiled app                                               |
| `npm run typecheck`                    | Check TypeScript without emitting files                            |
| `npm run lint`                         | Run ESLint                                                         |
| `npm run format` / `format:check`      | Format source and check formatting                                 |
| `npm test` / `test:watch` / `test:cov` | Run Vitest (configured to pass while the foundation has no tests)  |
| `npm run test:e2e`                     | Run the e2e Vitest configuration                                   |
| `npm run prisma:*`                     | Generate, validate, migrate, inspect status, or open Prisma Studio |

## Configuration notes

All environment variables are validated at application startup. `RABBITMQ_URL` and `REDIS_URL`, when non-empty, take precedence over their component settings. Leaving either URL blank builds it from the corresponding host, port, credentials, vhost, and database settings. Keep URL credentials synchronized with the service credentials used by Compose.

`APP_HOST_PORT`, `POSTGRES_HOST_PORT`, `RABBITMQ_HOST_PORT`, and `REDIS_HOST_PORT` control loopback-only host bindings independently from the internal service ports.

The services have health checks and restart policies. Internal database and broker ports are not published on a public interface by this Compose setup; local host port mappings bind to `127.0.0.1`.
