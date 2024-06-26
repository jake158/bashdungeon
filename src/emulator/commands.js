

function CommandRegistry(fileSystem, colorize = (text) => text) {

    const parseArgs = (args) => {
        const flagMap = new Map();
        const positionalArgs = [];

        args.forEach(arg => {
            if (arg.startsWith('--') && arg.length > 2) {
                const [flag, value] = arg.split('=');
                flagMap.delete(flag);
                flagMap.set(flag, value ? value : true);
            } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
                arg.slice(1).split('').forEach(flagChar => { flagMap.delete(`-${flagChar}`); flagMap.set(`-${flagChar}`, true); });
            } else {
                positionalArgs.push(arg);
            }
        });

        return { positionalArgs, flagMap };
    };

    const command = (name, func, acceptedFlags = [], acceptsMultipleArgs = false) => {
        return function (args, stdin) {
            const { positionalArgs, flagMap } = parseArgs(args);

            for (const [flag, _] of flagMap.entries()) {
                if (!acceptedFlags.includes(flag)) {
                    return { stdin: '', stdout: '', stderr: `${name}: ${flag}: unrecognized option` }
                }
            }

            if (acceptsMultipleArgs && positionalArgs.length > 1) {
                let stdout = '';
                let stderr = '';

                positionalArgs.forEach(arg => {
                    try {
                        stdout += func(stdin, [arg], flagMap, true);
                    } catch (error) {
                        stderr += `${name}: ${error.message}\n`;
                    }
                });
                return { stdin: '', stdout: stdout.trim(), stderr: stderr.trim() };
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
    // Flexible flag parser with specified structure for each command that requires it

    // 2. Cleaner multiple positional args evaluation

    // 3. Improve wrapper: --help entry for each command

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

        'clear': command(
            // Handled by terminal using eventEmitter
            'clear',
            (stdin, args, flagMap) => {
                return '';
            }
        ),

        'pwd': command(
            'pwd',
            (stdin, args, flagMap) => {
                return fileSystem.pwd();
            }
        ),

        'echo': command(
            'echo',
            (stdin, args, flagMap) => {
                let str = args.map(arg => arg.replace(/['"]/g, '')).join(' ') || ' ';
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
                return processEscapes ? processEscapeSequences(str) : str;
            },
            ['-e', '-E']
        ),

        'ls': command(
            'ls',
            (stdin, args, flagMap, multipleArgsMode = false) => {
                if (args.length === 0) {
                    return fileSystem.ls('.');
                }
                else if (!multipleArgsMode) {
                    return fileSystem.ls(args[0]);
                }
                else {
                    return `${args[0].replace('~', fileSystem.getHomeDirectory())}:\n${fileSystem.ls(args[0])}\n\n`;
                }
            },
            ['-l', '-a'],
            true
        ),

        'cd': command(
            'bash: cd',
            (stdin, args, flagMap) => {
                if (args.length > 1) {
                    throw new Error('too many arguments');
                }
                const path = args.length === 1 ? args[0] : '~';
                fileSystem.cd(path);
                return '';
            }
        ),

        'mkdir': command(
            'mkdir',
            (stdin, args, flagMap) => {
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                fileSystem.mkdir(args[0]);
                return '';
            },
            [],
            true
        ),

        'rmdir': command(
            'rmdir',
            (stdin, args, flagMap) => {
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                fileSystem.rmdir(args[0]);
                return '';
            },
            [],
            true
        ),

        'cat': command(
            'cat',
            (stdin, args, flagMap, multipleArgsMode = false) => {
                if (args.length === 0) {
                    return stdin;
                }
                let output = fileSystem.getFileContent(args[0]);
                output += multipleArgsMode && output ? '\n' : '';
                return output;
            },
            [],
            true
        ),
    };


    return {
        get: (name) => commands[name]
    };
}


export { CommandRegistry };
