// src/components/tasks/TaskDetailPlaceholder.tsx
import React from 'react';
import Icon from '../common/Icon';
import {twMerge} from 'tailwind-merge';

const TaskDetailPlaceholder: React.FC = () => {
    return (
        <div className={twMerge(
            "h-full flex flex-col items-center justify-center text-center p-8",
            "bg-white dark:bg-neutral-850", // Use neutral-850 for dark mode placeholder background
        )}>
            <Icon name="file-text" size={40} strokeWidth={1}
                  className="text-grey-light dark:text-neutral-600 mb-4 opacity-80"/> {/* Dark mode icon color */}
            <h3 className="text-[16px] font-normal text-grey-dark dark:text-neutral-100 mb-1">No Task Selected</h3>
            <p className="text-[13px] font-light text-grey-medium dark:text-neutral-400">
                Select a task from the list to view its details.
            </p>
        </div>
    );
};

TaskDetailPlaceholder.displayName = 'TaskDetailPlaceholder';
export default TaskDetailPlaceholder;