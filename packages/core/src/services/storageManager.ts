import { IStorageService } from './storageInterface';

class StorageManager {
    private serviceInstance: IStorageService | null = null;
    private isPersisting = false;
    private persistQueue: Array<() => Promise<void>> = [];

    register(service: IStorageService): void {
        if (this.serviceInstance) {
            console.warn("Storage service has already been registered.");
            return;
        }
        this.serviceInstance = service;
    }

    get(): IStorageService {
        if (!this.serviceInstance) {
            throw new Error("Storage service has not been registered. Please call register() at application startup.");
        }
        return this.serviceInstance;
    }

    // 新增：延迟批量持久化
    async queuePersist(operation: () => Promise<void>): Promise<void> {
        this.persistQueue.push(operation);

        if (!this.isPersisting) {
            this.isPersisting = true;
            await this.processPersistQueue();
            this.isPersisting = false;
        }
    }

    private async processPersistQueue(): Promise<void> {
        // 等待一小段时间收集更多操作
        await new Promise(resolve => setTimeout(resolve, 100));

        const operations = [...this.persistQueue];
        this.persistQueue = [];

        // 批量执行所有操作
        try {
            await Promise.all(operations.map(op => op()));
        } catch (error) {
            console.error('Failed to persist operations:', error);
        }
    }

    // 新增：强制刷新
    async flush(): Promise<void> {
        if (this.serviceInstance?.flush) {
            await this.serviceInstance.flush();
        }

        // 处理队列中剩余的操作
        if (this.persistQueue.length > 0) {
            await this.processPersistQueue();
        }
    }
}

const storageManager = new StorageManager();
export default storageManager;