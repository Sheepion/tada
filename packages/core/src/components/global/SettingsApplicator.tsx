import React, { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { appearanceSettingsAtom, defaultAppearanceSettingsForApi, defaultPreferencesSettingsForApi, preferencesSettingsAtom } from '@/store/jotai';
import { APP_THEMES } from '@/config/app';
import { useTranslation } from 'react-i18next';

/**
 * A global, non-visual component responsible for applying user settings
 * (like theme, dark mode, language, font size, and font weight) to the application's DOM and i18n instance.
 */
const SettingsApplicator: React.FC = () => {
    const loadedAppearance = useAtomValue(appearanceSettingsAtom);
    const loadedPreferences = useAtomValue(preferencesSettingsAtom);
    const { i18n } = useTranslation();

    // Use loaded settings or fall back to defaults to prevent null issues
    const appearance = loadedAppearance ?? defaultAppearanceSettingsForApi();
    const preferences = loadedPreferences ?? defaultPreferencesSettingsForApi();

    // Effect for applying appearance settings (theme, dark mode, typography)
    useEffect(() => {
        // Dark Mode
        const applyDarkMode = (mode: 'light' | 'dark' | 'system') => {
            if (mode === 'system') {
                const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', systemPrefersDark);
            } else {
                document.documentElement.classList.toggle('dark', mode === 'dark');
            }
        };
        applyDarkMode(appearance.darkMode);

        let mediaQueryListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | undefined;
        if (appearance.darkMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQueryListener = () => applyDarkMode('system');
            mediaQuery.addEventListener('change', mediaQueryListener);
        }

        // Theme Colors
        const selectedTheme = APP_THEMES.find(theme => theme.id === appearance.themeId) || APP_THEMES[0];
        document.documentElement.style.setProperty('--color-primary-hsl', selectedTheme.colors.primary);
        document.documentElement.style.setProperty('--color-primary-light-hsl', selectedTheme.colors.light);
        document.documentElement.style.setProperty('--color-primary-dark-hsl', selectedTheme.colors.dark);

        document.documentElement.style.removeProperty('--app-background-image');
        document.documentElement.style.removeProperty('--app-background-filter');
        document.body.style.backgroundColor = '';

        // Text Size
        if (appearance.textSize === 'large') {
            document.documentElement.setAttribute('data-text-size', 'large');
            document.documentElement.style.setProperty('--app-font-size', '16px');
        } else {
            document.documentElement.removeAttribute('data-text-size');
            document.documentElement.style.setProperty('--app-font-size', '13.5px');
        }

        // Font Weight mapping to variables
        let fwLight, fwNormal, fwMedium, fwSemibold, fwBold;

        switch (appearance.fontWeight) {
            case 'light':
                fwLight = '300';
                fwNormal = '400';
                fwMedium = '500';
                fwSemibold = '600';
                fwBold = '700';
                break;
            case 'regular':
                fwLight = '400';
                fwNormal = '500';
                fwMedium = '600';
                fwSemibold = '700';
                fwBold = '800';
                break;
            case 'bold':
                fwLight = '500';
                fwNormal = '600';
                fwMedium = '700';
                fwSemibold = '800';
                fwBold = '900';
                break;
            default: // Default/fallback
                fwLight = '300';
                fwNormal = '400';
                fwMedium = '500';
                fwSemibold = '600';
                fwBold = '700';
        }

        document.documentElement.style.setProperty('--fw-light', fwLight);
        document.documentElement.style.setProperty('--fw-normal', fwNormal);
        document.documentElement.style.setProperty('--fw-medium', fwMedium);
        document.documentElement.style.setProperty('--fw-semibold', fwSemibold);
        document.documentElement.style.setProperty('--fw-bold', fwBold);

        return () => {
            if (mediaQueryListener && appearance && appearance.darkMode === 'system') {
                window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
            }
        };
    }, [appearance]);

    // Effect for applying language preference
    useEffect(() => {
        if (document.documentElement.lang !== preferences.language) {
            document.documentElement.lang = preferences.language;
        }
        if (i18n.language !== preferences.language) {
            i18n.changeLanguage(preferences.language);
        }
    }, [preferences, i18n]);

    return null; // This component does not render anything
};

SettingsApplicator.displayName = 'SettingsApplicator';
export default SettingsApplicator;