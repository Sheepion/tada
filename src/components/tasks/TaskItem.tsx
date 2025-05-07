// src/components/tasks/TaskItem.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Task, TaskGroupCategory} from '@/types';
import {formatDate, formatRelativeDate, isOverdue, isValid, safeParseDate} from '@/utils/dateUtils';
import {useAtom, useSetAtom} from 'jotai';
import {searchTermAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import {twMerge} from 'tailwind-merge';
import {clsx} from 'clsx';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import Button from "@/components/common/Button";
import Highlighter from "react-highlight-words";
import {IconName} from "@/components/common/IconMap";
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import {CustomDatePickerContent} from "@/components/common/CustomDatePickerPopover";
import {useTaskItemMenu} from '@/context/TaskItemMenuContext';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import * as Tooltip from '@radix-ui/react-tooltip';
import SelectionCheckboxRadix from '../common/SelectionCheckbox';
import {useAtomValue} from "jotai/index"; // Using the Radix based checkbox


export const ProgressIndicator: React.FC<{
    percentage: number | null; isTrash: boolean; size?: number; className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaLabelledby?: string;
}> = React.memo(({percentage, isTrash, size = 16, className, onClick, onKeyDown, ariaLabelledby}) => {
    const normalizedPercentage = percentage ?? 0;
    const radius = size / 2 - 1.25;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 2.5;
    const offset = circumference - (normalizedPercentage / 100) * circumference;
    const checkPath = `M ${size * 0.3} ${size * 0.55} L ${size * 0.45} ${size * 0.7} L ${size * 0.75} ${size * 0.4}`;
    const indicatorClasses = useMemo(() => twMerge("relative flex-shrink-0 rounded-full transition-all duration-200 ease-apple focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-current/50", !isTrash && "cursor-pointer", isTrash && "opacity-50 cursor-not-allowed", className), [isTrash, className]);
    const buttonBgColor = useMemo(() => {
        if (isTrash) return "bg-gray-200/50 dark:bg-gray-700/40 border-gray-300 dark:border-gray-600";
        if (normalizedPercentage === 100) return "bg-primary/80 hover:bg-primary/90 border-primary/80";
        return "bg-white/40 dark:bg-gray-800/30 hover:border-primary/60 dark:hover:border-primary/50 border-gray-400/80 dark:border-gray-500/70";
    }, [isTrash, normalizedPercentage]);
    const progressStrokeColor = useMemo(() => {
        if (isTrash) return "stroke-gray-400 dark:stroke-gray-500";
        if (normalizedPercentage === 100) return "stroke-white";
        if (normalizedPercentage >= 80) return "stroke-primary/90";
        if (normalizedPercentage >= 50) return "stroke-primary/80";
        if (normalizedPercentage > 0) return "stroke-primary/70";
        return "stroke-transparent";
    }, [isTrash, normalizedPercentage]);
    const progressLabel = normalizedPercentage === 100 ? "Completed" : `${normalizedPercentage}% done`;
    return (<button type="button" onClick={onClick} onKeyDown={onKeyDown} disabled={isTrash}
                    aria-labelledby={ariaLabelledby} aria-label={`Task progress: ${progressLabel}`}
                    aria-pressed={normalizedPercentage === 100}
                    className={twMerge(indicatorClasses, buttonBgColor, "border")} style={{width: size, height: size}}>
            <svg viewBox={`0 0 ${size} ${size}`}
                 className="absolute inset-0 w-full h-full transition-opacity duration-200 ease-apple"
                 style={{opacity: normalizedPercentage > 0 ? 1 : 0}} aria-hidden="true">
                {normalizedPercentage > 0 && normalizedPercentage < 100 && (
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
                            className={progressStrokeColor} strokeDasharray={circumference} strokeDashoffset={offset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="round"
                            style={{transition: 'stroke-dashoffset 0.3s ease-out'}}/>)}
                {normalizedPercentage === 100 && (
                    <path d={checkPath} fill="none" strokeWidth={strokeWidth * 0.9} className={progressStrokeColor}
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{transition: 'opacity 0.2s ease-in 0.1s'}}/>)}
            </svg>
        </button>
    );
});
ProgressIndicator.displayName = 'ProgressIndicator';

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
    if (firstMatchIndex === -1) return content.substring(0, length) + (content.length > length ? '...' : '');
    const start = Math.max(0, firstMatchIndex - Math.floor(length / 3));
    const end = Math.min(content.length, firstMatchIndex + matchedWord.length + Math.ceil(length * 2 / 3));
    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
}

const priorityMap: Record<number, { label: string; iconColor: string; shortLabel: string }> = {
    1: {label: 'High Priority', iconColor: 'text-red-500 dark:text-red-400', shortLabel: 'P1'},
    2: {label: 'Medium Priority', iconColor: 'text-orange-500 dark:text-orange-400', shortLabel: 'P2'},
    3: {label: 'Low Priority', iconColor: 'text-blue-500 dark:text-blue-400', shortLabel: 'P3'},
    4: {label: 'Lowest Priority', iconColor: 'text-gray-500 dark:text-neutral-400', shortLabel: 'P4'},
};

interface RadixMenuItemProps extends DropdownMenu.DropdownMenuItemProps {
    icon?: IconName;
    iconColor?: string;
    selected?: boolean;
    isDanger?: boolean;
}

const TaskItemRadixMenuItem: React.FC<RadixMenuItemProps> = React.memo(({
                                                                            icon,
                                                                            iconColor,
                                                                            selected,
                                                                            children,
                                                                            className,
                                                                            isDanger = false,
                                                                            ...props
                                                                        }) => (
    <DropdownMenu.Item
        className={twMerge("relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8", isDanger ? "text-red-600 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300" : "focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07]", selected && !isDanger && "bg-primary/15 text-primary data-[highlighted]:bg-primary/20 dark:bg-primary/25 dark:text-primary-light dark:data-[highlighted]:bg-primary/30", !selected && !isDanger && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50", "data-[disabled]:opacity-50", className)} {...props}>
        {icon && (<Icon name={icon} size={15} className={twMerge("mr-2 flex-shrink-0 opacity-70", iconColor)}
                        aria-hidden="true"/>)} {children}
    </DropdownMenu.Item>
));
TaskItemRadixMenuItem.displayName = 'TaskItemRadixMenuItem';

interface TaskItemProps {
    task: Task;
    groupCategory?: TaskGroupCategory;
    isOverlay?: boolean;
    style?: React.CSSProperties;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

const TaskItem: React.FC<TaskItemProps> = memo(({task, groupCategory, isOverlay = false, style: overlayStyle}) => {
    const [selectedTaskId, setSelectedTaskId] = useAtom(selectedTaskIdAtom);
    const setTasks = useSetAtom(tasksAtom);
    const [searchTerm] = useAtom(searchTermAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const {openItemId, setOpenItemId} = useTaskItemMenu();
    const isSelected = useMemo(() => selectedTaskId === task.id, [selectedTaskId, task.id]);

    const [isMenuDatePickerOpen, setIsMenuDatePickerOpen] = useState(false);
    const [isDateClickPickerOpen, setIsDateClickPickerOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const moreActionsButtonRef = useRef<HTMLButtonElement>(null);
    const dateDisplayRef = useRef<HTMLButtonElement>(null);

    const isTrashItem = useMemo(() => task.list === 'Trash', [task.list]);
    const isCompleted = useMemo(() => (task.completionPercentage ?? 0) === 100 && !isTrashItem, [task.completionPercentage, isTrashItem]);
    const isSortable = useMemo(() => !isCompleted && !isTrashItem && !isOverlay, [isCompleted, isTrashItem, isOverlay]);
    const isInteractive = useMemo(() => !isOverlay && !isCompleted && !isTrashItem, [isOverlay, isCompleted, isTrashItem]);

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
        data: {task, type: 'task-item', groupCategory: groupCategory ?? task.groupCategory}
    });
    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        const calculatedTransition = dndTransition;
        if (isDragging && !isOverlay) return {
            transform: baseTransform,
            transition: calculatedTransition,
            opacity: 0.4,
            cursor: 'grabbing',
            backgroundColor: 'hsla(210, 40%, 98%, 0.3)',
            boxShadow: 'none',
            border: '1px dashed hsla(0, 0%, 0%, 0.15)',
            zIndex: 1,
        };
        if (isOverlay) return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition,
            cursor: 'grabbing',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
        };
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
            if (isMenuDatePickerOpen) setIsMenuDatePickerOpen(false);
            if (isDateClickPickerOpen) setIsDateClickPickerOpen(false);
        }
    }, [openItemId, task.id, isMoreActionsOpen, isMenuDatePickerOpen, isDateClickPickerOpen]);
    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, [data-radix-popper-content-wrapper], [role="dialog"], [role="menuitem"], [data-date-picker-trigger="true"]')) return;
        if (isDragging) return;
        setSelectedTaskId(id => (id === task.id ? null : task.id));
        setIsMoreActionsOpen(false);
        setIsMenuDatePickerOpen(false);
        setIsDateClickPickerOpen(false);
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, isDragging, setOpenItemId]);
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed' | 'subtasks'>>) => {
        setTasks(prevTasks => prevTasks.map(t => (t.id === task.id ? {...t, ...updates} : t)));
    }, [setTasks, task.id]);
    const cycleCompletionPercentage = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        const currentPercentage = task.completionPercentage ?? 0;
        let nextPercentage: number | null = currentPercentage === 100 ? null : 100;
        updateTask({completionPercentage: nextPercentage});
        if (nextPercentage === 100 && isSelected) setSelectedTaskId(null);
        setOpenItemId(null);
        setIsMoreActionsOpen(false);
        setIsMenuDatePickerOpen(false);
        setIsDateClickPickerOpen(false);
    }, [task.completionPercentage, updateTask, isSelected, setSelectedTaskId, setOpenItemId]);
    const handleProgressIndicatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            cycleCompletionPercentage();
        }
    }, [cycleCompletionPercentage]);
    const handleProgressChange = useCallback((newPercentage: number | null) => {
        updateTask({completionPercentage: newPercentage});
        if (newPercentage === 100 && isSelected) setSelectedTaskId(null);
    }, [updateTask, isSelected, setSelectedTaskId]);
    const handleDateSelect = useCallback((dateWithTime: Date | undefined) => {
        const newDueDate = dateWithTime ? dateWithTime.getTime() : null;
        updateTask({dueDate: newDueDate});
    }, [updateTask]);
    const handleMenuDatePickerOpenChange = useCallback((open: boolean) => {
        setIsMenuDatePickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsDateClickPickerOpen(false);
        } else if (openItemId === task.id && !isMoreActionsOpen && !isDateClickPickerOpen) setOpenItemId(null);
    }, [setIsMenuDatePickerOpen, openItemId, task.id, setOpenItemId, isMoreActionsOpen, isDateClickPickerOpen]);
    const handleDateClickPickerOpenChange = useCallback((open: boolean) => {
        setIsDateClickPickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsMenuDatePickerOpen(false);
        } else if (openItemId === task.id && !isMoreActionsOpen && !isMenuDatePickerOpen) setOpenItemId(null);
    }, [setIsDateClickPickerOpen, openItemId, task.id, setOpenItemId, isMoreActionsOpen, isMenuDatePickerOpen]);
    const closeMenuDatePickerPopover = useCallback(() => handleMenuDatePickerOpenChange(false), [handleMenuDatePickerOpenChange]);
    const closeDateClickPopover = useCallback(() => handleDateClickPickerOpenChange(false), [handleDateClickPickerOpenChange]);
    const handlePriorityChange = useCallback((newPriority: number | null) => updateTask({priority: newPriority}), [updateTask]);
    const handleListChange = useCallback((newList: string) => updateTask({list: newList}), [updateTask]);
    const handleDuplicateTask = useCallback(() => {
        const now = Date.now();
        const duplicatedSubtasks = (task.subtasks || []).map(sub => ({
            ...sub,
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
            parentId: '',
            createdAt: now,
            updatedAt: now,
            completedAt: sub.completed ? now : null,
        }));
        const newParentTaskId = `task-${now}-${Math.random().toString(16).slice(2)}`;
        duplicatedSubtasks.forEach(sub => sub.parentId = newParentTaskId);
        const newTaskData: Partial<Task> = {
            ...task,
            id: newParentTaskId,
            title: `${task.title} (Copy)`,
            order: task.order + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completionPercentage: task.completionPercentage === 100 ? null : task.completionPercentage,
            subtasks: duplicatedSubtasks,
        };
        delete newTaskData.groupCategory;
        setTasks(prev => {
            const index = prev.findIndex(t => t.id === task.id);
            const newTasks = [...prev];
            if (index !== -1) newTasks.splice(index + 1, 0, newTaskData as Task); else newTasks.push(newTaskData as Task);
            return newTasks;
        });
        setSelectedTaskId(newParentTaskId);
    }, [task, setTasks, setSelectedTaskId]);
    const openDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(true), []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);
    const confirmDeleteTask = useCallback(() => {
        updateTask({list: 'Trash', completionPercentage: null});
        if (isSelected) setSelectedTaskId(null);
        closeDeleteConfirm();
    }, [updateTask, isSelected, setSelectedTaskId, closeDeleteConfirm]);

    const dueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
    const isValidDueDate = useMemo(() => dueDate && isValid(dueDate), [dueDate]);
    const overdue = useMemo(() => isValidDueDate && !isCompleted && !isTrashItem && isOverdue(dueDate!), [isValidDueDate, isCompleted, isTrashItem, dueDate]);
    const searchWords = useMemo(() => searchTerm ? searchTerm.trim().toLowerCase().split(' ').filter(Boolean) : [], [searchTerm]);
    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-yellow-300/70 font-semibold rounded-[2px] px-0.5 mx-[-0.5px] backdrop-blur-xs",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);
    const subtaskSearchMatch = useMemo(() => {
        if (searchWords.length === 0 || !task.subtasks || task.subtasks.length === 0) return null;
        const parentTitleIncludesAllSearch = searchWords.every(w => task.title.toLowerCase().includes(w));
        const parentContentIncludesAllSearch = task.content && searchWords.every(w => task.content!.toLowerCase().includes(w));
        for (const subtask of task.subtasks) {
            const subtaskTitleIncludesAllSearch = searchWords.every(w => subtask.title.toLowerCase().includes(w));
            if (subtaskTitleIncludesAllSearch && !parentTitleIncludesAllSearch) return {
                type: 'title',
                text: subtask.title,
                original: subtask.title
            };
            if (subtask.content) {
                const subtaskContentIncludesAllSearch = searchWords.every(w => subtask.content!.toLowerCase().includes(w));
                if (subtaskContentIncludesAllSearch && !parentContentIncludesAllSearch && !parentTitleIncludesAllSearch) return {
                    type: 'content',
                    text: generateContentSnippet(subtask.content, searchTerm),
                    original: subtask.content
                };
            }
        }
        return null;
    }, [searchWords, task.title, task.content, task.subtasks, searchTerm]);
    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lc = task.content.toLowerCase();
        const lt = task.title.toLowerCase();
        const mainContentMatch = searchWords.some(w => lc.includes(w)) && !searchWords.every(w => lt.includes(w));
        return mainContentMatch && (!subtaskSearchMatch || subtaskSearchMatch.type !== 'content');
    }, [searchWords, task.content, task.title, subtaskSearchMatch]);
    const baseClasses = useMemo(() => twMerge('task-item flex items-start px-3 py-2.5 border-b border-black/5 dark:border-white/[.03] group relative min-h-[56px]', isOverlay ? 'bg-glass-100 dark:bg-neutral-800 backdrop-blur-lg border rounded-md shadow-strong' : isSelected && !isDragging ? 'bg-primary/15 dark:bg-primary/25 backdrop-blur-sm' : isTrashItem ? 'bg-glass-alt/30 dark:bg-neutral-700/20 backdrop-blur-xs opacity-60 hover:bg-black/5 dark:hover:bg-white/[.02]' : isCompleted ? 'bg-glass-alt/30 dark:bg-neutral-700/20 backdrop-blur-xs opacity-60 hover:bg-black/5 dark:hover:bg-white/[.02]' : 'bg-transparent hover:bg-black/[.03] dark:hover:bg-white/[.015] hover:backdrop-blur-sm', isDragging ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-default')), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);
    const titleClasses = useMemo(() => twMerge("text-[13.5px] text-neutral-800 dark:text-neutral-100 leading-tight block font-medium", (isCompleted || isTrashItem) && "line-through text-muted-foreground dark:text-neutral-500 font-normal"), [isCompleted, isTrashItem]);
    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const actionsMenuContentClasses = useMemo(() => twMerge('z-[55] min-w-[200px] p-1.5 w-52 bg-glass-menu dark:bg-neutral-800/90 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade'), []);
    const datePickerPopoverContentClasses = useMemo(() => twMerge("z-[60] radix-popover-content data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade"), []);
    const progressMenuItems = useMemo(() => [{
        label: 'Not Started',
        value: null,
        icon: 'circle' as IconName
    }, {label: 'Started (20%)', value: 20, icon: 'circle-dot-dashed' as IconName}, {
        label: 'Halfway (50%)',
        value: 50,
        icon: 'circle-dot' as IconName
    }, {label: 'Almost Done (80%)', value: 80, icon: 'circle-slash' as IconName}, {
        label: 'Completed (100%)',
        value: 100,
        icon: 'circle-check' as IconName
    },], []);
    const isDateClickable = isValidDueDate && isInteractive;
    const dueDateClasses = useMemo(() => twMerge('flex items-center whitespace-nowrap rounded-md transition-colors duration-150 ease-apple outline-none text-[11px] font-medium', overdue && 'text-red-500 dark:text-red-500', (isCompleted || isTrashItem) && 'line-through opacity-70', isDateClickable && 'cursor-pointer hover:bg-black/[.08] dark:hover:bg-white/[.08] px-1.5 mx-[-6px] py-1 my-[-4px] focus-visible:ring-1 focus-visible:ring-primary/50', !isDateClickable && 'px-0 py-0', !overdue && 'text-muted-foreground dark:text-neutral-400/80'), [overdue, isCompleted, isTrashItem, isDateClickable]);

    const MAX_VISIBLE_SUBTASKS_IN_LIST = 2;
    const subtasksToDisplayInList = useMemo(() => task.subtasks?.slice(0, MAX_VISIBLE_SUBTASKS_IN_LIST) || [], [task.subtasks]);
    const hiddenSubtasksCount = useMemo(() => Math.max(0, (task.subtasks?.length || 0) - MAX_VISIBLE_SUBTASKS_IN_LIST), [task.subtasks]);

    const tooltipContentClass = "text-xs bg-black/80 dark:bg-neutral-900/90 text-white dark:text-neutral-100 px-2 py-1 rounded shadow-md select-none z-[70] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    return (
        <>
            <div ref={setNodeRef} style={style}
                 className={baseClasses} {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                 onClick={handleTaskClick} role={isSortable ? "listitem" : "button"} tabIndex={0}
                 onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                     if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('[role="button"],[role="menuitem"]')) {
                         e.preventDefault();
                         handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                     }
                     if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).getAttribute('data-date-picker-trigger') === 'true') {
                         e.preventDefault();
                         handleDateClickPickerOpenChange(true);
                     }
                 }} aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}>
                <div className="flex-shrink-0 mr-3 pt-0.5">
                    <ProgressIndicator percentage={task.completionPercentage} isTrash={isTrashItem}
                                       onClick={cycleCompletionPercentage} onKeyDown={handleProgressIndicatorKeyDown}
                                       ariaLabelledby={`task-title-${task.id}`} size={18}/>
                </div>
                <div className="flex-1 min-w-0 pt-0.5 pb-0.5 flex flex-col"> {/* Allow vertical stacking */}
                    <div className="flex items-baseline">
                        <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'}
                                     id={`task-title-${task.id}`} className={titleClasses}/>
                        {/* Progress Label removed for cleaner look, progress indicator is primary */}
                    </div>

                    {/* Metadata Row */}
                    <div
                        className={twMerge("flex items-center flex-wrap text-muted-foreground dark:text-neutral-400 mt-1 leading-tight gap-x-2.5 gap-y-1 min-h-[18px]")}>
                        {!!task.priority && task.priority <= 4 && !isCompleted && !isTrashItem && (
                            <Tooltip.Provider delayDuration={200}><Tooltip.Root><Tooltip.Trigger asChild>
                                <span
                                    className={clsx("flex items-center font-semibold text-[10.5px]", priorityMap[task.priority]?.iconColor)}>
                                    <Icon name="flag" size={10} strokeWidth={3} className="mr-0.5"/>
                                    {priorityMap[task.priority]?.shortLabel}
                                </span>
                            </Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className={tooltipContentClass}
                                                                               side="bottom"
                                                                               sideOffset={4}>{priorityMap[task.priority]?.label}<Tooltip.Arrow
                                className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>
                        )}
                        {isValidDueDate && (
                            <Popover.Root modal={true} open={isDateClickPickerOpen}
                                          onOpenChange={handleDateClickPickerOpenChange}>
                                <Popover.Trigger asChild disabled={!isDateClickable}>
                                    <button ref={dateDisplayRef} className={dueDateClasses} title={formatDate(dueDate!)}
                                            onClick={isDateClickable ? (e) => e.stopPropagation() : undefined}
                                            onKeyDown={isDateClickable ? (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDateClickPickerOpenChange(true);
                                                }
                                            } : undefined}
                                            aria-label={isDateClickable ? `Change due date, currently ${formatRelativeDate(dueDate!, true)}` : undefined}
                                            data-date-picker-trigger={isDateClickable ? "true" : "false"}>
                                        <Icon name="calendar" size={10} className="mr-1 opacity-80 flex-shrink-0"/>
                                        {formatRelativeDate(dueDate!, true)}
                                    </button>
                                </Popover.Trigger>
                                {isDateClickable && (
                                    <Popover.Portal><Popover.Content side="bottom" align="start" sideOffset={5}
                                                                     className={datePickerPopoverContentClasses}
                                                                     onCloseAutoFocus={(e) => {
                                                                         e.preventDefault();
                                                                         dateDisplayRef.current?.focus();
                                                                     }}><CustomDatePickerContent
                                        initialDate={dueDate ?? undefined} onSelect={handleDateSelect}
                                        closePopover={closeDateClickPopover}/></Popover.Content></Popover.Portal>)}
                            </Popover.Root>
                        )}
                        {task.list && task.list !== 'Inbox' && (
                            <span
                                className={clsx("flex items-center whitespace-nowrap bg-black/[.04] dark:bg-white/[.04] text-muted-foreground dark:text-neutral-400/80 px-1.5 py-[2px] rounded-md text-[10px] backdrop-blur-sm", (isCompleted || isTrashItem) && 'line-through opacity-60')}
                                title={task.list}>
                                <Icon name={listIcon} size={9} className="mr-1 opacity-70 flex-shrink-0"/> <span
                                className="truncate">{task.list}</span>
                            </span>
                        )}
                        {task.tags && task.tags.length > 0 && (
                            <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                <span
                                    className={clsx("flex items-center bg-black/[.04] dark:bg-white/[.04] text-muted-foreground dark:text-neutral-400/80 px-1.5 py-[2px] rounded-md text-[10px] backdrop-blur-sm cursor-default", (isCompleted || isTrashItem) && 'line-through opacity-60')}>
                                    <Icon name="tag" size={9} className="mr-1 opacity-70"/>
                                    <span className="truncate max-w-[60px]">{task.tags[0]}</span>
                                    {task.tags.length > 1 &&
                                        <span className="ml-1 opacity-70">+{task.tags.length - 1}</span>}
                                </span>
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                 sideOffset={4}>
                                    Tags: {task.tags.join(', ')}
                                    <Tooltip.Arrow
                                        className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                        )}
                        {showContentHighlight && (<Highlighter {...highlighterProps}
                                                               textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                                               className={clsx("block truncate text-[10.5px] text-muted-foreground/70 dark:text-neutral-500/70 italic w-full", (isCompleted || isTrashItem) && 'line-through')}/>)}
                        {subtaskSearchMatch && (<div
                            className={clsx("block truncate text-[10.5px] text-muted-foreground/70 dark:text-neutral-500/70 italic w-full flex items-center", (isCompleted || isTrashItem) && 'line-through')}>
                            <Icon name="git-fork" size={10}
                                  className="mr-1 opacity-60 flex-shrink-0"/>Sub: <Highlighter {...highlighterProps}
                                                                                               textToHighlight={subtaskSearchMatch.text}
                                                                                               className="ml-1"/>
                        </div>)}
                    </div>

                    {/* Subtasks Display in Task List Item */}
                    {task.subtasks && task.subtasks.length > 0 && !isTrashItem && !isCompleted && (
                        <div className="mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/[.02] -mx-1 px-1">
                            {subtasksToDisplayInList.map(sub => (
                                <div key={sub.id} className="flex items-center text-xs mb-0.5">
                                    <SelectionCheckboxRadix
                                        id={`subtask-list-item-check-${sub.id}`}
                                        checked={sub.completed}
                                        onChange={() => { /* Non-interactive in list view */
                                        }}
                                        aria-label={`Subtask: ${sub.title} status`}
                                        className="mr-1.5 flex-shrink-0 pointer-events-none"
                                        size={12}
                                        disabled={true} // Visually disabled
                                    />
                                    <span className={twMerge(
                                        "truncate text-muted-foreground dark:text-neutral-400/90",
                                        sub.completed && "line-through opacity-70"
                                    )}>
                                        {sub.title}
                                    </span>
                                </div>
                            ))}
                            {hiddenSubtasksCount > 0 && (
                                <div
                                    className="text-xs text-muted-foreground/70 dark:text-neutral-500/70 mt-0.5 ml-[18px]">
                                    ... +{hiddenSubtasksCount} more subtask{hiddenSubtasksCount > 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {isInteractive && (
                    <div
                        className="task-item-actions absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ease-apple z-10"
                        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}>
                        <Popover.Root modal={true} open={isMenuDatePickerOpen}
                                      onOpenChange={handleMenuDatePickerOpenChange}>
                            <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={(open) => {
                                setIsMoreActionsOpen(open);
                                if (open) {
                                    setOpenItemId(task.id);
                                    setIsMenuDatePickerOpen(false);
                                    setIsDateClickPickerOpen(false);
                                } else if (openItemId === task.id && !isMenuDatePickerOpen && !isDateClickPickerOpen) setOpenItemId(null);
                            }}>
                                <Popover.Anchor asChild><DropdownMenu.Trigger asChild disabled={!isInteractive}><Button
                                    ref={moreActionsButtonRef} variant="ghost" size="icon" icon="more-horizontal"
                                    className="h-7 w-7 text-muted-foreground/80 dark:text-neutral-400/80 hover:bg-black/10 dark:hover:bg-white/5"
                                    aria-label={`More actions for ${task.title || 'task'}`}/></DropdownMenu.Trigger></Popover.Anchor>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content className={actionsMenuContentClasses} sideOffset={4}
                                                          align="end" onCloseAutoFocus={(e) => {
                                        if (!isMenuDatePickerOpen) {
                                            e.preventDefault();
                                            if (!isMenuDatePickerOpen && !isDateClickPickerOpen) moreActionsButtonRef.current?.focus();
                                        }
                                    }}>
                                        <DropdownMenu.Sub><DropdownMenu.SubTrigger
                                            className={twMerge("relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] data-[state=open]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07] dark:data-[state=open]:bg-white/[.07] text-gray-700 data-[highlighted]:text-gray-800 data-[state=open]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50 dark:data-[state=open]:text-neutral-50 data-[disabled]:opacity-50")}><Icon
                                            name="circle-gauge" size={15} className="mr-2 flex-shrink-0 opacity-70"/>Set
                                            Progress
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={15}
                                                                                className="opacity-70"/></div>
                                        </DropdownMenu.SubTrigger><DropdownMenu.Portal><DropdownMenu.SubContent
                                            className={actionsMenuContentClasses} sideOffset={2}
                                            alignOffset={-5}>{progressMenuItems.map(item => (
                                            <TaskItemRadixMenuItem key={item.label} icon={item.icon}
                                                                   selected={task.completionPercentage === item.value || (task.completionPercentage === null && item.value === null)}
                                                                   onSelect={() => handleProgressChange(item.value)}
                                                                   disabled={!isInteractive}>{item.label}</TaskItemRadixMenuItem>))}</DropdownMenu.SubContent></DropdownMenu.Portal></DropdownMenu.Sub>
                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>
                                        <TaskItemRadixMenuItem icon="calendar-plus" onSelect={(event) => {
                                            event.preventDefault();
                                            handleMenuDatePickerOpenChange(true);
                                        }} disabled={!isInteractive}>Set Due Date...</TaskItemRadixMenuItem>
                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>
                                        <DropdownMenu.Sub><DropdownMenu.SubTrigger
                                            className={twMerge("relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] data-[state=open]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07] dark:data-[state=open]:bg-white/[.07] text-gray-700 data-[highlighted]:text-gray-800 data-[state=open]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50 dark:data-[state=open]:text-neutral-50 data-[disabled]:opacity-50")}
                                            disabled={!isInteractive}><Icon name="flag" size={15}
                                                                            className="mr-2 flex-shrink-0 opacity-70"/>Priority
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={15}
                                                                                className="opacity-70"/></div>
                                        </DropdownMenu.SubTrigger><DropdownMenu.Portal><DropdownMenu.SubContent
                                            className={actionsMenuContentClasses} sideOffset={2}
                                            alignOffset={-5}><DropdownMenu.RadioGroup
                                            value={String(task.priority ?? 'none')}
                                            onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}>{[null, 1, 2, 3, 4].map(p => (
                                            <DropdownMenu.RadioItem key={p ?? 'none'} value={String(p ?? 'none')}
                                                                    className={twMerge("relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07]", p && priorityMap[p]?.iconColor, "data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/20 dark:data-[state=checked]:bg-primary/25 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/30", !p && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50", "data-[disabled]:opacity-50")}
                                                                    disabled={!isInteractive}> {p &&
                                                <Icon name="flag" size={15}
                                                      className="mr-2 flex-shrink-0 opacity-70"/>} {p ? `P${p} ${priorityMap[p]?.label}` : 'None'} </DropdownMenu.RadioItem>))}</DropdownMenu.RadioGroup></DropdownMenu.SubContent></DropdownMenu.Portal></DropdownMenu.Sub>
                                        <DropdownMenu.Sub><DropdownMenu.SubTrigger
                                            className={twMerge("relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] data-[state=open]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07] dark:data-[state=open]:bg-white/[.07] text-gray-700 data-[highlighted]:text-gray-800 data-[state=open]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50 dark:data-[state=open]:text-neutral-50 data-[disabled]:opacity-50")}
                                            disabled={!isInteractive}><Icon name="folder" size={15}
                                                                            className="mr-2 flex-shrink-0 opacity-70"/>Move
                                            to List
                                            <div className="ml-auto pl-5"><Icon name="chevron-right" size={15}
                                                                                className="opacity-70"/></div>
                                        </DropdownMenu.SubTrigger><DropdownMenu.Portal><DropdownMenu.SubContent
                                            className={twMerge(actionsMenuContentClasses, "max-h-40 overflow-y-auto styled-scrollbar-thin")}
                                            sideOffset={2} alignOffset={-5}><DropdownMenu.RadioGroup value={task.list}
                                                                                                     onValueChange={handleListChange}>{availableLists.map(list => (
                                            <DropdownMenu.RadioItem key={list} value={list}
                                                                    className={twMerge("relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07] data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/20 dark:data-[state=checked]:bg-primary/25 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/30 text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50 data-[disabled]:opacity-50")}
                                                                    disabled={!isInteractive}><Icon
                                                name={list === 'Inbox' ? 'inbox' : 'list'} size={15}
                                                className="mr-2 flex-shrink-0 opacity-70"/>{list}
                                            </DropdownMenu.RadioItem>))}</DropdownMenu.RadioGroup></DropdownMenu.SubContent></DropdownMenu.Portal></DropdownMenu.Sub>
                                        <DropdownMenu.Separator className="h-px bg-black/10 dark:bg-white/10 my-1"/>
                                        <TaskItemRadixMenuItem icon="copy-plus" onSelect={handleDuplicateTask}
                                                               disabled={!isInteractive}>Duplicate
                                            Task</TaskItemRadixMenuItem>
                                        {!isTrashItem && (
                                            <TaskItemRadixMenuItem icon="trash" onSelect={openDeleteConfirm} isDanger>Move
                                                to Trash</TaskItemRadixMenuItem>)}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <Popover.Portal><Popover.Content side="bottom" align="end" sideOffset={5}
                                                             className={datePickerPopoverContentClasses}
                                                             onCloseAutoFocus={(e) => {
                                                                 e.preventDefault();
                                                                 moreActionsButtonRef.current?.focus();
                                                             }}><CustomDatePickerContent
                                initialDate={dueDate ?? undefined} onSelect={handleDateSelect}
                                closePopover={closeMenuDatePickerPopover}/></Popover.Content></Popover.Portal>
                        </Popover.Root>
                    </div>
                )}
            </div>
            <ConfirmDeleteModalRadix isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm}
                                     onConfirm={confirmDeleteTask} taskTitle={task.title || 'Untitled Task'}/>
        </>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;