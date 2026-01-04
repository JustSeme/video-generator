import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "./exec.js";

export type TtsProvider = "elevenlabs" | "mock";

export async function synthesizeToFile(params: {
  provider: TtsProvider;
  text: string;
  durationSec: number;
  outFile: string;
  ffmpegBin: string;
}): Promise<void> {
  await mkdir(path.dirname(params.outFile), { recursive: true });

  if (params.provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required for elevenlabs TTS provider");
    }

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: params.text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`ElevenLabs error: ${res.status} ${res.statusText} ${t}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(params.outFile, buf);
    return;
  }

  // mock: generate silent audio with requested duration
  await execFile(params.ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=44100:cl=stereo`,
    "-t",
    `${params.durationSec}`,
    "-q:a",
    "9",
    "-acodec",
    "libmp3lame",
    params.outFile,
  ]);
}
