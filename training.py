import xeno as x
import random

import pandas as pd
import ast
import tqdm

import xgboost as xgb
from sklearn import datasets
from sklearn import model_selection
from sklearn.metrics import confusion_matrix, mean_squared_error
import sklearn.preprocessing as sp
import matplotlib.pyplot as plt

from seaborn_analyzer import regplot
from xgboost import XGBRegressor
from sklearn.model_selection import KFold

import numpy as np
from sklearn.model_selection import cross_val_score

from sklearn.model_selection import validation_curve

import optuna
import time

import joblib




# cpuの命名規則を定義
def get_name_cpu(index:int):
    return 'test_player'+str(index)


# cpuの行動を定義
def choice_cpu(now,choices,kind):
    number = random.randint(0,len(choices)-1)
    if kind=='opponentChoice':
        choice = choices[number]
        result = choice['select_number']
    else:
        result = choices[number]
    
    # print(f'コンピュータは{result}を選択しました！')
    return result

funcs = [{'get_name':get_name_cpu, 'choice':choice_cpu},{'get_name':get_name_cpu,'choice':choice_cpu}]

def bayes_objective(trial):
    params = {
        'learning_rate': trial.suggest_float('learning_rate', 0.01, 0.3, log=True),
        'min_child_weight': trial.suggest_int('min_child_weight', 2, 8),
        'max_depth': trial.suggest_int('max_depth', 1, 4),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.2, 1.0),
        'subsample': trial.suggest_float('subsample', 0.2, 1.0),
        'reg_alpha': trial.suggest_float('reg_alpha', 0.001, 0.1, log=True),
        'reg_lambda': trial.suggest_float('reg_lambda', 0.001, 0.1, log=True),
        'gamma': trial.suggest_float('gamma', 0.0001, 0.1, log=True),
    }
    # モデルにパラメータ適用
    model.set_params(**params)
    # cross_val_scoreでクロスバリデーション
    scores = cross_val_score(model, X, y, cv=cv,
                            scoring=scoring, fit_params=fit_params, n_jobs=-1)
    val = scores.mean()
    return val

generation_number = 10**2 * 1
for generation in range(generation_number):
    df = pd.DataFrame([])
    generation += 1
    if generation > 1:
        model = joblib.load(f'result/xeno_xgbregressor_{generation-1}.pkl')
        # cpuの行動を定義
        def choice_cpu(now,choices,kind):
            scores = {}
            for choice in choices:
                data = {}


                card_number = now['card_number']
                my_hands = now['my_hands']
                my_played = now['my_played']
                other_played = now['other_played']
                look_hands = now['look_hands']
                looked_hands = now['looked_hands']
                pred_data = now['pred']
                reincarnation = int(now['reincarnation'])
                
                data['card_number'] = int(card_number)
                for j in range(2):
                    if j < len(my_hands):
                        data[f'my_hands_{j}'] = int(my_hands[j])
                    else:
                        data[f'my_hands_{j}'] = 0

                for j in range(15):
                    if j < len(my_played):
                        data[f'my_played_{j}'] = int(my_played[j])
                    else:
                        data[f'my_played_{j}'] = 0
                
                for j in range(now['players_length']):
                    j += 1
                    for k in range(15):
                        if j in list(other_played.keys()):
                            if k < len(other_played[j]):
                                data[f'other_played_{j}_{k}'] = int(other_played[j][k])
                            else:
                                data[f'other_played_{j}_{k}'] = 0
                        else:
                            data[f'other_played_{j}_{k}'] = 0
                    
                    for k in range(15):
                        if j in list(other_played.keys()):
                            if k < len(look_hands[j]):
                                data[f'look_hands_{j}_{k}'] = int(look_hands[j][k])
                            else:
                                data[f'look_hands_{j}_{k}'] = 0
                        else:
                            data[f'look_hands_{j}_{k}'] = 0
                    
                    for k in range(15):
                        if j in list(look_hands.keys()):
                            if k < len(looked_hands[j]):
                                data[f'looked_hands_{j}_{k}'] = int(looked_hands[j][k])
                            else:
                                data[f'looked_hands_{j}_{k}'] = 0
                        else:
                            data[f'looked_hands_{j}_{k}'] = 0
                    
                for k in range(2):
                    if k < len(pred_data):
                        data[f'pred_{k}_subject'] = int(pred_data[k]['subject'])
                        data[f'pred_{k}_object'] = int(pred_data[k]['object'])
                        data[f'pred_{k}_card'] = int(pred_data[k]['pred_card'])
                    else:
                        data[f'pred_{k}_subject'] = 0
                        data[f'pred_{k}_object'] = 0
                        data[f'pred_{k}_card'] = 0
                
                data['reincarnation'] = reincarnation
                data['kind'] = kind
                for i in range(10):
                    if i < len(choices):
                        if kind=='opponentChoice':
                            data[f'choices_{i}'] = choices[i]['player'].turn_number
                        else:
                            data[f'choices_{i}'] = choices[i]
                    else:
                        data[f'choices_{i}'] = 0

                if kind=='opponentChoice':
                    data['choice'] = choice['select_number']
                else:
                    data['choice'] = choice
                df = pd.DataFrame(data=data,index=[0])
                
                for i in range(len(list(df['kind']))):
                    if df.iloc[i]['kind'] == 'draw':
                        df.at[i,'kind'] = 0
                    elif df.iloc[i]['kind'] == 'opponentChoice':
                        df.at[i,'kind'] = 1
                    elif df.iloc[i]['kind'] == 'play_card':
                        df.at[i,'kind'] = 2
                    elif df.iloc[i]['kind'] == 'pred':
                        df.at[i,'kind'] = 3
                    elif df.iloc[i]['kind'] == 'trush':
                        df.at[i,'kind'] = 4

                df.astype(float)
                x = df.values
                score = model.predict(x)
                if kind == 'opponentChoice':
                    choice_name = choice['select_number']
                    scores[f'{choice_name}'] = score
                else:
                    scores[f'{choice}'] = score
            print(choices)
            print(choice)
            print(scores)
            select = max(scores, key=scores.get)
            return select
        
        funcs = [{'get_name':get_name_cpu, 'choice':choice_cpu},{'get_name':get_name_cpu,'choice':choice_cpu}]
    
    play_time = 10**5 * 1
    log_list = []
    for _ in range(play_time):
        game = x.Game(2,funcs=funcs)
        game_data = game.game()
        if game_data[0]:
            logs = game_data[1]
            for log in logs:
                log_list.append(log)
        else:
            err = game_data[1]
            print(err)
            break
    
    for log in log_list:
        result = log[-1]
        log = log[:-1]
        for l in log:
            data = {}
            now = l['now']
            kind = l['kind']
            choices = l['choices']
            choice = l['choice']
            # print(now.keys())
            card_number = now['card_number']
            my_hands = now['my_hands']
            my_played = now['my_played']
            other_played = now['other_played']
            look_hands = now['look_hands']
            looked_hands = now['looked_hands']
            pred_data = now['pred']
            reincarnation = int(now['reincarnation'])
            
            data['card_number'] = int(card_number)
            for j in range(2):
                if j < len(my_hands):
                    data[f'my_hands_{j}'] = int(my_hands[j])
                else:
                    data[f'my_hands_{j}'] = 0

            for j in range(15):
                if j < len(my_played):
                    data[f'my_played_{j}'] = int(my_played[j])
                else:
                    data[f'my_played_{j}'] = 0
            
            for j in range(now['players_length']):
                j += 1
                for k in range(15):
                    if j in list(other_played.keys()):
                        if k < len(other_played[j]):
                            data[f'other_played_{j}_{k}'] = int(other_played[j][k])
                        else:
                            data[f'other_played_{j}_{k}'] = 0
                    else:
                        data[f'other_played_{j}_{k}'] = 0
                
                for k in range(15):
                    if j in list(other_played.keys()):
                        if k < len(look_hands[j]):
                            data[f'look_hands_{j}_{k}'] = int(look_hands[j][k])
                        else:
                            data[f'look_hands_{j}_{k}'] = 0
                    else:
                        data[f'look_hands_{j}_{k}'] = 0
                
                for k in range(15):
                    if j in list(look_hands.keys()):
                        if k < len(looked_hands[j]):
                            data[f'looked_hands_{j}_{k}'] = int(looked_hands[j][k])
                        else:
                            data[f'looked_hands_{j}_{k}'] = 0
                    else:
                        data[f'looked_hands_{j}_{k}'] = 0
                
            for k in range(2):
                if k < len(pred_data):
                    data[f'pred_{k}_subject'] = int(pred_data[k]['subject'])
                    data[f'pred_{k}_object'] = int(pred_data[k]['object'])
                    data[f'pred_{k}_card'] = int(pred_data[k]['pred_card'])
                else:
                    data[f'pred_{k}_subject'] = 0
                    data[f'pred_{k}_object'] = 0
                    data[f'pred_{k}_card'] = 0
            
            data['reincarnation'] = reincarnation
            data['kind'] = kind
            for i in range(10):
                if i < len(choices):
                    data[f'choices_{i}'] = choices[i]
                else:
                    data[f'choices_{i}'] = 0
            data['choice'] = choice
            data['result'] = result

            insert = pd.DataFrame(data,index=[0]) 
            df = pd.concat([df,insert])
        
    # データを全て数字化
    for i in tqdm.tqdm(range(len(list(df['result'])))):
        if df.iloc[i]['result'] == 'lose':
            df.at[i,'result'] = 0
        else:
            df.at[i,'result'] = 1
        
        if df.iloc[i]['kind'] == 'draw':
            df.at[i,'kind'] = 0
        elif df.iloc[i]['kind'] == 'opponentChoice':
            df.at[i,'kind'] = 1
        elif df.iloc[i]['kind'] == 'play_card':
            df.at[i,'kind'] = 2
        elif df.iloc[i]['kind'] == 'pred':
            df.at[i,'kind'] = 3
        elif df.iloc[i]['kind'] == 'trush':
            df.at[i,'kind'] = 4
            

    df = df.fillna(0)
    df = df.astype(float)
    df = df.reset_index()
    df = df.drop(columns=['index'])

    df_test = df
    xcolumns = list(df_test.columns)
    xcolumns.remove('result')

    OBJECTIVE_VARIALBLE = 'result'  # 目的変数
    USE_EXPLANATORY = xcolumns
    df_test[USE_EXPLANATORY]


    # 乱数シード
    seed = 42

    X = df_test[USE_EXPLANATORY].values
    y = df_test[OBJECTIVE_VARIALBLE].values

    fit_params = {'verbose': 0,  # 学習中のコマンドライン出力
                #   'early_stopping_rounds': 10,  # 学習時、評価指標がこの回数連続で改善しなくなった時点でストップ
                #   'eval_metric': 'rmse',  # early_stopping_roundsの評価指標
                'eval_set': [(X, y)]  # early_stopping_roundsの評価指標算出用データ
                }

    cv = KFold(n_splits=5, shuffle=True, random_state=seed)  # KFoldでクロスバリデーション分割指定

    model = XGBRegressor()

    scoring = 'neg_mean_squared_error'  # 評価指標をRMSEに指定
    # クロスバリデーションで評価指標算出
    scores = cross_val_score(model, X, y, cv=cv,
                            scoring=scoring, n_jobs=-1, fit_params=fit_params)
    print(f'scores={scores}')
    print(f'average_score={np.mean(scores)}')


    start = time.time()
    # ベイズ最適化時の評価指標算出メソッド
    

    # ベイズ最適化を実行
    study = optuna.create_study(direction='maximize',
                                sampler=optuna.samplers.TPESampler(seed=seed))
    study.optimize(bayes_objective, n_trials=600)

    # 最適パラメータの表示と保持
    best_params = study.best_trial.params
    best_score = study.best_trial.value
    print(f'最適パラメータ {best_params}\nスコア {best_score}')
    print(f'所要時間{time.time() - start}秒')

    best_trial = study.best_trial
    best_params = best_trial.params

    best_model = XGBRegressor(**best_params)
    best_model.fit(X, y)
    joblib.dump(best_model, f'result/xeno_xgbregressor_{generation}.pkl')
    time.sleep(5)
            