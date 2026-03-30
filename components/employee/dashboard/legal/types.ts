import { User as UserType } from '../../../../types';

export type ViewMode = 'DASHBOARD' | 'CASE_LIST' | 'CASE_DETAIL' | 'ANALYZER' | 'GENERATOR' | 'CONSUMER_WIZARD' | 'CALCULATORS';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date | string;
}

export interface LegalCase {
    id: string;
    title: string;
    category: 'CIVIL' | 'WORK' | 'CONSUMER' | 'ADMIN' | 'ANALYSIS' | 'CONSULTATION' | 'OTHER';
    status: 'OPEN' | 'CLOSED' | 'ANALYZED' | 'ARCHIVED';
    createdAt: Date | string;
    messages: ChatMessage[];
    notes?: string;
    description?: string;
}

export const DUMMY_CASES: LegalCase[] = [
    {
        id: '1',
        title: 'Reklamacja laptopa',
        status: 'OPEN',
        createdAt: new Date('2024-03-10'),
        category: 'CONSUMER',
        messages: [{ id: 'm1', role: 'assistant', content: 'Dzień dobry. Jak mogę pomóc w sprawie reklamacji?', timestamp: new Date() }]
    }
];

export interface WizardStep {
    id: string;
    question: string;
    options: { label: string; subLabel?: string; icon: any; nextId: string | null; action?: string; templateId?: string }[];
    advice?: {
        title: string;
        description: string;
        legalBasis: string;
        isPositive: boolean;
    };
    finalAction?: {
        label: string;
        templateId: string;
    };
}

export interface DocumentTemplateField {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'date' | 'number' | 'select';
    placeholder?: string;
    options?: string[];
}

export interface DocumentTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    price?: number;
    fields: DocumentTemplateField[];
    contentTemplate: string;
}
