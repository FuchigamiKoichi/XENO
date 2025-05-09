import random
import traceback


def create_log(now,choices,kind,field,player,choice):
    out = {'now':now,'kind':kind,'choices':choices,'choice':choice}
    if kind == 'opponentChoice':
        out_chocies = []
        choices_copy = choices.copy()
        for i in range(len(choices_copy)):
            out_chocies.append(choices_copy[i]['player'].turn_number)
            if choices_copy[i]['select_number'] == choice:
                out['choice'] = choices_copy[i]['player'].turn_number
        out['choices'] = out_chocies
    for i in range(len(field.players)):
        if field.players[i]is player:
            field.game.log[i].append(out) 


def create_data(field,player):
    players = field.players
    other_played = {}
    look_hands = {}
    looked_hands = {}
    pred = []
    state = {}
    for i in range(len(players)):
        if i+1 != player.turn_number:
            other_played[i+1] = []
            look_hands[i+1] = []
            looked_hands[i+1] = []
            state[i+1] = True

            
    my_played = []
    for i in range(len(field.played)):
        played = field.played[i].copy()
        if i+1 == player.turn_number:
            for j in range(len(played)):
                my_played.append(played[j].number)
        else:
            for j in range(len(played)):
                other_played[i+1].append(played[j].number)
    
    my_hands = []
    for card in player.hands:
        my_hands.append(card.number)

    for look_data in player.look:
        opponent = look_data['opponent']
        card = look_data['card']
        look_hands[opponent.turn_number].append(card.number)
    
    for looked_data in player.looked:
        card = looked_data['card']
        subject = looked_data['subject']
        looked_hands[subject.turn_number].append(card.number)
    
    num = 0
    for i in range(len(players)):
        if players[i] != player:
            if not players[i].live:
                state[players[i].turn_number] = False
    
    num = 0
    for i in range(len(players)):
        if players[i] != player:
            stranger = players[i]
            for stranger_pred in stranger.pred:
                subject_num = stranger.turn_number
                object = stranger_pred['opponent']
                pred_card_num = stranger_pred['pred_card'].number
                object_num = object.turn_number
                pred_data = {'subject':subject_num, 'object':object_num, 'pred_card':pred_card_num}
                pred.append(pred_data)
            num += 1
        else:
            for player_pred in player.pred:
                subject_num = player.turn_number
                object = player_pred['opponent']
                pred_card_num = player_pred['pred_card'].number
                object_num = object.turn_number
                pred_data = {'subject':subject_num, 'object':object_num, 'pred_card':pred_card_num}
                pred.append(pred_data)

    data = {'players_length':len(players),'my_turn_number':player.turn_number ,'other_players':state, 'card_number':len(field.deck), 'my_hands':my_hands,'my_played':my_played, 'other_played':other_played, 'look_hands':look_hands,'looked_hands':looked_hands , 'pred':pred, 'reincarnation':True if(len(field.reincarnation)>0) else False}
    return data

# リストをシャッフルする
def shuffle(list:list):
    list_copy = list.copy()
    arange = []
    for i in range(len(list)):
        arange.append(i)
    random.shuffle(arange)
    
    result = []
    for i in arange:
        result.append(list_copy[i])
    return result

# 配列の中に指定した型が存在するかを確認
# 配列の中に指定した数字のカードがあるかを確認するため
def inType(sample,list:list):
    result = False
    for content in list:
        if type(content)==type(sample):
            result = True
    return result


# プレイヤークラス
class Player:
    def __init__(self, name:str, func):
        self.name = name
        self.turn_number = -1
        self.live = True # 生死の状態
        self.hands = [] # 手札
        self.played = [] # 場に出したカード
        self.look = [] # 自分が観測した相手のカード
        self.looked = [] # 自分の手札で相手に見られたカード
        self.pred = []
        self.affected = True # 効果を受けつける状態かどうか
        self.get = 1 # 山札から
        self.choice = func


# フィールドクラス
class Field:
    def __init__(self,players:list,game):
        self.game = game
        self.played = [[] for i in range(len(players))]
        self.players = players
        cards = [Card1(field=self),Card2(field=self),Card3(field=self),Card4(field=self),Card5(field=self),Card6(field=self),Card7(field=self),Card8(field=self),Card9(field=self),Card10(field=self)]
        deck = []
        for number in range(10):
            if number+1 <= 8:
                for _ in range(2):
                    deck.append(cards[number])
            else:
                deck.append(cards[number])

        self.deck = shuffle(deck)
        reincarnation_card = self.deck.pop()
        self.reincarnation = [reincarnation_card]

    def draw(self, player:Player):
        choice_func = player.choice
        player.affected = True
        cards = self.deck[:player.get]
        if len(cards) > 0:
            choices = []
            for card in cards:
                choices.append(card.number)
            choice_number= int(choice_func(create_data(field=self,player=player),choices=choices,kind='draw'))
            create_log(create_data(field=self,player=player),choices=choices,kind='draw',field=self,player=player,choice=choice_number)
            for i in range(len(cards)):
                if cards[i].number == choice_number:
                    get_card_index = i
                    break
            get_card = cards[get_card_index]
            get_card.player = player
            player.hands.append(get_card)
            self.deck.pop(get_card_index)
            player.get = 1


# カードのスーパークラス
# 数字と効果を定義
class Card:
    def __init__(self,number:int,name:str,field:Field):
        self.number = number
        self.name = name
        self.field = field
    
    def move(self, player):
        field = self.field
        for i in range(len(player.hands)):
            if player.hands[i] == self:
                move_index = i
                break
        player.hands.pop(move_index)
        turn_number = int(player.turn_number)
        field.played[turn_number-1].append(self)
    
    def opponentChoice(self, me:Player):
        choice = me.choice
        field = self.field
        num = 0
        choices = []
        opponentPlayers_number = []
        opponentPlayers = []
        for player in field.players:
            if player != me and player.affected:
                opponentPlayers_number.append(num)
                opponentPlayers.append(player)
                choices.append({'select_number':num,'player':player})
                num += 1

        if len(opponentPlayers) != 0:
            opponentNumber = int(choice(now=create_data(field=self.field,player=me),choices=choices,kind='opponentChoice'))
            create_log(create_data(field=self.field,player=me),choices=choices,kind='opponentChoice',field=self.field,player=me,choice=opponentNumber)
            opponent = opponentPlayers[opponentNumber]
            return opponent
        else:
            return None
        
    def kill(self,opponent:Player):
        opponent.live = False
    
    def kill10(self, opponent:Player):
        for card in opponent.hands:
            card.move(player=opponent)
        reincarnation_card = self.field.reincarnation.pop()
        opponent.hands.append(reincarnation_card)


# カード1:少年
# 一枚目では効果無し、二枚目では「公開処刑」
class Card1(Card):
    def __init__(self, field):
        super().__init__(number=1,name='少年',field=field)
    
    # opponent:攻撃対象の敵
    def play(self, player:Player):
        choice = player.choice
        field = self.field
        played = field.played.copy()
        played_cards = []
        for i in range(len(played)):
            for j in range(len(played[i])):
                played_cards.append(played[i][j])
        if inType(sample=Card1,list=played_cards):
            self.move(player=player)
            opponent = self.opponentChoice(me=player)
            if opponent and len(self.field.deck)>0:
                get_number = opponent.get
                opponent.get = 1
                field.draw(player=opponent)
                opponent.get = get_number
                opponentHands = list(opponent.hands)
                choices = []
                for card in opponentHands:
                    choices.append(card.number)
                    player.look.append({'opponent':opponent,'card':card})
                    opponent.looked.append({'subject':player,'card':card})

                card_number = int(choice(now=create_data(field=field,player=player),choices=choices,kind='trush'))
                create_log(create_data(field=self.field,player=player),choices=choices,kind='trush',field=self.field,player=player,choice=card_number)
                for i in range(len(opponent.hands)):
                    if opponent.hands[i].number == card_number:
                        trushNumber = i
                        break
                trush_card = opponent.hands.pop(trushNumber)
                self.field.played[player.turn_number-1].append(trush_card)
                if trush_card.number == 10:
                    self.kill(opponent=opponent)
        else:
            self.move(player=player)


# カード2:兵士
class Card2(Card):
    def __init__(self, field):
        super().__init__(number=2, name='兵士', field=field)
    
    def play(self, player:Player):
        choice = player.choice
        self.move(player=player)
        field = self.field
        opponent = self.opponentChoice(me=player)
        if opponent: # opponentの存在確認
            cards = [Card1(field=field),Card2(field=field),Card3(field=field),Card4(field=field),Card5(field=field),Card6(field=field),Card7(field=field),Card8(field=field),Card9(field=field),Card10(field=field)]
            cards_number = []
            for card in cards:
                cards_number.append(card.number)
            predNumber = int(choice(now=create_data(field=field,player=player),choices=cards_number,kind='pred'))
            create_log(create_data(field=self.field,player=player),choices=cards_number,kind='pred',field=self.field,player=player,choice=predNumber)
            predCard = cards[predNumber-1]
            data = {'opponent':opponent,'pred_card':predCard}
            player.pred.append(data)
            if inType(sample=predCard,list=opponent.hands) and type(Card10(field=field))!=type(predCard):
                self.kill(opponent=opponent)
            else:
                self.kill10(opponent=opponent)


# カード3：占い師
class Card3(Card):
    def __init__(self, field):
        super().__init__(number=3, name='占い師', field=field)
    
    def play(self, player:Player):
        choice = player.choice
        self.move(player=player)
        opponent = self.opponentChoice(me=player)
        if opponent: # opponentの存在確認
            for card in opponent.hands:
                player.look.append({'opponent':opponent,'card':card})
                opponent.looked.append({'subject':player,'card':card})


# カード4：乙女
class Card4(Card):
    def __init__(self, field):
        super().__init__(number=4, name='乙女', field=field)
    
    def play(self, player:Player):
        self.move(player=player)
        player.affected = False


# カード5：死神
class Card5(Card):
    def __init__(self, field):
        super().__init__(number=5, name='死神', field=field)
    
    def play(self, player:Player):
        choice = player.choice
        self.move(player=player)
        opponent = self.opponentChoice(me=player)
        if opponent and len(self.field.deck)>0: # opponentの存在確認
            self.field.draw(player=opponent)
        
            drop_card = opponent.hands.pop(random.randint(0,len(opponent.hands)-1))
            drop_card.player = opponent
            opponent.looked.append({'subject':player,'card':drop_card})
            self.field.played[opponent.turn_number-1].append(drop_card)
            if drop_card.number == 10:
                # 捨てさせたカードが10の場合は相手を死亡させる
                self.kill10(opponent=opponent)


# カード6：貴族
class Card6(Card):
    def __init__(self, field):
        super().__init__(number=6, name='貴族', field=field)
    
    def play(self, player:Player):
        choice = player.choice
        self.move(player=player)
        opponent = self.opponentChoice(me=player)
        if opponent and len(player.hands)>0:
            if player.hands[0].number < opponent.hands[0].number:
                self.kill(opponent=player)
            elif player.hands[0].number == opponent.hands[0].number:
                self.kill(opponent=player)
                self.kill(opponent=opponent)
            else:
                self.kill(opponent=opponent)
            player.looked.append({'subject':opponent, 'card':player.hands[0]})
            player.look.append({'opponent':opponent,'card':opponent.hands[0]})
            opponent.looked.append({'subject':player, 'card':opponent.hands[0]})
            opponent.look.append({'opponent':player,'card':player.hands[0]})


# カード7：賢者
class Card7(Card):
    def __init__(self, field):
        super().__init__(number=7, name='賢者', field=field)
    
    def play(self, player:Player):
        self.move(player=player)
        player.get = 3
        self.field.deck = shuffle(self.field.deck)


# カード8：精霊
class Card8(Card):
    def __init__(self, field):
        super().__init__(number=8, name='精霊', field=field)
    
    def play(self, player:Player):
        choice = player.choice
        self.move(player=player)
        opponent = self.opponentChoice(me=player)
        if opponent: 
            if len(player.hands)>0 and len(opponent.hands)>0:
                copy_self = player.hands.pop()
                copy_opponent = opponent.hands.pop()
                player.hands.append(copy_opponent)
                opponent.hands.append(copy_self)
                opponent.look.append({'opponent':player,'card':player.hands[0]})
                player.look.append({'opponent':opponent,'card':opponent.hands[0]})
                opponent.looked.append({'subject':player,'card':opponent.hands[0]})
                player.looked.append({'subject':opponent,'card':player.hands[0]})


# カード9：皇帝
class Card9(Card):
    def __init__(self, field):
        super().__init__(number=9, name='皇帝', field=field)
    
    def play(self, player:Player):
        choice = player.choice
        self.move(player=player)
        opponent = self.opponentChoice(me=player)
        if opponent and len(self.field.deck)>0:
            get_number = opponent.get
            opponent.get = 1
            self.field.draw(player=opponent)
            opponent.get = get_number
            opponentHands = list(opponent.hands)
            choices = []
            for card in opponentHands:
                choices.append(card.number)
                player.look.append({'opponent':opponent,'card':card})

            choice_number = int(choice(now=create_data(field=self.field,player=player),choices=choices,kind='trush'))
            create_log(create_data(field=self.field,player=player),choices=choices,kind='trush',field=self.field,player=player,choice=choice_number)
            for i in range(len(opponent.hands)):
                card = opponent.hands[i]
                if card.number == choice_number:
                    choice_index = i
                    break
            
            turn_number = player.turn_number
            trush_card = opponent.hands.pop(choice_index)
            self.field.played[turn_number-1].append(trush_card)
            if trush_card.number == 10:
                self.kill(opponent=opponent)


# カード10：英雄
class Card10(Card):
    def __init__(self, field):
        super().__init__(number=10, name='英雄', field=field)
    
    def play(self, player:Player):
        return None


# ゲームクラス：ゲームに必要なものを定義する
class Game:
    def __init__(self,player_number, funcs):
        # プレイヤーの生成
        players = []
        for i in range(player_number):
            get_name_func = funcs[i]['get_name']
            choice_func = funcs[i]['choice']
            get_name = get_name_func
            name = str(get_name(i))
            players.append(Player(name=name,func=choice_func))
        players = shuffle(players)
        for i in range(len(players)):
            player = players[i]
            player.turn_number = i+1

        # ゲームフィールドの生成
        self.field = Field(players=players, game=self)

        # 勝者
        self.winners = []
        # 敗者
        self.losers = []
        # 戦績ログ
        log = []
        for _ in players:
            log.append([])
        self.log = log
    
    def isContinue(self):
        field = self.field
        players = field.players

        winners = []
        losers = []
        l = 0
        for player in players:
            if player.live:
                l += 1
        
        if len(self.field.deck) == 0 or l < 2:
            if l>=2:
                maxarg = 0
                eq = True
                for i in range(len(players)):
                    player = players[i]
                    max = players[maxarg]
                    if player.hands[0].number > max.hands[0].number:
                        maxarg = i
                    
                    if player.hands[0].number != max.hands[0].number:
                        eq = False
                
                if eq:
                    for i in range(len(players)):
                        self.log[i].append('lose')
                else:
                    for i in range(len(players)):
                        if players[i].hands[0].number == players[maxarg].hands[0].number:
                            self.log[i].append('win')
                            winners.append(players[i])
                        else:
                            self.log[i].append('lose')
                            losers.append(players[i])
            else:
                for i in range(len(players)):
                    if players[i].live:
                        self.log[i].append('win')
                        winners.append(players[i])
                    else:
                        self.log[i].append('lose')
                        losers.append(players[i])


            return [False,winners,losers]
        else:
            return [True]
    
    def turn(self, player:Player):
        choice = player.choice
        self.field.draw(player=player)
        if len(player.hands) > 1:
            hands = []
            # if not len(player.hands)==1 and player.hands[0].number==10:
            for card in player.hands:
                if card.number != 10:
                    hands.append(card.number)
            card_number = int(choice(now=create_data(field=self.field,player=player),choices=hands,kind='play_card'))
            create_log(create_data(field=self.field,player=player),choices=hands,kind='play_card',field=self.field,player=player,choice=card_number)
            for i in range(len(player.hands)):
                if player.hands[i].number == card_number:
                    card_index = i
                    break
            player.hands[card_index].play(player=player)
    
    def game(self):
        try:
            players = self.field.players
            state = [True]
            for i in range(len(players)):
                p = players[i]
                choice_func = p.choice
                self.field.draw(player=p)
            while state[0]:
                for i in range(len(players)):
                    player = players[i]
                    state = self.isContinue() # ゲームがアクティブか
                    if state[0]:
                        self.turn(player=player)
                    else:
                        self.winners = state[1]
                        self.losers = state[2]
                        break
            
            return [True,self.log]
        except Exception as e:
            info = traceback.format_exc()
            return [False,info,self.log]