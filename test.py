import random

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


# プレイヤークラス
class Player:
    def __init__(self, name:str):
        self.name = name
        self.live = True # 生死の状態
        self.hands = [] # 手札
        self.played = [] # 場に出したカード
        self.affected = True # 効果を受けつける状態かどうか
        self.get = 1 # 山札から
    
    def show_hands(self):
        hands = []
        for card in self.hands:
            hands.append(card.name)
        print(f'{self.name}の手札は{hands}です。')

# フィールドクラス
class Field:
    def __init__(self,players:list):
        self.played = []
        self.players = players
        admin = Player('admin')
        cards = [Card1(field=self, player=admin),Card2(field=self,player=admin),Card3(field=self,player=admin),Card4(field=self,player=admin),Card5(field=self,player=admin),Card6(field=self,player=admin)]
        deck = []
        for number in range(4):
            if number < 8:
                for _ in range(2):
                    deck.append(cards[number])

        self.deck = shuffle(deck)
        self.reincarnation = self.deck.pop()
            

    def draw(self, player:Player):
        for _ in range(player.get):
            # card = self.deck.pop()
            card = Card6(field=self,player=Player('admin'))
            card.player = player
            player.hands.append(card)
            print(f'{player.name}は{card.name}を引きました。')


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
    
    def opponentChoice(self):
        field = self.field
        msg = '相手を選択してください'+'\n'
        opponentPlayers = []
        for player in field.players:
            if player != self.player and player.affected:
                opponentPlayers.append(player)

        if len(opponentPlayers) != 0:
            for i in range(len(opponentPlayers)):
                player = opponentPlayers[i]
                msg += str(i) + '：' + player.name + '\n'
                opponentNumber = int(input(msg))
                opponent = opponentPlayers[opponentNumber]
            return opponent
        else:
            return None
    
    def kill(self,player:Player):
        player.live = False
        print(f'{player.name}は死亡しました。')
    
    def kill10(self,player:Player):
        for card in player.hands:
            card.move()
        player.hands.append(self.field.reincarnation)
        print(f'{player.name}は転生しました。')
        player.show_hands()
            



# カード1:少年
# 一枚目では効果無し、二枚目では「公開処刑」
class Card1(Card):
    def __init__(self,field,player):
        super().__init__(number=1,name='少年',field=field, player=player)
    
    # opponent:攻撃対象の敵
    def play(self):
        field = self.field
        print(self.player.name,'が',self.name,'を使用しました。')
        if inType(type=Card1,list=field.played):
            opponent = super().opponentChoice()
            if opponent:
                msg = '相手に捨てさせるカードを選択してください'+'\n'
                opponentHands = list(opponent.hands)
                for i in range(len(opponentHands)):
                    card = opponent.hands[i]
                    msg += str(i)+'：'+str(card.number)+str(card.name)+'\n'

                trushNumber = int(input(msg))
                opponent.hands.pop(trushNumber)
            else:
                print('選択可能な相手がいないため、カードの効果は使用できません。')
        
        super().move()


# カード2:兵士
class Card2(Card):
    def __init__(self, field, player):
        super().__init__(number=2, name='兵士', field=field, player=player)
    
    def play(self):
        field = self.field
        print(self.player.name,'が',self.name,'を使用しました。')
        opponent = super().opponentChoice()
        if opponent: # opponentの存在確認
            cards = [Card1(field=field,player=self),Card2(field=field,player=self)]
            msg = opponent.name+'が持っていそうなカードを予想してください。\n'
            for card in cards:
                msg += str(card.number)+'：'+card.name+'\n'
            predNumber = int(input(msg))
            predCard = cards[predNumber-1]
            if inType(type=type(predCard),list=opponent.hands):
                self.kill(opponent)
        else:
            print('選択可能な相手がいないため、カードの効果は使用できません。')
        
        super().move()


# カード3：占い師
class Card3(Card):
    def __init__(self, field, player):
        super().__init__(number=3, name='占い師', field=field, player=player)
    
    def play(self):
        print(self.player.name,'が',self.name,'を使用しました。')
        opponent = super().opponentChoice()
        if opponent: # opponentの存在確認
            opponent.show_hands()
        else:
            print('選択可能な相手がいないため、カードの効果は使用できません。')

        super().move()

# カード4：乙女
class Card4(Card):
    def __init__(self, field, player):
        super().__init__(number=4, name='乙女', field=field, player=player)
    
    def play(self):
        print(self.player.name,'が',self.name,'を使用しました。')
        self.player.affected = False
        super().move()

# カード5：死神
class Card5(Card):
    def __init__(self, field, player):
        super().__init__(number=5, name='死神', field=field, player=player)
    
    def play(self):
        print(self.player.name,'が',self.name,'を使用しました。')
        opponent = super().opponentChoice()
        print(f'{opponent.name}は、山札から1枚引きます。')
        if opponent: # opponentの存在確認
            self.field.draw(player=opponent)
        
        drop_card = opponent.hands.pop(random.randint(0,1))
        if drop_card.number == 10:
            # 捨てさせたカードが10の場合は相手を死亡させる
            self.kill10(opponent)
        print(f'{opponent.name}の手札から{drop_card.name}を捨てました。')
        opponent.show_hands()
        self.field.played.append(drop_card)
        super().move()


# カード6：貴族
class Card6(Card):
    def __init__(self, field, player):
        super().__init__(number=6, name='貴族', field=field, player=player)
    
    def play(self):
        print(self.player.name,'が',self.name,'を使用しました。')

        opponent = super().opponentChoice()
        if inType(type=Card6,list=self.field.played):
            super().move()
            if self.player.hands[0].number < opponent.hands[0].number:
                super().kill(self.player)
            elif self.player.hands[0].number == opponent.hands[0].number:
                super().kill(self.player)
                super().kill(opponent)
            else:
                super().kill(opponent)
        else:
            super().move()
            self.player.show_hands()
            opponent.show_hands()


# ゲームクラス：ゲームに必要なものを定義する
class Game:
    def __init__(self,player_number):
        # プレイヤーの生成
        players = []
        for i in range(player_number):
            i += 1
            msg = f'プレイヤー{i}の名前を入力してください。\n'
            name = str(input(msg))
            players.append(Player(name=name))
        players = shuffle(players)

        # ゲームフィールドの生成
        self.field = Field(players=players)
        for p in self.field.players:
            self.field.draw(p)
    
    def turn(self, player:Player):
        print()
        msg = f'{player.name}の番です。\n山札からカードを1枚引きます。'
        print(msg)
        field = self.field
        field.draw(player=player)
        player.hands[0].play()
    
    def game(self):
        msg = f'先攻・後攻を決めます'
        print(msg)
        print()
        players = self.field.players
        msg = f'先攻は{players[0].name}です。'
        print(msg)
        print()
        self.turn(player=players[0])
        print()
        players[0].show_hands()
        print()
        msg = f'後攻は{players[1].name}です。'
        self.turn(player=players[1])
        print()
        players[1].show_hands()


game = Game(2)
game.game()