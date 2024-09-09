

export const TEXT_COMMANDS = {
    'echo': [
        function (stdin, arg, flagMap) {
            const processEscapeSequences = (input) => {
                return input.replace(/\\n/g, '\n')
                    .replace(/\\t/g, '\t')
                    .replace(/\\r/g, '\r')
                    .replace(/\\f/g, '\f')
                    .replace(/\\b/g, '\b')
                    .replace(/\\v/g, '\v')
                    .replace(/\\\\/g, '\\');
            };
            let processEscapes = false;

            for (const [flag, _] of flagMap.entries()) {
                switch (flag) {
                    case '-e':
                        processEscapes = true;
                        break;
                    case '-E':
                        processEscapes = false;
                }
            }

            const str = arg ? arg : ' ';
            return processEscapes ? processEscapeSequences(str) + ' ' : str + ' ';
        },

        {
            flags: {
                '-e': 'regular',
                '-E': 'regular',
            },
            callForEachArg: true
        }
    ],

    'cat': [
        function (stdin, arg, flagMap, info) {
            if (!arg) {
                return stdin;
            }
            let output = this.fileSystem.getFileContent(arg);
            output += info.multipleArgsMode && output ? '\n' : '';
            return output;
        },

        {
            callForEachArg: true
        }
    ],

    'grep': [
        function (stdin, [file, pattern], flagMap, info) {
            let text = stdin;
            const options = {
                ignoreCase: flagMap.has('-i'),
                lineNumbers: flagMap.has('-n'),
            };

            if (file && file !== '-') {
                text = this.fileSystem.getFileContent(file);
            }

            const regex = new RegExp(pattern, 'g' + (options.ignoreCase ? 'i' : ''));
            const lines = text.split('\n');
            const results = [];

            lines.forEach((line, index) => {
                if (regex.test(line)) {
                    let outputLine = line.replace(regex, (match) => this.colorize(match, 'bold', 'red'));
                    if (options.lineNumbers) {
                        outputLine = `${this.colorize(index + 1, 'green')}${this.colorize(':', 'cyan')}${outputLine}`;
                    }
                    if (info.multipleArgsMode) {
                        outputLine = `${this.colorize(file, 'magenta')}${this.colorize(':', 'cyan')}${outputLine}`;
                    }
                    results.push(outputLine);
                }
            });
            return results.join('\n') + (info.multipleArgsMode ? '\n' : '');
        },

        {
            flags: {
                '-i': 'regular', // Case insensitive search
                '-n': 'regular', // Show line numbers
            },
            callForEachArg: true,
            destinationArgLocations: [0]
        }
    ]
}
