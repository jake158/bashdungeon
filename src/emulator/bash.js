import { FileSystem } from './fileSystem.js';
import { CommandRegistry } from './commands.js';


function BashEmulator(eventEmitter, colorize = (text) => text) {
    const fileSystem = FileSystem();
    const commandRegistry = CommandRegistry(fileSystem);
    const history = [];
    let historyIndex = 0;


    const parseArgs = (args) => {
        const flags = {};
        const positionalArgs = [];

        let currentFlag = null;
        args.forEach(arg => {
            if (arg.startsWith('--')) {
                const [flag, value] = arg.split('=');
                flags[flag] = value !== undefined ? value : true;
                currentFlag = flag;
            }
            else if (arg.startsWith('-')) {
                arg.slice(1).split('').forEach(flagChar => {
                    flags[`-${flagChar}`] = true;
                });
                currentFlag = `-${arg.slice(1)}`;
            }
            else {
                positionalArgs.push(arg);
                currentFlag = null;
            }
        });
        return { flags, positionalArgs };
    };

    const parse = (input) => {
        const [commandName, ...args] = input.trim().split(/\s+/);
        const { flags, positionalArgs } = parseArgs(args);
        return { commandName, flags, positionalArgs };
    };


    const execute = (input) => {
        if (!/\S/.test(input)) {
            return '';
        }
        const { commandName, flags, positionalArgs } = parse(input);
        const command = commandRegistry.get(commandName);
        pushToHistory(input);

        if (command) {
            eventEmitter.emit(commandName);
            return command(positionalArgs, flags);
        } else {
            return `${commandName}: command not found`;
        }
    };

    const pushToHistory = (command) => {
        historyIndex = history.length;
        if (command != history[history.length - 1]) {
            history.push(command);
            historyIndex = history.length;
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
        const currentDirectory = fileSystem.pwd();
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
