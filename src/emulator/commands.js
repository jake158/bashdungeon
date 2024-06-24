

function CommandRegistry(fileSystem) {

    const command = (name, func, acceptedFlags = []) => {
        return function (args, flags) {
            try {
                for (let flag in flags) {
                    if (!acceptedFlags.includes(flag)) {
                        throw new Error(`${flag}: unrecognized option`);
                    }
                }
                return func(args, flags);
            } catch (error) {
                return `${name}: ${error.message}`;
            }
        };
    };
    // TODO:
    // 1. Each command parses flags differently, e.g. `cut -d , -f 2 animals.csv`, `find /home -name puppies.jpg`
    // Flexible flag parser needs to be implemented instead of rigid one in bash.js

    // 2. Cleaner multiple positional args evaluation
    // If one directory permission denies ls, the other still gets printed
    // Commands need to be called separately for each positionalArg, when multiple are allowed

    // 3. Improve wrapper: --help entry for each command

    const commands = {

        'pwd': command(
            'pwd',
            (args, flags) => {
                return fileSystem.pwd();
            }
        ),

        'ls': command(
            'ls',
            (args, flags) => {
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
            (args, flags) => {
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
            (args, flags) => {
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
            (args, flags) => {
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                args.forEach(arg => {
                    fileSystem.rmdir(arg);
                });
                return '';
            }
        ),

        'clear': command(
            // Handled by terminal using eventEmitter
            'clear',
            (args, flags) => {
                return '';
            }
        ),
    };


    return {
        get: (name) => commands[name]
    };
}


export { CommandRegistry };
