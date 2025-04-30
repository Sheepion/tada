// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}' // Ensure it scans all relevant files
  ],
  theme: {
    extend: {
      // Define custom colors using HSL variables for easy theming
      colors: {
        'primary': {
          DEFAULT: 'hsl(var(--primary-h), var(--primary-s), var(--primary-l))', // e.g., hsl(208, 100%, 50%)
          'light': 'hsl(var(--primary-h), var(--primary-s), 96%)', // Very light version
          'dark': 'hsl(var(--primary-h), var(--primary-s), 45%)', // Darker shade for hover/active
          'foreground': 'hsl(0, 0%, 100%)', // White text on primary bg
        },
        'muted': {
          DEFAULT: 'hsl(210, 9%, 80%)', // Lighter gray for borders/backgrounds
          foreground: 'hsl(210, 10%, 60%)', // Medium gray for text
        },
        'canvas': {
          DEFAULT: 'hsl(var(--canvas))', // Base background (white)
          alt: 'hsl(var(--canvas-alt))', // Alternate slightly off-white/gray bg
          inset: 'hsl(220, 30%, 96%)', // Background for inset elements like inputs
        },
        // Specific border colors (can be simplified if needed)
        'border-color': { // Renamed for clarity, use standard border-{color} utilities
          DEFAULT: 'hsl(210, 25%, 93%)', // Default subtle border
          medium: 'hsl(210, 20%, 88%)', // Slightly stronger border
          'glass-subtle': 'hsla(0, 0%, 0%, 0.08)', // Subtle black border for glass
          'glass-medium': 'hsla(0, 0%, 0%, 0.12)', // Medium black border for glass
          'glass-light': 'hsla(0, 0%, 100%, 0.1)', // Light border on dark glass (if needed)
        },
        // Glassmorphism background colors with varying opacity
        'glass': {
          'DEFAULT': 'hsla(0, 0%, 100%, 0.60)', // White glass base
          '100': 'hsla(0, 0%, 100%, 0.80)', // Less transparent
          '200': 'hsla(0, 0%, 100%, 0.70)',
          '300': 'hsla(0, 0%, 100%, 0.50)', // More transparent
          // Alternate glass based on canvas-alt
          'alt': 'hsla(220, 40%, 98%, 0.60)',
          'alt-100': 'hsla(220, 40%, 98%, 0.80)',
          'alt-200': 'hsla(220, 40%, 98%, 0.70)',
          'alt-300': 'hsla(220, 40%, 98%, 0.50)',
          // Inset glass based on canvas-inset
          'inset': 'hsla(220, 30%, 96%, 0.70)',
          'inset-100': 'hsla(220, 30%, 96%, 0.80)',
          'inset-200': 'hsla(220, 30%, 96%, 0.60)',
        }
      },
      // Define standard border radius values
      borderRadius: {
        'sm': '4px',
        'md': '6px', // Default
        'lg': '8px',
        'xl': '12px',
        'full': '9999px',
      },
      // Define standard box shadow values
      boxShadow: {
        'subtle': '0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'medium': '0 4px 8px -2px hsla(0, 0%, 0%, 0.07), 0 2px 4px -2px hsla(0, 0%, 0%, 0.05)',
        'strong': '0 10px 20px -5px hsla(0, 0%, 0%, 0.1), 0 4px 8px -4px hsla(0, 0%, 0%, 0.08)',
        'inner': 'inset 0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'inner-strong': 'inset 0 2px 4px 0 hsla(0, 0%, 0%, 0.06)',
        // Glass shadows using primary color tint
        'glass': '0 4px 12px -2px hsla(var(--primary-h), var(--primary-s), 50%, 0.1), 0 2px 4px -2px hsla(var(--primary-h), var(--primary-s), 50%, 0.06)',
        'glass-lg': '0 8px 24px -6px hsla(var(--primary-h), var(--primary-s), 50%, 0.12), 0 4px 8px -4px hsla(var(--primary-h), var(--primary-s), 50%, 0.08)',
        // Standard Tailwind xl shadow
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // Adjusted xl for more emphasis
      },
      // Define custom transition timing functions
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)', // Similar to ease-in-out, common Apple feel
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)', // Material Design emphasized easing
        'sharp': 'cubic-bezier(0.4, 0, 0.6, 1)', // Faster exit
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      // Define backdrop blur utilities
      backdropBlur: {
        'none': '0', 'xs': '2px', 'sm': '4px', 'DEFAULT': '8px', 'md': '12px',
        'lg': '16px', 'xl': '24px', '2xl': '32px', '3xl': '48px',
      },
      // Define keyframes for animations
      keyframes: {
        'spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // Add other keyframes if needed
      },
      // Define animations using keyframes
      animation: {
        'spin': 'spin 1s linear infinite', // Loader animation
      }
    },
  },
  // Include necessary plugins
  plugins: [
    require('@tailwindcss/forms'), // Provides base styles for form elements
    // Add other plugins like typography if used
  ],
} satisfies Config;