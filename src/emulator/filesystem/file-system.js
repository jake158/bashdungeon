import { ROOT } from './levels.js';
import { Dir, File } from './items.js';
import { octalToPerms, permsToOctal, parseChmodString } from './file-system-utils.js';


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

    #applyUmask(permissions) {
        const permOctal = permsToOctal(permissions);
        const result = permOctal - this.#umask;
        return octalToPerms(result.toString().padStart(3, '0'), permissions[0] === 'd');
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
            ? new File(item.name, { content: item.content, permissions: item.permissions, username: item.username, groupname: item.groupname })
            : new Dir(item.name, { permissions: item.permissions, username: item.username, groupname: item.groupname }, item.contents.map(copyItem));

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
        if (item.permissions[2] != 'w' && !force) {
            let notice = 'Attention: Real Bash prompts you when removing write protected files.\n';
            notice += 'Currently, this emulator does not support prompting.\nTo remove the file, use the flag: `-f` (force).';
            throw new Error(`${trace}${item.name} is write protected\n${notice}`)
        }
        let output = ``;

        if (item.type === 'directory') {
            while (item.contents.length > 0) {
                const child = item.contents.pop();
                output += this.#rmRecurse(child, force, `${trace + item.name}/`);
            }
        }
        item.parent.removeItemByName(item.name, force);
        output += `\nremoved ${item.type === 'directory' ? 'directory ' : ''}'${trace}${item.name}'`;
        return output;
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
                    const newDir = new Dir(dirName, { permissions: this.#applyUmask('drwxrwxrwx') });
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

            const newFile = new File(fileName, { content: '', permissions: this.#applyUmask('-rwxrwxrwx') });
            parentDir.addItem(newFile);
        },
        'setting times of'
    );
}
