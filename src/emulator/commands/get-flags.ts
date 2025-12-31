type FlagType = 'regular' | 'argument';

export const getFlags = (
    args: string[],
    flags: Record<string, FlagType>
): { positionalArgs: string[]; flagMap: Map<string, string[]> } => {
    const flagMap = new Map<string, string[]>();
    const positionalArgs: string[] = [];

    const handleLongFlag = (arg: string, index: number): number => {
        let [flag, value]: [string, string | undefined] = arg.split('=') as [string, string | undefined];

        if (!flags[flag]) {
            throw new Error(`unrecognized option ${flag}`);
        }
        if (flags[flag] === 'argument' && !value) {
            value = args.length > index + 1 ? args[index + 1] : undefined;
            index++;
            if (!value) throw new Error(`option requires an argument -- '${flag}'`);
        } else if (flags[flag] === 'regular' && value) {
            throw new Error(`option '${flag}' doesn't allow an argument`);
        }

        if (flags[flag] === 'argument') {
            if (!flagMap.has(flag)) {
                flagMap.set(flag, []);
            }
            const existingValue = flagMap.get(flag);
            if (existingValue && value !== undefined) {
                existingValue.push(value);
            }
        } else {
            flagMap.set(flag, []);
        }
        return index;
    };

    const handleShortFlag = (arg: string, index: number): number => {
        let remainder = arg;

        while (remainder) {
            const flag = Object.keys(flags).find((f) => remainder.startsWith(f));
            if (!flag) {
                throw new Error(`unrecognized option -- '${remainder.slice(1, 2)}'`);
            }
            remainder = remainder.slice(flag.length);

            if (flags[flag] === 'argument') {
                let optArg: string | undefined = remainder;
                if (!remainder) {
                    optArg = args.length > index + 1 ? args[index + 1] : undefined;
                    index++;
                }
                if (!optArg) {
                    throw new Error(`option requires an argument -- '${flag.slice(1)}'`);
                }
                if (!flagMap.has(flag)) {
                    flagMap.set(flag, []);
                }
                const existingValue = flagMap.get(flag);
                if (existingValue) {
                    existingValue.push(optArg);
                }
                break;
            } else {
                remainder = remainder ? '-' + remainder : '';
                flagMap.delete(flag);
                flagMap.set(flag, []);
            }
        }
        return index;
    };

    for (let i = 0; i < args.length; i++) {
        let arg = args[i];

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
