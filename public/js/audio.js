/**
 * XENOゲーム用音声管理システム
 * BGMとSEを管理するクラス
 */
class AudioManager {
    constructor() {
        this.bgmVolume = 0.1;
        this.seVolume = 0.7;
        this.isMuted = false;
        this.currentBGM = null;
        this.sounds = {};
        this.activeTimers = new Map(); // 再生中のタイマーを管理
        
        // 音声ファイルのパス定義
        this.bgmPaths = {
            main: './sounds/bgm/MainBGM.mp3',     // メインBGM
            ending: './sounds/bgm/EndingBGM.mp3'  // エンディングBGM
        };
        
        this.sePaths = {
            // 基本UI音
            hover: './sounds/se/hover.mp3',
            decision: './sounds/se/decision11.mp3',    // 決定音（11を選択）
            cancel: './sounds/se/cancel2.mp3',         // キャンセル音（2を選択）
            
            // カード操作音
            cardCut: './sounds/se/card_cut1.mp3',      // カードを切る音（1を選択）
            cardFlip: './sounds/se/card_flip.mp3',     // カードをめくる音
            cardPlace: './sounds/se/card_place.mp3',   // カードを台に置く音
            cardDeal: './sounds/se/card_deal.mp3',     // カードを配る音
            cardShuffle: './sounds/se/card_shuffle.mp3', // シャッフル音
            
            // ゲーム効果音
            snap: './sounds/se/snap1.mp3',             // 指パッチン音（1を選択）
            steal: './sounds/se/steal_card.mp3',       // 手札を抜き取る音
            trauma: './sounds/se/trauma.mp3',          // 蘇るトラウマ音
            gameStart: './sounds/se/game_start.mp3'    // ゲーム開始音
        };
        
        // 各SEのデフォルト再生時間設定（秒）
        this.seDurations = {
            // 基本UI音
            hover: 0.2,           // ホバー音
            decision: 0.8,        // 決定音
            cancel: 0.8,          // キャンセル音
            
            // カード操作音
            cardCut: 0.15,        // カードを切る音 (1.5秒 → 0.15秒)
            cardFlip: 0.6,        // カードをめくる音
            cardPlace: 0.6,       // カードを台に置く音
            cardDeal: 0.2,        // カードを配る音 (2.0秒 → 0.2秒)
            cardShuffle: 1.0,     // シャッフル音
            
            // ゲーム効果音
            snap: 0.7,            // 指パッチン音
            steal: 0.8,           // 手札を抜き取る音
            trauma: 2.5,          // 蘇るトラウマ音
            gameStart: 1.8        // ゲーム開始音
        };
        
        this.preloadSounds();
    }
    
    /**
     * 音声ファイルを遅延読み込み（必要な時だけ読み込み）
     */
    preloadSounds() {
        // 重要なSEのみを事前読み込み（ゲーム開始に必要）
        const criticalSounds = ['hover', 'decision', 'gameStart'];
        
        criticalSounds.forEach(key => {
            if (this.sePaths[key]) {
                const audio = new Audio(this.sePaths[key]);
                audio.preload = 'auto';
                audio.volume = this.seVolume;
                this.sounds[key] = audio;
            }
        });
        
        // BGMとその他のSEは遅延読み込み（preload='none'）
        Object.keys(this.bgmPaths).forEach(key => {
            const audio = new Audio(this.bgmPaths[key]);
            audio.preload = 'none'; // 遅延読み込み
            audio.loop = true;
            audio.volume = this.bgmVolume;
            this.sounds[key] = audio;
        });
        
        Object.keys(this.sePaths).forEach(key => {
            if (!criticalSounds.includes(key)) {
                const audio = new Audio(this.sePaths[key]);
                audio.preload = 'none'; // 遅延読み込み
                audio.volume = this.seVolume;
                this.sounds[key] = audio;
            }
        });
    }
    
    /**
     * 音声ファイルが読み込まれているかチェックし、必要に応じて読み込む
     * @param {HTMLAudioElement} audio - 音声要素
     * @returns {Promise} 読み込み完了のPromise
     */
    ensureAudioLoaded(audio) {
        return new Promise((resolve) => {
            if (audio.readyState >= 2) { // HAVE_CURRENT_DATA以上
                resolve();
            } else {
                const onCanPlay = () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    resolve();
                };
                audio.addEventListener('canplay', onCanPlay);
                audio.load(); // 読み込み開始
            }
        });
    }

    /**
     * BGMを再生
     * @param {string} bgmKey - BGMのキー
     * @param {boolean} fadeIn - フェードイン効果を使用するかどうか
     */
    async playBGM(bgmKey, fadeIn = true) {
        if (this.isMuted) return;
        
        // 既存のBGMを停止
        if (this.currentBGM) {
            this.stopBGM();
        }
        
        const bgm = this.sounds[bgmKey];
        if (!bgm) {
            console.warn(`BGM not found: ${bgmKey}`);
            return;
        }
        
        // BGMが読み込まれていない場合は読み込む
        await this.ensureAudioLoaded(bgm);
        
        this.currentBGM = bgm;
        
        if (fadeIn) {
            bgm.volume = 0;
            bgm.play().catch(error => {
                console.warn('BGM playback failed:', error);
            });
            this.fadeIn(bgm, this.bgmVolume);
        } else {
            bgm.volume = this.bgmVolume;
            bgm.play().catch(error => {
                console.warn('BGM playback failed:', error);
            });
        }
    }
    
    /**
     * BGMを停止
     * @param {boolean} fadeOut - フェードアウト効果を使用するかどうか
     */
    stopBGM(fadeOut = true) {
        if (!this.currentBGM) return;
        
        if (fadeOut) {
            this.fadeOut(this.currentBGM, () => {
                this.currentBGM.pause();
                this.currentBGM.currentTime = 0;
                this.currentBGM = null;
            });
        } else {
            this.currentBGM.pause();
            this.currentBGM.currentTime = 0;
            this.currentBGM = null;
        }
    }
    
    /**
     * SEを再生
     * @param {string} seKey - SEのキー
     * @param {number} duration - 再生時間（秒）。未指定の場合はデフォルト時間を使用
     */
    async playSE(seKey, duration = null) {
        if (this.isMuted) return;
        
        const se = this.sounds[seKey];
        if (!se) {
            console.warn(`SE not found: ${seKey}`);
            return;
        }
        
        // SEが読み込まれていない場合は読み込む
        await this.ensureAudioLoaded(se);
        
        // 既存のタイマーがあればクリア
        this.stopSE(seKey);
        
        // SEは複数回再生可能にするため、cloneして再生
        const seClone = se.cloneNode();
        seClone.volume = this.seVolume;
        seClone.currentTime = 0;
        
        const playDuration = duration !== null ? duration : this.seDurations[seKey];
        
        // デバッグログ追加
        console.log(`[AudioManager] SE再生開始: ${seKey}, 再生時間: ${playDuration}秒`);
        
        seClone.play().catch(error => {
            console.warn('SE playback failed:', error);
        });
        
        // 指定時間後に停止するタイマーを設定
        if (playDuration && playDuration > 0) {
            const timer = setTimeout(() => {
                console.log(`[AudioManager] SE停止: ${seKey} (${playDuration}秒経過)`);
                seClone.pause();
                seClone.currentTime = 0;
                this.activeTimers.delete(seKey);
            }, playDuration * 1000);
            
            this.activeTimers.set(seKey, {
                timer: timer,
                audio: seClone
            });
        }
        
        return seClone;
    }
    
    /**
     * 指定したSEを停止
     * @param {string} seKey - SEのキー
     */
    stopSE(seKey) {
        const activeTimer = this.activeTimers.get(seKey);
        if (activeTimer) {
            clearTimeout(activeTimer.timer);
            activeTimer.audio.pause();
            activeTimer.audio.currentTime = 0;
            this.activeTimers.delete(seKey);
        }
    }
    
    /**
     * 全てのSEを停止
     */
    stopAllSE() {
        this.activeTimers.forEach((activeTimer, key) => {
            clearTimeout(activeTimer.timer);
            activeTimer.audio.pause();
            activeTimer.audio.currentTime = 0;
        });
        this.activeTimers.clear();
    }
    
    /**
     * フェードイン効果
     * @param {HTMLAudioElement} audio - 音声要素
     * @param {number} targetVolume - 目標音量
     */
    fadeIn(audio, targetVolume) {
        const fadeStep = targetVolume / 20;
        const fadeInterval = setInterval(() => {
            if (audio.volume < targetVolume - fadeStep) {
                audio.volume += fadeStep;
            } else {
                audio.volume = targetVolume;
                clearInterval(fadeInterval);
            }
        }, 50);
    }
    
    /**
     * フェードアウト効果
     * @param {HTMLAudioElement} audio - 音声要素
     * @param {Function} callback - 完了時のコールバック
     */
    fadeOut(audio, callback) {
        const fadeStep = audio.volume / 20;
        const fadeInterval = setInterval(() => {
            if (audio.volume > fadeStep) {
                audio.volume -= fadeStep;
            } else {
                audio.volume = 0;
                clearInterval(fadeInterval);
                if (callback) callback();
            }
        }, 50);
    }
    
    /**
     * BGM音量を設定
     * @param {number} volume - 音量 (0.0 - 1.0)
     */
    setBGMVolume(volume) {
        this.bgmVolume = Math.max(0, Math.min(1, volume));
        Object.keys(this.bgmPaths).forEach(key => {
            if (this.sounds[key]) {
                this.sounds[key].volume = this.bgmVolume;
            }
        });
    }
    
    /**
     * SE音量を設定
     * @param {number} volume - 音量 (0.0 - 1.0)
     */
    setSEVolume(volume) {
        this.seVolume = Math.max(0, Math.min(1, volume));
        Object.keys(this.sePaths).forEach(key => {
            if (this.sounds[key]) {
                this.sounds[key].volume = this.seVolume;
            }
        });
    }
    
    /**
     * 全体ミュート切り替え
     * @param {boolean} mute - ミュート状態
     */
    setMute(mute) {
        this.isMuted = mute;
        if (mute) {
            if (this.currentBGM) {
                this.currentBGM.volume = 0;
            }
        } else {
            if (this.currentBGM) {
                this.currentBGM.volume = this.bgmVolume;
            }
        }
    }
    



    /**
     * 音量設定をローカルストレージに保存
     */
    saveSettings() {
        const settings = {
            bgmVolume: this.bgmVolume,
            seVolume: this.seVolume,
            isMuted: this.isMuted
        };
        localStorage.setItem('xenoAudioSettings', JSON.stringify(settings));
    }
    
    /**
     * 音量設定をローカルストレージから読み込み
     */
    loadSettings() {
        const settings = localStorage.getItem('xenoAudioSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.setBGMVolume(parsed.bgmVolume || 0.1);
            this.setSEVolume(parsed.seVolume || 0.7);
            this.setMute(parsed.isMuted || false);
        }
    }
}

// グローバルインスタンス
window.audioManager = new AudioManager();

// ページ読み込み時に設定を復元
document.addEventListener('DOMContentLoaded', () => {
    window.audioManager.loadSettings();
});