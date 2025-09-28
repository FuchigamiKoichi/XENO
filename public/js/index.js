const socket = io();

// プレイヤー名の登録
const select_room = document.getElementById('selectRooms');
const text_name = document.getElementById('name');


// ルームの選択
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const showRoomsBtn = document.getElementById('showRoomsBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomInfo = document.getElementById('roomInfo');
const gameArea = document.getElementById('gameArea');

const rooms = document.getElementById('rooms');
const gameStart = document.getElementById('startGameBtn');

function joinRoom(roomId){
    socket.emit('joinRoom', roomId, (response) => {
    if (!response || !response.success) {
        alert(response ? response.message : 'ルーム参加に失敗しました');
    } else {
        window.location.replace(`game.html?roomId=${roomId}&playerId=${response.playerId}&players=${response.players}`)
    }
    });
}

// ルームを確認する
showRoomsBtn.addEventListener('click', () => {
    const player_name = text_name.value;
    socket.emit('registPlayer', {name: player_name});
    socket.emit('showRooms', { maxPlayers: 4 }, (response) => {
    if (response && response.rooms) {
        let room_list = Object.keys(response.rooms);
        rooms.innerHTML = "";
        for (let i=0; i<room_list.length; i++) {
        let item = document.createElement('button');
        
        // シンプルなボタンスタイル
        item.style.width = "100%";
        item.style.padding = "12px";
        item.style.marginBottom = "5px";
        item.style.backgroundColor = "white";
        item.style.color = "#333";
        item.style.border = "1px solid #ddd";
        item.style.borderRadius = "4px";
        item.style.cursor = "pointer";
        item.style.fontSize = "14px";
        item.style.textAlign = "left";
        
        // ルーム情報をシンプルなテキストで表示
        let roomInfo = `ルーム: ${room_list[i]} | オーナー: ${response.players[response.rooms[room_list[i]].owner].name}`;
        item.textContent = roomInfo;
        
        // ホバー効果
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = "#f8f8f8";
        });
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = "white";
        });
        
        item.addEventListener('click', () => {
            joinRoom(room_list[i])
        });
        
        rooms.appendChild(item);
        window.scrollTo(0, document.body.scrollHeight);
        }
    }
    })
})

// ルームを作成する
createRoomBtn.addEventListener('click', () => {
    
    const player_name = text_name.value;
    socket.emit('registPlayer', {name: player_name});
    select_room.style.display = 'block';

    socket.emit('createRoom', { maxPlayers: 4 }, (response) => {
    if (response && response.roomId) {
        joinRoom(response.roomId)
        // roomInfo.innerText = 'ルームが作成されました: ' + response.roomId;
    }
    });
});

// 既存のルームに参加する
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value;
    
    socket.emit('joinRoom', roomId, (response) => {
    if (!response || !response.success) {
        alert(response ? response.message : 'ルーム参加に失敗しました');
    } else {
        window.replace()
    }
    });
});

// ルームのメンバー更新を受け取る
socket.on('updateRoomMembers', (data) => {
    roomInfo.innerText = `メンバーが更新されました: ${data.players.join(', ')}`;
});

// ゲーム開始
// ここではサンプルとして、参加後すぐに開始ボタンを出す例
function startGame(roomId) {
    socket.emit('startGame', roomId);
    socket.on('redirect', (url) => {
    console.log('画面遷移:',url);
    location.replace(url);
    })
}

// ゲーム開始イベントを受け取る
socket.on('gameStarted', (data) => {
    gameArea.innerText = data.message;
    // ここでゲーム用の画面を作っていく
});

// ゲーム状態更新イベントを受け取る
socket.on('gameStateUpdate', (data) => {
    // data.action などを使ってゲーム画面をリアルタイム更新
    // console.log('gameStateUpdate', data);
});

// プレイヤー操作を送る例
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
    // 例えば現在のルームIDを roomId として
    const roomId = roomIdInput.value;
    socket.emit('playerAction', roomId, { move: 'up' });
    }
});