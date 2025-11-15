import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const ChangelogPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadContent = async () => {
            try {
                setLoading(true);
                const lang = i18n.language === 'zh-CN' ? 'zh-CN' : 'en';

                const url = `${import.meta.env.BASE_URL}content/changelog.${lang}.md`.replace(/\/+/g, '/');
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error('Failed to load changelog');
                }

                const text = await response.text();
                setContent(text);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load content');
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [i18n.language]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-neutral-800 flex items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-white dark:bg-neutral-800 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-grey-medium dark:text-neutral-400 mb-4">{error}</p>
                    <Button asChild variant="ghost">
                        <Link to="/">{t('common.backToApp')}</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-neutral-800">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <Button asChild variant="ghost" icon="arrow-left" className="mb-4">
                        <Link to="/">{t('common.backToApp')}</Link>
                    </Button>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </div>

                <div className="mt-12 pt-8 border-t border-grey-light dark:border-neutral-700">
                    <div className="text-center">
                        <Button asChild>
                            <Link to="/">{t('common.backToApp')}</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChangelogPage;