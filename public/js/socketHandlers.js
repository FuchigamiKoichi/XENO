/**
 * クライアントサイド Socket Handler
 * ゲームアクションの処理を担当
 */
const SocketHandlers = {
  /**
   * drawアクション処理
   */
  async handleDraw(data, callback) {
    if (data.choices.length > 1) {
      // 直前ターンの相手演出（FX）が残っている可能性があるため、短時間だけ待ってからセレクトを表示
      await Anim.waitForFxIdle(1200);
      Anim.startTurnTimer();
      const idx = await select(data.choices, messageManager.getSelectMessage('draw'));
      hideSelect();
      const chosen = data.choices[idx];
      
      // カード効果演出との重複を防ぐため、少し待機してからドロー
      await new Promise(resolve => setTimeout(resolve, 300));
      playCardDealSE();
      
      const done = await Anim.drawCardToHand(chosen);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(messageManager.getGameMessage('drawCard', { card: chosen }));
        callback([idx]);
      }
    } else {
      // カード効果演出との重複を防ぐため、少し待機してからドロー
      await new Promise(resolve => setTimeout(resolve, 300));
      playCardDealSE();
      
      const choice = data.choices[0];
      const done = await Anim.drawCardToHand(choice);
      if (done === 'done') {
        Anim.stopTurnTimer();
        addLog(messageManager.getGameMessage('drawCard', { card: choice }));
        callback([0]);
      }
    }
  },

  /**
   * play_cardアクション処理
   */
  async handlePlayCard(data, callback) {
    Anim.startTurnTimer();
    const idx = await selectPlayableFromHand(data.choices);
    const selectedCard = parseInt(data.choices[idx], 10);
    const handInfo = getCurrentHandInfo(data);
    let newMyHands = [];
    let frag = false;
    for(let i=0; i< handInfo.playerCards.length; i++){
      if (parseInt(handInfo.playerCards[i]) != selectedCard || frag){
        newMyHands.push(parseInt(handInfo.playerCards[i]));
      }else{
        frag = true;
      }
    }
    handInfo.playerCards = newMyHands;
    const isBarriered = data.isBarriered; // 相手のバリアが有効か
    
    addLog(messageManager.getGameMessage('playCard', { card: data.choices[idx] }));
    playCardPlaceSE();
    console.log('Barrier状態:', isBarriered, 'カード:', selectedCard);
    
    // playCard関数にバリア状態を渡す
    const done = await playCard(data.choices[idx], isBarriered, handInfo);
    if (done === 'done') {
      Anim.stopTurnTimer();
      callback([idx]);
    }
  },

  /**
   * predアクション処理（カード2の予想）
   */
  async handlePrediction(data, callback) {
    const otherHands = parseInt(data.now.otherHands[Object.keys(data.now.otherHands)[0]]);
    console.log('[Card2 pred] Processing prediction request from server');
    console.log('[Card2 pred] Available choices:', data.choices);
    console.log('[Card2 pred] Other hands data:', otherHands);
    
    try {
      // 予想入力を促す
      const guessedCard = parseInt(await select([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], messageManager.getSelectMessage('pred'))) + 1;
      console.log('[Card2 pred] User predicted card:', guessedCard);
      hideSelect();
      
      // 相手の手札から判定（サーバーから提供されたデータを使用）
      const opponentCards = this.extractOpponentCards(otherHands);
      console.log('[Card2 pred] Opponent cards for judgment:', opponentCards, 'Guessed card:', guessedCard);
      
      // 判定結果を計算
      const isHit = (otherHands === guessedCard);
      console.log('[Card2 pred] Judgment result - isHit:', isHit);
      
      // 判定アニメーション実行（攻撃側視点）
      if (Anim && typeof Anim.enqueueGuessAnnounce === 'function') {
        console.log('[Card2] Starting guess announce animation');
        await Anim.enqueueGuessAnnounce(guessedCard, 'attacker');
        console.log('[Card2] Guess announce animation completed');
      }

      if (Anim && typeof Anim.enqueueGuessResult === 'function') {
        console.log('[Card2] Starting guess result animation');
        await Anim.enqueueGuessResult(guessedCard, isHit, 'attacker');
        console.log('[Card2] Guess result animation completed');
      }
      
      // サーバーに予想選択を返す（data.choicesのインデックス）
      callback([guessedCard - 1]);
      
    } catch (error) {
      console.error('[Card2 pred] Error in prediction processing:', error);
      // エラー時はランダムな選択を返す
      const randomIndex = Math.floor(Math.random() * data.choices.length);
      callback([randomIndex]);
    }
  },

  /**
   * showアクション処理
   */
  async handleShow(data, callback) {
    try {
      await show(data.choices);
      addLog(messageManager.getGameMessage('opponentHandReveal', { card: data.choices[0].cards[0] }));
      hideShow();
      callback([0]);
    } catch (e) {
      console.log(e);
    }
  },

  /**
   * trashアクション処理（カード捨て選択）
   */
  async handleTrash(data, callback) {
    try {
      if (data.choices.length > 1){
        Anim.startTurnTimer();
        console.log('[handleTrash] カード捨て選択開始:', data);
        
        // カード9の場合など、相手の手札を見て選択する
        const message = messageManager.getSelectMessage('trash');
        const idx = await select(data.choices, message);
        hideSelect();
        
        const selectedCard = parseInt(data.choices[idx], 10);
        console.log(`[handleTrash] プレイヤーが相手のカード${selectedCard}を選択して捨てさせます`);
        
        // ログに追加（選択したプレイヤー視点）
        addLog(`相手のカード${selectedCard}を捨てさせました`);
        
        Anim.stopTurnTimer();
        callback([idx]);
      }else{
        Anim.startTurnTimer();
        console.log('[handleTrash] カード捨て選択開始:', data);

        const selectedCard = parseInt(data.choices[0], 10);
        console.log(`[handleTrash] プレイヤーが相手のカード${selectedCard}を選択して捨てさせます`);

        // ログに追加（選択したプレイヤー視点）
        addLog(`相手のカード${selectedCard}を捨てさせました`);
        
        Anim.stopTurnTimer();
        callback([0]);
      }
    } catch (e) {
      Anim.stopTurnTimer();
      console.error('[handleTrash] エラーが発生しました:', e);
      callback([0]); // フォールバック
    }
  },

  /**
   * defaultアクション処理
   */
  async handleDefault(data, callback) {
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
  },

  /**
   * 相手の手札データを抽出
   */
  extractOpponentCards(otherHands) {
    let opponentCards = [];
    if (otherHands && otherHands.number) {
      if (Array.isArray(otherHands.number)) {
        opponentCards = otherHands.number.filter(card => !isNaN(parseInt(card, 10))).map(card => parseInt(card, 10));
      } else {
        opponentCards = [parseInt(otherHands.number, 10)].filter(card => !isNaN(card));
      }
    }
    return opponentCards;
  }
};