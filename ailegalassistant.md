
# AI Legal Assistant – Twój osobisty prawnik dostępny 24/7 w ramach benefitów pracowniczych
**Rozwiązuj codzienne problemy prawne w 60 sekund, analizuj umowy i generuj pisma urzędowe bez wychodzenia z domu i ponoszenia dodatkowych kosztów.**

---

### O aplikacji
AI Legal Assistant to rewolucyjny benefit pracowniczy, który zapewnia Ci poczucie bezpieczeństwa w życiu prywatnym i zawodowym. Zamiast wydawać setki złotych na jednorazowe konsultacje w kancelariach lub tracić godziny na przeszukiwanie forów internetowych, wykorzystaj swoje punkty benefitowe, aby uzyskać natychmiastową, rzetelną pomoc prawną. Aplikacja została stworzona z myślą o pracownikach, którzy potrzebują szybkiego wsparcia w zrozumieniu zawiłości prawnych – od wynajmu mieszkania, przez reklamacje towarów, aż po sprawy urzędowe. Dzięki integracji z Twoim kontem na platformie benefitowej, profesjonalna pomoc prawna jest teraz tak dostępna, jak karta sportowa czy bilet do kina.

### Główne funkcje aplikacji

**1. AI Legal Assistant – Porady prawne w 60 sekund**
To serce aplikacji – inteligentny czat, który rozumie polskie prawo i potrafi przełożyć je na ludzki język. Masz problem z sąsiadem? Zastanawiasz się, czy należy Ci się odszkodowanie za opóźniony lot? A może potrzebujesz szybkiej interpretacji przepisu drogowego? Po prostu zadaj pytanie. Asystent w czasie rzeczywistym analizuje Twoją sytuację w oparciu o aktualne kodeksy i orzecznictwo, dostarczając konkretną odpowiedź wraz z podstawą prawną. To idealne rozwiązanie do szybkiej weryfikacji faktów w sytuacjach stresowych.

**2. Analiza umów PDF – Twój filtr bezpieczeństwa**
Podpisujesz umowę najmu mieszkania, kupna samochodu, polisę ubezpieczeniową lub umowę na remont? Nie ryzykuj. Wgraj plik PDF lub zdjęcie dokumentu do aplikacji. AI Legal Assistant w kilka chwil prześwietli treść umowy, wyłapując tzw. "haczyki", klauzule abuzywne (niedozwolone) oraz zapisy niekorzystne dla Ciebie. Otrzymasz jasny raport: co jest bezpieczne, co jest ryzykowne i co powinieneś renegocjować, zanim złożysz podpis.

**3. Generator pism urzędowych i procesowych**
Koniec z walką z pustą kartką i urzędowym żargonem. Funkcja ta pozwala na błyskawiczne stworzenie profesjonalnego dokumentu. Wybierasz cel (np. reklamacja obuwia, odwołanie od mandatu, wniosek o 500+, wypowiedzenie umowy telekomunikacyjnej), podajesz kluczowe dane, a system generuje gotowy do wydruku lub wysyłki plik PDF/DOCX. Dokumenty są sformułowane w sposób, który wymusza na instytucjach i firmach poważne traktowanie Twojej sprawy.

**4. Porady konsumenckie – Twoja tarcza w zakupach**
Czujesz się oszukany przez sprzedawcę? Sklep odmawia przyjęcia zwrotu? Aplikacja krok po kroku poprowadzi Cię przez proces dochodzenia swoich praw. Dowiesz się, kiedy skorzystać z rękojmi, a kiedy z gwarancji, jak skutecznie odstąpić od umowy zawartej na odległość i jak walczyć z nieuczciwymi praktykami rynkowymi. To Twoje wsparcie w walce z dużymi korporacjami i nieuczciwymi sprzedawcami.

### Model płatności voucherami
Dostęp do AI Legal Assistant jest w pełni zintegrowany z Twoim portfelem punktowym na platformie benefitowej. Oferujemy elastyczność dopasowaną do Twoich potrzeb:

*   **Subskrypcja "Legalny Spokój" (Miesięczna):** Za stałą liczbę punktów (voucherów) otrzymujesz nielimitowany dostęp do czatu z asystentem oraz generatora pism. To idealna opcja dla osób, które chcą mieć stałe poczucie bezpieczeństwa.
*   **Płatność za funkcję (Pay-per-use):** Potrzebujesz tylko sprawdzić jedną umowę najmu? Zapłać voucherami jednorazowo za analizę konkretnego pliku PDF. Płacisz tylko wtedy, kiedy realnie potrzebujesz wsparcia, bez długoterminowych zobowiązań.

---

### 🔧 Rekomendacje Techniczne i Architektura Backendu (Dla Deweloperów)

Poniższa sekcja stanowi wytyczne dla zespołu inżynierskiego odpowiedzialnego za budowę silnika AI oraz bazy wiedzy aplikacji. Celem jest zapewnienie wysokiej precyzji odpowiedzi (zminimalizowanie halucynacji) oraz zgodności z polskim systemem prawnym.

#### 1. Wymagane źródła danych i struktura bazy wiedzy (Knowledge Base)

System musi opierać się na technologii RAG (Retrieval-Augmented Generation). Model AI nie może polegać wyłącznie na swojej "wiedzy wytrenowanej", lecz musi dynamicznie odpytywać aktualną bazę aktów prawnych.

**Kluczowe akty prawne (Pliki źródłowe do wektoryzacji):**
Backend musi posiadać zindeksowane i regularnie aktualizowane (poprzez API ISAP - Internetowy System Aktów Prawnych) treści następujących dokumentów:

*   **Prawo Cywilne i Procedura:**
    *   Ustawa z dnia 23 kwietnia 1964 r. - Kodeks cywilny (Dz.U. 1964 nr 16 poz. 93).
    *   Ustawa z dnia 17 listopada 1964 r. - Kodeks postępowania cywilnego (KPC).
*   **Prawa Konsumenta:**
    *   Ustawa z dnia 30 maja 2014 r. o prawach konsumenta.
    *   Rejestr klauzul niedozwolonych (UOKiK) – *krytyczne dla modułu analizy umów.*
*   **Prawo Pracy (Kluczowe dla pracowników):**
    *   Ustawa z dnia 26 czerwca 1974 r. - Kodeks pracy.
*   **Inne istotne ustawy:**
    *   Prawo o ruchu drogowym (dla spraw mandatowych).
    *   Ustawa o ochronie danych osobowych (RODO).
    *   Ustawa o ochronie konkurencji i konsumentów.

**Orzecznictwo i Interpretacje:**
Baza wektorowa powinna być wzbogacona o:
*   Wybrane orzeczenia Sądu Najwyższego (Izba Cywilna i Pracy).
*   Istotne stanowiska Rzecznika Praw Obywatelskich oraz Rzecznika Finansowego.
*   Decyzje Prezesa UOKiK w sprawach konsumenckich.

#### 2. Metodologia odpowiedzi asystenta AI (System Prompting)

Aby AI działało jak prawnik, a nie jak wyszukiwarka, "System Prompt" musi wymuszać specyficzną strukturę odpowiedzi. Rekomendowany schemat działania silnika:

1.  **Analiza stanu faktycznego:** AI najpierw musi potwierdzić, czy zrozumiało sytuację użytkownika (np. "Rozumiem, że chcesz zwrócić towar kupiony przez internet, który okazał się wadliwy").
2.  **Identyfikacja problemu prawnego:** Przypisanie problemu do gałęzi prawa (np. Prawo konsumenckie -> Rękojmia).
3.  **Retrieval (Wyszukiwanie):** Pobranie odpowiednich artykułów z bazy wektorowej (np. art. 556 KC).
4.  **Generowanie odpowiedzi (Model IRAC):**
    *   **I (Issue):** Zdefiniowanie problemu.
    *   **R (Rule):** Przytoczenie przepisu prawa (prostym językiem) z podaniem numeru artykułu.
    *   **A (Analysis):** Zastosowanie przepisu do sytuacji użytkownika.
    *   **C (Conclusion):** Konkretna rekomendacja działania.
5.  **Disclaimer (Zastrzeżenie):** Każda odpowiedź musi kończyć się formułą o wyłączeniu odpowiedzialności ("Informacja nie stanowi porady prawnej w rozumieniu ustawy o radcach prawnych...").

#### 3. Specyfikacja dla modułu analizy umów PDF

Ten moduł wymaga zastosowania zaawansowanego przetwarzania NLP (Natural Language Processing).

*   **Technologia:** OCR (dla skanów) + LLM z dużym oknem kontekstowym (np. Gemini 1.5 Pro lub GPT-4o).
*   **Logika działania:**
    *   Ekstrakcja tekstu z dokumentu.
    *   Porównanie zapisów z bazą klauzul abuzywnych UOKiK (Vector Search).
    *   Weryfikacja kompletności umowy (czy zawiera niezbędne elementy, np. datę, strony, przedmiot umowy).
*   **Output dla użytkownika:**
    *   *Sygnalizacja świetlna:* Zielone (bezpieczne), Żółte (do weryfikacji), Czerwone (krytyczne ryzyko).
    *   *Tłumaczenie "z polskiego na nasze":* Wyjaśnienie skomplikowanych paragrafów prostym językiem.

#### 4. Specyfikacja Generatora Pism

*   **Szablony:** Backend musi posiadać bibliotekę sparametryzowanych szablonów (format JSON/XML), które są wypełniane danymi z wywiadu z użytkownikiem.
*   **Wymagane szablony startowe:**
    *   Oświadczenie o odstąpieniu od umowy zawartej na odległość.
    *   Reklamacja z tytułu rękojmi.
    *   Wezwanie do zapłaty.
    *   Wniosek o udzielenie informacji publicznej.
    *   Odwołanie od decyzji ubezpieczyciela.
*   **Flow:** AI Chatbot przeprowadza wywiad (zbiera zmienne: data, kwota, nazwa firmy), a następnie wstrzykuje je do szablonu prawnego, generując plik końcowy.

#### 5. Stack technologiczny (Rekomendacja)

*   **Vector Database:** Pinecone lub Weaviate (do szybkiego przeszukiwania kodeksów).
*   **LLM:** Modele o wysokiej zdolności rozumowania logicznego (Reasoning).
*   **Backend:** Python (FastAPI/Django) ze względu na biblioteki do obsługi AI (LangChain/LlamaIndex).
*   **Frontend:** React/Next.js (integracja z obecnym stosem technologicznym platformy benefitowej).

Taka architektura zapewnia, że **AI Legal Assistant** nie będzie "zgadywać", lecz opierać się na twardych danych prawnych, co jest kluczowe dla budowania zaufania użytkowników platformy benefitowej.
