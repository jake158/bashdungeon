import { manEntries } from './man-entries.js';


export class Man {
    constructor(commandDefinitions, colorize = (text) => text) {
        this.definitions = commandDefinitions;
        this.colorize = colorize;
        this.checkForMissingOptions();
    }

    checkForMissingOptions() {
        for (const commandName of Object.keys(this.definitions)) {
            const command = this.definitions[commandName];
            const manualEntry = manEntries[commandName];

            if (!manualEntry) {
                console.warn(`BashDungeon: No manual entry found for '${commandName}'.`);
                continue;
            }
            const [_, settings = {}] = command;

            if (settings.flags) {
                for (const flag of Object.keys(settings.flags)) {
                    if (!(flag in manualEntry.OPTIONS)) {
                        console.warn(`BashDungeon: Option '${flag}' is specified in settings but missing in manEntries.js for '${commandName}'.`);
                    }
                }
            }
        }
    }

    #getEntryData(commandName) {
        const command = this.definitions[commandName];
        const manualEntry = manEntries[commandName];

        if (!command || !manualEntry) {
            throw new Error(`No manual entry for ${commandName}`);
        }
        return manualEntry;
    }

    getManEntry(commandName) {
        const { SUMMARY, SYNOPSIS, DESCRIPTION, OPTIONS } = this.#getEntryData(commandName);

        const optionsText = OPTIONS && Object.keys(OPTIONS).length > 0
            ? Object.entries(OPTIONS).map(([flag, description]) => `${this.colorize(flag, 'bold')}:\n        ${description}`).join('\n    ')
            : 'None implemented.';

        return `
${this.colorize('[mini-man]', 'yellow')}
${this.colorize('SUMMARY', 'bold')}
    ${commandName} - ${SUMMARY}

${this.colorize('SYNOPSIS', 'bold')}
    ${SYNOPSIS.split('\n').map(s => `${this.colorize(commandName, 'bold')} ${s}`).join('\n    ')}

${this.colorize('DESCRIPTION', 'bold')}
    ${DESCRIPTION.split('\n').join('\n    ')}

${this.colorize('OPTIONS', 'bold')}
    ${optionsText}
        `;
    }

    getHelpEntry(commandName) {
        const { SUMMARY, SYNOPSIS, DESCRIPTION, OPTIONS } = this.#getEntryData(commandName);
        return SYNOPSIS.split('\n').map(s => `${this.colorize(commandName, 'bold')} ${s}`)[0] + '\n   ' + SUMMARY;
    }
}