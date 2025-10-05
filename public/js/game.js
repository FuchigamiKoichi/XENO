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

// 未捕捉のPromiseエラーをキャッチ
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  console.error('Promise that was rejected:', event.promise);
  // エラーを防ぐ（オプション）
  event.preventDefault();
});

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
  const criticalImages = [getCardImagePath(0), getCardImagePath(1)];
  criticalImages.forEach(src => loadImageLazy(src));
});

// ログエリアのトグル機能
const logToggleBtn = document.getElementById('log-toggle');
const logCloseBtn = document.getElementById('log-close');
const logArea = document.getElementById('log-area');
const gameScreen = document.getElementById('gameScreen');

function toggleLog() {
  const isOpen = logArea.classList.contains('open');
  if (isOpen) {
    // ログエリアを閉じる
    logArea.classList.remove('open');
    gameScreen.classList.remove('log-open');
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
    deckCard.src = getCardImagePath(0); // 空の山札用画像（カード裏面を使用）
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

// 効果音の再生をカード番号ごとに統一
function playSEForCard(cardNum) {
  if (!window.audioManager) {
    return;
  }
  switch (cardNum) {
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

// カード詳細情報を取得する関数
function getCardDetails(cardNumber) {
  cardNumber = parseInt(cardNumber, 10);
  return messageManager.getCardInfo(cardNumber);
}

// カードを出す（自分）
async function playCard(cardNumber, isBarriered = false) {
  const imgSrc = getCardImagePath(cardNumber);
  const cardNum = parseInt(cardNumber, 10);

  // カード効果に応じて特別なSEを再生
  playSEForCard(cardNum);

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

  // カードエフェクトの実行（バリア情報を使用）
  if (cardNum === 6) {
    // カード6の場合は、サーバーからの応答（相手のカード情報含む）を待つ
    console.log('[Card6] Waiting for server response with hand info...');
    // エフェクトの実行は yourTurn の update で行う（相手のカード情報が必要なため）
    // ただし、バリア状態の確認はここで記録
    window.__lastPlayedCardBySelf = 6;
    window.__lastBarrierState = isBarriered;
  } else if (cardNum === 2) {
    // カード2（兵士）: 基本のカード効果アニメーションを先に実行
    console.log('[Card2 playCard] Executing basic card effect animation first');
    await Anim.playCardEffect(2, isBarriered);
  } else {
    // カード効果演出を実行（バリア状態を反映）
    await Anim.playCardEffect(cardNum, isBarriered);
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

// カードを出す（相手）- サーバーからのバリア情報付き
async function playCard_cpu_withBarrier(cardNumber, isBarriered) {
  console.log('playCard_cpu_withBarrier called with:', cardNumber, 'バリア:', isBarriered); // デバッグログ追加
  const imgSrc = getCardImagePath(cardNumber);
  const cardNum = parseInt(cardNumber, 10);
  // カード効果に応じて特別なSEを再生
  playSEForCard(cardNum);
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

// サーバーの update データから handInfo を構築
function buildHandInfoFromData(data) {
  const handInfo = {
    playerCards: Array.isArray(data?.myHands) ? data.myHands : [],
    opponentCards: [],
    gameState: data || null,
  };
  if (data && data.lookHands) {
    try {
      Object.keys(data.lookHands).forEach(turnNumber => {
        const cards = data.lookHands[turnNumber];
        if (Array.isArray(cards) && cards.length > 0) {
          handInfo.opponentCards.push(...cards);
        }
      });
    } catch (_) {}
  }
  return handInfo;
}

// 視点（攻撃側/防御側）を計算
function computePerspective(myTurnNumber, targetTurn) {
  if (typeof myTurnNumber === 'number' && typeof targetTurn === 'number') {
    return myTurnNumber === targetTurn ? 'defender' : 'attacker';
  }
  return 'attacker';
}

// カード2の防御側判定アニメーション実行（フォールバック）
async function executeCard2DefenderJudgment() {
  console.log('[Card2 Defender Fallback] Executing defender judgment animation');
  
  try {
    // 最後に受信したゲームデータから予想を取得する試行
    let guessedCard = null;
    
    // 最近のゲーム状態から予想を探す
    if (window.__lastGameData && window.__lastGameData.pred && window.__lastGameData.pred.length > 0) {
      const lastPred = window.__lastGameData.pred[window.__lastGameData.pred.length - 1];
      if (lastPred && lastPred.predCard) {
        guessedCard = parseInt(lastPred.predCard, 10);
        console.log('[Card2 Defender Fallback] Found prediction from last game data:', guessedCard);
      }
    }
    
    // currentGameStateからも確認
    if (!guessedCard && currentGameState && currentGameState.pred && currentGameState.pred.length > 0) {
      const predData = currentGameState.pred[currentGameState.pred.length - 1];
      if (predData && predData.choice) {
        guessedCard = parseInt(predData.choice, 10);
        console.log('[Card2 Defender Fallback] Found prediction in current game state:', guessedCard);
      } else if (predData && predData.predCard) {
        guessedCard = parseInt(predData.predCard, 10);
        console.log('[Card2 Defender Fallback] Found predCard in current game state:', guessedCard);
      }
    }
    
    // 攻撃者の手札から確率的に予想を生成（より現実的なフォールバック）
    if (!guessedCard || isNaN(guessedCard)) {
      // 自分の手札を確認して、最も可能性の高いカードを予想として使用
      const myCards = Array.from(playerHandZone.querySelectorAll('img')).map(img => {
        return parseInt(img.dataset.card || img.value, 10);
      }).filter(card => !isNaN(card));
      
      if (myCards.length > 0) {
        // 自分の手札の中からランダムに選択（相手が当てようとしそうなカード）
        guessedCard = myCards[Math.floor(Math.random() * myCards.length)];
        console.log('[Card2 Defender Fallback] Generated intelligent guess from own cards:', guessedCard);
      } else {
        // 最終フォールバック：完全ランダム
        guessedCard = Math.floor(Math.random() * 10) + 1;
        console.log('[Card2 Defender Fallback] Generated random guess:', guessedCard);
      }
    }
    
    // 自分の手札から判定
    const myCards = Array.from(playerHandZone.querySelectorAll('img')).map(img => {
      return parseInt(img.dataset.card || img.value, 10);
    }).filter(card => !isNaN(card));
    
    console.log('[Card2 Defender Fallback] My cards:', myCards, 'Opponent guessed:', guessedCard);
    
    const isHit = myCards.includes(guessedCard);
    console.log('[Card2 Defender Fallback] Judgment result - isHit:', isHit);
    
    // 判定アニメーション実行（防御側視点）
    if (Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
      console.log('[Card2 Defender Fallback] Starting guess announce animation');
      await Anim.enqueueGuessAnnounce(guessedCard, 'defender');
      console.log('[Card2 Defender Fallback] Guess announce animation completed');
    }
    
    if (Anim && typeof Anim.enqueueGuessResult === 'function') {
      console.log('[Card2 Defender Fallback] Starting guess result animation');
      await Anim.enqueueGuessResult(guessedCard, isHit, 'defender');
      console.log('[Card2 Defender Fallback] Guess result animation completed');
    }
    // フラグ設定：判定完了
    window.__card2JudgeDone = true;
    
  } catch (error) {
    console.error('[Card2 Defender Fallback] Error in fallback judgment:', error);
  }
}

// カード2の予想入力を要求
async function requestCard2Prediction() {
  return new Promise((resolve) => {
    // カードベースの予想入力UI
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: linear-gradient(135deg, #2c3e50, #34495e);
      padding: 30px;
      border-radius: 15px;
      text-align: center;
      max-width: 80vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    `;
    
    const title = document.createElement('h3');
    title.textContent = '相手のカードを予想してください';
    title.style.cssText = `
      color: #fff;
      font-size: 24px;
      margin-bottom: 25px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    
    const cardGrid = document.createElement('div');
    cardGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(80px, 120px));
      gap: 15px;
      justify-content: center;
      margin: 20px 0;
    `;
    
    // カード1-10の画像カードを作成
    for (let i = 1; i <= 10; i++) {
      const cardContainer = document.createElement('div');
      cardContainer.style.cssText = `
        position: relative;
        cursor: pointer;
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
        border: 3px solid transparent;
        background: #fff;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      `;
      
      const cardImage = document.createElement('img');
      cardImage.src = `/images/${i}.webp`;
      cardImage.alt = `カード${i}`;
      cardImage.style.cssText = `
        width: 100%;
        height: auto;
        display: block;
        transition: transform 0.3s ease;
      `;
      
      const cardNumber = document.createElement('div');
      cardNumber.textContent = i.toString();
      cardNumber.style.cssText = `
        position: absolute;
        bottom: 5px;
        right: 5px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      `;
      
      cardContainer.appendChild(cardImage);
      cardContainer.appendChild(cardNumber);
      
      // ホバーエフェクト
      cardContainer.addEventListener('mouseenter', () => {
        cardContainer.style.transform = 'scale(1.05) translateY(-5px)';
        cardContainer.style.borderColor = '#3498db';
        cardContainer.style.boxShadow = '0 8px 16px rgba(52, 152, 219, 0.4)';
      });
      
      cardContainer.addEventListener('mouseleave', () => {
        cardContainer.style.transform = 'scale(1) translateY(0)';
        cardContainer.style.borderColor = 'transparent';
        cardContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
      });
      
      cardContainer.addEventListener('click', () => {
        // クリックエフェクト
        cardContainer.style.transform = 'scale(0.95)';
        setTimeout(() => {
          document.body.removeChild(modal);
          resolve(i);
        }, 150);
      });
      
      cardGrid.appendChild(cardContainer);
    }
    
    content.appendChild(title);
    content.appendChild(cardGrid);
    modal.appendChild(content);
    document.body.appendChild(modal);
  });
}

// 予想データをゲーム状態に追加
function addPredictionToGameState(guessedCard) {
  if (!currentGameState) {
    currentGameState = {};
  }
  
  if (!currentGameState.pred) {
    currentGameState.pred = [];
  }
  
  const myTurn = currentGameState.myTurnNumber || 1;
  
  // 既存の予想を削除
  currentGameState.pred = currentGameState.pred.filter(p => p.subject !== myTurn);
  
  // 新しい予想を追加
  currentGameState.pred.push({
    subject: myTurn,
    predCard: guessedCard
  });
  
  console.log('[Card2] Added prediction to game state:', {
    subject: myTurn,
    predCard: guessedCard
  });
}

// カード2用のデモ判定結果を作成（予想データがない場合）
function createDemoCard2Judgment(isFromOpponent = false) {
  try {
    // 防御側の手札を取得
    let defenderCards = [];
    
    if (isFromOpponent) {
      // 相手側からの呼び出し：自分の手札が防御側
      defenderCards = Array.from(playerHandZone.querySelectorAll('img')).map(img => {
        return parseInt(img.dataset.card || img.value, 10);
      }).filter(card => !isNaN(card));
      console.log('[Card2 Demo] From opponent - using player cards as defender:', defenderCards);
    } else {
      // 自分側からの呼び出し：相手の手札が防御側
      defenderCards = Array.from(opponentHandZone.querySelectorAll('img')).map(img => {
        return parseInt(img.dataset.card || img.value, 10);
      }).filter(card => !isNaN(card));
      console.log('[Card2 Demo] From self - using opponent cards as defender:', defenderCards);
    }
    
    if (defenderCards.length === 0) {
      console.warn('[Card2 Demo] No defender cards available for demo judgment');
      // 防御側カードが取得できない場合はダミーデータを使用
      defenderCards = [Math.floor(Math.random() * 10) + 1]; 
      console.log('[Card2 Demo] Using dummy defender cards:', defenderCards);
    }
    
    // 予想データから実際の予想カードを取得
    let guessedCard;
    const myTurn = currentGameState?.myTurnNumber || 1;
    const predData = currentGameState?.pred;
    
    if (predData && Array.isArray(predData) && predData.length > 0) {
      // 実際の予想データを使用
      const attackerTurn = isFromOpponent ? (myTurn === 1 ? 2 : 1) : myTurn;
      const prediction = predData.find(p => p.subject === attackerTurn);
      guessedCard = prediction ? prediction.predCard : Math.floor(Math.random() * 10) + 1;
      console.log('[Card2 Demo] Using actual prediction:', guessedCard, 'from attacker turn:', attackerTurn);
    } else {
      // 予想データがない場合はランダム
      guessedCard = Math.floor(Math.random() * 10) + 1;
      console.log('[Card2 Demo] No prediction data, using random guess:', guessedCard);
    }
    
    const isHit = defenderCards.includes(guessedCard);
    
    // ターン番号を取得
    const targetTurn = isFromOpponent ? myTurn : (myTurn === 1 ? 2 : 1);
    
    const demoResult = {
      guessed: guessedCard,
      isHit: isHit,
      targetTurn: targetTurn
    };
    
    console.log('[Card2 Demo] Generated demo judgment:', demoResult, 'isFromOpponent:', isFromOpponent);
    return demoResult;
  } catch (e) {
    console.error('[Card2 Demo] Demo judgment creation failed:', e);
    return null;
  }
}

// カード2の予想判定をローカルで実行
function performCard2LocalJudgment(data) {
  try {
    const now = data.now || currentGameState;
    console.log('[Card2 Local] Input data.now:', now);
    
    if (!now || !now.pred || !Array.isArray(now.pred)) {
      console.warn('[Card2 Local] No prediction data available in now:', now);
      return null;
    }

    const myTurn = (typeof currentGameState?.myTurnNumber !== 'undefined')
      ? currentGameState.myTurnNumber
      : now.myTurnNumber;
    
    // カード2の使用者（攻撃者）と防御者を特定
    let attackerTurn, defenderTurn;
    
    // data.choiceがundefinedまたは2以外の場合はanotherTurnからの呼び出し
    const isFromAnotherTurn = !data.choice || data.choice != 2;
    
    if (isFromAnotherTurn) {
      // anotherTurnで来た場合：相手が攻撃者、自分が防御者
      attackerTurn = now.myTurnNumber;  // now は攻撃者視点
      defenderTurn = myTurn;            // 現在の自分は防御者
      console.log('[Card2 Local] Called from anotherTurn - opponent is attacker');
    } else {
      // playCardで来た場合：自分が攻撃者
      attackerTurn = myTurn;
      // 防御者を特定（相手のターン番号）
      if (now.otherPlayers && Object.keys(now.otherPlayers).length > 0) {
        defenderTurn = parseInt(Object.keys(now.otherPlayers)[0], 10);
      } else {
        console.warn('[Card2 Local] Cannot determine defender turn from otherPlayers');
        // 2人プレイを仮定してdefenderTurnを推定
        defenderTurn = attackerTurn === 1 ? 2 : 1;
        console.log('[Card2 Local] Assuming 2-player game, defenderTurn:', defenderTurn);
      }
      console.log('[Card2 Local] Called from playCard - self is attacker');
    }

    console.log('[Card2 Local] Attacker turn:', attackerTurn, 'Defender turn:', defenderTurn);
    
    const prediction = now.pred.find(p => p.subject === attackerTurn);
    if (!prediction) {
      console.warn('[Card2 Local] No prediction found for attacker turn', attackerTurn);
      return null;
    }

    console.log('[Card2 Local] Found prediction:', prediction);

    // 防御側の手札を確認
    let defenderCards;
    if (defenderTurn === myTurn) {
      // 自分が防御者の場合：DOMから取得
      defenderCards = Array.from(playerHandZone.querySelectorAll('img')).map(img => {
        return parseInt(img.dataset.card || img.value, 10);
      }).filter(card => !isNaN(card));
      console.log('[Card2 Local] Defender cards from DOM (self):', defenderCards);
    } else {
      // 相手が防御者の場合：attackerHands（サーバーから提供）を使用
      if (now.attackerHands && defenderTurn && now.attackerHands[defenderTurn]) {
        defenderCards = now.attackerHands[defenderTurn];
        console.log('[Card2 Local] Defender cards from server data (opponent):', defenderCards);
      } else {
        console.warn('[Card2 Local] Cannot get defender cards for opponent');
        return null;
      }
    }

    const guessedCard = prediction.predCard;
    const isHit = defenderCards.includes(guessedCard);

    const result = {
      guessed: guessedCard,
      isHit: isHit,
      targetTurn: defenderTurn
    };

    console.log('[Card2 Local] Final judgment result:', result);
    return result;
  } catch (e) {
    console.error('[Card2 Local] Judgment failed:', e);
    return null;
  }
}

// カード6用の基本handInfo構築（現在は直接anotherTurnで処理するため使用頻度低）
function buildCard6HandInfoForOpponent(isBarriered) {
  const handInfo = getCurrentHandInfo() || {};
  handInfo.onlyReveal = isBarriered
    ? { player: false, opponent: false }
    : { player: true, opponent: true };
  return handInfo;
}

// カード2（兵士）の判定結果処理
async function handleCard2Result(payload, data) {
  const { guessed, isHit, targetTurn } = payload.predResult || {};
  const myTurnNumber = (typeof currentGameState?.myTurnNumber !== 'undefined')
    ? currentGameState.myTurnNumber
    : data.now?.myTurnNumber;
  const perspective = (myTurnNumber && targetTurn) ? (myTurnNumber === targetTurn ? 'defender' : 'attacker') : 'attacker';
  
  console.log('[Card2] Starting prediction animation:', {
    guessed, isHit, targetTurn, myTurnNumber, perspective
  });
  
  try {
    if (Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
      console.log('[Card2] Starting guess announce animation');
      await Anim.enqueueGuessAnnounce(guessed, perspective);
      console.log('[Card2] Guess announce animation completed');
    }
    if (Anim && typeof Anim.enqueueGuessResult === 'function') {
      console.log('[Card2] Starting guess result animation');
      await Anim.enqueueGuessResult(guessed, !!isHit, perspective);
      console.log('[Card2] Guess result animation completed');
    }
    console.log('[Card2] All prediction animations completed successfully');
    return true; // 成功を明示的に返す
  } catch (error) {
    console.error('[Card2] Guess animation error:', error);
    return false; // エラーを明示的に返す
  }
}

// Promise追跡のユーティリティ関数
function trackAnimationPromise(promise, promiseType = 'self') {
  if (promiseType === 'self') {
    window.__lastSelfAnimPromise = promise;
    promise.finally(() => {
      if (window.__lastSelfAnimPromise === promise) {
        window.__lastSelfAnimPromise = null;
      }
    });
  } else if (promiseType === 'opponent') {
    window.__lastOpponentAnimPromise = promise;
    promise.finally(() => {
      if (window.__lastOpponentAnimPromise === promise) {
        console.log('[trackAnimationPromise] Opponent animation promise cleared');
        window.__lastOpponentAnimPromise = null;
      }
    });
  }
  return promise;
}

// カード6（貴族）のバリア結果処理
async function handleCard6Result(data) {
  const isBarriered = data.isBarriered || window.__lastBarrierState;
  console.log(`[Card6] Received result from server: isBarriered=${isBarriered}`);
  
  try {
    if (isBarriered) {
      // バリア時：無効化演出を表示
      console.log('[Card6] Playing barrier effect for self');
      if (Anim && typeof Anim.enqueueBarrierEffect === 'function') {
        await Anim.enqueueBarrierEffect();
      } else {
        await Anim.playBarrierEffect();
      }
      addLog('相手はカード4で守られているため、手札の確認ができませんでした！');
    } else {
      // 成功時：カード6を使った側は両方の手札の実際の画像でアニメーション
      console.log('[Card6] Playing effect with actual card images (attacker perspective)');
      
      // 最新の手札情報を強制的に再取得
      let handInfo = {
        playerCards: [],
        opponentCards: []
      };
      
      // 自分の手札情報を最新のゲーム状態から取得
      if (data && Array.isArray(data.myHands) && data.myHands.length > 0) {
        handInfo.playerCards = [...data.myHands]; // 配列をコピー
      } else if (currentGameState && Array.isArray(currentGameState.myHands)) {
        handInfo.playerCards = [...currentGameState.myHands];
      }
      
      // サーバーからの相手の手札情報を取得
      if (data && data.lookHands) {
        try {
          const opponentCards = [];
          Object.keys(data.lookHands).forEach(turnNumber => {
            const cards = data.lookHands[turnNumber];
            if (Array.isArray(cards) && cards.length > 0) {
              opponentCards.push(...cards);
            }
          });
          if (opponentCards.length > 0) {
            handInfo.opponentCards = opponentCards;
          }
        } catch (e) {
          console.warn('Failed to extract opponent cards from server data:', e);
        }
      }
      
      // 情報が不完全な場合の警告
      if (handInfo.playerCards.length === 0 || handInfo.opponentCards.length === 0) {
        console.warn('[Card6] Incomplete hand information:', handInfo);
      }
      
      console.log('[Card6] Hand info for attacker animation:', handInfo);
      // カード6を使った側は両方とも実際のカード画像を表示
      handInfo.onlyReveal = { player: true, opponent: true };
      await Anim.playCardEffect(6, false, handInfo);
      addLog('相手の手札を確認しました！');
    }
    
    // クリーンアップ
    window.__lastBarrierState = undefined;
  } catch (error) {
    console.error('[Card6] Effect animation error:', error);
  }
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
  const otherHands = data.now.otherHands;
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
      const choice = data.choices[0];
      const done = await Anim.drawCardToHand(choice);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(messageManager.getGameMessage('drawCard', { card: choice }));
        callback([0]);
      }
    }
  } else if (data.kind === 'opponentChoice') {
    Anim.stopTurnTimer();
    callback([0]);
  } else if (data.kind === 'play_card') {
    Anim.startTurnTimer();
    const idx = await selectPlayableFromHand(data.choices);
    const selectedCard = parseInt(data.choices[idx], 10);
    const isBarriered = data.isBarriered; // 相手のバリアが有効か
    
    addLog(messageManager.getGameMessage('playCard', { card: data.choices[idx] }));
    // addLog(messageManager.getGameMessage('work', {  }));
    if (window.audioManager) {
      window.audioManager.playSE('cardPlace');
    }
    console.log('Barrier状態:', isBarriered, 'カード:', selectedCard);
    
    // playCard関数にバリア状態を渡す
    const done = await playCard(data.choices[idx], isBarriered);
    if (done === 'done') {
      Anim.stopTurnTimer();
      callback([idx]);
    }
  } else if (data.kind === 'pred') {
    // カード2の予想処理（Card.jsのCard2.play()から呼ばれる）
    console.log('[Card2 pred] Processing prediction request from server');
    console.log('[Card2 pred] Available choices:', data.choices);
    console.log('[Card2 pred] Other hands data:', otherHands);
    
    try {
      // 予想入力を促す
      const guessedCard = await requestCard2Prediction();
      console.log('[Card2 pred] User predicted card:', guessedCard);
      
      // 相手の手札から判定（サーバーから提供されたデータを使用）
      let opponentCards = [];
      if (otherHands && otherHands.number) {
        if (Array.isArray(otherHands.number)) {
          opponentCards = otherHands.number.filter(card => !isNaN(parseInt(card, 10))).map(card => parseInt(card, 10));
        } else {
          opponentCards = [parseInt(otherHands.number, 10)].filter(card => !isNaN(card));
        }
      }
      
      console.log('[Card2 pred] Opponent cards for judgment:', opponentCards, 'Guessed card:', guessedCard);
      
      // 判定結果を計算
      const isHit = opponentCards.includes(guessedCard);
      console.log('[Card2 pred] Judgment result - isHit:', isHit);
      
      // 判定アニメーション実行（攻撃側視点）
      if (Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
        console.log('[Card2 pred] Starting guess announce animation');
        await Anim.enqueueGuessAnnounce(guessedCard, 'attacker');
        console.log('[Card2 pred] Guess announce animation completed');
      }
      
      if (Anim && typeof Anim.enqueueGuessResult === 'function') {
        console.log('[Card2 pred] Starting guess result animation');
        await Anim.enqueueGuessResult(guessedCard, isHit, 'attacker');
        console.log('[Card2 pred] Guess result animation completed');
      }
      
      // サーバーに予想選択を返す（data.choicesのインデックス）
      const choiceIndex = data.choices.findIndex(choice => parseInt(choice, 10) === guessedCard);
      const responseIndex = choiceIndex >= 0 ? choiceIndex : guessedCard - 1;
      
      console.log('[Card2 pred] Returning choice index:', responseIndex, 'for card:', guessedCard);
      callback([responseIndex]);
      
    } catch (error) {
      console.error('[Card2 pred] Error in prediction processing:', error);
      // エラー時はランダムな選択を返す
      const randomIndex = Math.floor(Math.random() * data.choices.length);
      callback([randomIndex]);
    }
  }else if (data.kind === 'update') {
    // yourTurn 側の update（カード効果結果処理）
    try {
      // カード6やその他のカードエフェクト結果処理
      if (data.isBarriered !== undefined && window.__lastPlayedCardBySelf) {
        const cardNumber = window.__lastPlayedCardBySelf;
        console.log(`[Card${cardNumber}] Received barrier result:`, data.isBarriered);
        console.log(`[Card${cardNumber}] Full data from server:`, data); // デバッグ用
        
        if (cardNumber === 6) {
          const card6EffectPromise = handleCard6Result(data);
          trackAnimationPromise(card6EffectPromise, 'self');
        }
        
        // 使用済みカード情報をクリア
        window.__lastPlayedCardBySelf = null;
      }
      
      // カード2の判定結果処理は削除 - playCard内でローカル判定を使用
    } catch (e) {
      console.warn('update handling error:', e);
    } finally {
      Anim.stopTurnTimer();
      callback([0]);
    }
  } else if (data.kind === 'show') {
    try {
      await show(data.choices);
      addLog(messageManager.getGameMessage('opponentHandReveal', { card: data.choices[0] }));
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

socket.on('anotherTurn', async (data) => {
  Anim.stopTurnTimer();
  console.log('anotherTurn received:', data); // デバッグログ追加
  // 直近のゲームデータを保持（フォールバック参照用）
  try { window.__lastGameData = data.now; } catch (_) {}
  
  if (data.kind === 'pred') {
    // カード2の予想処理（防御側視点）
    console.log('[Card2 anotherTurn pred] Processing prediction from opponent');
    console.log('[Card2 anotherTurn pred] Data received:', data);
    
    // タイムアウトをクリア（pred イベントが正常に届いた場合）
    if (window.__card2PredTimeout) {
      console.log('[Card2 anotherTurn pred] Clearing prediction timeout - pred event received');
      clearTimeout(window.__card2PredTimeout);
      window.__card2PredTimeout = null;
    }
    // pred受信フラグを立て、フォールバックの重複実行を防止
    window.__card2PredReceived = true;
    if (window.__card2JudgeDone) {
      console.log('[Card2 anotherTurn pred] Judgment already executed by fallback. Skipping pred animation.');
      return;
    }
    
    try {
      // 相手の予想カードを取得（サーバーのchoices配列とchoiceインデックスを使用）
      let guessedCard = parseInt(data.choice, 10);
      
      // 判定結果を計算
      const myCards = parseInt(data.now.myHands);
      const isHit = (myCards === guessedCard);
      console.log('[Card2 anotherTurn pred] Final judgment - guessed:', guessedCard, 'my cards:', myCards, 'isHit:', isHit);
      
      // 判定アニメーション実行（防御側視点）
      if (Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
        console.log('[Card2 anotherTurn pred] Starting guess announce animation');
        await Anim.enqueueGuessAnnounce(guessedCard, 'defender');
        console.log('[Card2 anotherTurn pred] Guess announce animation completed');
      }
      
      if (Anim && typeof Anim.enqueueGuessResult === 'function') {
        console.log('[Card2 anotherTurn pred] Starting guess result animation');
        await Anim.enqueueGuessResult(guessedCard, isHit, 'defender');
        console.log('[Card2 anotherTurn pred] Guess result animation completed');
      }
      // 判定完了フラグを設定
      window.__card2JudgeDone = true;
      
    } catch (error) {
      console.error('[Card2 anotherTurn pred] Error in prediction processing:', error);
    }
    
  } else if (data.kind === 'play_card') {
    console.log('相手がカードをプレイ:', data.choice, 'バリア効果:', data.isBarriered); // デバッグログ追加
    // 直近のプレイカード番号を保持（リザルト遷移のグレース待機に利用）
    try { window.__lastPlayedCard = parseInt(data.choice, 10); } catch (_) {}

    const cardNum = parseInt(data.choice, 10);
    
    // カード2の場合は、pred イベントが来ない可能性があるため、ここで判定アニメーションの準備をする
    if (cardNum === 2) {
      console.log('[Card2 anotherTurn play_card] Card 2 played by opponent, awaiting pred event (no guessedCard fallback).');
      // pred受信・判定状態を初期化
      window.__card2PredReceived = false;
      window.__card2JudgeDone = false;
      // タイムアウト時は不一致演出を避けるため何もしない
      window.__card2PredTimeout = setTimeout(() => {
        if (window.__card2PredReceived || window.__card2JudgeDone) {
          console.log('[Card2 anotherTurn play_card] Timeout reached but pred received or already judged. No action needed.');
          return;
        }
        console.warn('[Card2 anotherTurn play_card] pred event timeout. Skipping guess animations to avoid incorrect display.');
      }, 12000);
    }
    const text = getEffectDescription(cardNum);

    // handInfo 準備（カード6のみ開示フラグを調整）
    let handInfo;
    if (cardNum === 6) {
      // カード6の場合：最新の手札情報を取得
      handInfo = getCurrentHandInfo() || {};
      
      // サーバーから攻撃者（相手）の手札情報が来ている場合は更新
      if (data.now && data.now.attackerHands) {
        console.log('[Card6 anotherTurn] Using fresh attacker hands from server:', data.now.attackerHands);
        handInfo.opponentCards = data.now.attackerHands;
      }
      
      // 自分の手札も最新の状態に更新（DOMから取得）
      const currentPlayerCards = Array.from(playerHandZone.querySelectorAll('img')).map(img => {
        return parseInt(img.dataset.card || img.value, 10);
      }).filter(card => !isNaN(card));
      
      if (currentPlayerCards.length > 0) {
        handInfo.playerCards = currentPlayerCards;
        console.log('[Card6 anotherTurn] Updated player cards from DOM:', currentPlayerCards);
      }
      
      // バリア状態に応じて表示フラグを設定
      if (data.isBarriered) {
        handInfo.onlyReveal = { player: false, opponent: false };
      } else {
        handInfo.onlyReveal = { player: true, opponent: true };
      }
    } else {
      handInfo = getCurrentHandInfo() || {};
    }

    // 防御側にも無効化演出を見せる（カード6のバリア時）
    if (cardNum === 6 && data.isBarriered && Anim && typeof Anim.enqueueBarrierEffect === 'function') {
      console.log('[anotherTurn] defender enqueue barrier effect');
      Anim.enqueueBarrierEffect();
    }

    // 後でリザルト遷移時に待つため、最後の相手演出のPromiseを保持
    const baseOpponentPromise = Anim.enqueueOpponentPlay(
      cardNum,
      !!data.isBarriered,
      handInfo,
      text
    );

    // カード2の判定演出は別途 pred イベントで処理されるため、ここでは基本演出のみ
    window.__lastOpponentAnimPromise = baseOpponentPromise;

    addLog(messageManager.getGameMessage('opponentPlayCard', { card: data.choice }));
  } else if (data.kind === 'draw') {
    // カードドロー処理
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

  } else if (data.kind === 'update') {
    // 相手側からの update 通知 - 主にカード2判定で使用されていたが、現在はplay_cardで処理
    console.log('[anotherTurn update] Received update (legacy):', data);
    // 現在はplay_cardイベントでローカル判定するため、updateイベントは主に使用されない
    // 念のため残すが、基本的にplay_cardで処理済み
  }
});

socket.on('gameEnded', async (data) => {
  Anim.stopTurnTimer();
  // 相手演出が残っていれば完了を待つ
  console.log('[gameEnded] Starting result transition with animation wait...');
  try {
    // 相手の演出待機
    if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
      console.log('[gameEnded] Waiting for opponent animation to complete...');
      await window.__lastOpponentAnimPromise.catch(() => {});
      console.log('[gameEnded] Opponent animation completed');
    } else {
      console.log('[gameEnded] No opponent animation to wait for');
    }
    // 自分の演出待機（カード6など）
    if (window.__lastSelfAnimPromise && typeof window.__lastSelfAnimPromise.then === 'function') {
      console.log('[gameEnded] Waiting for self animation to complete...');
      await window.__lastSelfAnimPromise.catch(() => {});
      console.log('[gameEnded] Self animation completed');
    } else {
      console.log('[gameEnded] No self animation to wait for');
    }
    // 念のためFXレーンのアイドルも待つ（最大3秒に延長）
    if (Anim && typeof Anim.waitForFxIdle === 'function') {
      console.log('[gameEnded] Waiting for FX idle...');
      await Anim.waitForFxIdle(3000);
      console.log('[gameEnded] FX idle completed');
    }
  } catch (e) {
    console.debug('result navigation wait error:', e);
  }

  // アニメーション待機の成功・失敗に関わらず、リザルト画面に遷移
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
});

socket.on('redirectToResult', async (data) => {
  console.log('[redirectToResult] Starting result transition...');
  if (!data || !data.url) return;
  // 相手演出が残っていれば完了を待つ（待機時間を短縮）
  try {
    // 相手の演出待機
    if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
      console.log('[redirectToResult] Waiting for opponent animation to complete...');
      await window.__lastOpponentAnimPromise.catch(() => {});
      console.log('[redirectToResult] Opponent animation completed');
    } else {
      console.log('[redirectToResult] No opponent animation to wait for');
    }
    // 自分の演出待機（カード6など）
    if (window.__lastSelfAnimPromise && typeof window.__lastSelfAnimPromise.then === 'function') {
      console.log('[redirectToResult] Waiting for self animation to complete...');
      await window.__lastSelfAnimPromise.catch(() => {});
      console.log('[redirectToResult] Self animation completed');
    } else {
      console.log('[redirectToResult] No self animation to wait for');
    }
    if (Anim && typeof Anim.waitForFxIdle === 'function') {
      console.log('[redirectToResult] Waiting for FX idle...');
      await Anim.waitForFxIdle(3000); // 3秒に延長
      console.log('[redirectToResult] FX idle completed');
    }
  } catch (e) {
    console.debug('redirect wait error:', e);
  }
  console.log('[redirectToResult] Navigating to:', data.url);
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


