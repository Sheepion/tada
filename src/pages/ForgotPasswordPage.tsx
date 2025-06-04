// src/pages/ForgotPasswordPage.tsx
import React, { useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import * as apiService from '@/services/apiService';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import { twMerge } from 'tailwind-merge';

const ForgotPasswordPage: React.FC = () => {
    const [identifier, setIdentifier] = useState(''); // Can be email or phone
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        setMessage(null);

        const response = await apiService.apiForgotPasswordRequest(identifier);
        setIsLoading(false);

        if (response.success) {
            setMessage(response.message || 'If an account with that identifier exists, a password reset link/code has been sent.');
        } else {
            setError(response.error || 'Failed to send reset instructions. Please try again.');
        }
    }, [identifier]);

    const inputBaseClasses = "w-full h-10 px-3 text-sm font-light rounded-base focus:outline-none bg-grey-ultra-light dark:bg-neutral-700 placeholder:text-grey-medium dark:placeholder:text-neutral-400 text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light focus:ring-1 focus:ring-primary dark:focus:ring-primary-light";

    return (
        <div className="flex items-center justify-center min-h-screen bg-grey-ultra-light dark:bg-grey-deep p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white dark:bg-neutral-800 rounded-lg shadow-modal">
                <div className="text-center">
                    <Icon name="lock" size={40} className="mx-auto text-primary dark:text-primary-light mb-3" strokeWidth={1.5}/>
                    <h1 className="text-2xl font-medium text-grey-dark dark:text-neutral-100">
                        Forgot Your Password?
                    </h1>
                    <p className="mt-1 text-sm text-grey-medium dark:text-neutral-400">
                        Enter your email address or phone number and we'll send you instructions to reset your password.
                    </p>
                </div>

                {message && !error && (
                    <p className="text-sm text-success dark:text-green-400 text-center bg-success/10 p-3 rounded-base">
                        {message}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="identifier" className="block text-xs font-medium text-grey-medium dark:text-neutral-300 mb-1">
                            Email or Phone Number
                        </label>
                        <input
                            id="identifier"
                            name="identifier"
                            type="text"
                            autoComplete="email" // Or "tel" - browser might handle this
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            className={inputBaseClasses}
                            placeholder="you@example.com or +1234567890"
                            disabled={isLoading || !!message} // Disable if message is shown (success)
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-error dark:text-red-400 text-center bg-error/10 p-2 rounded-base">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        variant="primary"
                        fullWidth
                        size="lg"
                        loading={isLoading}
                        disabled={isLoading || !identifier.trim() || !!message}
                        className="!h-10"
                    >
                        Send Reset Instructions
                    </Button>
                </form>

                <p className="mt-6 text-center text-xs text-grey-medium dark:text-neutral-400">
                    Remember your password?{' '}
                    <RouterLink
                        to="/login"
                        className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary transition-colors"
                    >
                        Sign in
                    </RouterLink>
                </p>
            </div>
        </div>
    );
};
ForgotPasswordPage.displayName = 'ForgotPasswordPage';
export default ForgotPasswordPage;