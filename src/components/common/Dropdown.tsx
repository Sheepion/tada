// src/components/common/Dropdown.tsx
import React, { useState, useCallback, useRef, memo, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for createPortal
import { usePopper } from 'react-popper';
import { AnimatePresence, motion } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import type { Placement } from '@popperjs/core';

export interface DropdownRenderProps {
    close: () => void;
}

interface DropdownProps {
    trigger: React.ReactElement;
    children: React.ReactNode | ((props: DropdownRenderProps) => React.ReactNode);
    contentClassName?: string;
    placement?: Placement; // Use imported Placement type
    wrapperClassName?: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    zIndex?: number;
    onClose?: () => void;
    usePortal?: boolean; // Prop to control portal usage
    // *** REMOVE scrollContainerRef PROP ***
    // scrollContainerRef?: React.RefObject<HTMLElement>;
}

const Dropdown: React.FC<DropdownProps> = memo(({
                                                    trigger,
                                                    children,
                                                    contentClassName,
                                                    placement = 'bottom-start',
                                                    wrapperClassName,
                                                    isOpen: externalIsOpen,
                                                    onOpenChange,
                                                    zIndex = 50, // Default z-index
                                                    onClose,
                                                    usePortal = false // Default to false
                                                    // *** REMOVE scrollContainerRef PROP ***
                                                }) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = externalIsOpen ?? internalIsOpen;
    const wasOpenRef = useRef(isOpen);

    const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the trigger wrapper

    // Popper is still used if usePortal is FALSE or for other scenarios
    const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
        placement: placement,
        strategy: usePortal ? 'fixed' : 'absolute', // Strategy depends on portal
        modifiers: [
            { name: 'offset', options: { offset: [0, 6] } },
            {
                name: 'flip', // Keep flip and preventOverflow for non-portal or other portal cases
                options: {
                    fallbackPlacements: ['top-start', 'bottom-end', 'top-end', 'left-start', 'right-start'],
                    padding: 10,
                },
            },
            {
                name: 'preventOverflow',
                options: {
                    padding: 8,
                    mainAxis: true,
                    altAxis: true,
                },
            },
        ],
    });

    // Update Popper position when needed (mostly for non-portal case now)
    useEffect(() => {
        // Update only if NOT using portal OR if popper elements exist
        if (isOpen && update && (!usePortal || (referenceElement && popperElement))) {
            const rafId = requestAnimationFrame(() => {
                update?.();
            });
            return () => cancelAnimationFrame(rafId);
        }
    }, [isOpen, update, usePortal, referenceElement, popperElement, placement]);


    // *** REMOVE THE SCROLL LISTENER EFFECT ***
    // useEffect(() => { ... scroll listener logic removed ... }, [...]);


    // External control/internal state sync
    const setIsOpen = useCallback((value: boolean) => {
        if (onOpenChange) {
            onOpenChange(value);
        } else {
            setInternalIsOpen(value);
        }
    }, [onOpenChange]);

    // onClose callback trigger
    useEffect(() => {
        if (wasOpenRef.current && !isOpen) {
            onClose?.();
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, onClose]);

    // Close function
    const close = useCallback(() => {
        setIsOpen(false);
    }, [setIsOpen]);

    // Click Away Logic (remains the same)
    const clickAwayHandler = useCallback((event: MouseEvent | TouchEvent) => {
        const target = event.target as Node;
        const isClickOutsideTrigger = !dropdownRef.current?.contains(target);
        const isClickOutsidePopper = !popperElement?.contains(target); // Check against popper element ref
        const shouldIgnore = (target instanceof Element) && target.closest('.ignore-click-away');

        if (isClickOutsideTrigger && isClickOutsidePopper && !shouldIgnore) {
            close();
        }
    }, [close, popperElement]); // Depend on popperElement

    // Attach/detach click-away listeners (remains the same)
    useEffect(() => {
        if (!isOpen) return;
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', clickAwayHandler);
            document.addEventListener('touchstart', clickAwayHandler);
        }, 0);
        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', clickAwayHandler);
            document.removeEventListener('touchstart', clickAwayHandler);
        };
    }, [isOpen, clickAwayHandler]);

    // Trigger click handler (remains the same)
    const handleTriggerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setIsOpen(!isOpen);
    }, [isOpen, setIsOpen]);

    // Keyboard handler (remains the same)
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        } else if (e.key === 'Escape') {
            close();
        }
    }, [isOpen, setIsOpen, close]);

    // Popper styles (only relevant if not using portal or for other portal scenarios)
    const popperStyle = useMemo(() => ({
        ...styles.popper,
        zIndex: zIndex
    }), [styles.popper, zIndex]);

    // Wrapper classes (remains the same)
    const popperWrapperClasses = twMerge(
        'ignore-click-away min-w-[180px] overflow-hidden',
        !contentClassName?.includes('date-picker-popover') && 'bg-glass-100 backdrop-blur-xl rounded-lg shadow-strong border border-black/10',
        contentClassName
    );

    // Dropdown content rendering logic (remains the same)
    const dropdownContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={setPopperElement} // Still set ref for click-away logic
                    style={usePortal ? { zIndex: zIndex } : popperStyle} // Apply only zIndex if portal, else full Popper style
                    // If not using portal, apply Popper attributes
                    {...(!usePortal ? attributes.popper : {})}
                    className={popperWrapperClasses}
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    {typeof children === 'function' ? children({ close }) : children}
                </motion.div>
            )}
        </AnimatePresence>
    );

    // Component render (remains the same)
    return (
        <div ref={dropdownRef} className={twMerge("relative inline-block", wrapperClassName)}>
            <div
                ref={setReferenceElement} // Still set ref for Popper if !usePortal
                onClick={handleTriggerClick}
                className="w-full cursor-pointer"
                role="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                {trigger}
            </div>
            {/* Conditionally use portal */}
            {usePortal ? ReactDOM.createPortal(dropdownContent, document.body) : dropdownContent}
        </div>
    );
});
Dropdown.displayName = 'Dropdown';
export default Dropdown;