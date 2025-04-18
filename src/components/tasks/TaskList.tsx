// src/components/tasks/TaskList.tsx
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import TaskItem from './TaskItem';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    tasksAtom,
    selectedTaskIdAtom,
    currentFilterAtom,
    groupedAllTasksAtom, // Use this for 'all' view structure
    filteredTasksAtom   // Use this for other views structure
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task, TaskFilter, TaskGroupCategory } from '@/types';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragEndEvent, DragOverlay, DragStartEvent, UniqueIdentifier, MeasuringStrategy
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { startOfDay, isValid, safeParseDate, isToday, isWithinNext7Days, isOverdue } from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';

// Interface for component props
interface TaskListProps {
    title: string;
    filter: TaskFilter; // Pass filter explicitly for clarity
}

// Sticky Group Header Component with Stronger Glass Effect
const TaskGroupHeader: React.FC<{ title: string }> = ({ title }) => (
    <motion.div
        className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-[5]"
        style={{
            backgroundColor: 'hsla(0, 0%, 100%, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
        }}
        layout // Animate position if list changes cause header shifts
    >
        {title}
    </motion.div>
);

// Helper to get category (can be defined outside if preferred)
const getTaskGroupCategoryLocal = (task: Task | Omit<Task, 'groupCategory'>): TaskGroupCategory => {
    if (task.dueDate != null) {
        const dueDateObj = safeParseDate(task.dueDate);
        if (!dueDateObj || !isValid(dueDateObj)) return 'nodate';
        if (isOverdue(dueDateObj)) return 'overdue';
        if (isToday(dueDateObj)) return 'today';
        if (isWithinNext7Days(dueDateObj)) return 'next7days';
        return 'later';
    }
    return 'nodate';
};


// Main Task List Component
const TaskList: React.FC<TaskListProps> = ({ title, filter }) => {
    const filteredTasks = useAtomValue(filteredTasksAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const [tasks, setTasks] = useAtom(tasksAtom);
    const [currentFilterInternal, setCurrentFilterInternal] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);

    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [draggingTaskCategory, setDraggingTaskCategory] = useState<TaskGroupCategory | undefined>(undefined);

    // Sync external filter prop with internal atom state
    useEffect(() => {
        if (filter !== currentFilterInternal) {
            setCurrentFilterInternal(filter);
        }
    }, [filter, currentFilterInternal, setCurrentFilterInternal]);

    // Memoize the list of task IDs *and* the tasks themselves for the current view
    const currentViewTasks = useMemo(() => {
        if (filter === 'all') {
            return Object.values(groupedTasks).flat();
        } else {
            return filteredTasks;
        }
    }, [filter, groupedTasks, filteredTasks]);

    const sortableItems: UniqueIdentifier[] = useMemo(() => currentViewTasks.map(task => task.id), [currentViewTasks]);

    // Configure Dnd-Kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // --- Drag and Drop Handlers ---
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const taskData = active.data.current?.task as Task | undefined;
        const categoryData = active.data.current?.groupCategory as TaskGroupCategory | undefined;

        if (taskData) {
            setDraggingTask(taskData);
            setDraggingTaskCategory(categoryData);
        } else {
            const task = tasks.find(t => t.id === active.id);
            if (task) {
                setDraggingTask(task);
                setDraggingTaskCategory(task.groupCategory);
            }
        }
    }, [tasks]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setDraggingTask(null);
        setDraggingTaskCategory(undefined);

        if (!over || active.id === over.id) {
            return; // No drop target or dropped on itself
        }

        const activeId = active.id as string;
        const overId = over.id as string;
        const targetGroupCategory = over.data.current?.groupCategory as TaskGroupCategory | undefined;

        // Find indices based on the *current visual order* from the memoized array
        const oldVisualIndex = currentViewTasks.findIndex(t => t.id === activeId);
        const newVisualIndex = currentViewTasks.findIndex(t => t.id === overId);

        if (oldVisualIndex === -1 || newVisualIndex === -1) {
            console.warn("TaskList DragEnd: Could not find dragged items in the current visual list.");
            // As a fallback, attempt reorder based on the full list - less accurate visually
            setTasks(currentTasks => {
                const oldFullIndex = currentTasks.findIndex(t => t.id === activeId);
                const newFullIndex = currentTasks.findIndex(t => t.id === overId);
                if (oldFullIndex !== -1 && newFullIndex !== -1) {
                    return arrayMove(currentTasks, oldFullIndex, newFullIndex);
                }
                return currentTasks;
            });
            return;
        }

        // --- Determine New Order using Fractional Indexing ---
        // Use the visual indices to find the neighbors in the *current visual list*
        const isMovingDown = oldVisualIndex < newVisualIndex;

        // Find the task *before* the drop position in the visual list
        const prevTaskVisual = isMovingDown
            ? currentViewTasks[newVisualIndex] // Dropping after this item
            : (newVisualIndex > 0 ? currentViewTasks[newVisualIndex - 1] : null); // Dropping before `overId`, need item before that

        // Find the task *after* the drop position in the visual list
        const nextTaskVisual = isMovingDown
            ? (newVisualIndex + 1 < currentViewTasks.length ? currentViewTasks[newVisualIndex + 1] : null) // Item after the one we dropped after
            : currentViewTasks[newVisualIndex]; // Dropping before this item (`overId`)

        const prevOrder = prevTaskVisual?.order;
        const nextOrder = nextTaskVisual?.order;

        let newOrderValue: number;

        if (prevOrder === undefined || prevOrder === null) { // Dropped at the beginning
            newOrderValue = (nextOrder ?? 0) - 1;
        } else if (nextOrder === undefined || nextOrder === null) { // Dropped at the end
            newOrderValue = prevOrder + 1;
        } else { // Dropped between two items
            // Prevent potential floating point precision issues by adding a small buffer
            if (Math.abs(nextOrder - prevOrder) < 0.001) {
                // Orders are too close, need re-balancing or a different strategy
                // For now, just place slightly after prevOrder
                console.warn("Fractional indices too close, potential re-balancing needed.");
                newOrderValue = prevOrder + 0.001;
            } else {
                newOrderValue = (prevOrder + nextOrder) / 2;
            }
        }
        // --- End Fractional Indexing ---


        // --- Handle Date Change based on Drop Target Group (only in 'all' view) ---
        let newDueDate: number | null | undefined = undefined; // undefined means no date change needed
        if (filter === 'all' && targetGroupCategory) {
            const originalTask = tasks.find(t => t.id === activeId); // Find original task from full list
            if (originalTask) {
                const originalCategory = originalTask.groupCategory ?? getTaskGroupCategoryLocal(originalTask);
                if (targetGroupCategory !== originalCategory) {
                    console.log(`Dropped task ${activeId} from ${originalCategory} to ${targetGroupCategory}`);
                    switch (targetGroupCategory) {
                        case 'today':
                            newDueDate = startOfDay(new Date()).getTime();
                            break;
                        case 'nodate':
                            newDueDate = null; // Explicitly set to null
                            break;
                        case 'overdue':
                        case 'next7days':
                        case 'later':
                            newDueDate = undefined; // No date change for these groups
                            break;
                    }
                }
            }
        }
        // --- End Date Change ---

        // Update the tasks atom
        setTasks((currentTasks) =>
            currentTasks.map((task) => {
                if (task.id === activeId) {
                    return {
                        ...task,
                        order: newOrderValue,
                        updatedAt: Date.now(),
                        // Apply date change only if newDueDate is defined (not undefined)
                        ...(newDueDate !== undefined && { dueDate: newDueDate }),
                        // groupCategory will be updated automatically by the tasksAtom setter
                    };
                }
                return task;
            })
        );

    }, [setTasks, filter, currentViewTasks, tasks]); // Added tasks to deps for original task lookup


    // --- Add Task Handler ---
    const handleAddTask = () => {
        const now = Date.now();
        let defaultList = 'Inbox'; // Default to Inbox
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];

        // Set defaults based on the current filter
        if (filter.startsWith('list-')) {
            const listName = filter.substring(5);
            if (listName !== 'Inbox' && listName !== 'Trash') {
                defaultList = listName;
            }
        } else if (filter === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (filter.startsWith('tag-')) {
            defaultTags = [filter.substring(4)];
        } else if (filter === 'next7days') {
            defaultDueDate = startOfDay(new Date(now + 86400000)).getTime(); // Default to tomorrow
        }

        // Calculate order: Place new task at the top of the *current view*
        const firstVisibleTaskOrder = currentViewTasks.length > 0 ? currentViewTasks[0]?.order : 0;
        const newOrder = (firstVisibleTaskOrder ?? 0) - 1; // Place before the first visible item

        const newTaskBase: Omit<Task, 'groupCategory'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '', // Start with empty title
            completed: false,
            list: defaultList,
            dueDate: defaultDueDate,
            order: newOrder,
            createdAt: now,
            updatedAt: now,
            content: '',
            tags: defaultTags,
            priority: null,
        };

        // Cast, knowing atom setter will add category
        const newTask: Task = newTaskBase as Task;

        // Add the new task using the functional update form of setTasks
        setTasks(prev => [newTask, ...prev]);
        setSelectedTaskId(newTask.id); // Select the new task

        // Focus the title input in TaskDetail after a short delay
        setTimeout(() => {
            const titleInput = document.querySelector('.task-detail-title-input') as HTMLInputElement | null;
            titleInput?.focus();
        }, 100);
    };

    // --- Render Helper for Task Groups ---
    const renderTaskGroup = (groupTasks: Task[], groupKey: TaskGroupCategory | string) => (
        <AnimatePresence initial={false} key={`group-anim-${groupKey}`}>
            {groupTasks.map((task) => (
                <motion.div
                    key={task.id}
                    layout // Enable layout animation for reordering
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10, transition: { duration: 0.15, ease: 'easeIn' } }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="task-motion-wrapper"
                >
                    <TaskItem
                        task={task}
                        groupCategory={typeof groupKey === 'string' && ['overdue', 'today', 'next7days', 'later', 'nodate'].includes(groupKey) ? groupKey as TaskGroupCategory : task.groupCategory} // Pass correct category
                    />
                </motion.div>
            ))}
        </AnimatePresence>
    );

    // Determine if the current view is empty
    const isEmpty = useMemo(() => sortableItems.length === 0, [sortableItems]);

    // --- Main Render ---
    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
            <div className="h-full flex flex-col bg-glass backdrop-blur-lg">
                {/* Header */}
                <div className={twMerge(
                    "px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 z-10",
                    "bg-glass-200 backdrop-blur-md"
                )}>
                    <h1 className="text-base font-semibold text-gray-800 truncate pr-2" title={title}>{title}</h1>
                    <div className="flex items-center space-x-1">
                        {filter !== 'completed' && filter !== 'trash' && (
                            <Button variant="primary" size="sm" icon="plus" onClick={handleAddTask} className="px-2.5"> Add </Button>
                        )}
                        <Button variant="ghost" size="icon" aria-label="List options" className="w-7 h-7 text-muted-foreground hover:bg-black/10">
                            <Icon name="more-horizontal" size={18} />
                        </Button>
                    </div>
                </div>

                {/* Task List Area */}
                <div className="flex-1 overflow-y-auto styled-scrollbar relative">
                    {isEmpty ? (
                        // Empty State Message
                        <motion.div
                            className="flex flex-col items-center justify-center h-full text-gray-400 px-6 text-center pt-10"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Icon
                                name={filter === 'trash' ? 'trash' : (filter === 'completed' ? 'check-square' : 'archive')}
                                size={40} className="mb-3 text-gray-300 opacity-80"
                            />
                            <p className="text-sm font-medium text-gray-500">
                                {filter === 'trash' ? 'Trash is empty' : (filter === 'completed' ? 'No completed tasks yet' : `No tasks in "${title}"`)}
                            </p>
                            {filter !== 'trash' && filter !== 'completed' && (
                                <p className="text-xs mt-1 text-muted">Click the '+' button to add a new task.</p>
                            )}
                        </motion.div>
                    ) : (
                        // Sortable Context wrapping the tasks
                        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
                            {filter === 'all' ? (
                                // Render grouped tasks for 'All' view
                                <>
                                    {groupedTasks.overdue.length > 0 && ( <> <TaskGroupHeader title="Overdue" /> {renderTaskGroup(groupedTasks.overdue, 'overdue')} </> )}
                                    {groupedTasks.today.length > 0 && ( <> <TaskGroupHeader title="Today" /> {renderTaskGroup(groupedTasks.today, 'today')} </> )}
                                    {groupedTasks.next7days.length > 0 && ( <> <TaskGroupHeader title="Next 7 Days" /> {renderTaskGroup(groupedTasks.next7days, 'next7days')} </> )}
                                    {groupedTasks.later.length > 0 && ( <> <TaskGroupHeader title="Later" /> {renderTaskGroup(groupedTasks.later, 'later')} </> )}
                                    {groupedTasks.nodate.length > 0 && ( <> <TaskGroupHeader title="No Due Date" /> {renderTaskGroup(groupedTasks.nodate, 'nodate')} </> )}
                                </>
                            ) : (
                                // Render flat list for other filters
                                <div className="pt-0.5">
                                    {renderTaskGroup(filteredTasks, 'default-group')}
                                </div>
                            )}
                        </SortableContext>
                    )}
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    <TaskItem
                        task={draggingTask}
                        groupCategory={draggingTaskCategory}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};
export default TaskList;