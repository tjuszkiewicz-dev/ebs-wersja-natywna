import React from 'react';
import { WizardStep, DocumentTemplate } from './types';
import { 
    ShoppingBag, Briefcase, Truck, AlertTriangle, X, Clock, Calendar, Building2, Globe, CheckCircle, AlertCircle
} from 'lucide-react';

export const CONSUMER_WIZARD_DATA: Record<string, WizardStep> = {
    'START': {
        id: 'START',
        question: 'Czego dotyczy Twój problem?',
        options: [
            { label: 'Zakup Towaru', subLabel: 'Buty, elektronika, meble...', icon: React.createElement(ShoppingBag, { size: 24 }), nextId: 'GOODS' },
            { label: 'Usługa', subLabel: 'Remont, fryzjer, mechanik...', icon: React.createElement(Briefcase, { size: 24 }), nextId: 'SERVICES' },
            { label: 'Zakupy Online', subLabel: 'Zwrot towaru (E-commerce)', icon: React.createElement(Truck, { size: 24 }), nextId: 'ONLINE_RETURN' }
        ]
    },
    'GOODS': {
        id: 'GOODS',
        question: 'Co jest nie tak z towarem?',
        options: [
            { label: 'Ma wadę / Zepsuł się', subLabel: 'Przestał działać, pękł, nie ma funkcji...', icon: React.createElement(AlertTriangle, { size: 24 }), nextId: 'DEFECT' },
            { label: 'Nie podoba mi się', subLabel: 'Zły rozmiar, kolor, rozmyśliłem się', icon: React.createElement(X, { size: 24 }), nextId: 'NO_DEFECT' }
        ]
    },
    'DEFECT': {
        id: 'DEFECT',
        question: 'Kiedy kupiłeś towar i kiedy zauważyłeś wadę?',
        options: [
            { label: 'Mniej niż 2 lata temu', subLabel: 'Wada wyszła w trakcie użytkowania', icon: React.createElement(Clock, { size: 24 }), nextId: 'REKOJMIA_ADVICE', templateId: 'TPL_REKLAMACJA' },
            { label: 'Ponad 2 lata temu', subLabel: 'Okres rękojmi minął', icon: React.createElement(Calendar, { size: 24 }), nextId: 'TOO_LATE_ADVICE' }
        ]
    },
    'REKOJMIA_ADVICE': {
        id: 'REKOJMIA_ADVICE',
        question: '',
        options: [],
        advice: {
            title: 'Masz prawo do reklamacji (Niezgodność towaru z umową)',
            description: 'Sprzedawca odpowiada za wady towaru przez 2 lata od wydania. Nie musisz posiadać paragonu (wystarczy dowód płatności kartą lub świadek). Możesz żądać naprawy lub wymiany. Jeśli to niemożliwe - obniżenia ceny lub zwrotu gotówki.',
            legalBasis: 'Art. 556 i nast. Kodeksu Cywilnego (Rękojmia) / Ustawa o prawach konsumenta',
            isPositive: true
        },
        finalAction: {
            label: 'Stwórz Pismo Reklamacyjne',
            templateId: 'TPL_REKLAMACJA'
        }
    },
    'NO_DEFECT': {
        id: 'NO_DEFECT',
        question: 'Gdzie dokonałeś zakupu?',
        options: [
            { label: 'Sklep Stacjonarny', subLabel: 'Galeria, sklep osiedlowy', icon: React.createElement(Building2, { size: 24 }), nextId: 'STATIONARY_ADVICE' },
            { label: 'Internet / Telefon', subLabel: 'Allegro, sklep online, pokaz', icon: React.createElement(Globe, { size: 24 }), nextId: 'ONLINE_RETURN' }
        ]
    },
    'STATIONARY_ADVICE': {
        id: 'STATIONARY_ADVICE',
        question: '',
        options: [],
        advice: {
            title: 'Zwrot zależy od dobrej woli sprzedawcy',
            description: 'Polskie prawo NIE gwarantuje możliwości zwrotu towaru pełnowartościowego zakupionego stacjonarnie ("widzimisię"). Sklepy mogą ustalać własne zasady (np. zwrot tylko na kartę podarunkową w ciągu 30 dni). Sprawdź regulamin sklepu na paragonie.',
            legalBasis: 'Zasada swobody umów (brak ustawowego prawa do zwrotu w sklepie stacjonarnym)',
            isPositive: false
        }
    },
    'ONLINE_RETURN': {
        id: 'ONLINE_RETURN',
        question: 'Ile czasu minęło od odebrania przesyłki?',
        options: [
            { label: 'Mniej niż 14 dni', subLabel: 'Jestem w terminie ustawowym', icon: React.createElement(CheckCircle, { size: 24 }), nextId: 'RETURN_OK_ADVICE', templateId: 'TPL_ODSTAPIENIE' },
            { label: 'Więcej niż 14 dni', subLabel: 'Termin minął', icon: React.createElement(Clock, { size: 24 }), nextId: 'RETURN_LATE_ADVICE' }
        ]
    },
    'RETURN_OK_ADVICE': {
        id: 'RETURN_OK_ADVICE',
        question: '',
        options: [],
        advice: {
            title: 'Możesz zwrócić towar bez podania przyczyny',
            description: 'Przysługuje Ci 14-dniowe prawo do odstąpienia od umowy zawartej na odległość. Nie musisz tłumaczyć dlaczego zwracasz. Towar może być rozpakowany w celu sprawdzenia (tak jak w sklepie).',
            legalBasis: 'Art. 27 Ustawy o prawach konsumenta',
            isPositive: true
        },
        finalAction: {
            label: 'Generuj Odstąpienie od Umowy',
            templateId: 'TPL_ODSTAPIENIE'
        }
    },
    'RETURN_LATE_ADVICE': {
        id: 'RETURN_LATE_ADVICE',
        question: '',
        options: [],
        advice: {
            title: 'Ustawowy termin minął',
            description: 'Minęło 14 dni na ustawowy zwrot. Sprzedawca nie ma obowiązku przyjąć zwrotu, chyba że jego własny regulamin jest bardziej korzystny (np. Zalando oferuje 100 dni). Sprawdź regulamin sklepu.',
            legalBasis: 'Art. 27 Ustawy o prawach konsumenta (termin zawity)',
            isPositive: false
        }
    },
    'SERVICES': {
        id: 'SERVICES',
        question: 'Na czym polega problem z usługą?',
        options: [
            { label: 'Opóźnienie', subLabel: 'Wykonawca nie dotrzymuje terminów', icon: React.createElement(Clock, { size: 24 }), nextId: 'SERVICE_DELAY' },
            { label: 'Wady / Fuszerka', subLabel: 'Źle wykonana praca', icon: React.createElement(AlertCircle, { size: 24 }), nextId: 'SERVICE_BAD' }
        ]
    },
    'SERVICE_DELAY': {
        id: 'SERVICE_DELAY',
        question: '',
        options: [],
        advice: {
            title: 'Wyznacz termin ostateczny',
            description: 'Jeśli wykonawca opóźnia się z rozpoczęciem lub wykończeniem dzieła tak dalece, że nie jest prawdopodobne, żeby zdołał je ukończyć w czasie umówionym, zamawiający może bez wyznaczenia terminu dodatkowego od umowy odstąpić jeszcze przed upływem terminu do wykonania dzieła.',
            legalBasis: 'Art. 635 Kodeksu Cywilnego',
            isPositive: true
        }
    },
    'SERVICE_BAD': {
        id: 'SERVICE_BAD',
        question: '',
        options: [],
        advice: {
            title: 'Żądaj poprawek (Rękojmia za wady dzieła)',
            description: 'Jeżeli dzieło ma wady, możesz żądać ich usunięcia w wyznaczonym terminie. Po bezskutecznym upływie terminu możesz odmówić przyjęcia naprawy i odstąpić od umowy (jeśli wada jest istotna) lub żądać obniżenia ceny.',
            legalBasis: 'Art. 636-638 Kodeksu Cywilnego',
            isPositive: true
        }
    },
    'TOO_LATE_ADVICE': {
        id: 'TOO_LATE_ADVICE',
        question: '',
        options: [],
        advice: {
            title: 'Upłynął okres odpowiedzialności sprzedawcy',
            description: 'Odpowiedzialność z tytułu rękojmi trwa 2 lata. Jeśli nie posiadasz dodatkowej, dobrowolnej gwarancji producenta (która może być dłuższa), dochodzenie roszczeń będzie bardzo trudne.',
            legalBasis: 'Art. 568 Kodeksu Cywilnego',
            isPositive: false
        }
    }
};

export const CATEGORY_LABELS: Record<string, string> = {
    'CIVIL': 'Prawo Cywilne',
    'WORK': 'Prawo Pracy',
    'CONSUMER': 'Konsument',
    'ADMIN': 'Administracja',
    'ANALYSIS': 'Analiza',
    'CONSULTATION': 'Konsultacja',
    'OTHER': 'Inne'
};

export const CATEGORY_COLORS: Record<string, string> = {
    'CIVIL': 'bg-blue-100 text-blue-800 border-blue-200',
    'WORK': 'bg-purple-100 text-purple-800 border-purple-200',
    'CONSUMER': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'ADMIN': 'bg-amber-100 text-amber-800 border-amber-200',
    'ANALYSIS': 'bg-rose-100 text-rose-800 border-rose-200',
    'CONSULTATION': 'bg-sky-100 text-sky-800 border-sky-200',
    'OTHER': 'bg-slate-100 text-slate-800 border-slate-200'
};

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
    {
        id: 'TPL_REKLAMACJA',
        name: 'Reklamacja Towaru (Rękojmia)',
        description: 'Zgłoszenie wady fizycznej towaru z żądaniem naprawy, wymiany lub zwrotu.',
        category: 'Konsumenckie',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text', placeholder: 'Warszawa, 20.10.2025' },
            { id: 'seller_name', label: 'Dane Sprzedawcy (Nazwa i Adres)', type: 'textarea', placeholder: 'Sklep XYZ Sp. z o.o.\nul. Przykładowa 1\n00-001 Warszawa' },
            { id: 'sender_address', label: 'Twój Adres (do korespondencji)', type: 'textarea', placeholder: 'Jan Kowalski\nul. Moja 5/10\n00-999 Miasto' },
            { id: 'date_purchase', label: 'Data zakupu', type: 'date' },
            { id: 'product_name', label: 'Nazwa towaru', type: 'text', placeholder: 'np. Buty sportowe Nike Air' },
            { id: 'price', label: 'Cena (PLN)', type: 'number', placeholder: '299.00' },
            { id: 'defect_date', label: 'Data stwierdzenia wady', type: 'date' },
            { id: 'defect_desc', label: 'Opis wady', type: 'textarea', placeholder: 'Opisz dokładnie na czym polega usterka, np. odklejenie podeszwy...' },
            { id: 'demand', label: 'Żądanie', type: 'select', options: ['nieodpłatną naprawę towaru', 'wymianę towaru na nowy', 'obniżenie ceny', 'odstąpienie od umowy (zwrot gotówki)'] }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
        <div style="width: 45%;">
            <strong>Nadawca:</strong><br/>
            {sender_address}
        </div>
        <div style="width: 45%;">
            <strong>Adresat:</strong><br/>
            {seller_name}
        </div>
    </div>

    <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 30px; font-size: 16px; font-weight: bold;">REKLAMACJA TOWARU Z TYTUŁU RĘKOJMI</h2>

    <p style="text-align: justify; margin-bottom: 15px;">
        Niniejszym zawiadamiam, że zakupiony przeze mnie w dniu <strong>{date_purchase}</strong> towar w postaci: <strong>{product_name}</strong> za cenę <strong>{price} PLN</strong> jest wadliwy.
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Wada została stwierdzona w dniu <strong>{defect_date}</strong> i polega na:<br/>
        <em>{defect_desc}</em>
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Z uwagi na powyższe, na podstawie ustawy Kodeks cywilny, żądam: <strong>{demand}</strong>.
    </p>

    <p style="text-align: justify; margin-bottom: 40px;">
        Oczekuję na ustosunkowanie się do niniejszej reklamacji w terminie 14 dni od jej otrzymania.
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis konsumenta
    </div>
</div>
`
    },
    {
        id: 'TPL_ODSTAPIENIE',
        name: 'Odstąpienie od umowy (14 dni)',
        description: 'Zwrot towaru zakupionego przez internet bez podania przyczyny.',
        category: 'Konsumenckie',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text', placeholder: 'Kraków, 12.05.2025' },
            { id: 'seller_name', label: 'Dane Sprzedawcy', type: 'textarea', placeholder: 'Sklep Internetowy...' },
            { id: 'sender_address', label: 'Twój Adres', type: 'textarea', placeholder: 'Jan Kowalski...' },
            { id: 'order_no', label: 'Numer zamówienia', type: 'text', placeholder: 'ZAM/2025/...' },
            { id: 'date_contract', label: 'Data zawarcia umowy', type: 'date' },
            { id: 'date_received', label: 'Data odbioru towaru', type: 'date' },
            { id: 'items', label: 'Zwracane przedmioty', type: 'textarea', placeholder: 'Wymień co zwracasz...' },
            { id: 'iban', label: 'Nr konta do zwrotu', type: 'text', placeholder: 'PL 00 0000 0000...' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
        <div style="width: 45%;">
            <strong>Nadawca:</strong><br/>
            {sender_address}
        </div>
        <div style="width: 45%;">
            <strong>Adresat:</strong><br/>
            {seller_name}
        </div>
    </div>

    <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 30px; font-size: 16px; font-weight: bold;">OŚWIADCZENIE O ODSTĄPIENIU OD UMOWY</h2>
    <p style="text-align: center; font-size: 12px; margin-top: -20px;">ZAWARTEJ NA ODLEGŁOŚĆ</p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Niniejszym informuję o moim odstąpieniu od umowy sprzedaży następujących rzeczy: <strong>{items}</strong>.
    </p>
    
    <p style="text-align: justify; margin-bottom: 15px;">
        Numer zamówienia: <strong>{order_no}</strong><br/>
        Data zawarcia umowy: {date_contract}<br/>
        Data odbioru towaru: {date_received}
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Proszę o zwrot płatności na rachunek bankowy:
    </p>

    <div style="background: #f3f3f3; padding: 10px; font-family: monospace; font-size: 14px; text-align: center; margin: 20px 0; border: 1px solid #ccc;">
        {iban}
    </div>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis
    </div>
</div>
`
    },
    {
        id: 'TPL_LOT',
        name: 'Odszkodowanie za opóźniony lot',
        description: 'Wniosek do linii lotniczej (Rozporządzenie WE 261/2004).',
        category: 'Podróże',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text', placeholder: 'Warszawa, ...' },
            { id: 'airline_name', label: 'Linia Lotnicza', type: 'text', placeholder: 'np. Ryanair, LOT' },
            { id: 'sender_address', label: 'Twoje Dane', type: 'textarea', placeholder: 'Imię, Nazwisko, Adres' },
            { id: 'flight_no', label: 'Numer Lotu', type: 'text', placeholder: 'np. FR1234' },
            { id: 'route', label: 'Trasa (Od - Do)', type: 'text', placeholder: 'Warszawa - Londyn' },
            { id: 'date_flight', label: 'Data Lotu', type: 'date' },
            { id: 'delay_hours', label: 'Czas opóźnienia (godz)', type: 'number', placeholder: '4' },
            { id: 'iban', label: 'Twój IBAN', type: 'text', placeholder: 'PL...' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>

    <div style="margin-bottom: 40px;">
        <strong>Nadawca:</strong><br/>
        {sender_address}
        <br/><br/>
        <strong>Do:</strong><br/>
        {airline_name} (Dział Reklamacji)
    </div>

    <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 30px; font-size: 16px; font-weight: bold;">WNIOSEK O ODSZKODOWANIE (WE 261/2004)</h2>

    <p style="text-align: justify; margin-bottom: 15px;">
        W związku z opóźnieniem/odwołaniem mojego lotu numer <strong>{flight_no}</strong> w dniu {date_flight} na trasie {route}.
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Zgodnie z Rozporządzeniem (WE) nr 261/2004 Parlamentu Europejskiego, opóźnienie w miejscu docelowym wyniosło powyżej <strong>{delay_hours} godzin</strong>. Wnoszę o wypłatę zryczałtowanego odszkodowania przewidzianego prawem.
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Płatności proszę dokonać na rachunek: {iban}.
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis pasażera
    </div>
</div>
`
    },
    {
        id: 'TPL_WYPOWIEDZENIE_NAJMU',
        name: 'Wypowiedzenie Umowy Najmu',
        description: 'Rozwiązanie umowy najmu mieszkania przez najemcę.',
        category: 'Nieruchomości',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text' },
            { id: 'landlord_name', label: 'Wynajmujący (Właściciel)', type: 'text', placeholder: 'Jan Kowalski' },
            { id: 'tenant_name', label: 'Najemca (Ty)', type: 'text', placeholder: 'Anna Nowak' },
            { id: 'address_property', label: 'Adres Lokalu', type: 'text', placeholder: 'ul. Długa 1/10, Warszawa' },
            { id: 'contract_date', label: 'Data zawarcia umowy', type: 'date' },
            { id: 'termination_period', label: 'Okres wypowiedzenia', type: 'text', placeholder: 'np. 1 miesiąc' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>

    <div style="margin-bottom: 40px;">
        <strong>Najemca:</strong><br/>
        {tenant_name}
        <br/><br/>
        <strong>Wynajmujący:</strong><br/>
        {landlord_name}
    </div>

    <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 30px; font-size: 16px; font-weight: bold;">WYPOWIEDZENIE UMOWY NAJMU</h2>

    <p style="text-align: justify; margin-bottom: 15px;">
        Niniejszym wypowiadam umowę najmu lokalu mieszkalnego położonego w: <strong>{address_property}</strong>, zawartą w dniu {contract_date}.
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Zgodnie z postanowieniami umowy, zachowuję obowiązujący okres wypowiedzenia wynoszący <strong>{termination_period}</strong>.
    </p>

    <p style="text-align: justify; margin-bottom: 15px;">
        Jednocześnie wnoszę o ustalenie terminu zdania lokalu i sporządzenia protokołu zdawczo-odbiorczego.
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis Najemcy
    </div>
</div>
`
    },
    {
        id: 'TPL_PROTOKOL_ZDAWCZY',
        name: 'Protokół Zdawczo-Odbiorczy',
        description: 'Dokument przekazania mieszkania/lokalu (liczniki, stan).',
        category: 'Nieruchomości',
        fields: [
            { id: 'address', label: 'Adres Lokalu', type: 'text' },
            { id: 'date', label: 'Data przekazania', type: 'date' },
            { id: 'lic_prad', label: 'Stan licznika prądu', type: 'text', placeholder: '12345 kWh' },
            { id: 'lic_woda', label: 'Stan licznika wody', type: 'text', placeholder: '123 m3' },
            { id: 'lic_gaz', label: 'Stan licznika gazu', type: 'text', placeholder: '456 m3' },
            { id: 'uwagi', label: 'Uwagi / Usterki', type: 'textarea', placeholder: 'Brak usterek / Pęknięta szyba...' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <h2 style="text-align: center; text-transform: uppercase; margin-bottom: 30px; font-size: 16px; font-weight: bold;">PROTOKÓŁ ZDAWCZO-ODBIORCZY</h2>
    
    <p>Sporządzony w dniu {date} dla lokalu: <strong>{address}</strong>.</p>
    
    <h3>Stany Liczników:</h3>
    <ul>
        <li>Energia elektryczna: {lic_prad}</li>
        <li>Woda: {lic_woda}</li>
        <li>Gaz: {lic_gaz}</li>
    </ul>

    <h3>Uwagi do stanu technicznego:</h3>
    <p>{uwagi}</p>

    <div style="display: flex; justify-content: space-between; margin-top: 60px;">
        <div style="border-top: 1px dashed #000; width: 40%; text-align: center;">Zdający</div>
        <div style="border-top: 1px dashed #000; width: 40%; text-align: center;">Odbierający</div>
    </div>
</div>
`
    },
    {
        id: 'TPL_POZYCZKA',
        name: 'Umowa Pożyczki (Prywatna)',
        description: 'Prosta umowa pożyczki pieniędzy między osobami fizycznymi.',
        category: 'Finanse',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text' },
            { id: 'lender', label: 'Pożyczkodawca (Imię, Nazwisko, PESEL)', type: 'text' },
            { id: 'borrower', label: 'Pożyczkobiorca (Imię, Nazwisko, PESEL)', type: 'text' },
            { id: 'amount', label: 'Kwota Pożyczki (PLN)', type: 'number', placeholder: '1000' },
            { id: 'return_date', label: 'Termin Zwrotu', type: 'date' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>
    <h2 style="text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 20px;">UMOWA POŻYCZKI</h2>
    
    <p>Zawarta pomiędzy:</p>
    <p>1. <strong>{lender}</strong> (Pożyczkodawca)</p>
    <p>2. <strong>{borrower}</strong> (Pożyczkobiorca)</p>

    <p>§1. Pożyczkodawca udziela Pożyczkobiorcy pożyczki w kwocie <strong>{amount} PLN</strong>.</p>
    <p>§2. Pożyczkobiorca kwituje odbiór gotówki / przelewu przy podpisywaniu umowy.</p>
    <p>§3. Pożyczkobiorca zobowiązuje się zwrócić całą kwotę do dnia <strong>{return_date}</strong>.</p>
    
    <p style="font-size: 10px; margin-top: 20px; font-style: italic;">
        *Uwaga: Pożyczka powyżej 1000 zł od osoby niespokrewnionej wymaga zgłoszenia PCC-3 do Urzędu Skarbowego w ciągu 14 dni.
    </p>

    <div style="display: flex; justify-content: space-between; margin-top: 60px;">
        <div style="border-top: 1px dashed #000; width: 40%; text-align: center;">Pożyczkodawca</div>
        <div style="border-top: 1px dashed #000; width: 40%; text-align: center;">Pożyczkobiorca</div>
    </div>
</div>
`
    },
    {
        id: 'TPL_PRACA_ZDALNA',
        name: 'Wniosek o Pracę Zdalną',
        description: 'Wniosek pracownika o okazjonalną lub stałą pracę zdalną.',
        category: 'Prawo Pracy',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text' },
            { id: 'employer', label: 'Pracodawca', type: 'text', placeholder: 'Nazwa Firmy' },
            { id: 'employee', label: 'Pracownik', type: 'text', placeholder: 'Jan Kowalski' },
            { id: 'type', label: 'Rodzaj', type: 'select', options: ['Praca zdalna okazjonalna (do 24 dni)', 'Stała praca zdalna', 'Praca hybrydowa'] },
            { id: 'dates', label: 'W dniach / Od dnia', type: 'text', placeholder: 'np. 20.05.2025' },
            { id: 'reason', label: 'Uzasadnienie (opcjonalne)', type: 'textarea', placeholder: 'Sprawy rodzinne...' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>
    <div>
        <strong>Pracownik:</strong> {employee}<br/>
        <strong>Do:</strong> {employer}
    </div>

    <h2 style="text-align: center; margin-top: 40px; font-size: 16px; font-weight: bold;">WNIOSEK O PRACĘ ZDALNĄ</h2>

    <p>
        Wnoszę o wyrażenie zgody na wykonywanie pracy w trybie: <strong>{type}</strong>.
    </p>
    <p>
        Termin: <strong>{dates}</strong>.
    </p>
    <p>
        Oświadczam, że posiadam warunki lokalowe i techniczne do świadczenia pracy w miejscu zamieszkania.
    </p>
    <p>
        Uzasadnienie: {reason}
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis Pracownika
    </div>
</div>
`
    },
    {
        id: 'TPL_WYPOWIEDZENIE_ABONAMENTU',
        name: 'Wypowiedzenie Abonamentu',
        description: 'Rezygnacja z usług telekomunikacyjnych, siłowni, TV.',
        category: 'Usługi',
        fields: [
            { id: 'city_date', label: 'Data', type: 'text' },
            { id: 'provider', label: 'Usługodawca', type: 'text', placeholder: 'np. Orange, CityFit' },
            { id: 'client_id', label: 'Numer Klienta / Umowy', type: 'text' },
            { id: 'reason', label: 'Typ wypowiedzenia', type: 'select', options: ['Z zachowaniem okresu wypowiedzenia', 'Ze skutkiem natychmiastowym (ważny powód)', 'Na koniec okresu zastrzeżonego'] }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>
    <strong>Do:</strong> {provider}

    <h2 style="text-align: center; margin-top: 30px; font-size: 16px; font-weight: bold;">WYPOWIEDZENIE UMOWY</h2>

    <p>
        Niniejszym wypowiadam umowę o świadczenie usług (Nr klienta/umowy: <strong>{client_id}</strong>).
    </p>
    <p>
        Tryb: {reason}.
    </p>
    <p>
        Proszę o pisemne potwierdzenie rozwiązania umowy oraz wskazanie daty końcowej świadczenia usług.
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis Abonenta
    </div>
</div>
`
    },
    {
        id: 'TPL_MANDAT',
        name: 'Odwołanie od Mandatu',
        description: 'Pismo do sądu/organu w sprawie niesłusznie nałożonego mandatu.',
        category: 'Ruch Drogowy',
        fields: [
            { id: 'city_date', label: 'Data', type: 'text' },
            { id: 'authority', label: 'Organ (np. Komendant Policji)', type: 'text' },
            { id: 'ticket_no', label: 'Seria i numer mandatu', type: 'text' },
            { id: 'justification', label: 'Uzasadnienie (Opis sytuacji)', type: 'textarea', placeholder: 'Nie popełniłem wykroczenia ponieważ...' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>
    <strong>Do:</strong> {authority}

    <h2 style="text-align: center; margin-top: 30px; font-size: 16px; font-weight: bold;">ODWOŁANIE OD MANDATU KARNEGO</h2>
    
    <p>
        Wnoszę o uchylenie mandatu karnego seria/nr: <strong>{ticket_no}</strong> nałożonego w dniu {city_date}.
    </p>

    <p><strong>Uzasadnienie:</strong></p>
    <p>{justification}</p>

    <p>
        W związku z powyższym odmawiam przyjęcia mandatu i wnoszę o skierowanie sprawy na drogę postępowania sądowego (jeśli dotyczy) lub jego anulowanie.
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis
    </div>
</div>
`
    },
    {
        id: 'TPL_PELNOMOCNICTWO',
        name: 'Pełnomocnictwo Ogólne',
        description: 'Upoważnienie innej osoby do działania w Twoim imieniu.',
        category: 'Inne',
        fields: [
            { id: 'city_date', label: 'Miejscowość i data', type: 'text' },
            { id: 'principal', label: 'Mocodawca (Ty)', type: 'text', placeholder: 'Imię, Nazwisko, PESEL' },
            { id: 'agent', label: 'Pełnomocnik (Osoba zaufana)', type: 'text', placeholder: 'Imię, Nazwisko, PESEL' },
            { id: 'scope', label: 'Zakres', type: 'textarea', placeholder: 'np. do odbioru korespondencji, reprezentowania w urzędzie...' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>
    <h2 style="text-align: center; margin-bottom: 30px; font-size: 18px; font-weight: bold;">PEŁNOMOCNICTWO</h2>

    <p>
        Ja, niżej podpisany/a <strong>{principal}</strong>, legitymujący/a się dowodem osobistym/PESEL wskazanym powyżej,
    </p>
    <p>
        niniejszym <strong>upoważniam</strong>:
    </p>
    <p>
        Pana/Panią <strong>{agent}</strong>
    </p>
    <p>
        do działania w moim imieniu w następującym zakresie:
        <br/>
        <em>{scope}</em>
    </p>

    <div style="margin-top: 80px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis Mocodawcy
    </div>
</div>
`
    },
    {
        id: 'TPL_RODO_DELETE',
        name: 'Żądanie usunięcia danych (RODO)',
        description: 'Wniosek o "bycie zapomnianym" do firmy marketingowej/bazy.',
        category: 'Inne',
        fields: [
            { id: 'city_date', label: 'Data', type: 'text' },
            { id: 'controller', label: 'Administrator Danych (Firma)', type: 'text' },
            { id: 'my_data', label: 'Twoje dane (do identyfikacji)', type: 'text', placeholder: 'Email / Telefon' }
        ],
        contentTemplate: `
<div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #000;">
    <div style="text-align: right; margin-bottom: 20px;">{city_date}</div>
    <strong>Do:</strong> {controller}

    <h2 style="text-align: center; margin-top: 30px; font-size: 16px; font-weight: bold;">ŻĄDANIE USUNIĘCIA DANYCH OSOBOWYCH</h2>

    <p>
        Na podstawie art. 17 RODO (prawo do bycia zapomnianym), żądam niezwłocznego usunięcia moich danych osobowych z Państwa bazy danych.
    </p>
    <p>
        Dane identyfikacyjne: <strong>{my_data}</strong>.
    </p>
    <p>
        Cofam wszelkie zgody marketingowe. Proszę o potwierdzenie usunięcia danych.
    </p>

    <div style="margin-top: 60px; float: right; width: 200px; border-top: 1px dashed #000; text-align: center; font-size: 12px;">
        Podpis
    </div>
</div>
`
    }
];
