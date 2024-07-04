

class Item {
    #type;
    #name;
    #permissions;
    #immutable;
    #parent;

    constructor(name, { type = null, permissions = '---------', immutable = false } = {}) {
        this.#type = type;
        this.#name = name;
        this.#permissions = permissions;
        this.#immutable = immutable;
        this.#parent = null;
    }

    checkPermissions(action) {
        const perms = {
            read: this.#permissions[1] === 'r',
            write: this.#permissions[2] === 'w',
            execute: this.#permissions[3] === 'x'
        };
        if (!perms[action]) {
            throw new Error('Permission denied');
        }
    }

    get type() {
        return this.#type;
    }

    get parent() {
        return this.#parent;
    }

    get name() {
        return this.#name;
    }

    get permissions() {
        return this.#permissions;
    }

    get immutable() {
        return this.#immutable;
    }

    set parent(parent) {
        this.#parent = parent;
    }

    set name(name) {
        if (this.#immutable) throw new Error('Permission denied');
        this.#parent.checkPermissions('write');
        this.#name = name;
    }

    set permissions(permissions) {
        if (this.#immutable) throw new Error('Permission denied');
        this.#permissions = permissions;
    }
}


class Dir extends Item {
    #contents;

    constructor(name, { permissions = 'drwxrwxr-x', immutable = false } = {}, contents = []) {
        super(name, { type: 'directory', permissions, immutable });
        this.#contents = contents;
        contents.forEach(item => item.parent = this);
    }

    get contents() {
        this.checkPermissions('read');
        return this.#contents;
    }

    get links() {
        let links = 2;
        this.#contents.forEach(item => {
            if (item.type === 'directory') {
                links += 1;
            }
        });
        return links;
    }

    get isEmpty() {
        return this.#contents.length === 0;
    }

    findItemByName(name) {
        this.checkPermissions('execute');
        return this.#contents.find(item => item.name === name);
    }

    removeItemByName(name, force = false) {
        if (!force) this.checkPermissions('write');
        const index = this.#contents.findIndex(item => item.name === name);
        if (index !== -1) {
            if (this.#contents[index].immutable) throw new Error('Permission denied');
            this.#contents.splice(index, 1);
            return true;
        } else {
            return false;
        }
    }

    addItem(item) {
        this.checkPermissions('write');
        this.#contents.push(item);
        item.parent = this;
    }
}


class File extends Item {
    #content;

    constructor(name, { content = '', permissions = '-rw-rw-r--', immutable = false } = {}) {
        super(name, { type: 'file', permissions, immutable });
        this.#content = content;
    }

    get content() {
        this.checkPermissions('read');
        return this.#content;
    }

    get links() {
        return 1;
    }

    set content(content) {
        if (this.immutable) throw new Error('Permission denied');
        this.checkPermissions('write');
        this.#content = content;
    }

    appendContent(content) {
        if (this.immutable) throw new Error('Permission denied');
        this.checkPermissions('write');
        this.#content += content;
    }
}


function permsToOctal(perms) {
    const permissionBits = { 'r': 4, 'w': 2, 'x': 1, '-': 0 };
    let octal = '';

    for (let i = 1; i < perms.length; i += 3) {
        let value = 0;
        value += permissionBits[perms[i]];
        value += permissionBits[perms[i + 1]];
        value += permissionBits[perms[i + 2]];
        octal += value.toString(8);
    }

    return octal;
}

function octalToPerms(octal, isDirectory = false) {
    const permissionChars = { 4: 'r', 2: 'w', 1: 'x', 0: '-' };
    const typeChar = isDirectory ? 'd' : '-';
    let perms = typeChar;

    for (let i = 0; i < octal.length; i++) {
        let value = parseInt(octal[i], 8);
        perms += permissionChars[(value & 4)];
        perms += permissionChars[(value & 2)];
        perms += permissionChars[(value & 1)];
    }

    return perms;
}


class FileSystem {
    #homeDirectory;
    #currentDirectory;
    #previousDirectory;
    #umask;

    constructor() {
        this.#homeDirectory = '/home/wizard';
        this.#currentDirectory = `${this.#homeDirectory}/Dungeon`;
        this.#previousDirectory = this.#currentDirectory;
        this.#umask = '0002';

        this.tree = new Dir('/', { immutable: true }, [
            new Dir('home', { immutable: true }, [
                new Dir('wizard', { immutable: true }, [
                    new Dir('Dungeon', { immutable: true }, [
                        new File('file1.txt', { content: 'file1 yo' }),
                        new File('emptyfile.txt'),
                        new File('.test', { content: 'hidden immutable file yo', immutable: true }),
                        new File('unreadable.txt', { content: 'unreadable yo', permissions: '--wx------' }),
                        new Dir('noexecute', { permissions: 'drw-------' }),
                        new Dir('noread', { permissions: 'd-wx------' }),
                        new Dir('nowrite', { permissions: 'dr-x------' }, [new File('denied')])
                    ])
                ])
            ])
        ]);

        this.tree.parent = this.tree;
    }

    get umask() {
        return this.#umask;
    }

    set umask(value) {
        if (!/(^[0-7]{3}$)|(^0{1}[0-7]{3}$)/.test(value)) {
            throw new Error('value must be of the format: 0?[0-7][0-7][0-7]');
        }
        this.#umask = value.padStart(4, '0');
    }

    #applyUmask(permissions) {
        const permOctal = permsToOctal(permissions);
        const result = permOctal - this.#umask;
        return octalToPerms(result.toString().padStart(3, '0'), permissions[0] === 'd');
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
        let curr = this.tree;

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

        if (!destDir) {
            throw new Error(`'${destPath}': No such file or directory`);
        }

        const copyItem = (item) => item.type === 'file'
            ? new File(item.name, { content: item.content, permissions: item.permissions })
            : new Dir(item.name, { permissions: item.permissions }, item.contents.map(copyItem));

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

    #chainErrors(func, message = null) {
        return (...args) => {
            try {
                return func(...args);
            } catch (error) {
                throw new Error(`${message ? message + ' ' : ''}'${args[0].replace('~', this.#homeDirectory)}': ${error.message}`);
            }
        };
    }


    get homeDirectory() {
        return this.#homeDirectory;
    }

    get currentDirectory() {
        return this.#currentDirectory;
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
                name: name ? name : item.name,
            });

            if (options.dir || item.type === 'file') {
                return constructObject(item, path === '.' ? '.' : false);
            }

            const result = options.all
                ? [constructObject(item, '.'), constructObject(item.parent, '..'), ...item.contents.map(i => constructObject(i))]
                : item.contents.filter(i => !i.name.startsWith('.')).map(i => constructObject(i));

            return result.sort((itemA, itemB) => {
                if (itemA.type === 'directory' && itemB.type !== 'directory') { return -1; }
                if (itemA.type !== 'directory' && itemB.type === 'directory') { return 1; }
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
        (path) => {
            const absolutePath = this.#evaluatePath(path);
            const sep = absolutePath.lastIndexOf('/');
            const directory = this.#getItem(absolutePath.substring(0, sep));
            const dirname = absolutePath.substring(sep + 1);

            if (!directory) {
                throw new Error('No such file or directory');
            } else if (directory.type != 'directory') {
                throw new Error('Not a directory');
            } else if (!dirname || directory.findItemByName(dirname)) {
                throw new Error('File exists');
            }

            const newDir = new Dir(dirname, { permissions: this.#applyUmask('drwxrwxrwx') });
            directory.addItem(newDir);
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

    rm = this.#chainErrors(
        (path, options) => {
            const item = this.#getItem(this.#evaluatePath(path));
            if (!item) { throw new Error('No such file or directory'); }
            return this.#rmRecurse(item, options.force === true).trim();
        },
        'cannot remove'
    );

    #parseChmodString(string, currentPermissions) {
        const parts = string.split(',').filter(Boolean);
        const regex = /([ugoa]*)([+\-=])([ugo]{1}|[rwxXst]*)/g;
        let permissions = currentPermissions.split('');

        // Detect octal here
        // UMASK!

        for (const part of parts) {
            let match;
            let prev = null;
            let consumedLength = 0;

            while ((match = regex.exec(part)) !== null) {
                let [fullMatch, groups, operator, perms] = match;
                groups = prev || groups || 'a';
                prev = groups;

                console.log(`groups to change: '${groups}', operator: '${operator}', perms: '${perms}'`);

                // Process here
                // UMASK!

                consumedLength += fullMatch.length;
            }

            if (consumedLength !== part.length) {
                throw new Error(`invalid mode: '${part}'`);
            }
        }
        return permissions.join('');
    }

    chmod = this.#chainErrors(
        (path, permString) => {
            const item = this.#getItem(this.#evaluatePath(path));
            if (!item) { throw new Error('No such file or directory'); }
            item.permissions = this.#parseChmodString(permString, item.permissions);
        }
    );

}


export { FileSystem };
