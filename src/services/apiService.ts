// src/services/apiService.ts
import {
    AppearanceSettings,
    PreferencesSettings,
    StoredSummary, Subtask,
    Task,
    User
} from '@/types';
import { AiTaskAnalysis } from './aiService';
import { addDays, startOfDay, subDays } from '@/utils/dateUtils';

const API_BASE_URL = '/api';

const simulateNetworkDelay = (delay = 500) => new Promise(resolve => setTimeout(resolve, delay));

// --- User & Auth ---
export interface AuthResponse {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
    message?: string; // For general messages like "code sent"
    redirectUrl?: string; // For OAuth flows
}

// Email + Password Login
export const apiLogin = async (email: string, password: string): Promise<AuthResponse> => {
    await simulateNetworkDelay();
    console.log('[API] Login attempt (Email/Pass):', email);
    if (email === 'yp.leao@gmail.com' && password === 'password') {
        const user: User = { id: '1', name: 'Liu Yunpeng', email: 'yp.leao@gmail.com', avatar: '/vite.svg', isPremium: true };
        localStorage.setItem('authToken', 'fake-jwt-token-user1');
        return { success: true, user, token: 'fake-jwt-token-user1' };
    }
    if (email === 'test@example.com' && password === 'test') {
        const user: User = { id: '2', name: 'Test User', email: 'test@example.com', isPremium: false };
        localStorage.setItem('authToken', 'fake-jwt-token-user2');
        return { success: true, user, token: 'fake-jwt-token-user2'};
    }
    return { success: false, error: 'Invalid email or password.' };
};

// Phone + Password Login
export const apiLoginWithPhonePassword = async (phone: string, password: string): Promise<AuthResponse> => {
    await simulateNetworkDelay();
    console.log('[API] Login attempt (Phone/Pass):', phone);
    // Simulate a user registered with phone and password
    if (phone === '+15551234567' && password === 'phonepass') {
        const user: User = { id: '3', name: 'Phone User', email: '', // Phone users might not have an email initially
            phone: '+15551234567', isPremium: false };
        localStorage.setItem('authToken', 'fake-jwt-token-user3');
        return { success: true, user, token: 'fake-jwt-token-user3' };
    }
    return { success: false, error: 'Invalid phone number or password.' };
};

// Send Phone Verification Code
export const apiSendPhoneVerificationCode = async (phone: string, context: 'login' | 'register' | 'reset_password'): Promise<{success: boolean, message?: string, error?:string}> => {
    await simulateNetworkDelay(1000);
    console.log(`[API] Sending ${context} verification code to:`, phone);
    // Simulate: check if phone number is valid or exists for login/reset
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) { // Basic E.164-like format check
        return { success: false, error: "Invalid phone number format." };
    }
    // In a real app, you'd integrate with an SMS gateway.
    // For simulation, we assume success and store a mock code.
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(`phoneVerificationCode-${phone}-${context}`, mockCode);
    localStorage.setItem(`phoneVerificationExpiry-${phone}-${context}`, (Date.now() + 5 * 60 * 1000).toString()); // Expires in 5 mins
    console.log(`[API Mock] Code for ${phone} (${context}): ${mockCode}`);
    return { success: true, message: `Verification code sent to ${phone}.` };
};

// Phone + Code Login
export const apiLoginWithPhoneCode = async (phone: string, code: string): Promise<AuthResponse> => {
    await simulateNetworkDelay();
    console.log('[API] Login attempt (Phone/Code):', phone, code);
    const storedCode = localStorage.getItem(`phoneVerificationCode-${phone}-login`);
    const expiry = localStorage.getItem(`phoneVerificationExpiry-${phone}-login`);

    if (storedCode && code === storedCode && expiry && Date.now() < parseInt(expiry, 10)) {
        // Simulate finding or creating user based on phone
        const user: User = { id: '4', name: `User ${phone.slice(-4)}`, email: '', phone, isPremium: false };
        localStorage.removeItem(`phoneVerificationCode-${phone}-login`); // Code used
        localStorage.removeItem(`phoneVerificationExpiry-${phone}-login`);
        localStorage.setItem('authToken', 'fake-jwt-token-user4');
        return { success: true, user, token: 'fake-jwt-token-user4' };
    }
    return { success: false, error: 'Invalid or expired verification code.' };
};


// Registration with Email
export const apiRegisterWithEmail = async (name: string, email: string, password: string): Promise<AuthResponse> => {
    await simulateNetworkDelay(1000);
    console.log('[API] Register attempt (Email):', name, email);
    if (email === 'yp.leao@gmail.com' || email === 'test@example.com') { // Simulate email taken
        return { success: false, error: 'Email already in use.' };
    }
    const newUser: User = { id: `user-email-${Date.now()}`, name, email, isPremium: false };
    localStorage.setItem('authToken', `fake-jwt-token-${newUser.id}`);
    // Simulate storing new user
    console.log('[API] Registered new email user:', newUser);
    return { success: true, user: newUser, token: `fake-jwt-token-${newUser.id}` };
};

// Registration with Phone
export const apiRegisterWithPhone = async (name: string, phone: string, password: string, code: string): Promise<AuthResponse> => {
    await simulateNetworkDelay(1000);
    console.log('[API] Register attempt (Phone):', name, phone, code);

    const storedCode = localStorage.getItem(`phoneVerificationCode-${phone}-register`);
    const expiry = localStorage.getItem(`phoneVerificationExpiry-${phone}-register`);

    if (storedCode && code === storedCode && expiry && Date.now() < parseInt(expiry, 10)) {
        // Simulate checking if phone number is already registered (if needed)
        // For now, assume new registration is allowed
        const newUser: User = { id: `user-phone-${Date.now()}`, name, phone, email: '', isPremium: false }; // Email can be added later
        localStorage.removeItem(`phoneVerificationCode-${phone}-register`);
        localStorage.removeItem(`phoneVerificationExpiry-${phone}-register`);
        localStorage.setItem('authToken', `fake-jwt-token-${newUser.id}`);
        console.log('[API] Registered new phone user:', newUser);
        return { success: true, user: newUser, token: `fake-jwt-token-${newUser.id}` };
    }
    return { success: false, error: 'Invalid or expired verification code for registration.' };
};

// Forgot Password Request
export const apiForgotPasswordRequest = async (identifier: string): Promise<{success: boolean, message?: string, error?: string}> => {
    await simulateNetworkDelay(1000);
    console.log('[API] Forgot password request for:', identifier);
    // In real app, check if identifier (email/phone) exists. Send email or SMS.
    // For simulation, assume it exists and send "instructions".
    // A real token would be generated and stored with an expiry.
    localStorage.setItem(`resetTokenFor-${identifier}`, `fake-reset-token-${Date.now()}`);
    localStorage.setItem(`resetTokenExpiry-${identifier}`, (Date.now() + 15 * 60 * 1000).toString()); // 15 min expiry
    return { success: true, message: `Password reset instructions sent to ${identifier} (simulated).` };
};

// Reset Password
export const apiResetPassword = async (token: string, newPassword: string): Promise<{success: boolean, message?: string, error?: string}> => {
    await simulateNetworkDelay(1000);
    console.log('[API] Reset password attempt with token:', token);
    // Find identifier associated with token
    let identifier: string | null = null;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('resetTokenFor-') && localStorage.getItem(key) === token) {
            identifier = key.replace('resetTokenFor-', '');
            break;
        }
    }

    if (!identifier) {
        return { success: false, error: "Invalid or expired reset token (token not found)." };
    }

    const expiry = localStorage.getItem(`resetTokenExpiry-${identifier}`);
    if (!expiry || Date.now() > parseInt(expiry, 10)) {
        return { success: false, error: "Reset token has expired." };
    }

    // Simulate password update
    console.log(`[API] Password reset for ${identifier} successfully.`);
    localStorage.removeItem(`resetTokenFor-${identifier}`);
    localStorage.removeItem(`resetTokenExpiry-${identifier}`);
    return { success: true, message: "Password has been reset successfully." };
};

// Third-Party Login
export const apiLoginWithThirdParty = async (provider: 'wechat' /* | 'google' | 'apple' */): Promise<AuthResponse> => {
    await simulateNetworkDelay(700);
    console.log(`[API] Initiating login with ${provider}`);
    // In a real app, this would construct the OAuth URL and redirect.
    // The backend would handle the callback, create/link user, and issue a JWT.
    // For simulation:
    if (provider === 'wechat') {
        // Simulate a redirect URL that would be returned by backend to initiate OAuth flow
        // return { success: false, redirectUrl: `https://open.weixin.qq.com/connect/qrconnect?appid=YOUR_WECHAT_APPID&redirect_uri=YOUR_BACKEND_CALLBACK_URL&response_type=code&scope=snsapi_login#wechat_redirect` };

        // OR, simulate direct success after "invisible" OAuth flow for demo
        const wechatUser: User = { id: 'wechat-user-123', name: 'WeChat User', email: 'wechat.user@example.com', isPremium: false, avatar: `https://i.pravatar.cc/150?u=wechat` };
        localStorage.setItem('authToken', 'fake-jwt-token-wechatuser');
        return { success: true, user: wechatUser, token: 'fake-jwt-token-wechatuser' };
    }
    return { success: false, error: `${provider} login not fully simulated yet.` };
};


export const apiLogout = async (): Promise<{ success: boolean }> => {
    await simulateNetworkDelay();
    console.log('[API] Logging out');
    localStorage.removeItem('authToken');
    return {success: true};
};

export const apiFetchCurrentUser = async (): Promise<{ success: boolean, user?: User, error?: string }> => {
    await simulateNetworkDelay(200);
    console.log('[API] Fetching current user');
    const token = localStorage.getItem('authToken');
    // This is a very basic simulation. A real backend would validate the token.
    if (token === 'fake-jwt-token') {
        const user: User = {
            id: '1',
            name: 'Liu Yunpeng',
            email: 'yp.leao@gmail.com',
            avatar: '/vite.svg',
            isPremium: true,
        };
        return {success: true, user};
    } else if (token === 'fake-jwt-token-test') {
        const user: User = {
            id: '2',
            name: 'Test User',
            email: 'test@example.com',
            isPremium: false,
        };
        return {success: true, user};
    } else if (token && token.startsWith('fake-jwt-token-user-')) { // For newly registered users
        const userId = token.replace('fake-jwt-token-', '');
        // In a real app, you'd fetch user details by ID or from token claims
        // For simulation, we just construct a basic user
        const user: User = {
            id: userId,
            name: 'New User', // This would be fetched/decoded
            email: 'newuser@example.com', // This would be fetched/decoded
            isPremium: false,
        };
        return {success: true, user};
    }
    return {success: false, error: 'Not authenticated'};
};

// ... (rest of apiService.ts remains the same as in the previous step) ...
export const apiUpdateUserProfile = async (userId: string, updates: Partial<User>): Promise<{
    success: boolean,
    user?: User,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Updating user profile for:', userId, updates);
    const existingUserRes = await apiFetchCurrentUser(); // Fetch based on current auth
    if (!existingUserRes.success || !existingUserRes.user || existingUserRes.user.id !== userId) {
        return {success: false, error: "User mismatch or not found for profile update."};
    }
    const updatedUser: User = {...existingUserRes.user, ...updates, id: userId};
    // Simulate saving this updatedUser. In a real app, you'd send updates to backend.
    // For demo, if email changes, it might affect login, so this is simplified.
    if (updates.name) localStorage.setItem(`userName-${userId}`, updates.name); // Mock DB

    return {success: true, user: updatedUser};
};
export const apiChangePassword = async (userId: string, oldPass: string, newPass: string): Promise<{
    success: boolean,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Changing password for user:', userId);
    if (oldPass === "password" || oldPass === "test") {
        return {success: true};
    }
    return {success: false, error: "Incorrect old password"};
};
export const apiFetchTasks = async (): Promise<Task[]> => {
    await simulateNetworkDelay();
    console.log('[API] Fetching tasks');
    const {initialTasksForApi} = await import('@/store/atoms');
    const storedTasks = localStorage.getItem('api_tasks_simulation');
    if (storedTasks) {
        try {
            return JSON.parse(storedTasks);
        } catch (e) {
            console.error("Error parsing stored tasks", e);
            return initialTasksForApi();
        }
    }
    return initialTasksForApi();
};
export const apiUpdateTasks = async (tasks: Task[]): Promise<{ success: boolean, tasks?: Task[], error?: string }> => {
    await simulateNetworkDelay(300);
    console.log('[API] Updating tasks batch:', tasks.length, 'tasks');
    localStorage.setItem('api_tasks_simulation', JSON.stringify(tasks));
    return {success: true, tasks: JSON.parse(JSON.stringify(tasks))};
};
export const apiFetchAppearanceSettings = async (): Promise<AppearanceSettings> => {
    await simulateNetworkDelay();
    console.log('[API] Fetching appearance settings');
    const {defaultAppearanceSettingsForApi} = await import('@/store/atoms');
    const stored = localStorage.getItem('api_appearanceSettings_simulation');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return defaultAppearanceSettingsForApi();
        }
    }
    return defaultAppearanceSettingsForApi();
};
export const apiUpdateAppearanceSettings = async (settings: AppearanceSettings): Promise<{
    success: boolean,
    settings?: AppearanceSettings,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Updating appearance settings:', settings);
    localStorage.setItem('api_appearanceSettings_simulation', JSON.stringify(settings));
    return {success: true, settings};
};
export const apiFetchPreferencesSettings = async (): Promise<PreferencesSettings> => {
    await simulateNetworkDelay();
    console.log('[API] Fetching preferences settings');
    const {defaultPreferencesSettingsForApi} = await import('@/store/atoms');
    const stored = localStorage.getItem('api_preferencesSettings_simulation');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return defaultPreferencesSettingsForApi();
        }
    }
    return defaultPreferencesSettingsForApi();
};
export const apiUpdatePreferencesSettings = async (settings: PreferencesSettings): Promise<{
    success: boolean,
    settings?: PreferencesSettings,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Updating preferences settings:', settings);
    localStorage.setItem('api_preferencesSettings_simulation', JSON.stringify(settings));
    return {success: true, settings};
};
export const apiFetchUserLists = async (): Promise<string[]> => {
    await simulateNetworkDelay();
    console.log('[API] Fetching user lists');
    const {initialUserListsForApi} = await import('@/store/atoms');
    const stored = localStorage.getItem('api_userLists_simulation');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return initialUserListsForApi();
        }
    }
    return initialUserListsForApi();
};
export const apiUpdateUserLists = async (lists: string[]): Promise<{
    success: boolean,
    lists?: string[],
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Updating user lists:', lists);
    localStorage.setItem('api_userLists_simulation', JSON.stringify(lists));
    return {success: true, lists};
};
export const apiFetchStoredSummaries = async (): Promise<StoredSummary[]> => {
    await simulateNetworkDelay();
    console.log('[API] Fetching stored summaries');
    const stored = localStorage.getItem('api_storedSummaries_simulation');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return [];
        }
    }
    return [];
};
export const apiSaveSummary = async (summary: StoredSummary): Promise<{
    success: boolean,
    summary?: StoredSummary,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Saving summary:', summary.id);
    const summaries = await apiFetchStoredSummaries();
    const newSummaries = [summary, ...summaries.filter(s => s.id !== summary.id)];
    localStorage.setItem('api_storedSummaries_simulation', JSON.stringify(newSummaries));
    return {success: true, summary};
};
export const apiUpdateSummary = async (summaryId: string, summaryText: string): Promise<{
    success: boolean,
    summary?: StoredSummary,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log('[API] Updating summary text for:', summaryId);
    const summaries = await apiFetchStoredSummaries();
    let updatedSummary: StoredSummary | undefined;
    const newSummaries = summaries.map(s => {
        if (s.id === summaryId) {
            updatedSummary = {...s, summaryText, updatedAt: Date.now()};
            return updatedSummary;
        }
        return s;
    });
    if (updatedSummary) {
        localStorage.setItem('api_storedSummaries_simulation', JSON.stringify(newSummaries));
        return {success: true, summary: updatedSummary};
    }
    return {success: false, error: "Summary not found"};
};
export const apiAnalyzeTaskInput = async (sentence: string, currentTaskDueDate: Date | null): Promise<AiTaskAnalysis> => {
    await simulateNetworkDelay(1200);
    console.log(`[API] AI Task Input Analysis for: "${sentence}", Due: ${currentTaskDueDate?.toISOString()}`);
    let title = sentence;
    let content = `AI analyzed plan for: ${sentence}.\n\nKey considerations:\n- Detail 1\n- Detail 2`;
    let subtasks: Array<Omit<Subtask, 'id' | 'parentId' | 'createdAt' | 'updatedAt' | 'completedAt' | 'completed' | 'order' | 'dueDate'> & {
        title: string;
        dueDate?: number | Date | string | null
    }> = [];
    let tags: string[] = ['ai-analyzed'];
    let priority: number | null = null;
    let dueDate: number | null = currentTaskDueDate ? currentTaskDueDate.getTime() : null;
    const today = startOfDay(new Date());
    const baseDueDate = currentTaskDueDate ? startOfDay(currentTaskDueDate) : addDays(today, 3);
    if (sentence.toLowerCase().includes('birthday party') || sentence.toLowerCase().includes('生日派对')) {
        title = `Plan: ${sentence}`;
        content = `Planning a fantastic birthday party for the occasion mentioned: "${sentence}".\n\nImportant aspects to cover:\n1. Guest List\n2. Venue\n3. Theme & Decorations\n4. Food & Drinks\n5. Entertainment\n6. Cake.`;
        subtasks = [{
            title: 'Finalize guest list and send invitations',
            dueDate: subDays(baseDueDate, 14)
        }, {
            title: 'Book venue (if not at home)',
            dueDate: subDays(baseDueDate, 10)
        }, {title: 'Plan theme and buy decorations', dueDate: subDays(baseDueDate, 7)}, {
            title: 'Order birthday cake',
            dueDate: subDays(baseDueDate, 3)
        }, {
            title: 'Shop for food and drinks',
            dueDate: subDays(baseDueDate, 2)
        }, {title: 'Prepare party space and setup', dueDate: baseDueDate},];
        tags = ['event', 'personal', 'birthday', 'planning', 'ai-analyzed'];
        priority = 1;
    } else if (sentence.toLowerCase().includes('project report') || sentence.toLowerCase().includes('项目报告')) {
        title = `Project Report: ${sentence.replace(/project report/i, '').trim()}`;
        content = `Outline for the project report: "${sentence}".\n\nStructure:\nI. Introduction\nII. Methodology\nIII. Findings\nIV. Discussion\nV. Conclusion & Recommendations`;
        subtasks = [{
            title: 'Gather all necessary data',
            dueDate: subDays(baseDueDate, 5)
        }, {title: 'Draft Intro & Methodology', dueDate: subDays(baseDueDate, 4)}, {
            title: 'Draft Findings',
            dueDate: subDays(baseDueDate, 2)
        }, {
            title: 'Write Discussion & Conclusion',
            dueDate: subDays(baseDueDate, 1)
        }, {title: 'Review and finalize report', dueDate: baseDueDate},];
        tags = ['work', 'report', 'project', 'writing', 'ai-analyzed'];
        priority = 2;
    } else {
        if (sentence.toLowerCase().includes("tomorrow") || sentence.toLowerCase().includes("明天")) {
            dueDate = addDays(today, 1).getTime();
            tags.push("schedule");
        } else if (sentence.toLowerCase().includes("today") || sentence.toLowerCase().includes("今天")) {
            dueDate = today.getTime();
            tags.push("schedule");
        }
        subtasks = [{
            title: `Define scope for '${sentence}'`,
            dueDate: addDays(baseDueDate, 1)
        }, {title: `Execute first step of '${sentence}'`, dueDate: addDays(baseDueDate, 2)},];
        const firstWord = sentence.split(' ')[0];
        if (firstWord && firstWord.length > 2) tags.push(firstWord.toLowerCase());
    }
    return {title, content, subtasks, tags, priority, dueDate};
};
export const apiStreamAiSummary = (tasks: Task[], selectedFields: string[], fieldLabelsMap: {
    [id: string]: string
}): EventSource => {
    console.log('[API Service] Initiating AI Summary Stream for tasks:', tasks.map(t => t.title), "selectedFields:", selectedFields);
    const queryParams = new URLSearchParams();
    queryParams.append('taskIds', tasks.map(t => t.id).join(','));
    queryParams.append('selectedFields', selectedFields.join(','));
    const eventSourceUrl = `${API_BASE_URL}/summary/stream?${queryParams.toString()}`;
    console.log('[API Service] EventSource URL for SSE:', eventSourceUrl);
    const mockEventSource = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        close: () => {
            console.log('[MockEventSource] close() called');
            clearTimeout(timeoutId);
        },
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'message' && typeof listener === 'function') mockEventSource.onmessage = listener as any;
            if (type === 'error' && typeof listener === 'function') mockEventSource.onerror = listener as any;
        },
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
            if (type === 'message' && mockEventSource.onmessage === listener) mockEventSource.onmessage = null;
            if (type === 'error' && mockEventSource.onerror === listener) mockEventSource.onerror = null;
        }
    } as unknown as EventSource;
    let chunkIndex = 0;
    const summaryChunks = [`Starting summary for ${tasks.length} tasks based on fields: ${selectedFields.join(', ')}. `, `Analyzing task details... `, `Key themes emerging are X, Y, and Z. `, `Potential actions include A, B. `, `This is a simulated stream. `, `Finalizing summary...`];
    let timeoutId: NodeJS.Timeout;
    const sendChunk = () => {
        if (chunkIndex < summaryChunks.length) {
            if (mockEventSource.onmessage) {
                const messageEvent = new MessageEvent('message', {
                    data: JSON.stringify({
                        type: 'chunk',
                        content: summaryChunks[chunkIndex]
                    })
                });
                mockEventSource.onmessage(messageEvent);
            }
            chunkIndex++;
            timeoutId = setTimeout(sendChunk, 300 + Math.random() * 200);
        } else {
            if (mockEventSource.onmessage) {
                const doneEvent = new MessageEvent('message', {data: JSON.stringify({type: 'done'})});
                mockEventSource.onmessage(doneEvent);
            }
            mockEventSource.close();
        }
    };
    setTimeout(() => {
        sendChunk();
    }, 100);
    return mockEventSource;
};
export const apiLinkSocialAccount = async (provider: 'google' | 'apple'): Promise<{
    success: boolean,
    error?: string,
    user?: User
}> => {
    await simulateNetworkDelay();
    console.log(`[API] Linking ${provider} account.`);
    const currentUser = (await apiFetchCurrentUser()).user;
    if (!currentUser) return {success: false, error: "User not found"};
    const updatedUser = {...currentUser, [`${provider}Linked`]: true} as User & {
        googleLinked?: boolean,
        appleLinked?: boolean
    };
    return {success: true, user: updatedUser};
};
export const apiUnlinkSocialAccount = async (provider: 'google' | 'apple'): Promise<{
    success: boolean,
    error?: string,
    user?: User
}> => {
    await simulateNetworkDelay();
    console.log(`[API] Unlinking ${provider} account.`);
    const currentUser = (await apiFetchCurrentUser()).user;
    if (!currentUser) return {success: false, error: "User not found"};
    const updatedUser = {...currentUser, [`${provider}Linked`]: false} as User & {
        googleLinked?: boolean,
        appleLinked?: boolean
    };
    return {success: true, user: updatedUser};
};
export const apiRequestAccountDeletion = async (userId: string): Promise<{ success: boolean, error?: string }> => {
    await simulateNetworkDelay(1000);
    console.log(`[API] Account deletion requested for user: ${userId}.`);
    return {success: true};
};
export const apiBackupData = async (userId: string): Promise<{ success: boolean, data?: any, error?: string }> => {
    await simulateNetworkDelay(1000);
    console.log(`[API] Backing up data for user: ${userId}.`);
    const tasks = await apiFetchTasks();
    const appearance = await apiFetchAppearanceSettings();
    const preferences = await apiFetchPreferencesSettings();
    const lists = await apiFetchUserLists();
    const summaries = await apiFetchStoredSummaries();
    const backupData = {
        userId,
        timestamp: Date.now(),
        tasks,
        appearanceSettings: appearance,
        preferencesSettings: preferences,
        userLists: lists,
        storedSummaries: summaries
    };
    return {success: true, data: backupData};
};
export const apiImportData = async (userId: string, file: File): Promise<{ success: boolean, error?: string }> => {
    await simulateNetworkDelay(1000);
    console.log(`[API] Importing data for user: ${userId}, file: ${file.name}, size: ${file.size} bytes.`);
    if (file.type !== 'application/json') {
        return {success: false, error: 'Invalid file type. Please upload a JSON file.'};
    }
    try {
        const fileContent = await file.text();
        const importedData = JSON.parse(fileContent);
        if (importedData.tasks) await apiUpdateTasks(importedData.tasks);
        if (importedData.appearanceSettings) await apiUpdateAppearanceSettings(importedData.appearanceSettings);
        if (importedData.preferencesSettings) await apiUpdatePreferencesSettings(importedData.preferencesSettings);
        if (importedData.userLists) await apiUpdateUserLists(importedData.userLists);
        if (importedData.storedSummaries) {
            localStorage.setItem('api_storedSummaries_simulation', JSON.stringify(importedData.storedSummaries));
        }
        console.log('[API] Import successful (simulated application of data).');
        return {success: true};
    } catch (e: any) {
        console.error('[API] Import failed:', e);
        return {success: false, error: `Import processing error: ${e.message}`};
    }
};
export const apiUpgradeToPro = async (userId: string, tierId: string): Promise<{
    success: boolean,
    checkoutUrl?: string,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log(`[API] User ${userId} attempting to upgrade to Pro tier ${tierId}.`);
    return {success: true, checkoutUrl: `https://example.com/checkout/pro?user=${userId}&tier=${tierId}`};
};
export const apiManageSubscription = async (userId: string): Promise<{
    success: boolean,
    portalUrl?: string,
    error?: string
}> => {
    await simulateNetworkDelay();
    console.log(`[API] User ${userId} attempting to manage subscription.`);
    return {success: true, portalUrl: `https://example.com/billing_portal/${userId}`};
};