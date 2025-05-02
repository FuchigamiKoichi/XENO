import xeno as x
import cpu
import csv

# cpuの行動を定義
def choice_cpu(now,choices,kind):
    # cpu.pyでAIを読み込んで選択肢を検討
    return cpu.cpu(now=now,choices=choices,kind=kind)

# cpuの命名規則を定義
def get_name_cpu(index:int):
    return 'test_player'+str(index)


# プレイヤーの行動を定義
def choice_player(now,choices,kind):
    # input関数でプレイヤーに選択させる
    return input(f'現在状況：{now}, モード：{kind}, 選択肢：{choices}')

def get_name_player(index:int):
    # input関数でプレイヤーに名前を選択させる
    return input(f'名前を入力してください')

game = x.Game(2, get_name_funcs=[get_name_cpu,get_name_player])
data = game.game(choice_funcs=[choice_cpu,choice_player])


# while True:
# # for _ in range(10**4):
#     game = x.Game(2, get_name_funcs=[get_name_cpu,])
#     data = game.game(choice_func=choice)
#     if data[0]:
#         log = data[1]
#         if log[0][-1] == log[1][-1] == 'win':
#             print('err：勝者が複数人います')
#         with open('result/log.csv', 'a') as f:
#         # with open('result/log.csv', 'a') as f:
#             writer = csv.writer(f)
#             for l in log:
#                 writer.writerow(l)
#     else:
#         log = data[2]
#         err = data[1]
#         print(err)
#         with open('result/log.csv', 'a') as f:
#             writer = csv.writer(f)
#             for l in log:
#                 writer.writerow(l)
#         break