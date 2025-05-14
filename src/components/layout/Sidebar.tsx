// src/components/layout/Sidebar.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import Icon from '../common/Icon';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    currentFilterAtom,
    isAddListModalOpenAtom,
    rawSearchResultsAtom,
    searchTermAtom,
    selectedTaskIdAtom,
    taskCountsAtom,
    userDefinedListsAtom,
    userListNamesAtom,
    userTagNamesAtom
} from '@/store/atoms';
import {Task, TaskFilter} from '@/types';
import {twMerge} from 'tailwind-merge';
import Button from '../common/Button';
import AddListModal from '../common/AddListModal';
import {IconName} from "@/components/common/IconMap";
import Highlighter from "react-highlight-words";
import {AnimatePresence, motion} from 'framer-motion';

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

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


const SidebarItem: React.FC<{
    to: string; filter: TaskFilter; icon: IconName; label: string;
    count?: number; isUserList?: boolean;
}> = memo(({to, filter, icon, label, count}) => {
    const [currentActiveFilter,] = useAtom(currentFilterAtom);
    const navigate = useNavigate();
    const isActive = useMemo(() => currentActiveFilter === filter, [currentActiveFilter, filter]);
    const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        navigate(to);
    }, [navigate, to]);

    const linkClassName = useMemo(() => twMerge(
        'flex items-center justify-between px-2 py-0 h-8 rounded-base mb-0.5 text-[13px] group transition-colors duration-200 ease-in-out cursor-pointer relative',
        isActive
            ? 'bg-grey-ultra-light text-primary font-medium'
            : 'text-grey-dark font-light hover:bg-grey-ultra-light hover:text-grey-dark',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white'
    ), [isActive]);

    const countClassName = useMemo(() => twMerge(
        "text-[10px] font-light px-1 py-0 rounded-sm ml-1 tabular-nums flex-shrink-0",
        isActive ? 'text-primary bg-primary/20' : 'text-grey-medium bg-grey-light group-hover:bg-grey-light'
    ), [isActive]);

    return (
        <Link to={to} onClick={handleClick} className={linkClassName} aria-current={isActive ? 'page' : undefined}>
            <div className="flex items-center overflow-hidden whitespace-nowrap text-ellipsis flex-1 min-w-0 mr-1">
                <Icon name={icon} size={16} strokeWidth={1}
                      className="mr-2 flex-shrink-0 opacity-90"
                      aria-hidden="true"/>
                <span className="truncate">{label}</span>
            </div>
            {(count !== undefined && count > 0) && (
                <span className={countClassName} aria-label={`${count} items`}> {count} </span>)}
        </Link>
    );
});
SidebarItem.displayName = 'SidebarItem';

const CollapsibleSection: React.FC<{
    title: string; children: React.ReactNode;
    initiallyOpen?: boolean; action?: React.ReactNode;
    // Removed 'icon' prop from here as it's no longer used for leading section icons.
    // It could be added back if a different type of icon usage is needed in the future.
}> = memo(({title, children, initiallyOpen = true, action}) => {
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const sectionId = useMemo(() => `section-content-${title.replace(/\s+/g, '-')}`, [title]);
    const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

    // Chevron classes now don't include ml-auto, as it's positioned left.
    const chevronClasses = useMemo(() => twMerge(
        "transition-transform duration-200 ease-in-out opacity-70 group-hover:opacity-90",
        isOpen ? "rotate-0" : "-rotate-90"
    ), [isOpen]);

    return (
        <div className="pt-4 first:pt-2">
            {/* Removed 'group' class from this div, as action button hover is no longer needed */}
            <div className="flex items-center justify-between px-2 py-0 mb-1">
                <button onClick={toggleOpen}
                    // 'group' class here is for the chevron's group-hover effect. Added pr-1 for spacing.
                        className="flex items-center flex-1 min-w-0 h-6 text-[11px] font-normal text-grey-medium uppercase tracking-[0.5px] hover:text-grey-dark focus:outline-none group rounded pr-1"
                        aria-expanded={isOpen} aria-controls={sectionId}>
                    {/* Chevron icon moved to the left of the title */}
                    <Icon name={'chevron-down'} size={14} strokeWidth={1.5}
                          className={twMerge("mr-1.5 flex-shrink-0", chevronClasses)} // Added flex-shrink-0
                          aria-hidden="true"/>
                    {/* The leading icon (folder, tag) display logic is removed. */}
                    <span className="truncate">{title}</span> {/* Title can truncate */}
                </button>
                {action && <div className="-mr-1 ml-1 flex-shrink-0">{action}</div>}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div id={sectionId} key="content" initial="collapsed" animate="open" exit="collapsed"
                                variants={{
                                    open: {opacity: 1, height: 'auto', marginTop: '2px'},
                                    collapsed: {opacity: 0, height: 0, marginTop: 0}
                                }}
                                transition={{duration: 0.25, ease: "easeOut"}} className="overflow-hidden">
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
CollapsibleSection.displayName = 'CollapsibleSection';

const Sidebar: React.FC = () => {
    const counts = useAtomValue(taskCountsAtom);
    const userLists = useAtomValue(userListNamesAtom);
    const userTags = useAtomValue(userTagNamesAtom);
    const searchResults = useAtomValue(rawSearchResultsAtom);
    const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const setUserDefinedLists = useSetAtom(userDefinedListsAtom);
    const [, setIsAddListModalOpen] = useAtom(isAddListModalOpenAtom);

    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchTerm = useDebounce(searchTerm, 250);
    const isSearching = useMemo(() => debouncedSearchTerm.trim().length > 0, [debouncedSearchTerm]);
    const handleAddNewListClick = useCallback(() => {
        setIsAddListModalOpen(true);
    }, [setIsAddListModalOpen]);
    const handleListAdded = useCallback((newListName: string) => {
        const trimmedName = newListName.trim();
        if (!trimmedName) return;
        setUserDefinedLists((prevLists = []) => {
            const newListSet = new Set(prevLists);
            newListSet.add(trimmedName);
            return Array.from(newListSet).sort((a, b) => a.localeCompare(b));
        });
        navigate(`/list/${encodeURIComponent(trimmedName)}`);
    }, [setUserDefinedLists, navigate]);
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, [setSearchTerm]);
    const handleClearSearch = useCallback(() => {
        setSearchTerm('');
        searchInputRef.current?.focus();
    }, [setSearchTerm]);
    const handleSearchResultClick = useCallback((task: Task) => {
        setSelectedTaskId(task.id);
    }, [setSelectedTaskId]);
    const myListsToDisplay = useMemo(() => userLists.filter(list => list !== 'Inbox'), [userLists]);
    const tagsToDisplay = useMemo(() => userTags, [userTags]);

    const searchInputClassName = useMemo(() => twMerge(
        "w-full h-[32px] pl-8 pr-7 text-[13px] font-light rounded-base focus:outline-none",
        "bg-grey-ultra-light dark:bg-neutral-700/60",
        "border border-transparent dark:border-transparent",
        // Removed primary focus ring/border
        "focus:border-transparent dark:focus:border-transparent", // Ensure border remains transparent on focus
        "placeholder:text-grey-medium dark:placeholder:text-neutral-400/70",
        "text-grey-dark dark:text-neutral-100",
        "transition-colors duration-200 ease-in-out"
    ), []);

    const highlighterProps = useMemo(() => ({
        highlightClassName: "bg-primary-light text-primary font-normal rounded-[1px] px-0",
        searchWords: debouncedSearchTerm.split(' ').filter(Boolean), autoEscape: true,
    }), [debouncedSearchTerm]);
    const searchResultButtonClassName = "flex items-start w-full px-2 py-1.5 text-left rounded-base hover:bg-grey-ultra-light text-[13px] group transition-colors duration-100 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary";

    return (
        <>
            <aside className="w-full bg-white h-full flex flex-col shrink-0 z-10 pt-2.5 pb-2 px-2">
                <div className="mb-3 flex-shrink-0">
                    <div className="relative flex items-center">
                        <label htmlFor="sidebar-search" className="sr-only">Search Tasks</label>
                        <Icon name="search" size={12} strokeWidth={1.5}
                              className="absolute left-3 text-grey-medium pointer-events-none z-10"/>
                        <input ref={searchInputRef} id="sidebar-search" type="search" placeholder="Search"
                               value={searchTerm} onChange={handleSearchChange} className={searchInputClassName}
                               aria-label="Search tasks"/>
                        <AnimatePresence>
                            {searchTerm && (
                                <motion.div key="clear-search-btn" initial={{scale: 0.7, opacity: 0}}
                                            animate={{scale: 1, opacity: 1}} exit={{scale: 0.7, opacity: 0}}
                                            transition={{duration: 0.1}}
                                            className="absolute right-1.5 h-full flex items-center z-10">
                                    <Button variant="ghost" size="icon" icon="x-circle" onClick={handleClearSearch}
                                            className="w-5 h-5 text-grey-medium opacity-70 hover:opacity-100 hover:bg-grey-light"
                                            iconProps={{size: 14, strokeWidth: 1}} aria-label="Clear search"/>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto styled-scrollbar -mx-0.5 pr-0.5">
                    <AnimatePresence mode="wait">
                        {isSearching ? (
                            <motion.div key="search-results" initial={{opacity: 0}} animate={{opacity: 1}}
                                        exit={{opacity: 0}} transition={{duration: 0.15, ease: 'linear'}}
                                        className="px-0.5 pb-2">
                                {searchResults.length > 0 ? (
                                    <>
                                        <p className="text-[11px] font-normal text-grey-medium px-1.5 py-1">{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</p>
                                        {searchResults.map((task: Task) => (
                                            <button key={task.id} onClick={() => handleSearchResultClick(task)}
                                                    className={searchResultButtonClassName}
                                                    aria-label={`Search result: ${task.title || 'Untitled Task'}`}>
                                                <Icon
                                                    name={task.list === 'Inbox' ? 'inbox' : (task.list === 'Trash' ? 'trash' : 'list')}
                                                    size={15} strokeWidth={1}
                                                    className="mr-2 mt-[2px] flex-shrink-0 text-grey-medium opacity-80"
                                                    aria-hidden="true"/>
                                                <div className="flex-1 overflow-hidden">
                                                    <Highlighter {...highlighterProps}
                                                                 textToHighlight={task.title || 'Untitled Task'}
                                                                 className={twMerge("block truncate font-normal text-grey-dark", task.completed && task.list !== 'Trash' && "line-through text-grey-medium", task.list === 'Trash' && "italic text-grey-medium")}/>
                                                    {task.content && generateContentSnippet(task.content, debouncedSearchTerm) && (
                                                        <Highlighter {...highlighterProps}
                                                                     textToHighlight={generateContentSnippet(task.content, debouncedSearchTerm)}
                                                                     className="block truncate text-[11px] font-light text-grey-medium mt-0.5"/>)}
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                ) : (
                                    <p className="text-[12px] text-grey-medium text-center py-4 px-2 italic font-light">No
                                        tasks found matching "{debouncedSearchTerm}".</p>)}
                            </motion.div>
                        ) : (
                            <motion.div key="filters" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                                        transition={{duration: 0.15, ease: 'linear'}} className="px-0.5 pb-2">
                                <nav className="mb-1">
                                    <SidebarItem to="/all" filter="all" icon="archive" label="All Tasks"
                                                 count={counts.all}/>
                                    <SidebarItem to="/today" filter="today" icon="sun" label="Today"
                                                 count={counts.today}/>
                                    <SidebarItem to="/next7days" filter="next7days" icon="calendar" label="Next 7 Days"
                                                 count={counts.next7days}/>
                                    <SidebarItem to="/list/Inbox" filter="list-Inbox" icon="inbox" label="Inbox"
                                                 count={counts.lists['Inbox']}/>
                                </nav>
                                {/* Removed icon="folder" prop */}
                                <CollapsibleSection title="My Lists"
                                                    action={
                                                        <Button variant="ghost" size="icon" icon="plus"
                                                            // Removed opacity classes for hover-to-show, button is now always visible
                                                                className="w-6 h-6 text-grey-medium hover:text-primary hover:bg-grey-ultra-light"
                                                                iconProps={{size: 16, strokeWidth: 1.5}}
                                                                onClick={handleAddNewListClick}
                                                                aria-label="Add New List"/>
                                                    }>
                                    {myListsToDisplay.length === 0 ? (
                                        <p className="text-[12px] text-grey-medium px-2 py-1 italic font-light">
                                            No custom lists yet.</p>) : (myListsToDisplay.map(listName => (
                                        <SidebarItem key={listName} to={`/list/${encodeURIComponent(listName)}`}
                                                     filter={`list-${listName}`} icon="list" label={listName}
                                                     count={counts.lists[listName]} isUserList={true}/>)))}
                                </CollapsibleSection>
                                {/* Removed icon="tag" prop */}
                                {tagsToDisplay.length > 0 && (<CollapsibleSection title="Tags"
                                                                                  initiallyOpen={false}> {tagsToDisplay.map(tagName => (
                                    <SidebarItem key={tagName} to={`/tag/${encodeURIComponent(tagName)}`}
                                                 filter={`tag-${tagName}`} icon="tag" label={`#${tagName}`}
                                                 count={counts.tags[tagName]}/>))} </CollapsibleSection>)}
                                {/* System section does not use a leading icon by default */}
                                <CollapsibleSection title="System" initiallyOpen={false}>
                                    <SidebarItem to="/completed" filter="completed" icon="check-square"
                                                 label="Completed" count={counts.completed}/>
                                    <SidebarItem to="/trash" filter="trash" icon="trash" label="Trash"
                                                 count={counts.trash}/>
                                </CollapsibleSection>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </aside>
            <AddListModal onAdd={handleListAdded}/>
        </>
    );
};
Sidebar.displayName = 'Sidebar';
export default Sidebar;