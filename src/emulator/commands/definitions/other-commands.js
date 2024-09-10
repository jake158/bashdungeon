

export const OTHER_COMMANDS = {
    'env': [
        function () {
            return Object.entries(this.env).map(([key, value]) => `${key}=${value}`).join('\n');
        }
    ],

    'man': [
        function (stdin, arg) {
            if (!arg) return "What manual page do you want?\nFor example, try 'man cd'";
            return this.man.getManEntry(arg);
        },
        {
            callForEachArg: true,
        }
    ],

    'help': [
        function () {
            return Object.keys(this.commandDefinitions).map(c => {
                try {
                    return this.man.getHelpEntry(c);
                } catch {
                    return null
                }
            })
                .filter(h => h !== null)
                .join('\n')
                .trimEnd();
        }
    ],

    'base64': [
        function (stdin, args, flagMap) {
            if (args.length > 1) { throw new Error(`extra operand ${args[1]}`); }
            const decode = flagMap.has('-d') || flagMap.has('--decode');

            const base64Encode = (input) => {
                return btoa(input);
            };
            const base64Decode = (input) => {
                try {
                    return atob(input);
                } catch (error) {
                    throw new Error('invalid input');
                }
            };
            const inputContent = args[0] && args[0] !== '-'
                ? this.fileSystem.getFileContent(args[0])
                : stdin;

            if (!inputContent) {
                throw new Error('no input provided');
            }
            const output = decode ? base64Decode(inputContent.trim()) : base64Encode(inputContent);
            return output;
        },

        {
            flags: {
                '-d': 'regular',
                '--decode': 'regular'
            },
        }
    ]
}