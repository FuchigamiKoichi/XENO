import random

# モジュール用関数：出力を決める

def choice(now,choices,kind):
    out = {'now':now,'kind':kind,'choices':choices}
    return input(f'{out}')

def create_log(now,choices,kind,field,player,choice):
    out = {'now':now,'kind':kind,'choices':choices,'choice':choice}
    for i in range(len(field.players)):
        if field.players[i] == player:
            field.game.log[i].append(out) 

def get_name():
    return input('名前を入力してください')

def inType(type:type,list:list):
    for content in list:
        if isinstance(content,type):
            return True
        else:
            continue
    return False

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


def create_data(field,player):
    players = field.players
    other_played = {}
    look_hands = {}
    looked_hands = {}
    pred = {}
    state = {}
    num = 0
    for i in range(len(players)):
        if player != players[i]:
            other_played[num] = []
            look_hands[num] = []
            looked_hands[num] = []
            pred[num] = []
            state[num] = True
            num += 1
        else:
            pred[-1] = []
            

    my_played = []
    for card in field.played:
        num = 0
        if player == card.player:
            my_played.append(card.number)
        else:
            for i in range(len(players)):
                if players[i] == card.player:
                    other_played[num].append(card.number)
            num += 1
    
    my_hands = []
    for card in player.hands:
        my_hands.append(card.number)
    
    for card in player.look:
        num = 0
        for i in range(len(players)):
            if players[i] != player:
                if players[i] == card.player:
                    look_hands[num].append(card.number)
                num += 1
    
    for looked_data in player.looked:
        card = looked_data['card']
        subject = looked_data['subject']
        num = 0
        for i in range(len(players)):
            if players[i] != player:
                if players[i] == subject:
                    looked_hands[num].append(card.number)
                num += 1
    
    num = 0
    for i in range(len(players)):
        if players[i] != player:
            if not players[i].live:
                state[num] = False
    
    num = 0
    for i in range(len(players)):
        if players[i] != player:
            stranger = players[i]
            for stranger_pred in stranger.pred:
                subject_num = num
                object = stranger_pred['opponent']
                pred_card_num = stranger_pred['pred_card'].number
                num_j = 0
                for j in range(len(players)):
                    if players[j] != player:
                        if players[j] == object:
                            break
                        num_j += 1
                object_num = num_j
                pred_data = {'subject':subject_num, 'object':object_num, 'pred_card':pred_card_num}
                pred[subject_num].append(pred_data)
            num += 1
        else:
            for player_pred in player.pred:
                subject_num = -1
                object = player_pred['opponent']
                pred_card_num = player_pred['pred_card'].number
                num_j = 0
                for j in range(len(players)):
                    if players[j] != player:
                        if players[j] == object:
                            break
                        num_j += 1
                object_num = num_j
                pred_data = {'subject':subject_num, 'object':object_num, 'pred_card':pred_card_num}
                pred[subject_num].append(pred_data)

    data = {'players_length':len(players), 'other_players':state,'my_hands':my_hands,'my_played':my_played, 'other_played':other_played, 'look_hands':look_hands,'looked_hands':looked_hands , 'pred':pred, 'reincarnation':True if(field.reincarnation) else False}
    # for i in range(len(players)):
    #     if players[i] == player:
    #         field.game.log[i].append(data)
    return data


# プレイヤークラス
class Player:
    def __init__(self, name:str):
        self.name = name
        self.live = True # 生死の状態
        self.hands = [] # 手札
        self.played = [] # 場に出したカード
        self.look = [] # 自分が観測した相手のカード
        self.looked = [] # 自分の手札で相手に見られたカード
        self.pred = []
        self.affected = True # 効果を受けつける状態かどうか
        self.get = 1 # 山札から
    
    def show_hands(self):
        hands = []
        for card in self.hands:
            hands.append(card.name)
        return {'player':self}

# フィールドクラス
class Field:
    def __init__(self,players:list,game):
        self.game = game
        self.played = []
        self.players = players
        admin = Player('admin')
        cards = [Card1(field=self, player=admin),Card2(field=self,player=admin),Card3(field=self,player=admin),Card4(field=self,player=admin),Card5(field=self,player=admin),Card6(field=self,player=admin),Card7(field=self,player=admin),Card8(field=self,player=admin),Card9(field=self,player=admin),Card10(field=self,player=admin)]
        deck = []
        for number in range(10):
            number
            if number+1 <= 8:
                for _ in range(2):
                    deck.append(cards[number])
            else:
                deck.append(cards[number])

        self.deck = shuffle(deck)
        self.reincarnation = self.deck.pop()
            
    def draw(self, player, choice):
        player.affected = True
        cards = self.deck[:player.get]
        if len(cards) > 0:
            choices = []
            for card in cards:
                choices.append(card.number)
            choice_number= int(choice(create_data(field=self,player=player),choices=choices,kind='draw'))
            create_log(create_data(field=self,player=player),choices=choices,kind='draw',field=self,player=player,choice=choice_number)
            for i in range(len(cards)):
                card = cards[i]
                if card.number == choice_number:
                    choice_index = i
                    break
            get_card = cards[choice_index]
            get_card.player = player
            player.hands.append(get_card)
            for i in range(len(cards)):
                if type(get_card) == type(self.deck[i]):
                    self.deck.pop(i)
                    break
            player.get = 1
        return {'player':player}



# カードのスーパークラス
# 数字と効果を定義
class Card:
    def __init__(self,number:int,name:str,field:Field,player:Player):
        self.number = number
        self.name = name
        self.player = player
        self.field = field
    
    def move(self):
        field = self.field
        for i in range(len(self.player.hands)):
            if type(self) == type(self.player.hands[i]):
                self.player.hands.pop(i)
                break
        field.played.append(self)
        return self
    
    def opponentChoice(self, choice):
        field = self.field
        num = 0
        opponentPlayers_number = []
        opponentPlayers = []
        for player in field.players:
            if player != self.player and player.affected:
                opponentPlayers_number.append(num)
                opponentPlayers.append(player)
                num += 1

        if len(opponentPlayers) != 0:
            opponentNumber = int(choice(now=create_data(field=self.field,player=self.player),choices=opponentPlayers_number,kind='opponentChoice'))
            create_log(create_data(field=self.field,player=player),choices=opponentPlayers_number,kind='draw',field=self.field,player=self.player,choice=opponentNumber)
            opponent = opponentPlayers[opponentNumber]
            return opponent
        else:
            return None
    
    def kill(self,player:Player):
        player.live = False
    
    def kill10(self,player:Player):
        for card in player.hands:
            card.move()
        player.hands.append(self.field.reincarnation)
        self.field.reincarnation = None
        player.show_hands()
            



# カード1:少年
# 一枚目では効果無し、二枚目では「公開処刑」
class Card1(Card):
    def __init__(self,field,player):
        super().__init__(number=1,name='少年',field=field, player=player)
    
    # opponent:攻撃対象の敵
    def play(self, choice):
        field = self.field
        if inType(type=Card1,list=field.played):
            opponent = self.opponentChoice(choice=choice)
            if opponent:
                get_number = opponent.get
                opponent.get = 1
                field.draw(player=opponent, choice=choice)
                opponent.get = get_number
                opponentHands = list(opponent.hands)
                choices = []
                for card in opponentHands:
                    choices.append(card.number)
                    self.player.look.append(card)
                    opponent.looked.append({'subject':self.player,'card':card})

                card_number = int(choice(now=create_data(field=field,player=self.player),choices=choices,kind='trush'))
                create_log(create_data(field=self.field,player=self.player),choices=choices,kind='draw',field=self.field,player=self.player,choice=card_number)
                for i in range(len(opponent.hands)):
                    if opponent.hands[i].number == card_number:
                        trushNumber = i
                        break
                trush_card = opponent.hands.pop(trushNumber)
                self.field.played.append(trush_card)
        
        super().move()


# カード2:兵士
class Card2(Card):
    def __init__(self, field, player):
        super().__init__(number=2, name='兵士', field=field, player=player)
    
    def play(self, choice):
        field = self.field
        opponent = super().opponentChoice(choice=choice)
        if opponent: # opponentの存在確認
            admin = Player('admin')
            cards = [Card1(field=self, player=admin),Card2(field=self,player=admin),Card3(field=self,player=admin),Card4(field=self,player=admin),Card5(field=self,player=admin),Card6(field=self,player=admin),Card7(field=self,player=admin),Card8(field=self,player=admin),Card9(field=self,player=admin),Card10(field=self,player=admin)]
            cards_number = []
            for card in cards:
                cards_number.append(card.number)
            predNumber = int(choice(now=create_data(field=field,player=self.player),choices=cards_number,kind='pred'))
            create_log(create_data(field=self.field,player=self.player),choices=cards_number,kind='draw',field=self.field,player=self.player,choice=predNumber)
            predCard = cards[predNumber-1]
            data = {'opponent':opponent,'pred_card':predCard}
            self.player.pred.append(data)
            if inType(type=type(predCard),list=opponent.hands):
                self.kill(opponent)
        else:
            return ''
        
        super().move()


# カード3：占い師
class Card3(Card):
    def __init__(self, field, player):
        super().__init__(number=3, name='占い師', field=field, player=player)
    
    def play(self, choice):
        opponent = super().opponentChoice(choice=choice)
        if opponent: # opponentの存在確認
            for card in opponent.hands:
                self.player.look.append(card)
                opponent.looked.append({'subject':self.player,'card':card})
        else:
            return ''

        super().move()

# カード4：乙女
class Card4(Card):
    def __init__(self, field, player):
        super().__init__(number=4, name='乙女', field=field, player=player)
    
    def play(self,choice):
        self.player.affected = False
        super().move()

# カード5：死神
class Card5(Card):
    def __init__(self, field, player):
        super().__init__(number=5, name='死神', field=field, player=player)
    
    def play(self,choice):
        opponent = super().opponentChoice(choice=choice)
        if opponent: # opponentの存在確認
            self.field.draw(player=opponent, choice=choice)
        
            drop_card = opponent.hands.pop(random.randint(0,1))
            drop_card.player = opponent
            opponent.looked.append({'subject':self.player,'card':drop_card})
            self.field.played.append(drop_card)
            if drop_card.number == 10:
                # 捨てさせたカードが10の場合は相手を死亡させる
                self.kill10(opponent)
            opponent.show_hands()
        else:
            return ''
        super().move()


# カード6：貴族
class Card6(Card):
    def __init__(self, field, player):
        super().__init__(number=6, name='貴族', field=field, player=player)
    
    def play(self,choice):

        opponent = super().opponentChoice(choice=choice)
        if opponent:
            super().move()
            if len(self.player.hands) > 0:
                if self.player.hands[0].number < opponent.hands[0].number:
                    super().kill(self.player)
                elif self.player.hands[0].number == opponent.hands[0].number:
                    super().kill(self.player)
                    super().kill(opponent)
                else:
                    super().kill(opponent)
                self.player.looked.append({'subject':opponent, 'card':self.player.hands[0]})
                self.player.look.append(opponent.hands[0])
                opponent.looked.append({'subject':self.player, 'card':opponent.hands[0]})
                opponent.look.append(self.player.hands[0])
        else:
            super().move()


# カード7：賢者
class Card7(Card):
    def __init__(self, field, player):
        super().__init__(number=7, name='賢者', field=field, player=player)
    
    def play(self, choice):
        self.player.get = 3
        super().move()


# カード8：精霊
class Card8(Card):
    def __init__(self, field, player):
        super().__init__(number=8, name='精霊', field=field, player=player)
    
    def play(self,choice):
        opponent = super().opponentChoice(choice=choice)
        if opponent: 
            if len(self.player.hands) > 0:
                if len(self.player.hands)>1:
                    super().move()
                    copy = self.player.hands[0]
                    self.player.hands[0] = opponent.hands[0]
                    opponent.hands[0] = copy
                    opponent.look.append(self.player.hands[0])
                    self.player.look.append(opponent.hands[0])
                    opponent.looked.append({'subject':self.player,'card':opponent.hands[0]})
                    self.player.looked.append({'subject':opponent,'card':self.player.hands[0]})
        else:
            super().move()


# カード9：皇帝
class Card9(Card):
    def __init__(self, field, player):
        super().__init__(number=9, name='皇帝', field=field, player=player)
    
    def play(self, choice):
        super().move()
        opponent = super().opponentChoice(choice=choice)
        if opponent:
            get_number = opponent.get
            opponent.get = 1
            self.field.draw(player=opponent,choice=choice)
            opponent.get = get_number
            opponentHands = list(opponent.hands)
            choices = []
            for card in opponentHands:
                choices.append(card.number)
                self.player.look.append(card)

            choice_number = int(choice(now=create_data(field=self.field,player=self.player),choices=choices,kind='trush'))
            create_log(create_data(field=self.field,player=self.player),choices=choices,kind='draw',field=self.field,player=self.player,choice=choice_number)
            for i in range(len(opponent.hands)):
                card = opponent.hands[i]
                if card.number == choice_number:
                    choice_index = i
                    break
            trush_card = opponent.hands.pop(choice_index)
            self.field.played.append(trush_card)
            if trush_card.number == 10:
                self.kill(player=opponent)
        else:
            return ''


# カード10：英雄
class Card10(Card):
    def __init__(self, field, player):
        super().__init__(number=10, name='英雄', field=field, player=player)
    
    def play(self, choice):
        return ''


# ゲームクラス：ゲームに必要なものを定義する
class Game:
    def __init__(self,player_number, get_name):
        # プレイヤーの生成
        players = []
        for i in range(player_number):
            i += 1
            name = str(get_name())
            players.append(Player(name=name))
        players = shuffle(players)

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
        lives = 0
        for player in players:
            if player.live:
                lives += 1
            else:
                lives += 0

        if lives < 2:
            winners = []
            losers = []
            for i in range(len(players)):
                player = players[i]
                if player.live:
                    winners.append(player)
                    self.log[i].append('win')
                else:
                    losers.append(player)
                    self.log[i].append('lose')
            return [False, winners, losers]
        else:
            return [True]
    
    def turn(self, player:Player, choice):
        if player.live:
            field = self.field
            field.draw(player=player,choice=choice)
            player.show_hands()
            hands = []
            if not len(player.hands)==1 and player.hands[0].number==10:
                for card in player.hands:
                    if card.number != 10:
                        hands.append(card.number)
                card_number = int(choice(now=create_data(field=field,player=player),choices=hands,kind='play_card'))
                create_log(create_data(field=field,player=player),choices=hands,kind='play_card',field=self.field,player=player,choice=card_number)
                for i in range(len(player.hands)):
                    if player.hands[i].number == card_number:
                        card_index = i
                        break
                player.hands[card_index].play(choice=choice)
    
    def game(self, choice):
        try:
            players = self.field.players
            state = [True]
            for p in self.field.players:
                self.field.draw(p,choice=choice)
            
            while len(self.field.deck) > 0 and state[0]:
                for player in players:
                    self.turn(player=player, choice=choice)
                    player.show_hands()
                
                    state = self.isContinue() # ゲームがアクティブか

                    if state[0]:
                        continue
                    else:
                        self.winners = state[1]
                        self.losers = state[2]
                        break
            
            l = 0
            for player in players:
                if player.live:
                    l +=  1

            if len(self.field.deck) == 0 and l>1:
                players = self.field.players
                maxarg = 0
                for i in range(len(players)):
                    player = players[i]
                    max = players[maxarg]
                    if player.hands[0].number > max.hands[0].number:
                        maxarg = i
                
                if players[0].hands[0].number == players[maxarg].hands[0].number:
                    for l in self.log:
                        l.append('lose')
                else:
                    for i in range(len(players)):
                        player = players[i]
                        if i == maxarg:
                            self.log[i].append('win')
                        else:
                            self.log[i].append('lose')
            
            return [True,self.log]
        except:
            return [False,self.log]
