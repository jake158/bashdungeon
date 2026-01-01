import { Command, type CommandContext, type CommandSettings } from './command';

// Type representing a command class constructor
export type CommandClass = {
    new (context: CommandContext): Command;
    commandName: string;
    settings: CommandSettings;
    getSortFunction?: (context: CommandContext) => (a: string, b: string) => number;
};

export class CommandRegistry {
    private commandClasses: Map<string, CommandClass> = new Map();

    constructor() {
        this.discoverCommands();
    }

    private discoverCommands(): void {
        // Use require.context to dynamically import all command index files
        // The regex matches: ./category/command-name/index.ts
        const commandModules = require.context('./', true, /^\.\/(filesystem|text|other)\/[^/]+\/index\.ts$/);

        commandModules.keys().forEach((modulePath) => {
            const module = commandModules(modulePath) as Record<string, unknown>;

            // Find the exported command class
            // Convention: Export should be named like PwdCommand, LsCommand, etc.
            const commandClass = Object.values(module).find(
                (exported) => typeof exported === 'function' && 'commandName' in exported && 'settings' in exported
            ) as CommandClass | undefined;

            if (commandClass) {
                const name = commandClass.commandName;
                if (this.commandClasses.has(name)) {
                    console.warn(`BashDungeon: Duplicate command '${name}' found. Skipping.`);
                } else {
                    this.commandClasses.set(name, commandClass);
                }
            } else {
                console.warn(`BashDungeon: No valid command class found in ${modulePath}`);
            }
        });

        console.log(`BashDungeon: Discovered ${this.commandClasses.size} commands`);
    }

    getCommandClass(name: string): CommandClass | undefined {
        return this.commandClasses.get(name);
    }

    getAllCommandNames(): string[] {
        return Array.from(this.commandClasses.keys());
    }

    getCommandDefinitions(): Map<string, [CommandClass, CommandSettings]> {
        const definitions = new Map<string, [CommandClass, CommandSettings]>();
        this.commandClasses.forEach((cmdClass, name) => {
            definitions.set(name, [cmdClass, cmdClass.settings]);
        });
        return definitions;
    }
}
