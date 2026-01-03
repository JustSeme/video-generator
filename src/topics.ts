import fs from "node:fs/promises";
import path from "node:path";
import { Topic } from "./types.js";

const fallbackTopics: Topic[] = [
  {
    id: "example",
    title: "Пример темы",
    description: "Замените topics.json на ваш список горячих тем.",
  },
];

export async function loadTopics(): Promise<Topic[]> {
  const filePath = path.resolve("./topics.json");

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallbackTopics;

    const topics: Topic[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as any).id === "string" &&
        typeof (item as any).title === "string" &&
        typeof (item as any).description === "string"
      ) {
        topics.push({
          id: (item as any).id,
          title: (item as any).title,
          description: (item as any).description,
        });
      }
    }

    return topics.length ? topics : fallbackTopics;
  } catch {
    return fallbackTopics;
  }
}
