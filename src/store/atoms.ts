// src/store/atoms.ts
import {atom, WritableAtom} from 'jotai';
import {RESET} from 'jotai/utils';
import {
    AppearanceSettings,
    PreferencesSettings,
    SettingsTab,
    StoredSummary,
    Task,
    TaskFilter,
    TaskGroupCategory,
    User
} from '@/types';
import {
    addDays,
    endOfDay,
    endOfMonth,
    endOfWeek,
    isAfter,
    isBefore,
    isSameDay,
    isValid,
    isWithinNext7Days,
    safeParseDate,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks
} from '@/utils/dateUtils';
import {APP_THEMES, PREDEFINED_BACKGROUND_IMAGES} from "@/config/themes";
import * as service from '@/services/apiService'; // Renamed to avoid conflict

// --- Helper type for async data atoms ---
// TData is the type of the data itself (e.g., Task[], AppearanceSettings)
// TUpdate is the type of the update argument for the write function (e.g., Task[] | ((prev: Task[]) => Task[]))
type AsyncDataAtom<TData, TUpdate = TData | ((prev: TData) => TData) | typeof RESET> = WritableAtom<
    TData | null, // Read value can be null during loading/error
    [TUpdate],    // Write value (update argument)
    Promise<void> // Write result (async)
>;


// --- Initial Data Structure Simulators (Exported for apiService simulation) ---
const createInitialRawTasks = (): Omit<Task, 'groupCategory' | 'completed' | 'completedAt'>[] => [
    {
        id: '11',
        title: '体检预约',
        completionPercentage: 60,
        dueDate: subDays(startOfDay(new Date()), 2).setHours(10, 0, 0, 0),
        list: 'Personal',
        content: 'Called the clinic, waiting for callback.\n\n- Follow up on Friday if no response.\n- Check fasting requirements.',
        order: 7,
        createdAt: subDays(new Date(), 4).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: 1,
        tags: ['health', 'appointment'],
        subtasks: [
            {
                id: 'sub11-1',
                parentId: '11',
                title: 'Call Dr. Smith\'s office',
                completed: true,
                completedAt: subDays(new Date(), 3).getTime(),
                order: 0,
                createdAt: subDays(new Date(), 4).getTime(),
                updatedAt: subDays(new Date(), 3).getTime(),
                dueDate: subDays(startOfDay(new Date()), 3).setHours(9, 0, 0, 0),
            },
            {
                id: 'sub11-2',
                parentId: '11',
                title: 'Confirm insurance coverage for annual check-up and blood work',
                completed: false,
                completedAt: null,
                order: 1,
                createdAt: subDays(new Date(), 4).getTime(),
                updatedAt: subDays(new Date(), 1).getTime(),
                dueDate: subDays(startOfDay(new Date()), 2).setHours(14, 0, 0, 0),
            },
        ]
    },
    {
        id: '1',
        title: '施工组织设计评审表',
        completionPercentage: 60,
        dueDate: new Date().setHours(14, 0, 0, 0),
        list: 'Work',
        content: 'Review the construction plan details. Focus on safety section.\n\nKey points to check:\n- Emergency evacuation plan\n- PPE requirements\n- Hazard identification',
        order: 0,
        createdAt: subDays(new Date(), 3).getTime(),
        updatedAt: subDays(new Date(), 3).getTime(),
        priority: 1,
        tags: ['review', 'urgent'],
        subtasks: [
            {
                id: 'sub1-1',
                parentId: '1',
                title: 'Check safety compliance checklist (Sections A-C)',
                completed: true,
                completedAt: new Date().getTime(),
                order: 0,
                createdAt: subDays(new Date(), 1).getTime(),
                updatedAt: new Date().getTime(),
                dueDate: new Date().setHours(10, 0, 0, 0)
            },
            {
                id: 'sub1-2',
                parentId: '1',
                title: 'Verify material specifications against approved list',
                completed: false,
                completedAt: null,
                order: 1,
                createdAt: subDays(new Date(), 1).getTime(),
                updatedAt: subDays(new Date(), 1).getTime(),
                dueDate: new Date().setHours(11, 30, 0, 0)
            },
            {
                id: 'sub1-3',
                parentId: '1',
                title: 'Write feedback summary for presentation',
                completed: false,
                completedAt: null,
                order: 2,
                createdAt: subDays(new Date(), 1).getTime(),
                updatedAt: subDays(new Date(), 1).getTime(),
            },
        ]
    },
    {
        id: '8',
        title: '准备明天会议材料 (已完成)',
        completionPercentage: 100,
        dueDate: new Date().setHours(18, 0, 0, 0),
        list: 'Work',
        content: 'Finalize slides, add Q&A section. Print 5 copies.',
        order: 1,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 1,
        tags: ['meeting', 'preparation'],
    },
    {
        id: '2',
        title: '开发框架讲解',
        completionPercentage: 30,
        dueDate: addDays(startOfDay(new Date()), 1).setHours(10, 30, 0, 0),
        list: 'Work',
        content: 'Prepare slides for the team meeting. Outline done.\n\nInclude:\n- Core concepts\n- Best practices\n- Common pitfalls',
        order: 2,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 2,
        tags: ['development', 'presentation', 'tada', 'tjweather', 'atmos']
    },
    {
        id: '10',
        title: '研究 CodeMirror Themes',
        completionPercentage: 60,
        dueDate: null,
        list: 'Dev',
        content: 'Found a few potential themes, need to test compatibility with current setup.\n\nConsiderations:\n- Light/Dark mode support\n- Readability\n- Performance',
        order: 5,
        createdAt: subDays(new Date(), 2).getTime(),
        updatedAt: new Date().getTime(),
        priority: 3,
        tags: ['codemirror', 'frontend', 'research']
    },
    {
        id: '13',
        title: '欢迎加入Tada',
        completionPercentage: 0,
        dueDate: null,
        list: 'Inbox',
        content: 'Try creating your first task! You can add subtasks too, and set precise due dates with times.',
        order: 12,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: null,
        tags: ['welcome']
    },
];

export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    if (task.completed || task.list === 'Trash') {
        return 'nodate';
    }
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) return 'nodate';

        const today = startOfDay(new Date());
        const taskDay = startOfDay(dueDateObj);

        if (isBefore(taskDay, today)) return 'overdue';
        if (isSameDay(taskDay, today)) return 'today';
        if (isWithinNext7Days(taskDay)) return 'next7days';
        return 'later';
    }
    return 'nodate';
};

export const initialTasksForApi = (): Task[] => { // Renamed from initialTasks to initialTasksForApi for clarity
    return createInitialRawTasks()
        .map(taskRaw => {
            const now = Date.now();
            const percentage = taskRaw.completionPercentage === 0 ? null : taskRaw.completionPercentage ?? null;
            const isCompleted = percentage === 100;
            let dueDateTimestamp: number | null = null;
            if (taskRaw.dueDate !== null && taskRaw.dueDate !== undefined) {
                const parsedDate = safeParseDate(taskRaw.dueDate);
                if (parsedDate && isValid(parsedDate)) dueDateTimestamp = parsedDate.getTime();
            }
            const subtasks = (taskRaw.subtasks || []).map(subRaw => ({
                ...subRaw,
                createdAt: subRaw.createdAt || now,
                updatedAt: subRaw.updatedAt || now,
                completedAt: subRaw.completed ? (subRaw.completedAt || subRaw.updatedAt || now) : null,
                dueDate: subRaw.dueDate ? safeParseDate(subRaw.dueDate)?.getTime() ?? null : null,
            })).sort((a, b) => a.order - b.order);

            const taskPartial: Omit<Task, 'groupCategory'> = {
                id: taskRaw.id, title: taskRaw.title, completed: isCompleted, completionPercentage: percentage,
                dueDate: dueDateTimestamp, list: taskRaw.list, content: taskRaw.content ?? '', order: taskRaw.order,
                createdAt: taskRaw.createdAt, updatedAt: taskRaw.updatedAt ?? now,
                completedAt: isCompleted ? (taskRaw.updatedAt ?? now) : null,
                tags: taskRaw.tags?.map(tag => tag.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).sort() ?? [],
                priority: taskRaw.priority ?? null, subtasks: subtasks,
            };
            return {...taskPartial, groupCategory: getTaskGroupCategory(taskPartial)};
        })
        .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
};
export const defaultAppearanceSettingsForApi = (): AppearanceSettings => ({
    themeId: APP_THEMES[0].id,
    darkMode: 'system',
    backgroundImageUrl: PREDEFINED_BACKGROUND_IMAGES[0].url,
    backgroundImageBlur: 0,
    backgroundImageBrightness: 100,
    interfaceDensity: 'default',
});
export const defaultPreferencesSettingsForApi = (): PreferencesSettings => ({
    language: 'en',
    defaultNewTaskDueDate: null,
    defaultNewTaskPriority: null,
    defaultNewTaskList: 'Inbox',
    confirmDeletions: true,
});
export const initialUserListsForApi = (): string[] => ['Work', 'Planning', 'Dev', 'Personal'];


// --- User & Auth Atoms ---
const baseCurrentUserAtom = atom<User | null>(null);
export const currentUserLoadingAtom = atom<boolean>(true);
export const currentUserErrorAtom = atom<string | null>(null);

export const currentUserAtom: AsyncDataAtom<User, User | null | typeof RESET | 'logout' | undefined> = atom(
    (get) => get(baseCurrentUserAtom),
    async (get, set, update) => {
        if (update === 'logout') {
            set(currentUserLoadingAtom, true);
            await service.apiLogout();
            set(baseCurrentUserAtom, null);
            set(currentUserLoadingAtom, false);
            // Clear other user-specific persisted data by resetting their atoms
            set(tasksAtom, RESET);
            set(appearanceSettingsAtom, RESET);
            set(preferencesSettingsAtom, RESET);
            set(userDefinedListsAtom, RESET);
            set(storedSummariesAtom, RESET);
            // summarySelectedFieldsAtom might also need reset if user-specific
            // set(summarySelectedFieldsAtom, RESET);
            return;
        }
        if (update === RESET || update === undefined) { // Initial load or explicit reset
            set(currentUserLoadingAtom, true);
            set(currentUserErrorAtom, null);
            try {
                const {success, user, error} = await service.apiFetchCurrentUser();
                if (success && user) {
                    set(baseCurrentUserAtom, user);
                } else {
                    set(baseCurrentUserAtom, null);
                    if (error) set(currentUserErrorAtom, error);
                }
            } catch (e: any) {
                set(currentUserErrorAtom, e.message || 'Failed to fetch user');
                set(baseCurrentUserAtom, null);
            } finally {
                set(currentUserLoadingAtom, false);
            }
            return;
        }
        // If update is a User object (e.g., from login or profile update response)
        if (update !== null && typeof update === 'object' && 'id' in update) {
            set(baseCurrentUserAtom, update as User);
            // Persisting the user object itself usually happens at login/profile update,
            // not by directly setting this atom unless that's the intended flow.
        } else if (update === null) { // Explicitly setting to null (e.g. after a failed auth action)
            set(baseCurrentUserAtom, null);
        }
    }
);
currentUserAtom.onMount = (setSelf) => {
    setSelf(undefined); // Trigger initial fetch
};


// --- Task Atoms ---
const baseTasksDataAtom = atom<Task[] | null>(null); // Can be null initially
export const tasksLoadingAtom = atom<boolean>(true);
export const tasksErrorAtom = atom<string | null>(null);

export const tasksAtom: AsyncDataAtom<Task[], Task[] | ((prev: Task[]) => Task[]) | typeof RESET> = atom(
    (get) => get(baseTasksDataAtom), // Getter returns Task[] | null
    async (get, set, update) => {
        if (update === RESET) {
            set(tasksLoadingAtom, true);
            set(tasksErrorAtom, null);
            try {
                const fetchedTasks = await service.apiFetchTasks();
                set(baseTasksDataAtom, fetchedTasks);
            } catch (e: any) {
                set(tasksErrorAtom, e.message || 'Failed to fetch tasks');
                set(baseTasksDataAtom, []); // Fallback to empty array on fetch error
            } finally {
                set(tasksLoadingAtom, false);
            }
            return;
        }

        const previousTasks = get(baseTasksDataAtom) ?? []; // Handle null case for previousTasks
        const nextTasksRaw = typeof update === 'function' ? (update as (prev: Task[]) => Task[])(previousTasks) : update;
        const now = Date.now();

        const nextTasksProcessed = nextTasksRaw.map(task => {
            const previousTaskState = previousTasks.find(p => p.id === task.id);
            let updatedTask = {...task};

            if (updatedTask.subtasks) {
                updatedTask.subtasks = updatedTask.subtasks.map(sub => {
                    const prevSub = previousTaskState?.subtasks?.find(ps => ps.id === sub.id);
                    let subChanged = !prevSub ||
                        sub.title !== prevSub.title ||
                        sub.completed !== prevSub.completed ||
                        sub.dueDate !== prevSub.dueDate ||
                        sub.order !== prevSub.order;
                    return {
                        ...sub,
                        parentId: updatedTask.id,
                        createdAt: sub.createdAt || now,
                        updatedAt: subChanged ? now : (sub.updatedAt || now),
                        completedAt: sub.completed ? (sub.completedAt || (subChanged ? now : sub.updatedAt) || now) : null,
                    };
                }).sort((a, b) => a.order - b.order);
            } else {
                updatedTask.subtasks = [];
            }

            if (updatedTask.list !== 'Trash') {
                const allSubtasksCompleted = updatedTask.subtasks.length > 0 && updatedTask.subtasks.every(s => s.completed);
                const anySubtaskIncomplete = updatedTask.subtasks.some(s => !s.completed);

                if (allSubtasksCompleted) {
                    if (!updatedTask.completed || updatedTask.completionPercentage !== 100) {
                        updatedTask.completed = true;
                        updatedTask.completionPercentage = 100;
                        updatedTask.completedAt = updatedTask.completedAt || now;
                    }
                } else if (anySubtaskIncomplete) {
                    if (updatedTask.completed && updatedTask.completionPercentage === 100) {
                        updatedTask.completed = false;
                        updatedTask.completionPercentage = null;
                        updatedTask.completedAt = null;
                    }
                }
                if (updatedTask.completed && updatedTask.completionPercentage === 100) {
                    updatedTask.subtasks = updatedTask.subtasks.map(s => s.completed ? s : {
                        ...s,
                        completed: true,
                        completedAt: s.completedAt || now,
                        updatedAt: now
                    });
                }
            }

            let currentPercentage = updatedTask.completionPercentage ?? null;
            let isCompleted = updatedTask.completed;

            if (updatedTask.list === 'Trash') {
                currentPercentage = null;
                isCompleted = false;
            } else {
                if (previousTaskState && updatedTask.completionPercentage !== previousTaskState.completionPercentage && updatedTask.completionPercentage !== undefined) {
                    currentPercentage = updatedTask.completionPercentage === 0 ? null : updatedTask.completionPercentage;
                    isCompleted = currentPercentage === 100;
                } else if (updatedTask.completed !== undefined && updatedTask.completed !== previousTaskState?.completed) {
                    isCompleted = updatedTask.completed;
                    const prevPercentage = previousTaskState?.completionPercentage;
                    currentPercentage = isCompleted ? 100 : (prevPercentage === 100 ? null : (prevPercentage ?? null));
                }
                if (currentPercentage === 100 && !isCompleted) isCompleted = true;
                else if (currentPercentage !== 100 && isCompleted) currentPercentage = 100;
            }

            const newCompletedAt = isCompleted ? (updatedTask.completedAt ?? previousTaskState?.completedAt ?? updatedTask.updatedAt ?? now) : null;

            const validatedTask: Omit<Task, 'groupCategory'> = {
                ...updatedTask,
                content: updatedTask.content ?? '',
                tags: updatedTask.tags?.map(tag => tag.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).sort() ?? [],
                priority: updatedTask.priority ?? null,
                completionPercentage: currentPercentage,
                completed: isCompleted,
                completedAt: newCompletedAt,
                updatedAt: updatedTask.updatedAt ?? (previousTaskState?.updatedAt ?? updatedTask.createdAt),
                subtasks: updatedTask.subtasks,
            };

            const newCategory = getTaskGroupCategory(validatedTask);
            const finalTask = {...validatedTask, groupCategory: newCategory};

            let changed = false;
            if (!previousTaskState) {
                changed = true;
            } else {
                const relevantFields: (keyof Task)[] = ['title', 'completionPercentage', 'completed', 'dueDate', 'list', 'content', 'order', 'priority', 'groupCategory'];
                for (const field of relevantFields) {
                    if (JSON.stringify(finalTask[field]) !== JSON.stringify(previousTaskState[field])) {
                        changed = true;
                        break;
                    }
                }
                if (!changed && JSON.stringify(finalTask.tags?.sort()) !== JSON.stringify(previousTaskState.tags?.sort())) changed = true;
                if (!changed) {
                    const prevSubs = previousTaskState.subtasks || [];
                    const finalSubs = finalTask.subtasks || [];
                    if (prevSubs.length !== finalSubs.length) {
                        changed = true;
                    } else {
                        for (let i = 0; i < finalSubs.length; i++) {
                            if (JSON.stringify(finalSubs[i]) !== JSON.stringify(prevSubs[i])) {
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }
            return changed ? {...finalTask, updatedAt: now} : {...finalTask, updatedAt: previousTaskState!.updatedAt};
        });

        set(baseTasksDataAtom, nextTasksProcessed); // Optimistic update

        try {
            const response = await service.apiUpdateTasks(nextTasksProcessed);
            if (response.success && response.tasks) {
                // set(baseTasksDataAtom, response.tasks); // Update with potentially server-modified tasks
            } else {
                console.error('[TasksAtom] Backend update failed:', response.error);
                set(baseTasksDataAtom, previousTasks); // Revert
                set(tasksErrorAtom, response.error || 'Failed to update tasks on server');
            }
        } catch (e: any) {
            console.error('[TasksAtom] API call failed:', e);
            set(baseTasksDataAtom, previousTasks);
            set(tasksErrorAtom, e.message || 'API call failed during task update');
        }
    }
);
tasksAtom.onMount = (setSelf) => {
    setSelf(RESET); // Trigger initial fetch
};


// --- UI State Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');

// --- Settings Atoms ---
export type DarkModeOption = 'light' | 'dark' | 'system';

const baseAppearanceSettingsAtom = atom<AppearanceSettings | null>(null);
export const appearanceSettingsLoadingAtom = atom<boolean>(true);
export const appearanceSettingsErrorAtom = atom<string | null>(null);

export const appearanceSettingsAtom: AsyncDataAtom<AppearanceSettings> = atom(
    (get) => get(baseAppearanceSettingsAtom),
    async (get, set, newSettingsParam) => {
        if (newSettingsParam === RESET) {
            set(appearanceSettingsLoadingAtom, true);
            set(appearanceSettingsErrorAtom, null);
            try {
                const fetched = await service.apiFetchAppearanceSettings();
                set(baseAppearanceSettingsAtom, fetched);
            } catch (e: any) {
                set(appearanceSettingsErrorAtom, e.message || 'Failed to load appearance settings');
                set(baseAppearanceSettingsAtom, defaultAppearanceSettingsForApi());
            } finally {
                set(appearanceSettingsLoadingAtom, false);
            }
            return;
        }
        const currentSettings = get(baseAppearanceSettingsAtom) ?? defaultAppearanceSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: AppearanceSettings) => AppearanceSettings)(currentSettings) : newSettingsParam;

        set(baseAppearanceSettingsAtom, updatedSettings);
        try {
            const {
                success,
                settings: savedSettings,
                error
            } = await service.apiUpdateAppearanceSettings(updatedSettings);
            if (!success) {
                set(baseAppearanceSettingsAtom, currentSettings);
                set(appearanceSettingsErrorAtom, error || 'Failed to save appearance settings');
            } else if (savedSettings) {
                set(baseAppearanceSettingsAtom, savedSettings); // Update with server response if different
            }
        } catch (e: any) {
            set(baseAppearanceSettingsAtom, currentSettings);
            set(appearanceSettingsErrorAtom, e.message || 'API error saving appearance settings');
        }
    }
);
appearanceSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};


export type DefaultNewTaskDueDate = null | 'today' | 'tomorrow';

const basePreferencesSettingsAtom = atom<PreferencesSettings | null>(null);
export const preferencesSettingsLoadingAtom = atom<boolean>(true);
export const preferencesSettingsErrorAtom = atom<string | null>(null);

export const preferencesSettingsAtom: AsyncDataAtom<PreferencesSettings> = atom(
    (get) => get(basePreferencesSettingsAtom),
    async (get, set, newSettingsParam) => {
        if (newSettingsParam === RESET) {
            set(preferencesSettingsLoadingAtom, true);
            set(preferencesSettingsErrorAtom, null);
            try {
                const fetched = await service.apiFetchPreferencesSettings();
                set(basePreferencesSettingsAtom, fetched);
            } catch (e: any) {
                set(preferencesSettingsErrorAtom, e.message || 'Failed to load preferences');
                set(basePreferencesSettingsAtom, defaultPreferencesSettingsForApi());
            } finally {
                set(preferencesSettingsLoadingAtom, false);
            }
            return;
        }
        const currentSettings = get(basePreferencesSettingsAtom) ?? defaultPreferencesSettingsForApi();
        const updatedSettings = typeof newSettingsParam === 'function' ? (newSettingsParam as (prev: PreferencesSettings) => PreferencesSettings)(currentSettings) : newSettingsParam;

        set(basePreferencesSettingsAtom, updatedSettings);
        try {
            const {
                success,
                settings: savedSettings,
                error
            } = await service.apiUpdatePreferencesSettings(updatedSettings);
            if (!success) {
                set(basePreferencesSettingsAtom, currentSettings);
                set(preferencesSettingsErrorAtom, error || 'Failed to save preferences');
            } else if (savedSettings) {
                set(basePreferencesSettingsAtom, savedSettings);
            }
        } catch (e: any) {
            set(basePreferencesSettingsAtom, currentSettings);
            set(preferencesSettingsErrorAtom, e.message || 'API error saving preferences');
        }
    }
);
preferencesSettingsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};


export type PremiumSettings = {
    tier: 'free' | 'pro';
    subscribedUntil: number | null;
};
export const premiumSettingsAtom = atom(
    (get): PremiumSettings => {
        const user = get(currentUserAtom);
        if (user?.isPremium) {
            const subEndDate = user.id === '1' ? addDays(new Date(), 365).getTime() : null; // Example logic
            return {tier: 'pro', subscribedUntil: subEndDate};
        }
        return {tier: 'free', subscribedUntil: null};
    }
);


// --- User Lists ---
const baseUserDefinedListsAtom = atom<string[] | null>(null);
export const userDefinedListsLoadingAtom = atom<boolean>(true);
export const userDefinedListsErrorAtom = atom<string | null>(null);

export const userDefinedListsAtom: AsyncDataAtom<string[], string[] | ((prev: string[]) => string[]) | typeof RESET> = atom(
    (get) => get(baseUserDefinedListsAtom),
    async (get, set, newListsParam) => {
        if (newListsParam === RESET) {
            set(userDefinedListsLoadingAtom, true);
            set(userDefinedListsErrorAtom, null);
            try {
                const fetched = await service.apiFetchUserLists();
                set(baseUserDefinedListsAtom, fetched);
            } catch (e: any) {
                set(userDefinedListsErrorAtom, e.message || 'Failed to load user lists');
                set(baseUserDefinedListsAtom, initialUserListsForApi());
            } finally {
                set(userDefinedListsLoadingAtom, false);
            }
            return;
        }
        const currentLists = get(baseUserDefinedListsAtom) ?? initialUserListsForApi();
        const updatedLists = typeof newListsParam === 'function' ? (newListsParam as (prev: string[]) => string[])(currentLists) : newListsParam;

        set(baseUserDefinedListsAtom, updatedLists);
        try {
            const {success, lists: savedLists, error} = await service.apiUpdateUserLists(updatedLists);
            if (!success) {
                set(baseUserDefinedListsAtom, currentLists);
                set(userDefinedListsErrorAtom, error || 'Failed to save user lists');
            } else if (savedLists) {
                set(baseUserDefinedListsAtom, savedLists);
            }
        } catch (e: any) {
            set(baseUserDefinedListsAtom, currentLists);
            set(userDefinedListsErrorAtom, e.message || 'API error saving user lists');
        }
    }
);
userDefinedListsAtom.onMount = (setSelf) => {
    setSelf(RESET);
};


// --- Summary View Atoms ---
export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());

const baseStoredSummariesAtom = atom<StoredSummary[] | null>(null);
export const storedSummariesLoadingAtom = atom<boolean>(true);
export const storedSummariesErrorAtom = atom<string | null>(null);

export const storedSummariesAtom: AsyncDataAtom<StoredSummary[], StoredSummary[] | ((prev: StoredSummary[]) => StoredSummary[]) | typeof RESET> = atom(
    (get) => get(baseStoredSummariesAtom),
    async (get, set, update) => {
        if (update === RESET) {
            set(storedSummariesLoadingAtom, true);
            set(storedSummariesErrorAtom, null);
            try {
                const fetched = await service.apiFetchStoredSummaries();
                set(baseStoredSummariesAtom, fetched);
            } catch (e: any) {
                set(storedSummariesErrorAtom, e.message || 'Failed to load summaries');
                set(baseStoredSummariesAtom, []);
            } finally {
                set(storedSummariesLoadingAtom, false);
            }
            return;
        }

        const currentSummaries = get(baseStoredSummariesAtom) ?? [];
        let updatedSummaries = typeof update === 'function' ? (update as (prev: StoredSummary[]) => StoredSummary[])(currentSummaries) : update;

        const isAddingNew = Array.isArray(updatedSummaries) && updatedSummaries.length > 0 &&
            updatedSummaries.length > currentSummaries.length &&
            !currentSummaries.find(cs => cs.id === updatedSummaries[0].id);

        if (isAddingNew) {
            const newSummary = updatedSummaries[0];
            set(baseStoredSummariesAtom, updatedSummaries); // Optimistic
            try {
                const {success, summary: savedSummary, error} = await service.apiSaveSummary(newSummary);
                if (!success || !savedSummary) {
                    set(baseStoredSummariesAtom, currentSummaries); // Revert
                    set(storedSummariesErrorAtom, error || 'Failed to save new summary');
                } else {
                    // Update with server response, important if ID or timestamps changed
                    set(baseStoredSummariesAtom, current => [savedSummary, ...(current?.filter(s => s.id !== savedSummary.id) ?? [])]);
                }
            } catch (e: any) {
                set(baseStoredSummariesAtom, currentSummaries); // Revert
                set(storedSummariesErrorAtom, e.message || 'API error saving new summary');
            }
        } else if (Array.isArray(updatedSummaries)) {
            let changedSummary: StoredSummary | undefined;
            for (const us of updatedSummaries) {
                const cs = currentSummaries.find(s => s.id === us.id);
                if (cs && (us.summaryText !== cs.summaryText || us.updatedAt !== cs.updatedAt)) {
                    changedSummary = us;
                    break;
                }
            }
            if (changedSummary && changedSummary.updatedAt && changedSummary.updatedAt > (currentSummaries.find(s => s.id === changedSummary!.id)?.updatedAt || 0)) {
                set(baseStoredSummariesAtom, updatedSummaries); // Optimistic
                try {
                    const {
                        success,
                        summary: savedSummary,
                        error
                    } = await service.apiUpdateSummary(changedSummary.id, changedSummary.summaryText);
                    if (!success) {
                        set(baseStoredSummariesAtom, currentSummaries);
                        set(storedSummariesErrorAtom, error || `Failed to update summary ${changedSummary.id}`);
                    } else if (savedSummary) {
                        set(baseStoredSummariesAtom, prev => prev!.map(s => s.id === savedSummary.id ? savedSummary : s));
                    }
                } catch (e: any) {
                    set(baseStoredSummariesAtom, currentSummaries);
                    set(storedSummariesErrorAtom, e.message || `API error updating summary ${changedSummary.id}`);
                }
            } else {
                set(baseStoredSummariesAtom, updatedSummaries);
            }
        }
    }
);
storedSummariesAtom.onMount = (setSelf) => {
    setSelf(RESET);
};


export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

export const SUMMARY_FIELD_OPTIONS: { id: string; label: string }[] = [
    {id: 'accomplishments', label: '今日工作总结'},
    {id: 'tomorrowPlan', label: '明日工作计划'},
    {id: 'challenges', label: '遇到的问题与困难'},
    {id: 'teamCommunication', label: '团队沟通情况'},
    {id: 'learnings', label: '学习与成长收获'},
    {id: 'blockers', label: '当前主要瓶颈'},
];
const defaultSelectedSummaryFields = [SUMMARY_FIELD_OPTIONS[0].id, SUMMARY_FIELD_OPTIONS[1].id];

// Persisting summarySelectedFieldsAtom (simplified, assuming it's part of user preferences)
const baseSummarySelectedFieldsAtom = atom<string[]>(defaultSelectedSummaryFields);
export const summarySelectedFieldsAtom: WritableAtom<string[], [string[] | ((prev: string[]) => string[])], Promise<void>> = atom(
    (get) => get(baseSummarySelectedFieldsAtom),
    async (get, set, newFieldsParam) => {
        const currentFields = get(baseSummarySelectedFieldsAtom);
        const updatedFields = typeof newFieldsParam === 'function' ? newFieldsParam(currentFields) : newFieldsParam;
        set(baseSummarySelectedFieldsAtom, updatedFields);
        // This would ideally be part of a larger preferences update or a dedicated API
        console.log("[Store] Simulating update of summary selected fields to backend:", updatedFields);
        // try {
        //    await service.apiUpdateUserPreferences({ summaryFields: updatedFields }); // Example
        // } catch (e) {
        //    set(baseSummarySelectedFieldsAtom, currentFields); // Revert
        // }
    }
);
// summarySelectedFieldsAtom.onMount = (setSelf) => { /* Potentially fetch if stored separately */ };


// --- Derived Atoms ---
export const selectedTaskAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    if (!tasks) return null; // Handle tasks being null during initial load
    return selectedId ? tasks.find(task => task.id === selectedId) ?? null : null;
});

export const userListNamesAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const userListsFromSettings = get(userDefinedListsAtom) ?? [];
    const listsFromTasks = new Set<string>(tasks.filter(t => t.list !== 'Trash' && t.list).map(t => t.list!));
    const combinedLists = new Set(['Inbox', ...userListsFromSettings, ...Array.from(listsFromTasks)]);
    combinedLists.delete('Trash');
    return Array.from(combinedLists).sort((a, b) => a === 'Inbox' ? -1 : b === 'Inbox' ? 1 : a.localeCompare(b));
});

export const userTagNamesAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const tags = new Set<string>();
    tasks.forEach(task => task.tags?.forEach(tag => tags.add(tag.trim())));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
});

export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom) ?? [];
    const allUserListNames = get(userListNamesAtom);
    const allUserTagNames = get(userTagNamesAtom);
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const trashedTasksCount = tasks.length - activeTasks.length;

    const counts = {
        all: 0,
        today: 0,
        next7days: 0,
        completed: 0,
        trash: trashedTasksCount,
        lists: Object.fromEntries(allUserListNames.map(name => [name, 0])),
        tags: Object.fromEntries(allUserTagNames.map(name => [name, 0])),
    };

    activeTasks.forEach(task => {
        if (task.completed) {
            counts.completed++;
        } else {
            counts.all++;
            const taskGroup = getTaskGroupCategory(task);
            if (taskGroup === 'today') counts.today++;
            if (taskGroup === 'next7days') counts.next7days++;

            if (task.list && Object.prototype.hasOwnProperty.call(counts.lists, task.list)) {
                counts.lists[task.list]++;
            }
            task.tags?.forEach(tag => {
                if (Object.prototype.hasOwnProperty.call(counts.tags, tag)) {
                    counts.tags[tag]++;
                }
            });
        }
    });
    return counts;
});

export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    const tasksToGroup = (get(tasksAtom) ?? []).filter(t => t.list !== 'Trash' && !t.completed)
        .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    const groups: Record<TaskGroupCategory, Task[]> = {
        overdue: [], today: [], next7days: [], later: [], nodate: []
    };
    tasksToGroup.forEach(task => {
        const category = task.groupCategory;
        if (Object.prototype.hasOwnProperty.call(groups, category)) {
            groups[category].push(task);
        } else {
            groups.nodate.push(task);
        }
    });
    return groups;
});

export const rawSearchResultsAtom = atom<Task[]>((get) => {
    const search = get(searchTermAtom).trim().toLowerCase();
    if (!search) return [];
    const allTasks = get(tasksAtom) ?? [];
    const searchWords = search.split(' ').filter(Boolean);

    return allTasks.filter(task => {
        return searchWords.every(word => {
            const titleMatch = task.title.toLowerCase().includes(word);
            const contentMatch = task.content && task.content.toLowerCase().includes(word);
            const tagsMatch = task.tags && task.tags.some(tag => tag.toLowerCase().includes(word));
            const listMatch = task.list.toLowerCase().includes(word);
            const subtasksMatch = task.subtasks && task.subtasks.some(sub => sub.title.toLowerCase().includes(word));
            return titleMatch || contentMatch || tagsMatch || listMatch || subtasksMatch;
        });
    }).sort((a, b) => {
        const aIsActive = a.list !== 'Trash' && !a.completed;
        const bIsActive = b.list !== 'Trash' && !b.completed;
        if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt - b.createdAt);
    });
});

export const currentSummaryFilterKeyAtom = atom<string>((get) => {
    const period = get(summaryPeriodFilterAtom);
    const list = get(summaryListFilterAtom);
    let periodStr = '';
    if (typeof period === 'string') {
        periodStr = period;
    } else if (period && typeof period === 'object' && period.start && period.end) {
        periodStr = `custom_${startOfDay(new Date(period.start)).getTime()}_${endOfDay(new Date(period.end)).getTime()}`;
    } else {
        periodStr = 'invalid_period';
    }
    const listStr = list === 'all' ? 'all' : `list-${list}`;
    return `${periodStr}__${listStr}`;
});

export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom) ?? [];
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const todayStart = startOfDay(new Date());
    let startDateNum: number | null = null, endDateNum: number | null = null;

    switch (period) {
        case 'today':
            startDateNum = todayStart.getTime();
            endDateNum = endOfDay(new Date()).getTime();
            break;
        case 'yesterday':
            startDateNum = startOfDay(subDays(todayStart, 1)).getTime();
            endDateNum = endOfDay(new Date(startDateNum)).getTime();
            break;
        case 'thisWeek':
            startDateNum = startOfWeek(todayStart).getTime();
            endDateNum = endOfWeek(todayStart).getTime();
            break;
        case 'lastWeek':
            startDateNum = startOfWeek(subWeeks(todayStart, 1)).getTime();
            endDateNum = endOfWeek(new Date(startDateNum)).getTime();
            break;
        case 'thisMonth':
            startDateNum = startOfMonth(todayStart).getTime();
            endDateNum = endOfMonth(todayStart).getTime();
            break;
        case 'lastMonth':
            startDateNum = startOfMonth(subMonths(todayStart, 1)).getTime();
            endDateNum = endOfMonth(new Date(startDateNum)).getTime();
            break;
        default:
            if (typeof period === 'object' && period.start && period.end) {
                startDateNum = startOfDay(new Date(period.start)).getTime();
                endDateNum = endOfDay(new Date(period.end)).getTime();
            }
            break;
    }
    if (!startDateNum || !endDateNum) return [];
    const startDateObj = new Date(startDateNum);
    const endDateObj = new Date(endDateNum);
    if (!isValid(startDateObj) || !isValid(endDateObj)) return [];

    return allTasks.filter(task => {
        if (task.list === 'Trash') return false;
        if (listFilter !== 'all' && task.list !== listFilter) return false;
        let relevantDateTimestamp: number | null = null;
        if (task.completed && task.completedAt) {
            relevantDateTimestamp = task.completedAt;
        } else if (!task.completed && task.dueDate) { // Only consider due date if not completed
            relevantDateTimestamp = task.dueDate;
        } else if (task.completed && !task.completedAt) { // Completed but no completedAt, use updatedAt as proxy
            relevantDateTimestamp = task.updatedAt;
        } else if (!relevantDateTimestamp) { // If neither completedAt nor dueDate, might use updatedAt for activity
            relevantDateTimestamp = task.updatedAt;
        }
        if (!relevantDateTimestamp) return false;
        const relevantDate = safeParseDate(relevantDateTimestamp);
        if (!relevantDate || !isValid(relevantDate)) return false;
        const relevantDateDayStart = startOfDay(relevantDate);
        return !isBefore(relevantDateDayStart, startDateObj) && !isAfter(relevantDateDayStart, endDateObj);
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order || a.createdAt - b.createdAt);
});

export const relevantStoredSummariesAtom = atom<StoredSummary[]>((get) => {
    const allSummaries = get(storedSummariesAtom) ?? [];
    const filterKeyVal = get(currentSummaryFilterKeyAtom);
    if (filterKeyVal.startsWith('invalid_period')) return [];
    const [periodKey, listKey] = filterKeyVal.split('__');
    return allSummaries.filter(s => s.periodKey === periodKey && s.listKey === listKey).sort((a, b) => b.createdAt - a.createdAt);
});

export const currentDisplayedSummaryAtom = atom<StoredSummary | null>((get) => {
    const summaries = get(relevantStoredSummariesAtom);
    const index = get(currentSummaryIndexAtom);
    if (index === -1) return null; // For when a new summary is being generated but not yet saved
    return summaries[index] ?? null;
});

export const referencedTasksForSummaryAtom = atom<Task[]>((get) => {
    const summary = get(currentDisplayedSummaryAtom);
    if (!summary) return [];
    const tasks = get(tasksAtom) ?? [];
    const ids = new Set(summary.taskIds);
    return tasks.filter(t => ids.has(t.id)).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order);
});