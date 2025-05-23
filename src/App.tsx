// src/App.tsx
import React, {useEffect, useRef} from 'react';
import {Navigate, Outlet, Route, Routes, useLocation, useParams} from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import MainPage from './pages/MainPage';
import SummaryPage from './pages/SummaryPage';
import CalendarPage from './pages/CalendarPage';
import {TaskFilter} from './types';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {
    appearanceSettingsAtom,
    currentFilterAtom,
    preferencesSettingsAtom,
    selectedTaskIdAtom,
    tasksAtom
} from './store/atoms';
import {startOfDay} from "@/utils/dateUtils";
import {APP_THEMES} from "@/config/themes";

// Component to apply global settings (theme, dark mode, background)
const SettingsApplicator: React.FC = () => {
    const appearance = useAtomValue(appearanceSettingsAtom);

    useEffect(() => {
        const applyDarkMode = (mode: 'light' | 'dark' | 'system') => {
            if (mode === 'system') {
                const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', systemPrefersDark);
            } else {
                document.documentElement.classList.toggle('dark', mode === 'dark');
            }
        };

        applyDarkMode(appearance.darkMode);

        // Listener for system preference changes if 'system' mode is selected
        let mediaQueryListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | undefined;
        if (appearance.darkMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQueryListener = () => applyDarkMode('system');
            mediaQuery.addEventListener('change', mediaQueryListener);
        }

        // Theme Color
        const selectedTheme = APP_THEMES.find(theme => theme.id === appearance.themeId) || APP_THEMES[0];
        document.documentElement.style.setProperty('--color-primary-hsl', selectedTheme.colors.primary);
        document.documentElement.style.setProperty('--color-primary-light-hsl', selectedTheme.colors.light);
        document.documentElement.style.setProperty('--color-primary-dark-hsl', selectedTheme.colors.dark);

        // Background Image
        if (appearance.backgroundImageUrl && appearance.backgroundImageUrl !== 'none') {
            document.body.style.backgroundImage = `url('${appearance.backgroundImageUrl}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.style.backgroundAttachment = 'fixed';
        } else {
            document.body.style.backgroundImage = 'none';
        }
        // Background Image Filters
        // A dedicated overlay div for blur would be more robust, but for simplicity:
        const filterValue = `brightness(${appearance.backgroundImageBrightness}%) ${appearance.backgroundImageBlur > 0 ? `blur(${appearance.backgroundImageBlur}px)` : ''}`;
        document.body.style.filter = filterValue.trim() || 'none';


        return () => {
            if (mediaQueryListener && appearance.darkMode === 'system') {
                window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
            }
        };
    }, [appearance]);

    const preferences = useAtomValue(preferencesSettingsAtom);
    useEffect(() => {
        document.documentElement.lang = preferences.language;
    }, [preferences.language]);

    return null;
};
SettingsApplicator.displayName = 'SettingsApplicator';

// Route Change Handler Component
const RouteChangeHandler: React.FC = () => {
    const [currentFilterInternal, setCurrentFilter] = useAtom(currentFilterAtom);
    const setSelectedTaskId = useSetAtom(selectedTaskIdAtom);
    const location = useLocation();
    const params = useParams();

    useEffect(() => {
        const {pathname} = location;
        const listName = params.listName ? decodeURIComponent(params.listName) : '';
        const tagName = params.tagName ? decodeURIComponent(params.tagName) : '';

        let newFilter: TaskFilter = 'all';

        if (pathname === '/today') newFilter = 'today';
        else if (pathname === '/next7days') newFilter = 'next7days';
        else if (pathname === '/completed') newFilter = 'completed';
        else if (pathname === '/trash') newFilter = 'trash';
        else if (pathname.startsWith('/list/') && listName) newFilter = `list-${listName}`;
        else if (pathname.startsWith('/tag/') && tagName) newFilter = `tag-${tagName}`;
        else if (pathname === '/summary') newFilter = 'all';
        else if (pathname === '/calendar') newFilter = 'all';
        else if (pathname === '/all' || pathname === '/') newFilter = 'all';

        if (currentFilterInternal !== newFilter) {
            setCurrentFilter(newFilter);
            setSelectedTaskId(null);
        }
    }, [location.pathname, params.listName, params.tagName, currentFilterInternal, setCurrentFilter, setSelectedTaskId]);

    return <Outlet/>;
};
RouteChangeHandler.displayName = 'RouteChangeHandler';

// List Page Wrapper Component
const ListPageWrapper: React.FC = () => {
    const {listName} = useParams<{ listName: string }>();
    const decodedListName = listName ? decodeURIComponent(listName) : 'Inbox';
    if (!decodedListName) return <Navigate to="/list/Inbox" replace/>;
    const filter: TaskFilter = `list-${decodedListName}`;
    return <MainPage title={decodedListName} filter={filter}/>;
};
ListPageWrapper.displayName = 'ListPageWrapper';

// Tag Page Wrapper Component
const TagPageWrapper: React.FC = () => {
    const {tagName} = useParams<{ tagName: string }>();
    const decodedTagName = tagName ? decodeURIComponent(tagName) : '';
    if (!decodedTagName) return <Navigate to="/all" replace/>;
    const filter: TaskFilter = `tag-${decodedTagName}`;
    return <MainPage title={`#${decodedTagName}`} filter={filter}/>;
};
TagPageWrapper.displayName = 'TagPageWrapper';

const DailyTaskRefresh: React.FC = () => {
    const setTasks = useSetAtom(tasksAtom);
    const lastCheckDateRef = useRef<string>(startOfDay(new Date()).toISOString().split('T')[0]);

    useEffect(() => {
        const checkDate = () => {
            const todayDate = startOfDay(new Date()).toISOString().split('T')[0];
            if (todayDate !== lastCheckDateRef.current) {
                console.log(`Date changed from ${lastCheckDateRef.current} to ${todayDate}. Triggering task category refresh.`);
                setTasks(currentTasks => [...currentTasks]);
                lastCheckDateRef.current = todayDate;
            }
        };
        checkDate();
        const intervalId = setInterval(checkDate, 60 * 1000);
        window.addEventListener('focus', checkDate);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', checkDate);
        };
    }, [setTasks]);

    return null;
};
DailyTaskRefresh.displayName = 'DailyTaskRefresh';

const App: React.FC = () => {
    return (
        <>
            <SettingsApplicator/>
            <DailyTaskRefresh/>
            <Routes>
                <Route path="/" element={<MainLayout/>}>
                    <Route element={<RouteChangeHandler/>}>
                        <Route index element={<Navigate to="/all" replace/>}/>
                        <Route path="all" element={<MainPage title="All Tasks" filter="all"/>}/>
                        <Route path="today" element={<MainPage title="Today" filter="today"/>}/>
                        <Route path="next7days" element={<MainPage title="Next 7 Days" filter="next7days"/>}/>
                        <Route path="completed" element={<MainPage title="Completed" filter="completed"/>}/>
                        <Route path="trash" element={<MainPage title="Trash" filter="trash"/>}/>
                        <Route path="summary" element={<SummaryPage/>}/>
                        <Route path="calendar" element={<CalendarPage/>}/>
                        <Route path="list/:listName" element={<ListPageWrapper/>}/>
                        <Route path="list/" element={<Navigate to="/list/Inbox" replace/>}/>
                        <Route path="tag/:tagName" element={<TagPageWrapper/>}/>
                        <Route path="tag/" element={<Navigate to="/all" replace/>}/>
                        <Route path="*" element={<Navigate to="/all" replace/>}/>
                    </Route>
                </Route>
            </Routes>
        </>
    );
};
App.displayName = 'App';
export default App;