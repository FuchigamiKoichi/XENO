player1 = {'name':'Kishida','isDead':True,'Hands':[1,2],'Played':[1,3],'Afected':True,'Get':1}
player2 = {'name':'Abe','isDead':True,'Hands':[1,2],'Played':[1,3],'Afected':True,'Get':1}
Field = {'Played':[],'Players':[player1,player2],'Deck':[]}


def inType(type:type,list:list):
    for content in list:
        if isinstance(content,type):
            return True
        else:
            continue
    return False

# プレイヤークラス
class Player:
    def __init__(self, name:str):
        self.name = name
        self.live = True # 生死の状態
        self.hands = [] # 手札
        self.played = [] # 場に出したカード
        self.affected = True # 効果を受けつける状態かどうか
        self.get = 1 # 山札から
    
    def reset(self):
        self.live = True
        self.hands = []
        self.played = []
        self.affected = True
        self.get = 1


# フィールドクラス
class Field:
    def __init__(self,players:list):
        self.players = players
        self.played = []
        Deck = []
        for number in range(10):
            if number < 9:
                for _ in range(2):
                    Deck.append(number)
            else:
                Deck.append(number)
        self.Deck = Deck


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
        opponentPlayers = field.players
        opponentPlayers.remove(self.player)
        for i in range(len(opponentPlayers)):
            player = opponentPlayers[i]
            msg += str(i) + '：' + player.name + '\n'
            
        opponentNumber = int(input(msg))
        opponent = field.players[opponentNumber]
        return opponent



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

            msg = '相手に捨てさせるカードを選択してください'+'\n'
            opponentHands = list(opponent.hands)
            for i in range(len(opponentHands)):
                card = opponent.hands[i]
                msg += str(i)+'：'+str(card.number)+str(card.name)+'\n'

            trushNumber = int(input(msg))
            opponent.hands.pop(trushNumber)
        
        super().move()


# カード2:兵士
class Card2(Card):
    def __init__(self, field, player):
        super().__init__(number=2, name='兵士', field=field, player=player)
    
    def play(self):
        field = self.field
        print(self.player.name,'が',self.name,'を使用しました。')
        opponent = super().opponentChoice()
        cards = [Card1(field=self.field,player=self),Card2(field=self.field,player=self)]
        msg = opponent.name+'が持っていそうなカードを予想してください。\n'
        for card in cards:
            msg += str(card.number)+'：'+card.name+'\n'
        predNumber = int(input(msg))
        predCard = cards[predNumber-1]
        if inType(type=type(predCard),list=opponent.hands):
            opponent.live = False
        
        super().move()


# プレイヤーを作成
player1 = Player("Alice")
player2 = Player("Bob")

Game = Field(players=[player1,player2])
card1_1 = Card1(field=Game,player=player1)
card1_2 = Card1(field=Game,player=player1)
card2_1 = Card2(field=Game,player=player1)
card1_3 = Card1(field=Game,player=player2)
card1_4 = Card1(field=Game,player=player2)


player1.hands = [card1_1,card2_1]
player2.hands = [card1_3,card1_4]

# テスト
players = [player1,player2]
test = [1,2]

for player in Game.players:
    cards = []
    for card in player.hands:
        cards.append(card.name)
    print(str(player.name),'が持っているカード','：',cards)

cards = []
for card in Game.played:
    cards.append(card.name)
print('場に出ているカード','：',cards)
print()

card2_1.play()
print()

for player in Game.players:
    cards = []
    for card in player.hands:
        cards.append(card.name)
    print(str(player.name),'が持っているカード','：',cards)

cards = []
for card in Game.played:
    cards.append(card.name)
print('場に出ているカード','：',cards)
print()
print(player1.name,'の命は',player1.live,'です。')
print(player2.name,'の命は',player2.live,'です。')