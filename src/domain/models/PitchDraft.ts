export interface ScreeningAnswer {
  question: string;
  answer: string;
}

export interface PitchDraft {
  jobId: string;
  detectedClientName?: string;
  detectedEasterEgg?: string;
  winningHook: string; // The crucial first 150-200 characters passing the Swap Test
  diagnosisAndSolution: string; // Specific technical diagnosis & proposed execution
  proofOfExecution: string; // Micro-case study or immediate prototype offer
  consultativeQuestion: string; // Strategic question flipping dynamic from applicant to consultant
  fullPitchText: string; // The complete, ready-to-paste proposal (< 150 words)
  screeningAnswers: ScreeningAnswer[];
  matchScore: number; // 0 to 100
  matchReason: string;
  generationLatencyMs: number;
}
