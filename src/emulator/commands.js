import parseArgs from './parseArgs.js';


class CommandRegistry {
    #commands;

    constructor(fileSystem, colorize = (text) => text) {
        this.fileSystem = fileSystem;
        this.colorize = colorize;
        this.#commands = this.#initializeCommands();
    }

    #popDestinationArg(positionalArgs, flagMap, destinationArgs) {
        let dest = null;

        for (let destArg of destinationArgs) {
            if (typeof destArg === 'string' && flagMap.has(destArg)) {
                dest = flagMap.get(destArg);
                dest = dest.length === 1 ? dest[0] : dest;
                break;
            }
            else if (typeof destArg === 'number' && positionalArgs.length > Math.abs(destArg)) {
                dest = destArg < 0 ? positionalArgs[positionalArgs.length + destArg] : positionalArgs[destArg];
                positionalArgs.splice((destArg < 0) ? (positionalArgs.length + destArg) : destArg, 1);
                break;
            }
        }
        return dest;
    }

    #executeMultipleArgs(func, stdin, positionalArgs, flagMap, name, destinationArgs, sortArgs) {
        const dest = destinationArgs ? this.#popDestinationArg(positionalArgs, flagMap, destinationArgs) : null;

        if (destinationArgs && !dest || destinationArgs && positionalArgs.length === 0) {
            const error = positionalArgs.length > 0
                ? `missing destination operand after '${positionalArgs.pop()}'`
                : 'missing operand';
            throw new Error(error);
        }

        let stdout = '';
        let stderr = '';
        if (sortArgs) { positionalArgs.sort(sortArgs); }
        if (positionalArgs.length === 0) { positionalArgs.push(null); }

        for (let arg of positionalArgs) {
            try {
                stdout += func(
                    stdin,
                    destinationArgs ? [arg, dest] : arg,
                    flagMap,
                    positionalArgs.length > 1
                );
            }
            catch (error) {
                stderr += `${name}: ${error.message}\n`;
            }
        }
        return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
    }

    #command(func, settings = {}) {
        const {
            name = 'unnamed command',
            flags = {},
            callForEachArg = false,
            destinationArgLocations = null,
            sortArgs = null
        } = settings;

        return (args, stdin) => {
            try {
                const { positionalArgs, flagMap } = parseArgs(args, flags);

                if (callForEachArg) {
                    return this.#executeMultipleArgs(
                        func,
                        stdin,
                        positionalArgs,
                        flagMap,
                        name,
                        destinationArgLocations,
                        sortArgs
                    );
                }

                return { stdin: '', stdout: func(stdin, positionalArgs, flagMap), stderr: '' };
            } catch (error) {
                return { stdin: '', stdout: '', stderr: `${name}: ${error.message}` };
            }
        };
    }

    #initializeCommands() {
        return {

            'pwd': this.#command(
                () => { return this.fileSystem.currentDirectory; },
                { name: 'pwd' }
            ),

            'cd': this.#command(
                (stdin, args) => {
                    if (args.length > 1) {
                        throw new Error('too many arguments');
                    }
                    const path = args.length === 1 ? args[0] : '~';
                    this.fileSystem.cd(path);
                    return '';
                },
                { name: 'bash: cd' }
            ),


            // executeMultipleArgs calls each of these individually for each positional arg

            'echo': this.#command(
                (stdin, arg, flagMap) => {
                    const processEscapeSequences = (input) => {
                        return input.replace(/\\n/g, '\n')
                            .replace(/\\t/g, '\t')
                            .replace(/\\r/g, '\r')
                            .replace(/\\f/g, '\f')
                            .replace(/\\b/g, '\b')
                            .replace(/\\v/g, '\v')
                            .replace(/\\'/g, "'")
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                    };
                    let processEscapes = false;

                    for (const [flag, _] of flagMap.entries()) {
                        switch (flag) {
                            case '-e':
                                processEscapes = true;
                                break;
                            case '-E':
                                processEscapes = false;
                        }
                    }

                    const str = arg ? arg : ' ';
                    return processEscapes ? processEscapeSequences(str) + ' ' : str + ' ';
                },

                {
                    name: 'echo',
                    flags: {
                        '-e': 'regular',
                        '-E': 'regular',
                    },
                    callForEachArg: true
                }
            ),

            'mkdir': this.#command(
                (stdin, arg) => {
                    if (!arg) {
                        throw new Error('missing operand');
                    }
                    this.fileSystem.mkdir(arg);
                    return '';
                },

                {
                    name: 'mkdir',
                    callForEachArg: true
                }
            ),

            'rmdir': this.#command(
                (stdin, arg) => {
                    if (!arg) {
                        throw new Error('missing operand');
                    }
                    this.fileSystem.rmdir(arg);
                    return '';
                },

                {
                    name: 'rmdir',
                    callForEachArg: true
                }
            ),

            'ls': this.#command(
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
                    name: 'ls',
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
            ),

            'cat': this.#command(
                (stdin, arg, flagMap, multipleArgsMode = false) => {
                    if (!arg) {
                        return stdin;
                    }
                    let output = this.fileSystem.getFileContent(arg);
                    output += multipleArgsMode && output ? '\n' : '';
                    return output;
                },

                {
                    name: 'cat',
                    callForEachArg: true
                }
            ),

            'cp': this.#command(
                (stdin, [source, dest], flagMap) => {
                    if (Array.isArray(dest)) throw new Error('multiple target directories specified');
                    if (!flagMap.has('-r') && this.fileSystem.isDirectory(source)) {
                        throw new Error(`-r not specified; omitting directory '${source}'`);
                    }
                    this.fileSystem.cp(source, dest);
                    return '';
                },

                {
                    name: 'cp',
                    flags: {
                        '-t': 'argument',
                        '--target-directory': 'argument',
                        '-r': 'regular'
                    },
                    callForEachArg: true,
                    destinationArgLocations: ['-t', '--target-directory', -1]
                }
            ),

            'mv': this.#command(
                (stdin, [source, dest], flagMap) => {
                    if (Array.isArray(dest)) throw new Error('multiple target directories specified');
                    this.fileSystem.mv(source, dest);
                    return '';
                },

                {
                    name: 'mv',
                    flags: {
                        '-t': 'argument',
                        '--target-directory': 'argument',
                    },
                    callForEachArg: true,
                    destinationArgLocations: ['-t', '--target-directory', -1]
                }
            ),

            // TODO: Implement prompting
            // rm: remove write-protected regular file 'test'? (y/n)
            'rm': this.#command(
                (stdin, path, flagMap) => {
                    if (this.fileSystem.isDirectory(path) && !flagMap.has('-r')) {
                        throw new Error(`cannot remove '${path}': Is a directory`);
                    }
                    if (path === '.' || path === '..') {
                        throw new Error(`refusing to remove '.' or '..' directory: skipping '${path}'`);
                    }
                    const output = this.fileSystem.rm(path, { force: flagMap.has('-f') });
                    return flagMap.has('-v') ? output + '\n' : '';
                },

                {
                    name: 'rm',
                    flags: {
                        '-r': 'regular',
                        '-f': 'regular',
                        '-v': 'regular',
                    },
                    callForEachArg: true,
                }
            ),

        };
    }

    get(name) {
        return this.#commands[name];
    }

    set(name, callback) {
        this.#commands[name] = this.#command(callback, { name });
    }

}


export { CommandRegistry };
