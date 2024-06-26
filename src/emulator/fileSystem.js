

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
        this.#name = name;
    }
}


class Dir extends Item {
    #contents;

    constructor(name, { permissions = 'drwxr-xr-x', immutable = false } = {}, contents = []) {
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

    removeItemByName(name) {
        this.checkPermissions('write');
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

    constructor(name, { content = '', permissions = '-rw-r--r--', immutable = false } = {}) {
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


class FileSystem {
    #homeDirectory;
    #currentDirectory;
    #previousDirectory;

    constructor() {
        this.#homeDirectory = '/home/wizard';
        this.#currentDirectory = `${this.#homeDirectory}/Dungeon`;
        this.#previousDirectory = this.#currentDirectory;

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
                        new Dir('nowrite', { permissions: 'dr-x------' })
                    ])
                ])
            ])
        ]);

        this.tree.parent = this.tree;
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
            ? new File(item.name, { permissions: item.permissions }, item.content)
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
        'cannot access');

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
        'cannot access');

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
        });

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

            const newDir = new Dir(dirname);
            directory.addItem(newDir);
        },
        'cannot create directory');

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
        'failed to remove');

    cp = this.#chainErrors(
        (source, dest) => {
            this.#handleItemMove(this.#evaluatePath(source), this.#evaluatePath(dest), 'copy');
        },
        'cannot copy');

    mv = this.#chainErrors(
        (source, dest) => {
            this.#handleItemMove(this.#evaluatePath(source), this.#evaluatePath(dest), 'move');
        },
        'cannot move');

}


export { FileSystem };
