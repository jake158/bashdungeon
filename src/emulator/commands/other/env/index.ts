import { Command, type CommandInfo } from '../../command';

export class EnvCommand extends Command {
    static override readonly commandName = 'env';
    static override readonly settings = {};

    override execute(_stdin: string, _args: unknown, _flagMap: Map<string, string[]>, _options: CommandInfo): string {
        return Object.entries(this.env)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
    }
}
