
// GLOBAL EXTERNAL LIBS
declare global {
    const XLSX: {
        read: (data: any, options: any) => any;
        utils: {
            sheet_to_json: (sheet: any, options?: any) => any[];
            aoa_to_sheet: (data: any[][]) => any;
            book_new: () => any;
            book_append_sheet: (wb: any, ws: any, name: string) => void;
            json_to_sheet: (data: any[]) => any;
        };
        writeFile: (wb: any, filename: string) => void;
    };

    interface Window {
        html2pdf: () => {
            set: (opt: any) => any;
            from: (element: HTMLElement) => any;
            save: () => Promise<void>;
        };
    }

    const JSZip: new () => {
        file: (name: string, data: any) => void;
        folder: (name: string) => any;
        generateAsync: (options: any) => Promise<Blob>;
    };

    const saveAs: (data: Blob, filename: string) => void;
}

export * from './types/enums';
export * from './types/user';
export * from './types/company';
export * from './types/voucher';
export * from './types/order';
export * from './types/core';
export * from './types/notification';
export * from './types/system';
