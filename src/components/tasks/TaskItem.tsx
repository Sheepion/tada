// src/components/tasks/TaskItem.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {Task, TaskGroupCategory} from '@/types';
import {formatDate, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {searchTermAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import Button from "@/components/common/Button";
import Highlighter from "react-highlight-words";
import {IconName} from "@/components/common/IconMap";
import MenuItem from "@/components/common/MenuItem";
import CustomDatePickerPopover from "@/components/common/CustomDatePickerPopover";
import {usePopper} from "react-popper";
import {AnimatePresence, motion} from 'framer-motion';
import {useTaskItemMenu} from '@/context/TaskItemMenuContext';
import ConfirmDeleteModal from "@/components/common/ConfirmDeleteModal";

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

// --- ENHANCED SVG Progress Indicator Component ---
interface ProgressIndicatorProps {
    percentage: number | null; // null or 0 = 0%, 20, 50, 80, 100
    isTrash: boolean;
    size?: number;
    className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaLabelledby?: string; // For accessibility linking to task title
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = React.memo(({
                                                                                   percentage,
                                                                                   isTrash,
                                                                                   size = 16,
                                                                                   className,
                                                                                   onClick,
                                                                                   onKeyDown,
                                                                                   ariaLabelledby
                                                                               }) => {
    const normalizedPercentage = percentage ?? 0;
    const radius = size / 2 - 1.25; // Slightly smaller radius for bolder stroke
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 2.5; // Bolder stroke

    // Calculate stroke-dashoffset for progress arc
    const offset = circumference - (normalizedPercentage / 100) * circumference;

    // Checkmark path scaled
    const checkPath = `M ${size * 0.3} ${size * 0.55} L ${size * 0.45} ${size * 0.7} L ${size * 0.75} ${size * 0.4}`;

    const indicatorClasses = useMemo(() => twMerge(
        "relative flex-shrink-0 rounded-full transition-all duration-200 ease-apple focus:outline-none",
        "focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-current/50",
        !isTrash && "cursor-pointer",
        isTrash && "opacity-50 cursor-not-allowed",
        className
    ), [isTrash, className]);

    const buttonBgColor = useMemo(() => {
        if (isTrash) return "bg-gray-200/50 border-gray-300"; // Ensure border color matches
        if (normalizedPercentage === 100) return "bg-primary/80 hover:bg-primary/90 border-primary/80"; // Use primary color for completed background
        return "bg-white/40 hover:border-primary/60 border-gray-400/80"; // Default background
    }, [isTrash, normalizedPercentage]);

    // Enhanced progress stroke color
    const progressStrokeColor = useMemo(() => {
        if (isTrash) return "stroke-gray-400";
        if (normalizedPercentage === 100) return "stroke-white"; // Checkmark color
        // Adjusted saturation for better visibility
        if (normalizedPercentage >= 80) return "stroke-primary/90";
        if (normalizedPercentage >= 50) return "stroke-primary/80";
        if (normalizedPercentage > 0) return "stroke-primary/70";
        return "stroke-transparent"; // No stroke if 0%
    }, [isTrash, normalizedPercentage]);


    const progressLabel = normalizedPercentage === 100 ? "Completed" : `${normalizedPercentage}% done`;

    return (
        <button
            type="button"
            onClick={onClick}
            onKeyDown={onKeyDown}
            disabled={isTrash}
            // Link to task title for better screen reader announcement
            aria-labelledby={ariaLabelledby}
            aria-label={`Task progress: ${progressLabel}`} // Add percentage to label
            aria-pressed={normalizedPercentage === 100}
            className={twMerge(indicatorClasses, buttonBgColor, "border")} // Ensure border is applied
            style={{width: size, height: size}}
        >
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="absolute inset-0 w-full h-full transition-opacity duration-200 ease-apple"
                // Only show SVG content if progress > 0
                style={{opacity: normalizedPercentage > 0 ? 1 : 0}}
                aria-hidden="true" // SVG is decorative, label is on button
            >
                {/* Progress Arc (shown for > 0% and < 100%) */}
                {normalizedPercentage > 0 && normalizedPercentage < 100 && (
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        className={progressStrokeColor}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`} // Start from top
                        strokeLinecap="round"
                        style={{transition: 'stroke-dashoffset 0.3s ease-out'}}
                    />
                )}
                {/* Checkmark (only shown for 100%) */}
                {normalizedPercentage === 100 && (
                    // Add a background circle for the checkmark for better contrast
                    <>
                        <circle cx={size / 2} cy={size / 2} r={size / 2} className="fill-current text-primary/80"/>
                        <path
                            d={checkPath}
                            fill="none"
                            strokeWidth={strokeWidth * 0.9} // Slightly thinner checkmark
                            className={progressStrokeColor} // Should be white now
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{transition: 'opacity 0.2s ease-in 0.1s'}}
                        />
                    </>
                )}
            </svg>
        </button>
    );
});
ProgressIndicator.displayName = 'ProgressIndicator';

// Helper function to generate content snippet (keep as is)
function generateContentSnippet(content: string, term: string, length: number = 35): string {
    if (!content || !term) return '';
    const lowerContent = content.toLowerCase();
    const searchWords = term.toLowerCase().split(' ').filter(Boolean);
    let firstMatchIndex = -1;
    let matchedWord = '';
    for (const word of searchWords) {
        const index = lowerContent.indexOf(word);
        if (index !== -1) {
            firstMatchIndex = index;
            matchedWord = word;
            break;
        }
    }
    if (firstMatchIndex === -1) {
        return content.substring(0, length) + (content.length > length ? '...' : '');
    }
    const start = Math.max(0, firstMatchIndex - Math.floor(length / 3));
    const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3));
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
}

// Priority Map (keep as is)
const priorityMap: Record<number, { label: string; iconColor: string }> = {
    1: {
        label: 'High',
        iconColor: 'text-red-500'
    },
    2: {label: 'Medium', iconColor: 'text-orange-500'},
    3: {label: 'Low', iconColor: 'text-blue-500'},
    4: {label: 'Lowest', iconColor: 'text-gray-500'},
};


// TaskItem Component (with corrections and updates)
const TaskItem: React.FC<TaskItemProps> = memo(({
                                                    task,
                                                    groupCategory,
                                                    isOverlay = false,
                                                    style: overlayStyle,
                                                    scrollContainerRef
                                                }) => {
    // Hooks and state setup
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const {openItemId, setOpenItemId} = useTaskItemMenu();
    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [datePickerReferenceElement, setDatePickerReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [datePickerPopperElement, setDatePickerPopperElement] = useState<HTMLDivElement | null>(null);
    const actionsTriggerRef = useRef<HTMLButtonElement>(null);
    const actionsContentRef = useRef<HTMLDivElement>(null);
    const [actionsStyle, setActionsStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 55,
    });

    // Popper/Actions/Sorting hooks and logic
    const {styles: datePickerStyles, attributes: datePickerAttributes, update: updateDatePickerPopper} = usePopper(
        datePickerReferenceElement, datePickerPopperElement,
        {
            strategy: 'fixed',
            placement: 'bottom-start',
            modifiers: [{name: 'offset', options: {offset: [0, 8]}}, {
                name: 'preventOverflow',
                options: {padding: 8, boundary: scrollContainerRef?.current ?? undefined}
            }, {
                name: 'flip',
                options: {
                    padding: 8,
                    boundary: scrollContainerRef?.current ?? undefined,
                    fallbackPlacements: ['top-start', 'bottom-end', 'top-end']
                }
            }],
        }
    );
    useEffect(() => {
        if (isDatePickerOpen && scrollContainerRef?.current && updateDatePickerPopper) {
            const rafId = requestAnimationFrame(() => updateDatePickerPopper());
            return () => cancelAnimationFrame(rafId);
        }
    }, [isDatePickerOpen, updateDatePickerPopper, scrollContainerRef]);
    const isTrashItem = useMemo(() => task.list === 'Trash', [task.list]);
    const isCompleted = useMemo(() => (task.completionPercentage ?? 0) === 100 && !isTrashItem, [task.completionPercentage, isTrashItem]);
    const isSortable = useMemo(() => !isCompleted && !isTrashItem && !isOverlay, [isCompleted, isTrashItem, isOverlay]);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition: dndTransition,
        isDragging
    } = useSortable({
        id: task.id,
        disabled: !isSortable,
        data: {task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory},
    });
    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        const calculatedTransition = dndTransition;
        if (isDragging && !isOverlay) {
            return {
                transform: baseTransform,
                transition: calculatedTransition,
                opacity: 0.4,
                cursor: 'grabbing',
                backgroundColor: 'hsla(210, 40%, 98%, 0.3)',
                boxShadow: 'none',
                border: '1px dashed hsla(0, 0%, 0%, 0.15)',
                zIndex: 1,
            };
        }
        if (isOverlay) {
            return {
                ...overlayStyle,
                transform: baseTransform,
                transition: calculatedTransition,
                cursor: 'grabbing',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                zIndex: 1000,
            };
        }
        return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition || 'background-color 0.2s ease-apple, border-color 0.2s ease-apple',
            zIndex: isSelected ? 2 : 1,
        };
    }, [overlayStyle, transform, dndTransition, isDragging, isOverlay, isSelected]);
    useEffect(() => {
        if (openItemId !== task.id) {
            if (isMoreActionsOpen) setIsMoreActionsOpen(false);
            if (isDatePickerOpen) setIsDatePickerOpen(false);
        }
    }, [openItemId, task.id, isMoreActionsOpen, isDatePickerOpen]);
    const calculateActionsPosition = useCallback(() => {
        if (!actionsTriggerRef.current || !actionsContentRef.current) return;
        const triggerRect = actionsTriggerRef.current.getBoundingClientRect();
        const contentRect = actionsContentRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8;
        let top = triggerRect.bottom + margin / 2;
        let left = triggerRect.right - contentRect.width;
        if (top + contentRect.height + margin > viewportHeight) top = triggerRect.top - contentRect.height - margin / 2;
        if (left < margin) left = margin;
        if (left + contentRect.width + margin > viewportWidth) left = viewportWidth - contentRect.width - margin;
        top = Math.max(margin, top);
        left = Math.max(margin, left);
        setActionsStyle(prev => ({...prev, top: `${top}px`, left: `${left}px`, opacity: 1, pointerEvents: 'auto'}));
    }, []);
    useEffect(() => {
        if (isMoreActionsOpen) {
            requestAnimationFrame(() => calculateActionsPosition());
        } else {
            setActionsStyle(prev => ({...prev, opacity: 0, pointerEvents: 'none'}));
        }
    }, [isMoreActionsOpen, calculateActionsPosition]);
    useEffect(() => {
        if (!isMoreActionsOpen || !scrollContainerRef) return;
        const scrollElement = scrollContainerRef.current;
        const handleUpdate = () => calculateActionsPosition();
        let throttleTimeout: NodeJS.Timeout | null = null;
        const throttledHandler = () => {
            if (!throttleTimeout) {
                throttleTimeout = setTimeout(() => {
                    handleUpdate();
                    throttleTimeout = null;
                }, 50);
            }
        };
        if (scrollElement) scrollElement.addEventListener('scroll', throttledHandler, {passive: true});
        window.addEventListener('resize', throttledHandler);
        return () => {
            if (scrollElement) scrollElement.removeEventListener('scroll', throttledHandler);
            window.removeEventListener('resize', throttledHandler);
            if (throttleTimeout) clearTimeout(throttleTimeout);
        };
    }, [isMoreActionsOpen, calculateActionsPosition, scrollContainerRef]);
    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a') || actionsTriggerRef.current?.contains(target) || datePickerReferenceElement?.contains(target) || target.closest('.ignore-click-away') || actionsContentRef.current?.contains(target) || target.closest('.react-tooltip') || target.closest('[role="dialog"]')) {
            return;
        }
        if (isDragging) {
            return;
        }
        setSelectedTaskId(id => (id === task.id ? null : task.id));
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, datePickerReferenceElement, setOpenItemId, isDragging]);

    // Update Task Logic
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed'>>) => {
        setTasks(prevTasks => prevTasks.map(t => {
            if (t.id === task.id) {
                return {...t, ...updates, updatedAt: Date.now()};
            }
            return t;
        }));
    }, [setTasks, task.id]);

    // Progress Cycling Logic (for main button)
    const cycleCompletionPercentage = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        const currentPercentage = task.completionPercentage ?? 0;
        let nextPercentage: number | null = null;
        if (currentPercentage === 100) nextPercentage = null;
        else nextPercentage = 100;
        updateTask({completionPercentage: nextPercentage});
        if (nextPercentage === 100 && isSelected) setSelectedTaskId(null);
        setOpenItemId(null);
    }, [task.completionPercentage, updateTask, isSelected, setSelectedTaskId, setOpenItemId]);

    // Direct Progress Setting Logic (for menu)
    const closeActionsDropdown = useCallback(() => {
        setIsMoreActionsOpen(false);
        if (openItemId === task.id) {
            setOpenItemId(null);
        }
    }, [setOpenItemId, openItemId, task.id]);
    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({completionPercentage: newPercentage});
        if (newPercentage === 100 && isSelected) setSelectedTaskId(null);
        closeActionsDropdown();
    }, [updateTask, isSelected, setSelectedTaskId, closeActionsDropdown]);

    const handleProgressIndicatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cycleCompletionPercentage();
        }
    }, [cycleCompletionPercentage]);

    // Date picker/other actions logic
    const openDatePicker = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setDatePickerReferenceElement(event.currentTarget);
        setIsDatePickerOpen(true);
        setIsMoreActionsOpen(false);
        setOpenItemId(task.id);
    }, [setOpenItemId, task.id]);
    const closeDatePicker = useCallback(() => {
        setIsDatePickerOpen(false);
        setDatePickerReferenceElement(null);
        if (openItemId === task.id) {
            setOpenItemId(null);
        }
    }, [setOpenItemId, openItemId, task.id]);
    const handleDateSelect = useCallback((date: Date | undefined) => {
        const newDueDate = date && isValid(date) ? startOfDay(date).getTime() : null;
        updateTask({dueDate: newDueDate});
        closeDatePicker();
    }, [updateTask, closeDatePicker]);
    const toggleActionsDropdown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const opening = !isMoreActionsOpen;
        setIsMoreActionsOpen(opening);
        setIsDatePickerOpen(false);
        setOpenItemId(opening ? task.id : null);
    }, [isMoreActionsOpen, setOpenItemId, task.id]);
    const handleSetDueDateClickFromDropdown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setDatePickerReferenceElement(event.currentTarget as HTMLButtonElement);
        setIsDatePickerOpen(true);
        setOpenItemId(task.id);
    }, [setOpenItemId, task.id]);
    const handlePriorityChange = useCallback((newPriority: number | null) => {
        updateTask({priority: newPriority});
        closeActionsDropdown();
    }, [updateTask, closeActionsDropdown]);
    const handleListChange = useCallback((newList: string) => {
        updateTask({list: newList});
        closeActionsDropdown();
    }, [updateTask, closeActionsDropdown]);
    const handleDuplicateTask = useCallback(() => {
        const now = Date.now();
        // Create a new task object, copying relevant fields including completionPercentage
        const newTaskData: Partial<Task> = {
            ...task, // Spread original task data
            id: `task-${now}-${Math.random().toString(16).slice(2)}`, // New unique ID
            title: `${task.title} (Copy)`, // Modified title
            order: task.order + 0.01, // Slightly adjust order
            createdAt: now, // New creation time
            updatedAt: now, // New update time
            // Reset completion *trigger* fields, let atom derive state from copied percentage
            completed: false,
            completedAt: null,
            // Explicitly copy the percentage
            completionPercentage: task.completionPercentage
        };
        // Remove groupCategory as it will be derived by the atom
        delete newTaskData.groupCategory;

        setTasks(prev => {
            const index = prev.findIndex(t => t.id === task.id);
            const newTasks = [...prev];
            // The tasksAtom setter will handle deriving completed, completedAt, and groupCategory
            if (index !== -1) {
                newTasks.splice(index + 1, 0, newTaskData as Task);
            } else {
                newTasks.push(newTaskData as Task);
            }
            return newTasks;
        });
        setSelectedTaskId(newTaskData.id!); // Select the newly created task
        closeActionsDropdown();
    }, [task, setTasks, setSelectedTaskId, closeActionsDropdown]);
    const openDeleteConfirm = useCallback(() => {
        setIsDeleteDialogOpen(true);
        closeActionsDropdown();
    }, [closeActionsDropdown]);
    const closeDeleteConfirm = useCallback(() => {
        setIsDeleteDialogOpen(false);
    }, []);
    const confirmDeleteTask = useCallback(() => {
        updateTask({list: 'Trash', completionPercentage: null});
        if (isSelected) {
            setSelectedTaskId(null);
        }
        closeDeleteConfirm();
    }, [updateTask, isSelected, setSelectedTaskId, closeDeleteConfirm]);
    useEffect(() => {
        if (!isMoreActionsOpen) return;
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            const isClickInsideTrigger = actionsTriggerRef.current?.contains(target);
            const isClickInsideContent = actionsContentRef.current?.contains(target);
            const isClickInsideDatePicker = datePickerPopperElement?.contains(target);
            const shouldIgnore = (target instanceof Element) && target.closest('.ignore-click-away');
            if (!isClickInsideTrigger && !isClickInsideContent && !isClickInsideDatePicker && !shouldIgnore) {
                closeActionsDropdown();
            }
        };
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMoreActionsOpen, closeActionsDropdown, datePickerPopperElement]);

    // Memoized display values
    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);
    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lc = task.content.toLowerCase();
        const lt = task.title.toLowerCase();
        return searchWords.some(w => lc.includes(w)) && !searchWords.every(w => lt.includes(w));
    }, [searchWords, task.content, task.title]);
    const baseClasses = useMemo(() => twMerge(
        'task-item flex items-start px-2.5 py-2 border-b border-black/10 group relative min-h-[52px]',
        isOverlay
            ? 'bg-glass-100 backdrop-blur-lg border rounded-md shadow-strong' // Overlay style
            : isSelected && !isDragging // Selected non-dragging style
                ? 'bg-primary/20 backdrop-blur-sm'
                : isTrashItem // Trashed style
                    ? 'bg-glass-alt/30 backdrop-blur-xs opacity-60 hover:bg-black/10'
                    : isCompleted // Completed style
                        ? 'bg-glass-alt/30 backdrop-blur-xs opacity-60 hover:bg-black/10'
                        : 'bg-transparent hover:bg-black/[.05] hover:backdrop-blur-sm', // Default style
        isDragging ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-pointer')
    ), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);
    const titleClasses = useMemo(() => twMerge(
        "text-sm text-gray-800 leading-snug block",
        (isCompleted || isTrashItem) && "line-through text-muted-foreground"
    ), [isCompleted, isTrashItem]);
    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const actionsMenuClasses = useMemo(() => twMerge('ignore-click-away min-w-[180px] overflow-hidden py-1 w-48', 'bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10'), []);

    // Progress Percentage Label
    const progressLabel = useMemo(() => {
        const p = task.completionPercentage;
        if (p && p > 0 && p < 100 && !isTrashItem) {
            return `[${p}%]`;
        }
        return null;
    }, [task.completionPercentage, isTrashItem]);

    // Corrected Progress Menu Items (Icons Swapped for 20/50)
    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName},
        {label: 'Started (20%)', value: 20, icon: 'circle-dot-dashed' as IconName}, // Swapped Icon
        {label: 'Halfway (50%)', value: 50, icon: 'circle-dot' as IconName}, // Swapped Icon
        {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName},
        {label: 'Completed (100%)', value: 100, icon: 'circle-check' as IconName},
    ], []);

    return (
        <>
            <div
                ref={setNodeRef} style={style} className={baseClasses}
                {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                onClick={handleTaskClick} role={isSortable ? "listitem" : "button"} tabIndex={0}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                    }
                }}
                aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}
            >
                {/* Progress Indicator */}
                <div className="flex-shrink-0 mr-2.5 pt-[3px] pl-[2px]">
                    <ProgressIndicator
                        percentage={task.completionPercentage}
                        isTrash={isTrashItem}
                        onClick={cycleCompletionPercentage}
                        onKeyDown={handleProgressIndicatorKeyDown}
                        ariaLabelledby={`task-title-${task.id}`}
                    />
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0 pt-[1px] pb-[1px]">
                    {/* Title and Progress Label */}
                    <div className="flex items-baseline">
                        <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'}
                                     id={`task-title-${task.id}`} className={titleClasses}/>
                        {/* Display percentage label subtly with color */}
                        {progressLabel && (
                            <span className="ml-1.5 text-[10px] text-primary/90 opacity-90 font-medium select-none">
                                 {progressLabel}
                             </span>
                        )}
                    </div>
                    {/* Metadata */}
                    <div
                        className="flex items-center flex-wrap text-[11px] text-muted-foreground space-x-2 mt-1 leading-tight gap-y-0.5 min-h-[17px]">
                        {/* Priority Indicator */}
                        {!!task.priority && task.priority <= 4 && !isCompleted && !isTrashItem && (
                            <span className={clsx("flex items-center", priorityMap[task.priority]?.iconColor)}
                                  title={`Priority ${priorityMap[task.priority]?.label}`}>
                                <Icon name="flag" size={11} strokeWidth={2.5}/>
                            </span>
                        )}
                        {/* Due Date & Reschedule Button */}
                        {isValidDueDate && (
                            <span className="flex items-center task-item-reschedule">
                                <span
                                    className={clsx('whitespace-nowrap', overdue && 'text-red-600 font-medium', (isCompleted || isTrashItem) && 'line-through opacity-70')}
                                    title={formatDate(dueDate!)}>
                                    <Icon name="calendar" size={11}
                                          className="mr-0.5 opacity-70"/> {formatRelativeDate(dueDate!)}
                                </span>
                                {overdue && !isOverlay && !isCompleted && !isTrashItem && (
                                    <button
                                        className="ml-1 p-0.5 rounded hover:bg-red-500/15 focus-visible:ring-1 focus-visible:ring-red-400 outline-none ignore-click-away"
                                        onClick={openDatePicker}
                                        aria-label="Reschedule task" title="Reschedule"
                                    >
                                        <Icon name="calendar-plus" size={12}
                                              className="text-red-500 opacity-70 group-hover/task-item-reschedule:opacity-100"/>
                                    </button>
                                )}
                            </span>
                        )}
                        {/* List Name */}
                        {task.list && task.list !== 'Inbox' && (
                            <span
                                className={clsx("flex items-center whitespace-nowrap bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[80px] truncate backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through opacity-70')}
                                title={task.list}>
                                <Icon name={listIcon} size={10} className="mr-0.5 opacity-70 flex-shrink-0"/> <span
                                className="truncate">{task.list}</span>
                            </span>
                        )}
                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                            <span
                                className={clsx("flex items-center space-x-1 flex-wrap gap-y-0.5", (isCompleted || isTrashItem) && 'opacity-70')}>
                                {task.tags.slice(0, 2).map(tag => (
                                    <span key={tag}
                                          className={clsx("bg-black/10 text-muted-foreground px-1 py-0 rounded-[4px] text-[10px] max-w-[70px] truncate backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through')}
                                          title={tag}>
                                        #{tag}
                                    </span>
                                ))}
                                {task.tags.length > 2 &&
                                    <span className="text-muted-foreground text-[10px]">+{task.tags.length - 2}</span>}
                            </span>
                        )}
                        {/* Content Snippet Highlight */}
                        {showContentHighlight && (
                            <Highlighter {...highlighterProps}
                                         textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                         className={clsx("block truncate text-[11px] text-muted italic w-full mt-0.5", (isCompleted || isTrashItem) && 'line-through')}/>
                        )}
                    </div>
                </div>

                {/* More Actions Button & Dropdown */}
                {!isOverlay && !isTrashItem && (
                    <div
                        className="task-item-actions absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-30 ease-apple"
                        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}>
                        <Button
                            ref={actionsTriggerRef} variant="ghost" size="icon" icon="more-horizontal"
                            className="h-6 w-6 text-muted-foreground hover:bg-black/15"
                            onClick={toggleActionsDropdown} aria-label={`More actions for ${task.title || 'task'}`}
                            aria-haspopup="true" aria-expanded={isMoreActionsOpen} tabIndex={0}
                            disabled={isTrashItem}
                        />
                        {ReactDOM.createPortal(
                            <AnimatePresence>
                                {isMoreActionsOpen && (
                                    <motion.div
                                        ref={actionsContentRef} style={actionsStyle} className={actionsMenuClasses}
                                        initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}}
                                        exit={{opacity: 0, scale: 0.95, transition: {duration: 0.1}}}
                                        transition={{duration: 0.15, ease: 'easeOut'}}
                                        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                    >
                                        <div className="space-y-0.5">
                                            {/* Progress Setting Section */}
                                            <div
                                                className="px-2.5 pt-1 pb-0.5 text-xs text-muted-foreground font-medium">Set
                                                Progress
                                            </div>
                                            {progressMenuItems.map(item => (
                                                <MenuItem
                                                    key={item.label} icon={item.icon}
                                                    selected={task.completionPercentage === item.value || (task.completionPercentage === null && item.value === null)}
                                                    onClick={() => handleProgressChange(item.value)}
                                                    disabled={isTrashItem}
                                                >
                                                    {item.label}
                                                </MenuItem>
                                            ))}
                                            <hr className="my-1 border-black/10"/>
                                            {/* Other Actions */}
                                            <MenuItem icon="calendar-plus" onClick={handleSetDueDateClickFromDropdown}
                                                      className="w-full ignore-click-away" disabled={isCompleted}> Set
                                                Due Date... </MenuItem>
                                            <hr className="my-1 border-black/10"/>
                                            <div
                                                className="px-2.5 pt-1 pb-0.5 text-xs text-muted-foreground font-medium">Priority
                                            </div>
                                            {[1, 2, 3, 4, null].map(p => (
                                                <MenuItem key={p ?? 'none'} icon="flag"
                                                          iconColor={p ? priorityMap[p]?.iconColor : undefined}
                                                          selected={task.priority === p}
                                                          onClick={() => handlePriorityChange(p)}
                                                          disabled={isCompleted}>
                                                    {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                                </MenuItem>
                                            ))}
                                            <hr className="my-1 border-black/10"/>
                                            <div
                                                className="px-2.5 pt-1 pb-0.5 text-xs text-muted-foreground font-medium">Move
                                                to List
                                            </div>
                                            <div className="max-h-32 overflow-y-auto styled-scrollbar px-0.5">
                                                {availableLists.map(list => (
                                                    <MenuItem key={list} icon={list === 'Inbox' ? 'inbox' : 'list'}
                                                              selected={task.list === list}
                                                              onClick={() => handleListChange(list)}
                                                              disabled={isCompleted}>
                                                        {list}
                                                    </MenuItem>
                                                ))}
                                            </div>
                                            <hr className="my-1 border-black/10"/>
                                            <MenuItem icon="copy-plus" onClick={handleDuplicateTask}
                                                      disabled={isCompleted}> Duplicate Task </MenuItem>
                                            {!isTrashItem &&
                                                <MenuItem icon="trash" className="!text-red-600 hover:!bg-red-500/15"
                                                          onClick={openDeleteConfirm}> Move to Trash </MenuItem>}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>,
                            document.body
                        )}
                    </div>
                )}

                {/* Date Picker Portal */}
                {isDatePickerOpen && datePickerReferenceElement && ReactDOM.createPortal(
                    (
                        <div ref={setDatePickerPopperElement} style={{...datePickerStyles.popper, zIndex: 60}}
                             {...datePickerAttributes.popper} className="ignore-click-away date-picker-popover-wrapper">
                            <CustomDatePickerPopover
                                usePortal={false} initialDate={dueDate ?? undefined}
                                onSelect={handleDateSelect} close={closeDatePicker}
                                triggerElement={datePickerReferenceElement}
                            />
                        </div>
                    ), document.body
                )}
            </div>
            {/* Delete Modal */}
            <ConfirmDeleteModal isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm} onConfirm={confirmDeleteTask}
                                taskTitle={task.title || 'Untitled Task'}/>
        </>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;