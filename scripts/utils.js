import { getWorkingDirectory, getHomeDirectory } from './fileSystem.js';

const green = '\x1b[32m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';

const userAtHost = `${green}wizard@dungeon${reset}`;
const homeDirectory = getHomeDirectory();


export const printPrompt = (terminal) => {
    const currentDirectory = getWorkingDirectory();
    const displayDirectory = currentDirectory.replace(homeDirectory, '~');
    const prompt = `${userAtHost}:${blue}${displayDirectory}${reset}$ `;
    terminal.write(`\r\n${prompt}`);
};

export const printToTerminal = (terminal, text) => {
    terminal.write(`\r\n${text}`);
};
