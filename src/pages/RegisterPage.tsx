// src/pages/RegisterPage.tsx
import React, {useCallback, useState} from 'react';
import {Link as RouterLink, useNavigate} from 'react-router-dom';
import {useSetAtom} from 'jotai';
import {currentUserAtom} from '@/store/atoms';
import * as apiService from '@/services/apiService';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import {twMerge} from 'tailwind-merge';

type RegisterMethod = 'email' | 'phone';

const RegisterPage: React.FC = () => {
    const [registerMethod, setRegisterMethod] = useState<RegisterMethod>('email');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const setCurrentUser = useSetAtom(currentUserAtom);
    const navigate = useNavigate();

    const handleSendCode = useCallback(async () => {
        if (!phone.trim()) {
            setError("Please enter your phone number.");
            return;
        }
        setIsSendingCode(true);
        setError(null);
        setMessage(null);
        const response = await apiService.apiSendPhoneVerificationCode(phone, 'register');
        setIsSendingCode(false);
        if (response.success) {
            setIsCodeSent(true);
            setMessage("Verification code sent to your phone.");
        } else {
            setError(response.error || "Failed to send verification code.");
        }
    }, [phone]);

    const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setMessage(null);

        let response: apiService.AuthResponse;

        if (registerMethod === 'email') {
            if (!email.trim()) {
                setError("Email is required for email registration.");
                setIsLoading(false);
                return;
            }
            response = await apiService.apiRegisterWithEmail(name, email, password);
        } else { // phone
            if (!phone.trim()) {
                setError("Phone number is required for phone registration.");
                setIsLoading(false);
                return;
            }
            if (!verificationCode.trim()) {
                setError("Verification code is required for phone registration.");
                setIsLoading(false);
                return;
            }
            response = await apiService.apiRegisterWithPhone(name, phone, password, verificationCode);
        }

        setIsLoading(false);
        if (response.success && response.user) {
            setCurrentUser(response.user);
            navigate('/all', {replace: true});
        } else {
            setError(response.error || 'Registration failed. Please try again.');
        }
    }, [name, email, phone, password, confirmPassword, verificationCode, registerMethod, setCurrentUser, navigate]);

    const inputBaseClasses = "w-full h-10 px-3 text-sm font-light rounded-base focus:outline-none bg-grey-ultra-light dark:bg-neutral-700 placeholder:text-grey-medium dark:placeholder:text-neutral-400 text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light focus:ring-1 focus:ring-primary dark:focus:ring-primary-light";
    const tabButtonClasses = (isActive: boolean) => twMerge(
        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex-1",
        isActive ? "bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light" : "text-grey-medium hover:bg-grey-light/50 dark:text-neutral-400 dark:hover:bg-neutral-700"
    );

    return (
        <div className="flex items-center justify-center min-h-screen bg-grey-ultra-light dark:bg-grey-deep p-4">
            <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white dark:bg-neutral-800 rounded-lg shadow-modal">
                <div className="text-center">
                    <Icon name="user" size={40} className="mx-auto text-primary dark:text-primary-light mb-3"
                          strokeWidth={1.5}/>
                    <h1 className="text-xl sm:text-2xl font-medium text-grey-dark dark:text-neutral-100">
                        Create your Tada Account
                    </h1>
                </div>

                <div
                    className="flex justify-center space-x-1 border border-grey-light dark:border-neutral-700 rounded-lg p-1 bg-grey-ultra-light/50 dark:bg-neutral-750">
                    <button onClick={() => {
                        setRegisterMethod('email');
                        setError(null);
                        setMessage(null);
                    }} className={tabButtonClasses(registerMethod === 'email')}>Register with Email
                    </button>
                    <button onClick={() => {
                        setRegisterMethod('phone');
                        setError(null);
                        setMessage(null);
                    }} className={tabButtonClasses(registerMethod === 'phone')}>Register with Phone
                    </button>
                </div>

                {message && !error && (
                    <p className="text-xs text-success dark:text-green-400 text-center bg-success/10 p-2 rounded-base">
                        {message}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="name" className="sr-only">Full Name</label>
                        <input id="name" name="name" type="text" autoComplete="name" required
                               value={name} onChange={(e) => setName(e.target.value)}
                               className={inputBaseClasses} placeholder="Full Name" disabled={isLoading}/>
                    </div>

                    {registerMethod === 'email' && (
                        <div>
                            <label htmlFor="email" className="sr-only">Email address</label>
                            <input id="email" name="email" type="email" autoComplete="email" required
                                   value={email} onChange={(e) => setEmail(e.target.value)}
                                   className={inputBaseClasses} placeholder="Email address" disabled={isLoading}/>
                        </div>
                    )}

                    {registerMethod === 'phone' && (
                        <>
                            <div>
                                <label htmlFor="phone-reg" className="sr-only">Phone number</label>
                                <input id="phone-reg" name="phone" type="tel" autoComplete="tel" required
                                       value={phone} onChange={(e) => setPhone(e.target.value)}
                                       className={inputBaseClasses} placeholder="Phone number"
                                       disabled={isLoading || isSendingCode || isCodeSent}/>
                            </div>
                            <div className="flex space-x-2">
                                <label htmlFor="verificationCode-reg" className="sr-only">Verification Code</label>
                                <input id="verificationCode-reg" name="verificationCode" type="text" inputMode="numeric"
                                       autoComplete="one-time-code" required={registerMethod === 'phone'}
                                       value={verificationCode}
                                       onChange={(e) => setVerificationCode(e.target.value)}
                                       className={twMerge(inputBaseClasses, "flex-grow")}
                                       placeholder="Verification Code" disabled={isLoading || !isCodeSent}/>
                                <Button type="button" variant="secondary" onClick={handleSendCode}
                                        loading={isSendingCode}
                                        disabled={isLoading || isSendingCode || !phone.trim() || isCodeSent}
                                        className="!h-10 flex-shrink-0 !px-3 text-xs">
                                    {isCodeSent ? 'Code Sent' : 'Send Code'}
                                </Button>
                            </div>
                        </>
                    )}
                    <div>
                        <label htmlFor="password-reg" className="sr-only">Password</label>
                        <input id="password-reg" name="password" type="password" autoComplete="new-password"
                               required value={password} onChange={(e) => setPassword(e.target.value)}
                               className={inputBaseClasses} placeholder="Password (min. 6 characters)"
                               disabled={isLoading}/>
                    </div>
                    <div>
                        <label htmlFor="confirmPassword-reg" className="sr-only">Confirm Password</label>
                        <input id="confirmPassword-reg" name="confirmPassword" type="password"
                               autoComplete="new-password" required value={confirmPassword}
                               onChange={(e) => setConfirmPassword(e.target.value)}
                               className={inputBaseClasses} placeholder="Confirm Password" disabled={isLoading}/>
                    </div>

                    {error && (
                        <p className="text-xs text-error dark:text-red-400 text-center bg-error/10 p-2 rounded-base">
                            {error}
                        </p>
                    )}

                    <Button type="submit" variant="primary" fullWidth size="lg" loading={isLoading} disabled={isLoading}
                            className="!h-10">
                        Create Account
                    </Button>
                </form>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-grey-light dark:border-neutral-600"/>
                    </div>
                    <div className="relative flex justify-center text-xs"><span
                        className="bg-white dark:bg-neutral-800 px-2 text-grey-medium dark:text-neutral-400">Or sign up with</span>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                    <Button variant="secondary" fullWidth className="!h-10 !font-normal justify-center"
                            onClick={() => alert("WeChat sign up not implemented yet.")} disabled={isLoading}>
                        <Icon name="message-square-text" size={18}
                              className="mr-2 opacity-80"/> {/* Placeholder for WeChat */}
                        WeChat
                    </Button>
                    <Button variant="secondary" fullWidth className="!h-10 !font-normal justify-center"
                            onClick={() => alert("Google sign up not implemented yet.")} disabled={isLoading}>
                        <svg className="mr-2 -ml-1 w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fab"
                             data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                            <path fill="currentColor"
                                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                        </svg>
                        Google
                    </Button>
                </div>


                <p className="mt-8 text-center text-xs text-grey-medium dark:text-neutral-400">
                    Already have an account?{' '}
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
RegisterPage.displayName = 'RegisterPage';
export default RegisterPage;