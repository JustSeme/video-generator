import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getChatModel } from "./llm.js";
import { Scene, Topic } from "./types.js";

const SceneSchema = z.object({
  title: z.string(),
  text: z.string(),
  visual: z.string(),
  duration: z.number(),
});

const ScenesSchema = z.object({
  scenes: z.array(SceneSchema),
});

function normalizeDurations(scenes: Scene[], totalDurationSec: number): Scene[] {
  const safeScenes = scenes.map((s) => ({ ...s, duration: Math.max(3, Math.round(s.duration)) }));
  const sum = safeScenes.reduce((acc, s) => acc + s.duration, 0);
  if (!sum) {
    const per = Math.max(3, Math.round(totalDurationSec / Math.max(1, safeScenes.length)));
    return safeScenes.map((s) => ({ ...s, duration: per }));
  }

  const scaled = safeScenes.map((s) => ({
    ...s,
    duration: Math.max(3, Math.round((s.duration / sum) * totalDurationSec)),
  }));

  let diff = totalDurationSec - scaled.reduce((acc, s) => acc + s.duration, 0);
  for (let i = 0; i < scaled.length && diff !== 0; i += 1) {
    const step = diff > 0 ? 1 : -1;
    if (scaled[i].duration + step >= 3) {
      scaled[i].duration += step;
      diff -= step;
    }
  }

  return scaled;
}

export async function generateScript(params: {
  topic: Topic;
  scenesCount: number;
  totalDurationSec: number;
  provider: "openai" | "anthropic";
}): Promise<Scene[]> {
  const model = getChatModel(params.provider);
  const structured = model.withStructuredOutput(ScenesSchema);

  const system =
    "You are a professional screenwriter for YouTube videos." +
    "Write in English, in dynamic tempo, add specific examples and micro-conflicts. " +
    "Each scene: title (short descriptive title), text (audio of up to 3 sentences), " +
    "visual (specific description of an image, carefully selected to match the scene for visual accompaniment to convey atmosphere and key elements of the scene), " +
    "duration (seconds, how long the scene will last).";

  const user =
    `Topic: ${params.topic.title}\n` +
    `Description: ${params.topic.description}\n\n` +
    `Generate a script of ${params.scenesCount} scenes with a total duration of approximately ${params.totalDurationSec} seconds. ` +
    "Return a JSON object with a 'scenes' property containing an array of scene objects.";

  const rawResponse = (await structured.invoke([
    { role: "system", content: system },
    { role: "user", content: user },
  ])) as z.infer<typeof ScenesSchema>;

  const scenes: Scene[] = rawResponse.scenes.map((s: z.infer<typeof SceneSchema>) => ({
    ...s,
    id: randomUUID(),
  }));

  return normalizeDurations(scenes, params.totalDurationSec);
}
