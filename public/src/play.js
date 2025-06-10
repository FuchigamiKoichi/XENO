import { Game } from "./game.js";

// dataManager.js
const fs = require('fs');
const DATA_FILE = './now.json';

let jsonData = { logs:[] };

// 使用例
// CPUプレイヤーの選択関数
function choiceCpu(now, choices, kind) {
    const number = Math.floor(Math.random() * choices.length);
    if (kind === 'opponentChoice') {
        const choice = choices[number];
        return choice.selectNumber;
    }
    return choices[number];
}

// CPUプレイヤーの命名関数
function getNameCpu(index) {
    return `test_player${index}`;
}

// 使用例
const funcs = [
    { get_name: getNameCpu, choice: choiceCpu },
    { get_name: getNameCpu, choice: choiceCpu }
];

// ゲームの実行
for(let i = 0; i < 10; i++) {
    const game = new Game(2, funcs);
    const result = game.game();
    if((result[0])) {
        console.log('ゲームログ:', result[1]);
    }
}