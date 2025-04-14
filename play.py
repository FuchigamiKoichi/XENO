import xeno as x

def choice(now,choices,kind):
    out = {'now':now,'kind':kind,'choices':choices}
    return input(f'{out}')

def get_name():
    return input('名前を入力してください')


game = x.Game(2, get_name=get_name)
log = game.game(choice=choice)