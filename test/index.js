var bdp = require('..'),
    stream = require('stream'),
    path = require('path');

var config = {
    levels: [
        path.join(__dirname, 'fixtures/test1/level1')
    ],
    options: {}
};


stringifier = new stream.Transform({ objectMode: true });
stringifier._transform = function(chunk, encoding, done) {
    this.push(JSON.stringify(chunk, null, 4));
    done();
}


// read(config, reader).pipe(stringifier).pipe(process.stdout);
bdp.read(config, bdp.reader).pipe(bdp.parse(bdp.parser)).pipe(stringifier).pipe(process.stdout);
// read(config, reader).pipe(parse(parser)); //.pipe(stringifier).pipe(process.stdout);

// bemDeps.read ходит по fs, на каждый депсовый файл вызывает коллбек - функцию,
// которая берет строку, эвалит, добавляет полей => на каждую бэм-сущность получим массив из таких реезультатов.

// на предыдущий результат вызываем коллбек bemDeps.parse() -> граф
// noDeps хендлится в parse
