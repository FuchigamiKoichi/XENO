from xgboost import XGBRegressor
import joblib
import pandas as pd

model = joblib.load('xeno_xgbregressor.pkl')


def cpu(now,choices,kind,model=model):
    scores = {}
    for choice in choices:
        data = {}

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

        for j in range(len(list(other_played.keys()))):
            for k in range(15):
                if k < len(other_played[j]):
                    data[f'other_played_{j}_{k}'] = int(other_played[j][k])
                else:
                    data[f'other_played_{j}_{k}'] = 0

            for k in range(15):
                if k < len(look_hands[j]):
                    data[f'look_hands_{j}_{k}'] = int(look_hands[j][k])
                else:
                    data[f'look_hands_{j}_{k}'] = 0

            for k in range(15):
                if k < len(looked_hands[j]):
                    data[f'looked_hands_{j}_{k}'] = int(looked_hands[j][k])
                else:
                    data[f'looked_hands_{j}_{k}'] = 0

            for k in range(2):
                if k < len(pred_data[j]):
                    p = pred_data[j][k]
                    data[f'pred_{j}_{k}_object'] = int(p['object'])
                    data[f'pred_{j}_{k}_predcard'] = int(p['pred_card'])
                else:
                    data[f'pred_{j}_{k}_object'] = 0
                    data[f'pred_{j}_{k}_predcard'] = 0
                
                if k < len(pred_data[-1]):
                    p = pred_data[-1][k]
                    data[f'pred_{-1}_{k}_object'] = int(p['object'])
                    data[f'pred_{-1}_{k}_predcard'] = int(p['pred_card'])
                else:
                    data[f'pred_{-1}_{k}_object'] = 0
                    data[f'pred_{-1}_{k}_predcard'] = 0

        data['reincarnation'] = reincarnation
        data['kind'] = kind
        for i in range(10):
            if i < len(choices):
                data[f'choices_{i}'] = choices[i]
            else:
                data[f'choices_{i}'] = 0
        data['choice'] = choice

        df = pd.DataFrame(data=data,index=[0])

        if df.iloc[0]['kind'] == 'draw':
            df.at[0,'kind'] = 0
        elif df.iloc[0]['kind'] == 'opponentChoice':
            df.at[0,'kind'] = 1
        elif df.iloc[0]['kind'] == 'play_card':
            df.at[0,'kind'] = 2
        elif df.iloc[0]['kind'] == 'pred':
            df.at[0,'kind'] = 3
        elif df.iloc[0]['kind'] == 'trush':
            df.at[0,'kind'] = 4

        df.astype(float)
        x = df.values
        score = model.predict(x)
        scores[f'{choice}'] = score
    return max(scores, key=scores.get)