// ===================
// GSAP 設定
// ===================
const FX = {
  dur: 0.5,              // 標準アニメ時間
  ease: 'power2.out',    // 標準イージング
  long: 300              // ターンタイマー（秒）
};

// ===================
// ソケット & DOM
// ===================
const socket = io();

const selectContainer = document.getElementById('select-container');
const showContainer   = document.getElementById('show-container');
const waitingInfoDiv  = document.getElementById('waiting-info');
const opponentHandZone= document.getElementById('opponent-hand');
const playerHandZone  = document.getElementById('player-hand');
const playArea        = document.getElementById('playArea');
const opponentArea    = document.getElementById('opponent-playArea');
const deckContainer   = document.getElementById('deck-container');
const ruleButton      = document.getElementById('ruleButton');
const ruleModal       = document.getElementById('ruleModal');
const closeRuleBtn    = document.getElementById('closeRule');
const timerBar        = document.getElementById('turn-timer-bar');

selectContainer.style.display = 'none';
showContainer.style.display   = 'none';

// URL パラメータ
const params   = new URLSearchParams(window.location.search);
const roomId   = params.get('roomId');
const playerId = params.get('playerId');
const players  = (params.get('players') || '').split(',').filter(Boolean);

socket.emit('changeSocketid', { id: playerId, roomId });

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

// ===================
// 画面更新
// ===================
function updateGameView(now) {
  playerHandZone.innerHTML = '';
  playArea.innerHTML = '';
  opponentArea.innerHTML = '';
  deckContainer.innerHTML = "<div id='deck-count'></div><div id='side-card-container'></div>";
  const sideContainer = document.getElementById('side-card-container');
  opponentHandZone.innerHTML = '';

  // 自分の手札
  if (now.myHands.length > 0) {
    now.myHands.forEach(card => {
      const cardImg = document.createElement('img');
      cardImg.src = `../images/${card}.jpg`;
      cardImg.classList.add('card');
      cardImg.value = card;
      playerHandZone.appendChild(cardImg);
    });
  }

  // 自分の場
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

  // 相手の場
  const otherPlayedKeys = Object.keys(now.otherPlayed || {});
  if (otherPlayedKeys.length > 0) {
    let idx = 0;
    (now.otherPlayed[otherPlayedKeys[0]] || []).forEach(card => {
      const playedImg = document.createElement('img');
      playedImg.src = `../images/${card}.jpg`;
      playedImg.classList.add('played-card');
      playedImg.style.position = 'absolute';
      playedImg.style.left = `${idx * 40}px`;
      playedImg.style.zIndex = idx;
      playedImg.style.width = '100px';
      playedImg.style.height = '150px';
      opponentArea.appendChild(playedImg);
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

  // 転生札
  if (now.reincarnation) {
    const sideCard = document.createElement('img');
    sideCard.src = `../images/0.jpg`;
    sideCard.classList.add('side-card');
    sideContainer.appendChild(sideCard);
  }

  // デッキ
  if (now.cardNumber > 0) {
    const deckCard = document.createElement('img');
    deckCard.src = `../images/0.jpg`;
    deckCard.id = 'deck';
    deckContainer.appendChild(deckCard);
  }

  // デッキ枚数
  const deckCount = document.getElementById('deck-count');
  deckCount.textContent = `残り枚数: ${now.cardNumber}`;
}

// ===================
// アニメーション（GSAP）
// ===================
function showTurnIndicator() {
  const el = document.getElementById('turnIndicator');
  gsap.set(el, { display: 'block', autoAlpha: 0 });
  gsap.timeline()
    .to(el, { duration: 0.2, autoAlpha: 1, ease: FX.ease })
    .to(el, { duration: 0.5, autoAlpha: 0, ease: 'power1.out', delay: 1.0 })
    .set(el, { display: 'none' });
}

function showTurnIndicator_s() {
  const el = document.getElementById('second_turn');
  gsap.set(el, { display: 'block', autoAlpha: 0 });
  gsap.timeline()
    .to(el, { duration: 0.2, autoAlpha: 1, ease: FX.ease })
    .to(el, { duration: 0.5, autoAlpha: 0, ease: 'power1.out', delay: 1.0 })
    .set(el, { display: 'none' });
}

function showCardZoom(imgSrc, effectText, holdSec = 1.0) {
  const zoomArea  = document.getElementById('cardZoom');
  const zoomedCard= document.getElementById('zoomedCard');
  const desc      = document.getElementById('effectDescription');
  zoomedCard.src = imgSrc;
  desc.textContent = effectText;

  gsap.set(zoomArea, { display: 'flex', autoAlpha: 0 });
  gsap.set(zoomedCard, { scale: 0.5 });

  return gsap.timeline()
    .to(zoomArea,   { autoAlpha: 1, duration: 0.2 })
    .to(zoomedCard, { scale: 2, duration: 0.5, ease: FX.ease }, 0)
    .to(zoomArea,   { autoAlpha: 0, duration: 0.3, delay: holdSec })
    .set(zoomArea,  { display: 'none' });
}

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

function playCard(cardNumber) {
  return new Promise((resolve) => {
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

    // ズーム演出 → 場にカードを並べる
    showCardZoom(imgSrc, text, 1.0).eventCallback('onComplete', () => {
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
      gsap.from(newCard, { scale: 0.7, duration: 0.3, ease: FX.ease });

      resolve('done');
    });
  });
}

function playCard_cpu(cardNumber) {
  const imgSrc = `../images/${cardNumber}.jpg`;
  const cname  = getCharacterName(cardNumber);
  const text   = getEffectDescription(cname);

  showCardZoom(imgSrc, text, 1.5).eventCallback('onComplete', () => {
    const newCard = document.createElement('img');
    newCard.src = imgSrc;
    newCard.classList.add('played-card');

    const index = opponentArea.children.length;
    newCard.style.position = 'absolute';
    newCard.style.left = `${index * 40}px`;
    newCard.style.zIndex = index;
    newCard.style.width = '100px';
    newCard.style.height = '150px';

    opponentArea.appendChild(newCard);
    gsap.from(newCard, { scale: 0.7, duration: 0.3, ease: FX.ease });
  });
}

// ===================
// ★ 安全な座標取得用ヘルパ
// ===================
function getSafeRect(el) {
  if (el) {
    const r = el.getBoundingClientRect();
    // width/height が 0 の場合は未配置の可能性がある
    if (r && (r.width > 0 || r.height > 0)) return r;
  }
  // フォールバック：プレイエリア、さらにダメならビューポート中央
  const pa = document.getElementById('playArea');
  if (pa) {
    const pr = pa.getBoundingClientRect();
    return {
      left: pr.left + 20,
      top:  pr.bottom - 150 - 20, // プレイエリアの下に手札が来る想定
      width: 100, height: 150
    };
  }
  // どうしても無ければ画面中央
  const vw = window.innerWidth, vh = window.innerHeight;
  return { left: vw / 2 - 50, top: vh / 2 - 75, width: 100, height: 150 };
}

function getDeckAnchorRect() {
  const deckEl = document.getElementById('deck');
  if (deckEl) {
    const r = deckEl.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) return r;
  }
  // #deck が未生成の瞬間は #deck-container を使用
  const dc = document.getElementById('deck-container');
  if (dc) {
    const r = dc.getBoundingClientRect();
    return { left: r.left + 10, top: r.top + 10, width: 100, height: 150 };
  }
  // 最終手段
  return { left: 20, top: 20, width: 100, height: 150 };
}

function cleanupAnimTemps() {
  document.querySelectorAll('.anim-temp').forEach(n => n.remove());
}

// ===================
// ドロー：山札→自分手札（堅牢化）
// ===================
function drawCardToHand(drawnCard) {
  return new Promise((resolve) => {
    cleanupAnimTemps(); // ★ 前回の取り残しを掃除

    const anchorFrom = getDeckAnchorRect();     // ★ 常に安全な始点
    const anchorTo   = getSafeRect(playerHandZone); // ★ 常に安全な終点

    const temp = document.createElement('img');
    temp.src = `../images/${drawnCard}.jpg`;
    temp.classList.add('card', 'anim-temp'); // ★ 一時ノード識別
    document.body.appendChild(temp);

    // 初期配置（viewport座標）
    gsap.set(temp, {
      position: 'absolute',
      left: anchorFrom.left, top: anchorFrom.top,
      width: 100, height: 150,
      autoAlpha: 0, x: 0, y: 0, clearProps: 'transform'
    });

    const dx = (anchorTo.left + 20) - anchorFrom.left;
    const dy = (anchorTo.top  + 20) - anchorFrom.top;

    gsap.timeline({
      defaults: { duration: FX.dur, ease: FX.ease },
      onComplete() {
        // ★ 一時ノードを手札用ノードに差し替える（transform等クリア）
        temp.classList.remove('anim-temp');
        temp.style.position = 'static';
        gsap.set(temp, { clearProps: 'all' });
        playerHandZone.appendChild(temp);
        resolve('done');
      }
    })
    .to(temp, { autoAlpha: 1 }, 0)
    .to(temp, { x: dx, y: dy }, 0);
  });
}

// ===================
// CPU ドロー：山札→相手手札（堅牢化）
// ===================
function cpuDrawCardToHand() {
  return new Promise((resolve) => {
    cleanupAnimTemps(); // ★ 前回の取り残しを掃除

    const anchorFrom = getDeckAnchorRect();          // ★ 安全な始点
    const anchorTo   = getSafeRect(opponentHandZone); // ★ 安全な終点

    const temp = document.createElement('img');
    temp.src = `../images/0.jpg`;
    temp.classList.add('card', 'anim-temp'); // ★ 一時ノード識別
    document.body.appendChild(temp);

    gsap.set(temp, {
      position: 'absolute',
      left: anchorFrom.left, top: anchorFrom.top,
      width: 100, height: 150,
      autoAlpha: 0, x: 0, y: 0, clearProps: 'transform'
    });

    const dx = (anchorTo.left + 20) - anchorFrom.left;
    const dy = (anchorTo.top  + 20) - anchorFrom.top;

    gsap.timeline({
      defaults: { duration: FX.dur, ease: FX.ease },
      onComplete() {
        // ★ 一時ノードを相手手札へ移動し、transform/positionをクリア
        temp.classList.remove('anim-temp');
        temp.style.position = 'static';
        gsap.set(temp, { clearProps: 'all' });
        opponentHandZone.appendChild(temp);
        resolve();
      }
    })
    .to(temp, { autoAlpha: 1 }, 0)
    .to(temp, { x: dx, y: dy }, 0);
  });
}

// 使用済みカード表示
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

// ログ
function addLog(message) {
  const logMessages = document.getElementById('log-messages');
  const d = document.createElement('div');
  d.textContent = message;
  logMessages.appendChild(d);
  logMessages.scrollTop = logMessages.scrollHeight;
}

// 結果表示
function showResult(message) {
  const el = document.getElementById('showResult');
  el.innerHTML = message;
  el.style.display = 'block';
}

// セレクトUI
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

// 公開UI
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

// ターンタイマー（GSAP）
let turnTween;
function startTurnTimer() {
  if (turnTween) turnTween.kill();
  gsap.set(timerBar, { width: '100%' });
  turnTween = gsap.to(timerBar, {
    width: '0%',
    duration: FX.long,
    ease: 'none'
  });
}
function stopTurnTimer() {
  if (turnTween) turnTween.kill();
  gsap.set(timerBar, { width: '100%' });
}

// surrender / reset / title
function surrender() {
  if (confirm('本当に投降しますか？')) {
    alert('あなたは投降しました。CPUの勝ちです。');
    goToTitle();
    resetGame();
  }
}

// デッキ定義（演出用）
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
  decks.splice(index, 1)[0]; // 1枚消費
  const sideCard = document.createElement('img');
  sideCard.src = '0.jpg';
  sideCard.classList.add('side-card');
  const sideContainer = document.getElementById('side-card-container');
  sideContainer.appendChild(sideCard);
}

function resetGame() {
  decks = [
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
  const start = document.getElementById('startScreen'); // ない場合もある
  if (game) game.style.display = 'none';
  if (start) start.style.display = 'block';
  resetGame();
}

// ボタン等
function hideSelect() { selectContainer.style.display = 'none'; }
function hideShow()   { showContainer.style.display = 'none'; }

// ===================
// ソケットイベント
// ===================
socket.on('yourTurn', async (data, callback) => {
  await updateGameView(data.now);
  if (data.kind === 'draw') {
    if (data.choices.length > 2) {
      startTurnTimer();
      const idx = await select(data.choices);
      hideSelect();
      const chosen = data.choices[idx];
      const done = await drawCardToHand(chosen);
      if (done === 'done') {
        stopTurnTimer();
        addLog(`あなたが${idx}をドロー！`);
        callback([idx]);
      }
    } else {
      const done = await drawCardToHand(data.choices[0]);
      if (done === 'done') {
        stopTurnTimer();
        addLog(`あなたが${data.choices[0]}をドロー！`);
        callback([0]);
      }
    }
  } else if (data.kind === 'opponentChoice') {
    stopTurnTimer();
    callback([0]);
  } else if (data.kind === 'play_card') {
    startTurnTimer();
    const idx = await select(data.choices);
    addLog(`あなたが${data.choices[idx]}を場に出す！`);
    hideSelect();
    const done = await playCard(data.choices[idx]);
    if (done === 'done') {
      stopTurnTimer();
      callback([idx]);
    }
  } else if (data.kind === 'update') {
    stopTurnTimer();
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
      startTurnTimer();
      const idx = await select(data.choices);
      hideSelect();
      stopTurnTimer();
      callback([idx]);
    } catch (e) {
      stopTurnTimer();
      console.log(e);
    }
  }
});

socket.on('onatherTurn', async (data) => {
  stopTurnTimer();
  if (data.kind === 'play_card') {
    await playCard_cpu(parseInt(data.choice, 10));
    addLog(`相手が${data.choice}を場に出す！`);
  } else if (data.kind === 'draw') {
    await cpuDrawCardToHand();
    // 裏向き手札の再描画
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

socket.on('result', (data) => {
  stopTurnTimer();
  showResult(data.result);
});

socket.on('gameEnded', (data) => {
  stopTurnTimer();
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

socket.on('forceStopTurnTimer', () => stopTurnTimer());

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

// HTML から呼ぶもの
window.goToTitle = goToTitle;
window.surrender = surrender;
window.closeUsedCards = closeUsedCards;
