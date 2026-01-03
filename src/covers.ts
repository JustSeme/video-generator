import { z } from "zod";
import { getChatModel } from "./llm.js";
import { Topic } from "./types.js";

const CoversSchema = z.object({
  previewPrompt: z.string(),
  thumbnailPrompt: z.string(),
});

export async function generateCoverPrompts(params: {
  topic: Topic;
  provider: "openai" | "anthropic";
}): Promise<z.infer<typeof CoversSchema>> {
  const model = getChatModel(params.provider);
  const structured = model.withStructuredOutput(CoversSchema);

  const system =
    "Ты арт-директор и промпт-инженер. Твоя задача — написать два промпта для генерации изображений для видео. " +
    "Пиши промпты по-русски. Избегай текста на изображении. Делай высокий контраст, чистую композицию, 16:9. ";

  const user =
    `Тема видео: ${params.topic.title}\n` +
    `Описание: ${params.topic.description}\n\n` +
    "Сгенерируй: previewPrompt (кадр-превью, нейтральный) и thumbnailPrompt (миниатюра, более кликабельная).";

  return (await structured.invoke([
    { role: "system", content: system },
    { role: "user", content: user },
  ])) as z.infer<typeof CoversSchema>;
}
