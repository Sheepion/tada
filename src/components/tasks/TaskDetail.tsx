// src/components/tasks/TaskDetail.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai'; // Added useAtom
import {selectedTaskAtom, selectedTaskIdAtom, tasksAtom, userListNamesAtom,} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {formatDateTime, formatRelativeDate, isOverdue, isValid, safeParseDate, startOfDay} from '@/utils/dateUtils';
import {Task} from '@/types';
import {AnimatePresence, motion} from 'framer-motion'; // Keep for Dropdown animation, removed from TaskDetail root
import {usePopper} from 'react-popper';
import {twMerge} from 'tailwind-merge';
import CustomDatePickerPopover from '../common/CustomDatePickerPopover';
import {IconName} from "@/components/common/IconMap"; // Corrected path

// --- Custom Hook for Click Away (Keep as is) ---
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref.current;
            // Ignore clicks inside the element, or inside specific popover classes
            if (!el || el.contains(event.target as Node) || (event.target as Element).closest('.rdp, .date-picker-popover')) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}


// --- Reusable Dropdown Component (Memoized) ---
interface DropdownRenderProps {
    close: () => void;
}

interface DropdownProps {
    trigger: React.ReactElement; // Expect a single element as the trigger
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode);
    contentClassName?: string;
    placement?: import('@popperjs/core').Placement;
    wrapperClassName?: string; // Optional class for the wrapper div
}

const Dropdown: React.FC<DropdownProps> = memo(({
                                                    trigger,
                                                    children,
                                                    contentClassName,
                                                    placement = 'bottom-start',
                                                    wrapperClassName // Added wrapperClassName prop
                                                }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Ref for the *wrapper* element which Popper will be anchored to
    const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the entire dropdown structure for click-away

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        placement: placement,
        modifiers: [{ name: 'offset', options: { offset: [0, 6] } }],
    });

    const close = useCallback(() => setIsOpen(false), []);
    useClickAway(dropdownRef, close); // Attach click-away listener

    const handleTriggerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
        // We don't need to call trigger.props.onClick here,
        // as the primary action of the trigger *in this context* is to open the dropdown.
        // If the original trigger had its own essential onClick, that pattern would need rethinking.
    }, []);

    return (
        // Use the outer dropdownRef for click-away detection
        <div ref={dropdownRef} className={twMerge("relative inline-block w-full", wrapperClassName)}>
            {/* Wrapper DIV: Attach ref and onClick handler here */}
            <div
                ref={setReferenceElement} // Popper reference attaches here
                onClick={handleTriggerClick} // Open/close logic attaches here
                className="w-full" // Make wrapper take full width of its container
                role="button" // Indicate it's clickable
                aria-haspopup="true"
                aria-expanded={isOpen}
                tabIndex={0} // Make wrapper focusable if needed
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTriggerClick(e as any); }} // Basic keyboard interaction
            >
                {/* Render the original trigger element unmodified inside */}
                {trigger}
            </div>
            {/* Popper Content */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={setPopperElement}
                        style={styles.popper} {...attributes.popper}
                        className={twMerge(
                            'z-30 min-w-[180px] overflow-hidden',
                            !contentClassName?.includes('date-picker-popover') && 'bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10',
                            contentClassName
                        )}
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.1 } }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    >
                        {typeof children === 'function' ? children({ close }) : children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
Dropdown.displayName = 'Dropdown';


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    const [selectedTask] = useAtom(selectedTaskAtom); // Read-only access is fine here
    const setTasks = useSetAtom(tasksAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const [localTitle, setLocalTitle] = useState('');
    const [localContent, setLocalContent] = useState('');
    const [localDueDate, setLocalDueDate] = useState<Date | undefined>(undefined);
    const [localTags, setLocalTags] = useState('');

    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef(false);
    const hasUnsavedChangesRef = useRef(false);


    // Effect to sync local state when selectedTask changes FROM THE ATOM
    useEffect(() => {
        if (selectedTask) {
            // Only update local state if it differs from the atom's value
            // This prevents overwriting user input while typing if the atom updates
            if (selectedTask.title !== localTitle) setLocalTitle(selectedTask.title);
            if ((selectedTask.content || '') !== localContent) setLocalContent(selectedTask.content || '');
            const taskDueDate = safeParseDate(selectedTask.dueDate);
            const currentLocalTime = localDueDate?.getTime();
            const taskDueTime = taskDueDate?.getTime();
            if (currentLocalTime !== taskDueTime) {
                setLocalDueDate(taskDueDate && isValid(taskDueDate) ? taskDueDate : undefined);
            }
            const taskTagsString = (selectedTask.tags ?? []).join(', ');
            if (taskTagsString !== localTags) setLocalTags(taskTagsString);

            // Auto-focus title only if it's truly empty (new task scenario)
            if (selectedTask.title === '' && !titleInputRef.current?.matches(':focus')) {
                const timer = setTimeout(() => {
                    titleInputRef.current?.focus();
                }, 50); // Shorter delay might work
                return () => clearTimeout(timer);
            }
            // Reset unsaved changes flag when task context changes
            hasUnsavedChangesRef.current = false;
        } else {
            // Reset local state if no task selected
            setLocalTitle('');
            setLocalContent('');
            setLocalDueDate(undefined);
            setLocalTags('');
            hasUnsavedChangesRef.current = false;
        }
        // Clean up pending save on task change
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        isSavingRef.current = false;

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTask]); // Re-run ONLY when the selectedTask object from the atom changes


    // Debounced save function
    const saveChanges = useCallback((updatedFields: Partial<Task> = {}) => {
        if (!selectedTask || isSavingRef.current) return;
        hasUnsavedChangesRef.current = true;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            if (!hasUnsavedChangesRef.current || !selectedTask) {
                isSavingRef.current = false; return;
            }
            isSavingRef.current = true;

            const finalUpdate: Partial<Task> = {
                title: (updatedFields.title !== undefined ? updatedFields.title : localTitle).trim() || "Untitled Task",
                content: updatedFields.content !== undefined ? updatedFields.content : localContent,
                dueDate: updatedFields.dueDate !== undefined ? updatedFields.dueDate : (localDueDate && isValid(localDueDate) ? localDueDate.getTime() : null),
                list: updatedFields.list !== undefined ? updatedFields.list : selectedTask.list,
                priority: updatedFields.priority !== undefined ? updatedFields.priority : selectedTask.priority,
                completed: updatedFields.completed !== undefined ? updatedFields.completed : selectedTask.completed,
                tags: updatedFields.tags !== undefined ? updatedFields.tags : localTags.split(',').map(t => t.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i),
                updatedAt: Date.now(),
            };

            // --- FIX: Corrected change detection and assignment ---
            const changesToSave: Partial<Task> = {}; // Explicitly type as Partial<Task>
            let hasEffectiveChanges = false;

            // Iterate over potential changes
            for (const key in finalUpdate) {
                const typedKey = key as keyof Task;

                // Special handling for tags array comparison
                if (typedKey === 'tags') {
                    const currentTags = (finalUpdate.tags ?? []).sort();
                    const originalTags = (selectedTask.tags ?? []).sort();
                    if (JSON.stringify(currentTags) !== JSON.stringify(originalTags)) {
                        changesToSave.tags = finalUpdate.tags; // Assign the array
                        hasEffectiveChanges = true;
                    }
                }
                // General comparison for other properties
                else if (finalUpdate[typedKey] !== selectedTask[typedKey]) {
                    // Now assign the correctly typed value
                    (changesToSave as any)[typedKey] = finalUpdate[typedKey];
                    hasEffectiveChanges = true;
                }
            }
            // --- End Fix ---

            if (!hasEffectiveChanges) {
                console.log("Save skipped: No effective changes detected.");
                isSavingRef.current = false;
                hasUnsavedChangesRef.current = false;
                return;
            }

            console.log("Saving changes for task:", selectedTask.id, changesToSave);
            setTasks((prevTasks) =>
                prevTasks.map((t) =>
                    t.id === selectedTask.id ? {...t, ...changesToSave} : t
                )
            );

            isSavingRef.current = false;
            hasUnsavedChangesRef.current = false;

        }, 400);

    }, [selectedTask, setTasks, localTitle, localContent, localDueDate, localTags]);


    // --- Event Handlers ---
    const handleClose = useCallback(() => {
        // Trigger immediate save if changes are pending before closing
        if (hasUnsavedChangesRef.current) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            isSavingRef.current = false; // Allow save function to run
            saveChanges(); // Call save immediately
        }
        setSelectedTaskId(null); // Clear selection
    }, [setSelectedTaskId, saveChanges]);

    // Update local state AND trigger debounced save
    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTitle(e.target.value);
        saveChanges();
    }, [saveChanges]);
    const handleContentChange = useCallback((newValue: string) => {
        setLocalContent(newValue);
        saveChanges();
    }, [saveChanges]);
    const handleTagInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTags(e.target.value);
        saveChanges();
    }, [saveChanges]);

    // Trigger save on blur if value changed from initial task state
    const handleTitleBlur = useCallback(() => {
        const trimmed = localTitle.trim();
        if (selectedTask && trimmed !== selectedTask.title) {
            saveChanges({ title: trimmed || "Untitled Task" });
        }
    }, [localTitle, selectedTask, saveChanges]);
    const handleContentBlur = useCallback(() => {
        if (selectedTask && localContent !== (selectedTask.content || '')) {
            saveChanges({ content: localContent });
        }
    }, [localContent, selectedTask, saveChanges]);
    const handleTagInputBlur = useCallback(() => {
        const newTags = localTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '').filter((v, i, a) => a.indexOf(v) === i);
        if (selectedTask && JSON.stringify(newTags.sort()) !== JSON.stringify((selectedTask.tags ?? []).sort())) {
            saveChanges({ tags: newTags });
        }
    }, [localTags, selectedTask, saveChanges]);

    // Keyboard handlers
    const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleInputRef.current?.blur(); // Blur on Enter
        } else if (e.key === 'Escape' && selectedTask) {
            setLocalTitle(selectedTask.title); // Revert to original on Escape
            titleInputRef.current?.blur();
        }
    }, [selectedTask]); // Add selectedTask dependency

    const handleTagInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape' && selectedTask) {
            setLocalTags((selectedTask.tags ?? []).join(', '));
            (e.target as HTMLInputElement).blur();
        }
    }, [selectedTask]); // Add selectedTask dependency

    // Direct actions (trigger save immediately)
    const handleDatePickerSelect = useCallback((date: Date | undefined) => {
        const newDate = date && isValid(date) ? startOfDay(date) : undefined; // Ensure start of day
        setLocalDueDate(newDate); // Update local state first
        saveChanges({dueDate: newDate ? newDate.getTime() : null}); // Save timestamp or null
    }, [saveChanges]);

    const handleListChange = useCallback((newList: string, closeDropdown?: () => void) => {
        saveChanges({list: newList});
        closeDropdown?.(); // Close dropdown if provided
    }, [saveChanges]);

    const handlePriorityChange = useCallback((newPriority: number | null, closeDropdown?: () => void) => {
        saveChanges({priority: newPriority});
        closeDropdown?.();
    }, [saveChanges]);

    const handleToggleComplete = useCallback(() => {
        if (!selectedTask || selectedTask.list === 'Trash') return;
        // Toggle completion state and save immediately
        saveChanges({completed: !selectedTask.completed});
        // Optionally close detail view when completing? Current UX keeps it open.
        // if (!selectedTask.completed) { setSelectedTaskId(null); }
    }, [selectedTask, saveChanges]);

    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        // Update task state: move to Trash, uncomplete, set timestamp
        setTasks(prevTasks => prevTasks.map(t => t.id === selectedTask.id ? {
            ...t,
            list: 'Trash', // Move to Trash list
            completed: false, // Ensure it's not completed
            updatedAt: Date.now() // Update timestamp
        } : t));
        setSelectedTaskId(null); // Close detail view
    }, [selectedTask, setTasks, setSelectedTaskId]);

    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        // Move back to Inbox (or original list if tracked?) - Simple restore to Inbox for now
        saveChanges({list: 'Inbox'});
        // Keep detail view open after restore? Yes, seems reasonable.
    }, [selectedTask, saveChanges]);

    // --- Memos for Display Logic ---
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({
        1: { label: 'High', iconColor: 'text-red-500' },
        2: { label: 'Medium', iconColor: 'text-orange-500' },
        3: { label: 'Low', iconColor: 'text-blue-500' },
        4: { label: 'Lowest', iconColor: 'text-gray-500' },
    }), []);

    // Derived states for rendering based on selectedTask
    const isTrash = selectedTask?.list === 'Trash';
    const isCompleted = selectedTask?.completed && !isTrash;
    const overdue = useMemo(() => localDueDate && !isCompleted && !isTrash && isOverdue(localDueDate), [localDueDate, isCompleted, isTrash]);

    // If no task is selected, render nothing.
    if (!selectedTask) return null;

    // Use selectedTask for read-only displays unless actively edited (which local state covers)
    const displayPriority = selectedTask.priority;
    const displayList = selectedTask.list;

    return (
        // Removed motion.div wrapper to prevent slide animation
        // Use direct styling for width and appearance
        <div
            className={twMerge(
                "border-l border-black/10 w-[420px] shrink-0 h-full flex flex-col shadow-xl z-20", // Fixed width and core styles
                "bg-glass-100 backdrop-blur-xl" // Background
            )}
        >
            {/* Header */}
            <div
                className="px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 bg-glass-alt-100 backdrop-blur-lg">
                <div className="w-20 flex justify-start">
                    {isTrash ? (
                        <Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore}
                                className="text-green-600 hover:bg-green-400/20 hover:text-green-700 text-xs px-1.5"> Restore </Button>
                    ) : (
                        <Button variant="ghost" size="icon" icon="trash" onClick={handleDelete}
                                className="text-red-600 hover:bg-red-400/20 hover:text-red-700 w-7 h-7"
                                aria-label="Move task to Trash"/>
                    )}
                </div>
                {/* Saving Indicator Placeholder */}
                <div className="flex-1 text-center h-4">
                    {/* Removed animated saving indicator */}
                </div>
                {/* Close Button */}
                <div className="w-20 flex justify-end">
                    <Button variant="ghost" size="icon" icon="x" onClick={handleClose} aria-label="Close task details"
                            className="text-muted-foreground hover:bg-black/15 w-7 h-7"/>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 styled-scrollbar flex flex-col">
                {/* Checkbox and Title */}
                <div className="flex items-start space-x-3 mb-4 flex-shrink-0">
                    {/* Custom Checkbox */}
                    <button
                        onClick={handleToggleComplete}
                        className={twMerge(
                            "mt-[5px] flex-shrink-0 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors duration-30 ease-apple appearance-none", // Base + transition
                            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-glass-100", // Focus state
                            isCompleted ? 'bg-gray-400 border-gray-400 hover:bg-gray-500' : 'bg-white/40 border-gray-400 hover:border-primary/80 backdrop-blur-sm', // Incomplete/Completed states
                            // Checkmark SVG or pseudo-element styling
                            'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-[60%]', // Position checkmark
                            'after:h-[10px] after:w-[5px] after:rotate-45 after:border-b-[2.5px] after:border-r-[2.5px] after:border-solid after:border-transparent after:transition-opacity after:duration-100', // Checkmark style
                            isCompleted ? 'after:border-white after:opacity-100' : 'after:opacity-0', // Show/hide checkmark
                            isTrash && 'cursor-not-allowed opacity-50 !border-gray-300 hover:!border-gray-300 !bg-gray-200/50 after:!border-gray-400' // Disabled state for trash
                        )}
                        aria-pressed={isCompleted}
                        disabled={isTrash}
                        aria-label={isCompleted ? 'Mark task as incomplete' : 'Mark task as complete'}
                    />
                    {/* Title Input */}
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={localTitle} // Controlled input using local state
                        onChange={handleTitleChange}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className={twMerge(
                            "w-full text-lg font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 m-0 leading-tight", // Base styling
                            "placeholder:text-muted placeholder:font-normal", // Placeholder style
                            (isCompleted || isTrash) && "line-through text-muted-foreground", // Style for completed/trash
                            "task-detail-title-input" // Class for potential focus targeting
                        )}
                        placeholder="Task title..."
                        disabled={isTrash}
                        aria-label="Task title"
                        id={`task-title-input-${selectedTask.id}`} // Unique ID
                    />
                </div>

                {/* Metadata Section */}
                <div className="space-y-1.5 text-sm border-t border-b border-black/10 py-2.5 my-4 flex-shrink-0">
                    {/* Due Date Row */}
                    <MetaRow icon="calendar" label="Due Date" disabled={isTrash}>
                        <Dropdown
                            trigger={
                                <Button variant="ghost" size="sm"
                                        className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal truncate hover:bg-black/10 backdrop-blur-sm", localDueDate ? 'text-gray-700' : 'text-muted-foreground', overdue && 'text-red-600 font-medium', isTrash && 'text-muted line-through !bg-transparent')}
                                        disabled={isTrash}>
                                    {localDueDate ? formatRelativeDate(localDueDate) : 'Set date'}
                                </Button>
                            }
                            contentClassName="date-picker-popover p-0 border-0 shadow-none bg-transparent" // Special class to prevent default dropdown styles
                            placement="bottom-end"
                        >
                            {/* Render Date Picker Popover */}
                            {(props: DropdownRenderProps) => (
                                <CustomDatePickerPopover
                                    initialDate={localDueDate}
                                    onSelect={handleDatePickerSelect}
                                    close={props.close}
                                />
                            )}
                        </Dropdown>
                    </MetaRow>
                    {/* List Row */}
                    <MetaRow icon="list" label="List" disabled={isTrash}>
                        <Dropdown
                            trigger={
                                <Button variant="ghost" size="sm"
                                        className="text-xs h-7 px-1.5 w-full text-left justify-start text-gray-700 font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm"
                                        disabled={isTrash}>
                                    {displayList} {/* Use task's current list */}
                                </Button>
                            }
                            contentClassName="max-h-48 overflow-y-auto styled-scrollbar py-1" // Scrollable dropdown content
                        >
                            {(props: DropdownRenderProps) => (
                                <>
                                    {/* Render available lists (excluding Trash) */}
                                    {userLists.filter(l => l !== 'Trash').map(list => (
                                        <button
                                            key={list}
                                            onClick={() => handleListChange(list, props.close)}
                                            className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple focus:outline-none focus-visible:bg-black/10", displayList === list && "bg-primary/20 text-primary font-medium")}
                                            role="menuitem"
                                            aria-selected={displayList === list}
                                        >
                                            {list}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>
                    {/* Priority Row */}
                    <MetaRow icon="flag" label="Priority" disabled={isTrash}>
                        <Dropdown
                            trigger={
                                <Button variant="ghost" size="sm"
                                        className={twMerge("text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through truncate hover:bg-black/10 backdrop-blur-sm", displayPriority ? priorityMap[displayPriority]?.iconColor : 'text-gray-700')}
                                        icon={displayPriority ? 'flag' : undefined} // Show flag icon if priority set
                                        disabled={isTrash}>
                                    {displayPriority ? `P${displayPriority} ${priorityMap[displayPriority]?.label}` : 'Set Priority'}
                                </Button>
                            }
                            contentClassName="py-1" // Dropdown content padding
                        >
                            {(props: DropdownRenderProps) => (
                                <>
                                    {/* Render priority options */}
                                    {[1, 2, 3, 4, null].map(p => (
                                        <button
                                            key={p ?? 'none'}
                                            onClick={() => handlePriorityChange(p, props.close)}
                                            className={twMerge("block w-full text-left px-2.5 py-1 text-sm hover:bg-black/15 transition-colors duration-100 ease-apple flex items-center focus:outline-none focus-visible:bg-black/10", displayPriority === p && "bg-primary/20 text-primary font-medium", p && priorityMap[p]?.iconColor)}
                                            role="menuitemradio"
                                            aria-checked={displayPriority === p}
                                        >
                                            {p && <Icon name="flag" size={14} className="mr-1.5 flex-shrink-0"/>}
                                            {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>
                    {/* Tags Row */}
                    <MetaRow icon="tag" label="Tags" disabled={isTrash}>
                        <input
                            type="text"
                            value={localTags} // Controlled input using local state
                            onChange={handleTagInputChange}
                            onBlur={handleTagInputBlur}
                            onKeyDown={handleTagInputKeyDown}
                            placeholder="Add tags (comma-separated)"
                            className={twMerge(
                                "flex-1 text-xs h-7 px-1.5 border-none focus:ring-0 bg-transparent rounded-sm w-full", // Base styling
                                "hover:bg-white/15 focus:bg-white/20 backdrop-blur-sm transition-colors duration-30 ease-apple", // Interaction styles
                                "placeholder:text-muted placeholder:font-normal", // Placeholder
                                "disabled:bg-transparent disabled:hover:bg-transparent disabled:text-muted disabled:line-through disabled:placeholder:text-transparent" // Disabled state
                            )}
                            disabled={isTrash}
                            aria-label="Tags (comma-separated)"
                        />
                    </MetaRow>
                </div>
                {/* Content Editor */}
                <div className="task-detail-content-editor flex-1 min-h-[150px] flex flex-col mb-4">
                    <CodeMirrorEditor
                        ref={editorRef}
                        value={localContent} // Controlled input
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="Add notes, links, or details here... Markdown is supported."
                        className={twMerge(
                            "!min-h-[150px] h-full text-sm", // Sizing
                            (isCompleted || isTrash) && "opacity-70" // Dimmed style when completed/trash
                        )}
                        readOnly={isTrash} // Read-only when in trash
                    />
                </div>
            </div>
            {/* Footer */}
            <div
                className="px-4 py-2 border-t border-black/10 flex justify-end items-center flex-shrink-0 h-9 bg-glass-alt-200 backdrop-blur-lg">
                <div className="text-[11px] text-muted-foreground space-x-4">
                    {/* Display formatted timestamps */}
                    <span>Created: {formatDateTime(selectedTask.createdAt)}</span>
                    <span>Updated: {formatDateTime(selectedTask.updatedAt)}</span>
                </div>
            </div>
        </div>
    );
};

// --- Metadata Row Component (Memoized) ---
const MetaRow: React.FC<{
    icon: IconName;
    label: string;
    children: React.ReactNode,
    disabled?: boolean
}> = React.memo(({icon, label, children, disabled = false}) => (
    <div
        className={twMerge(
            "flex items-center justify-between group min-h-[34px] px-1 rounded", // Base layout
            // Apply interaction styles only if NOT disabled
            !disabled && "hover:bg-black/5 transition-colors duration-100 ease-apple",
            disabled && "opacity-60 pointer-events-none" // Disabled state
        )}>
        {/* Left Side: Icon + Label */}
        <span className="text-muted-foreground flex items-center text-xs font-medium w-24 flex-shrink-0">
            <Icon name={icon} size={14} className="mr-1.5 opacity-70"/>{label}
        </span>
        {/* Right Side: Content (Dropdown Trigger / Input) */}
        <div className="flex-1 text-right min-w-0">
            {children}
        </div>
    </div>
));
MetaRow.displayName = 'MetaRow';

export default TaskDetail;