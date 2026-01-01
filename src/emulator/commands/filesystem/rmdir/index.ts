import { Command, type CommandInfo } from '../../command';

export class RmdirCommand extends Command<string | null> {
    static override readonly commandName = 'rmdir';
    static override readonly settings = {
        callForEachArg: true,
    };

    override execute(
        _stdin: string,
        arg: string | null,
        _flagMap: Map<string, string[]>,
        _options: CommandInfo
    ): string {
        if (!arg) {
            throw new Error('missing operand');
        }
        this.fileSystem.rmdir(arg);
        return '';
    }
}
