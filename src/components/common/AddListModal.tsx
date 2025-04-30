// src/components/common/AddListModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAtom } from 'jotai';
import { isAddListModalOpenAtom, userListNamesAtom } from '@/store/atoms';
import Button from './Button';
import { twMerge } from 'tailwind-merge';

interface AddListModalProps {
    onAdd: (listName: string) => void;
}

const AddListModal: React.FC<AddListModalProps> = ({ onAdd }) => {
    const [isOpen, setIsOpen] = useAtom(isAddListModalOpenAtom);
    const [allListNames] = useAtom(userListNamesAtom);
    const [listName, setListName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Performance: Memoize callbacks
    const handleClose = useCallback(() => setIsOpen(false), [setIsOpen]);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setListName(''); // Clear name on open
            setError(null); // Clear error on open
            // Focus input after a short delay to ensure it's rendered and transition is complete
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50); // Short delay
            return () => clearTimeout(timer);
        }
    }, [isOpen]);


    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) {
            setError("List name cannot be empty.");
            inputRef.current?.focus();
            return;
        }
        // Normalize comparison to lower case
        const lowerTrimmedName = trimmedName.toLowerCase();
        if (allListNames.some(name => name.toLowerCase() === lowerTrimmedName)) {
            setError(`List "${trimmedName}" already exists.`);
            inputRef.current?.select();
            return;
        }
        // Added more reserved names
        const reservedNames = ['inbox', 'trash', 'archive', 'all', 'today', 'next 7 days', 'completed', 'later', 'nodate', 'overdue'];
        if (reservedNames.includes(lowerTrimmedName)) {
            setError(`"${trimmedName}" is a reserved system name.`);
            inputRef.current?.select();
            return;
        }

        setError(null);
        onAdd(trimmedName); // Call the provided onAdd function
        handleClose(); // Close the modal
    }, [listName, allListNames, onAdd, handleClose]);

    // Clear error on typing
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setListName(e.target.value);
        if (error) setError(null);
    }, [error]);

    // Prevent modal close on inner click
    const handleDialogClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation(), []);

    // Return null if not open (avoids rendering an invisible div)
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-40 flex items-center justify-center p-4"
            onClick={handleClose} // Click outside closes
            aria-modal="true"
            role="dialog"
            aria-labelledby="addListModalTitle"
        >
            <div
                className={twMerge(
                    "bg-glass-100 backdrop-blur-xl w-full max-w-sm rounded-xl shadow-strong overflow-hidden border border-black/10",
                    "flex flex-col" // Ensure flex column layout
                )}
                onClick={handleDialogClick} // Prevent closing when clicking inside
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-black/10 flex justify-between items-center flex-shrink-0 bg-glass-alt-100 backdrop-blur-lg">
                    <h2 id="addListModalTitle" className="text-base font-semibold text-gray-800">Create New List</h2>
                    <Button
                        variant="ghost"
                        size="icon"
                        icon="x"
                        onClick={handleClose}
                        className="text-muted-foreground hover:bg-black/15 w-7 h-7 -mr-1"
                        aria-label="Close modal"
                    />
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div>
                        <label htmlFor="listNameInput" className="block text-xs font-medium text-muted-foreground mb-1.5">
                            List Name
                        </label>
                        <input
                            ref={inputRef}
                            id="listNameInput"
                            type="text"
                            value={listName}
                            onChange={handleInputChange} // Use memoized handler
                            placeholder="e.g., Groceries, Project X"
                            className={twMerge(
                                "w-full h-9 px-3 text-sm bg-glass-inset-100 backdrop-blur-md border rounded-md focus:border-primary/50 focus:ring-1 focus:ring-primary/30 placeholder:text-muted shadow-inner",
                                error ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-black/10',
                                "focus:bg-glass-inset-200" // Slight visual feedback on focus
                            )}
                            required // HTML5 required attribute
                            aria-required="true"
                            aria-invalid={!!error}
                            aria-describedby={error ? "listNameError" : undefined}
                        />
                        {error && <p id="listNameError" className="text-xs text-red-600 mt-1.5">{error}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-2 pt-2">
                        <Button variant="glass" size="md" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" size="md" disabled={!listName.trim() || !!error}>
                            Create List
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
AddListModal.displayName = 'AddListModal'; // Add display name
export default AddListModal;