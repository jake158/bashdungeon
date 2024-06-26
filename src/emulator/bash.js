import { FileSystem } from './fileSystem.js';
import { CommandRegistry } from './commands.js';

function BashEmulator(eventEmitter, colorize = (text) => text) {
    const fileSystem = FileSystem(colorize);
    const commandRegistry = CommandRegistry(fileSystem, colorize);
    const history = [];
    let historyIndex = 0;

    const pushToHistory = (command) => {
        historyIndex = history.length;
        if (command != history[history.length - 1]) {
            history.push(command);
            historyIndex = history.length;
        }
    };

    const parseAndExecute = (input) => {

        const executeCommand = (command, stdin = '') => {
            const [commandName, ...args] = command.trim().split(/\s+/);
            const commandFunc = commandRegistry.get(commandName);
            eventEmitter.emit(commandName);

            if (commandFunc) {
                return commandFunc(args, stdin);
            } else {
                return { stdin: '', stdout: '', stderr: `${commandName}: command not found` };
            }
        };

        const regex = /\|\||\||&&|&>|&|;|<>|<|2>>|2>|>>/g;
        const commands = input.split(regex).map(cmd => cmd.trim()).filter(cmd => cmd != '');
        const operators = input.match(regex) || [];
        operators.unshift(';');

        let result = { stdin: '', stdout: '', stderr: '' };
        const outputStream = [];

        pipeline:
        for (let i = 0; i < commands.length; i++) {
            switch (operators[i]) {
                case ';':
                    result = executeCommand(commands[i]);
                    break;
                case '||':
                    if (!result.stderr) { break pipeline; }
                    result = executeCommand(commands[i]);
                    break
                case '&&':
                    if (result.stderr) { break pipeline; }
                    result = executeCommand(commands[i]);
                    break
                case '|':
                    !result.stderr ? outputStream.pop() : '';
                    result = executeCommand(commands[i], result.stdout);
                    break;
                case '2>':
                    outputStream.pop();
                    result = executeCommand(commands[i], result.stderr);
                    break;
                default:
                    outputStream.push(`${operators[i]}: operator not implemented`);
                    break pipeline;
            }
            if (result.stderr) {
                outputStream.push(result.stderr);
            }
            if (result.stdout) {
                outputStream.push(result.stdout);
            }
        }
        return outputStream;
    };

    const execute = (input) => {
        if (!/\S/.test(input)) {
            return '';
        }
        pushToHistory(input);
        const outputStream = parseAndExecute(input);
        return outputStream.join('\n');
    };

    const historyUp = () => {
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

    const tabComplete = (input) => {
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
        tabComplete,
        getPrompt
    };
}


export { BashEmulator };
