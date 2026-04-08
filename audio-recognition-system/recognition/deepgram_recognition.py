import sys
import os
import datetime
import queue
import wave
import time
import numpy as np
import pyaudio
import threading
import uuid
import json

# Logging
from utils.logger import setup_logger

from contextlib import nullcontext
from deepgram import (
    DeepgramClient,
    PrerecordedOptions,
    FileSource,
)

# 共通の音声正規化関数
from utils.audio_normalization import normalize_audio
from utils.keyword_search import KeywordSearch

# Setup logger
logger = setup_logger(__name__)

class DeepgramRecognition:
    def __init__(self, audio_config, processing_queue, translation_queue,
                 config_manager, lang_config, debug=False, web_ui=None, mlx_lock=None):
        self.config = audio_config
        self.processing_queue = processing_queue
        self.translation_queue = translation_queue
        self.lang_config = lang_config
        self.debug = debug
        self.web_ui = web_ui
        self.keyword_search = KeywordSearch(debug=debug)
        
        # Deepgram API Key 取得
        model_config = config_manager.get_model_config('asr')
        deepgram_config = model_config.deepgram
        self.api_key = deepgram_config.api_key if deepgram_config else ""
        if not self.api_key:
            msg = "Deepgram API Key is not set in config or environment variables (DEEPGRAM_API_KEY). Please enter it in the Web UI."
            logger.error(msg)
            raise ValueError(msg)
        
        self.model_name = deepgram_config.model if deepgram_config else "nova-2"
        
        self.deepgram = DeepgramClient(self.api_key) if self.api_key else None
        
        output_config = config_manager.output
        self.output_dir = output_config.directory

        os.makedirs(self.output_dir, exist_ok=True)
        current_time = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_file_path = os.path.join(
            self.output_dir,
            f"recognized_audio_log_{lang_config.source}_{current_time}.txt"
        )

        self.debug_audio_dir = os.path.join(self.output_dir, "debug_audio") if debug else None
        if self.debug_audio_dir:
            os.makedirs(self.debug_audio_dir, exist_ok=True)

        self._log_buffer = []
        self._log_buffer_size = 10

    def recognition_thread(self, is_running):
        last_text = ""
        last_text_time = 0
        
        if not self.deepgram:
            logger.error("DeepgramClient initialized failed. Exiting recognition thread.")
            return

        while is_running.is_set():
            try:
                audio_data = self.processing_queue.get(timeout=0.5)
                # Convert buffer to wave format internally for Deepgram REST API
                
                if self.debug:
                    logger.info("Deepgram 音声認識処理開始")
                    debug_file = os.path.join(
                        self.debug_audio_dir,
                        f"debug_audio_{int(time.time() * 1000)}.wav"
                    )
                    self.save_audio_debug(audio_data, debug_file)
                
                try:
                    payload: FileSource = {
                        "buffer": self.convert_to_wav_bytes(audio_data),
                    }
                    options = PrerecordedOptions(
                        model=self.model_name,
                        language=self.lang_config.source,
                        smart_format=True,
                    )
                    
                    response = self.deepgram.listen.rest.v("1").transcribe_file(payload, options)
                    text = response.results.channels[0].alternatives[0].transcript.strip()
                    
                except Exception as e:
                    logger.info(f"Deepgram音声認識エラー: {e}")
                    continue
                
                current_time = time.time()
                if text and (text != last_text or current_time - last_text_time > 1.5):
                    if not self.web_ui:
                        self.print_with_strictly_controlled_linebreaks(text)
                    
                    last_text = text
                    last_text_time = current_time

                    pair_id = str(uuid.uuid4())

                    if self.translation_queue:
                        self.translation_queue.put({'text': text, 'pair_id': pair_id})
                    
                    self._add_to_log_buffer(text)
                    
                    if self.web_ui:
                        self.web_ui.send_recognized_text(text, self.lang_config.source, pair_id)
                        
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
                    logger.info("Deepgram認識結果が空です。")

            except queue.Empty:
                if self.debug:
                    pass
            except Exception as e:
                logger.error(f"エラー (Deepgram認識スレッド): {e}")

        self._flush_log_buffer()

    def normalize_audio(self, audio_data):
        return normalize_audio(audio_data, self.config.format)

    def save_audio_debug(self, audio_data, filename):
        with wave.open(filename, 'wb') as wf:
            wf.setnchannels(self.config.channels)
            wf.setsampwidth(pyaudio.get_sample_size(self.config.format))
            wf.setframerate(self.config.sample_rate)
            wf.writeframes(audio_data.tobytes())
            
    def convert_to_wav_bytes(self, audio_data):
        import io
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wf:
            wf.setnchannels(self.config.channels)
            wf.setsampwidth(pyaudio.get_sample_size(self.config.format))
            wf.setframerate(self.config.sample_rate)
            wf.writeframes(audio_data.tobytes())
        return wav_io.getvalue()

    def _add_to_log_buffer(self, text):
        self._log_buffer.append(text)
        if len(self._log_buffer) >= self._log_buffer_size:
            self._flush_log_buffer()

    def _flush_log_buffer(self):
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
        self._flush_log_buffer()

    @staticmethod
    def is_sentence_end(word):
        sentence_end_chars = ('.', '!', '?', '。', '！', '？')
        return word.endswith(sentence_end_chars)

    def print_with_strictly_controlled_linebreaks(self, text):
        words = text.split()
        buffer = []
        final_output = ""
        for i, word in enumerate(words):
            buffer.append(word)
            
            if DeepgramRecognition.is_sentence_end(word) or i == len(words) - 1:
                line = ' '.join(buffer)
                final_output += line
                if DeepgramRecognition.is_sentence_end(word):
                    final_output += '\n'
                elif i == len(words) - 1:
                    final_output += ' '
                buffer = []

        if buffer:
            line = ' '.join(buffer)
            final_output += line

        print(final_output, end='', flush=True)

