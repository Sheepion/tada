import {
    AISettings,
    AppearanceSettings,
    List,
    PreferencesSettings,
    StoredSummary,
    Task,
    Subtask
} from '@/types';

export interface IStorageService {
    // Settings - 同步方法保留用于初始化
    fetchSettings(): {
        appearance: AppearanceSettings;
        preferences: PreferencesSettings;
        ai: AISettings;
    };
    updateAppearanceSettings(settings: AppearanceSettings): AppearanceSettings;
    updatePreferencesSettings(settings: PreferencesSettings): PreferencesSettings;
    updateAISettings(settings: AISettings): AISettings;

    // Lists - 同步方法保留
    fetchLists(): List[];
    createList(listData: { name: string; icon?: string }): List;
    updateList(listId: string, updates: Partial<List>): List;
    deleteList(listId: string): { message: string };
    updateLists(lists: List[]): List[];

    // Tasks - 同步方法保留
    fetchTasks(): Task[];
    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>): Task;
    updateTask(taskId: string, updates: Partial<Task>): Task;
    deleteTask(taskId: string): void;
    updateTasks(tasks: Task[]): Task[];

    // Subtasks
    createSubtask(taskId: string, subtaskData: { title: string; order: number; dueDate: number | null }): Subtask;
    updateSubtask(subtaskId: string, updates: Partial<Subtask>): Subtask;
    deleteSubtask(subtaskId: string): void;

    // Summaries
    fetchSummaries(): StoredSummary[];
    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>): StoredSummary;
    updateSummary(summaryId: string, updates: Partial<StoredSummary>): StoredSummary;
    updateSummaries(summaries: StoredSummary[]): StoredSummary[];

    // 新增：批量操作方法
    batchUpdateTasks?(tasks: Task[]): Promise<void>;
    batchUpdateLists?(lists: List[]): Promise<void>;

    // 新增：持久化控制
    flush?(): Promise<void>; // 强制刷新所有待处理的写入
    enableAutoPersist?(enabled: boolean): void; // 控制自动持久化
}

// 新增：存储事件监听器
export interface StorageEventListener {
    onTasksChanged?(tasks: Task[]): void;
    onListsChanged?(lists: List[]): void;
    onSettingsChanged?(settings: any): void;
}

export interface IEnhancedStorageService extends IStorageService {
    addEventListener?(listener: StorageEventListener): () => void;
}