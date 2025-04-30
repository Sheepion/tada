// src/components/layout/MainLayout.tsx
import React, { Suspense, useMemo } from 'react'; // Added useMemo
import { Outlet, useLocation } from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import { useAtomValue } from 'jotai';
import { isSettingsOpenAtom, searchTermAtom } from '@/store/atoms';
import Icon from "@/components/common/Icon";
import { twMerge } from 'tailwind-merge';

// Simple loading spinner component
const LoadingSpinner: React.FC = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-glass/70 backdrop-blur-md z-50">
        <Icon name="loader" size={32} className="text-primary animate-spin" />
    </div>
);
LoadingSpinner.displayName = 'LoadingSpinner'; // Add display name

const MainLayout: React.FC = () => {
    const isSettingsOpen = useAtomValue(isSettingsOpenAtom);
    const searchTerm = useAtomValue(searchTermAtom);
    const location = useLocation();

    // Performance: Memoize sidebar visibility calculation
    const hideSidebar = useMemo(() => {
        // Hide Sidebar if NOT searching AND on Calendar or Summary pages
        const isSearching = searchTerm.trim().length > 0;
        return !isSearching && ['/calendar', '/summary'].some(path => location.pathname.startsWith(path));
    }, [searchTerm, location.pathname]);

    return (
        <div className="flex h-screen bg-canvas-alt overflow-hidden font-sans">
            <IconBar />

            {/* Conditional Sidebar rendering */}
            {!hideSidebar && (
                <div className="w-56 flex-shrink-0 h-full relative"> {/* Fixed width */}
                    <Sidebar />
                </div>
            )}

            {/* Main Content Area */}
            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col min-w-0", // Flex properties for layout
                "bg-glass/30 backdrop-blur-lg" // Background styling
            )}>
                {/* Suspense for lazy-loaded route components */}
                <Suspense fallback={<LoadingSpinner />}>
                    <Outlet /> {/* Renders the matched child route */}
                </Suspense>
            </main>

            {/* Modals - Rendered conditionally based on Jotai state */}
            {/* Key added to ensure modal remounts and potentially resets state if needed */}
            {isSettingsOpen && <SettingsModal key={`settings-modal-${isSettingsOpen}`} />}
            {/* AddListModal is rendered within Sidebar */}
        </div>
    );
};
MainLayout.displayName = 'MainLayout'; // Add display name
export default MainLayout;