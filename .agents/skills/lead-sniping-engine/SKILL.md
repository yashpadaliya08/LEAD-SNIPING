---
name: lead-sniping-engine
description: >-
  Playbook and operational procedures for building, maintaining, and scaling the freelance lead sniping engine.
  Use when designing feed monitors, anti-bot bypass mechanisms, latency budgets, proposal generation engines,
  or notification pipelines for Upwork, Reddit, Hacker News, and remote job boards.
---

# Lead Sniping Engine: Operational Playbook

## 1. Platform Ingestion Strategies

### A. Upwork (Post-August 2024 Strategy)
*Context: Upwork discontinued legacy RSS feeds on Aug 20, 2024. WAF employs Cloudflare Turnstile, Akamai Bot Manager, and TLS Fingerprinting.*
1. **Primary Route: Local Browser Extension Bridge (Zero-Ban Architecture)**
   - Manifest V3 Chrome Extension running on freelancer's browser.
   - Leverages active authenticated session cookies (`oauth2_global_js_token`, user session).
   - Polls Upwork GraphQL (`https://www.upwork.com/api/graphql/v1`) using standard `fetch()` from background service worker.
   - Forwards raw job payloads via encrypted WebSocket or HTTPS POST to our local or private cloud ingest server.
   - *Advantage*: Zero proxy fees, zero TLS fingerprint mismatches, 100% legitimate traffic footprint.
2. **Secondary Route: Stealth TLS Impersonator**
   - For autonomous server-side monitoring without active browser sessions.
   - Uses `curl_cffi` (Python) or `tls-client` (Go) simulating Chrome JA3/JA4 fingerprints and HTTP/2 settings.
   - Employs high-reputation rotating residential proxies (e.g. BrightData, Webshare, Oxylabs).
   - Ingests visitor search tokens dynamically.

### B. Reddit Real-Time Job Stream
- Monitored Subreddits: `r/forhire`, `r/freelance_forhire`, `r/Jobbit`, `r/RemoteJobs`, `r/hiring`.
- Protocol: Reddit API stream (`/r/.../new.json` or PRAW `subreddit.stream.submissions(skip_existing=True)`).
- Filter: Require `[Hiring]` or `[hiring]` in title, filter out `[For Hire]`.
- Latency: < 1.0 second from post submission.

### C. Hacker News & Remote Job Boards
- Hacker News: "Ask HN: Who is hiring?" thread (monthly). Ingest top comments in real-time via Firebase API (`https://hacker-news.firebaseio.com/v0/item/{id}.json`).
- RemoteOK & We Work Remotely: Public JSON/Atom endpoints polled on 30-second staggered intervals.

---

## 2. Ultra-Low-Latency Pipeline (End-to-End < 6.5s)

```
[Job Ingestion] (~1-3s polling/stream)
       │
       ▼
[Stage 1: Deduplication & Fast Heuristic Filter] (< 10ms)
       │ - Redis SETNX with hash key: `seen:{platform}:{id}`
       │ - Budget validation: Hourly >= $45 or Fixed >= $500
       │ - Client Reputation: Hire rate >= 50%, payment verified, review count >= 3
       │ - Negative keyword filter: "unpaid", "rev-share", "equity only"
       ▼
[Stage 2: Semantic Relevance & Skill Matching] (< 40ms)
       │ - Generate embedding of job description (or BM25 + cosine similarity)
       │ - Compare against Freelancer Profile Vectors in pgvector / LanceDB
       │ - Match Score Threshold >= 0.78
       ▼
[Stage 3: Proposal Draft Generation (Prompt Caching)] (~1.2 - 2.0s)
       │ - Static Prefix (KV Cached): System rules, user portfolio, past winning hooks
       │ - Dynamic Suffix: Cleaned job description, extracted client name, client tone
       │ - LLM: Gemini 2.0 Flash / Claude 3.5 Haiku / GPT-4o-mini
       │ - Output: JSON { hook, diagnosis, proof, strategic_question, answers_to_questions }
       ▼
[Stage 4: Telegram Bot Instant Dispatch] (~300ms)
       │ - Rich Markdown alert with inline action keyboard:
       │   [📋 Copy Hook] [🚀 Copy Full Pitch] [🌐 Open Job] [❌ Disqualify]
       ▼
[Freelancer Phone Vibrates] (Total Latency: 3.5s - 6.5s)
```

---

## 3. Proposal Conversion Science & Psychology

### The 5 Golden Rules of Pitching
1. **The First 150 Characters (The Hook)**: Upwork shows only the first 2 lines in the client review feed. Must immediately reference a specific project requirement or offer a concrete diagnostic insight.
2. **The "Swap Test"**: If the opening lines could apply to a different job, they are garbage. Always personalize around the client's explicit pain.
3. **Client Name Extraction**: Scrape the client's past feedback reviews to find their first name (e.g., *"Working with David was great..."* -> Open with *"Hi David,"*). Creates instant psychological affinity.
4. **Easter Egg Spotter**: Detect hidden instructions (e.g., "Start your proposal with 'Pineapple'", "Answer: what is 7+3?"). Place the answer precisely where requested.
5. **No Self-Centered Resumes**: Never start with "I am an expert..." or "I have 7 years of experience in React." Start with: "Your Postgres query latency on the orders table is almost certainly caused by..."

---

## 4. Telegram Alert Layout Spec

```text
⚡ NEW HIGH-MATCH LEAD (Upwork) — 94% Match
━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Title: Senior Full-Stack Next.js & PostgreSQL Optimization
💰 Budget: $80/hr (Estimated: 20-30 hrs/week)
👤 Client: United States | ⭐ 4.95 (34 reviews) | 88% Hire Rate | $120k+ Spent
🕵️ Detected Client Name: Marcus

🎯 WINNING HOOK (First 2 Lines):
Hi Marcus, if your Next.js Server Components are stalling on the orders feed, it's typically missing composite index pushdowns or unmemoized Prisma queries.

📝 FULL PITCH DRAFT:
[Clean, 120-word consultative proposal drafted specifically for Marcus]

❓ SCREENING QUESTION ANSWERS:
Q1: How do you handle cold-start serverless connections?
A1: We pool via Prisma Accelerate / PgBouncer with keep-alive connections.

━━━━━━━━━━━━━━━━━━━━━━━━━━
[📋 Copy Hook]  [🚀 Copy Full Pitch]
[⚡ Open Upwork Job]  [🚫 Mute Client]
```
