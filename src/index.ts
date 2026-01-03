import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { generateCoverPrompts } from "./covers.js";
import { convertToJpg, generateImageToFile } from "./images.js";
import { generateScript } from "./script.js";
import { loadTopics } from "./topics.js";
import { synthesizeToFile } from "./tts.js";
import { AppConfig, Scene, Topic } from "./types.js";
import { composeVideo } from "./video.js";
import { ensureDir, slugify } from "./utils.js";

function pickTopic(topics: Topic[]): Topic {
  const requested = process.env.TOPIC_ID;
  if (requested) {
    const found = topics.find((t) => t.id === requested);
    if (found) return found;
  }

  return topics[Math.floor(Math.random() * topics.length)];
}

async function writeJson(p: string, data: unknown) {
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

async function cleanupIntermediates(cfg: AppConfig) {
  await Promise.allSettled([
    fs.rm(path.join(cfg.outputDir, "audio"), { recursive: true, force: true }),
    fs.rm(path.join(cfg.outputDir, "images"), { recursive: true, force: true }),
    fs.rm(path.join(cfg.outputDir, "clips"), { recursive: true, force: true }),
    fs.rm(path.join(cfg.outputDir, "concat.txt"), { force: true }),
  ]);
}

async function main() {
  const cfg = loadConfig();
  await ensureDir(cfg.outputDir);

  const topics = await loadTopics();
  const topic = pickTopic(topics);

  const metaDir = path.join(cfg.outputDir, "meta");
  await ensureDir(metaDir);

  await writeJson(path.join(metaDir, "topic.json"), topic);

  const scenes = await generateScript({
    topic,
    scenesCount: cfg.scenesCount,
    totalDurationSec: cfg.totalDurationSec,
    provider: cfg.providers.llmScriptProvider,
  });

  const audioDir = path.join(cfg.outputDir, "audio");
  const imagesDir = path.join(cfg.outputDir, "images");
  await ensureDir(audioDir);
  await ensureDir(imagesDir);

  const enrichedScenes: Array<Scene & { audioPath: string; imagePath: string }> = [];

  for (const scene of scenes) {
    const audioPath = path.join(audioDir, `${scene.id}.mp3`);
    const imagePath = path.join(imagesDir, `${scene.id}.png`);

    await synthesizeToFile({
      provider: cfg.providers.ttsProvider,
      text: scene.text,
      durationSec: scene.duration,
      outFile: audioPath,
      ffmpegBin: cfg.ffmpegBin,
    });

    await generateImageToFile({
      provider: cfg.providers.imageProvider,
      prompt: scene.visual,
      outFile: imagePath,
      ffmpegBin: cfg.ffmpegBin,
    });

    enrichedScenes.push({ ...scene, audioPath, imagePath });
  }

  await writeJson(path.join(metaDir, "script.json"), scenes);

  const videoName = slugify(topic.title || topic.id) || "video";

  const coverPrompts = await generateCoverPrompts({
    topic,
    provider: cfg.providers.llmVisualProvider,
  });

  await writeJson(path.join(metaDir, "covers.json"), coverPrompts);

  const previewPng = path.join(imagesDir, `${videoName}-preview.png`);
  const thumbnailPng = path.join(imagesDir, `${videoName}-thumbnail.png`);

  await generateImageToFile({
    provider: cfg.providers.imageProvider,
    prompt: coverPrompts.previewPrompt,
    outFile: previewPng,
    ffmpegBin: cfg.ffmpegBin,
  });

  await generateImageToFile({
    provider: cfg.providers.imageProvider,
    prompt: coverPrompts.thumbnailPrompt,
    outFile: thumbnailPng,
    ffmpegBin: cfg.ffmpegBin,
  });

  const previewPath = path.join(cfg.outputDir, `${videoName}-preview.jpg`);
  const thumbnailPath = path.join(cfg.outputDir, `${videoName}-thumbnail.jpg`);

  await convertToJpg({ ffmpegBin: cfg.ffmpegBin, inFile: previewPng, outFile: previewPath });
  await convertToJpg({ ffmpegBin: cfg.ffmpegBin, inFile: thumbnailPng, outFile: thumbnailPath });

  const video = await composeVideo({
    ffmpegBin: cfg.ffmpegBin,
    outDir: cfg.outputDir,
    videoName,
    previewPath,
    thumbnailPath,
    scenes: enrichedScenes.map((s) => ({
      id: s.id,
      duration: s.duration,
      imagePath: s.imagePath,
      audioPath: s.audioPath,
    })),
  });

  await writeJson(path.join(metaDir, "outputs.json"), {
    video,
  });

  if (cfg.cleanup) {
    await cleanupIntermediates(cfg);
  }

  console.log("Done:");
  console.log(`- Topic: ${topic.title}`);
  console.log(`- Video: ${video.videoPath}`);
  console.log(`- Preview: ${video.previewPath}`);
  console.log(`- Thumbnail: ${video.thumbnailPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
