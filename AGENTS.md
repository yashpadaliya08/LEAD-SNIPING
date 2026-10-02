# AGENTS.md - Lead Sniping System Workspace Rules

## Core Philosophy: The Zero-Slop, Ultra-Low-Latency Engineering Standard

1. **Architecture Before Implementation**: Every component must follow Clean Architecture / Hexagonal (Ports & Adapters) principles. Business logic, data ingestion, LLM pipelines, and external integrations (Upwork, Reddit, Telegram) must remain strictly decoupled.
2. **Speed is the Core Feature**: The end-to-end budget from job publication to Telegram alert with full proposal draft is strictly **<= 10 seconds** (target: **3.5 - 6.5s**). Every millisecond counts.
3. **No Generic AI Proposals**: Any proposal containing conversational filler ("Dear Hiring Manager", "I hope you are doing well", "I am a seasoned developer with 8+ years", "I am thrilled to apply") is considered a hard failure. All proposals must pass the **Swap Test**: if the first 2 lines can be copy-pasted to another job, it fails.
4. **Resilience & Stealth**: External platform monitoring must prioritize account safety. Upwork operations rely on client-side session bridging (browser extension) or stealth TLS-fingerprinted workers (`curl_cffi` / `tls-client`). Never harvest or store user passwords.
5. **Type Safety & Strict Validation**: All schemas across backend, queues, and frontend must be strictly typed using Zod / TypeScript strict mode. No implicit `any`, no unhandled promise rejections, no blind unwraps.
6. **Prompt Caching Discipline**: LLM prompt architectures must place static system directives, freelancer portfolio assets, and few-shot exemplars at the static prompt prefix (>= 1,024 tokens) to guarantee KV cache hits across all calls, reducing TTFT by 85%.
