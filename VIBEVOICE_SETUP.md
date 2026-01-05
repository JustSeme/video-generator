# Установка VibeVoice Large для интеграции с Node.js

## Шаг 1: Установка Python зависимостей

```bash
pip install -r requirements.txt
```

## Шаг 2: Клонирование VibeVoice репозитория

```bash
git clone https://github.com/microsoft/vibevoice.git
cd vibevoice
pip install -e .
```

## Шаг 3: Скачивание модели

### Вариант А: Через HuggingFace (рекомендуется)
```bash
# Установите huggingface-hub если еще не установлен
pip install huggingface_hub

# Скачайте модель
python -c "
from huggingface_hub import snapshot_download
snapshot_download(repo_id='WestZhang/VibeVoice-Large-pt', local_dir='./models/vibevoice-large')
"
```

### Вариант Б: Вручную
1. Перейдите на https://huggingface.co/WestZhang/VibeVoice-Large-pt
2. Скачайте все файлы модели
3. Поместите их в папку `./models/vibevoice-large`

## Шаг 4: Создание необходимых папок

```bash
mkdir -p outputs
mkdir -p demo/text_examples
```

## Шаг 5: Настройка путей в Python скрипте

Убедитесь, что в `vibevoice_tts.py` правильные пути:
- `model_path` должен указывать на скачанную модель
- `demo/inference_from_file.py` должен существовать

## Шаг 6: Тестирование

```bash
python vibevoice_tts.py --text "Привет, мир!" --speaker Alice --output test.wav
```

## Шаг 7: Использование в TypeScript

```typescript
import { synthesizeToFile } from './src/tts.js';

await synthesizeToFile({
  provider: "vibevoice",
  text: "Привет, мир!",
  durationSec: 5,
  outFile: "./output/audio.wav",
  ffmpegBin: "./ffmpeg"
});
```

## Возможные проблемы и решения

### Проблема: ModuleNotFoundError
**Решение:** Убедитесь, что все зависимости установлены и VibeVoice склонирован правильно.

### Проблема: CUDA out of memory
**Решение:** Используйте CPU или уменьшите размер модели.

### Проблема: Модель не найдена
**Решение:** Проверьте путь к модели в Python скрипте.

### Проблема: FFmpeg не найден
**Решение:** Установите FFmpeg и добавьте в PATH.

## Дополнительные настройки

### Множественные говорящие
```typescript
await synthesizeToFile({
  provider: "vibevoice",
  text: "Alice: Привет! Frank: Здравствуйте!",
  durationSec: 10,
  outFile: "./output/dialogue.wav",
  ffmpegBin: "./ffmpeg"
});
```

### Кастомные голоса
В Python скрипте можно добавить поддержку разных голосов:
```python
# Добавьте в vibevoice_tts.py
parser.add_argument('--voice_id', help='Custom voice ID')
```

## Производительность

- **GPU**: Значительно ускоряет генерацию
- **CPU**: Работает, но медленнее
- **RAM**: Требуется ~8GB для Large модели

## Лицензия

Убедитесь, что вы соблюдаете лицензию VibeVoice при коммерческом использовании.
