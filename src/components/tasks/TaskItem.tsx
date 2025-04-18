// src/components/tasks/TaskItem.tsx
import React, { useMemo } from 'react';
import { Task, TaskGroupCategory } from '@/types'; // Added TaskGroupCategory
import { formatRelativeDate, isOverdue, safeParseDate } from '@/utils/dateUtils';
import { useAtom } from 'jotai';
import { selectedTaskIdAtom, tasksAtom } from '@/store/atoms';
import Icon from '../common/Icon';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Button from "@/components/common/Button";

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory; // Receive group category for DND context
    isOverlay?: boolean; // To style the item when rendered in DragOverlay
    style?: React.CSSProperties; // Allow passing style from DragOverlay
}

const TaskItem: React.FC<TaskItemProps> = ({ task, groupCategory, isOverlay = false, style: overlayStyle }) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const [, setTasks] = useAtom(tasksAtom);
    const isSelected = selectedTaskId === task.id;

    // Determine if the task is sortable (not completed and not in Trash)
    const isSortable = !task.completed && task.list !== 'Trash';

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: task.id,
        disabled: !isSortable, // Disable sorting based on condition
        data: { // Pass task data and group category for context
            task,
            type: 'task-item', // Identify draggable type
            groupCategory: groupCategory ?? task.groupCategory, // Pass the category for drop logic
        },
    });

    // Combine dnd-kit styles with overlay styles if provided
    const style = {
        ...overlayStyle, // Apply styles from DragOverlay first
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 150ms ease-apple', // Use apple ease
        // Apply styles for the original item *while* dragging (placeholder appearance)
        ...(isDragging && !isOverlay && {
            opacity: 0.3, // More faded placeholder
            cursor: 'grabbing',
            // boxShadow: 'none', // Remove shadow from original item while dragging
        }),
        // Ensure overlay has grabbing cursor and looks distinct
        ...(isOverlay && {
            cursor: 'grabbing',
            boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)', // Stronger overlay shadow
            borderRadius: '6px', // rounded-md
            border: '1px solid rgba(0, 0, 0, 0.05)' // Subtle border for overlay
        }),
        zIndex: isDragging || isOverlay ? 10 : 1, // Ensure dragging/overlay item is on top
    };

    const handleTaskClick = (e: React.MouseEvent<HTMLDivElement>) => { // Changed type to div
        // Prevent selection if clicking interactive elements or if in Trash
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a') || task.list === 'Trash') {
            return;
        }
        setSelectedTaskId(task.id);
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation(); // Prevent task selection when clicking checkbox
        const isChecked = e.target.checked;
        const now = Date.now();
        setTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === task.id ? { ...t, completed: isChecked, updatedAt: now } : t
            )
        );
        // If completing the currently selected task, deselect it
        if (isChecked && isSelected) {
            setSelectedTaskId(null);
        }
    };

    // Safely parse due date only once
    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const overdue = useMemo(() => dueDate && !task.completed && isOverdue(dueDate), [dueDate, task.completed]);

    // Base class names - use glass effect for overlay
    const baseClasses = twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-border-color/60 group relative min-h-[52px] transition-colors duration-100 ease-out',
        isSelected && !isDragging && !isOverlay && 'bg-primary/10', // Slightly stronger selection background
        !isSelected && !isDragging && !isOverlay && isSortable && 'hover:bg-gray-500/5 cursor-pointer', // Subtle hover for glass
        task.completed && 'opacity-60', // Dim completed tasks more
        task.list === 'Trash' && 'opacity-50 cursor-default hover:bg-transparent', // Style for trash items
        isOverlay && 'bg-glass-100 backdrop-blur-md border rounded-md shadow-strong', // Overlay specific glass style
        !isSortable && !isOverlay && 'bg-canvas-alt/30 hover:bg-canvas-alt/30 cursor-default', // Different background for non-sortable (completed/trash)
        isSortable && !isOverlay && 'bg-transparent', // Make default sortable items transparent to see underlying bg/glass
    );

    return (
        // Removed outer motion.div, handled in TaskList
        <div
            ref={setNodeRef}
            style={style}
            className={baseClasses}
            onClick={handleTaskClick}
            role="button" // Semantically a button if clickable
            tabIndex={0} // Make it focusable
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>); }} // Allow activation with Enter/Space, refined type
            aria-selected={isSelected}
        >
            {/* Drag Handle - Conditionally rendered and styled */}
            <div className="flex-shrink-0 h-full flex items-center mr-2">
                {isSortable ? (
                    <button
                        {...attributes}
                        {...listeners}
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()} // Prevent task selection, added type
                        className={twMerge(
                            "text-muted cursor-grab p-1 -ml-1 opacity-0 group-hover:opacity-50 group-focus-within:opacity-50 focus-visible:opacity-80", // Adjusted opacity
                            "transition-opacity duration-150 outline-none rounded", // Added rounding for focus
                            isDragging && "opacity-50" // Keep handle visible while dragging original
                        )}
                        aria-label="Drag task to reorder"
                        tabIndex={-1} // Not focusable via tab
                    >
                        <Icon name="grip-vertical" size={15} strokeWidth={2} />
                    </button>
                ) : (
                    <div className="w-[27px]"></div> // Placeholder for alignment when not sortable
                )}
            </div>


            {/* Checkbox */}
            <div className="flex-shrink-0 mr-2.5 pt-[3px]"> {/* Adjusted top padding slightly */}
                <input
                    type="checkbox"
                    id={`task-checkbox-${task.id}`}
                    checked={task.completed}
                    onChange={handleCheckboxChange}
                    onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()} // Prevent selection, added type
                    className={twMerge(
                        "h-4 w-4 rounded border-2 transition duration-100 ease-in-out cursor-pointer appearance-none", // Use appearance-none for custom styling
                        "focus:ring-primary/50 focus:ring-1 focus:ring-offset-1 focus:outline-none",
                        // Custom checkbox style
                        task.completed
                            ? 'bg-gray-300 border-gray-300 hover:bg-gray-400 hover:border-gray-400' // Completed style
                            : 'bg-canvas border-gray-400/80 hover:border-primary/60', // Incomplete style
                        // Checkmark SVG for completed state
                        'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
                        'after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-solid after:border-transparent after:transition-opacity after:duration-100',
                        task.completed ? 'after:border-white after:opacity-100' : 'after:opacity-0',
                        // Disabled style for trash items
                        task.list === 'Trash' && 'opacity-50 cursor-not-allowed !border-gray-300 hover:!border-gray-300 !bg-gray-200 after:!border-gray-400'
                    )}
                    aria-labelledby={`task-title-${task.id}`}
                    disabled={task.list === 'Trash'} // Cannot check/uncheck in Trash
                />
                <label htmlFor={`task-checkbox-${task.id}`} className="sr-only">Complete task</label>
            </div>

            {/* Task Info */}
            <div className="flex-1 min-w-0 pt-[1px]"> {/* Adjusted top padding slightly */}
                {/* Task Title */}
                <p id={`task-title-${task.id}`} className={twMerge(
                    "text-sm text-gray-800 leading-snug", // Use leading-snug for tighter lines
                    task.completed && "line-through text-muted-foreground", // Adjust completed text color
                    task.list === 'Trash' && "text-muted-foreground line-through", // Also strikethrough in trash
                )}>
                    {task.title || <span className="text-muted italic">Untitled Task</span>}
                </p>

                {/* Subline - Conditionally render info */}
                <div className="flex items-center flex-wrap text-[11px] text-muted-foreground space-x-2 mt-1 leading-tight"> {/* Darker muted text */}
                    {/* Priority Indicator (only if high/medium) */}
                    {task.priority && task.priority <= 2 && !task.completed && task.list !== 'Trash' && (
                        <span className={clsx("flex items-center", {
                            'text-red-600': task.priority === 1,
                            'text-orange-500': task.priority === 2,
                        })} title={`Priority ${task.priority}`}>
                            <Icon name="flag" size={11} strokeWidth={2.5}/>
                        </span>
                    )}
                    {/* Due Date */}
                    {dueDate && !task.completed && task.list !== 'Trash' && (
                        <span className={clsx('flex items-center whitespace-nowrap', overdue && 'text-red-600 font-medium')}>
                            <Icon name="calendar" size={11} className="mr-0.5 opacity-70" />
                            {formatRelativeDate(dueDate)}
                        </span>
                    )}
                    {/* List Name (if not Inbox and filter is 'all' or date-based) */}
                    {task.list && task.list !== 'Inbox' && task.list !== 'Trash' && !task.completed && !isSelected && (
                        <span className="flex items-center whitespace-nowrap bg-gray-500/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate" title={task.list}>
                            <Icon name="list" size={10} className="mr-0.5 opacity-70 flex-shrink-0" />
                            <span className="truncate">{task.list}</span>
                        </span>
                    )}
                    {/* Tags (limit displayed) */}
                    {task.tags && task.tags.length > 0 && !task.completed && task.list !== 'Trash' && (
                        <span className="flex items-center space-x-1">
                            {task.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="bg-gray-500/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate" title={tag}>
                                    #{tag}
                                </span>
                            ))}
                            {task.tags.length > 2 && <span className="text-muted-foreground text-[10px]">+{task.tags.length - 2}</span>}
                        </span>
                    )}
                </div>
            </div>

            {/* More Actions Button (Optional - show on hover/focus) */}
            {isSortable && !isOverlay && ( // Only show actions for sortable items, not on overlay
                <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:bg-black/10" // Smaller icon button, adjusted hover
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => { // Added type
                            e.stopPropagation();
                            console.log('More actions for task:', task.id);
                            // Trigger dropdown menu logic here
                            setSelectedTaskId(task.id); // Select task when opening actions
                        }}
                        aria-label={`More actions for ${task.title || 'task'}`}
                        tabIndex={0} // Make focusable
                    >
                        <Icon name="more-horizontal" size={16} />
                    </Button>
                </div>
            )}
        </div>
    );
};

export default TaskItem;