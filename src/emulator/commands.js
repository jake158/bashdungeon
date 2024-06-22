

function CommandRegistry(fileSystem) {

    const commands = {

        'pwd': () => {
            return fileSystem.pwd()
        },

        'ls': () => {
            return fileSystem.ls()
        },

        'cd': (args) => {
            if (args.length > 1) {
                return 'bash: cd: too many arguments';
            }
            const path = args.length === 1 ? args[0] : '~';
            const error = fileSystem.cd(path);
            return error || '';
        },

        'mkdir': (args) => {
            if (args.length < 1) {
                return 'mkdir: missing operand';
            }
            // TODO: arg evaluation
            return fileSystem.mkdir(args[0]);
        },

        'rmdir': (args) => {
            if (args.length < 1) {
                return 'rmdir: missing operand';
            }
            // TODO: arg evaluation
            return fileSystem.rmdir(args[0]);
        },

        'clear': () => {
            // Handled by terminal using eventEmitter
            return '';
        },
    };

    const get = (name) => commands[name];


    return { get };
}

export { CommandRegistry };
