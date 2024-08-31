

export class Item {
    #type;
    #name;
    #permissions;
    #immutable;
    #parent;
    #username;
    #groupname;
    #lastModified;

    constructor(type, name, { permissions = '---------', immutable = false, username = 'user', groupname = 'group', lastModified = new Date() } = {}) {
        this.#type = type;
        this.#name = name;
        this.#permissions = permissions;
        this.#immutable = immutable;
        this.#parent = null;
        this.#username = username;
        this.#groupname = groupname;
        this.#lastModified = lastModified;
        if (!(lastModified instanceof Date)) { throw new Error('lastModified must be an instance of Date'); }
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

    get username() {
        return this.#username;
    }

    get groupname() {
        return this.#groupname;
    }

    get lastModified() {
        return this.#lastModified;
    }

    get fileSize() {
        return 0;
    }

    updateLastModified() {
        this.#lastModified = new Date();
    }

    set parent(parent) {
        this.#parent = parent;
    }

    set name(name) {
        if (this.#immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        if (this.#parent) {
            this.#parent.checkPermissions('write');
        }
        this.#name = name;
        this.updateLastModified();
    }

    set permissions(permissions) {
        if (this.#immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        this.#permissions = permissions;
        this.updateLastModified();
    }

    toJSON() {
        return {
            type: this.#type,
            name: this.#name,
            options: {
                permissions: this.#permissions,
                immutable: this.#immutable,
                username: this.#username,
                groupname: this.#groupname,
                lastModified: this.#lastModified.toISOString()
            }
        };
    }

    static fromJSON(json) {
        if (json.options && json.options.lastModified) {
            json.options.lastModified = new Date(json.options.lastModified);
        }
        if (json.type === 'directory') {
            const contents = (json.contents || []).map(item => Item.fromJSON(item));
            return new Dir(json.name, contents, json.options || {});
        } else if (json.type === 'file') {
            return new File(json.name, json.content || '', json.options || {});
        } else {
            throw new Error('Invalid JSON: Unknown item type');
        }
    }
}


export class Dir extends Item {
    #contents;

    constructor(name, contents = [], { permissions = 'drwxrwxr-x', immutable = false, username = 'user', groupname = 'group', lastModified = new Date() } = {}) {
        super('directory', name, { permissions, immutable, username, groupname, lastModified });
        this.#contents = contents;
        contents.forEach(item => item.parent = this);
    }

    get contents() {
        this.checkPermissions('read');
        return this.#contents;
    }

    get links() {
        let links = 2;
        for (const item of this.#contents) {
            if (item.type === 'directory') {
                links += 1;
            }
        }
        return links;
    }

    get isEmpty() {
        return this.#contents.length === 0;
    }

    get fileSize() {
        return this.#contents.reduce((totalSize, item) => totalSize + item.fileSize, 0);
    }

    findItemByName(name) {
        this.checkPermissions('execute');
        return this.#contents.find(item => item.name === name);
    }

    removeItemByName(name, force = false) {
        if (!force) this.checkPermissions('write');
        const index = this.#contents.findIndex(item => item.name === name);
        if (index !== -1) {
            if (this.#contents[index].immutable) throw new Error(`Permission denied: ${name} is immutable`);
            this.#contents.splice(index, 1);
            this.updateLastModified();
            return true;
        } else {
            return false;
        }
    }

    addItem(item) {
        this.checkPermissions('write');
        this.#contents.push(item);
        item.parent = this;
        this.updateLastModified();
    }

    toJSON() {
        const json = super.toJSON();
        json.contents = this.#contents.map(item => item.toJSON());
        return json;
    }
}

export class File extends Item {
    #content;

    constructor(name, content = '', { permissions = '-rw-rw-r--', immutable = false, username = 'user', groupname = 'group', lastModified = new Date() } = {}) {
        super('file', name, { permissions, immutable, username, groupname, lastModified });
        this.#content = content;
    }

    get content() {
        this.checkPermissions('read');
        return this.#content;
    }

    get links() {
        return 1;
    }

    get fileSize() {
        return this.#content.length;
    }

    set content(content) {
        if (this.immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        this.checkPermissions('write');
        this.#content = content;
        this.updateLastModified();
    }

    appendContent(content) {
        if (this.immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        this.checkPermissions('write');
        this.#content += content;
        this.updateLastModified();
    }

    toJSON() {
        const json = super.toJSON();
        json.content = this.#content;
        return json;
    }
}
