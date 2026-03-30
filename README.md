# STRATTON PRIME: Eliton Benefits System (EBS)

**Wersja:** 1.0.8 (Unified UI)  
**Operator:** Stratton Prime S.A.

---

## 📖 Spis Treści

1. [Opis Ogólny Systemu](#-opis-ogólny-systemu)
2. [Schemat Procesu (Model Zaufania)](#-schemat-procesu-model-zaufania)
3. [Dokumentacja: Rola HR Manager](#-rola-hr-manager)
4. [Dokumentacja: Rola Administrator (Superadmin)](#-rola-administrator-superadmin)
5. [Dokumentacja: Rola Pracownik](#-rola-pracownik)
6. [Tabela Uprawnień](#-tabela-uprawnień)
7. [Instalacja i Konfiguracja Techniczna](#-instalacja-i-konfiguracja-techniczna)
8. [FAQ (Często Zadawane Pytania)](#-faq)

---

## 🌟 Opis Ogólny Systemu

**Eliton Benefits System (EBS)** to zaawansowana platforma klasy Enterprise służąca do zarządzania cyfrowymi benefitami pracowniczymi. System automatyzuje proces zamawiania, dystrybucji i rozliczania voucherów, wykorzystując unikalny **Model Zaufania (Trust Model)**, który pozwala na przekazanie środków pracownikom jeszcze przed zaksięgowaniem płatności.

Główne filary systemu:
*   **Optymalizacja Podatkowa:** Kalkulator płacowy "Net-First" (prognoza 2026) – automatyczny podział wynagrodzenia netto na gotówkę i vouchery.
*   **Mass Onboarding:** Szybki import pracowników z plików Excel z walidacją danych.
*   **Transparentność:** Pełna historia operacji, logi audytowe i zgodność z RODO.
*   **Bezpieczeństwo:** Procedury odkupu wygasłych środków (Buyback) z generowaniem umów prawnych.

---

## 🔄 Schemat Procesu (Model Zaufania)

Poniższy diagram przedstawia unikalny przepływ środków w systemie EBS:

```ascii
[HR] Zleca Zamówienie  --->  [ADMIN] Zatwierdza (Status: APPROVED)
                                      |
                                      v
                             [SYSTEM] Emituje Vouchery "RESERVED"
                                      |
        ---------------------------------------------------------
        |                                                       |
[HR] Rozdaje Vouchery (TRUST)                           [HR] Pobiera Fakturę VAT
(Pracownik otrzymuje środki natychmiast)                (Ma 7 dni na płatność)
        |                                                       |
[PRACOWNIK] Wydaje środki                               [ADMIN] Księguje wpłatę
                                                                |
                                                                v
                                                       [SYSTEM] Status: PAID
                                                       (Vouchery stają się ACTIVE)
```

---

## 🏢 Rola: HR Manager

Rola przeznaczona dla działów kadr i płac. Skupia się na zarządzaniu listą pracowników, budżetem oraz dokumentacją księgową.

### Główne Funkcjonalności
*   **Kreator Zamówień:** Składanie zamówień na vouchery z kalkulacją prowizji.
*   **Kalkulator Płacowy:** Import pliku Excel z kwotami netto i automatyczny podział na część gotówkową (minimum krajowe) i voucherową (nadwyżka).
*   **Dystrybucja Masowa:** Przelewanie środków do wielu pracowników jednym kliknięciem (na podstawie pliku Excel).
*   **Archiwum Dokumentów:** Pobieranie Not Księgowych, Faktur VAT i Protokołów Przekazania.

### Instrukcja Krok po Kroku: Nowy Miesiąc Rozliczeniowy

System prowadzi HR Managera przez proces za pomocą paska akcji (Action Bar):

1.  **KROK 1: KADRY (Aktualizacja Bazy)**
    *   Przejdź do zakładki **Pracownicy**.
    *   Użyj przycisku **"Dodaj Pracownika"** -> **"Lista z Excela"**, aby wgrać nowe osoby.
    *   *Wymagane:* Plik Excel zgodny z szablonem (dostępny do pobrania w oknie importu).

2.  **KROK 2: ZAMÓWIENIE (Zasilenie Budżetu)**
    *   Przejdź do zakładki **Rozliczenia**.
    *   Wpisz kwotę doładowania LUB użyj opcji **"Wgraj listę płac"** (zalecane dla automatycznego podziału).
    *   Kliknij **"Zamów Środki"**.

3.  **KROK 3: DYSTRYBUCJA (Model Zaufania)**
    *   Gdy Admin zatwierdzi zamówienie, na Pulpicie pojawi się przycisk **"Rozdaj Vouchery"**.
    *   Możesz rozdysponować środki (nawet te nieopłacone - status *Trust*) pojedynczo lub masowo.
    *   *Rezultat:* Pracownicy otrzymują powiadomienia i środki na konta.

4.  **KROK 4: PŁATNOŚĆ**
    *   Pobierz dokumenty finansowe z tabeli historii zamówień (Nota + Faktura).
    *   Opłać fakturę w terminie 7 dni.

### Ograniczenia
*   HR nie może edytować konfiguracji globalnej systemu.
*   HR nie może "cofnąć" rozdanych voucherów, jeśli pracownik już je wydał.

---

## 🛡️ Rola: Administrator (Superadmin)

Rola techniczna i nadzorcza. Posiada pełny wgląd w system, logi oraz konfigurację.

### Główne Funkcjonalności
*   **Weryfikacja Zamówień:** Zatwierdzanie lub odrzucanie zamówień składanych przez firmy.
*   **Księgowanie:** Symulacja i obsługa wpłat bankowych (zmiana statusu z APPROVED na PAID). Import plików bankowych (MT940/CSV).
*   **Zarządzanie Odkupami:** Akceptacja umów odkupu (zwrot środków za wygasłe vouchery).
*   **Diagnostyka:** Narzędzie "System Diagnostics" do testowania procesów na żywo (E2E).
*   **Compliance:** Anonimizacja danych użytkowników (RODO) i podgląd audytów dostępu.

### Instrukcja: Procesowanie Zamówienia Klienta

1.  Zaloguj się do **Centrum Dowodzenia**.
2.  Przejdź do zakładki **Zamówienia** (ikona trójkąta ostrzegawczego, jeśli są nowe).
3.  Znajdź zamówienie ze statusem `PENDING`.
4.  Kliknij **"Zatwierdź"**.
    *   *Akcja:* System wyemituje vouchery do puli rezerwacyjnej firmy. HR otrzyma powiadomienie.
5.  Po otrzymaniu przelewu bankowego:
    *   Wejdź w zakładkę **Bank & Windykacja**.
    *   Wgraj wyciąg lub ręcznie zatwierdź wpłatę.
    *   *Akcja:* Status zmienia się na `PAID`, vouchery stają się w pełni aktywne, naliczają się prowizje sprzedażowe.

### Instrukcja: Zarządzanie Odkupem (Buyback)

1.  Przejdź do zakładki **Odkupy**.
2.  Filtruj listę po statusie **"Do Akceptacji"**.
3.  Zweryfikuj dane użytkownika (kliknij na wiersz, aby zobaczyć szczegóły i historię zmian IBAN).
4.  Zaznacz umowy i kliknij **"Zatwierdź Wybrane"** lub **"Zaksięguj Wybrane"** (po wykonaniu przelewu zwrotnego).

---

## 👤 Rola: Pracownik

Użytkownik końcowy systemu. Odbiera benefity i wymienia je na usługi.

### Główne Funkcjonalności
*   **Mój Portfel:** Podgląd salda punktowego (1 pkt = 1 PLN) i ważności środków.
*   **Zamknięty Katalog Usług:** Zakup usług (Spotify, Bilety, Karty Paliwowe).
*   **Historia:** Przegląd wszystkich operacji (uznania i obciążenia).
*   **Odkup (Rezygnacja):** Automatyczne generowanie umowy zwrotu środków za niewykorzystane vouchery po ich wygaśnięciu.

### Instrukcja: Zakup Benefitu

1.  Zaloguj się do panelu pracownika.
2.  W zakładce **Mój Portfel** sprawdź "Dostępne Środki".
3.  Przewiń do sekcji **Zamknięty Katalog Usług** lub przejdź do zakładki **Zamknięty Katalog Usług**.
4.  Wybierz usługę (np. "Spotify Premium").
5.  W oknie potwierdzenia przesuń suwak w prawo ("Slide to Pay").
6.  *Rezultat:* Otrzymasz kod cyfrowy (QR), a saldo zostanie pomniejszone.

### Instrukcja: Uzupełnienie Danych do Przelewu (Odkup)

Jeśli Twoje vouchery wygasną, system zamieni je na gotówkę (procedura Odkupu). Aby to zrobić, musisz podać numer konta:
1.  Kliknij ikonę **Ustawienia** (lub "Profil" na mobile).
2.  W zakładce **Wypłaty** wpisz swój numer IBAN (PL...).
3.  Podaj powód zmiany/dodania konta.
4.  Zatwierdź. Administrator zweryfikuje Twój wniosek ze względów bezpieczeństwa.

---

## 📊 Tabela Uprawnień

| Funkcjonalność | Admin | HR | Pracownik |
| :--- | :---: | :---: | :---: |
| **Logowanie** | ✅ (2FA) | ✅ | ✅ |
| **Przegląd pracowników** | ✅ (Wszyscy) | ✅ (Własna firma) | ❌ |
| **Edycja danych osobowych** | ✅ | ✅ (Swoich + Prac.) | ❌ (Tylko IBAN/Hasło) |
| **Składanie zamówień** | ❌ | ✅ | ❌ |
| **Zatwierdzanie zamówień** | ✅ | ❌ | ❌ |
| **Dystrybucja środków** | ✅ (Manual) | ✅ | ❌ |
| **Zakup w katalogu** | ❌ | ❌ | ✅ |
| **Podgląd raportów finans.** | ✅ | ✅ | ❌ |
| **Konfiguracja systemu** | ✅ | ❌ | ❌ |
| **Anonimizacja (RODO)** | ✅ | ❌ | ❌ |

---

## ⚙️ Instalacja i Konfiguracja Techniczna

System jest aplikacją webową typu SPA (Single Page Application) napisaną w React z backendem Node.js do generowania PDF.

### Wymagania
*   Node.js v18+
*   NPM lub Yarn

### Uruchomienie (Środowisko Deweloperskie)

1.  **Instalacja zależności:**
    ```bash
    npm install
    ```

2.  **Start Serwera PDF (Backend):**
    Otwórz nowy terminal i wpisz:
    ```bash
    cd server
    npm install
    node app.js
    ```
    *Serwer nasłuchuje na porcie 3001. Odpowiada za generowanie plików PDF wysokiej jakości.*

3.  **Start Aplikacji (Frontend):**
    W głównym katalogu wpisz:
    ```bash
    npm start
    ```
    *Aplikacja uruchomi się pod adresem http://localhost:3000.*

---

## ❓ FAQ

### Dla HR
**Q: Czy mogę cofnąć wysłane vouchery?**  
A: Nie, transakcja jest nieodwracalna, ponieważ pracownik mógł już wymienić voucher na usługę. W przypadku pomyłki skontaktuj się z Administratorem w celu wykonania korekty (Clawback).

**Q: Co oznacza "Model Zaufania"?**  
A: Oznacza to, że możesz rozdać vouchery pracownikom od razu po zatwierdzeniu zamówienia przez Stratton Prime, nie czekając na księgowanie przelewu bankowego. Vouchery te mają status "RESERVED" do momentu opłacenia faktury.

### Dla Administratora
**Q: Jak dodać nową firmę?**  
A: Przejdź do zakładki **Konfiguracja** -> **Baza Firm** i kliknij "Dodaj Firmę" lub użyj przycisku "Synchronizuj CRM", aby pobrać dane z systemu zewnętrznego (jeśli integracja jest aktywna).

**Q: Jak zresetować system?**  
A: W zakładce **Konfiguracja** -> **Bezpieczeństwo** znajduje się przycisk "Reset Systemu" (Strefa Niebezpieczna). Usunie on wszystkie dane lokalne (Local Storage).

### Dla Pracownika
**Q: Dlaczego moje vouchery zniknęły?**  
A: Vouchery mają domyślną ważność 7 dni. Jeśli ich nie wykorzystasz, wygasają. System automatycznie wygeneruje dla Ciebie **Umowę Odkupu** w zakładce "Historia", aby zwrócić Ci równowartość w gotówce na podane konto bankowe.

**Q: Jak zmienić numer konta do wypłat?**  
A: Wejdź w Ustawienia Profilu -> Wypłaty. Pamiętaj, że każda zmiana IBAN musi zostać zatwierdzona przez Administratora.
