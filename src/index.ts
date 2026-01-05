import { writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { generateCoverPrompts } from "./covers.js";
import { convertToJpg, generateImageToFile } from "./images.js";
import { generateScenes } from "./scenes.js";
import { synthesizeToFile } from "./tts.js";
import { AppConfig, NeuralNetworkError, Scene, Topic } from "./types.js";
import { composeVideo } from "./video.js";
import { slugify, withRetry } from "./utils.js";

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
    topicTitle,
    topicDescription
  } = cfg;

  await mkdir(outputDir, { recursive: true });

  const topic = {
    title: topicTitle,
    description: topicDescription
  };

  const metaDir = path.join(outputDir, "meta");
  await mkdir(metaDir, { recursive: true });

  const scenes = await withRetry(
    () => generateScenes(
      topic,
      scenesCount,
      totalDurationSec,
      llmScriptProvider
    ),
    `scenes-generation-${llmScriptProvider}`
  );

  await writeJson(path.join(metaDir, "scenes.json"), scenes);

  const audioDir = path.join(outputDir, "audio");
  const imagesDir = path.join(outputDir, "images");
  await mkdir(audioDir, { recursive: true });
  await mkdir(imagesDir, { recursive: true });

  const enrichedScenes: Array<Scene & { audioPath: string; imagePath: string }> = [];

  for (const scene of scenes) {
    const audioPath = path.join(audioDir, `${scene.id}.mp3`);
    const imagePath = path.join(imagesDir, `${scene.id}.png`);

    await withRetry(
      () => generateImageToFile(
        imageProvider,
        scene.visual,
        imagePath,
        ffmpegBin,
      ),
      `image-${imageProvider}-scene-${scene.id}`
    );

    /* await withRetry(
      () => synthesizeToFile({
        provider: ttsProvider,
        text: scene.text,
        durationSec: scene.duration,
        outFile: audioPath,
        ffmpegBin,
      }),
      `tts-${ttsProvider}-scene-${scene.id}`
    ); */

    enrichedScenes.push({ ...scene, audioPath, imagePath });
  }

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
    () => generateImageToFile(
      imageProvider,
      coverPrompts.previewPrompt,
      previewPng,
      ffmpegBin,
    ),
    `image-${imageProvider}-preview`
  );

  await withRetry(
    () => generateImageToFile(
      imageProvider,
      coverPrompts.thumbnailPrompt,
      thumbnailPng,
      ffmpegBin,
    ),
    `image-${imageProvider}-thumbnail`
  );

  const previewPath = path.join(outputDir, `${videoName}-preview.jpg`);
  const thumbnailPath = path.join(outputDir, `${videoName}-thumbnail.jpg`);

  await convertToJpg(ffmpegBin, previewPng, previewPath);
  await convertToJpg(ffmpegBin, thumbnailPng, thumbnailPath);

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
