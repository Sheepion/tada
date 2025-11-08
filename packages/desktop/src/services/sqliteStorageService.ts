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

// 批量操作队列
interface BatchOperation {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: any;
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

    // 批量操作相关
    private batchQueue: BatchOperation[] = [];
    private batchTimeout: NodeJS.Timeout | null = null;
    private readonly BATCH_DELAY = 100; // 100ms 批处理延迟
    private readonly BATCH_SIZE = 50; // 每批最多50个操作

    // 写入队列
    private writeQueue: Array<() => Promise<void>> = [];
    private isProcessingQueue = false;

    async initialize(): Promise<void> {
        try {
            this.db = await Database.load('sqlite:tada.db');
            console.log('Database connected successfully');

            // 验证并创建索引（如果不存在）
            await this.ensureIndexes();

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

    // 确保索引存在
    private async ensureIndexes(): Promise<void> {
        const db = this.getDb();

        try {
            // 这些索引应该已在迁移中创建，这里是额外保障
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_subtasks_parent_id ON subtasks(parent_id)');
            await db.execute('CREATE INDEX IF NOT EXISTS idx_summaries_period_list ON summaries(period_key, list_key)');
        } catch (error) {
            console.error('Failed to ensure indexes:', error);
        }
    }

    async preloadData(): Promise<void> {
        if (this.isDataLoaded) return;

        try {
            // 并行加载所有数据
            const [lists, tasks, summaries, settings] = await Promise.all([
                this.fetchListsAsync(),
                this.fetchTasksAsync(),
                this.fetchSummariesAsync(),
                this.fetchSettingsAsync()
            ]);

            this.listsCache = lists;
            this.tasksCache = tasks;
            this.summariesCache = summaries;
            this.settingsCache = settings;
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

    // 批量处理队列
    private scheduleBatchProcess(): void {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.processBatchQueue();
        }, this.BATCH_DELAY);
    }

    private async processBatchQueue(): Promise<void> {
        if (this.batchQueue.length === 0) return;

        const operations = this.batchQueue.splice(0, this.BATCH_SIZE);
        const db = this.getDb();

        try {
            // 使用事务批量执行
            await db.execute('BEGIN TRANSACTION');

            for (const op of operations) {
                try {
                    await this.executeOperation(op);
                } catch (error) {
                    console.error('Failed to execute batch operation:', op, error);
                }
            }

            await db.execute('COMMIT');
        } catch (error) {
            await db.execute('ROLLBACK');
            console.error('Batch processing failed:', error);
        }

        // 如果还有剩余操作，继续处理
        if (this.batchQueue.length > 0) {
            this.scheduleBatchProcess();
        }
    }

    private async executeOperation(op: BatchOperation): Promise<void> {
        const db = this.getDb();

        switch (op.type) {
            case 'insert':
                // 根据表名执行插入
                if (op.table === 'tasks') {
                    await this.insertTask(op.data);
                } else if (op.table === 'lists') {
                    await this.insertList(op.data);
                }
                break;
            case 'update':
                if (op.table === 'tasks') {
                    await this.updateTaskInDb(op.data.id, op.data.updates);
                } else if (op.table === 'lists') {
                    await this.updateListInDb(op.data.id, op.data.updates);
                }
                break;
            case 'delete':
                await db.execute(`DELETE FROM ${op.table} WHERE id = ?`, [op.data.id]);
                break;
        }
    }

    // 队列化写入操作
    private async queueWrite(operation: () => Promise<void>): Promise<void> {
        this.writeQueue.push(operation);

        if (!this.isProcessingQueue) {
            this.processWriteQueue();
        }
    }

    private async processWriteQueue(): Promise<void> {
        this.isProcessingQueue = true;

        while (this.writeQueue.length > 0) {
            const operation = this.writeQueue.shift();
            if (operation) {
                try {
                    await operation();
                } catch (error) {
                    console.error('Write operation failed:', error);
                }
            }
        }

        this.isProcessingQueue = false;
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
        if (this.settingsCache) {
            this.settingsCache.appearance = settings;
        }

        // 异步写入数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                ['appearance', JSON.stringify(settings), now]
            );
        });

        return settings;
    }

    updatePreferencesSettings(settings: PreferencesSettings): PreferencesSettings {
        if (this.settingsCache) {
            this.settingsCache.preferences = settings;
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                ['preferences', JSON.stringify(settings), now]
            );
        });

        return settings;
    }

    updateAISettings(settings: AISettings): AISettings {
        if (this.settingsCache) {
            this.settingsCache.ai = settings;
        }

        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();
            await db.execute(
                'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
                ['ai', JSON.stringify(settings), now]
            );
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
        const now = Date.now();
        const id = `list-${now}-${Math.random()}`;

        const newList: List = {
            id,
            name: listData.name,
            icon: listData.icon || 'list',
            color: null,
            order: now,
        };

        // 立即更新缓存
        this.listsCache.push(newList);

        // 异步写入数据库
        this.queueWrite(async () => {
            await this.insertList(newList);
        });

        return newList;
    }

    private async insertList(list: List): Promise<void> {
        const db = this.getDb();
        const now = Date.now();
        await db.execute(
            'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [list.id, list.name, list.icon, list.color, list.order, now, now]
        );
    }

    updateList(listId: string, updates: Partial<List>): List {
        const index = this.listsCache.findIndex(l => l.id === listId);
        if (index === -1) throw new Error("List not found");

        const originalName = this.listsCache[index].name;
        this.listsCache[index] = { ...this.listsCache[index], ...updates };

        // 异步更新数据库
        this.queueWrite(async () => {
            await this.updateListInDb(listId, updates);

            // 如果名称变更，更新相关任务
            if (updates.name && updates.name !== originalName) {
                const now = Date.now();
                await this.getDb().execute(
                    'UPDATE tasks SET list_name = ?, updated_at = ? WHERE list_id = ?',
                    [updates.name, now, listId]
                );

                // 更新任务缓存
                this.tasksCache.forEach(task => {
                    if (task.listId === listId) {
                        task.listName = updates.name!;
                        task.updatedAt = now;
                    }
                });
            }
        });

        return this.listsCache[index];
    }

    private async updateListInDb(listId: string, updates: Partial<List>): Promise<void> {
        const db = this.getDb();
        const now = Date.now();

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

        if (updateFields.length === 0) return;

        updateFields.push('updated_at = ?');
        values.push(now, listId);

        await db.execute(
            `UPDATE lists SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );
    }

    deleteList(listId: string): { message: string } {
        const listToDelete = this.listsCache.find(l => l.id === listId);
        if (!listToDelete) throw new Error("List not found");
        if (listToDelete.name === 'Inbox') throw new Error("Cannot delete Inbox");

        const inbox = this.listsCache.find(l => l.name === 'Inbox');
        if (!inbox) throw new Error("Inbox not found, cannot delete list.");

        // 立即更新缓存
        this.listsCache = this.listsCache.filter(l => l.id !== listId);

        // 更新任务缓存
        this.tasksCache.forEach(task => {
            if (task.listId === listId) {
                if (task.listName === 'Trash') {
                    task.listId = null;
                } else {
                    task.listId = inbox.id;
                    task.listName = inbox.name;
                }
                task.updatedAt = Date.now();
            }
        });

        // 异步删除数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                // 移动任务
                await db.execute(`
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
                `, [inbox.id, inbox.name, now, listId]);

                // 删除列表
                await db.execute('DELETE FROM lists WHERE id = ?', [listId]);

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                throw error;
            }
        });

        return { message: "List deleted successfully" };
    }

    updateLists(lists: List[]): List[] {
        // 立即更新缓存
        this.listsCache = lists;

        // 异步批量更新数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM lists');

                for (const list of lists) {
                    await db.execute(
                        'INSERT INTO lists (id, name, icon, color, "order", created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [list.id, list.name, list.icon || null, list.color || null, list.order || 0, now, now]
                    );
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Failed to update lists:', error);
            }
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
            // 优化查询：使用索引
            const [dbTasks, dbSubtasks] = await Promise.all([
                db.select<DbTask[]>('SELECT * FROM tasks ORDER BY "order", created_at'),
                db.select<DbSubtask[]>('SELECT * FROM subtasks ORDER BY parent_id, "order"')
            ]);

            // 分组子任务
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
        const now = Date.now();
        const id = `task-${now}-${Math.random()}`;

        const newTask: Task = {
            ...taskData,
            id,
            createdAt: now,
            updatedAt: now,
            groupCategory: 'nodate',
        };

        // 立即更新缓存
        this.tasksCache.push(newTask);

        // 异步写入数据库
        this.queueWrite(async () => {
            await this.insertTask(newTask);
        });

        return newTask;
    }

    private async insertTask(task: Task): Promise<void> {
        const db = this.getDb();
        await db.execute(`
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
            task.createdAt,
            task.updatedAt,
            task.tags ? JSON.stringify(task.tags) : null,
            task.priority,
            task.groupCategory
        ]);
    }

    updateTask(taskId: string, updates: Partial<Task>): Task {
        const index = this.tasksCache.findIndex(t => t.id === taskId);
        if (index === -1) throw new Error("Task not found");

        const now = Date.now();
        this.tasksCache[index] = { ...this.tasksCache[index], ...updates, updatedAt: now };

        // 异步更新数据库
        this.queueWrite(async () => {
            await this.updateTaskInDb(taskId, updates);
        });

        return this.tasksCache[index];
    }

    private async updateTaskInDb(taskId: string, updates: Partial<Task>): Promise<void> {
        const db = this.getDb();
        const now = Date.now();

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

        if (updateFields.length === 0) return;

        updateFields.push('updated_at = ?');
        values.push(now, taskId);

        await db.execute(
            `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );
    }

    deleteTask(taskId: string): void {
        // 立即更新缓存
        this.tasksCache = this.tasksCache.filter(t => t.id !== taskId);

        // 异步删除数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM subtasks WHERE parent_id = ?', [taskId]);
                await db.execute('DELETE FROM tasks WHERE id = ?', [taskId]);
                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                throw error;
            }
        });
    }

    updateTasks(tasks: Task[]): Task[] {
        // 立即更新缓存
        this.tasksCache = tasks;

        // 异步批量更新数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM subtasks');
                await db.execute('DELETE FROM tasks');

                for (const task of tasks) {
                    await db.execute(`
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
                    ]);

                    if (task.subtasks) {
                        for (const subtask of task.subtasks) {
                            await db.execute(`
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
                            ]);
                        }
                    }
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Failed to update tasks:', error);
            }
        });

        return tasks;
    }

    // 新增：批量更新任务（性能优化）
    async batchUpdateTasks(tasks: Task[]): Promise<void> {
        // 立即更新缓存
        this.tasksCache = tasks;

        // 异步批量更新（使用事务）
        await this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                // 使用准备语句批量更新
                for (const task of tasks) {
                    await db.execute(`
                        INSERT OR REPLACE INTO tasks (
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
                    ]);

                    // 更新子任务
                    if (task.subtasks) {
                        // 先删除旧的子任务
                        await db.execute('DELETE FROM subtasks WHERE parent_id = ?', [task.id]);

                        // 插入新的子任务
                        for (const subtask of task.subtasks) {
                            await db.execute(`
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
                            ]);
                        }
                    }
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Batch update tasks failed:', error);
                throw error;
            }
        });
    }

    // 新增：批量更新列表（性能优化）
    async batchUpdateLists(lists: List[]): Promise<void> {
        this.listsCache = lists;

        await this.queueWrite(async () => {
            const db = this.getDb();
            const now = Date.now();

            await db.execute('BEGIN TRANSACTION');
            try {
                for (const list of lists) {
                    await db.execute(`
                        INSERT OR REPLACE INTO lists (
                            id, name, icon, color, "order", created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        list.id,
                        list.name,
                        list.icon || null,
                        list.color || null,
                        list.order || 0,
                        now,
                        now
                    ]);
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Batch update lists failed:', error);
                throw error;
            }
        });
    }

    // 新增：强制刷新所有待处理的写入
    async flush(): Promise<void> {
        // 处理批量队列
        if (this.batchQueue.length > 0) {
            await this.processBatchQueue();
        }

        // 处理写入队列
        await this.processWriteQueue();
    }

    // Subtasks
    createSubtask(taskId: string, subtaskData: { title: string; order: number; dueDate: number | null }): Subtask {
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

        // 立即更新缓存
        const taskIndex = this.tasksCache.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            if (!this.tasksCache[taskIndex].subtasks) {
                this.tasksCache[taskIndex].subtasks = [];
            }
            this.tasksCache[taskIndex].subtasks!.push(newSubtask);
        }

        // 异步写入数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`
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
            ]);
        });

        return newSubtask;
    }

    updateSubtask(subtaskId: string, updates: Partial<Subtask>): Subtask {
        const now = Date.now();
        let updatedSubtask: Subtask | undefined;

        // 立即更新缓存
        for (const task of this.tasksCache) {
            if (task.subtasks) {
                const subtaskIndex = task.subtasks.findIndex(s => s.id === subtaskId);
                if (subtaskIndex !== -1) {
                    updatedSubtask = { ...task.subtasks[subtaskIndex], ...updates, updatedAt: now };
                    task.subtasks[subtaskIndex] = updatedSubtask;
                    break;
                }
            }
        }

        if (!updatedSubtask) throw new Error("Subtask not found");

        // 异步更新数据库
        this.queueWrite(async () => {
            const db = this.getDb();
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

                await db.execute(
                    `UPDATE subtasks SET ${updateFields.join(', ')} WHERE id = ?`,
                    values
                );
            }
        });

        return updatedSubtask;
    }

    deleteSubtask(subtaskId: string): void {
        // 立即更新缓存
        for (const task of this.tasksCache) {
            if (task.subtasks) {
                const initialLength = task.subtasks.length;
                task.subtasks = task.subtasks.filter(s => s.id !== subtaskId);
                if (task.subtasks.length < initialLength) {
                    break;
                }
            }
        }

        // 异步删除数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute('DELETE FROM subtasks WHERE id = ?', [subtaskId]);
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
        const now = Date.now();
        const id = `summary-${now}-${Math.random()}`;

        const newSummary: StoredSummary = {
            ...summaryData,
            id,
            createdAt: now,
            updatedAt: now,
        };

        // 立即更新缓存
        this.summariesCache.unshift(newSummary);

        // 异步写入数据库
        this.queueWrite(async () => {
            const db = this.getDb();
            await db.execute(`
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
            ]);
        });

        return newSummary;
    }

    updateSummary(summaryId: string, updates: Partial<StoredSummary>): StoredSummary {
        const now = Date.now();
        const index = this.summariesCache.findIndex(s => s.id === summaryId);
        if (index === -1) throw new Error("Summary not found");

        this.summariesCache[index] = { ...this.summariesCache[index], ...updates, updatedAt: now };

        // 异步更新数据库
        this.queueWrite(async () => {
            const db = this.getDb();
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

                await db.execute(
                    `UPDATE summaries SET ${updateFields.join(', ')} WHERE id = ?`,
                    values
                );
            }
        });

        return this.summariesCache[index];
    }

    updateSummaries(summaries: StoredSummary[]): StoredSummary[] {
        // 立即更新缓存
        this.summariesCache = summaries;

        // 异步批量更新数据库
        this.queueWrite(async () => {
            const db = this.getDb();

            await db.execute('BEGIN TRANSACTION');
            try {
                await db.execute('DELETE FROM summaries');

                for (const summary of summaries) {
                    await db.execute(`
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
                    ]);
                }

                await db.execute('COMMIT');
            } catch (error) {
                await db.execute('ROLLBACK');
                console.error('Failed to update summaries:', error);
            }
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