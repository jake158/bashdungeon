import { FileSystem } from './fileSystem.js';
import { CommandRegistry } from './commands.js';


export class BashEmulator {
    #fileSystem;
    #commandRegistry;
    #history;
    #historyIndex;
    #colorize;

    constructor(clearTerminal = () => '', colorize = (text) => text) {
        this.#fileSystem = new FileSystem();
        this.#commandRegistry = new CommandRegistry(this.#fileSystem, colorize);
        this.#history = [];
        this.#historyIndex = 0;
        this.#colorize = colorize;

        this.#commandRegistry.set('clear', clearTerminal);
        this.#commandRegistry.set('history', () => this.#history.map((line, index) => ` ${index + 1}  ${line}`).join('\n'));
    }

    #pushToHistory(command) {
        this.#historyIndex = this.#history.length;
        if (command !== this.#history[this.#history.length - 1]) {
            this.#history.push(command);
            this.#historyIndex = this.#history.length;
        }
    }

    #parseAndExecute(input) {
        const executeCommand = (command, stdin = '') => {
            const [commandName, ...args] = command.trim().split(/\s+/);
            const commandFunc = this.#commandRegistry.get(commandName);

            if (commandFunc) {
                return commandFunc(args, stdin);
            } else {
                return { stdin: '', stdout: '', stderr: `${commandName}: command not found` };
            }
        };

        const regex = /\|\||\||&&|&>|&|;|<>|<|2>>|2>|>>/g;
        const commands = input.split(regex).map(cmd => cmd.trim()).filter(cmd => cmd !== '');
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
                    break;
                case '&&':
                    if (result.stderr) { break pipeline; }
                    result = executeCommand(commands[i]);
                    break;
                case '|':
                    if (!result.stderr) outputStream.pop();
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
    }

    execute(input) {
        if (!/\S/.test(input)) {
            return '';
        }
        this.#pushToHistory(input);
        const outputStream = this.#parseAndExecute(input);
        return outputStream.join('\n');
    }

    historyUp() {
        if (this.#historyIndex > 0) {
            this.#historyIndex--;
            return this.#history[this.#historyIndex];
        } else {
            return '';
        }
    }

    historyDown() {
        if (this.#historyIndex < this.#history.length - 1) {
            this.#historyIndex++;
            return this.#history[this.#historyIndex];
        } else {
            return '';
        }
    }

    tabComplete(input) {
        // TODO: Implement
        return input;
    }

    getPrompt() {
        const userAtHost = 'wizard@dungeon';
        const displayDirectory = this.#fileSystem.currentDirectory.replace(this.#fileSystem.homeDirectory, '~');
        return `${this.#colorize(userAtHost, 'bold', 'green')}:${this.#colorize(displayDirectory, 'bold', 'blue')}$ `;
    }
}
