import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BashEmulator } from './emulator/bash.js';
import { colorize, ascii, ansi } from './utils.js';


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

    clearInput() {
        let cursorPos = this.terminal.buffer.active.cursorX;
        while (this.commandBuffer.length > 0) {
            this.commandBuffer = this.commandBuffer.slice(0, -1);

            if (cursorPos != 0) {
                this.terminal.write(ansi.deleteToLeft);
                cursorPos--;
            } else {
                terminal.write(ansi.cursorUp + ansi.moveToColumn(terminal.cols) + ansi.deleteOnCursor);
                cursorPos = this.terminal.cols - 1;
            }
        }
        this.cursorRow = 0;
    }

    async handleData(e) {
        const { terminal, bash } = this;

        switch (e) {
            case '\r':
                const result = await bash.execute(this.commandBuffer);
                terminal.write(result ? '\r\n' + result : '');
                terminal.write(`\r\n${bash.getPrompt()}`);
                this.commandBuffer = '';
                this.cursorRow = 0;
                break;

            case ansi.backspace:
                if (this.commandBuffer.length > 0 && terminal.buffer.active.cursorX != 0) {
                    this.commandBuffer = this.commandBuffer.slice(0, -1);
                    terminal.write(ansi.deleteToLeft);
                } else if (terminal.buffer.active.cursorX == 0) {
                    this.commandBuffer = this.commandBuffer.slice(0, -1);
                    terminal.write(ansi.cursorUp + ansi.moveToColumn(terminal.cols) + ansi.deleteOnCursor);
                    this.cursorRow--;
                }
                break;

            case '\t':
                const completion = bash.tabComplete(this.commandBuffer);
                if (completion) {
                    this.clearInput();
                    this.commandBuffer = completion;
                    terminal.write(this.commandBuffer);
                }
                break;

            case ansi.cursorUp:
                const upCommand = bash.historyUp();
                if (upCommand) {
                    this.clearInput();
                    this.commandBuffer = upCommand;
                    terminal.write(this.commandBuffer);
                }
                break;

            case ansi.cursorDown:
                const downCommand = bash.historyDown();
                if (downCommand) {
                    this.clearInput();
                    this.commandBuffer = downCommand;
                    terminal.write(this.commandBuffer);
                }
                break;

            case ansi.cursorBackward:
                // TODO: fix: include prompt length
                if (this.commandBuffer.length > 0) {
                    if (terminal.buffer.active.cursorX === 0 && this.cursorRow > 0) {
                        this.cursorRow--;
                        terminal.write(ansi.cursorUp + ansi.moveToColumn(terminal.cols));
                    } else {
                        terminal.write(ansi.cursorBackward);
                    }
                }
                break;

            case ansi.cursorForward:
                // TODO: fix: include prompt length
                if (this.commandBuffer.length > terminal.buffer.active.cursorX + terminal.cols * this.cursorRow) {
                    if (terminal.buffer.active.cursorX === terminal.cols - 1) {
                        this.cursorRow++;
                        terminal.write(ansi.cursorDown + ansi.moveToBeginning);
                    } else {
                        terminal.write(ansi.cursorForward);
                    }
                }
                break;

            default:
                if (terminal.buffer.active.cursorX === terminal.cols) {
                    this.cursorRow += 1;
                    terminal.write(ansi.cursorDown + ansi.moveToBeginning);
                }
                this.commandBuffer += e;
                terminal.write(e);
        }
    }

    start() {
        this.terminal.write(ascii.welcome);
        this.terminal.write(this.bash.getPrompt());
        this.terminal.onData(e => this.handleData(e));
        this.terminal.focus();
    }
}
