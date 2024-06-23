

function CommandRegistry(fileSystem) {

    const command = (func, name) => {
        return function (...args) {
            try {
                return func(...args);
            } catch (error) {
                return `${name}: ${error.message}`;
            }
        };
    };
    // TODO: automatic error msg depending on function name?
    // Doesn't work with anonymous functions in commands

    const commands = {

        'pwd': command(
            () => {
                return fileSystem.pwd()
            },
            'pwd'
        ),

        'ls': command(
            (args) => {
                // TODO: arg evaluation
                return fileSystem.ls(args.length > 0 ? args[0] : '.')
            },
            'ls'
        ),

        'cd': command(
            (args) => {
                if (args.length > 1) {
                    throw new Error('too many arguments');
                }
                const path = args.length === 1 ? args[0] : '~';
                fileSystem.cd(path);
                return '';
            },
            'bash: cd'
        ),

        'mkdir': command(
            (args) => {
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                // TODO: arg evaluation
                fileSystem.mkdir(args[0]);
                return '';
            },
            'mkdir'
        ),

        'rmdir': command(
            (args) => {
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                // TODO: arg evaluation
                fileSystem.rmdir(args[0]);
                return '';
            },
            'rmdir'
        ),

        'clear': () => {
            // Handled by terminal using eventEmitter
            return '';
        },
    };

    const get = (name) => commands[name];


    return { get };
}

export { CommandRegistry };
