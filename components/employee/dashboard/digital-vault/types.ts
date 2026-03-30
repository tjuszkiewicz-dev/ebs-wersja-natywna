export interface VaultFile {
    id: string;
    name: string;
    type: 'file' | 'folder';
    size?: number; // bytes
    parentId: string | null; // null for root
    createdAt: number;
    content?: string; // base64 for demo
    extension?: string;
}

export interface VaultStats {
    usedBytes: number;
    totalBytes: number; // 10GB = 10 * 1024 * 1024 * 1024
    fileCount: number;
}
