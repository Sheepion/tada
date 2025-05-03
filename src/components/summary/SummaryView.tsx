// src/components/summary/SummaryView.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import {
    currentDisplayedSummaryAtom,
    currentSummaryFilterKeyAtom,
    currentSummaryIndexAtom,
    filteredTasksForSummaryAtom,
    isGeneratingSummaryAtom,
    referencedTasksForSummaryAtom,
    relevantStoredSummariesAtom,
    storedSummariesAtom,
    StoredSummary,
    summaryListFilterAtom,
    summaryPeriodFilterAtom,
    SummaryPeriodOption,
    summarySelectedTaskIdsAtom,
    tasksAtom,
    userListNamesAtom
} from '@/store/atoms';
import Button from '../common/Button';
import Icon from '../common/Icon';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {Task} from '@/types';
import {
    format,
    formatDateTime,
    formatRelativeDate,
    isBefore,
    isSameDay,
    isValid,
    safeParseDate,
    startOfDay
} from '@/utils/dateUtils';
import {twMerge} from 'tailwind-merge';
import SelectionCheckboxRadix from '../common/SelectionCheckbox';
import useDebounce from '@/hooks/useDebounce';
import {CustomDateRangePickerContent} from '../common/CustomDateRangePickerPopover';
import SummaryHistoryModal from './SummaryHistoryModal';

// Placeholder AI Function (keep as is)
async function generateAiSummary(tasks: Task[]): Promise<string> {
    console.log("Generating AI summary for tasks:", tasks.map(t => t.title));
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

    if (tasks.length === 0) {
        return "No tasks selected or found for summary generation.";
    }

    const completedCount = tasks.filter(t => t.completed).length;
    const inProgressCount = tasks.length - completedCount;
    const lists = Array.from(new Set(tasks.map(t => t.list))).join(', ');

    let summary = `Generated summary for ${tasks.length} task(s) from list(s): ${lists}. \n`;
    summary += `- ${completedCount} completed, ${inProgressCount} in progress.\n`;

    if (inProgressCount > 0) {
        const highPriority = tasks.find(t => !t.completed && t.priority === 1);
        const overdue = tasks.find(t => !t.completed && t.dueDate && isBefore(startOfDay(safeParseDate(t.dueDate)!), startOfDay(new Date())));

        summary += "- Focus areas: ";
        if (highPriority) {
            summary += `High priority task **"${highPriority.title}"** needs attention. `;
        } else if (overdue) {
            summary += `Overdue task **"${overdue.title}"** requires action. `;
        } else {
            summary += `Continue progress on **"${tasks.find(t => !t.completed)?.title ?? 'current tasks'}"**. `;
        }
    } else {
        summary += "- All selected tasks are complete. Well done!";
    }

    summary += "\n\n*This is a simulated AI summary.*";
    return summary.trim();
}


// --- Main Summary View Component ---
const SummaryView: React.FC = () => {
    const [period, setPeriod] = useAtom(summaryPeriodFilterAtom);
    const [listFilter, setListFilter] = useAtom(summaryListFilterAtom);
    const availableLists = useAtomValue(userListNamesAtom);
    const filteredTasks = useAtomValue(filteredTasksForSummaryAtom);
    const [selectedTaskIds, setSelectedTaskIds] = useAtom(summarySelectedTaskIdsAtom);
    const relevantSummaries = useAtomValue(relevantStoredSummariesAtom);
    const allStoredSummaries = useAtomValue(storedSummariesAtom);
    const [currentIndex, setCurrentIndex] = useAtom(currentSummaryIndexAtom);
    const currentSummary = useAtomValue(currentDisplayedSummaryAtom);
    const setStoredSummaries = useSetAtom(storedSummariesAtom);
    const filterKey = useAtomValue(currentSummaryFilterKeyAtom);
    const [isGenerating, setIsGenerating] = useAtom(isGeneratingSummaryAtom);
    const referencedTasks = useAtomValue(referencedTasksForSummaryAtom);
    const allTasks = useAtomValue(tasksAtom);

    const [summaryEditorContent, setSummaryEditorContent] = useState('');
    const debouncedEditorContent = useDebounce(summaryEditorContent, 700);
    const editorRef = useRef<CodeMirrorEditorRef>(null);
    const hasUnsavedChangesRef = useRef(false);
    const isInternalEditorUpdate = useRef(false);

    // State for popovers and modals
    const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
    const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
    const [isRefTasksDropdownOpen, setIsRefTasksDropdownOpen] = useState(false);


    // --- Effects ---
    useEffect(() => {
        // Reset selections when filters change
        setSelectedTaskIds(new Set());
        setCurrentIndex(0); // Go back to the newest summary for the new filter
        hasUnsavedChangesRef.current = false; // Discard unsaved changes on filter change
    }, [period, listFilter, setCurrentIndex, setSelectedTaskIds]);

    useEffect(() => {
        // Load content when the current summary changes (due to index or filter change)
        const summaryToLoad = relevantSummaries[currentIndex];
        const summaryText = summaryToLoad?.summaryText ?? '';
        const currentEditorText = editorRef.current?.getView()?.state.doc.toString();

        if (summaryText !== currentEditorText) {
            isInternalEditorUpdate.current = true; // Mark as internal update
            setSummaryEditorContent(summaryText);
            hasUnsavedChangesRef.current = false; // Reset unsaved flag when loading new content
            // No need to focus editor here, let user interact naturally
        }
        // Make sure dropdowns close if summary changes
        setIsRefTasksDropdownOpen(false);
    }, [currentIndex, relevantSummaries]); // Depend only on index and the relevant summaries list

    useEffect(() => {
        // Debounced save for editor changes
        if (hasUnsavedChangesRef.current && currentSummary?.id) {
            const summaryIdToUpdate = currentSummary.id;
            // console.log(`Debounced save triggered for summary ${summaryIdToUpdate}`);
            setStoredSummaries(prev => prev.map(s => s.id === summaryIdToUpdate ? {
                ...s,
                summaryText: debouncedEditorContent,
                updatedAt: Date.now()
            } : s));
            hasUnsavedChangesRef.current = false; // Reset flag after saving
        }
    }, [debouncedEditorContent, currentSummary?.id, setStoredSummaries]);


    // --- Callbacks ---
    const forceSaveCurrentSummary = useCallback(() => {
        if (hasUnsavedChangesRef.current && currentSummary?.id) {
            const id = currentSummary.id;
            // console.log(`Force saving summary ${id}`);
            setStoredSummaries(p => p.map(s => s.id === id ? {
                ...s,
                summaryText: summaryEditorContent, // Use direct state, not debounced
                updatedAt: Date.now()
            } : s));
            hasUnsavedChangesRef.current = false; // Reset flag after saving
        }
    }, [currentSummary?.id, setStoredSummaries, summaryEditorContent]);

    // Combined handler for period dropdown changes
    const handlePeriodValueChange = useCallback((selectedValue: string) => {
        forceSaveCurrentSummary(); // Save before changing filter
        if (selectedValue === 'custom') {
            // Use setTimeout to ensure dropdown closes before popover opens
            setTimeout(() => {
                setIsRangePickerOpen(true);
            }, 0);
        } else {
            setPeriod(selectedValue as SummaryPeriodOption);
            setIsRangePickerOpen(false);
        }
    }, [setPeriod, setIsRangePickerOpen, forceSaveCurrentSummary]); // Added forceSave


    const handleListChange = useCallback((newList: string) => {
        forceSaveCurrentSummary(); // Save before changing filter
        setListFilter(newList);
    }, [setListFilter, forceSaveCurrentSummary]); // Added forceSave

    const handleTaskSelectionChange = useCallback((taskId: string, isSelected: boolean | 'indeterminate') => {
        if (isSelected === 'indeterminate') return; // Ignore clicks on indeterminate state itself
        setSelectedTaskIds(prev => {
            const newSet = new Set(prev);
            if (isSelected) newSet.add(taskId); else newSet.delete(taskId);
            return newSet;
        });
    }, [setSelectedTaskIds]);

    const handleSelectAllTasks = useCallback(() => {
        setSelectedTaskIds(new Set(filteredTasks.map(t => t.id)));
    }, [filteredTasks, setSelectedTaskIds]);

    const handleDeselectAllTasks = useCallback(() => {
        setSelectedTaskIds(new Set());
    }, [setSelectedTaskIds]);

    const handleGenerateClick = useCallback(async () => {
        forceSaveCurrentSummary(); // Save any pending edits before generating
        setIsGenerating(true);
        const tasksToSummarize = allTasks.filter(t => selectedTaskIds.has(t.id));
        try {
            const newSummaryText = await generateAiSummary(tasksToSummarize);
            const [periodKey, listKey] = filterKey.split('__');
            const newSummaryEntry: StoredSummary = {
                id: `summary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                createdAt: Date.now(),
                periodKey,
                listKey,
                taskIds: tasksToSummarize.map(t => t.id),
                summaryText: newSummaryText,
            };
            // Update stored summaries, putting the new one first
            setStoredSummaries(prev => [newSummaryEntry, ...prev]);
            // Set index to 0 to view the newly generated summary
            setCurrentIndex(0);
            // The useEffect listening to [currentIndex, relevantSummaries] will handle loading the editor
            // No need to set editor content directly here anymore
        } catch (error) {
            console.error("Error generating summary:", error);
            // Optionally, show an error message to the user
            // Maybe update editor content with error temporarily?
            isInternalEditorUpdate.current = true;
            setSummaryEditorContent(`Error generating summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
            hasUnsavedChangesRef.current = false;
        } finally {
            setIsGenerating(false);
        }
        // Deselect tasks after generation? Optional, based on desired UX.
        // handleDeselectAllTasks();
    }, [selectedTaskIds, allTasks, filterKey, setIsGenerating, setStoredSummaries, setCurrentIndex, forceSaveCurrentSummary]); // Added forceSave

    const handleEditorChange = useCallback((newValue: string) => {
        // Only update local state and mark unsaved if it's not an internal update
        if (!isInternalEditorUpdate.current) {
            setSummaryEditorContent(newValue);
            hasUnsavedChangesRef.current = true;
        }
        // Reset the internal update flag after the first change event
        isInternalEditorUpdate.current = false;
    }, []);

    const handlePrevSummary = useCallback(() => {
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.min(prev + 1, relevantSummaries.length - 1));
    }, [setCurrentIndex, relevantSummaries.length, forceSaveCurrentSummary]);

    const handleNextSummary = useCallback(() => {
        forceSaveCurrentSummary();
        setCurrentIndex(prev => Math.max(prev - 1, 0));
    }, [setCurrentIndex, forceSaveCurrentSummary]);

    // Callback for the Date Range Picker Popover Content
    const handleRangeApply = useCallback((startDate: Date, endDate: Date) => {
        forceSaveCurrentSummary(); // Save before applying range
        setPeriod({start: startDate.getTime(), end: endDate.getTime()});
        setIsRangePickerOpen(false); // Close the popover after applying
    }, [setPeriod, setIsRangePickerOpen, forceSaveCurrentSummary]); // Added forceSave

    const openHistoryModal = useCallback(() => {
        forceSaveCurrentSummary(); // Save before opening modal
        setIsHistoryModalOpen(true);
    }, [forceSaveCurrentSummary]);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);
    const closeRangePicker = useCallback(() => setIsRangePickerOpen(false), []);

    // --- Memoized Values ---
    const periodOptions = useMemo((): { label: string, value: SummaryPeriodOption | 'custom' }[] => [
        {label: 'Today', value: 'today'}, {label: 'Yesterday', value: 'yesterday'},
        {label: 'This Week', value: 'thisWeek'}, {label: 'Last Week', value: 'lastWeek'},
        {label: 'This Month', value: 'thisMonth'}, {label: 'Last Month', value: 'lastMonth'},
        {label: 'Custom Range...', value: 'custom'},
    ], []);

    const listOptions = useMemo(() => [
        {label: 'All Lists', value: 'all'},
        ...availableLists.map(listName => ({label: listName, value: listName}))
    ], [availableLists]);

    const selectedPeriodLabel = useMemo(() => {
        const option = periodOptions.find(p => typeof period === 'string' && p.value === period);
        if (option) return option.label;
        if (typeof period === 'object') {
            const startStr = format(period.start, 'MMM d');
            const endStr = format(period.end, 'MMM d');
            const startYear = format(period.start, 'yyyy');
            const endYear = format(period.end, 'yyyy');
            const currentYear = format(new Date(), 'yyyy');

            if (isSameDay(period.start, period.end)) {
                return startYear !== currentYear ? format(period.start, 'MMM d, yyyy') : startStr;
            }

            if (startYear !== endYear) {
                return `${format(period.start, 'MMM d, yyyy')} - ${format(period.end, 'MMM d, yyyy')}`;
            } else if (startYear !== currentYear) {
                return `${startStr} - ${endStr}, ${startYear}`;
            } else {
                return `${startStr} - ${endStr}`;
            }
        }
        return 'Select Period';
    }, [period, periodOptions]);

    const selectedListLabel = useMemo(() => {
        const option = listOptions.find(l => l.value === listFilter);
        return option ? option.label : 'Unknown List';
    }, [listFilter, listOptions]);

    const isGenerateDisabled = useMemo(() => isGenerating || selectedTaskIds.size === 0, [isGenerating, selectedTaskIds]);
    const tasksUsedCount = useMemo(() => currentSummary?.taskIds.length ?? 0, [currentSummary]);
    const summaryTimestamp = useMemo(() => currentSummary ? formatDateTime(currentSummary.createdAt) : null, [currentSummary]);
    const allTasksSelected = useMemo(() => filteredTasks.length > 0 && filteredTasks.every(task => selectedTaskIds.has(task.id)), [filteredTasks, selectedTaskIds]);
    const someTasksSelected = useMemo(() => selectedTaskIds.size > 0 && !allTasksSelected, [selectedTaskIds, allTasksSelected]);
    const totalRelevantSummaries = useMemo(() => relevantSummaries.length, [relevantSummaries]);
    const displayedIndex = useMemo(() => totalRelevantSummaries > 0 ? (currentIndex + 1) : 0, [totalRelevantSummaries, currentIndex]);

    const selectAllState = useMemo(() => {
        if (allTasksSelected) return true;
        if (someTasksSelected) return 'indeterminate';
        return false;
    }, [allTasksSelected, someTasksSelected]);

    const dropdownContentClasses = "min-w-[160px] z-50 bg-glass-100 dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-1 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";

    // --- Render Functions ---
    const renderReferencedTasksDropdown = () => (
        <div
            className="bg-glass-100/95 dark:bg-neutral-800/90 backdrop-blur-xl rounded-lg shadow-xl border border-black/10 dark:border-white/10 max-h-72 w-80 styled-scrollbar overflow-y-auto p-1.5">
            <div
                className="px-1.5 py-1 text-xs font-semibold text-muted-foreground dark:text-neutral-400 border-b border-black/10 dark:border-white/10 sticky top-0 bg-glass-100/80 dark:bg-neutral-800/80 backdrop-blur-md z-10">
                Referenced Tasks ({referencedTasks.length})
            </div>
            {referencedTasks.length > 0 ? (
                <ul className="pt-1 space-y-0.5">
                    {referencedTasks.map(task => (
                        <li key={task.id}
                            className="flex items-start p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-100 ease-apple"
                            title={task.title}>
                            <div className={twMerge(
                                "flex-shrink-0 w-4 h-4 rounded-full border mt-[1px] mr-2.5 flex items-center justify-center",
                                task.completed
                                    ? "bg-primary/90 border-primary/90"
                                    : task.completionPercentage && task.completionPercentage > 0
                                        ? "border-primary/70 dark:border-primary/60"
                                        : "bg-white/40 dark:bg-neutral-700/30 border-gray-400/80 dark:border-neutral-500"
                            )}>
                                {task.completed && <Icon name="check" size={9} className="text-white" strokeWidth={3}/>}
                                {task.completionPercentage && task.completionPercentage > 0 && !task.completed && (
                                    <div className="w-1.5 h-1.5 bg-primary/80 dark:bg-primary/70 rounded-full"></div>
                                )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className={twMerge(
                                    "text-[12.5px] font-medium text-gray-800 dark:text-neutral-100 leading-snug truncate",
                                    task.completed && "line-through text-muted-foreground dark:text-neutral-500"
                                )}>
                                    {task.title || "Untitled"}
                                </p>
                                <div
                                    className="flex items-center space-x-2 mt-0.5 text-[10.5px] text-muted-foreground dark:text-neutral-400">
                                    {task.completionPercentage && !task.completed && (
                                        <span
                                            className="font-medium text-primary/90 dark:text-primary-light/80">[{task.completionPercentage}%]</span>
                                    )}
                                    {task.dueDate && isValid(safeParseDate(task.dueDate)) && (
                                        <span className="flex items-center whitespace-nowrap">
                                            <Icon name="calendar" size={10} className="mr-0.5 opacity-60"/>
                                            {formatRelativeDate(task.dueDate)}
                                        </span>
                                    )}
                                    {task.list && task.list !== 'Inbox' && (
                                        <span
                                            className="flex items-center bg-black/10 dark:bg-white/10 px-1 py-0 rounded-[3px] max-w-[70px] truncate"
                                            title={task.list}>
                                            <Icon name={task.list === 'Trash' ? 'trash' : 'list'} size={9}
                                                  className="mr-0.5 opacity-60 flex-shrink-0"/>
                                            <span className="truncate">{task.list}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground dark:text-neutral-500 italic p-4 text-center">No referenced
                    tasks found.</p>
            )}
        </div>
    );


    // --- Task Item Mini Component (Inline) ---
    const TaskItemMiniInline: React.FC<{
        task: Task;
        isSelected: boolean;
        onSelectionChange: (id: string, selected: boolean | 'indeterminate') => void;
    }> = React.memo(({task, isSelected, onSelectionChange}) => {
        const parsedDueDate = useMemo(() => safeParseDate(task.dueDate), [task.dueDate]);
        const overdue = useMemo(() => parsedDueDate != null && isValid(parsedDueDate) && isBefore(startOfDay(parsedDueDate), startOfDay(new Date())) && !task.completed, [parsedDueDate, task.completed]);
        const uniqueId = `summary-task-${task.id}`;
        const isDisabled = task.list === 'Trash';

        return (
            <div className={twMerge(
                "flex items-center p-1.5 rounded-md transition-colors duration-150 ease-apple",
                isSelected && !isDisabled ? "bg-primary/15 dark:bg-primary/25" : "hover:bg-black/10 dark:hover:bg-white/5",
                isDisabled && "opacity-60 cursor-not-allowed"
            )}>
                <SelectionCheckboxRadix
                    id={uniqueId}
                    checked={isSelected}
                    onChange={(checkedState) => onSelectionChange(task.id, checkedState)}
                    aria-label={`Select task: ${task.title || 'Untitled'}`}
                    className="mr-2.5 flex-shrink-0"
                    size={16}
                    disabled={isDisabled}
                />
                <div className="flex-1 overflow-hidden">
                    <span className={twMerge(
                        "text-sm text-gray-800 dark:text-neutral-100 block truncate",
                        task.completed && !isDisabled && "line-through text-muted-foreground dark:text-neutral-500",
                        isDisabled && "text-muted-foreground dark:text-neutral-500"
                    )}>
                        {task.title || <span className="italic">Untitled Task</span>}
                    </span>
                    <div
                        className="text-xs text-muted-foreground dark:text-neutral-400 flex items-center space-x-2 mt-0.5 flex-wrap gap-y-0.5">
                        {task.completionPercentage && task.completionPercentage < 100 && !isDisabled && (
                            <span
                                className="text-primary/90 dark:text-primary-light/80 font-medium">[{task.completionPercentage}%]</span>
                        )}
                        {parsedDueDate && isValid(parsedDueDate) && (
                            <span className={twMerge(
                                "flex items-center whitespace-nowrap",
                                overdue && !task.completed && !isDisabled && "text-red-600 dark:text-red-400 font-medium",
                                task.completed && !isDisabled && "line-through"
                            )}>
                                <Icon name="calendar" size={11} className="mr-0.5 opacity-70"/>
                                {formatRelativeDate(parsedDueDate)}
                            </span>
                        )}
                        {task.list && task.list !== 'Inbox' && (
                            <span
                                className="flex items-center bg-black/10 dark:bg-white/10 px-1 rounded text-[10px] max-w-[70px] truncate"
                                title={task.list}>
                                <Icon name={task.list === 'Trash' ? 'trash' : 'list'} size={10}
                                      className="mr-0.5 opacity-70"/>
                                <span className="truncate">{task.list}</span>
                            </span>
                        )}
                        {task.tags && task.tags.length > 0 && (
                            <span className="flex items-center space-x-1">
                                {task.tags.slice(0, 1).map(tag => (
                                    <span key={tag}
                                          className="bg-black/10 dark:bg-white/10 px-1 rounded text-[10px] max-w-[60px] truncate">#{tag}</span>
                                ))}
                                {task.tags.length > 1 && <span
                                    className="text-[10px] text-muted-foreground/80 dark:text-neutral-500">+{task.tags.length - 1}</span>}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    });
    TaskItemMiniInline.displayName = 'TaskItemMiniInline';


    return (
        <div className="h-full flex flex-col bg-glass-alt-100 dark:bg-neutral-900 overflow-hidden">
            {/* Page Header */}
            <div
                className="px-3 md:px-4 py-2 border-b border-black/10 dark:border-white/10 flex justify-between items-center flex-shrink-0 bg-glass-100 dark:bg-neutral-800/70 backdrop-blur-lg z-10 h-12 shadow-sm">
                {/* Left Section: Title + History */}
                <div className="w-1/3 flex items-center space-x-2">
                    <h1 className="text-base font-semibold text-gray-800 dark:text-neutral-100 truncate">AI Summary</h1>
                    <Tooltip.Root delayDuration={200}>
                        <Tooltip.Trigger asChild>
                            <Button variant="ghost" size="icon" icon="history" onClick={openHistoryModal}
                                    className="w-7 h-7 text-muted-foreground dark:text-neutral-400 hover:bg-black/15 dark:hover:bg-white/10"
                                    aria-label="View Summary History"/>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content
                                className="text-xs bg-black/80 text-white px-2 py-1 rounded shadow-md select-none z-[70]"
                                sideOffset={4}>
                                View All Generated Summaries
                                <Tooltip.Arrow className="fill-black/80"/>
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                </div>

                {/* Center Section: Filters */}
                <div className="flex-1 flex justify-center items-center space-x-2">
                    {/* Popover Root for the Date Range Picker */}
                    <Popover.Root modal={true} open={isRangePickerOpen} onOpenChange={setIsRangePickerOpen}>
                        <DropdownMenu.Root open={isPeriodDropdownOpen} onOpenChange={setIsPeriodDropdownOpen}>
                            <Popover.Anchor asChild>
                                <DropdownMenu.Trigger asChild>
                                    <Button variant="ghost" size="sm"
                                            className="text-sm h-8 px-2 text-gray-700 dark:text-neutral-200 font-medium hover:bg-black/15 dark:hover:bg-white/10 min-w-[120px] tabular-nums">
                                        <Icon name="calendar-days" size={14} className="mr-1.5 opacity-70"/>
                                        {selectedPeriodLabel}
                                        <Icon name="chevron-down" size={14} className="ml-auto opacity-60 pl-1"/>
                                    </Button>
                                </DropdownMenu.Trigger>
                            </Popover.Anchor>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className={dropdownContentClasses} sideOffset={5} align="center">
                                    <DropdownMenu.RadioGroup
                                        value={typeof period === 'string' ? period : 'custom'}
                                        onValueChange={handlePeriodValueChange}
                                    >
                                        {periodOptions.map(p => {
                                            const itemValue = typeof p.value === 'string' ? p.value : 'custom';
                                            const itemKey = p.label;
                                            return (
                                                <DropdownMenu.RadioItem
                                                    key={itemKey}
                                                    value={itemValue}
                                                    className={twMerge(
                                                        "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                        "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                                        "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/40",
                                                        "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
                                                        "data-[disabled]:opacity-50"
                                                    )}
                                                >
                                                    {p.label}
                                                </DropdownMenu.RadioItem>
                                            );
                                        })}
                                    </DropdownMenu.RadioGroup>
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>

                        {/* Date Range Picker Popover Content */}
                        <Popover.Portal>
                            <Popover.Content
                                side="bottom"
                                align="center"
                                sideOffset={5}
                                className={twMerge(
                                    "z-[60] radix-popover-content",
                                    "data-[state=open]:animate-slideUpAndFade",
                                    "data-[state=closed]:animate-slideDownAndFade"
                                )}
                                onOpenAutoFocus={(e) => e.preventDefault()}
                                onCloseAutoFocus={(e) => e.preventDefault()}
                                // No onInteractOutside needed for modal
                            >
                                <CustomDateRangePickerContent
                                    initialStartDate={typeof period === 'object' ? new Date(period.start) : undefined}
                                    initialEndDate={typeof period === 'object' ? new Date(period.end) : undefined}
                                    onApplyRange={handleRangeApply}
                                    closePopover={closeRangePicker}
                                />
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root> {/* End Popover Root */}


                    {/* List Dropdown */}
                    <DropdownMenu.Root open={isListDropdownOpen} onOpenChange={setIsListDropdownOpen}>
                        <DropdownMenu.Trigger asChild>
                            <Button variant="ghost" size="sm"
                                    className="text-sm h-8 px-2 text-gray-700 dark:text-neutral-200 font-medium hover:bg-black/15 dark:hover:bg-white/10 min-w-[110px]">
                                <Icon name="list" size={14} className="mr-1.5 opacity-70"/>
                                {selectedListLabel}
                                <Icon name="chevron-down" size={14} className="ml-auto opacity-60 pl-1"/>
                            </Button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                className={twMerge(dropdownContentClasses, "max-h-60 overflow-y-auto styled-scrollbar-thin")}
                                sideOffset={5} align="center">
                                <DropdownMenu.RadioGroup value={listFilter} onValueChange={handleListChange}>
                                    {listOptions.map(l => (
                                        <DropdownMenu.RadioItem
                                            key={l.value} value={l.value}
                                            className={twMerge(
                                                "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7",
                                                "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                                "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:bg-primary/40",
                                                "text-gray-700 data-[highlighted]:text-gray-800 dark:text-neutral-300 dark:data-[highlighted]:text-neutral-100",
                                                "data-[disabled]:opacity-50"
                                            )}>
                                            {l.label}
                                        </DropdownMenu.RadioItem>
                                    ))}
                                </DropdownMenu.RadioGroup>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                </div>

                {/* Right Section: Generate Button */}
                <div className="w-1/3 flex justify-end">
                    <Button variant="primary" size="sm" icon={isGenerating ? undefined : "sparkles"}
                            loading={isGenerating} onClick={handleGenerateClick} disabled={isGenerateDisabled}
                            className="px-3 !h-8">
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 md:p-3 gap-2 md:gap-3 min-h-0">
                {/* Left Pane: Task List */}
                <div
                    className="w-full md:w-[320px] h-1/2 md:h-full flex flex-col bg-glass-alt-100 dark:bg-neutral-800/60 backdrop-blur-xl rounded-lg shadow-lg border border-black/10 dark:border-white/10 overflow-hidden flex-shrink-0">
                    <div
                        className="px-3 py-2 border-b border-black/10 dark:border-white/10 flex justify-between items-center flex-shrink-0 h-11">
                        <h2 className="text-base font-semibold text-gray-800 dark:text-neutral-100 truncate">Tasks
                            ({filteredTasks.length})</h2>
                        <SelectionCheckboxRadix
                            id="select-all-summary-tasks"
                            checked={selectAllState === true}
                            indeterminate={selectAllState === 'indeterminate'}
                            onChange={() => {
                                if (allTasksSelected || someTasksSelected) {
                                    handleDeselectAllTasks();
                                } else {
                                    handleSelectAllTasks();
                                }
                            }}
                            aria-label={allTasksSelected ? "Deselect all tasks" : (someTasksSelected ? "Deselect all tasks" : "Select all tasks")}
                            className="mr-1"
                            size={18}
                            disabled={filteredTasks.length === 0} // Disable if no tasks to select
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto styled-scrollbar p-2 space-y-1">
                        {filteredTasks.length === 0 ? (
                            <div
                                className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-500 px-4 text-center pt-10">
                                <Icon name="archive" size={36}
                                      className="mb-3 text-gray-300 dark:text-neutral-600 opacity-80"/>
                                <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">No tasks match
                                    criteria</p>
                                <p className="text-xs mt-1 text-muted dark:text-neutral-500">Adjust filters or check
                                    task status.</p>
                            </div>
                        ) : (
                            filteredTasks.map(task => (
                                <TaskItemMiniInline key={task.id} task={task} isSelected={selectedTaskIds.has(task.id)}
                                                    onSelectionChange={handleTaskSelectionChange}/>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Pane: Summary */}
                <div
                    className="flex-1 h-1/2 md:h-full flex flex-col bg-glass-100 dark:bg-neutral-800/80 backdrop-blur-xl rounded-lg shadow-lg border border-black/10 dark:border-white/10 overflow-hidden">
                    <div className="flex-1 flex flex-col overflow-hidden p-3">
                        {totalRelevantSummaries > 0 || isGenerating ? (
                            <>
                                {/* Summary Header */}
                                <div className="flex justify-between items-center mb-2 flex-shrink-0 h-6">
                                    <span className="text-xs text-muted-foreground dark:text-neutral-400">
                                         {isGenerating ? 'Generating summary...' : (summaryTimestamp ? `Generated: ${summaryTimestamp}` : 'Unsaved Summary')}
                                    </span>
                                    <div className="flex items-center space-x-2">
                                        {/* Referenced Tasks Dropdown */}
                                        <DropdownMenu.Root open={isRefTasksDropdownOpen}
                                                           onOpenChange={setIsRefTasksDropdownOpen}>
                                            <DropdownMenu.Trigger asChild disabled={!currentSummary || isGenerating}>
                                                <button
                                                    className={twMerge(
                                                        "flex items-center text-xs h-6 px-1.5 rounded transition-colors duration-150 ease-apple focus:outline-none",
                                                        !currentSummary || isGenerating
                                                            ? "text-muted-foreground/50 dark:text-neutral-500 cursor-not-allowed"
                                                            : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 dark:hover:bg-blue-500/15 focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:bg-blue-500/10 dark:focus-visible:bg-blue-500/15"
                                                    )}
                                                    aria-haspopup="true"
                                                >
                                                    <Icon name="file-text" size={12} className="mr-1 opacity-70"/>
                                                    {tasksUsedCount} tasks used
                                                    <Icon name="chevron-down" size={12} className="ml-0.5 opacity-60"/>
                                                </button>
                                            </DropdownMenu.Trigger>
                                            <DropdownMenu.Portal>
                                                <DropdownMenu.Content
                                                    className={twMerge("z-[55] radix-dropdown-content")}
                                                    sideOffset={4} align="end"
                                                    // Keep dropdown open on interaction inside
                                                    onInteractOutside={e => e.preventDefault()}
                                                    onFocusOutside={e => e.preventDefault()}
                                                >
                                                    {renderReferencedTasksDropdown()}
                                                </DropdownMenu.Content>
                                            </DropdownMenu.Portal>
                                        </DropdownMenu.Root>

                                        {/* Summary Navigation */}
                                        {totalRelevantSummaries > 1 && !isGenerating && (
                                            <>
                                                <Button variant="ghost" size="icon" icon="chevron-left"
                                                        onClick={handlePrevSummary}
                                                        disabled={currentIndex >= totalRelevantSummaries - 1}
                                                        className="w-6 h-6 text-muted-foreground dark:text-neutral-400"
                                                        aria-label="Older summary"/>
                                                <span
                                                    className="text-xs font-medium text-muted-foreground dark:text-neutral-300 tabular-nums">
                                                     {displayedIndex} / {totalRelevantSummaries}
                                                </span>
                                                <Button variant="ghost" size="icon" icon="chevron-right"
                                                        onClick={handleNextSummary} disabled={currentIndex <= 0}
                                                        className="w-6 h-6 text-muted-foreground dark:text-neutral-400"
                                                        aria-label="Newer summary"/>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* CodeMirror Editor - ADD KEY PROP */}
                                <div
                                    className="flex-1 min-h-0 border border-black/10 dark:border-white/10 rounded-md overflow-hidden bg-glass-inset-100 dark:bg-neutral-700/30 shadow-inner relative">
                                    <CodeMirrorEditor
                                        // --- FIX: Add key prop ---
                                        // This key forces React to unmount and remount the component when the
                                        // displayed summary ID changes, ensuring a fresh CodeMirror instance.
                                        // We use a placeholder key during generation or when no summary is selected.
                                        key={isGenerating ? 'generating' : (currentSummary?.id ?? 'no-summary')}
                                        // --- End FIX ---
                                        ref={editorRef}
                                        value={summaryEditorContent}
                                        onChange={handleEditorChange}
                                        placeholder={isGenerating ? "Generating..." : "AI generated summary will appear here..."}
                                        className="!h-full !bg-transparent"
                                        readOnly={isGenerating || !currentSummary}
                                    />
                                    {hasUnsavedChangesRef.current && !isGenerating && currentSummary && (
                                        <span
                                            className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/70 dark:text-neutral-400/70 italic animate-pulse">
                                            saving...
                                        </span>
                                    )}
                                    {isGenerating && (
                                        <div
                                            className="absolute inset-0 bg-glass-alt/30 backdrop-blur-sm flex items-center justify-center z-10">
                                            <Icon name="loader" size={24} className="text-primary animate-spin"/>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div
                                className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-neutral-500 px-6 text-center">
                                <Icon name="sparkles" size={40}
                                      className="mb-3 text-gray-300 dark:text-neutral-600 opacity-80"/>
                                <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">Generate Your
                                    First Summary</p>
                                <p className="text-xs mt-1 text-muted dark:text-neutral-500">Select tasks and click
                                    'Generate'.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary History Modal */}
            <SummaryHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={closeHistoryModal}
                summaries={allStoredSummaries}
                allTasks={allTasks}
            />
        </div>
    );
};
SummaryView.displayName = 'SummaryView';
export default SummaryView;