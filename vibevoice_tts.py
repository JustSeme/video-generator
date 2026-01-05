#!/usr/bin/env python3
import sys
import json
import argparse
import subprocess
import os
from pathlib import Path

def validate_inputs(args):
    """Валидация входных параметров"""
    errors = []
    
    if not args.text or len(args.text.strip()) == 0:
        errors.append("Text cannot be empty")
    
    if len(args.text) > 10000:  # Ограничение длины текста
        errors.append("Text too long (max 10000 characters)")
    
    if not args.output:
        errors.append("Output file path is required")
    
    # Проверка расширения выходного файла
    if not args.output.lower().endswith('.wav'):
        errors.append("Output file must be .wav format")
    
    # Проверка доступности модели
    if not os.path.exists(args.model.replace('WestZhang/VibeVoice-Large-pt', './models/vibevoice-large')):
        if not args.model.startswith('WestZhang/') and not os.path.exists(args.model):
            errors.append(f"Model path not found: {args.model}")
    
    return errors

def check_dependencies():
    """Проверка наличия необходимых зависимостей"""
    missing_deps = []
    
    try:
        import torch
    except ImportError:
        missing_deps.append("torch")
    
    try:
        import transformers
    except ImportError:
        missing_deps.append("transformers")
    
    try:
        import librosa
    except ImportError:
        missing_deps.append("librosa")
    
    return missing_deps

def main():
    parser = argparse.ArgumentParser(description='VibeVoice TTS synthesis')
    parser.add_argument('--text', required=True, help='Text to synthesize')
    parser.add_argument('--speaker', default='Alice', help='Speaker name(s), comma-separated for multiple speakers')
    parser.add_argument('--output', required=True, help='Output audio file path')
    parser.add_argument('--model', default='WestZhang/VibeVoice-Large-pt', help='Model path')
    parser.add_argument('--format', default='monologue', help='Format: "dialogue" or "monologue"')
    parser.add_argument('--validate', action='store_true', help='Validate inputs only (no synthesis)')
    
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
        
        # Проверка зависимостей
        missing_deps = check_dependencies()
        if missing_deps:
            print(json.dumps({
                'success': False,
                'error': 'Missing dependencies',
                'details': missing_deps
            }), file=sys.stderr)
            sys.exit(1)
        
        if args.validate:
            print(json.dumps({
                'success': True,
                'message': 'Validation passed',
                'model': args.model,
                'speakers': args.speaker.split(','),
                'format': args.format
            }))
            return
        
        # Поддержка нескольких говорящих
        speakers = [s.strip() for s in args.speaker.split(',')]
        
        # Создаем временную папку и файл
        temp_dir = Path('./temp')
        temp_dir.mkdir(exist_ok=True)
        temp_text_file = temp_dir / f"temp_{os.getpid()}.txt"
        
        # Форматируем текст в зависимости от формата
        if args.format == 'dialogue' and len(speakers) > 1:
            # Для диалога форматируем как "Speaker: Text"
            formatted_text = format_dialogue_text(args.text, speakers)
        else:
            # Для монолога оставляем как есть
            formatted_text = args.text
        
        with open(temp_text_file, 'w', encoding='utf-8') as f:
            f.write(formatted_text)
        
        try:
            # Создаем папку для вывода
            output_dir = Path('./outputs')
            output_dir.mkdir(exist_ok=True)
            
            # Вызываем VibeVoice
            cmd = [
                'python', 'demo/inference_from_file.py',
                '--model_path', args.model,
                '--txt_path', str(temp_text_file),
                '--speaker_names', ','.join(speakers)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd='.', timeout=300)  # 5 минут таймаут
            
            if result.returncode != 0:
                error_msg = result.stderr if result.stderr else "Unknown error"
                print(json.dumps({
                    'success': False,
                    'error': 'VibeVoice synthesis failed',
                    'details': error_msg,
                    'return_code': result.returncode
                }), file=sys.stderr)
                sys.exit(1)
            
            # Ищем сгенерированный файл
            generated_files = list(output_dir.glob(f"{temp_text_file.stem}_generated.wav"))
            
            if generated_files:
                # Создаем папку для выходного файла
                output_path = Path(args.output)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Копируем в нужное место
                import shutil
                shutil.copy2(generated_files[0], output_path)
                
                # Удаляем временный файл
                generated_files[0].unlink()
                
                print(json.dumps({
                    'success': True,
                    'output_file': str(output_path),
                    'speakers': speakers,
                    'format': args.format,
                    'text_length': len(args.text),
                    'model': args.model
                }))
            else:
                print(json.dumps({
                    'success': False,
                    'error': 'Generated audio file not found',
                    'search_path': str(output_dir),
                    'pattern': f"{temp_text_file.stem}_generated.wav"
                }), file=sys.stderr)
                sys.exit(1)
                
        except subprocess.TimeoutExpired:
            print(json.dumps({
                'success': False,
                'error': 'Synthesis timeout',
                'details': 'Operation took longer than 5 minutes'
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
            # Удаляем временный файл
            if temp_text_file.exists():
                temp_text_file.unlink()

    except KeyboardInterrupt:
        print(json.dumps({
            'success': False,
            'error': 'Operation cancelled by user'
        }), file=sys.stderr)
        sys.exit(1)
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': 'Fatal error',
            'details': str(e)
        }), file=sys.stderr)
        sys.exit(1)

def format_dialogue_text(text, speakers):
    """Форматирует текст для диалога с несколькими говорящими"""
    lines = text.split('\n')
    formatted_lines = []
    current_speaker_idx = 0
    
    for line in lines:
        line = line.strip()
        if line:
            # Если строка начинается с имени говорящего, используем его
            if ':' in line:
                parts = line.split(':', 1)
                speaker_name = parts[0].strip()
                dialogue_text = parts[1].strip()
                
                # Ищем говорящего в списке
                speaker_idx = 0
                for i, speaker in enumerate(speakers):
                    if speaker.lower() in speaker_name.lower():
                        speaker_idx = i
                        break
                
                formatted_lines.append(f"{speakers[speaker_idx]}: {dialogue_text}")
            else:
                # Автоматически назначаем говорящего по очереди
                formatted_lines.append(f"{speakers[current_speaker_idx]}: {line}")
                current_speaker_idx = (current_speaker_idx + 1) % len(speakers)
    
    return '\n'.join(formatted_lines)

if __name__ == '__main__':
    main()
