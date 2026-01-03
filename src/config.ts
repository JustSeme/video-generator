import "dotenv/config";
import path from "node:path";
import { AppConfig } from "./types.js";

function asBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return value === "1" || value.toLowerCase() === "true";
}

function asInt(value: string | undefined, defaultValue: number) {
  if (!value) return defaultValue;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

export function loadConfig(): AppConfig {
  const outputDir = process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.resolve("./out");

  return {
    outputDir,
    ffmpegBin: process.env.FFMPEG_BIN ?? "ffmpeg",
    totalDurationSec: asInt(process.env.TOTAL_DURATION_SEC, 60),
    scenesCount: asInt(process.env.SCENES_COUNT, 6),
    cleanup: asBool(process.env.CLEANUP, false),
    providers: {
      llmScriptProvider: (process.env.LLM_SCRIPT_PROVIDER as any) ?? "openai",
      llmVisualProvider: (process.env.LLM_VISUAL_PROVIDER as any) ?? "anthropic",
      ttsProvider: (process.env.TTS_PROVIDER as any) ?? "mock",
      imageProvider: (process.env.IMAGE_PROVIDER as any) ?? "mock",
    },
  };
}
