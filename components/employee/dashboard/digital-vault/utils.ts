// Mock data/logic for the vault
import { VaultFile } from './types';

export const MOCK_VAULT_STORAGE_KEY = 'ebs_digital_vault_files_v1';
export const MOCK_VAULT_SUBSCRIPTION_KEY = 'ebs_digital_vault_sub_v1';

export const TOTAL_SPACE = 10 * 1024 * 1024 * 1024; // 10GB

export const getStoredFiles = (): VaultFile[] => {
    const data = localStorage.getItem(MOCK_VAULT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

export const saveStoredFiles = (files: VaultFile[]) => {
    localStorage.setItem(MOCK_VAULT_STORAGE_KEY, JSON.stringify(files));
};

export const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const getFileIcon = (filename: string) => {
    // Simple icon mapping or return generic
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf': return 'file-text';
        case 'doc': case 'docx': return 'file-type-word';
        case 'xls': case 'xlsx': return 'file-spreadsheet';
        case 'jpg': case 'png': case 'jpeg': return 'image';
        default: return 'file';
    }
};
