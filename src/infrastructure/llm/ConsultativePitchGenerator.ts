import { IPitchGenerator } from "../../application/ports/IPitchGenerator.js";
import { JobLead } from "../../domain/models/JobLead.js";
import { PitchDraft, ScreeningAnswer } from "../../domain/models/PitchDraft.js";

export class ConsultativePitchGenerator implements IPitchGenerator {
  constructor(
    private readonly freelancerName: string,
    public readonly coreSpecialty: string
  ) {}

  public async generatePitch(lead: JobLead): Promise<PitchDraft> {
    const startTime = Date.now();

    // 1. Client name extraction
    const clientName = this.extractClientName(lead);

    // 2. Easter egg detection
    const easterEgg = this.detectEasterEgg(lead.description);

    // 3. Problem diagnosis & core technology identification
    const primaryTech = this.identifyPrimaryTech(lead);

    // 4. Craft winning hook passing the Swap Test
    const winningHook = this.craftWinningHook(lead, clientName, primaryTech, easterEgg);

    // 5. Diagnostic and execution solution
    const diagnosisAndSolution = this.craftDiagnosis(lead, primaryTech);

    // 6. Micro-proof of execution (Prototype offer)
    const proofOfExecution = this.craftProofOfExecution(primaryTech);

    // 7. Strategic consultative question
    const consultativeQuestion = this.craftConsultativeQuestion(lead);

    // 8. Assemble full pitch
    const fullPitchText = this.assembleFullPitch(
      winningHook,
      diagnosisAndSolution,
      proofOfExecution,
      consultativeQuestion
    );

    // 9. Screening questions detection & answers
    const screeningAnswers = this.generateScreeningAnswers(lead);

    const generationLatencyMs = Date.now() - startTime;

    return {
      jobId: lead.id,
      detectedClientName: clientName,
      detectedEasterEgg: easterEgg,
      winningHook,
      diagnosisAndSolution,
      proofOfExecution,
      consultativeQuestion,
      fullPitchText,
      screeningAnswers,
      matchScore: 92,
      matchReason: `High-value match for ${primaryTech} MVP / automation (${this.coreSpecialty})`,
      generationLatencyMs
    };
  }

  private extractClientName(lead: JobLead): string | undefined {
    if (lead.client.name && !lead.client.name.includes("_") && lead.client.name.length < 15) {
      // Capitalize
      return lead.client.name.charAt(0).toUpperCase() + lead.client.name.slice(1);
    }
    // Check description for feedback signs e.g., "Thanks John"
    const nameMatch = lead.description.match(/(?:working with|thanks to|cheers|hi|hey)\s+([A-Z][a-z]{2,12})\b/);
    if (nameMatch && nameMatch[1]) {
      return nameMatch[1];
    }
    return undefined;
  }

  private detectEasterEgg(description: string): string | undefined {
    const patterns = [
      /(?:start|begin|include)\s+(?:your\s+)?(?:proposal|cover\s*letter|bid|message)\s+(?:with|by\s+saying)\s+["']?([^"'\n.,!]+)["']?/i,
      /(?:keyword|code word|magic word)\s*(?:is|:)\s*["']?([^"'\n.,!]+)["']?/i,
      /(?:type|write)\s+["']([^"']+)["']\s+at the (?:top|beginning)/i,
      /(?:what is|solve:?)\s*(\d+\s*[\+\-\*]\s*\d+)/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private identifyPrimaryTech(lead: JobLead): string {
    const text = `${lead.title} ${lead.description}`.toLowerCase();
    if (text.includes("next.js") || text.includes("nextjs")) return "Next.js";
    if (text.includes("react")) return "React";
    if (text.includes("python") || text.includes("fastapi")) return "Python";
    if (text.includes("scraping") || text.includes("crawler") || text.includes("scraper"))
      return "Web Scraping & Data Extraction";
    if (text.includes("ai") || text.includes("openai") || text.includes("claude") || text.includes("llm"))
      return "AI & LLM Integration";
    if (text.includes("automation") || text.includes("bot") || text.includes("telegram"))
      return "Workflow Automation";
    if (text.includes("node") || text.includes("typescript")) return "TypeScript/Node.js";
    return "Full-Stack Web Development";
  }

  private craftWinningHook(
    lead: JobLead,
    clientName: string | undefined,
    tech: string,
    easterEgg: string | undefined
  ): string {
    const greeting = clientName ? `Hi ${clientName}` : "Hi there";
    const eggPrefix = easterEgg ? `${easterEgg}. ` : "";

    // Specific hook tailored to the title
    const cleanTitle = lead.title.replace(/\[hiring\]/gi, "").trim();

    return `${eggPrefix}${greeting} — regarding your "${cleanTitle}": I specialize in rapid ${tech} builds and can deliver a clean, working prototype without technical debt.`;
  }

  private craftDiagnosis(lead: JobLead, tech: string): string {
    const desc = lead.description.toLowerCase();
    if (desc.includes("scrape") || desc.includes("scraping")) {
      return "For this data extraction pipeline, I'll implement headless session handling with automatic rate-limit backoff and clean JSON/CSV structuring so the feeds never stall.";
    }
    if (desc.includes("bot") || desc.includes("telegram")) {
      return "I'll architect the bot with event-driven Webhooks rather than polling to guarantee instant sub-second response times and rock-solid uptime.";
    }
    if (desc.includes("mvp") || desc.includes("saas") || desc.includes("dashboard")) {
      return `For this ${tech} MVP, I structure modern component architecture with reactive state and clean API boundaries so you can launch and scale immediately.`;
    }
    return `I will structure the ${tech} architecture cleanly, ensuring responsive UI and bulletproof API integration from day one.`;
  }

  private craftProofOfExecution(tech: string): string {
    return `Instead of a generic proposal, I can put together the core functional ${tech} prototype for this today so you can test it directly before committing.`;
  }

  private craftConsultativeQuestion(lead: JobLead): string {
    const desc = lead.description.toLowerCase();
    if (desc.includes("api") || desc.includes("database")) {
      return "Do you already have the API documentation/credentials prepared, or should we scaffold the schema first?";
    }
    if (desc.includes("stripe") || desc.includes("payment")) {
      return "Are you integrating Stripe Checkout or custom Elements for payment processing?";
    }
    return "What is your target go-live date, and do you have existing design mockups or wireframes ready?";
  }

  private assembleFullPitch(
    hook: string,
    diagnosis: string,
    proof: string,
    question: string
  ): string {
    return `${hook}\n\n${diagnosis}\n\n${proof}\n\n${question}\n\nBest regards,\n${this.freelancerName}`;
  }

  private generateScreeningAnswers(lead: JobLead): ScreeningAnswer[] {
    const answers: ScreeningAnswer[] = [];
    const desc = lead.description;

    // Detect common screening questions in the job description
    const questionMatches = desc.match(/(?:question|q\d|screening)[\s:#]+([^\n?]+\?)/gi);
    if (questionMatches) {
      for (const q of questionMatches.slice(0, 3)) {
        answers.push({
          question: q.trim(),
          answer: `I handle this directly using modern ${this.identifyPrimaryTech(lead)} patterns with strict type-safety and automated error handling.`
        });
      }
    }

    return answers;
  }
}
