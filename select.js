// model.js で score(input) を export している想定
// import { score as modelScore } from "./model.js";
const  { score } = require('./model.js');

/**
 * Python版と同じ順序で特徴量ベクトルを構築し、modelScore に渡して予測します。
 * @param {Array<any>} choices - 選択肢の配列
 * @param {Object} now - 現在の状態（Pythonコードの now と同等）
 * @param {string} kind - 'draw' | 'opponentChoice' | 'play_card' | 'pred' | 'trush'
 * @param {(input:number[])=>number} scoreFn - 既定は model.js の score
 * @returns {string} - スコア最大の選択肢を表すキー（Pythonと同様の戻り値）
 */
function selectBestChoice(choices, now, kind, scoreFn = score) {
  const scores = new Map();
  const playersLength = Number(now?.players_length ?? 0);

  for (const choice of choices) {
    const input = [];

    // 1) card_number
    input.push(Number(now?.card_number ?? 0));

    // 2) my_hands_0..1（足りない分は0）
    for (let j = 0; j < 2; j++) {
      const v = (now?.my_hands && j < now.my_hands.length) ? now.my_hands[j] : 0;
      input.push(Number(v));
    }

    // 3) my_played_0..14
    for (let j = 0; j < 15; j++) {
      const v = (now?.my_played && j < now.my_played.length) ? now.my_played[j] : 0;
      input.push(Number(v));
    }

    // 4) 各プレイヤー j=1..playersLength の other_played / look_hands / looked_hands
    for (let pj = 1; pj <= playersLength; pj++) {
      // other_played_{j}_{k}, k=0..14
      for (let k = 0; k < 15; k++) {
        const arr = now?.other_played?.[pj];
        const v = Array.isArray(arr) && k < arr.length ? arr[k] : 0;
        input.push(Number(v));
      }

      // ※Python原文と同じ条件分岐（look_hands の有無判定に other_played のキーを使っている箇所を忠実に再現）
      for (let k = 0; k < 15; k++) {
        const exists = now?.other_played && (pj in now.other_played);
        const arr = now?.look_hands?.[pj];
        const v = (exists && Array.isArray(arr) && k < arr.length) ? arr[k] : 0;
        input.push(Number(v));
      }

      // looked_hands_{j}_{k}, 有無判定は look_hands のキーで（原文通り）
      for (let k = 0; k < 15; k++) {
        const exists = now?.look_hands && (pj in now.look_hands);
        const arr = now?.looked_hands?.[pj];
        const v = (exists && Array.isArray(arr) && k < arr.length) ? arr[k] : 0;
        input.push(Number(v));
      }
    }

    // 5) pred_k_subject/object/card, k=0..1
    const pred = Array.isArray(now?.pred) ? now.pred : [];
    for (let k = 0; k < 2; k++) {
      if (k < pred.length) {
        input.push(Number(pred[k]?.subject ?? 0));
        input.push(Number(pred[k]?.object ?? 0));
        input.push(Number(pred[k]?.pred_card ?? 0));
      } else {
        input.push(0, 0, 0);
      }
    }

    // 6) reincarnation
    input.push(Number(now?.reincarnation ?? 0));

    // 7) kind（カテゴリを数値にエンコード）
    input.push(kindToId(kind));

    // 8) choices_0..9
    for (let i = 0; i < 10; i++) {
      if (i < choices.length) {
        if (kind === "opponentChoice") {
          input.push(Number(choices[i]?.player?.turn_number ?? 0));
        } else {
          input.push(Number(choices[i] ?? 0));
        }
      } else {
        input.push(0);
      }
    }

    // 9) choice
    if (kind === "opponentChoice") {
      input.push(Number(choice?.select_number ?? 0));
    } else {
      input.push(Number(choice ?? 0));
    }

    // 予測（Pythonの model.predict(x) 相当）
    // Pythonでは DataFrame -> values(2D) でしたが、model.js は 1D配列想定のためそのまま渡します
    // 必要なら console.log(input) で形状を確認
    const y = Number(scoreFn(input));

    // スコアを choices 用のキーで保持（原文に合わせる）
    const key = (kind === "opponentChoice")
      ? String(choice?.select_number)
      : String(choice);
    scores.set(key, y);
  }

  // 最大スコアのキーを返す
  let bestKey = null;
  let bestScore = -Infinity;
  for (const [k, v] of scores) {
    if (v > bestScore) {
      bestScore = v;
      bestKey = k;
    }
  }
  return bestKey;
}

function kindToId(k) {
  switch (k) {
    case "draw":            return 0;
    case "opponentChoice":  return 1;
    case "play_card":       return 2;
    case "pred":            return 3;
    case "trush":           return 4;
    default:                return 0;
  }
}

module.exports = {
  selectBestChoice
};