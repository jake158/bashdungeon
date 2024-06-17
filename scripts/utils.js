import { getWorkingDirectory, getHomeDirectory } from './fileSystem.js';

const green = '\x1b[32m';
const blue = '\x1b[34m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

const userAtHost = `${green}wizard@dungeon${reset}`;
const homeDirectory = getHomeDirectory();


export const printPrompt = (terminal) => {
    const currentDirectory = getWorkingDirectory();
    const displayDirectory = currentDirectory.replace(homeDirectory, '~');
    const prompt = `${bold}${userAtHost}:${bold}${blue}${displayDirectory}${reset}$ `;
    terminal.write(`\r\n${prompt}`);
};

export const print = (terminal, text, printBold = false, addNewLine = true) => {
    const formattedText = printBold ? `${bold}${text}${reset}` : text;
    if (addNewLine) {
        terminal.write(`\r\n${formattedText}`);
    } else {
        terminal.write(`${formattedText}`);
    }
};
