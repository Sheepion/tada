import { IStorageService } from '@tada/core/services/storageInterface';
import {
    AISettings,
    AppearanceSettings,
    List,
    PreferencesSettings,
    StoredSummary,
    Task,
    Subtask
} from '@tada/core/types';
import {
    defaultAISettingsForApi,
    defaultAppearanceSettingsForApi,
    defaultPreferencesSettingsForApi
} from '@tada/core/store/jotai';

// --- Constants for LocalStorage Keys ---
const KEYS = {
    TASKS: 'tada-tasks',
    LISTS: 'tada-lists',
    SUMMARIES: 'tada-summaries',
    APPEARANCE_SETTINGS: 'tada-appearanceSettings',
    PREFERENCES_SETTINGS: 'tada-preferencesSettings',
    AI_SETTINGS: 'tada-aiSettings',
};

// --- 内存缓存 ---
class MemoryCache<T> {
    private cache: T | null = null;
    private isDirty = false;

    set(value: T, dirty = true): void {
        this.cache = value;
        this.isDirty = dirty;
    }

    get(): T | null {
        return this.cache;
    }

    markDirty(): void {
        this.isDirty = true;
    }

    isDirtyFlag(): boolean {
        return this.isDirty;
    }

    clearDirty(): void {
        this.isDirty = false;
    }

    clear(): void {
        this.cache = null;
        this.isDirty = false;
    }
}

// --- Helper Functions with caching ---
function getItem<T>(key: string, defaultValue: T, cache?: MemoryCache<T>): T {
    // 先检查缓存
    if (cache) {
        const cached = cache.get();
        if (cached !== null) {
            return cached;
        }
    }

    try {
        const rawData = localStorage.getItem(key);
        if (rawData) {
            const parsed = JSON.parse(rawData) as T;
            if (cache) {
                cache.set(parsed, false); // 从存储加载，不标记为脏
            }
            return parsed;
        }
    } catch (error) {
        console.error(`Failed to load '${key}' from localStorage`, error);
    }

    if (cache) {
        cache.set(defaultValue, false);
    }
    return defaultValue;
}

function setItem<T>(key: string, value: T, cache?: MemoryCache<T>): void {
    // 先更新缓存
    if (cache) {
        cache.set(value, true);
    }

    // 使用 requestIdleCallback 延迟写入
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            persistToStorage(key, value, cache);
        }, { timeout: 2000 });
    } else {
        // 降级：使用 setTimeout
        setTimeout(() => {
            persistToStorage(key, value, cache);
        }, 100);
    }
}

function persistToStorage<T>(key: string, value: T, cache?: MemoryCache<T>): void {
    try {
        const stringifiedData = JSON.stringify(value);
        localStorage.setItem(key, stringifiedData);
        if (cache) {
            cache.clearDirty();
        }
    } catch (error) {
        console.error(`Failed to save '${key}' to localStorage`, error);
    }
}

// --- Default Data Initialization ---
function initializeDefaultData() {
    if (!localStorage.getItem(KEYS.LISTS)) {
        const inboxId = `list-${Date.now()}`;
        const defaultLists: List[] = [{ id: inboxId, name: 'Inbox', icon: 'inbox', order: 1 }];
        localStorage.setItem(KEYS.LISTS, JSON.stringify(defaultLists));
    }
    if (!localStorage.getItem(KEYS.PREFERENCES_SETTINGS)) {
        const defaultPrefs = defaultPreferencesSettingsForApi();
        defaultPrefs.defaultNewTaskList = 'Inbox';
        localStorage.setItem(KEYS.PREFERENCES_SETTINGS, JSON.stringify(defaultPrefs));
    }
}

initializeDefaultData();

// --- Service Implementation with Performance Optimizations ---
export class LocalStorageService implements IStorageService {
    private tasksCache = new MemoryCache<Task[]>();
    private listsCache = new MemoryCache<List[]>();
    private summariesCache = new MemoryCache<StoredSummary[]>();
    private appearanceCache = new MemoryCache<AppearanceSettings>();
    private preferencesCache = new MemoryCache<PreferencesSettings>();
    private aiCache = new MemoryCache<AISettings>();

    private pendingWrites = new Set<string>();
    private flushTimeout: NodeJS.Timeout | null = null;

    constructor() {
        // 页面卸载时强制刷新
        window.addEventListener('beforeunload', () => {
            this.flushSync();
        });

        // 页面隐藏时刷新
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.flush();
            }
        });
    }

    // Settings
    fetchSettings() {
        return {
            appearance: getItem(KEYS.APPEARANCE_SETTINGS, defaultAppearanceSettingsForApi(), this.appearanceCache),
            preferences: getItem(KEYS.PREFERENCES_SETTINGS, defaultPreferencesSettingsForApi(), this.preferencesCache),
            ai: getItem(KEYS.AI_SETTINGS, defaultAISettingsForApi(), this.aiCache),
        };
    }

    updateAppearanceSettings(settings: AppearanceSettings) {
        setItem(KEYS.APPEARANCE_SETTINGS, settings, this.appearanceCache);
        return settings;
    }

    updatePreferencesSettings(settings: PreferencesSettings) {
        setItem(KEYS.PREFERENCES_SETTINGS, settings, this.preferencesCache);
        return settings;
    }

    updateAISettings(settings: AISettings) {
        setItem(KEYS.AI_SETTINGS, settings, this.aiCache);
        return settings;
    }

    // Lists
    fetchLists() {
        return getItem<List[]>(KEYS.LISTS, [], this.listsCache);
    }

    createList(listData: { name: string; icon?: string }) {
        const lists = this.fetchLists();
        const newList: List = {
            id: `list-${Date.now()}-${Math.random()}`,
            name: listData.name,
            icon: listData.icon ?? 'list',
            order: (lists.length + 1) * 1000,
        };
        lists.push(newList);
        setItem(KEYS.LISTS, lists, this.listsCache);
        return newList;
    }

    updateList(listId: string, updates: Partial<List>) {
        const lists = this.fetchLists();
        let originalName: string | undefined;
        let updatedList: List | undefined;

        const updatedLists = lists.map(list => {
            if (list.id === listId) {
                originalName = list.name;
                updatedList = { ...list, ...updates };
                return updatedList;
            }
            return list;
        });

        if (!updatedList) throw new Error("List not found");

        setItem(KEYS.LISTS, updatedLists, this.listsCache);

        if (updates.name && originalName && updates.name !== originalName) {
            const tasks = this.fetchTasks();
            const updatedTasks = tasks.map(task =>
                task.listId === listId ? { ...task, listName: updates.name! } : task
            );
            setItem(KEYS.TASKS, updatedTasks, this.tasksCache);
        }

        return updatedList;
    }

    deleteList(listId: string) {
        const lists = this.fetchLists();
        const listToDelete = lists.find(l => l.id === listId);
        if (!listToDelete) throw new Error("List not found");
        if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");

        const inbox = lists.find(l => l.name === 'Inbox');
        if (!inbox) throw new Error("Inbox not found, cannot delete list.");

        const tasks = this.fetchTasks();
        const updatedTasks = tasks.map(task => {
            if (task.listId === listId) {
                return task.listName === 'Trash'
                    ? { ...task, listId: null }
                    : { ...task, listId: inbox.id, listName: inbox.name };
            }
            return task;
        });
        setItem(KEYS.TASKS, updatedTasks, this.tasksCache);

        const newLists = lists.filter(l => l.id !== listId);
        setItem(KEYS.LISTS, newLists, this.listsCache);
        return { message: "List deleted successfully" };
    }

    updateLists(lists: List[]) {
        setItem(KEYS.LISTS, lists, this.listsCache);
        return lists;
    }

    // Tasks
    fetchTasks() {
        return getItem<Task[]>(KEYS.TASKS, [], this.tasksCache);
    }

    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>) {
        const tasks = this.fetchTasks();
        const now = Date.now();
        const newTask: Task = {
            ...taskData,
            id: `task-${now}-${Math.random()}`,
            createdAt: now,
            updatedAt: now,
            groupCategory: 'nodate',
        };
        tasks.push(newTask);
        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return newTask;
    }

    updateTask(taskId: string, updates: Partial<Task>) {
        const tasks = this.fetchTasks();
        let updatedTask: Task | undefined;
        const newTasks = tasks.map(task => {
            if (task.id === taskId) {
                updatedTask = { ...task, ...updates, updatedAt: Date.now() };
                return updatedTask;
            }
            return task;
        });
        if (!updatedTask) throw new Error("Task not found");
        setItem(KEYS.TASKS, newTasks, this.tasksCache);
        return updatedTask;
    }

    deleteTask(taskId: string) {
        const tasks = this.fetchTasks();
        const newTasks = tasks.filter(t => t.id !== taskId);
        setItem(KEYS.TASKS, newTasks, this.tasksCache);
    }

    updateTasks(tasks: Task[]) {
        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return tasks;
    }

    // 新增：批量更新任务（异步）
    async batchUpdateTasks(tasks: Task[]): Promise<void> {
        // 先更新缓存（同步）
        this.tasksCache.set(tasks, true);

        // 标记有待处理的写入
        this.pendingWrites.add(KEYS.TASKS);

        // 调度批量刷新
        this.scheduleBatchFlush();
    }

    // 新增：批量更新列表（异步）
    async batchUpdateLists(lists: List[]): Promise<void> {
        this.listsCache.set(lists, true);
        this.pendingWrites.add(KEYS.LISTS);
        this.scheduleBatchFlush();
    }

    // 调度批量刷新
    private scheduleBatchFlush(): void {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }

        this.flushTimeout = setTimeout(() => {
            this.flush();
        }, 100); // 100ms 内的所有更新合并为一次写入
    }

    // 异步刷新
    async flush(): Promise<void> {
        if (this.pendingWrites.size === 0) return;

        const writes = Array.from(this.pendingWrites);
        this.pendingWrites.clear();

        await Promise.all(
            writes.map(async (key) => {
                try {
                    let cache: MemoryCache<any> | undefined;

                    if (key === KEYS.TASKS) cache = this.tasksCache;
                    else if (key === KEYS.LISTS) cache = this.listsCache;
                    else if (key === KEYS.SUMMARIES) cache = this.summariesCache;
                    else if (key === KEYS.APPEARANCE_SETTINGS) cache = this.appearanceCache;
                    else if (key === KEYS.PREFERENCES_SETTINGS) cache = this.preferencesCache;
                    else if (key === KEYS.AI_SETTINGS) cache = this.aiCache;

                    if (cache && cache.isDirtyFlag()) {
                        const value = cache.get();
                        if (value !== null) {
                            await new Promise<void>((resolve) => {
                                persistToStorage(key, value, cache);
                                resolve();
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to flush ${key}:`, error);
                }
            })
        );
    }

    // 同步刷新（用于页面卸载）
    private flushSync(): void {
        const caches = [
            { key: KEYS.TASKS, cache: this.tasksCache },
            { key: KEYS.LISTS, cache: this.listsCache },
            { key: KEYS.SUMMARIES, cache: this.summariesCache },
            { key: KEYS.APPEARANCE_SETTINGS, cache: this.appearanceCache },
            { key: KEYS.PREFERENCES_SETTINGS, cache: this.preferencesCache },
            { key: KEYS.AI_SETTINGS, cache: this.aiCache },
        ];

        caches.forEach(({ key, cache }) => {
            if (cache.isDirtyFlag()) {
                const value = cache.get();
                if (value !== null) {
                    try {
                        localStorage.setItem(key, JSON.stringify(value));
                        cache.clearDirty();
                    } catch (error) {
                        console.error(`Failed to sync flush ${key}:`, error);
                    }
                }
            }
        });
    }

    // Subtasks
    createSubtask(taskId: string, subtaskData: { title: string, order: number, dueDate: number | null }) {
        const tasks = this.fetchTasks();
        const now = Date.now();
        const newSubtask: Subtask = {
            id: `subtask-${now}-${Math.random()}`,
            parentId: taskId,
            title: subtaskData.title,
            completed: false,
            completedAt: null,
            order: subtaskData.order,
            dueDate: subtaskData.dueDate,
            createdAt: now,
            updatedAt: now,
        };

        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) throw new Error("Parent task not found");

        if (!tasks[taskIndex].subtasks) {
            tasks[taskIndex].subtasks = [];
        }
        tasks[taskIndex].subtasks!.push(newSubtask);

        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return newSubtask;
    }

    updateSubtask(subtaskId: string, updates: Partial<Subtask>) {
        const tasks = this.fetchTasks();
        let updatedSubtask: Subtask | undefined;

        for (const task of tasks) {
            if (task.subtasks) {
                const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
                if (subtaskIndex !== -1) {
                    updatedSubtask = { ...task.subtasks[subtaskIndex], ...updates, updatedAt: Date.now() };
                    task.subtasks[subtaskIndex] = updatedSubtask;
                    break;
                }
            }
        }
        if (!updatedSubtask) throw new Error("Subtask not found");
        setItem(KEYS.TASKS, tasks, this.tasksCache);
        return updatedSubtask;
    }

    deleteSubtask(subtaskId: string) {
        const tasks = this.fetchTasks();
        for (const task of tasks) {
            if (task.subtasks) {
                const initialLength = task.subtasks.length;
                task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                if (task.subtasks.length < initialLength) {
                    break;
                }
            }
        }
        setItem(KEYS.TASKS, tasks, this.tasksCache);
    }

    // Summaries
    fetchSummaries() {
        return getItem<StoredSummary[]>(KEYS.SUMMARIES, [], this.summariesCache);
    }

    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>) {
        const summaries = this.fetchSummaries();
        const now = Date.now();
        const newSummary: StoredSummary = {
            ...summaryData,
            id: `summary-${now}-${Math.random()}`,
            createdAt: now,
            updatedAt: now,
        };
        summaries.unshift(newSummary);
        setItem(KEYS.SUMMARIES, summaries, this.summariesCache);
        return newSummary;
    }

    updateSummary(summaryId: string, updates: Partial<StoredSummary>) {
        const summaries = this.fetchSummaries();
        let updatedSummary: StoredSummary | undefined;
        const newSummaries = summaries.map(s => {
            if (s.id === summaryId) {
                updatedSummary = { ...s, ...updates, updatedAt: Date.now() };
                return updatedSummary;
            }
            return s;
        });
        if (!updatedSummary) throw new Error("Summary not found");
        setItem(KEYS.SUMMARIES, newSummaries, this.summariesCache);
        return updatedSummary;
    }

    updateSummaries(summaries: StoredSummary[]) {
        setItem(KEYS.SUMMARIES, summaries, this.summariesCache);
        return summaries;
    }
}