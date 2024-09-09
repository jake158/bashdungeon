

export class Man {
    constructor(commandDefinitions, colorize = (text) => text) {
        this.definitions = commandDefinitions;
        this.colorize = colorize;
    }

    getEntry(commandName) {
        const command = this.definitions[commandName];
        if (!command) {
            throw new Error(`No manual entry for ${commandName}`);
        }
        const [func, settings] = command;

        return `
${this.colorize('[simplified man]', 'yellow')}
${this.colorize('NAME', 'bold')}
    ${commandName} - [implement]

${this.colorize('SYNOPSIS', 'bold')}
    [implement]

${this.colorize('DESCRIPTION', 'bold')}
    [implement]

${this.colorize('OPTIONS', 'bold')}
    ${settings.flags ? Object.keys(settings.flags).join('\n    ') : ''}
        `;
    }
}