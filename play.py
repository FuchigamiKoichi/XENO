import xeno_module as x
import cpu
import csv
import random

# cpuの行動を定義
def choice_cpu(now,choices,kind):
    # print()
    # print()
    # my_hands = now['my_hands']
    # my_played = now['my_played']
    # other_played = now['other_played']
    # look_hands = now['look_hands']
    # looked_hands = now['looked_hands']
    # pred = now['pred']
    # reincarnation = now['reincarnation']

    # print(f'コンピュータの手札は{my_hands}')
    # print(f'コンピュータの場：{my_played}')
    # print(f'プレイヤーの場：{other_played}')
    # print(f'コンピュータが得た情報：{look_hands}')
    # print(f'プレイヤーが得た情報：{looked_hands}')
    # print(f'予測：{pred}')
    # print(f'転生札：{reincarnation}')
    # if kind=='draw':
    #     print('ドロー！\nカードを引いてください')
    # elif kind=='opponentChoice':
    #     print('相手を選択してください')
    # elif kind=='trush':
    #     print('捨てさせるカードを選択してください')
    # elif kind=='play':
    #     print('どのカードを場に出しますか？')
    
    # if kind=='opponentChoice':
    #     for i in range(len(choices)):
    #         print(choices[i]['select_number'],choices[i]['player'].name)
    # else:
    #     print(choices)

    
    number = random.randint(0,len(choices)-1)
    if kind=='opponentChoice':
        choice = choices[number]
        result = choice['select_number']
    else:
        result = choices[number]
    
    # print(f'コンピュータは{result}を選択しました！')
    return result

# cpuの命名規則を定義
def get_name_cpu(index:int):
    return 'test_player'+str(index)


# プレイヤーの行動を定義
def choice_player(now,choices,kind):
    print()
    print()
    # input関数でプレイヤーに選択させる
    my_hands = now['my_hands']
    my_played = now['my_played']
    other_played = now['other_played']
    look_hands = now['look_hands']
    looked_hands = now['looked_hands']
    pred = now['pred']
    reincarnation = now['reincarnation']

    print(f'あなたの手札は{my_hands}')
    print(f'あなたの場：{my_played}')
    print(f'コンピュータの場：{other_played}')
    print(f'あなたが得た情報：{look_hands}')
    print(f'コンピュータが得た情報：{looked_hands}')
    print(f'予測：{pred}')
    print(f'転生札：{reincarnation}')
    
    if kind=='draw':
        print('ドロー！\nカードを引いてください')
    elif kind=='opponentChoice':
        print('相手を選択してください')
    elif kind=='trush':
        print('捨てさせるカードを選択してください')
    elif kind=='play':
        print('どのカードを場に出しますか？')

    if kind=='opponentChoice':
        for i in range(len(choices)):
            print(choices[i]['select_number'],choices[i]['player'].name)
    else:
        print(choices)
    return input()

def get_name_player(index:int):
    # input関数でプレイヤーに名前を選択させる
    return input(f'名前を入力してください')

# funcs = [{'get_name':get_name_cpu, 'choice':choice_cpu},{'get_name':get_name_player,'choice':choice_player}]
# game = x.Game(2, funcs=funcs)
# data = game.game()
# if data[0]:
#     for d in data[1]:
#         print()
#         print(d)
# else:
#     print(data[1])


funcs = [{'get_name':get_name_cpu, 'choice':choice_cpu},{'get_name':get_name_cpu,'choice':choice_cpu}]
# while True:
for _ in range(10**4):
    game = x.Game(2, funcs=funcs)
    data = game.game()
    if data[0]:
        log = data[1]
        if not (log[0][-1] == 'win' or log[0][-1] == 'lose') and (log[1][-1] == 'win' or log[1][-1] == 'lose'):
            print('err：勝利判定が行われていません!')
            with open('result/log.csv', 'a') as f:
                writer = csv.writer(f)
                for l in log:
                    writer.writerow(l)
            break
    else:
        log = data[2]
        err = data[1]
        print(err)
        with open('result/log.csv', 'a') as f:
            writer = csv.writer(f)
            for l in log:
                writer.writerow(l)
        break