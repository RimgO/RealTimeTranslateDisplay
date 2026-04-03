"""
設定管理モジュール

YAMLファイルから設定を読み込み、プラットフォーム依存の設定を適切に処理します。
環境変数、コマンドライン引数、プロファイル機能をサポートします。
"""

import sys
import os
import yaml
from dotenv import load_dotenv

# Load .env file
load_dotenv()

import pyaudio
import numpy as np
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass

# Logging
from utils.logger import setup_logger

# Setup logger
logger = setup_logger(__name__)


@dataclass
class DynamicBufferConfig:
    """動的バッファ設定データクラス"""
    min_duration: float = 2.0
    max_duration: float = 30.0
    short_pause: float = 0.3
    medium_pause: float = 0.8
    long_pause: float = 1.5


@dataclass
class AudioConfig:
    """音声設定データクラス"""
    format_str: str
    format: int
    sample_rate: int
    channels: int
    chunk_size: int
    buffer_duration: float
    numpy_dtype: type
    buffer_size: int
    silence_threshold: float
    voice_activity_threshold: float
    silence_duration: float
    zero_crossing_rate_threshold: float = 0.1
    dynamic_buffer: DynamicBufferConfig = None
    input_device: Optional[int] = None


@dataclass
class GGUFConfig:
    """GGUF形式モデル設定データクラス"""
    enabled: bool = False
    model_path: str = ""
    model_file: str = ""
    n_ctx: int = 4096
    n_gpu_layers: int = -1
    n_threads: int = 8


@dataclass
class APIConfig:
    """APIサーバー設定データクラス (LM Studio, Ollama, vLLM等のOpenAI互換API)"""
    enabled: bool = False
    base_url: str = "http://localhost:1234/v1"
    api_key: str = ""
    model: str = "local-model"
    timeout: int = 60
    max_retries: int = 3


@dataclass
class GoogleTranslateConfig:
    """Google Cloud Translation API設定データクラス"""
    enabled: bool = False
    api_key: str = ""


@dataclass
class DeepgramConfig:
    """Deepgram API設定データクラス"""
    api_key: str = ""
    model: str = "nova-2"


@dataclass
class ModelConfig:
    """モデル設定データクラス"""
    engine: str = "whisper"
    model_path: Optional[str] = None
    model_size: Optional[str] = None
    deepgram: Optional[DeepgramConfig] = None
    gguf: Optional[GGUFConfig] = None
    api: Optional[APIConfig] = None
    google: Optional[GoogleTranslateConfig] = None
    trust_remote_code: bool = False  # セキュリティ: 任意コード実行の制御


@dataclass
class TranslationConfig:
    """翻訳設定データクラス"""
    enabled: bool
    batch_size: int
    context_window_size: int
    context_separator: str
    generation_params: Dict[str, Any]
    reload_interval: int
    max_consecutive_errors: int
    error_cooldown: int


@dataclass
class OutputConfig:
    """出力設定データクラス"""
    directory: str
    recognized_audio: bool
    translated_text: bool
    bilingual_log: bool
    timestamp_format: str


@dataclass
class LanguageConfig:
    """言語設定データクラス"""
    source: str
    target: str
    
    # 後方互換性のためのエイリアス
    @property
    def source_lang(self) -> str:
        """後方互換性: source_lang → source"""
        return self.source
    
    @property
    def target_lang(self) -> str:
        """後方互換性: target_lang → target"""
        return self.target
    
    @staticmethod
    def get_language_name(lang_code: str) -> str:
        """
        言語コードから言語名を取得
        
        Args:
            lang_code: 言語コード ('en', 'ja', etc.)
        
        Returns:
            言語名
        """
        language_names = {
            'ja': '日本語',
            'en': '英語',
            'zh': '中国語',
            'ko': '韓国語',
            'fr': 'フランス語',
            'de': 'ドイツ語',
            'es': 'スペイン語',
            'it': 'イタリア語',
            'ru': 'ロシア語',
            'ar': 'アラビア語',
            'pt': 'ポルトガル語',
            'hi': 'ヒンディー語',
        }
        return language_names.get(lang_code, lang_code)


@dataclass
class ResourceConfig:
    """リソース設定データクラス"""
    min_threads: int
    max_threads: int


@dataclass
class TTSConfig:
    """TTS (Text-to-Speech) 設定データクラス"""
    enabled: bool = False
    engine: str = "edge-tts"
    voice: str = "ja-JP-NanamiNeural"  # edge-tts voice ID
    rate: str = "+0%"  # edge-tts rate (-50% to +100%)
    volume: str = "+0%"  # edge-tts volume (-50% to +100%)
    pitch: str = "+0Hz"  # edge-tts pitch (-50Hz to +50Hz)
    output_device: Optional[str] = None  # Output device name


class ConfigManager:
    """
    統合設定管理クラス（クリーン版）
    
    YAMLファイルから設定を読み込み、すべての設定を型安全なデータクラスで提供します。
    後方互換性は考慮せず、モダンでシンプルなAPIを提供します。
    
    使用例:
        config = ConfigManager()
        logger.info(config.audio.sample_rate)
        logger.info(config.translation.batch_size)
        logger.info(config.language.source)
    """
    
    def __init__(self, config_path: Optional[str] = None, profile: str = "production"):
        """
        Args:
            config_path: 設定ファイルのパス（Noneの場合はデフォルト）
            profile: 使用するプロファイル名 (development, production, testing)
        """
        self.profile = profile
        self.platform = self._detect_platform()

        # 設定ファイルの読み込み
        if config_path is None:
            config_path = self._find_default_config()

        self.config_path = config_path  # Store for reload()
        self._config = self._load_config(config_path)

        # プロファイルの適用
        self._apply_profile()

        # 環境変数による上書き
        self._apply_env_overrides()

        # 設定データクラスの初期化（遅延ロード用のキャッシュ）
        self._audio = None
        self._translation = None
        self._output = None
        self._language = None
        self._resources = None
        self._tts = None

    @staticmethod
    def _detect_platform() -> str:
        """プラットフォームを検出"""
        if sys.platform == 'darwin':
            return 'darwin'
        return 'default'
    
    @staticmethod
    def _find_default_config() -> str:
        """デフォルトの設定ファイルを探す

        config.yamlが存在しない場合、config.yaml.exampleから自動的にコピーします。
        """
        possible_paths = [
            'config.yaml',
            'config/config.yaml',
            'configs/config.yaml',
            os.path.join(os.path.dirname(__file__), 'config.yaml'),
        ]

        # まずconfig.yamlを探す
        for path in possible_paths:
            if os.path.exists(path):
                return path

        # config.yamlが見つからない場合、config.yaml.exampleからコピー
        example_paths = [
            'config.yaml.example',
            'config/config.yaml.example',
            'configs/config.yaml.example',
            os.path.join(os.path.dirname(__file__), 'config.yaml.example'),
        ]

        for example_path in example_paths:
            if os.path.exists(example_path):
                # config.yamlと同じディレクトリにコピー
                target_path = example_path.replace('.example', '')
                try:
                    shutil.copy2(example_path, target_path)
                    logger.info(f"初回起動: {example_path} を {target_path} にコピーしました。")
                    return target_path
                except Exception as e:
                    logger.warning(f" 設定ファイルのコピーに失敗しました: {e}")

        raise FileNotFoundError(
            "設定ファイルが見つかりません。config.yaml または config.yaml.example を以下のパスに配置してください:\n" +
            "\n".join(f"  - {p}" for p in possible_paths)
        )
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """YAML設定ファイルを読み込む"""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            logger.info(f"設定ファイルを読み込みました: {config_path}")
            return config
        except Exception as e:
            raise RuntimeError(f"設定ファイルの読み込みに失敗しました: {e}")
    
    def _apply_profile(self):
        """プロファイル設定を適用"""
        if 'profiles' in self._config and self.profile in self._config['profiles']:
            profile_config = self._config['profiles'][self.profile]
            self._deep_merge(self._config, profile_config)
            logger.info(f"プロファイルを適用しました: {self.profile}")
    
    def _deep_merge(self, base: Dict, override: Dict):
        """辞書を再帰的にマージ"""
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value
    
    def _apply_env_overrides(self):
        """環境変数による設定の上書き"""
        env_mappings = {
            'AUDIO_SAMPLE_RATE': ('audio', 'sample_rate'),
            'AUDIO_CHANNELS': ('audio', 'channels'),
            'MODEL_SIZE': ('models', 'asr', self.platform, 'model_size'),
            'TRANSLATION_BATCH_SIZE': ('translation', 'batch_size'),
            'OUTPUT_DIR': ('output', 'directory'),
            'DEBUG': ('debug', 'enabled'),
            'GOOGLE_TRANSLATE_API_KEY': ('models', 'translation', 'google', 'api_key'),
            'GOOGLE_TRANSLATE_ENABLED': ('models', 'translation', 'google', 'enabled'),
            'DEEPGRAM_API_KEY': ('models', 'asr', 'deepgram', 'api_key'),
        }
        
        for env_var, config_path in env_mappings.items():
            if env_var in os.environ:
                value = os.environ[env_var]
                # 型変換
                if env_var in ['AUDIO_SAMPLE_RATE', 'AUDIO_CHANNELS', 'TRANSLATION_BATCH_SIZE']:
                    value = int(value)
                elif env_var in ['DEBUG', 'GOOGLE_TRANSLATE_ENABLED']:
                    value = value.lower() in ('true', '1', 'yes')
                
                self._set_nested_value(config_path, value)
    
    def _set_nested_value(self, path: tuple, value: Any):
        """ネストされた設定値をセット"""
        current = self._config
        for key in path[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[path[-1]] = value
    
    def get(self, *keys: str, default: Any = None) -> Any:
        """
        設定値を取得（プラットフォーム依存の値を自動選択）
        
        Args:
            *keys: 設定キーのパス
            default: デフォルト値
        
        Returns:
            設定値
        """
        current = self._config
        
        for key in keys:
            if not isinstance(current, dict):
                return default
            
            # プラットフォーム依存の設定を優先
            if self.platform in current and key != self.platform:
                platform_value = current[self.platform].get(key) if isinstance(current[self.platform], dict) else None
                if platform_value is not None:
                    return platform_value
            
            if key in current:
                current = current[key]
            else:
                return default
        
        # プラットフォーム固有の値がある場合はそれを返す
        if isinstance(current, dict) and self.platform in current:
            return current[self.platform]
        
        return current
    
    # =====================================
    # 設定取得メソッド（型安全）
    # =====================================
    
    @staticmethod
    def _get_format_from_string(format_str: str) -> int:
        """フォーマット文字列からPyAudioのフォーマット定数に変換"""
        format_dict = {
            'int8': pyaudio.paInt8,
            'int16': pyaudio.paInt16,
            'int32': pyaudio.paInt32,
            'float32': pyaudio.paFloat32
        }
        return format_dict.get(format_str.lower(), pyaudio.paInt16)
    
    @staticmethod
    def _get_numpy_dtype(format: int):
        """PyAudioフォーマットからNumPyのdtypeに変換"""
        dtype_map = {
            pyaudio.paInt8: np.int8,
            pyaudio.paInt16: np.int16,
            pyaudio.paInt32: np.int32,
            pyaudio.paFloat32: np.float32,
        }
        if format not in dtype_map:
            raise ValueError(f"Unsupported audio format: {format}")
        return dtype_map[format]
    
    @property
    def audio(self) -> AudioConfig:
        """音声設定を取得（キャッシュあり）"""
        if self._audio is None:
            format_str = self.get('audio', 'format')
            format_val = self._get_format_from_string(format_str)
            sample_rate = self.get('audio', 'sample_rate')
            buffer_duration = self.get('audio', 'buffer_duration')

            # 動的バッファ設定を取得
            dynamic_buffer_config = DynamicBufferConfig()
            if 'dynamic_buffer' in self._config.get('audio', {}):
                db_data = self._config['audio']['dynamic_buffer']
                dynamic_buffer_config = DynamicBufferConfig(
                    min_duration=db_data.get('min_duration', 2.0),
                    max_duration=db_data.get('max_duration', 30.0),
                    short_pause=db_data.get('short_pause', 0.3),
                    medium_pause=db_data.get('medium_pause', 0.8),
                    long_pause=db_data.get('long_pause', 1.5)
                )

            self._audio = AudioConfig(
                format_str=format_str,
                format=format_val,
                sample_rate=sample_rate,
                channels=self.get('audio', 'channels'),
                chunk_size=self.get('audio', 'chunk_size'),
                buffer_duration=buffer_duration,
                numpy_dtype=self._get_numpy_dtype(format_val),
                buffer_size=int(sample_rate * buffer_duration),
                silence_threshold=self.get('audio', 'voice_detection', 'silence_threshold'),
                voice_activity_threshold=self.get('audio', 'voice_detection', 'voice_activity_threshold'),
                silence_duration=self.get('audio', 'voice_detection', 'silence_duration'),
                zero_crossing_rate_threshold=self.get('audio', 'voice_detection', 'zero_crossing_rate_threshold', default=0.1),
                dynamic_buffer=dynamic_buffer_config,
                input_device=self.get('audio', 'input_device'),
            )

        return self._audio
    
    def reload(self):
        """
        設定ファイルを再読み込み

        実行中に config.yaml が更新された場合、この関数を呼び出すことで
        新しい設定を反映できます。TTS設定や翻訳パラメータなど、
        リアルタイム反映可能な設定に使用します。
        """
        # 設定ファイルを再読み込み
        self._config = self._load_config(self.config_path)

        # プロファイルと環境変数を再適用
        self._apply_profile()
        self._apply_env_overrides()

        # キャッシュをクリア（次回アクセス時に再生成）
        self._audio = None
        self._translation = None
        self._output = None
        self._language = None
        self._resources = None
        self._tts = None  # TTS設定もクリア

    def get_model_config(self, model_type: str) -> ModelConfig:
        """
        モデル設定を取得

        Args:
            model_type: 'asr' または 'translation'

        Returns:
            ModelConfig
        """
        # models.asr または models.translation を取得
        if 'models' not in self._config or model_type not in self._config['models']:
            return ModelConfig(model_path=None, model_size=None)

        model_config = self._config['models'][model_type]

        # プラットフォーム固有の設定を取得
        if self.platform in model_config:
            platform_config = model_config[self.platform]
        elif 'default' in model_config:
            platform_config = model_config['default']
        else:
            platform_config = {}

        # エンジン設定とDeepgram設定を取得
        engine = model_config.get('engine', 'whisper')
        deepgram_config = DeepgramConfig()
        if 'deepgram' in model_config:
            dg_data = model_config['deepgram']
            if isinstance(dg_data, dict):
                deepgram_config = DeepgramConfig(
                    api_key=dg_data.get('api_key', ''),
                    model=dg_data.get('model', 'nova-2')
                )

        # GGUF設定を取得
        gguf_config = GGUFConfig()
        if 'gguf' in model_config:
            gguf_data = model_config['gguf']
            gguf_config = GGUFConfig(
                enabled=gguf_data.get('enabled', False),
                model_path=gguf_data.get('model_path', ''),
                model_file=gguf_data.get('model_file', ''),
                n_ctx=gguf_data.get('n_ctx', 4096),
                n_gpu_layers=gguf_data.get('n_gpu_layers', -1),
                n_threads=gguf_data.get('n_threads', 8)
            )

        # API設定を取得
        api_config = APIConfig()
        if 'api' in model_config:
            api_data = model_config['api']
            api_config = APIConfig(
                enabled=api_data.get('enabled', False),
                base_url=api_data.get('base_url', 'http://localhost:1234/v1'),
                api_key=api_data.get('api_key', ''),
                model=api_data.get('model', 'local-model'),
                timeout=api_data.get('timeout', 60),
                max_retries=api_data.get('max_retries', 3)
            )

        # Google Translate設定を取得
        google_config = GoogleTranslateConfig()
        if 'google' in model_config:
            google_data = model_config['google']
            google_config = GoogleTranslateConfig(
                enabled=google_data.get('enabled', False),
                api_key=google_data.get('api_key', '')
            )

        # trust_remote_code 設定を取得（デフォルト: False、PlamoなどはTrueが必要）
        trust_remote_code = model_config.get('trust_remote_code', False)
        # Plamoモデルなどはコード実行が必須なため、モデルパスに含まれる場合はTrueを強制または推奨
        model_path = platform_config.get('model_path', '')
        if model_path and 'plamo' in model_path.lower():
            trust_remote_code = True

        return ModelConfig(
            engine=engine,
            model_path=platform_config.get('model_path'),
            model_size=platform_config.get('model_size'),
            deepgram=deepgram_config,
            gguf=gguf_config,
            api=api_config,
            google=google_config,
            trust_remote_code=trust_remote_code
        )
    
    @property
    def translation(self) -> TranslationConfig:
        """翻訳設定を取得（キャッシュあり）"""
        if self._translation is None:
            # プラットフォーム固有の生成パラメータを取得
            gen_config = self._config.get('translation', {}).get('generation', {})
            if self.platform in gen_config:
                gen_params = gen_config[self.platform]
            elif 'default' in gen_config:
                gen_params = gen_config['default']
            else:
                gen_params = {}
            
            # reload_intervalの取得
            reload_config = self._config.get('models', {}).get('translation', {}).get('reload', {})
            if self.platform == 'darwin' and 'interval_seconds_darwin' in reload_config:
                reload_interval = reload_config['interval_seconds_darwin']
            else:
                reload_interval = reload_config.get('interval_seconds', 3600)
            
            # error_handlingの取得
            error_config = self._config.get('models', {}).get('translation', {}).get('error_handling', {})
            
            self._translation = TranslationConfig(
                enabled=self._config.get('translation', {}).get('enabled', True),
                batch_size=self._config.get('translation', {}).get('batch_size', 5),
                context_window_size=self._config.get('translation', {}).get('context', {}).get('window_size', 8),
                context_separator=self._config.get('translation', {}).get('context', {}).get('separator', '\n'),
                generation_params=gen_params,
                reload_interval=reload_interval,
                max_consecutive_errors=error_config.get('max_consecutive_errors', 5),
                error_cooldown=error_config.get('error_cooldown_seconds', 10),
            )
        
        return self._translation
    
    @property
    def output(self) -> OutputConfig:
        """出力設定を取得（キャッシュあり）"""
        if self._output is None:
            self._output = OutputConfig(
                directory=self.get('output', 'directory'),
                recognized_audio=self.get('output', 'logging', 'recognized_audio'),
                translated_text=self.get('output', 'logging', 'translated_text'),
                bilingual_log=self.get('output', 'logging', 'bilingual_log'),
                timestamp_format=self.get('output', 'filename_format', 'timestamp'),
            )
        
        return self._output
    
    @property
    def language(self) -> LanguageConfig:
        """言語設定を取得（キャッシュあり）"""
        if self._language is None:
            self._language = LanguageConfig(
                source=self.get('language', 'source'),
                target=self.get('language', 'target')
            )
        
        return self._language
    
    @property
    def resources(self) -> ResourceConfig:
        """リソース設定を取得（キャッシュあり）"""
        if self._resources is None:
            self._resources = ResourceConfig(
                min_threads=self.get('resources', 'threads', 'min', default=2),
                max_threads=self.get('resources', 'threads', 'max', default=8),
            )

        return self._resources

    @property
    def tts(self) -> TTSConfig:
        """TTS設定を取得（キャッシュあり）"""
        if not hasattr(self, '_tts') or self._tts is None:
            self._tts = TTSConfig(
                enabled=self.get('tts', 'enabled', default=False),
                engine=self.get('tts', 'engine', default='edge-tts'),
                voice=self.get('tts', 'voice', default='ja-JP-NanamiNeural'),
                rate=self.get('tts', 'rate', default='+0%'),
                volume=self.get('tts', 'volume', default='+0%'),
                pitch=self.get('tts', 'pitch', default='+0Hz'),
                output_device=self.get('tts', 'output_device', default=None),
            )

        return self._tts

    def is_debug_enabled(self) -> bool:
        """デバッグモードが有効か"""
        return self.get('debug', 'enabled', default=False)

    # =====================================
    # 公式セッター API（キャッシュ無効化付き）
    # =====================================

    def set_output_dir(self, directory: str) -> None:
        """
        出力ディレクトリを設定

        Args:
            directory: 出力ディレクトリパス
        """
        if 'output' not in self._config:
            self._config['output'] = {}
        self._config['output']['directory'] = directory
        # キャッシュを無効化
        self._output = None

    def set_language(self, source: str, target: str) -> None:
        """
        翻訳言語を設定

        Args:
            source: ソース言語コード（例: 'en'）
            target: ターゲット言語コード（例: 'ja'）
        """
        if 'language' not in self._config:
            self._config['language'] = {}
        self._config['language']['source'] = source
        self._config['language']['target'] = target
        # キャッシュを更新（既存のインスタンスが参照している場合を考慮してインプレース更新）
        if self._language:
            self._language.source = source
            self._language.target = target
        else:
            # 次回取得時に生成
            self._language = None

    def set_batch_size(self, batch_size: int) -> None:
        """
        翻訳バッチサイズを設定

        Args:
            batch_size: バッチサイズ（正の整数）
        """
        if batch_size <= 0:
            raise ValueError(f"batch_size must be positive, got {batch_size}")
        if 'translation' not in self._config:
            self._config['translation'] = {}
        self._config['translation']['batch_size'] = batch_size
        # キャッシュを無効化
        self._translation = None

    def set_model_path(self, model_type: str, model_path: str) -> None:
        """
        モデルパスを設定

        Args:
            model_type: 'asr' または 'translation'
            model_path: モデルパス（Hugging FaceリポジトリIDまたはローカルパス）
        """
        if model_type not in ['asr', 'translation']:
            raise ValueError(f"model_type must be 'asr' or 'translation', got {model_type}")

        if 'models' not in self._config:
            self._config['models'] = {}
        if model_type not in self._config['models']:
            self._config['models'][model_type] = {}
        if self.platform not in self._config['models'][model_type]:
            self._config['models'][model_type][self.platform] = {}

        self._config['models'][model_type][self.platform]['model_path'] = model_path

    def set_asr_engine(self, engine: str) -> None:
        """
        ASRエンジンを設定

        Args:
            engine: 'whisper' または 'deepgram'
        """
        if 'models' not in self._config:
            self._config['models'] = {}
        if 'asr' not in self._config['models']:
            self._config['models']['asr'] = {}
        self._config['models']['asr']['engine'] = engine

    def set_tts_enabled(self, enabled: bool) -> None:
        """
        TTS有効化を設定

        Args:
            enabled: TTS有効フラグ
        """
        if 'tts' not in self._config:
            self._config['tts'] = {}
        self._config['tts']['enabled'] = enabled
        # キャッシュを更新（既存のインスタンスが参照している場合を考慮）
        if self._tts:
            self._tts.enabled = enabled
        # キャッシュを無効化（次回取得時に再生成されるようにもする）
        # self._tts = None # 今回は参照保持のためNoneにしないか、enabledプロパティを持つ別オブジェクトにするか。
        # dataclassなので参照を書き換えれば伝わる。

    def set_debug(self, enabled: bool) -> None:
        """
        デバッグモードを設定

        Args:
            enabled: デバッグ有効フラグ
        """
        if 'debug' not in self._config:
            self._config['debug'] = {}
        self._config['debug']['enabled'] = enabled

    def to_dict(self) -> Dict[str, Any]:
        """設定を辞書として取得（デバッグ用）"""
        return self._config.copy()

    def __repr__(self):
        """デバッグ用の文字列表現"""
        return (
            f"ConfigManager("
            f"profile={self.profile}, "
            f"platform={self.platform})"
        )


# 使用例とテスト
if __name__ == "__main__":
    logger.info("=== ConfigManager (クリーン統合版) のテスト ===\n")
    
    # 初期化
    config = ConfigManager(profile="development")
    
    logger.info(f"基本情報:")
    logger.info(f"  プロファイル: {config.profile}")
    logger.info(f"  プラットフォーム: {config.platform}")

    logger.info("🎵 音声設定:")
    audio = config.audio
    logger.info(f"  サンプルレート: {audio.sample_rate} Hz")
    logger.info(f"  チャンネル: {audio.channels}")
    logger.info(f"  フォーマット: {audio.format_str}")
    logger.info(f"  バッファサイズ: {audio.buffer_size}")
    logger.info(f"  NumPy dtype: {audio.numpy_dtype}")

    logger.info("モデル設定:")
    asr_model = config.get_model_config('asr')
    logger.info(f"  ASRモデル: {asr_model.model_path}")
    logger.info(f"  モデルサイズ: {asr_model.model_size}")
    
    trans_model = config.get_model_config('translation')
    logger.info(f"  翻訳モデル: {trans_model.model_path}")
    
    logger.info(f"  GGUFモデル使用: {trans_model.gguf.enabled}")
    if trans_model.gguf.enabled:
        logger.info(f"    GGUFモデルパス: {trans_model.gguf.model_path}")
        logger.info(f"    GGUFモデルファイル: {trans_model.gguf.model_file}")
        logger.info(f"    コンテキストウィンドウ: {trans_model.gguf.n_ctx}")
        logger.info(f"    GPUレイヤー数: {trans_model.gguf.n_gpu_layers}")
        logger.info(f"    CPUスレッド数: {trans_model.gguf.n_threads}")

    logger.info("翻訳設定:")
    trans = config.translation
    logger.info(f"  有効: {trans.enabled}")
    logger.info(f"  バッチサイズ: {trans.batch_size}")
    logger.info(f"  コンテキストウィンドウ: {trans.context_window_size}")

    logger.info("言語設定:")
    lang = config.language
    logger.info(f"  {lang.source} → {lang.target}")

    logger.info("出力設定:")
    output = config.output
    logger.info(f"  ディレクトリ: {output.directory}")
    logger.info(f"  音声認識ログ: {output.recognized_audio}")
    logger.info(f"  翻訳ログ: {output.translated_text}")

    logger.info("リソース設定:")
    res = config.resources
    logger.info(f"  スレッド: {res.min_threads}-{res.max_threads}")

    logger.info("すべての設定が型安全に取得できます！")

