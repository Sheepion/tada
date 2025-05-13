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
import {useAtomValue} from "jotai/index";

export const ProgressIndicator: React.FC<{
    percentage: number | null; isTrash: boolean; size?: number; className?: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    ariaLabelledby?: string;
}> = React.memo(({percentage, isTrash, size = 16, className, onClick, onKeyDown, ariaLabelledby}) => {
    const normalizedPercentage = percentage ?? 0;
    const radius = size / 2 - 1;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 1;
    const offset = circumference - (normalizedPercentage / 100) * circumference;
    const checkPath = `M ${size * 0.32} ${size * 0.5} L ${size * 0.45} ${size * 0.65} L ${size * 0.7} ${size * 0.4}`;

    const indicatorClasses = useMemo(() => twMerge(
        "relative flex-shrink-0 rounded-full transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        !isTrash && "cursor-pointer",
        isTrash && "opacity-50 cursor-not-allowed",
        className
    ), [isTrash, className]);

    const stateStyles = useMemo(() => {
        if (isTrash) return "border-grey-light"; // Use updated grey-light
        if (normalizedPercentage === 100) return "bg-primary border-primary";
        return "border-grey-light hover:border-primary-dark"; // Use updated grey-light
    }, [isTrash, normalizedPercentage]);

    const progressStrokeColor = useMemo(() => {
        if (isTrash) return "stroke-grey-medium"; // Use updated grey-medium
        if (normalizedPercentage === 100) return "stroke-white";
        return "stroke-primary";
    }, [isTrash, normalizedPercentage]);

    const progressLabel = normalizedPercentage === 100 ? "Completed" : (normalizedPercentage > 0 ? `${normalizedPercentage}% done` : "Not started");

    return (
        <button type="button" onClick={onClick} onKeyDown={onKeyDown} disabled={isTrash}
                aria-labelledby={ariaLabelledby} aria-label={`Task progress: ${progressLabel}`}
                aria-pressed={normalizedPercentage === 100}
                className={twMerge(indicatorClasses, stateStyles, "border")}
                style={{width: size, height: size}}>
            <svg viewBox={`0 0 ${size} ${size}`}
                 className="absolute inset-0 w-full h-full transition-opacity duration-200 ease-in-out"
                 style={{opacity: (normalizedPercentage > 0 && normalizedPercentage < 100) || normalizedPercentage === 100 ? 1 : 0}}
                 aria-hidden="true">
                {normalizedPercentage > 0 && normalizedPercentage < 100 && (
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
                            className={progressStrokeColor} strokeDasharray={circumference} strokeDashoffset={offset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="round"
                            style={{transition: 'stroke-dashoffset 0.3s ease-out'}}/>
                )}
                {normalizedPercentage === 100 && (
                    <path d={checkPath} fill="none" strokeWidth={strokeWidth + 0.5}
                          className={progressStrokeColor}
                          strokeLinecap="round" strokeLinejoin="round"
                          style={{transition: 'opacity 0.2s ease-in 0.1s'}}/>
                )}
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

const priorityMap: Record<number, {
    label: string;
    iconColor: string;
    bgColor: string;
    shortLabel: string
}> = {
    1: {label: 'High Priority', iconColor: 'text-error', bgColor: 'bg-error', shortLabel: 'P1'},
    2: {label: 'Medium Priority', iconColor: 'text-warning', bgColor: 'bg-warning', shortLabel: 'P2'},
    3: {label: 'Low Priority', iconColor: 'text-info', bgColor: 'bg-info', shortLabel: 'P3'},
    4: {label: 'Lowest Priority', iconColor: 'text-grey-medium', bgColor: 'bg-grey-medium', shortLabel: 'P4'},
};
const noPriorityBgColor = 'bg-grey-light';

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
                                                                        }) => (<DropdownMenu.Item
    className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8 font-normal", isDanger ? "text-error data-[highlighted]:bg-error/10 data-[highlighted]:text-error" : "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light", selected && !isDanger && "bg-primary-light text-primary data-[highlighted]:bg-primary-light", !selected && !isDanger && "text-grey-dark data-[highlighted]:text-grey-dark", "data-[disabled]:opacity-50", className)} {...props}> {icon && (
    <Icon name={icon} size={16} strokeWidth={1}
          className={twMerge("mr-2 flex-shrink-0 opacity-80", iconColor)} // Increased opacity for icons
          aria-hidden="true"/>)} <span className="flex-grow">{children}</span> </DropdownMenu.Item>));
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
    const taskItemRef = useRef<HTMLDivElement>(null);

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
        const calculatedTransition = dndTransition || 'background-color 0.2s ease-in-out';
        if (isDragging && !isOverlay) return {
            transform: baseTransform,
            transition: calculatedTransition,
            opacity: 0.7,
            cursor: 'grabbing',
            boxShadow: 'var(--shadow-subtle)',
            zIndex: 10,
            background: 'hsl(var(--color-white))'
        };
        if (isOverlay) return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition,
            cursor: 'grabbing',
            boxShadow: 'var(--shadow-subtle)',
            zIndex: 1000,
            background: 'hsl(var(--color-white))'
        };
        return {
            ...overlayStyle,
            transform: baseTransform,
            transition: calculatedTransition,
            zIndex: isSelected ? 2 : 1,
        };
    }, [overlayStyle, transform, dndTransition, isDragging, isOverlay, isSelected]);

    useEffect(() => {
        if (openItemId !== task.id) {
            setIsMoreActionsOpen(false);
            setIsMenuDatePickerOpen(false);
            setIsDateClickPickerOpen(false);
        }
    }, [openItemId, task.id]);

    useEffect(() => {
        if (!isMoreActionsOpen && !isMenuDatePickerOpen && !isDateClickPickerOpen && openItemId === task.id) {
            setOpenItemId(null);
        }
    }, [isMoreActionsOpen, isMenuDatePickerOpen, isDateClickPickerOpen, openItemId, task.id, setOpenItemId]);


    const handleTaskClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, a, [data-radix-popper-content-wrapper], [role="dialog"], [role="menuitem"], [data-date-picker-trigger="true"], [data-tooltip-trigger]')) return;
        if (isDragging) return;
        setSelectedTaskId(id => (id === task.id ? null : task.id));
        setOpenItemId(null);
    }, [setSelectedTaskId, task.id, isDragging, setOpenItemId]);

    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed' | 'subtasks'>>) => {
        setTasks(prevTasks => prevTasks.map(t => (t.id === task.id ? {...t, ...updates, updatedAt: Date.now()} : t)));
    }, [setTasks, task.id]);

    const cycleCompletionPercentage = useCallback((event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        const currentPercentage = task.completionPercentage ?? 0;
        let nextPercentage: number | null = currentPercentage === 100 ? null : 100;
        updateTask({completionPercentage: nextPercentage});
        if (nextPercentage === 100 && isSelected) setSelectedTaskId(null);
        setOpenItemId(null);
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

    const handleMoreActionsOpenChange = useCallback((open: boolean) => {
        setIsMoreActionsOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsMenuDatePickerOpen(false);
            setIsDateClickPickerOpen(false);
        }
    }, [task.id, setOpenItemId]);


    const handleMenuDatePickerOpenChange = useCallback((open: boolean) => {
        setIsMenuDatePickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsMoreActionsOpen(true);
            setIsDateClickPickerOpen(false);
        }
    }, [task.id, setOpenItemId]);

    const handleDateClickPickerOpenChange = useCallback((open: boolean) => {
        setIsDateClickPickerOpen(open);
        if (open) {
            setOpenItemId(task.id);
            setIsMoreActionsOpen(false);
            setIsMenuDatePickerOpen(false);
        }
    }, [task.id, setOpenItemId]);


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
            if (index !== -1) {
                newTasks.splice(index + 1, 0, newTaskData as Task);
            } else {
                newTasks.push(newTaskData as Task);
            }
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
        highlightClassName: "bg-primary-light text-primary font-normal rounded-[1px] px-0",
        searchWords: searchWords,
        autoEscape: true,
    }), [searchWords]);

    const subtaskSearchMatch = useMemo(() => {
        if (searchWords.length === 0 || !task.subtasks || task.subtasks.length === 0) return null;

        const parentTitleIncludesAllSearch = searchWords.every(w => task.title.toLowerCase().includes(w));
        const parentContentMatchesButNotTitle = task.content &&
            searchWords.some(w => task.content!.toLowerCase().includes(w)) &&
            !parentTitleIncludesAllSearch;

        for (const subtask of task.subtasks) {
            const subtaskTitleIncludesSearch = searchWords.some(w => subtask.title.toLowerCase().includes(w));
            if (subtaskTitleIncludesSearch && (!parentTitleIncludesAllSearch || parentContentMatchesButNotTitle)) {
                return {
                    type: 'title',
                    text: generateContentSnippet(subtask.title, searchTerm, 30),
                    original: subtask.title
                };
            }
        }
        return null;
    }, [searchWords, task.title, task.content, task.subtasks, searchTerm]);


    const showContentHighlight = useMemo(() => {
        if (searchWords.length === 0 || !task.content?.trim()) return false;
        const lc = task.content.toLowerCase();
        const lt = task.title.toLowerCase();
        const contentHasMatch = searchWords.some(w => lc.includes(w));
        const titleHasAllMatches = searchWords.every(w => lt.includes(w));
        return contentHasMatch && (!titleHasAllMatches && !subtaskSearchMatch);

    }, [searchWords, task.content, task.title, subtaskSearchMatch]);

    const combinedRef = useCallback((node: HTMLDivElement | null) => {
        setNodeRef(node);
        (taskItemRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }, [setNodeRef]);

    const baseClasses = useMemo(() => twMerge(
        'task-item flex items-center px-4 pr-3 h-[48px] mb-1.5',
        'group relative rounded-base',
        isOverlay ? 'bg-white shadow-subtle border border-grey-light' // Use updated grey-light
            : isSelected && !isDragging ? 'bg-grey-ultra-light' // Use updated grey-ultra-light
                : isTrashItem || isCompleted ? 'bg-white opacity-60'
                    : 'bg-white hover:bg-grey-ultra-light', // Use updated grey-ultra-light
        isDragging ? 'cursor-grabbing' : (isSortable ? 'cursor-grab' : 'cursor-default'),
        'transition-colors duration-150 ease-in-out outline-none',
        'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white'
    ), [isOverlay, isSelected, isDragging, isTrashItem, isCompleted, isSortable]);


    const titleClasses = useMemo(() => twMerge(
        "text-[13px] text-grey-dark leading-tight block font-normal truncate",
        (isCompleted || isTrashItem) && "line-through text-grey-medium font-light"
    ), [isCompleted, isTrashItem]);

    const listIcon: IconName = useMemo(() => task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list'), [task.list]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);

    const actionsMenuContentClasses = useMemo(() => twMerge('z-[55] min-w-[200px] p-1 w-52 bg-white rounded-base shadow-modal data-[state=open]:animate-dropdownShow data-[state=closed]:animate-dropdownHide'), []);
    const datePickerPopoverWrapperClasses = useMemo(() => twMerge("z-[60] p-0 bg-white rounded-base shadow-modal data-[state=open]:animate-popoverShow data-[state=closed]:animate-popoverHide"), []);

    const progressMenuItems = useMemo(() => [
        {label: 'Not Started', value: null, icon: 'circle' as IconName},
        {label: '20%', value: 20, icon: 'circle-dot-dashed' as IconName},
        {label: '50%', value: 50, icon: 'circle-dot' as IconName},
        {label: '80%', value: 80, icon: 'circle-slash' as IconName},
        {label: '100% (Completed)', value: 100, icon: 'circle-check' as IconName},
    ], []);

    const isDateClickable = isValidDueDate && isInteractive;

    const dueDateClasses = useMemo(() => twMerge(
        'flex items-center whitespace-nowrap rounded-base transition-colors duration-150 ease-in-out outline-none',
        'text-[11px] font-light',
        overdue && 'text-error',
        (isCompleted || isTrashItem) && 'line-through opacity-70',
        isDateClickable && 'cursor-pointer hover:bg-grey-light px-1 py-0.5 mx-[-4px] my-[-2px] focus-visible:ring-1 focus-visible:ring-primary', // Use updated grey-light
        !isDateClickable && 'px-0 py-0',
        !overdue && 'text-grey-medium'
    ), [overdue, isCompleted, isTrashItem, isDateClickable]);

    const tooltipContentClass = "text-[11px] bg-grey-dark text-white px-2 py-1 rounded-base shadow-md select-none z-[70] data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const priorityDotBgClass = useMemo(() => {
        if (task.priority && priorityMap[task.priority]) {
            return priorityMap[task.priority].bgColor;
        }
        return noPriorityBgColor;
    }, [task.priority]);

    const priorityDotLabel = useMemo(() => {
        if (task.priority && priorityMap[task.priority]) {
            return priorityMap[task.priority].label;
        }
        return 'No Priority';
    }, [task.priority]);


    return (
        <>
            <div ref={combinedRef}
                 style={style}
                 className={baseClasses} {...(isSortable ? attributes : {})} {...(isSortable ? listeners : {})}
                 onClick={handleTaskClick}
                 role={isSortable ? "listitem" : "button"}
                 tabIndex={isInteractive ? 0 : -1}
                 onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                     if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button, input, a, [role="menuitem"], [data-date-picker-trigger="true"], [data-tooltip-trigger]')) {
                         e.preventDefault();
                         handleTaskClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                     }
                     if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).getAttribute('data-date-picker-trigger') === 'true') {
                         e.preventDefault();
                         e.stopPropagation();
                         handleDateClickPickerOpenChange(true);
                     }
                     if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === taskItemRef.current && moreActionsButtonRef.current) {
                         e.preventDefault();
                         e.stopPropagation();
                         moreActionsButtonRef.current.click();
                     }
                 }}
                 aria-selected={isSelected} aria-labelledby={`task-title-${task.id}`}>

                <div className="flex-shrink-0 mr-3">
                    <ProgressIndicator percentage={task.completionPercentage} isTrash={isTrashItem}
                                       onClick={cycleCompletionPercentage} onKeyDown={handleProgressIndicatorKeyDown}
                                       ariaLabelledby={`task-title-${task.id}`} size={16}/>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center">
                        {!isCompleted && !isTrashItem && (
                            <Tooltip.Provider delayDuration={300}><Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                     <span
                                         className={twMerge("w-2 h-2 rounded-full flex-shrink-0 mr-2", priorityDotBgClass)}
                                         data-tooltip-trigger="true"
                                         aria-label={priorityDotLabel}
                                     />
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                 sideOffset={4}>
                                    {priorityDotLabel} <Tooltip.Arrow className="fill-grey-dark"/>
                                </Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                        )}
                        <Highlighter {...highlighterProps} textToHighlight={task.title || 'Untitled Task'}
                                     id={`task-title-${task.id}`} className={titleClasses}/>
                    </div>

                    <div
                        className={twMerge("flex items-center flex-wrap text-grey-medium mt-0.5 leading-tight gap-x-2 gap-y-0.5 min-h-[17px]",
                            (isCompleted || isTrashItem) && "opacity-70"
                        )}>
                        {!isTrashItem && (
                            <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <span className="flex items-center text-[11px] font-light cursor-default"
                                          data-tooltip-trigger="true">
                                         <Icon name={listIcon} size={12} strokeWidth={1.5}
                                               className="mr-0.5 opacity-80 flex-shrink-0"/> {/* Icon opacity increased */}
                                        <span
                                            className={clsx((isCompleted || isTrashItem) && 'line-through')}>{task.list}</span>
                                    </span>
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                 align="start" sideOffset={4}>
                                    List: {task.list} <Tooltip.Arrow className="fill-grey-dark"/>
                                </Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                        )}

                        {task.subtasks && task.subtasks.length > 0 && !subtaskSearchMatch && (
                            <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                     <span className="flex items-center text-[11px] font-light cursor-default"
                                           data-tooltip-trigger="true">
                                          <Icon name="git-fork" size={12} strokeWidth={1.5}
                                                className="mr-0.5 opacity-80 flex-shrink-0"/> {/* Icon opacity increased */}
                                         <span
                                             className={clsx((isCompleted || isTrashItem) && 'line-through')}>{task.subtasks.length}</span>
                                     </span>
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                 align="start" sideOffset={4}>
                                    {task.subtasks.length} Subtask{task.subtasks.length > 1 ? 's' : ''} <Tooltip.Arrow
                                    className="fill-grey-dark"/>
                                </Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                        )}

                        {isValidDueDate && !showContentHighlight && !subtaskSearchMatch && (
                            <Popover.Root modal={true} open={isDateClickPickerOpen}
                                          onOpenChange={handleDateClickPickerOpenChange}>
                                <Popover.Trigger asChild disabled={!isDateClickable}>
                                    <button ref={dateDisplayRef} className={dueDateClasses}
                                            title={isDateClickable ? `Due: ${formatDate(dueDate!)} (Click to change)` : `Due: ${formatDate(dueDate!)}`}
                                            onClick={isDateClickable ? (e) => e.stopPropagation() : undefined}
                                            onKeyDown={isDateClickable ? (e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleDateClickPickerOpenChange(true);
                                                }
                                            } : undefined}
                                            aria-label={isDateClickable ? `Change due date, currently ${formatRelativeDate(dueDate!, false)}` : `Due date ${formatRelativeDate(dueDate!, false)}`}
                                            data-date-picker-trigger={isDateClickable ? "true" : "false"}
                                            data-tooltip-trigger="true"
                                    >
                                        <Icon name="calendar" size={12} strokeWidth={1.5}
                                              className="mr-0.5 opacity-80 flex-shrink-0"/> {/* Icon opacity increased */}
                                        {formatRelativeDate(dueDate!, false)}
                                    </button>
                                </Popover.Trigger>
                                {isDateClickable && (
                                    <Popover.Portal><Popover.Content side="bottom" align="start" sideOffset={5}
                                                                     className={datePickerPopoverWrapperClasses}
                                                                     onOpenAutoFocus={(e) => e.preventDefault()}
                                                                     onCloseAutoFocus={(e) => {
                                                                         e.preventDefault();
                                                                         dateDisplayRef.current?.focus();
                                                                     }}>
                                        <CustomDatePickerContent
                                            initialDate={dueDate ?? undefined} onSelect={handleDateSelect}
                                            closePopover={closeDateClickPopover}/>
                                    </Popover.Content></Popover.Portal>)}
                            </Popover.Root>
                        )}

                        {task.tags && task.tags.length > 0 && !showContentHighlight && !subtaskSearchMatch && (
                            <Tooltip.Provider delayDuration={200}><Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                    <span
                                        className={clsx("flex items-center bg-grey-ultra-light text-grey-medium px-1.5 py-[1px] rounded-base text-[10px] font-light cursor-default", (isCompleted || isTrashItem) && 'line-through opacity-60')}
                                        data-tooltip-trigger="true"
                                    >
                                        <Icon name="tag" size={10} strokeWidth={1.5}
                                              className="mr-1 opacity-80"/> {/* Icon opacity increased */}
                                        <span className="truncate max-w-[60px]">{task.tags[0]}</span>
                                        {task.tags.length > 1 &&
                                            <span className="ml-0.5 opacity-70">+{task.tags.length - 1}</span>}
                                    </span>
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="bottom"
                                                                 sideOffset={4}>
                                    Tags: {task.tags.join(', ')}<Tooltip.Arrow className="fill-grey-dark"/>
                                </Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                        )}

                        {showContentHighlight && (
                            <div
                                className={clsx("flex items-center text-[11px] text-grey-medium italic w-full font-light", (isCompleted || isTrashItem) && 'line-through')}>
                                <Icon name="file-text" size={10} strokeWidth={1}
                                      className="mr-1 opacity-70 flex-shrink-0 mt-px"/> {/* Icon opacity increased */}
                                <Highlighter {...highlighterProps}
                                             textToHighlight={generateContentSnippet(task.content!, searchTerm)}
                                             className="truncate"/>
                            </div>
                        )}

                        {subtaskSearchMatch && (
                            <div
                                className={clsx("flex items-center text-[11px] text-grey-medium italic w-full font-light", (isCompleted || isTrashItem) && 'line-through')}>
                                <Icon name="git-fork" size={10} strokeWidth={1.5}
                                      className="mr-1 opacity-70 flex-shrink-0 mt-px"/> {/* Icon opacity increased */}
                                <span className="mr-1">Sub:</span>
                                <Highlighter {...highlighterProps}
                                             textToHighlight={subtaskSearchMatch.text}
                                             className="truncate"/>
                            </div>
                        )}
                    </div>
                </div>

                {isInteractive && (
                    <div
                        className="task-item-actions absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 ease-in-out z-10"
                        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}>
                        <Popover.Root modal={true} open={isMenuDatePickerOpen}
                                      onOpenChange={handleMenuDatePickerOpenChange}>
                            <DropdownMenu.Root open={isMoreActionsOpen} onOpenChange={handleMoreActionsOpenChange}>
                                <Popover.Anchor asChild>
                                    <DropdownMenu.Trigger asChild disabled={!isInteractive}>
                                        <Button
                                            ref={moreActionsButtonRef} variant="ghost" size="icon"
                                            icon="more-horizontal"
                                            className="h-7 w-7 text-grey-medium hover:bg-grey-light focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-grey-light"
                                            iconProps={{size: 16, strokeWidth: 1.5}}
                                            aria-label={`More actions for ${task.title || 'task'}`}/>
                                    </DropdownMenu.Trigger>
                                </Popover.Anchor>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        className={actionsMenuContentClasses}
                                        sideOffset={4}
                                        align="end"
                                        onCloseAutoFocus={(e) => {
                                            const parentElement = taskItemRef.current;
                                            const isParentHovered = parentElement?.matches(':hover');
                                            if (isMenuDatePickerOpen || !isParentHovered) {
                                                e.preventDefault();
                                            }
                                        }}
                                    >
                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger
                                                className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark data-[disabled]:opacity-50")}>
                                                <Icon name="circle-gauge" size={16} strokeWidth={1}
                                                      className="mr-2 flex-shrink-0 opacity-80"/>
                                                Set Progress
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                    strokeWidth={1}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent className={actionsMenuContentClasses}
                                                                         sideOffset={2} alignOffset={-5}
                                                >
                                                    {progressMenuItems.map(item => (
                                                        <TaskItemRadixMenuItem key={item.label} icon={item.icon}
                                                                               selected={task.completionPercentage === item.value || (task.completionPercentage === null && item.value === null)}
                                                                               onSelect={() => handleProgressChange(item.value)}
                                                                               disabled={!isInteractive}>
                                                            {item.label}
                                                        </TaskItemRadixMenuItem>
                                                    ))}
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator className="h-px bg-grey-light my-1"/>

                                        <Popover.Trigger asChild>
                                            <TaskItemRadixMenuItem icon="calendar-plus"
                                                                   onSelect={(event) => {
                                                                       event.preventDefault();
                                                                       handleMenuDatePickerOpenChange(true);
                                                                   }}
                                                                   disabled={!isInteractive}>
                                                Set Due Date...
                                            </TaskItemRadixMenuItem>
                                        </Popover.Trigger>

                                        <DropdownMenu.Separator className="h-px bg-grey-light my-1"/>

                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger
                                                className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark data-[disabled]:opacity-50")}
                                                disabled={!isInteractive}>
                                                <Icon name="flag" size={16} strokeWidth={1}
                                                      className="mr-2 flex-shrink-0 opacity-80"/>
                                                Priority
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                    strokeWidth={1}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent className={actionsMenuContentClasses}
                                                                         sideOffset={2} alignOffset={-5}
                                                >
                                                    <DropdownMenu.RadioGroup value={String(task.priority ?? 'none')}
                                                                             onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}>
                                                        {[null, 1, 2, 3, 4].map(p => (
                                                            <DropdownMenu.RadioItem
                                                                key={p ?? 'none'}
                                                                value={String(p ?? 'none')}
                                                                className={twMerge(
                                                                    "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8",
                                                                    p && priorityMap[p] ? priorityMap[p].iconColor : 'text-grey-dark',
                                                                    `data-[state=checked]:${p && priorityMap[p] ? priorityMap[p].iconColor : 'text-grey-dark'}`,
                                                                    (task.priority !== p) && 'data-[highlighted]:text-grey-dark',
                                                                    'focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light',
                                                                    'data-[state=checked]:bg-grey-ultra-light',
                                                                    "data-[disabled]:opacity-50"
                                                                )}
                                                                disabled={!isInteractive}>
                                                                {p && <Icon name="flag" size={16} strokeWidth={1}
                                                                            className={twMerge("mr-2 flex-shrink-0 opacity-80", p && priorityMap[p] ? priorityMap[p].iconColor : '')}/>}
                                                                {p && priorityMap[p] ? `P${p} - ${priorityMap[p].label}` : 'None'}
                                                                <DropdownMenu.ItemIndicator
                                                                    className="absolute right-2 inline-flex items-center">
                                                                    <Icon name="check" size={14} strokeWidth={2}/>
                                                                </DropdownMenu.ItemIndicator>
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Sub>
                                            <DropdownMenu.SubTrigger
                                                className={twMerge("relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8 focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light data-[state=open]:bg-grey-ultra-light text-grey-dark data-[highlighted]:text-grey-dark data-[state=open]:text-grey-dark data-[disabled]:opacity-50")}
                                                disabled={!isInteractive}>
                                                <Icon name="folder" size={16} strokeWidth={1}
                                                      className="mr-2 flex-shrink-0 opacity-80"/>
                                                Move to List
                                                <div className="ml-auto pl-5"><Icon name="chevron-right" size={16}
                                                                                    strokeWidth={1}
                                                                                    className="opacity-70"/></div>
                                            </DropdownMenu.SubTrigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.SubContent
                                                    className={twMerge(actionsMenuContentClasses, "max-h-40 overflow-y-auto styled-scrollbar-thin")}
                                                    sideOffset={2} alignOffset={-5}
                                                >
                                                    <DropdownMenu.RadioGroup value={task.list}
                                                                             onValueChange={handleListChange}>
                                                        {availableLists.map(list => (
                                                            <DropdownMenu.RadioItem key={list} value={list}
                                                                                    className={twMerge(
                                                                                        "relative flex cursor-pointer select-none items-center rounded-base px-3 py-2 text-[13px] font-normal outline-none transition-colors data-[disabled]:pointer-events-none h-8",
                                                                                        "focus:bg-grey-ultra-light data-[highlighted]:bg-grey-ultra-light",
                                                                                        "data-[state=checked]:bg-primary-light data-[state=checked]:text-primary",
                                                                                        "text-grey-dark data-[highlighted]:text-grey-dark",
                                                                                        "data-[disabled]:opacity-50"
                                                                                    )}
                                                                                    disabled={!isInteractive}>
                                                                <Icon name={list === 'Inbox' ? 'inbox' : 'list'}
                                                                      size={16} strokeWidth={1}
                                                                      className="mr-2 flex-shrink-0 opacity-80"/>
                                                                {list}
                                                                <DropdownMenu.ItemIndicator
                                                                    className="absolute right-2 inline-flex items-center">
                                                                    <Icon name="check" size={14} strokeWidth={2}/>
                                                                </DropdownMenu.ItemIndicator>
                                                            </DropdownMenu.RadioItem>
                                                        ))}
                                                    </DropdownMenu.RadioGroup>
                                                </DropdownMenu.SubContent>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Sub>

                                        <DropdownMenu.Separator className="h-px bg-grey-light my-1"/>

                                        <TaskItemRadixMenuItem icon="copy-plus" onSelect={handleDuplicateTask}
                                                               disabled={!isInteractive}>
                                            Duplicate Task
                                        </TaskItemRadixMenuItem>

                                        {!isTrashItem && (
                                            <TaskItemRadixMenuItem icon="trash" onSelect={openDeleteConfirm} isDanger>
                                                Move to Trash
                                            </TaskItemRadixMenuItem>
                                        )}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>

                            <Popover.Portal>
                                <Popover.Content side="right" align="start"
                                                 sideOffset={5}
                                                 className={datePickerPopoverWrapperClasses}
                                                 onOpenAutoFocus={(e) => e.preventDefault()}
                                                 onCloseAutoFocus={(e) => {
                                                     e.preventDefault();
                                                 }}>
                                    <CustomDatePickerContent
                                        initialDate={dueDate ?? undefined} onSelect={handleDateSelect}
                                        closePopover={closeMenuDatePickerPopover}/>
                                </Popover.Content>
                            </Popover.Portal>
                        </Popover.Root>
                    </div>
                )}
            </div>

            <ConfirmDeleteModalRadix isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm}
                                     onConfirm={confirmDeleteTask} itemTitle={task.title || 'Untitled Task'}/>
        </>
    );
});
TaskItem.displayName = 'TaskItem';
export default TaskItem;