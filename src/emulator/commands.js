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

    const commands = {

        'pwd': command(
            (args, flags) => {
                for (let flag in flags) {
                    throw new Error(`${flag}: unrecognized option`);
                }
                return fileSystem.pwd();
            },
            'pwd'
        ),

        'ls': command(
            (args, flags) => {
                for (let flag in flags) {
                    throw new Error(`${flag}: unrecognized option`);
                }
                return fileSystem.ls(args.length > 0 ? args[0] : '.');
            },
            'ls'
        ),

        'cd': command(
            (args, flags) => {
                for (let flag in flags) {
                    throw new Error(`${flag}: unrecognized option`);
                }
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
            (args, flags) => {
                for (let flag in flags) {
                    throw new Error(`${flag}: unrecognized option`);
                }
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                fileSystem.mkdir(args[0]);
                return '';
            },
            'mkdir'
        ),

        'rmdir': command(
            (args, flags) => {
                for (let flag in flags) {
                    throw new Error(`${flag}: unrecognized option`);
                }
                if (args.length < 1) {
                    throw new Error('missing operand');
                }
                fileSystem.rmdir(args[0]);
                return '';
            },
            'rmdir'
        ),

        'clear': command(
            (args, flags) => {
                // Handled by terminal using eventEmitter
                return '';
            },
            'clear'
        ),
    };

    const get = (name) => commands[name];

    return { get };
}

export { CommandRegistry };
