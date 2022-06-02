/** @format */
declare type IIndexDb = {
    dbName: string;
    version: number;
    tables: DbTable[];
};
declare type DbIndex = {
    key: string;
    option?: IDBIndexParameters;
};
declare type DbTable = {
    tableName: string;
    option?: IDBObjectStoreParameters;
    indexes?: DbIndex[];
};
interface DbOperate<T> {
    tableName: string;
    key: string;
    data: T | T[];
    value: string | number;
    condition(data: T): boolean;
    success(res: T[] | T): void;
    handle(res: T): void;
}
export default class TsIndexDb {
    private dbName;
    private version;
    private tableList;
    private db;
    private queue;
    constructor({ dbName, version, tables }: IIndexDb);
    private static _instance;
    static getInstance(dbOptions?: IIndexDb): TsIndexDb;
    queryAll<T>({ tableName }: Pick<DbOperate<T>, 'tableName'>): Promise<T[]>;
    query<T>({ tableName, condition }: Pick<DbOperate<T>, 'condition' | 'tableName'>): Promise<T[]>;
    queryByKeyValue<T>({ tableName, key, value }: Pick<DbOperate<T>, 'tableName' | 'key' | 'value'>): Promise<T>;
    queryByPrimaryKey<T>({ tableName, value }: Pick<DbOperate<T>, 'tableName' | 'value'>): Promise<T>;
    update<T>({ tableName, condition, handle }: Pick<DbOperate<T>, 'tableName' | 'condition' | 'handle'>): Promise<T>;
    updateByPrimaryKey<T>({ tableName, value, handle }: Pick<DbOperate<T>, 'tableName' | 'value' | 'handle'>): Promise<T>;
    insert<T>({ tableName, data }: Pick<DbOperate<T>, 'tableName' | 'data'>): Promise<T>;
    delete<T>({ tableName, condition }: Pick<DbOperate<T>, 'tableName' | 'condition'>): Promise<T>;
    deleteByPrimaryKey<T>({ tableName, value }: Pick<DbOperate<T>, 'tableName' | 'value'>): Promise<T>;
    openDB(): Promise<TsIndexDb>;
    closeDB(): Promise<unknown>;
    deleteDB(name: string): Promise<unknown>;
    deleteTable(tableName: string): Promise<unknown>;
    private createTable;
    private commitDb;
    cursorSuccess(e: any, { condition, handler, success }: any): void;
}
export declare const initDB: ({ dbName, version, tables }: IIndexDb) => Promise<TsIndexDb>;
export declare const getInstance: () => TsIndexDb;
export {};
