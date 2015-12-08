var fs = require('fs'),
    util = require('util'),
    stream = require('stream'),
    naming = require('bem-naming'),
    walk = require('bem-walk'),
    depsNormalize = require('deps-normalize');

/**
 * Reads file and calls callback with normalized dependency object
 * @param {Object}
 */
function reader(file, cb) {
    fs.readFile(file.path, function(err, depsText) {
        if (err) return cb(err);

        var parsedDeps = eval(depsText.toString());

        Array.isArray(parsedDeps) || (parsedDeps = [parsedDeps]);

        cb(null, parsedDeps.map(function(dep) {
            ['mustDeps', 'shouldDeps'].forEach(function(depsType) {
                dep[depsType] = depsNormalize(dep[depsType]);
            });

            // add entity info to dep item
            return util._extend(JSON.parse(JSON.stringify(file.entity)), dep);
        }));
    });
}

// returns `output` stream which will flush each entity data (totalEntityFiles === 0)
// and ends when no more deps left (totalDepsFiles === 0)
function read(config, reader) {
    var output = new stream.Readable({ objectMode: true }),
        deps = {},
        isInited = false,
        totalDepsFiles = 0;

    walker = walk(config.levels, { defaults: config.options });

    walker.on('data', function(file) {
        if (file.tech !== 'deps.js') return;

        isInited = true;
        totalDepsFiles++;

        var name = naming.stringify(file.entity);

        deps[name] ?
            deps[name].push(file) :
            deps[name] = [file];
    });

    walker.on('end', function() {
        Object.keys(deps).forEach(function(name) {
            var files = deps[name],
                totalEntityFiles = files.length;

            files.forEach(function(file) {
                file.deps = [];

                reader(file, function(err, depsFile) {
                    if (err) {
                        output.emit('error', err);
                        output.push(null);
                        return;
                    }

                    totalDepsFiles--;
                    totalEntityFiles--;

                    file.deps.push(depsFile);

                    totalEntityFiles || output.push({
                        entity: file.entity,
                        deps: file.deps
                    });
                });
            });
        });
    });

    output._read = function () {
        isInited && !totalDepsFiles && output.push(null);
    };

    return output;
}

function parse(cb) {
    var transform = new stream.Transform({ objectMode: true });

    transform._transform = function(entityDeps, encoding, done) {
        this.push(cb(entityDeps));
        done();
    }

    return transform;
}

function parser(entityDeps) {
    var result = {
        entity: entityDeps.entity,
        dependOn: []
    };

    function normalize(deps) {
        if (typeof deps === 'string') {
            deps = { block: deps };
        }

        if (!Array.isArray(deps)) {
            deps = [deps];
        }

        return deps;
    }

    function add(mustOrShouldDeps, isMust) {
        if (!mustOrShouldDeps) return;

        normalize(mustOrShouldDeps).forEach(function(dep) {
            var dependOnEntity = {
                block: dep.block
            };

            ['elem', 'modName', 'modVal'].forEach(function(field) {
                dep[field] && (dependOnEntity[field] = dep[field]);
            });

            var dependency = {
                entity: dependOnEntity,
                tech: dep.tech
            };

            isMust && (dependency.order = 'dependenceBeforeDependants');

            result.dependOn.push(dependency);
        });
    }

    // `entityDeps.deps` is an array of all entity dependencies from all files
    entityDeps.deps.forEach(function(entityOneFileDeps) {
        entityOneFileDeps.forEach(function(oneTechDeps) {
            result.tech = oneTechDeps.tech;

            add(oneTechDeps.mustDeps, true);
            add(oneTechDeps.shouldDeps);
            // TODO: noDeps
        });
    });

    return result;
}

module.exports = {
    read: read,
    reader: reader,
    parse: parse,
    parser: parser
};
