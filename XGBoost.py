import joblib, xgboost as xgb, m2cgen as m, math

# 1) モデルを読み込み（.pkl が Booster でも OK）
mdl = joblib.load("xeno_xgbregressor_30.pkl")

# 2) 必ず scikit-learn ラッパー化する（Booster → JSON → XGBRegressor）
if isinstance(mdl, xgb.Booster):
    booster = mdl
else:
    booster = mdl.get_booster()

booster.save_model("tmp_model.json")
sk = xgb.XGBRegressor()
sk.load_model("tmp_model.json")

# 3) m2cgen が参照する base_score を明示（None/NaN対策）
params = sk.get_params()
bs = params.get("base_score")
if bs is None or (isinstance(bs, float) and math.isnan(bs)):
    sk.set_params(base_score=0)

# 4) JS へエクスポート
code = m.export_to_javascript(sk, function_name="score")
open("model.js","w").write(code + "\nexport default score;")
print("OK: model.js を出力しました")