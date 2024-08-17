

const processQuotes = (str) => {
    if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
        return str.slice(1, -1);
    }
    return str.replace(/\\(?!\\)/g, '');
};


export const parseArgs = (args, flags) => {
    const flagMap = new Map();
    const positionalArgs = [];

    const handleLongFlag = (arg, index) => {
        let [flag, value] = arg.split('=');

        if (!flags[flag]) {
            throw new Error(`unrecognized option ${flag}`);
        }
        if (flags[flag] === 'argument' && !value) {
            value = args.length > index + 1 ? args[index + 1] : null;
            index++;
            if (!value) throw new Error(`option requires an argument -- '${flag}'`);
        }
        else if (flags[flag] === 'regular' && value) {
            throw new Error(`option '${flag}' doesn't allow an argument`);
        }

        if (flags[flag] === 'argument') {
            if (!flagMap.has(flag)) {
                flagMap.set(flag, []);
            }
            flagMap.get(flag).push(value);
        } else {
            flagMap.set(flag, true);
        }
        return index;
    };

    const handleShortFlag = (arg, index) => {
        let remainder = arg;

        while (remainder) {
            const flag = Object.keys(flags).find(f => remainder.startsWith(f));
            if (!flag) {
                throw new Error(`unrecognized option -- '${remainder.slice(1, 2)}'`);
            }
            remainder = remainder.slice(flag.length);

            if (flags[flag] === 'argument') {
                let optArg = remainder;
                if (!remainder) {
                    optArg = args.length > index + 1 ? args[index + 1] : null;
                    index++;
                }
                if (!optArg) {
                    throw new Error(`option requires an argument -- '${flag.slice(1)}'`);
                }
                if (!flagMap.has(flag)) {
                    flagMap.set(flag, []);
                }
                flagMap.get(flag).push(optArg);
                break;
            } else {
                remainder = remainder ? '-' + remainder : null;
                flagMap.delete(flag);
                flagMap.set(flag, true);
            }
        }
        return index;
    };

    const processedArgs = args.map(e => processQuotes(e));

    for (let i = 0; i < processedArgs.length; i++) {
        let arg = processedArgs[i];

        if (arg.startsWith('--') && arg.length > 2) {
            i = handleLongFlag(arg, i);
        } else if (arg.startsWith('-') && !arg.startsWith('--') && arg.length > 1) {
            i = handleShortFlag(arg, i);
        } else {
            positionalArgs.push(arg);
        }
    }
    return { positionalArgs, flagMap };
};
