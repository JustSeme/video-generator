import { writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "./exec.js";

export async function composeVideo(params: {
  ffmpegBin: string;
  outDir: string;
  videoName: string;
  previewPath?: string;
  thumbnailPath?: string;
  scenes: Array<{
    id: string;
    duration: number;
    imagePath: string;
    audioPath: string;
  }>;
}): Promise<{ videoPath: string; previewPath: string; thumbnailPath: string }> {
  const clipsDir = path.join(params.outDir, "clips");
  await writeFile(clipsDir, "", "utf8");

  const clipPaths: string[] = [];
  for (const scene of params.scenes) {
    const clipPath = path.join(clipsDir, `${scene.id}.mp4`);
    clipPaths.push(clipPath);

    await execFile(params.ffmpegBin, [
      "-y",
      "-loop",
      "1",
      "-i",
      scene.imagePath,
      "-i",
      scene.audioPath,
      "-t",
      `${scene.duration}`,
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      clipPath,
    ]);
  }

  const concatFile = path.join(params.outDir, "concat.txt");
  const concatText = clipPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(concatFile, concatText, "utf8");

  const videoPath = path.join(params.outDir, `${params.videoName}.mp4`);
  await execFile(params.ffmpegBin, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    videoPath,
  ]);

  const previewPath = params.previewPath ?? path.join(params.outDir, `${params.videoName}-preview.jpg`);
  const thumbnailPath =
    params.thumbnailPath ?? path.join(params.outDir, `${params.videoName}-thumbnail.jpg`);

  return { videoPath, previewPath, thumbnailPath };
}
