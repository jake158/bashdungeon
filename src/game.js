import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BashEmulator } from './emulator/bash.js';
import { EventEmitter } from './eventEmitter.js';
import { colorize, print, ascii } from './utils.js';


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

    const eventEmitter = EventEmitter();
    const bash = BashEmulator(eventEmitter, colorize);
    let commandBuffer = '';
    let cursorRow = 0;

    // This does not work
    // When cursor reaches x=0 on line, it doesn't go up a line
    // I am very tired of this terminal so I will ignore it for now
    const clearInput = () => {
        for (let i = 0; i < commandBuffer.length; i++) {
            terminal.write('\b \b');
        }
    };

    terminal.onData(e => {
        switch (e) {
            // Enter
            case '\r':
                const result = bash.execute(commandBuffer);
                print(terminal, result);
                print(terminal, bash.getPrompt());
                commandBuffer = '';
                cursorRow = 0;
                break;

            // Backspace
            case '\u007F':
                if (commandBuffer.length > 0 && terminal.buffer.active.cursorX != 0) {
                    commandBuffer = commandBuffer.slice(0, -1);
                    terminal.write('\b \b');
                }
                else if (terminal.buffer.active.cursorX == 0) {
                    commandBuffer = commandBuffer.slice(0, -1);
                    terminal.write('\x1b[A');
                    terminal.write(`\x1b[${terminal.cols}C`);
                    terminal.write('\b \b');
                    cursorRow--;
                }
                break;

            // Tab
            case '\t':
                const completion = bash.tabComplete(commandBuffer);
                if (completion) {
                    clearInput();
                    commandBuffer = completion;
                    terminal.write(commandBuffer);
                }
                break;

            // Up arrow
            case '\x1b[A':
                const upCommand = bash.historyUp();
                if (upCommand) {
                    clearInput();
                    commandBuffer = upCommand;
                    terminal.write(commandBuffer);
                }
                break;

            // Down arrow
            case '\x1b[B':
                const downCommand = bash.historyDown();
                if (downCommand) {
                    clearInput();
                    commandBuffer = downCommand;
                    terminal.write(commandBuffer);
                }
                break;

            // Left, right arrow
            case '\x1b[D':
            case '\x1b[C':
                break;

            default:
                if (terminal.buffer.active.cursorX === terminal.cols - 1) {
                    cursorRow += 1;
                    terminal.write('\x1b[B');
                    terminal.write('\x1b[1000D');
                }
                commandBuffer += e;
                terminal.write(e);
        }
    });

    eventEmitter.on('clear', () => terminal.reset());

    print(terminal, ascii.welcome, false, false);
    print(terminal, bash.getPrompt());
    terminal.focus();
}


window.addEventListener("DOMContentLoaded", (e) => {
    Game();
});
