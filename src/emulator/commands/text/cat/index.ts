import { Command, type CommandInfo } from '../../command';

export class CatCommand extends Command<string | null> {
    static override readonly commandName = 'cat';
    static override readonly settings = {
        callForEachArg: true,
    };

    override execute(stdin: string, arg: string | null, _flagMap: Map<string, string[]>, info: CommandInfo): string {
        if (!arg) {
            return stdin;
        }
        let output = this.fileSystem.getFileContent(arg);
        output += info.multipleArgsMode && output ? '\n' : '';
        return output;
    }
}
