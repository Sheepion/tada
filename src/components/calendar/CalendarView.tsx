// src/components/calendar/CalendarView.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai'; // Added useSetAtom
import { tasksAtom, selectedTaskIdAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import { Task } from '@/types';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
    addMonths, subMonths, isSameMonth, isSameDay, getDay, startOfDay, isBefore, enUS, safeParseDate, isToday as isTodayFn, isValid // Use utils
} from '@/utils/dateUtils';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import {
    DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable,
    DragOverlay, pointerWithin, MeasuringStrategy, UniqueIdentifier
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';

// --- Draggable Task Item for Calendar ---
interface DraggableTaskProps {
    task: Task;
    onClick: () => void;
    style?: React.CSSProperties; // For DragOverlay
}

const DraggableCalendarTask: React.FC<DraggableTaskProps> = ({ task, onClick, style: overlayStyle }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `caltask-${task.id}`, // Unique prefix for calendar tasks
        data: { task, type: 'calendar-task' },
    });

    const style = {
        ...overlayStyle, // Apply overlay styles if provided
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.7 : 1, // Slightly more transparent when dragging
        zIndex: isDragging ? 1000 : 1,
    };

    const parsedDueDate = safeParseDate(task.dueDate);
    const overdue = parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed;

    // Base classes - Using subtle glass on hover
    const baseClasses = twMerge(
        "w-full text-left px-1.5 py-0.5 rounded-[5px] truncate text-[11px] transition-all duration-100 cursor-grab relative mb-0.5", // Slightly larger radius, margin bottom
        task.completed
            ? 'bg-gray-100/70 text-muted-foreground line-through italic opacity-70 pointer-events-none' // Muted completed
            : 'bg-primary/10 text-primary-dark hover:bg-primary/20', // Base style
        // Priority indicators as subtle dots
        task.priority === 1 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-red-500",
        task.priority === 2 && !task.completed && "pl-3 before:content-[''] before:absolute before:left-[5px] before:top-1/2 before:-translate-y-1/2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-orange-400",
        // Overdue style overrides priority dot color
        overdue && !task.completed && 'text-red-600 bg-red-500/10 hover:bg-red-500/20 before:bg-red-600',
        isDragging && !overlayStyle && "shadow-medium bg-white ring-1 ring-primary/50 opacity-50", // Style for the original item while dragging
        // Style for the item in the overlay (more prominent glass)
        overlayStyle && "shadow-strong ring-1 ring-primary/30 bg-glass-100 backdrop-blur-sm"
    );

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={baseClasses}
            title={task.title}
        >
            {task.title || <span className="italic text-muted">Untitled</span>}
        </button>
    );
}

// --- Droppable Day Cell ---
interface DroppableDayCellContentProps { // Renamed from DroppableDayProps to avoid name clash
    day: Date;
    children: React.ReactNode;
    className?: string;
    isOver: boolean; // Pass isOver state down
}

// Use motion for subtle scale effect
const DroppableDayCellContent: React.FC<DroppableDayCellContentProps> = ({ children, className, isOver }) => { // Removed day prop as unused
    return (
        <motion.div
            className={twMerge(
                'h-full w-full transition-colors duration-150', // Ensure full size and transition
                className,
                // Subtle highlight effect on drop target
                isOver && 'bg-primary/10 ring-1 ring-inset ring-primary/30'
            )}
            animate={{ scale: isOver ? 1.02 : 1 }} // Animate scale based on isOver
            transition={{ duration: 0.15, ease: 'easeOut' }}
        >
            {children}
        </motion.div>
    );
};

const DroppableDayCell: React.FC<{ day: Date; children: React.ReactNode; className?: string }> = ({ day, children, className }) => {
    const { isOver, setNodeRef } = useDroppable({
        id: `day-${format(day, 'yyyy-MM-dd')}`, // Unique ID for the day cell
        data: { date: day, type: 'calendar-day' },
    });

    // Wrapper div is necessary for the droppable ref and content isolation
    return (
        <div ref={setNodeRef} className="h-full w-full relative"> {/* Added relative positioning */}
            <DroppableDayCellContent day={day} className={className} isOver={isOver}>
                {children}
            </DroppableDayCellContent>
        </div>
    );
};

// --- Main Calendar View Component ---
const CalendarView: React.FC = () => {
    const [tasks, setTasks] = useAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom); // Setter only
    const [currentMonthDate, setCurrentMonthDate] = useState(startOfDay(new Date()));
    const [draggingTaskId, setDraggingTaskId] = useState<UniqueIdentifier | null>(null); // Track dragging task ID
    const [monthDirection, setMonthDirection] = useState<number>(0); // For animation: 0: none, -1: prev, 1: next

    // Get the task being dragged for the overlay
    const draggingTask = useMemo(() => {
        if (!draggingTaskId) return null;
        const id = draggingTaskId.toString().replace('caltask-', ''); // Get original task ID
        return tasks.find(t => t.id === id) ?? null;
    }, [draggingTaskId, tasks]);


    // Calculate dates for the grid
    const firstDayCurrentMonth = startOfMonth(currentMonthDate);
    const lastDayCurrentMonth = endOfMonth(currentMonthDate);
    const startDate = startOfWeek(firstDayCurrentMonth, { locale: enUS });
    const endDate = endOfWeek(lastDayCurrentMonth, { locale: enUS });
    const daysInGrid = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    // Group tasks by due date (memoized)
    const tasksByDueDate = useMemo(() => {
        const grouped: Record<string, Task[]> = {};
        tasks.forEach(task => {
            // Only include non-trashed tasks with a valid due date
            if (task.dueDate && task.list !== 'Trash') {
                const parsedDate = safeParseDate(task.dueDate);
                if (parsedDate && isValid(parsedDate)) { // Check validity
                    const dateKey = format(parsedDate, 'yyyy-MM-dd');
                    if (!grouped[dateKey]) grouped[dateKey] = [];
                    grouped[dateKey].push(task);
                }
            }
        });
        // Sort tasks within each day: Priority (High to Low), then Creation Time (Newest First)
        Object.values(grouped).forEach(dayTasks => {
            dayTasks.sort((a, b) => ((a.priority ?? 5) - (b.priority ?? 5)) || (b.createdAt - a.createdAt));
        });
        return grouped;
    }, [tasks]);

    // --- Event Handlers ---
    const handleTaskClick = (taskId: string) => {
        setSelectedTaskId(taskId);
    };

    // Month Navigation
    const changeMonth = (direction: -1 | 1) => {
        setMonthDirection(direction);
        setCurrentMonthDate(current => direction === 1 ? addMonths(current, 1) : subMonths(current, 1));
    };
    const goToToday = () => {
        const todayMonthStart = startOfMonth(new Date());
        const currentMonthStart = startOfMonth(currentMonthDate);
        if (isBefore(todayMonthStart, currentMonthStart)) setMonthDirection(-1);
        else if (isBefore(currentMonthStart, todayMonthStart)) setMonthDirection(1);
        else setMonthDirection(0); // No animation if same month
        setCurrentMonthDate(startOfDay(new Date()));
    };

    // DND Handlers
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        // Ensure we are dragging a calendar task
        if (active.data.current?.type === 'calendar-task') {
            setDraggingTaskId(active.id);
            setSelectedTaskId(active.data.current.task.id); // Select task being dragged
        }
    }, [setSelectedTaskId]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setDraggingTaskId(null); // Clear dragging state
        const { active, over } = event;

        // Check if dropped onto a valid day cell and started dragging a calendar task
        if (over?.data.current?.type === 'calendar-day' && active.data.current?.type === 'calendar-task') {
            const taskId = active.data.current.task.id as string;
            const targetDay = over.data.current?.date as Date | undefined;
            // Get the task data directly from the event, not a separate state lookup
            const originalTask = active.data.current?.task as Task | undefined;

            if (taskId && targetDay && originalTask) {
                const originalDateTime = safeParseDate(originalTask.dueDate); // Use original task from drag data
                const currentDueDateStart = originalDateTime ? startOfDay(originalDateTime) : null;
                const newDueDateStart = startOfDay(targetDay);

                // Only update if the date *actually* changed
                if (!currentDueDateStart || !isSameDay(currentDueDateStart, newDueDateStart)) {
                    setTasks((prevTasks: Task[]) =>
                        prevTasks.map(task => {
                            if (task.id === taskId) {
                                // --- Preserve Time Logic ---
                                let newTimestamp = newDueDateStart.getTime(); // Default to start of target day

                                // Try parsing the *current* task's dueDate from the state for time preservation
                                const currentTaskDateTime = safeParseDate(task.dueDate);
                                if (currentTaskDateTime && isValid(currentTaskDateTime)) {
                                    // Keep original hours/minutes/seconds if they existed
                                    const hours = currentTaskDateTime.getHours();
                                    const minutes = currentTaskDateTime.getMinutes();
                                    const seconds = currentTaskDateTime.getSeconds();
                                    const updatedDateWithTime = new Date(newDueDateStart); // Start with target day 00:00
                                    updatedDateWithTime.setHours(hours, minutes, seconds, 0); // Set original time
                                    newTimestamp = updatedDateWithTime.getTime();
                                }
                                // --- End Preserve Time Logic ---

                                return {
                                    ...task,
                                    dueDate: newTimestamp,
                                    updatedAt: Date.now(), // Update timestamp
                                };
                            }
                            return task;
                        })
                    );
                }
            }
        }

    }, [setTasks]);

    // Animation variants for month text change
    const monthTextVariants = {
        initial: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? 10 : (direction < 0 ? -10 : 0), // Subtle slide
        }),
        animate: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.25, ease: 'easeOut' } // Faster transition
        },
        exit: (direction: number) => ({
            opacity: 0,
            x: direction > 0 ? -10 : (direction < 0 ? 10 : 0), // Slide opposite direction
            transition: { duration: 0.15, ease: 'easeIn' } // Faster exit
        }),
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- Render Function for a Single Day Cell ---
    const renderCalendarDay = (day: Date, index: number) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDueDate[dateKey] || [];
        const isCurrentMonthDay = isSameMonth(day, currentMonthDate);
        const isToday = isTodayFn(day);
        const dayOfWeek = getDay(day); // 0 = Sun, 6 = Sat

        const MAX_VISIBLE_TASKS = 3; // Max tasks to show before "+ X more"

        return (
            <DroppableDayCell
                key={day.toISOString()}
                day={day}
                className={twMerge(
                    // Base styles for the cell content wrapper provided by DroppableDayCellContent
                    'flex flex-col relative transition-colors duration-150 ease-in-out overflow-hidden',
                    // Use subtle transparent backgrounds for glass effect within grid
                    isCurrentMonthDay ? 'bg-white/60' : 'bg-gray-500/5', // Light bg for current, very faint for others
                    'border-t border-l border-black/5', // Softer borders
                    // Borders - remove outer borders visually handled by container
                    dayOfWeek === 0 && 'border-l-0', // No left border for first column
                    index < 7 && 'border-t-0', // No top border for first row
                    'group' // For hover effects if needed
                )}
            >
                {/* Day Number Header */}
                <div className="flex justify-between items-center px-1.5 pt-1 pb-0.5 flex-shrink-0">
                    {/* Day number */}
                    <span className={clsx(
                        'text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full transition-colors duration-150',
                        isToday ? 'bg-primary text-white font-semibold shadow-sm' : 'text-gray-600',
                        !isCurrentMonthDay && !isToday && 'text-gray-400 opacity-60' // Dim non-current month numbers
                    )}>
                        {format(day, 'd')}
                    </span>
                    {/* Task count badge (only for current month days with tasks) */}
                    {dayTasks.length > 0 && isCurrentMonthDay && (
                        <motion.span
                            className="text-[10px] text-muted-foreground bg-black/5 px-1 py-0.5 rounded-full font-mono"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.15 }}
                        >
                            {dayTasks.length}
                        </motion.span>
                    )}
                </div>

                {/* Task List Area */}
                <div className="overflow-y-auto styled-scrollbar flex-1 space-y-0.5 px-1 pb-1 min-h-[50px]"> {/* Min height for drop */}
                    {/* Render tasks only for the current month */}
                    {isCurrentMonthDay && dayTasks.slice(0, MAX_VISIBLE_TASKS).map((task) => (
                        <DraggableCalendarTask
                            key={task.id}
                            task={task}
                            onClick={() => handleTaskClick(task.id)}
                        />
                    ))}
                    {/* "+ X more" indicator */}
                    {isCurrentMonthDay && dayTasks.length > MAX_VISIBLE_TASKS && (
                        <div className="text-[10px] text-muted-foreground pt-0.5 px-1 text-center opacity-80">
                            + {dayTasks.length - MAX_VISIBLE_TASKS} more
                        </div>
                    )}
                </div>
                {/* Subtle gradient overlay for non-current month days - enhanced */}
                {!isCurrentMonthDay && (
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-gray-500/10 backdrop-blur-[1px] opacity-60 pointer-events-none rounded-md"></div>
                    )}
            </DroppableDayCell>
        );
    };


    // --- Main Component Render ---
    return (
        <DndContext
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            collisionDetection={pointerWithin} // Simple collision detection
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} // Ensure droppables are measured correctly
        >
            {/* Apply glass effect to the main container */}
            <div className="h-full flex flex-col bg-glass backdrop-blur-lg overflow-hidden">
                {/* Header with Stronger Glass Effect */}
                <div className="px-4 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-100 backdrop-blur-md z-10 h-11"> {/* Adjusted glass */}
                    <h1 className="text-lg font-semibold text-gray-800">Calendar</h1>
                    <div className="flex items-center space-x-3">
                        {/* Today Button - Glass Style */}
                        <Button
                            onClick={goToToday}
                            variant="glass" // Use glass variant
                            size="sm"
                            className="!h-[30px] px-2.5" // Override height for sm button
                            disabled={isSameMonth(currentMonthDate, new Date()) && isTodayFn(currentMonthDate)} // Disable if viewing today in current month
                        >
                            Today
                        </Button>
                        {/* Month Navigation */}
                        <div className="flex items-center">
                            {/* Previous Month Button */}
                            <Button onClick={() => changeMonth(-1)} variant="ghost" size="icon" aria-label="Previous month" className="w-7 h-7 text-muted-foreground hover:bg-black/10">
                                <Icon name="chevron-left" size={18} />
                            </Button>
                            {/* Animated Month/Year Display */}
                            <AnimatePresence mode="wait" initial={false} custom={monthDirection}>
                                <motion.span
                                    key={format(currentMonthDate, 'yyyy-MM')} // Key changes on month change
                                    className="mx-2 text-sm font-medium w-28 text-center tabular-nums text-gray-700"
                                    custom={monthDirection}
                                    variants={monthTextVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                >
                                    {format(currentMonthDate, 'MMMM yyyy', { locale: enUS })}
                                </motion.span>
                            </AnimatePresence>
                            {/* Next Month Button */}
                            <Button onClick={() => changeMonth(1)} variant="ghost" size="icon" aria-label="Next month" className="w-7 h-7 text-muted-foreground hover:bg-black/10">
                                <Icon name="chevron-right" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 overflow-hidden p-3"> {/* Padding around the grid */}
                    {/* Grid structure with rounded corners and shadow - More subtle glass effect */}
                    <div className="h-full w-full flex flex-col rounded-lg overflow-hidden shadow-medium border border-black/10 bg-white/40 backdrop-blur-sm"> {/* Subtle glass grid container */}
                        {/* Weekday Headers - Apply glass effect */}
                        <div className="grid grid-cols-7 flex-shrink-0 border-b border-black/10 bg-glass-alt-200 backdrop-blur-sm"> {/* Glass weekday header */}
                            {weekDays.map((day) => (
                                <div key={day} className="text-center py-1.5 text-[11px] font-semibold text-muted-foreground border-l border-black/5 first:border-l-0">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Calendar Days Grid - takes remaining space */}
                        {/* Use grid-rows-6 for standard 6-row layout */}
                        <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0"> {/* min-h-0 prevents content growth issues */}
                            {/* Render day cells */}
                            {daysInGrid.map(renderCalendarDay)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay for visual feedback */}
            <DragOverlay dropAnimation={null}>
                {draggingTask ? (
                    // Use overlay style defined within DraggableCalendarTask
                    <DraggableCalendarTask
                        task={draggingTask}
                        onClick={() => {}} // No click action needed for overlay
                        style={{ cursor: 'grabbing' }} // Pass only essential overrides
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default CalendarView;