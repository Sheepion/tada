// src/components/summary/SummaryHistoryModal.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {twMerge} from 'tailwind-merge';
import {StoredSummary} from '@/store/atoms';
import Button from '../common/Button';
import Icon from '../common/Icon';
import {format, formatDistanceToNowStrict, isSameDay, isValid, parseISO, startOfDay, subDays} from 'date-fns';
import CodeMirrorEditor, {CodeMirrorEditorRef} from '../common/CodeMirrorEditor';
import {Task} from '@/types';
import useDebounce from '@/hooks/useDebounce';
import Highlighter from 'react-highlight-words';
import {IconName} from "@/components/common/IconMap";
import * as Dialog from '@radix-ui/react-dialog';
import {VisuallyHidden} from '@radix-ui/react-visually-hidden'; // Keep this import

// --- Helper: Get Filter Labels ---
const getFilterLabels = (periodKey: string, listKey: string): { periodLabel: string, listLabel: string } => {
    let periodLabel = 'Date Range';
    let listLabel = 'All Lists';

    if (periodKey === 'today') periodLabel = 'Today';
    else if (periodKey === 'yesterday') periodLabel = 'Yesterday';
    else if (periodKey === 'thisWeek') periodLabel = 'This Week';
    else if (periodKey === 'lastWeek') periodLabel = 'Last Week';
    else if (periodKey === 'thisMonth') periodLabel = 'This Month';
    else if (periodKey === 'lastMonth') periodLabel = 'Last Month';
    else if (periodKey.startsWith('custom_')) {
        try {
            const [, startTs, endTs] = periodKey.split('_');
            const startDate = new Date(Number(startTs));
            const endDate = new Date(Number(endTs));
            if (isValid(startDate) && isValid(endDate)) {
                const currentYear = new Date().getFullYear();
                const startYear = startDate.getFullYear();
                const endYear = endDate.getFullYear();

                if (isSameDay(startDate, endDate)) {
                    periodLabel = format(startDate, startYear === currentYear ? 'MMM d' : 'MMM d, yyyy');
                } else {
                    const startFormat = startYear === currentYear ? 'MMM d' : 'MMM d, yyyy';
                    const endFormat = endYear === currentYear ? 'MMM d' : 'MMM d, yyyy';
                    periodLabel = `${format(startDate, startFormat)} - ${format(endDate, endFormat)}`;
                }
            } else {
                periodLabel = 'Custom Range';
            }
        } catch (e) {
            console.error("Error parsing custom date range key:", e);
            periodLabel = 'Custom Range';
        }
    }

    if (listKey !== 'all' && listKey.startsWith('list-')) {
        listLabel = listKey.substring(5);
    } else if (listKey !== 'all') {
        listLabel = listKey;
    }

    return {periodLabel, listLabel};
};


// --- Helper: Referenced Task Item ---
interface ReferencedTaskItemProps {
    task: Task;
}

const ReferencedTaskItem: React.FC<ReferencedTaskItemProps> = React.memo(({task}) => {
    const iconName: IconName = task.completed ? "check-square" : "square";
    const iconColor = task.completed ? "text-green-600 dark:text-green-400" : "text-neutral-400 dark:text-neutral-500";
    const textColor = task.completed ? "text-neutral-500 dark:text-neutral-400" : "text-neutral-800 dark:text-neutral-200";
    const showPercentage = !task.completed && task.completionPercentage && task.completionPercentage > 0;

    return (
        <li
            className="flex items-center py-1 px-1.5 rounded-md transition-colors duration-150 ease-out group"
            title={task.title}
        >
            <Icon
                name={iconName}
                size={13}
                className={twMerge("mr-2 flex-shrink-0 transition-colors", iconColor)}
                strokeWidth={task.completed ? 2.5 : 1.75}
            />
            <div className="flex items-baseline flex-1 overflow-hidden">
                <span className={twMerge("text-xs truncate", textColor, task.completed && "line-through")}>
                    {task.title || <span className="italic">Untitled Task</span>}
                </span>
                {showPercentage && (
                    <span
                        className="ml-1.5 text-[9px] text-primary/90 dark:text-primary/80 font-medium select-none flex-shrink-0">
                        [{task.completionPercentage}%]
                    </span>
                )}
            </div>
        </li>
    );
});
ReferencedTaskItem.displayName = 'ReferencedTaskItem';

// --- Main Modal Component ---
interface SummaryHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    summaries: StoredSummary[];
    allTasks: Task[];
}

const SummaryHistoryModal: React.FC<SummaryHistoryModalProps> = ({
                                                                     isOpen,
                                                                     onClose,
                                                                     summaries,
                                                                     allTasks,
                                                                 }) => {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 250);
    const editorRef = useRef<CodeMirrorEditorRef>(null);

    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) {
            onClose();
            setSelectedSummaryId(null);
            setSearchTerm('');
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            const validSelectionExists = summaries.some(s => s.id === selectedSummaryId);
            if (summaries.length > 0 && !validSelectionExists) {
                setSelectedSummaryId(summaries[0].id);
            } else if (summaries.length === 0) {
                setSelectedSummaryId(null);
            }
            if (summaries.length > 0) {
                const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
                return () => clearTimeout(timer);
            }
        }
    }, [isOpen, summaries, selectedSummaryId]);

    const selectedSummary = useMemo(() => {
        return summaries.find(s => s.id === selectedSummaryId) ?? null;
    }, [selectedSummaryId, summaries]);

    const selectedReferencedTasks = useMemo(() => {
        if (!selectedSummary) return [];
        const referencedIds = new Set(selectedSummary.taskIds);
        return allTasks
            .filter(task => referencedIds.has(task.id))
            .sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1) || a.title.localeCompare(b.title));
    }, [selectedSummary, allTasks]);

    const groupedSummaries = useMemo(() => {
        const groups: Record<string, StoredSummary[]> = {};
        const sortedSummaries = [...summaries].sort((a, b) => b.createdAt - a.createdAt);
        sortedSummaries.forEach(summary => {
            const date = new Date(summary.createdAt);
            const dateKey = format(date, 'yyyy-MM-dd');
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(summary);
        });
        const sortedKeys = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        return sortedKeys.map(key => ({dateKey: key, items: groups[key]}));
    }, [summaries]);

    const filteredGroupedSummaries = useMemo(() => {
        if (!debouncedSearchTerm) {
            return groupedSummaries;
        }
        const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
        const searchWords = lowerSearchTerm.split(' ').filter(Boolean);

        const filtered: { dateKey: string; items: StoredSummary[] }[] = [];
        groupedSummaries.forEach(group => {
            const matchingItems = group.items.filter(summary => {
                const {periodLabel, listLabel} = getFilterLabels(summary.periodKey, summary.listKey);
                const textMatch = searchWords.every(word =>
                    summary.summaryText.toLowerCase().includes(word) ||
                    periodLabel.toLowerCase().includes(word) ||
                    listLabel.toLowerCase().includes(word)
                );
                return textMatch;
            });
            if (matchingItems.length > 0) {
                filtered.push({dateKey: group.dateKey, items: matchingItems});
            }
        });
        return filtered;
    }, [groupedSummaries, debouncedSearchTerm]);

    const formatDateGroupKey = (dateKey: string): string => {
        const date = parseISO(dateKey);
        if (!isValid(date)) return "Invalid Date";
        const now = new Date();
        if (isSameDay(date, now)) return 'Today';
        if (isSameDay(date, startOfDay(subDays(now, 1)))) return 'Yesterday';
        return format(date, date.getFullYear() === now.getFullYear() ? 'MMMM d' : 'MMMM d, yyyy');
    };

    const handleSelectSummary = useCallback((summaryId: string) => {
        setSelectedSummaryId(summaryId);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        const currentList = filteredGroupedSummaries.flatMap(g => g.items);
        if (!currentList.find(s => s.id === selectedSummaryId)) {
            setSelectedSummaryId(currentList[0]?.id ?? null);
        }
    };

    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
        searchInputRef.current?.focus();
        if (!summaries.find(s => s.id === selectedSummaryId)) {
            setSelectedSummaryId(summaries[0]?.id ?? null);
        }
    }, [summaries, selectedSummaryId]);

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary/20 dark:bg-primary/30 text-inherit font-semibold rounded-[1px] px-0",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean),
        autoEscape: true,
        textToHighlight: '',
    }), [debouncedSearchTerm]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-black/65 dark:bg-black/75 backdrop-blur-sm z-50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                />
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[55]",
                        "bg-neutral-50 dark:bg-neutral-800/90 backdrop-blur-3xl",
                        "w-full max-w-5xl",
                        "rounded-xl shadow-2xl overflow-hidden border border-neutral-300/50 dark:border-neutral-700/50",
                        "flex flex-col max-h-[80vh] h-[80vh]",
                        "data-[state=open]:animate-contentShow",
                        "data-[state=closed]:animate-contentHide"
                    )}
                    onEscapeKeyDown={onClose}
                    // REMOVED aria-labelledby and aria-describedby - Rely on automatic linking
                >
                    {/* Header: Contains Title */}
                    <div
                        className="px-5 py-3 border-b border-neutral-200/70 dark:border-neutral-700/50 flex justify-between items-center flex-shrink-0 h-[50px]">
                        {/* Title is FIRST semantic element inside header */}
                        <Dialog.Title
                            className="text-base font-semibold text-neutral-800 dark:text-neutral-100 flex items-center">
                            <Icon name="history" size={16} className="mr-2 text-neutral-500 dark:text-neutral-400"/>
                            Summary History
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-neutral-500 dark:text-neutral-400 hover:bg-neutral-500/10 dark:hover:bg-neutral-700/50 w-7 h-7 -mr-1.5"
                                    aria-label="Close history"/>
                        </Dialog.Close>
                    </div>

                    {/* Description: Placed immediately after header, visually hidden */}
                    <Dialog.Description asChild>
                        <VisuallyHidden>
                            Browse and search through previously generated AI summaries. Select a summary from the list
                            to
                            view its details and the tasks it references.
                        </VisuallyHidden>
                    </Dialog.Description>

                    {/* Main Content: Two Panes */}
                    <div className="flex flex-1 overflow-hidden min-h-0">
                        {/* Left Pane: Search + History List */}
                        <div
                            className="w-[320px] border-r border-neutral-200/70 dark:border-neutral-700/50 flex flex-col overflow-hidden flex-shrink-0 bg-neutral-100/50 dark:bg-neutral-800/60">
                            {/* Search Area */}
                            <div
                                className="p-3 border-b border-neutral-200/70 dark:border-neutral-700/50 flex-shrink-0">
                                <div className="relative">
                                    <Icon name="search" size={15}
                                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 z-10"/>
                                    <input
                                        ref={searchInputRef}
                                        type="search"
                                        placeholder="Search history..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className={twMerge(
                                            "w-full h-8 pl-8 pr-7 text-sm rounded-md focus:outline-none",
                                            "bg-neutral-200/60 dark:bg-neutral-700/60",
                                            "border border-transparent focus:border-primary/40 dark:focus:border-primary/60",
                                            "focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/30",
                                            "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
                                            "text-neutral-800 dark:text-neutral-100",
                                            "transition-colors duration-150 ease-in-out"
                                        )}
                                        aria-label="Search summaries"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={handleClearSearch}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 z-10 transition-colors"
                                            aria-label="Clear search"
                                        >
                                            <Icon name="x-circle" size={14}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* List Area */}
                            <div className="flex-1 overflow-y-auto styled-scrollbar-thin">
                                {summaries.length === 0 ? (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-10 px-4 italic">
                                        No summaries generated yet.
                                    </p>
                                ) : filteredGroupedSummaries.length === 0 ? (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-10 px-4 italic">
                                        No summaries match "{debouncedSearchTerm}".
                                    </p>
                                ) : (
                                    filteredGroupedSummaries.map(({dateKey, items}) => (
                                        <div key={dateKey} className="pt-2">
                                            <h3 className="px-3.5 pt-2 pb-1 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide sticky top-0 bg-neutral-100/80 dark:bg-neutral-800/80 backdrop-blur-sm z-10 border-b border-neutral-200/50 dark:border-neutral-700/30">
                                                {formatDateGroupKey(dateKey)}
                                            </h3>
                                            <ul className="px-2 py-1">
                                                {items.map((summary) => {
                                                    const {
                                                        periodLabel,
                                                        listLabel
                                                    } = getFilterLabels(summary.periodKey, summary.listKey);
                                                    const isSelected = selectedSummaryId === summary.id;
                                                    const summarySnippet = summary.summaryText.substring(0, 100) + (summary.summaryText.length > 100 ? '...' : '');
                                                    return (
                                                        <li key={summary.id}>
                                                            <button
                                                                className={twMerge(
                                                                    "w-full text-left p-2.5 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors duration-100 ease-out rounded-lg mb-0.5",
                                                                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-100 dark:focus-visible:ring-offset-neutral-800",
                                                                    isSelected && "bg-primary/10 hover:bg-primary/15 dark:bg-primary/20 dark:hover:bg-primary/25"
                                                                )}
                                                                onClick={() => handleSelectSummary(summary.id)}
                                                                aria-current={isSelected ? 'page' : undefined}
                                                            >
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span
                                                                        className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                                                                        {format(summary.createdAt, 'p')}
                                                                    </span>
                                                                    <div
                                                                        className="flex items-center space-x-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
                                                                        <span
                                                                            className="inline-flex items-center bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-[1px] rounded-full text-[9px] font-medium"
                                                                            title={periodLabel}
                                                                        >
                                                                            <Icon name="calendar-days" size={9}
                                                                                  className="mr-1 opacity-70 flex-shrink-0"/>
                                                                            <span
                                                                                className="truncate">{periodLabel}</span>
                                                                        </span>
                                                                        <span
                                                                            className="inline-flex items-center bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 px-1.5 py-[1px] rounded-full text-[9px] font-medium"
                                                                            title={listLabel}
                                                                        >
                                                                            <Icon name="list" size={9}
                                                                                  className="mr-1 opacity-70 flex-shrink-0"/>
                                                                            <span
                                                                                className="truncate">{listLabel}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <p className={twMerge("text-xs text-neutral-600 dark:text-neutral-400 leading-snug", isSelected && "text-neutral-800 dark:text-neutral-200")}>
                                                                    <Highlighter {...highlighterProps}
                                                                                 textToHighlight={summarySnippet}/>
                                                                </p>
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right Pane: Summary Detail */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-900/50">
                            {selectedSummary ? (
                                <div className="flex-1 flex flex-col p-4 md:p-5 overflow-hidden">
                                    {/* Detail Header */}
                                    <div className="flex justify-between items-center mb-3 flex-shrink-0">
                                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                            <span
                                                className="inline-flex items-center bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-[11px] font-medium">
                                                <Icon name="calendar-days" size={11} className="mr-1 opacity-70"/>
                                                {getFilterLabels(selectedSummary.periodKey, selectedSummary.listKey).periodLabel}
                                            </span>
                                            <span
                                                className="inline-flex items-center bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 px-2 py-0.5 rounded-full text-[11px] font-medium">
                                                <Icon name="list" size={11} className="mr-1 opacity-70"/>
                                                {getFilterLabels(selectedSummary.periodKey, selectedSummary.listKey).listLabel}
                                            </span>
                                        </div>
                                        <span
                                            className="text-[11px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap pl-2">
                                            {formatDistanceToNowStrict(selectedSummary.createdAt, {addSuffix: true})}
                                            {selectedSummary.updatedAt && selectedSummary.updatedAt > selectedSummary.createdAt + 10000 && (
                                                <span className="italic ml-1">(edited)</span>
                                            )}
                                        </span>
                                    </div>
                                    {/* Summary Content Editor */}
                                    <div className={twMerge(
                                        "flex-1 min-h-0 mb-3 rounded-lg overflow-hidden relative",
                                        "bg-neutral-100/50 dark:bg-neutral-800/40",
                                        "border border-neutral-200/80 dark:border-neutral-700/50"
                                    )}>
                                        <CodeMirrorEditor
                                            ref={editorRef}
                                            key={selectedSummary.id}
                                            value={selectedSummary.summaryText}
                                            onChange={() => { /* Read-only */
                                            }}
                                            readOnly={true}
                                            className="!h-full !border-none !shadow-none !bg-transparent"
                                            placeholder="Summary content..."
                                        />
                                    </div>
                                    {/* Referenced Tasks Section */}
                                    <div
                                        className="flex-shrink-0 max-h-[30%] overflow-hidden flex flex-col border-t border-neutral-200/70 dark:border-neutral-700/50 pt-2">
                                        <h4 className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1 px-1 flex-shrink-0">
                                            Referenced Tasks ({selectedReferencedTasks.length})
                                        </h4>
                                        {selectedReferencedTasks.length > 0 ? (
                                            <ul className="space-y-0 flex-1 overflow-y-auto styled-scrollbar-thin pr-1">
                                                {selectedReferencedTasks.map(task => (
                                                    <ReferencedTaskItem key={task.id} task={task}/>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400 italic px-1 py-2">
                                                No tasks were referenced.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-neutral-400 text-sm italic p-10 text-center">
                                    <Icon name="file-text" size={32} className="mb-3 opacity-30"/>
                                    Select a summary<br/>to view details.
                                </div>
                            )}
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
SummaryHistoryModal.displayName = 'SummaryHistoryModal';

export default SummaryHistoryModal;