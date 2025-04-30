import {atom} from 'jotai';
import {atomWithStorage, createJSONStorage, RESET} from 'jotai/utils';
import {SettingsTab, Task, TaskFilter, TaskGroupCategory, User} from '@/types';
import {
    addDays,
    endOfDay,
    endOfMonth,
    endOfWeek,
    isAfter,
    isBefore,
    isOverdue as isOverdueCheck,
    isSameDay,
    isToday as isTodayCheck,
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

// --- Base Atoms ---
export const currentUserAtom = atom<User | null>({
    id: '1',
    name: 'Liu Yunpeng',
    email: 'yp.leao@gmail.com',
    avatar: '/vite.svg',
    isPremium: true,
});

// Helper function to determine task group category (relies on `completed` status)
export const getTaskGroupCategory = (task: Omit<Task, 'groupCategory'> | Task): TaskGroupCategory => {
    // Use the `completed` field, which should be kept in sync with completionPercentage by the atom setter
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
        const tomorrow = startOfDay(addDays(today, 1));
        const sevenDaysFromTodayEnd = endOfDay(addDays(today, 6));
        if (!isBefore(taskDay, tomorrow) && !isAfter(taskDay, sevenDaysFromTodayEnd)) {
            return 'next7days';
        }
        if (isAfter(taskDay, sevenDaysFromTodayEnd)) {
            return 'later';
        }
    }
    return 'nodate';
};

// Sample Data with completionPercentage
const initialTasksDataRaw = [
    {
        id: '11',
        title: '体检预约',
        completionPercentage: 50,
        dueDate: subDays(startOfDay(new Date()), 2),
        list: 'Personal',
        content: 'Called the clinic, waiting for callback.',
        order: 7,
        createdAt: subDays(new Date(), 4).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: 1
    },
    {
        id: '1',
        title: '施工组织设计评审表 (Copy)',
        completionPercentage: 50,
        dueDate: startOfDay(new Date()),
        list: 'Work',
        content: 'Review the construction plan details.',
        order: 0,
        createdAt: subDays(new Date(), 3).getTime(),
        updatedAt: subDays(new Date(), 3).getTime(),
        priority: 1,
        tags: ['review', 'urgent']
    },
    {
        id: '8',
        title: '准备明天会议材料 (Copy)',
        completionPercentage: 100,
        dueDate: startOfDay(new Date()),
        list: 'Work',
        content: 'Finalize slides, need to add Q&A section.',
        order: 1,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 1,
        completedAt: new Date().getTime()
    },
    {
        id: '2',
        title: '开发框架讲解',
        completionPercentage: 20,
        dueDate: addDays(startOfDay(new Date()), 1),
        list: 'Work',
        content: 'Prepare slides for the team meeting. Outline done.',
        order: 2,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: new Date().getTime(),
        priority: 2
    },
    {
        id: '3',
        title: 'RESTful讲解',
        completionPercentage: 0,
        dueDate: addDays(startOfDay(new Date()), 3),
        list: 'Work',
        content: '',
        order: 3,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        tags: ['presentation']
    },
    {
        id: '9',
        title: '下周项目规划',
        completionPercentage: null,
        dueDate: addDays(startOfDay(new Date()), 10),
        list: 'Planning',
        content: 'Define milestones for Q4.',
        order: 6,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime()
    },
    {
        id: '4',
        title: '欢迎加入Tada (Copy)',
        completionPercentage: 100,
        dueDate: null,
        list: 'Inbox',
        content: 'Explore features:\n- **Tasks**\n- Calendar\n- Summary',
        order: 4,
        createdAt: subDays(new Date(), 5).getTime(),
        updatedAt: subDays(new Date(), 5).getTime(),
        completedAt: subDays(new Date(), 3).getTime()
    },
    {
        id: '10',
        title: '研究 CodeMirror Themes',
        completionPercentage: 50,
        dueDate: null,
        list: 'Dev',
        content: 'Found a few potential themes, need to test.',
        order: 5,
        createdAt: subDays(new Date(), 2).getTime(),
        updatedAt: new Date().getTime(),
        priority: 3
    },
    {
        id: '5',
        title: '我能用Tada做什么?',
        completionPercentage: 100,
        dueDate: null,
        list: 'Inbox',
        content: 'Organize life, track projects, collaborate.',
        order: 8,
        createdAt: subDays(new Date(), 4).getTime(),
        completedAt: new Date().getTime(),
        updatedAt: new Date().getTime()
    },
    {
        id: '7',
        title: 'Swagger2讲解 (Completed)',
        completionPercentage: 100,
        dueDate: new Date(2024, 5, 14).getTime(),
        list: 'Work',
        content: 'Focus on API documentation standards.',
        order: 10,
        createdAt: new Date(2024, 5, 10).getTime(),
        updatedAt: new Date(2024, 5, 14, 15, 0, 0).getTime(),
        completedAt: new Date(2024, 5, 14, 15, 0, 0).getTime()
    },
    {
        id: '6',
        title: '研究一下patch (Trashed)',
        completionPercentage: null,
        dueDate: new Date(2024, 5, 13).getTime(),
        list: 'Trash',
        content: '',
        order: 9,
        createdAt: new Date(2024, 5, 10).getTime(),
        updatedAt: new Date(2024, 5, 10).getTime()
    },
    {
        id: '12',
        title: '体检预约',
        completionPercentage: 50,
        dueDate: subDays(startOfDay(new Date()), 1),
        list: 'Personal',
        content: 'Confirm appointment time.',
        order: 11,
        createdAt: subDays(new Date(), 2).getTime(),
        updatedAt: subDays(new Date(), 1).getTime(),
        priority: 2
    },
    {
        id: '13',
        title: '欢迎加入Tada',
        completionPercentage: 20,
        dueDate: null,
        list: 'Inbox',
        content: 'Try creating your first task!',
        order: 12,
        createdAt: subDays(new Date(), 1).getTime(),
        updatedAt: subDays(new Date(), 1).getTime()
    },
];

// Initialize tasks with calculated groupCategory and derived completed status
const initialTasks: Task[] = initialTasksDataRaw
    .map(taskRaw => {
        const now = Date.now();
        const percentage = taskRaw.completionPercentage ?? 0; // Treat null as 0
        const isCompleted = percentage === 100;
        const dueDateTimestamp = taskRaw.dueDate instanceof Date && isValid(taskRaw.dueDate) ? taskRaw.dueDate.getTime() : (taskRaw.dueDate === null ? null : undefined);
        if (dueDateTimestamp === undefined && taskRaw.dueDate !== null) {
            console.warn(`Invalid dueDate encountered for task "${taskRaw.title}". Setting to null.`);
        }

        const taskPartial: Omit<Task, 'groupCategory'> = {
            ...taskRaw,
            completed: isCompleted, // Derived from percentage
            completionPercentage: taskRaw.completionPercentage, // Keep original null/number
            dueDate: dueDateTimestamp === undefined ? null : dueDateTimestamp,
            completedAt: isCompleted ? (taskRaw.completedAt ?? taskRaw.updatedAt ?? now) : null, // Set based on derived completed status
            updatedAt: taskRaw.updatedAt ?? now,
            tags: taskRaw.tags ?? [],
            priority: taskRaw.priority ?? null,
            content: taskRaw.content ?? '',
        };
        return {
            ...taskPartial,
            groupCategory: getTaskGroupCategory(taskPartial), // Use the derived completed status for grouping
        };
    })
    .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));

// Atom for storing the raw task list with persistence
const baseTasksAtom = atomWithStorage<Task[]>('tasks_v6_percentage', initialTasks, undefined, {getOnInit: true});

// Main tasks atom with refined setter logic
export const tasksAtom = atom(
    (get) => get(baseTasksAtom),
    (get, set, update: Task[] | ((prev: Task[]) => Task[]) | typeof RESET) => {
        if (update === RESET) {
            set(baseTasksAtom, initialTasks);
            return;
        }
        const previousTasks = get(baseTasksAtom);
        const nextTasksRaw = typeof update === 'function' ? update(previousTasks) : update;
        const now = Date.now();

        const nextTasksProcessed = nextTasksRaw.map(task => {
            const previousTaskState = previousTasks.find(p => p.id === task.id);

            let currentPercentage = task.completionPercentage ?? null; // Start with provided value or null
            let isCompleted = task.completed; // Start with provided value

            // Derive state based on changes or rules
            if (task.list === 'Trash') {
                currentPercentage = null; // Trash items are not "in progress"
                isCompleted = false;
            } else if (previousTaskState && task.completed !== undefined && task.completed !== previousTaskState.completed) {
                // If 'completed' status was explicitly changed by the user/action
                currentPercentage = task.completed ? 100 : (previousTaskState.completionPercentage === 100 ? null : previousTaskState.completionPercentage); // Go to 100 or back to previous (or null if was 100)
                isCompleted = task.completed; // Trust the explicit change
            } else if (task.completionPercentage !== undefined && (!previousTaskState || task.completionPercentage !== previousTaskState.completionPercentage)) {
                // If percentage changed explicitly
                isCompleted = task.completionPercentage === 100;
                currentPercentage = task.completionPercentage === 0 ? null : task.completionPercentage; // Treat 0 as null
            } else {
                // Fallback/Initial state derivation if neither completed nor percentage was the primary trigger
                isCompleted = currentPercentage === 100;
            }


            const newCompletedAt = isCompleted ? (task.completedAt ?? previousTaskState?.completedAt ?? task.updatedAt ?? now) : null;

            const validatedTask = {
                ...task,
                content: task.content ?? '',
                tags: task.tags ?? [],
                priority: task.priority ?? null,
                completionPercentage: currentPercentage, // Keep null for 0% or trashed
                completed: isCompleted, // Ensure 'completed' reflects the percentage/state
                completedAt: newCompletedAt,
                // Don't update 'updatedAt' yet, decide based on functional changes
                updatedAt: task.updatedAt
            };
            const newCategory = getTaskGroupCategory(validatedTask); // Recalculate category based on potentially updated state

            let changed = false;
            if (!previousTaskState) {
                changed = true;
            } else {
                // Compare relevant functional fields
                if (validatedTask.title !== previousTaskState.title ||
                    validatedTask.completionPercentage !== previousTaskState.completionPercentage ||
                    validatedTask.completed !== previousTaskState.completed ||
                    validatedTask.dueDate !== previousTaskState.dueDate ||
                    validatedTask.list !== previousTaskState.list ||
                    validatedTask.content !== previousTaskState.content ||
                    validatedTask.order !== previousTaskState.order ||
                    validatedTask.priority !== previousTaskState.priority ||
                    JSON.stringify(validatedTask.tags) !== JSON.stringify(previousTaskState.tags) ||
                    newCategory !== previousTaskState.groupCategory ||
                    validatedTask.completedAt !== previousTaskState.completedAt) {
                    changed = true;
                }
            }

            if (changed) {
                // Functional change occurred, update timestamp
                return {...validatedTask, groupCategory: newCategory, updatedAt: now};
            } else {
                // If nothing functionally changed, return the previous state object
                // This prevents unnecessary updates and keeps the original updatedAt timestamp
                return previousTaskState!; // We know previousTaskState exists if changed is false
            }
        });


        // Only update base atom if the processed list is actually different from the previous one
        // This comparison helps prevent infinite loops if the setter logic is flawed
        if (JSON.stringify(nextTasksProcessed) !== JSON.stringify(previousTasks)) {
            // console.log("Updating baseTasksAtom due to changes.");
            set(baseTasksAtom, nextTasksProcessed);
        }
    }
);

// --- UI State Atoms ---
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false);
export const currentFilterAtom = atom<TaskFilter>('all');
export const searchTermAtom = atom<string>('');

// --- Summary View Atoms ---
export interface StoredSummary {
    id: string;
    createdAt: number;
    periodKey: string;
    listKey: string;
    taskIds: string[];
    summaryText: string;
    updatedAt?: number;
}

export type SummaryPeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';
export type SummaryPeriodOption = SummaryPeriodKey | { start: number; end: number };
export const summaryPeriodFilterAtom = atom<SummaryPeriodOption>('thisWeek');
export const summaryListFilterAtom = atom<string>('all');
export const summarySelectedTaskIdsAtom = atom<Set<string>>(new Set<string>());
const summaryStorage = createJSONStorage<StoredSummary[]>(() => localStorage);
export const storedSummariesAtom = atomWithStorage<StoredSummary[]>(
    'tada_summaries_v1', [], summaryStorage, {getOnInit: true}
);
export const currentSummaryIndexAtom = atom<number>(0);
export const isGeneratingSummaryAtom = atom<boolean>(false);

// --- Derived Atoms ---
export const selectedTaskAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    if (!selectedId) return null;
    return tasks.find(task => task.id === selectedId) ?? null;
});
const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal'];
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists_v1', initialUserLists, undefined, {getOnInit: true});
export const userListNamesAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const userLists = get(userDefinedListsAtom);
    const listsFromTasks = new Set<string>();
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        if (task.list) listsFromTasks.add(task.list)
    });
    const combinedLists = new Set(['Inbox', ...userLists, ...Array.from(listsFromTasks)]);
    combinedLists.delete('Trash');
    return Array.from(combinedLists).sort((a, b) => {
        if (a === 'Inbox') return -1;
        if (b === 'Inbox') return 1;
        return a.localeCompare(b);
    });
});
export const userTagNamesAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        task.tags?.forEach(tag => tags.add(tag))
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
});
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const allUserListNames = get(userListNamesAtom);
    const allUserTagNames = get(userTagNamesAtom);
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const counts = {
        all: 0, today: 0, next7days: 0,
        completed: 0,
        trash: tasks.filter(task => task.list === 'Trash').length,
        lists: Object.fromEntries(allUserListNames.map(name => [name, 0])),
        tags: Object.fromEntries(allUserTagNames.map(name => [name, 0])),
    };
    activeTasks.forEach(task => {
        if (task.completed) {
            counts.completed++;
        } else {
            counts.all++;
            if (task.dueDate != null) {
                const date = safeParseDate(task.dueDate);
                if (date && isValid(date)) {
                    if (isTodayCheck(date)) counts.today++;
                    if (!isOverdueCheck(date) && isWithinNext7Days(date)) counts.next7days++;
                }
            }
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
    const tasksToGroup = get(tasksAtom).filter(task => task.list !== 'Trash' && !task.completed).sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    const groups: Record<TaskGroupCategory, Task[]> = {overdue: [], today: [], next7days: [], later: [], nodate: []};
    tasksToGroup.forEach(task => {
        const category = task.groupCategory;
        if (Object.prototype.hasOwnProperty.call(groups, category)) {
            groups[category].push(task);
        } else {
            console.warn(`Task ${task.id} in groupedAllTasksAtom has unexpected category: ${category}. Placing in 'nodate'.`);
            groups.nodate.push(task);
        }
    });
    return groups;
});
export const rawSearchResultsAtom = atom<Task[]>((get) => {
    const search = get(searchTermAtom).trim().toLowerCase();
    if (!search) return [];
    const allTasks = get(tasksAtom);
    const searchWords = search.split(' ').filter(Boolean);
    return allTasks.filter(task => searchWords.every(word => task.title.toLowerCase().includes(word) || (task.content && task.content.toLowerCase().includes(word)) || (task.tags && task.tags.some(tag => tag.toLowerCase().includes(word))) || (task.list.toLowerCase().includes(word)))).sort((a, b) => {
        const aIsActive = a.list !== 'Trash' && !a.completed;
        const bIsActive = b.list !== 'Trash' && !b.completed;
        if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;
        return (a.order ?? 0) - (b.order ?? 0) || (a.createdAt - b.createdAt);
    });
});

// --- Derived Atoms for Summary View ---
export const currentSummaryFilterKeyAtom = atom<string>((get) => {
    const period = get(summaryPeriodFilterAtom);
    const list = get(summaryListFilterAtom);
    let periodStr: string;
    if (typeof period === 'string') {
        periodStr = period;
    } else {
        periodStr = `custom_${startOfDay(period.start).getTime()}_${endOfDay(period.end).getTime()}`;
    }
    const listStr = list === 'all' ? 'all' : `list-${list}`;
    return `${periodStr}__${listStr}`;
});
export const filteredTasksForSummaryAtom = atom<Task[]>((get) => {
    const allTasks = get(tasksAtom);
    const period = get(summaryPeriodFilterAtom);
    const listFilter = get(summaryListFilterAtom);
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    switch (period) {
        case 'today':
            startDate = todayStart;
            endDate = todayEnd;
            break;
        case 'yesterday':
            startDate = startOfDay(subDays(todayStart, 1));
            endDate = endOfDay(subDays(todayStart, 1));
            break;
        case 'thisWeek':
            startDate = startOfWeek(todayStart);
            endDate = endOfWeek(todayStart);
            break;
        case 'lastWeek':
            const lwStart = startOfWeek(subWeeks(todayStart, 1));
            startDate = lwStart;
            endDate = endOfWeek(lwStart);
            break;
        case 'thisMonth':
            startDate = startOfMonth(todayStart);
            endDate = endOfMonth(todayStart);
            break;
        case 'lastMonth':
            const lmStart = startOfMonth(subMonths(todayStart, 1));
            startDate = lmStart;
            endDate = endOfMonth(lmStart);
            break;
        default:
            if (typeof period === 'object' && period.start && period.end) {
                startDate = startOfDay(new Date(period.start));
                endDate = endOfDay(new Date(period.end));
            }
            break;
    }
    if ((startDate && !isValid(startDate)) || (endDate && !isValid(endDate))) {
        console.error("Invalid date range for summary filter", {period, startDate, endDate});
        return [];
    }
    return allTasks.filter(task => {
        // Filter by Completion Percentage > 0
        if (task.completionPercentage === null || task.completionPercentage === 0) return false;
        // Filter by List
        if (listFilter !== 'all' && task.list !== listFilter) return false;
        // Filter by Date Range (only if range is active and task has a valid due date)
        if (startDate && endDate) {
            if (!task.dueDate) return false;
            const dueDate = safeParseDate(task.dueDate);
            if (!dueDate || !isValid(dueDate)) return false;
            const dueDateStart = startOfDay(dueDate);
            if (isBefore(dueDateStart, startDate) || isAfter(dueDateStart, endDate)) return false;
        }
        // Exclude Trashed
        if (task.list === 'Trash') return false;
        return true; // Passed all filters
    }).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order || a.createdAt - b.createdAt);
});
export const relevantStoredSummariesAtom = atom<StoredSummary[]>((get) => {
    const allSummaries = get(storedSummariesAtom);
    const filterKey = get(currentSummaryFilterKeyAtom);
    return allSummaries.filter(s => s.periodKey === filterKey.split('__')[0] && s.listKey === filterKey.split('__')[1]).sort((a, b) => b.createdAt - a.createdAt);
});
export const currentDisplayedSummaryAtom = atom<StoredSummary | null>((get) => {
    const relevantSummaries = get(relevantStoredSummariesAtom);
    const index = get(currentSummaryIndexAtom);
    return relevantSummaries[index] ?? null;
});
export const referencedTasksForSummaryAtom = atom<Task[]>((get) => {
    const currentSummary = get(currentDisplayedSummaryAtom);
    if (!currentSummary) return [];
    const allTasks = get(tasksAtom);
    const referencedIds = new Set(currentSummary.taskIds);
    // Return tasks preserving their original order/data as much as possible
    // return currentSummary.taskIds.map(id => allTasks.find(task => task.id === id)).filter((task): task is Task => !!task);
    // Alternative: filter and sort based on original task data if order is needed
    return allTasks.filter(task => referencedIds.has(task.id)).sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.order - b.order);
});