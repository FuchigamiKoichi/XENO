// game.js
// 画面制御・ソケット・ゲームロジック。アニメは animation.js の Anim を利用。

const socket = io();

// DOM 参照
const selectContainer   = document.getElementById('select-container');
const showContainer     = document.getElementById('show-container');
const waitingInfoDiv    = document.getElementById('waiting-info');
const opponentHandZone  = document.getElementById('opponent-hand');
const playerHandZone    = document.getElementById('player-hand');
const playArea          = document.getElementById('playArea');
const opponentArea      = document.getElementById('opponent-playArea');
const deckContainer     = document.getElementById('deck-container');
const ruleButton        = document.getElementById('ruleButton');
const ruleModal         = document.getElementById('ruleModal');
const closeRuleBtn      = document.getElementById('closeRule');
const timerBar          = document.getElementById('turn-timer-bar');

selectContainer.style.display = 'none';
showContainer.style.display   = 'none';

// メッセージ初期化
initializeMessages();

// 画像の遅延読み込みキャッシュ
const imageCache = new Map();

/**
 * 画像を遅延読み込みしてキャッシュする
 * @param {string} src - 画像のURL
 * @returns {Promise<HTMLImageElement>} 読み込み完了した画像要素
 */
function loadImageLazy(src) {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * カード番号から最適な画像パスを取得（WebP対応）
 * @param {number} cardNum - カード番号
 * @returns {string} 画像パス
 */
function getCardImagePath(cardNum) {
  // カード番号0-10はWebP、その他はJPG
  if (cardNum >= 0 && cardNum <= 10) {
    return `../images/${cardNum}.webp`;
  }
  return `../images/${cardNum}.jpg`;
}

/**
 * 最適化されたカード画像要素を作成
 * @param {string} src - 画像のURL
 * @param {string} className - CSSクラス名
 * @param {Object} attributes - 追加属性
 * @returns {Promise<HTMLImageElement>} カード画像要素
 */
async function createOptimizedCardImage(src, className = '', attributes = {}) {
  const img = document.createElement('img');
  img.className = className;
  
  // 属性を設定
  Object.entries(attributes).forEach(([key, value]) => {
    img.setAttribute(key, value);
  });
  
  // 遅延読み込みを使用して画像を設定
  try {
    const cachedImg = await loadImageLazy(src);
    img.src = cachedImg.src;
  } catch (error) {
    console.warn(`Failed to load image: ${src}`, error);
    img.src = src; // フォールバック
  }
  
  return img;
}

// ゲーム開始時にBGMを再生
document.addEventListener('DOMContentLoaded', () => {
  // ユーザーの操作後にBGMを開始（自動再生ポリシー対応）
  const startBGMOnInteraction = () => {
    if (window.audioManager) {
      window.audioManager.playBGM('main');
      document.removeEventListener('click', startBGMOnInteraction);
      document.removeEventListener('keydown', startBGMOnInteraction);
    }
  };
  
  document.addEventListener('click', startBGMOnInteraction);
  document.addEventListener('keydown', startBGMOnInteraction);
  
  // 重要なカード画像を事前読み込み（背面、基本カードなど）
  const criticalImages = ['../images/pack.jpg', getCardImagePath(0), getCardImagePath(1)];
  criticalImages.forEach(src => loadImageLazy(src));
});

// ログエリアのトグル機能
const logToggleBtn = document.getElementById('log-toggle');
const logCloseBtn = document.getElementById('log-close');
const logArea = document.getElementById('log-area');
const gameScreen = document.getElementById('gameScreen');

function toggleLog() {
  const isOpen = logArea.classList.contains('open');
  
      if (chosen) {
        const { guessed, isHit, targetTurn } = chosen;
        // onatherTurnのdata.nowは攻撃側の視点である可能性が高い。
        // 自分のターン番号はローカルに保持しているcurrentGameStateから取得する。
        const myTurnNumber = (typeof currentGameState?.myTurnNumber !== 'undefined')
          ? currentGameState.myTurnNumber
          : data.now?.myTurnNumber;
        const perspective = (myTurnNumber && targetTurn) ? (myTurnNumber === targetTurn ? 'defender' : 'attacker') : 'attacker';
    logToggleBtn.textContent = '📝'; // 閉じた状態のアイコン
  } else {
    // ログエリアを開く
    logArea.classList.add('open');
    gameScreen.classList.add('log-open');
    logToggleBtn.textContent = '📋'; // 開いた状態のアイコン
  }
}

// トグルボタンのイベントリスナー
if (logToggleBtn) {
  logToggleBtn.addEventListener('click', toggleLog);
}

// 閉じるボタンのイベントリスナー
if (logCloseBtn) {
  logCloseBtn.addEventListener('click', () => {
    logArea.classList.remove('open');
    gameScreen.classList.remove('log-open');
    logToggleBtn.textContent = '📝'; // 閉じた状態のアイコン
  });
}

// ログエリア外をクリックした時に閉じる（オプション）
document.addEventListener('click', (e) => {
  if (logArea.classList.contains('open') && 
      !logArea.contains(e.target) && 
      !logToggleBtn.contains(e.target)) {
    logArea.classList.remove('open');
    gameScreen.classList.remove('log-open');
    logToggleBtn.textContent = '📝'; // 閉じた状態のアイコン
  }
});

// Anim 初期化（アニメ側へDOMを注入）
Anim.init({
  playerHandZone,
  opponentHandZone,
  playArea,
  opponentArea,
  timerBar,
  longSec: 300, // 必要に応じて変更
});

// デッキクリックでシャッフルアニメーション
const deckElement = document.getElementById('deck');
if (deckElement) {
  deckElement.addEventListener('click', async () => {
    await Anim.shuffleCards(1.5);
  });
  deckElement.style.cursor = 'pointer';
  deckElement.title = 'クリックでシャッフル';
}

// URL パラメータ
const params   = new URLSearchParams(window.location.search);
const roomId   = params.get('roomId');
const playerId = params.get('playerId');
const players  = (params.get('players') || '').split(',').filter(Boolean);

socket.emit('changeSocketid', { id: playerId, roomId });

// ==== Collapsible Menu toggle ====
const menuBar    = document.getElementById('menuBar');
const menuToggle = document.getElementById('menuToggle');
const menuList   = document.getElementById('menuList');

function openMenu() {
  menuList.classList.add('open');
  menuToggle.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  menuList.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}
function toggleMenu() {
  if (menuList.classList.contains('open')) closeMenu(); else openMenu();
}

menuToggle.addEventListener('click', (e) => {
  e.stopPropagation(); // 外側クリック判定に食われないように
  toggleMenu();
});

// メニュー外クリックで閉じる
document.addEventListener('click', (e) => {
  if (!menuBar.contains(e.target)) closeMenu();
});

// Escで閉じる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu();
});

// メニュー項目クリック時も閉じる（操作後に自動で畳む）
['backToTitle', 'surrenderButton', 'ruleButton'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => {
      if (window.audioManager) {
        window.audioManager.playSE('decision');
      }
      closeMenu();
      // 投降ボタンの場合は surrender 関数を実行
      if (id === 'surrenderButton') {
        surrender();
      }
    });
  }
});

// CPU 対戦ボタン
const selectCpuBtn = document.getElementById('select-cpu-btn');
if (selectCpuBtn) {
  selectCpuBtn.addEventListener('click', () => {
    socket.emit('ready', { roomId, playerId: 'cpu' });
    waitingInfoDiv.style.display = 'none';
  });
}

// プレイエリアクリックで使用済みカード表示
playArea.addEventListener('click', showUsedCards);
opponentArea.addEventListener('click', showOpponentUsedCards);

closeRuleBtn.addEventListener('click', () => { ruleModal.style.display = 'none'; });

// 音量設定モーダルの処理
const audioModal = document.getElementById('audioModal');
const audioSettingsButton = document.getElementById('audioSettingsButton');
const closeAudioBtn = document.getElementById('closeAudio');
const bgmVolumeSlider = document.getElementById('bgmVolume');
const seVolumeSlider = document.getElementById('seVolume');
const muteToggle = document.getElementById('muteToggle');
const testSEButton = document.getElementById('testSE');
const bgmVolumeValue = document.getElementById('bgmVolumeValue');
const seVolumeValue = document.getElementById('seVolumeValue');

// 音量設定ボタンクリック
audioSettingsButton.addEventListener('click', () => {
  audioModal.style.display = 'block';
  if (window.audioManager) {
    bgmVolumeSlider.value = window.audioManager.bgmVolume * 100;
    seVolumeSlider.value = window.audioManager.seVolume * 100;
    muteToggle.checked = window.audioManager.isMuted;
    bgmVolumeValue.textContent = Math.round(window.audioManager.bgmVolume * 100) + '%';
    seVolumeValue.textContent = Math.round(window.audioManager.seVolume * 100) + '%';
    
    // SE再生時間の初期値を設定
    const selectedSE = seSelect.value;
    const duration = window.audioManager.getSEDuration(selectedSE);
    seDurationSlider.value = duration;
    seDurationValue.textContent = duration.toFixed(1) + '秒';
  }
});

// 音量設定モーダルを閉じる
closeAudioBtn.addEventListener('click', () => {
  audioModal.style.display = 'none';
});

// BGM音量調整
bgmVolumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value / 100;
  bgmVolumeValue.textContent = e.target.value + '%';
  if (window.audioManager) {
    window.audioManager.setBGMVolume(volume);
    window.audioManager.saveSettings();
  }
});

// SE音量調整
seVolumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value / 100;
  seVolumeValue.textContent = e.target.value + '%';
  if (window.audioManager) {
    window.audioManager.setSEVolume(volume);
    window.audioManager.saveSettings();
  }
});

// ミュート切り替え
muteToggle.addEventListener('change', (e) => {
  if (window.audioManager) {
    window.audioManager.setMute(e.target.checked);
    window.audioManager.saveSettings();
  }
});

// SEテスト
testSEButton.addEventListener('click', () => {
  if (window.audioManager) {
    window.audioManager.playSE('decision');
  }
});

// SE再生時間調整の要素を取得
const resetToDefaultsButton = document.getElementById('resetToDefaults');

// 音量をデフォルトにリセット
resetToDefaultsButton.addEventListener('click', () => {
  if (window.audioManager && confirm('BGMとSEの音量をデフォルトに戻しますか？')) {
    // 音量をデフォルト値に設定
    window.audioManager.setBGMVolume(0.1);
    window.audioManager.setSEVolume(0.7);
    window.audioManager.setMute(false);
    
    // UIを更新
    bgmVolumeSlider.value = 0.1;
    bgmVolumeValue.textContent = '10%';
    seVolumeSlider.value = 0.7;
    seVolumeValue.textContent = '70%';
    muteToggle.checked = false;
    
    // 設定を保存
    window.audioManager.saveSettings();
    
    console.log('[AudioManager] 音量をデフォルトに戻しました');
  }
});

// ルールボタンがクリックされた時の処理
ruleButton.addEventListener('click', async () => {
  // モーダル表示
  ruleModal.style.display = 'block';

  if (ruleModal.dataset.loaded === 'true') {
    return;
  }

  // --- ルールHTMLを初回のみ読み込む ---
  try {
    const res = await fetch('./rule.html');
    if (!res.ok) throw new Error('Failed to fetch rule.html');
    
    const html = await res.text();
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const ruleHtml = bodyMatch ? bodyMatch[1] : '';

    // モーダル内のコンテンツエリアにHTMLを挿入
    const contentWrapper = ruleModal.querySelector('.modal-content');
    const ruleContainer = document.createElement('div');
    ruleContainer.innerHTML = ruleHtml;

    const backBtn = ruleContainer.querySelector('button[onclick="window.history.back()"]');
    if (backBtn) backBtn.remove();
    
    // 既存のコンテンツ（閉じるボタンなど）の後に追加
    contentWrapper.appendChild(ruleContainer);

    // 読み込み完了フラグ
    ruleModal.dataset.loaded = 'true';

    const tabBtns = contentWrapper.querySelectorAll('.tab-btn');
    const tabContents = contentWrapper.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetContent = contentWrapper.querySelector('#' + btn.dataset.target);
        if (targetContent) targetContent.classList.add('active');
      });
    });
    const pillBtns = contentWrapper.querySelectorAll('.pill-btn');
    const cardDescs = contentWrapper.querySelectorAll('.card-desc');
    pillBtns.forEach(pill => {
      pill.addEventListener('click', function() {
        pillBtns.forEach(p => p.classList.remove('active'));
        cardDescs.forEach(d => d.classList.remove('active'));
        pill.classList.add('active');
        const targetDesc = contentWrapper.querySelector('#' + pill.dataset.cardTarget);
        if (targetDesc) targetDesc.classList.add('active');
      });
    });

  } catch (e) {
    console.error('ルールの読み込みに失敗しました:', e);
    const contentWrapper = ruleModal.querySelector('.modal-content');
    contentWrapper.innerHTML += '<div>ルール説明の読み込みに失敗しました。</div>';
  }
});
// ルールタブ切替
(() => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
})();

// 現在のゲーム状態を保存（グローバル変数）
let currentGameState = null;

// 画面更新
function updateGameView(now) {
  // ゲーム状態を保存
  currentGameState = now;
  
  playerHandZone.innerHTML = '';
  playArea.innerHTML = '';
  opponentArea.innerHTML = '';
  deckContainer.innerHTML = "<div id='deck-count'></div><div id='side-card-container'></div>";
  const sideContainer = document.getElementById('side-card-container');
  opponentHandZone.innerHTML = '';

  if (now.myHands.length > 0) {
    now.myHands.forEach(card => {
      const cardImg = document.createElement('img');
      cardImg.src = getCardImagePath(card);
      cardImg.classList.add('card');
      cardImg.value = card;
      playerHandZone.appendChild(cardImg);
      
      // ツールチップイベントを追加
      addCardTooltipEvents(cardImg, card);
    });
  }

  if (now.myPlayed.length > 0) {
    let idx = 0;
    now.myPlayed.forEach(card => {
      const playedImg = document.createElement('img');
      playedImg.src = getCardImagePath(card);
      playedImg.classList.add('played-card');
      playedImg.style.position = 'absolute';
      playedImg.style.left = `${idx * 40}px`;
      playedImg.style.zIndex = idx;
      playedImg.style.width = '100px';
      playedImg.style.height = '150px';
      playArea.appendChild(playedImg);
      
      // ツールチップイベントを追加
      addCardTooltipEvents(playedImg, card);
      
      idx++;
    });
  }

  const otherPlayedKeys = Object.keys(now.otherPlayed || {});
  if (otherPlayedKeys.length > 0) {
    let idx = 0;
    const opponentPlayedCards = now.otherPlayed[otherPlayedKeys[0]] || [];
    const previousCardCount = opponentArea.children.length;
    
    opponentPlayedCards.forEach((card, cardIdx) => {
      const playedImg = document.createElement('img');
      playedImg.src = getCardImagePath(card);
      playedImg.classList.add('played-card');
      playedImg.style.position = 'absolute';
      playedImg.style.left = `${idx * 40}px`;
      playedImg.style.zIndex = idx;
      playedImg.style.width = '100px';
      playedImg.style.height = '150px';
      opponentArea.appendChild(playedImg);
      
      // ツールチップイベントを追加
      addCardTooltipEvents(playedImg, card);
      
      // 新しく追加されたカードのみにポップインアニメーションを適用
      if (cardIdx >= previousCardCount) {
        Anim.popIn(playedImg);
      }
      
      idx++;
    });
  }

  // 相手の手札（裏向き）
  for (let i = 0; i < now.playersLength; i++) {
    const playerTurnNumber = now.playersHandsLengths[i];
    if (playerTurnNumber.turnNumber !== now.myTurnNumber) {
      opponentHandZone.innerHTML = '';
      for (let j = 0; j < playerTurnNumber.length; j++) {
        const backCard = document.createElement('img');
        backCard.src = getCardImagePath(0);
        backCard.classList.add('card');
        opponentHandZone.appendChild(backCard);
      }
    }
  }

  if (now.reincarnation) {
    const sideCard = document.createElement('img');
    sideCard.src = getCardImagePath(0);
    sideCard.classList.add('side-card');
    sideContainer.appendChild(sideCard);
  }

  // 山札の表示（0枚でもプレースホルダーを表示）
  const deckCard = document.createElement('img');
  if (now.cardNumber > 0) {
    deckCard.src = getCardImagePath(0);
    deckCard.classList.add('deck-active');
  } else {
    deckCard.src = `../images/pack.jpg`; // 空の山札用画像
    deckCard.classList.add('deck-empty');
  }
  deckCard.id = 'deck';
  deckContainer.appendChild(deckCard);

  const deckCount = document.getElementById('deck-count');
  deckCount.textContent = messageManager.getGameMessage('deckCount', { count: now.cardNumber });
  
  // 山札が0枚の時のスタイル適用
  if (now.cardNumber === 0) {
    deckCount.classList.add('empty-deck');
  } else {
    deckCount.classList.remove('empty-deck');
  }
}

// 文字列→演出テキスト
function getCharacterName(cardNumber) {
  cardNumber = parseInt(cardNumber, 10);
  const characterNames = ['俺','探偵','エスパー','バリア','下痢','対決','正夢','能力交換','悪魔','彼女'];
  return characterNames[cardNumber - 1];
}
function getEffectDescription(cardNumber) {
  return messageManager.getEffectMessage(cardNumber);
}

// 兵士(2)の遅延判定演出が残っている可能性がある場合に待機
async function waitForPendingCard2Judgement(timeoutMs = 1500) {
  const start = Date.now();
  // まずは、遅れて到着する可能性のある判定演出Promiseの出現を短くポーリング
  if (!window.__lastOpponentAnimPromise) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    while (!window.__lastOpponentAnimPromise && (Date.now() - start) < timeoutMs) {
      await sleep(50);
    }
  }
  // 見つかったらそれを待つ
  if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
    try { await window.__lastOpponentAnimPromise; } catch (_) {}
  }
  if (Anim && typeof Anim.waitForFxIdle === 'function') {
    const remain = Math.max(0, timeoutMs - (Date.now() - start));
    try { await Anim.waitForFxIdle(remain); } catch (_) {}
  }
}

// カード詳細情報を取得する関数
function getCardDetails(cardNumber) {
  cardNumber = parseInt(cardNumber, 10);
  return messageManager.getCardInfo(cardNumber);
}

// カードを出す（自分）
async function playCard(cardNumber) {
  const imgSrc = getCardImagePath(cardNumber);
  const cardNum = parseInt(cardNumber, 10);

  // カード効果に応じて特別なSEを再生
  if (window.audioManager) {
    switch(cardNum) {
      case 5: // 死神
        window.audioManager.playSE('trauma');
        break;
      case 9: // 皇帝
        window.audioManager.playSE('snap');
        break;
      case 10: // 英雄
        window.audioManager.playSE('gameStart');
        break;
      default:
        window.audioManager.playSE('cardPlace');
        break;
    }
  }

  // 手札から該当1枚を除去
  const myHands = playerHandZone.querySelectorAll('img');
  for (let i = 0; i < myHands.length; i++) {
    if (parseInt(myHands[i].value, 10) === parseInt(cardNumber, 10)) {
      playerHandZone.removeChild(myHands[i]);
      break;
    }
  }

  const cname = getCharacterName(cardNumber);
  const text  = getEffectDescription(cardNumber);

  // ズーム演出（完了待ち）
  await Anim.zoomCard(imgSrc, text, 1.0);

  // カード6は効果の成否（バリア）確定まで開示を遅延する
  if (parseInt(cardNumber, 10) === 6) {
    const result = await waitForCard6Resolution(4500); // 最大4.5秒待つ
    if (result && result.barriered) {
      // バリア時：6の開示演出はしないが、無効化演出は表示したい
      // 競合を避けるため、FXレーンに積む
      if (Anim && typeof Anim.enqueueBarrierEffect === 'function') {
          console.log('[Card6] enqueue barrier effect for attacker');
          Anim.enqueueBarrierEffect(6);
      } else {
        await Anim.playBarrierEffect(6);
      }
    } else if (result && !result.barriered) {
      // 成功後に最新の手札情報で演出
      const handInfo = getCurrentHandInfo();
      // 成功時は両者のカード開示（必要に応じて調整可）
      handInfo.onlyReveal = { player: true, opponent: true };
      await Anim.playCardEffect(6, false, handInfo);
    } else {
      // タイムアウト時は安全側（何もしない）
      console.debug('Card6 resolution timeout: skip reveal');
    }
  } else if (parseInt(cardNumber, 10) === 2) {
    // 兵士: 予想演出（攻撃側視点）
    // サーバからの 'update' でも相手/自分両方に結果演出が来るが、
    // ローカルは先に予想演出を軽く挟む（重複は短いので許容）
    try {
      // now.predに直近の自分の予想が入る可能性があるが確定ではないため控えめに運用
      const lastPred = (window.currentGameState && Array.isArray(window.currentGameState.pred))
        ? window.currentGameState.pred.find(p => p.subject === window.currentGameState.myTurnNumber)
        : null;
      const guessed = lastPred ? lastPred.predCard : undefined;
      if (guessed && Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
        Anim.enqueueGuessAnnounce(guessed, 'attacker');
      }
    } catch (e) { console.debug('local guess announce skipped:', e); }
    await Anim.playCardEffect(2, false);
  } else {
    // カード効果演出を実行
    await Anim.playCardEffect(parseInt(cardNumber, 10), false);
  }

  // 場に配置
  const newCard = document.createElement('img');
  newCard.src = imgSrc;
  newCard.classList.add('played-card');

  const index = playArea.children.length;
  newCard.style.position = 'absolute';
  newCard.style.left = `${index * 40}px`;
  newCard.style.zIndex = index;
  newCard.style.width = '100px';
  newCard.style.height = '150px';

  playArea.appendChild(newCard);
  Anim.popIn(newCard);
  return 'done';
}

// ====== Card 6（貴族）解決待ちユーティリティ ======
let __pendingCard6Resolve = null;
function waitForCard6Resolution(timeoutMs = 4500) {
  // 既存の保留があれば前のを無効化
  __pendingCard6Resolve = null;

  return new Promise((resolve) => {
    let finished = false;
    const done = (res) => {
      if (finished) return;
      finished = true;
      __pendingCard6Resolve = null;
      resolve(res);
    };
    // socket側からの通知で解決させるためのresolverを保存
    __pendingCard6Resolve = (res) => done(res);

    // 成功判定のために lookHands のベースラインを記録
    const getLookHandsCount = () => {
      try {
        if (!currentGameState || !currentGameState.lookHands) return 0;
        const keys = Object.keys(currentGameState.lookHands);
        let count = 0;
        keys.forEach(k => {
          const arr = currentGameState.lookHands[k];
          if (Array.isArray(arr)) count += arr.length;
        });
        return count;
      } catch (e) {
        return 0;
      }
    };
    const baselineCount = getLookHandsCount();

    // 成功（相手カードが見える状態）をポーリング検知
    const startedAt = Date.now();
    const tick = () => {
      if (finished) return;
      try {
        // ベースラインから増えていれば今回の効果で新規に見えたと判断
        const nowCount = getLookHandsCount();
        if (nowCount > baselineCount) {
          done({ barriered: false });
          return;
        }
      } catch (e) {}
      if (Date.now() - startedAt >= timeoutMs) {
        done(null); // タイムアウト
      } else {
        setTimeout(tick, 120);
      }
    };
    setTimeout(tick, 120);
  });
}

// カードを出す（相手）- サーバーからのバリア情報付き
async function playCard_cpu_withBarrier(cardNumber, isBarriered) {
  console.log('playCard_cpu_withBarrier called with:', cardNumber, 'バリア:', isBarriered); // デバッグログ追加
  const imgSrc = getCardImagePath(cardNumber);
  const cardNum = parseInt(cardNumber, 10);
  // カード効果に応じて特別なSEを再生
  if (window.audioManager) {
    switch(cardNum) {
      case 5: // 死神
        window.audioManager.playSE('trauma');
        break;
      case 9: // 皇帝
        window.audioManager.playSE('snap');
        break;
      case 10: // 英雄
        window.audioManager.playSE('gameStart');
        break;
      default:
        window.audioManager.playSE('cardPlace');
        break;
    }
  }
  const cname  = getCharacterName(cardNumber);
  const text   = getEffectDescription(cardNumber);

  // カードのズーム表示のみを行い、プレイエリアへの追加はupdateGameViewに任せる
  console.log('Showing zoom for opponent card:', cardNumber); // デバッグログ追加
  await Anim.zoomCard(imgSrc, text, 1.5);
  
  // カード6の場合は手札情報を含めて演出を実行
  if (parseInt(cardNumber, 10) === 6) {
    let handInfo = getCurrentHandInfo() || {};
    // セーフガード：無効化時は両側非開示、成功時は両側開示
    if (isBarriered) {
      handInfo.onlyReveal = { player: false, opponent: false };
    } else {
      handInfo.onlyReveal = { player: true, opponent: true };
    }
    console.log('Playing card 6 effect for opponent with hand info:', handInfo); // デバッグログ追加
    await Anim.playCardEffect(parseInt(cardNumber, 10), isBarriered, handInfo);
  } else {
    // カード効果演出を実行（サーバーからのバリア情報を使用）
    console.log('Playing card effect for opponent card:', cardNumber, 'with barrier:', isBarriered); // デバッグログ追加
    await Anim.playCardEffect(parseInt(cardNumber, 10), isBarriered);
  }
  console.log('Card effect completed for opponent card:', cardNumber); // デバッグログ追加
  
  // 実際のカード追加処理はupdateGameViewで行われるため、ここでは行わない
  // これにより重複表示を防ぐ
}

// カードを出す（相手）- 後方互換性のため残す
async function playCard_cpu(cardNumber) {
  await playCard_cpu_withBarrier(cardNumber, false);
}

// バリア効果の判定はサーバー側で行われるため、この関数は削除済み
// サーバーからのisBarriered情報を直接使用します

// 現在の手札情報を取得する
function getCurrentHandInfo() {
  if (!currentGameState) {
    console.warn('ゲーム状態が取得できません');
  }

  // まずはDOMから現在のプレイヤー手札を取得（最新かつ確実）
  let playerCards = [];
  try {
    const imgs = playerHandZone ? Array.from(playerHandZone.querySelectorAll('img')) : [];
    playerCards = imgs
      .map(img => parseInt(img.dataset.card ?? img.value, 10))
      .filter(n => Number.isFinite(n));
  } catch (e) {}
  // DOMから取得できない場合は、サーバー状態をフォールバック
  if (!playerCards || playerCards.length === 0) {
    playerCards = (currentGameState && currentGameState.myHands) ? currentGameState.myHands.slice() : [];
  }

  const opponentCards = [];
  try {
    if (currentGameState && currentGameState.lookHands) {
      const lookHandsKeys = Object.keys(currentGameState.lookHands);
      lookHandsKeys.forEach(turnNumber => {
        const cards = currentGameState.lookHands[turnNumber];
        if (cards && cards.length > 0) {
          opponentCards.push(...cards);
        }
      });
    }
  } catch (e) {}

  console.log('手札情報取得 - プレイヤー(DOM優先):', playerCards, '相手:', opponentCards);

  return {
    playerCards,
    opponentCards,
    gameState: currentGameState
  };
}

// カード画像のsrcからカード番号を抽出
function extractCardNumberFromSrc(src) {
  const match = src.match(/(\d+)\.jpg$/);
  return match ? parseInt(match[1], 10) : null;
}

// 使用済みカードモーダル
let usedCards = [];
let opponentUsedCards = [];
function showUsedCards() {
  const modal = document.getElementById('usedCardsModal');
  const list  = document.getElementById('usedCardsList');
  list.innerHTML = '';
  usedCards.forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.classList.add('used-card');
    list.appendChild(img);
  });
  modal.style.display = 'block';
}
function showOpponentUsedCards() {
  const modal = document.getElementById('usedCardsModal');
  const list  = document.getElementById('usedCardsList');
  list.innerHTML = '';
  opponentUsedCards.forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.classList.add('used-card');
    list.appendChild(img);
  });
  modal.style.display = 'block';
}
function closeUsedCards() {
  const modal = document.getElementById('usedCardsModal');
  modal.style.display = 'none';
}

// ログ/結果
function addLog(message) {
  const logMessages = document.getElementById('log-messages');
  
  // ユーザーが最下部近くにいるかチェック（20px以内なら自動スクロール）
  const isNearBottom = logMessages.scrollHeight - logMessages.scrollTop - logMessages.clientHeight < 20;
  
  const d = document.createElement('div');
  d.textContent = message;
  d.style.wordWrap = 'break-word'; // 長いメッセージの改行
  logMessages.appendChild(d);
  
  // 最下部近くにいた場合のみ自動スクロール
  if (isNearBottom) {
    logMessages.scrollTop = logMessages.scrollHeight;
  }
}
function showResult(message) {
  const el = document.getElementById('showResult');
  el.innerHTML = message;
  el.style.display = 'block';
}

// セレクトUI/公開UI
async function select(choices, message = undefined) {
  return new Promise((resolve) => {
    selectContainer.innerHTML = '';
    
    // メッセージタイトルを作成
    const titleElement = document.createElement('div');
    titleElement.classList.add('select-title');
    titleElement.textContent = message || messageManager.getSelectMessage('default');
    selectContainer.appendChild(titleElement);
    
    // カードコンテナを作成
    const cardsArea = document.createElement('div');
    cardsArea.classList.add('select-cards-area');
    
    // 現在アクティブなカードのインデックスを追跡
    let activeCardIndex = -1;
    
    // 全カードの状態をリセットする関数
    const resetAllCardStates = () => {
      cardsArea.querySelectorAll('.select-card-wrapper').forEach(wrapper => {
        wrapper.classList.remove('hover-active', 'focus-active');
      });
      activeCardIndex = -1;
    };
    
    // 特定のカードをアクティブにする関数
    const setActiveCard = (index, type = 'hover') => {
      resetAllCardStates();
      const targetWrapper = cardsArea.children[index];
      if (targetWrapper) {
        targetWrapper.classList.add(type === 'focus' ? 'focus-active' : 'hover-active');
        activeCardIndex = index;
      }
    };
    
    for (let i = 0; i < choices.length; i++) {
      const cardNumber = choices[i];
      
      // カードラッパー（キーボードフォーカス対応）
      const cardWrapper = document.createElement('div');
      cardWrapper.classList.add('select-card-wrapper');
      cardWrapper.setAttribute('tabindex', '0');
      cardWrapper.setAttribute('role', 'button');
      cardWrapper.setAttribute('aria-label', messageManager.getUIMessage('tooltip.selectCard', { number: cardNumber }));
      cardWrapper.setAttribute('data-card-index', i);
      cardWrapper.setAttribute('data-click-hint', messageManager.getUIMessage('clickHint'));
      
      const card = document.createElement('img');
      card.src = getCardImagePath(cardNumber);
      card.width = 140; 
      card.height = 210; 
      card.alt = `カード ${cardNumber}`;
      card.classList.add('select-card');
      
      // イベントハンドラー（クロージャーでインデックスを保持）
      const cardIndex = i;
      
      const handleMouseEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveCard(cardIndex, 'hover');
        if (window.audioManager) {
          window.audioManager.playSE('hover');
        }
      };
      
      const handleMouseLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeCardIndex === cardIndex) {
          resetAllCardStates();
        }
      };
      
      const handleFocus = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveCard(cardIndex, 'focus');
      };
      
      const handleBlur = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeCardIndex === cardIndex) {
          resetAllCardStates();
        }
      };
      
      // クリック・キーボード操作の処理
      const selectCard = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (window.audioManager) {
          window.audioManager.playSE('decision');
        }
        
        // 全てのイベントリスナーを削除
        cardsArea.querySelectorAll('.select-card-wrapper').forEach((wrapper, idx) => {
          const clonedWrapper = wrapper.cloneNode(true);
          wrapper.parentNode.replaceChild(clonedWrapper, wrapper);
        });
        
        card.style.transform = 'scale(0.95)';
        setTimeout(() => resolve(cardIndex), 100);
      };
      
      // イベントリスナーを追加
      cardWrapper.addEventListener('mouseenter', handleMouseEnter, { passive: false });
      cardWrapper.addEventListener('mouseleave', handleMouseLeave, { passive: false });
      cardWrapper.addEventListener('focus', handleFocus, { passive: false });
      cardWrapper.addEventListener('blur', handleBlur, { passive: false });
      cardWrapper.addEventListener('click', selectCard, { passive: false });
      cardWrapper.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          selectCard(e);
        }
      }, { passive: false });
      
      cardWrapper.appendChild(card);
      cardsArea.appendChild(cardWrapper);
      
      // ツールチップイベントを追加
      addCardTooltipEvents(card, cardNumber);
    }
    
    selectContainer.appendChild(cardsArea);
    selectContainer.style.display = 'flex';
    
    // 初期状態で全ての状態をクリア
    setTimeout(() => {
      resetAllCardStates();
      
      // 最初のカードにフォーカス
      const firstCard = cardsArea.querySelector('.select-card-wrapper');
      if (firstCard) {
        firstCard.focus();
      }
    }, 50);
  });
}

// === 手札から選択（play_card 用）：オーバーレイなしでカードを光らせて選ばせる ===
function selectPlayableFromHand(choices) {
  return new Promise((resolve) => {
    // choices の値ごとにインデックスを持っておく（同値が複数あっても安全）
    const indicesByValue = new Map();
    choices.forEach((v, i) => {
      const arr = indicesByValue.get(v) || [];
      arr.push(i);
      indicesByValue.set(v, arr);
    });

    const imgs = Array.from(playerHandZone.querySelectorAll('img'));
    const listeners = [];

    function cleanup() {
      listeners.forEach(({ node, handler }) => node.removeEventListener('click', handler));
      imgs.forEach(img => img.classList.remove('selectable', 'disabled'));
      document.removeEventListener('keydown', onKeydownEsc);
    }
    function onKeydownEsc(e) {
      if (e.key === 'Escape') cleanup(); // キャンセルして resolve しない（必要なら挙動変更可）
    }
    document.addEventListener('keydown', onKeydownEsc);

    imgs.forEach(img => {
      const val = parseInt(img.dataset.card ?? img.value, 10);
      if (!Number.isFinite(val)) return;

      // 10（英雄）は選択不可：見た目も薄く
      if (val === 10) {
        img.classList.add('disabled');
        return;
      }
      // choices に含まれていないカードは選択不可
      if (!choices.includes(val)) return;

      // 選択可能：枠を光らせる
      img.classList.add('selectable');

      const handler = () => {
        // 同値が複数ある場合でも未使用のインデックスを先頭から割り当て
        const arr = indicesByValue.get(val) || [];
        const idx = arr.shift(); // 使ったインデックスを消費
        indicesByValue.set(val, arr);
        cleanup();
        resolve(idx); // 旧 select と同じく「choices のインデックス」を返す
      };
      img.addEventListener('click', handler);
      listeners.push({ node: img, handler });
    });
  });
}

async function show(data) {
  return new Promise((resolve) => {
    showContainer.innerHTML = '';
    
    // タイトルメッセージを追加
    const titleElement = document.createElement('div');
    titleElement.classList.add('show-title');
    const cardCount = data[0].cards.length;
    titleElement.textContent = messageManager.getGameMessage('opponentHandDisplay', { count: cardCount });
    showContainer.appendChild(titleElement);
    
    // カードコンテナを作成
    const cardsArea = document.createElement('div');
    cardsArea.classList.add('show-cards-area');
    
    for (let i = 0; i < data[0].cards.length; i++) {
      const cardNumber = data[0].cards[i];
      const card = document.createElement('img');
      card.src = getCardImagePath(cardNumber);
      card.width = 140; 
      card.height = 210; 
      card.alt = `相手のカード ${cardNumber}`;
      card.classList.add('show-card');
      cardsArea.appendChild(card);
      
      // ツールチップイベントを追加
      addCardTooltipEvents(card, cardNumber);
    }
    
    showContainer.appendChild(cardsArea);
    
    showContainer.style.display = 'flex';
    
    // 3秒後に自動で閉じる
    setTimeout(() => resolve(0), 3000);
  });
}

// surrender/reset/title
function surrender() {
  console.log('surrender関数が呼び出されました', { roomId, playerId });
  if (confirm('本当に投降しますか？')) {
    if (roomId && playerId) {
        console.log('降参リクエストをサーバーに送信します。', { roomId, playerId });
        socket.emit('playerSurrender', { roomId: roomId, playerId: playerId });
    } else {
        console.error('roomIdまたはplayerIdが設定されていません', { roomId, playerId });
    }
  } else {
    console.log('投降がキャンセルされました');
  }
}

// デッキ（演出用）
let decks = [
  { name: 'boy.jpg',     value: 1,  character: '少年' },
  { name: 'boy.jpg',     value: 1,  character: '少年' },
  { name: 'soldier.jpg', value: 2,  character: '兵士' },
  { name: 'soldier.jpg', value: 2,  character: '兵士' },
  { name: 'diviner.jpg', value: 3,  character: '占い師' },
  { name: 'diviner.jpg', value: 3,  character: '占い師' },
  { name: 'noble.jpg',   value: 6,  character: '貴族' },
  { name: 'noble.jpg',   value: 6,  character: '貴族' },
  { name: 'maiden.jpg',  value: 4,  character: '乙女' },
  { name: 'maiden.jpg',  value: 4,  character: '乙女' },
  { name: 'sage.jpg',    value: 7,  character: '賢者' },
  { name: 'sage.jpg',    value: 7,  character: '賢者' },
  { name: 'reaper.jpg',  value: 5,  character: '死神' },
  { name: 'reaper.jpg',  value: 5,  character: '死神' },
  { name: 'spirit.jpg',  value: 8,  character: '精霊' },
  { name: 'spirit.jpg',  value: 8,  character: '精霊' },
  { name: 'kaizer.jpg',  value: 9,  character: '皇帝' },
  { name: 'hero.jpg',    value:10,  character: '英雄' },
];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
function setupSideCard() {
  if (decks.length === 0) return;
  const index = Math.floor(Math.random() * decks.length);
  decks.splice(index, 1)[0];
  const sideCard = document.createElement('img');
  sideCard.src = getCardImagePath(0);
  sideCard.classList.add('side-card');
  const sideContainer = document.getElementById('side-card-container');
  sideContainer.appendChild(sideCard);
}
async function resetGame() {
  decks = [...decks]; // 実際は初期配列を再構築してください
  
  // シャッフルアニメーションを実行
  await Anim.shuffleCards(2.0);
  
  shuffle(decks);
  playerHandZone.innerHTML = '';
  opponentHandZone.innerHTML = '';
  playArea.innerHTML = '';
  opponentArea.innerHTML = '';
  const deckEl = document.getElementById('deck');
  const deckCount = document.getElementById('deck-count');
  if (deckEl) deckEl.style.display = 'block';
  if (deckCount) {
    deckCount.style.display = 'block';
    deckCount.textContent = decks.length;
  }
  setupSideCard();
  const ti = document.getElementById('turnIndicator');
  if (ti) ti.textContent = 'ゲームをリセットしました';
}
function goToTitle() {
  const game = document.getElementById('gameScreen');
  const start = document.getElementById('startScreen');
  if (game) game.style.display = 'none';
  if (start) start.style.display = 'block';
  resetGame();
}

function hideSelect() { selectContainer.style.display = 'none'; }
function hideShow()   { showContainer.style.display = 'none'; }

// ===== ソケット =====
socket.on('yourTurn', async (data, callback) => {
  await updateGameView(data.now);
  if (data.kind === 'draw') {
    if (data.choices.length > 2) {
      // 直前ターンの相手演出（FX）が残っている可能性があるため、短時間だけ待ってからセレクトを表示
      await Anim.waitForFxIdle(1200);
      Anim.startTurnTimer();
      const idx = await select(data.choices, messageManager.getSelectMessage('draw'));
      hideSelect();
      const chosen = data.choices[idx];
      // カード効果演出との重複を防ぐため、少し待機してからドロー
      await new Promise(resolve => setTimeout(resolve, 300));
      if (window.audioManager) {
        window.audioManager.playSE('cardDeal');
      }
      const done = await Anim.drawCardToHand(chosen);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(messageManager.getGameMessage('drawCard', { card: idx }));
        callback([idx]);
      }
    } else {
      // カード効果演出との重複を防ぐため、少し待機してからドロー
      await new Promise(resolve => setTimeout(resolve, 300));
      if (window.audioManager) {
        window.audioManager.playSE('cardDeal');
      }
      const done = await Anim.drawCardToHand(data.choices[0]);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(messageManager.getGameMessage('drawCard', { card: data.choices[0] }));
        callback([0]);
      }
    }
  } else if (data.kind === 'opponentChoice') {
    Anim.stopTurnTimer();
    callback([0]);
  } else if (data.kind === 'play_card') {
    Anim.startTurnTimer();
    const idx = await selectPlayableFromHand(data.choices);
    addLog(messageManager.getGameMessage('playCard', { card: data.choices[idx] }));
    if (window.audioManager) {
      window.audioManager.playSE('cardPlace');
    }
    const done = await playCard(data.choices[idx]);
    if (done === 'done') {
      Anim.stopTurnTimer();
      callback([idx]);
    }
  } else if (data.kind === 'update') {
    // yourTurn 側の update（例: 兵士の予想結果）
    try {
      const payload = Array.isArray(data.choices) ? data.choices[0] : null;
      if (payload && payload.type === 'card2' && payload.predResult) {
        const { guessed, isHit, targetTurn } = payload.predResult || {};
        // 自分のターン番号はローカル状態から取得（onatherTurnと同様に視点ブレを回避）
        const myTurnNumber = (typeof currentGameState?.myTurnNumber !== 'undefined')
          ? currentGameState.myTurnNumber
          : data.now?.myTurnNumber;
        const perspective = (myTurnNumber && targetTurn) ? (myTurnNumber === targetTurn ? 'defender' : 'attacker') : 'attacker';
        const p = (async () => {
          if (Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
            await Anim.enqueueGuessAnnounce(guessed, perspective);
          }
          if (Anim && typeof Anim.enqueueGuessResult === 'function') {
            await Anim.enqueueGuessResult(guessed, !!isHit, perspective);
          }
        })();
        window.__lastOpponentAnimPromise = p;
      }
    } catch (e) {
      console.warn('update handling error:', e);
    } finally {
      Anim.stopTurnTimer();
      callback([0]);
    }
  } else if (data.kind === 'show') {
    try {
      await show(data.choices);
      addLog(messageManager.getGameMessage('opponentHandReveal', { card: data.choices[0].cards[0] }));
      hideShow();
      callback([0]);
    } catch (e) {
      console.log(e);
    }
  } else {
    try {
      Anim.startTurnTimer();
      // data.kindに応じてメッセージを変更
      const message = messageManager.getSelectMessage(data.kind);
      
      const idx = await select(data.choices, message);
      hideSelect();
      Anim.stopTurnTimer();
      callback([idx]);
    } catch (e) {
      Anim.stopTurnTimer();
      console.log(e);
    }
  }
});

socket.on('onatherTurn', async (data) => {
  Anim.stopTurnTimer();
  console.log('onatherTurn received:', data); // デバッグログ追加
  if (data.kind === 'play_card') {
    console.log('相手がカードをプレイ:', data.choice, 'バリア効果:', data.isBarriered); // デバッグログ追加
    // 直近のプレイカード番号を保持（リザルト遷移のグレース待機に利用）
    try { window.__lastPlayedCard = parseInt(data.choice, 10); } catch (_) {}
    // 重なり防止のため、演出はスケジューラに積む（待たない）
    const cname  = getCharacterName(parseInt(data.choice, 10));
    const text   = getEffectDescription(parseInt(data.choice, 10));
    // 後でリザルト遷移時に待つため、最後の相手演出のPromiseを保持
    const cardNum = parseInt(data.choice, 10);
    let handInfo = getCurrentHandInfo();
    // 6かつ無効化なら何も開示しないフラグを付与
    if (cardNum === 6) {
      handInfo = handInfo || {};
      if (data.isBarriered) {
        handInfo.onlyReveal = { player: false, opponent: false };
        // 防御側にも無効化演出を見せる
        if (Anim && typeof Anim.enqueueBarrierEffect === 'function') {
          console.log('[onatherTurn] defender enqueue barrier effect');
          Anim.enqueueBarrierEffect(6);
        }
      } else {
        // 成功時は両者開示（必要があれば片側のみに調整）
        handInfo.onlyReveal = { player: true, opponent: true };
      }
    }
    window.__lastOpponentAnimPromise = Anim.enqueueOpponentPlay(
      cardNum,
      data.isBarriered || false,
      handInfo,
      text
    );
    addLog(messageManager.getGameMessage('opponentPlayCard', { card: data.choice }));
  } else if (data.kind === 'draw') {
    // ドローはdrawレーンへenqueue（fxレーン稼働中は短く待ってから走る）
    Anim.enqueueCpuDraw();
    if (window.audioManager) {
      window.audioManager.playSE('cardPlace');
    }
    await playCard_cpu(parseInt(data.choice, 10));
    addLog(messageManager.getGameMessage('opponentPlayCard', { card: data.choice }));
  } else if (data.kind === 'draw') {
    if (window.audioManager) {
      window.audioManager.playSE('cardDeal');
    }
    await Anim.cpuDrawCardToHand();
    for (let i = 0; i < data.now.playersLength + 1; i++) {
      const playerTurnNumber = data.now.playersHandsLengths[i];
      if (playerTurnNumber.turnNumber !== Object.keys(data.now.otherPlayers)[0]) {
        opponentHandZone.innerHTML = '';
        for (let j = 0; j < playerTurnNumber.length + 1; j++) {
          const backCard = document.createElement('img');
          backCard.src = getCardImagePath(0);
          backCard.classList.add('card');
          opponentHandZone.appendChild(backCard);
        }
      }
    }
  }
});

socket.on('ed', (data) => {
  Anim.stopTurnTimer();
  if (window.audioManager) {
    window.audioManager.stopBGM();
    window.audioManager.playBGM('ending', false);
  }
});

socket.on('gameEnded', async (data) => {
  Anim.stopTurnTimer();
  // 相手演出が残っていれば完了を待つ
  try {
    if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
      await window.__lastOpponentAnimPromise.catch(() => {});
    }
    // 念のためFXレーンのアイドルも待つ（最大30秒）
    if (Anim && typeof Anim.waitForFxIdle === 'function') {
      await Anim.waitForFxIdle(30000);
    }
    // 兵士(2)の判定演出が残っている可能性に備える
    if (window.__lastPlayedCard === 2 || (window.__lastOpponentUpdate && window.__lastOpponentUpdate.type === 'card2')) {
      await waitForPendingCard2Judgement(1500);
    }
  } catch (e) {

    console.debug('result navigation wait error:', e);
    if (window.audioManager) {
      window.audioManager.stopBGM();
      window.audioManager.playBGM('ending', false);
    }
    const resultString = data.result.toString();
    let reason = 'Noreason';
    const match = resultString.match(/\((.*)\)/);
    if (match) reason = match[1];
    const encodedReason = encodeURIComponent(reason);
    window.location.replace(
      `result.html?roomId=${roomId}&playerId=${playerId}&players=${players}&result=${resultString}&reason=${encodedReason}`
    );
  }
});

socket.on('redirectToResult', async (data) => {
  if (!data || !data.url) return;
  // 相手演出が残っていれば完了を待つ
  try {
    if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
      await window.__lastOpponentAnimPromise.catch(() => {});
    }
    if (Anim && typeof Anim.waitForFxIdle === 'function') {
      await Anim.waitForFxIdle(30000);
    }
    if (window.__lastPlayedCard === 2 || (window.__lastOpponentUpdate && window.__lastOpponentUpdate.type === 'card2')) {
      await waitForPendingCard2Judgement(1500);
    }
  } catch (e) {
    console.debug('redirect wait error:', e);
  }
  window.location.replace(data.url);
});

socket.on('waitingForOpponent', (data) => {
  const roomIdDisplayP = document.getElementById('room-id-display');
  if (waitingInfoDiv && roomIdDisplayP) {
    roomIdDisplayP.textContent = data.roomId;
    waitingInfoDiv.style.display = 'block';
  }
});

socket.on('hideWaitingInfo', async () => {
  if (waitingInfoDiv) waitingInfoDiv.style.display = 'none';
  
  // ゲーム開始時のシャッフルアニメーション
  await Anim.shuffleCards(1.5);
});

socket.on('forceStopTurnTimer', () => Anim.stopTurnTimer());

// クリップボードコピー
(() => {
  const copyBtn = document.getElementById('copy-room-id-btn');
  if (!copyBtn) return;
  copyBtn.addEventListener('click', () => {
    const roomIdDisplay = document.getElementById('room-id-display');
    const rid = roomIdDisplay.textContent;
    if (rid) {
      navigator.clipboard.writeText(rid).then(() => {
        const original = copyBtn.textContent;
        copyBtn.textContent = 'コピーしました！';
        copyBtn.style.backgroundColor = '#28a745';
        setTimeout(() => {
          copyBtn.textContent = original;
          copyBtn.style.backgroundColor = '#007bff';
        }, 2000);
      });
    }
  });
})();

// 起動
function startGame() {
  socket.emit('ready', { roomId, playerId });
}
startGame();

// ルーム削除通知の受信
socket.on('roomDeleted', (data) => {
    alert(`ルーム ${data.roomId} が削除されました: ${data.reason}`);
    window.location.href = 'index.html';
});

// プレイヤー退室通知の受信
socket.on('playerLeft', (data) => {
    addLogMessage(messageManager.getGameMessage('playerLeft', { count: data.remainingPlayers }));
});

// プレイヤー自身のカード効果が無効化された場合の通知
socket.on('cardEffectBarriered', async (data) => {
  console.log('自分のカード効果が無効化されました:', data); // デバッグログ追加
  
  // バリア効果のアニメーションを表示
  if (data.isBarriered) {
    console.log('バリア効果アニメーションを表示中...');
    if (Anim && typeof Anim.enqueueBarrierEffect === 'function') {
      console.log('[BarrierNotice] enqueue barrier effect for defender');
      Anim.enqueueBarrierEffect(data.cardNumber || null);
    } else {
      await Anim.playBarrierEffect(data.cardNumber || null);
    }
    console.log('バリア効果アニメーション完了');
    addLog('相手はカード4で守られているため、効果が無効化されました！');
  }
  // カード6の解決待ちがあれば「無効」を通知
  try {
    if (typeof __pendingCard6Resolve === 'function') {
      __pendingCard6Resolve({ barriered: !!data.isBarriered });
    }
  } catch (e) {}
});

// ツールチップ機能
const cardTooltip = document.getElementById('card-tooltip');
const tooltipCardName = document.getElementById('tooltip-card-name');
const tooltipCardNumber = document.getElementById('tooltip-card-number');
const tooltipCardEffect = document.getElementById('tooltip-card-effect');

function showCardTooltip(cardNumber, event) {
  const cardDetails = getCardDetails(cardNumber);
  
  tooltipCardName.textContent = cardDetails.name;
  tooltipCardNumber.textContent = cardNumber;
  tooltipCardEffect.textContent = cardDetails.effect;
  
  // マウス位置にツールチップを表示
  const x = event.clientX;
  const y = event.clientY;
  const tooltipRect = cardTooltip.getBoundingClientRect();
  
  // 画面端での位置調整
  let left = x + 10;
  let top = y - 10;
  
  if (left + 250 > window.innerWidth) {
    left = x - 260;
  }
  if (top < 0) {
    top = y + 10;
  }
  if (top + tooltipRect.height > window.innerHeight) {
    top = window.innerHeight - tooltipRect.height - 10;
  }
  
  cardTooltip.style.left = `${left}px`;
  cardTooltip.style.top = `${top}px`;
  cardTooltip.classList.add('show');
}

function hideCardTooltip() {
  cardTooltip.classList.remove('show');
}

function updateTooltipPosition(event) {
  if (!cardTooltip.classList.contains('show')) return;
  
  const x = event.clientX;
  const y = event.clientY;
  
  let left = x + 10;
  let top = y - 10;
  
  if (left + 250 > window.innerWidth) {
    left = x - 260;
  }
  if (top < 0) {
    top = y + 10;
  }
  
  cardTooltip.style.left = `${left}px`;
  cardTooltip.style.top = `${top}px`;
}

// カード画像にツールチップイベントを追加する関数
function addCardTooltipEvents(cardElement, cardNumber) {
  if (!cardElement || cardNumber == null) return;
  
  cardElement.addEventListener('mouseenter', (e) => {
    showCardTooltip(cardNumber, e);
  });
  
  cardElement.addEventListener('mousemove', (e) => {
    updateTooltipPosition(e);
  });
  
  cardElement.addEventListener('mouseleave', () => {
    hideCardTooltip();
  });
}

// HTML から呼ぶもの
window.goToTitle = goToTitle;
window.surrender = surrender;
window.closeUsedCards = closeUsedCards;


