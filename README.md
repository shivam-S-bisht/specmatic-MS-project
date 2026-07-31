# 🚀 Specmatic Multi-Microservices Suite

An enterprise-grade, distributed microservices project demonstrating comprehensive contract testing, event-driven testing, resiliency mutation, and multi-step workflow automation using **Specmatic** (OpenAPI 3.0, AsyncAPI 3.0, Arazzo 1.0, and Specmatic Studio).

---

## 📐 System Architecture & Services

The system consists of **5 Node.js microservices** orchestrating order management, stock reservation, payment processing, shipping allocation, and notification delivery via REST APIs and Apache Kafka event streams:

```
                          ┌──────────────────────────┐
                          │   Specmatic Studio UI    │
                          │   http://localhost:9000  │
                          └─────────────┬────────────┘
                                        │
┌───────────────────┐    REST     ┌─────▼───────────┐    REST     ┌───────────────────┐
│ Inventory Service ◄─────────────┤  Order Service  ├────────────►│  Payment Service  │
│    (Port 3001)    │  (Mock:9001)│   (Port 3000)   │ (Mock:9002) │    (Port 3002)    │
└───────────────────┘             └────────┬────────┘             └───────────────────┘
                                           │ Publishes OrderCreated Event
                                           ▼
                                ┌─────────────────────┐
                                │ Kafka Event Broker  │
                                │    (Port 9092)      │
                                └──────────┬──────────┘
                                           │
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
             ┌───────────────────┐                   ┌───────────────────┐
             │ Shipping Service  │                   │Notification Serv. │
             │    (Port 3003)    │                   │    (Consumer)     │
             └───────────────────┘                   └───────────────────┘
```

1. **Order Service (Port 3000):** Orchestrates order creation (`POST /orders`), status retrieval (`GET /orders/{id}`), and order cancellation (`DELETE /orders/{id}`). Connects to Inventory and Payment services and publishes `OrderCreated` events to Kafka.
2. **Inventory Service (Port 3001):** Manages stock catalog (`GET /items/{id}`) and handles reservations (`POST /items/reserve`).
3. **Payment Service (Port 3002):** Processes transactions using polymorphic schemas (`CREDIT_CARD` vs `BANK_TRANSFER`).
4. **Shipping Service (Port 3003):** Consumes `order-events` from Kafka to allocate packages and exposes tracking (`GET /shipments/{orderId}`).
5. **Notification Service (Consumer):** Listens to Kafka `order-events` and triggers customer confirmation alerts.
6. **Kafka Broker:** Apache Kafka running in KRaft mode for event propagation.

---

## 🌟 Implemented Specmatic Features & Why We Used Them

### 1. 📜 OpenAPI (REST) Contract Testing
* **What We Implemented:** Full OpenAPI 3.0 specifications ([order-api.yaml](contracts/order-api.yaml), [inventory-api.yaml](contracts/inventory-api.yaml), [payment-api.yaml](contracts/payment-api.yaml), [shipping-api.yaml](contracts/shipping-api.yaml)).
* **Why We Used It:** Guarantees our Express REST endpoints comply 100% with API contracts. Specmatic generates test inputs dynamically and validates real HTTP response schemas against spec definitions.

### 2. ⚡ AsyncAPI (Kafka Event Stream) Contract Testing
* **What We Implemented:** AsyncAPI 3.0 specification in [events-api.yaml](contracts/events-api.yaml) defining Kafka channels (`order-events`) and message schemas (`OrderCreated`).
* **Why We Used It:** Validates asynchronous messaging between Order (Publisher) and Shipping/Notification (Subscribers) without manual Kafka payload assertions.

### 3. 🧩 Smart Upstream Dependency Mocking
* **What We Implemented:** Configured `dependencies.services` in service `specmatic.yaml` files. Specmatic auto-launches mocks for Inventory (`:9001`) and Payment (`:9002`) when testing Order service.
* **Why We Used It:** Enables true isolated microservice testing. The Order service can be verified without starting live downstream payment or inventory databases.

### 4. 🛡️ Negative Schema Mutations & Resiliency Testing (`schemaResiliencyTests: all`)
* **What We Implemented:** Enabled `schemaResiliencyTests: all` in `specmatic.yaml` across microservices.
* **Why We Used It:** Ensures services handle invalid data robustly. Specmatic automatically mutates payloads (nulls, missing required fields, type mismatches) and verifies the SUT responds with proper 4xx codes instead of 500 crashes.

### 5. 🔀 Polymorphic Discriminator Validation (`oneOf` + `discriminator`)
* **What We Implemented:** Used `oneOf` and `discriminator` in [payment-api.yaml](contracts/payment-api.yaml) for payment types (`CREDIT_CARD` vs `BANK_TRANSFER`).
* **Why We Used It:** Validates complex real-world data models. Specmatic generates test payloads for every polymorphic branch and validates correct schema selection.

### 6. 🔒 API Security Schemes & Access Control (`X-API-Key`)
* **What We Implemented:** Added header authentication (`X-API-Key`) to protected endpoints like `DELETE /orders/{id}` in [order-api.yaml](contracts/order-api.yaml).
* **Why We Used It:** Verifies security enforcement as part of contract tests. Confirms that missing or invalid API keys return `401 Unauthorized`.

### 7. 📖 Dictionary-Driven Data Generation (`dictionary.yaml`)
* **What We Implemented:** Created [contracts/dictionary.yaml](contracts/dictionary.yaml) defining domain-specific realistic values for item IDs, prices, stock levels, and product names.
* **Why We Used It:** Prevents test failures caused by completely random data. Ensures Specmatic uses valid domain-specific test values during contract test generation and stubbing.

### 8. 🔄 Arazzo Workflow Integration Testing (Arazzo 1.0 Specification)
* **What We Implemented:** Authored [place-order.arazzo.yaml](contracts/place-order.arazzo.yaml) executing a multi-step sequence: `placeOrder` ➡️ `getOrder` ➡️ `cancelOrder`.
* **Why We Used It:** Tests complete end-to-end business transactions across services, passing outputs dynamically between steps and generating HTML coverage reports.

### 9. 🎨 Specmatic Studio Workspace
* **What We Implemented:** Configured Docker Studio profile on port 9000 with interactive web navigation and workflow canvas authoring.
* **Why We Used It:** Gives developers and QA engineers a visual UI to inspect contracts, trigger tests against live services, and drag-and-drop endpoints onto an Arazzo canvas.

---

## 🔬 How Lab Patterns Improve Testing

| Specmatic Feature / Lab Pattern | What It Does | How It Improves Testing |
| :--- | :--- | :--- |
| **Schema Resiliency Testing** | Mutates valid request payloads (nulls, missing fields, out-of-bound numbers). | Eliminates hundreds of manual negative test scripts and prevents `500 Internal Server Error` production crashes. |
| **Polymorphic Discriminator** | Validates request/response bodies taking multiple structural forms (`oneOf`). | Ensures 100% test coverage across every schema branch, preventing silent deserialization bugs. |
| **Arazzo Integration Workflows** | Executes multi-step business transactions (`placeOrder` ➡️ `getOrder` ➡️ `cancelOrder`). | Moves beyond isolated single-endpoint testing to catch dynamic state management and parameter extraction bugs. |
| **API Security Schemes** | Asserts security constraints (`X-API-Key` headers on destructive routes). | Automates security compliance, ensuring key-less requests are rejected (`401 Unauthorized`). |
| **Dictionary-Driven Generation** | Supplies domain-specific realistic values to Specmatic's random data generator. | Prevents false-negative test failures from arbitrary random numbers and ensures mock stubs mirror production data. |
| **Specmatic Studio Workspace** | Web UI for inspecting specs, executing tests, and visually authoring workflows. | Lowers barrier to entry for QA and non-coders to design, debug, and review integration workflows visually. |

---

## 🔬 Specmatic Labs Integration Mapping

| GitHub Lab Repository | How Integrated in This Project | Implementation Files |
| :--- | :--- | :--- |
| `schema-resiliency-testing` | Enabled `schemaResiliencyTests: all` setting in service configurations. | [order-service/specmatic.yaml](order-service/specmatic.yaml) |
| `schema-design` | Added polymorphic `oneOf` request schemas with explicit `discriminator` property. | [contracts/payment-api.yaml](contracts/payment-api.yaml) |
| `arazzo-workflow-testing` | Authored Arazzo 1.0 workflow spec defining dynamic parameter passing & success criteria. | [contracts/place-order.arazzo.yaml](contracts/place-order.arazzo.yaml) |
| `api-resiliency-testing` | Implemented `X-API-Key` header security parameters and 401 Unauthorized handling. | [contracts/order-api.yaml](contracts/order-api.yaml) |
| `mcp-auto-test` | Configured Specmatic Studio web interface container profile on port 9000. | [docker-compose.yaml](docker-compose.yaml) |
| Dictionary Pattern | Created domain dictionary with curated prices, stock, and names. | [contracts/dictionary.yaml](contracts/dictionary.yaml) |

---

## 💻 Commands & Execution Guide

### 1. Run Full Contract & Workflow Test Suite
Execute from project root directory:
```bash
docker compose up specmatic-test --build --abort-on-container-exit
```
* **Test Sequence Executed:**
  1. Inventory Service Contract Tests (100% Coverage)
  2. Payment Service Contract Tests (100% Coverage)
  3. Order Service Contract Tests (100% Coverage, automatic Inventory/Payment/Kafka mocking)
  4. Shipping Service Contract Tests (100% Coverage, automatic Kafka event injection)
  5. Notification Service Contract Tests (Consumer-only isolated contract testing via OPERATION-ID filter)
  6. Arazzo Integration Workflow Tests (100% Workflow Coverage: `placeOrder` ➡️ `getOrder` ➡️ `cancelOrder`)
### 2. Clean Up Containers & Networks
```bash
docker compose down -v
```

---

## 📊 Interactive Documentation Dashboard

View the interactive HTML dashboard detailing the architecture, statistics, and features:
👉 Open **[specmatic_architecture_overview.html](specmatic_architecture_overview.html)** in your browser.
