// animation.js
// すべてのアニメ共通ロジックをここに集約（グローバルに Anim を公開）

(function () {
  // ===== 設定（必要なら init で上書き可）=====
  const FX = {
    dur: 0.5,            // 標準アニメ時間
    ease: 'power2.out',  // 標準イージング
    long: 300            // ターンタイマー（秒）
  };

  // ===== 参照（initで注入）=====
  const refs = {
    playerHandZone: null,
    opponentHandZone: null,
    playArea: null,
    opponentArea: null,
    timerBar: null,
  };

  function init({ playerHandZone, opponentHandZone, playArea, opponentArea, timerBar, longSec } = {}) {
    if (playerHandZone)  refs.playerHandZone  = playerHandZone;
    if (opponentHandZone)refs.opponentHandZone= opponentHandZone;
    if (playArea)        refs.playArea        = playArea;
    if (opponentArea)    refs.opponentArea    = opponentArea;
    if (timerBar)        refs.timerBar        = timerBar;
    if (typeof longSec === 'number') FX.long = longSec;
  }

  // ===== ヘルパ =====
  function getSafeRect(el) {
    if (el) {
      const r = el.getBoundingClientRect();
      if (r && (r.width > 0 || r.height > 0)) return r;
    }
    const pa = refs.playArea || document.getElementById('playArea');
    if (pa) {
      const pr = pa.getBoundingClientRect();
      return { left: pr.left + 20, top: pr.bottom - 150 - 20, width: 100, height: 150 };
    }
    const vw = window.innerWidth, vh = window.innerHeight;
    return { left: vw / 2 - 50, top: vh / 2 - 75, width: 100, height: 150 };
  }

  function getDeckAnchorRect() {
    const deckEl = document.getElementById('deck');
    if (deckEl) {
      const r = deckEl.getBoundingClientRect();
      if (r && (r.width > 0 || r.height > 0)) return r;
    }
    const dc = document.getElementById('deck-container');
    if (dc) {
      const r = dc.getBoundingClientRect();
      return { left: r.left + 10, top: r.top + 10, width: 100, height: 150 };
    }
    return { left: 20, top: 20, width: 100, height: 150 };
  }

  function cleanupAnimTemps() {
    document.querySelectorAll('.anim-temp').forEach(n => n.remove());
  }

  // ===== 公開アニメAPI =====
  function showTurnIndicator() {
    const el = document.getElementById('turnIndicator');
    gsap.set(el, { display: 'block', autoAlpha: 0 });
    gsap.timeline()
      .to(el, { duration: 0.2, autoAlpha: 1, ease: FX.ease })
      .to(el, { duration: 0.5, autoAlpha: 0, ease: 'power1.out', delay: 1.0 })
      .set(el, { display: 'none' });
  }

  function showTurnIndicatorOpponent() {
    const el = document.getElementById('second_turn');
    gsap.set(el, { display: 'block', autoAlpha: 0 });
    gsap.timeline()
      .to(el, { duration: 0.2, autoAlpha: 1, ease: FX.ease })
      .to(el, { duration: 0.5, autoAlpha: 0, ease: 'power1.out', delay: 1.0 })
      .set(el, { display: 'none' });
  }

  // ズームUI（完了で resolve する Promise 版）
  function zoomCard(imgSrc, effectText, holdSec = 1.0) {
    return new Promise((resolve) => {
      const zoomArea   = document.getElementById('cardZoom');
      const zoomedCard = document.getElementById('zoomedCard');
      const desc       = document.getElementById('effectDescription');
      zoomedCard.src = imgSrc;
      desc.textContent = effectText;

      gsap.set(zoomArea, { display: 'flex', autoAlpha: 0 });
      gsap.set(zoomedCard, { scale: 0.5 });

      gsap.timeline({
        onComplete: () => {
          resolve();
        }
      })
      .to(zoomArea,   { autoAlpha: 1, duration: 0.2 })
      .to(zoomedCard, { scale: 2, duration: 0.5, ease: FX.ease }, 0)
      .to(zoomArea,   { autoAlpha: 0, duration: 0.3, delay: holdSec })
      .set(zoomArea,  { display: 'none' });
    });
  }

  // 手札へドロー（自分）
  function drawCardToHand(drawnCard) {
    return new Promise((resolve) => {
      cleanupAnimTemps();

      const anchorFrom = getDeckAnchorRect();
      const anchorTo   = getSafeRect(refs.playerHandZone);

      const temp = document.createElement('img');
      temp.src = `../images/${drawnCard}.jpg`;
      temp.classList.add('card', 'anim-temp');
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
          temp.classList.remove('anim-temp');
          temp.style.position = 'static';
          gsap.set(temp, { clearProps: 'all' });
          refs.playerHandZone.appendChild(temp);
          resolve('done');
        }
      })
      .to(temp, { autoAlpha: 1 }, 0)
      .to(temp, { x: dx, y: dy }, 0);
    });
  }

  // 手札へドロー（相手：裏面）
  function cpuDrawCardToHand() {
    return new Promise((resolve) => {
      cleanupAnimTemps();

      const anchorFrom = getDeckAnchorRect();
      const anchorTo   = getSafeRect(refs.opponentHandZone);

      const temp = document.createElement('img');
      temp.src = `../images/0.jpg`;
      temp.classList.add('card', 'anim-temp');
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
          temp.classList.remove('anim-temp');
          temp.style.position = 'static';
          gsap.set(temp, { clearProps: 'all' });
          refs.opponentHandZone.appendChild(temp);
          resolve();
        }
      })
      .to(temp, { autoAlpha: 1 }, 0)
      .to(temp, { x: dx, y: dy }, 0);
    });
  }

  // 置いたカードを軽くポップ表示
  function popIn(el) {
    gsap.from(el, { scale: 0.7, duration: 0.3, ease: FX.ease });
  }

  // ターンタイマー
  let turnTween;
  function startTurnTimer() {
    if (!refs.timerBar) return;
    if (turnTween) turnTween.kill();
    gsap.set(refs.timerBar, { width: '100%' });
    turnTween = gsap.to(refs.timerBar, {
      width: '0%',
      duration: FX.long,
      ease: 'none'
    });
  }
  function stopTurnTimer() {
    if (!refs.timerBar) return;
    if (turnTween) turnTween.kill();
    gsap.set(refs.timerBar, { width: '100%' });
  }

  // 公開
  window.Anim = {
    init,
    showTurnIndicator,
    showTurnIndicatorOpponent,
    zoomCard,
    drawCardToHand,
    cpuDrawCardToHand,
    popIn,
    startTurnTimer,
    stopTurnTimer
  };
})();