import { Cd, Ls, Pwd, Clear } from './command.js';
import { printPrompt, printToTerminal } from './utils.js';

const terminal = new Terminal();
const fitAddon = new FitAddon.FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(document.getElementById('terminal'));
fitAddon.fit();

window.addEventListener('resize', () => fitAddon.fit());

let commandBuffer = '';


terminal.onData(e => {
    switch (e) {
        // Enter
        case '\r':
            processCommand(commandBuffer);
            commandBuffer = '';
            printPrompt(terminal);
            break;
        // Backspace
        case '\u007F':
            if (commandBuffer.length > 0) {
                commandBuffer = commandBuffer.slice(0, -1);
                terminal.write('\b \b');
            }
            break;
        default:
            commandBuffer += e;
            terminal.write(e);
    }
});

const commandRegistry = {
    'cd': new Cd(terminal),
    'ls': new Ls(terminal),
    'pwd': new Pwd(terminal),
    'clear': new Clear(terminal)
};

const processCommand = (input) => {
    const [commandName, ...args] = input.trim().split(/\s+/);
    const command = commandRegistry[commandName];

    if (command) {
        command.execute(args);
    } else {
        printToTerminal(terminal, `Command not found: ${input}`);
    }
};

printToTerminal(terminal, 'Welcome to the BASH Dungeon Game!\n');
printPrompt(terminal);
