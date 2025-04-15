import xeno as x

def get_name():
    return 'test_player'

game = x.Game(player_number=2,get_name=get_name)
p1 = x.Player('test_player')
p2 = x.Player('test_player')

field = x.Field(players=[p1,p2],game=game)