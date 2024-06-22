

function CommandRegistry(fileSystem) {

    const commands = {

        'cd': (args) => {
            if (args.length < 1) {
                return 'No directory specified';
            }
            const path = args[0];
            const error = fileSystem.cd(path);
            return error || '';
        },

        'ls': () => {
            return fileSystem.ls()
        },

        'pwd': () => {
            return fileSystem.pwd()
        },

        'clear': () => {
            // Handled by terminal using eventEmitter
            return '';
        }
    };

    const get = (name) => commands[name];


    return { get };
}

export { CommandRegistry };
