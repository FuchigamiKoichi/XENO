// カードのスーパークラス
class Card {
    constructor(number, name, field) {
        this.number = number;
        this.name = name;
        this.field = field;
    }

    move(player) {
        const field = this.field;
        const moveIndex = player.hands.findIndex(card => card === this);
        player.hands.splice(moveIndex, 1);
        const turnNumber = parseInt(player.turnNumber);
        field.played[turnNumber - 1].push(this);
    }

    async opponentChoice(me, roomId) {
        const choice = me.choice;
        const field = this.field;
        let num = 0;
        const choices = [];
        const opponentPlayers = [];

        for (const player of field.players) {
            if (player !== me && player.affected) {
                choices.push({ selectNumber: num, player: player.turnNumber });
                num++;
            }
        }

        if (choices.length !== 0) {
            const responce = await choice(
                createData(field, me),
                choices,
                'opponentChoice',
                me.socketId,
                roomId
            )
            const selectedIndex = parseInt(responce);
            
            // selectedIndexに対応するchoicesから実際のplayer.turnNumberを取得
            const selectedChoice = choices.find(choice => choice.selectNumber === selectedIndex);
            if (!selectedChoice) {
                console.log(`[opponentChoice] 選択されたインデックス ${selectedIndex} が見つかりません`);
                return null;
            }
            
            const opponentTurnNumber = selectedChoice.player;
            
            let opponent = null;
            for(const player of field.players) {
                if(player.turnNumber === opponentTurnNumber){
                    opponent = player;
                    break;
                }
            }
            createLog(createData(field, me), choices, 'opponentChoice', field, me, opponentTurnNumber);
            return opponent;
        }
        return null;
    }

    kill(opponent) {
        opponent.live = false;
    }

    kill10(opponent) {
        for (const card of opponent.hands) {
            card.move(opponent);
        }
        const reincarnationCard = this.field.reincarnation.pop();
        opponent.hands.push(reincarnationCard);
    }
}

// カード1: 少年
class Card1 extends Card {
    constructor(field) {
        super(1, '少年', field);
    }

    async play(player, roomId) {
        console.log('playCard1')
        const choice = player.choice;
        const field = this.field;
        const playedCards = field.played.flat();
        
        if (playedCards.some(card => card instanceof Card1)) {
            this.move(player);
            const opponent = await this.opponentChoice(player, roomId);
            if (opponent) {
                if (this.field.deck.length === 0) {
                    console.log('Card1: 山札が空のため効果をスキップ');
                    await choice(
                        createData(this.field, player),
                        ["", ""],
                        'update',
                        player.socketId,
                        roomId
                    );
                    return;
                }
                
                console.log('Card1: 効果実行 - 相手にドローさせて手札を確認');
                
                await choice(
                    createData(this.field, player),
                    ["", ""],
                    'update',
                    player.socketId,
                    roomId
                )

                const getNumber = opponent.get;
                opponent.get = 1;
                await field.draw(opponent, roomId);
                opponent.get = getNumber;
                
                const opponentHands = [...opponent.hands];
                const choices = opponentHands.map(card => card.number);
                
                opponentHands.forEach(card => {
                    player.look.push({ opponent, card });
                    opponent.looked.push({ subject: player, card });
                });

                const responce = await choice(
                    createData(field, player),
                    choices,
                    'trush',
                    player.socketId,
                    roomId
                )
                const cardNumber = parseInt(responce);
                createLog(createData(field, player), choices, 'trush', field, player, cardNumber);
                
                const trushIndex = opponent.hands.findIndex(card => card.number === cardNumber);
                const trushCard = opponent.hands.splice(trushIndex, 1)[0];
                field.played[opponent.turnNumber - 1].push(trushCard);
                
                if (trushCard.number === 10) {
                    this.kill10(opponent);
                }
            }
        } else {
            this.move(player);
        }
    }
}

// カード2: 兵士
class Card2 extends Card {
    constructor(field) {
        super(2, '兵士', field);
    }

    async play(player, roomId) {
        console.log('playCard2')
        const choice = player.choice;
        this.move(player);
        const opponent = await this.opponentChoice(player, roomId);
        
        if (opponent) {
            const field = this.field;
            const cards = [
                new Card1(field), new Card2(field), new Card3(field),
                new Card4(field), new Card5(field), new Card6(field),
                new Card7(field), new Card8(field), new Card9(field),
                new Card10(field)
            ];
            const cardsNumber = cards.map(card => card.number);
            
            const responce = await choice(
                createData(field, player),
                cardsNumber,
                'pred',
                player.socketId,
                roomId
            )
            const predNumber = parseInt(responce);
            createLog(createData(field, player), cardsNumber, 'pred', field, player, predNumber);
            
            const predCard = cards[predNumber - 1];
            player.pred.push({ opponent, predCard });
            
            const isHit = inType(predCard, opponent.hands);
            if (isHit) {
                if (!(predCard instanceof Card10)) {
                    this.kill(opponent);
                } else {
                    this.kill10(opponent);
                }
            }

            // カード2の判定結果は現在クライアントサイドで処理されるため、サーバーからの通知は不要
            // クライアントは自分で攻撃者の手札情報から判定を行う
        }
    }
}

// カード3: 占い師
class Card3 extends Card {
    constructor(field) {
        super(3, '占い師', field);
    }

    async play(player, roomId) {
        console.log('playCard3')
        const choice = player.choice;
        this.move(player);
        const opponent = await this.opponentChoice(player, roomId);
        
        if (opponent) {
            let cards = [];
            for (const card of opponent.hands) {
                player.look.push({ opponent, card });
                opponent.looked.push({ subject: player, card });
                cards.push(card.number);
            }
            const responce = await choice(
                createData(this.field, player),
                [{"opponent":opponent.name, "cards":cards}],
                'show',
                player.socketId,
                roomId
            )
        }
    }
}

// カード4: 乙女
class Card4 extends Card {
    constructor(field) {
        super(4, '乙女', field);
    }

    async play(player, roomId) {
        console.log('playCard4')
        this.move(player);
        player.affected = false;
    }
}

// カード5: 死神
class Card5 extends Card {
    constructor(field) {
        super(5, '死神', field);
    }

    async play(player, roomId) {
        console.log('playCard5')
        const choice = player.choice;
        this.move(player);
        const opponent = await this.opponentChoice(player, roomId);
        
        if (opponent) {
            if (this.field.deck.length === 0) {
                console.log('Card5: 山札が空のため効果をスキップ');
                await choice(
                    createData(this.field, player),
                    ["", ""],
                    'update',
                    player.socketId,
                    roomId
                );
                return;
            }
            
            console.log('Card5: 効果実行 - 相手にドローさせてランダム廃棄');
            
            await choice(
                createData(this.field, player),
                ["", ""],
                'update',
                player.socketId,
                roomId
            )

            const getNumber = opponent.get;
            opponent.get = 1;
            await this.field.draw(opponent, roomId);
            opponent.get = getNumber;
            
            const randomIndex = Math.floor(Math.random() * opponent.hands.length + 1) - 1; // opponent.hands.length分ランダムにするためには+1が必要
            const dropCard = opponent.hands.splice(randomIndex, 1)[0];
            opponent.looked.push({ subject: player, card: dropCard });
            this.field.played[opponent.turnNumber - 1].push(dropCard);
            
            if (dropCard.number === 10) {
                this.kill10(opponent);
            }

            await choice(
                createData(this.field, player),
                ["", ""],
                'update',
                player.socketId,
                roomId
            )
        }
    }
}

// カード6: 貴族
class Card6 extends Card {
    constructor(field) {
        super(6, '貴族', field);
    }

    async play(player, roomId) {
        console.log('playCard6')
        const choice = player.choice;
        this.move(player);
        const opponent = await this.opponentChoice(player, roomId);
        
        if (opponent && player.hands.length > 0) {
            console.log(`[Card6] ${player.name}の手札: ${player.hands[0].number}, ${opponent.name}の手札: ${opponent.hands[0].number}`);
            
            if (player.hands[0].number < opponent.hands[0].number) {
                console.log(`[Card6] ${player.name}が脱落`);
                this.kill(player);
            } else if (player.hands[0].number === opponent.hands[0].number) {
                console.log(`[Card6] 両方脱落`);
                this.kill(player);
                this.kill(opponent);
            } else {
                console.log(`[Card6] ${opponent.name}が脱落`);
                this.kill(opponent);
            }
            
            player.looked.push({ subject: opponent, card: player.hands[0] });
            player.look.push({ opponent, card: opponent.hands[0] });
            opponent.looked.push({ subject: player, card: opponent.hands[0] });
            opponent.look.push({ opponent: player, card: player.hands[0] });

            await choice(
                createData(this.field, player),
                ["", ""],
                'update',
                player.socketId,
                roomId
            )
        }
    }
}

// カード7: 賢者
class Card7 extends Card {
    constructor(field) {
        super(7, '賢者', field);
    }

    async play(player, roomId) {
        console.log('playCard7')
        this.move(player);
        player.get = 3;
    }
}

// カード8: 精霊
class Card8 extends Card {
    constructor(field) {
        super(8, '精霊', field);
    }

    async play(player, roomId) {
        console.log('playCard8')
        const choice = player.choice;
        this.move(player);
        const opponent = await this.opponentChoice(player, roomId);
        
        if (opponent && player.hands.length > 0 && opponent.hands.length > 0) {
            const copySelf = player.hands.pop();
            const copyOpponent = opponent.hands.pop();
            player.hands.push(copyOpponent);
            opponent.hands.push(copySelf);
            
            opponent.look.push({ opponent: player, card: player.hands[0] });
            player.look.push({ opponent, card: opponent.hands[0] });
            opponent.looked.push({ subject: player, card: opponent.hands[0] });
            player.looked.push({ subject: opponent, card: player.hands[0] });
            const responce = await choice(
                createData(this.field, player),
                ["", ""],
                'update',
                player.socketId,
                roomId
            )
        }
    }
}

// カード9: 皇帝
class Card9 extends Card {
    constructor(field) {
        super(9, '皇帝', field);
    }

    async play(player, roomId) {
        console.log('playCard9')
        const choice = player.choice;
        this.move(player);
        const opponent = await this.opponentChoice(player, roomId);
        
        if (opponent) {
            if (this.field.deck.length === 0) {
                console.log('Card9: 山札が空のため効果をスキップ');
                await choice(
                    createData(this.field, player),
                    ["", ""],
                    'update',
                    player.socketId,
                    roomId
                );
                return;
            }
            
            console.log('Card9: 効果実行 - 相手にドローさせて手札を選択廃棄');
            
            await choice(
                createData(this.field, player),
                ["", ""],
                'update',
                player.socketId,
                roomId
            )

            const getNumber = opponent.get;
            opponent.get = 1;
            await this.field.draw(opponent, roomId);
            opponent.get = getNumber;
            
            const opponentHands = [...opponent.hands];
            const choices = opponentHands.map(card => card.number);
            
            opponentHands.forEach(card => {
                player.look.push({ opponent, card });
            });

            const responce = await choice(
                createData(this.field, player),
                choices,
                'trush',
                player.socketId,
                roomId
            )
            const choiceNumber = parseInt(responce);
            createLog(createData(this.field, player), choices, 'trush', this.field, player, choiceNumber);
            
            const choiceIndex = opponent.hands.findIndex(card => card.number === choiceNumber);
            const trushCard = opponent.hands.splice(choiceIndex, 1)[0];
            this.field.played[opponent.turnNumber - 1].push(trushCard);
            
            if (trushCard.number === 10) {
                this.kill(opponent);
            }
        }
    }
}

// カード10: 英雄
class Card10 extends Card {
    constructor(field) {
        super(10, '英雄', field);
    }

    play(player) {
        console.log('playCard10')
        return null;
    }
}

// ヘルパー関数
function createData(field, player) {
    const players = field.players;
    const otherPlayed = {};
    const lookHands = {};
    const lookedHands = {};
    const pred = [];
    const state = {};

    for (let i = 0; i < players.length; i++) {
        if (i + 1 !== player.turnNumber) {
            otherPlayed[i + 1] = [];
            lookHands[i + 1] = [];
            lookedHands[i + 1] = [];
            state[i + 1] = true;
        }
    }

    const myPlayed = [];
    for (let i = 0; i < field.played.length; i++) {
        const played = [...field.played[i]];
        if (i + 1 === player.turnNumber) {
            myPlayed.push(...played.map(card => card.number));
        } else {
            otherPlayed[i + 1].push(...played.map(card => card.number));
        }
    }

    const myHands = player.hands.map(card => card.number);
    
    // fieldから相手の手札情報を取得
    const otherHands = {};
    for (const p of players) {
        if (p !== player && p.live) {
            // 相手プレイヤーの手札をfieldから取得
            otherHands[p.turnNumber] = p.hands.map(card => card.number);
        }
    }

    for (const lookData of player.look) {
        const opponent = lookData.opponent;
        const card = lookData.card;
        lookHands[opponent.turnNumber].push(card.number);
    }

    for (const lookedData of player.looked) {
        const card = lookedData.card;
        const subject = lookedData.subject;
        lookedHands[subject.turnNumber].push(card.number);
    }

    for (const p of players) {
        if (p !== player) {
            state[p.turnNumber] = {
                live: p.live,
                affected: p.affected  // affected状態も含める
            };
        }
    }

    const allPreds = [];
    for (const p of players) {
        if (p !== player) {
            for (const pred of p.pred) {
                allPreds.push({
                    subject: p.turnNumber,
                    object: pred.opponent.turnNumber,
                    predCard: pred.predCard.number
                });
            }
        } else {
            for (const pred of player.pred) {
                allPreds.push({
                    subject: player.turnNumber,
                    object: pred.opponent.turnNumber,
                    predCard: pred.predCard.number
                });
            }
        }
    }
    pred.push(...allPreds);

    const playersHandsLengths = []
    for (const player of players){
        playersHandsLengths.push({
            turnNumber: player.turnNumber,
            length: player.hands.length
        })
    }

    return {
        playersLength: players.length,
        myTurnNumber: player.turnNumber,
        otherPlayers: state,
        cardNumber: field.deck.length,
        myHands,
        otherHands,  // fieldから取得した相手の手札情報
        myPlayed,
        otherPlayed,
        lookHands,
        lookedHands,
        pred,
        playersHandsLengths,
        reincarnation: field.reincarnation.length > 0,
        roomId: field.game?.roomId || null  // ゲームのroomIdを追加
    };
}

function createLog(now, choices, kind, field, player, choice) {
    const out = { now, kind, choices, choice };
    if (kind === 'opponentChoice') {
        const outChoices = choices.map(c => c.player.turnNumber);
        const selectedChoice = choices.find(c => c.selectNumber === choice);
        if (selectedChoice) {
            out.choice = selectedChoice.player.turnNumber;
        }
        out.choices = outChoices;
    }
    
    const playerIndex = field.players.findIndex(p => p === player);
    if (playerIndex !== -1) {
        field.game.log[playerIndex].push(out);
    }
}

// シャッフル関数
function shuffle(list) {
    const listCopy = [...list];
    const arange = Array.from({ length: list.length }, (_, i) => i);
    for (let i = arange.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arange[i], arange[j]] = [arange[j], arange[i]];
    }
    return arange.map(i => listCopy[i]);
}

// 型チェック関数
function inType(sample, list) {
    return list.some(content => content instanceof sample.constructor);
} 

module.exports = {
  Card1,
  Card2,
  Card3,
  Card4,
  Card5,
  Card6,
  Card7,
  Card8,
  Card9,
  Card10,
  createData,
  createLog,
  shuffle
};