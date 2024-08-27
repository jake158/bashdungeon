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
        window.addEventListener('resize', () => this.fitAddon.fit());

        this.bash = new BashEmulator(() => this.terminal.reset(), colorize);

        this.commandBuffer = '';
        this.promptLen = this.bash.getPrompt(false).length;
        this.cursorPos = 0;
    }

    #calculateTotalRows(bufferLength) {
        return Math.floor((this.promptLen + bufferLength + 2) / this.terminal.cols);
    }

    #calculateCurrentRow(cursorPos) {
        return Math.floor((this.promptLen + cursorPos + 1) / this.terminal.cols);
    }

    #moveCursorToBottom(totalRows, currentRow) {
        const rowsToMoveDown = totalRows - currentRow;
        if (rowsToMoveDown > 0) {
            this.terminal.write(ansi.cursorDown.repeat(rowsToMoveDown));
        }
    }

    #moveCursorToSavedPosition(newBuffer, newPos) {
        // TODO: Bug: when cursor is at col 0, it rewrites the prompt
        // This function is still buggy
        const totalNewRows = this.#calculateTotalRows(newBuffer.length - 1);
        const newRow = this.#calculateCurrentRow(newPos);

        const rowsToMoveUp = totalNewRows - newRow;
        if (rowsToMoveUp > 0) {
            this.terminal.write(ansi.cursorUp.repeat(rowsToMoveUp));
        }
        const columnPos = (this.promptLen + 2 + newPos) % this.terminal.cols;
        this.terminal.write(ansi.moveToColumn(columnPos === 0 ? this.terminal.cols : columnPos + 1));
    }

    rewriteBuffer(newBuffer = "", newCursorPos = null) {
        const totalRows = this.#calculateTotalRows(this.commandBuffer.length);
        const currentRow = this.#calculateCurrentRow(this.cursorPos);

        this.#moveCursorToBottom(totalRows, currentRow);
        this.terminal.write((ansi.deleteLine + ansi.cursorUp).repeat(totalRows + 1)
            + '\r\n' + this.bash.getPrompt() + newBuffer);

        const newPos = newCursorPos ?? newBuffer.length;
        if (newCursorPos !== null) {
            this.#moveCursorToSavedPosition(newBuffer, newPos);
        }
        this.cursorPos = newPos;
        this.commandBuffer = newBuffer;
    }

    #moveCursorToPosition(newPos) {
        const direction = newPos > this.cursorPos ? ansi.cursorForward : ansi.cursorBackward;
        const distance = Math.abs(newPos - this.cursorPos);
        this.terminal.write(direction.repeat(distance));
        this.cursorPos = newPos;
    }

    #handleAltArrow(key) {
        if (key === 'D') {
            const newPos = closestLeftBoundary(this.commandBuffer, this.cursorPos);
            this.#moveCursorToPosition(newPos);
        } else if (key === 'C') {
            const newPos = closestRightBoundary(this.commandBuffer, this.cursorPos);
            this.#moveCursorToPosition(newPos);
        }
    }

    #handleAlt(e) {
        if (e === ansi.altBackspace) {
            const { newBuffer, newPos } = deleteWordToLeft(this.commandBuffer, this.cursorPos);
            requestAnimationFrame(() => this.rewriteBuffer(newBuffer, newPos));
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
                    this.#handleAlt(e);
                    return;
                }
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
