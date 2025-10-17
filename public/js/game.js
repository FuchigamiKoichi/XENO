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

// ゲーム終了監視用変数
let connectionCheckInterval = null;
let gameEndTimeout = null;
let gameEnded = false;
let redirectProcessing = false;
let isCPUGame = false;  // CPU対戦かどうかのフラグ

// メッセージ初期化
initializeMessages();

// SocketHandlers初期化
if (typeof SocketHandlers !== 'undefined') {
  SocketHandlers.isAnimationInProgress = false;
  SocketHandlers.timeoutWarningTimer = null;
}

// ===============================
// Error Handling & Logging
// ===============================
// DOM & Image Utilities
// ===============================

const imageCache = new Map();

const DOMUtils = {
  /**
   * 画像を遅延読み込みしてキャッシュする
   * @param {string} src - 画像のURL
   * @returns {Promise<HTMLImageElement>} 読み込み完了した画像要素
   */
  loadImageLazy(src) {
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
  },

  /**
   * DOM要素を作成
   * @param {string} tagName - タグ名
   * @param {Object} options - オプション
   * @returns {HTMLElement} 作成された要素
   */
  createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    if (options.className) {
      element.className = options.className;
    }
    
    if (options.textContent) {
      element.textContent = options.textContent;
    }
    
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    
    if (options.styles) {
      Object.entries(options.styles).forEach(([key, value]) => {
        element.style[key] = value;
      });
    }
    
    return element;
  },

  /**
   * 安全にイベントリスナーを追加
   * @param {Element} element - 対象要素
   * @param {string} event - イベントタイプ
   * @param {Function} handler - イベントハンドラー
   */
  addEventListenerSafe(element, event, handler) {
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, handler);
    }
  }
};



// カード番号から画像パスを取得
function getCardImagePath(cardNum) {
  return `../images/${cardNum}.webp`;
}

// ===============================
// Initialization
// ===============================

// ゲーム開始時にBGMを再生とUI初期化
document.addEventListener('DOMContentLoaded', () => {
  // UI初期化
  initializeUI();
  
  // ユーザーの操作後にBGMを開始（自動再生ポリシー対応）
  const startBGMOnInteraction = () => {
    startMainBGM();
    document.removeEventListener('click', startBGMOnInteraction);
    document.removeEventListener('keydown', startBGMOnInteraction);
  };
  
  document.addEventListener('click', startBGMOnInteraction);
  document.addEventListener('keydown', startBGMOnInteraction);
  
  // 重要なカード画像を事前読み込み（背面、基本カードなど）
  const criticalImages = [getCardImagePath(0), getCardImagePath(1)];
  criticalImages.forEach(src => DOMUtils.loadImageLazy(src));
});

// ログエリアのトグル機能
const logToggleBtn = document.getElementById('log-toggle');
const logCloseBtn = document.getElementById('log-close');
const logArea = document.getElementById('log-area');
const gameScreen = document.getElementById('gameScreen');

// ===============================
// UI Management
// ===============================

const UIManager = {
  /**
   * ログエリアの表示を切り替え
   */
  toggleLog() {
    const isOpen = logArea.classList.contains('open');
    if (isOpen) {
      this.closeLog();
    } else {
      this.openLog();
    }
  },

  /**
   * ログエリアを開く
   */
  openLog() {
    logArea.classList.add('open');
    gameScreen.classList.add('log-open');
    logToggleBtn.textContent = '✖'; // 開いた状態のアイコン（×で閉じることを示す）
  },

  /**
   * ログエリアを閉じる
   */
  closeLog() {
    logArea.classList.remove('open');
    gameScreen.classList.remove('log-open');
    logToggleBtn.textContent = '📋'; // 閉じた状態のアイコン（ログを開くことを示す）
  },

  /**
   * メニューを開く
   */
  openMenu() {
    menuList.classList.add('open');
    menuToggle.setAttribute('aria-expanded', 'true');
  },

  /**
   * メニューを閉じる
   */
  closeMenu() {
    menuList.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  },

  /**
   * メニューの表示を切り替え
   */
  toggleMenu() {
    if (menuList.classList.contains('open')) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  },

  /**
   * モーダルを表示
   * @param {HTMLElement} modal - モーダル要素
   */
  showModal(modal) {
    if (modal) {
      modal.style.display = 'block';
    }
  },

  /**
   * モーダルを非表示
   * @param {HTMLElement} modal - モーダル要素
   */
  hideModal(modal) {
    if (modal) {
      modal.style.display = 'none';
    }
  },

  /**
   * ログメッセージを追加
   * @param {string} message - ログメッセージ
   */
  addLog(message) {
    const logMessages = document.getElementById('log-messages');
    if (!logMessages) return;

    // ユーザーが最下部近くにいるかチェック（20px以内なら自動スクロール）
    const isNearBottom = logMessages.scrollHeight - logMessages.scrollTop - logMessages.clientHeight < 20;
    
    const d = DOMUtils.createElement('div', {
      textContent: message,
      styles: { wordWrap: 'break-word' }
    });
    
    logMessages.appendChild(d);
    
    // 最下部近くにいた場合のみ自動スクロール
    if (isNearBottom) {
      logMessages.scrollTop = logMessages.scrollHeight;
    }
  },

  /**
   * 結果を表示
   * @param {string} message - 結果メッセージ
   */
  showResult(message) {
    const el = document.getElementById('showResult');
    if (el) {
      el.innerHTML = message;
      el.style.display = 'block';
    }
  },

  /**
   * セレクトUIを非表示
   */
  hideSelect() {
    if (selectContainer) {
      selectContainer.style.display = 'none';
    }
  },

  /**
   * ショーUIを非表示
   */
  hideShow() {
    if (showContainer) {
      showContainer.style.display = 'none';
    }
  }
};

// UI初期化とイベントリスナー設定
const initializeUI = () => {
  // ログエリアのイベントリスナー
  if (logToggleBtn) {
    // 初期状態のアイコンを設定
    logToggleBtn.textContent = '📋';
    DOMUtils.addEventListenerSafe(logToggleBtn, 'click', () => UIManager.toggleLog());
  }

  if (logCloseBtn) {
    DOMUtils.addEventListenerSafe(logCloseBtn, 'click', () => UIManager.closeLog());
  }

  // ログエリア外をクリックした時に閉じる
  DOMUtils.addEventListenerSafe(document, 'click', (e) => {
    if (logArea && logArea.classList.contains('open') && 
        !logArea.contains(e.target) && 
        !logToggleBtn.contains(e.target)) {
      UIManager.closeLog();
    }
  });
};

// 後方互換性のためのエイリアス
const toggleLog = UIManager.toggleLog.bind(UIManager);
const addLog = UIManager.addLog.bind(UIManager);
const showResult = UIManager.showResult.bind(UIManager);
const hideSelect = UIManager.hideSelect.bind(UIManager);
const hideShow = UIManager.hideShow.bind(UIManager);

// Anim 初期化（アニメ側へDOMを注入）
Anim.init({
  playerHandZone,
  opponentHandZone,
  playArea,
  opponentArea,
  timerBar,
  longSec: 60, // 1分に設定
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

// メニュー管理関数（UIManagerで統一）
const openMenu = UIManager.openMenu.bind(UIManager);
const closeMenu = UIManager.closeMenu.bind(UIManager);
const toggleMenu = UIManager.toggleMenu.bind(UIManager);

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
      playDecisionSE();
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
  updateAudioUI({
    bgmVolumeSlider,
    seVolumeSlider,
    muteToggle,
    bgmVolumeValue,
    seVolumeValue
  });
  
  // SE再生時間の初期値を設定
  const selectedSE = seSelect.value;
  const duration = getSEDuration(selectedSE);
  seDurationSlider.value = duration;
  seDurationValue.textContent = duration.toFixed(1) + '秒';
});

// 音量設定モーダルを閉じる
closeAudioBtn.addEventListener('click', () => {
  audioModal.style.display = 'none';
});

// BGM音量調整
bgmVolumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value / 100;
  bgmVolumeValue.textContent = e.target.value + '%';
  setBGMVolume(volume);
});

// SE音量調整
seVolumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value / 100;
  seVolumeValue.textContent = e.target.value + '%';
  setSEVolume(volume);
});

// ミュート切り替え
muteToggle.addEventListener('change', (e) => {
  setMute(e.target.checked);
});

// SEテスト
testSEButton.addEventListener('click', () => {
  playDecisionSE();
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

// ===============================
// Audio & Game Utilities
// ===============================
function getEffectDescription(cardNumber) {
  return messageManager.getEffectMessage(cardNumber);
}

// カード詳細情報を取得する関数
function getCardDetails(cardNumber) {
  cardNumber = parseInt(cardNumber, 10);
  return messageManager.getCardInfo(cardNumber);
}

// カードを出す（自分）
async function playCard(cardNumber, isBarriered = false, handInfo) {
  const imgSrc = getCardImagePath(cardNumber);
  const cardNum = parseInt(cardNumber, 10);

  // カード効果に応じて特別なSEを再生
  playCardSE(cardNum);

  // 手札から該当1枚を除去
  const myHands = playerHandZone.querySelectorAll('img');
  for (let i = 0; i < myHands.length; i++) {
    if (parseInt(myHands[i].value, 10) === parseInt(cardNumber, 10)) {
      playerHandZone.removeChild(myHands[i]);
      break;
    }
  }

  const text  = getEffectDescription(cardNumber);

  // ズーム演出（完了待ち）
  await Anim.zoomCard(imgSrc, text, 1.0);

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

  if (isBarriered && [1,2,3,5,6,8,9].includes(cardNum)){
    await Anim.playBarrierEffect();
  }else{
    await Anim.playCardEffect( cardNum, isBarriered, handInfo);
  }

  return 'done';
}

// 現在の手札情報を取得する
function getCurrentHandInfo(data) {
  let playerCards = []
  for (let i=0; i<Object.keys(data.now.myHands).length; i++){
    let key = Object.keys(data.now.myHands)[i];
    playerCards.push(data.now.myHands[key]);
  }

  let opponentCards = []
  for (let i=0; i<Object.keys(data.now.otherHands).length; i++){
    let key = Object.keys(data.now.otherHands)[i];
    opponentCards.push(data.now.otherHands[key]);
  }

  console.log('手札情報取得 - プレイヤー(DOM優先):', playerCards, '相手:', opponentCards);

  return {
    playerCards,
    opponentCards
  };
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

// ログ/結果関数は UIManager で統一済み

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

// セレクト/ショー非表示関数は UIManager で統一済み

// ===== ソケット =====
// ===============================
// Socket Event Handlers
// ===============================

socket.on('yourTurn', async (data, callback) => {
  await updateGameView(data.now);
  
  switch (data.kind) {
    case 'draw':
      await SocketHandlers.handleDraw(data, callback);
      break;
    case 'opponentChoice':
      Anim.stopTurnTimer();
      callback([0]);
      break;
    case 'play_card':
      await SocketHandlers.Card(data, callback);
      break;
    case 'pred':
      await SocketHandlers.handlePrediction(data, callback);
      break;
    case 'update':
      callback([0]);
      break;
    case 'show':
      await SocketHandlers.handleShow(data, callback);
      break;
    case 'trash':
      await SocketHandlers.handleTrash(data, callback);
      break;
    default:
      await SocketHandlers.handleDefault(data, callback);
      break;
  }
});

socket.on('anotherTurn', async (data) => {
  const isBarriered = data.isBarriered;
  Anim.stopTurnTimer();
  console.log('anotherTurn received:', data); // デバッグログ追加
  // 直近のゲームデータを保持（フォールバック参照用）
  if (data.now) {
    window.__lastGameData = data.now;
  }
  
  // trashイベントの場合は、アニメーション実行前にupdateGameViewを呼ばない
  // 手札の現在状態を保持してアニメーションを実行する
  if (data.kind === 'trash') {
    // trash処理（自分のカードが捨てられる場合）
    console.log('自分のカードがtrashされる:', data);
    
    if (data.choice !== undefined) {
      const trashedCard = parseInt(data.choice, 10);
      console.log(`自分のカード${trashedCard}が捨てられます`);
      
      // アニメーション実行（ゲーム状態更新前に手札の現在の状態でアニメーション）
      console.log('trashアニメーション実行前の手札状態確認');
      await Anim.enqueuePlayerTrash(trashedCard);
      
      // アニメーション完了後にログのみ追加（ゲーム状態更新は行わない）
      addLog(`あなたのカード${trashedCard}が捨てられました`);
      
      // 注意: data.nowは相手視点のデータなので、updateGameView()は呼ばない
      // ゲーム状態の更新は次のyourTurnイベントで正しく行われる
      console.log('trash処理完了：ゲーム状態更新は次のyourTurnイベントを待機');
    }
    return; // 他の処理をスキップ
  }
  
  if (data.kind === 'pred') {
    // カード2の予想処理（防御側視点）
    console.log('[Card2 anotherTurn pred] Processing prediction from opponent');
    console.log('[Card2 anotherTurn pred] Data received:', data);
    
    try {
      // 相手の予想カードを取得（サーバーのchoices配列とchoiceインデックスを使用）
      let guessedCard = parseInt(data.choice, 10);
      
      // 判定結果を計算
      const handInfo = getCurrentHandInfo(data);
      const myCards = parseInt(handInfo.opponentCards);
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
    if (data.choice !== undefined) {
      window.__lastPlayedCard = parseInt(data.choice, 10);
    }

    const cardNum = parseInt(data.choice, 10);
    
    // カード2の場合は、ここで判定アニメーションの準備をする
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
    
    // trashカード（5: 下痢、9: 悪魔）の場合、相手側でもアニメーション準備
    if (cardNum === 5 || cardNum === 9) {
      console.log(`[anotherTurn play_card] trashカード${cardNum}が使用されました - 後続のtrashイベントでアニメーション実行予定`);
    }
    const text = getEffectDescription(cardNum);

    let handInfo;
    handInfo = getCurrentHandInfo(data) || {};
    // const myCard = handInfo.opponentCards;
    // handInfo.opponentCards = handInfo.playerCards;
    // handInfo.playerCards = myCard;

    // 防御側にも無効化演出を見せる
    if (isBarriered && [1,2,3,5,6,8,9].includes(cardNum) ) {
      console.log('[anotherTurn] defender enqueue barrier effect');
      Anim.enqueueBarrierEffect();
    }else {
      // 後でリザルト遷移時に待つため、最後の相手演出のPromiseを保持
      const baseOpponentPromise = Anim.enqueuePlay(
        cardNum,
        isBarriered,
        handInfo,
        text
      );

      window.__lastOpponentAnimPromise = baseOpponentPromise;
    }

    addLog(messageManager.getGameMessage('opponentPlayCard', { card: data.choice }));
  } else if (data.kind === 'draw') {
    // カードドロー処理
    playCardDealSE();
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
  clearTimeout(gameEndTimeout);
  console.log('[GameEndMonitor] Game ended normally, stopping monitoring');
  console.log('[gameEnded] Received gameEnded event with data:', data);
  gameEnded = true;  // ゲーム終了フラグを設定
  
  Anim.stopTurnTimer();
  // 相手演出が残っていれば完了を待つ
  console.log('[gameEnded] Starting result transition with animation wait...');
  
  // プレイヤー対戦の場合、より短いタイムアウトでアニメーション待機
  const isPlayerVsPlayer = !isCPUGame;
  const animationTimeout = isPlayerVsPlayer ? 3000 : 5000;  // プレイヤー対戦では3秒
  const overallTimeout = isPlayerVsPlayer ? 6000 : 10000;   // 全体で6秒
  try {
    // タイムアウト付きでアニメーション待機
    const animationPromises = [];
    
    if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
      console.log('[gameEnded] Waiting for opponent animation to complete...');
      animationPromises.push(
        Promise.race([
          window.__lastOpponentAnimPromise,
          new Promise(resolve => setTimeout(() => {
            console.log('[gameEnded] Opponent animation timeout');
            resolve();
          }, animationTimeout))
        ])
      );
    }
    
    if (window.__lastSelfAnimPromise && typeof window.__lastSelfAnimPromise.then === 'function') {
      console.log('[gameEnded] Waiting for self animation to complete...');
      animationPromises.push(
        Promise.race([
          window.__lastSelfAnimPromise,
          new Promise(resolve => setTimeout(() => {
            console.log('[gameEnded] Self animation timeout');
            resolve();
          }, animationTimeout))
        ])
      );
    }
    
    if (Anim && typeof Anim.waitForFxIdle === 'function') {
      console.log('[gameEnded] Waiting for FX idle...');
      animationPromises.push(
        Promise.race([
          Anim.waitForFxIdle(animationTimeout * 0.8),  // FX待機時間を短縮
          new Promise(resolve => setTimeout(() => {
            console.log('[gameEnded] FX idle timeout');
            resolve();
          }, animationTimeout))
        ])
      );
    }
    
    // 全てのアニメーション待機を並列実行
    await Promise.race([
      Promise.all(animationPromises),
      new Promise(resolve => setTimeout(() => {
        console.log('[gameEnded] Overall animation timeout reached');
        resolve();
      }, overallTimeout))
    ]);
    
    console.log('[gameEnded] Animation wait completed or timed out');
    
  } catch (e) {
    console.error('result navigation wait error:', e);
    // エラーが発生してもリザルト画面への遷移は継続する
  }

  // リザルト画面への遷移
  navigateToResult(data);
});

// より確実なページ遷移処理
function safeNavigateToResult(url) {
  console.log('[SafeNavigation] Attempting navigation to:', url);
  
  // 重複実行を防ぐ
  if (window.navigationInProgress || redirectProcessing) {
    console.log('[SafeNavigation] Navigation already in progress, skipping');
    return;
  }
  window.navigationInProgress = true;
  redirectProcessing = true;
  
  // アニメーション完了待機（最大2秒）
  const waitForAnimations = async () => {
    try {
      if (window.__lastOpponentAnimPromise) {
        await Promise.race([window.__lastOpponentAnimPromise, new Promise(resolve => setTimeout(resolve, 2000))]);
      }
      if (window.__lastSelfAnimPromise) {
        await Promise.race([window.__lastSelfAnimPromise, new Promise(resolve => setTimeout(resolve, 2000))]);
      }
      if (Anim && typeof Anim.waitForFxIdle === 'function') {
        await Promise.race([Anim.waitForFxIdle(2000), new Promise(resolve => setTimeout(resolve, 2000))]);
      }
    } catch (e) {
      console.warn('[SafeNavigation] Animation wait error:', e);
    }
  };
  
  const attemptNavigation = async () => {
    await waitForAnimations();
    
    try {
      // 方法1: location.replace()を試す
      location.replace(url);
    } catch (e1) {
      console.warn('[SafeNavigation] location.replace() failed:', e1);
      
      setTimeout(() => {
        try {
          // 方法2: location.href を試す  
          window.location.href = url;
        } catch (e2) {
          console.warn('[SafeNavigation] location.href failed:', e2);
          
          setTimeout(() => {
            try {
              // 方法3: history.pushState() + location.reload()
              history.pushState(null, '', url);
              window.location.reload();
            } catch (e3) {
              console.error('[SafeNavigation] All navigation methods failed:', e3);
              
              // 方法4: ユーザーに手動遷移を促す
              const userConfirm = confirm(`ゲームが終了しました。結果画面に移動しますか？\n${url}`);
              if (userConfirm) {
                window.open(url, '_self');
              }
            }
          }, 500);
        }
      }, 500);
    }
  };
  
  attemptNavigation();
}

// リザルト遷移を分離して確実に実行
function navigateToResult(data) {
  console.log('[gameEnded] Navigating to result...');
  
  if (redirectProcessing) {
    console.log('[navigateToResult] Redirect already processing, skipping');
    return;
  }
  redirectProcessing = true;
  
  if (window.audioManager) {
    window.audioManager.stopBGM();
    window.audioManager.playBGM('ending', false);
  }
  
  const resultString = data.result.toString();
  let reason = 'ゲーム終了';
  const match = resultString.match(/\((.*)\)/);
  if (match) {
    reason = match[1];
  }
  
  const encodedReason = encodeURIComponent(reason);
  const resultUrl = `result.html?roomId=${roomId}&playerId=${playerId}&players=${players}&result=${resultString}&reason=${encodedReason}`;
  
  console.log('[gameEnded] Final navigation to:', resultUrl);
  safeNavigateToResult(resultUrl);
}

// ゲーム終了の監視開始
function startGameEndMonitoring() {
  console.log('[GameEndMonitor] Starting game end monitoring...');
  
  // プレイヤー対戦では20秒、CPU対戦では30秒でタイムアウト
  const timeoutDuration = isCPUGame ? 30000 : 20000;
  
  gameEndTimeout = setTimeout(() => {
    console.warn('[GameEndMonitor] Game end timeout reached, checking status...');
    checkGameEndStatus();
  }, timeoutDuration);
  
  // プレイヤー対戦では追加の安全確認を15秒後にも実行
  if (!isCPUGame) {
    setTimeout(() => {
      if (gameEnded && !redirectProcessing) {
        console.warn('[GameEndMonitor] Early safety check - game ended but no redirect started');
        checkGameEndStatus();
      }
    }, 15000);
  }
}

// ゲーム終了状態をポーリングで確認
function checkGameEndStatus() {
  if (!socket.connected) {
    console.warn('[GameEndMonitor] Socket disconnected, attempting reconnection...');
    socket.connect();
    
    // 接続失敗時はローカル状態で判定
    setTimeout(() => {
      if (!socket.connected && gameEnded) {
        console.warn('[GameEndMonitor] Connection failed, using local game state for navigation');
        const fallbackUrl = `result.html?result=disconnect&reason=${encodeURIComponent('接続失敗')}&roomId=${roomId}&playerId=${playerId}`;
        safeNavigateToResult(fallbackUrl);
      }
    }, 3000);
    return;
  }
  
  // サーバーにゲーム状態を問い合わせ（タイムアウト付き）
  const statusCheckTimeout = setTimeout(() => {
    console.warn('[GameEndMonitor] Server status check timeout, using fallback navigation');
    if (gameEnded) {
      const fallbackUrl = `result.html?result=timeout&reason=${encodeURIComponent('サーバー応答タイムアウト')}&roomId=${roomId}&playerId=${playerId}`;
      safeNavigateToResult(fallbackUrl);
    }
  }, 5000);
  
  socket.emit('checkGameStatus', { roomId, playerId }, (response) => {
    clearTimeout(statusCheckTimeout);
    
    if (response && response.gameEnded) {
      console.log('[GameEndMonitor] Server confirmed game ended, forcing result navigation...');
      
      const resultUrl = response.resultUrl || 
        `result.html?result=timeout&reason=${encodeURIComponent('接続タイムアウト')}&roomId=${roomId}&playerId=${playerId}&players=${players}`;
      
      safeNavigateToResult(resultUrl);
    } else if (gameEnded) {
      // ローカルでは終了しているがサーバーは継続中の場合
      console.warn('[GameEndMonitor] Local game ended but server says continuing - using local state');
      const localUrl = `result.html?result=local&reason=${encodeURIComponent('ローカル終了検出')}&roomId=${roomId}&playerId=${playerId}`;
      safeNavigateToResult(localUrl);
    } else {
      console.log('[GameEndMonitor] Game still in progress according to server');
    }
  });
}

// 接続状態の監視
socket.on('connect', () => {
  console.log('[Socket] Connected to server');
  clearInterval(connectionCheckInterval);
});

socket.on('disconnect', () => {
  console.warn('[Socket] Disconnected from server, starting reconnection monitoring...');
  
  connectionCheckInterval = setInterval(() => {
    if (!socket.connected) {
      console.log('[Socket] Attempting reconnection...');
      socket.connect();
    } else {
      clearInterval(connectionCheckInterval);
    }
  }, 5000);
});

socket.on('redirectToResult', async (data) => {
  clearTimeout(gameEndTimeout);
  console.log('[GameEndMonitor] Redirect received, stopping monitoring');
  console.log('[redirectToResult] Received redirect event with data:', data);
  
  console.log('画面遷移:', data.url);
  if (!data || !data.url) return;
  // 相手演出が残っていれば完了を待つ（待機時間を短縮）
  try {
    // 相手の演出待機
    if (window.__lastOpponentAnimPromise && typeof window.__lastOpponentAnimPromise.then === 'function') {
      console.log('[redirectToResult] Waiting for opponent animation to complete...');
      await window.__lastOpponentAnimPromise;
      console.log('[redirectToResult] Opponent animation completed');
    } else {
      console.log('[redirectToResult] No opponent animation to wait for');
    }
    // 自分の演出待機（カード6など）
    if (window.__lastSelfAnimPromise && typeof window.__lastSelfAnimPromise.then === 'function') {
      console.log('[redirectToResult] Waiting for self animation to complete...');
      await window.__lastSelfAnimPromise;
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
    console.error('redirect wait error:', e);
    // エラーが発生してもリダイレクトは継続する
  }
  location.replace(data.url);
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
  
  // CPU対戦かどうかを判定（URL パラメータから）
  const urlParams = new URLSearchParams(window.location.search);
  const cpuMode = urlParams.get('cpu');
  isCPUGame = (cpuMode === 'true' || cpuMode === '1');
  console.log(`[GameSetup] CPU Game Mode: ${isCPUGame}`);
  
  // ゲーム開始時のシャッフルアニメーション
  await Anim.shuffleCards(1.5);
  
  // ゲーム終了監視を開始
  startGameEndMonitoring();
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
