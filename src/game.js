import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { Cd, Ls, Pwd, Clear } from './commands.js';
import { printPrompt, print } from './utils.js';
import { ascii } from './ascii.js';


addEventListener("DOMContentLoaded", (event) => {

    const terminal = new Terminal({
        fontSize: 17,
        fontFamily: 'Ubuntu Mono, courier-new, courier, monospace',
        cursorBlink: true,
        convertEol: true
    });
    terminal.open(document.getElementById('terminal'));

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
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
            print(terminal, `Command not found: ${input}`);
        }
    };

    print(terminal, ascii.banner, false, false);
    printPrompt(terminal);
    terminal.focus();
});
