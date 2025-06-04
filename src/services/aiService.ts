// src/services/aiService.ts
import {Subtask, Task} from '@/types';
import { apiStreamAiSummary, apiAnalyzeTaskInput } from './apiService'; // Added apiAnalyzeTaskInput

// Interface for AI analysis of a single task input
export interface AiTaskAnalysis {
    title: string; // The AI might refine the title
    content: string;
    subtasks: Array<
        Omit<Subtask, 'id' | 'parentId' | 'createdAt' | 'updatedAt' | 'completedAt' | 'completed' | 'order' | 'dueDate'> &
        { title: string; dueDate?: number | Date | string | null }
    >;
    tags: string[];
    priority?: number | null; // AI might suggest a priority
    dueDate?: number | null; // AI might parse a due date
}

// Function for analyzing a single task input sentence (Request-Response)
export const analyzeTaskInputWithAI = async (sentence: string, currentTaskDueDate: Date | null): Promise<AiTaskAnalysis> => {
    // This will call the backend endpoint dedicated to analyzing a single task string
    return apiAnalyzeTaskInput(sentence, currentTaskDueDate);
};

// Function for streaming an AI-generated summary (SSE) - Remains for SummaryView
export const streamAiGeneratedSummary = (
    tasks: Task[],
    selectedFields: string[],
    fieldLabelsMap: { [id: string]: string }
): EventSource => {
    return apiStreamAiSummary(tasks, selectedFields, fieldLabelsMap);
};