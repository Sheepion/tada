// src/components/layout/IconBar.tsx
import React, {memo, useCallback, useMemo} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import Icon from '../common/Icon';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom} from '@/store/atoms';
import {twMerge} from 'tailwind-merge';
import Button from "@/components/common/Button";
import {IconName} from "@/components/common/IconMap";
// Import Radix Tooltip
import * as Tooltip from '@radix-ui/react-tooltip';

const IconBar: React.FC = memo(() => {
    const currentUser = useAtomValue(currentUserAtom);
    // Control Settings Dialog open state
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    // Set settings tab to default when opening from avatar
    const setSettingsTab = useSetAtom(settingsSelectedTabAtom);
    const location = useLocation();

    const navigationItems: { path: string; icon: IconName, label: string }[] = useMemo(() => [
        {path: '/all', icon: 'archive', label: 'All Tasks'}, // Represents the main task section
        {path: '/calendar', icon: 'calendar-days', label: 'Calendar'},
        {path: '/summary', icon: 'sparkles', label: 'AI Summary'},
    ], []);

    // Open settings modal and set default tab
    const handleAvatarClick = useCallback(() => {
        setSettingsTab('account'); // Reset to account tab when opening
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen, setSettingsTab]);

    // --- CORRECTED: Active state logic based on section ---
    const getNavLinkClass = useCallback((itemPath: string): string => {
        // Determine the active state based on the current location pathname representing the broader section
        let isSectionActive = false;
        const currentPath = location.pathname;

        if (itemPath === '/calendar') {
            // Calendar section is active if the path starts with /calendar
            isSectionActive = currentPath.startsWith('/calendar');
        } else if (itemPath === '/summary') {
            // Summary section is active if the path starts with /summary
            isSectionActive = currentPath.startsWith('/summary');
        } else if (itemPath === '/all') {
            // The 'All Tasks' icon represents the main task management area.
            // It should be active for any path *not* starting with /calendar or /summary.
            // This covers /, /all, /today, /list/*, /tag/*, etc.
            isSectionActive = !currentPath.startsWith('/calendar') && !currentPath.startsWith('/summary');
        }

        // Apply styles based on the calculated section activity
        return twMerge(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-30 ease-apple group relative', // Ensure flex centering
            isSectionActive // Use the calculated section activity
                ? 'bg-primary/25 text-primary backdrop-blur-md ring-1 ring-inset ring-primary/30' // Active state style
                : 'text-muted-foreground hover:bg-black/20 hover:text-gray-700 hover:backdrop-blur-sm', // Inactive state style
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-glass-alt-100' // Focus style
        );
    }, [location.pathname]); // Recalculate when pathname changes

    // Tooltip content class
    const tooltipContentClass = "text-xs bg-black/80 text-white px-2 py-1 rounded shadow-md select-none z-[60] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut";

    return (
        <div
            className="w-16 bg-glass-alt-100 backdrop-blur-xl border-r border-black/10 flex flex-col items-center py-4 flex-shrink-0 z-20 shadow-strong">
            {/* App Logo */}
            <div
                className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary/90 to-blue-500/80 rounded-lg text-white font-bold text-xl shadow-inner select-none"
                aria-label="Tada App Logo" title="Tada">
                <span className="-mt-0.5">T</span>
            </div>

            {/* Main Navigation */}
            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    // Wrap NavLink with Tooltip components
                    <Tooltip.Root key={item.path} delayDuration={300}>
                        <Tooltip.Trigger asChild>
                            <NavLink
                                to={item.path}
                                className={getNavLinkClass(item.path)} // Apply the calculated class string directly
                                aria-label={item.label}
                                // `end` prop is not needed here as our custom logic determines section activity
                            >
                                {/* Icon is centered due to NavLink's flex properties */}
                                <Icon name={item.icon} size={20} strokeWidth={1.75}/>
                            </NavLink>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className={tooltipContentClass} side="right" sideOffset={6}>
                                {item.label}
                                <Tooltip.Arrow className="fill-black/80"/>
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                ))}
            </nav>

            {/* User Avatar / Settings Trigger */}
            <div className="mt-auto mb-1">
                <Tooltip.Root delayDuration={300}>
                    <Tooltip.Trigger asChild>
                        {/* Button triggers the settings modal */}
                        <Button
                            onClick={handleAvatarClick}
                            variant="glass" size="icon"
                            className="w-9 h-9 rounded-full overflow-hidden p-0 border border-black/10 shadow-inner hover:bg-black/15 backdrop-blur-md focus-visible:ring-offset-glass-alt-100" // Adjust offset color
                            aria-label="Account Settings"
                        >
                            {currentUser?.avatar ? (
                                <img src={currentUser.avatar} alt={currentUser.name || 'User Avatar'}
                                     className="w-full h-full object-cover"/>
                            ) : (
                                <div
                                    className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-medium text-sm">
                                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() :
                                        <Icon name="user" size={16}/>}
                                </div>
                            )}
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className={tooltipContentClass} side="right" sideOffset={6}>
                            Account Settings
                            <Tooltip.Arrow className="fill-black/80"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>
        </div>
    );
});
IconBar.displayName = 'IconBar';
export default IconBar;