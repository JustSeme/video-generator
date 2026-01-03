import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function joinPosix(...parts: string[]) {
  return parts.join(path.sep);
}
