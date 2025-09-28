const { EventEmitter } = require('events');
const { Player } = require('./player.js');
const { Field } = require('./field.js');
const { shuffle } =  require('./card.js');
const { createData, createLog } = require('./card.js');

class Game extends EventEmitter{
    constructor(playerNumber, funcs, gameData, roomId) {
        super();
        this.roomId = roomId;
        this.isForcefullyEnded = false; // 強制終了フラグ
        // プレイヤーの生成
        const players = [];
        for (let i = 0; i < playerNumber; i++) {
            const getNameFunc = funcs[i].get_name;
            const choiceFunc = funcs[i].choice;
            const name = String(getNameFunc(gameData.roomId,i));
            //const currentSocketId = this.jsonData.players[gameData.players[i]].socketId;
            players.push(new Player(name, choiceFunc, gameData.players[i]));
        }

        // プレイヤーのシャッフルと順番の設定
        const shuffledPlayers = shuffle(players);
        shuffledPlayers.forEach((player, index) => {
            player.turnNumber = index + 1;
        });

        // ゲームフィールドの生成
        this.field = new Field(shuffledPlayers, this);

        // 勝者と敗者
        this.winners = [];
        this.losers = [];

        // 戦績ログ
        this.log = Array(players.length).fill().map(() => []);
    }

    isContinue() {
        const field = this.field;
        const players = field.players;

        let liveCount = 0;
        for (const player of players) {
            if (player.live) {
                liveCount++;
            }
        }

        if (field.deck.length === 0 || liveCount < 2) {
            if (liveCount >= 2) {
                // 手札があるプレイヤーだけを対象にする
                const playersWithHands = players.filter(p => p.live && p.hands.length > 0);
                
                if (playersWithHands.length === 0) {
                    // 手札があるプレイヤーがいない場合は全員負け
                    for (let i = 0; i < players.length; i++) {
                        this.log[i].push('lose');
                    }
                    return [false, [], players];
                }

                let maxArg = 0;
                let eq = true;

                for (let i = 0; i < playersWithHands.length; i++) {
                    const player = playersWithHands[i];
                    const max = playersWithHands[maxArg];
                    if (player.hands[0].number > max.hands[0].number) {
                        maxArg = i;
                    }
                    if (player.hands[0].number !== max.hands[0].number) {
                        eq = false;
                    }
                }

                if (eq) {
                    // 同点の場合は全員ドロー
                    for (let i = 0; i < players.length; i++) {
                        this.log[i].push('draw');
                    }
                } else {
                    // 勝者と敗者を決定
                    const maxPlayer = playersWithHands[maxArg];
                    for (let i = 0; i < players.length; i++) {
                        const player = players[i];
                        if (player.live && player.hands.length > 0 && 
                            player.hands[0].number === maxPlayer.hands[0].number) {
                            this.log[i].push('win');
                            this.winners.push(player);
                        } else {
                            this.log[i].push('lose');
                            this.losers.push(player);
                        }
                    }
                }
            } else {
                // 生存者が2人未満の場合
                for (let i = 0; i < players.length; i++) {
                    if (players[i].live) {
                        this.log[i].push('win');
                        this.winners.push(players[i]);
                    } else {
                        this.log[i].push('lose');
                        this.losers.push(players[i]);
                    }
                }
            }
            return [false, this.winners, this.losers];
        }
        return [true];
    }

    async turn(player) {
        const choice = player.choice;
        await this.field.draw(player, this.roomId);
        
        if (player.hands.length > 1) {
            const hands = player.hands
                .filter(card => card.number !== 10)
                .map(card => card.number);

            const response = await choice(
                createData(this.field, player),
                hands,
                'play_card',
                player.socketId,
                this.roomId
            );

            console.log(response)

            if (!response) {
                console.log(`${player.name} がタイムアウトしました。`);
                player.live = false;

                const playerIndex = this.field.players.findIndex(p => p.id === player.id);
                if (playerIndex !== -1) {
                    this.log[playerIndex].push('LOSE (by timeout)');
                }
                
                const opponent = this.field.players.find(p => p.id !== player.id && p.live);
                if (opponent) {
                    const opponentIndex = this.field.players.findIndex(p => p.id === opponent.id);
                    if (opponentIndex !== -1) {
                        this.log[opponentIndex].push('WIN (opponent timeout)');
                    }
                }
                return;
            }

            const cardNumber = parseInt(response);

            createLog(
                createData(this.field, player),
                hands,
                'play_card',
                this.field,
                player,
                cardNumber
            );

            const cardIndex = player.hands.findIndex(card => card.number === cardNumber);
            await player.hands[cardIndex].play(player, this.roomId);
        }
    }

    forceSurrender(playerId) {
        const player = this.field.players.find(p => p.id === playerId);
        
        if (player) {
            console.log(`${player.name} を強制降参させるで`);
            player.live = false;
        }
        this.isForcefullyEnded = true; // ループを停止させるフラグを立てる
        console.log(`[ゲーム] isForcefullyEndedフラグを ${this.isForcefullyEnded} に設定しました。`);
        this.emit('cancelChoice'); // もし選択待ちならキャンセルする
        this.isContinue();
        console.log("isContinueを実行")
    }


    async game() {
        let endReason = 'NormalEnd'; // ゲームの終了理由を記録する変数
        try {
            const players = this.field.players;
            let state = [true];

            // 初期手札の配布
            for (const player of players) {
                await this.field.draw(player, this.roomId);
            }

            // ゲームループ
            while (state[0] && !this.isForcefullyEnded) {
                for (const player of players) {
                    //脱落したプレイヤーのターンはスキップする
                    if (!player.live) {
                        console.log(`> ${player.name} は脱落済みのため、ターンをスキップします。`);
                        continue;
                    }
                    console.log(`[ループ内チェック] 現在のプレイヤー: ${player.name}, 生存状態: ${player.live}`);
                    state = this.isContinue();
                    console.log(`[isContinue判定結果] ゲームを継続しますか？ -> ${state[0]}`);
                    console.log(`this.isForcefullyEnded: ${this.isForcefullyEnded}`);
                    if (state[0] && !this.isForcefullyEnded) {
                        await this.turn(player);
                    } else {
                        this.winners = state[1];
                        this.losers = state[2];
                        break;
                    }
                }
            }
            console.log('gameDone: ゲームループが正常に終了しました。')

            return [true, this.log];
        } catch (e) {
            if (e && e.message === 'Player surrendered') {
                console.log('ゲームが降参により正常に中断されました。');
                endReason = 'Surrender';
            } else {
                const info = e.stack || e.toString();
                console.error("ゲームループ中に予期せぬエラーが発生しました:", info);
                return [false, info, this.log];
            }
        }
        console.log('ゲームが終了しました。最終的な勝敗を決定します。');
        return { success: true, reason: endReason, log: this.log };
    }
}

// CPUプレイヤーの選択関数
function choiceCpu(now, choices, kind) {
    const number = Math.floor(Math.random() * choices.length);
    if (kind === 'opponentChoice') {
        const choice = choices[number];
        return choice.selectNumber;
    }
    return choices[number];
}

// CPUプレイヤーの命名関数
function getNameCpu(index) {
    return `test_player${index}`;
}

// 使用例
const funcs = [
    { get_name: getNameCpu, choice: choiceCpu },
    { get_name: getNameCpu, choice: choiceCpu }
];

// ゲームの実行
// for(let i = 0; i < 10; i++) {
//     const game = new Game(2, funcs);
//     const result = game.game();
//     if(!(result[0])) {
//         console.log('ゲーム結果:', result);
//     }
// }

module.exports = {
  Game
};