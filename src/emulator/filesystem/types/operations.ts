export interface MkdirOptions {
    parents?: boolean;
    verbose?: boolean;
}

export interface RmOptions {
    force?: boolean;
}

export interface TouchOptions {
    noCreate?: boolean;
}

export interface LsOptions {
    all?: boolean;
    dir?: boolean;
}

/** Item returned by ls operation */
export interface LsItem {
    type: string;
    permissions: string;
    links: number;
    username: string;
    groupname: string;
    size: number;
    modified: Date;
    name: string;
}
