import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { BashEmulator } from './emulator/bash.js';
import { colorize, ascii, ansi, closestLeftBoundary, closestRightBoundary, deleteWordToLeft } from './utils.js';


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

        this.bash = new BashEmulator(() => this.terminal.reset(), colorize, this.terminal.cols);
        this.commandBuffer = '';
        this.promptLen = this.bash.getPrompt(false).length;
        this.cursorPos = 0;
        this.#setupCopyPaste();

        window.addEventListener('resize', () => {
            this.fitAddon.fit();
            this.bash.terminalCols = this.terminal.cols;
        });
    }

    #setupCopyPaste() {
        const handleC = () => {
            this.terminal.write('^C' + '\r\n' + this.bash.getPrompt());
            this.commandBuffer = '';
            this.cursorPos = 0;
        }
        const handleV = () => {
            const newBuffer =
                this.commandBuffer.slice(0, this.cursorPos)
                + '^V'
                + this.commandBuffer.slice(this.cursorPos);
            this.rewriteBuffer(newBuffer, this.cursorPos + 2);
        }

        this.terminal.attachCustomKeyEventHandler(ev => {
            if (ev.type === 'keydown' && (ev.code === 'KeyC' || ev.code === 'KeyV') && ev.ctrlKey && !ev.shiftKey) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.code === 'KeyC' ? handleC() : handleV();
                return false;
            }
            return true;
        });
    }

    #calculateTotalRows(bufferLength) {
        return Math.floor((this.promptLen + bufferLength + 1) / this.terminal.cols);
    }

    #calculateCurrentRow(cursorPos) {
        return Math.floor((this.promptLen + cursorPos + 2) / this.terminal.cols);
    }

    #calculateRowDifference(oldBufferLength, newCursorPos) {
        const totalRows = this.#calculateTotalRows(oldBufferLength);
        const currentRow = this.#calculateCurrentRow(newCursorPos);
        return totalRows - currentRow;
    }

    #moveCursor(buffer, newPos) {
        let out = '';
        const rowDifference = this.#calculateRowDifference(buffer.length, newPos);
        out += rowDifference > 0 ? ansi.cursorUp.repeat(rowDifference) : ansi.cursorDown.repeat(-rowDifference);

        const columnPos = (this.promptLen + 2 + newPos) % this.terminal.cols;
        out += ansi.moveToColumn(columnPos + 1);
        return out;
    }

    rewriteBuffer(newBuffer = "", newCursorPos = null) {
        const rowDifference = this.#calculateRowDifference(this.commandBuffer.length, this.cursorPos);
        const moveToLastRow = rowDifference > 0 ? ansi.cursorDown.repeat(rowDifference) : ansi.cursorUp.repeat(-rowDifference);

        this.terminal.write(
            moveToLastRow
            + (ansi.deleteLine + ansi.cursorUp).repeat(this.#calculateTotalRows(this.commandBuffer.length) + 1)
            + ('\r\n' + this.bash.getPrompt() + newBuffer)
            + (newCursorPos !== null ? this.#moveCursor(newBuffer, newCursorPos) : '')
        );

        this.cursorPos = newCursorPos ?? newBuffer.length;
        this.commandBuffer = newBuffer;
    }

    #handleAltArrow(key) {
        if (key === 'D') {
            const newPos = closestLeftBoundary(this.commandBuffer, this.cursorPos);
            this.rewriteBuffer(this.commandBuffer, newPos);
        } else if (key === 'C') {
            const newPos = closestRightBoundary(this.commandBuffer, this.cursorPos);
            this.rewriteBuffer(this.commandBuffer, newPos);
        }
    }

    handleAlt(e) {
        if (e === ansi.altBackspace) {
            const { newBuffer, newPos } = deleteWordToLeft(this.commandBuffer, this.cursorPos);
            this.rewriteBuffer(newBuffer, newPos);
            return;
        }
        this.#handleAltArrow(e.charAt(5));
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
                // TODO: 
                // Add completion with cursor position accounted for
                // Add displaying available completions when completions.length > 1
                const { completions, completedCommand } = bash.getTabCompletions(this.commandBuffer);
                if (completions.length === 1) {
                    this.rewriteBuffer(completedCommand);
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
                    this.rewriteBuffer(downCommand)
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
                if (e.startsWith('\x1b')) {
                    this.handleAlt(e);
                    return;
                }
                // TODO: handle special characters on paste
                e = e.replace(/(\r\n|\n|\r)/gm, "");
                const newBuffer = this.commandBuffer.slice(0, this.cursorPos) + e + this.commandBuffer.slice(this.cursorPos);
                this.rewriteBuffer(newBuffer, this.cursorPos + e.length);
        }
    }

    start() {
        this.terminal.write(ascii.welcome);
        this.terminal.write(this.bash.getPrompt());
        this.terminal.onData(e => this.handleData(e));
        this.terminal.focus();
    }
}
