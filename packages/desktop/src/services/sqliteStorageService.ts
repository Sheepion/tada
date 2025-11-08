import Database from '@tauri-apps/plugin-sql';
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

interface DbTask {
    id: string;
    title: string;
    completed: number;
    completed_at: number | null;
    complete_percentage: number | null;
    due_date: number | null;
    list_id: string | null;
    list_name: string;
    content: string | null;
    order: number;
    created_at: number;
    updated_at: number;
    tags: string | null;
    priority: number | null;
    group_category: string;
}

interface DbSubtask {
    id: string;
    parent_id: string;
    title: string;
    completed: number;
    completed_at: number | null;
    due_date: number | null;
    order: number;
    created_at: number;
    updated_at: number;
}

interface DbList {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    order: number | null;
    created_at: number;
    updated_at: number;
}

interface DbSummary {
    id: string;
    created_at: number;
    updated_at: number;
    period_key: string;
    list_key: string;
    task_ids: string;
    summary_text: string;
}

interface DbSetting {
    key: string;
    value: string;
    updated_at: number;
}

export class SqliteStorageService implements IStorageService {
    private db: Database | null = null;
    private listsCache: List[] = [];
    private tasksCache: Task[] = [];
    private summariesCache: StoredSummary[] = [];
    private settingsCache: {
        appearance: AppearanceSettings;
        preferences: PreferencesSettings;
        ai: AISettings;
    } | null = null;
    private isDataLoaded = false;

    async initialize(): Promise<void> {
        try {
            this.db = await Database.load('sqlite:tada.db');
            console.log('Database connected successfully');

            // 验证 Inbox 是否存在
            const lists = await this.db.select<DbList[]>('SELECT * FROM lists');
            console.log('Lists in database:', lists);

            if (lists.length === 0) {
                console.warn('No lists found! Creating default Inbox...');
                const now = Date.now();
                await this.db.execute(
                    'INSERT INTO lists (id, name, icon, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                    ['inbox-default', 'Inbox', 'inbox', 1, now, now]
                );
            }
        } catch (error) {
            console.error('Failed to connect to database:', error);
            throw error;
        }
    }

    async preloadData(): Promise<void> {
        if (this.isDataLoaded) return;

        try {
            this.listsCache = await this.fetchListsAsync();
            this.tasksCache = await this.fetchTasksAsync();
            this.summariesCache = await this.fetchSummariesAsync();
            this.settingsCache = await this.fetchSettingsAsync();
            this.isDataLoaded = true;

            console.log('Data preloaded:', {
                lists: this.listsCache.length,
                tasks: this.tasksCache.length,
                summaries: this.summariesCache.length,
                settings: this.settingsCache
            });
        } catch (error) {
            console.error('Failed to preload data:', error);
            throw error;
        }
    }

    private getDb(): Database {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return this.db;
    }

    // Settings
    fetchSettings() {
        if (!this.isDataLoaded || !this.settingsCache) {
            console.warn('Settings not yet loaded, returning defaults');
            return {
                appearance: defaultAppearanceSettingsForApi(),
                preferences: defaultPreferencesSettingsForApi(),
                ai: defaultAISettingsForApi(),
            };
        }
        return this.settingsCache;
    }

    async fetchSettingsAsync() {
        const db = this.getDb();

        const settings = await db.select<DbSetting[]>('SELECT * FROM settings WHERE key IN (?, ?, ?)', ['appearance', 'preferences', 'ai']);

        const result = {
            appearance: defaultAppearanceSettingsForApi(),
            preferences: defaultPreferencesSettingsForApi(),
            ai: defaultAISettingsForApi(),
        };

        settings.forEach(setting => {
            try {
                const parsed = JSON.parse(setting.value);
                if (setting.key === 'appearance') {
                    result.appearance = { ...result.appearance, ...parsed };
                } else if (setting.key === 'preferences') {
                    result.preferences = { ...result.preferences, ...parsed };
                } else if (setting.key === 'ai') {
                    result.ai = { ...result.ai, ...parsed };
                }
            } catch (error) {
                console.error(`Failed to parse setting ${setting.key}:`, error);
            }
        });

        this.settingsCache = result;
        return result;
    }

    updateAppearanceSettings(settings: AppearanceSettings): AppearanceSettings {
        const db = this.getDb();
        const now = Date.now();

        db.execute(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
            ['appearance', JSON.stringify(settings), now]
        ).then(() => {
            if (this.settingsCache) {
                this.settingsCache.appearance = settings;
            }
        }).catch(error => {
            console.error('Failed to update appearance settings:', error);
        });

        return settings;
    }

    updatePreferencesSettings(settings: PreferencesSettings): PreferencesSettings {
        const db = this.getDb();
        const now = Date.now();

        db.execute(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
            ['preferences', JSON.stringify(settings), now]
        ).then(() => {
            if (this.settingsCache) {
                this.settingsCache.preferences = settings;
            }
        }).catch(error => {
            console.error('Failed to update preferences settings:', error);
        });

        return settings;
    }

    updateAISettings(settings: AISettings): AISettings {
        const db = this.getDb();
        const now = Date.now();

        db.execute(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
            ['ai', JSON.stringify(settings), now]
        ).then(() => {
            if (this.settingsCache) {
                this.settingsCache.ai = settings;
            }
        }).catch(error => {
            console.error('Failed to update AI settings:', error);
        });

        return settings;
    }

    // Lists
    fetchLists(): List[] {
        if (!this.isDataLoaded) {
            console.warn('Data not yet loaded, returning empty array');
            return [];
        }
        return this.listsCache;
    }

    async fetchListsAsync(): Promise<List[]> {
        const db = this.getDb();

        try {
            const dbLists = await db.select<DbList[]>('SELECT * FROM lists ORDER BY "order", name');
            const lists = dbLists.map(this.mapDbListToList);
            this.listsCache = lists;
            return lists;
        } catch (error) {
            console.error('Failed to fetch lists:', error);
            return [];
        }
    }

    createList(listData: { name: string; icon?: string }): List {
        const db = this.getDb();
        const now = Date.now();
        const id = `list-${now}-${Math.random()}`;

        const newList: List = {
            id,
            name: listData.name,
            icon: listData.icon || 'list',
            color: null,
            order: now,
        };

        db.execute(
            'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newList.id, newList.name, newList.icon, newList.color, newList.order, now, now]
        ).then(() => {
            this.listsCache.push(newList);
        }).catch(error => {
            console.error('Failed to create list:', error);
        });

        return newList;
    }

    updateList(listId: string, updates: Partial<List>): List {
        const db = this.getDb();
        const now = Date.now();

        // Build dynamic update query
        const updateFields = [];
        const values = [];

        if (updates.name !== undefined) {
            updateFields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.icon !== undefined) {
            updateFields.push('icon = ?');
            values.push(updates.icon);
        }
        if (updates.color !== undefined) {
            updateFields.push('color = ?');
            values.push(updates.color);
        }
        if (updates.order !== undefined) {
            updateFields.push('"order" = ?');
            values.push(updates.order);
        }

        updateFields.push('updated_at = ?');
        values.push(now, listId);

        db.execute(
            `UPDATE lists SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        ).then(() => {
            // 更新缓存
            const index = this.listsCache.findIndex(l => l.id === listId);
            if (index !== -1) {
                this.listsCache[index] = { ...this.listsCache[index], ...updates };
            }
        }).catch(error => {
            console.error('Failed to update list:', error);
        });

        // If name was updated, update tasks
        if (updates.name) {
            db.execute(
                'UPDATE tasks SET list_name = ?, updated_at = ? WHERE list_id = ?',
                [updates.name, now, listId]
            ).then(() => {
                // 更新任务缓存中的列表名称
                this.tasksCache.forEach(task => {
                    if (task.listId === listId) {
                        task.listName = updates.name!;
                        task.updatedAt = now;
                    }
                });
            }).catch(error => {
                console.error('Failed to update task list names:', error);
            });
        }

        // Return updated list
        const currentLists = this.fetchLists();
        const updatedList = currentLists.find(l => l.id === listId);
        if (!updatedList) throw new Error("List not found");

        return { ...updatedList, ...updates };
    }

    deleteList(listId: string): { message: string } {
        const db = this.getDb();
        const now = Date.now();

        // Find the list to delete and ensure it's not Inbox
        const lists = this.fetchLists();
        const listToDelete = lists.find(l => l.id === listId);
        if (!listToDelete) throw new Error("List not found");
        if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");

        const inbox = lists.find(l => l.name === 'Inbox');
        if (!inbox) throw new Error("Inbox not found, cannot delete list.");

        // Move tasks to inbox or mark them appropriately
        db.execute(`
            UPDATE tasks 
            SET list_id = CASE 
                WHEN list_name = 'Trash' THEN NULL 
                ELSE ?
            END,
            list_name = CASE 
                WHEN list_name = 'Trash' THEN list_name
                ELSE ?
            END,
            updated_at = ?
            WHERE list_id = ?
        `, [inbox.id, inbox.name, now, listId]).then(() => {
            // 更新任务缓存
            this.tasksCache.forEach(task => {
                if (task.listId === listId) {
                    if (task.listName === 'Trash') {
                        task.listId = null;
                    } else {
                        task.listId = inbox.id;
                        task.listName = inbox.name;
                    }
                    task.updatedAt = now;
                }
            });
        }).catch(error => {
            console.error('Failed to move tasks:', error);
        });

        // Delete the list
        db.execute('DELETE FROM lists WHERE id = ?', [listId]).then(() => {
            // 更新列表缓存
            this.listsCache = this.listsCache.filter(l => l.id !== listId);
        }).catch(error => {
            console.error('Failed to delete list:', error);
        });

        return { message: "List deleted successfully" };
    }

    updateLists(lists: List[]): List[] {
        const db = this.getDb();
        const now = Date.now();

        // Clear existing lists and insert new ones
        db.execute('DELETE FROM lists').then(() => {
            lists.forEach(list => {
                db.execute(
                    'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [list.id, list.name, list.icon || null, list.color || null, list.order || 0, now, now]
                ).catch(error => {
                    console.error('Failed to insert list:', error);
                });
            });

            // 更新缓存
            this.listsCache = lists;
        }).catch(error => {
            console.error('Failed to clear lists:', error);
        });

        return lists;
    }

    // Tasks
    fetchTasks(): Task[] {
        if (!this.isDataLoaded) {
            console.warn('Data not yet loaded, returning empty array');
            return [];
        }
        return this.tasksCache;
    }

    async fetchTasksAsync(): Promise<Task[]> {
        const db = this.getDb();

        try {
            const dbTasks = await db.select<DbTask[]>('SELECT * FROM tasks ORDER BY "order", created_at');
            const dbSubtasks = await db.select<DbSubtask[]>('SELECT * FROM subtasks ORDER BY parent_id, "order"');

            // Group subtasks by parent_id
            const subtasksByParent: Record<string, Subtask[]> = {};
            dbSubtasks.forEach(dbSubtask => {
                const subtask = this.mapDbSubtaskToSubtask(dbSubtask);
                if (!subtasksByParent[dbSubtask.parent_id]) {
                    subtasksByParent[dbSubtask.parent_id] = [];
                }
                subtasksByParent[dbSubtask.parent_id].push(subtask);
            });

            const tasks = dbTasks.map(dbTask => {
                const task = this.mapDbTaskToTask(dbTask);
                task.subtasks = subtasksByParent[task.id] || [];
                return task;
            });

            this.tasksCache = tasks;
            return tasks;
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
            return [];
        }
    }

    createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'groupCategory'>): Task {
        const db = this.getDb();
        const now = Date.now();
        const id = `task-${now}-${Math.random()}`;

        const newTask: Task = {
            ...taskData,
            id,
            createdAt: now,
            updatedAt: now,
            groupCategory: 'nodate',
        };

        db.execute(`
            INSERT INTO tasks (
                id, title, completed, completed_at, complete_percentage, due_date, 
                list_id, list_name, content, "order", created_at, updated_at, 
                tags, priority, group_category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            newTask.id,
            newTask.title,
            newTask.completed ? 1 : 0,
            newTask.completedAt,
            newTask.completePercentage,
            newTask.dueDate || null,
            newTask.listId,
            newTask.listName,
            newTask.content || null,
            newTask.order,
            newTask.createdAt,
            newTask.updatedAt,
            newTask.tags ? JSON.stringify(newTask.tags) : null,
            newTask.priority,
            newTask.groupCategory
        ]).then(() => {
            this.tasksCache.push(newTask);
        }).catch(error => {
            console.error('Failed to create task:', error);
        });

        return newTask;
    }

    updateTask(taskId: string, updates: Partial<Task>): Task {
        const db = this.getDb();
        const now = Date.now();

        // Build dynamic update query
        const updateFields = [];
        const values = [];

        Object.entries(updates).forEach(([key, value]) => {
            switch (key) {
                case 'title':
                    updateFields.push('title = ?');
                    values.push(value);
                    break;
                case 'completed':
                    updateFields.push('completed = ?');
                    values.push(value ? 1 : 0);
                    break;
                case 'completedAt':
                    updateFields.push('completed_at = ?');
                    values.push(value);
                    break;
                case 'completePercentage':
                    updateFields.push('complete_percentage = ?');
                    values.push(value);
                    break;
                case 'dueDate':
                    updateFields.push('due_date = ?');
                    values.push(value);
                    break;
                case 'listId':
                    updateFields.push('list_id = ?');
                    values.push(value);
                    break;
                case 'listName':
                    updateFields.push('list_name = ?');
                    values.push(value);
                    break;
                case 'content':
                    updateFields.push('content = ?');
                    values.push(value);
                    break;
                case 'order':
                    updateFields.push('"order" = ?');
                    values.push(value);
                    break;
                case 'tags':
                    updateFields.push('tags = ?');
                    values.push(value ? JSON.stringify(value) : null);
                    break;
                case 'priority':
                    updateFields.push('priority = ?');
                    values.push(value);
                    break;
                case 'groupCategory':
                    updateFields.push('group_category = ?');
                    values.push(value);
                    break;
            }
        });

        if (updateFields.length === 0) {
            // No valid fields to update, just return existing task
            const tasks = this.fetchTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) throw new Error("Task not found");
            return task;
        }

        updateFields.push('updated_at = ?');
        values.push(now, taskId);

        db.execute(
            `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        ).then(() => {
            // 更新缓存
            const index = this.tasksCache.findIndex(t => t.id === taskId);
            if (index !== -1) {
                this.tasksCache[index] = { ...this.tasksCache[index], ...updates, updatedAt: now };
            }
        }).catch(error => {
            console.error('Failed to update task:', error);
        });

        // Return updated task
        const currentTasks = this.fetchTasks();
        const updatedTask = currentTasks.find(t => t.id === taskId);
        if (!updatedTask) throw new Error("Task not found");

        return { ...updatedTask, ...updates, updatedAt: now };
    }

    deleteTask(taskId: string): void {
        const db = this.getDb();

        // Delete subtasks first
        db.execute('DELETE FROM subtasks WHERE parent_id = ?', [taskId]).then(() => {
            // Delete the task
            return db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
        }).then(() => {
            // 更新缓存
            this.tasksCache = this.tasksCache.filter(t => t.id !== taskId);
        }).catch(error => {
            console.error('Failed to delete task:', error);
        });
    }

    updateTasks(tasks: Task[]): Task[] {
        const db = this.getDb();
        const now = Date.now();

        // Clear existing tasks and subtasks, then insert new ones
        db.execute('DELETE FROM subtasks').then(() => {
            return db.execute('DELETE FROM tasks');
        }).then(() => {
            tasks.forEach(task => {
                // Insert task
                db.execute(`
                    INSERT INTO tasks (
                        id, title, completed, completed_at, complete_percentage, due_date, 
                        list_id, list_name, content, "order", created_at, updated_at, 
                        tags, priority, group_category
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    task.id,
                    task.title,
                    task.completed ? 1 : 0,
                    task.completedAt,
                    task.completePercentage,
                    task.dueDate || null,
                    task.listId,
                    task.listName,
                    task.content || null,
                    task.order,
                    task.createdAt || now,
                    task.updatedAt || now,
                    task.tags ? JSON.stringify(task.tags) : null,
                    task.priority,
                    task.groupCategory
                ]).then(() => {
                    // Insert subtasks
                    if (task.subtasks) {
                        task.subtasks.forEach(subtask => {
                            db.execute(`
                                INSERT INTO subtasks (
                                    id, parent_id, title, completed, completed_at, 
                                    due_date, "order", created_at, updated_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                subtask.id,
                                subtask.parentId,
                                subtask.title,
                                subtask.completed ? 1 : 0,
                                subtask.completedAt,
                                subtask.dueDate || null,
                                subtask.order,
                                subtask.createdAt,
                                subtask.updatedAt
                            ]).catch(error => {
                                console.error('Failed to insert subtask:', error);
                            });
                        });
                    }
                }).catch(error => {
                    console.error('Failed to insert task:', error);
                });
            });

            // 更新缓存
            this.tasksCache = tasks;
        }).catch(error => {
            console.error('Failed to clear tasks:', error);
        });

        return tasks;
    }

    // Subtasks
    createSubtask(taskId: string, subtaskData: { title: string; order: number; dueDate: number | null }): Subtask {
        const db = this.getDb();
        const now = Date.now();
        const id = `subtask-${now}-${Math.random()}`;

        const newSubtask: Subtask = {
            id,
            parentId: taskId,
            title: subtaskData.title,
            completed: false,
            completedAt: null,
            order: subtaskData.order,
            dueDate: subtaskData.dueDate,
            createdAt: now,
            updatedAt: now,
        };

        db.execute(`
            INSERT INTO subtasks (
                id, parent_id, title, completed, completed_at, 
                due_date, "order", created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            newSubtask.id,
            newSubtask.parentId,
            newSubtask.title,
            newSubtask.completed ? 1 : 0,
            newSubtask.completedAt,
            newSubtask.dueDate,
            newSubtask.order,
            newSubtask.createdAt,
            newSubtask.updatedAt
        ]).then(() => {
            // 更新缓存
            const taskIndex = this.tasksCache.findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
                if (!this.tasksCache[taskIndex].subtasks) {
                    this.tasksCache[taskIndex].subtasks = [];
                }
                this.tasksCache[taskIndex].subtasks!.push(newSubtask);
            }
        }).catch(error => {
            console.error('Failed to create subtask:', error);
        });

        return newSubtask;
    }

    updateSubtask(subtaskId: string, updates: Partial<Subtask>): Subtask {
        const db = this.getDb();
        const now = Date.now();

        // Build dynamic update query
        const updateFields = [];
        const values = [];

        Object.entries(updates).forEach(([key, value]) => {
            switch (key) {
                case 'title':
                    updateFields.push('title = ?');
                    values.push(value);
                    break;
                case 'completed':
                    updateFields.push('completed = ?');
                    values.push(value ? 1 : 0);
                    break;
                case 'completedAt':
                    updateFields.push('completed_at = ?');
                    values.push(value);
                    break;
                case 'dueDate':
                    updateFields.push('due_date = ?');
                    values.push(value);
                    break;
                case 'order':
                    updateFields.push('"order" = ?');
                    values.push(value);
                    break;
            }
        });

        if (updateFields.length > 0) {
            updateFields.push('updated_at = ?');
            values.push(now, subtaskId);

            db.execute(
                `UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`,
                values
            ).then(() => {
                // 更新缓存
                for (const task of this.tasksCache) {
                    if (task.subtasks) {
                        const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
                        if (subtaskIndex !== -1) {
                            task.subtasks[subtaskIndex] = { ...task.subtasks[subtaskIndex], ...updates, updatedAt: now };
                            break;
                        }
                    }
                }
            }).catch(error => {
                console.error('Failed to update subtask:', error);
            });
        }

        // Return updated subtask
        const tasks = this.fetchTasks();
        for (const task of tasks) {
            if (task.subtasks) {
                const subtask = task.subtasks.find(s => s.id === subtaskId);
                if (subtask) {
                    return { ...subtask, ...updates, updatedAt: now };
                }
            }
        }
        throw new Error("Subtask not found");
    }

    deleteSubtask(subtaskId: string): void {
        const db = this.getDb();

        db.execute('DELETE FROM subtasks WHERE id = ?', [subtaskId]).then(() => {
            // 更新缓存
            for (const task of this.tasksCache) {
                if (task.subtasks) {
                    const initialLength = task.subtasks.length;
                    task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                    if (task.subtasks.length < initialLength) {
                        break;
                    }
                }
            }
        }).catch(error => {
            console.error('Failed to delete subtask:', error);
        });
    }

    // Summaries
    fetchSummaries(): StoredSummary[] {
        if (!this.isDataLoaded) {
            console.warn('Data not yet loaded, returning empty array');
            return [];
        }
        return this.summariesCache;
    }

    async fetchSummariesAsync(): Promise<StoredSummary[]> {
        const db = this.getDb();

        try {
            const dbSummaries = await db.select<DbSummary[]>('SELECT * FROM summaries ORDER BY created_at DESC');
            const summaries = dbSummaries.map(this.mapDbSummaryToSummary);
            this.summariesCache = summaries;
            return summaries;
        } catch (error) {
            console.error('Failed to fetch summaries:', error);
            return [];
        }
    }

    createSummary(summaryData: Omit<StoredSummary, 'id' | 'createdAt' | 'updatedAt'>): StoredSummary {
        const db = this.getDb();
        const now = Date.now();
        const id = `summary-${now}-${Math.random()}`;

        const newSummary: StoredSummary = {
            ...summaryData,
            id,
            createdAt: now,
            updatedAt: now,
        };

        db.execute(`
            INSERT INTO summaries (
                id, created_at, updated_at, period_key, list_key, task_ids, summary_text
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            newSummary.id,
            newSummary.createdAt,
            newSummary.updatedAt,
            newSummary.periodKey,
            newSummary.listKey,
            JSON.stringify(newSummary.taskIds),
            newSummary.summaryText
        ]).then(() => {
            this.summariesCache.unshift(newSummary);
        }).catch(error => {
            console.error('Failed to create summary:', error);
        });

        return newSummary;
    }

    updateSummary(summaryId: string, updates: Partial<StoredSummary>): StoredSummary {
        const db = this.getDb();
        const now = Date.now();

        // Build dynamic update query
        const updateFields = [];
        const values = [];

        Object.entries(updates).forEach(([key, value]) => {
            switch (key) {
                case 'periodKey':
                    updateFields.push('period_key = ?');
                    values.push(value);
                    break;
                case 'listKey':
                    updateFields.push('list_key = ?');
                    values.push(value);
                    break;
                case 'taskIds':
                    updateFields.push('task_ids = ?');
                    values.push(JSON.stringify(value));
                    break;
                case 'summaryText':
                    updateFields.push('summary_text = ?');
                    values.push(value);
                    break;
            }
        });

        if (updateFields.length > 0) {
            updateFields.push('updated_at = ?');
            values.push(now, summaryId);

            db.execute(
                `UPDATE summaries SET ${updateFields.join(', ')} WHERE id = ?`,
                values
            ).then(() => {
                // 更新缓存
                const index = this.summariesCache.findIndex(s => s.id === summaryId);
                if (index !== -1) {
                    this.summariesCache[index] = { ...this.summariesCache[index], ...updates, updatedAt: now };
                }
            }).catch(error => {
                console.error('Failed to update summary:', error);
            });
        }

        // Return updated summary
        const summaries = this.fetchSummaries();
        const summary = summaries.find(s => s.id === summaryId);
        if (!summary) throw new Error("Summary not found");

        return { ...summary, ...updates, updatedAt: now };
    }

    updateSummaries(summaries: StoredSummary[]): StoredSummary[] {
        const db = this.getDb();

        // Clear existing summaries and insert new ones
        db.execute('DELETE FROM summaries').then(() => {
            summaries.forEach(summary => {
                db.execute(`
                    INSERT INTO summaries (
                        id, created_at, updated_at, period_key, list_key, task_ids, summary_text
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    summary.id,
                    summary.createdAt,
                    summary.updatedAt,
                    summary.periodKey,
                    summary.listKey,
                    JSON.stringify(summary.taskIds),
                    summary.summaryText
                ]).catch(error => {
                    console.error('Failed to insert summary:', error);
                });
            });

            // 更新缓存
            this.summariesCache = summaries;
        }).catch(error => {
            console.error('Failed to clear summaries:', error);
        });

        return summaries;
    }

    // Helper methods to map database records to app types
    private mapDbListToList(dbList: DbList): List {
        return {
            id: dbList.id,
            name: dbList.name,
            icon: dbList.icon,
            color: dbList.color,
            order: dbList.order,
        };
    }

    private mapDbTaskToTask(dbTask: DbTask): Task {
        return {
            id: dbTask.id,
            title: dbTask.title,
            completed: Boolean(dbTask.completed),
            completedAt: dbTask.completed_at,
            completePercentage: dbTask.complete_percentage,
            dueDate: dbTask.due_date,
            listId: dbTask.list_id,
            listName: dbTask.list_name,
            content: dbTask.content || undefined,
            order: dbTask.order,
            createdAt: dbTask.created_at,
            updatedAt: dbTask.updated_at,
            tags: dbTask.tags ? JSON.parse(dbTask.tags) : undefined,
            priority: dbTask.priority,
            groupCategory: dbTask.group_category as any,
            subtasks: [], // Will be populated separately
        };
    }

    private mapDbSubtaskToSubtask(dbSubtask: DbSubtask): Subtask {
        return {
            id: dbSubtask.id,
            parentId: dbSubtask.parent_id,
            title: dbSubtask.title,
            completed: Boolean(dbSubtask.completed),
            completedAt: dbSubtask.completed_at,
            dueDate: dbSubtask.due_date,
            order: dbSubtask.order,
            createdAt: dbSubtask.created_at,
            updatedAt: dbSubtask.updated_at,
        };
    }

    private mapDbSummaryToSummary(dbSummary: DbSummary): StoredSummary {
        return {
            id: dbSummary.id,
            createdAt: dbSummary.created_at,
            updatedAt: dbSummary.updated_at,
            periodKey: dbSummary.period_key,
            listKey: dbSummary.list_key,
            taskIds: JSON.parse(dbSummary.task_ids),
            summaryText: dbSummary.summary_text,
        };
    }
}