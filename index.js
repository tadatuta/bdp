var fs = require('fs'),
    util = require('util'),
    stream = require('stream'),
    naming = require('bem-naming'),
    walk = require('bem-walk'),
    _ = require('lodash'),
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
            ['mustDeps', 'shouldDeps', 'noDeps'].forEach(function(depsType) {
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
            deps[name].files.push(file) :
            deps[name] = {
                files: [file],
                techs: {}
            };
    });

    walker.on('end', function() {
        Object.keys(deps).forEach(function(name) {
            var files = deps[name].files,
                totalEntityFiles = files.length;

            files.forEach(function(file) {
                reader(file, function(err, depsFile) {
                    if (err) {
                        output.emit('error', err);
                        output.push(null);
                        return;
                    }

                    totalDepsFiles--;
                    totalEntityFiles--;

                    depsFile.forEach(function(oneTechDeps) {
                        var techs = deps[name].techs,
                            techName = oneTechDeps.tech || '';

                        techs[techName] || (techs[techName] = []);
                        techs[techName].push([oneTechDeps]);
                    });

                    if (!totalDepsFiles && !totalEntityFiles) {
                            Object.keys(deps).forEach(function(name) {
                                var techs = deps[name].techs;
                                Object.keys(techs).forEach(function(techName) {
                                    techs[techName].forEach(function(item) {
                                        item.forEach(function(i) {
                                            output.push({
                                                entity: file.entity,
                                                tech: techName,
                                                deps: deps[name].techs[techName]
                                            });
                                        });
                                    });
                                });
                            });

                        output.push(null);
                    }
                });
            });
        });
    });

    output._read = function () {};

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

            _.some(result.dependOn, dependency) || result.dependOn.push(dependency);
        });
    }

    function remove(noDeps) {
        noDeps.forEach(function(noDep) {
            result.dependOn.forEach(function(dep, idx) {
                if ((naming.stringify(dep.entity) + dep.tech) === (naming.stringify(noDep) + noDep.tech)) {
                    result.dependOn.splice(idx, 1);
                }
            });
        });
    }

    // `entityDeps.deps` is an array of all entity dependencies from all files
    entityDeps.deps.forEach(function(entityOneFileDeps) {
        entityOneFileDeps.forEach(function(oneTechDeps) {
            oneTechDeps.tech && (result.tech = oneTechDeps.tech);

            add(oneTechDeps.mustDeps, true);
            add(oneTechDeps.shouldDeps);
            remove(oneTechDeps.noDeps);
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
