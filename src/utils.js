

export const ansi = {
    backspace: '\u007F',
    altBackspace: '\x1b\x7f',
    cursorUp: '\x1b[A',
    cursorDown: '\x1b[B',
    cursorForward: '\x1b[C',
    cursorBackward: '\x1b[D',
    moveToBeginning: '\x1b[1G',
    deleteToLeft: '\x1b[D \x1b[D',
    deleteOnCursor: ' \b\x1b[C',
    deleteLine: '\x1b[2K',
    moveToColumn: (col) => `\x1b[${col}G`,
};

const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
}

export function colorize(text, ...colorArgs) {
    const colorCodes = colorArgs.map(color => colors[color] || '').join('');
    return `${colorCodes}${text}${colors.reset}`;
}


export function closestLeftBoundary(input, offset) {
    const inputSlice = input.slice(0, offset);
    const words = inputSlice.match(/\b\w+\b/g) || [];
    return words.length > 0 ? inputSlice.lastIndexOf(words[words.length - 1]) : 0;
}

export function closestRightBoundary(input, offset) {
    const inputSlice = input.slice(offset);
    const words = inputSlice.match(/\b\w+\b/g) || [];
    return words.length > 0 ? offset + inputSlice.indexOf(words[0]) + words[0].length : input.length;
}

export function deleteWordToLeft(input, cursorPos) {
    const boundaryPos = closestLeftBoundary(input, cursorPos);
    return {
        newBuffer: input.slice(0, boundaryPos) + input.slice(cursorPos),
        newPos: boundaryPos
    };
}


export const ascii = {
    welcome: `
Welcome to the

     ▄▄▄▄·  ▄▄▄· .▄▄ ·  ▄ .▄    ·▄▄▄▄  ▄• ▄▌ ▐ ▄  ▄▄ • ▄▄▄ .       ▐ ▄ 
     ▐█ ▀█▪▐█ ▀█ ▐█ ▀. ██▪▐█    ██▪ ██ █▪██▌•█▌▐█▐█ ▀ ▪▀▄.▀·▪     •█▌▐█
     ▐█▀▀█▄▄█▀▀█ ▄▀▀▀█▄██▀▐█    ▐█· ▐█▌█▌▐█▌▐█▐▐▌▄█ ▀█▄▐▀▀▪▄ ▄█▀▄ ▐█▐▐▌
     ██▄▪▐█▐█ ▪▐▌▐█▄▪▐███▌▐▀    ██. ██ ▐█▄█▌██▐█▌▐█▄▪▐█▐█▄▄▌▐█▌.▐▌██▐█▌
     ·▀▀▀▀  ▀  ▀  ▀▀▀▀ ▀▀▀ ·    ▀▀▀▀▀•  ▀▀▀ ▀▀ █▪·▀▀▀▀  ▀▀▀  ▀█▄▀▪▀▀ █▪

`,
};
