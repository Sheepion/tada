// src/components/tasks/TaskList.tsx
import React, {useCallback, useMemo, useRef, useState} from 'react';
import TaskItem from './TaskItem';
import {useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    groupedAllTasksAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    tasksAtom
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import * as Popover from '@radix-ui/react-popover';
import {CustomDatePickerContent} from '../common/CustomDatePickerPopover';
import {Task, TaskGroupCategory} from '@/types';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    KeyboardSensor,
    MeasuringStrategy,
    PointerSensor,
    UniqueIdentifier,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {AnimatePresence} from 'framer-motion';
import {
    addDays,
    isBefore,
    isOverdue,
    isToday,
    isValid,
    isWithinNext7Days,
    safeParseDate,
    startOfDay,
    subDays
} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import {TaskItemMenuProvider} from '@/context/TaskItemMenuContext';

interface TaskListProps {
    title: string;
}

const TaskGroupHeader: React.FC<{
    title: string;
    groupKey: TaskGroupCategory;
}> = React.memo(({title, groupKey}) => (
    <div
        className={twMerge(
            "flex items-center justify-between px-4 pt-3 pb-1.5", // Increased left padding to align with task text
            "text-[12px] font-normal text-grey-medium uppercase tracking-[0.5px]", // Per spec for group titles
            "sticky top-0 z-10 bg-white" // White bg for sticky header
        )}
    >
        <span>{title}</span>
        {groupKey === 'overdue' && (
            <Popover.Anchor asChild>
                <Popover.Trigger asChild>
                    <Button
                        variant="link" size="sm" icon="calendar-check"
                        className="text-[11px] !h-5 px-1 text-primary hover:text-primary-dark -mr-1"
                        title="Reschedule all overdue tasks..."
                        iconProps={{size: 12, strokeWidth: 1.5}}
                    >
                        Reschedule All
                    </Button>
                </Popover.Trigger>
            </Popover.Anchor>
        )}
    </div>
));
TaskGroupHeader.displayName = 'TaskGroupHeader';

const groupTitles: Record<TaskGroupCategory, string> = {
    overdue: 'Overdue', today: 'Today', next7days: 'Next 7 Days', later: 'Later', nodate: 'No Date',
};
const groupOrder: TaskGroupCategory[] = ['overdue', 'today', 'next7days', 'later', 'nodate'];


const TaskList: React.FC<TaskListProps> = ({title: pageTitle}) => {
    const allTasks = useAtomValue(tasksAtom);
    const setTasks = useSetAtom(tasksAtom);
    const currentFilterGlobal = useAtomValue(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const groupedTasks = useAtomValue(groupedAllTasksAtom);
    const rawSearchResults = useAtomValue(rawSearchResultsAtom);
    const searchTerm = useAtomValue(searchTermAtom);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [draggingTask, setDraggingTask] = useState<Task | null>(null);
    const [isBulkRescheduleOpen, setIsBulkRescheduleOpen] = useState(false);

    const {tasksToDisplay, isGroupedView, isSearching} = useMemo(() => {
        const searching = searchTerm.trim().length > 0;
        let displayData: Task[] | Record<TaskGroupCategory, Task[]> = [];
        let grouped = false;

        if (searching) {
            displayData = rawSearchResults;
            grouped = false;
        } else if (currentFilterGlobal === 'all') {
            displayData = groupedTasks;
            grouped = true;
        } else {
            let filtered: Task[] = [];
            const activeTasks = allTasks.filter((task: Task) => task.list !== 'Trash');
            const trashedTasks = allTasks.filter((task: Task) => task.list === 'Trash');

            switch (currentFilterGlobal) {
                case 'today':
                    filtered = activeTasks.filter((task: Task) => !task.completed && task.dueDate != null && isToday(task.dueDate));
                    break;
                case 'next7days':
                    filtered = activeTasks.filter((task: Task) => {
                        if (task.completed || task.dueDate == null) return false;
                        const date = safeParseDate(task.dueDate);
                        return date && isValid(date) && !isOverdue(date) && isWithinNext7Days(date);
                    });
                    break;
                case 'completed':
                    filtered = activeTasks.filter((task: Task) => task.completed).sort((a: Task, b: Task) =>
                        (b.completedAt ?? b.updatedAt ?? 0) - (a.completedAt ?? a.updatedAt ?? 0)
                    );
                    break;
                case 'trash':
                    filtered = trashedTasks.sort((a: Task, b: Task) => (b.updatedAt || 0) - (a.updatedAt || 0));
                    break;
                default:
                    if (currentFilterGlobal.startsWith('list-')) {
                        const listName = currentFilterGlobal.substring(5);
                        filtered = activeTasks.filter((task: Task) => !task.completed && task.list === listName);
                    } else if (currentFilterGlobal.startsWith('tag-')) {
                        const tagName = currentFilterGlobal.substring(4);
                        filtered = activeTasks.filter((task: Task) => !task.completed && task.tags?.includes(tagName));
                    } else {
                        console.warn(`Unrecognized filter: ${currentFilterGlobal}, showing all tasks.`);
                        displayData = groupedTasks;
                        grouped = true;
                        filtered = [];
                    }
                    break;
            }
            if (!grouped && currentFilterGlobal !== 'completed' && currentFilterGlobal !== 'trash') {
                filtered.sort((a: Task, b: Task) => (a.order - b.order) || (a.createdAt - b.createdAt));
            }
            if (!grouped) {
                displayData = filtered;
            }
        }
        return {tasksToDisplay: displayData, isGroupedView: grouped, isSearching: searching};
    }, [searchTerm, currentFilterGlobal, groupedTasks, rawSearchResults, allTasks]);

    const sortableItems: UniqueIdentifier[] = useMemo(() => {
        if (isGroupedView) {
            return groupOrder.flatMap(groupKey =>
                (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey]?.map(task => task.id) ?? []
            );
        } else {
            return (tasksToDisplay as Task[]).map(task => task.id);
        }
    }, [tasksToDisplay, isGroupedView]);

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 8}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates})
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const {active} = event;
        const allVisibleTasks = isGroupedView
            ? Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).flat()
            : (tasksToDisplay as Task[]);
        const activeTask = allVisibleTasks.find((task: Task) => task.id === active.id) ?? allTasks.find((task: Task) => task.id === active.id);

        if (activeTask && !activeTask.completed && activeTask.list !== 'Trash') {
            setDraggingTask(activeTask);
            setSelectedTaskId(activeTask.id);
        } else {
            setDraggingTask(null);
        }
    }, [tasksToDisplay, isGroupedView, setSelectedTaskId, allTasks]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const {active, over} = event;
        setDraggingTask(null);

        if (!over || !active.data.current?.task || active.id === over.id) {
            return;
        }

        const activeId = active.id as string;
        const overId = over.id as string;
        const originalTask = active.data.current.task as Task;

        let targetGroupCategory: TaskGroupCategory | undefined = undefined;
        if (currentFilterGlobal === 'all' && over.data.current?.type === 'task-item') {
            targetGroupCategory = over.data.current?.groupCategory as TaskGroupCategory | undefined;
        }
        const categoryChanged = targetGroupCategory && targetGroupCategory !== originalTask.groupCategory;

        setTasks((currentTasks) => {
            const oldIndex = currentTasks.findIndex(t => t.id === activeId);
            const newIndex = currentTasks.findIndex(t => t.id === overId);

            if (oldIndex === -1 || newIndex === -1) {
                console.warn("DragEnd: Task not found in current task list.");
                return currentTasks;
            }

            const currentVisualOrderIds = sortableItems;
            const activeVisualIndex = currentVisualOrderIds.indexOf(activeId);
            const overVisualIndex = currentVisualOrderIds.indexOf(overId);

            if (activeVisualIndex === -1 || overVisualIndex === -1) {
                console.warn("DragEnd: Task not found in visual order array.");
                return currentTasks;
            }

            const movedVisualOrderIds = arrayMove(currentVisualOrderIds, activeVisualIndex, overVisualIndex);
            const finalMovedVisualIndex = movedVisualOrderIds.indexOf(activeId);

            const prevTaskId = finalMovedVisualIndex > 0 ? movedVisualOrderIds[finalMovedVisualIndex - 1] : null;
            const nextTaskId = finalMovedVisualIndex < movedVisualOrderIds.length - 1 ? movedVisualOrderIds[finalMovedVisualIndex + 1] : null;

            const prevTask = prevTaskId ? currentTasks.find((t: Task) => t.id === prevTaskId) : null;
            const nextTask = nextTaskId ? currentTasks.find((t: Task) => t.id === nextTaskId) : null;

            const prevOrder = prevTask?.order;
            const nextOrder = nextTask?.order;
            let newOrderValue: number;

            if (prevOrder === undefined || prevOrder === null) {
                newOrderValue = (nextOrder ?? Date.now()) - 1000;
            } else if (nextOrder === undefined || nextOrder === null) {
                newOrderValue = prevOrder + 1000;
            } else {
                const mid = prevOrder + (nextOrder - prevOrder) / 2;
                if (!Number.isFinite(mid) || mid <= prevOrder || mid >= nextOrder) {
                    newOrderValue = prevOrder + Math.random();
                    console.warn("Order calculation fallback (random offset).");
                } else {
                    newOrderValue = mid;
                }
            }
            if (!Number.isFinite(newOrderValue)) {
                newOrderValue = Date.now();
                console.warn("Order calculation fallback (Date.now()).");
            }

            let newDueDate: number | null | undefined = undefined;

            if (categoryChanged && targetGroupCategory) {
                const todayStart = startOfDay(new Date());
                switch (targetGroupCategory) {
                    case 'today':
                        newDueDate = todayStart.getTime();
                        break;
                    case 'next7days':
                        newDueDate = startOfDay(addDays(todayStart, 1)).getTime();
                        break;
                    case 'later':
                        newDueDate = startOfDay(addDays(todayStart, 8)).getTime();
                        break;
                    case 'overdue':
                        newDueDate = startOfDay(subDays(todayStart, 1)).getTime();
                        break;
                    case 'nodate':
                        newDueDate = null;
                        break;
                }

                const currentDueDateObj = safeParseDate(originalTask.dueDate);
                const currentDueDayStart = currentDueDateObj && isValid(currentDueDateObj) ? startOfDay(currentDueDateObj).getTime() : null;
                const newDueDayStart = newDueDate !== null && newDueDate !== undefined ? startOfDay(new Date(newDueDate)).getTime() : null;

                if (currentDueDayStart === newDueDayStart) {
                    newDueDate = undefined;
                }
            }
            return currentTasks.map((task: Task) => {
                if (task.id === activeId) {
                    const updates: Partial<Task> = {
                        order: newOrderValue,
                    };
                    if (newDueDate !== undefined) {
                        updates.dueDate = newDueDate;
                    }
                    return {...task, ...updates};
                }
                return task;
            });
        });

    }, [setTasks, currentFilterGlobal, sortableItems]);

    const handleAddTask = useCallback(() => {
        const now = Date.now();
        let defaultList = 'Inbox';
        let defaultDueDate: number | null = null;
        let defaultTags: string[] = [];

        if (currentFilterGlobal.startsWith('list-')) {
            const listName = currentFilterGlobal.substring(5);
            if (listName !== 'Trash' && listName !== 'Completed') {
                defaultList = listName;
            }
        } else if (currentFilterGlobal === 'today') {
            defaultDueDate = startOfDay(now).getTime();
        } else if (currentFilterGlobal.startsWith('tag-')) {
            defaultTags = [currentFilterGlobal.substring(4)];
        } else if (currentFilterGlobal === 'next7days') {
            defaultDueDate = startOfDay(addDays(now, 1)).getTime();
        }

        let newOrder: number;
        const visibleTaskIds = sortableItems;
        if (visibleTaskIds.length > 0) {
            const firstTaskId = visibleTaskIds[0];
            const firstTask = allTasks.find((t: Task) => t.id === firstTaskId);
            const minOrder = (firstTask && typeof firstTask.order === 'number' && isFinite(firstTask.order))
                ? firstTask.order
                : Date.now();
            newOrder = minOrder - 1000;
        } else {
            newOrder = Date.now();
        }
        if (!isFinite(newOrder)) {
            newOrder = Date.now();
            console.warn("AddTask: Order calculation fallback (Date.now()).");
        }

        const newTask: Omit<Task, 'groupCategory' | 'completed'> = {
            id: `task-${now}-${Math.random().toString(16).slice(2)}`,
            title: '',
            completedAt: null,
            list: defaultList,
            completionPercentage: null,
            dueDate: defaultDueDate,
            order: newOrder,
            createdAt: now,
            updatedAt: now,
            content: '',
            tags: defaultTags,
            priority: null,
        };
        setTasks(prev => [newTask as Task, ...prev]);
        setSelectedTaskId(newTask.id);
    }, [currentFilterGlobal, setTasks, setSelectedTaskId, sortableItems, allTasks]);

    const handleBulkRescheduleDateSelect = useCallback((date: Date | undefined) => {
        if (!date || !isValid(date)) {
            setIsBulkRescheduleOpen(false);
            return;
        }
        const newDueDateTimestamp = date.getTime();

        setTasks(currentTasks =>
            currentTasks.map((task: Task) => {
                const isTaskOverdue = !task.completed &&
                    task.list !== 'Trash' &&
                    task.dueDate != null &&
                    isValid(task.dueDate) &&
                    isBefore(startOfDay(safeParseDate(task.dueDate)!), startOfDay(new Date()));

                if (isTaskOverdue) {
                    return {...task, dueDate: newDueDateTimestamp};
                }
                return task;
            })
        );
        setIsBulkRescheduleOpen(false);
    }, [setTasks]);

    const closeBulkReschedulePopover = useCallback(() => setIsBulkRescheduleOpen(false), []);

    const renderTaskGroup = useCallback((groupTasks: Task[], groupKey: TaskGroupCategory | 'flat-list' | string) => (
        <AnimatePresence initial={false} mode="sync">
            {groupTasks.map((task: Task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    groupCategory={isGroupedView && groupKey !== 'flat-list' ? groupKey as TaskGroupCategory : undefined}
                    scrollContainerRef={scrollContainerRef}
                />
            ))}
        </AnimatePresence>
    ), [isGroupedView, scrollContainerRef]);

    const isEmpty = useMemo(() => {
        if (isGroupedView) {
            return Object.values(tasksToDisplay as Record<TaskGroupCategory, Task[]>).every((group: Task[]) => group.length === 0);
        } else {
            return (tasksToDisplay as Task[]).length === 0;
        }
    }, [tasksToDisplay, isGroupedView]);

    const emptyStateTitle = useMemo(() => {
        if (isSearching) return `No results for "${searchTerm}"`;
        if (currentFilterGlobal === 'trash') return 'Trash is empty';
        if (currentFilterGlobal === 'completed') return 'No completed tasks yet';
        if (currentFilterGlobal.startsWith('list-') || currentFilterGlobal.startsWith('tag-')) {
            return `No active tasks in "${pageTitle}"`;
        }
        return `No tasks for "${pageTitle}"`;
    }, [isSearching, searchTerm, currentFilterGlobal, pageTitle]);

    const headerClass = useMemo(() => twMerge(
        "px-6 py-0 h-[56px]",
        "border-b border-grey-light", // Updated border color
        "flex justify-between items-center flex-shrink-0 z-10",
        "bg-white"
    ), []);

    const showAddTaskButton = useMemo(() => !['completed', 'trash'].includes(currentFilterGlobal) && !isSearching, [currentFilterGlobal, isSearching]);

    const datePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[60] p-0 bg-white rounded-base shadow-modal",
        "data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"
    ), []);

    return (
        <TaskItemMenuProvider>
            <Popover.Root open={isBulkRescheduleOpen} onOpenChange={setIsBulkRescheduleOpen}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd} measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
                    <div className="h-full flex flex-col bg-white overflow-hidden relative">
                        <div className={headerClass}>
                            <h1 className="text-[18px] font-light text-grey-dark truncate pr-2"
                                title={pageTitle}>{pageTitle}</h1>
                            <div className="flex items-center space-x-2">
                                {showAddTaskButton && (
                                    <Button variant="primary" size="md" icon="plus" onClick={handleAddTask}
                                            className="!h-[32px] !px-4 !font-normal">Add Task</Button>
                                )}
                            </div>
                        </div>
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto styled-scrollbar relative">
                            {isEmpty ? (
                                <div
                                    className="flex flex-col items-center justify-center h-full text-grey-medium px-6 text-center pt-10">
                                    <Icon
                                        name={currentFilterGlobal === 'trash' ? 'trash' : (currentFilterGlobal === 'completed' ? 'check-square' : (isSearching ? 'search' : 'archive'))}
                                        size={32} strokeWidth={1} className="mb-3 text-grey-light opacity-80"/>
                                    <p className="text-[13px] font-normal text-grey-dark">{emptyStateTitle}</p>
                                    {showAddTaskButton && (
                                        <p className="text-[11px] mt-1 text-grey-medium font-light">Click the '+' button
                                            to add a new task.</p>)}
                                </div>
                            ) : (<div className="pb-16"><SortableContext items={sortableItems}
                                                                         strategy={verticalListSortingStrategy}>
                                {isGroupedView ? (<> {groupOrder.map(groupKey => {
                                        const groupTasks = (tasksToDisplay as Record<TaskGroupCategory, Task[]>)[groupKey];
                                        if (groupTasks && groupTasks.length > 0) {
                                            return (<div key={groupKey} className="mb-4"><TaskGroupHeader
                                                title={groupTitles[groupKey]}
                                                groupKey={groupKey}/> {renderTaskGroup(groupTasks, groupKey)} </div>);
                                        }
                                        return null;
                                    })} </>
                                ) : (<div
                                    className="pt-0.5"> {renderTaskGroup(tasksToDisplay as Task[], 'flat-list')} </div>)}
                            </SortableContext></div>)}
                        </div>
                    </div>
                    <DragOverlay dropAnimation={null}>
                        {draggingTask ? (<div className="shadow-lg rounded-base bg-white"><TaskItem task={draggingTask}
                                                                                                    isOverlay={true}
                                                                                                    scrollContainerRef={scrollContainerRef}/>
                        </div>) : null}
                    </DragOverlay>
                    <Popover.Portal>
                        <Popover.Content sideOffset={5} align="end" className={datePickerPopoverWrapperClasses}
                                         onOpenAutoFocus={(e) => e.preventDefault()}
                                         onCloseAutoFocus={(e) => e.preventDefault()}>
                            <CustomDatePickerContent initialDate={undefined} onSelect={handleBulkRescheduleDateSelect}
                                                     closePopover={closeBulkReschedulePopover}/>
                        </Popover.Content>
                    </Popover.Portal>
                </DndContext>
            </Popover.Root>
        </TaskItemMenuProvider>
    );
};
TaskList.displayName = 'TaskList';
export default TaskList;