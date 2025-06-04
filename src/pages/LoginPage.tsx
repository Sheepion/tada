// src/pages/LoginPage.tsx
import React, {useCallback, useState} from 'react';
import {Link as RouterLink, useNavigate} from 'react-router-dom';
import {useSetAtom} from 'jotai';
import {currentUserAtom} from '@/store/atoms';
import * as apiService from '@/services/apiService';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import {twMerge} from 'tailwind-merge';

type LoginMethod = 'email-password' | 'phone-password' | 'phone-code';

const LoginPage: React.FC = () => {
    const [loginMethod, setLoginMethod] = useState<LoginMethod>('email-password');

    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setCurrentUser = useSetAtom(currentUserAtom);
    const navigate = useNavigate();

    const handleSendCode = useCallback(async () => {
        if (!phone.trim()) {
            setError("Please enter your phone number.");
            return;
        }
        setIsSendingCode(true);
        setError(null);
        const response = await apiService.apiSendPhoneVerificationCode(phone, 'login');
        setIsSendingCode(false);
        if (response.success) {
            setIsCodeSent(true);
            setMessage("Verification code sent to your phone.");
        } else {
            setError(response.error || "Failed to send verification code.");
        }
    }, [phone]);

    const [message, setMessage] = useState<string | null>(null);


    const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        setMessage(null);

        let response: apiService.AuthResponse;

        switch (loginMethod) {
            case 'email-password':
                response = await apiService.apiLogin(email, password);
                break;
            case 'phone-password':
                response = await apiService.apiLoginWithPhonePassword(phone, password);
                break;
            case 'phone-code':
                response = await apiService.apiLoginWithPhoneCode(phone, verificationCode);
                break;
            default:
                setError("Invalid login method selected.");
                setIsLoading(false);
                return;
        }

        setIsLoading(false);
        if (response.success && response.user) {
            setCurrentUser(response.user);
            navigate('/all', {replace: true});
        } else {
            setError(response.error || 'Login failed. Please check your credentials.');
        }
    }, [email, phone, password, verificationCode, loginMethod, setCurrentUser, navigate]);

    const handleThirdPartyLogin = async (provider: 'wechat' /* | 'google' | 'apple' etc. */) => {
        setIsLoading(true);
        setError(null);
        // Simulate initiating third-party login.
        // In a real app, this would redirect or open a popup.
        const response = await apiService.apiLoginWithThirdParty(provider);
        setIsLoading(false);
        if (response.success && response.user) {
            setCurrentUser(response.user);
            navigate('/all', {replace: true});
        } else if (response.redirectUrl) {
            // For a real OAuth flow, you'd redirect
            // window.location.href = response.redirectUrl;
            alert(`Simulating redirect to ${provider}: ${response.redirectUrl}`);
        } else {
            setError(response.error || `Login with ${provider} failed.`);
        }
    };


    const inputBaseClasses = "w-full h-10 px-3 text-sm font-light rounded-base focus:outline-none bg-grey-ultra-light dark:bg-neutral-700 placeholder:text-grey-medium dark:placeholder:text-neutral-400 text-grey-dark dark:text-neutral-100 transition-colors duration-200 ease-in-out border border-grey-light dark:border-neutral-600 focus:border-primary dark:focus:border-primary-light focus:ring-1 focus:ring-primary dark:focus:ring-primary-light";
    const tabButtonClasses = (isActive: boolean) => twMerge(
        "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
        isActive ? "bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light" : "text-grey-medium hover:bg-grey-light/50 dark:text-neutral-400 dark:hover:bg-neutral-700"
    );

    return (
        <div className="flex items-center justify-center min-h-screen bg-grey-ultra-light dark:bg-grey-deep p-4">
            <div className="w-full max-w-sm p-6 sm:p-8 space-y-6 bg-white dark:bg-neutral-800 rounded-lg shadow-modal">
                <div className="text-center">
                    <Icon name="check-square" size={48} className="mx-auto text-primary dark:text-primary-light mb-3"/>
                    <h1 className="text-xl sm:text-2xl font-medium text-grey-dark dark:text-neutral-100">
                        Welcome Back to Tada
                    </h1>
                </div>

                <div
                    className="flex justify-center space-x-1 border border-grey-light dark:border-neutral-700 rounded-lg p-1 bg-grey-ultra-light/50 dark:bg-neutral-750">
                    <button onClick={() => setLoginMethod('email-password')}
                            className={tabButtonClasses(loginMethod === 'email-password')}>Email
                    </button>
                    <button onClick={() => setLoginMethod('phone-password')}
                            className={tabButtonClasses(loginMethod === 'phone-password')}>Phone+Pass
                    </button>
                    <button onClick={() => setLoginMethod('phone-code')}
                            className={tabButtonClasses(loginMethod === 'phone-code')}>Phone+Code
                    </button>
                </div>

                {message && !error && (
                    <p className="text-xs text-success dark:text-green-400 text-center bg-success/10 p-2 rounded-base">
                        {message}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {loginMethod === 'email-password' && (
                        <>
                            <div>
                                <label htmlFor="email" className="sr-only">Email address</label>
                                <input id="email" name="email" type="email" autoComplete="email" required
                                       value={email} onChange={(e) => setEmail(e.target.value)}
                                       className={inputBaseClasses} placeholder="Email address" disabled={isLoading}/>
                            </div>
                            <div>
                                <label htmlFor="password-email" className="sr-only">Password</label>
                                <input id="password-email" name="password" type="password"
                                       autoComplete="current-password"
                                       required value={password} onChange={(e) => setPassword(e.target.value)}
                                       className={inputBaseClasses} placeholder="Password" disabled={isLoading}/>
                            </div>
                        </>
                    )}

                    {loginMethod === 'phone-password' && (
                        <>
                            <div>
                                <label htmlFor="phone-pass" className="sr-only">Phone number</label>
                                <input id="phone-pass" name="phone" type="tel" autoComplete="tel" required
                                       value={phone} onChange={(e) => setPhone(e.target.value)}
                                       className={inputBaseClasses} placeholder="Phone number" disabled={isLoading}/>
                            </div>
                            <div>
                                <label htmlFor="password-phone" className="sr-only">Password</label>
                                <input id="password-phone" name="password" type="password"
                                       autoComplete="current-password"
                                       required value={password} onChange={(e) => setPassword(e.target.value)}
                                       className={inputBaseClasses} placeholder="Password" disabled={isLoading}/>
                            </div>
                        </>
                    )}

                    {loginMethod === 'phone-code' && (
                        <>
                            <div>
                                <label htmlFor="phone-code-input" className="sr-only">Phone number</label>
                                <div className="flex space-x-2">
                                    <input id="phone-code-input" name="phone" type="tel" autoComplete="tel" required
                                           value={phone} onChange={(e) => setPhone(e.target.value)}
                                           className={inputBaseClasses} placeholder="Phone number"
                                           disabled={isLoading || isSendingCode || isCodeSent}/>
                                    <Button type="button" variant="secondary" onClick={handleSendCode}
                                            loading={isSendingCode}
                                            disabled={isLoading || isSendingCode || !phone.trim() || isCodeSent}
                                            className="!h-10 flex-shrink-0 !px-3 text-xs">
                                        {isCodeSent ? 'Sent' : 'Send Code'}
                                    </Button>
                                </div>
                            </div>
                            {isCodeSent && (
                                <div>
                                    <label htmlFor="verificationCode" className="sr-only">Verification Code</label>
                                    <input id="verificationCode" name="verificationCode" type="text" inputMode="numeric"
                                           autoComplete="one-time-code" required value={verificationCode}
                                           onChange={(e) => setVerificationCode(e.target.value)}
                                           className={inputBaseClasses} placeholder="Verification Code"
                                           disabled={isLoading}/>
                                </div>
                            )}
                        </>
                    )}

                    {error && (
                        <p className="text-xs text-error dark:text-red-400 text-center bg-error/10 p-2 rounded-base">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-end text-xs">
                        <RouterLink
                            to="/forgot-password"
                            className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary transition-colors"
                        >
                            Forgot password?
                        </RouterLink>
                    </div>

                    <Button type="submit" variant="primary" fullWidth size="lg" loading={isLoading} disabled={isLoading}
                            className="!h-10">
                        Sign In
                    </Button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-grey-light dark:border-neutral-600"/>
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="bg-white dark:bg-neutral-800 px-2 text-grey-medium dark:text-neutral-400">
                            Or continue with
                        </span>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3">
                    <Button variant="secondary" fullWidth className="!h-10 !font-normal justify-center"
                            onClick={() => handleThirdPartyLogin('wechat')} disabled={isLoading}>
                        <Icon name="message-square-text" size={18}
                              className="mr-2 opacity-80"/> {/* Placeholder for WeChat */}
                        WeChat
                    </Button>
                    {/* Add other third-party logins here, e.g., Google, Apple */}
                    <Button variant="secondary" fullWidth className="!h-10 !font-normal justify-center"
                            onClick={() => alert("Google login not implemented yet")} disabled={isLoading}>
                        <svg className="mr-2 -ml-1 w-4 h-4" aria-hidden="true" focusable="false" data-prefix="fab"
                             data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                            <path fill="currentColor"
                                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                        </svg>
                        Google
                    </Button>
                </div>


                <p className="mt-8 text-center text-xs text-grey-medium dark:text-neutral-400">
                    Don't have an account?{' '}
                    <RouterLink
                        to="/register"
                        className="font-medium text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary transition-colors"
                    >
                        Sign up here
                    </RouterLink>
                </p>
            </div>
        </div>
    );
};
LoginPage.displayName = 'LoginPage';
export default LoginPage;