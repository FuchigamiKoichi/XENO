const socket = io();

let roomId = null;
let playerId = null;
let players = {};
let response = {};
socket.emit('changeSocketid', {id:playerId, roomId: roomId})
// (1) ページが読み込まれたら、すぐに実行
window.addEventListener('DOMContentLoaded', () => {
    
    // (2) URLからパラメータを取得
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('result'); // 'win' または 'lose'
    const reason = params.get('reason');

    roomId = params.get('roomId');
    playerId = params.get('playerId');
    players = params.get('players');
    response = {roomId: roomId, playerId: playerId, players: players}

    console.log(`[result.html読み取りチェック] roomId: ${roomId}, playerId: ${playerId}`);

    if (roomId && playerId) {
        socket.emit('identifyResultPage', { roomId: roomId, playerId: playerId });
    }


    const resultText = document.getElementById('result-text');
    const resultReason = document.getElementById('result-reason');

    if (outcome === 'win') {
        resultText.textContent = 'YOU WIN';
        resultText.className = 'win-text';
    } else if (outcome === 'lose') {
        resultText.textContent = 'YOU LOSE';
        resultText.className = 'lose-text';
    }else{
        resultText.textContent = 'DRAW';
        resultText.className = 'draw-text';
    }

    resultReason.textContent = reason;
});

// 「もう1度遊ぶ」ボタンの処理
document.getElementById('play-again-btn').addEventListener('click', () => {
    // IDが取得できていれば、room.htmlにIDを付けて戻る
    if (roomId) {
        console.log(`再戦リクエストを送信: roomId=${roomId}, playerId=${playerId}`);
        socket.emit('requestRematch', { roomId: roomId, playerId: playerId });

        // ユーザーへのフィードバック
        event.target.textContent = '相手を待っています...';
        event.target.disabled = true; 
        document.getElementById('return-to-lobby-btn').disabled = true;

    } else {
        alert('ルーム情報が取得できませんでした。ロビーに戻ります。');
        window.location.href = '/';
    }
});

socket.on('opponentRequestedRematch', (data) => {
    console.log('相手が再戦を希望しました:', data);
    
    const statusEl = document.getElementById('opponent-status');
    if(statusEl) {
        statusEl.textContent = `${data.name} さんが再戦を希望しています。`;
        statusEl.classList.add('show'); // CSSでフェードイン
    }

    const lobbyBtn = document.getElementById('return-to-lobby-btn');
    if (lobbyBtn) {
        lobbyBtn.textContent = '再戦を待っています';
        lobbyBtn.disabled = true;
    }
});

// (4) サーバーから「ゲーム画面に移動せよ」という指示を受け取る
socket.on('navigateToGame', (data) => {
    console.log('サーバーからゲーム画面への遷移指示を受け取りました:', data.url);
    if (data && data.url) {
        window.location.replace(data.url);
    }
});

// 他のプレイヤーがロビーに戻ることを選択した通知
socket.on('playerWantsToLeave', (data) => {
    console.log('他のプレイヤーがロビー復帰を選択:', data);
    
    const statusEl = document.getElementById('opponent-status');
    if (statusEl) {
        statusEl.textContent = data.message;
        statusEl.classList.add('show');
    }
});

// ルーム解散通知
socket.on('roomDissolved', (data) => {
    console.log('ルーム解散通知:', data);
    alert(data.reason);
    window.location.href = '/';
});
// (4) 「ロビーに戻る」ボタン
document.getElementById('return-to-lobby-btn').addEventListener('click', () => {
    if (roomId && playerId) {
        // サーバーにロビー復帰の意思を通知
        socket.emit('returnToLobby', { roomId, playerId });
        
        // ボタンを無効化してフィードバック
        const button = document.getElementById('return-to-lobby-btn');
        button.textContent = 'ロビーに戻っています...';
        button.disabled = true;
        
        // 少し待ってからロビーに移動
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    } else {
        window.location.href = '/';
    }
});