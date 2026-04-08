import React from 'react';
import {
  ShoppingBag, Briefcase, Truck, AlertTriangle, X, Clock, Calendar,
  Building2, Globe, CheckCircle, AlertCircle
} from 'lucide-react';
import { WizardStep } from './types';

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
