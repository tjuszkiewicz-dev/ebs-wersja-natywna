
import React from 'react';
import { DocumentTemplate, Company } from '../../../types';
import { PDF_LAYOUT } from '../PDF_LAYOUT';

interface Props {
  data: DocumentTemplate;
  company?: Company;
}

export const PolicyTemplate: React.FC<Props> = ({ data, company }) => {
  return (
    <div 
        className={PDF_LAYOUT.printClass}
        style={{ 
            width: PDF_LAYOUT.cssWidth, 
            height: PDF_LAYOUT.cssHeight, 
            padding: PDF_LAYOUT.cssPadding,
            fontSize: '10pt',
            fontFamily: 'Inter, sans-serif'
        }}
    >
        {/* Header */}
        <div className="mb-8 border-b border-black pb-4 flex justify-between items-end">
            <div>
                <h1 className="text-xl font-bold uppercase tracking-wider text-black">{data.name}</h1>
                <p className="text-sm text-gray-600 mt-1">Dokument Systemowy EBS</p>
            </div>
            <div className="text-right text-xs text-gray-500">
                <p>Wersja: {data.version}.0</p>
                <p>Data aktualizacji: {new Date(data.lastModified).toLocaleDateString()}</p>
                {company && <p className="mt-1 font-bold">{company.name}</p>}
            </div>
        </div>

        {/* Content Body - Pre-wrap to preserve formatting from textarea */}
        <div className="text-justify whitespace-pre-wrap leading-relaxed text-sm">
            {data.content}
        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-gray-300 text-center text-[8pt] text-gray-400">
            Dokument pobrany z platformy Eliton Benefits System (EBS).<br/>
            Obowiązuje od dnia publikacji w systemie.
        </div>
    </div>
  );
};
