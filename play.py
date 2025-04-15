import xeno as x
import random
import csv

def choice(now,choices,kind):
    if len(choices) > 0:
        choice_index = random.randint(0,len(choices)-1)
        choice = choices[choice_index]
    else:
        choice = ''
    return choice

def get_name():
    return 'test_player'


for _ in range(10000):
    game = x.Game(2, get_name=get_name)
    data = game.game(choice=choice)
    if data[0]:
        log = data[1]
        with open('./result/log.csv', 'a') as f:
            writer = csv.writer(f)
            for l in log:
                writer.writerow(l)
    else:
        log = data[1]
        print('error')
        for l in log:
            for p in l:
                print(p)
        break