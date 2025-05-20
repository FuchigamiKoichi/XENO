// カードのスーパークラス
export class Card {
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

    opponentChoice(me) {
        const choice = me.choice;
        const field = this.field;
        let num = 0;
        const choices = [];
        const opponentPlayers = [];

        for (const player of field.players) {
            if (player !== me && player.affected) {
                opponentPlayers.push(player);
                choices.push({ selectNumber: num, player: player });
                num++;
            }
        }

        if (opponentPlayers.length !== 0) {
            const opponentNumber = parseInt(choice(
                createData(field, me),
                choices,
                'opponentChoice'
            ));
            createLog(createData(field, me), choices, 'opponentChoice', field, me, opponentNumber);
            return opponentPlayers[opponentNumber];
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
export class Card1 extends Card {
    constructor(field) {
        super(1, '少年', field);
    }

    play(player) {
        const choice = player.choice;
        const field = this.field;
        const playedCards = field.played.flat();
        
        if (playedCards.some(card => card instanceof Card1)) {
            this.move(player);
            const opponent = this.opponentChoice(player);
            if (opponent && this.field.deck.length > 0) {
                const getNumber = opponent.get;
                opponent.get = 1;
                field.draw(opponent);
                opponent.get = getNumber;
                
                const opponentHands = [...opponent.hands];
                const choices = opponentHands.map(card => card.number);
                
                opponentHands.forEach(card => {
                    player.look.push({ opponent, card });
                    opponent.looked.push({ subject: player, card });
                });

                const cardNumber = parseInt(choice(
                    createData(field, player),
                    choices,
                    'trush'
                ));
                createLog(createData(field, player), choices, 'trush', field, player, cardNumber);
                
                const trushIndex = opponent.hands.findIndex(card => card.number === cardNumber);
                const trushCard = opponent.hands.splice(trushIndex, 1)[0];
                field.played[player.turnNumber - 1].push(trushCard);
                
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
export class Card2 extends Card {
    constructor(field) {
        super(2, '兵士', field);
    }

    play(player) {
        const choice = player.choice;
        this.move(player);
        const field = this.field;
        const opponent = this.opponentChoice(player);
        
        if (opponent) {
            const cards = [
                new Card1(field), new Card2(field), new Card3(field),
                new Card4(field), new Card5(field), new Card6(field),
                new Card7(field), new Card8(field), new Card9(field),
                new Card10(field)
            ];
            const cardsNumber = cards.map(card => card.number);
            
            const predNumber = parseInt(choice(
                createData(field, player),
                cardsNumber,
                'pred'
            ));
            createLog(createData(field, player), cardsNumber, 'pred', field, player, predNumber);
            
            const predCard = cards[predNumber - 1];
            player.pred.push({ opponent, predCard });
            
            if (inType(predCard, opponent.hands)) {
                if (!(predCard instanceof Card10)) {
                    this.kill(opponent);
                } else {
                    this.kill10(opponent);
                }
            }
        }
    }
}

// カード3: 占い師
export class Card3 extends Card {
    constructor(field) {
        super(3, '占い師', field);
    }

    play(player) {
        const choice = player.choice;
        this.move(player);
        const opponent = this.opponentChoice(player);
        
        if (opponent) {
            for (const card of opponent.hands) {
                player.look.push({ opponent, card });
                opponent.looked.push({ subject: player, card });
            }
        }
    }
}

// カード4: 乙女
export class Card4 extends Card {
    constructor(field) {
        super(4, '乙女', field);
    }

    play(player) {
        this.move(player);
        player.affected = false;
    }
}

// カード5: 死神
export class Card5 extends Card {
    constructor(field) {
        super(5, '死神', field);
    }

    play(player) {
        const choice = player.choice;
        this.move(player);
        const opponent = this.opponentChoice(player);
        
        if (opponent && this.field.deck.length > 0) {
            const getNumber = opponent.get;
            opponent.get = 1;
            this.field.draw(player);
            opponent.get = getNumber;
            
            const randomIndex = Math.floor(Math.random() * opponent.hands.length);
            const dropCard = opponent.hands.splice(randomIndex, 1)[0];
            opponent.looked.push({ subject: player, card: dropCard });
            this.field.played[opponent.turnNumber - 1].push(dropCard);
            
            if (dropCard.number === 10) {
                this.kill10(opponent);
            }
        }
    }
}

// カード6: 貴族
export class Card6 extends Card {
    constructor(field) {
        super(6, '貴族', field);
    }

    play(player) {
        const choice = player.choice;
        this.move(player);
        const opponent = this.opponentChoice(player);
        
        if (opponent && player.hands.length > 0) {
            if (player.hands[0].number < opponent.hands[0].number) {
                this.kill(player);
            } else if (player.hands[0].number === opponent.hands[0].number) {
                this.kill(player);
                this.kill(opponent);
            } else {
                this.kill(opponent);
            }
            
            player.looked.push({ subject: opponent, card: player.hands[0] });
            player.look.push({ opponent, card: opponent.hands[0] });
            opponent.looked.push({ subject: player, card: opponent.hands[0] });
            opponent.look.push({ opponent: player, card: player.hands[0] });
        }
    }
}

// カード7: 賢者
export class Card7 extends Card {
    constructor(field) {
        super(7, '賢者', field);
    }

    play(player) {
        this.move(player);
        player.get = 3;
    }
}

// カード8: 精霊
export class Card8 extends Card {
    constructor(field) {
        super(8, '精霊', field);
    }

    play(player) {
        const choice = player.choice;
        this.move(player);
        const opponent = this.opponentChoice(player);
        
        if (opponent && player.hands.length > 0 && opponent.hands.length > 0) {
            const copySelf = player.hands.pop();
            const copyOpponent = opponent.hands.pop();
            player.hands.push(copyOpponent);
            opponent.hands.push(copySelf);
            
            opponent.look.push({ opponent: player, card: player.hands[0] });
            player.look.push({ opponent, card: opponent.hands[0] });
            opponent.looked.push({ subject: player, card: opponent.hands[0] });
            player.looked.push({ subject: opponent, card: player.hands[0] });
        }
    }
}

// カード9: 皇帝
export class Card9 extends Card {
    constructor(field) {
        super(9, '皇帝', field);
    }

    play(player) {
        const choice = player.choice;
        this.move(player);
        const opponent = this.opponentChoice(player);
        
        if (opponent && this.field.deck.length > 0) {
            const getNumber = opponent.get;
            opponent.get = 1;
            this.field.draw(player);
            opponent.get = getNumber;
            
            const opponentHands = [...opponent.hands];
            const choices = opponentHands.map(card => card.number);
            
            opponentHands.forEach(card => {
                player.look.push({ opponent, card });
            });

            const choiceNumber = parseInt(choice(
                createData(this.field, player),
                choices,
                'trush'
            ));
            createLog(createData(this.field, player), choices, 'trush', this.field, player, choiceNumber);
            
            const choiceIndex = opponent.hands.findIndex(card => card.number === choiceNumber);
            const trushCard = opponent.hands.splice(choiceIndex, 1)[0];
            this.field.played[player.turnNumber - 1].push(trushCard);
            
            if (trushCard.number === 10) {
                this.kill(opponent);
            }
        }
    }
}

// カード10: 英雄
export class Card10 extends Card {
    constructor(field) {
        super(10, '英雄', field);
    }

    play(player) {
        return null;
    }
}

// ヘルパー関数
export function createData(field, player) {
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
            state[p.turnNumber] = p.live;
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

    return {
        playersLength: players.length,
        myTurnNumber: player.turnNumber,
        otherPlayers: state,
        cardNumber: field.deck.length,
        myHands,
        myPlayed,
        otherPlayed,
        lookHands,
        lookedHands,
        pred,
        reincarnation: field.reincarnation.length > 0
    };
}

export function createLog(now, choices, kind, field, player, choice) {
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
export function shuffle(list) {
    const listCopy = [...list];
    const arange = Array.from({ length: list.length }, (_, i) => i);
    for (let i = arange.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arange[i], arange[j]] = [arange[j], arange[i]];
    }
    return arange.map(i => listCopy[i]);
}

// 型チェック関数
export function inType(sample, list) {
    return list.some(content => content instanceof sample.constructor);
} 