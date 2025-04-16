import xeno as x

def get_name():
    return 'test_player'

def choice_5(now,choices,kind):
    return 0

game = x.Game(player_number=2,get_name=get_name)
p1 = x.Player('test_player')
p2 = x.Player('test_player')

field = x.Field(players=[p1,p2],game=game)

p1.hands.append(x.Card10(field=field,player=p1))
p1.hands.append(x.Card5(field=field,player=p1))
p1.hands[1].play(choice=choice_5)