// src/components/layout/IconBar.tsx
import React, {memo, useCallback, useMemo} from 'react';
import {NavLink, useLocation} from 'react-router-dom';
import Icon from '../common/Icon';
import {useAtom, useAtomValue, useSetAtom} from 'jotai';
import {currentUserAtom, isSettingsOpenAtom, settingsSelectedTabAtom} from '@/store/atoms';
import {twMerge} from 'tailwind-merge';
import Button from "@/components/common/Button";
import {IconName} from "@/components/common/IconMap";
import * as Tooltip from '@radix-ui/react-tooltip';

const IconBar: React.FC = memo(() => {
    const currentUser = useAtomValue(currentUserAtom);
    const [, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const setSettingsTab = useSetAtom(settingsSelectedTabAtom);
    const location = useLocation();

    const navigationItems: { path: string; icon: IconName, label: string }[] = useMemo(() => [
        {path: '/all', icon: 'archive', label: 'All Tasks'},
        {path: '/calendar', icon: 'calendar-days', label: 'Calendar'},
        {path: '/summary', icon: 'sparkles', label: 'AI Summary'},
    ], []);

    const handleAvatarClick = useCallback(() => {
        setSettingsTab('account');
        setIsSettingsOpen(true);
    }, [setIsSettingsOpen, setSettingsTab]);

    const getNavLinkClass = useCallback((itemPath: string): string => {
        let isSectionActive = false;
        const currentPath = location.pathname;
        if (itemPath === '/calendar') isSectionActive = currentPath.startsWith('/calendar');
        else if (itemPath === '/summary') isSectionActive = currentPath.startsWith('/summary');
        else if (itemPath === '/all') isSectionActive = !currentPath.startsWith('/calendar') && !currentPath.startsWith('/summary');

        return twMerge(
            'flex items-center justify-center w-10 h-10 rounded-base transition-colors duration-200 ease-in-out group relative',
            isSectionActive
                ? 'bg-grey-ultra-light text-primary dark:bg-primary-dark/20 dark:text-primary-light' // Adjusted active state for dark mode
                : 'text-grey-medium hover:bg-grey-ultra-light hover:text-grey-dark dark:text-neutral-400 dark:hover:bg-grey-deep dark:hover:text-neutral-100',
            'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep'
        );
    }, [location.pathname]);

    const tooltipContentClass = "text-[11px] bg-grey-dark text-white px-2 py-1 rounded-base shadow-md select-none z-[60] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut dark:bg-neutral-900 dark:text-neutral-100";

    return (
        <div
            className={twMerge(
                "w-16 flex flex-col items-center py-4 flex-shrink-0 z-20 border-r border-grey-light/50 dark:border-grey-deep/50",
                "bg-white/80 dark:bg-grey-deep/80 backdrop-blur-md transition-colors duration-300" // Semi-transparent with blur
            )}
        >
            <div
                className="mb-6 mt-1 flex items-center justify-center w-9 h-9 bg-primary rounded-base text-white font-medium text-xl select-none"
                aria-label="Tada App Logo" title="Tada">
                <span className="-mt-0.5">T</span>
            </div>

            <nav className="flex flex-col items-center space-y-2 flex-1">
                {navigationItems.map((item) => (
                    <Tooltip.Root key={item.path} delayDuration={200}>
                        <Tooltip.Trigger asChild>
                            <NavLink to={item.path} className={getNavLinkClass(item.path)} aria-label={item.label}>
                                <Icon name={item.icon} size={20} strokeWidth={1}/>
                            </NavLink>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className={tooltipContentClass} side="right" sideOffset={6}>
                                {item.label}
                                <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900"/>
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                ))}
            </nav>

            <div className="mt-auto mb-1">
                <Tooltip.Root delayDuration={200}>
                    <Tooltip.Trigger asChild>
                        <Button onClick={handleAvatarClick} variant="ghost" size="icon"
                                className="w-9 h-9 rounded-full overflow-hidden p-0 hover:bg-grey-ultra-light dark:hover:bg-grey-deep focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep"
                                aria-label="Account Settings">
                            {currentUser?.avatar ? (
                                <img src={currentUser.avatar} alt={currentUser.name || 'User Avatar'}
                                     className="w-full h-full object-cover"/>
                            ) : (
                                <div
                                    className="w-full h-full bg-grey-light dark:bg-neutral-600 flex items-center justify-center text-grey-medium dark:text-neutral-300 font-normal text-sm">
                                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() :
                                        <Icon name="user" size={16} strokeWidth={1}/>}
                                </div>
                            )}
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content className={tooltipContentClass} side="right" sideOffset={6}>
                            Account Settings
                            <Tooltip.Arrow className="fill-grey-dark dark:fill-neutral-900"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root>
            </div>
        </div>
    );
});
IconBar.displayName = 'IconBar';
export default IconBar;