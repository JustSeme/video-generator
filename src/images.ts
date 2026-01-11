import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "./exec.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

export type ImageProvider = "google";

export async function generateImageToFile(
  provider: ImageProvider,
  prompt: string,
  outFile: string,
  ffmpegBin: string
): Promise<void> {
  await mkdir(path.dirname(outFile), { recursive: true });

  if (provider === "google") {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY environment variable is required for nano-banana image generation"
      );
    }

    const model = new ChatGoogleGenerativeAI({
      apiKey,
      configuration: {
        baseURL: process.env.OPENROUTER_BASE_URL,
      },
      model: "gemini-2.5-flash-image",
    } as any);

    const res = await model.invoke([
      new HumanMessage({
        content: [{ type: "text", text: prompt }],
      }),
    ], {
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    } as any);

    const content = (res as any)?.content;
    let imageUrl: string | undefined;

    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== "object") continue;

        const anyItem = item as any;
        if (typeof anyItem?.image_url === "string") {
          imageUrl = anyItem.image_url;
          break;
        }

        if (typeof anyItem?.image_url?.url === "string") {
          imageUrl = anyItem.image_url.url;
          break;
        }

        if (anyItem?.type === "image_url" && typeof anyItem?.image_url === "string") {
          imageUrl = anyItem.image_url;
          break;
        }

        if (anyItem?.type === "image_url" && typeof anyItem?.image_url?.url === "string") {
          imageUrl = anyItem.image_url.url;
          break;
        }
      }
    }

    const b64 = typeof imageUrl === "string" ? imageUrl.split(",").pop() : undefined;
    if (typeof b64 !== "string" || !b64) {
      throw new Error("Nano Banana images: unexpected response (no image_url base64)");
    }

    await writeFile(outFile, Buffer.from(b64, "base64"));
    return;
  }

  // mock: generate a simple colored frame
  await execFile(ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x111111:s=1280x720",
    "-frames:v",
    "1",
    outFile,
  ]);
}

export async function convertToJpg(
  ffmpegBin: string,
  inFile: string,
  outFile: string
): Promise<void> {
  await mkdir(path.dirname(outFile), { recursive: true });
  await execFile(ffmpegBin, [
    "-y",
    "-i",
    inFile,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outFile,
  ]);
}
