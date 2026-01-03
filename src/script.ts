import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getChatModel } from "./llm.js";
import { Scene, Topic } from "./types.js";

const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  visual: z.string(),
  duration: z.number(),
});

const ScenesSchema = z.array(SceneSchema);

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
    "Ты профессиональный сценарист коротких вертикальных видео (Reels/Shorts). " +
    "Пиши по-русски, делай динамичный темп, добавляй конкретные примеры и микроконфликт. " +
    "Каждая сцена: title (заголовок кадра), text (озвучка 1-3 предложения), " +
    "visual (точное описание картинки/кадра для генерации), duration (секунды).";

  const user =
    `Тема: ${params.topic.title}\n` +
    `Описание: ${params.topic.description}\n\n` +
    `Сгенерируй сценарий из ${params.scenesCount} сцен на суммарную длительность ~${params.totalDurationSec} секунд. ` +
    "Верни строго массив объектов сцен.";

  const rawScenes = (await structured.invoke([
    { role: "system", content: system },
    { role: "user", content: user },
  ])) as z.infer<typeof ScenesSchema>;

  const scenes: Scene[] = rawScenes.map((s: z.infer<typeof SceneSchema>) => ({
    ...s,
    id: randomUUID(),
  }));

  return normalizeDurations(scenes, params.totalDurationSec);
}
