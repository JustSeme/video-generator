export type Topic = {
  title: string;
  description: string;
};

export type Scene = {
  id: string;
  title: string;
  text: string;
  visual: string;
  duration: number;
};

export type ProvidersConfig = {
  llmScriptProvider: "openai" | "anthropic";
  llmVisualProvider: "openai" | "anthropic";
  ttsProvider: "elevenlabs" | "coqui";
  imageProvider: "openai";
};

export type AppConfig = {
  topicTitle: string;
  topicDescription: string;
  outputDir: string;
  ffmpegBin: string;
  totalDurationSec: number;
  scenesCount: number;
  cleanup: boolean;
  providers: ProvidersConfig;
};

export class NeuralNetworkError extends Error {
  constructor(message: string, public readonly provider: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'NeuralNetworkError';
  }
}