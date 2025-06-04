// src/pages/ResetPasswordPage.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import * as apiService from '@/services/apiService';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import { twMerge } from 'tailwind-merge';

const ResetPasswordPage: React.FC = () => {
    const { token } = useParams<{ token: string }>(); // Get token from URL
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            setError("Invalid or missing reset token.");
            // Optionally navigate away or show a more permanent error
        }
    }, [token]);

    const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token) {
            setError("Reset token is missing. Cannot proceed.");
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) { // Basic validation
            setError("Password must be at least 6 characters long.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setMessage(null);

        const response = await apiService.apiResetPassword(token, newPassword);
        setIsLoading(false);

        if (response.success) {
            setMessage(response.message || 'Your password has been reset successfully. You can now log in.');
            // Optionally auto-login or redirect to login after a delay
            setTimeout(() => navigate('/login'), 3000);
        } else {
            setError(response.error || 'Failed to reset password. The link may be invalid or expired.');
        }
    }, [token, newPassword, confirmNewPassword, navigate]);

    const inputBaseClasses = "w-full h-10 px-3 text-sm font-light rounded-base focus:outline-none bg-grey-ultra-light dark:bg-neutral-700 placeholder:text-grey-medium dark:placeholder:text-neutral-400 text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light focus:ring-1 focus:ring-primary dark:focus:ring-primary-light";

    return (
        <div className="flex items-center justify-center min-h-screen bg-grey-ultra-light dark:bg-grey-deep p-4">
            <div className="w-full max-w-sm p-8 space-y-6 bg-white dark:bg-neutral-800 rounded-lg shadow-modal">
                <div className="text-center">
                    <Icon name="key" size={40} className="mx-auto text-primary dark:text-primary-light mb-3" strokeWidth={1.5}/>
                    <h1 className="text-2xl font-medium text-grey-dark dark:text-neutral-100">
                        Reset Your Password
                    </h1>
                    <p className="mt-1 text-sm text-grey-medium dark:text-neutral-400">
                        Enter your new password below.
                    </p>
                </div>

                {message && !error && (
                    <p className="text-sm text-success dark:text-green-400 text-center bg-success/10 p-3 rounded-base">
                        {message}
                    </p>
                )}


                {!message && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="newPassword"
                                   className="block text-xs font-medium text-grey-medium dark:text-neutral-300 mb-1">
                                New Password
                            </label>
                            <input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className={inputBaseClasses}
                                placeholder="Enter new password"
                                disabled={isLoading || !token}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirmNewPassword"
                                   className="block text-xs font-medium text-grey-medium dark:text-neutral-300 mb-1">
                                Confirm New Password
                            </label>
                            <input
                                id="confirmNewPassword"
                                name="confirmNewPassword"
                                type="password"
                                required
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className={inputBaseClasses}
                                placeholder="Re-enter new password"
                                disabled={isLoading || !token}
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
                            disabled={isLoading || !token || !newPassword.trim() || !confirmNewPassword.trim()}
                            className="!h-10"
                        >
                            Reset Password
                        </Button>
                    </form>
                )}


                <p className="mt-6 text-center text-xs text-grey-medium dark:text-neutral-400">
                    <RouterLink
                        to="/login"
                        className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary transition-colors"
                    >
                        Back to Sign In
                    </RouterLink>
                </p>
            </div>
        </div>
    );
};
ResetPasswordPage.displayName = 'ResetPasswordPage';
export default ResetPasswordPage;