import { config } from "./config/env.js";
import { PersistentDeduplicationStore } from "./infrastructure/cache/PersistentDeduplicationStore.js";
import { DEFAULT_FILTER_CRITERIA } from "./domain/models/FilterCriteria.js";
import { IngestAndFilterLeadUseCase } from "./application/use-cases/IngestAndFilterLeadUseCase.js";
import { ConsultativePitchGenerator } from "./infrastructure/llm/ConsultativePitchGenerator.js";
import { TelegramNotifierAdapter } from "./infrastructure/notifiers/TelegramNotifierAdapter.js";
import { GenerateAndDispatchPitchUseCase } from "./application/use-cases/GenerateAndDispatchPitchUseCase.js";
import { RedditJobFeedAdapter } from "./infrastructure/feeds/RedditJobFeedAdapter.js";
import { UpworkFeedAdapter } from "./infrastructure/feeds/UpworkFeedAdapter.js";
import { WeWorkRemotelyFeedAdapter } from "./infrastructure/feeds/WeWorkRemotelyFeedAdapter.js";
import { HackerNewsFeedAdapter } from "./infrastructure/feeds/HackerNewsFeedAdapter.js";
import { RemoteOKFeedAdapter } from "./infrastructure/feeds/RemoteOKFeedAdapter.js";
import { RemotiveFeedAdapter } from "./infrastructure/feeds/RemotiveFeedAdapter.js";
import { FreelancerFeedAdapter } from "./infrastructure/feeds/FreelancerFeedAdapter.js";
import { IJobFeedSource } from "./application/ports/IJobFeedSource.js";

async function bootstrap() {
  console.log("====================================================");
  console.log("⚡ FREELANCE LEAD SNIPER ENGINE — INITIALIZING");
  console.log("====================================================");
  console.log(`👤 Target Profile: ${config.FREELANCER_NAME} (${config.FREELANCER_TITLE})`);
  console.log(`🎯 Sweet-Spot Skills: ${config.FREELANCER_CORE_SKILLS}`);
  console.log(`⏱ Polling Interval: ${config.POLL_INTERVAL_MS}ms`);
  console.log(`🛡 Max Alerts / Hour: ${config.MAX_ALERTS_PER_HOUR} (Anti-spam quota)`);

  // 1. Dependency Injection Setup (Hexagonal Architecture with Persistent Cache)
  const deduplicationStore = new PersistentDeduplicationStore();
  const filterUseCase = new IngestAndFilterLeadUseCase(
    deduplicationStore,
    {
      ...DEFAULT_FILTER_CRITERIA,
      maxLeadAgeHours: config.MAX_LEAD_AGE_HOURS
    }
  );

  const pitchGenerator = new ConsultativePitchGenerator(
    config.FREELANCER_NAME,
    config.FREELANCER_TITLE
  );

  const telegramNotifier = new TelegramNotifierAdapter(
    config.TELEGRAM_BOT_TOKEN,
    config.TELEGRAM_CHAT_ID,
    config.MAX_ALERTS_PER_HOUR
  );

  const dispatchUseCase = new GenerateAndDispatchPitchUseCase(
    pitchGenerator,
    telegramNotifier
  );

  const feedSources: IJobFeedSource[] = [
    new FreelancerFeedAdapter(),
    new RemoteOKFeedAdapter(),
    new RemotiveFeedAdapter(),
    new WeWorkRemotelyFeedAdapter(),
    new HackerNewsFeedAdapter(),
    new UpworkFeedAdapter(),
    new RedditJobFeedAdapter()
  ];

  console.log(`📡 Active Feed Sources: [${feedSources.map((s) => s.platformName).join(", ")}]`);

  // 2. Initial Telegram Connectivity Verification
  try {
    const testUrl = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/getMe`;
    const res = await fetch(testUrl);
    const data = await res.json() as { ok: boolean; result?: { username: string } };
    if (data.ok && data.result) {
      console.log(`✅ Telegram Bot Connected: @${data.result.username}`);
    } else {
      console.warn("⚠️ Telegram Bot Token check failed. Check your TELEGRAM_BOT_TOKEN in .env");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Telegram connectivity warning: ${message}`);
  }

  console.log("🚀 Sniper Radar is ACTIVE. Listening for high-value leads...\n");

  // 3. Execution Cycle
  let isCycleRunning = false;

  const runCycle = async () => {
    if (isCycleRunning) return;
    isCycleRunning = true;
    let totalScanned = 0;
    let qualifiedThisCycle = 0;
    let dispatchedThisCycle = 0;

    try {
      for (const source of feedSources) {
        const rawJobs = await source.pollNewJobs();
        totalScanned += rawJobs.length;
        for (const job of rawJobs) {
          try {
            // Step 1: Filter & Deduplicate
            const qualifiedJob = await filterUseCase.evaluate(job);
            qualifiedThisCycle++;

            console.log(
              `🎯 [QUALIFIED LEAD] [${qualifiedJob.platform.toUpperCase()}] "${qualifiedJob.title.slice(0, 50)}..."`
            );

            // Step 2: Generate Consultative Pitch & Dispatch Alert
            const report = await dispatchUseCase.execute(qualifiedJob);
            if (report.dispatched) {
              dispatchedThisCycle++;
            }

            console.log(
              `⚡ [ALERT DISPATCHED] Lead ID: ${report.leadId} | Latency: ${report.totalLatencyMs}ms | Status: ${report.dispatched ? "OK" : "FAILED"}`
            );
          } catch (err: unknown) {
            // Disqualified or duplicate jobs throw typed domain errors (normal flow)
          }
        }
      }

      const timestamp = new Date().toLocaleTimeString();
      console.log(
        `[${timestamp}] 📡 Radar sweep complete. ${totalScanned} listings inspected across ${feedSources.length} feeds. (${qualifiedThisCycle} qualified, ${dispatchedThisCycle} alerts sent). Radar listening, next sweep in ${config.POLL_INTERVAL_MS / 1000}s...`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Error during polling cycle: ${message}`);
    } finally {
      isCycleRunning = false;
    }
  };

  // Run immediately, then repeat
  await runCycle();
  const intervalHandle = setInterval(runCycle, config.POLL_INTERVAL_MS);

  // 4. Graceful Shutdown
  const shutdown = () => {
    console.log("\n🛑 Shutting down Lead Sniper Engine gracefully...");
    clearInterval(intervalHandle);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  console.error("❌ Fatal Bootstrap Error:", err);
  process.exit(1);
});
