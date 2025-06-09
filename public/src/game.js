const { Player } = require('./player.js');
const { Field } = require('./field.js');
const { shuffle } =  require('./card.js');
const { createData, createLog } = require('./card.js');

class Game {
    constructor(playerNumber, funcs, gameData) {
        // プレイヤーの生成
        const players = [];
        for (let i = 0; i < playerNumber; i++) {
            const getNameFunc = funcs[i].get_name;
            const choiceFunc = funcs[i].choice;
            const name = String(getNameFunc(gameData.roomId,i));
            console.log(gameData.players[i])
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
                    // 同点の場合は全員負け
                    for (let i = 0; i < players.length; i++) {
                        this.log[i].push('lose');
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

    turn(player) {
        const choice = player.choice;
        this.field.draw(player);
        
        if (player.hands.length > 1) {
            const hands = player.hands
                .filter(card => card.number !== 10)
                .map(card => card.number);

            const cardNumber = parseInt(choice(
                createData(this.field, player),
                hands,
                'play_card',
                player.playerId
            ));

            createLog(
                createData(this.field, player),
                hands,
                'play_card',
                this.field,
                player,
                cardNumber
            );

            const cardIndex = player.hands.findIndex(card => card.number === cardNumber);
            player.hands[cardIndex].play(player);
        }
    }

    game() {
        try {
            const players = this.field.players;
            let state = [true];

            // 初期手札の配布
            for (const player of players) {
                this.field.draw(player);
            }

            // ゲームループ
            while (state[0]) {
                for (const player of players) {
                    state = this.isContinue();
                    if (state[0]) {
                        this.turn(player);
                    } else {
                        this.winners = state[1];
                        this.losers = state[2];
                        break;
                    }
                }
            }

            return [true, this.log];
        } catch (e) {
            const info = e.stack;
            return [false, info, this.log];
        }
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