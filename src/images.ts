import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "./exec.js";

export type ImageProvider = "openai" | "mock";

export async function generateImageToFile(params: {
  provider: ImageProvider;
  prompt: string;
  outFile: string;
  ffmpegBin: string;
}): Promise<void> {
  await mkdir(path.dirname(params.outFile), { recursive: true });

  if (params.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required for openai image provider");
    }

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: params.prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI images error: ${res.status} ${res.statusText} ${t}`);
    }

    const json = (await res.json()) as any;
    const b64 = json?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") {
      throw new Error("OpenAI images: unexpected response (no b64_json)");
    }

    await writeFile(params.outFile, Buffer.from(b64, "base64"));
    return;
  }

  // mock: generate a simple colored frame
  await execFile(params.ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x111111:s=1280x720",
    "-frames:v",
    "1",
    params.outFile,
  ]);
}

export async function convertToJpg(params: {
  ffmpegBin: string;
  inFile: string;
  outFile: string;
}): Promise<void> {
  await mkdir(path.dirname(params.outFile), { recursive: true });
  await execFile(params.ffmpegBin, [
    "-y",
    "-i",
    params.inFile,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    params.outFile,
  ]);
}
