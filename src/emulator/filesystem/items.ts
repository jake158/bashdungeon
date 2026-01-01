import type { ItemJSON, ItemOptions, ItemType, PermissionAction } from './types';

export class Item {
    #type: ItemType;
    #name: string;
    #permissions: string;
    #immutable: boolean;
    #parent: Dir | null;
    #username: string;
    #groupname: string;
    #lastModified: Date;

    constructor(
        type: ItemType,
        name: string,
        {
            permissions = '---------',
            immutable = false,
            username = 'user',
            groupname = 'group',
            lastModified = new Date(),
        }: ItemOptions = {}
    ) {
        this.#type = type;
        this.#name = name;
        this.#permissions = permissions;
        this.#immutable = immutable;
        this.#parent = null;
        this.#username = username;
        this.#groupname = groupname;
        this.#lastModified = lastModified;
        if (!(lastModified instanceof Date)) {
            throw new Error('lastModified must be an instance of Date');
        }
    }

    checkPermissions(action: PermissionAction): void {
        const perms: Record<PermissionAction, boolean> = {
            read: this.#permissions[1] === 'r',
            write: this.#permissions[2] === 'w',
            execute: this.#permissions[3] === 'x',
        };
        if (!perms[action]) {
            throw new Error('Permission denied');
        }
    }

    get type(): ItemType {
        return this.#type;
    }

    get parent(): Dir | null {
        return this.#parent;
    }

    get name(): string {
        return this.#name;
    }

    get permissions(): string {
        return this.#permissions;
    }

    get immutable(): boolean {
        return this.#immutable;
    }

    get username(): string {
        return this.#username;
    }

    get groupname(): string {
        return this.#groupname;
    }

    get lastModified(): Date {
        return this.#lastModified;
    }

    get fileSize(): number {
        return 0;
    }

    get links(): number {
        return 0;
    }

    updateLastModified(): void {
        this.#lastModified = new Date();
    }

    set parent(parent: Dir | null) {
        this.#parent = parent;
    }

    set name(name: string) {
        if (this.#immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        if (this.#parent) {
            this.#parent.checkPermissions('write');
        }
        this.#name = name;
        this.updateLastModified();
    }

    set permissions(permissions: string) {
        if (this.#immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        this.#permissions = permissions;
        this.updateLastModified();
    }

    toJSON(): ItemJSON {
        return {
            type: this.#type,
            name: this.#name,
            options: {
                permissions: this.#permissions,
                immutable: this.#immutable,
                username: this.#username,
                groupname: this.#groupname,
                lastModified: this.#lastModified.toISOString(),
            } as ItemJSON['options'],
        };
    }

    static fromJSON(json: ItemJSON): Item {
        const options = json.options
            ? {
                  ...json.options,
                  lastModified: json.options.lastModified ? new Date(json.options.lastModified) : undefined,
              }
            : {};
        if (json.type === 'directory') {
            const contents = (json.contents || []).map((item) => Item.fromJSON(item));
            return new Dir(json.name, contents, options);
        } else if (json.type === 'file') {
            return new File(json.name, json.content || '', options);
        } else {
            throw new Error('Invalid JSON: Unknown item type');
        }
    }
}

export class Dir extends Item {
    #contents: Item[];

    constructor(
        name: string,
        contents: Item[] = [],
        {
            permissions = 'drwxrwxr-x',
            immutable = false,
            username = 'user',
            groupname = 'group',
            lastModified = new Date(),
        }: ItemOptions = {}
    ) {
        super('directory', name, { permissions, immutable, username, groupname, lastModified });
        this.#contents = contents;
        contents.forEach((item) => (item.parent = this));
    }

    get contents(): Item[] {
        this.checkPermissions('read');
        return this.#contents;
    }

    override get links(): number {
        let links = 2;
        for (const item of this.#contents) {
            if (item.type === 'directory') {
                links += 1;
            }
        }
        return links;
    }

    get isEmpty(): boolean {
        return this.#contents.length === 0;
    }

    override get fileSize(): number {
        return this.#contents.reduce((totalSize, item) => totalSize + item.fileSize, 0);
    }

    findItemByName(name: string): Item | undefined {
        this.checkPermissions('execute');
        return this.#contents.find((item) => item.name === name);
    }

    removeItemByName(name: string, force: boolean = false): boolean {
        if (!force) this.checkPermissions('write');
        const index = this.#contents.findIndex((item) => item.name === name);
        if (index !== -1) {
            if (this.#contents[index].immutable) throw new Error(`Permission denied: ${name} is immutable`);
            this.#contents.splice(index, 1);
            this.updateLastModified();
            return true;
        } else {
            return false;
        }
    }

    addItem(item: Item): void {
        this.checkPermissions('write');
        this.#contents.push(item);
        item.parent = this;
        this.updateLastModified();
    }

    override toJSON(): ItemJSON {
        const json = super.toJSON();
        json.contents = this.#contents.map((item) => item.toJSON());
        return json;
    }
}

export class File extends Item {
    #content: string;

    constructor(
        name: string,
        content: string = '',
        {
            permissions = '-rw-rw-r--',
            immutable = false,
            username = 'user',
            groupname = 'group',
            lastModified = new Date(),
        }: ItemOptions = {}
    ) {
        super('file', name, { permissions, immutable, username, groupname, lastModified });
        this.#content = content;
    }

    get content(): string {
        this.checkPermissions('read');
        return this.#content;
    }

    override get links(): number {
        return 1;
    }

    override get fileSize(): number {
        return this.#content.length;
    }

    set content(content: string) {
        if (this.immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        this.checkPermissions('write');
        this.#content = content;
        this.updateLastModified();
    }

    appendContent(content: string): void {
        if (this.immutable) throw new Error(`Permission denied: ${this.name} is immutable`);
        this.checkPermissions('write');
        this.#content += content;
        this.updateLastModified();
    }

    override toJSON(): ItemJSON {
        const json = super.toJSON();
        json.content = this.#content;
        return json;
    }
}
