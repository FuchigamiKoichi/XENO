function createLog(now, choices, kind, field, player, choice) {
    const out = { now: now, kind: kind, choices: choices, choice: choice };
    if (kind === 'opponentChoice') {
        const outChoices = [];
        const choicesCopy = [...choices];
        for (let i = 0; i < choicesCopy.length; i++) {
            outChoices.push(choicesCopy[i].player.turn_number);
            if (choicesCopy[i].select_number === choice) {
                out.choice = choicesCopy[i].player.turn_number;
            }
        }
        out.choices = outChoices;
    }
    for (let i = 0; i < field.players.length; i++) {
        if (field.players[i] === player) {
            field.game.log[i].push(out);
        }
    }
}

function createData(field, player) {
    const players = field.players;
    const other_played = {};
    const look_hands = {};
    const looked_hands = {};
    const pred = [];
    const state = {};

    for (let i = 0; i < players.length; i++) {
        if (i + 1 !== player.turn_number) {
            other_played[i + 1] = [];
            look_hands[i + 1] = [];
            looked_hands[i + 1] = [];
            state[i + 1] = true;
        }
    }

    const my_played = [];
    for (let i = 0; i < field.played.length; i++) {
        const played = [...field.played[i]];
        if (i + 1 === player.turn_number) {
            for (let j = 0; j < played.length; j++) {
                my_played.push(played[j].number);
            }
        } else {
            for (let j = 0; j < played.length; j++) {
                other_played[i + 1].push(played[j].number);
            }
        }
    }

    const my_hands = [];
    for (const card of player.hands) {
        my_hands.push(card.number);
    }

    for (const look_data of player.look) {
        const opponent = look_data.opponent;
        const card = look_data.card;
        look_hands[opponent.turn_number].push(card.number);
    }

    for (const looked_data of player.looked) {
        const card = looked_data.card;
        const subject = looked_data.subject;
        looked_hands[subject.turn_number].push(card.number);
    }

    for (let i = 0; i < players.length; i++) {
        if (players[i] !== player) {
            if (!players[i].live) {
                state[players[i].turn_number] = false;
            }
        }
    }

    for (let i = 0; i < players.length; i++) {
        const stranger = players[i];
        if (stranger !== player) {
            for (const stranger_pred of stranger.pred) {
                const subject_num = stranger.turn_number;
                const object = stranger_pred.opponent;
                const pred_card_num = stranger_pred.pred_card.number;
                const object_num = object.turn_number;
                pred.push({
                    subject: subject_num,
                    object: object_num,
                    pred_card: pred_card_num
                });
            }
        } else {
            for (const player_pred of player.pred) {
                const subject_num = player.turn_number;
                const object = player_pred.opponent;
                const pred_card_num = player_pred.pred_card.number;
                const object_num = object.turn_number;
                pred.push({
                    subject: subject_num,
                    object: object_num,
                    pred_card: pred_card_num
                });
            }
        }
    }

    const data = {
        players_length: players.length,
        my_turn_number: player.turn_number,
        other_players: state,
        card_number: field.deck.length,
        my_hands: my_hands,
        my_played: my_played,
        other_played: other_played,
        look_hands: look_hands,
        looked_hands: looked_hands,
        pred: pred,
        reincarnation: field.reincarnation.length > 0
    };

    return data;
}

function shuffle(list) {
    const list_copy = [...list];
    const arange = Array.from({ length: list.length }, (_, i) => i);
    for (let i = arange.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arange[i], arange[j]] = [arange[j], arange[i]];
    }
    const result = [];
    for (const i of arange) {
        result.push(list_copy[i]);
    }
    return result;
}

function inType(sample, list) {
    for (const content of list) {
        if (content.constructor === sample.constructor) {
            return true;
        }
    }
    return false;
}

// JavaScript版のPlayerクラス
class Player {
    constructor(name, func) {
      this.name = name;
      this.turn_number = -1;
      this.live = true;
      this.hands = [];
      this.played = [];
      this.look = [];
      this.looked = [];
      this.pred = [];
      this.affected = true;
      this.get = 1;
      this.choice = func;
    }
  }
  
  // JavaScript版のFieldクラス
  class Field {
    constructor(players, game) {
      this.game = game;
      this.played = Array(players.length).fill().map(() => []);
      this.players = players;
  
      const cards = [new Card1(this), new Card2(this), new Card3(this), new Card4(this), new Card5(this), new Card6(this), new Card7(this), new Card8(this), new Card9(this), new Card10(this)];
  
      this.deck = [];
      for (let number = 0; number < 10; number++) {
        if (number + 1 <= 8) {
          for (let i = 0; i < 2; i++) {
            this.deck.push(cards[number]);
          }
        } else {
          this.deck.push(cards[number]);
        }
      }
      this.deck = shuffle(this.deck);
      const reincarnationCard = this.deck.pop();
      this.reincarnation = [reincarnationCard];
    }
  
    draw(player) {
      const choiceFunc = player.choice;
      player.affected = true;
      const cards = this.deck.slice(0, player.get);
  
      if (cards.length > 0) {
        const choices = cards.map(card => card.number);
        const choiceNumber = parseInt(choiceFunc(create_data(this, player), choices, 'draw'));
        create_log(create_data(this, player), choices, 'draw', this, player, choiceNumber);
  
        let getCardIndex = -1;
        for (let i = 0; i < cards.length; i++) {
          if (cards[i].number === choiceNumber) {
            getCardIndex = i;
            break;
          }
        }
        const getCard = cards[getCardIndex];
        getCard.player = player;
        player.hands.push(getCard);
        this.deck.splice(getCardIndex, 1);
        player.get = 1;
      }
    }
  }
  
  // カードのスーパークラス
  class Card {
    constructor(number, name, field) {
      this.number = number;
      this.name = name;
      this.field = field;
    }
  
    move(player) {
      const field = this.field;
      let moveIndex = player.hands.findIndex(card => card === this);
      if (moveIndex !== -1) {
        player.hands.splice(moveIndex, 1);
        const turnNumber = parseInt(player.turn_number);
        field.played[turnNumber - 1].push(this);
      }
    }
  
    opponentChoice(me) {
      const choice = me.choice;
      const field = this.field;
      let num = 0;
      let choices = [];
      let opponentPlayers = [];
  
      for (const player of field.players) {
        if (player !== me && player.affected) {
          choices.push({ select_number: num, player });
          opponentPlayers.push(player);
          num++;
        }
      }
  
      if (opponentPlayers.length !== 0) {
        const opponentNumber = parseInt(choice(create_data(this.field, me), choices, 'opponentChoice'));
        create_log(create_data(this.field, me), choices, 'opponentChoice', this.field, me, opponentNumber);
        return opponentPlayers[opponentNumber];
      } else {
        return null;
      }
    }
  
    kill(opponent) {
      opponent.live = false;
    }
  
    kill10(opponent) {
      for (const card of [...opponent.hands]) {
        card.move(opponent);
      }
      const reincarnationCard = this.field.reincarnation.pop();
      opponent.hands.push(reincarnationCard);
    }
  }



// Card1: 少年
class Card1 extends Card {
    constructor(field) {
      super(1, '少年', field);
    }
  
    play(player) {
      const choice = player.choice;
      const field = this.field;
      const played = field.played.flat();
  
      if (inType(new Card1(field), played)) {
        this.move(player);
        const opponent = this.opponentChoice(player);
        if (opponent && field.deck.length > 0) {
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
  
          const cardNumber = parseInt(choice({ now: create_data(field, player), choices, kind: 'trush' }));
          create_log(create_data(field, player), choices, 'trush', field, player, cardNumber);
  
          const trushIndex = opponent.hands.findIndex(c => c.number === cardNumber);
          if (trushIndex !== -1) {
            const trushCard = opponent.hands.splice(trushIndex, 1)[0];
            field.played[player.turn_number - 1].push(trushCard);
          }
        }
      } else {
        this.move(player);
      }
    }
  }
  
  // Card2: 兵士
  class Card2 extends Card {
    constructor(field) {
      super(2, '兵士', field);
    }
  
    play(player) {
      const choice = player.choice;
      this.move(player);
      const field = this.field;
      const opponent = this.opponentChoice(player);
  
      if (opponent) {
        const cards = [1,2,3,4,5,6,7,8,9,10].map(n => new globalThis[`Card${n}`](field));
        const cardsNumber = cards.map(card => card.number);
        const predNumber = parseInt(choice({ now: create_data(field, player), choices: cardsNumber, kind: 'pred' }));
        create_log(create_data(field, player), cardsNumber, 'pred', field, player, predNumber);
  
        const predCard = cards[predNumber - 1];
        player.pred.push({ opponent, pred_card: predCard });
        if (inType(predCard, opponent.hands)) {
          this.kill(opponent);
        }
      }
    }
  }
  
  // Card3: 占い師
  class Card3 extends Card {
    constructor(field) {
      super(3, '占い師', field);
    }
  
    play(player) {
      this.move(player);
      const opponent = this.opponentChoice(player);
      if (opponent) {
        opponent.hands.forEach(card => {
          player.look.push({ opponent, card });
          opponent.looked.push({ subject: player, card });
        });
      }
    }
  }
  
  // Card4: 乙女
  class Card4 extends Card {
    constructor(field) {
      super(4, '乙女', field);
    }
  
    play(player) {
      this.move(player);
      player.affected = false;
    }
  }
  
  // Card5: 死神
  class Card5 extends Card {
    constructor(field) {
      super(5, '死神', field);
    }
  
    play(player) {
      this.move(player);
      const opponent = this.opponentChoice(player);
      if (opponent && this.field.deck.length > 0) {
        this.field.draw(opponent);
        const dropIndex = Math.floor(Math.random() * opponent.hands.length);
        const dropCard = opponent.hands.splice(dropIndex, 1)[0];
        dropCard.player = opponent;
        opponent.looked.push({ subject: player, card: dropCard });
        this.field.played[opponent.turn_number - 1].push(dropCard);
        if (dropCard.number === 10) {
          this.kill10(opponent);
        }
      }
    }
  }
  
  // Card6: 貴族
  class Card6 extends Card {
    constructor(field) {
      super(6, '貴族', field);
    }
  
    play(player) {
      this.move(player);
      const opponent = this.opponentChoice(player);
      if (opponent && player.hands.length > 0) {
        const myCard = player.hands[0];
        const opCard = opponent.hands[0];
        if (myCard.number <= opCard.number) {
          this.kill(player);
          if (myCard.number === opCard.number) this.kill(opponent);
        } else {
          this.kill(opponent);
        }
        player.looked.push({ subject: opponent, card: myCard });
        player.look.push({ opponent, card: opCard });
        opponent.looked.push({ subject: player, card: opCard });
        opponent.look.push({ opponent: player, card: myCard });
      }
    }
  }
  
  // Card7: 賢者
  class Card7 extends Card {
    constructor(field) {
      super(7, '賢者', field);
    }
  
    play(player) {
      this.move(player);
      player.get = 3;
      this.field.deck = shuffle(this.field.deck);
    }
  }
  
  // Card8: 精霊
  class Card8 extends Card {
    constructor(field) {
      super(8, '精霊', field);
    }
  
    play(player) {
      this.move(player);
      const opponent = this.opponentChoice(player);
      if (opponent && player.hands.length > 0 && opponent.hands.length > 0) {
        const myCard = player.hands.pop();
        const opCard = opponent.hands.pop();
        player.hands.push(opCard);
        opponent.hands.push(myCard);
        opponent.look.push({ opponent: player, card: player.hands[0] });
        player.look.push({ opponent, card: opponent.hands[0] });
        opponent.looked.push({ subject: player, card: opponent.hands[0] });
        player.looked.push({ subject: opponent, card: player.hands[0] });
      }
    }
  }
  
  // Card9: 皇帝
  class Card9 extends Card {
    constructor(field) {
      super(9, '皇帝', field);
    }
  
    play(player) {
      this.move(player);
      const opponent = this.opponentChoice(player);
      if (opponent && this.field.deck.length > 0) {
        const getNumber = opponent.get;
        opponent.get = 1;
        this.field.draw(opponent);
        opponent.get = getNumber;
  
        const opponentHands = [...opponent.hands];
        const choices = opponentHands.map(card => card.number);
        opponentHands.forEach(card => {
          player.look.push({ opponent, card });
        });
  
        const choiceNumber = parseInt(player.choice({ now: create_data(this.field, player), choices, kind: 'trush' }));
        create_log(create_data(this.field, player), choices, 'trush', this.field, player, choiceNumber);
  
        const choiceIndex = opponent.hands.findIndex(card => card.number === choiceNumber);
        if (choiceIndex !== -1) {
          const trushCard = opponent.hands.splice(choiceIndex, 1)[0];
          this.field.played[player.turn_number - 1].push(trushCard);
          if (trushCard.number === 10) {
            this.kill(opponent);
          }
        }
      }
    }
  }
  
  // Card10: 英雄
  class Card10 extends Card {
    constructor(field) {
      super(10, '英雄', field);
    }
  
    play(player) {
      return;
    }
  }

  class Game {
    constructor(playerNumber, funcs) {
      // プレイヤーの生成
      let players = [];
      for (let i = 0; i < playerNumber; i++) {
        players.push(new Player(funcs[i]['get_name'](i+1), funcs[i]['choice']));
      }
  
      players = shuffle(players);
      players.forEach((player, i) => {
        player.turn_number = i + 1;
      });
  
      // ゲームフィールドの生成
      this.field = new Field(players, this);
  
      // 勝者・敗者・ログ
      this.winners = [];
      this.losers = [];
      this.log = Array(players.length).fill(null).map(() => []);
    }
  
    isContinue() {
      const players = this.field.players;
      const winners = [];
      const losers = [];
      let liveCount = 0;
  
      players.forEach(player => {
        if (player.live) liveCount++;
      });
  
      if (this.field.deck.length === 0 || liveCount < 2) {
        if (liveCount >= 2) {
          let maxArg = 0;
          let isEqual = true;
  
          players.forEach((player, i) => {
            if (player.hands[0].number > players[maxArg].hands[0].number) {
              maxArg = i;
            }
            if (player.hands[0].number !== players[0].hands[0].number) {
              isEqual = false;
            }
          });
  
          if (isEqual) {
            players.forEach((_, i) => this.log[i].push('lose'));
          } else {
            players.forEach((player, i) => {
              if (player.hands[0].number === players[maxArg].hands[0].number) {
                this.log[i].push('win');
                winners.push(player);
              } else {
                this.log[i].push('lose');
                losers.push(player);
              }
            });
          }
        } else {
          players.forEach((player, i) => {
            if (player.live) {
              this.log[i].push('win');
              winners.push(player);
            } else {
              this.log[i].push('lose');
              losers.push(player);
            }
          });
        }
  
        return [false, winners, losers];
      }
  
      return [true];
    }
  
    turn(player) {
      const choice = player.choice;
      this.field.draw(player);
  
      if (player.hands.length > 1) {
        const hands = player.hands.filter(card => card.number !== 10).map(card => card.number);
  
        const cardNumber = parseInt(choice({
          now: create_data(this.field, player),
          choices: hands,
          kind: 'play_card'
        }));
  
        create_log(create_data(this.field, player), hands, 'play_card', this.field, player, cardNumber);
  
        const cardIndex = player.hands.findIndex(card => card.number === cardNumber);
        if (cardIndex !== -1) {
          player.hands[cardIndex].play(player);
        }
      }
    }
  
    game() {
      try {
        const players = this.field.players;
        let state = [true];
  
        players.forEach(player => this.field.draw(player));
  
        while (state[0]) {
          for (let i = 0; i < players.length; i++) {
            const player = players[i];
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
        console.error(e);
        return [false, e.toString(), this.log];
      }
    }
  }

export {Game};