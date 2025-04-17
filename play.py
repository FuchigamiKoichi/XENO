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
    number = random.randint(0,9)
    return 'test_player'+str(number)

for i in range(10**2):
    game = x.Game(2, get_name=get_name)
    data = game.game(choice_func=choice)
    if data[0]:
        log = data[1]
        with open('./result/log.csv', 'a') as f:
            writer = csv.writer(f)
            for l in log:
                writer.writerow(l)
    else:
        log = data[2]
        err = data[1]
        print(err)
        with open('./result/log.csv', 'a') as f:
            writer = csv.writer(f)
            for l in log:
                writer.writerow(l)
        break