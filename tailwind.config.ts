// tailwind.config.ts
import type {Config} from 'tailwindcss';

export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'primary': 'hsl(var(--color-primary) / <alpha-value>)',
                'primary-light': 'hsl(var(--color-primary-light) / <alpha-value>)',
                'primary-dark': 'hsl(var(--color-primary-dark) / <alpha-value>)',

                'white': 'hsl(var(--color-white) / <alpha-value>)',
                'almost-white': 'hsl(var(--color-almost-white) / <alpha-value>)',
                'grey-ultra-light': 'hsl(var(--color-grey-ultra-light) / <alpha-value>)',
                'grey-light': 'hsl(var(--color-grey-light) / <alpha-value>)',
                'grey-medium': 'hsl(var(--color-grey-medium) / <alpha-value>)',
                'grey-dark': 'hsl(var(--color-grey-dark) / <alpha-value>)',
                'grey-deep': 'hsl(var(--color-grey-deep) / <alpha-value>)',

                'success': 'hsl(var(--color-success) / <alpha-value>)',
                'info': 'hsl(var(--color-info) / <alpha-value>)',
                'warning': 'hsl(var(--color-warning) / <alpha-value>)',
                'error': 'hsl(var(--color-error) / <alpha-value>)',
            },
            fontFamily: {
                primary: ['var(--font-primary)', 'sans-serif'],
            },
            fontWeight: {
                regular: 'var(--font-primary-regular-weight)',
                medium: 'var(--font-primary-medium-weight)',
                semibold: 'var(--font-primary-semibold-weight)',
            },
            borderRadius: {
                'sm': 'var(--border-radius-small)',
                'base': 'var(--border-radius-base)',
                'lg': 'var(--border-radius-large)',
                'full': 'var(--border-radius-full)',
                '4px': '4px', // Added for precise inner rounding
            },
            boxShadow: {
                'interactive': 'var(--shadow-interactive)',
                'popover': 'var(--shadow-popover)',
                'modal': 'var(--shadow-modal)',
            },
            spacing: {
                '0.5': '2px', '1': '4px', '2': '8px', '3': '12px',
                '4': '16px', '5': '20px', '6': '24px', '10': '40px',
            },
            borderWidth: {
                'DEFAULT': '1px',
                '0': '0px',
                '0.5': '0.5px',
                '2': '2px',
                '4': '4px',
                '8': '8px',
            },
            letterSpacing: {
                tightest: '-.075em', tighter: '-.05em', tight: '-.025em',
                normal: '0', wide: '.025em', wider: '.05em',
                widest: '.1em', '0.5px': '0.5px',
            },
            lineHeight: {
                '3': '1.3', 'normal': '1.65', 'tight': '1.2', '6': '1.6',
            },
            keyframes: {
                fadeIn: {from: {opacity: '0'}, to: {opacity: '1'}},
                fadeOut: {from: {opacity: '1'}, to: {opacity: '0'}},
                modalShow: {
                    from: {opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)'},
                    to: {opacity: '1', transform: 'translate(-50%, -50%) scale(1)'},
                },
                modalHide: {
                    from: {opacity: '1', transform: 'translate(-50%, -50%) scale(1)'},
                    to: {opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)'},
                },
                scaleIn: {
                    '0%': {opacity: '0', transform: 'scale(0.95)'},
                    '100%': {opacity: '1', transform: 'scale(1)'},
                },
                scaleOut: {
                    '0%': {opacity: '1', transform: 'scale(1)'},
                    '100%': {opacity: '0', transform: 'scale(0.95)'},
                },
                // Added for AI Glow Border
                borderAnimation: {
                    '0%': {backgroundPosition: '0% 0%'},
                    '100%': {backgroundPosition: '300% 0%'},
                },
            },
            animation: {
                fadeIn: 'fadeIn 0.15s ease-out',
                fadeOut: 'fadeOut 0.15s ease-in',
                modalShow: 'modalShow 0.2s ease-out',
                modalHide: 'modalHide 0.2s ease-in',
                popoverShow: 'scaleIn 0.1s ease-out',
                popoverHide: 'scaleOut 0.1s ease-in',
                dropdownShow: 'scaleIn 0.1s ease-out',
                dropdownHide: 'scaleOut 0.1s ease-in',
                // Added for AI Glow Border
                'border-flow': 'borderAnimation 4s linear infinite',
            },
            transitionTimingFunction: { // This defines Tailwind utility classes like `ease-app-ease-out`
                'app-ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
                'app-ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
            },
            transitionDuration: {
                'DEFAULT': '150ms',
                '75': '75ms',
                '100': '100ms',
                '150': '150ms',
                '200': '200ms',
            },
        },
    },
    plugins: [
        require('tailwindcss-radix')({
            variantPrefix: 'radix',
        }),
        require('@tailwindcss/typography'),
        require('@tailwindcss/forms')({strategy: 'class'}),
    ],
} satisfies Config;