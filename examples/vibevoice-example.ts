import { synthesizeToFile } from '../src/tts.js';
import path from 'node:path';

async function demonstrateVibeVoice() {
  console.log('🎤 Демонстрация VibeVoice Large');
  
  // Пример 1: Монолог
  console.log('\n1. Генерация монолога...');
  try {
    await synthesizeToFile({
      provider: "vibevoice",
      text: "Привет! Я VibeVoice Large - современная модель синтеза речи от Microsoft. Я могу генерировать качественную и естественную речь на разных языках.",
      durationSec: 8,
      outFile: "./examples/output/monologue.wav",
      ffmpegBin: "./ffmpeg"
    });
    console.log('✅ Монолог сохранен в ./examples/output/monologue.wav');
  } catch (error) {
    console.error('❌ Ошибка при генерации монолога:', error);
  }
  
  // Пример 2: Диалог с автоматическим распределением говорящих
  console.log('\n2. Генерация диалога...');
  try {
    await synthesizeToFile({
      provider: "vibevoice",
      text: `Здравствуйте!
      Добрый день! Как дела?
      Отлично, спасибо! А у вас?
      Тоже хорошо. Работаю над интересным проектом.
      Расскажите подробнее?
      Это система синтеза речи с использованием VibeVoice.`,
      durationSec: 15,
      outFile: "./examples/output/dialogue.wav",
      ffmpegBin: "./ffmpeg"
    });
    console.log('✅ Диалог сохранен в ./examples/output/dialogue.wav');
  } catch (error) {
    console.error('❌ Ошибка при генерации диалога:', error);
  }
  
  // Пример 3: Диалог с явным указанием говорящих
  console.log('\n3. Генерация диалога с именованными говорящими...');
  try {
    await synthesizeToFile({
      provider: "vibevoice",
      text: `Алиса: Привет, Фрэнк! Как твой день?
      Фрэнк: Привет, Алиса! Отлично, работаю над VibeVoice.
      Алиса: Звучит интересно! Что это за технология?
      Фрэнк: Это продвинутая модель для синтеза речи от Microsoft.
      Алиса: Вау! Какая впечатляющая технология!`,
      durationSec: 20,
      outFile: "./examples/output/named_dialogue.wav",
      ffmpegBin: "./ffmpeg"
    });
    console.log('✅ Именованный диалог сохранен в ./examples/output/named_dialogue.wav');
  } catch (error) {
    console.error('❌ Ошибка при генерации именованного диалога:', error);
  }
  
  // Пример 4: Кастомные говорящие
  console.log('\n4. Генерация с кастомными говорящими...');
  try {
    // Сначала нужно обновить tts.ts для поддержки кастомных говорящих
    await synthesizeToFile({
      provider: "vibevoice",
      text: "Анна: Привет! Марк: Здравствуйте! Анна: Как настроение? Марк: Отлично!",
      durationSec: 10,
      outFile: "./examples/output/custom_speakers.wav",
      ffmpegBin: "./ffmpeg"
    });
    console.log('✅ Кастомные говорящие сохранены в ./examples/output/custom_speakers.wav');
  } catch (error) {
    console.error('❌ Ошибка при генерации с кастомными говорящими:', error);
  }
  
  console.log('\n🎉 Все примеры завершены!');
  console.log('Проверьте папку ./examples/output/ для просмотра сгенерированных аудиофайлов.');
}

// Расширенная функция с поддержкой кастомных говорящих
async function synthesizeWithCustomSpeakers(params: {
  text: string;
  speakers: string[];
  outFile: string;
  format?: 'dialogue' | 'monologue';
}) {
  const { execFileWithOutput } = await import('../src/exec.js');
  
  try {
    const { stdout } = await execFileWithOutput("python", [
      "vibevoice_tts.py",
      "--text", params.text,
      "--speaker", params.speakers.join(','),
      "--output", params.outFile,
      "--format", params.format || 'dialogue'
    ]);
    
    const result = JSON.parse(stdout);
    if (!result.success) {
      throw new Error(`VibeVoice error: ${result.error}`);
    }
    
    return result;
  } catch (err) {
    throw new Error(`VibeVoice synthesis failed: ${err}`);
  }
}

// Демонстрация расширенных возможностей
async function demonstrateAdvancedFeatures() {
  console.log('\n🚀 Демонстрация расширенных возможностей VibeVoice');
  
  try {
    const result = await synthesizeWithCustomSpeakers({
      text: `Анна: Привет, это голос Анны!
      Марк: А это голос Марка!
      Анна: Мы можем вести диалог.
      Марк: VibeVoice делает это очень естественно.`,
      speakers: ['Анна', 'Марк'],
      outFile: "./examples/output/advanced_dialogue.wav",
      format: 'dialogue'
    });
    
    console.log('✅ Расширенный диалог сохранен:', result.output_file);
    console.log('📊 Использованные говорящие:', result.speakers);
    console.log('📝 Формат:', result.format);
  } catch (error) {
    console.error('❌ Ошибка при расширенной генерации:', error);
  }
}

// Запуск демонстраций
async function main() {
  // Создаем папку для вывода
  const fs = await import('node:fs/promises');
  await fs.mkdir('./examples/output', { recursive: true });
  
  await demonstrateVibeVoice();
  await demonstrateAdvancedFeatures();
}

if (require.main === module) {
  main().catch(console.error);
}

export { synthesizeWithCustomSpeakers, demonstrateVibeVoice, demonstrateAdvancedFeatures };
