import { ROOT } from './levels.js';
import { Dir, File } from './items.js';
import { applyUmask, parseChmodString } from './file-system-utils.js';


export class FileSystem {
    #homeDirectory;
    #currentDirectory;
    #previousDirectory;
    #umask;

    constructor() {
        this.#homeDirectory = '/home/wizard';
        this.#currentDirectory = `${this.#homeDirectory}/Dungeon`;
        this.#previousDirectory = this.#currentDirectory;
        this.#umask = '0002';

        this.root = ROOT;
        this.root.parent = this.root;
    }

    #evaluatePath(path) {
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

    #getItem(path) {
        const parts = path.split('/').filter(Boolean);
        let curr = this.root;

        for (const part of parts) {
            const item = curr.findItemByName(part);
            if (item) {
                curr = item;
            } else {
                return null;
            }
        }
        return curr;
    }

    #chainErrors(func, message = null) {
        return (...args) => {
            try {
                return func(...args);
            } catch (error) {
                throw new Error(`${message ? message + ' ' : ''}'${args[0].replace('~', this.#homeDirectory)}': ${error.message}`);
            }
        };
    }

    #handleItemMove(sourcePath, destPath, operation) {
        const sourceItem = this.#getItem(sourcePath);
        if (!sourceItem) { throw new Error('No such file or directory'); }

        const getDestinationInfo = (destPath) => {
            const sep = destPath.lastIndexOf('/');
            const destDirPath = sep === -1 ? this.#currentDirectory : destPath.substring(0, sep);
            const destFileName = sep === -1 ? destPath : destPath.substring(sep + 1);
            const destDir = this.#getItem(destDirPath);
            return { destDir, destFileName };
        };

        const itemAtPath = this.#getItem(destPath);
        const { destDir, destFileName } = itemAtPath && itemAtPath.type === 'directory'
            ? { destDir: itemAtPath, destFileName: sourceItem.name }
            : getDestinationInfo(destPath);

        if (!destDir) { throw new Error(`'${destPath}': No such file or directory`); }

        const copyItem = (item) => item.type === 'file'
            ? new File(item.name, item.content, { permissions: item.permissions, username: item.username, groupname: item.groupname })
            : new Dir(item.name, item.contents.map(copyItem), { permissions: item.permissions, username: item.username, groupname: item.groupname });

        // This makes cp -r fail when it encounters any unreadable file. Unreadable files should be skipped when copying.
        const newItem = (operation === 'copy') ? copyItem(sourceItem) : sourceItem;

        newItem.name = destFileName;
        const sourceItemName = sourceItem.name;
        destDir.removeItemByName(destFileName);
        destDir.addItem(newItem);

        const sourceDirPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
        const sourceDir = this.#getItem(sourceDirPath);
        if (operation === 'move' && !Object.is(sourceDir, destDir)) {
            sourceDir.removeItemByName(sourceItemName);
        }
    }

    #rmRecurse(item, force, trace = '') {
        if (item.immutable) {
            throw new Error(`Permission denied: ${item.name} is immutable`);
        } else if (item.permissions[2] != 'w' && !force) {
            // TODO: Add prompting to remove write protected files
            throw new Error(`${trace}${item.name} is write protected`);
        }
        let output = ``;

        if (item.type === 'directory') {
            while (item.contents.length > 0) {
                output += this.#rmRecurse(item.contents[0], force, `${trace + item.name}/`);
            }
        }
        item.parent.removeItemByName(item.name, force);
        output += `\nremoved ${item.type === 'directory' ? 'directory ' : ''}'${trace}${item.name}'`;
        return output;
    }

    #wildcardToRegex(pattern) {
        // Escape regex special characters except for * and ?
        let escapedPattern = pattern.replace(/[.+^$(){}|\\]/g, '\\$&');
        // Handle the negation character set [!...] by converting it to a regex equivalent
        escapedPattern = escapedPattern.replace(/\[!(.+?)\]/g, '[^$1]');
        // Replace * with .* to match any number of characters
        // Replace ? with . to match a single character
        escapedPattern = escapedPattern.replace(/\*/g, '.*').replace(/\?/g, '.');
        return new RegExp(`^${escapedPattern}$`);
    }


    get umask() {
        return this.#umask;
    }

    get homeDirectory() {
        return this.#homeDirectory;
    }

    get currentDirectory() {
        return this.#currentDirectory;
    }

    set umask(value) {
        if (!/(^[0-7]{3}$)|(^0{1}[0-7]{3}$)/.test(value)) {
            throw new Error('value must be of the format: 0?[0-7][0-7][0-7]');
        }
        this.#umask = value.padStart(4, '0');
    }

    matchFiles(pattern) {
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

        const matches = baseDir.contents
            .filter(item => regex.test(item.name) && (basePattern.startsWith('.') || !item.name.startsWith('.')))
            .map(item => `${isRelativePath ? '' : baseDirPath + '/'}${item.name}`);
        return matches.sort();
    }

    isDirectory(path) {
        const item = this.#getItem(this.#evaluatePath(path));
        if (!item) return false;
        return item.type === 'directory';
    }

    getFileContent = this.#chainErrors(
        (path) => {
            const item = this.#getItem(this.#evaluatePath(path));
            if (!item) {
                throw new Error('No such file or directory');
            } else if (item.type === 'directory') {
                throw new Error('Is a directory');
            }
            return item.content;
        },
        'cannot access'
    );

    ls = this.#chainErrors(
        (path, options) => {
            const absolutePath = this.#evaluatePath(path);
            const item = this.#getItem(absolutePath);
            if (!item) { throw new Error('No such file or directory'); }

            const constructObject = (item, name = false) => ({
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

            const result = options.all
                ? [constructObject(item, '.'), constructObject(item.parent, '..'), ...item.contents.map(i => constructObject(i))]
                : item.contents.filter(i => !i.name.startsWith('.')).map(i => constructObject(i));

            return result.sort((itemA, itemB) => {
                const a = itemA.name.toLowerCase();
                const b = itemB.name.toLowerCase();
                return (a < b) ? -1 : (a > b) ? 1 : 0;
            });
        },
        'cannot access'
    );

    cd = this.#chainErrors(
        (path) => {
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
        }
    );

    mkdir = this.#chainErrors(
        (path, options) => {
            const segments = this.#evaluatePath(path).split('/').filter(Boolean);
            let currentDir = this.root;
            let dirName;
            let output = '';

            for (let i = 0; i < segments.length; i++) {
                dirName = segments[i];
                const nextDir = currentDir.findItemByName(dirName);

                if (nextDir) {
                    if (nextDir.type !== 'directory') throw new Error('Not a directory');
                    currentDir = nextDir;
                    continue;
                } else if (i === segments.length - 1 || options.parents) {
                    const newDir = new Dir(dirName, [], { permissions: applyUmask('drwxrwxrwx', this.umask) });
                    currentDir.addItem(newDir);
                    output += (options.verbose ? `mkdir: created directory '${dirName}'\n` : '');
                    currentDir = newDir;
                } else {
                    throw new Error('No such file or directory');
                }
            }
            return output.trim();
        },
        'cannot create directory'
    );

    rmdir = this.#chainErrors(
        (path) => {
            const absolutePath = this.#evaluatePath(path);
            const directory = this.#getItem(absolutePath);

            if (!directory) {
                throw new Error('No such file or directory');
            } else if (directory.type != 'directory') {
                throw new Error('Not a directory');
            } else if (!directory.isEmpty) {
                throw new Error('Directory not empty');
            }

            const parentDirectory = directory.parent;
            parentDirectory.removeItemByName(directory.name);
        },
        'failed to remove'
    );

    cp = this.#chainErrors(
        (source, dest) => {
            this.#handleItemMove(this.#evaluatePath(source), this.#evaluatePath(dest), 'copy');
        },
        'cannot copy'
    );

    mv = this.#chainErrors(
        (source, dest) => {
            this.#handleItemMove(this.#evaluatePath(source), this.#evaluatePath(dest), 'move');
        },
        'cannot move'
    );

    rm = this.#chainErrors(
        (path, options) => {
            const item = this.#getItem(this.#evaluatePath(path));
            if (!item) { throw new Error('No such file or directory'); }
            return this.#rmRecurse(item, options.force === true).trim();
        },
        'cannot remove'
    );

    chmod = this.#chainErrors(
        (path, permString) => {
            const item = this.#getItem(this.#evaluatePath(path));
            if (!item) { throw new Error('No such file or directory'); }
            item.permissions = parseChmodString(permString, item.permissions);
        }
    );

    touch = this.#chainErrors(
        (path, options = {}) => {
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
            parentDir.addItem(newFile);
        },
        'setting times of'
    );
}
