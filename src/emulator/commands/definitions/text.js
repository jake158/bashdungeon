

export class TextCommands {
    constructor(fileSystem, colorize) {
        this.fileSystem = fileSystem;
        this.colorize = colorize;
    }

    get() {
        return {
            'echo': [
                (stdin, arg, flagMap) => {
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
                    name: 'echo',
                    flags: {
                        '-e': 'regular',
                        '-E': 'regular',
                    },
                    callForEachArg: true
                }
            ],

            'cat': [
                (stdin, arg, flagMap, multipleArgsMode = false) => {
                    if (!arg) {
                        return stdin;
                    }
                    let output = this.fileSystem.getFileContent(arg);
                    output += multipleArgsMode && output ? '\n' : '';
                    return output;
                },

                {
                    name: 'cat',
                    callForEachArg: true
                }
            ],
        }
    }
}