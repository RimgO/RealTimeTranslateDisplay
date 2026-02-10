import sys
import os
import datetime
import queue
import wave
import time
import numpy as np
import pyaudio

# Logging
from utils.logger import setup_logger

if sys.platform == 'darwin':
    import mlx_whisper
    import mlx.core as mx
else:
    import whisper

# 共通の音声正規化関数
from utils.audio_normalization import normalize_audio
from utils.keyword_search import KeywordSearch
import threading

# Setup logger
logger = setup_logger(__name__)

from contextlib import nullcontext

class SpeechRecognition:
    def __init__(self, audio_config, processing_queue, translation_queue,
                 config_manager, lang_config, debug=False, web_ui=None, mlx_lock=None):
        self.mlx_lock = mlx_lock
        self.config = audio_config
        self.processing_queue = processing_queue
        self.translation_queue = translation_queue
        self.lang_config = lang_config
        self.debug = debug
        self.web_ui = web_ui  # Web UI Bridge
        self.keyword_search = KeywordSearch(debug=debug)

        # ConfigManagerから設定を取得
        if hasattr(config_manager, 'get_model_config'):
            # ConfigManagerの場合
            model_config = config_manager.get_model_config('asr')
            self.model_path = model_config.model_path
            self.model_size = model_config.model_size
            output_config = config_manager.output
            self.output_dir = output_config.directory
        else:
            # 互換アダプターの場合
            self.model_path = getattr(config_manager, 'model_path', None)
            self.model_size = getattr(config_manager, 'model_size', 'large-v3-turbo')
            self.output_dir = getattr(config_manager, 'output_dir', 'logs')

        if sys.platform != 'darwin':
            self.model = whisper.load_model(self.model_size)

        os.makedirs(self.output_dir, exist_ok=True)
        current_time = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file_path = os.path.join(
            self.output_dir,
            f"recognized_audio_log_{lang_config.source}_{current_time}.txt"
        )

        # デバッグモード: 音声ファイル出力ディレクトリ
        self.debug_audio_dir = os.path.join(self.output_dir, "debug_audio") if debug else None
        if self.debug_audio_dir:
            os.makedirs(self.debug_audio_dir, exist_ok=True)

        # パフォーマンス最適化：ログバッファ
        self._log_buffer = []
        self._log_buffer_size = 10  # 10件ごとに書き込み

    def recognition_thread(self, is_running):
        last_text = ""
        last_text_time = 0
        while is_running.is_set():
            try:
                audio_data = self.processing_queue.get(timeout=0.5)
                normalized_audio = self.normalize_audio(audio_data)
                
                if self.debug:
                    logger.info("音声認識処理開始")
                    debug_file = os.path.join(
                        self.debug_audio_dir,
                        f"debug_audio_{int(time.time() * 1000)}.wav"
                    )
                    self.save_audio_debug(audio_data, debug_file)
                
                try:
                    if sys.platform == 'darwin':
                        # Ensure MLX lock is used if available to prevent Metal thread conflict
                        lock = self.mlx_lock if self.mlx_lock else nullcontext() # fallback dummy context if no lock
                        
                        # Use the lock if it's a real lock, otherwise just run
                        if self.mlx_lock:
                            with self.mlx_lock:
                                result = mlx_whisper.transcribe(
                                    normalized_audio,
                                    language=self.lang_config.source,
                                    path_or_hf_repo=self.model_path
                                )
                                # Wait for GPU to finish before releasing lock
                                mx.synchronize()
                        else:
                             result = mlx_whisper.transcribe(
                                normalized_audio,
                                language=self.lang_config.source,
                                path_or_hf_repo=self.model_path
                            )
                             mx.synchronize()
                    else:
                        result = self.model.transcribe(
                            normalized_audio,
                            language=self.lang_config.source
                        )
                except Exception as e:
                    logger.info(f"音声認識エラー: {e}")
                    continue
                
                text = result['text'].strip()

                current_time = time.time()
                # 判定ロジックの改善: 
                # 1. テキストが空でない
                # 2. 前のテキストと違う、または一定時間（1.5秒）経過している
                # これにより、同じフレーズを繰り返した場合や、Whisperの同一結果出力を適切に処理しつつ、
                # 反応性を向上させる。
                if text and (text != last_text or current_time - last_text_time > 1.5):
                    # Web UIモードではstdoutに出力しない
                    if not self.web_ui:
                        self.print_with_strictly_controlled_linebreaks(text)
                    
                    last_text = text
                    last_text_time = current_time

                    # ペアIDを生成（翻訳と紐付けるため）
                    import uuid
                    pair_id = str(uuid.uuid4())

                    if self.translation_queue:
                        # ペアIDと一緒に送信
                        self.translation_queue.put({'text': text, 'pair_id': pair_id})
                    
                    # 認識結果をバッファに追加（I/O効率化）
                    self._add_to_log_buffer(text)
                    
                    # Web UIに送信（ペアID付き）
                    if self.web_ui:
                        self.web_ui.send_recognized_text(text, self.lang_config.source, pair_id)
                        
                        # 翻訳キューがない場合（文字起こしのみモード）、ここでキーワード検索を発動
                        if not self.translation_queue and self.keyword_search:
                            def trigger_keyword_search(txt, pid, lang):
                                try:
                                    keywords = self.keyword_search.extract_keywords_simple(txt, lang)
                                    if keywords:
                                        articles, images = self.keyword_search.search(keywords)
                                        self.web_ui.send_keywords(keywords, articles, images, pid)
                                except Exception as e:
                                    logger.error(f"Keyword search background error (SR): {e}")

                            threading.Thread(
                                target=trigger_keyword_search,
                                args=(text, pair_id, self.lang_config.source),
                                daemon=True
                            ).start()

                elif self.debug and not text:
                    logger.info("認識結果が空です。")

            except queue.Empty:
                if self.debug:
                    logger.info("認識キューが空です")
            except Exception as e:
                logger.error(f"エラー (認識スレッド): {e}")

        # スレッド終了時に残りのバッファをフラッシュ
        self._flush_log_buffer()

    def normalize_audio(self, audio_data):
        """
        音声データを正規化

        Note:
            実装は utils.audio_normalization.normalize_audio に委譲
        """
        return normalize_audio(audio_data, self.config.format)

    def save_audio_debug(self, audio_data, filename):
        with wave.open(filename, 'wb') as wf:
            wf.setnchannels(self.config.channels)
            wf.setsampwidth(pyaudio.get_sample_size(self.config.format))
            wf.setframerate(self.config.sample_rate)
            wf.writeframes(audio_data.tobytes())

    def _add_to_log_buffer(self, text):
        """
        ログテキストをバッファに追加し、満杯時に一括書き込み

        Args:
            text: 書き込むテキスト
        """
        self._log_buffer.append(text)
        if len(self._log_buffer) >= self._log_buffer_size:
            self._flush_log_buffer()

    def _flush_log_buffer(self):
        """バッファの内容をファイルに一括書き込み"""
        if not self._log_buffer:
            return
        try:
            with open(self.log_file_path, "a", encoding="utf-8") as log_file:
                for text in self._log_buffer:
                    log_file.write(text + "\n")
            self._log_buffer.clear()
        except IOError as e:
            logger.error(f"ログ書き込みエラー: {e}")

    def close(self):
        """クローズ時に残りのバッファをフラッシュ"""
        self._flush_log_buffer()

    @staticmethod
    def is_sentence_end(word):
        # 日本語と英語の文末記号
        sentence_end_chars = ('.', '!', '?', '。', '！', '？')
        return word.endswith(sentence_end_chars)

    def print_with_strictly_controlled_linebreaks(self, text):
        words = text.split()
        buffer = []
        final_output = ""
        for i, word in enumerate(words):
            buffer.append(word)
            
            if SpeechRecognition.is_sentence_end(word) or i == len(words) - 1:
                line = ' '.join(buffer)
                final_output += line
                if SpeechRecognition.is_sentence_end(word):
                    final_output += '\n'
                elif i == len(words) - 1:
                    final_output += ' '
                buffer = []

        if buffer:
            line = ' '.join(buffer)
            final_output += line

        # コンソールに出力（認識結果はログではなく標準出力）
        print(final_output, end='', flush=True)

