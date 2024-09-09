

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
}