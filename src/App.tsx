// src/App.tsx
import React, {useEffect, useRef} from 'react';
import { Routes, Route, useParams, Navigate, useLocation, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom, useSetAtom } from 'jotai';
import { currentFilterAtom, selectedTaskIdAtom, tasksAtom } from './store/atoms';
import { startOfDay } from "@/utils/dateUtils"; // Correct import path

// Route Change Handler Component
// Updates filter state based on URL, resets selection. Search term is NOT reset here.
const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const location = useLocation();
    const params = useParams();

    useEffect(() => {
        const { pathname } = location;
        const listName = params.listName ? decodeURIComponent(params.listName) : '';
        const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';

        let newFilter: TaskFilter = 'all'; // Default filter

        // Determine filter based on path
        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`;
        else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
        else if (pathname === '/summary') newFilter = 'all'; // Use 'all' context for summary
        else if (pathname === '/calendar') newFilter = 'all'; // Use 'all' context for calendar
        else if (pathname === '/all' || pathname === '/') newFilter = 'all';

        // Update filter only if it has actually changed
        if (currentFilterInternal !== newFilter) {
            // console.log(`Route Change: Filter changing from ${currentFilterInternal} to ${newFilter}`);
            setCurrentFilter(newFilter);
            // Reset selection when the main filter context changes
            // This prevents showing details of a task that might not be in the new view
            setSelectedTaskId(null);
        }
    }, [location.pathname, params.listName, params.tagName, currentFilterInternal, setCurrentFilter, setSelectedTaskId]);

    return <Outlet />; // Renders the matched child route component (e.g., MainPage, SummaryPage)
};

// List Page Wrapper Component
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    // Decode list name from URL param, default to 'Inbox' if undefined/empty
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';
    // Redirect if decoded name is somehow empty (shouldn't happen with default)
    if (!decodedListName) return <Navigate to="/list/Inbox" replace />;
    const filter: TaskFilter = `list-${decodedListName}`;
    // Pass filter for context, MainPage will use global state primarily
    return <MainPage title={decodedListName} filter={filter} />;
};
ListPageWrapper.displayName = 'ListPageWrapper'; // Add display name

// Tag Page Wrapper Component
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';
    // Redirect to 'all' if tag name is missing
    if (!decodedTagName) return <Navigate to="/all" replace />;
    const filter: TaskFilter = `tag-${decodedTagName}`;
    // Pass filter for context, MainPage will use global state primarily
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};
TagPageWrapper.displayName = 'TagPageWrapper'; // Add display name

// Component to trigger task category refresh when the date changes
const DailyTaskRefresh: React.FC = () => {
    const setTasks = useSetAtom(tasksAtom);
    // Store only the date part (YYYY-MM-DD) for comparison
    const lastCheckDateRef = useRef<string>(startOfDay(new Date()).toISOString().split('T')[0]);

    useEffect(() => {
        const checkDate = () => {
            const todayDate = startOfDay(new Date()).toISOString().split('T')[0];
            if (todayDate !== lastCheckDateRef.current) {
                console.log(`Date changed from ${lastCheckDateRef.current} to ${todayDate}. Triggering task category refresh.`);
                // Trigger a write to tasksAtom. The refined setter logic now handles recalculating all categories
                // Triggering a write by passing the current state forces the setter logic to run
                setTasks(currentTasks => [...currentTasks]); // Create new array reference to trigger update
                lastCheckDateRef.current = todayDate; // Update last check date
            }
        };

        // Check immediately on mount
        checkDate();

        // Set up interval to check periodically (e.g., every minute) as focus might not always trigger reliably
        const intervalId = setInterval(checkDate, 60 * 1000); // Check every minute

        // Check when window gains focus (useful for returning to the app)
        window.addEventListener('focus', checkDate);

        // Cleanup listeners and interval on unmount
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', checkDate);
        };
    }, [setTasks]); // Dependency on setTasks

    return null; // This component doesn't render anything visual
};
DailyTaskRefresh.displayName = 'DailyTaskRefresh'; // Add display name

// Main Application Component
const App: React.FC = () => {
    return (
        <>
            {/* Include the DailyTaskRefresh component to handle date changes */}
            <DailyTaskRefresh />
            <Routes>
                {/* MainLayout provides the IconBar and potentially the Sidebar */}
                <Route path="/" element={<MainLayout />}>
                    {/* RouteChangeHandler sits inside MainLayout and manages filter state based on URL changes */}
                    <Route element={<RouteChangeHandler/>}>
                        {/* Index route redirects to the default view ('all' tasks) */}
                        <Route index element={<Navigate to="/all" replace />} />
                        {/* Standard filter views */}
                        <Route path="all" element={<MainPage title="All Tasks" filter="all" />} />
                        <Route path="today" element={<MainPage title="Today" filter="today" />} />
                        <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days" />} />
                        <Route path="completed" element={<MainPage title="Completed" filter="completed" />} />
                        <Route path="trash" element={<MainPage title="Trash" filter="trash" />} />
                        {/* Dedicated views */}
                        <Route path="summary" element={<SummaryPage />} />
                        <Route path="calendar" element={<CalendarPage />} />
                        {/* Dynamic list view */}
                        <Route path="list/:listName" element={<ListPageWrapper />} />
                        <Route path="list/" element={<Navigate to="/list/Inbox" replace />} /> {/* Handle empty list path */}
                        {/* Dynamic tag view */}
                        <Route path="tag/:tagName" element={<TagPageWrapper />} />
                        <Route path="tag/" element={<Navigate to="/all" replace />} /> {/* Handle empty tag path */}
                        {/* Catch-all route redirects to 'all' */}
                        <Route path="*" element={<Navigate to="/all" replace />} />
                    </Route>
                </Route>
            </Routes>
        </>
    );
};
App.displayName = 'App'; // Add display name
export default App;