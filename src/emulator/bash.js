import { FileSystem } from './fileSystem.js';
import { CommandRegistry } from './commands.js';


function BashEmulator(eventEmitter, colorize) {
    const fileSystem = FileSystem();
    const commandRegistry = CommandRegistry(fileSystem);
    const history = [];
    let historyIndex = 0;


    const pushToHistory = (command) => {
        // No duplicates
        if (command != history[historyIndex - 1]) {
            history.push(command);
            historyIndex = history.length;
        }
    };

    const parseCommand = (input) => {
        return input.trim().split(/\s+/);
    };

    const execute = (input) => {
        // Return on whitespace
        if (!/\S/.test(input)) {
            return '';
        }
        const [commandName, ...args] = parseCommand(input);
        const command = commandRegistry.get(commandName);
        pushToHistory(input);

        if (command) {
            eventEmitter.emit(commandName);
            return command(args);
        } else {
            return `${input}: command not found`;
        }
    };

    const historyUp = () => {
        // TODO: Bash remembers what was in buffer
        // E.g. type "test", press UpArrow, DownArrow
        // Result is "test"
        if (historyIndex > 0) {
            historyIndex--;
            return history[historyIndex];
        } else {
            return '';
        }
    };

    const historyDown = () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            return history[historyIndex];
        } else {
            return ''
        }
    };

    const autocomplete = (input) => {
        // TODO: Implement
        return input;
    };

    const getPrompt = () => {
        const userAtHost = 'wizard@dungeon';
        const currentDirectory = fileSystem.getWorkingDirectory();
        const displayDirectory = currentDirectory.replace(fileSystem.getHomeDirectory(), '~');
        return `${colorize(userAtHost, 'bold', 'green')}:${colorize(displayDirectory, 'bold', 'blue')}$ `;
    };


    return {
        execute,
        historyUp,
        historyDown,
        autocomplete,
        getPrompt
    };
}


export { BashEmulator };
