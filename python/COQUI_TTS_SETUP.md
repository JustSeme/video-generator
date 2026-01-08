# Установка Coqui TTS XTTS-v2 для интеграции с Node.js

## Что такое Coqui TTS XTTS-v2?

**XTTS-v2** - это multilingual модель от Coqui, которая поддерживает:
- **16 языков** включая русский
- **Клонирование голоса** по 3-6 секундам аудио
- **Высокое качество** синтеза речи
- **Локальную работу** без интернета

## Шаг 1: Установка Python зависимостей

```bash
pip install -r requirements.txt
```

## Шаг 2: Установка системных зависимостей

### Windows:
```bash
# Установите ffmpeg (если еще не установлен)
# Скачать с: https://ffmpeg.org/download.html
# Или через chocolatey:
choco install ffmpeg
```

### Linux:
```bash
sudo apt update
sudo apt install ffmpeg
```

### macOS:
```bash
brew install ffmpeg
```

## Шаг 3: Проверка установки

```bash
python coqui_tts.py --validate --text "Привет, мир!" --output test.wav
```

## Шаг 4: Использование в TypeScript

```typescript
import { synthesizeToFile } from './src/tts.js';

// Базовое использование
await synthesizeToFile({
  provider: "coqui",
  text: "Привет, мир! Я говорю по-русски с помощью Coqui TTS.",
  durationSec: 5,
  outFile: "./output/coqui_speech.wav",
  ffmpegBin: "./ffmpeg"
});
```

## Шаг 5: Клонирование голоса (опционально)

### Подготовка образца голоса:
1. Запишите голос в WAV формате (22050 Hz, mono)
2. Длительность: 3-6 секунд
3. Чистое звучание без шума

### Использование кастомного голоса:
```typescript
// Нужно будет расширить интерфейс для поддержки speaker_wav
await synthesizeToFile({
  provider: "coqui",
  text: "Привет! Это мой клонированный голос.",
  durationSec: 5,
  outFile: "./output/cloned_voice.wav",
  ffmpegBin: "./ffmpeg"
});
```

## Дополнительные возможности

### Поддерживаемые языки:
- `ru` - Русский
- `en` - Английский  
- `de` - Немецкий
- `fr` - Французский
- `es` - Испанский
- `it` - Итальянский
- И другие 10 языков

### Кастомизация модели:
```bash
# Скачайте модель локально для офлайн работы
python -c "
from TTS.api import TTS
tts = TTS(model_name='tts_models/multilingual/multi-dataset/xtts_v2')
"
```

## Возможные проблемы

### Проблема: CUDA out of memory
**Решение:** 
```bash
# Используйте CPU
export CUDA_VISIBLE_DEVICES=""
```

### Проблема: Медленная загрузка модели
**Решение:** Модель кэшируется после первой загрузки

### Проблема: Качество русского языка
**Решение:** Используйте образец голоса носителя языка для клонирования

## Производительность

- **GPU (CUDA):** ~2-5 секунд на 100 символов
- **CPU:** ~10-30 секунд на 100 символов
- **RAM:** ~2-4GB для модели
- **VRAM:** ~1-2GB на GPU

## Лицензия

Coqui TTS распространяется под MPL 2.0 лицензией. Коммерческое использование разрешено с указанием авторства.
