// src/components/common/AddListModal.tsx
import React, {useCallback, useRef, useState} from 'react';
import {useAtom} from 'jotai';
import {isAddListModalOpenAtom, userListNamesAtom} from '@/store/atoms';
import Button from './Button';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';

interface AddListModalProps {
    onAdd: (listName: string) => void;
}

const AddListModal: React.FC<AddListModalProps> = ({onAdd}) => {
    const [isOpen, setIsOpen] = useAtom(isAddListModalOpenAtom);
    const [allListNames] = useAtom(userListNamesAtom);
    const [listName, setListName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleOpenChange = useCallback((open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setListName('');
            setError(null);
        }
    }, [setIsOpen]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) {
            setError("List name cannot be empty.");
            inputRef.current?.focus();
            return;
        }
        const lowerTrimmedName = trimmedName.toLowerCase();
        if (allListNames.some(name => name.toLowerCase() === lowerTrimmedName)) {
            setError(`List "${trimmedName}" already exists.`);
            inputRef.current?.select();
            return;
        }
        const reservedNames = ['inbox', 'trash', 'archive', 'all', 'today', 'next 7 days', 'completed', 'later', 'nodate', 'overdue'];
        if (reservedNames.includes(lowerTrimmedName)) {
            setError(`"${trimmedName}" is a reserved system name.`);
            inputRef.current?.select();
            return;
        }
        setError(null);
        onAdd(trimmedName);
        handleOpenChange(false);
    }, [listName, allListNames, onAdd, handleOpenChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setListName(e.target.value);
        if (error) setError(null);
    }, [error]);

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 dark:bg-black/60 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40 backdrop-blur-sm"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white dark:bg-neutral-800 w-full max-w-md rounded-base shadow-modal flex flex-col", // Dark mode background
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    style={{
                        paddingTop: '24px',
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        paddingBottom: '20px'
                    }}
                    onEscapeKeyDown={() => handleOpenChange(false)}
                    aria-describedby={undefined}
                >
                    <div className="flex justify-between items-center mb-4">
                        <Dialog.Title className="text-[16px] font-normal text-grey-dark dark:text-neutral-100">
                            Create New List
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-grey-medium dark:text-neutral-400 hover:bg-grey-ultra-light dark:hover:bg-neutral-700 hover:text-grey-dark dark:hover:text-neutral-100 w-6 h-6 -mr-1"
                                    iconProps={{strokeWidth: 1.5, size: 12}}
                                    aria-label="Close modal"/>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                ref={inputRef}
                                id="listNameInput"
                                type="text"
                                value={listName}
                                onChange={handleInputChange}
                                placeholder="e.g., Groceries, Project X"
                                aria-label="List Name"
                                className={twMerge(
                                    "w-full h-8 px-3 text-[13px] font-light rounded-base focus:outline-none",
                                    "bg-grey-ultra-light dark:bg-neutral-700", // Dark mode input background
                                    "placeholder:text-grey-medium dark:placeholder:text-neutral-400",
                                    "text-grey-dark dark:text-neutral-100",
                                    "transition-colors duration-200 ease-in-out",
                                    error
                                        ? "border border-error focus:ring-1 focus:ring-error dark:border-error dark:focus:ring-error"
                                        : "border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light" // Subtle border in normal state
                                )}
                                required
                                aria-required="true"
                                aria-invalid={!!error}
                                aria-describedby={error ? "listNameError" : undefined}
                            />
                            {error && (
                                <p id="listNameError"
                                   className="text-[11px] text-error dark:text-red-400 mt-1.5 font-light">{error}</p>
                            )}
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <Dialog.Close asChild>
                                <Button variant="secondary" size="md"> Cancel </Button>
                            </Dialog.Close>
                            <Button type="submit" variant="primary" size="md"
                                    disabled={!listName.trim() || !!error}> Create List </Button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
AddListModal.displayName = 'AddListModal';
export default AddListModal;