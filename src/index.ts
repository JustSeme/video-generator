import { writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { generateCoverPrompts } from "./covers.js";
import { convertToJpg, generateImageToFile } from "./images.js";
import { generateScript } from "./script.js";
import { loadTopics } from "./topics.js";
import { synthesizeToFile } from "./tts.js";
import { AppConfig, NeuralNetworkError, Scene, Topic } from "./types.js";
import { composeVideo } from "./video.js";
import { slugify, withRetry } from "./utils.js";

function pickTopic(topics: Topic[]): Topic {
  const requested = process.env.TOPIC_ID;
  if (requested) {
    const found = topics.find((t) => t.id === requested);
    if (found) return found;
  }

  return topics[Math.floor(Math.random() * topics.length)];
}

async function writeJson(p: string, data: unknown) {
  await writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

async function cleanupIntermediates(cfg: AppConfig) {
  await Promise.allSettled([
    rm(path.join(cfg.outputDir, "audio"), { recursive: true, force: true }),
    rm(path.join(cfg.outputDir, "images"), { recursive: true, force: true }),
    rm(path.join(cfg.outputDir, "clips"), { recursive: true, force: true }),
    rm(path.join(cfg.outputDir, "concat.txt"), { force: true }),
  ]);
}

async function main() {
  const cfg = loadConfig();
  const {
    outputDir,
    cleanup,
    totalDurationSec,
    scenesCount,
    providers: { llmScriptProvider, llmVisualProvider, ttsProvider, imageProvider },
    ffmpegBin,
  } = cfg;

  await mkdir(outputDir, { recursive: true });

  const topics = await loadTopics();
  const topic = pickTopic(topics);

  const metaDir = path.join(outputDir, "meta");
  await mkdir(metaDir, { recursive: true });

  await writeJson(path.join(metaDir, "topic.json"), topic);

  const scenes = await withRetry(
    () => generateScript({
      topic,
      scenesCount,
      totalDurationSec,
      provider: llmScriptProvider,
    }),
    `script-generation-${llmScriptProvider}`
  );

  const audioDir = path.join(outputDir, "audio");
  const imagesDir = path.join(outputDir, "images");
  await mkdir(audioDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  const enrichedScenes: Array<Scene & { audioPath: string; imagePath: string }> = [];

  for (const scene of scenes) {
    const audioPath = path.join(audioDir, `${scene.id}.mp3`);
    const imagePath = path.join(imagesDir, `${scene.id}.png`);

    console.log("Scene:", JSON.stringify(scene, null, 2));

    await withRetry(
      () => synthesizeToFile({
        provider: ttsProvider,
        text: scene.text,
        durationSec: scene.duration,
        outFile: audioPath,
        ffmpegBin,
      }),
      `tts-${ttsProvider}-scene-${scene.id}`
    );

    await withRetry(
      () => generateImageToFile({
        provider: imageProvider,
        prompt: scene.visual,
        outFile: imagePath,
        ffmpegBin,
      }),
      `image-${imageProvider}-scene-${scene.id}`
    );

    enrichedScenes.push({ ...scene, audioPath, imagePath });
  }

  await writeJson(path.join(metaDir, "script.json"), scenes);

  const videoName = slugify(topic.title);
  if (!videoName) {
    throw new Error("Video name could not be generated from topic title");
  }

  const coverPrompts = await withRetry(
    () => generateCoverPrompts({
      topic,
      provider: llmVisualProvider,
    }),
    `cover-prompts-${llmVisualProvider}`
  );

  await writeJson(path.join(metaDir, "covers.json"), coverPrompts);

  const previewPng = path.join(imagesDir, `${videoName}-preview.png`);
  const thumbnailPng = path.join(imagesDir, `${videoName}-thumbnail.png`);

  await withRetry(
    () => generateImageToFile({
      provider: imageProvider,
      prompt: coverPrompts.previewPrompt,
      outFile: previewPng,
      ffmpegBin,
    }),
    `image-${imageProvider}-preview`
  );

  await withRetry(
    () => generateImageToFile({
      provider: imageProvider,
      prompt: coverPrompts.thumbnailPrompt,
      outFile: thumbnailPng,
      ffmpegBin,
    }),
    `image-${imageProvider}-thumbnail`
  );

  const previewPath = path.join(outputDir, `${videoName}-preview.jpg`);
  const thumbnailPath = path.join(outputDir, `${videoName}-thumbnail.jpg`);

  await convertToJpg({ ffmpegBin, inFile: previewPng, outFile: previewPath });
  await convertToJpg({ ffmpegBin, inFile: thumbnailPng, outFile: thumbnailPath });

  const video = await composeVideo({
    ffmpegBin,
    outDir: outputDir,
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

  if (cleanup) {
    await cleanupIntermediates(cfg);
  }

  console.log("Done:");
  console.log(`- Topic: ${topic.title}`);
  console.log(`- Video: ${video.videoPath}`);
  console.log(`- Preview: ${video.previewPath}`);
  console.log(`- Thumbnail: ${video.thumbnailPath}`);
};

main().catch((err) => {
  if (err instanceof NeuralNetworkError) {
    console.error(`\n❌ Neural Network Error (${err.provider}):`);
    console.error(err.message);
    if (err.originalError) {
      console.error('\nOriginal error:');
      console.error(err.originalError.message);
    }
  } else {
    console.error('\n❌ Unexpected error:');
    console.error(err);
  }
  process.exitCode = 1;
});
