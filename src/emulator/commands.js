import { changeDirectory, listDirectory, getWorkingDirectory } from './fileSystem.js';


function CommandRegistry() {

    const commands = {

        'cd': (args) => {
            if (args.length < 1) {
                return 'No directory specified';
            }
            const path = args[0];
            const error = changeDirectory(path);
            return error || '';
        },

        'ls': () => {
            return listDirectory()
        },

        'pwd': () => {
            return getWorkingDirectory()
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
