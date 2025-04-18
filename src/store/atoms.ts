// src/store/atoms.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { User, Task, TaskFilter, TaskGroupCategory, SettingsTab } from '@/types';
import {
    isToday, isWithinNext7Days, isOverdue, startOfDay, safeParseDate,
    isValid // Use utils directly
} from '@/utils/dateUtils';

// --- Base Atoms ---

// Default User (Consider fetching from API in a real app)
export const currentUserAtom = atom<User | null>({
    id: '1',
    name: 'Liu Yunpeng',
    email: 'yp.leao@gmail.com',
    avatar: '/vite.svg', // Placeholder - use a real path or remove if none
    isPremium: true,
});

// Helper function to determine the group category (kept separate for clarity)
const getTaskGroupCategory = (task: Task | Omit<Task, 'groupCategory'>): TaskGroupCategory => {
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) {
            return 'nodate'; // Treat invalid date as no date
        }
        if (isOverdue(dueDateObj)) return 'overdue';
        if (isToday(dueDateObj)) return 'today';
        // Use the utility function correctly for the 7-day check
        if (isWithinNext7Days(dueDateObj)) return 'next7days';
        return 'later';
    }
    return 'nodate';
};


// Sample Data - adjusted for clarity and diverse scenarios
const initialTasksData: Omit<Task, 'groupCategory'>[] = [ // Start without groupCategory
    // Overdue
    { id: '11', title: '体检预约', completed: false, dueDate: startOfDay(new Date(Date.now() - 86400000 * 2)).getTime(), list: 'Personal', content: 'Call the clinic.', order: 7, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3, priority: 1 }, // High prio overdue
    // Today
    { id: '1', title: '施工组织设计评审表', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Review the construction plan details.', order: 1, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 3600000, priority: 1, tags: ['review', 'urgent'] },
    { id: '8', title: '准备明天会议材料', completed: false, dueDate: startOfDay(new Date()).getTime(), list: 'Work', content: 'Finalize slides.', order: 0, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 100000, priority: 1 },
    // Tomorrow ( falls into next7days )
    { id: '2', title: '开发框架讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000)).getTime(), list: 'Work', content: 'Prepare slides for the team meeting.', order: 2, createdAt: Date.now() - 86400000, updatedAt: Date.now(), priority: 2 },
    // Next 7 Days (Day 3)
    { id: '3', title: 'RESTful讲解', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 3)).getTime(), list: 'Work', content: '', order: 3, createdAt: Date.now() - 86400000, updatedAt: Date.now(), tags: ['presentation'] },
    // Later (Day 10)
    { id: '9', title: '下周项目规划', completed: false, dueDate: startOfDay(new Date(Date.now() + 86400000 * 10)).getTime(), list: 'Planning', content: 'Define milestones for Q4.', order: 4, createdAt: Date.now() - 86400000, updatedAt: Date.now() - 50000 },
    // No Due Date
    { id: '4', title: '欢迎加入Tada', completed: false, dueDate: null, list: 'Inbox', content: 'Explore features:\n- **Tasks**\n- Calendar\n- Summary', order: 5, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5 },
    { id: '10', title: '研究 CodeMirror Themes', completed: false, dueDate: null, list: 'Dev', content: 'Find a good light/dark theme.', order: 6, createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000 * 1 },
    // Completed
    { id: '5', title: '我能用Tada做什么?', completed: true, dueDate: null, list: 'Inbox', content: 'Organize life, track projects, collaborate.', order: 8, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 3 },
    { id: '7', title: 'Swagger2讲解 (Completed)', completed: true, dueDate: new Date(2024, 6, 14).getTime(), list: 'Work', content: 'Focus on API documentation standards.', order: 10, createdAt: new Date(2024, 6, 14).getTime(), updatedAt: new Date(2024, 6, 14).getTime() },
    // Trashed
    { id: '6', title: '研究一下patch (Trashed)', completed: false, /* Completed is usually false in Trash */ dueDate: new Date(2024, 6, 13).getTime(), list: 'Trash', content: '', order: 9, createdAt: new Date(2024, 6, 13).getTime(), updatedAt: new Date(2024, 6, 15).getTime() }, // Moved to Trash later
];


// Initialize tasks with calculated group categories
const initialTasks: Task[] = initialTasksData
    .map(task => ({
        ...task,
        groupCategory: getTaskGroupCategory(task),
    }))
    .sort((a, b) => a.order - b.order); // Initial sort by order


// Store tasks in localStorage
// Modify the storage atom to update groupCategory whenever a task changes, especially dueDate
const baseTasksAtom = atomWithStorage<Task[]>('tasks', initialTasks, undefined, { getOnInit: true });

export const tasksAtom = atom(
    (get) => get(baseTasksAtom), // Getter remains the same
    (get, set, update: Task[] | ((prev: Task[]) => Task[])) => { // Setter intercepts updates
        const previousTasks = get(baseTasksAtom);
        const nextTasksRaw = typeof update === 'function' ? update(previousTasks) : update;

        // Ensure groupCategory is updated for any changed task
        const nextTasksWithCategory = nextTasksRaw.map(task => {
            // Find the original task to compare
            const originalTask = previousTasks.find(t => t.id === task.id);
            // Re-calculate category if dueDate changed or it's a new task or category is missing
            if (!originalTask || originalTask.dueDate !== task.dueDate || !task.groupCategory) {
                return { ...task, groupCategory: getTaskGroupCategory(task) };
            }
            // Otherwise, keep the existing category
            return task;
        });

        set(baseTasksAtom, nextTasksWithCategory); // Set the updated array to storage
    }
);


// Store user-defined lists separately
const initialUserLists = ['Work', 'Planning', 'Dev', 'Personal']; // Remove 'Inbox' - it's implicit
export const userDefinedListsAtom = atomWithStorage<string[]>('userDefinedLists', initialUserLists, undefined, { getOnInit: true });

// UI State Atoms
export const selectedTaskIdAtom = atom<string | null>(null);
export const isSettingsOpenAtom = atom<boolean>(false);
export const settingsSelectedTabAtom = atom<SettingsTab>('account');
export const isAddListModalOpenAtom = atom<boolean>(false); // State for Add List Modal

// Represents the current filter applied (from URL/Sidebar)
export const currentFilterAtom = atom<TaskFilter>('all'); // Default to 'all'

// --- Derived Atoms ---

export const selectedTaskAtom = atom<Task | null>((get) => {
    const tasks = get(tasksAtom);
    const selectedId = get(selectedTaskIdAtom);
    return tasks.find(task => task.id === selectedId) ?? null;
});

// Atom to get unique user-defined list names (including Inbox)
// Ensures explicitly defined lists are always present.
export const userListNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const userDefinedLists = get(userDefinedListsAtom);
    const systemLists = ['Trash', 'Archive']; // Lists not managed by the user directly in "My Lists"

    const listsFromTasks = new Set<string>();
    // Always include 'Inbox'
    listsFromTasks.add('Inbox');

    tasks.forEach(task => {
        // Consider only tasks not in Trash/Archive for user-defined lists
        if (task.list && !systemLists.includes(task.list)) {
            listsFromTasks.add(task.list);
        }
    });

    // Combine 'Inbox', explicitly defined lists, and lists found in non-system tasks
    const combinedLists = new Set(['Inbox', ...userDefinedLists, ...Array.from(listsFromTasks)]);

    return Array.from(combinedLists).sort((a, b) => {
        // Keep Inbox first, then sort alphabetically
        if (a === 'Inbox') return -1;
        if (b === 'Inbox') return 1;
        return a.localeCompare(b);
    });
});

// Filtered Tasks based on the current route/filter, sorted by 'order'
export const filteredTasksAtom = atom<Task[]>((get) => {
    const tasks = get(tasksAtom);
    const filter = get(currentFilterAtom);

    // Active tasks (non-trashed) and trashed tasks
    const activeTasks = tasks.filter(task => task.list !== 'Trash');
    const trashedTasks = tasks.filter(task => task.list === 'Trash');

    let filtered: Task[];

    switch (filter) {
        case 'all':
            // Show all non-completed, non-trashed tasks
            filtered = activeTasks.filter(task => !task.completed);
            break;
        case 'today':
            filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isToday(task.dueDate));
            break;
        case 'next7days':
            // Show tasks due today AND the next 6 days (non-completed)
            filtered = activeTasks.filter(task => !task.completed && task.dueDate != null && isWithinNext7Days(task.dueDate));
            break;
        case 'completed':
            // Show completed non-trashed tasks, sorted by completion date (updatedAt) descending
            filtered = activeTasks.filter(task => task.completed).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            break;
        case 'trash':
            // Show only trashed tasks, sorted by date moved to trash (updatedAt) descending
            filtered = trashedTasks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            break;
        default:
            if (filter.startsWith('list-')) {
                const listName = filter.substring(5);
                filtered = activeTasks.filter(task => !task.completed && task.list === listName);
            } else if (filter.startsWith('tag-')) {
                const tagName = filter.substring(4);
                filtered = activeTasks.filter(task => !task.completed && task.tags?.includes(tagName));
            } else {
                // Fallback to 'all' if filter is unrecognized
                console.warn(`Unrecognized filter: ${filter}. Falling back to 'all'.`);
                filtered = activeTasks.filter(task => !task.completed);
            }
            break;
    }

    // Sort all filtered tasks (except completed/trash which have their own sort) by the 'order' property
    if (filter !== 'completed' && filter !== 'trash') {
        // Ensure consistent sorting: order first, then creation time as fallback
        return filtered.sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt));
    }

    return filtered;
});

// Atom to get unique tag names from non-trashed tasks
export const userTagNamesAtom = atom<string[]>((get) => {
    const tasks = get(tasksAtom);
    const tags = new Set<string>();
    // Consider only tags from non-trashed tasks
    tasks.filter(t => t.list !== 'Trash').forEach(task => {
        task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b)); // Alphabetical sort
});


// Atom to get task counts for the sidebar
export const taskCountsAtom = atom((get) => {
    const tasks = get(tasksAtom);
    const allUserListNames = get(userListNamesAtom); // Get all known user lists (including Inbox)
    const allUserTagNames = get(userTagNamesAtom); // Get all known tags

    // Active tasks are non-trashed tasks
    const activeTasks = tasks.filter(task => task.list !== 'Trash');

    // --- Initialize Counts ---
    const counts = {
        all: 0,
        today: 0,
        next7days: 0,
        completed: activeTasks.filter(t => t.completed).length, // Completed count is straightforward
        trash: tasks.filter(t => t.list === 'Trash').length,   // Trash count is straightforward
        lists: {} as Record<string, number>,
        tags: {} as Record<string, number>,
    };

    // Initialize list counts to 0
    allUserListNames.forEach(listName => {
        counts.lists[listName] = 0;
    });
    // Initialize tag counts to 0
    allUserTagNames.forEach(tagName => {
        counts.tags[tagName] = 0;
    });

    // --- Calculate Counts from active, non-completed tasks ---
    activeTasks.filter(t => !t.completed).forEach(task => {
        counts.all++; // Increment 'all' count

        // Check date-based filters
        if (task.dueDate != null) {
            // Ensure date is valid before checking
            const dueDateObj = safeParseDate(task.dueDate);
            if (dueDateObj && isValid(dueDateObj)) { // Check validity
                if (isToday(dueDateObj)) counts.today++;
                // Check if within the next 7 days (inclusive of today)
                if (isWithinNext7Days(dueDateObj)) counts.next7days++;
            }
        }

        // Count lists (ensure list exists in the initialized keys)
        if (task.list && Object.prototype.hasOwnProperty.call(counts.lists, task.list)) {
            counts.lists[task.list]++;
        }

        // Count tags (ensure tag exists in the initialized keys)
        task.tags?.forEach(tag => {
            if (Object.prototype.hasOwnProperty.call(counts.tags, tag)) {
                counts.tags[tag]++;
            }
        });
    });

    return counts;
});


// Helper atom to group tasks for the 'All Tasks' view
export const groupedAllTasksAtom = atom((get): Record<TaskGroupCategory, Task[]> => {
    // Read the base tasks atom, filter, sort, and *then* group
    const allActiveNonCompletedTasks = get(tasksAtom)
        .filter(task => task.list !== 'Trash' && !task.completed)
        .sort((a, b) => (a.order - b.order) || (a.createdAt - b.createdAt)); // Sort by order, then creation

    const groups: Record<TaskGroupCategory, Task[]> = {
        overdue: [],
        today: [],
        next7days: [], // Only tasks due day 2-7
        later: [],
        nodate: [],
    };

    allActiveNonCompletedTasks.forEach(task => {
        // Use the pre-calculated or default groupCategory
        const category = task.groupCategory ?? getTaskGroupCategory(task); // Fallback just in case

        if (groups[category]) {
            // Specifically check if a task categorized as 'next7days' is actually 'today'
            if (category === 'next7days' && isToday(task.dueDate)) {
                groups.today.push(task); // Put today's tasks in the 'today' group
            } else {
                groups[category].push(task);
            }
        } else {
            // Fallback for safety
            groups.nodate.push(task);
            console.warn(`Task ${task.id} has unexpected category: ${category}`);
        }
    });

    // The groups are naturally sorted by 'order' because the input list was sorted
    return groups;
});