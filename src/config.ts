import "dotenv/config";
import path from "node:path";
import { AppConfig } from "./types.js";

export function loadConfig(): AppConfig {
  const outputDir = process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.resolve("./out");

  return {
    outputDir,
    ffmpegBin: "ffmpeg",
    totalDurationSec: 60,
    scenesCount: 6,
    cleanup: false,
    providers: {
      llmScriptProvider: "openai",
      llmVisualProvider: "anthropic",
      ttsProvider: "elevenlabs",
      imageProvider: "openai",
    },
  };
}
