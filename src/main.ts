// Types for Web Speech API
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: any) => void;
    onend: () => void;
}

class TranslateApp {
    private videoElement: HTMLVideoElement;
    private subtitleOverlay: HTMLElement;
    private btnCapture: HTMLButtonElement;
    private btnSpeech: HTMLButtonElement;
    private statusDot: HTMLElement;
    private statusMessage: HTMLElement;
    private selectLang: HTMLSelectElement;
    private selectSourceLang: HTMLSelectElement;
    private selectEngine: HTMLSelectElement;
    private ollamaSettings: HTMLElement;
    private inputOllamaUrl: HTMLInputElement;
    private inputOllamaModel: HTMLInputElement;
    private inputFontOriginal: HTMLInputElement;
    private inputFontTranslated: HTMLInputElement;
    private valFontOriginal: HTMLElement;
    private valFontTranslated: HTMLElement;

    private inputColorOriginalFill: HTMLInputElement;
    private inputColorOriginalStroke: HTMLInputElement;
    private inputColorTranslatedFill: HTMLInputElement;
    private inputColorTranslatedStroke: HTMLInputElement;

    private inputMaxPairs: HTMLInputElement;
    private valMaxPairs: HTMLElement;

    private inputOverlayBottom: HTMLInputElement;
    private valOverlayBottom: HTMLElement;

    private mlxSettings: HTMLElement;
    private inputMlxUrl: HTMLInputElement;
    private selectMlxMode: HTMLSelectElement;
    private inputMaxDuration: HTMLInputElement;
    private valMaxDuration: HTMLElement;
    private googleSettings: HTMLElement;
    private inputGoogleKey: HTMLInputElement;
    private deepgramSettings: HTMLElement;
    private inputDeepgramKey: HTMLInputElement;
    private checkTts: HTMLInputElement;
    private checkSplitView: HTMLInputElement;

    private btnToggleControls: HTMLButtonElement;
    private btnToggleHistory: HTMLButtonElement;
    private controlsPanel: HTMLElement;
    private topicHistoryPanel: HTMLElement;
    private historyList: HTMLElement;

    private selectVideoSource: HTMLSelectElement;
    private selectVideoDevice: HTMLSelectElement;
    private videoDeviceSetting: HTMLElement;
    private selectAudioSource: HTMLSelectElement;
    private selectMicDevice: HTMLSelectElement;
    private systemAudioNote: HTMLElement;
    private micVisualizer: HTMLElement;
    private micBar: HTMLElement;

    private recognition: SpeechRecognition | null = null;
    private isRecognizing: boolean = false;
    private stream: MediaStream | null = null;
    private micStream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private animationId: number | null = null;
    private lastTranslatedText: string = '';
    private lastDetectionTime: number = 0; // Throttle detection
    private translationAbortController: AbortController | null = null;

    private autoFontSizeEnabled: boolean = true;
    private originalBaseFontSize = 1.5; // rem
    private translatedBaseFontSize = 2.5; // rem
    private readonly MIN_FONT_SIZE = 0.8; // rem
    private readonly MAX_CHARS_ORIGINAL = 100;
    private readonly MAX_CHARS_TRANSLATED = 80;
    private isTranslating: boolean = false;
    private currentTranslationRequestID: number = 0;
    private lastInterimTranslationTime: number = 0;
    private readonly INTERIM_TRANSLATION_THROTTLE_MS = 800;

    private mlxSocket: WebSocket | null = null;

    // Background Color Sampling
    private colorSampleInterval: number | null = null;
    private sampleCanvas: HTMLCanvasElement;
    private sampleCtx: CanvasRenderingContext2D | null;

    private STORAGE_KEY = 'translate_app_settings';
    private ollamaModelList: HTMLDataListElement;

    constructor() {
        this.videoElement = document.getElementById('display-video') as HTMLVideoElement;
        this.subtitleOverlay = document.getElementById('subtitle-overlay') as HTMLElement;
        this.btnCapture = document.getElementById('btn-capture') as HTMLButtonElement;
        this.btnSpeech = document.getElementById('btn-speech') as HTMLButtonElement;
        this.statusDot = document.getElementById('status-dot') as HTMLElement;
        this.statusMessage = document.getElementById('status-message') as HTMLElement;

        this.selectLang = document.getElementById('select-lang') as HTMLSelectElement;
        this.selectSourceLang = document.getElementById('select-source-lang') as HTMLSelectElement;
        this.selectEngine = document.getElementById('select-engine') as HTMLSelectElement;
        this.ollamaSettings = document.getElementById('ollama-settings') as HTMLElement;
        this.inputOllamaUrl = document.getElementById('input-ollama-url') as HTMLInputElement;
        this.inputOllamaModel = document.getElementById('input-ollama-model') as HTMLInputElement;

        this.inputFontOriginal = document.getElementById('input-font-original') as HTMLInputElement;
        this.inputFontTranslated = document.getElementById('input-font-translated') as HTMLInputElement;
        this.valFontOriginal = document.getElementById('val-font-original') as HTMLElement;
        this.valFontTranslated = document.getElementById('val-font-translated') as HTMLElement;

        this.inputColorOriginalFill = document.getElementById('input-color-original-fill') as HTMLInputElement;
        this.inputColorOriginalStroke = document.getElementById('input-color-original-stroke') as HTMLInputElement;
        this.inputColorTranslatedFill = document.getElementById('input-color-translated-fill') as HTMLInputElement;
        this.inputColorTranslatedStroke = document.getElementById('input-color-translated-stroke') as HTMLInputElement;

        this.inputMaxPairs = document.getElementById('input-max-pairs') as HTMLInputElement;
        this.valMaxPairs = document.getElementById('val-max-pairs') as HTMLElement;

        this.btnToggleControls = document.getElementById('btn-toggle-controls') as HTMLButtonElement;
        this.btnToggleHistory = document.getElementById('btn-toggle-history') as HTMLButtonElement;
        this.controlsPanel = document.getElementById('controls-panel') as HTMLElement;
        this.topicHistoryPanel = document.getElementById('topic-history') as HTMLElement;
        this.historyList = document.getElementById('history-list') as HTMLElement;

        this.mlxSettings = document.getElementById('mlx-settings') as HTMLElement;
        this.inputMlxUrl = document.getElementById('input-mlx-url') as HTMLInputElement;
        this.selectMlxMode = document.getElementById('select-mlx-mode') as HTMLSelectElement;
        this.inputMaxDuration = document.getElementById('input-max-duration') as HTMLInputElement;
        this.valMaxDuration = document.getElementById('val-max-duration') as HTMLElement;

        this.googleSettings = document.getElementById('google-settings') as HTMLElement;
        this.inputGoogleKey = document.getElementById('input-google-key') as HTMLInputElement;

        this.deepgramSettings = document.getElementById('deepgram-settings') as HTMLElement;
        this.inputDeepgramKey = document.getElementById('input-deepgram-key') as HTMLInputElement;

        this.selectVideoSource = document.getElementById('select-video-source') as HTMLSelectElement;
        this.selectVideoDevice = document.getElementById('select-video-device') as HTMLSelectElement;
        this.videoDeviceSetting = document.getElementById('video-device-setting') as HTMLElement;
        this.selectAudioSource = document.getElementById('select-audio-source') as HTMLSelectElement;
        this.selectMicDevice = document.getElementById('select-mic-device') as HTMLSelectElement;
        this.systemAudioNote = document.getElementById('system-audio-note') as HTMLElement;
        this.micVisualizer = document.getElementById('mic-visualizer') as HTMLElement;
        this.micBar = document.getElementById('mic-bar') as HTMLElement;
        this.checkTts = document.getElementById('check-tts') as HTMLInputElement;
        this.checkSplitView = document.getElementById('check-split-view') as HTMLInputElement;

        this.inputOverlayBottom = document.getElementById('input-overlay-bottom') as HTMLInputElement;
        this.valOverlayBottom = document.getElementById('val-overlay-bottom') as HTMLElement;
        this.ollamaModelList = document.getElementById('ollama-model-list') as HTMLDataListElement;

        this.sampleCanvas = document.createElement('canvas');
        this.sampleCanvas.width = 100;
        this.sampleCanvas.height = 30; // Aspect ratio reflecting the bottom portion of the screen
        this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });

        this.loadSettings();
        this.initEventListeners();
        this.initSpeechRecognition();
        this.initDeviceList();

        // Initial fetch of server config to sync slider (with slight delay)
        setTimeout(() => {
            this.fetchServerConfig();
            this.fetchOllamaModels();
        }, 1000);
    }

    private async fetchServerConfig() {
        try {
            // MLX 固有の動的設定の更新 (既存ロジック)
            if (this.selectEngine.value === 'mlx' || this.selectEngine.value === 'deepgram') {
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
            const baseUrl = this.inputMlxUrl.value.trim().replace(/\/ws$/, '').replace(/^ws/, 'http');
            const fullConfigResponse = await fetch(`${baseUrl}/api/config/full`);
            if (fullConfigResponse.ok) {
                const contentType = fullConfigResponse.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await fullConfigResponse.json();
                    if (data.status === 'success' && data.config) {
                        const googleConfig = data.config.models?.translation?.google;
                        // APIキーが空かつサーバー側で設定されている場合のみ自動補完
                        if (googleConfig?.api_key && !this.inputGoogleKey.value) {
                            this.inputGoogleKey.value = googleConfig.api_key;
                            this.inputGoogleKey.placeholder = "Loaded from server .env";
                        }
                        
                        const deepgramConfig = data.config.models?.asr?.deepgram;
                        if (deepgramConfig?.api_key && !this.inputDeepgramKey.value) {
                            this.inputDeepgramKey.value = deepgramConfig.api_key;
                            this.inputDeepgramKey.placeholder = "Loaded from server .env";
                        }
                    }
                }
            }
        } catch (e: any) {
            // Ignore normal "Failed to fetch" errors that happen when the backend is offline
            if (e.name !== 'TypeError' || e.message !== 'Failed to fetch') {
                console.warn('Failed to fetch server config', e);
            }
        }
    }

    private loadSettings() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.engine) {
                    this.selectEngine.value = settings.engine;
                    this.updateSettingsVisibility();
                }
                if (settings.lang) this.selectLang.value = settings.lang;
                if (settings.sourceLang) this.selectSourceLang.value = settings.sourceLang;
                if (settings.ollamaUrl) this.inputOllamaUrl.value = settings.ollamaUrl;
                if (settings.ollamaModel) this.inputOllamaModel.value = settings.ollamaModel;
                if (settings.mlxUrl) this.inputMlxUrl.value = settings.mlxUrl;
                if (settings.mlxMode) this.selectMlxMode.value = settings.mlxMode;
                if (settings.videoSource) {
                    this.selectVideoSource.value = settings.videoSource;
                    this.updateVideoSourceUI();
                }
                if (settings.videoDevice) this.selectVideoDevice.value = settings.videoDevice;
                if (settings.audioSource) {
                    this.selectAudioSource.value = settings.audioSource;
                    this.updateAudioSourceUI();
                }
                if (settings.micDevice) this.selectMicDevice.value = settings.micDevice;
                if (settings.googleApiKey) this.inputGoogleKey.value = settings.googleApiKey;
                if (settings.deepgramApiKey) this.inputDeepgramKey.value = settings.deepgramApiKey;

                if (settings.maxPairs) {
                    this.inputMaxPairs.value = settings.maxPairs;
                    this.valMaxPairs.innerText = settings.maxPairs;
                } else {
                    // Default to 2
                    this.inputMaxPairs.value = "2";
                    this.valMaxPairs.innerText = "2";
                }

                if (settings.menuHidden) {
                    this.controlsPanel.classList.add('hidden');
                }

                if (settings.historyHidden) {
                    this.topicHistoryPanel.classList.add('hidden');
                }
                this.checkTts.checked = settings.ttsEnabled !== false;
                this.checkSplitView.checked = settings.splitViewEnabled === true;
                this.updateSplitViewUI();
                if (settings.selectEngine) this.selectEngine.value = settings.selectEngine;

                if (settings.fontOriginal) {
                    this.inputFontOriginal.value = settings.fontOriginal;
                    this.originalBaseFontSize = parseFloat(settings.fontOriginal);
                    this.subtitleOverlay.style.setProperty('--original-font-size', `${settings.fontOriginal}rem`);
                    this.valFontOriginal.innerText = settings.fontOriginal;
                }
                if (settings.fontTranslated) {
                    this.inputFontTranslated.value = settings.fontTranslated;
                    this.translatedBaseFontSize = parseFloat(settings.fontTranslated);
                    this.subtitleOverlay.style.setProperty('--translated-font-size', `${settings.fontTranslated}rem`);
                    this.valFontTranslated.innerText = settings.fontTranslated;
                }

                if (settings.colorOriginalFill) this.inputColorOriginalFill.value = settings.colorOriginalFill;
                if (settings.colorOriginalStroke) this.inputColorOriginalStroke.value = settings.colorOriginalStroke;
                if (settings.colorTranslatedFill) this.inputColorTranslatedFill.value = settings.colorTranslatedFill;
                if (settings.colorTranslatedStroke) this.inputColorTranslatedStroke.value = settings.colorTranslatedStroke;

                if (settings.overlayBottom) {
                    this.inputOverlayBottom.value = settings.overlayBottom;
                    this.valOverlayBottom.innerText = settings.overlayBottom;
                    const valStr = `${settings.overlayBottom}%`;
                    this.subtitleOverlay.style.setProperty('--overlay-bottom', valStr);
                    this.subtitleOverlay.style.maxHeight = valStr;
                } else {
                    // Default 20%
                    this.inputOverlayBottom.value = "20";
                    this.valOverlayBottom.innerText = "20";
                    this.subtitleOverlay.style.setProperty('--overlay-bottom', "20%");
                    this.subtitleOverlay.style.maxHeight = "20%";
                }

                // Apply colors
                this.updateColorStyles();
            } catch (e) {
                console.error('Failed to load settings', e);
            }
        } else {
            // Default colors if no settings
            this.updateColorStyles();
        }
    }

    private updateColorStyles() {
        if (this.subtitleOverlay) {
            this.subtitleOverlay.style.setProperty('--original-fill', this.inputColorOriginalFill.value);
            this.subtitleOverlay.style.setProperty('--original-stroke', this.inputColorOriginalStroke.value);
            this.subtitleOverlay.style.setProperty('--translated-fill', this.inputColorTranslatedFill.value);
            this.subtitleOverlay.style.setProperty('--translated-stroke', this.inputColorTranslatedStroke.value);
        }
    }

    private truncateText(text: string): string {
        if (!text) return "";
        const limit = parseInt(this.inputMaxPairs.value) || 2;
        
        // 1. Try splitting by sentence terminators
        let segments = (text.match(/[^。\.\?\!\n]+[。\.\?\!\n]?/g) || [text]) as string[];
        
        // 2. If we have too few segments but the text is long, split by char count to respect "Display Limit"
        if (segments.length < limit && text.length > 50 * limit) {
             const chunkSize = Math.floor(text.length / limit) || 50;
             segments = [];
             for (let i = 0; i < text.length; i += chunkSize) {
                 segments.push(text.slice(i, i + chunkSize));
             }
        }
        
        if (segments.length > limit) {
             segments = segments.slice(-limit);
        }
        
        let result = segments.join("").trim();
        
        // 3. Final character limit safety valve
        const charLimit = 80 * limit; 
        if (result.length > charLimit) {
            result = "..." + result.slice(-charLimit);
        }
        return result;
    }

    private getOrCreateCurrentSubtitlePair() {
        let pair = this.subtitleOverlay.querySelector('.subtitle-pair.current') as HTMLElement;
        if (!pair) {
            pair = document.createElement('div');
            pair.className = 'subtitle-pair';
            if (this.checkSplitView.checked) {
                pair.classList.add('split');
            }
            pair.classList.add('current');

            const orig = document.createElement('div');
            orig.className = 'text-original';

            const trans = document.createElement('div');
            trans.className = 'text-translated';

            pair.appendChild(orig);
            pair.appendChild(trans);

            this.subtitleOverlay.appendChild(pair);
        }
        return {
            pair,
            orig: pair.querySelector('.text-original') as HTMLElement,
            trans: pair.querySelector('.text-translated') as HTMLElement
        };
    }

    private commitCurrentSubtitle() {
        const current = this.subtitleOverlay.querySelector('.subtitle-pair.current');
        if (current) {
            current.classList.remove('current');

            // Limit stack to prevent DOM/screen overflow
            const limit = parseInt(this.inputMaxPairs.value) || 2;
            while (this.subtitleOverlay.children.length > limit) {
                this.subtitleOverlay.firstChild?.remove();
            }
        }
    }

    private saveSettings() {
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
            videoSource: this.selectVideoSource.value,
            videoDevice: this.selectVideoDevice.value,
            googleApiKey: this.inputGoogleKey.value,
            deepgramApiKey: this.inputDeepgramKey.value,
            maxPairs: this.inputMaxPairs.value,
            menuHidden: this.controlsPanel.classList.contains('hidden'),
            historyHidden: this.topicHistoryPanel.classList.contains('hidden'),
            ttsEnabled: this.checkTts.checked,
            splitViewEnabled: this.checkSplitView.checked,
            overlayBottom: this.inputOverlayBottom.value
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    }

    private initEventListeners() {
        this.btnCapture.addEventListener('click', () => this.startCapture());
        this.btnSpeech.addEventListener('click', () => this.toggleSpeech());
        this.btnToggleControls.addEventListener('click', () => this.toggleControls());
        this.btnToggleHistory.addEventListener('click', () => this.toggleHistory());

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
            this.inputGoogleKey,
            this.inputDeepgramKey,
            this.inputMaxPairs,
            this.inputMlxUrl,
            this.selectMlxMode,
            this.checkTts,
            this.checkSplitView,
            this.inputMaxDuration,
            this.inputOverlayBottom,
            this.selectAudioSource,
            this.selectMicDevice,
            this.selectVideoSource,
            this.selectVideoDevice
        ];

        saveInputs.forEach(input => {
            input.addEventListener('change', () => this.saveSettings());
        });

        this.selectAudioSource.addEventListener('change', () => this.updateAudioSourceUI());
        this.selectVideoSource.addEventListener('change', () => this.updateVideoSourceUI());

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
            const val = this.inputMaxDuration.value;
            this.valMaxDuration.innerText = val;
            if (this.selectEngine.value === 'mlx' || this.selectEngine.value === 'deepgram') {
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
                } catch (e) {
                    console.error('Failed to update config', e);
                }
            }
        });
        this.inputMaxDuration.addEventListener('input', () => {
            this.valMaxDuration.innerText = this.inputMaxDuration.value;
        });

        this.inputMaxPairs.addEventListener('input', () => {
            this.valMaxPairs.innerText = this.inputMaxPairs.value;
            // Immediate cleanup if limit is reduced
            const limit = parseInt(this.inputMaxPairs.value) || 2;
            while (this.subtitleOverlay.children.length > limit) {
                const first = this.subtitleOverlay.firstChild as HTMLElement;
                if (first && !first.classList.contains('current')) {
                    first.remove();
                } else {
                    break;
                }
            }
        });

        this.inputOverlayBottom.addEventListener('input', () => {
            const val = this.inputOverlayBottom.value;
            this.valOverlayBottom.innerText = val;
            const valStr = `${val}%`;
            this.subtitleOverlay.style.setProperty('--overlay-bottom', valStr);
            this.subtitleOverlay.style.maxHeight = valStr;
            this.saveSettings();
        });

        this.checkSplitView.addEventListener('change', () => {
            this.updateSplitViewUI();
            this.saveSettings();
        });

        this.selectSourceLang.addEventListener('change', () => {
            this.updateSettingsVisibility();
            this.fetchServerConfig();
        });

        this.selectEngine.addEventListener('change', () => {
            this.updateSettingsVisibility();
            this.fetchServerConfig();
        });

        this.inputMlxUrl.addEventListener('change', () => this.saveSettings());
        this.selectMlxMode.addEventListener('change', () => this.saveSettings());

        this.inputFontOriginal.addEventListener('input', () => {
            const val = this.inputFontOriginal.value;
            this.originalBaseFontSize = parseFloat(val);
            this.subtitleOverlay.style.setProperty('--original-font-size', `${val}rem`);
            this.valFontOriginal.innerText = val;
            
            // Apply font size change to all existing original text elements
            this.subtitleOverlay.querySelectorAll('.text-original').forEach((el) => {
                this.adjustFontSize(el as HTMLElement, el.textContent || "", 'original');
            });
            
            this.saveSettings();
        });

        this.inputFontTranslated.addEventListener('input', () => {
            const val = this.inputFontTranslated.value;
            this.translatedBaseFontSize = parseFloat(val);
            this.subtitleOverlay.style.setProperty('--translated-font-size', `${val}rem`);
            this.valFontTranslated.innerText = val;
            
            // Apply font size change to all existing translated text elements
            this.subtitleOverlay.querySelectorAll('.text-translated').forEach((el) => {
                this.adjustFontSize(el as HTMLElement, el.textContent || "", 'translated');
            });
            
            this.saveSettings();
        });

        this.selectAudioSource.addEventListener('change', () => {
            this.updateAudioSourceUI();
            this.saveSettings();
        });
        
        this.selectVideoSource.addEventListener('change', () => {
            this.updateVideoSourceUI();
            this.saveSettings();
        });

        this.selectVideoDevice.addEventListener('change', () => {
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
            if ((this.selectEngine.value === 'mlx' || this.selectEngine.value === 'deepgram') && this.mlxSocket && this.mlxSocket.readyState === WebSocket.OPEN) {
                this.mlxSocket.send(JSON.stringify({
                    type: 'settings',
                    settings: {
                        tts_enabled: this.checkTts.checked
                    }
                }));
            }
        });
        
        this.inputOllamaUrl.addEventListener('change', () => {
            this.saveSettings();
            this.fetchOllamaModels();
        });
    }

    private updateSettingsVisibility() {
        const engine = this.selectEngine.value;
        this.ollamaSettings.style.display = engine === 'ollama' ? 'block' : 'none';
        this.mlxSettings.style.display = (engine === 'mlx' || engine === 'deepgram') ? 'block' : 'none';
        this.googleSettings.style.display = engine === 'google' ? 'block' : 'none';
        this.deepgramSettings.style.display = engine === 'deepgram' ? 'block' : 'none';
    }

    private toggleControls() {
        this.controlsPanel.classList.toggle('hidden');
        this.saveSettings();
    }

    private toggleHistory() {
        this.topicHistoryPanel.classList.toggle('hidden');
        this.saveSettings();
    }

    private updateAudioSourceUI() {
        const isSystem = this.selectAudioSource.value === 'system';
        this.systemAudioNote.style.display = isSystem ? 'block' : 'none';
        (document.getElementById('mic-device-setting') as HTMLElement).style.display = isSystem ? 'none' : 'block';
    }

    private updateVideoSourceUI() {
        const isCamera = this.selectVideoSource.value === 'camera';
        this.videoDeviceSetting.style.display = isCamera ? 'block' : 'none';
        this.btnCapture.innerHTML = isCamera ? '<span class="icon">📷</span> カメラ開始' : '<span class="icon">📺</span> 画面キャプチャ開始';
    }

    private async initDeviceList() {
        try {
            // Request permission to list devices labels
            await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => { });
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Audio Devices
            const audioDevices = devices.filter(d => d.kind === 'audioinput');
            this.selectMicDevice.innerHTML = '<option value="default">規定のデバイス</option>';
            audioDevices.forEach(device => {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.text = device.label || `マイク ${this.selectMicDevice.length}`;
                this.selectMicDevice.appendChild(opt);
            });

            // Video Devices
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            this.selectVideoDevice.innerHTML = '<option value="default">規定のカメラ</option>';
            videoDevices.forEach(device => {
                const opt = document.createElement('option');
                opt.value = device.deviceId;
                opt.text = device.label || `カメラ ${this.selectVideoDevice.length}`;
                this.selectVideoDevice.appendChild(opt);
            });
        } catch (err) {
            console.warn('Failed to enumerate devices', err);
        }
    }

    private async startCapture() {
        try {
            const isCamera = this.selectVideoSource.value === 'camera';
            
            if (isCamera) {
                const videoConstraints: MediaTrackConstraints | boolean = this.selectVideoDevice.value !== 'default'
                    ? { deviceId: { exact: this.selectVideoDevice.value } }
                    : true;
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: videoConstraints,
                    audio: false // Audio is handled separately or via another stream
                });
                this.updateStatus('active', 'カメラを使用中');
            } else {
                this.stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: "window",
                    },
                    audio: true
                });
                this.updateStatus('active', '画面をキャプチャ中');
            }

            this.videoElement.srcObject = this.stream;

            // If audio source is system, start visualizer with the capture stream
            if (this.selectAudioSource.value === 'system' && this.stream.getAudioTracks().length > 0) {
                this.startMicVisualizer(this.stream);
            }

            this.startBgColorSampling();

            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.onended = () => {
                    this.updateStatus('inactive', '準備完了');
                    this.videoElement.srcObject = null;
                    if (this.selectAudioSource.value === 'system') {
                        this.stopMicVisualizer();
                    }
                    this.stopBgColorSampling();
                    this.updateColorStyles(); // Revert to user's selected colors
                };
            }
        } catch (err) {
            console.error("Error starting capture: ", err);
            alert("キャプチャの開始に失敗しました。");
        }
    }

    private initSpeechRecognition() {
        const RecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

            this.recognition.onresult = (event: SpeechRecognitionEvent) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const result = event.results[i];
                    if (result && result[0]) {
                        if (result.isFinal) {
                            finalTranscript += result[0].transcript;
                        } else {
                            interimTranscript += result[0].transcript;
                        }
                    }
                }

                const currentText = finalTranscript || interimTranscript;
                if (currentText && currentText !== this.lastTranslatedText) {
                    // Try to detect and swap language direction
                    this.detectAndSwapLanguage(currentText);

                    const { orig, trans } = this.getOrCreateCurrentSubtitlePair();
                    const displayOrig = this.truncateText(currentText);
                    orig.innerText = displayOrig;
                    this.adjustFontSize(orig, displayOrig, 'original');

                    // Translation logic with throttling for interim results
                    const now = Date.now();
                    const shouldTranslateInterim = !finalTranscript && !this.isTranslating && (now - this.lastInterimTranslationTime > this.INTERIM_TRANSLATION_THROTTLE_MS);
                    
                    if (finalTranscript || shouldTranslateInterim) {
                        if (!finalTranscript) {
                            this.lastInterimTranslationTime = now;
                        }
                        this.translateText(displayOrig, trans);
                        if (finalTranscript) {
                            this.lastTranslatedText = finalTranscript;
                            // Trigger keyword extraction via backend API
                            this.triggerBackendKeywordAnalysis(finalTranscript);
                            this.commitCurrentSubtitle();
                        }
                    }
                }
            };

            this.recognition.onerror = (event: any) => {
                console.error("Speech Recognition Error:", event.error);
                if (event.error === 'not-allowed') {
                    this.updateStatus('error', 'マイクの使用が許可されていません');
                }
            };

            this.recognition.onend = () => {
                if (this.isRecognizing && this.recognition) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        // Already started or other error
                    }
                }
            };
        }
    }

    private toggleSpeech() {
        const engine = this.selectEngine.value;

        if (this.isRecognizing) {
            if (engine === 'mlx' || engine === 'deepgram') {
                this.stopMlxRecognition();
            } else {
                this.stopSpeech();
            }
        } else {
            if (engine === 'mlx' || engine === 'deepgram') {
                this.startMlxRecognition();
            } else {
                this.startSpeech();
            }
        }
    }

    private startSpeech() {
        if (!this.recognition) return;
        try {
            this.recognition.lang = this.selectSourceLang.value === 'ja' ? 'ja-JP' : (this.selectSourceLang.value === 'en' ? 'en-US' : this.selectSourceLang.value);
            
            // Clear previous subtitles and reset state
            this.subtitleOverlay.innerHTML = '';
            this.lastTranslatedText = '';
            this.lastDetectionTime = 0;

            this.recognition.start();
            this.isRecognizing = true;
            this.setRecognitionUIActive(true);
            this.updateStatus('active', '音声認識中...');

            // Only start mic visualizer if we are NOT in system audio mode 
            // OR if we don't have a capture stream yet
            if (this.selectAudioSource.value === 'mic' || !this.stream) {
                this.startMicVisualizer();
            }
        } catch (e) {
            console.error('Failed to start recognition', e);
        }
    }

    private stopSpeech() {
        if (!this.recognition) return;
        this.recognition.stop();
        this.isRecognizing = false;
        this.setRecognitionUIActive(false);
        
        let statusMessage = '準備完了';
        if (this.stream) {
            statusMessage = this.selectVideoSource.value === 'camera' ? 'カメラを使用中' : '画面キャプチャ中';
        }
        this.updateStatus('active', statusMessage);
        this.stopMicVisualizer();
    }

    private setRecognitionUIActive(active: boolean | 'connecting') {
        if (active === true) {
            this.btnSpeech.innerHTML = '<span class="icon">⏹️</span> 停止';
            this.btnSpeech.classList.add('active');
            this.btnSpeech.disabled = false;
        } else if (active === 'connecting') {
            this.btnSpeech.innerHTML = '<span class="icon">⌛</span> 接続中...';
            this.btnSpeech.classList.add('active');
            this.btnSpeech.disabled = true;
        } else {
            this.btnSpeech.innerHTML = '<span class="icon">🎤</span> 音声認識開始';
            this.btnSpeech.classList.remove('active');
            this.btnSpeech.disabled = false;
        }
    }

    private startMlxRecognition() {
        const url = this.inputMlxUrl.value.trim();
        const mode = this.selectMlxMode.value;
        const sourceLang = this.selectSourceLang.value;
        const targetLang = this.selectLang.value;
        const asrEngine = this.selectEngine.value;

        console.log(`Connecting to Backend Server: ${url} (Engine: ${asrEngine})`);
        this.updateStatus('active', `${asrEngine === 'deepgram' ? 'Deepgram' : 'MLX'} サーバー接続中...`);
        this.setRecognitionUIActive('connecting');
        
        // Clear previous subtitles and reset state
        this.subtitleOverlay.innerHTML = '';
        this.lastTranslatedText = '';
        this.lastDetectionTime = 0;

        try {
            this.mlxSocket = new WebSocket(url);

            this.mlxSocket.onopen = () => {
                console.log('Backend WebSocket connected');
                this.isRecognizing = true;
                this.setRecognitionUIActive(true);
                this.updateStatus('active', `${asrEngine === 'deepgram' ? 'Deepgram' : 'MLX'} 音声認識実行中...`);

                // Send start command
                this.mlxSocket?.send(JSON.stringify({
                    type: 'start',
                    settings: {
                        mode: mode,
                        source_lang: sourceLang,
                        target_lang: targetLang,
                        tts_enabled: this.checkTts.checked,
                        asr_engine: asrEngine,
                        deepgram_api_key: this.inputDeepgramKey.value.trim(),
                        translation_engine: this.selectEngine.value,
                        ollama_url: this.inputOllamaUrl.value.trim(),
                        ollama_model: this.inputOllamaModel.value.trim()
                    }
                }));
            };

            this.mlxSocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'recognized') {
                    // Try to detect and swap language direction
                    this.detectAndSwapLanguage(data.text);

                    const { orig } = this.getOrCreateCurrentSubtitlePair();
                    const displayOrig = this.truncateText(data.text);
                    orig.innerText = displayOrig;
                    this.adjustFontSize(orig, displayOrig, 'original');
                } else if (data.type === 'translated') {
                    const { orig, trans } = this.getOrCreateCurrentSubtitlePair();
                    const displayTrans = this.truncateText(data.text);
                    trans.innerText = displayTrans;
                    this.adjustFontSize(trans, displayTrans, 'translated');
                    if (data.source_text) {
                        const displayOrig = this.truncateText(data.source_text);
                        orig.innerText = displayOrig;
                        this.adjustFontSize(orig, displayOrig, 'original');
                    }
                    this.commitCurrentSubtitle();
                } else if (data.type === 'keywords') {
                    console.log('Keywords received:', data);
                    this.renderKeywords(data);
                } else if (data.type === 'status') {
                    console.log('Backend Status:', data.message);
                } else if (data.type === 'error') {
                    this.updateStatus('error', `サーバーエラー: ${data.message}`);
                }
            };

            this.mlxSocket.onclose = () => {
                console.log('Backend WebSocket closed');
                if (this.isRecognizing) {
                    this.stopMlxRecognition();
                }
            };

            this.mlxSocket.onerror = (err) => {
                console.log('Backend WebSocket error', err);
                this.updateStatus('error', 'サーバー接続エラー');
                this.stopMlxRecognition();
            };

        } catch (err) {
            console.error('Failed to connect to Backend Server', err);
            this.updateStatus('error', 'サーバー接続失敗');
            this.setRecognitionUIActive(false);
        }
    }

    private stopMlxRecognition() {
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

    private renderKeywords(data: any) {
        if (!this.historyList) {
            console.error('History list element not found');
            return;
        }
        const overlay = document.getElementById('search-overlay');
        const { keywords, articles, images } = data;

        console.log(`Rendering keywords:`, { keywords, articlesCount: articles?.length });

        if (!keywords || keywords.length === 0) return;

        // Clear history placeholder
        const placeholder = this.historyList.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        // --- 1. Create Overlay Item (Temporary Popup) ---
        if (overlay) {
            const item = document.createElement('div');
            item.className = 'search-item';

            const kwHtml = keywords.map((k: string) => `<span class="keyword-badge">${k}</span>`).join('');

            const artHtml = (articles || []).slice(0, 1).map((a: any) => `
                <div class="article-mini">
                    <h4><a href="${a.link}" target="_blank">${a.title}</a></h4>
                    <p>${a.snippet}</p>
                </div>
            `).join('');

            const imgHtml = (images || []).length > 0 ? `
                <div class="image-mini-grid">
                    ${images.map((img: any) => `
                        <div class="image-mini-item" onclick="window.open('${img.url}', '_blank')">
                            <img src="${img.thumbnail || img.image}" alt="">
                        </div>
                    `).join('')}
                </div>
            ` : '';

            item.innerHTML = `
                <div class="keywords-row">${kwHtml}</div>
                ${artHtml}
                ${imgHtml}
            `;

            // Add to overlay
            if (overlay.firstChild) overlay.insertBefore(item, overlay.firstChild);
            else overlay.appendChild(item);

            if (overlay.children.length > 3) {
                const lastChild = overlay.children[overlay.children.length - 1];
                if (lastChild) overlay.removeChild(lastChild);
            }

            // Auto remove from overlay after 15s
            setTimeout(() => {
                if (item.parentNode === overlay) {
                    (item as HTMLElement).style.opacity = '0';
                    (item as HTMLElement).style.transform = 'translateX(-20px)';
                    (item as HTMLElement).style.transition = 'all 0.5s ease';
                    setTimeout(() => {
                        if (item.parentNode === overlay) overlay.removeChild(item);
                    }, 500);
                }
            }, 10000); // 10s for popups
        }

        // --- 2. Create History Item (Persistent List) ---
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        const kwHtmlHist = keywords.map((k: string) => `<span class="keyword-badge">${k}</span>`).join('');
        const firstArt = (articles || []).length > 0 ? articles[0].title : '<span style="opacity:0.5;">(検索結果なし)</span>';

        historyItem.innerHTML = `
            <div style="font-size: 0.7rem; opacity: 0.5; margin-bottom: 5px;">${timeStr}</div>
            <div class="keywords-row">${kwHtmlHist}</div>
            <div style="font-size: 0.8rem; margin-top: 5px; color: rgba(255,255,255,0.7);">
                ${firstArt}
            </div>
        `;

        if (this.historyList.firstChild) this.historyList.insertBefore(historyItem, this.historyList.firstChild);
        else this.historyList.appendChild(historyItem);

        // Limit history to 20 items
        if (this.historyList.children.length > 20) {
            const lastChild = this.historyList.lastChild;
            if (lastChild) this.historyList.removeChild(lastChild);
        }
    }

    private async triggerBackendKeywordAnalysis(text: string) {
        try {
            const baseUrl = this.inputMlxUrl.value.trim().replace(/\/ws$/, '').replace(/^ws/, 'http');
            const lang = this.selectSourceLang.value;

            console.log(`Triggering keyword analysis for: "${text.substring(0, 30)}..." on ${baseUrl}`);

            const resp = await fetch(`${baseUrl}/api/keywords/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    language: lang,
                    pair_id: 'browser-' + Date.now()
                })
            });

            const result = await resp.json();
            console.log('Keyword analysis trigger result:', result);
        } catch (e) {
            console.warn('Failed to trigger keyword analysis (backend might be down or port mismatch)', e);
        }
    }

    private async startMicVisualizer(externalStream: MediaStream | null = null) {
        this.stopMicVisualizer();
        this.micVisualizer.classList.add('active');

        try {
            let mediaStream: MediaStream;

            if (externalStream) {
                mediaStream = externalStream;
            } else {
                const constraints: MediaStreamConstraints = {
                    audio: this.selectMicDevice.value !== 'default'
                        ? { deviceId: { exact: this.selectMicDevice.value } }
                        : true
                };
                mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                this.micStream = mediaStream;
            }

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.audioContext = audioContext;

            const source = audioContext.createMediaStreamSource(mediaStream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            this.analyser = analyser;
            source.connect(analyser);

            const freqDataArray = new Uint8Array(analyser.frequencyBinCount);

            const animate = () => {
                const currentAnalyser = this.analyser;
                if (!currentAnalyser || !this.micVisualizer.classList.contains('active')) return;

                currentAnalyser.getByteFrequencyData(freqDataArray);

                let sum = 0;
                sum = freqDataArray.reduce((p, c) => p + c, 0);
                const average = sum / freqDataArray.length;
                const volume = Math.min(100, (average / 128) * 100);

                this.micBar.style.width = `${volume}%`;
                this.animationId = requestAnimationFrame(animate);
            };

            animate();
        } catch (err) {
            console.error('Visualizer error:', err);
        }
    }

    private stopMicVisualizer() {
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

    private async translateText(text: string, elementToUpdate: HTMLElement) {
        const engine = this.selectEngine.value;
        const targetLang = this.selectLang.value;

        if (engine === 'ollama') {
            await this.translateWithOllama(text, targetLang, elementToUpdate);
        } else if (engine === 'google') {
            await this.translateWithGoogle(text, targetLang, elementToUpdate);
        } else {
            // Mock translation
            if (engine === 'mock') {
                elementToUpdate.innerText = `[${targetLang.toUpperCase()}] ${text}`;
            }
            // For 'mlx', translation is handled by WebSocket
        }
    }

    private async translateWithGoogle(text: string, targetLang: string, elementToUpdate: HTMLElement) {
        const apiKey = this.inputGoogleKey.value.trim();
        if (!apiKey) {
            elementToUpdate.innerText = '(Google APIキーが未設定です)';
            return;
        }

        if (this.translationAbortController) {
            this.translationAbortController.abort();
        }
        this.translationAbortController = new AbortController();
        const requestID = ++this.currentTranslationRequestID;

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
            elementToUpdate.innerText = unescapedText;
            this.adjustFontSize(elementToUpdate, unescapedText, 'translated');
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            console.error('Google Translate Error:', err);
            elementToUpdate.innerText = `(Google翻訳エラー: ${err.message})`;
        } finally {
            if (this.currentTranslationRequestID === requestID) {
                this.isTranslating = false;
            }
        }
    }

    private async fetchOllamaModels() {
        try {
            const baseUrl = this.inputOllamaUrl.value.trim();
            if (!baseUrl) return;
            
            console.log(`Fetching Ollama models from ${baseUrl}...`);
            const response = await fetch(`${baseUrl}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                if (data.models) {
                    this.ollamaModelList.innerHTML = '';
                    data.models.forEach((m: any) => {
                        const opt = document.createElement('option');
                        opt.value = m.name;
                        this.ollamaModelList.appendChild(opt);
                    });
                    console.log(`Fetched ${data.models.length} models from Ollama`);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch Ollama models', e);
        }
    }

    private async translateWithOllama(text: string, targetLang: string, elementToUpdate: HTMLElement) {
        const baseUrl = this.inputOllamaUrl.value.trim().replace(/\/$/, '');
        const model = this.inputOllamaModel.value.trim();

        if (this.translationAbortController) {
            this.translationAbortController.abort();
        }
        this.translationAbortController = new AbortController();
        const requestID = ++this.currentTranslationRequestID;

        const langNames: Record<string, string> = {
            'en': 'English',
            'ja': 'Japanese',
            'zh': 'Chinese',
            'ko': 'Korean'
        };

        const prompt = `Translate the following text to ${langNames[targetLang] || targetLang}. Output ONLY the translated text without any explanations or extra words.\nText: ${text}`;

        this.isTranslating = true;
        try {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
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
            const translatedText = data.message.content.trim();
            elementToUpdate.innerText = translatedText;
            this.adjustFontSize(elementToUpdate, translatedText, 'translated');
        } catch (err: any) {
            if (err.name === 'AbortError') return;

            console.error('Ollama Error:', err);
            let errorMessage = `(Ollama エラー: ${err.message})`;

            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                errorMessage = '(Ollama に接続できません。CORS設定または起動状態を確認してください)';
                this.updateStatus('error', 'Ollama 接続エラー');
            } else if (err.message.includes('terminated') ||
                err.message.includes('Metal') ||
                err.message.includes('EOF') ||
                err.message.includes('Load Error')) {
                errorMessage = '(Ollama モデルエラー: モデルがクラッシュまたはロードに失敗しました。軽量なモデルへの変更や、Ollamaの再起動を試してください)';
                this.updateStatus('error', 'Ollama モデル読込エラー');
            }

            elementToUpdate.innerText = errorMessage;
        } finally {
            if (this.currentTranslationRequestID === requestID) {
                this.isTranslating = false;
            }
        }
    }

    private updateStatus(type: 'active' | 'inactive' | 'error', message: string) {
        this.statusMessage.innerText = message;
        this.statusDot.className = 'dot';
        if (type === 'active') {
            this.statusDot.classList.add('active');
        } else if (type === 'error') {
            this.statusDot.style.background = '#ff4b4b';
        }
    }

    /**
     * Automatically adjust font size based on text length
     * @param element The text element to adjust
     * @param text The text content
     * @param type 'original' or 'translated'
     */
    private detectAndSwapLanguage(text: string) {
        // Only detect if it's been a while since last swap, and text is substantial
        const now = Date.now();
        if (now - this.lastDetectionTime < 5000) return; // Wait at least 5s between flips
        if (text.length < 4) return;

        // Japanese characters regex
        const hasJapanese = /[ぁ-んァ-ヶー一-龠]/.test(text);
        const sourceLang = this.selectSourceLang.value;
        const targetLang = this.selectLang.value;

        let swapped = false;

        // English -> Japanese set, but Japanese detected
        if (sourceLang === 'en' && targetLang === 'ja' && hasJapanese) {
            this.selectSourceLang.value = 'ja';
            this.selectLang.value = 'en';
            swapped = true;
        } 
        // Japanese -> English set, but purely English detected (and substantial)
        else if (sourceLang === 'ja' && targetLang === 'en' && !hasJapanese && text.split(' ').length >= 3) {
            this.selectSourceLang.value = 'en';
            this.selectLang.value = 'ja';
            swapped = true;
        }

        if (swapped) {
            console.log(`Language direction auto-swapped to: ${this.selectSourceLang.value} -> ${this.selectLang.value}`);
            this.lastDetectionTime = now;
            this.saveAndSyncSettings();
        }
    }

    private saveAndSyncSettings() {
        this.saveSettings();
        // Update live settings if backend is connected
        if ((this.selectEngine.value === 'mlx' || this.selectEngine.value === 'deepgram') && 
            this.mlxSocket && this.mlxSocket.readyState === WebSocket.OPEN) {
            this.mlxSocket.send(JSON.stringify({
                type: 'settings',
                settings: {
                    source_lang: this.selectSourceLang.value,
                    target_lang: this.selectLang.value
                }
            }));
        }
    }

    private adjustFontSize(element: HTMLElement, text: string, type: 'original' | 'translated') {
        if (!this.autoFontSizeEnabled || !text) {
            return;
        }

        const textLength = text.length;
        const baseFontSize = type === 'original' ? this.originalBaseFontSize : this.translatedBaseFontSize;
        const maxChars = type === 'original' ? this.MAX_CHARS_ORIGINAL : this.MAX_CHARS_TRANSLATED;

        // Calculate scale factor based on text length
        let fontSize = baseFontSize;

        if (textLength > maxChars) {
            // Reduce font size proportionally when text exceeds max chars
            const scaleFactor = Math.sqrt(maxChars / textLength);
            fontSize = Math.max(this.MIN_FONT_SIZE, baseFontSize * scaleFactor);
        }

        // As a fallback to directly override the variable if the user defined logic relies on inline style:
        element.style.fontSize = `${fontSize}rem`;
    }

    private startBgColorSampling() {
        if (this.colorSampleInterval) {
            clearInterval(this.colorSampleInterval);
        }

        this.colorSampleInterval = window.setInterval(() => {
            this.updateStrokeColorFromVideo();
        }, 300); // 300ms interval for good responsiveness but solid performance
    }

    private stopBgColorSampling() {
        if (this.colorSampleInterval) {
            clearInterval(this.colorSampleInterval);
            this.colorSampleInterval = null;
        }
    }

    private updateStrokeColorFromVideo() {
        if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) return;
        if (!this.sampleCtx) return;

        const vw = this.videoElement.videoWidth;
        const vh = this.videoElement.videoHeight;

        if (vw === 0 || vh === 0) return;

        // Subtitles generally appear on the bottom 40% of the video.
        const sampleHeight = Math.floor(vh * 0.40);
        const sampleY = vh - sampleHeight;

        try {
            this.sampleCtx.drawImage(
                this.videoElement,
                0, sampleY, vw, sampleHeight, // Source region: bottom 40%
                0, 0, this.sampleCanvas.width, this.sampleCanvas.height // Destination rect
            );

            const imageData = this.sampleCtx.getImageData(0, 0, this.sampleCanvas.width, this.sampleCanvas.height);
            const data = imageData.data;

            // Bucket colors to find the most dominant color
            // Use 16 as bucket size to quantize colors
            const bucketSize = 16;
            const colorCounts: { [key: string]: { count: number, r: number, g: number, b: number } } = {};
            let maxCount = 0;
            let dominantBucket: string | null = null;

            // Step size 16 means moving by 4 pixels (4 bytes * 4) at a time
            for (let i = 0; i < data.length; i += 16) {
                const r = data[i] || 0;
                const g = data[i + 1] || 0;
                const b = data[i + 2] || 0;

                const rB = Math.floor(r / bucketSize) * bucketSize;
                const gB = Math.floor(g / bucketSize) * bucketSize;
                const bB = Math.floor(b / bucketSize) * bucketSize;

                const key = `${rB},${gB},${bB}`;
                if (!colorCounts[key]) {
                    colorCounts[key] = { count: 1, r: rB, g: gB, b: bB };
                } else {
                    colorCounts[key].count++;
                }

                if (colorCounts[key] && colorCounts[key]!.count > maxCount) {
                    maxCount = colorCounts[key]!.count;
                    dominantBucket = key;
                }
            }


            if (dominantBucket && colorCounts[dominantBucket]) {
                const dom = colorCounts[dominantBucket];
                if (dom) {
                    // Calculate opposite (complementary) color
                    // 255 - RGB component values gives the direct opposite in RGB color space
                    const oppR = 255 - dom.r;
                    const oppG = 255 - dom.g;
                    const oppB = 255 - dom.b;

                    // Add an alpha channel of 0.95 for slight blending
                    const strokeColor = `rgba(${oppR}, ${oppG}, ${oppB}, 0.95)`;
                    if (this.subtitleOverlay) {
                        this.subtitleOverlay.style.setProperty('--original-stroke', strokeColor);
                        this.subtitleOverlay.style.setProperty('--translated-stroke', strokeColor);
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    private updateSplitViewUI() {
        const isSplit = this.checkSplitView.checked;
        this.subtitleOverlay.querySelectorAll('.subtitle-pair').forEach(el => {
            if (isSplit) {
                el.classList.add('split');
            } else {
                el.classList.remove('split');
            }
        });
    }
}

// Initialize the app
window.addEventListener('DOMContentLoaded', () => {
    new TranslateApp();
});
