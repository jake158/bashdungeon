import { getWorkingDirectory } from './fileSystem.js';

const green = '\x1b[32m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';

const userAtHost = `${green}wizard@dungeon${reset}`;


export const printPrompt = (terminal) => {
    const currentDirectory = getWorkingDirectory().replace('/home/wizard', '~');
    const prompt = `${userAtHost}:${blue}${currentDirectory}${reset}$ `;
    terminal.write(`\r\n${prompt}`);
};

export const printToTerminal = (terminal, text) => {
    terminal.write(`\r\n${text}`);
};
