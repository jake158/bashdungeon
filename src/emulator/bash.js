import { Executor } from "./executor.js";


export class BashEmulator {
    #executor
    #history;
    #historyIndex;

    constructor(clearTerminal = () => '', colorize = (text) => text) {
        this.#executor = new Executor(colorize);
        this.#history = [];
        this.#historyIndex = 0;

        this.#executor.setCommand('clear', clearTerminal);
        this.#executor.setCommand('history', () => this.#history.map((line, index) => ` ${index + 1}  ${line}`).join('\n'));
    }

    #pushToHistory(command) {
        this.#historyIndex = this.#history.length;
        if (command !== this.#history[this.#history.length - 1]) {
            this.#history.push(command);
            this.#historyIndex = this.#history.length;
        }
    }

    #parseAndExecute(input) {
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
                    result = this.#executor.executeCommand(commands[i]);
                    break;
                case '||':
                    if (!result.stderr) { break pipeline; }
                    result = this.#executor.executeCommand(commands[i]);
                    break;
                case '&&':
                    if (result.stderr) { break pipeline; }
                    result = this.#executor.executeCommand(commands[i]);
                    break;
                case '|':
                    if (!result.stderr) outputStream.pop();
                    result = this.#executor.executeCommand(commands[i], result.stdout);
                    break;
                case '2>':
                    outputStream.pop();
                    result = this.#executor.executeCommand(commands[i], result.stderr);
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
        return this.#executor.getPrompt();
    }
}
