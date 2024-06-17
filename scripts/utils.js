import { getWorkingDirectory } from './fileSystem.js';


export const printToTerminal = (terminal, text) => {
    terminal.write(`\r\n${text}`);
};

export const printPrompt = (terminal) => {
    let currentDirectory = getWorkingDirectory().replace('/home/wizard', '~');
    terminal.write(`\r\nwizard@dungeon:${currentDirectory}$ `);
};
