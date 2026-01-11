import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileWithOutput } from "./exec.js";
import { ElevenLabsClient, ElevenLabsError } from "elevenlabs";

export type TtsProvider = "elevenlabs" | "coqui";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export async function synthesizeToFile(
  provider: TtsProvider,
  text: string,
  durationSec: number,
  outFile: string,
  ffmpegBin: string,
): Promise<void> {
  await mkdir(path.dirname(outFile), { recursive: true });

  if (provider === "coqui") {
    try {
      const speakerVoicePath = path.join(projectRoot, "python/temp", "speaker.wav");
      const scriptPath = path.join(projectRoot, "python", "coqui_tts.py");

      const { stdout } = await execFileWithOutput("python", [
        "-X",
        "utf8",
        scriptPath,
        "--text", text,
        "--output", path.resolve(outFile),
        "--speaker_voice", speakerVoicePath
      ], { cwd: projectRoot });

      const result = JSON.parse(stdout);
      if (!result.success) {
        throw new Error(`Coqui TTS error: ${result.error}`);
      }
    } catch (err) {
      throw new Error(`Coqui TTS synthesis failed: ${err}`);
    }
    return;
  }

  if (provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required for elevenlabs TTS provider");
    }

    try {
      const client = new ElevenLabsClient({ apiKey, baseUrl: process.env.OPENROUTER_BASE_URL });
      const audioStream = await client.textToSpeech.convert(voiceId, {
        model_id: "eleven_multilingual_v2",
        text,
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
      await writeFile(outFile, audioBuffer);
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
  await execFile(ffmpegBin, [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=44100:cl=stereo`,
    "-t",
    `${durationSec}`,
    "-q:a",
    "9",
    "-acodec",
    "libmp3lame",
    outFile,
  ]);
}
