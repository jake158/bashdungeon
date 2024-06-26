

function CommandRegistry(fileSystem, colorize = (text) => text) {

    const parseArgs = (args) => {
        const flagMap = new Map();
        const positionalArgs = [];

        for (let arg of args) {

            if (arg.startsWith('--') && arg.length > 2) {
                const [flag, value] = arg.split('=');
                flagMap.delete(flag);
                flagMap.set(flag, value ? value : true);
            }

            else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
                arg.slice(1).split('').forEach(flagChar => { flagMap.delete(`-${flagChar}`); flagMap.set(`-${flagChar}`, true); });
            }

            else {
                // Unquoted arguments treat \ as an escape character
                arg = arg.startsWith('"') && arg.endsWith('"') || arg.startsWith("'") && arg.endsWith("'")
                    ? arg.slice(1, -1)
                    : arg.replace(/\\(?!\\)/g, '');
                positionalArgs.push(arg);
            }
        }
        return { positionalArgs, flagMap };
    };


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
            const error = positionalArgs.length > 0 ? `missing destination operand after '${positionalArgs.pop()}'` : 'missing operand';
            return { stdin: '', stdout: '', stderr: `${name}: ${error}` };
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
            flags = [],
            callForEachArg = false,
            destinationArgLocations = null
        } = settings;

        return function (args, stdin) {
            const {
                positionalArgs,
                flagMap
            } = parseArgs(args);

            for (const [flag, _] of flagMap.entries()) {
                if (!flags.includes(flag)) {
                    return { stdin: '', stdout: '', stderr: `${name}: ${flag}: unrecognized option` }
                }
            }

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

            try {
                return { stdin: '', stdout: func(stdin, positionalArgs, flagMap), stderr: '' };
            } catch (error) {
                return { stdin: '', stdout: '', stderr: `${name}: ${error.message}` };
            }
        };
    };

    // TODO:
    // 1. Each command parses flags differently, e.g. `cut -d , -f 2 animals.csv`, `find /home -name puppies.jpg`
    // parseArgs needs additional info passed which specifies which flags require an argument

    // 2. Improve wrapper: --help entry for each command

    // 3. Cleaning, refactoring

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


    const commands = {

        // These commands take no positional arguments

        'clear': command(
            // Handled by terminal using eventEmitter
            () => {
                return '';
            },

            {
                name: 'clear'
            }
        ),

        'pwd': command(
            () => {
                return fileSystem.pwd();
            },

            {
                name: 'pwd'
            }
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
                flags: ['-e', '-E'],
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
                flags: ['-l', '-a'],
                callForEachArg: true
            }
        ),

        'cat': command(
            (stdin, arg, flagMap, multipleArgsMode = false) => {
                if (arg.length === 0) {
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
                const [source, dest] = args;
                console.log("Source:", source);
                console.log("Destination:", dest);
                return '';
            },

            {
                name: 'mv',
                flags: ['-t'],
                callForEachArg: true,
                destinationArgLocations: ['-t', -1]
            }
        ),
    };


    return {
        get: (name) => commands[name]
    };
}


export { CommandRegistry };
