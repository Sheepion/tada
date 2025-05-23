// src/components/settings/SettingsModal.tsx
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAtom, useAtomValue} from 'jotai';
import {
    appearanceSettingsAtom,
    currentUserAtom,
    DarkModeOption,
    DefaultNewTaskDueDate,
    isSettingsOpenAtom,
    preferencesSettingsAtom,
    premiumSettingsAtom,
    settingsSelectedTabAtom,
    userListNamesAtom,
} from '@/store/atoms';
import {SettingsTab} from '@/types';
import Icon from '../common/Icon';
import Button from '../common/Button';
import {twMerge} from 'tailwind-merge';
import {IconName} from "@/components/common/IconMap";
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import * as RadioGroup from '@radix-ui/react-radio-group';
import * as RadixSwitch from '@radix-ui/react-switch'; // <-- ADDED THIS IMPORT
import {
    APP_THEMES,
    APP_VERSION,
    CHANGELOG_HTML,
    PREDEFINED_BACKGROUND_IMAGES,
    PRIVACY_POLICY_HTML,
    TERMS_OF_USE_HTML
} from '@/config/themes';

interface SettingsItem {
    id: SettingsTab;
    label: string;
    icon: IconName;
}

const settingsSections: SettingsItem[] = [
    {id: 'account', label: 'Account', icon: 'user'},
    {id: 'appearance', label: 'Appearance', icon: 'settings'},
    {id: 'preferences', label: 'Preferences', icon: 'sliders'},
    {id: 'premium', label: 'Premium', icon: 'crown'},
    {id: 'about', label: 'About', icon: 'info'},
];

const SettingsRow: React.FC<{
    label: string,
    value?: React.ReactNode,
    action?: React.ReactNode,
    children?: React.ReactNode,
    description?: string,
    htmlFor?: string,
}> = memo(({label, value, action, children, description, htmlFor}) => (
    <div className="flex justify-between items-center py-3 min-h-[48px]">
        <div className="flex-1 mr-4">
            <label htmlFor={htmlFor}
                   className="text-[13px] text-grey-dark dark:text-neutral-200 font-normal block cursor-default">{label}</label>
            {description &&
                <p className="text-[11px] text-grey-medium dark:text-neutral-400 mt-0.5 font-light">{description}</p>}
        </div>
        <div
            className="text-[13px] text-grey-dark dark:text-neutral-200 font-light flex items-center space-x-2 flex-shrink-0">
            {value && !action && !children &&
                <span className="text-grey-medium dark:text-neutral-300 text-right font-normal">{value}</span>}
            {action && !children && <div className="flex justify-end">{action}</div>}
            {children && <div className="flex justify-end space-x-2">{children}</div>}
        </div>
    </div>
));
SettingsRow.displayName = 'SettingsRow';

// Dark Mode Selector Component
const DarkModeSelector: React.FC<{ value: DarkModeOption; onChange: (value: DarkModeOption) => void; }> = memo(({
                                                                                                                    value,
                                                                                                                    onChange
                                                                                                                }) => {
    const options: { value: DarkModeOption; label: string; icon: IconName }[] = [
        {value: 'light', label: 'Light', icon: 'sun'},
        {value: 'dark', label: 'Dark', icon: 'moon'},
        {value: 'system', label: 'System', icon: 'settings'},
    ];

    return (
        <RadioGroup.Root
            value={value}
            onValueChange={onChange}
            className="flex space-x-1 p-0.5 bg-grey-ultra-light dark:bg-neutral-700 rounded-base"
            aria-label="Appearance mode"
        >
            {options.map(option => (
                <RadioGroup.Item
                    key={option.value}
                    value={option.value}
                    id={`darkMode-${option.value}`}
                    className={twMerge(
                        "flex-1 flex items-center justify-center px-2.5 py-1 h-7 rounded-[4px] text-[12px] font-normal transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        value === option.value
                            ? "bg-white dark:bg-neutral-600 text-primary dark:text-primary-light shadow-sm"
                            : "text-grey-medium dark:text-neutral-400 hover:text-grey-dark dark:hover:text-neutral-200"
                    )}
                >
                    <Icon name={option.icon} size={14} strokeWidth={1.5} className="mr-1.5 opacity-80"/>
                    {option.label}
                </RadioGroup.Item>
            ))}
        </RadioGroup.Root>
    );
});
DarkModeSelector.displayName = 'DarkModeSelector';


// Color Swatch Component for Theme Picker
const ColorSwatch: React.FC<{
    colorValue: string;
    selected: boolean;
    onClick: () => void;
    themeName: string;
}> = memo(({colorValue, selected, onClick, themeName}) => (
    <button
        type="button"
        onClick={onClick}
        className={twMerge(
            "w-7 h-7 rounded-full border-2 transition-all duration-150 ease-in-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep",
            selected ? "ring-2 ring-offset-1 ring-current" : "border-transparent hover:border-grey-medium/50 dark:hover:border-neutral-400/50"
        )}
        style={{backgroundColor: `hsl(${colorValue})`, borderColor: selected ? `hsl(${colorValue})` : undefined}}
        aria-label={`Select ${themeName} theme`}
        aria-pressed={selected}
    />
));
ColorSwatch.displayName = 'ColorSwatch';

// Background Image Preview Component
const BackgroundImagePreview: React.FC<{
    imageUrl: string;
    name: string;
    selected: boolean;
    onClick: () => void;
}> = memo(({imageUrl, name, selected, onClick}) => (
    <button
        type="button"
        onClick={onClick}
        className={twMerge(
            "w-full h-20 rounded-base border-2 overflow-hidden relative group transition-all duration-150 ease-in-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-grey-deep",
            selected ? "border-primary dark:border-primary-light" : "border-grey-light hover:border-grey-medium dark:border-neutral-600 dark:hover:border-neutral-400"
        )}
        aria-label={`Select background: ${name}`}
        aria-pressed={selected}
    >
        {imageUrl === 'none' ? (
            <div className="w-full h-full flex items-center justify-center bg-grey-ultra-light dark:bg-grey-deep">
                <Icon name="slash" size={24} className="text-grey-medium dark:text-neutral-500"/>
            </div>
        ) : (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover"/>
        )}
        <div className={twMerge(
            "absolute inset-0 bg-black/20 group-hover:bg-black/10 flex items-center justify-center transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
            {selected && <Icon name="check-circle" size={20} className="text-white"/>}
        </div>
        <span
            className="absolute bottom-1 left-1.5 text-[10px] bg-black/40 text-white px-1 py-0.5 rounded-sm backdrop-blur-sm">{name}</span>
    </button>
));
BackgroundImagePreview.displayName = 'BackgroundImagePreview';


// Account Settings
const AccountSettings: React.FC = memo(() => {
    const [currentUser] = useAtom(currentUserAtom);
    const handleEdit = useCallback(() => console.log("Edit action triggered"), []);
    const handleChangePassword = useCallback(() => console.log("Change password action triggered"), []);
    const handleUnlink = useCallback(() => console.log("Unlink Google action triggered"), []);
    const handleLinkApple = useCallback(() => console.log("Link Apple ID action triggered"), []);
    const handleBackup = useCallback(() => console.log("Backup action triggered"), []);
    const handleImport = useCallback(() => console.log("Import action triggered"), []);
    const handleDeleteAccount = useCallback(() => console.log("Delete account action triggered"), []);
    const handleLogout = useCallback(() => console.log("Logout action triggered"), []);
    const userName = useMemo(() => currentUser?.name ?? 'Guest User', [currentUser?.name]);
    const userEmail = useMemo(() => currentUser?.email ?? 'No email provided', [currentUser?.email]);
    const isPremium = useMemo(() => currentUser?.isPremium ?? false, [currentUser?.isPremium]);
    const avatarSrc = useMemo(() => currentUser?.avatar, [currentUser?.avatar]);
    const avatarInitial = useMemo(() => currentUser?.name?.charAt(0).toUpperCase(), [currentUser?.name]);

    return (<div className="space-y-6">
        <div className="flex items-center space-x-4 mb-4">
            <div
                className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-grey-ultra-light dark:bg-neutral-700">
                {avatarSrc ? (
                    <img src={avatarSrc} alt={userName} className="w-full h-full object-cover"/>
                ) : (
                    <div
                        className="w-full h-full bg-grey-light dark:bg-neutral-600 flex items-center justify-center text-grey-medium dark:text-neutral-400 text-2xl font-normal">
                        {avatarInitial || <Icon name="user" size={24} strokeWidth={1}/>}
                    </div>
                )}
            </div>
            <div>
                <h3 className="text-[18px] font-normal text-grey-dark dark:text-neutral-100">{userName}</h3>
                <p className="text-[13px] text-grey-medium dark:text-neutral-300 font-light">{userEmail}</p>
                {isPremium && (
                    <div
                        className="text-[11px] text-primary dark:text-primary-light flex items-center mt-1.5 font-normal bg-primary-light dark:bg-primary-dark/30 px-2 py-0.5 rounded-full w-fit">
                        <Icon name="crown" size={12} className="mr-1 text-primary dark:text-primary-light"
                              strokeWidth={1.5}/>
                        <span>Premium Member</span>
                    </div>
                )}
            </div>
        </div>
        <div className="space-y-0">
            <SettingsRow label="Name" value={userName}
                         action={<Button variant="link" size="sm" onClick={handleEdit}>Edit</Button>}/>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Email Address" value={userEmail} description="Used for login and notifications."/>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Password" action={<Button variant="link" size="sm" onClick={handleChangePassword}>Change
                Password</Button>}/>
        </div>
        <div className="space-y-0">
            <h4 className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 uppercase tracking-[0.5px] mb-2 mt-4">Connected
                Accounts</h4>
            <SettingsRow label="Google Account" value={currentUser?.email ? "Linked" : "Not Linked"}
                         action={currentUser?.email ? <Button variant="link" size="sm"
                                                              className="text-grey-medium dark:text-neutral-400 hover:text-error dark:hover:text-red-400"
                                                              onClick={handleUnlink}>Unlink</Button> : undefined}/>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Apple ID"
                         action={<Button variant="link" size="sm" onClick={handleLinkApple}>Link Apple ID</Button>}/>
        </div>
        <div className="space-y-0">
            <h4 className="text-[11px] font-normal text-grey-medium dark:text-neutral-400 uppercase tracking-[0.5px] mb-2 mt-4">Data
                Management</h4>
            <SettingsRow label="Backup & Restore" description="Save or load your task data.">
                <Button variant="secondary" size="sm" icon="download" onClick={handleBackup}>Backup</Button>
                <Button variant="secondary" size="sm" icon="upload" onClick={handleImport}>Import</Button>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Delete Account" description="Permanently delete your account and data."
                         action={<Button variant="danger" size="sm" onClick={handleDeleteAccount}>Request
                             Deletion</Button>}/>
        </div>
        <div className="mt-8">
            <Button variant="secondary" size="md" icon="logout" onClick={handleLogout}
                    className="w-full sm:w-auto">Logout</Button>
        </div>
    </div>);
});
AccountSettings.displayName = 'AccountSettings';

// Appearance Settings Component
const AppearanceSettings: React.FC = memo(() => {
    const [appearance, setAppearance] = useAtom(appearanceSettingsAtom);
    const [customBgUrl, setCustomBgUrl] = useState(
        PREDEFINED_BACKGROUND_IMAGES.some(img => img.url === appearance.backgroundImageUrl) || appearance.backgroundImageUrl === 'none'
            ? ''
            : appearance.backgroundImageUrl
    );
    const customBgUrlInputRef = useRef<HTMLInputElement>(null);

    const handleThemeChange = (themeId: string) => setAppearance(s => ({...s, themeId}));
    const handleDarkModeChange = (mode: DarkModeOption) => setAppearance(s => ({...s, darkMode: mode}));
    const handleBgImageChange = (url: string) => {
        setAppearance(s => ({...s, backgroundImageUrl: url}));
        if (!PREDEFINED_BACKGROUND_IMAGES.some(img => img.url === url) && url !== 'none') {
            setCustomBgUrl(url);
        } else {
            setCustomBgUrl('');
        }
    };
    const handleCustomBgUrlApply = () => {
        if (customBgUrl.trim()) {
            if (customBgUrl.startsWith('http://') || customBgUrl.startsWith('https://') || customBgUrl.startsWith('data:image')) {
                handleBgImageChange(customBgUrl.trim());
            } else {
                alert("Please enter a valid image URL (starting with http, https, or data:image).");
                customBgUrlInputRef.current?.focus();
            }
        }
    };

    useEffect(() => {
        if (!PREDEFINED_BACKGROUND_IMAGES.some(img => img.url === appearance.backgroundImageUrl) && appearance.backgroundImageUrl !== 'none') {
            setCustomBgUrl(appearance.backgroundImageUrl);
        } else {
            setCustomBgUrl('');
        }
    }, [appearance.backgroundImageUrl]);


    return (
        <div className="space-y-6">
            <SettingsRow label="Appearance Mode" description="Choose your preferred interface look.">
                <DarkModeSelector value={appearance.darkMode} onChange={handleDarkModeChange}/>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <SettingsRow label="Theme Color" description="Choose an accent color for the application.">
                <div className="flex space-x-2">
                    {APP_THEMES.map(theme => (
                        <ColorSwatch
                            key={theme.id}
                            colorValue={theme.colors.primary}
                            selected={appearance.themeId === theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            themeName={theme.name}
                        />
                    ))}
                </div>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>

            <div>
                <SettingsRow label="Background Image"
                             description="Select a predefined background or set a custom one."/>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1 mb-4">
                    {PREDEFINED_BACKGROUND_IMAGES.map(img => (
                        <BackgroundImagePreview
                            key={img.id}
                            imageUrl={img.url}
                            name={img.name}
                            selected={appearance.backgroundImageUrl === img.url}
                            onClick={() => handleBgImageChange(img.url)}
                        />
                    ))}
                </div>
                <div className="flex items-center space-x-2">
                    <input
                        ref={customBgUrlInputRef}
                        type="url"
                        value={customBgUrl}
                        onChange={(e) => setCustomBgUrl(e.target.value)}
                        placeholder="Enter custom image URL (http://... or data:image/...)"
                        className={twMerge(
                            "flex-grow h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                            "bg-grey-ultra-light dark:bg-neutral-700",
                            "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                            "text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out",
                            "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light"
                        )}
                    />
                    <Button variant="secondary" size="md" onClick={handleCustomBgUrlApply} className="flex-shrink-0">Apply
                        URL</Button>
                </div>
            </div>
        </div>
    );
});
AppearanceSettings.displayName = 'AppearanceSettings';

// Preferences Settings Component
const PreferencesSettings: React.FC = memo(() => {
    const [preferences, setPreferences] = useAtom(preferencesSettingsAtom);
    const userLists = useAtomValue(userListNamesAtom);

    const handleLanguageChange = (value: string) => setPreferences(p => ({...p, language: value as 'en' | 'zh-CN'}));
    const handleDefaultDueDateChange = (value: string) => setPreferences(p => ({
        ...p,
        defaultNewTaskDueDate: value === 'none' ? null : value as DefaultNewTaskDueDate
    }));
    const handleDefaultPriorityChange = (value: string) => setPreferences(p => ({
        ...p,
        defaultNewTaskPriority: value === 'none' ? null : parseInt(value, 10)
    }));
    const handleDefaultListChange = (value: string) => setPreferences(p => ({...p, defaultNewTaskList: value}));
    const handleConfirmDeletionsChange = (checked: boolean) => setPreferences(p => ({...p, confirmDeletions: checked}));


    const dueDateOptions = [
        {value: 'none', label: 'None'},
        {value: 'today', label: 'Today'},
        {value: 'tomorrow', label: 'Tomorrow'},
    ];
    const priorityOptions = [
        {value: 'none', label: 'No Priority'},
        {value: '1', label: 'High (P1)'},
        {value: '2', label: 'Medium (P2)'},
        {value: '3', label: 'Low (P3)'},
    ];
    const listOptions = useMemo(() => ['Inbox', ...userLists.filter(l => l !== 'Inbox')].map(l => ({
        value: l,
        label: l
    })), [userLists]);

    const renderSelect = (id: string, value: string | null, onChange: (value: string) => void, options: {
        value: string,
        label: string
    }[], placeholder: string) => (
        <Select.Root value={value ?? undefined} onValueChange={onChange}>
            <Select.Trigger
                id={id}
                className="flex items-center justify-between w-[160px] h-8 px-3 text-[13px] font-light rounded-base bg-grey-ultra-light dark:bg-neutral-700 text-grey-dark dark:text-neutral-100 hover:bg-grey-light dark:hover:bg-neutral-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label={placeholder}
            >
                <Select.Value placeholder={placeholder}/>
                <Select.Icon className="text-grey-medium dark:text-neutral-400">
                    <Icon name="chevron-down" size={14} strokeWidth={1.5}/>
                </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
                <Select.Content
                    className="z-[60] min-w-[160px] bg-white dark:bg-neutral-750 rounded-base shadow-popover p-1 overflow-hidden animate-popoverShow"
                    position="popper" sideOffset={5}
                >
                    <Select.Viewport>
                        {options.map(opt => (
                            <Select.Item
                                key={opt.value}
                                value={opt.value}
                                className="relative flex items-center h-7 px-3 text-[13px] font-light rounded-[4px] select-none cursor-pointer data-[highlighted]:bg-grey-ultra-light dark:data-[highlighted]:bg-neutral-600 data-[highlighted]:outline-none text-grey-dark dark:text-neutral-100 data-[state=checked]:text-primary dark:data-[state=checked]:text-primary-light"
                            >
                                <Select.ItemText>{opt.label}</Select.ItemText>
                                <Select.ItemIndicator className="absolute right-2">
                                    <Icon name="check" size={12} strokeWidth={2}/>
                                </Select.ItemIndicator>
                            </Select.Item>
                        ))}
                    </Select.Viewport>
                </Select.Content>
            </Select.Portal>
        </Select.Root>
    );

    return (
        <div className="space-y-0">
            <SettingsRow label="Language" description="Change the application display language."
                         htmlFor="languageSelect">
                {renderSelect('languageSelect', preferences.language, handleLanguageChange, [{
                    value: 'en',
                    label: 'English'
                }, {value: 'zh-CN', label: '简体中文'}], "Select Language")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Default Due Date" description="Set the default due date for newly created tasks."
                         htmlFor="defaultDueDateSelect">
                {renderSelect('defaultDueDateSelect', preferences.defaultNewTaskDueDate, handleDefaultDueDateChange, dueDateOptions, "Select Due Date")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Default Priority" description="Set the default priority for newly created tasks."
                         htmlFor="defaultPrioritySelect">
                {renderSelect('defaultPrioritySelect', preferences.defaultNewTaskPriority?.toString() ?? 'none', handleDefaultPriorityChange, priorityOptions, "Select Priority")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Default List" description="Set the default list for newly created tasks."
                         htmlFor="defaultListSelect">
                {renderSelect('defaultListSelect', preferences.defaultNewTaskList, handleDefaultListChange, listOptions, "Select List")}
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Confirm Deletions"
                         description="Show a confirmation dialog before moving tasks to trash."
                         htmlFor="confirmDeletionsToggle">
                <RadixSwitch.Root
                    id="confirmDeletionsToggle"
                    checked={preferences.confirmDeletions}
                    onCheckedChange={handleConfirmDeletionsChange}
                    aria-label="Toggle confirm deletions"
                    className={twMerge(
                        "custom-switch-track",
                        preferences.confirmDeletions ? "custom-switch-track-on" : "custom-switch-track-off"
                    )}
                >
                    <RadixSwitch.Thumb
                        className={twMerge("custom-switch-thumb", preferences.confirmDeletions ? "custom-switch-thumb-on" : "custom-switch-thumb-off")}/>
                </RadixSwitch.Root>
            </SettingsRow>
        </div>
    );
});
PreferencesSettings.displayName = 'PreferencesSettings';

// Premium Settings Component
const PremiumSettings: React.FC = memo(() => {
    const premiumInfo = useAtomValue(premiumSettingsAtom);

    const handleUpgrade = () => {
        alert("Upgrade flow not implemented in this demo. Imagine redirecting to a payment provider!");
    };

    const premiumTiers = [
        {
            name: "Free Tier",
            price: "Free",
            features: ["Basic Task Management", "Up to 3 Lists", "Standard AI Summary"],
            current: premiumInfo.tier === 'free'
        },
        {
            name: "Pro Tier",
            price: "$5/month",
            features: ["Unlimited Lists & Tasks", "Advanced AI Summary Options", "Priority Support", "Cloud Backup & Sync (mock)"],
            current: premiumInfo.tier === 'pro'
        },
    ];

    return (
        <div className="space-y-6">
            <div
                className="p-4 rounded-base bg-primary-light/50 dark:bg-primary-dark/20 border border-primary/30 dark:border-primary-dark/40">
                <div className="flex items-center">
                    <Icon name="crown" size={24} className="text-primary dark:text-primary-light mr-3"/>
                    <div>
                        <h3 className="text-md font-medium text-primary dark:text-primary-light">
                            {premiumInfo.tier === 'pro' ? "You are a Premium Member!" : "Unlock Premium Features"}
                        </h3>
                        {premiumInfo.tier === 'pro' && premiumInfo.subscribedUntil && (
                            <p className="text-xs text-primary/80 dark:text-primary-light/80">
                                Your subscription is active
                                until {new Date(premiumInfo.subscribedUntil).toLocaleDateString()}.
                            </p>
                        )}
                        {premiumInfo.tier !== 'pro' && (
                            <p className="text-xs text-primary/80 dark:text-primary-light/80">
                                Supercharge your productivity with exclusive features.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {premiumTiers.map(tier => (
                    <div key={tier.name} className={twMerge(
                        "p-4 rounded-lg border",
                        tier.current ? "border-primary dark:border-primary-light bg-primary-light/30 dark:bg-primary-dark/10" : "border-grey-light dark:border-neutral-700 bg-grey-ultra-light dark:bg-neutral-750"
                    )}>
                        <h4 className="text-md font-semibold text-grey-dark dark:text-neutral-100 mb-1">{tier.name}</h4>
                        <p className="text-lg font-medium text-primary dark:text-primary-light mb-3">{tier.price}</p>
                        <ul className="space-y-1.5 text-xs text-grey-medium dark:text-neutral-300 mb-4">
                            {tier.features.map(feature => (
                                <li key={feature} className="flex items-start">
                                    <Icon name="check" size={12} strokeWidth={2.5}
                                          className="text-success mr-1.5 mt-0.5 flex-shrink-0"/>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                        {premiumInfo.tier === 'free' && tier.name === "Pro Tier" && (
                            <Button variant="primary" fullWidth onClick={handleUpgrade}>Upgrade to Pro</Button>
                        )}
                        {premiumInfo.tier === 'pro' && tier.name === "Pro Tier" && (
                            <Button variant="secondary" fullWidth disabled>Currently Active</Button>
                        )}
                    </div>
                ))}
            </div>
            {premiumInfo.tier === 'pro' && (
                <div className="text-center mt-4">
                    <Button variant="link" size="sm"
                            onClick={() => alert("Manage subscription action (not implemented).")}>
                        Manage Subscription or View Billing
                    </Button>
                </div>
            )}
        </div>
    );
});
PremiumSettings.displayName = 'PremiumSettings';

// About Settings Component
const AboutSettings: React.FC = memo(() => {
    const [activeContent, setActiveContent] = useState<'changelog' | 'privacy' | 'terms' | null>(null);

    const contentMap = {
        changelog: {title: 'Update Changelog', html: CHANGELOG_HTML},
        privacy: {title: 'Privacy Policy', html: PRIVACY_POLICY_HTML},
        terms: {title: 'Terms of Use', html: TERMS_OF_USE_HTML},
    };

    const renderContent = () => {
        if (!activeContent || !contentMap[activeContent]) return null;
        return (
            <div
                className="mt-4 p-4 rounded-base border border-grey-light dark:border-neutral-700 bg-grey-ultra-light/50 dark:bg-neutral-750/50 max-h-[300px] overflow-y-auto styled-scrollbar-thin">
                <h4 className="text-md font-semibold text-grey-dark dark:text-neutral-100 mb-3">{contentMap[activeContent].title}</h4>
                <div dangerouslySetInnerHTML={{__html: contentMap[activeContent].html}}/>
            </div>
        );
    };

    return (
        <div className="space-y-0">
            <SettingsRow label="Application Version" value={APP_VERSION}/>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Changelog" action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'changelog' ? null : 'changelog')}>
                    {activeContent === 'changelog' ? "Hide" : "View"}
                </Button>
            }/>
            {activeContent === 'changelog' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Privacy Policy" action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'privacy' ? null : 'privacy')}>
                    {activeContent === 'privacy' ? "Hide" : "View"}
                </Button>
            }/>
            {activeContent === 'privacy' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Terms of Use" action={
                <Button variant="link" size="sm"
                        onClick={() => setActiveContent(activeContent === 'terms' ? null : 'terms')}>
                    {activeContent === 'terms' ? "Hide" : "View"}
                </Button>
            }/>
            {activeContent === 'terms' && renderContent()}
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Feedback & Suggestions" description="We'd love to hear from you!">
                <Button as="a" href="mailto:feedback@tada-app.example.com?subject=Tada App Feedback" variant="secondary"
                        size="sm" icon="mail">
                    Send Email
                </Button>
            </SettingsRow>
            <div className="h-px bg-grey-light dark:bg-neutral-700 my-0"></div>
            <SettingsRow label="Report an Issue" description="Found a bug? Let us know.">
                <Button as="a" href="mailto:support@tada-app.example.com?subject=Tada App Issue Report"
                        variant="secondary" size="sm" icon="alert-circle"
                        className="text-warning hover:!bg-warning/10 dark:text-warning dark:hover:!bg-warning/20">
                    Report Issue
                </Button>
            </SettingsRow>
        </div>
    );
});
AboutSettings.displayName = 'AboutSettings';


const SettingsModal: React.FC = () => {
    const [isOpen, setIsSettingsOpen] = useAtom(isSettingsOpenAtom);
    const [selectedTab, setSelectedTab] = useAtom(settingsSelectedTabAtom);
    const handleOpenChange = useCallback((open: boolean) => {
        setIsSettingsOpen(open);
    }, [setIsSettingsOpen]);
    const handleTabClick = useCallback((id: SettingsTab) => setSelectedTab(id), [setSelectedTab]);
    const renderContent = useMemo(() => {
        switch (selectedTab) {
            case 'account':
                return <AccountSettings/>;
            case 'appearance':
                return <AppearanceSettings/>;
            case 'preferences':
                return <PreferencesSettings/>;
            case 'premium':
                return <PremiumSettings/>;
            case 'about':
                return <AboutSettings/>;
            default:
                return <AccountSettings/>;
        }
    }, [selectedTab]);
    const modalTitle = useMemo(() => settingsSections.find(s => s.id === selectedTab)?.label ?? 'Settings', [selectedTab]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/50 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40 backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white dark:bg-neutral-800 w-full max-w-3xl h-[75vh] max-h-[650px]",
                        "rounded-base shadow-modal flex overflow-hidden",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    aria-describedby={undefined}
                    onEscapeKeyDown={() => handleOpenChange(false)}
                >
                    <div
                        className="w-52 bg-grey-ultra-light/80 dark:bg-grey-deep/80 backdrop-blur-sm p-3 flex flex-col shrink-0 border-r border-grey-light/50 dark:border-neutral-700/50">
                        <nav className="space-y-0.5 flex-1 mt-2">
                            {settingsSections.map((item) => (
                                <button key={item.id} onClick={() => handleTabClick(item.id)}
                                        className={twMerge('flex items-center w-full px-3 py-2 h-8 text-[13px] rounded-base transition-colors duration-200 ease-in-out',
                                            selectedTab === item.id
                                                ? 'bg-grey-light text-primary dark:bg-primary-dark/30 dark:text-primary-light font-normal'
                                                : 'text-grey-dark dark:text-neutral-200 font-light hover:bg-grey-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-100',
                                            'focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-grey-ultra-light dark:focus-visible:ring-offset-grey-deep'
                                        )} aria-current={selectedTab === item.id ? 'page' : undefined}>
                                    <Icon name={item.icon} size={16} strokeWidth={1} className="mr-2.5 opacity-90"
                                          aria-hidden="true"/>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-800 relative">
                        <div
                            className="flex items-center justify-between px-6 py-4 border-b border-grey-light dark:border-neutral-700 flex-shrink-0 h-[60px]">
                            <Dialog.Title
                                className="text-[16px] font-normal text-grey-dark dark:text-neutral-100">{modalTitle}</Dialog.Title>
                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" icon="x"
                                        className="text-grey-medium dark:text-neutral-400 hover:bg-grey-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-100 w-7 h-7 -mr-2"
                                        iconProps={{strokeWidth: 1.5, size: 12}} aria-label="Close settings"/>
                            </Dialog.Close>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto styled-scrollbar">{renderContent}</div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
SettingsModal.displayName = 'SettingsModal';
export default SettingsModal;