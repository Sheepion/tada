// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refined color palette - slightly adjusted primary
        'primary': {
          DEFAULT: 'hsl(208, 100%, 50%)', // Main blue
          'light': 'hsl(208, 100%, 96%)', // Very light blue for subtle backgrounds
          'dark': 'hsl(208, 100%, 45%)',  // Darker blue for hover/active
          'foreground': 'hsl(208, 100%, 98%)', // High contrast text on primary bg
        },
        'muted': {
          DEFAULT: 'hsl(210, 9%, 75%)', // Lighter muted for placeholders
          foreground: 'hsl(210, 10%, 55%)', // Darker muted for secondary text
        },
        'canvas': { // Base background colors
          DEFAULT: 'hsl(0, 0%, 100%)',        // Pure white as base
          alt: 'hsl(220, 40%, 98%)',        // Very subtle, slightly cooler alt background
          inset: 'hsl(220, 30%, 96%)',      // Slightly cooler, lighter inset background (e.g., Inputs)
        },
        'border-color': { // Dedicated border color for subtlety
          DEFAULT: 'hsl(210, 25%, 93%)', // Softer border
          medium: 'hsl(210, 20%, 88%)', // Medium border for inputs etc.
        },
        // --- Enhanced Glassmorphism Colors ---
        'glass': {
          // Base Canvas Colors with Alpha
          'DEFAULT': 'hsla(0, 0%, 100%, 0.65)', // Default white glass (less opaque)
          '100': 'hsla(0, 0%, 100%, 0.85)',     // More opaque white glass
          '200': 'hsla(0, 0%, 100%, 0.75)',
          '300': 'hsla(0, 0%, 100%, 0.5)',      // More transparent

          // Alt Canvas Colors with Alpha
          'alt': 'hsla(220, 40%, 98%, 0.7)',    // Default alt glass
          'alt-100': 'hsla(220, 40%, 98%, 0.85)', // More opaque alt glass
          'alt-200': 'hsla(220, 40%, 98%, 0.75)',
          'alt-300': 'hsla(220, 40%, 98%, 0.6)', // More transparent alt

          // Inset Canvas Colors with Alpha
          'inset': 'hsla(220, 30%, 96%, 0.7)',  // Default inset glass
          'inset-100': 'hsla(220, 30%, 96%, 0.8)',
          'inset-200': 'hsla(220, 30%, 96%, 0.6)',
        }
        // --- End Enhanced Glassmorphism Colors ---
      },
      borderRadius: { // Slightly reduced radii for a sharper look
        'sm': '3px',
        'md': '5px',  // DEFAULT - Standardized small radius
        'lg': '7px',  // For modals, cards
        'xl': '10px', // Larger containers if needed
        'full': '9999px',
      },
      boxShadow: { // Fine-tuned shadows for depth
        'subtle': '0 1px 2px 0 hsla(0, 0%, 0%, 0.04)',
        'medium': '0 3px 6px -1px hsla(0, 0%, 0%, 0.05), 0 2px 4px -2px hsla(0, 0%, 0%, 0.04)',
        'strong': '0 8px 16px -4px hsla(0, 0%, 0%, 0.06), 0 4px 8px -4px hsla(0, 0%, 0%, 0.05)', // More pronounced strong shadow
        'inner': 'inset 0 1px 2px 0 hsla(0, 0%, 0%, 0.05)',
        'inner-strong': 'inset 0 2px 4px 0 hsla(0, 0%, 0%, 0.06)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)', // Matches common ease-in-out used by Apple
        'emphasized': 'cubic-bezier(0.4, 0, 0.2, 1)', // Alias for clarity if needed
        'sharp': 'cubic-bezier(0.4, 0, 0.6, 1)', // Faster curve
      },
      backdropBlur: { // Consistent blur levels
        'xs': '2px',
        'sm': '4px',
        'DEFAULT': '8px', // Standard blur
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
      },
      keyframes: { // Keep subtle animations
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-out': { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } }, // Slightly less scale
        'scale-out': { '0%': { opacity: '1', transform: 'scale(1)' }, '100%': { opacity: '0', transform: 'scale(0.97)' } },
        'slide-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }, // Shorter distance
        'slide-down': { '0%': { opacity: '1', transform: 'translateY(0)' }, '100%': { opacity: '0', transform: 'translateY(8px)' } },
        // Added drawer specific animations
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-out-right': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(100%)' } },
      },
      animation: { // Use consistent, slightly faster durations
        'fade-in': 'fade-in 0.18s ease-out forwards',
        'fade-out': 'fade-out 0.15s ease-in forwards',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'scale-out': 'scale-out 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-up': 'slide-up 0.18s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-down': 'slide-down 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        // Drawer animations - make them fast
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'slide-out-right': 'slide-out-right 0.2s cubic-bezier(0.4, 0, 0.6, 1) forwards', // Use sharp ease for exit
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} satisfies Config;