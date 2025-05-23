// src/components/layout/MainLayout.tsx
import React, {Suspense, useMemo} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import IconBar from './IconBar';
import Sidebar from './Sidebar';
import SettingsModal from '../settings/SettingsModal';
import Icon from "@/components/common/Icon";
import {twMerge} from 'tailwind-merge';

const LoadingSpinner: React.FC = () => (
    <div
        className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-grey-deep/70 z-50 backdrop-blur-sm">
        <Icon name="loader" size={24} className="text-primary dark:text-primary-light animate-spin" strokeWidth={1.5}/>
    </div>
);
LoadingSpinner.displayName = 'LoadingSpinner';

const MainLayout: React.FC = () => {
    const location = useLocation();

    const hideSidebar = useMemo(() => {
        return ['/calendar', '/summary'].some(path => location.pathname.startsWith(path));
    }, [location.pathname]);

    return (
        <div
            className="flex h-screen bg-transparent overflow-hidden font-primary"> {/* Made bg-transparent to allow body background to show */}
            <IconBar/>
            {!hideSidebar && (
                <div className={twMerge(
                    "w-[240px] flex-shrink-0 h-full relative border-r border-grey-light/50 dark:border-grey-deep/50",
                    "bg-white/80 dark:bg-grey-deep/80 backdrop-blur-md transition-colors duration-300" // Semi-transparent with blur
                )}>
                    <Sidebar/>
                </div>
            )}
            <main className={twMerge(
                "flex-1 overflow-hidden relative flex flex-col min-w-0",
                // Pages themselves will define their solid backgrounds, this main container can be transparent or subtly layered
                "bg-transparent" // Or a very subtle overlay: "bg-white/10 dark:bg-black/10"
            )}>
                <Suspense fallback={<LoadingSpinner/>}>
                    <Outlet/>
                </Suspense>
            </main>
            <SettingsModal/>
        </div>
    );
};
MainLayout.displayName = 'MainLayout';
export default MainLayout;