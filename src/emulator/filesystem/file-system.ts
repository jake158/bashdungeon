import { applyUmask, parseChmodString } from './file-system-utils';
import { Dir, File, Item } from './items';
import { ROOT } from './levels';

interface LsOptions {
    all?: boolean;
    dir?: boolean;
}

interface MkdirOptions {
    parents?: boolean;
    verbose?: boolean;
}

interface RmOptions {
    force?: boolean;
}

interface TouchOptions {
    noCreate?: boolean;
}

interface LsItem {
    type: string;
    permissions: string;
    links: number;
    username: string;
    groupname: string;
    size: number;
    modified: Date;
    name: string;
}

export class FileSystem {
    #user: string;
    #homeDirectory: string;
    #currentDirectory: string;
    #previousDirectory: string;
    #umask: string;
    root: Dir;

    constructor() {
        this.#user = 'wizard';
        this.#homeDirectory = `/home/${this.#user}`;
        this.#currentDirectory = `${this.#homeDirectory}/Dungeon`;
        this.#previousDirectory = this.#currentDirectory;
        this.#umask = '0002';

        this.root = ROOT as Dir;
        this.root.parent = this.root;
    }

    #evaluatePath(path: string): string {
        path = path.replace('~', this.#homeDirectory);
        const stack = path.startsWith('/') ? [] : this.#currentDirectory.split('/').filter(Boolean);
        const parts = path.split('/');

        for (const part of parts) {
            if (part === '' || part === '.') {
                continue;
            } else if (part === '..') {
                if (stack.length > 0) {
                    stack.pop();
                }
            } else {
                stack.push(part);
            }
        }
        return '/' + stack.join('/');
    }

    #getItem(path: string): Item | null {
        const parts = path.split('/').filter(Boolean);
        let curr: Item | Dir = this.root;

        for (const part of parts) {
            if (curr.type !== 'directory') {
                return null;
            }
            const item = (curr as Dir).findItemByName(part);
            if (item) {
                curr = item;
            } else {
                return null;
            }
        }
        return curr as Item;
    }

    #chainErrors<T extends (...args: never[]) => unknown>(func: T, message: string | null = null): T {
        return ((...args: Parameters<T>) => {
            try {
                return func(...args);
            } catch (error) {
                const errMessage = error instanceof Error ? error.message : String(error);
                throw new Error(
                    `${message ? message + ' ' : ''}'${String(args[0]).replace('~', this.#homeDirectory)}': ${errMessage}`
                );
            }
        }) as T;
    }

    #handleItemMove(sourcePath: string, destPath: string, operation: 'copy' | 'move'): void {
        const sourceItem = this.#getItem(sourcePath);
        if (!sourceItem) {
            throw new Error('No such file or directory');
        }

        const getDestinationInfo = (destPath: string): { destDir: Item | null; destFileName: string } => {
            const sep = destPath.lastIndexOf('/');
            const destDirPath = sep === -1 ? this.#currentDirectory : destPath.substring(0, sep);
            const destFileName = sep === -1 ? destPath : destPath.substring(sep + 1);
            const destDir = this.#getItem(destDirPath);
            return { destDir, destFileName };
        };

        const itemAtPath = this.#getItem(destPath);
        const { destDir, destFileName } =
            itemAtPath && itemAtPath.type === 'directory'
                ? { destDir: itemAtPath, destFileName: sourceItem.name }
                : getDestinationInfo(destPath);

        if (!destDir || destDir.type !== 'directory') {
            throw new Error(`'${destPath}': No such file or directory`);
        }

        const copyItem = (item: Item): Item =>
            item.type === 'file'
                ? new File(item.name, (item as File).content, {
                      permissions: item.permissions,
                      username: item.username,
                      groupname: item.groupname,
                  })
                : new Dir(item.name, (item as Dir).contents.map(copyItem), {
                      permissions: item.permissions,
                      username: item.username,
                      groupname: item.groupname,
                  });

        // TODO: This makes cp -r fail when it encounters any unreadable file. Unreadable files should be skipped when copying.
        const newItem = operation === 'copy' ? copyItem(sourceItem) : sourceItem;

        newItem.name = destFileName;
        const sourceItemName = sourceItem.name;
        (destDir as Dir).removeItemByName(destFileName);
        (destDir as Dir).addItem(newItem);

        const sourceDirPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        const sourceDir = this.#getItem(sourceDirPath);
        if (operation === 'move' && !Object.is(sourceDir, destDir) && sourceDir && sourceDir.type === 'directory') {
            (sourceDir as Dir).removeItemByName(sourceItemName);
        }
    }

    #rmRecurse(item: Item, force: boolean, trace: string = ''): string {
        if (item.immutable) {
            throw new Error(`Permission denied: ${item.name} is immutable`);
        } else if (item.permissions[2] != 'w' && !force) {
            // TODO: Add prompting to remove write protected files
            throw new Error(`${trace}${item.name} is write protected`);
        }
        let output = ``;

        if (item.type === 'directory') {
            const dirItem = item as Dir;
            while (dirItem.contents.length > 0) {
                output += this.#rmRecurse(dirItem.contents[0], force, `${trace + item.name}/`);
            }
        }
        if (item.parent) {
            item.parent.removeItemByName(item.name, force);
        }
        output += `\nremoved ${item.type === 'directory' ? 'directory ' : ''}'${trace}${item.name}'`;
        return output;
    }

    #wildcardToRegex(pattern: string): RegExp {
        // TODO: Ensure this does not crash on bad pattern

        // Escape regex special characters except for * and ?
        let escapedPattern = pattern.replace(/[.+^$(){}|\\]/g, '\\$&');
        // Handle the negation character set [!...] by converting it to a regex equivalent
        escapedPattern = escapedPattern.replace(/\[!(.+?)\]/g, '[^$1]');
        // Replace * with .* to match any number of characters
        // Replace ? with . to match a single character
        escapedPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${escapedPattern}$`);
    }

    get user(): string {
        return this.#user;
    }

    get homeDirectory(): string {
        return this.#homeDirectory;
    }

    get currentDirectory(): string {
        return this.#currentDirectory;
    }

    get umask(): string {
        return this.#umask;
    }

    set umask(value: string) {
        if (!/(^[0-7]{3}$)|(^0{1}[0-7]{3}$)/.test(value)) {
            throw new Error('value must be of the format: 0?[0-7][0-7][0-7]');
        }
        this.#umask = value.padStart(4, '0');
    }

    getWildcardMatches(pattern: string): string[] {
        // TODO: Add { } handling
        const absolutePath = this.#evaluatePath(pattern);
        const sepIndex = absolutePath.lastIndexOf('/');
        const baseDirPath = sepIndex === -1 ? this.#currentDirectory : absolutePath.substring(0, sepIndex);
        const basePattern = sepIndex === -1 ? pattern : absolutePath.substring(sepIndex + 1);
        const isRelativePath = baseDirPath === this.#currentDirectory;

        const baseDir = this.#getItem(baseDirPath);
        if (!baseDir || baseDir.type !== 'directory') {
            throw new Error(`'${baseDirPath}': No such file or directory`);
        }
        const regex = this.#wildcardToRegex(basePattern);

        const matches = (baseDir as Dir).contents
            .filter((item) => regex.test(item.name) && (basePattern.startsWith('.') || !item.name.startsWith('.')))
            .map((item) => `${isRelativePath ? '' : baseDirPath + '/'}${item.name}`);

        return matches.sort((itemA, itemB) => {
            const a = itemA.toLowerCase();
            const b = itemB.toLowerCase();
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }

    getFilesStartingWith(string: string): string[] {
        const dir = this.#getItem(this.#currentDirectory);
        if (!dir || dir.type !== 'directory') {
            return [];
        }
        return (dir as Dir).contents
            .map((i) => (i.type === 'file' ? i.name : i.name + '/'))
            .filter((i) => i.startsWith(string));
    }

    isDirectory(path: string): boolean {
        const item = this.#getItem(this.#evaluatePath(path));
        if (!item) return false;
        return item.type === 'directory';
    }

    getFileContent = this.#chainErrors((path: string): string => {
        const item = this.#getItem(this.#evaluatePath(path));
        if (!item) {
            throw new Error('No such file or directory');
        } else if (item.type === 'directory') {
            throw new Error('Is a directory');
        }
        return (item as File).content;
    }, 'cannot access');

    ls = this.#chainErrors((path: string, options: LsOptions = {}): LsItem[] => {
        const absolutePath = this.#evaluatePath(path);
        const item = this.#getItem(absolutePath);
        if (!item) {
            throw new Error('No such file or directory');
        }

        const constructObject = (item: Item, name: string | false = false): LsItem => ({
            type: item.type,
            permissions: item.permissions,
            links: item.links,
            username: item.username,
            groupname: item.groupname,
            size: item.fileSize,
            modified: item.lastModified,
            name: name ? name : item.name,
        });

        if (options.dir || item.type === 'file') {
            return [constructObject(item, path === '.' ? '.' : false)];
        }

        const dirItem = item as Dir;
        const result = options.all
            ? [
                  constructObject(item, '.'),
                  constructObject(item.parent!, '..'),
                  ...dirItem.contents.map((i) => constructObject(i)),
              ]
            : dirItem.contents.filter((i) => !i.name.startsWith('.')).map((i) => constructObject(i));

        return result.sort((itemA, itemB) => {
            const a = itemA.name.toLowerCase();
            const b = itemB.name.toLowerCase();
            return a < b ? -1 : a > b ? 1 : 0;
        });
    }, 'cannot access');

    cd = this.#chainErrors((path: string): void => {
        const absolutePath = path === '-' ? this.#previousDirectory : this.#evaluatePath(path);
        const item = this.#getItem(absolutePath);

        if (!item) {
            throw new Error('No such file or directory');
        } else if (item.type != 'directory') {
            throw new Error('Not a directory');
        } else if (item.permissions[3] != 'x') {
            throw new Error('Permission denied');
        }

        this.#previousDirectory = this.#currentDirectory;
        this.#currentDirectory = absolutePath;
    });

    mkdir = this.#chainErrors((path: string, options: MkdirOptions): string => {
        const segments = this.#evaluatePath(path).split('/').filter(Boolean);
        let currentDir: Dir = this.root;
        let dirName: string;
        let output = '';

        for (let i = 0; i < segments.length; i++) {
            dirName = segments[i];
            const nextDir = currentDir.findItemByName(dirName);

            if (nextDir) {
                if (nextDir.type !== 'directory') throw new Error('Not a directory');
                currentDir = nextDir as Dir;
                continue;
            } else if (i === segments.length - 1 || options.parents) {
                const newDir = new Dir(dirName, [], { permissions: applyUmask('drwxrwxrwx', this.umask) });
                currentDir.addItem(newDir);
                output += options.verbose ? `mkdir: created directory '${dirName}'\n` : '';
                currentDir = newDir;
            } else {
                throw new Error('No such file or directory');
            }
        }
        return output.trim();
    }, 'cannot create directory');

    rmdir = this.#chainErrors((path: string): void => {
        const absolutePath = this.#evaluatePath(path);
        const directory = this.#getItem(absolutePath);

        if (!directory) {
            throw new Error('No such file or directory');
        } else if (directory.type != 'directory') {
            throw new Error('Not a directory');
        } else if (!(directory as Dir).isEmpty) {
            throw new Error('Directory not empty');
        }

        const parentDirectory = directory.parent;
        if (parentDirectory) {
            parentDirectory.removeItemByName(directory.name);
        }
    }, 'failed to remove');

    cp = this.#chainErrors((source: string, dest: string): void => {
        this.#handleItemMove(this.#evaluatePath(source), this.#evaluatePath(dest), 'copy');
    }, 'cannot copy');

    mv = this.#chainErrors((source: string, dest: string): void => {
        this.#handleItemMove(this.#evaluatePath(source), this.#evaluatePath(dest), 'move');
    }, 'cannot move');

    rm = this.#chainErrors((path: string, options: RmOptions): string => {
        const item = this.#getItem(this.#evaluatePath(path));
        if (!item) {
            throw new Error('No such file or directory');
        }
        return this.#rmRecurse(item, options.force === true).trim();
    }, 'cannot remove');

    chmod = this.#chainErrors((path: string, permString: string): void => {
        const item = this.#getItem(this.#evaluatePath(path));
        if (!item) {
            throw new Error('No such file or directory');
        }
        item.permissions = parseChmodString(permString, item.permissions);
    }, null);

    touch = this.#chainErrors((path: string, options: TouchOptions = {}): void => {
        const absPath = this.#evaluatePath(path);
        const item = this.#getItem(absPath);

        if (item) {
            item.updateLastModified();
            return;
        } else if (path.endsWith('/')) {
            throw new Error('No such file or directory');
        } else if (options.noCreate) {
            return;
        }
        const parentDirPath = absPath.substring(0, absPath.lastIndexOf('/'));
        const parentDir = this.#getItem(parentDirPath);

        if (!parentDir || parentDir.type !== 'directory') {
            throw new Error(`No such file or directory`);
        }
        const fileName = absPath.substring(absPath.lastIndexOf('/') + 1);

        const newFile = new File(fileName, '', { permissions: applyUmask('-rw-rw-rw-', this.umask) });
        (parentDir as Dir).addItem(newFile);
    }, null);
}
