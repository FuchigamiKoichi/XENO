const  { Card1, Card2, Card3, Card4, Card5, Card6, Card7, Card8, Card9, Card10, shuffle } = require('./card.js');
const {  createData, createLog } = require('./card.js');

class Field {
    constructor(players, game) {
        this.game = game;
        this.played = Array(players.length).fill().map(() => []);
        this.players = players;
        
        // カードの生成
        const cards = [
            new Card1(this),
            new Card2(this),
            new Card3(this),
            new Card4(this),
            new Card5(this),
            new Card6(this),
            new Card7(this),
            new Card8(this),
            new Card9(this),
            new Card10(this)
        ];

        // デッキの生成（通常構成）
        let deck = [];
        
        // 通常のデッキ構成：各カード2枚ずつ（カード10は1枚のみ）
        for (let number = 0; number < 10; number++) {
            if (number + 1 <= 8) {
                // カード1-8は各2枚
                deck.push(cards[number]);
                deck.push(cards[number]);
            } else if (number + 1 === 9) {
                // カード9は1枚
                deck.push(cards[number]);
            } else if (number + 1 === 10) {
                // カード10（英雄）は1枚
                deck.push(cards[number]);
            }
        }

        this.deck = shuffle(deck);
        const reincarnationCard = this.deck.pop();
        this.reincarnation = [reincarnationCard];
    }

    async draw(player, roomId) {
        const choiceFunc = player.choice;
        player.affected = true;
        
        // デッキが空の場合は何もしない
        if (this.deck.length === 0) {
            console.log(`[デッキ空] ${player.name} はカードを引けません。デッキが空です。`);
            player.get = 1;
            return;
        }
        
        const cards = this.deck.slice(0, player.get);
        player.get = 1;
        
        if (cards.length > 0) {
            const choices = cards.map(card => card.number);
            const responce = await choiceFunc(
                createData(this, player),
                choices,
                'draw',
                player.socketId,
                roomId
            );
            const choiceNumber = parseInt(responce);
            
            createLog(
                createData(this, player),
                choices,
                'draw',
                this,
                player,
                choiceNumber
            );

            const getCardIndex = cards.findIndex(card => card.number === choiceNumber);
            const getCard = cards[getCardIndex];
            player.hands.push(getCard);
            this.deck.splice(getCardIndex, 1);
            this.deck = shuffle(this.deck);
        } else {
            console.log(`[警告] ${player.name} が引くべきカードが存在しません。`);
        }
    }
} 
module.exports = {
  Field
};