import { EventEmitter } from "./event-emitter.js";
import { FileSystem } from './filesystem/file-system.js';
import { CommandExecutor } from './commands/command-executor.js';
import { Process } from "./process.js";


export class BashEmulator extends EventEmitter {
    #fileSystem;
    #commandExecutor;
    #history;
    #historyIndex;

    constructor(clearTerminal = () => '', colorize = (text) => text, terminalCols = null) {
        super();
        this.colorize = colorize;
        this.#fileSystem = new FileSystem();
        this.#commandExecutor = new CommandExecutor(this.#fileSystem, colorize, terminalCols);
        this.#history = [];
        this.#historyIndex = 0;

        this.#commandExecutor.set('clear', clearTerminal);
        this.#commandExecutor.set('history', () => this.#history.map((line, index) => ` ${index + 1}  ${line}`).join('\n'));
    }

    /**
     * @param {number} newCols
     */
    set terminalCols(newCols) {
        console.log('calling in bash');
        this.#commandExecutor.terminalCols = Math.round(newCols);
    }

    #pushToHistory(command) {
        this.#historyIndex = this.#history.length;
        if (command !== this.#history[this.#history.length - 1]) {
            this.#history.push(command);
            this.#historyIndex = this.#history.length;
        }
    }

    async #runProcess(name, func, args = [], type = 'systemProcess') {
        const process = new Process(name, func, args);
        process.on('start', (name) => this.emit('processStart', name, type, process));
        process.on('end', (name) => this.emit('processEnd', name, type, process));
        return process.run();
    }

    async executeCommand(command, stdin = '') {
        const [commandName, ...args] = command.trim().split(/\s+/);
        return this.#runProcess(
            commandName,
            (commandName, stdin, args) => this.#commandExecutor.execute(commandName, stdin, args),
            [commandName, stdin, args],
            'userCommand');
    }

    async #parseAndExecute(input) {
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
                    result = await this.executeCommand(commands[i]);
                    break;
                case '||':
                    if (!result.stderr) { break pipeline; }
                    result = await this.executeCommand(commands[i]);
                    break;
                case '&&':
                    if (result.stderr) { break pipeline; }
                    result = await this.executeCommand(commands[i]);
                    break;
                case '|':
                    if (!result.stderr) outputStream.pop();
                    result = await this.executeCommand(commands[i], result.stdout);
                    break;
                case '2>':
                    outputStream.pop();
                    result = await this.executeCommand(commands[i], result.stderr);
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

    async execute(input) {
        if (!/\S/.test(input)) {
            return '';
        }
        this.#pushToHistory(input);
        const outputStream = await this.#parseAndExecute(input);
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

    getPrompt(colorized = true) {
        const userAtHost = 'wizard@dungeon';
        const displayDirectory = this.#fileSystem.currentDirectory.replace(this.#fileSystem.homeDirectory, '~');
        return colorized
            ? `${this.colorize(userAtHost, 'bold', 'green')}:${this.colorize(displayDirectory, 'bold', 'blue')}$ `
            : `${userAtHost}:${displayDirectory}`;
    }
}
