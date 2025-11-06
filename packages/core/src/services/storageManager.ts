import { IStorageService } from './storageInterface';

class StorageManager {
    private serviceInstance: IStorageService | null = null;

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
}

const storageManager = new StorageManager();
export default storageManager;