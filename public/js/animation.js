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
          temp.value = drawnCard;                 
          temp.dataset.card = String(drawnCard);
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

  // ===== カード演出アニメーション =====
  
  // カード1: 少年 - シンプルな輝きエフェクト
  function cardEffect1() {
    console.log('cardEffect1 starting...');
    return new Promise((resolve) => {
      const sparkles = createSparkleEffect();
      console.log('Created sparkles element:', sparkles);
      document.body.appendChild(sparkles);
      console.log('Appended sparkles to body');
      
      const timeline = gsap.timeline({
        onStart: () => {
          console.log('cardEffect1 GSAP timeline started');
        },
        onComplete: () => {
          console.log('cardEffect1 animation complete');
          sparkles.remove();
          resolve();
        }
      });
      
      console.log('Starting GSAP timeline for cardEffect1');
      timeline
        .to(sparkles, { opacity: 1, duration: 0.3 })
        .to(sparkles, { opacity: 0, duration: 0.5, delay: 1.0 });
    });
  }

  // カード2: 兵士 - 剣の一閃エフェクト
  function cardEffect2() {
    console.log('cardEffect2 starting...');
    return new Promise((resolve) => {
      const slash = createSlashEffect();
      console.log('Created slash element:', slash);
      document.body.appendChild(slash);
      console.log('Appended slash to body');
      
      const timeline = gsap.timeline({
        onStart: () => {
          console.log('cardEffect2 GSAP timeline started');
        },
        onComplete: () => {
          console.log('cardEffect2 animation complete');
          slash.remove();
          resolve();
        }
      });
      
      console.log('Starting GSAP timeline for cardEffect2');
      timeline
        .set(slash, { scaleX: 0, rotation: -45 })
        .to(slash, { scaleX: 1, duration: 0.2, ease: 'power2.out' })
        .to(slash, { opacity: 0, duration: 0.3, delay: 0.5 });
    });
  }

  // カード3: 占い師 - 神秘的な目のエフェクト
  function cardEffect3() {
    console.log('cardEffect3 starting...');
    return new Promise((resolve) => {
      const mysticEye = createMysticEyeEffect();
      console.log('Created mystic eye element:', mysticEye);
      document.body.appendChild(mysticEye);
      console.log('Appended mystic eye to body');
      
      gsap.timeline({
        onComplete: () => {
          console.log('cardEffect3 animation complete');
          mysticEye.remove();
          resolve();
        }
      })
      .fromTo(mysticEye, 
        { scale: 0, rotation: 180 },
        { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.7)' }
      )
      .to(mysticEye, { autoAlpha: 0, duration: 0.4, delay: 1.0 });
    });
  }

  // カード4: 乙女 - 守護・プロテクションエフェクト
  function cardEffect4() {
    console.log('cardEffect4 starting...');
    return new Promise((resolve) => {
      const protectionEffect = createProtectionEffect();
      console.log('Created protection element:', protectionEffect);
      document.body.appendChild(protectionEffect);
      console.log('Appended protection effect to body');
      
      const timeline = gsap.timeline({
        onStart: () => {
          console.log('cardEffect4 GSAP timeline started');
        },
        onComplete: () => {
          console.log('cardEffect4 animation complete');
          protectionEffect.remove();
          resolve();
        }
      });
      
      console.log('Starting GSAP timeline for cardEffect4');
      timeline
        .fromTo(protectionEffect,
          { scale: 0, opacity: 0 },
          { scale: 1.2, opacity: 0.8, duration: 0.4, ease: 'back.out(1.7)' }
        )
        .to(protectionEffect, { scale: 1.5, opacity: 0, duration: 0.6 });
    });
  }

  // カード5: 死神 - 暗闇・鎌エフェクト
  function cardEffect5() {
    console.log('cardEffect5 starting...');
    return new Promise((resolve) => {
      const darkness = createDarknessEffect();
      const scythe = createScytheEffect();
      console.log('Created darkness and scythe elements:', darkness, scythe);
      document.body.appendChild(darkness);
      document.body.appendChild(scythe);
      console.log('Appended darkness and scythe to body');
      
      gsap.timeline({
        onComplete: () => {
          console.log('cardEffect5 animation complete');
          darkness.remove();
          scythe.remove();
          resolve();
        }
      })
      .to(darkness, { autoAlpha: 0.7, duration: 0.3 })
      .fromTo(scythe,
        { x: -200, rotation: -90 },
        { x: 0, rotation: 0, duration: 0.5, ease: 'power2.out' }, 0.2
      )
      .to([darkness, scythe], { autoAlpha: 0, duration: 0.4, delay: 0.8 });
    });
  }

  // カード6: 貴族 - 相互カード確認演出（重要！）
  function cardEffect6(handInfo = null) {
    console.log('cardEffect6 starting with handInfo:', handInfo);
    return new Promise((resolve) => {
      const cardRevealContainer = createCardRevealContainer(handInfo);
      const { container, playerCard, opponentCard, vsText, compareEffect } = cardRevealContainer;
      
      console.log('Created card reveal effects:', container);
      document.body.appendChild(container);
      console.log('Appended card reveal effects to body');
      
      const timeline = gsap.timeline({
        onStart: () => {
          console.log('cardEffect6 GSAP timeline started');
        },
        onComplete: () => {
          console.log('cardEffect6 animation complete');
          container.remove();
          resolve();
        }
      });
      
      console.log('Starting GSAP timeline for cardEffect6');
      timeline
        // カード登場
        .fromTo([playerCard, opponentCard], 
          { y: 100, opacity: 0, rotationY: 180 },
          { y: 0, opacity: 1, rotationY: 0, duration: 0.8, ease: 'back.out(1.7)', stagger: 0.2 }
        )
        // VS テキスト出現
        .fromTo(vsText,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }, "-=0.4"
        )
        // 比較エフェクト
        .fromTo(compareEffect,
          { scale: 0, opacity: 0 },
          { scale: 1.5, opacity: 1, duration: 0.3 }, "+=0.5"
        )
        .to(compareEffect,
          { scale: 2, opacity: 0, duration: 0.4 }
        )
        // カード回転・消失
        .to([playerCard, opponentCard], 
          { rotationY: 180, opacity: 0, duration: 0.5, ease: 'power2.in' }, "+=0.3"
        )
        .to(vsText, 
          { scale: 0, opacity: 0, duration: 0.3 }, "-=0.3"
        );
    });
  }

  // カード7: 賢者 - 魔法の書エフェクト
  function cardEffect7() {
    console.log('cardEffect7 starting...');
    return new Promise((resolve) => {
      const magicBook = createMagicBookEffect();
      const runes = createRunesEffect();
      
      console.log('Created magic book and runes elements:', magicBook, runes);
      document.body.appendChild(magicBook);
      document.body.appendChild(runes);
      console.log('Appended magic book and runes to body');
      
      const timeline = gsap.timeline({
        onStart: () => {
          console.log('cardEffect7 GSAP timeline started');
        },
        onComplete: () => {
          console.log('cardEffect7 animation complete');
          magicBook.remove();
          runes.remove();
          resolve();
        }
      });
      
      console.log('Starting GSAP timeline for cardEffect7');
      timeline
        .fromTo(magicBook,
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }
        )
        .fromTo(runes,
          { scale: 0, rotation: 0 },
          { scale: 1, rotation: 360, duration: 0.8, ease: 'power2.out' }, 0.3
        )
        .to([magicBook, runes], { opacity: 0, duration: 0.4, delay: 0.8 });
    });
  }

  // カード8: 精霊 - 交換・螺旋エフェクト
  function cardEffect8() {
    console.log('cardEffect8 starting...');
    return new Promise((resolve) => {
      const spiral1 = createSpiralEffect(true);
      const spiral2 = createSpiralEffect(false);
      
      console.log('Created spiral elements:', spiral1, spiral2);
      document.body.appendChild(spiral1);
      document.body.appendChild(spiral2);
      console.log('Appended spirals to body');
      
      const timeline = gsap.timeline({
        onStart: () => {
          console.log('cardEffect8 GSAP timeline started');
        },
        onComplete: () => {
          console.log('cardEffect8 animation complete');
          spiral1.remove();
          spiral2.remove();
          resolve();
        }
      });
      
      console.log('Starting GSAP timeline for cardEffect8');
      timeline
        .fromTo([spiral1, spiral2],
          { scale: 0, rotation: 0 },
          { scale: 1, rotation: 720, duration: 1.0, ease: 'power2.inOut' }
        )
        .to([spiral1, spiral2], { opacity: 0, duration: 0.3 });
    });
  }

  // カード9: 皇帝 - 威圧・王の力エフェクト
  function cardEffect9() {
    return new Promise((resolve) => {
      const crown = createCrownEffect();
      const aura = createAuraEffect();
      
      document.body.appendChild(crown);
      document.body.appendChild(aura);
      
      gsap.timeline({
        onComplete: () => {
          crown.remove();
          aura.remove();
          resolve();
        }
      })
      .fromTo(crown,
        { y: -100, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.6, ease: 'bounce.out' }
      )
      .fromTo(aura,
        { scale: 0 },
        { scale: 2, duration: 1.0, ease: 'power2.out' }, 0.2
      )
      .to([crown, aura], { autoAlpha: 0, duration: 0.4, delay: 0.8 });
    });
  }

  // カード10: 英雄 - 英雄の光・復活エフェクト
  function cardEffect10() {
    return new Promise((resolve) => {
      const heroLight = createHeroLightEffect();
      const wings = createWingsEffect();
      
      document.body.appendChild(heroLight);
      document.body.appendChild(wings);
      
      gsap.timeline({
        onComplete: () => {
          heroLight.remove();
          wings.remove();
          resolve();
        }
      })
      .fromTo(heroLight,
        { scale: 0, autoAlpha: 0 },
        { scale: 1.5, autoAlpha: 1, duration: 0.5, ease: 'power2.out' }
      )
      .fromTo(wings,
        { scaleX: 0, transformOrigin: 'center center' },
        { scaleX: 1, duration: 0.6, ease: 'back.out(1.7)' }, 0.3
      )
      .to([heroLight, wings], { autoAlpha: 0, duration: 0.5, delay: 1.0 });
    });
  }

  // ===== エフェクト作成ヘルパー関数 =====
  
  function createSparkleEffect() {
    const sparkles = document.createElement('div');
    sparkles.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 200px; height: 200px; pointer-events: none; z-index: 9999;
      background: radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
      border-radius: 50%; opacity: 0; visibility: visible;
    `;
    console.log('Created sparkles with styles:', sparkles.style.cssText);
    return sparkles;
  }

  function createSlashEffect() {
    const slash = document.createElement('div');
    slash.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 300px; height: 8px; pointer-events: none; z-index: 9999;
      background: linear-gradient(90deg, transparent 0%, #ffffff 50%, transparent 100%);
      box-shadow: 0 0 20px #ffffff; transform-origin: left center;
      opacity: 1; visibility: visible;
    `;
    console.log('Created slash with styles:', slash.style.cssText);
    return slash;
  }

  function createMysticEyeEffect() {
    const eye = document.createElement('div');
    eye.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 150px; height: 150px; pointer-events: none; z-index: 9999;
      background: radial-gradient(circle, #4a0e4e 30%, #8b5cf6 50%, #a855f7 70%, transparent 100%);
      border-radius: 50%; border: 3px solid #8b5cf6;
      box-shadow: 0 0 30px #8b5cf6; opacity: 1; visibility: visible;
    `;
    console.log('Created mystic eye with styles:', eye.style.cssText);
    return eye;
  }

  function createBarrierEffect() {
    const barrier = document.createElement('div');
    barrier.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 250px; height: 250px; pointer-events: none; z-index: 9999;
      background: radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(147,197,253,0.6) 50%, transparent 100%);
      border: 3px solid #3b82f6; border-radius: 50%;
      box-shadow: 0 0 40px #3b82f6; opacity: 1; visibility: visible;
    `;
    console.log('Created barrier with styles:', barrier.style.cssText);
    return barrier;
  }

  function createDarknessEffect() {
    const darkness = document.createElement('div');
    darkness.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0); pointer-events: none; z-index: 9998;
      opacity: 1; visibility: visible;
    `;
    console.log('Created darkness with styles:', darkness.style.cssText);
    return darkness;
  }

  function createScytheEffect() {
    const scythe = document.createElement('div');
    scythe.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 200px; height: 8px; pointer-events: none; z-index: 9999;
      background: linear-gradient(90deg, #1f2937 0%, #6b7280 50%, #1f2937 100%);
      box-shadow: 0 0 15px #1f2937; opacity: 1; visibility: visible;
    `;
    console.log('Created scythe with styles:', scythe.style.cssText);
    return scythe;
  }

  function createDuelBackground() {
    const bg = document.createElement('div');
    bg.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(circle, rgba(220, 38, 38, 0.3) 0%, rgba(239, 68, 68, 0.5) 50%, rgba(127, 29, 29, 0.7) 100%);
      pointer-events: none; z-index: 9998; opacity: 0; visibility: visible;
    `;
    return bg;
  }

  function createLightningEffect() {
    const lightning = document.createElement('div');
    lightning.style.cssText = `
      position: fixed; top: 0; left: 50%; transform: translateX(-50%);
      width: 8px; height: 100%; pointer-events: none; z-index: 9999;
      background: linear-gradient(180deg, transparent 0%, #fbbf24 20%, #ffffff 50%, #fbbf24 80%, transparent 100%);
      box-shadow: 0 0 20px #fbbf24;
    `;
    return lightning;
  }

  function createImpactEffect() {
    const impact = document.createElement('div');
    impact.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 50px; height: 50px; pointer-events: none; z-index: 9999;
      background: radial-gradient(circle, #ffffff 0%, rgba(255, 255, 255, 0.8) 30%, transparent 100%);
      border-radius: 50%;
    `;
    return impact;
  }

  function createMagicBookEffect() {
    const book = document.createElement('div');
    book.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 120px; height: 160px; pointer-events: none; z-index: 9999;
      background: linear-gradient(45deg, #8b5cf6 0%, #a855f7 50%, #c084fc 100%);
      border: 2px solid #7c3aed; border-radius: 8px;
      box-shadow: 0 0 25px #8b5cf6; opacity: 1; visibility: visible;
    `;
    console.log('Created magic book with styles:', book.style.cssText);
    return book;
  }

  function createRunesEffect() {
    const runes = document.createElement('div');
    runes.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 200px; height: 200px; pointer-events: none; z-index: 9999;
      border: 2px solid #8b5cf6; border-radius: 50%;
      box-shadow: 0 0 20px #8b5cf6; opacity: 1; visibility: visible;
    `;
    console.log('Created runes with styles:', runes.style.cssText);
    return runes;
  }

  function createSpiralEffect(clockwise = true) {
    const spiral = document.createElement('div');
    const direction = clockwise ? 'left: 30%' : 'left: 70%';
    spiral.style.cssText = `
      position: fixed; top: 50%; ${direction}; transform: translate(-50%, -50%);
      width: 100px; height: 100px; pointer-events: none; z-index: 9999;
      background: conic-gradient(from 0deg, transparent 0%, #10b981 50%, transparent 100%);
      border-radius: 50%; opacity: 1; visibility: visible;
    `;
    console.log('Created spiral with styles:', spiral.style.cssText);
    return spiral;
  }

  function createCrownEffect() {
    const crown = document.createElement('div');
    crown.style.cssText = `
      position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
      width: 150px; height: 80px; pointer-events: none; z-index: 9999;
      background: linear-gradient(45deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      box-shadow: 0 0 30px #fbbf24;
    `;
    return crown;
  }

  function createAuraEffect() {
    const aura = document.createElement('div');
    aura.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 100px; height: 100px; pointer-events: none; z-index: 9998;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(245, 158, 11, 0.2) 70%, transparent 100%);
      border-radius: 50%;
    `;
    return aura;
  }

  function createHeroLightEffect() {
    const light = document.createElement('div');
    light.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 200px; height: 200px; pointer-events: none; z-index: 9999;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(251, 191, 36, 0.6) 50%, transparent 100%);
      border-radius: 50%;
    `;
    return light;
  }

  function createWingsEffect() {
    const wings = document.createElement('div');
    wings.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 300px; height: 150px; pointer-events: none; z-index: 9999;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.7) 20%, rgba(251, 191, 36, 0.5) 50%, rgba(255, 255, 255, 0.7) 80%, transparent 100%);
      border-radius: 50%;
    `;
    return wings;
  }

  // バリア演出（4の効果で無効化された場合）
  function createBarrierEffect(cardNumber) {
    console.log('Creating barrier effect for card:', cardNumber);
    
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      height: 300px;
      pointer-events: none;
      z-index: 10000;
    `;
    
    // バリアシールド
    const shield = document.createElement('div');
    shield.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(255, 215, 0, 0.8) 0%, rgba(255, 215, 0, 0.4) 50%, transparent 100%);
      border: 3px solid #FFD700;
      border-radius: 50%;
      opacity: 0;
      box-shadow: 0 0 50px #FFD700;
    `;
    
    // 十字の光
    const cross1 = document.createElement('div');
    cross1.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 180px;
      background: linear-gradient(to bottom, transparent, #FFD700, transparent);
      opacity: 0;
    `;
    
    const cross2 = document.createElement('div');
    cross2.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 180px;
      height: 4px;
      background: linear-gradient(to right, transparent, #FFD700, transparent);
      opacity: 0;
    `;
    
    // 「無効」テキスト
    const invalidText = document.createElement('div');
    invalidText.textContent = '無効';
    invalidText.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 32px;
      font-weight: bold;
      color: #FF4444;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      opacity: 0;
    `;
    
    container.appendChild(shield);
    container.appendChild(cross1);
    container.appendChild(cross2);
    container.appendChild(invalidText);
    document.body.appendChild(container);
    
    console.log('Barrier effect elements created and added to DOM');
    
    return { container, shield, cross1, cross2, invalidText };
  }

  // バリア演出アニメーション
  async function playBarrierEffect(cardNumber) {
    console.log('playBarrierEffect starting for card:', cardNumber);
    
    return new Promise((resolve) => {
      const elements = createBarrierEffect(cardNumber);
      const { container, shield, cross1, cross2, invalidText } = elements;
      
      const tl = gsap.timeline({
        onComplete: () => {
          console.log('Barrier effect animation complete');
          container.remove();
          resolve();
        }
      });
      
      // バリアシールド出現
      tl.to(shield, {
        duration: 0.3,
        opacity: 1,
        scale: 1.2,
        ease: "back.out(1.7)"
      })
      // 十字の光出現
      .to([cross1, cross2], {
        duration: 0.4,
        opacity: 1,
        ease: "power2.out"
      }, "-=0.2")
      // 「無効」テキスト出現
      .to(invalidText, {
        duration: 0.3,
        opacity: 1,
        scale: 1.1,
        ease: "back.out(1.7)"
      }, "-=0.2")
      // 全体の消失
      .to([shield, cross1, cross2, invalidText], {
        duration: 0.5,
        opacity: 0,
        scale: 0.8,
        ease: "power2.in"
      }, "+=0.8");
    });
  }

  // カード6用 - 相互カード確認コンテナ作成
  function createCardRevealContainer(handInfo = null) {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      pointer-events: none;
    `;
    
    // プレイヤーカード
    const playerCard = document.createElement('div');
    playerCard.style.cssText = `
      width: 120px;
      height: 180px;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      border: 3px solid #FFF;
      border-radius: 10px;
      margin: 0 40px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      box-shadow: 0 0 20px rgba(79, 70, 229, 0.7);
    `;
    
    // 実際のカード画像を表示
    if (handInfo && handInfo.playerCards && handInfo.playerCards.length > 0) {
      const playerCardNumber = handInfo.playerCards[0];
      
      // カード画像を作成
      const cardImg = document.createElement('img');
      cardImg.src = `../images/${playerCardNumber}.jpg`;
      cardImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 7px;
      `;
      
      playerCard.innerHTML = '';
      playerCard.appendChild(cardImg);
    } else {
      playerCard.textContent = 'YOUR CARD';
    }
    
    // VS テキスト
    const vsText = document.createElement('div');
    vsText.style.cssText = `
      font-size: 48px;
      font-weight: bold;
      color: #FFD700;
      text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
      margin: 0 20px;
    `;
    vsText.textContent = 'VS';
    
    // 相手カード
    const opponentCard = document.createElement('div');
    opponentCard.style.cssText = `
      width: 120px;
      height: 180px;
      background: linear-gradient(135deg, #DC2626, #EF4444);
      border: 3px solid #FFF;
      border-radius: 10px;
      margin: 0 40px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
      box-shadow: 0 0 20px rgba(220, 38, 38, 0.7);
    `;
    
    // 相手のカード画像を表示（カード6の効果では相手のカードも見える）
    if (handInfo && handInfo.opponentCards && handInfo.opponentCards.length > 0) {
      const opponentCardNumber = handInfo.opponentCards[0];
      
      // カード画像を作成
      const cardImg = document.createElement('img');
      cardImg.src = `../images/${opponentCardNumber}.jpg`;
      cardImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 7px;
      `;
      
      opponentCard.innerHTML = '';
      opponentCard.appendChild(cardImg);
    } else {
      opponentCard.textContent = 'OPPONENT';
    }
    
    // 比較エフェクト
    const compareEffect = document.createElement('div');
    compareEffect.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, transparent 70%);
      border-radius: 50%;
      opacity: 0;
    `;
    
    container.appendChild(playerCard);
    container.appendChild(vsText);
    container.appendChild(opponentCard);
    container.appendChild(compareEffect);
    
    return { container, playerCard, opponentCard, vsText, compareEffect };
  }

  // カード4専用 - プロテクション（守護）エフェクト
  function createProtectionEffect() {
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 300px;
      height: 300px;
      pointer-events: none;
      z-index: 9999;
    `;
    
    // 守護の光輪
    const halo = document.createElement('div');
    halo.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(173, 216, 230, 0.6) 40%, transparent 70%);
      border: 2px solid rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      box-shadow: 0 0 40px rgba(173, 216, 230, 0.8);
    `;
    
    // 保護シンボル（十字）
    const cross = document.createElement('div');
    cross.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80px;
      height: 80px;
    `;
    
    const vertical = document.createElement('div');
    vertical.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 60px;
      background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.9), transparent);
    `;
    
    const horizontal = document.createElement('div');
    horizontal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 4px;
      background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.9), transparent);
    `;
    
    cross.appendChild(vertical);
    cross.appendChild(horizontal);
    container.appendChild(halo);
    container.appendChild(cross);
    
    return container;
  }

  // GSAPテスト関数
  function testGSAP() {
    console.log('Testing GSAP...');
    const testDiv = document.createElement('div');
    testDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 100px; height: 100px; background: red; z-index: 9999;
      opacity: 0;
    `;
    document.body.appendChild(testDiv);
    
    gsap.timeline({
      onStart: () => console.log('GSAP test timeline started'),
      onComplete: () => {
        console.log('GSAP test timeline completed');
        testDiv.remove();
      }
    })
    .to(testDiv, { opacity: 1, duration: 0.5 })
    .to(testDiv, { opacity: 0, duration: 0.5, delay: 0.5 });
  }

  // カード演出実行関数（バリア効果オプション付き）
  async function playCardEffect(cardNumber, isBarriered = false, handInfo = null) {
    console.log('playCardEffect called with cardNumber:', cardNumber, 'isBarriered:', isBarriered, 'handInfo:', handInfo); // デバッグログ追加
    console.log('GSAP available:', typeof gsap !== 'undefined'); // GSAP存在確認
    
    // GSAPテストを一度だけ実行
    if (!window.gsapTested) {
      window.gsapTested = true;
      testGSAP();
    }
    
    // バリア効果が有効な場合は専用演出を実行
    if (isBarriered) {
      console.log('Playing barrier effect for card:', cardNumber);
      await playBarrierEffect(cardNumber);
      console.log('Barrier effect completed for card:', cardNumber);
      return;
    }
    
    const effects = {
      1: cardEffect1,
      2: cardEffect2,
      3: cardEffect3,
      4: cardEffect4,
      5: cardEffect5,
      6: cardEffect6,
      7: cardEffect7,
      8: cardEffect8,
      9: cardEffect9,
      10: cardEffect10
    };

    const effectFunction = effects[cardNumber];
    console.log('Effect function found:', !!effectFunction, 'for card:', cardNumber); // デバッグログ追加
    if (effectFunction) {
      console.log('Executing effect for card:', cardNumber); // デバッグログ追加
      
      // カード6の場合は手札情報を渡す
      if (cardNumber === 6 && handInfo) {
        await effectFunction(handInfo);
      } else {
        await effectFunction();
      }
      
      console.log('Effect completed for card:', cardNumber); // 完了ログ追加
      
      // 演出完了後に少し待機してドローアニメーションとの重複を防ぐ
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      console.log('No effect function found for card:', cardNumber, 'using default'); // デバッグログ追加
    }
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
    stopTurnTimer,
    playCardEffect
  };
})();