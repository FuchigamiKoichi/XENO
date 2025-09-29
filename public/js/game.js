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

// ルールモーダル
ruleButton.onclick = () => { ruleModal.style.display = 'block'; };
closeRuleBtn.addEventListener('click', () => { ruleModal.style.display = 'none'; });

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

// 画面更新
function updateGameView(now) {
  playerHandZone.innerHTML = '';
  playArea.innerHTML = '';
  opponentArea.innerHTML = '';
  deckContainer.innerHTML = "<div id='deck-count'></div><div id='side-card-container'></div>";
  const sideContainer = document.getElementById('side-card-container');
  opponentHandZone.innerHTML = '';

  if (now.myHands.length > 0) {
    now.myHands.forEach(card => {
      const cardImg = document.createElement('img');
      cardImg.src = `../images/${card}.jpg`;
      cardImg.classList.add('card');
      cardImg.value = card;
      playerHandZone.appendChild(cardImg);
    });
  }

  if (now.myPlayed.length > 0) {
    let idx = 0;
    now.myPlayed.forEach(card => {
      const playedImg = document.createElement('img');
      playedImg.src = `../images/${card}.jpg`;
      playedImg.classList.add('played-card');
      playedImg.style.position = 'absolute';
      playedImg.style.left = `${idx * 40}px`;
      playedImg.style.zIndex = idx;
      playedImg.style.width = '100px';
      playedImg.style.height = '150px';
      playArea.appendChild(playedImg);
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
      playedImg.src = `../images/${card}.jpg`;
      playedImg.classList.add('played-card');
      playedImg.style.position = 'absolute';
      playedImg.style.left = `${idx * 40}px`;
      playedImg.style.zIndex = idx;
      playedImg.style.width = '100px';
      playedImg.style.height = '150px';
      opponentArea.appendChild(playedImg);
      
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
        backCard.src = `../images/0.jpg`;
        backCard.classList.add('card');
        opponentHandZone.appendChild(backCard);
      }
    }
  }

  if (now.reincarnation) {
    const sideCard = document.createElement('img');
    sideCard.src = `../images/0.jpg`;
    sideCard.classList.add('side-card');
    sideContainer.appendChild(sideCard);
  }

  if (now.cardNumber > 0) {
    const deckCard = document.createElement('img');
    deckCard.src = `../images/0.jpg`;
    deckCard.id = 'deck';
    deckContainer.appendChild(deckCard);
  }

  const deckCount = document.getElementById('deck-count');
  deckCount.textContent = `残り枚数: ${now.cardNumber}`;
}

// 文字列→演出テキスト
function getCharacterName(cardNumber) {
  cardNumber = parseInt(cardNumber, 10);
  const characterNames = ['少年','兵士','占い師','乙女','死神','貴族','賢者','精霊','皇帝','英雄'];
  return characterNames[cardNumber - 1];
}
function getEffectDescription(characterName) {
  switch (characterName) {
    case '少年': return '少年';
    case '兵士': return '兵士の効果：相手の手札を推測！';
    case '占い師': return '占い師の効果：相手の手札を覗く！';
    case '乙女': return '乙女の効果：次のターンまで守られる！';
    case '死神': return '死神の効果：相手に手札を捨てさせる！';
    case '貴族': return '貴族の効果：対決！';
    case '賢者': return '賢者の効果：次のターンで山札のトップ3枚からカードを選択！';
    case '精霊': return '精霊の効果：カードを交換！';
    case '皇帝': return '皇帝の効果：相手を恐怖に！';
    case '英雄': return '英雄の効果：最強の一撃！';
    default: return '効果は特にありません。';
  }
}

// カードを出す（自分）
async function playCard(cardNumber) {
  const imgSrc = `../images/${cardNumber}.jpg`;

  // 手札から該当1枚を除去
  const myHands = playerHandZone.querySelectorAll('img');
  for (let i = 0; i < myHands.length; i++) {
    if (parseInt(myHands[i].value, 10) === parseInt(cardNumber, 10)) {
      playerHandZone.removeChild(myHands[i]);
      break;
    }
  }

  const cname = getCharacterName(cardNumber);
  const text  = getEffectDescription(cname);

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
  return 'done';
}

// カードを出す（相手）
async function playCard_cpu(cardNumber) {
  const imgSrc = `../images/${cardNumber}.jpg`;
  const cname  = getCharacterName(cardNumber);
  const text   = getEffectDescription(cname);

  // カードのズーム表示のみを行い、プレイエリアへの追加はupdateGameViewに任せる
  await Anim.zoomCard(imgSrc, text, 1.5);
  
  // 実際のカード追加処理はupdateGameViewで行われるため、ここでは行わない
  // これにより重複表示を防ぐ
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
async function select(choices) {
  return new Promise((resolve) => {
    selectContainer.innerHTML = '';
    for (let i = 0; i < choices.length; i++) {
      const cardNumber = choices[i];
      const card = document.createElement('img');
      card.src = `../images/${cardNumber}.jpg`;
      card.width = 140; card.height = 210; card.zIndex = 100;
      card.addEventListener('click', () => resolve(i));
      card.classList.add('select-card');
      selectContainer.appendChild(card);
    }
    selectContainer.style.display = 'block';
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
    for (let i = 0; i < data[0].cards.length; i++) {
      const cardNumber = data[0].cards[i];
      const card = document.createElement('img');
      card.src = `../images/${cardNumber}.jpg`;
      card.width = 140; card.height = 210; card.zIndex = 100;
      card.classList.add('show-card');
      showContainer.appendChild(card);
    }
    showContainer.style.display = 'block';
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
  sideCard.src = '0.jpg';
  sideCard.classList.add('side-card');
  const sideContainer = document.getElementById('side-card-container');
  sideContainer.appendChild(sideCard);
}
function resetGame() {
  decks = [...decks]; // 実際は初期配列を再構築してください
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
      Anim.startTurnTimer();
      const idx = await select(data.choices);
      hideSelect();
      const chosen = data.choices[idx];
      const done = await Anim.drawCardToHand(chosen);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(`あなたが${idx}をドロー！`);
        callback([idx]);
      }
    } else {
      const done = await Anim.drawCardToHand(data.choices[0]);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(`あなたが${data.choices[0]}をドロー！`);
        callback([0]);
      }
    }
  } else if (data.kind === 'opponentChoice') {
    Anim.stopTurnTimer();
    callback([0]);
  } else if (data.kind === 'play_card') {
    Anim.startTurnTimer();
    const idx = await selectPlayableFromHand(data.choices);
    addLog(`あなたが${data.choices[idx]}を場に出す！`);
    const done = await playCard(data.choices[idx]);
    if (done === 'done') {
      Anim.stopTurnTimer();
      callback([idx]);
    }
  } else if (data.kind === 'update') {
    Anim.stopTurnTimer();
    callback([0]);
  } else if (data.kind === 'show') {
    try {
      await show(data.choices);
      addLog(`相手の持っているカードは${data.choices[0]}だった！`);
      hideShow();
      callback([0]);
    } catch (e) {
      console.log(e);
    }
  } else {
    try {
      Anim.startTurnTimer();
      const idx = await select(data.choices);
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
  if (data.kind === 'play_card') {
    await playCard_cpu(parseInt(data.choice, 10));
    addLog(`相手が${data.choice}を場に出す！`);
  } else if (data.kind === 'draw') {
    await Anim.cpuDrawCardToHand();
    for (let i = 0; i < data.now.playersLength + 1; i++) {
      const playerTurnNumber = data.now.playersHandsLengths[i];
      if (playerTurnNumber.turnNumber !== Object.keys(data.now.otherPlayers)[0]) {
        opponentHandZone.innerHTML = '';
        for (let j = 0; j < playerTurnNumber.length + 1; j++) {
          const backCard = document.createElement('img');
          backCard.src = `../images/0.jpg`;
          backCard.classList.add('card');
          opponentHandZone.appendChild(backCard);
        }
      }
    }
  }
});

socket.on('gameEnded', (data) => {
  Anim.stopTurnTimer();
  const resultString = data.result.toString();
  let reason = 'Noreason';
  const match = resultString.match(/\((.*)\)/);
  if (match) reason = match[1];
  const encodedReason = encodeURIComponent(reason);
  window.location.replace(
    `result.html?roomId=${roomId}&playerId=${playerId}&players=${players}&result=${resultString}&reason=${encodedReason}`
  );
});

socket.on('redirectToResult', (data) => {
  if (data && data.url) window.location.replace(data.url);
});

socket.on('waitingForOpponent', (data) => {
  const roomIdDisplayP = document.getElementById('room-id-display');
  if (waitingInfoDiv && roomIdDisplayP) {
    roomIdDisplayP.textContent = data.roomId;
    waitingInfoDiv.style.display = 'block';
  }
});

socket.on('hideWaitingInfo', () => {
  if (waitingInfoDiv) waitingInfoDiv.style.display = 'none';
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
    addLogMessage(`プレイヤーが退室しました。残り ${data.remainingPlayers} 人`);
});

// HTML から呼ぶもの
window.goToTitle = goToTitle;
window.surrender = surrender;
window.closeUsedCards = closeUsedCards;


