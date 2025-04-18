// src/components/tasks/TaskDetail.tsx
// src/components/tasks/TaskDetail.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
    selectedTaskAtom,
    tasksAtom,
    selectedTaskIdAtom,
    userListNamesAtom,
} from '@/store/atoms';
import Icon from '../common/Icon';
import Button from '../common/Button';
import CodeMirrorEditor, { CodeMirrorEditorRef } from '../common/CodeMirrorEditor';
import { formatDateTime, formatRelativeDate, isOverdue, safeParseDate } from '@/utils/dateUtils';
import { Task } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
// Import react-day-picker
import { DayPicker, SelectSingleEventHandler } from 'react-day-picker'; // Added ActiveModifiers
// Default styles imported in main.tsx
import { twMerge } from 'tailwind-merge';
import { usePopper } from 'react-popper';
import { IconName } from "@/components/common/IconMap.tsx";


// --- Custom Hook for Click Away ---
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            const el = ref.current;
            // Do nothing if clicking ref's element or descendent elements
            if (!el || el.contains(event.target as Node)) {
                return;
            }
            handler(event); // Call the handler otherwise
        };

        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);

        // Cleanup function
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]); // Re-run if ref or handler changes
}

// --- Reusable Dropdown Component ---
interface DropdownRenderProps {
    close: () => void;
}
interface DropdownProps {
    trigger: React.ReactElement;
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode);
    contentClassName?: string;
    placement?: import('@popperjs/core').Placement; // Allow custom placement
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children, contentClassName, placement = 'bottom-start' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [referenceElement, setReferenceElement] = useState<HTMLButtonElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // Ref encompassing trigger and popper

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
        placement: placement,
        modifiers: [{ name: 'offset', options: { offset: [0, 6] } }], // Standard offset
    });

    const close = useCallback(() => setIsOpen(false), []);

    // Use the custom click away hook
    useClickAway(dropdownRef, close);

    // Clone the trigger to attach ref and toggle handler
    const TriggerElement = React.cloneElement(trigger, {
        ref: setReferenceElement,
        onClick: (e: React.MouseEvent<HTMLButtonElement>) => { // Specified type
            e.stopPropagation(); // Prevent immediate close from click away
            setIsOpen(prev => !prev);
            trigger.props.onClick?.(e); // Call original onClick if exists
        },
        'aria-haspopup': 'true', // Indicate it controls a popup
        'aria-expanded': isOpen,
    });

    return (
        <div ref={dropdownRef} className="relative inline-block w-full"> {/* Ensure div takes width */}
            {TriggerElement}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={setPopperElement}
                        style={styles.popper}
                        {...attributes.popper}
                        className={twMerge(
                            // Base dropdown styles (removed explicit bg/blur here)
                            'z-30 min-w-[180px] overflow-hidden',
                            // Default glass effect applied here, can be overridden by contentClassName
                            'bg-glass-100 backdrop-blur-md rounded-lg shadow-strong border border-black/10',
                            contentClassName // Allow override (e.g., for DayPicker specific padding/bg)
                        )}
                        initial={{ opacity: 0, scale: 0.95, y: -4 }} // Subtle entry
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.1 } }} // Subtle exit
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        // Prevent clicks inside the dropdown from closing it via click away
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()} // Specified type
                    >
                        {/* Render children, passing close function if it's a render prop */}
                        {typeof children === 'function' ? children({ close }) : children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Metadata Row Component
const MetaRow: React.FC<{ icon: IconName; label: string; children: React.ReactNode, disabled?: boolean }> = ({ icon, label, children, disabled=false }) => (
    <div className={twMerge("flex items-center justify-between group min-h-[34px] px-1", disabled && "opacity-60 pointer-events-none")}> {/* Slightly increased height */}
        <span className="text-muted-foreground flex items-center text-xs font-medium w-20 flex-shrink-0">
            <Icon name={icon} size={14} className="mr-1.5 opacity-70"/>{label}
        </span>
        <div className="flex-1 text-right min-w-0"> {/* Added min-w-0 */}
            {children}
        </div>
    </div>
);


// --- TaskDetail Component ---
const TaskDetail: React.FC = () => {
    // Global state
    const selectedTask = useAtomValue(selectedTaskAtom); // Read-only derived state
    const setTasks = useSetAtom(tasksAtom); // Setter only
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom); // Setter only
    const userLists = useAtomValue(userListNamesAtom); // Read-only list names

    // Local state for inline editing, synced with selectedTask
    const [editableTitle, setEditableTitle] = useState('');
    const [editableContent, setEditableContent] = useState('');
    const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined); // Use undefined for DayPicker
    const [tagInputValue, setTagInputValue] = useState('');

    // Refs
    const titleInputRef = useRef<HTMLInputElement>(null);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const isSavingRef = useRef(false); // Prevent rapid saves/race conditions
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for debounced save
    const hasUnsavedChanges = useRef(false); // Track if changes occurred since last save trigger

    // Effect to synchronize local state when the selected task changes
    useEffect(() => {
        // Clear any pending saves when task changes
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        isSavingRef.current = false;
        hasUnsavedChanges.current = false; // Reset unsaved changes flag

        if (selectedTask) {
            setEditableTitle(selectedTask.title);
            setEditableContent(selectedTask.content || '');
            const initialDate = safeParseDate(selectedTask.dueDate);
            setSelectedDueDate(initialDate ?? undefined); // Convert null to undefined for DayPicker
            setTagInputValue((selectedTask.tags ?? []).join(', ')); // Join tags for input

            // Focus title input when a *new* task is selected (title is empty)
            if (selectedTask.title === '') {
                const timer = setTimeout(() => {
                    titleInputRef.current?.focus();
                }, 120); // Slightly longer delay after animation potentially
                return () => clearTimeout(timer);
            }

        }
        // No need to clear state when selectedTask is null, component will unmount

    }, [selectedTask]); // Re-run ONLY when the selected task object itself changes

    // --- Debounced Save Function ---
    const saveChanges = useCallback((updatedFields: Partial<Omit<Task, 'groupCategory'>>) => { // Omit groupCategory as it's derived
        if (!selectedTask || isSavingRef.current) return; // Prevent save if no task or already in the process of saving

        // Flag that a change requiring a save has occurred
        hasUnsavedChanges.current = true;

        // Clear previous timeout if exists
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        // Debounce the actual save logic
        saveTimeoutRef.current = setTimeout(() => {
            // Re-check task existence and if changes were flagged within the timeout scope
            // Use a local copy of selectedTask from the outer scope for comparison
            const taskAtDebounceStart = selectedTask;
            if (!taskAtDebounceStart || !hasUnsavedChanges.current) {
                isSavingRef.current = false; // Ensure saving flag is reset if save is skipped
                return;
            }
            // console.log("Executing debounced save for task:", taskAtDebounceStart.id, updatedFields);
            isSavingRef.current = true; // Set saving flag for the actual update

            // Determine the final state based on current local edits + specific updates
            const currentTitle = editableTitle.trim() || "Untitled Task";
            const currentContent = editableContent;
            const currentTags = tagInputValue.split(',').map(t => t.trim()).filter(Boolean);
            const currentDueDateMs = selectedDueDate ? selectedDueDate.getTime() : null;

            const currentState = {
                ...taskAtDebounceStart, // Use task state from when debounce was triggered
                title: currentTitle,
                content: currentContent,
                tags: currentTags,
                dueDate: currentDueDateMs,
            };

            // Merge specific field updates (e.g., from priority/list change) passed via argument
            const mergedFields = { ...currentState, ...updatedFields };

            // --- Deep Equality Check (Optimized) ---
            let needsServerUpdate = false;
            if (mergedFields.title !== taskAtDebounceStart.title) needsServerUpdate = true;
            else if (mergedFields.content !== (taskAtDebounceStart.content || '')) needsServerUpdate = true;
            else if (mergedFields.completed !== taskAtDebounceStart.completed) needsServerUpdate = true;
            else if (mergedFields.list !== taskAtDebounceStart.list) needsServerUpdate = true;
            else if (mergedFields.priority !== taskAtDebounceStart.priority) needsServerUpdate = true;
            else if (mergedFields.dueDate !== taskAtDebounceStart.dueDate) needsServerUpdate = true;
            else if (JSON.stringify((mergedFields.tags ?? []).sort()) !== JSON.stringify((taskAtDebounceStart.tags ?? []).sort())) needsServerUpdate = true;
            // --- End Deep Equality Check ---

            if (!needsServerUpdate) {
                // console.log("No actual changes detected, skipping save update.");
                isSavingRef.current = false;
                hasUnsavedChanges.current = false; // Reset flag
                return; // Skip update if nothing actually changed
            }

            const finalUpdatedTask: Task = {
                ...taskAtDebounceStart, // Start with original task state at debounce trigger
                ...mergedFields, // Apply merged updates based on latest local state + specific updates
                updatedAt: Date.now(), // Always update timestamp
                // groupCategory will be updated automatically by the tasksAtom setter logic
            };

            // Update the tasks atom
            setTasks((prevTasks: Task[]) =>
                prevTasks.map((t: Task) => (t.id === taskAtDebounceStart.id ? finalUpdatedTask : t))
            );

            // Reset flags after save logic execution is complete
            isSavingRef.current = false;
            hasUnsavedChanges.current = false; // Reset unsaved changes flag

        }, 300); // 300ms debounce interval

    }, [selectedTask, setTasks, editableTitle, editableContent, selectedDueDate, tagInputValue]); // Dependencies for reading current values


    // --- Event Handlers ---

    // Close Task Detail pane
    const handleClose = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); // Clear pending debounce
        if (hasUnsavedChanges.current && selectedTask) { // Only save if changes were flagged & task still selected
            // Trigger save immediately based on current state, don't wait for debounce
            isSavingRef.current = false; // Allow immediate save
            saveChanges({}); // Trigger save logic based on current state
        }
        setSelectedTaskId(null); // Clear selected task ID
    }, [setSelectedTaskId, saveChanges, selectedTask]); // Added selectedTask dependency

    // Title Handlers
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableTitle(e.target.value);
        saveChanges({}); // Debounced save on change
    };
    const handleTitleBlur = () => {
        // Ensure final title trim is saved if different & debounce hasn't fired yet
        const trimmedTitle = editableTitle.trim();
        if (selectedTask && trimmedTitle !== selectedTask.title) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); // Clear pending debounce
            isSavingRef.current = false; // Allow immediate save
            saveChanges({ title: trimmedTitle }); // Trigger immediate save
        }
    };
    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleInputRef.current?.blur(); // Blur triggers potential final save
        } else if (e.key === 'Escape') {
            if (selectedTask) setEditableTitle(selectedTask.title); // Revert
            hasUnsavedChanges.current = false; // Discard changes flag
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); // Clear pending save
            titleInputRef.current?.blur(); // Blur to remove focus
        }
    };

    // Content Handlers
    const handleContentChange = useCallback((newValue: string) => {
        setEditableContent(newValue);
        saveChanges({}); // Debounced save on change
    }, [saveChanges]);

    const handleContentBlur = useCallback(() => {
        // Save on blur only if content truly changed and debounce might not have fired
        if (selectedTask && editableContent !== (selectedTask.content || '')) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            isSavingRef.current = false; // Allow immediate save
            saveChanges({ content: editableContent });
        }
    }, [saveChanges, selectedTask, editableContent]);


    // Day Picker Handler - This function has the correct signature now
    const handleDayPickerSelect: SelectSingleEventHandler = (
        day: Date | undefined, // The selected day or undefined if deselected/disabled
        // selectedDay: Date, // The day element clicked
        // activeModifiers: ActiveModifiers, // Modifiers active for selectedDay
        // e: React.MouseEvent | React.KeyboardEvent // The event
    ) => {
        // We only need the first argument 'day'
        setSelectedDueDate(day); // Update local state immediately (Date or undefined)
        saveChanges({ dueDate: day ? day.getTime() : null }); // Trigger save (timestamp or null)
    };

    // List Change Handler (from Dropdown)
    const handleListChange = (newList: string, closeDropdown?: () => void) => {
        saveChanges({ list: newList });
        closeDropdown?.(); // Close the dropdown after selection
    };

    // Priority Change Handler (from Dropdown)
    const handlePriorityChange = (newPriority: number | null, closeDropdown?: () => void) => {
        saveChanges({ priority: newPriority });
        closeDropdown?.(); // Close the dropdown
    };

    // Tag Input Handlers
    const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTagInputValue(e.target.value);
        saveChanges({}); // Debounced save
    };
    const handleTagInputBlur = () => {
        const newTags = tagInputValue.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag !== ''); // Remove empty tags
        const uniqueTags = Array.from(new Set(newTags)); // Ensure uniqueness
        // Trigger save only if the sorted tags array actually changed
        if (selectedTask && JSON.stringify(uniqueTags.sort()) !== JSON.stringify((selectedTask.tags ?? []).sort())) {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            isSavingRef.current = false; // Allow immediate save
            saveChanges({ tags: uniqueTags });
        }
    };
    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur(); // Blur triggers potential final save
        } else if (e.key === 'Escape') {
            if (selectedTask) setTagInputValue((selectedTask.tags ?? []).join(', ')); // Revert
            hasUnsavedChanges.current = false; // Discard changes flag
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); // Clear pending save
            (e.target as HTMLInputElement).blur(); // Blur
        }
    };

    // Delete/Trash Handler
    const handleDelete = useCallback(() => {
        if (!selectedTask) return;
        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) =>
                t.id === selectedTask.id
                    ? { ...t, list: 'Trash', completed: false, updatedAt: Date.now() } // Move to Trash, mark incomplete
                    : t
            )
        );
        setSelectedTaskId(null); // Deselect after moving to trash
    }, [selectedTask, setTasks, setSelectedTaskId]);

    // Restore Handler
    const handleRestore = useCallback(() => {
        if (!selectedTask || selectedTask.list !== 'Trash') return;
        setTasks((prevTasks: Task[]) =>
            prevTasks.map((t: Task) =>
                t.id === selectedTask.id
                    ? { ...t, list: 'Inbox', updatedAt: Date.now() } // Restore to Inbox
                    : t
            )
        );
        // Keep task selected after restore to view it in its new list
    }, [selectedTask, setTasks]);


    // Toggle Complete Handler
    const handleToggleComplete = () => {
        if (!selectedTask || selectedTask.list === 'Trash') return; // Don't toggle in trash
        saveChanges({ completed: !selectedTask.completed });
    };

    // Priority mapping for display
    const priorityMap: Record<number, { label: string; iconColor: string }> = useMemo(() => ({
        1: { label: 'High', iconColor: 'text-red-500' },
        2: { label: 'Medium', iconColor: 'text-orange-500' },
        3: { label: 'Low', iconColor: 'text-blue-500' },
        4: { label: 'Lowest', iconColor: 'text-gray-500' },
    }), []);


    // --- Render Logic ---

    // Placeholder when no task is selected (handled by MainPage's AnimatePresence)
    if (!selectedTask) {
        return null; // Render nothing if no task selected
    }

    // Main Task Detail View
    return (
        // Removed key prop here, let MainPage handle presence animation
        <motion.div
            className="border-l border-border-color/60 w-[380px] shrink-0 bg-glass backdrop-blur-lg h-full flex flex-col shadow-lg z-10" // Apply glass effect
            // Animation for slide-in/out (handled by AnimatePresence in MainPage)
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} // Faster, standard ease for slide
        >
            {/* Header: Stronger Glass Effect */}
            <div className="px-3 py-2 border-b border-black/10 flex justify-between items-center flex-shrink-0 h-11 bg-glass-200 backdrop-blur-md"> {/* Glass header */}
                <span className="text-xs text-muted-foreground truncate pr-4 font-medium">
                     {/* Show List / Title context */}
                    {selectedTask.list !== 'Inbox' && selectedTask.list !== 'Trash' ? `${selectedTask.list} / ` : ''}
                    {selectedTask.list === 'Trash' ? 'Trash / ' : ''}
                    <span className="text-gray-700">{selectedTask.title || 'Untitled Task'}</span>
                 </span>
                {/* Close Button - Use Icon Button */}
                <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close task details" className="text-muted-foreground hover:bg-black/10 w-7 h-7 -mr-1">
                    <Icon name="x" size={16} />
                </Button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 styled-scrollbar space-y-4">

                {/* Title Input Row with Checkbox */}
                <div className="flex items-start space-x-2.5">
                    {/* Checkbox */}
                    <button
                        onClick={handleToggleComplete}
                        className={twMerge(
                            "mt-[3px] flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ease-in-out appearance-none", // appearance-none
                            "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                            // Custom checkbox style
                            selectedTask.completed
                                ? 'bg-gray-300 border-gray-300 hover:bg-gray-400' // Completed style
                                : 'bg-canvas border-gray-400 hover:border-primary/80', // Incomplete style
                            // Checkmark SVG for completed state
                            'relative after:content-[""] after:absolute after:left-1/2 after:top-1/2 after:-translate-x-1/2 after:-translate-y-1/2',
                            'after:h-2 after:w-1 after:rotate-45 after:border-b-2 after:border-r-2 after:border-solid after:border-transparent after:transition-opacity after:duration-100',
                            selectedTask.completed ? 'after:border-white after:opacity-100' : 'after:opacity-0',
                            // Disabled style
                            selectedTask.list === 'Trash' && 'cursor-not-allowed opacity-50 !border-gray-300 hover:!border-gray-300 !bg-gray-200 after:!border-gray-400'
                        )}
                        aria-pressed={selectedTask.completed}
                        disabled={selectedTask.list === 'Trash'}
                        aria-label={selectedTask.completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                    />

                    {/* Title Input */}
                    <input
                        ref={titleInputRef}
                        type="text"
                        value={editableTitle}
                        onChange={handleTitleChange}
                        onBlur={handleTitleBlur}
                        onKeyDown={handleTitleKeyDown}
                        className={twMerge(
                            "w-full text-base font-medium border-none focus:ring-0 focus:outline-none bg-transparent p-0 m-0 leading-tight", // Reset input styles
                            "placeholder:text-muted placeholder:font-normal",
                            selectedTask.completed && "line-through text-muted-foreground",
                            selectedTask.list === 'Trash' && "text-muted-foreground line-through", // Style title in trash
                            "task-detail-title-input" // Class for focusing
                        )}
                        placeholder="Task title..."
                        disabled={selectedTask.list === 'Trash'}
                        aria-label="Task title"
                    />
                </div>

                {/* Metadata Section - Refined layout */}
                <div className="space-y-1 text-sm border-t border-b border-border-color/60 py-2 my-3">

                    {/* Due Date with react-day-picker */}
                    <MetaRow icon="calendar" label="Due Date" disabled={selectedTask.list === 'Trash'}>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={twMerge(
                                        "text-xs h-7 px-1.5 w-full text-left justify-start font-normal truncate", // Base style, allow truncation
                                        selectedDueDate ? 'text-gray-700' : 'text-muted-foreground', // Color based on selection
                                        selectedDueDate && isOverdue(selectedDueDate) && !selectedTask.completed && 'text-red-600 font-medium', // Overdue style
                                        selectedTask.list === 'Trash' && 'text-muted line-through' // Trash style
                                    )}
                                    disabled={selectedTask.list === 'Trash'}
                                >
                                    {selectedDueDate ? formatRelativeDate(selectedDueDate) : 'Set date'}
                                </Button>
                            }
                            // Apply DayPicker specific styles and glass effect to the dropdown content
                            contentClassName="day-picker-dropdown w-auto" // Use specific class, auto width
                            placement="bottom-end"
                        >
                            {({ close }) => ( // Use render prop to get close function
                                <DayPicker
                                    mode="single"
                                    selected={selectedDueDate}
                                    // CORRECTED: Pass handleDayPickerSelect directly OR use inline func with correct signature
                                    // Option 1: Pass directly (cleaner if no extra logic like close() needed inside)
                                    // onSelect={handleDayPickerSelect}
                                    // Option 2: Use inline func with correct signature AND call close()
                                    onSelect={(day, selectedDay, activeModifiers, e) => {
                                        handleDayPickerSelect(day, selectedDay, activeModifiers, e);
                                        close(); // Close dropdown on select
                                    }}
                                    modifiersClassNames={{
                                        today: 'rdp-day_today',
                                        selected: 'rdp-day_selected',
                                        outside: 'rdp-day_outside',
                                        disabled: 'rdp-day_disabled',
                                    }}
                                    showOutsideDays
                                    fixedWeeks // Keep grid consistent
                                    footer={
                                        <div className="flex justify-between items-center pt-1 border-t border-black/5 mt-1">
                                            <Button
                                                variant="link"
                                                size="sm"
                                                // Use inline function for 'Today' to correctly call handler and close
                                                onClick={() => {
                                                    const today = new Date();
                                                    // Manually call handler with today's date
                                                    handleDayPickerSelect(today, today, {}, {} as React.MouseEvent); // Provide dummy args
                                                    close();
                                                }}
                                                className="text-xs"
                                            >
                                                Today
                                            </Button>
                                            <Button
                                                variant="link"
                                                size="sm"
                                                // Use inline function for 'Clear' to correctly call handler and close
                                                onClick={() => {
                                                    // Manually call handler with undefined
                                                    handleDayPickerSelect(undefined, new Date(), {}, {} as React.MouseEvent); // Provide dummy args
                                                    close();
                                                }}
                                                disabled={!selectedDueDate}
                                                className="text-xs text-muted-foreground hover:text-red-500"
                                            >
                                                Clear Date
                                            </Button>
                                        </div>
                                    }
                                />
                            )}
                        </Dropdown>
                    </MetaRow>

                    {/* List Selector */}
                    <MetaRow icon="list" label="List" disabled={selectedTask.list === 'Trash'}>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-1.5 w-full text-left justify-start text-gray-700 font-normal disabled:text-muted disabled:line-through truncate" // Added truncate
                                    disabled={selectedTask.list === 'Trash'}
                                    iconPosition="right"
                                >
                                    {selectedTask.list || 'Inbox'}
                                </Button>
                            }
                            contentClassName="max-h-48 overflow-y-auto styled-scrollbar py-1" // Scrollable content, padding
                        >
                            {({ close }) => (
                                <>
                                    {/* Use filter to exclude Trash from selectable lists */}
                                    {userLists.filter(l => l !== 'Trash').map(list => (
                                        <button
                                            key={list}
                                            onClick={() => handleListChange(list, close)}
                                            className={twMerge(
                                                "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/10", // Adjusted hover for glass
                                                selectedTask.list === list && "bg-primary/10 text-primary font-medium" // Highlight selected
                                            )}
                                            role="menuitem"
                                        >
                                            {list}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>

                    {/* Priority Selector */}
                    <MetaRow icon="flag" label="Priority" disabled={selectedTask.list === 'Trash'}>
                        <Dropdown
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={twMerge(
                                        "text-xs h-7 px-1.5 w-full text-left justify-start font-normal disabled:text-muted disabled:line-through truncate", // Added truncate
                                        selectedTask.priority ? priorityMap[selectedTask.priority]?.iconColor : 'text-gray-700' // Apply color based on priority
                                    )}
                                    icon={selectedTask.priority ? 'flag' : undefined} // Show flag icon if priority set
                                    iconPosition="left"
                                    disabled={selectedTask.list === 'Trash'}
                                >
                                    {selectedTask.priority ? `P${selectedTask.priority} ${priorityMap[selectedTask.priority]?.label}` : 'Set Priority'}
                                </Button>
                            }
                            contentClassName="py-1" // Add padding to dropdown content
                        >
                            {({ close }) => (
                                <>
                                    {[1, 2, 3, 4, null].map(p => ( // Include null for 'None'
                                        <button
                                            key={p ?? 'none'}
                                            onClick={() => handlePriorityChange(p, close)}
                                            className={twMerge(
                                                "block w-full text-left px-2.5 py-1 text-sm hover:bg-black/10 flex items-center", // Adjusted hover
                                                selectedTask.priority === p && "bg-primary/10 text-primary font-medium", // Highlight selected
                                                p && priorityMap[p]?.iconColor // Apply color to text/icon
                                            )}
                                            role="menuitem"
                                        >
                                            {p && <Icon name="flag" size={14} className="mr-1.5 flex-shrink-0" />}
                                            {p ? `P${p} ${priorityMap[p]?.label}` : 'None'}
                                        </button>
                                    ))}
                                </>
                            )}
                        </Dropdown>
                    </MetaRow>

                    {/* Tags Input */}
                    <MetaRow icon="tag" label="Tags" disabled={selectedTask.list === 'Trash'}>
                        {/* Use a standard input, styled like a ghost button when empty */}
                        <input
                            type="text"
                            value={tagInputValue}
                            onChange={handleTagInputChange}
                            onBlur={handleTagInputBlur}
                            onKeyDown={handleTagInputKeyDown}
                            placeholder="Add tags..."
                            className={twMerge(
                                "flex-1 text-xs h-7 px-1.5 border-none focus:ring-0 bg-transparent rounded-sm w-full", // Take full width
                                "hover:bg-gray-500/10 focus:bg-gray-500/10", // Subtle hover/focus background for glass
                                "placeholder:text-muted placeholder:font-normal",
                                "disabled:bg-transparent disabled:hover:bg-transparent disabled:text-muted disabled:line-through disabled:placeholder:text-transparent" // Disabled styles
                            )}
                            disabled={selectedTask.list === 'Trash'}
                            aria-label="Tags (comma-separated)"
                        />
                    </MetaRow>
                </div>

                {/* Content Editor - Use Glass Effect */}
                <div className="min-h-[150px] task-detail-content-editor flex-1 mb-4"> {/* Allow editor to grow */}
                    <CodeMirrorEditor
                        ref={editorRef}
                        value={editableContent}
                        onChange={handleContentChange}
                        onBlur={handleContentBlur}
                        placeholder="Add notes, links, or details here... Markdown is supported."
                        className={twMerge(
                            "min-h-[150px] h-full text-sm !border-0 focus-within:!ring-0 focus-within:!border-0 shadow-none", // Base styles
                            (selectedTask.list === 'Trash' || selectedTask.completed) && "opacity-70" // Dim if completed or trash
                        )}
                        readOnly={selectedTask.list === 'Trash'} // Readonly in trash
                        useGlassEffect // Enable glass styling for the editor container
                    />
                </div>

                {/* Timestamps - Subtle */}
                <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border-color/60 pt-3 mt-auto text-right flex-shrink-0">
                    <p>Created: {formatDateTime(selectedTask.createdAt)}</p>
                    <p>Updated: {formatDateTime(selectedTask.updatedAt)}</p>
                </div>
            </div>

            {/* Footer Actions - Glass Effect */}
            <div className="px-3 py-2 border-t border-black/10 flex justify-between items-center flex-shrink-0 h-10 bg-glass-alt-200 backdrop-blur-sm"> {/* Glass footer */}
                {/* Conditional Delete/Restore Button */}
                {selectedTask.list === 'Trash' ? (
                    <Button variant="ghost" size="sm" icon="arrow-left" onClick={handleRestore} className="text-green-600 hover:bg-green-400/20 hover:text-green-700 text-xs px-2">
                        Restore
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon" icon="trash" onClick={handleDelete} className="text-red-600 hover:bg-red-400/20 hover:text-red-700 w-7 h-7" aria-label="Move task to Trash" />
                )}

                {/* Saving Indicator (Optional) */}
                {/* Show subtle saving indicator (removed pulse) */}
                {(isSavingRef.current || (hasUnsavedChanges.current && !isSavingRef.current)) && ( // Corrected logic: show if saving OR if changes are pending but not yet saving
                    <span className="text-[10px] text-muted-foreground">Saving...</span>
                )}


                {/* Spacer to push delete/restore left */}
                <div className="flex-1"></div>

                {/* Other actions could go here */}

            </div>
        </motion.div>
    );
};

export default TaskDetail;