// src/components/layout/IconBar.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../common/Icon';
import { useAtom, useAtomValue } from 'jotai';
import { currentUserAtom, isSettingsOpenAtom } from '@/store/atoms';
import { twMerge } from 'tailwind-merge';
import Button from "@/components/common/Button";
import { IconName } from "@/components/common/IconMap";

// Performance: Memoize IconBar
const IconBar: React.FC = memo(() => {
    const currentUser = useAtomValue(currentUserAtom);
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const location = useLocation(); // Get current location

    const navigationItems: { path: string; icon: IconName, label: string }[] = useMemo(() => [
        { path: '/all', icon: 'archive', label: 'All Tasks' },
        { path: '/calendar', icon: 'calendar-days', label: 'Calendar' },
        { path: '/summary', icon: 'sparkles', label: 'AI Summary' },
    ], []);

    const handleAvatarClick = useCallback(() => {
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen]);

    // Update NavLink class logic to correctly highlight 'All Tasks'
    const getNavLinkClass = useCallback((itemPath: string) => ({ isActive }: { isActive: boolean }): string => {
        let isEffectivelyActive = isActive; // Start with react-router's determination

        // If this is the 'All Tasks' icon...
        if (itemPath === '/all') {
            // It should be active if the current path is *not* Calendar or Summary
            // And also check if the base path is one of the task list views
            const isTaskListRelatedView = !location.pathname.startsWith('/calendar') && !location.pathname.startsWith('/summary');
            isEffectivelyActive = isTaskListRelatedView;
        }
        // For other icons (Calendar, Summary), rely solely on react-router's isActive
        // (assuming their paths are unique prefixes like /calendar, /summary)

        return twMerge(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-30 ease-apple group relative', // Base styling
            isEffectivelyActive
                ? 'bg-primary/25 text-primary backdrop-blur-md ring-1 ring-inset ring-primary/30' // Active state
                : 'text-muted-foreground hover:bg-black/20 hover:text-gray-700 hover:backdrop-blur-sm', // Inactive state
            // Tooltip styles (example - requires a tooltip library setup)
            'before:content-[attr(title)] before:absolute before:left-full before:ml-2 before:px-1.5 before:py-0.5 before:rounded before:bg-black/80 before:text-white before:text-xs before:whitespace-nowrap before:opacity-0 before:invisible group-hover:before:opacity-100 group-hover:before:visible before:transition-opacity before:delay-500 before:z-50'
        );
    }, [location.pathname]); // Dependency on location.pathname

    return (
        <div className="w-16 bg-glass-alt-100 backdrop-blur-xl border-r border-black/10 flex flex-col items-center py-4 flex-shrink-0 z-20 shadow-strong">
            {/* App Logo */}
            <div className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary/90 to-blue-500/80 rounded-lg text-white font-bold text-xl shadow-inner select-none" aria-label="Tada App Logo" title="Tada">
                <span className="-mt-0.5">T</span>
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        // Apply the correct active class logic based on item path
                        className={getNavLinkClass(item.path)}
                        title={item.label} // Title is used for tooltip via CSS pseudo-element
                        aria-label={item.label}
                        // `end` prop ensures exact match for top-level routes like /calendar, /summary
                        // For /all, our custom logic handles sub-routes, so `end` isn't strictly needed there, but doesn't hurt.
                        end={item.path !== '/all'} // only apply 'end' if not '/all'
                    >
                        <Icon name={item.icon} size={20} strokeWidth={1.75} />
                    </NavLink>
                ))}
            </nav>

            {/* User Avatar / Settings Trigger */}
            <div className="mt-auto mb-1">
                <Button
                    onClick={handleAvatarClick}
                    variant="glass" size="icon"
                    className="w-9 h-9 rounded-full overflow-hidden p-0 border border-black/10 shadow-inner hover:bg-black/15 backdrop-blur-md"
                    aria-label="Account Settings"
                    title="Account Settings" // Add tooltip
                >
                    {currentUser?.avatar ? (
                        <img src={currentUser.avatar} alt={currentUser.name || 'User Avatar'} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-medium text-sm">
                            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : <Icon name="user" size={16} />}
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
});
IconBar.displayName = 'IconBar';
export default IconBar;