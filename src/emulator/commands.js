

function CommandRegistry(fileSystem, colorize = (text) => text) {

    const defaultParseArgs = (args) => {
        const flags = {};
        const positionalArgs = [];

        args.forEach(arg => {
            if (arg.startsWith('--') && arg.length > 2) {
                const [flag, value] = arg.split('=');
                flags[flag] = value !== undefined ? value : true;
            } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
                arg.slice(1).split('').forEach(flagChar => { flags[`-${flagChar}`] = true; });
            } else {
                positionalArgs.push(arg);
            }
        });
        return { positionalArgs, flags };
    };

    const command = (name, func, acceptedFlags = [], customParser = null) => {
        return function (args, stdin) {
            try {
                const { positionalArgs, flags } = customParser ? customParser(args) : defaultParseArgs(args);
                if (!customParser) {
                    for (let flag in flags) {
                        if (!acceptedFlags.includes(flag)) {
                            throw new Error(`${flag}: unrecognized option`);
                        }
                    }
                }
                return { stdin: '', stdout: func(stdin, positionalArgs, flags), stderr: '' };
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
    }


    const commands = {

        'clear': command(
            // Handled by terminal using eventEmitter
            'clear',
            (stdin, args, flags) => {
                return '';
            }
        ),

        'pwd': command(
            'pwd',
            (stdin, args, flags) => {
                return fileSystem.pwd();
            }
        ),

        'echo': command(
            'echo',
            (stdin, args, flags) => {
                console.log(flags);
                let str = args.map(arg => arg.replace(/['"]/g, '')).join(' ') || ' ';
                let processEscapes = false;

                for (let flag of Object.keys(flags)) {
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
            (stdin, args, flags) => {
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
            (stdin, args, flags) => {
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
            (stdin, args, flags) => {
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
            (stdin, args, flags) => {
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
            (stdin, args, flags) => {
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
