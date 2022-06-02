/** @format */
import { initDB, getInstance } from './tsIndexDb';
export default class FrontendCache {
    private dbName;
    private tableName;
    private time;
    constructor();
    get<T>(id: string): Promise<T | null>;
    /**
     * @param id
     * @param data
     * @param timeout 过期时间
     */
    set<T>(id: string, data: T, timeout?: number): Promise<void>;
    increase(id: string, amount: number): Promise<number>;
    delete(id: string): Promise<boolean>;
    pop<T>(id: string): Promise<T>;
}
export { initDB, getInstance };
