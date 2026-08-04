# Specmatic Multi-Microservices Suite

Five Node.js microservices — order, inventory, payment, shipping, notification —
contract tested end to end with **Specmatic Enterprise** over OpenAPI 3.0,
AsyncAPI 3.0 (Kafka) and Arazzo 1.1.

One config file (`specmatic.yaml`), one command, identical on a laptop and in CI.

---

## Quick start

```bash
cp .env.example .env          # generate values with `openssl rand -hex 16`
# put your Specmatic Enterprise license at ./license.txt (gitignored)

docker compose up specmatic-tests --build --abort-on-container-exit
docker compose down -v
```

The run fails immediately if `ORDER_API_KEY` or `PAYMENT_SERVICE_TOKEN` is
missing — no credential has a working default.

A clean run produces:

| Suite | Result |
| :--- | :--- |
| OpenAPI contract tests | 111 tests, 100% API coverage |
| AsyncAPI contract test | 1 test |
| Arazzo workflows | 4 workflows, 15 steps, 100% coverage |

Reports land in `build/reports/specmatic/`:

- `test/html/index.html` — REST contract tests and the API coverage table
- `async/test/html/index.html` — Kafka contract test
- `arazzo/html/index.html` — the cross-service workflows
- `stub/html/index.html` — what the Inventory and Payment mocks served
- `async/stub/html/index.html` — what the Kafka mock saw on `order-events`
- `**/ctrf/ctrf-report.json` — the same data as CTRF JSON for CI tooling

Each HTML report lists every generated test with its request, response and
verdict, plus per-operation and per-status-code coverage and anything reported as
`not tested`, `not implemented` or `missing in spec`.

---

## Architecture

```
       ┌───────────────────────────────────────────────────────────┐
       │  specmatic-tests    runs the mocks, then the tests         │
       │    :9001  Inventory mock      :9002  Payment mock          │
       └───▲──────────────▲───────────────────────────────────────┘
           │ upstream     │ upstream
           │              │
┌──────────┴────────┐  ┌──┴──────────────┐  ┌───────────────────┐
│ Inventory Service │  │  Order Service  │  │  Payment Service  │
│      :3001        │  │      :3000      │  │      :3002        │
└───────────────────┘  └────────┬────────┘  └───────────────────┘
   (real services, contract     │ publishes OrderCreated
    tested directly)            ▼
                     ┌──────────────────────┐
                     │   kafka       :9092  │
                     │   order-events topic │
                     └──────────┬───────────┘
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
     ┌───────────────────┐             ┌───────────────────┐
     │ Shipping Service  │             │ Notification Svc  │
     │      :3003        │             │  (consumer only)  │
     └───────────────────┘             └───────────────────┘
```

- **Order Service** (`:3000`) — `POST /orders`, `GET /orders/{id}`,
  `DELETE /orders/{id}`. Calls inventory and payment, then publishes
  `OrderCreated`. Its upstream calls go to the Specmatic mocks so it can be
  tested in isolation from real inventory and payment state.
- **Inventory Service** (`:3001`) — `GET /items/{id}`, `POST /items/reserve`.
- **Payment Service** (`:3002`) — `POST /payments`, polymorphic card vs
  bank-transfer request, bearer-token protected.
- **Shipping Service** (`:3003`) — consumes `order-events`, exposes
  `GET /shipments/{orderId}`.
- **Notification Service** — Kafka consumer, no HTTP surface.

Host ports are remapped to `1300x`; inside the compose network services talk on
their real ports. The Inventory and Payment mocks are published on `9001`/`9002`
and the Kafka broker on `9092`, so a local client can address any of them:
`curl localhost:13001/items/1`.

---

## Configuration layout

**`specmatic.yaml`** is the only Specmatic config in the project. It holds the
specs under test with their base URLs and security schemes, the AsyncAPI test
target, the Arazzo workflows in `workflows/`, every dependency mock, the
response-to-request chaining, and the governance gates. One `specmatic run-suite`
starts the mocks and then runs all three test phases from it.

**`docker-compose.yaml`** holds only orchestration: host port mappings, where
each service finds its peers, the secrets, and start-up ordering. Its one piece
of scripting writes the Arazzo workflow inputs from the environment before the
suite runs — Arazzo files have no environment substitution of their own.

**Each service's `Dockerfile`** holds what is intrinsic to that image — the port
it listens on (`ENV PORT` / `EXPOSE`) and how to tell whether it is healthy
(`HEALTHCHECK`). Compose waits on those healthchecks via `depends_on`.

`docker compose up specmatic-tests` starts only that service's dependency graph,
so every service the suite exercises is listed in its `depends_on`.

---

## What is implemented

- **OpenAPI 3.0 contract testing** — Specmatic generates requests from the specs,
  calls the running services and validates every response against the schema.
- **AsyncAPI 3.0 contract testing over Kafka** — `events-api.yaml` defines the
  `order-events` channel and the `OrderCreated` message.
- **Schema resiliency testing** (`schemaResiliencyTests: all`) — every valid
  payload is mutated with nulls, missing required fields and type/range
  violations, and the service must answer 4xx, never 500.
- **Polymorphic `oneOf` + `discriminator`** — `payment-api.yaml` models card and
  bank-transfer payments; every branch is tested.
- **Security schemes with credentials from the environment.**
- **Dependency mocking** — the Inventory and Payment HTTP mocks Order Service
  calls, plus a Kafka mock that validates every message published to
  `order-events` against the schema. All declared in the one config and started
  by `specmatic run-suite`.
- **Dictionary-driven generation** — domain values for the Inventory mock.
- **Externalised examples** — `contracts/examples/` supplies the 401 cases for
  `DELETE /orders/{id}` and `POST /payments`, without committing a real credential.
- **Overlay** — narrows the async test to the consumer side without editing the
  checked-in spec.
- **Response-to-request chaining** (`workflow.ids`) — config-driven: the orderId
  from `POST /orders` is threaded into the later `GET` and `DELETE`.
- **Arazzo 1.1 workflows** — `workflows/place-order.arazzo.yaml` holds four
  workflows covering the client-facing path, the internal hops Order Service
  makes, the cancellation auth sequence, and an inventory failure translating
  into a 400. Referenced from `specmatic.yaml`, not the command line.
- **Governance gates** — `minCoveragePercentage: 100`,
  `maxMissedOperationsInSpec: 0`, `enforce: true`.
- **HTML + CTRF reports**, uploaded as a CI artifact.
