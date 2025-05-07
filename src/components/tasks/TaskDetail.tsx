// src/components/tasks/TaskDetail.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate,} from '@/utils/dateUtils';
import {Subtask, Task} from '@/types';
import {twMerge} from 'tailwind-merge';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {CustomDatePickerContent} from '../common/CustomDatePickerPopover';
import ConfirmDeleteModalRadix from "@/components/common/ConfirmDeleteModal";
import {ProgressIndicator} from './TaskItem';
import {IconName} from "@/components/common/IconMap";
import SelectionCheckboxRadix from "@/components/common/SelectionCheckbox";
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
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {AnimatePresence, motion} from "framer-motion";


// --- Helper TagPill Component ---
interface TagPillProps {
    tag: string;
    onRemove: () => void;
    disabled?: boolean;
}

const TagPill: React.FC<TagPillProps> = React.memo(({tag, onRemove, disabled}) => (
    <span
        className={twMerge(
            "inline-flex items-center bg-black/5 dark:bg-white/5 text-gray-600 dark:text-neutral-300 rounded px-1.5 py-0.5 text-[11px] mr-1 mb-1 group/pill whitespace-nowrap backdrop-blur-sm",
            "transition-colors duration-100 ease-apple",
            disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-black/10 dark:hover:bg-white/10"
        )}
        aria-label={`Tag: ${tag}${disabled ? ' (disabled)' : ''}`}
    >
        {tag}
        {!disabled && (
            <button type="button" onClick={(e) => {
                e.stopPropagation();
                onRemove();
            }}
                    className="ml-1 text-gray-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 opacity-50 group-hover/pill:opacity-100 focus:outline-none rounded-full p-0.5 -mr-0.5 flex items-center justify-center"
                    aria-label={`Remove tag ${tag}`} tabIndex={-1}>
                <Icon name="x" size={9} strokeWidth={2.5}/>
            </button>
        )}
    </span>
));
TagPill.displayName = 'TagPill';


// --- Reusable Radix Dropdown Menu Item Component ---
interface RadixMenuItemProps extends DropdownMenu.DropdownMenuItemProps {
    icon?: IconName;
    iconColor?: string;
    selected?: boolean;
    isDanger?: boolean;
}

const RadixMenuItem: React.FC<RadixMenuItemProps> = React.memo(({
                                                                    icon,
                                                                    iconColor,
                                                                    selected,
                                                                    children,
                                                                    className,
                                                                    isDanger = false,
                                                                    ...props
                                                                }) => (
    <DropdownMenu.Item
        className={twMerge(
            "relative flex cursor-pointer select-none items-center rounded-md px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none h-8",
            isDanger
                ? "text-red-600 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-500/15 dark:data-[highlighted]:text-red-300"
                : "focus:bg-black/[.07] data-[highlighted]:bg-black/[.07] dark:focus:bg-white/[.07] dark:data-[highlighted]:bg-white/[.07]",
            selected && !isDanger && "bg-primary/15 text-primary data-[highlighted]:bg-primary/20 dark:bg-primary/25 dark:text-primary-light dark:data-[highlighted]:bg-primary/30",
            !selected && !isDanger && "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-200 dark:data-[highlighted]:text-neutral-50",
            "data-[disabled]:opacity-50",
            className
        )}
        {...props}
    >
        {icon && (<Icon name={icon} size={15} className={twMerge("mr-2 flex-shrink-0 opacity-70", iconColor)}
                        aria-hidden="true"/>)}
        <span className="flex-grow">{children}</span>
    </DropdownMenu.Item>
));
RadixMenuItem.displayName = 'RadixMenuItem';


// --- Subtask Item Component for TaskDetail (Refined UX) ---
interface SubtaskItemDetailProps {
    subtask: Subtask;
    onUpdate: (id: string, updates: Partial<Omit<Subtask, 'id' | 'parentId' | 'createdAt'>>) => void;
    onDelete: (id: string) => void;
    isEditingContentForThis: boolean;
    onToggleEditContent: (id: string | null) => void;
    isTaskCompletedOrTrashed: boolean;
    isDraggingOverlay?: boolean;
}

const SubtaskItemDetail: React.FC<SubtaskItemDetailProps> = memo(({
                                                                      subtask,
                                                                      onUpdate,
                                                                      onDelete,
                                                                      isEditingContentForThis,
                                                                      onToggleEditContent,
                                                                      isTaskCompletedOrTrashed,
                                                                      isDraggingOverlay = false
                                                                  }) => {
    const [localTitle, setLocalTitle] = useState(subtask.title);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isDateTooltipOpen, setIsDateTooltipOpen] = useState(false);
    const [localContentCache, setLocalContentCache] = useState(subtask.content || '');

    const isDisabledByParent = isTaskCompletedOrTrashed;
    const isDisabled = isDisabledByParent || subtask.completed;

    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
        id: `subtask-detail-${subtask.id}`, data: {subtask, type: 'subtask-item-detail'}, disabled: isDisabledByParent,
    });

    const style = useMemo(() => {
        const baseTransform = CSS.Transform.toString(transform);
        if (isDraggingOverlay) return {
            transform: baseTransform,
            transition,
            cursor: 'grabbing',
            zIndex: 1000,
            boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
            background: 'hsla(var(--canvas-alt-h), var(--canvas-alt-s), calc(var(--canvas-alt-l) + 3%), 0.9)'
        };
        if (isDragging) return {
            transform: baseTransform,
            transition,
            opacity: 0.6,
            cursor: 'grabbing',
            background: 'hsla(var(--glass-alt-h), var(--glass-alt-s), var(--glass-alt-l), 0.2)'
        };
        return {transform: baseTransform, transition};
    }, [transform, transition, isDragging, isDraggingOverlay]);

    useEffect(() => {
        setLocalTitle(subtask.title);
    }, [subtask.title]);
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);
    useEffect(() => {
        if (isEditingContentForThis && contentTextareaRef.current) {
            setLocalContentCache(subtask.content || '');
            contentTextareaRef.current.focus();
            contentTextareaRef.current.style.height = 'auto';
            requestAnimationFrame(() => {
                if (contentTextareaRef.current) contentTextareaRef.current.style.height = `${contentTextareaRef.current.scrollHeight}px`;
            });
        }
    }, [isEditingContentForThis, subtask.content]);


    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => setLocalTitle(e.target.value);
    const saveTitle = () => {
        const trimmedTitle = localTitle.trim();
        if (trimmedTitle && trimmedTitle !== subtask.title) onUpdate(subtask.id, {title: trimmedTitle}); else if (!trimmedTitle && subtask.title) setLocalTitle(subtask.title);
        setIsEditingTitle(false);
    };
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') saveTitle();
        if (e.key === 'Escape') {
            setLocalTitle(subtask.title);
            setIsEditingTitle(false);
        }
    };
    const handleCompletionToggle = () => {
        if (!isDisabledByParent) onUpdate(subtask.id, {
            completed: !subtask.completed,
            completedAt: !subtask.completed ? Date.now() : null
        });
    };

    const handleContentTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalContentCache(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };
    const saveSubtaskContent = () => {
        if (localContentCache !== (subtask.content || '')) {
            onUpdate(subtask.id, {content: localContentCache});
        }
        onToggleEditContent(null);
    };
    const cancelSubtaskContentEdit = () => {
        setLocalContentCache(subtask.content || '');
        onToggleEditContent(null);
    };

    const handleDateSelect = useCallback((dateWithTime: Date | undefined) => {
        if (!isDisabledByParent) onUpdate(subtask.id, {dueDate: dateWithTime ? dateWithTime.getTime() : null});
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, [onUpdate, subtask.id, isDisabledByParent]);
    const closeDatePickerPopover = useCallback(() => {
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, []);

    const subtaskDueDate = useMemo(() => safeParseDate(subtask.dueDate), [subtask.dueDate]);
    const isSubtaskOverdue = useMemo(() => subtaskDueDate && isValid(subtaskDueDate) && !subtask.completed && !isDisabledByParent && isOverdue(subtaskDueDate), [subtaskDueDate, subtask.completed, isDisabledByParent]);
    const hasContent = useMemo(() => !!subtask.content?.trim(), [subtask.content]);

    const subtaskItemBaseClasses = "group/subtask-detail flex flex-col rounded-lg transition-colors duration-150 ease-apple";
    const subtaskItemHoverClasses = !isDraggingOverlay && !isDragging && !isEditingContentForThis ? "hover:bg-black/[.025] dark:hover:bg-white/[.025]" : "";
    const subtaskItemEditingContentClasses = isEditingContentForThis ? "bg-black/[.02] dark:bg-white/[.02]" : "";
    const tooltipContentClass = "text-xs bg-black/80 dark:bg-neutral-900/90 text-white px-2 py-1 rounded shadow-md select-none z-[75] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    const datePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[70] p-0 bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10",
        "data-[state=open]:animate-slideUpAndFade",
        "data-[state=closed]:animate-slideDownAndFade"
    ), []);


    return (
        <div ref={setNodeRef} style={style}
             className={twMerge(subtaskItemBaseClasses, subtaskItemHoverClasses, subtaskItemEditingContentClasses, isDraggingOverlay && "bg-canvas-alt dark:bg-neutral-750 shadow-lg px-1.5")}>
            <div className="flex items-center h-9 px-1.5">
                <Button variant="ghost" size="icon" {...listeners} {...attributes}
                        className={twMerge("w-7 h-7 text-muted-foreground/30 dark:text-neutral-600 opacity-0 group-hover/subtask-detail:opacity-100 focus-visible:opacity-100 transition-opacity cursor-grab mr-1 flex-shrink-0", isDisabledByParent && "cursor-not-allowed !opacity-10")}
                        icon="grip-vertical" aria-label="Reorder subtask" tabIndex={-1} disabled={isDisabledByParent}
                />
                <SelectionCheckboxRadix
                    id={`subtask-detail-check-${subtask.id}`} checked={subtask.completed}
                    onChange={handleCompletionToggle}
                    aria-label={`Mark subtask ${subtask.title} as ${subtask.completed ? 'incomplete' : 'complete'}`}
                    className="mr-2.5 flex-shrink-0" size={16} disabled={isDisabledByParent}
                />
                <div className="flex-1 min-w-0 py-1"
                     onClick={() => !isEditingTitle && !isDisabled && setIsEditingTitle(true)}>
                    {isEditingTitle ? (
                        <input ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                               onBlur={saveTitle} onKeyDown={handleTitleKeyDown}
                               className={twMerge("w-full text-[13px] bg-transparent focus:outline-none focus:ring-0 border-none p-0 leading-tight h-full font-medium", subtask.completed ? "line-through text-neutral-500/70 dark:text-neutral-400/70" : "text-neutral-700 dark:text-neutral-100")}
                               placeholder="Subtask title..." disabled={isDisabled}
                        />
                    ) : (
                        <span
                            className={twMerge("text-[13px] cursor-text block truncate leading-tight font-medium", subtask.completed ? "line-through text-neutral-500/70 dark:text-neutral-400/70" : "text-neutral-700 dark:text-neutral-100")}>
                            {subtask.title || <span className="italic text-muted-foreground/70">Untitled Subtask</span>}
                        </span>
                    )}
                </div>
                <div
                    className={twMerge("flex items-center flex-shrink-0 ml-2 space-x-1 transition-opacity duration-150", (isEditingContentForThis || isEditingTitle) ? "opacity-100" : "opacity-0 group-hover/subtask-detail:opacity-100 focus-within:opacity-100")}>
                    {(subtask.dueDate || !isDisabled) && (
                        <Popover.Root open={isDatePickerOpen} onOpenChange={(open) => {
                            setIsDatePickerOpen(open);
                            if (!open) setIsDateTooltipOpen(false);
                        }}>
                            <Tooltip.Provider><Tooltip.Root delayDuration={300} open={isDateTooltipOpen}
                                                            onOpenChange={setIsDateTooltipOpen}>
                                <Tooltip.Trigger asChild>
                                    <Popover.Trigger asChild disabled={isDisabled}>
                                        <Button variant="ghost" size="icon" icon="calendar"
                                                className={twMerge("w-7 h-7",
                                                    isSubtaskOverdue && !subtask.completed && "text-red-500 dark:text-red-400",
                                                    !isSubtaskOverdue && "text-muted-foreground/60 dark:text-neutral-500/60 hover:text-muted-foreground dark:hover:text-neutral-400",
                                                    isDisabled && !subtask.dueDate && "opacity-50 cursor-not-allowed",
                                                    isDisabled && subtask.dueDate && "opacity-60 cursor-not-allowed",
                                                )}
                                                aria-label={subtask.dueDate ? `Subtask due: ${formatRelativeDate(subtaskDueDate, true)}` : "Set subtask due date"}
                                        />
                                    </Popover.Trigger>
                                </Tooltip.Trigger>
                                <Tooltip.Portal><Tooltip.Content className={tooltipContentClass} side="top"
                                                                 sideOffset={6}>
                                    {subtask.dueDate ? formatRelativeDate(subtaskDueDate, true) : "Set Due Date"}
                                    <Tooltip.Arrow className="fill-black/80 dark:fill-neutral-900/90"/>
                                </Tooltip.Content></Tooltip.Portal>
                            </Tooltip.Root></Tooltip.Provider>
                            <Popover.Portal><Popover.Content
                                className={datePickerPopoverWrapperClasses} // Applied corrected classes
                                sideOffset={5}
                                align="end" onOpenAutoFocus={(e) => e.preventDefault()}
                                onCloseAutoFocus={(e) => e.preventDefault()}>
                                <CustomDatePickerContent initialDate={subtaskDueDate ?? undefined}
                                                         onSelect={handleDateSelect}
                                                         closePopover={closeDatePickerPopover}/>
                            </Popover.Content></Popover.Portal>
                        </Popover.Root>
                    )}
                    <Button variant="ghost" size="icon"
                            icon={isEditingContentForThis ? "edit" : (hasContent ? "sticky-note" : "file-pen")}
                            onClick={() => !isDisabled && onToggleEditContent(isEditingContentForThis ? null : subtask.id)}
                            className={twMerge("w-7 h-7",
                                isEditingContentForThis ? "text-primary bg-primary/10 dark:bg-primary/20" : "text-muted-foreground/60 dark:text-neutral-500/60 hover:text-muted-foreground dark:hover:text-neutral-400",
                                isDisabled && "opacity-50 cursor-not-allowed",
                            )}
                            aria-label={isEditingContentForThis ? "Close subtask notes" : (hasContent ? "Edit subtask notes" : "Add subtask notes")}
                            disabled={isDisabled}
                    />
                    <Button variant="ghost" size="icon" icon="trash"
                            onClick={() => !isDisabledByParent && onDelete(subtask.id)}
                            className={twMerge("w-7 h-7 text-muted-foreground/40 dark:text-neutral-500/40 hover:text-red-500 dark:hover:text-red-400", isDisabledByParent && "opacity-20 cursor-not-allowed")}
                            aria-label="Delete subtask" disabled={isDisabledByParent}
                    />
                </div>
            </div>

            <AnimatePresence initial={false}>
                {isEditingContentForThis && (
                    <motion.div
                        key={`content-editor-${subtask.id}`}
                        initial={{height: 0, opacity: 0.5, marginTop: 0}}
                        animate={{height: 'auto', opacity: 1, marginTop: '4px', marginBottom: '4px'}}
                        exit={{height: 0, opacity: 0, marginTop: 0, marginBottom: 0}}
                        transition={{duration: 0.25, ease: [0.33, 1, 0.68, 1]}}
                        className="overflow-hidden pl-[calc(28px+10px+16px+10px)] pr-2"
                    >
                        <textarea
                            ref={contentTextareaRef} value={localContentCache} onChange={handleContentTextareaChange}
                            placeholder="Add notes..."
                            className={twMerge(
                                "w-full text-xs min-h-[40px] max-h-[120px] py-1.5 px-2 rounded-md resize-none overflow-y-auto styled-scrollbar-thin",
                                "bg-black/[.03] dark:bg-white/[.03] border border-black/10 dark:border-white/10",
                                "focus:ring-1 focus:ring-primary/50 focus:border-primary/50 dark:focus:border-primary/60",
                                "placeholder:text-muted-foreground/60 dark:placeholder:text-neutral-500/60",
                                "text-neutral-700 dark:text-neutral-300 leading-relaxed",
                                isDisabled && "opacity-60 cursor-not-allowed"
                            )}
                            disabled={isDisabled} rows={1}
                        />
                        <div className="flex justify-end space-x-2 mt-1.5">
                            <Button variant="ghost" size="sm" onClick={cancelSubtaskContentEdit}
                                    className="!h-6 !px-2 !text-xs">Cancel</Button>
                            <Button variant="primary" size="sm" onClick={saveSubtaskContent}
                                    className="!h-6 !px-2 !text-xs">Save Notes</Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
SubtaskItemDetail.displayName = 'SubtaskItemDetail';


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    const [selectedTask, setSelectedTaskInternal] = useAtom(selectedTaskAtom);
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);
    const [localTagsString, setLocalTagsString] = useState('');
    const [tagInputValue, setTagInputValue] = useState('');

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
    const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
    const [isTagsPopoverOpen, setIsTagsPopoverOpen] = useState(false);
    const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
    const [isProgressDropdownOpen, setIsProgressDropdownOpen] = useState(false);
    const [isInfoPopoverOpen, setIsInfoPopoverOpen] = useState(false);

    const [isProgressTooltipOpen, setIsProgressTooltipOpen] = useState(false);
    const [isDateTooltipOpen, setIsDateTooltipOpen] = useState(false);
    const [isListTooltipOpen, setIsListTooltipOpen] = useState(false);
    const [isPriorityTooltipOpen, setIsPriorityTooltipOpen] = useState(false);
    const [isTagsTooltipOpen, setIsTagsTooltipOpen] = useState(false);
    const [isInfoTooltipOpen, setIsInfoTooltipOpen] = useState(false);

    const [editingSubtaskContentId, setEditingSubtaskContentId] = useState<string | null>(null);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const newSubtaskInputRef = useRef<HTMLInputElement>(null);
    const [draggingSubtaskId, setDraggingSubtaskId] = useState<UniqueIdentifier | null>(null);

    const titleInputRef = useRef<HTMLInputElement>(null);
    const tagInputElementRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const latestTitleRef = useRef(localTitle);
    const latestContentRef = useRef(localContent);
    const latestTagsStringRef = useRef(localTagsString);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            savePendingChanges();
        };
    }, []);
    const savePendingChanges = useCallback(() => {
        if (!selectedTask || !hasUnsavedChangesRef.current || !isMountedRef.current) return;
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        const currentTitle = latestTitleRef.current;
        const currentContent = latestContentRef.current;
        const currentDueDate = localDueDate;
        const currentTagsString = latestTagsStringRef.current;
        const processedTitle = currentTitle.trim();
        const processedDueDateTimestamp = currentDueDate && isValid(currentDueDate) ? currentDueDate.getTime() : null;
        const processedTags = currentTagsString.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
        const originalTaskState = selectedTask;
        const changesToSave: Partial<Task> = {};
        if (processedTitle !== originalTaskState.title) changesToSave.title = processedTitle;
        if (currentContent !== (originalTaskState.content || '')) changesToSave.content = currentContent;
        const originalDueTime = originalTaskState.dueDate ?? null;
        if (processedDueDateTimestamp !== originalDueTime) changesToSave.dueDate = processedDueDateTimestamp;
        const originalTagsSorted = (originalTaskState.tags ?? []).slice().sort();
        const processedTagsSorted = processedTags.slice().sort();
        if (JSON.stringify(processedTagsSorted) !== JSON.stringify(originalTagsSorted)) changesToSave.tags = processedTags;
        if (Object.keys(changesToSave).length > 0) {
            setTasks(prevTasks => prevTasks.map((t) => (t.id === originalTaskState.id ? {...t, ...changesToSave} : t)));
        }
        hasUnsavedChangesRef.current = false;
    }, [selectedTask, setTasks, localDueDate]);
    useEffect(() => {
        savePendingChanges();
        if (selectedTask) {
            const isTitleFocused = titleInputRef.current === document.activeElement;
            const isTagsFocused = tagInputElementRef.current === document.activeElement;
            const isContentFocused = editorRef.current?.getView()?.hasFocus ?? false;
            if (!isTitleFocused) {
                setLocalTitle(selectedTask.title);
                latestTitleRef.current = selectedTask.title;
            }
            if (!isContentFocused) {
                setLocalContent(selectedTask.content || '');
                latestContentRef.current = selectedTask.content || '';
            }
            const taskDueDateObj = safeParseDate(selectedTask.dueDate);
            setLocalDueDate(taskDueDateObj && isValid(taskDueDateObj) ? taskDueDateObj : undefined);
            const taskTagsString = (selectedTask.tags ?? []).join(', ');
            if (!isTagsFocused) {
                setLocalTagsString(taskTagsString);
                latestTagsStringRef.current = taskTagsString;
                setTagInputValue('');
            }
            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            setEditingSubtaskContentId(null);
            setNewSubtaskTitle('');
            if (selectedTask.title === '' && !isTitleFocused && !isContentFocused && !isTagsFocused) {
                const timer = setTimeout(() => {
                    if (isMountedRef.current && titleInputRef.current) {
                        titleInputRef.current.focus();
                        titleInputRef.current.select();
                    }
                }, 350);
                return () => clearTimeout(timer);
            }
        } else {
            setLocalTitle('');
            latestTitleRef.current = '';
            setLocalContent('');
            latestContentRef.current = '';
            setLocalDueDate(undefined);
            setLocalTagsString('');
            latestTagsStringRef.current = '';
            setTagInputValue('');
            hasUnsavedChangesRef.current = false;
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            setIsDeleteDialogOpen(false);
            setIsDatePickerOpen(false);
            setIsListDropdownOpen(false);
            setIsPriorityDropdownOpen(false);
            setIsTagsPopoverOpen(false);
            setIsMoreActionsOpen(false);
            setIsProgressDropdownOpen(false);
            setIsInfoPopoverOpen(false);
            setEditingSubtaskContentId(null);
            setNewSubtaskTitle('');
        }
    }, [selectedTask]);
    useEffect(() => {
        latestTitleRef.current = localTitle;
    }, [localTitle]);
    useEffect(() => {
        latestContentRef.current = localContent;
    }, [localContent]);
    useEffect(() => {
        latestTagsStringRef.current = localTagsString;
    }, [localTagsString]);
    const triggerSave = useCallback(() => {
        if (!selectedTask || !isMountedRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            savePendingChanges();
        }, 700);
    }, [selectedTask, savePendingChanges]);
    const updateTask = useCallback((updates: Partial<Omit<Task, 'groupCategory' | 'completedAt' | 'completed' | 'subtasks'>>) => {
        if (!selectedTask || !isMountedRef.current) return;
        if (hasUnsavedChangesRef.current) savePendingChanges();
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        hasUnsavedChangesRef.current = false;
        setTasks(prevTasks => prevTasks.map(t => (t.id === selectedTask.id ? {...t, ...updates} : t)));
    }, [selectedTask, setTasks, savePendingChanges]);
    const handleClose = useCallback(() => {
        savePendingChanges();
        setSelectedTaskId(null);
    }, [setSelectedTaskId, savePendingChanges]);
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTitle(e.target.value);
        triggerSave();
    }, [triggerSave]);
    const handleContentChange = useCallback((newValue: string) => {
        setLocalContent(newValue);
        triggerSave();
    }, [triggerSave]);
    const handleMainContentBlur = useCallback(() => {
        savePendingChanges();
    }, [savePendingChanges]);
    const handleDatePickerSelect = useCallback((dateWithTime: Date | undefined) => {
        setLocalDueDate(dateWithTime);
        updateTask({dueDate: dateWithTime ? dateWithTime.getTime() : null});
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, [updateTask]);
    const closeDatePickerPopover = useCallback(() => {
        setIsDatePickerOpen(false);
        setIsDateTooltipOpen(false);
    }, []);
    const handleListChange = useCallback((newList: string) => updateTask({list: newList}), [updateTask]);
    const handlePriorityChange = useCallback((newPriority: number | null) => updateTask({priority: newPriority}), [updateTask]);
    const handleProgressChange = useCallback((newPercentage: number | null) => updateTask({completionPercentage: newPercentage}), [updateTask]);
    const cycleCompletionPercentage = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        const currentPercentage = selectedTask.completionPercentage ?? 0;
        let nextPercentage: number | null = currentPercentage === 100 ? null : 100;
        updateTask({completionPercentage: nextPercentage});
    }, [selectedTask, updateTask]);
    const openDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(true), []);
    const closeDeleteConfirm = useCallback(() => setIsDeleteDialogOpen(false), []);
    const confirmDelete = useCallback(() => {
        if (!selectedTask) return;
        updateTask({list: 'Trash', completionPercentage: null});
        setSelectedTaskId(null);
    }, [selectedTask, updateTask, setSelectedTaskId]);
    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        updateTask({list: 'Inbox'});
    }, [selectedTask, updateTask]);
    const handleDuplicateTask = useCallback(() => {
        if (!selectedTask) return;
        const now = Date.now();
        const newParentTaskId = `task-${now}-${Math.random().toString(16).slice(2)}`;
        const duplicatedSubtasks = (selectedTask.subtasks || []).map(sub => ({
            ...sub,
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`,
            parentId: newParentTaskId,
            createdAt: now,
            updatedAt: now,
            completedAt: sub.completed ? now : null,
        }));
        const newTaskData: Partial<Task> = {
            ...selectedTask,
            id: newParentTaskId,
            title: `${selectedTask.title} (Copy)`,
            order: selectedTask.order + 0.01,
            createdAt: now,
            updatedAt: now,
            completed: false,
            completedAt: null,
            completionPercentage: selectedTask.completionPercentage === 100 ? null : selectedTask.completionPercentage,
            subtasks: duplicatedSubtasks,
        };
        delete newTaskData.groupCategory;
        setTasks(prev => {
            const index = prev.findIndex(t => t.id === selectedTask.id);
            const newTasks = [...prev];
            newTasks.splice(index !== -1 ? index + 1 : prev.length, 0, newTaskData as Task);
            return newTasks;
        });
        setSelectedTaskId(newTaskData.id!);
        setIsMoreActionsOpen(false);
    }, [selectedTask, setTasks, setSelectedTaskId]);
    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            savePendingChanges();
            titleInputRef.current?.blur();
        } else if (e.key === 'Escape' && selectedTask) {
            e.preventDefault();
            if (localTitle !== selectedTask.title) {
                setLocalTitle(selectedTask.title);
                latestTitleRef.current = selectedTask.title;
                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                hasUnsavedChangesRef.current = false;
            }
            titleInputRef.current?.blur();
        }
    }, [selectedTask, localTitle, savePendingChanges]);
    const tagsArray = useMemo(() => localTagsString.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i), [localTagsString]);
    const isTrash = useMemo(() => selectedTask?.list === 'Trash', [selectedTask?.list]);
    const isCompleted = useMemo(() => (selectedTask?.completionPercentage ?? 0) === 100 && !isTrash, [selectedTask?.completionPercentage, isTrash]);
    const isInteractiveDisabled = useMemo(() => isTrash || isCompleted, [isTrash, isCompleted]);
    const addTag = useCallback((tagToAdd: string) => {
        const trimmedTag = tagToAdd.trim();
        if (!trimmedTag || isInteractiveDisabled) return;
        const currentTags = localTagsString.split(',').map(t => t.trim()).filter(Boolean);
        if (!currentTags.includes(trimmedTag)) {
            const newTagsString = [...currentTags, trimmedTag].join(', ');
            setLocalTagsString(newTagsString);
            triggerSave();
        }
        setTagInputValue('');
    }, [localTagsString, isInteractiveDisabled, triggerSave]);
    const removeTag = useCallback((tagToRemove: string) => {
        if (isInteractiveDisabled) return;
        const newTagsArray = tagsArray.filter(t => t !== tagToRemove);
        setLocalTagsString(newTagsArray.join(', '));
        triggerSave();
        tagInputElementRef.current?.focus();
    }, [tagsArray, isInteractiveDisabled, triggerSave]);
    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (isInteractiveDisabled) return;
        const value = tagInputValue.trim();
        if ((e.key === 'Enter' || e.key === ',') && value) {
            e.preventDefault();
            addTag(value);
        } else if (e.key === 'Backspace' && tagInputValue === '' && tagsArray.length > 0) {
            e.preventDefault();
            removeTag(tagsArray[tagsArray.length - 1]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setTagInputValue('');
            (e.target as HTMLInputElement).blur();
            setIsTagsPopoverOpen(false);
        }
    }, [tagInputValue, tagsArray, addTag, removeTag, isInteractiveDisabled]);
    const handleTagInputBlur = useCallback(() => {
        const value = tagInputValue.trim();
        if (value && !isInteractiveDisabled) addTag(value);
        savePendingChanges();
    }, [tagInputValue, addTag, isInteractiveDisabled, savePendingChanges]);
    const handleTagContainerClick = useCallback(() => {
        if (!isInteractiveDisabled) tagInputElementRef.current?.focus();
    }, [isInteractiveDisabled]);

    const handleAddSubtask = useCallback(() => {
        if (!selectedTask || !newSubtaskTitle.trim() || isInteractiveDisabled) return;
        const now = Date.now();
        const newSub: Subtask = {
            id: `subtask-${now}-${Math.random().toString(16).slice(2)}`, parentId: selectedTask.id,
            title: newSubtaskTitle.trim(), completed: false, completedAt: null,
            order: (selectedTask.subtasks?.reduce((max, s) => Math.max(max, s.order), 0) || 0) + 1000,
            createdAt: now, updatedAt: now, content: '', dueDate: null,
        };
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: [...(t.subtasks || []), newSub].sort((a, b) => a.order - b.order)
        } : t));
        setNewSubtaskTitle('');
    }, [selectedTask, newSubtaskTitle, setTasks, isInteractiveDisabled]);

    const handleUpdateSubtask = useCallback((subtaskId: string, updates: Partial<Omit<Subtask, 'id' | 'parentId' | 'createdAt'>>) => {
        if (!selectedTask) return;
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: (t.subtasks || []).map(sub => sub.id === subtaskId ? {
                ...sub, ...updates,
                updatedAt: Date.now()
            } : sub)
        } : t));
    }, [selectedTask, setTasks]);

    const handleDeleteSubtask = useCallback((subtaskId: string) => {
        if (!selectedTask) return;
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            subtasks: (t.subtasks || []).filter(sub => sub.id !== subtaskId)
        } : t));
        if (editingSubtaskContentId === subtaskId) setEditingSubtaskContentId(null);
    }, [selectedTask, setTasks, editingSubtaskContentId]);

    const handleToggleEditSubtaskContent = (subtaskId: string | null) => {
        setEditingSubtaskContentId(currentId => currentId === subtaskId ? null : subtaskId);
    };

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 3}}), useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));
    const handleSubtaskDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === 'subtask-item-detail') setDraggingSubtaskId(event.active.id.toString().replace('subtask-detail-', ''));
    };
    const handleSubtaskDragEnd = (event: DragEndEvent) => {
        setDraggingSubtaskId(null);
        const {active, over} = event;
        if (!selectedTask || !active || !over || active.id === over.id) return;
        if (active.data.current?.type !== 'subtask-item-detail' || over.data.current?.type !== 'subtask-item-detail') return;
        const activeId = active.id.toString().replace('subtask-detail-', '');
        const overId = over.id.toString().replace('subtask-detail-', '');
        const oldIndex = selectedTask.subtasks?.findIndex(s => s.id === activeId) ?? -1;
        const newIndex = selectedTask.subtasks?.findIndex(s => s.id === overId) ?? -1;
        if (oldIndex !== -1 && newIndex !== -1 && selectedTask.subtasks) {
            const reorderedSubtasksRaw = arrayMove(selectedTask.subtasks, oldIndex, newIndex);
            const finalSubtasks = reorderedSubtasksRaw.map((sub, index) => ({...sub, order: (index + 1) * 1000}));
            setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {...t, subtasks: finalSubtasks} : t));
        }
    };

    const priorityMap: Record<number, {
        label: string;
        icon: IconName;
        color: string
    }> = useMemo(() => ({
        1: {label: 'High', icon: 'flag', color: 'text-red-500 dark:text-red-400'},
        2: {label: 'Medium', icon: 'flag', color: 'text-orange-500 dark:text-orange-400'},
        3: {label: 'Low', icon: 'flag', color: 'text-blue-500 dark:text-blue-400'},
        4: {label: 'Lowest', icon: 'flag', color: 'text-gray-500 dark:text-neutral-400'},
    }), []);
    const displayDueDateForPicker = localDueDate;
    const displayDueDateForRender = localDueDate ?? safeParseDate(selectedTask?.dueDate);
    const overdue = useMemo(() => displayDueDateForRender && isValid(displayDueDateForRender) && !isCompleted && !isTrash && isOverdue(displayDueDateForRender), [displayDueDateForRender, isCompleted, isTrash]);
    const displayPriority = selectedTask?.priority;
    const displayList = selectedTask?.list;
    const displayCreatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.createdAt) : '', [selectedTask?.createdAt]);
    const displayUpdatedAt = useMemo(() => selectedTask ? formatDateTime(selectedTask.updatedAt) : '', [selectedTask?.updatedAt]);
    const availableLists = useMemo(() => userLists.filter(l => l !== 'Trash'), [userLists]);
    const mainPanelClass = useMemo(() => twMerge("h-full flex flex-col shadow-2xl z-20 bg-gradient-to-br from-neutral-100/80 to-neutral-200/70 dark:from-neutral-800/80 dark:to-neutral-900/70 backdrop-blur-2xl border-l border-neutral-200/70 dark:border-neutral-700/60"), []);
    const headerClass = useMemo(() => twMerge("px-4 py-2 h-16 flex items-center justify-between flex-shrink-0 border-b border-neutral-200/60 dark:border-neutral-700/50"), []);
    const titleInputClasses = useMemo(() => twMerge("flex-1 text-xl font-semibold border-none focus:ring-0 focus:outline-none bg-transparent p-0 mx-3 leading-tight placeholder:text-neutral-400 dark:placeholder:text-neutral-500 placeholder:font-normal", (isInteractiveDisabled) && "line-through text-neutral-500 dark:text-neutral-400", "text-neutral-800 dark:text-neutral-100 tracking-tight"), [isInteractiveDisabled]);
    const editorContainerClass = useMemo(() => twMerge("flex-grow-0 flex-shrink-0 prose dark:prose-invert max-w-none prose-sm prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2"), []);
    const editorClasses = useMemo(() => twMerge("!min-h-[150px] h-auto text-sm !bg-transparent !border-none !shadow-none", (isInteractiveDisabled) && "opacity-60", isTrash && "pointer-events-none", "dark:!text-neutral-300"), [isInteractiveDisabled, isTrash]);
    const footerClass = useMemo(() => twMerge("px-3 py-2 h-12 flex items-center justify-between flex-shrink-0 border-t border-neutral-200/60 dark:border-neutral-700/50"), []);
    const footerButtonClass = useMemo(() => twMerge("text-neutral-500 dark:text-neutral-400 hover:bg-neutral-500/10 dark:hover:bg-neutral-700/50 hover:text-neutral-700 dark:hover:text-neutral-200 focus-visible:ring-offset-neutral-100 dark:focus-visible:ring-offset-neutral-900"), []);
    const dropdownContentClasses = "min-w-[220px] z-[65] bg-glass-menu dark:bg-neutral-800/90 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-1.5 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";

    const datePickerPopoverWrapperClasses = useMemo(() => twMerge(
        "z-[70] p-0 bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10",
        "data-[state=open]:animate-slideUpAndFade",
        "data-[state=closed]:animate-slideDownAndFade"
    ), []);

    const tagsPopoverContentClasses = "min-w-[280px] z-[65] bg-glass-menu dark:bg-neutral-800/90 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-3 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";
    const tooltipContentClass = "text-xs bg-black/80 dark:bg-neutral-900/90 text-white dark:text-neutral-100 px-2 py-1 rounded shadow-md select-none z-[75] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";
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
    const progressStatusText = useMemo(() => {
        const p = selectedTask?.completionPercentage;
        if (p === 100) return "Completed";
        if (p && p > 0) return `${p}% Complete`;
        return "Not Started";
    }, [selectedTask?.completionPercentage]);
    const sortedSubtasks = useMemo(() => {
        if (!selectedTask?.subtasks) return [];
        return [...selectedTask.subtasks].sort((a, b) => a.order - b.order);
    }, [selectedTask?.subtasks]);

    if (!selectedTask) return null;

    return (
        <>
            <div className={mainPanelClass}>
                <div className={headerClass}>
                    <ProgressIndicator percentage={selectedTask.completionPercentage} isTrash={isTrash}
                                       onClick={cycleCompletionPercentage} size={24} className="flex-shrink-0"
                                       ariaLabelledby={`task-title-input-${selectedTask.id}`}/>
                    <input ref={titleInputRef} type="text" value={localTitle} onChange={handleTitleChange}
                           onKeyDown={handleTitleKeyDown} onBlur={savePendingChanges} className={titleInputClasses}
                           placeholder="Task title..." disabled={isTrash} aria-label="Task title"
                           id={`task-title-input-${selectedTask.id}`}/>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <DropdownMenu.Root open={isMoreActionsOpen}
                                           onOpenChange={setIsMoreActionsOpen}><DropdownMenu.Trigger asChild><Button
                            variant="ghost" size="icon" icon="more-horizontal"
                            className={twMerge(footerButtonClass, "w-8 h-8")}
                            aria-label="More actions"/></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content
                            className={dropdownContentClasses} sideOffset={5} align="end"><RadixMenuItem
                            icon="copy-plus" onSelect={handleDuplicateTask}>Duplicate
                            Task</RadixMenuItem><DropdownMenu.Separator
                            className="h-px bg-black/10 dark:bg-white/10 my-1"/>{isTrash ? (
                            <RadixMenuItem icon="arrow-left" onSelect={handleRestore}
                                           className="text-green-600 dark:text-green-500 data-[highlighted]:!bg-green-500/15 data-[highlighted]:!text-green-700 dark:data-[highlighted]:!text-green-400">Restore
                                Task</RadixMenuItem>) : (
                            <RadixMenuItem icon="trash" onSelect={openDeleteConfirm} isDanger>Move to
                                Trash</RadixMenuItem>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
                        <Button variant="ghost" size="icon" icon="x" onClick={handleClose}
                                className={twMerge(footerButtonClass, "w-8 h-8")} aria-label="Close task details"/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto styled-scrollbar-thin flex flex-col">
                    <div className={twMerge(editorContainerClass, "p-5 pb-3")}>
                        <CodeMirrorEditor ref={editorRef} value={localContent} onChange={handleContentChange}
                                          onBlur={handleMainContentBlur}
                                          placeholder="Add notes, links, or details here... Markdown is supported."
                                          className={editorClasses} readOnly={isInteractiveDisabled}/>
                    </div>
                    <div
                        className="px-5 pt-4 pb-5 border-t border-neutral-200/50 dark:border-neutral-700/50 flex-1 min-h-0 flex flex-col">
                        <div className="flex justify-between items-center mb-3 flex-shrink-0">
                            <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                                Subtasks
                                {sortedSubtasks.length > 0 && (
                                    <span
                                        className="ml-2 font-normal text-xs text-muted-foreground dark:text-neutral-400">
                                        ({sortedSubtasks.filter(s => s.completed).length} of {sortedSubtasks.length} completed)
                                    </span>
                                )}
                            </h3>
                        </div>

                        <div
                            className="flex-1 overflow-y-auto styled-scrollbar-thin -mx-2 pr-2 mb-3 min-h-[80px]">
                            <DndContext sensors={sensors} collisionDetection={closestCenter}
                                        onDragStart={handleSubtaskDragStart} onDragEnd={handleSubtaskDragEnd}
                                        measuring={{droppable: {strategy: MeasuringStrategy.Always}}}>
                                <SortableContext items={sortedSubtasks.map(s => `subtask-detail-${s.id}`)}
                                                 strategy={verticalListSortingStrategy}>
                                    <div className="space-y-0.5">
                                        {sortedSubtasks.map(subtask => (
                                            <SubtaskItemDetail
                                                key={subtask.id} subtask={subtask} onUpdate={handleUpdateSubtask}
                                                onDelete={handleDeleteSubtask}
                                                isEditingContentForThis={editingSubtaskContentId === subtask.id}
                                                onToggleEditContent={handleToggleEditSubtaskContent}
                                                isTaskCompletedOrTrashed={isInteractiveDisabled}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                                <DragOverlay dropAnimation={null}>
                                    {draggingSubtaskId && selectedTask.subtasks?.find(s => s.id === draggingSubtaskId) ? (
                                        <SubtaskItemDetail
                                            subtask={selectedTask.subtasks.find(s => s.id === draggingSubtaskId)!}
                                            onUpdate={() => {
                                            }}
                                            onDelete={() => {
                                            }}
                                            isEditingContentForThis={false}
                                            onToggleEditContent={() => {
                                            }}
                                            isTaskCompletedOrTrashed={isInteractiveDisabled}
                                            isDraggingOverlay={true}
                                        />
                                    ) : null}
                                </DragOverlay>
                            </DndContext>
                        </div>

                        {!isInteractiveDisabled && (
                            <div
                                className="mt-2 flex items-center flex-shrink-0 h-10 border-t border-neutral-200/40 dark:border-neutral-700/30 pt-2.5 pl-1">
                                <input
                                    ref={newSubtaskInputRef} type="text" value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newSubtaskTitle.trim()) handleAddSubtask();
                                        if (e.key === 'Escape') setNewSubtaskTitle('');
                                    }}
                                    placeholder="+ Add subtask..."
                                    className="flex-1 text-[13px] bg-transparent focus:outline-none p-0 h-full placeholder:text-muted-foreground/70 dark:placeholder:text-neutral-500/70 text-neutral-700 dark:text-neutral-300 focus:placeholder:text-muted-foreground/50 dark:focus:placeholder:text-neutral-500/50 transition-colors"
                                    aria-label="New subtask title"
                                />
                                <AnimatePresence>
                                    {newSubtaskTitle.trim() && (
                                        <motion.div initial={{opacity: 0, scale: 0.8}} animate={{opacity: 1, scale: 1}}
                                                    exit={{opacity: 0, scale: 0.8}} transition={{duration: 0.15}}>
                                            <Button variant="primary" size="sm" onClick={handleAddSubtask}
                                                    className="!h-7 !px-2.5 ml-2 !text-xs">Add</Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>

                <div className={footerClass}>
                    <div className="flex items-center space-x-0.5">
                        <Tooltip.Provider><Popover.Root open={isDatePickerOpen} onOpenChange={(open) => {
                            setIsDatePickerOpen(open);
                            if (!open) setIsDateTooltipOpen(false);
                        }}><Tooltip.Root delayDuration={300} open={isDateTooltipOpen}
                                         onOpenChange={setIsDateTooltipOpen}><Tooltip.Trigger asChild><Popover.Trigger
                            asChild disabled={isTrash}><Button variant="ghost" size="icon" icon="calendar"
                                                               className={twMerge(footerButtonClass, "w-8 h-8", overdue && !isCompleted && !isTrash && "text-red-500 dark:text-red-400")}
                                                               aria-label="Set due date"/></Popover.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                            className={tooltipContentClass} side="top"
                            sideOffset={6}>{displayDueDateForRender && isValid(displayDueDateForRender) ? `Due: ${formatRelativeDate(displayDueDateForRender, true)}` : 'Set Due Date'}<Tooltip.Arrow
                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root><Popover.Portal><Popover.Content
                            className={datePickerPopoverWrapperClasses} // Applied corrected classes
                            sideOffset={5}
                            align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}><CustomDatePickerContent
                            initialDate={displayDueDateForPicker} onSelect={handleDatePickerSelect}
                            closePopover={closeDatePickerPopover}/></Popover.Content></Popover.Portal></Popover.Root></Tooltip.Provider>
                        <Tooltip.Provider><DropdownMenu.Root open={isListDropdownOpen} onOpenChange={(open) => {
                            setIsListDropdownOpen(open);
                            if (!open) setIsListTooltipOpen(false);
                        }}><Tooltip.Root delayDuration={300} open={isListTooltipOpen}
                                         onOpenChange={setIsListTooltipOpen}><Tooltip.Trigger
                            asChild><DropdownMenu.Trigger asChild disabled={isTrash}><Button variant="ghost" size="icon"
                                                                                             icon={displayList === "Inbox" ? "inbox" : "list"}
                                                                                             className={twMerge(footerButtonClass, "w-8 h-8")}
                                                                                             aria-label="Change list"/></DropdownMenu.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                            className={tooltipContentClass} side="top" sideOffset={6}>List: {displayList}<Tooltip.Arrow
                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root><DropdownMenu.Portal><DropdownMenu.Content
                            className={twMerge(dropdownContentClasses, "max-h-48 overflow-y-auto styled-scrollbar-thin")}
                            sideOffset={5} align="start"
                            onCloseAutoFocus={(e) => e.preventDefault()}><DropdownMenu.RadioGroup value={displayList}
                                                                                                  onValueChange={handleListChange}>{availableLists.map(list => (
                            <RadixMenuItem key={list} onSelect={() => handleListChange(list)}
                                           selected={displayList === list}><Icon
                                name={list === 'Inbox' ? 'inbox' : 'list'} size={15} className="mr-2 opacity-70"/>{list}
                            </RadixMenuItem>))}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></Tooltip.Provider>
                        <Tooltip.Provider><DropdownMenu.Root open={isPriorityDropdownOpen} onOpenChange={(open) => {
                            setIsPriorityDropdownOpen(open);
                            if (!open) setIsPriorityTooltipOpen(false);
                        }}><Tooltip.Root delayDuration={300} open={isPriorityTooltipOpen}
                                         onOpenChange={setIsPriorityTooltipOpen}><Tooltip.Trigger
                            asChild><DropdownMenu.Trigger asChild disabled={isInteractiveDisabled}><Button
                            variant="ghost" size="icon" icon="flag"
                            className={twMerge(footerButtonClass, "w-8 h-8", displayPriority && priorityMap[displayPriority]?.color)}
                            aria-label="Set priority"/></DropdownMenu.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                            className={tooltipContentClass} side="top"
                            sideOffset={6}>{displayPriority ? `Priority: P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'}<Tooltip.Arrow
                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root><DropdownMenu.Portal><DropdownMenu.Content
                            className={dropdownContentClasses} sideOffset={5} align="start"
                            onCloseAutoFocus={(e) => e.preventDefault()}><DropdownMenu.RadioGroup
                            value={String(displayPriority ?? 'none')}
                            onValueChange={(value) => handlePriorityChange(value === 'none' ? null : Number(value))}>{[null, 1, 2, 3, 4].map(p => (
                            <RadixMenuItem key={p ?? 'none'} selected={displayPriority === p}
                                           onSelect={() => handlePriorityChange(p)}
                                           className={p ? priorityMap[p]?.color : ''}><Icon name="flag" size={15}
                                                                                            className="mr-2"/>{p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                            </RadixMenuItem>))}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></Tooltip.Provider>
                        <Tooltip.Provider><Popover.Root open={isTagsPopoverOpen} onOpenChange={(open) => {
                            setIsTagsPopoverOpen(open);
                            if (!open) setIsTagsTooltipOpen(false);
                        }}><Tooltip.Root delayDuration={300} open={isTagsTooltipOpen}
                                         onOpenChange={setIsTagsTooltipOpen}><Tooltip.Trigger asChild><Popover.Trigger
                            asChild disabled={isInteractiveDisabled}><Button variant="ghost" size="icon" icon="tag"
                                                                             className={twMerge(footerButtonClass, "w-8 h-8")}
                                                                             aria-label="Manage tags"/></Popover.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                            className={tooltipContentClass} side="top"
                            sideOffset={6}>{tagsArray.length > 0 ? `Tags: ${tagsArray.join(', ')}` : 'Add Tags'}<Tooltip.Arrow
                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root><Popover.Portal><Popover.Content
                            className={tagsPopoverContentClasses} sideOffset={5} align="start"
                            onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                            <div
                                className={twMerge("flex items-center flex-wrap bg-transparent rounded-lg w-full min-h-[36px] px-2 py-1.5 backdrop-blur-sm border border-black/10 dark:border-white/10", isInteractiveDisabled ? "opacity-60 cursor-not-allowed" : "hover:border-black/20 dark:hover:border-white/20 focus-within:border-primary/50 dark:focus-within:border-primary/60 cursor-text")}
                                onClick={handleTagContainerClick}
                                aria-disabled={isInteractiveDisabled}>{tagsArray.map((tag) => (
                                <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)}
                                         disabled={isInteractiveDisabled}/>))}<input ref={tagInputElementRef}
                                                                                     type="text" value={tagInputValue}
                                                                                     onChange={(e) => setTagInputValue(e.target.value)}
                                                                                     onKeyDown={handleTagInputKeyDown}
                                                                                     onBlur={handleTagInputBlur}
                                                                                     placeholder={tagsArray.length === 0 ? "Add tag..." : ""}
                                                                                     className={twMerge("flex-1 text-xs border-none focus:ring-0 bg-transparent p-0 m-0 h-[22px] min-w-[60px] self-center placeholder:text-muted dark:placeholder:text-neutral-500 placeholder:font-normal disabled:bg-transparent disabled:cursor-not-allowed dark:text-neutral-300")}
                                                                                     disabled={isInteractiveDisabled}
                                                                                     aria-label="Add a new tag (use comma or Enter to confirm)"/>
                            </div>
                        </Popover.Content></Popover.Portal></Popover.Root></Tooltip.Provider>
                        <Tooltip.Provider><DropdownMenu.Root open={isProgressDropdownOpen} onOpenChange={(open) => {
                            setIsProgressDropdownOpen(open);
                            if (!open) setIsProgressTooltipOpen(false);
                        }}><Tooltip.Root delayDuration={300} open={isProgressTooltipOpen}
                                         onOpenChange={setIsProgressTooltipOpen}><Tooltip.Trigger
                            asChild><DropdownMenu.Trigger asChild disabled={isTrash}><Button variant="ghost" size="icon"
                                                                                             icon="circle-gauge"
                                                                                             className={twMerge(footerButtonClass, "w-8 h-8")}
                                                                                             aria-label={`Progress: ${progressStatusText}`}/></DropdownMenu.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                            className={tooltipContentClass} side="top"
                            sideOffset={6}>{`Progress: ${progressStatusText}`}<Tooltip.Arrow
                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root><DropdownMenu.Portal><DropdownMenu.Content
                            className={dropdownContentClasses} sideOffset={5} align="start"
                            onCloseAutoFocus={(e) => e.preventDefault()}>{progressMenuItems.map(item => (
                            <RadixMenuItem key={item.label} icon={item.icon}
                                           selected={selectedTask?.completionPercentage === item.value || (selectedTask?.completionPercentage === null && item.value === null)}
                                           onSelect={() => handleProgressChange(item.value)}>{item.label}</RadixMenuItem>))}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></Tooltip.Provider>
                    </div>

                    <div className="flex items-center">
                        <Tooltip.Provider><Popover.Root open={isInfoPopoverOpen} onOpenChange={(open) => {
                            setIsInfoPopoverOpen(open);
                            if (!open) setIsInfoTooltipOpen(false);
                        }}><Tooltip.Root delayDuration={300} open={isInfoTooltipOpen}
                                         onOpenChange={setIsInfoTooltipOpen}><Tooltip.Trigger asChild><Popover.Trigger
                            asChild><Button variant="ghost" size="icon" icon="info"
                                            className={twMerge(footerButtonClass, "w-8 h-8")}
                                            aria-label="View task information"/></Popover.Trigger></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content
                            className={tooltipContentClass} side="top" sideOffset={6}>Task Information<Tooltip.Arrow
                            className="fill-black/80 dark:fill-neutral-900/90"/></Tooltip.Content></Tooltip.Portal></Tooltip.Root><Popover.Portal><Popover.Content
                            className={twMerge(dropdownContentClasses, "p-3 text-xs w-auto")} side="top" align="end"
                            sideOffset={5} onCloseAutoFocus={(e) => e.preventDefault()}>
                            <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300"><p><strong
                                className="font-medium text-neutral-700 dark:text-neutral-200">Created:</strong> {displayCreatedAt}
                            </p><p><strong
                                className="font-medium text-neutral-700 dark:text-neutral-200">Updated:</strong> {displayUpdatedAt}
                            </p></div>
                        </Popover.Content></Popover.Portal></Popover.Root></Tooltip.Provider>
                    </div>
                </div>
            </div>
            <ConfirmDeleteModalRadix isOpen={isDeleteDialogOpen} onClose={closeDeleteConfirm} onConfirm={confirmDelete}
                                     taskTitle={selectedTask.title || 'Untitled Task'}/>
        </>
    );
};
TaskDetail.displayName = 'TaskDetail';
export default TaskDetail;