export class Player {
    constructor(name, func) {
        this.name = name;
        this.turnNumber = -1;
        this.live = true;  // 生死の状態
        this.hands = [];   // 手札
        this.played = [];  // 場に出したカード
        this.look = [];    // 自分が観測した相手のカード
        this.looked = [];  // 自分の手札で相手に見られたカード
        this.pred = [];    // 予想
        this.affected = true;  // 効果を受けつける状態かどうか
        this.get = 1;      // 山札から
        this.choice = func; // 選択関数
    }
} 