# Engineering Excellence & Quality Code Standards

## 1. Architectural Integrity (Hexagonal / Ports & Adapters)
- **Domain Layer (Core)**: Pure business models, value objects, and domain logic. Zero external dependencies.
- **Application Layer (Use Cases)**: Orchestrates domain entities to fulfill user stories (e.g., `IngestJobUseCase`, `ScoreLeadUseCase`, `GeneratePitchUseCase`, `DispatchAlertUseCase`). Depends only on Domain.
- **Ports (Interfaces)**: Inbound ports (API controllers, queue listeners) and Outbound ports (`IJobFeedGateway`, `IVectorStore`, `ILLMProvider`, `INotificationService`).
- **Adapters (Infrastructure)**: Concrete implementations of ports (`UpworkBrowserBridgeAdapter`, `RedditPrawAdapter`, `TelegramNotifierAdapter`, `PgVectorAdapter`).

## 2. Backend Engineering Best Practices
- **Strict Typing**: TypeScript `strict: true`, no `any`, `unknown` used with type guards, exhaustive switch/union checks.
- **Runtime Validation**: Validate all inbound payloads (webhooks, scraped payloads, API inputs) with Zod schemas. Fail fast at the boundary.
- **Concurrency & Event Streams**:
  - Use Redis Streams / BullMQ for asynchronous job queues.
  - Idempotency keys (`hash(job.platform + job.externalId)`) with TTL to prevent duplicate processing.
  - Graceful shutdown handling (`SIGINT`, `SIGTERM`), draining worker queues without dropped jobs.
- **Structured Logging & Telemetry**:
  - Use JSON-structured logger (Pino or Go Zap) with trace IDs (`trace_id`, `job_id`, `stage`).
  - Track Latency Budgets per pipeline stage: `[ingest_ms, filter_ms, vector_match_ms, llm_ttft_ms, llm_total_ms, alert_ms]`.

## 3. Real-Time Frontend & Dashboard Standards
- **Component Architecture**: Atomic, composable components. Separate UI presentation from business logic hooks.
- **Zero CLS & Fluid UX**: Skeletons for loading states, optimistic UI updates, zero Cumulative Layout Shift.
- **Design Tokens**: Standardized CSS custom properties for semantic colors (e.g. `--bg-surface`, `--accent-primary`, `--text-muted`), spacing, and border radii.
- **WebSocket / SSE Protocol**: Resilient real-time connection with exponential backoff reconnection, heartbeat ping/pong, and message deduplication.

## 4. AI & Prompt Engineering Discipline
- **KV Cache Optimization**: Maintain >= 1024 static tokens at prompt origin (persona, portfolio, rules, few-shot pairs). Never inject variable timestamps or job IDs into the static prefix.
- **Structured JSON Outputs**: Use constrained schema generation (OpenAI Structured Outputs / Gemini JSON Schema / Anthropic Tools) to guarantee parseable, type-safe pitch objects.
- **Anti-Hallucination & Anti-Fluff Constraints**: Negative constraints explicitly forbidding generic introductions, buzzwords, and unsubstantiated claims.
