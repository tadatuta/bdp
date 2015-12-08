var bdp = require('..'),
    stream = require('stream');

var config = {
    levels: [
        'project-stub/libs/bem-core/common.blocks',
        'project-stub/libs/bem-core/desktop.blocks',
        'project-stub/libs/bem-components/common.blocks',
        'project-stub/libs/bem-components/desktop.blocks',
        'project-stub/libs/bem-components/design/common.blocks',
        'project-stub/libs/bem-components/design/desktop.blocks',
        'project-stub/common.blocks'
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
