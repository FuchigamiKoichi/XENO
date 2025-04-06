const cards = [
    { id: 1, name: "兵士", effect: "相手の手札を推測し当たれば脱落" },
    { id: 2, name: "騎士", effect: "互いの手札を見せ合い、数値が小さい方が脱落" },
    { id: 3, name: "僧侶", effect: "次のターンまで効果を受けない" },
    { id: 4, name: "暗殺者", effect: "相手に1枚捨てさせる" },
    { id: 5, name: "貴族", effect: "次のターンまで交換を受け付けない" },
    { id: 6, name: "精霊", effect: "自分の手札を交換する" },
    { id: 7, name: "賢者", effect: "次のターンまで場の効果を受けない" },
    { id: 8, name: "英雄", effect: "皇帝以外の効果で捨てさせられると転生" },
    { id: 9, name: "死神", effect: "相手の手札が6以上なら脱落" },
    { id: 10, name: "皇帝", effect: "英雄を持っている相手を脱落させる" },
];

const player1 = {
    name: "Player 1",
    hand: [],  // 手札（最大2枚）
    isProtected: false,  // 僧侶の効果で守られているか
    isEliminated: false  // 脱落しているか
};

const player2 = {
    name: "Player 2",
    hand: [],
    isProtected: false,
    isEliminated: false
};

function shuffleDeck() {
    let deck = [];
    for (let card of cards) {
        if (card.id <= 8) {
            deck.push(card, card);  // 1〜8は2枚ずつ
        } else {
            deck.push(card);  // 9と10は1枚ずつ
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function dealCards(deck, player) {
    player.hand.push(deck.pop(), deck.pop());  // 2枚引く
}

function playTurn(player, opponent, deck) {
    if (deck.length > 0) {
        player.hand.push(deck.pop());  // 1枚引く
    }
    
    let playedCard = player.hand.shift();  // 手札から1枚出す
    console.log(`${player.name} は ${playedCard.name} をプレイ！`);

    applyCardEffect(playedCard, player, opponent, deck);  // 効果を適用
}
