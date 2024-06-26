import { parseArgs } from './argParser.js';


function CommandRegistry(fileSystem, colorize = (text) => text) {

    const popDestinationArg = (positionalArgs, flagMap, destinationArgs) => {
        let dest = null;

        for (let destArg of destinationArgs) {
            if (typeof destArg === 'string' && flagMap.has(destArg)) {
                dest = flagMap.get(destArg);
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


    const executeMultipleArgs = (func, stdin, positionalArgs, flagMap, name, destinationArgs = null) => {
        const dest = destinationArgs ? popDestinationArg(positionalArgs, flagMap, destinationArgs) : null;

        if (destinationArgs && !dest || destinationArgs && positionalArgs.length === 0) {
            const error = positionalArgs.length > 0
                ? `missing destination operand after '${positionalArgs.pop()}'`
                : 'missing operand';
            throw new Error(error);
        }

        let stdout = '';
        let stderr = '';
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
            destinationArgLocations = null
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
                        destinationArgLocations
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
            () => { return fileSystem.pwd(); },
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
            // Implement -l, -a handling
            (stdin, arg, flagMap, multipleArgsMode = false) => {
                if (!arg) {
                    return fileSystem.ls('.');
                }
                else if (!multipleArgsMode) {
                    return fileSystem.ls(arg);
                }
                else {
                    return `${arg.replace('~', fileSystem.getHomeDirectory())}:\n${fileSystem.ls(arg)}\n\n`;
                }
            },

            {
                name: 'ls',
                flags: {
                    '-l': 'regular',
                    '-a': 'regular',
                },
                callForEachArg: true
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

        'mv': command(
            // Implement
            (stdin, args, flagMap) => {
                const [source, destArray] = args;
                if (destArray.length > 1) throw new Error('multiple target directories specified');
                console.log("Source:", source);
                console.log("Destination:", destArray[0]);
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
