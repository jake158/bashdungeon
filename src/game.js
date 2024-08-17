import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BashEmulator } from './emulator/bash.js';
import { colorize, print, ascii } from './utils.js';


export class Game {
    constructor(terminalElement) {
        this.terminal = new Terminal({
            fontSize: 17,
            fontFamily: 'Ubuntu Mono, courier-new, courier, monospace',
            cursorBlink: true,
            convertEol: true
        });
        this.terminal.open(terminalElement);

        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);
        this.fitAddon.fit();
        window.addEventListener('resize', () => this.fitAddon.fit());

        this.bash = new BashEmulator(() => this.terminal.reset(), colorize);
        this.commandBuffer = '';
        this.cursorRow = 0;
    }

    // Improve this
    clearInput() {
        for (let i = 0; i < this.commandBuffer.length; i++) {
            this.terminal.write('\b \b');
        }
    }

    handleData(e) {
        const { terminal, bash } = this;
        switch (e) {

            // Enter
            case '\r':
                const result = bash.execute(this.commandBuffer);
                print(terminal, result);
                print(terminal, bash.getPrompt());
                this.commandBuffer = '';
                this.cursorRow = 0;
                break;

            // Backspace
            case '\u007F':
                if (this.commandBuffer.length > 0 && terminal.buffer.active.cursorX != 0) {
                    this.commandBuffer = this.commandBuffer.slice(0, -1);
                    terminal.write('\b \b');
                } else if (terminal.buffer.active.cursorX == 0) {
                    this.commandBuffer = this.commandBuffer.slice(0, -1);
                    terminal.write('\x1b[A');
                    terminal.write(`\x1b[${terminal.cols}C`);
                    terminal.write('\b \b');
                    this.cursorRow--;
                }
                break;

            // Tab
            case '\t':
                const completion = bash.tabComplete(this.commandBuffer);
                if (completion) {
                    this.clearInput();
                    this.commandBuffer = completion;
                    terminal.write(this.commandBuffer);
                }
                break;

            // Up arrow
            case '\x1b[A':
                const upCommand = bash.historyUp();
                if (upCommand) {
                    this.clearInput();
                    this.commandBuffer = upCommand;
                    terminal.write(this.commandBuffer);
                }
                break;

            // Down arrow
            case '\x1b[B':
                const downCommand = bash.historyDown();
                if (downCommand) {
                    this.clearInput();
                    this.commandBuffer = downCommand;
                    terminal.write(this.commandBuffer);
                }
                break;

            // Left, right arrow
            case '\x1b[D':
            case '\x1b[C':
                break;

            default:
                if (terminal.buffer.active.cursorX === terminal.cols - 1) {
                    this.cursorRow += 1;
                    terminal.write('\x1b[B');
                    terminal.write('\x1b[1000D');
                }
                this.commandBuffer += e;
                terminal.write(e);
        }
    }

    start() {
        this.terminal.write(ascii.welcome);
        print(this.terminal, this.bash.getPrompt());
        this.terminal.onData(e => this.handleData(e));
        this.terminal.focus();
    }
}
