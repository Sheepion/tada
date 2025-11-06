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

// --- Helper Functions ---
function getItem<T>(key: string, defaultValue: T): T {
    try {
        const rawData = localStorage.getItem(key);
        if (rawData) {
            return JSON.parse(rawData) as T;
        }
    } catch (error) {
        console.error(`Failed to load '${key}' from localStorage`, error);
    }
    return defaultValue;
}

function setItem<T>(key: string, value: T): void {
    try {
        const stringifiedData = JSON.stringify(value);
        localStorage.setItem(key, stringifiedData);
    } catch (error) {
        console.error(`Failed to save '${key}' to localStorage`, error);
    }
}

// --- Default Data Initialization ---
function initializeDefaultData() {
    if (!localStorage.getItem(KEYS.LISTS)) {
        const inboxId = `list-${Date.now()}`;
        const defaultLists: List[] = [{ id: inboxId, name: 'Inbox', icon: 'inbox', order: 1 }];
        setItem(KEYS.LISTS, defaultLists);
    }
    if (!localStorage.getItem(KEYS.PREFERENCES_SETTINGS)) {
        const defaultPrefs = defaultPreferencesSettingsForApi();
        defaultPrefs.defaultNewTaskList = 'Inbox'; // Ensure it points to the default list
        setItem(KEYS.PREFERENCES_SETTINGS, defaultPrefs);
    }
}

initializeDefaultData();


// --- Service Implementation ---
export class LocalStorageService implements IStorageService {
    // Settings
    fetchSettings() {
        return {
            appearance: getItem(KEYS.APPEARANCE_SETTINGS, defaultAppearanceSettingsForApi()),
            preferences: getItem(KEYS.PREFERENCES_SETTINGS, defaultPreferencesSettingsForApi()),
            ai: getItem(KEYS.AI_SETTINGS, defaultAISettingsForApi()),
        };
    }
    updateAppearanceSettings(settings: AppearanceSettings) {
        setItem(KEYS.APPEARANCE_SETTINGS, settings);
        return settings;
    }
    updatePreferencesSettings(settings: PreferencesSettings) {
        setItem(KEYS.PREFERENCES_SETTINGS, settings);
        return settings;
    }
    updateAISettings(settings: AISettings) {
        setItem(KEYS.AI_SETTINGS, settings);
        return settings;
    }

    // Lists
    fetchLists() {
        return getItem<List[]>(KEYS.LISTS, []);
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
        setItem(KEYS.LISTS, lists);
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

        setItem(KEYS.LISTS, updatedLists);

        if (updates.name && originalName && updates.name !== originalName) {
            const tasks = this.fetchTasks();
            const updatedTasks = tasks.map(task =>
                task.listId === listId ? { ...task, listName: updates.name! } : task
            );
            setItem(KEYS.TASKS, updatedTasks);
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
        setItem(KEYS.TASKS, updatedTasks);

        const newLists = lists.filter(l => l.id !== listId);
        setItem(KEYS.LISTS, newLists);
        return { message: "List deleted successfully" };
    }
    updateLists(lists: List[]) {
        setItem(KEYS.LISTS, lists);
        return lists;
    }

    // Tasks
    fetchTasks() {
        return getItem<Task[]>(KEYS.TASKS, []);
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
        setItem(KEYS.TASKS, tasks);
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
        setItem(KEYS.TASKS, newTasks);
        return updatedTask;
    }
    deleteTask(taskId: string) {
        const tasks = this.fetchTasks();
        const newTasks = tasks.filter(t => t.id !== taskId);
        setItem(KEYS.TASKS, newTasks);
    }
    updateTasks(tasks: Task[]) {
        setItem(KEYS.TASKS, tasks);
        return tasks;
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

        setItem(KEYS.TASKS, tasks);
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
        setItem(KEYS.TASKS, tasks);
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
        setItem(KEYS.TASKS, tasks);
    }

    // Summaries
    fetchSummaries() {
        return getItem<StoredSummary[]>(KEYS.SUMMARIES, []);
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
        setItem(KEYS.SUMMARIES, summaries);
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
        setItem(KEYS.SUMMARIES, newSummaries);
        return updatedSummary;
    }
    updateSummaries(summaries: StoredSummary[]) {
        setItem(KEYS.SUMMARIES, summaries);
        return summaries;
    }
}