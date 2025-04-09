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
    

# ゲームクラス：ゲームに必要なものを定義する
class Game:
    def __init__(self,player_number):
        # プレイヤーの生成
        players = []
        for i in range(player_number):
            i += 1
            msg = f'プレイヤー{i}の名前を入力してください'
            name = str(input(msg))
            players.append(Player(name=name))
        players = shuffle(players)

        # デッキを生成
        deck = Deck()

        # ゲームフィールドの生成
        self.field = Field(players=players,deck=deck)
    
    def game(self):
        msg = f'先攻・後攻を決めます'
        print(msg)
        players = self.field.players
        msg = f'先攻は{players[0].name}です。'
        print(msg)


# プレイヤークラス
class Player:
    def __init__(self, name:str, ):
        self.name = name
        self.live = True # 生死の状態
        self.hands = [] # 手札
        self.played = [] # 場に出したカード
        self.affected = True # 効果を受けつける状態かどうか
        self.get = 1 # 山札から
    
    # リセット関数：値を初期状態に設定したい時に使う
    def reset(self):
        self.live = True
        self.hands = []
        self.played = []
        self.affected = True
        self.get = 1
    
    # ドロー関数：プレイヤーにハンドを追加する
    def draw(self, number:int):
        for _ in range(number):
            self.hands.append()

# デッククラス：ゲームの山札を定義する
class Deck:
    def __init__(self):
        deck = []
        for card in range(10):
            card += 1
            if card < 9:
                for _ in range(2):
                    deck.append(card)
            else:
                deck.append(card)
        self.deck = shuffle(deck)

# フィールドクラス
class Field:
    def __init__(self,players:list,deck:Deck):
        self.played = []
        self.deck = deck
        self.players = players

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
                opponent.live = False
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
            hands = []
            for card in opponent.hands:
                hands.append(f'{str(card.number)}：{card.name}')
            print(f'{opponent.name}が持っているカードは{hands}です。')
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
class Card4(Card):
    def __init__(self, field, player):
        super().__init__(number=4, name='乙女', field=field, player=player)
    
    def play(self):
        print(self.player.name,'が',self.name,'を使用しました。')
        self.player.affected = False
        super().move()

game = Game(2)
game.game()