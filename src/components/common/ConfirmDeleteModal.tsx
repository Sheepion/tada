// src/components/common/ConfirmDeleteModal.tsx
import React, {useCallback} from 'react';
import Button from './Button';
import {twMerge} from 'tailwind-merge';
import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    itemTitle: string;
    title?: string;
    description?: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary' | 'secondary';
}

const ConfirmDeleteModalRadix: React.FC<ConfirmDeleteModalProps> = ({
                                                                        isOpen, onClose, onConfirm, itemTitle,
                                                                        title = "Delete Item?",
                                                                        description,
                                                                        confirmText = "Delete",
                                                                        confirmVariant = 'danger',
                                                                    }) => {
    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) onClose();
    }, [onClose]);
    const handleConfirmClick = useCallback(() => {
        onConfirm();
    }, [onConfirm]);

    const finalDescription = description ?? `Are you sure you want to delete "${itemTitle || 'this item'}"? This action cannot be undone.`;

    return (
        <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay
                    className="fixed inset-0 bg-grey-dark/30 data-[state=open]:animate-fadeIn data-[state=closed]:animate-fadeOut z-50"/>
                <Dialog.Content
                    className={twMerge(
                        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60]",
                        "bg-white w-full max-w-sm rounded-base shadow-modal flex flex-col p-6",
                        "data-[state=open]:animate-modalShow data-[state=closed]:animate-modalHide"
                    )}
                    onEscapeKeyDown={onClose}
                >
                    <Dialog.Title
                        className="text-[16px] font-normal text-grey-dark mb-2 text-center">
                        {title}
                    </Dialog.Title>
                    <Dialog.Description
                        className="text-[13px] font-light text-grey-medium text-center mb-6"> {/* Description uses new grey-medium */}
                        {finalDescription}
                    </Dialog.Description>
                    <div className="flex justify-center space-x-3 mt-auto">
                        <Dialog.Close asChild>
                            <Button variant="secondary" size="md" className="flex-1"> Cancel </Button>
                        </Dialog.Close>
                        <Button variant={confirmVariant} size="md" onClick={handleConfirmClick} className="flex-1"
                                autoFocus> {confirmText} </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
ConfirmDeleteModalRadix.displayName = 'ConfirmDeleteModalRadix';
export default ConfirmDeleteModalRadix;