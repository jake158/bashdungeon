

export class SystemCommands {
    constructor(fileSystem, colorize) {
        this.fileSystem = fileSystem;
        this.colorize = colorize;
    }

    get() {
        return {
            'pwd': [
                () => { return this.fileSystem.currentDirectory; },
            ],

            'cd': [
                (stdin, args) => {
                    if (args.length > 1) {
                        throw new Error('too many arguments');
                    }
                    const path = args.length === 1 ? args[0] : '~';
                    this.fileSystem.cd(path);
                    return '';
                },
            ],

            'umask': [
                (stdin, args) => {
                    if (args.length > 1) {
                        throw new Error('too many arguments');
                    }
                    else if (args.length === 0) {
                        return this.fileSystem.umask;
                    }
                    else {
                        this.fileSystem.umask = args[0];
                    }
                    return '';
                },
            ],

            'chmod': [
                (stdin, args, flagMap) => {
                    let flagPerms = ''
                    flagPerms += flagMap.has('-r') ? '-r' : '';
                    flagPerms += flagMap.has('-w') ? '-w' : '';
                    flagPerms += flagMap.has('-x') ? '-x' : '';

                    if (flagPerms.length !== 0 && args.length < 1 || flagPerms.length === 0 && args.length < 2) {
                        const error = args.length === 1
                            ? `missing operand after '${args[0]}'`
                            : 'missing operand';
                        throw new Error(error);
                    }

                    for (let i = flagPerms ? 0 : 1; i < args.length; i++) {
                        this.fileSystem.chmod(args[i], flagPerms ? flagPerms : args[0]);
                    }
                    return '';
                },

                // Add: -R
                // Problem: chmod -x+w, chmod -x,w etc.
                {
                    flags: {
                        '-r': 'regular',
                        '-w': 'regular',
                        '-x': 'regular',
                    },
                }
            ],

            'mkdir': [
                (stdin, arg) => {
                    if (!arg) {
                        throw new Error('missing operand');
                    }
                    this.fileSystem.mkdir(arg);
                    return '';
                },

                {
                    callForEachArg: true
                }
            ],

            'rmdir': [
                (stdin, arg) => {
                    if (!arg) {
                        throw new Error('missing operand');
                    }
                    this.fileSystem.rmdir(arg);
                    return '';
                },

                {
                    callForEachArg: true
                }
            ],

            // TODO: Implement prompting
            // rm: remove write-protected regular file 'test'? (y/n)
            'rm': [
                (stdin, arg, flagMap) => {
                    if (this.fileSystem.isDirectory(arg) && !flagMap.has('-r')) {
                        throw new Error(`cannot remove '${arg}': Is a directory`);
                    }
                    if (arg === '.' || arg === '..') {
                        throw new Error(`refusing to remove '.' or '..' directory: skipping '${arg}'`);
                    }
                    const output = this.fileSystem.rm(arg, { force: flagMap.has('-f') });
                    return flagMap.has('-v') ? output + '\n' : '';
                },

                {
                    flags: {
                        '-r': 'regular',
                        '-f': 'regular',
                        '-v': 'regular',
                    },
                    callForEachArg: true,
                }
            ],

            'ls': [
                (stdin, arg, flagMap, multipleArgsMode = false) => {
                    const long = flagMap.has('-l');
                    const options = {
                        dir: flagMap.has('-d'),
                        all: flagMap.has('-a'),
                    };
                    const result = this.fileSystem.ls(arg ? arg : '.', options);

                    const formatResult = (item) => {
                        const name = item.type === 'directory' ? this.colorize(item.name, 'bold', 'blue') : item.name;
                        if (long) {
                            return `${item.permissions} ${item.links} ${name}`;
                        } else {
                            return name;
                        }
                    };

                    if (!Array.isArray(result)) {
                        return formatResult(result) + (multipleArgsMode && long ? '\n' : '  ');
                    }

                    const output = result.map(formatResult).join(long ? '\n' : '  ');
                    if (!multipleArgsMode) {
                        return output;
                    }
                    return `\n${arg.replace('~', this.fileSystem.homeDirectory)}:\n${output}\n`;
                },

                {
                    flags: {
                        '-l': 'regular',
                        '-d': 'regular',
                        '-a': 'regular',
                    },
                    callForEachArg: true,
                    sortArgs: (a, b) => {
                        if (this.fileSystem.isDirectory(a) && !this.fileSystem.isDirectory(b)) { return 1; }
                        if (!this.fileSystem.isDirectory(a) && this.fileSystem.isDirectory(b)) { return -1; }
                        return 0;
                    }
                }
            ],

            'cp': [
                (stdin, [source, dest], flagMap) => {
                    if (!dest || !source) {
                        const error = source
                            ? `missing destination file operand after '${source}'`
                            : 'missing file operand';
                        throw new Error(error);
                    }
                    if (Array.isArray(dest)) {
                        throw new Error('multiple target directories specified')
                    }
                    if (!flagMap.has('-r') && this.fileSystem.isDirectory(source)) {
                        throw new Error(`-r not specified; omitting directory '${source}'`);
                    }
                    this.fileSystem.cp(source, dest);
                    return '';
                },

                {
                    flags: {
                        '-t': 'argument',
                        '--target-directory': 'argument',
                        '-r': 'regular'
                    },
                    callForEachArg: true,
                    destinationArgLocations: ['-t', '--target-directory', -1]
                }
            ],

            'mv': [
                (stdin, [source, dest], flagMap) => {
                    if (!dest || !source) {
                        const error = source
                            ? `missing destination file operand after '${source}'`
                            : 'missing file operand';
                        throw new Error(error);
                    }
                    if (Array.isArray(dest)) {
                        throw new Error('multiple target directories specified')
                    }
                    this.fileSystem.mv(source, dest);
                    return '';
                },

                {
                    flags: {
                        '-t': 'argument',
                        '--target-directory': 'argument',
                    },
                    callForEachArg: true,
                    destinationArgLocations: ['-t', '--target-directory', -1]
                }
            ],
        }
    }
}