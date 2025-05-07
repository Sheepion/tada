// src/components/common/CustomDatePickerPopover.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {twMerge} from 'tailwind-merge';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    getHours,
    getMinutes,
    isSameDay,
    isSameMonth,
    isToday,
    isValid,
    setHours as setHoursFns,
    setMinutes as setMinutesFns,
    startOfDay,
    startOfMonth,
    startOfWeek,
    subMonths
} from '@/utils/dateUtils';
import Button from './Button';
import Icon from './Icon';

// --- Internal Content Component ---
interface CustomDatePickerContentProps {
    initialDate: Date | undefined;
    onSelect: (date: Date | undefined) => void;
    closePopover: () => void;
}

const CustomDatePickerContent: React.FC<CustomDatePickerContentProps> = React.memo(({
                                                                                        initialDate,
                                                                                        onSelect,
                                                                                        closePopover,
                                                                                    }) => {
    const today = useMemo(() => startOfDay(new Date()), []);
    const [viewDate, setViewDate] = useState(initialDate && isValid(initialDate) ? startOfDay(initialDate) : today);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined);

    const formatTimeForValue = (date: Date): string => {
        const h = String(getHours(date)).padStart(2, '0');
        const m = String(getMinutes(date)).padStart(2, '0');
        return `${h}:${m}`;
    };

    const [selectedTimeValue, setSelectedTimeValue] = useState<string>(() => {
        if (initialDate && isValid(initialDate)) {
            if (getHours(initialDate) === 0 && getMinutes(initialDate) === 0 && initialDate.getSeconds() === 0 && initialDate.getMilliseconds() === 0) {
                return "allDay";
            }
            return formatTimeForValue(initialDate);
        }
        return "allDay"; // Default to All day if no initialDate or invalid
    });

    const contentRef = useRef<HTMLDivElement>(null);

    const {calendarDays} = useMemo(() => {
        const mStart = startOfMonth(viewDate);
        const mEnd = endOfMonth(viewDate);
        const cStart = startOfWeek(mStart);
        const cEnd = endOfWeek(mEnd);
        const days = eachDayOfInterval({start: cStart, end: cEnd});
        return {calendarDays: days};
    }, [viewDate]);

    const timeOptions = useMemo(() => {
        const options: { label: string, value: string }[] = [{label: "All day", value: "allDay"}];
        for (let h = 0; h < 24; h++) {
            options.push({label: `${String(h).padStart(2, '0')}:00`, value: `${String(h).padStart(2, '0')}:00`});
            options.push({label: `${String(h).padStart(2, '0')}:30`, value: `${String(h).padStart(2, '0')}:30`});
        }
        return options;
    }, []);

    const prevMonth = useCallback(() => setViewDate(v => subMonths(v, 1)), []);
    const nextMonth = useCallback(() => setViewDate(v => addMonths(v, 1)), []);
    const goToTodayCalendarView = useCallback(() => {
        const todayDate = startOfDay(new Date());
        setViewDate(todayDate);
        // No need to auto-select date or time here, just change view
    }, []);

    const createQuickSelectHandler = useCallback((dateFn: () => Date, timeValue: string = "allDay") => () => {
        const date = startOfDay(dateFn());
        setSelectedDate(date);
        setSelectedTimeValue(timeValue); // Set time along with quick select

        let finalDate = date;
        if (timeValue !== "allDay") {
            const [hours, minutes] = timeValue.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                finalDate = setHoursFns(finalDate, hours);
                finalDate = setMinutesFns(finalDate, minutes);
            }
        }
        onSelect(finalDate);
        closePopover();
    }, [onSelect, closePopover]);

    const selectToday = useMemo(() => createQuickSelectHandler(() => new Date(), "allDay"), [createQuickSelectHandler]);
    const selectTomorrow = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 1), "allDay"), [createQuickSelectHandler]);
    const selectNextWeek = useMemo(() => createQuickSelectHandler(() => addDays(new Date(), 7), "allDay"), [createQuickSelectHandler]);
    const selectNextMonth = useMemo(() => createQuickSelectHandler(() => addMonths(new Date(), 1), "allDay"), [createQuickSelectHandler]);


    const handleSelectDate = useCallback((date: Date) => {
        const dateStart = startOfDay(date);
        const isCurrentlySelected = selectedDate && isSameDay(dateStart, selectedDate);

        if (isCurrentlySelected) {
            // If clicking the same date again, deselect it
            setSelectedDate(undefined);
            // Keep selectedTimeValue as is, or reset to "allDay" if preferred when no date is selected
            // setSelectedTimeValue("allDay");
        } else {
            setSelectedDate(dateStart);
            // If no time is set, or a new date is picked, default time to "allDay"
            if (selectedTimeValue === "allDay" && initialDate && isValid(initialDate) && isSameDay(dateStart, startOfDay(initialDate))) {
                // If re-selecting the initial date, and time was allDay, restore original time if any
                if (getHours(initialDate) === 0 && getMinutes(initialDate) === 0) {
                    setSelectedTimeValue("allDay");
                } else {
                    setSelectedTimeValue(formatTimeForValue(initialDate));
                }
            } else if (selectedTimeValue !== "allDay" && !isCurrentlySelected) {
                // Keep existing specific time if a new date is chosen and time was specific
            } else {
                // Default to allDay if no specific time was set or picking a new date with allDay previously.
                setSelectedTimeValue("allDay");
            }
        }
    }, [selectedDate, selectedTimeValue, initialDate]);

    const handleClearDate = useCallback(() => {
        setSelectedDate(undefined);
        setSelectedTimeValue("allDay"); // Reset time to all day when clearing
        onSelect(undefined);
        closePopover();
    }, [onSelect, closePopover]);

    const handleConfirm = useCallback(() => {
        if (selectedDate) {
            let finalDate = startOfDay(selectedDate);
            if (selectedTimeValue !== "allDay") {
                const [hours, minutes] = selectedTimeValue.split(':').map(Number);
                if (!isNaN(hours) && !isNaN(minutes)) {
                    finalDate = setHoursFns(finalDate, hours);
                    finalDate = setMinutesFns(finalDate, minutes);
                }
            }
            onSelect(finalDate);
        } else {
            onSelect(undefined);
        }
        closePopover();
    }, [selectedDate, selectedTimeValue, onSelect, closePopover]);

    const weekDays = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

    useEffect(() => {
        const validInitial = initialDate && isValid(initialDate) ? startOfDay(initialDate) : undefined;
        setSelectedDate(validInitial);
        setViewDate(validInitial ?? today);

        if (initialDate && isValid(initialDate)) {
            if (getHours(initialDate) === 0 && getMinutes(initialDate) === 0 && initialDate.getSeconds() === 0 && initialDate.getMilliseconds() === 0) {
                setSelectedTimeValue("allDay");
            } else {
                setSelectedTimeValue(formatTimeForValue(initialDate));
            }
        } else {
            setSelectedTimeValue("allDay");
        }
    }, [initialDate, today]);

    const displaySelectedTimeLabel = useMemo(() => {
        if (selectedTimeValue === "allDay") return "All day";
        return selectedTimeValue;
    }, [selectedTimeValue]);

    const dropdownContentClasses = "min-w-[100px] max-h-60 styled-scrollbar overflow-y-auto z-[75] bg-glass-menu dark:bg-neutral-800/95 backdrop-blur-xl rounded-lg shadow-strong border border-black/10 dark:border-white/10 p-1 data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-slideDownAndFade";


    return (
        <div
            ref={contentRef}
            className="date-picker-content p-4 w-[320px]" // Removed popover chrome styles
            onClick={e => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            {/* Quick Date Selection */}
            <div className="flex justify-between mb-4 px-4">
                <Tooltip.Provider><Tooltip.Root delayDuration={300}>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectToday}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 dark:hover:bg-white/10 transition-colors"
                                aria-label="Select Today">
                            <Icon name="sun" size={20} className="text-gray-500 dark:text-neutral-400"/>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 dark:bg-neutral-900/90 text-white px-2 py-1 rounded shadow-md select-none z-[80] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            Today
                            <Tooltip.Arrow className="fill-black/80 dark:fill-neutral-900/90"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root></Tooltip.Provider>
                <Tooltip.Provider><Tooltip.Root delayDuration={300}>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectTomorrow}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 dark:hover:bg-white/10 transition-colors"
                                aria-label="Select Tomorrow">
                            <Icon name="sunset" size={20} className="text-gray-500 dark:text-neutral-400"/>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 dark:bg-neutral-900/90 text-white px-2 py-1 rounded shadow-md select-none z-[80] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            Tomorrow
                            <Tooltip.Arrow className="fill-black/80 dark:fill-neutral-900/90"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root></Tooltip.Provider>
                <Tooltip.Provider><Tooltip.Root delayDuration={300}>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectNextWeek}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 dark:hover:bg-white/10 transition-colors"
                                aria-label="Select 7 days from now">
                            <div className="relative">
                                <Icon name="calendar" size={20} className="text-gray-500 dark:text-neutral-400"/>
                                <div
                                    className="absolute top-0 right-0 -mt-1 -mr-1 bg-gray-500 dark:bg-neutral-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center"> +7
                                </div>
                            </div>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 dark:bg-neutral-900/90 text-white px-2 py-1 rounded shadow-md select-none z-[80] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            +7 Days
                            <Tooltip.Arrow className="fill-black/80 dark:fill-neutral-900/90"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root></Tooltip.Provider>
                <Tooltip.Provider><Tooltip.Root delayDuration={300}>
                    <Tooltip.Trigger asChild>
                        <button onClick={selectNextMonth}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/15 dark:hover:bg-white/10 transition-colors"
                                aria-label="Select next month">
                            <Icon name="moon" size={20} className="text-gray-500 dark:text-neutral-400"/>
                        </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                        <Tooltip.Content
                            className="text-xs bg-black/80 dark:bg-neutral-900/90 text-white px-2 py-1 rounded shadow-md select-none z-[80] data-[state=delayed-open]:animate-fadeIn data-[state=closed]:animate-fadeOut"
                            sideOffset={4}>
                            Next Month
                            <Tooltip.Arrow className="fill-black/80 dark:fill-neutral-900/90"/>
                        </Tooltip.Content>
                    </Tooltip.Portal>
                </Tooltip.Root></Tooltip.Provider>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
                <div className="text-base font-medium text-gray-800 dark:text-neutral-100">
                    {format(viewDate, 'MMMM yyyy')}
                </div>
                <div className="flex items-center space-x-1">
                    <Button onClick={prevMonth} variant="ghost" size="icon" icon="chevron-left"
                            className="w-7 h-7 text-gray-500 dark:text-neutral-400 hover:bg-black/10 dark:hover:bg-white/10"
                            aria-label="Previous month"/>
                    <Button onClick={goToTodayCalendarView} variant="ghost" size="icon" className="w-7 h-7"
                            aria-label="Go to current month">
                        <div
                            className={twMerge("w-1.5 h-1.5 rounded-full", isSameMonth(viewDate, today) ? "bg-primary" : "bg-gray-300 dark:bg-neutral-600")}></div>
                    </Button>
                    <Button onClick={nextMonth} variant="ghost" size="icon" icon="chevron-right"
                            className="w-7 h-7 text-gray-500 dark:text-neutral-400 hover:bg-black/10 dark:hover:bg-white/10"
                            aria-label="Next month"/>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="mb-4">
                <div className="grid grid-cols-7 mb-1">
                    {weekDays.map((day, i) => (
                        <div key={i}
                             className="text-center text-xs text-gray-500 dark:text-neutral-500 h-8 flex items-center justify-center font-medium">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-0">
                    {calendarDays.map((day, i) => {
                        const isCurrentMonth = isSameMonth(day, viewDate);
                        const isDaySelected = selectedDate && isSameDay(day, selectedDate);
                        const isDayToday = isToday(day);
                        return (
                            <button
                                key={i}
                                onClick={() => handleSelectDate(day)}
                                className={twMerge(
                                    "h-9 w-9 flex items-center justify-center rounded-full text-sm transition-colors mx-auto",
                                    "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:z-10",
                                    !isCurrentMonth && "text-gray-400/60 dark:text-neutral-600/70",
                                    isCurrentMonth && "hover:bg-black/10 dark:hover:bg-white/10",
                                    isDayToday && !isDaySelected && "font-semibold text-primary border border-primary/50 dark:border-primary/60",
                                    !isDayToday && isCurrentMonth && !isDaySelected && "text-gray-800 dark:text-neutral-200",
                                    isDaySelected && "bg-primary text-white font-semibold hover:bg-primary-dark dark:hover:bg-primary/90",
                                    !isCurrentMonth && "pointer-events-none opacity-50"
                                )}
                                aria-label={format(day, 'MMMM d, yyyy')}
                                aria-pressed={!!isDaySelected}
                                disabled={!isCurrentMonth}
                            >
                                {format(day, 'd')}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Selection Dropdown */}
            <div className="flex items-center justify-between mb-4 pt-3 border-t border-black/10 dark:border-white/10">
                <label htmlFor="time-picker-trigger"
                       className="text-sm font-medium text-gray-700 dark:text-neutral-300">Time</label>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <Button
                            id="time-picker-trigger"
                            variant="ghost"
                            size="md"
                            className="min-w-[100px] text-sm text-gray-700 dark:text-neutral-200 hover:bg-black/10 dark:hover:bg-white/10 flex justify-between items-center !h-8 !px-2.5"
                            disabled={!selectedDate} // Disable if no date is selected
                        >
                            <span className="tabular-nums">{displaySelectedTimeLabel}</span>
                            <Icon name="chevron-down" size={14} className="ml-1.5 opacity-60"/>
                        </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content
                            className={dropdownContentClasses}
                            sideOffset={5}
                            align="end"
                            onCloseAutoFocus={(e) => e.preventDefault()} // Prevent focus shift on close
                        >
                            <DropdownMenu.RadioGroup value={selectedTimeValue} onValueChange={setSelectedTimeValue}>
                                {timeOptions.map(option => (
                                    <DropdownMenu.RadioItem
                                        key={option.value}
                                        value={option.value}
                                        className={twMerge(
                                            "relative flex cursor-pointer select-none items-center rounded-[3px] px-2.5 py-1 text-sm outline-none transition-colors data-[disabled]:pointer-events-none h-7 tabular-nums",
                                            "focus:bg-black/15 data-[highlighted]:bg-black/15 dark:focus:bg-white/10 dark:data-[highlighted]:bg-white/10",
                                            "data-[state=checked]:bg-primary/20 data-[state=checked]:text-primary data-[state=checked]:font-medium data-[highlighted]:data-[state=checked]:bg-primary/25 dark:data-[state=checked]:bg-primary/30 dark:data-[state=checked]:text-primary-light dark:data-[highlighted]:data-[state=checked]:bg-primary/40",
                                            "data-[state=unchecked]:text-gray-700 data-[highlighted]:data-[state=unchecked]:text-gray-800 dark:data-[state=unchecked]:text-neutral-300 dark:data-[highlighted]:data-[state=unchecked]:text-neutral-100",
                                        )}
                                    >
                                        {option.label}
                                    </DropdownMenu.RadioItem>
                                ))}
                            </DropdownMenu.RadioGroup>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>


            {/* Action Buttons */}
            <div className="flex space-x-2 mt-1">
                <Button variant="outline" size="md"
                        className="flex-1 justify-center text-muted-foreground dark:text-neutral-400"
                        onClick={handleClearDate}> Clear </Button>
                <Button variant="primary" size="md" className="flex-1 justify-center"
                        onClick={handleConfirm} disabled={!selectedDate}> OK </Button>
            </div>
        </div>
    );
});
CustomDatePickerContent.displayName = 'CustomDatePickerContent';

export {CustomDatePickerContent};
export default CustomDatePickerContent;