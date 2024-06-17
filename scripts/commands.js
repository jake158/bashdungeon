import { changeDirectory, listDirectory, getWorkingDirectory } from './fileSystem.js';
import { printToTerminal } from './utils.js';

class Command {
    constructor(terminal) {
        if (this.constructor === Command) {
            throw new Error("Cannot instantiate abstract class");
        }
        this.terminal = terminal;
    }
    execute(args) {
        throw new Error("Execute method must be implemented");
    }
}

class Cd extends Command {
    execute(args) {
        if (args.length < 1) {
            printToTerminal(this.terminal, 'No directory specified');
            return;
        }
        const path = args[0];
        const error = changeDirectory(path);
        if (error) {
            printToTerminal(this.terminal, error);
        }
    }
}

class Ls extends Command {
    execute(args) {
        const output = listDirectory();
        printToTerminal(this.terminal, output);
    }
}

class Pwd extends Command {
    execute(args) {
        const output = getWorkingDirectory();
        printToTerminal(this.terminal, output);
    }
}

class Clear extends Command {
    execute(args) {
        this.terminal.reset();
    }
}

export { Command, Cd, Ls, Pwd, Clear };
