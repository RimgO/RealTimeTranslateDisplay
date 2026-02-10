"""
Web UI Bridge

Bridges the audio recognition/translation system with the Web UI
by sending real-time updates via WebSocket.
"""

import asyncio
import json
from typing import Optional, List, Dict
from datetime import datetime
import requests
from concurrent.futures import ThreadPoolExecutor

# Logging
from utils.logger import setup_logger

# Setup logger
logger = setup_logger(__name__)

class WebUIBridge:
    """
    Web UIとの橋渡しクラス

    音声認識・翻訳システムからの出力をWeb UIにリアルタイムで送信します。
    """

    def __init__(self, server_url: str = "http://localhost:8000", enabled: bool = True):
        """
        Args:
            server_url: Web UIサーバーのURL
            enabled: Web UI連携を有効にするか
        """
        self.server_url = server_url
        self.enabled = enabled
        self.broadcast_url = f"{server_url}/api/broadcast"
        # 非同期送信用のスレッドプール
        self.executor = ThreadPoolExecutor(max_workers=4)
        # デバッグ用ログファイル
        self.debug_log = "/Users/rimgo/RealtimeTranslateDisplay/bridge_debug.log"
        with open(self.debug_log, "a") as f:
            f.write(f"\n--- Bridge started at {datetime.now()} ---\n")

    def send_recognized_text(self, text: str, language: str = "en", pair_id: Optional[str] = None):
        """
        認識されたテキストを送信

        Args:
            text: 認識されたテキスト
            language: 言語コード
            pair_id: ペアID（翻訳と紐付けるため）
        """
        if not self.enabled:
            return

        message = {
            "type": "recognized",
            "text": text,
            "language": language,
            "pair_id": pair_id or datetime.now().isoformat(),
            "timestamp": datetime.now().isoformat()
        }
        self._broadcast(message)

    def send_translated_text(self, text: str, source_text: Optional[str] = None, pair_id: Optional[str] = None):
        """
        翻訳されたテキストを送信

        Args:
            text: 翻訳されたテキスト
            source_text: 元のテキスト（オプション）
            pair_id: ペアID（認識テキストと紐付けるため）
        """
        if not self.enabled:
            return

        message = {
            "type": "translated",
            "text": text,
            "source_text": source_text,
            "pair_id": pair_id or datetime.now().isoformat(),
            "timestamp": datetime.now().isoformat()
        }
        self._broadcast(message)

    def send_keywords(self, keywords: list, articles: list, images: list, pair_id: Optional[str] = None):
        """
        抽出されたキーワードと検索結果を送信

        Args:
            keywords: キーワードリスト
            articles: 記事リスト
            images: 画像リスト
            pair_id: ペアID
        """
        if not self.enabled:
            return

        with open(self.debug_log, "a") as f:
            f.write(f"{datetime.now()} [KEYWORDS] count={len(keywords)} results={len(articles)}/{len(images)}\n")

        message = {
            "type": "keywords",
            "keywords": keywords,
            "articles": articles,
            "images": images,
            "pair_id": pair_id or datetime.now().isoformat(),
            "timestamp": datetime.now().isoformat()
        }
        logger.info(f"Bridge sending keywords: {keywords}")
        self._broadcast(message)

    def send_status(self, status: str, message: str):
        """
        ステータス更新を送信

        Args:
            status: ステータス（running, stopped, error等）
            message: ステータスメッセージ
        """
        if not self.enabled:
            return

        data = {
            "type": "status",
            "status": status,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        self._broadcast(data)

    def send_error(self, error_message: str):
        """
        エラーメッセージを送信

        Args:
            error_message: エラーメッセージ
        """
        if not self.enabled:
            return

        message = {
            "type": "error",
            "message": error_message,
            "timestamp": datetime.now().isoformat()
        }
        self._broadcast(message)

    def _broadcast(self, message: dict):
        """
        メッセージをブロードキャスト (非同期)
        """
        if not self.enabled:
            return
            
        def _do_post():
            try:
                resp = requests.post(self.broadcast_url, json=message, timeout=2.0)
                with open(self.debug_log, "a") as f:
                    f.write(f"{datetime.now()} [BROADCAST] type={message.get('type')} status={resp.status_code}\n")
                if resp.status_code != 200:
                    logger.warning(f"Web UI broadcast failed: HTTP {resp.status_code}")
            except Exception as e:
                with open(self.debug_log, "a") as f:
                    f.write(f"{datetime.now()} [BROADCAST ERROR] {e}\n")
                logger.error(f"Web UI broadcast error: {e}")

        self.executor.submit(_do_post)

    def close(self):
        """スレッドプールの終了"""
        self.executor.shutdown(wait=False)
