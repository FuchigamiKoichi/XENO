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

    let countdown = 10;
    const timerDisplay = document.getElementById('rematch-timer');
    const rematchButton = document.getElementById('rematch-btn');

    const rematchTimeout = setTimeout(() => {
        rematchButton.click(); 
    }, 10000);

    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            timerDisplay.textContent = `${countdown}秒後に自動で再戦します...`;
        } else {
            timerDisplay.textContent = '再戦を開始します...';
            clearInterval(countdownInterval);
        }
    }, 1000);

    function cancelAutoRematch() {
        clearTimeout(rematchTimeout);
        clearInterval(countdownInterval);
        timerDisplay.style.display = 'none';
    }
    rematchButton.addEventListener('click', cancelAutoRematch);
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
// Accessible modal for notifications
function showAccessibleModal(message, callback) {
    let modal = document.getElementById('accessible-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'accessible-modal';
        modal.setAttribute('role', 'alertdialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('tabindex', '-1');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div style="background: white; padding: 2em; border-radius: 8px; max-width: 90vw; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                <div id="accessible-modal-message" style="margin-bottom: 1em;" tabindex="0"></div>
                <button id="accessible-modal-ok" style="padding: 0.5em 1em;">OK</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    const msgEl = modal.querySelector('#accessible-modal-message');
    msgEl.textContent = message;
    msgEl.focus();
    const okBtn = modal.querySelector('#accessible-modal-ok');
    okBtn.focus();
    okBtn.onclick = () => {
        modal.style.display = 'none';
        if (callback) callback();
    };
    // Allow Enter/Escape to close
    modal.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            okBtn.click();
        }
    };
}

socket.on('roomDissolved', (data) => {
    console.log('ルーム解散通知:', data);
    showAccessibleModal(data.reason, () => {
        window.location.href = '/';
    });
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