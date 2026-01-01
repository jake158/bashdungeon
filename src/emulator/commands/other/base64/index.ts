import { Command, type CommandInfo } from '../../command';

export class Base64Command extends Command<string[]> {
    static override readonly commandName = 'base64';
    static override readonly settings = {
        flags: {
            '-d': 'regular' as const,
            '--decode': 'regular' as const,
        },
    };

    override execute(stdin: string, args: string[], flagMap: Map<string, string[]>, _options: CommandInfo): string {
        if (args.length > 1) {
            throw new Error(`extra operand ${args[1]}`);
        }
        const decode = flagMap.has('-d') || flagMap.has('--decode');

        const base64Encode = (input: string): string => {
            return btoa(input);
        };
        const base64Decode = (input: string): string => {
            try {
                return atob(input);
            } catch {
                throw new Error('invalid input');
            }
        };
        const inputContent = args[0] && args[0] !== '-' ? this.fileSystem.getFileContent(args[0]) : stdin;

        if (!inputContent) {
            throw new Error('no input provided');
        }
        const output = decode ? base64Decode(inputContent.trim()) : base64Encode(inputContent);
        return output;
    }
}
