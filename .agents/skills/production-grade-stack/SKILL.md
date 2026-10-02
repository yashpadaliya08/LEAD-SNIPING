---
name: production-grade-stack
description: >-
  Standard operating procedures and architectural patterns for building resilient,
  enterprise-grade fullstack web applications, microservices, real-time queues, and data stores.
---

# Production-Grade Architecture & Clean Code Blueprint

## 1. High-Performance Backend Architecture

### Recommended Stack Options
- **Node.js / TypeScript**: Fastify (3x faster than Express, native schema compilation with TypeBox/Zod) or NestJS (structured enterprise DI).
- **Go / Golang**: For the core scraper daemon, concurrent workers, and sub-millisecond network I/O.
- **Queue / Broker**: Redis Streams or BullMQ (Node) backed by Redis 7 / Dragonfly (ultra-low latency in-memory engine).
- **Primary Database**: PostgreSQL 16+ with `pgvector` extension for unified relational + vector similarity queries.

### Hexagonal Architecture (Directory Blueprint)
```text
src/
├── domain/                  # Enterprise Business Rules (Entities, Value Objects)
│   ├── models/
│   │   ├── JobLead.ts
│   │   ├── ClientProfile.ts
│   │   └── ProposalPitch.ts
│   └── errors/              # Domain-specific typed exceptions
├── application/             # Application Business Rules (Use Cases, Ports)
│   ├── ports/
│   │   ├── IJobScraperGateway.ts
│   │   ├── IProposalGenerator.ts
│   │   ├── INotificationGateway.ts
│   │   └── ILeadRepository.ts
│   └── use-cases/
│       ├── IngestAndScoreLead.ts
│       └── GenerateAndDispatchPitch.ts
├── infrastructure/          # Interface Adapters & Frameworks
│   ├── database/
│   │   ├── pgvector.ts
│   │   └── repositories/
│   ├── queues/
│   │   ├── redis-stream-worker.ts
│   │   └── deduplication-cache.ts
│   ├── scrapers/
│   │   ├── upwork-extension-bridge.ts
│   │   └── reddit-stream-watcher.ts
│   ├── llm/
│   │   └── cached-prompt-service.ts
│   └── notifiers/
│       └── telegram-bot-service.ts
└── presentation/            # Entrypoints
    ├── api/                 # Fastify HTTP REST & SSE / WebSocket
    └── cli/                 # Daemon worker entry
```

---

## 2. Modern Frontend Blueprint (2025/2026 Trends)

### Tech Selection
- **Framework**: Next.js 15 (App Router with React Server Components) or Vite + React 19 / Svelte 5.
- **Styling**: CSS Custom Properties design tokens + Vanilla CSS / modern Tailwind CSS v4.
- **Real-Time State**: TanStack Query (React Query) + WebSockets or Server-Sent Events (SSE) for zero-lag live feed updates.
- **Aesthetic Guidelines**:
  - Dark Mode First: Deep slate/zinc canvas (`#0b0f19`), subtle surface borders (`rgba(255,255,255,0.08)`).
  - Glassmorphic accents (`backdrop-filter: blur(12px)`).
  - Micro-interactions: Framer Motion / CSS cubic-bezier transitions on cards, buttons, badges.

---

## 3. Resilience, Fault Tolerance & Error Handling

1. **Circuit Breakers**: Wrap external APIs (Telegram, LLM providers, Reddit) with Polly / Bider / opossum circuit breakers to prevent cascade failures.
2. **Exponential Backoff with Full Jitter**:
   `delay = min(max_delay, base * 2^attempt) + rand(0, jitter)`
3. **Dead-Letter Queues (DLQ)**: Any failed job alert or parsing error after 3 retries is pushed to a Redis DLQ for inspection.
4. **Graceful Teardown**: Listen to `SIGTERM` and `SIGINT`, pause queue consumption, wait for in-flight LLM calls to resolve (max 5s timeout), and close DB pools cleanly.
