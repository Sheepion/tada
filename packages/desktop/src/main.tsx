import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { App } from '@tada/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import storageManager from '@tada/core/services/storageManager';
import { SqliteStorageService } from './services/sqliteStorageService';

// Import i18n configuration from core to initialize it
import '@tada/core/locales';

// Import base styles from core
import '@tada/core/styles/index.css';

// Initialize SQLite storage service
const initializeApp = async () => {
    const storageService = new SqliteStorageService();
    await storageService.initialize();
    storageManager.register(storageService);

    await storageService.preloadData();

    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error("Failed to find the root element. Ensure your HTML has an element with id='root'.");
    }

    const root = ReactDOM.createRoot(rootElement);

    root.render(
        <React.StrictMode>
            <JotaiProvider>
                <Tooltip.Provider delayDuration={200}>
                    <HashRouter>
                        <App />
                    </HashRouter>
                </Tooltip.Provider>
            </JotaiProvider>
        </React.StrictMode>
    );
};

initializeApp().catch(error => {
    // 1. 在开发者工具的控制台打印完整的错误对象，这是最重要的
    console.error('Failed to initialize app (full error object):', error);

    // 2. 在界面上显示更详细的信息
    const errorMessage = String(error);
    const errorDetails = JSON.stringify(error, null, 2);

    document.body.innerHTML = `
        <div style="padding: 20px; color: red; white-space: pre-wrap; font-family: monospace; word-break: break-all;">
            <h1>Application failed to start</h1>
            <p>${errorMessage}</p>
            <hr />
            <h2>Full Error Details (JSON):</h2>
            <pre>${errorDetails}</pre>
        </div>
    `;
});