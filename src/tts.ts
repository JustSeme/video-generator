import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "./exec.js";
import { ElevenLabsClient, ElevenLabsError } from "elevenlabs";

export type TtsProvider = "elevenlabs";

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

    try {
      const client = new ElevenLabsClient({ apiKey, baseUrl: 'https://openrouter.ai/api/v1' });
      const audioStream = await client.textToSpeech.convert(voiceId, {
        model_id: "eleven_multilingual_v2",
        text: params.text,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
        },
      });

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);
      await writeFile(params.outFile, audioBuffer);
    } catch (err) {
      if (err instanceof ElevenLabsError) {
        throw new Error(`ElevenLabs error: ${err.statusCode} ${err.message}`);
      } else {
        throw new Error(`Unknown error: ${err}`);
      }
    }
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
