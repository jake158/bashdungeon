

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


export class Dir extends Item {
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


export class File extends Item {
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
