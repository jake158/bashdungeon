/** Type of filesystem item */
export type ItemType = 'file' | 'directory';

/** Permission action types */
export type PermissionAction = 'read' | 'write' | 'execute';

/** Permission character in string representation */
export type PermissionChar = 'r' | 'w' | 'x' | '-';

/** Options for creating filesystem items */
export interface ItemOptions {
    permissions?: string;
    immutable?: boolean;
    username?: string;
    groupname?: string;
    lastModified?: Date;
}

/** JSON representation of a filesystem item for serialization */
export interface ItemJSON {
    type: ItemType;
    name: string;
    options?: {
        permissions?: string;
        immutable?: boolean;
        username?: string;
        groupname?: string;
        lastModified?: string;
    };
    content?: string;
    contents?: ItemJSON[];
}
