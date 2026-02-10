from duckduckgo_search import DDGS
import logging
from typing import List, Dict, Tuple, Optional
import re

logger = logging.getLogger(__name__)

class KeywordSearch:
    def __init__(self, debug: bool = False):
        self.debug = debug
        # DDGS instance will be created per request to avoid session issues if any
        
    def extract_keywords_simple(self, text: str, language: str = 'ja') -> List[str]:
        """
        シンプルなキーワード抽出
        """
        if not text:
            return []
            
        if str(language).lower().startswith('ja'):
            # 日本語の場合: 漢字、カタカナ、英数字の連続を抽出
            # 漢字1文字以上、カタカナ2文字以上、英数字3文字以上
            kanji = re.findall(r'[\u4e00-\u9faf]{1,}', text)
            katakana = re.findall(r'[\u30a0-\u30ff]{2,}', text)
            english = re.findall(r'[a-zA-Z0-9]{3,}', text)
            
            # 1文字の漢字は重要そうなもの以外除外（助詞や代名詞的なものを除外）
            kanji_filtered = []
            kanji_stop = set('はがのをにへとでもはがのをつにへとでもはがのをつをしてにへとでもはがのをつをしてるた')
            # 実際には一文字漢字のストップリスト
            one_char_stop = set('私僕俺君彼彼女誰何これそれあれこれ其其此此孰孰何何一二三四五六七八九十百千万大小上下左右前後中東西南北')
            for k in kanji:
                if len(k) == 1:
                    if k in one_char_stop:
                        continue
                kanji_filtered.append(k)
            
            keywords = kanji_filtered + katakana + english
            
            # 汎用的な単語を除外
            stop_words = ['今日', '昨日', '明日', '自分', '人間', '最初', '最後', '今回', '今回', '本当', '実際']
            keywords = [kw for kw in keywords if kw not in stop_words]
        else:
            # 英語などの場合
            text = re.sub(r'[!?.!?.。、，,]', ' ', text)
            words = text.split()
            keywords = [word for word in words if len(word) >= 3]
            
        # 重複削除
        unique_keywords = []
        for kw in keywords:
            if kw not in unique_keywords:
                unique_keywords.append(kw)
                
        # ログ出力
        if unique_keywords:
            logger.info(f"Extracted keywords ({language}): {unique_keywords}")
        else:
            logger.info(f"No keywords extracted from text (lang: {language})")
                
        return unique_keywords[:4]

    def search(self, keywords: List[str]) -> Tuple[List[Dict], List[Dict]]:
        """
        キーワードで記事と画像を検索
        """
        if not keywords:
            return [], []
            
        query = " ".join(keywords)
        articles = []
        images = []
        
        if self.debug:
            logger.info(f"Searching for: {query}")
            
        try:
            with DDGS() as ddgs:
                # 記事検索
                text_results = list(ddgs.text(query, max_results=3))
                for r in text_results:
                    articles.append({
                        "title": r.get('title'),
                        "link": r.get('href'),
                        "snippet": r.get('body')
                    })
                
                # 画像検索
                image_results = list(ddgs.images(query, max_results=3))
                for r in image_results:
                    images.append({
                        "title": r.get('title'),
                        "image": r.get('image'),
                        "thumbnail": r.get('thumbnail'),
                        "url": r.get('url')
                    })
                
                if self.debug:
                    logger.info(f"Search found {len(articles)} articles and {len(images)} images.")
        except Exception as e:
            logger.error(f"Search failed: {e}")
            
        if self.debug:
            logger.info(f"Search results: {len(articles)} articles, {len(images)} images")
                
        return articles, images
