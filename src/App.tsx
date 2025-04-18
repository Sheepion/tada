// src/App.tsx
import React, { useEffect } from 'react';
import { Routes, Route, useParams, Navigate, useLocation, Outlet } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import { TaskFilter } from './types';
import { useAtom, useSetAtom } from 'jotai'; // useSetAtom for setters only
import { currentFilterAtom, selectedTaskIdAtom } from './store/atoms';

// Helper Component to Update Filter State and Clear Selection on Route Change
const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom); // Need getter here to compare
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom); // Only need setter
    const location = useLocation();
    const params = useParams();

    useEffect(() => {
        let newFilter: TaskFilter = 'all'; // Default filter
        let clearSelection = true; // Default to clearing selection

        // Determine filter based on pathname
        const pathname = location.pathname;
        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname === '/all') newFilter = 'all';
        else if (pathname.startsWith('/list/')) {
            const listName = params.listName ? decodeURIComponent(params.listName) : '';
            if (listName) newFilter = `list-${listName}`;
            // Keep selection when switching between list/tag/standard views
            clearSelection = false;
        } else if (pathname.startsWith('/tag/')) {
            const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';
            if (tagName) newFilter = `tag-${tagName}`;
            // Keep selection when switching between list/tag/standard views
            clearSelection = false;
        } else if (pathname === '/summary' || pathname === '/calendar') {
            // Views without a task list filter; keep filter atom as 'all' for sidebar consistency.
            newFilter = 'all'; // Or potentially keep previous filter if desired: `newFilter = currentFilterInternal;`
            clearSelection = true; // Always clear selection for non-list views
        } else if (pathname === '/') {
            newFilter = 'all'; // Index route maps to 'all'
            // Keep selection when initially landing on default route
            clearSelection = false;
        } else {
            // Handle other static routes like 'today', 'all', 'next7days' etc.
            clearSelection = false;
        }


        // Update filter atom only if it changed
        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            // Clear selection only when the filter *type* changes drastically (e.g., list to calendar)
            // or navigating to special views like completed/trash.
            if (clearSelection || ['completed', 'trash'].includes(newFilter)) {
                setSelectedTaskId(null);
            }
        }

        // Always clear selection specifically for calendar and summary views regardless of filter change
        if (pathname === '/summary' || pathname === '/calendar') {
            setSelectedTaskId(null);
        }


    }, [location.pathname, params, currentFilterInternal, setCurrentFilter, setSelectedTaskId]); // Add dependencies

    return <Outlet />; // Render nested routes
};


// Wrapper for List Pages to extract params and pass props
const ListPageWrapper: React.FC = () => {
    const { listName } = useParams<{ listName: string }>();
    // Default to 'Inbox' if listName is somehow undefined or empty after decode
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';

    // Redirect if listName is invalid (e.g., empty after decode, though unlikely now with default)
    if (!decodedListName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter} />;
};

// Wrapper for Tag Pages
const TagPageWrapper: React.FC = () => {
    const { tagName } = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';

    if (!decodedTagName) return <Navigate to="/all" replace />;

    const filter: TaskFilter = `tag-${decodedTagName}`;
    // Use # prefix for title display
    return <MainPage title={`#${decodedTagName}`} filter={filter} />;
};


// Main Application Component with Routing Setup
const App: React.FC = () => {
    return (
        <Routes>
            {/* Main Layout wraps all primary routes */}
            <Route path="/" element={<MainLayout />}>
                {/* RouteChangeHandler sits inside MainLayout to access context and handle changes */}
                <Route element={<RouteChangeHandler/>}>
                    {/* Index route defaults to 'All Tasks' */}
                    {/* Redirect index to /all to ensure a filter is always active */}
                    <Route index element={<Navigate to="/all" replace />} />

                    {/* Static Filter Routes */}
                    <Route path="all" element={<MainPage title="All Tasks" filter="all" />} />
                    <Route path="today" element={<MainPage title="Today" filter="today" />} />
                    <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days" />} />
                    <Route path="completed" element={<MainPage title="Completed" filter="completed" />} />
                    <Route path="trash" element={<MainPage title="Trash" filter="trash" />} />

                    {/* Standalone Views (Sidebar is hidden via MainLayout logic) */}
                    <Route path="summary" element={<SummaryPage />} />
                    <Route path="calendar" element={<CalendarPage />} />

                    {/* Dynamic routes for lists and tags */}
                    <Route path="list/:listName" element={<ListPageWrapper />} />
                    <Route path="tag/:tagName" element={<TagPageWrapper />} />

                    {/* Fallback route - redirect any unmatched paths to the default view */}
                    <Route path="*" element={<Navigate to="/all" replace />} />
                </Route>
            </Route>
        </Routes>
    );
};

export default App;