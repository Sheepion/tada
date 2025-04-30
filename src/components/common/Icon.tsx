// src/components/common/Icon.tsx
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { iconMap, IconName } from "@/components/common/IconMap";

// Extend LucideProps, but omit 'ref' as it's handled by forwardRef
interface IconProps extends Omit<LucideIcons.LucideProps, 'ref'> {
    name: IconName;
    size?: number | string; // Allow string for flexibility, e.g., "1.5em"
    className?: string;
}

// Performance: Use React.memo as Icons are pure components based on props
const IconComponent = React.memo(React.forwardRef<SVGSVGElement, IconProps>(
    ({ name, size = 16, className, strokeWidth = 1.75, ...props }, ref) => {
        const LucideIcon = iconMap[name];

        // Fallback for missing icons
        if (!LucideIcon) {
            if (process.env.NODE_ENV === 'development') { // Only warn in development
                console.warn(`Icon "${name}" not found in iconMap. Rendering fallback (HelpCircle).`);
            }
            // Use the imported fallback icon directly
            const FallbackIcon = LucideIcons.HelpCircle;
            return (
                <FallbackIcon
                    ref={ref}
                    size={size}
                    strokeWidth={strokeWidth}
                    absoluteStrokeWidth={typeof strokeWidth === 'number' && strokeWidth > 3} // Maintain absolute stroke width logic
                    className={twMerge(
                        'inline-block flex-shrink-0 stroke-current text-red-500 animate-pulse', // Fallback styling
                        className
                    )}
                    {...props}
                />
            );
        }

        // Render the requested icon
        return (
            <LucideIcon
                ref={ref}
                size={size}
                strokeWidth={strokeWidth}
                absoluteStrokeWidth={typeof strokeWidth === 'number' && strokeWidth > 3}
                className={twMerge(
                    'inline-block flex-shrink-0 stroke-current', // Base styling: ensures icon doesn't grow/shrink unexpectedly
                    className // Allow external classes to override or add styles
                )}
                {...props} // Pass other SVG attributes (like color, fill, data attributes, etc.)
            />
        );
    }
));
IconComponent.displayName = 'Icon';
export default IconComponent;