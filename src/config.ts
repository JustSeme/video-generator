import "dotenv/config";
import path from "node:path";
import { AppConfig } from "./types.js";

export function loadConfig(): AppConfig {
  const outputDir = process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.resolve("./out");

  return {
    topicTitle: 'Когнитивная нагрузка в программировании',
    topicDescription: 'Короткий ролик про то, как когнитивная нагрузка влияет на продуктивность разработчиков и как с ней бороться в повседневной работе.',
    outputDir,
    ffmpegBin: "ffmpeg",
    totalDurationSec: 60,
    scenesCount: 6,
    cleanup: false,
    providers: {
      llmScriptProvider: "openai",
      llmVisualProvider: "anthropic",
      ttsProvider: "coqui",
      imageProvider: "openai",
    },
  };
}
