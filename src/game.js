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
        this.promptLen = this.bash.getPrompt(false).length;
        this.cursorPos = 0;
    }

    rewriteBuffer(newBuffer = "", newCursorPos = null) {
        const newPos = newCursorPos ?? newBuffer.length;
        const totalRows = Math.floor((this.promptLen + this.commandBuffer.length + 2) / this.terminal.cols);
        const currentRow = Math.floor((this.promptLen + this.cursorPos + 1) / this.terminal.cols);

        this.terminal.write(ansi.cursorDown.repeat(totalRows - currentRow));
        this.terminal.write((ansi.deleteLine + ansi.cursorUp).repeat(totalRows + 1));
        this.terminal.write('\r\n' + this.bash.getPrompt() + newBuffer);

        // BUG: Backspace when line is wrapping causes weird behavior
        if (newCursorPos !== null) {
            const newRow = Math.floor((this.promptLen + newPos + 1) / this.terminal.cols);
            const rowsToMoveUp = totalRows - newRow;
            if (rowsToMoveUp > 0) {
                this.terminal.write(ansi.cursorUp.repeat(rowsToMoveUp));
            }
            const columnPos = (this.promptLen + 2 + newPos) % this.terminal.cols;
            this.terminal.write(ansi.moveToColumn(columnPos + 1));
        }
        this.cursorPos = newPos;
        this.commandBuffer = newBuffer;
    }

    async handleData(e) {
        const { terminal, bash } = this;

        switch (e) {
            case '\r':
                const result = await bash.execute(this.commandBuffer);
                terminal.write(result ? '\r\n' + result : '');
                terminal.write(`\r\n` + bash.getPrompt());

                this.commandBuffer = '';
                this.promptLen = bash.getPrompt(false).length;
                this.cursorPos = 0;
                break;

            case ansi.backspace:
                if (this.cursorPos > 0) {
                    const newBuffer = this.commandBuffer.slice(0, this.cursorPos - 1) + this.commandBuffer.slice(this.cursorPos);
                    this.rewriteBuffer(newBuffer, this.cursorPos - 1);
                }
                break;

            case '\t':
                const completion = bash.tabComplete(this.commandBuffer);
                if (completion) {
                    this.rewriteBuffer(completion);
                }
                break;

            case ansi.cursorUp:
                const upCommand = bash.historyUp();
                if (upCommand) {
                    this.rewriteBuffer(upCommand);
                }
                break;

            case ansi.cursorDown:
                const downCommand = bash.historyDown();
                if (downCommand) {
                    this.rewriteBuffer(downCommand);
                }
                break;

            case ansi.cursorBackward:
                if (this.cursorPos === 0) { return; }

                if (terminal.buffer.active.cursorX === 0) {
                    terminal.write(ansi.cursorUp + ansi.moveToColumn(terminal.cols));
                } else {
                    terminal.write(ansi.cursorBackward);
                }
                this.cursorPos--;
                break;

            case ansi.cursorForward:
                if (this.cursorPos === this.commandBuffer.length) { return; }

                if (terminal.buffer.active.cursorX === terminal.cols - 1) {
                    terminal.write(ansi.cursorDown + ansi.moveToBeginning);
                } else {
                    terminal.write(ansi.cursorForward);
                }
                this.cursorPos++;
                break;

            default:
                const newBuffer = this.commandBuffer.slice(0, this.cursorPos) + e + this.commandBuffer.slice(this.cursorPos);
                this.rewriteBuffer(newBuffer, this.cursorPos + 1);
        }
    }

    start() {
        this.terminal.write(ascii.welcome);
        this.terminal.write(this.bash.getPrompt());
        this.terminal.onData(e => this.handleData(e));
        this.terminal.focus();
    }
}
