import { parseArgs } from './argParser.js';


function CommandRegistry(fileSystem, colorize = (text) => text) {

    const popDestinationArg = (positionalArgs, flagMap, destinationArgs) => {
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
    };


    const executeMultipleArgs = (func, stdin, positionalArgs, flagMap, name, destinationArgs, sortArgs) => {
        const dest = destinationArgs ? popDestinationArg(positionalArgs, flagMap, destinationArgs) : null;

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
                    positionalArgs.length > 1 ? true : false
                );
            }
            catch (error) {
                stderr += `${name}: ${error.message}\n`;
            }
        }
        return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
    };


    const command = (func, settings = {}) => {
        const {
            name = 'unnamed command',
            flags = {},
            callForEachArg = false,
            destinationArgLocations = null,
            sortArgs = null
        } = settings;

        return function (args, stdin) {
            try {
                const {
                    positionalArgs,
                    flagMap
                } = parseArgs(args, flags);

                if (callForEachArg) {
                    return executeMultipleArgs(
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
    };


    // TODO:
    // 1. Improve wrapper: --help entry for each command

    // 2. Cleaning, refactoring


    const commands = {

        // These commands take no positional arguments

        'clear': command(
            // Handled by terminal using eventEmitter
            () => { return ''; },
            { name: 'clear' }
        ),

        'pwd': command(
            () => { return fileSystem.getCurrentDirectory(); },
            { name: 'pwd' }
        ),


        // These commands take a fixed number of positional arguments

        'cd': command(
            (stdin, args, flagMap) => {
                if (args.length > 1) {
                    throw new Error('too many arguments');
                }
                const path = args.length === 1 ? args[0] : '~';
                fileSystem.cd(path);
                return '';
            },

            {
                name: 'bash: cd',
            }
        ),


        // These commands take any number of positional arguments

        'echo': command(
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

        'mkdir': command(
            (stdin, arg, flagMap) => {
                if (!arg) {
                    throw new Error('missing operand');
                }
                fileSystem.mkdir(arg);
                return '';
            },

            {
                name: 'mkdir',
                callForEachArg: true
            }
        ),

        'rmdir': command(
            (stdin, arg, flagMap) => {
                if (!arg) {
                    throw new Error('missing operand');
                }
                fileSystem.rmdir(arg);
                return '';
            },

            {
                name: 'rmdir',
                callForEachArg: true
            }
        ),

        'ls': command(
            // Implement -l
            (stdin, arg, flagMap, multipleArgsMode = false) => {
                const long = flagMap.has('-l');
                const all = flagMap.has('-a');
                const result = fileSystem.ls(arg ? arg : '.', all);

                const formatResult = (item) => {
                    const name = item.type === 'directory' ? colorize(item.name, 'bold', 'blue') : item.name;
                    if (long) { return `${item.permissions} ${name}`; }
                    else { return name; }
                }

                if (!Array.isArray(result)) {
                    return formatResult(result) + (multipleArgsMode && long ? '\n' : '  ');
                }

                const output = result.map(formatResult).join(long ? '\n' : '  ');
                if (!multipleArgsMode) { return output; }
                return `\n${arg.replace('~', fileSystem.getHomeDirectory())}:\n${output}\n`;
            },

            {
                name: 'ls',
                flags: {
                    '-l': 'regular',
                    '-a': 'regular',
                },
                callForEachArg: true,
                sortArgs: (a, b) => {
                    if (fileSystem.isDirectory(a) && !fileSystem.isDirectory(b)) { return 1; }
                    if (!fileSystem.isDirectory(a) && fileSystem.isDirectory(b)) { return -1; }
                    return 0;
                }
            }
        ),

        'cat': command(
            (stdin, arg, flagMap, multipleArgsMode = false) => {
                if (!arg) {
                    return stdin;
                }
                let output = fileSystem.getFileContent(arg);
                output += multipleArgsMode && output ? '\n' : '';
                return output;
            },

            {
                name: 'cat',
                callForEachArg: true
            }
        ),

        'cp': command(
            // Implement: merging -t and --target-directory arrays?
            (stdin, [source, dest], flagMap) => {
                if (Array.isArray(dest)) throw new Error('multiple target directories specified');
                if (!flagMap.has('-r') && fileSystem.isDirectory(source)) { throw new Error(`-r not specified; omitting directory '${source}'`); }
                fileSystem.cp(source, dest);
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

        'mv': command(
            (stdin, [source, dest], flagMap) => {
                if (Array.isArray(dest)) throw new Error('multiple target directories specified');
                fileSystem.mv(source, dest);
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
    };


    return {
        get: (name) => commands[name]
    };
}


export { CommandRegistry };
