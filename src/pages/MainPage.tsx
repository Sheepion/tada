// src/pages/MainPage.tsx
import React from 'react';
import TaskList from '../components/tasks/TaskList';
import TaskDetail from '../components/tasks/TaskDetail';
import { useAtomValue } from 'jotai'; // Use useAtomValue for reading
import { selectedTaskIdAtom } from '../store/atoms';
import { TaskFilter } from '@/types';
import { AnimatePresence } from 'framer-motion';

interface MainPageProps {
    title: string;
    filter: TaskFilter;
}

const MainPage: React.FC<MainPageProps> = ({ title, filter }) => {
    // Read selectedTaskId using useAtomValue as we don't set it here
    const selectedTaskId = useAtomValue(selectedTaskIdAtom);

    return (
        // Main container for the Task List / Detail view
        <div className="h-full flex flex-1 overflow-hidden">

            {/* Task List takes available space, min-width ensures it doesn't collapse too much */}
            {/* Added subtle border */}
            <div className="flex-1 h-full min-w-0 border-r border-black/5">
                {/* Pass title and filter props */}
                <TaskList title={title} filter={filter} />
            </div>

            {/* Task Detail slides in/out using AnimatePresence */}
            {/* initial={false} prevents animation on the initial load */}
            {/* NO key on TaskDetail allows content switching without remount animation */}
            <AnimatePresence initial={false}>
                {selectedTaskId && <TaskDetail />}
            </AnimatePresence>

        </div>
    );
};

export default MainPage;