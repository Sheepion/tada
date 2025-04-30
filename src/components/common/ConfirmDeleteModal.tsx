// src/components/common/ConfirmDeleteModal.tsx
import React, { useCallback } from 'react';
import ReactDOM from 'react-dom';
import Button from './Button';
import Icon from './Icon';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    taskTitle: string;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
                                                                   isOpen,
                                                                   onClose,
                                                                   onConfirm,
                                                                   taskTitle
                                                               }) => {

    const handleDialogClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(), []);

    const handleConfirmClick = useCallback(() => {
        onConfirm();
        onClose();
    }, [onConfirm, onClose]);

    const modalRoot = typeof document !== 'undefined' ? document.body : null;
    if (!modalRoot) {
        return null;
    }

    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    // Backdrop without blur
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }} // Match duration for backdrop and content
                    aria-modal="true"
                    role="dialog"
                    aria-labelledby="confirmDeleteModalTitle"
                >
                    {/* Modal Dialog Content */}
                    <motion.div
                        // --- MODIFICATION: Restored blur, simplified animation ---
                        className={twMerge(
                            // Restore glass background with blur for the content
                            "bg-glass-100 backdrop-blur-xl w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/10",
                            "flex flex-col p-5"
                        )}
                        onClick={handleDialogClick}
                        // Simplified animation: Fade and slight slide
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }} // Optional subtle slide down on exit
                        transition={{ duration: 0.2, ease: 'easeOut' }} // Match backdrop duration
                    >
                        {/* Icon and Title */}
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                                <Icon name="trash" size={24} className="text-red-600" />
                            </div>
                            {/* Use original text colors assuming glass background */}
                            <h2 id="confirmDeleteModalTitle" className="text-lg font-semibold text-gray-800 mb-1">
                                Move to Trash?
                            </h2>
                            <p className="text-sm text-muted-foreground px-4">
                                Are you sure you want to move the task "{taskTitle || 'Untitled Task'}" to the Trash?
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-center space-x-3 mt-4">
                            {/* Use original button variants */}
                            <Button variant="glass" size="md" onClick={onClose} className="flex-1">
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                size="md"
                                onClick={handleConfirmClick}
                                className="flex-1"
                            >
                                Move to Trash
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        modalRoot
    );
};
ConfirmDeleteModal.displayName = 'ConfirmDeleteModal';
export default ConfirmDeleteModal;