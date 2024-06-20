import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BashEmulator } from './emulator/bash.js';
import { EventEmitter } from './eventEmitter.js';
import { printPrompt, print, ascii } from './utils.js';


function Game() {
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
    const eventEmitter = EventEmitter();
    const bashEmulator = BashEmulator(eventEmitter);


    terminal.onData(e => {
        switch (e) {
            // Enter
            case '\r':
                const result = bashEmulator.execute(commandBuffer);
                print(terminal, result);
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

    eventEmitter.on('clear', () => terminal.reset());

    print(terminal, ascii.welcome, false, false);
    printPrompt(terminal);
    terminal.focus();
}


window.addEventListener("DOMContentLoaded", (e) => {
    Game();
});
