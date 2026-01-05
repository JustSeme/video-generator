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

export async function generateScenes(
  topic: Topic,
  scenesCount: number,
  totalDurationSec: number,
  provider: "openai" | "anthropic"
): Promise<Scene[]> {
  const model = getChatModel(provider);
  const structured = model.withStructuredOutput(ScenesSchema);

  const system =
    "You are a professional screenwriter for YouTube videos. " +
    "Write a coherent narrative about the topic: " + topic.title + " with logical transitions between scenes. " +
    "Each scene should have: a clear title, engaging text (up to 3 sentences), " +
    "A detailed prompt for creating a static image that describes the narrative in a given scene, named 'visual'. " +
    "The visual prompt should be descriptive and suitable for image generation.";

  const user =
    `Topic: ${topic.title}\n` +
    `Description: ${topic.description}\n\n` +
    `Generate a video script for YouTube of ${scenesCount} scenes with a total duration of approximately ${totalDurationSec} seconds. ` +
    "Return a JSON object with a 'scenes' property containing an array of scene objects. " +
    "Scene object should contain only the title, text, visual, and duration fields.";

  const rawResponse = (await structured.invoke([
    { role: "system", content: system },
    { role: "user", content: user },
  ])) as z.infer<typeof ScenesSchema>;

  const scenes: Scene[] = rawResponse.scenes.map((s: z.infer<typeof SceneSchema>) => ({
    ...s,
    id: randomUUID(),
  }));

  return normalizeDurations(scenes, totalDurationSec);
}
