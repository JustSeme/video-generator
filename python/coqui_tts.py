#!/usr/bin/env python3
import sys
import json
import argparse
import os
import re
import logging
from pathlib import Path
from TTS.api import TTS
import torch
import torchaudio
import librosa
import soundfile as sf

def _ensure_utf8_stdio():
    # В Windows при запуске из Node stdout/stderr часто оказываются в cp1252/cp1251,
    # из-за чего print()/logging падают на кириллице. Форсируем UTF-8.
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def preprocess_text(text, language="ru"):
    """Предобработка текста для улучшения качества синтеза"""
    # Удаление лишних пробелов и переносов строк
    text = ' '.join(text.split())
    
    # Добавление пауз для знаков препинания
    text = re.sub(r'([.!?]+)', r'\1 ', text)
    text = re.sub(r'([,;:])', r' \1 ', text)
    
    # Удаление множественных пробелов
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def validate_inputs(args):
    """Валидация входных параметров"""
    errors = []
    
    if not args.text or len(args.text.strip()) == 0:
        errors.append("Text cannot be empty")
    
    if len(args.text) > 5000:  # Ограничение длины текста для XTTS
        errors.append("Text too long (max 5000 characters for XTTS)")
    
    if not args.output:
        errors.append("Output file path is required")
    
    # Проверка расширения выходного файла
    if not args.output.lower().endswith('.wav'):
        errors.append("Output file must be .wav format")
    
    return errors

def enhance_audio_quality(input_path, output_path, normalize=True, remove_silence=True):
    """Улучшение качества аудио после синтеза"""
    try:
        # Загрузка аудио
        audio, sr = librosa.load(input_path, sr=22050)
        
        # Удаление тишины в начале и конце
        if remove_silence:
            audio, _ = librosa.effects.trim(audio, top_db=20)
        
        # Нормализация громкости
        if normalize:
            audio = librosa.util.normalize(audio)
        
        # Применение простого фильтра для уменьшения шума
        audio = librosa.effects.preemphasis(audio)
        
        # Сохранение улучшенного аудио
        sf.write(output_path, audio, sr)
        
        return True
    except Exception as e:
        logging.warning(f"Audio enhancement failed: {str(e)}")
        return False

def synthesize_speech(text, speaker_voice, output_path, language="ru"):
    """Синтез речи с помощью XTTS-v2 с улучшенными параметрами"""
    try:
        # Предобработка текста
        processed_text = preprocess_text(text, language)
        logging.info(f"Processed text: {processed_text[:100]}...")
        
        # Загрузка модели с указанием устройства
        tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")
        
        # Временный файл для сырого аудио
        temp_output = output_path.replace('.wav', '_temp.wav')

        # Синтез речи с улучшенными параметрами
        tts.tts_to_file(
            text=processed_text,
            speaker_wav=speaker_voice,
            language=language,
            file_path=temp_output,
            speed=1.0,
            temperature=0.85,
            sound_norm_refs=True,
        )
        
        # Улучшение качества аудио
        if enhance_audio_quality(temp_output, output_path):
            # Удаление временного файла
            os.remove(temp_output)
        else:
            # Если улучшение не удалось, используем оригинальный файл
            os.rename(temp_output, output_path)
        
        return True
    except Exception as e:
        raise Exception(f"Speech synthesis failed: {str(e)}")

def main():
    _ensure_utf8_stdio()
    # Настройка логирования
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)

    json_stdout = None
    stdout_fd_backup = None
    do_redirect = False
    try:
        json_stdout = os.fdopen(os.dup(1), 'w', encoding='utf-8', errors='replace', newline='\n')
        do_redirect = True
    except Exception:
        json_stdout = sys.stdout

    try:
        if do_redirect:
            try:
                stdout_fd_backup = os.dup(1)
                os.dup2(2, 1)
            except Exception:
                stdout_fd_backup = None
            sys.stdout = sys.stderr

        parser = argparse.ArgumentParser(description='Coqui TTS XTTS-v2 synthesis with enhanced quality')
        parser.add_argument('--text', required=True, help='Text to synthesize')
        parser.add_argument('--output', required=True, help='Output audio file path')
        parser.add_argument('--speaker_voice', default='temp/speaker.wav', help='Path to speaker reference voice file')
        parser.add_argument('--language', default='ru', help='Language code (ru, en, etc.)')
        
        args = parser.parse_args()

        try:
            # Валидация входных данных
            validation_errors = validate_inputs(args)
            if validation_errors:
                print(json.dumps({
                    'success': False,
                    'error': 'Validation failed',
                    'details': validation_errors
                }), file=sys.stderr)
                sys.exit(1)
            
            # Создание папок
            output_dir = Path(args.output).parent
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Определение файла говорящего
            if args.speaker_voice and os.path.exists(args.speaker_voice):
                speaker_voice = args.speaker_voice
            else:
                raise Exception("Speaker voice file not found")
            
            # Синтез речи с улучшенными параметрами
            success = synthesize_speech(
                text=args.text,
                speaker_voice=speaker_voice,
                output_path=args.output,
                language=args.language,
            )
            
            if success and os.path.exists(args.output):
                # Получаем информацию о файле
                file_size = os.path.getsize(args.output)
                
                print(json.dumps({
                    'success': True,
                    'output_file': args.output,
                    'language': args.language,
                    'text_length': len(args.text),
                    'file_size_bytes': file_size,
                    'speaker_voice': speaker_voice,
                }), file=json_stdout, flush=True)
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'Speech synthesis failed - no output file created'
                }), file=sys.stderr)
                sys.exit(1)
                
        except KeyboardInterrupt:
            print(json.dumps({
                'success': False,
                'error': 'Operation cancelled by user'
            }), file=sys.stderr)
            sys.exit(1)
            
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': 'Unexpected error',
                'details': str(e)
            }), file=sys.stderr)
            sys.exit(1)

    finally:
        try:
            sys.stdout = sys.__stdout__
        except Exception:
            pass
        if stdout_fd_backup is not None:
            try:
                os.dup2(stdout_fd_backup, 1)
            except Exception:
                pass
            try:
                os.close(stdout_fd_backup)
            except Exception:
                pass
        if json_stdout not in (None, sys.stdout, sys.stderr):
            try:
                json_stdout.close()
            except Exception:
                pass

if __name__ == '__main__':
    main()
