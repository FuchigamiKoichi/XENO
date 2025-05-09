import {Game} from './xeno.js'; 

// min以上 max以下 の整数をランダムに返す関数
function getRandomInt(min, max) {
    min = Math.ceil(min);     // 切り上げ
    max = Math.floor(max);    // 切り下げ
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function get_name(index){
    console.log(index)
    return 'test_player'+`${index}`
}

function choice_cpu(now,choices,kind){
    console.log(choices)
    if (typeof choices == typeof(['sample','sample'])){
        number = getRandomInt(0,choices.length)
    }else{
        number = getRandomInt(0,Object.keys(choices).length)
    }
    if (kind == 'opponentChoice'){
        choice = choices[number]
        select = choice['select_number']
    }else{
        select = choices[number]
    }
    return select
}

funcs = [{'get_name':get_name(),'choice':choice_cpu()},{'get_name':get_name(),'choice':choice_cpu()}]
game = new Game(2,funcs)
data = game.Game()
console.log(data)