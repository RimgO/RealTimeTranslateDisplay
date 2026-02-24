"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TranslateApp {
    videoElement;
    subtitleOverlay;
    originalTextElement;
    translatedTextElement;
    btnCapture;
    btnSpeech;
    statusDot;
    statusMessage;
    selectLang;
    selectSourceLang;
    selectEngine;
    ollamaSettings;
    inputOllamaUrl;
    inputOllamaModel;
    inputFontOriginal;
    inputFontTranslated;
    valFontOriginal;
    valFontTranslated;
    inputColorOriginalFill;
    inputColorOriginalStroke;
    inputColorTranslatedFill;
    inputColorTranslatedStroke;
    mlxSettings;
    inputMlxUrl;
    selectMlxMode;
    inputMaxDuration;
    valMaxDuration;
    googleSettings;
    inputGoogleKey;
    checkTts;
    btnToggleControls;
    controlsPanel;
    selectAudioSource;
    selectMicDevice;
    systemAudioNote;
    micVisualizer;
    micBar;
    recognition = null;
    isRecognizing = false;
    stream = null;
    micStream = null;
    audioContext = null;
    analyser = null;
    animationId = null;
    lastTranslatedText = '';
    translationAbortController = null;
    // Auto font size adjustment settings
    autoFontSizeEnabled = true;
    ORIGINAL_BASE_FONT_SIZE = 1.5; // rem
    TRANSLATED_BASE_FONT_SIZE = 2.5; // rem
    MIN_FONT_SIZE = 0.8; // rem
    MAX_CHARS_ORIGINAL = 100;
    MAX_CHARS_TRANSLATED = 80;
    isTranslating = false;
    mlxSocket = null;
    STORAGE_KEY = 'translate_app_settings';
    constructor() {
        this.videoElement = document.getElementById('display-video');
        this.subtitleOverlay = document.getElementById('subtitle-overlay');
        this.originalTextElement = document.getElementById('original-text');
        this.translatedTextElement = document.getElementById('translated-text');
        this.btnCapture = document.getElementById('btn-capture');
        this.btnSpeech = document.getElementById('btn-speech');
        this.statusDot = document.getElementById('status-dot');
        this.statusMessage = document.getElementById('status-message');
        this.selectLang = document.getElementById('select-lang');
        this.selectSourceLang = document.getElementById('select-source-lang');
        this.selectEngine = document.getElementById('select-engine');
        this.ollamaSettings = document.getElementById('ollama-settings');
        this.inputOllamaUrl = document.getElementById('input-ollama-url');
        this.inputOllamaModel = document.getElementById('input-ollama-model');
        this.inputFontOriginal = document.getElementById('input-font-original');
        this.inputFontTranslated = document.getElementById('input-font-translated');
        this.valFontOriginal = document.getElementById('val-font-original');
        this.valFontTranslated = document.getElementById('val-font-translated');
        this.inputColorOriginalFill = document.getElementById('input-color-original-fill');
        this.inputColorOriginalStroke = document.getElementById('input-color-original-stroke');
        this.inputColorTranslatedFill = document.getElementById('input-color-translated-fill');
        this.inputColorTranslatedStroke = document.getElementById('input-color-translated-stroke');
        this.btnToggleControls = document.getElementById('btn-toggle-controls');
        this.controlsPanel = document.getElementById('controls-panel');
        this.mlxSettings = document.getElementById('mlx-settings');
        this.inputMlxUrl = document.getElementById('input-mlx-url');
        this.selectMlxMode = document.getElementById('select-mlx-mode');
        this.inputMaxDuration = document.getElementById('input-max-duration');
        this.valMaxDuration = document.getElementById('val-max-duration');
        this.googleSettings = document.getElementById('google-settings');
        this.inputGoogleKey = document.getElementById('input-google-key');
        this.selectAudioSource = document.getElementById('select-audio-source');
        this.selectMicDevice = document.getElementById('select-mic-device');
        this.systemAudioNote = document.getElementById('system-audio-note');
        this.micVisualizer = document.getElementById('mic-visualizer');
        this.micBar = document.getElementById('mic-bar');
        this.checkTts = document.getElementById('check-tts');
        this.loadSettings();
        this.initEventListeners();
        this.initSpeechRecognition();
        this.initDeviceList();
        // Initial fetch of server config to sync slider
        this.fetchServerConfig();
    }
    async fetchServerConfig() {
        try {
            // MLX 固有の動的設定の更新 (既存ロジック)
            if (this.selectEngine.value === 'mlx') {
                const baseUrl = this.inputMlxUrl.value.trim().replace(/\/ws$/, '').replace(/^ws/, 'http');
                const response = await fetch(`${baseUrl}/api/config`);
                if (response.ok) {
                    const config = await response.json();
                    const maxDur = config?.audio?.dynamic_buffer?.max_duration;
                    if (maxDur) {
                        this.inputMaxDuration.value = String(maxDur);
                        this.valMaxDuration.innerText = String(maxDur);
                    }
                }
            }
            // サーバー側の config.yaml / .env から詳細設定を取得
            const fullConfigResponse = await fetch('/api/config/full');
            if (fullConfigResponse.ok) {
                const data = await fullConfigResponse.json();
                if (data.status === 'success' && data.config) {
                    const googleConfig = data.config.models?.translation?.google;
                    // APIキーが空かつサーバー側で設定されている場合のみ自動補完
                    if (googleConfig?.api_key && !this.inputGoogleKey.value) {
                        this.inputGoogleKey.value = googleConfig.api_key;
                        this.inputGoogleKey.placeholder = "Loaded from server .env";
                    }
                }
            }
        }
        catch (e) {
            console.warn('Failed to fetch server config', e);
        }
    }
    loadSettings() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.engine) {
                    this.selectEngine.value = settings.engine;
                    this.updateSettingsVisibility();
                }
                if (settings.lang)
                    this.selectLang.value = settings.lang;
                if (settings.sourceLang)
                    this.selectSourceLang.value = settings.sourceLang;
                if (settings.ollamaUrl)
                    this.inputOllamaUrl.value = settings.ollamaUrl;
                if (settings.ollamaModel)
                    this.inputOllamaModel.value = settings.ollamaModel;
                if (settings.mlxUrl)
                    this.inputMlxUrl.value = settings.mlxUrl;
                if (settings.mlxMode)
                    this.selectMlxMode.value = settings.mlxMode;
                if (settings.audioSource) {
                    this.selectAudioSource.value = settings.audioSource;
                    this.updateAudioSourceUI();
                }
                if (settings.micDevice)
                    this.selectMicDevice.value = settings.micDevice;
                if (settings.googleApiKey)
                    this.inputGoogleKey.value = settings.googleApiKey;
                if (settings.menuHidden) {
                    this.controlsPanel.classList.add('hidden');
                }
                if (settings.fontOriginal) {
                    this.inputFontOriginal.value = settings.fontOriginal;
                    this.originalTextElement.style.fontSize = `${settings.fontOriginal}rem`;
                    this.valFontOriginal.innerText = settings.fontOriginal;
                }
                if (settings.fontTranslated) {
                    this.inputFontTranslated.value = settings.fontTranslated;
                    this.translatedTextElement.style.fontSize = `${settings.fontTranslated}rem`;
                    this.valFontTranslated.innerText = settings.fontTranslated;
                }
                if (settings.colorOriginalFill)
                    this.inputColorOriginalFill.value = settings.colorOriginalFill;
                if (settings.colorOriginalStroke)
                    this.inputColorOriginalStroke.value = settings.colorOriginalStroke;
                if (settings.colorTranslatedFill)
                    this.inputColorTranslatedFill.value = settings.colorTranslatedFill;
                if (settings.colorTranslatedStroke)
                    this.inputColorTranslatedStroke.value = settings.colorTranslatedStroke;
                // Apply colors
                this.updateColorStyles();
                if (settings.ttsEnabled !== undefined) {
                    this.checkTts.checked = settings.ttsEnabled;
                }
            }
            catch (e) {
                console.error('Failed to load settings', e);
            }
        }
        else {
            // Default colors if no settings
            this.updateColorStyles();
        }
    }
    updateColorStyles() {
        if (this.originalTextElement) {
            this.originalTextElement.style.setProperty('--original-fill', this.inputColorOriginalFill.value);
            this.originalTextElement.style.setProperty('--original-stroke', this.inputColorOriginalStroke.value);
        }
        if (this.translatedTextElement) {
            this.translatedTextElement.style.setProperty('--translated-fill', this.inputColorTranslatedFill.value);
            this.translatedTextElement.style.setProperty('--translated-stroke', this.inputColorTranslatedStroke.value);
        }
    }
    saveSettings() {
        const settings = {
            engine: this.selectEngine.value,
            lang: this.selectLang.value,
            sourceLang: this.selectSourceLang.value,
            ollamaUrl: this.inputOllamaUrl.value,
            ollamaModel: this.inputOllamaModel.value,
            mlxUrl: this.inputMlxUrl.value,
            mlxMode: this.selectMlxMode.value,
            fontOriginal: this.inputFontOriginal.value,
            fontTranslated: this.inputFontTranslated.value,
            colorOriginalFill: this.inputColorOriginalFill.value,
            colorOriginalStroke: this.inputColorOriginalStroke.value,
            colorTranslatedFill: this.inputColorTranslatedFill.value,
            colorTranslatedStroke: this.inputColorTranslatedStroke.value,
            audioSource: this.selectAudioSource.value,
            micDevice: this.selectMicDevice.value,
            googleApiKey: this.inputGoogleKey.value,
            menuHidden: this.controlsPanel.classList.contains('hidden'),
            ttsEnabled: this.checkTts.checked
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    }
    initEventListeners() {
        this.btnCapture.addEventListener('click', () => this.startCapture());
        this.btnSpeech.addEventListener('click', () => this.toggleSpeech());
        this.btnToggleControls.addEventListener('click', () => this.toggleControls());
        const saveInputs = [
            this.selectEngine,
            this.selectLang,
            this.selectSourceLang,
            this.inputOllamaUrl,
            this.inputOllamaModel,
            this.inputFontOriginal,
            this.inputFontTranslated,
            this.inputColorOriginalFill,
            this.inputColorOriginalStroke,
            this.inputColorTranslatedFill,
            this.inputColorTranslatedStroke,
            this.inputGoogleKey
        ];
        saveInputs.forEach(input => {
            input.addEventListener('change', () => this.saveSettings());
        });
        // Color inputs: live update
        const colorInputs = [
            this.inputColorOriginalFill,
            this.inputColorOriginalStroke,
            this.inputColorTranslatedFill,
            this.inputColorTranslatedStroke
        ];
        colorInputs.forEach(input => {
            input.addEventListener('input', () => this.updateColorStyles());
        });
        // Add listener for Max Duration Slider logic
        this.inputMaxDuration.addEventListener('change', async () => {
            // ... existing slider logic ...
            const val = this.inputMaxDuration.value;
            this.valMaxDuration.innerText = val;
            // ...
            // Simplified to avoid re-writing the whole block as I am inside replace_file_content for a range
            // But wait, I'm replacing the whole block including initEventListeners, so I must include the full logic.
            // I will implement the full logic below as I am replacing the larger block.
            if (this.selectEngine.value === 'mlx') {
                try {
                    const baseUrl = this.inputMlxUrl.value.trim().replace(/\/ws$/, '').replace(/^ws/, 'http');
                    await fetch(`${baseUrl}/api/config/update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            updates: {
                                "audio.dynamic_buffer.max_duration": parseFloat(val)
                            }
                        })
                    });
                    console.log('Updated max_duration to', val);
                }
                catch (e) {
                    console.error('Failed to update config', e);
                }
            }
        });
        this.inputMaxDuration.addEventListener('input', () => {
            this.valMaxDuration.innerText = this.inputMaxDuration.value;
        });
        this.selectEngine.addEventListener('change', () => {
            this.updateSettingsVisibility();
            this.fetchServerConfig();
        });
        this.inputMlxUrl.addEventListener('change', () => this.saveSettings());
        this.selectMlxMode.addEventListener('change', () => this.saveSettings());
        this.inputFontOriginal.addEventListener('input', () => {
            const val = this.inputFontOriginal.value;
            this.originalTextElement.style.fontSize = `${val}rem`;
            this.valFontOriginal.innerText = val;
            this.saveSettings();
        });
        this.inputFontTranslated.addEventListener('input', () => {
            const val = this.inputFontTranslated.value;
            this.translatedTextElement.style.fontSize = `${val}rem`;
            this.valFontTranslated.innerText = val;
            this.saveSettings();
        });
        this.selectAudioSource.addEventListener('change', () => {
            this.updateAudioSourceUI();
            this.saveSettings();
        });
        this.selectMicDevice.addEventListener('change', () => {
            this.saveSettings();
            if (this.isRecognizing) {
                // Restart to apply device (though it primarily affects the visualizer)
                this.startMicVisualizer();
            }
        });
        this.checkTts.addEventListener('change', () => {
            this.saveSettings();
            if (this.selectEngine.value === 'mlx' && this.mlxSocket && this.mlxSocket.readyState === WebSocket.OPEN) {
                this.mlxSocket.send(JSON.stringify({
                    type: 'settings',
                    settings: {
                        tts_enabled: this.checkTts.checked
                    }
                }));
            }
        });
    }
    updateSettingsVisibility() {
        const engine = this.selectEngine.value;
        this.ollamaSettings.style.display = engine === 'ollama' ? 'block' : 'none';
        this.mlxSettings.style.display = engine === 'mlx' ? 'block' : 'none';
        this.googleSettings.style.display = engine === 'google' ? 'block' : 'none';
    }
    toggleControls() {
        this.controlsPanel.classList.toggle('hidden');
        this.saveSettings();
    }
    updateAudioSourceUI() {
        const isSystem = this.selectAudioSource.value === 'system';
        this.systemAudioNote.style.display = isSystem ? 'block' : 'none';
        document.getElementById('mic-device-setting').style.display = isSystem ? 'none' : 'block';
    }
    async initDeviceList() {
        try {
            // Request permission to list devices labels
            await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => { });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            this.selectMicDevice.innerHTML = '<option value="default">規定のデバイス</option>';
            audioDevices.forEach(device => {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.text = device.label || `マイク ${this.selectMicDevice.length}`;
                this.selectMicDevice.appendChild(opt);
            });
        }
        catch (err) {
            console.warn('Failed to enumerate devices', err);
        }
    }
    async startCapture() {
        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: "window",
                },
                audio: true
            });
            this.videoElement.srcObject = this.stream;
            this.updateStatus('active', '画面をキャプチャ中');
            // If audio source is system, start visualizer with the capture stream
            if (this.selectAudioSource.value === 'system' && this.stream.getAudioTracks().length > 0) {
                this.startMicVisualizer(this.stream);
            }
            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.onended = () => {
                    this.updateStatus('inactive', '準備完了');
                    this.videoElement.srcObject = null;
                    if (this.selectAudioSource.value === 'system') {
                        this.stopMicVisualizer();
                    }
                };
            }
        }
        catch (err) {
            console.error("Error capturing screen: ", err);
            alert("画面キャプチャに失敗しました。");
        }
    }
    initSpeechRecognition() {
        const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!RecognitionClass) {
            this.updateStatus('error', 'お使いのブラウザは音声認識非対応です');
            this.btnSpeech.disabled = true;
            return;
        }
        this.recognition = new RecognitionClass();
        if (this.recognition) {
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'ja-JP';
            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    if (result && result[0]) {
                        if (result.isFinal) {
                            finalTranscript += result[0].transcript;
                        }
                        else {
                            interimTranscript += result[0].transcript;
                        }
                    }
                }
                const currentText = finalTranscript || interimTranscript;
                if (currentText && currentText !== this.lastTranslatedText) {
                    this.originalTextElement.innerText = currentText;
                    this.adjustFontSize(this.originalTextElement, currentText, 'original');
                    // Only translate if it's the final transcript or if we haven't translated in a while
                    // To prevent overwhelming Ollama
                    if (finalTranscript || !this.isTranslating) {
                        this.translateText(currentText);
                        if (finalTranscript) {
                            this.lastTranslatedText = finalTranscript;
                        }
                    }
                }
            };
            this.recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                if (event.error === 'not-allowed') {
                    this.updateStatus('error', 'マイクの使用が許可されていません');
                }
            };
            this.recognition.onend = () => {
                if (this.isRecognizing && this.recognition) {
                    try {
                        this.recognition.start();
                    }
                    catch (e) {
                        // Already started or other error
                    }
                }
            };
        }
    }
    toggleSpeech() {
        const engine = this.selectEngine.value;
        if (this.isRecognizing) {
            if (engine === 'mlx') {
                this.stopMlxRecognition();
            }
            else {
                this.stopSpeech();
            }
        }
        else {
            if (engine === 'mlx') {
                this.startMlxRecognition();
            }
            else {
                this.startSpeech();
            }
        }
    }
    startSpeech() {
        if (!this.recognition)
            return;
        try {
            this.recognition.lang = this.selectSourceLang.value === 'ja' ? 'ja-JP' : (this.selectSourceLang.value === 'en' ? 'en-US' : this.selectSourceLang.value);
            this.recognition.start();
            this.isRecognizing = true;
            this.setRecognitionUIActive(true);
            this.updateStatus('active', '音声認識中...');
            // Only start mic visualizer if we are NOT in system audio mode 
            // OR if we don't have a capture stream yet
            if (this.selectAudioSource.value === 'mic' || !this.stream) {
                this.startMicVisualizer();
            }
        }
        catch (e) {
            console.error('Failed to start recognition', e);
        }
    }
    stopSpeech() {
        if (!this.recognition)
            return;
        this.recognition.stop();
        this.isRecognizing = false;
        this.setRecognitionUIActive(false);
        this.updateStatus('active', this.stream ? '画面キャプチャ中' : '準備完了');
        this.stopMicVisualizer();
    }
    setRecognitionUIActive(active) {
        if (active === true) {
            this.btnSpeech.innerHTML = '<span class="icon">⏹️</span> 停止';
            this.btnSpeech.classList.add('active');
            this.btnSpeech.disabled = false;
        }
        else if (active === 'connecting') {
            this.btnSpeech.innerHTML = '<span class="icon">⌛</span> 接続中...';
            this.btnSpeech.classList.add('active');
            this.btnSpeech.disabled = true;
        }
        else {
            this.btnSpeech.innerHTML = '<span class="icon">🎤</span> 音声認識開始';
            this.btnSpeech.classList.remove('active');
            this.btnSpeech.disabled = false;
        }
    }
    startMlxRecognition() {
        const url = this.inputMlxUrl.value.trim();
        const mode = this.selectMlxMode.value;
        const sourceLang = this.selectSourceLang.value;
        const targetLang = this.selectLang.value;
        console.log(`Connecting to MLX Server: ${url}`);
        this.updateStatus('active', 'MLX サーバー接続中...');
        this.setRecognitionUIActive('connecting');
        try {
            this.mlxSocket = new WebSocket(url);
            this.mlxSocket.onopen = () => {
                console.log('MLX WebSocket connected');
                this.isRecognizing = true;
                this.setRecognitionUIActive(true);
                this.updateStatus('active', 'MLX 音声認識実行中...');
                // Send start command
                this.mlxSocket?.send(JSON.stringify({
                    type: 'start',
                    settings: {
                        mode: mode,
                        source_lang: sourceLang,
                        target_lang: targetLang,
                        tts_enabled: this.checkTts.checked
                    }
                }));
            };
            this.mlxSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'recognized') {
                    this.originalTextElement.innerText = data.text;
                    this.adjustFontSize(this.originalTextElement, data.text, 'original');
                }
                else if (data.type === 'translated') {
                    this.translatedTextElement.innerText = data.text;
                    this.adjustFontSize(this.translatedTextElement, data.text, 'translated');
                    if (data.source_text) {
                        this.originalTextElement.innerText = data.source_text;
                        this.adjustFontSize(this.originalTextElement, data.source_text, 'original');
                    }
                }
                else if (data.type === 'status') {
                    console.log('MLX Status:', data.message);
                }
                else if (data.type === 'error') {
                    this.updateStatus('error', `MLX エラー: ${data.message}`);
                }
            };
            this.mlxSocket.onclose = () => {
                console.log('MLX WebSocket closed');
                if (this.isRecognizing) {
                    this.stopMlxRecognition();
                }
            };
            this.mlxSocket.onerror = (err) => {
                console.error('MLX WebSocket error', err);
                this.updateStatus('error', 'MLX 接続エラー');
                this.stopMlxRecognition();
            };
        }
        catch (err) {
            console.error('Failed to connect to MLX', err);
            this.updateStatus('error', 'MLX 接続失敗');
            this.setRecognitionUIActive(false);
        }
    }
    stopMlxRecognition() {
        if (this.mlxSocket) {
            if (this.mlxSocket.readyState === WebSocket.OPEN) {
                this.mlxSocket.send(JSON.stringify({ type: 'stop' }));
            }
            this.mlxSocket.close();
            this.mlxSocket = null;
        }
        this.isRecognizing = false;
        this.setRecognitionUIActive(false);
        this.updateStatus('active', this.stream ? '画面キャプチャ中' : '準備完了');
    }
    async startMicVisualizer(externalStream = null) {
        this.stopMicVisualizer();
        this.micVisualizer.classList.add('active');
        try {
            let mediaStream;
            if (externalStream) {
                mediaStream = externalStream;
            }
            else {
                const constraints = {
                    audio: this.selectMicDevice.value !== 'default'
                        ? { deviceId: { exact: this.selectMicDevice.value } }
                        : true
                };
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                this.micStream = mediaStream;
            }
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioContext = audioContext;
            const source = audioContext.createMediaStreamSource(mediaStream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            this.analyser = analyser;
            source.connect(analyser);
            const freqDataArray = new Uint8Array(analyser.frequencyBinCount);
            const animate = () => {
                const currentAnalyser = this.analyser;
                if (!currentAnalyser || !this.micVisualizer.classList.contains('active'))
                    return;
                currentAnalyser.getByteFrequencyData(freqDataArray);
                let sum = 0;
                sum = freqDataArray.reduce((p, c) => p + c, 0);
                const average = sum / freqDataArray.length;
                const volume = Math.min(100, (average / 128) * 100);
                this.micBar.style.width = `${volume}%`;
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        }
        catch (err) {
            console.error('Visualizer error:', err);
        }
    }
    stopMicVisualizer() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.micBar.style.width = '0%';
        this.micVisualizer.classList.remove('active');
    }
    async translateText(text) {
        const engine = this.selectEngine.value;
        const targetLang = this.selectLang.value;
        if (engine === 'ollama') {
            await this.translateWithOllama(text, targetLang);
        }
        else if (engine === 'google') {
            await this.translateWithGoogle(text, targetLang);
        }
        else {
            // Mock translation
            if (engine === 'mock') {
                this.translatedTextElement.innerText = `[${targetLang.toUpperCase()}] ${text}`;
            }
            // For 'mlx', we don't update translatedTextElement here as it comes via WebSocket
        }
    }
    async translateWithGoogle(text, targetLang) {
        const apiKey = this.inputGoogleKey.value.trim();
        if (!apiKey) {
            this.translatedTextElement.innerText = '(Google APIキーが未設定です)';
            return;
        }
        if (this.translationAbortController) {
            this.translationAbortController.abort();
        }
        this.translationAbortController = new AbortController();
        this.isTranslating = true;
        try {
            const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: targetLang
                }),
                signal: this.translationAbortController.signal
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error?.message || 'Unknown error');
            }
            const data = await response.json();
            const translatedText = data.data.translations[0].translatedText;
            // Unescape HTML entities
            const textArea = document.createElement('textarea');
            textArea.innerHTML = translatedText;
            const unescapedText = textArea.value;
            this.translatedTextElement.innerText = unescapedText;
            this.adjustFontSize(this.translatedTextElement, unescapedText, 'translated');
        }
        catch (err) {
            if (err.name === 'AbortError')
                return;
            console.error('Google Translate Error:', err);
            this.translatedTextElement.innerText = `(Google翻訳エラー: ${err.message})`;
        }
        finally {
            this.isTranslating = false;
        }
    }
    async translateWithOllama(text, targetLang) {
        const baseUrl = this.inputOllamaUrl.value.trim().replace(/\/$/, '');
        const model = this.inputOllamaModel.value.trim();
        // Cancel previous request if still running
        if (this.translationAbortController) {
            this.translationAbortController.abort();
        }
        this.translationAbortController = new AbortController();
        const langNames = {
            'en': 'English',
            'ja': 'Japanese',
            'zh': 'Chinese',
            'ko': 'Korean'
        };
        const prompt = `Translate the following text to ${langNames[targetLang] || targetLang}. Output ONLY the translated text without any explanations or extra words.\nText: ${text}`;
        this.isTranslating = true;
        try {
            const response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false
                }),
                signal: this.translationAbortController.signal
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const serverError = errorData.error || 'Unknown error';
                if (serverError.includes('llama runner process has terminated') ||
                    serverError.includes('Metal') ||
                    serverError.includes('EOF') ||
                    serverError.includes('load request')) {
                    this.updateStatus('error', 'Ollama モデル読込エラー');
                    throw new Error(`Ollama Metal/Load Error: モデルのロードに失敗しました。Macのメモリ不足か、Ollamaエンジンの互換性エラーです。モデルを軽量なものにするか、Ollamaを一度終了して再起動してください。`);
                }
                throw new Error(`Ollama Error (${response.status}): ${serverError}`);
            }
            const data = await response.json();
            const translatedText = data.response.trim();
            this.translatedTextElement.innerText = translatedText;
        }
        catch (err) {
            if (err.name === 'AbortError')
                return;
            console.error('Ollama Error:', err);
            let errorMessage = `(Ollama エラー: ${err.message})`;
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                errorMessage = '(Ollama に接続できません。CORS設定または起動状態を確認してください)';
                this.updateStatus('error', 'Ollama 接続エラー');
            }
            else if (err.message.includes('terminated') ||
                err.message.includes('Metal') ||
                err.message.includes('EOF') ||
                err.message.includes('Load Error')) {
                errorMessage = '(Ollama モデルエラー: モデルがクラッシュまたはロードに失敗しました。軽量なモデルへの変更や、Ollamaの再起動を試してください)';
                this.updateStatus('error', 'Ollama モデル読込エラー');
            }
            this.translatedTextElement.innerText = errorMessage;
        }
        finally {
            this.isTranslating = false;
        }
    }
    updateStatus(type, message) {
        this.statusMessage.innerText = message;
        this.statusDot.className = 'dot';
        if (type === 'active') {
            this.statusDot.classList.add('active');
        }
        else if (type === 'error') {
            this.statusDot.style.background = '#ff4b4b';
        }
    }
    /**
     * Automatically adjust font size based on text length
     * @param element The text element to adjust
     * @param text The text content
     * @param type 'original' or 'translated'
     */
    adjustFontSize(element, text, type) {
        if (!this.autoFontSizeEnabled || !text) {
            return;
        }
        const textLength = text.length;
        const baseFontSize = type === 'original' ? this.ORIGINAL_BASE_FONT_SIZE : this.TRANSLATED_BASE_FONT_SIZE;
        const maxChars = type === 'original' ? this.MAX_CHARS_ORIGINAL : this.MAX_CHARS_TRANSLATED;
        // Calculate scale factor based on text length
        let fontSize = baseFontSize;
        if (textLength > maxChars) {
            // Reduce font size proportionally when text exceeds max chars
            const scaleFactor = Math.sqrt(maxChars / textLength);
            fontSize = Math.max(this.MIN_FONT_SIZE, baseFontSize * scaleFactor);
        }
        element.style.fontSize = `${fontSize}rem`;
    }
}
// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    new TranslateApp();
});
//# sourceMappingURL=main.js.map