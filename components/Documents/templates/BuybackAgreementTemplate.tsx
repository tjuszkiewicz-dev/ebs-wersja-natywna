
import React from 'react';
import { BuybackAgreement, User } from '../../../types';
import { PDF_LAYOUT } from '../PDF_LAYOUT';
import { formatDate, formatCurrency } from '../documentUtils';

interface Props {
  data: BuybackAgreement;
  user: User;
}

export const BuybackAgreementTemplate: React.FC<Props> = ({ data, user }) => {
  
  // LOGIC: Use Snapshot Data if available (Priority), otherwise fallback to live User data
  // This ensures the PDF reflects the state at the moment of creation.
  const snapshotUser = data.snapshot?.user;

  const displayIban = snapshotUser?.iban || user.finance?.payoutAccount?.iban || '';
  const displayName = snapshotUser?.name || user.name;
  const displayEmail = snapshotUser?.email || user.email;
  const displayPesel = snapshotUser?.pesel || user.pesel || '----------------';

  // Format IBAN for display if exists
  const formattedIban = displayIban
    ? displayIban.replace(/(.{4})/g, '$1 ').trim() 
    : '________________________________________';

  return (
    <div 
        className={PDF_LAYOUT.printClass}
        style={{ 
            width: PDF_LAYOUT.cssWidth, 
            height: '296mm', // FIX: 1mm less than A4 to prevent browser rendering extra page
            padding: PDF_LAYOUT.cssPadding,
            fontSize: '10pt', 
            lineHeight: 1.5,
            fontFamily: '"Libre Baskerville", "Times New Roman", serif',
            color: '#000',
            overflow: 'hidden' // FIX: Force cut off anything spilling over
        }}
    >
       {/* 1. Header Section: Date & Location */}
       <div className="flex justify-end mb-6">
         <p className="italic">Warszawa, dnia {formatDate(data.dateGenerated)}</p>
       </div>

       {/* 2. Title Section */}
       <div className="text-center mb-8">
         <h1 className="font-bold uppercase tracking-widest border-b border-black pb-1 inline-block mb-1" style={{ fontSize: '14pt' }}>
            UMOWA ODKUPU VOUCHERÓW
         </h1>
         <p className="font-mono text-slate-600" style={{ fontSize: '8pt' }}>NR REF: {data.id}</p>
       </div>

       {/* 3. Parties Section (Grid) */}
       <div className="grid grid-cols-2 gap-8 mb-8" style={{ fontSize: '10pt' }}>
           {/* Seller */}
           <div>
               <p className="font-bold uppercase mb-1 tracking-widest border-b border-gray-300 pb-0.5" style={{ fontSize: '8pt' }}>SPRZEDAJĄCY (UŻYTKOWNIK)</p>
               <div className="leading-snug">
                   <p className="font-bold">{displayName}</p>
                   <p>ID Systemowe: {data.userId}</p>
                   <p>PESEL: {displayPesel}</p>
                   <p>{displayEmail}</p>
                   {snapshotUser?.address && <p className="text-[9pt] mt-1">{snapshotUser.address}</p>}
               </div>
           </div>
           
           {/* Buyer */}
           <div>
               <p className="font-bold uppercase mb-1 tracking-widest border-b border-gray-300 pb-0.5" style={{ fontSize: '8pt' }}>KUPUJĄCY (OPERATOR)</p>
               <div className="leading-snug">
                   <p className="font-bold">STRATTON PRIME S.A.</p>
                   <p>ul. Finansowa 12, 00-001 Warszawa</p>
                   <p>NIP: 521-333-44-55</p>
                   <p>Reprezentacja: System (EBS)</p>
               </div>
           </div>
       </div>

       {/* 4. Content Body - Justified Legal Text */}
       <div className="flex-1 text-justify space-y-4">
         <p>
            <strong>§1. Przedmiot Umowy.</strong><br/>
            1. Sprzedający oświadcza, że jest właścicielem elektronicznych znaków legitymacyjnych (Voucherów Prime) wymienionych w załączniku do niniejszej umowy.<br/>
            2. Przedmiotem umowy jest odpłatne przeniesienie praw do Voucherów na rzecz Kupującego w związku z ich wygaśnięciem lub rezygnacją z usług.
         </p>

         {/* Formal Table */}
         <div className="my-4">
            <table className="w-full border-collapse border border-black" style={{ fontSize: '9pt' }}>
                <thead className="bg-gray-100 text-black">
                    <tr>
                        <th className="border border-black p-1.5 text-left uppercase font-bold text-black" style={{ fontSize: '8pt' }}>Przedmiot Transakcji</th>
                        <th className="border border-black p-1.5 text-center uppercase font-bold text-black" style={{ fontSize: '8pt' }}>Ilość</th>
                        <th className="border border-black p-1.5 text-right uppercase font-bold text-black" style={{ fontSize: '8pt' }}>Nominał</th>
                        <th className="border border-black p-1.5 text-right uppercase font-bold text-black" style={{ fontSize: '8pt' }}>Wartość</th>
                    </tr>
                </thead>
                <tbody className="text-black">
                    <tr>
                        <td className="border border-black p-2 text-black">Voucher Prime (EBS) - Zwrot</td>
                        <td className="border border-black p-2 text-center font-mono text-black">{data.voucherCount}</td>
                        <td className="border border-black p-2 text-right font-mono text-black">1.00 PLN</td>
                        <td className="border border-black p-2 text-right font-bold font-mono text-black">{formatCurrency(data.totalValue)}</td>
                    </tr>
                </tbody>
            </table>
         </div>

         <p>
            <strong>§2. Warunki Płatności.</strong><br/>
            1. Strony ustalają łączną cenę odkupu na kwotę <strong>{formatCurrency(data.totalValue)}</strong>.<br/>
            2. Płatność nastąpi w terminie 7 dni od daty wygenerowania niniejszego dokumentu.<br/>
            3. Środki zostaną przekazane na rachunek bankowy Sprzedającego:
         </p>
         
         {/* IBAN Display */}
         <div className="bg-slate-50 border border-slate-300 p-3 font-mono text-center font-bold text-lg tracking-wider">
             {formattedIban}
         </div>

         <p>
            4. Z chwilą zapłaty, Vouchery zostają trwale umorzone w systemie EBS.
         </p>

         <p>
            <strong>§3. Postanowienia Końcowe.</strong><br/>
            Dokument został wygenerowany w formie elektronicznej na podstawie art. 60 Kodeksu Cywilnego. Wymiana oświadczeń woli nastąpiła poprzez system teleinformatyczny Operatora. Umowa nie wymaga odręcznego podpisu.
         </p>
       </div>

       {/* 5. Signature Footer */}
       <div className="mt-auto pt-8">
         <div className="grid grid-cols-2 gap-24">
            <div className="text-center">
                <div className="h-16 border-b border-black mb-1 flex flex-col justify-end pb-1 relative">
                     {/* Optional styling for "signed" look */}
                     <p className="font-script text-xl text-slate-400 absolute bottom-2 left-0 right-0 transform -rotate-2 opacity-50">{displayName}</p>
                </div>
                <p className="font-bold uppercase tracking-widest" style={{ fontSize: '8pt' }}>Sprzedający</p>
                <p className="text-gray-500 uppercase" style={{ fontSize: '7pt' }}>(Akceptacja Elektroniczna)</p>
            </div>
            <div className="text-center">
                <div className="h-16 border-b border-black mb-1 flex flex-col justify-end pb-1 relative">
                    <p className="font-script text-xl text-slate-400 absolute bottom-2 left-0 right-0 transform -rotate-2 opacity-50">Stratton Prime S.A.</p>
                </div>
                <p className="font-bold uppercase tracking-widest" style={{ fontSize: '8pt' }}>Kupujący</p>
                <p className="text-gray-500 uppercase" style={{ fontSize: '7pt' }}>(Pieczęć Systemowa)</p>
            </div>
         </div>
         
         <div className="text-center mt-8 text-gray-400 font-sans border-t border-gray-200 pt-2" style={{ fontSize: '7pt' }}>
            Dokument wygenerowany z systemu Eliton Benefits System (EBS) | ID: {data.id} | Suma kontrolna: {data.id.split('-').pop()}
         </div>
       </div>
    </div>
  );
};
