import "dotenv/config";
import path from "node:path";
import { AppConfig } from "./types.js";

export function loadConfig(): AppConfig {
  const outputDir = process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.resolve("./out");

  return {
    topicTitle: 'История Анатолии и Балкан 14-15 веков',
    topicDescription: 'Короткий ролик про историю Анатолии и Балкан в 14-15 веках.',
    outputDir,
    ffmpegBin: "ffmpeg",
    totalDurationSec: 60,
    scenesCount: 6,
    cleanup: false,
    providers: {
      llmScriptProvider: "openai",
      llmVisualProvider: "anthropic",
      ttsProvider: "coqui",
      imageProvider: "google",
    },
  };
}
