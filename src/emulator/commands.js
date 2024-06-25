

function CommandRegistry(fileSystem, colorize = (text) => text) {

    const defaultParseArgs = (args) => {
        const flags = [];
        const positionalArgs = [];

        args.forEach(arg => {
            if (arg.startsWith('--') && arg.length > 2) {
                flags.push(arg.split('='));
            } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
                arg.slice(1).split('').forEach(flagChar => { flags.push(`-${flagChar}`); });
            } else {
                positionalArgs.push(arg);
            }
        });

        // Map preserves flag order
        const flagMap = flags.reduce((acc, flag) => {
            if (flag instanceof Array) {
                acc.delete(flag[0]);
                acc.set(flag[0], flag[1] ? flag[1] : true);
            }
            else {
                acc.delete(flag);
                acc.set(flag, true);
            }
            return acc;
        }, new Map());

        return { positionalArgs, flagMap };
    };

    const command = (name, func, acceptedFlags = [], customParser = null) => {
        return function (args, stdin) {
            try {
                const { positionalArgs, flagMap } = customParser ? customParser(args) : defaultParseArgs(args);

                for (const [flag, _] of flagMap.entries()) {
                    if (!acceptedFlags.includes(flag)) {
                        throw new Error(`${flag}: unrecognized option`);
                    }
                }
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
    // If one directory permission denies ls, the other still gets printed
    // Commands need to be called separately for each positionalArg, when multiple are allowed

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
            (stdin, args, flagMap) => {
                if (args.length === 0) {
                    return fileSystem.ls('.');
                }
                else if (args.length === 1) {
                    return fileSystem.ls(args[0]);
                }
                else {
                    let output = '';
                    args.forEach(arg => {
                        output += `${arg.replace('~', fileSystem.getHomeDirectory())}:\n${fileSystem.ls(arg)}\n\n`;
                    });
                    return output.trim();
                }
            },
            ['-l', '-a']
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
                args.forEach(arg => {
                    fileSystem.mkdir(arg);
                });
                return '';
            }
        ),

        'rmdir': command(
            'rmdir',
            (stdin, args, flagMap) => {
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                args.forEach(arg => {
                    fileSystem.rmdir(arg);
                });
                return '';
            }
        ),

        'cat': command(
            // Implement
            'cat',
            (stdin, args, flagMap) => {
                if (args.length === 0) {
                    return stdin;
                }
                return '';
            }
        ),
    };


    return {
        get: (name) => commands[name]
    };
}


export { CommandRegistry };
