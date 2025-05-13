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
                    className="fixed inset-0 bg-grey-dark/30 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-40"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                        "bg-white w-full max-w-md rounded-base shadow-modal flex flex-col",
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
                        <Dialog.Title className="text-[16px] font-normal text-grey-dark">
                            Create New List
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <Button variant="ghost" size="icon" icon="x"
                                    className="text-grey-medium hover:bg-grey-ultra-light hover:text-grey-dark w-6 h-6 -mr-1"
                                    iconProps={{strokeWidth: 1.5, size: 12}}
                                    aria-label="Close modal"/>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="listNameInput"
                                   className="block text-[12px] font-light text-grey-medium mb-1.5"> List
                                Name </label> {/* Label uses new grey-medium */}
                            <input ref={inputRef} id="listNameInput" type="text" value={listName}
                                   onChange={handleInputChange}
                                   placeholder="e.g., Groceries, Project X"
                                   className={twMerge(
                                       "w-full h-8 px-3 text-[13px] font-light rounded-base",
                                       "bg-grey-ultra-light border-b border-grey-light focus:border-b-primary", // Use updated grey colors
                                       error ? 'border-b-error focus:border-b-error' : '',
                                       "placeholder:text-grey-medium text-grey-dark focus:outline-none" // Placeholder uses new grey-medium, text new grey-dark
                                   )}
                                   required aria-required="true" aria-invalid={!!error}
                                   aria-describedby={error ? "listNameError" : undefined}/>
                            {error &&
                                <p id="listNameError" className="text-[11px] text-error mt-1 font-light">{error}</p>}
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