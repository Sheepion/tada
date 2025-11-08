import React, { Suspense, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import {
    aiSettingsAtom,
    appearanceSettingsAtom,
    preferencesSettingsAtom,
    storedSummariesAtom,
    tasksAtom,
    userListsAtom,
} from '@/store/jotai';
import AppRouter from '@/router';
import SettingsApplicator from '@/components/global/SettingsApplicator';
import DailyTaskRefresh from '@/components/global/DailyTaskRefresh';
import GlobalStatusDisplay from '@/components/global/GlobalStatusDisplay';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import storageManager from '@/services/storageManager';

const App: React.FC = () => {
    // These calls ensure the atoms are initialized and start loading data
    // from localStorage on app load. Their values are used by other components.
    useAtomValue(tasksAtom);
    useAtomValue(userListsAtom);
    useAtomValue(appearanceSettingsAtom);
    useAtomValue(preferencesSettingsAtom);
    useAtomValue(aiSettingsAtom);
    useAtomValue(storedSummariesAtom);

    // 确保应用卸载时刷新所有待处理的写入
    useEffect(() => {
        return () => {
            storageManager.flush().catch(err => {
                console.error('Failed to flush on app unmount:', err);
            });
        };
    }, []);

    return (
        <>
            {/* Global non-visual components */}
            <SettingsApplicator />
            <DailyTaskRefresh />

            {/* Global UI components */}
            <GlobalStatusDisplay />

            {/* Main application content with routing */}
            <Suspense fallback={<LoadingSpinner />}>
                <AppRouter />
            </Suspense>
        </>
    );
};

App.displayName = 'App';
export default App;