/**
 * E5 T17 — dwa nowe szablony dokumentów generatora (Agencja Pracy), każdy w 4
 * wersjach dwujęzycznych (PL/ES, PL/RU, PL/HI, PL/EN) — łącznie 8 wierszy w
 * `hr_doc_templates`, kategoria 'umowy' (auto-dobór wg języka pracownika, jak
 * pozostałe umowy dwujęzyczne):
 *   1. Porozumienie o bezpłatnym szkoleniu wdrożeniowym
 *   2. Oświadczenie — kontakt przez pełnomocnika
 *
 * Układ i treść merytoryczna przeniesione z BBS-Unified
 * (scripts/seed-porozumienie-szkoleniowe.mjs, seed-oswiadczenie-pelnomocnik.mjs),
 * ale ŚWIADOMIE bez trzech kategorii danych obcych wobec EBS (decyzja D2/K1
 * ze specyfikacji E5):
 *  - dane spółki ALCES (nazwa/adres/NIP) → pola {{firma_nazwa}}/{{firma_adres}}/{{firma_nip}}
 *  - faksymile podpisu prezesa ALCES → NIE przenoszone (plik i tak jest poza
 *    repo BBS; wstawienie cudzego podpisu na dokumencie innego podmiotu byłoby
 *    podrobieniem dokumentu)
 *  - dane osobowe stałego pełnomocnika (imię, nazwisko, telefon) → pole {{pelnomocnik_dane}}
 * Użytkownik uzupełnia te pola ręcznie w panelu „Szablony dokumentów" (edytor
 * hr_doc_templates), tak jak resztę treści szablonu.
 *
 * Upsert po `name` — tabela `hr_doc_templates` NIE ma unikalnego constraintu na
 * tej kolumnie, więc rerun jest bezpieczny przez ręczny select + insert/update
 * (ten sam wzorzec co scripts/import-bbs-doc-templates.mts). Nic innego nie kasuje.
 *
 * Uruchom:  npx tsx --env-file=.env.local scripts/seed-e5-doc-templates.mts
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Brak kredencjałów EBS (.env.local — uruchom z --env-file=.env.local)');
  process.exit(1);
}

// ══════════════════════════════════════════════════════════════════════════
// 1) Porozumienie o bezpłatnym szkoleniu wdrożeniowym
// ══════════════════════════════════════════════════════════════════════════

const FIRMA = '<strong>{{firma_nazwa}}</strong><br/>{{firma_adres}}<br/>NIP: {{firma_nip}}';

const PL1 = {
  title: 'POROZUMIENIE O BEZPŁATNYM SZKOLENIU WDROŻENIOWYM',
  intro: 'zawarte dnia {{dzis}} pomiędzy:',
  company: `${FIRMA}<br/>zwaną dalej „Firmą"`,
  a: 'a',
  participant: '<strong>Panem/Panią:</strong> {{imie_nazwisko}}<br/>obywatelstwo: {{kraj_pochodzenia}}<br/>paszport nr: {{nr_paszportu}}<br/>adres zamieszkania: {{adres_zamieszkania}}<br/>zwanym dalej „Uczestnikiem".',
  s1h: '§1 Przedmiot porozumienia',
  s1: '<ol><li>Firma umożliwia Uczestnikowi udział w bezpłatnym szkoleniu wdrożeniowym mającym charakter wyłącznie edukacyjny i obserwacyjny.</li><li>Celem szkolenia jest:<ul><li>zapoznanie Uczestnika z organizacją pracy,</li><li>procedurami bezpieczeństwa,</li><li>standardami obsługi,</li><li>sposobem funkcjonowania przedsiębiorstwa.</li></ul></li><li>Szkolenie nie stanowi zatrudnienia, pracy zarobkowej ani świadczenia usług na rzecz Firmy.</li></ol>',
  s2h: '§2 Charakter szkolenia',
  s2: '<ol><li>Uczestnik:<ul><li>nie wykonuje pracy operacyjnej,</li><li>nie obsługuje klientów samodzielnie,</li><li>nie wykonuje czynności przynoszących Firmie bezpośrednią korzyść ekonomiczną,</li><li>uczestniczy wyłącznie w obserwacji i czynnościach szkoleniowych pod nadzorem.</li></ul></li><li>Uczestnik nie jest zobowiązany do wykonywania poleceń służbowych charakterystycznych dla stosunku pracy.</li><li>Firma może w każdej chwili zakończyć szkolenie bez podania przyczyny.</li></ol>',
  s3h: '§3 Brak wynagrodzenia',
  s3: '<ol><li>Strony zgodnie potwierdzają, że szkolenie ma charakter całkowicie nieodpłatny.</li><li>Uczestnikowi nie przysługuje:<ul><li>wynagrodzenie,</li><li>dieta,</li><li>premia,</li><li>zwrot kosztów,</li><li>jakiekolwiek świadczenia pracownicze.</li></ul></li></ol>',
  s4h: '§4 Okres szkolenia',
  s4: '<ol><li>Szkolenie odbywa się w okresie od {{dzis}} do {{dzis_plus_miesiac}}.</li><li>Łączny wymiar szkolenia nie przekroczy 60 godzin.</li></ol>',
  s5h: '§5 Miejsce szkolenia',
  s5: '<ol><li>{{miejsce_szkolenia}}</li></ol>',
  s6h: '§6 Oświadczenia uczestnika',
  s6: '<ol><li>Uczestnik oświadcza, że:<ul><li>przebywa legalnie na terytorium Polski,</li><li>posiada ważny paszport,</li><li>posiada dokument potwierdzający legalność pobytu,</li><li>został poinformowany, że niniejsze porozumienie nie stanowi umowy o pracę ani umowy zlecenia.</li></ul></li><li>Uczestnik zobowiązuje się do niezwłocznego poinformowania Firmy o zmianie statusu pobytowego.</li></ol>',
  s7h: '§7 Postanowienia końcowe',
  s7: '<ol><li>Porozumienie ma charakter cywilnoprawny i szkoleniowy.</li><li>W sprawach nieuregulowanych zastosowanie mają przepisy Kodeksu cywilnego.</li><li>Porozumienie sporządzono w dwóch jednobrzmiących egzemplarzach.</li></ol>',
  sig: 'Firma: ________________________<br/><br/>Uczestnik: ________________________',
};

const ES1 = {
  title: 'ACUERDO DE FORMACIÓN DE INDUCCIÓN GRATUITA',
  intro: 'celebrado el {{dzis}} entre:',
  company: `${FIRMA}<br/>en adelante la „Empresa"`,
  a: 'y',
  participant: '<strong>Don/Doña:</strong> {{imie_nazwisko}}<br/>nacionalidad: {{kraj_pochodzenia}}<br/>pasaporte n.º: {{nr_paszportu}}<br/>domicilio: {{adres_zamieszkania}}<br/>en adelante el „Participante".',
  s1h: '§1 Objeto del acuerdo',
  s1: '<ol><li>La Empresa permite al Participante tomar parte en una formación de inducción gratuita de carácter exclusivamente educativo y de observación.</li><li>El objetivo de la formación es:<ul><li>familiarizar al Participante con la organización del trabajo,</li><li>los procedimientos de seguridad,</li><li>los estándares de servicio,</li><li>el modo de funcionamiento de la empresa.</li></ul></li><li>La formación no constituye empleo, trabajo remunerado ni prestación de servicios a favor de la Empresa.</li></ol>',
  s2h: '§2 Carácter de la formación',
  s2: '<ol><li>El Participante:<ul><li>no realiza trabajo operativo,</li><li>no atiende clientes de forma independiente,</li><li>no realiza actividades que aporten a la Empresa un beneficio económico directo,</li><li>participa únicamente en la observación y en actividades formativas bajo supervisión.</li></ul></li><li>El Participante no está obligado a cumplir órdenes de servicio propias de una relación laboral.</li><li>La Empresa puede finalizar la formación en cualquier momento sin indicar el motivo.</li></ol>',
  s3h: '§3 Ausencia de remuneración',
  s3: '<ol><li>Las Partes confirman de común acuerdo que la formación tiene carácter totalmente gratuito.</li><li>Al Participante no le corresponde:<ul><li>remuneración,</li><li>dieta,</li><li>prima,</li><li>reembolso de gastos,</li><li>ninguna prestación laboral.</li></ul></li></ol>',
  s4h: '§4 Período de la formación',
  s4: '<ol><li>La formación tiene lugar en el período del {{dzis}} al {{dzis_plus_miesiac}}.</li><li>La duración total de la formación no superará las 60 horas.</li></ol>',
  s5h: '§5 Lugar de la formación',
  s5: '<ol><li>{{miejsce_szkolenia}}</li></ol>',
  s6h: '§6 Declaraciones del participante',
  s6: '<ol><li>El Participante declara que:<ul><li>permanece legalmente en el territorio de Polonia,</li><li>posee un pasaporte válido,</li><li>posee un documento que confirma la legalidad de su estancia,</li><li>ha sido informado de que el presente acuerdo no constituye un contrato de trabajo ni un contrato de mandato.</li></ul></li><li>El Participante se compromete a informar inmediatamente a la Empresa de cualquier cambio en su estatus de residencia.</li></ol>',
  s7h: '§7 Disposiciones finales',
  s7: '<ol><li>El acuerdo tiene carácter civil y formativo.</li><li>En lo no regulado se aplican las disposiciones del Código Civil.</li><li>El acuerdo se ha redactado en dos ejemplares idénticos.</li></ol>',
  sig: 'Empresa: ________________________<br/><br/>Participante: ________________________',
};

const RU1 = {
  title: 'СОГЛАШЕНИЕ О БЕСПЛАТНОМ ВВОДНОМ ОБУЧЕНИИ',
  intro: 'заключено {{dzis}} между:',
  company: `${FIRMA}<br/>далее — «Фирма»`,
  a: 'и',
  participant: '<strong>Господином/Госпожой:</strong> {{imie_nazwisko}}<br/>гражданство: {{kraj_pochodzenia}}<br/>паспорт №: {{nr_paszportu}}<br/>адрес проживания: {{adres_zamieszkania}}<br/>далее — «Участник».',
  s1h: '§1 Предмет соглашения',
  s1: '<ol><li>Фирма предоставляет Участнику возможность участия в бесплатном вводном обучении, имеющем исключительно образовательный и ознакомительный характер.</li><li>Целью обучения является:<ul><li>ознакомление Участника с организацией труда,</li><li>процедурами безопасности,</li><li>стандартами обслуживания,</li><li>принципами работы предприятия.</li></ul></li><li>Обучение не является трудоустройством, оплачиваемой работой или оказанием услуг в пользу Фирмы.</li></ol>',
  s2h: '§2 Характер обучения',
  s2: '<ol><li>Участник:<ul><li>не выполняет операционную работу,</li><li>не обслуживает клиентов самостоятельно,</li><li>не выполняет действий, приносящих Фирме прямую экономическую выгоду,</li><li>участвует исключительно в наблюдении и учебных мероприятиях под надзором.</li></ul></li><li>Участник не обязан выполнять служебные распоряжения, характерные для трудовых отношений.</li><li>Фирма может в любой момент прекратить обучение без указания причины.</li></ol>',
  s3h: '§3 Отсутствие вознаграждения',
  s3: '<ol><li>Стороны согласно подтверждают, что обучение имеет полностью безвозмездный характер.</li><li>Участнику не полагается:<ul><li>вознаграждение,</li><li>суточные,</li><li>премия,</li><li>возмещение расходов,</li><li>какие-либо трудовые выплаты.</li></ul></li></ol>',
  s4h: '§4 Период обучения',
  s4: '<ol><li>Обучение проходит в период с {{dzis}} по {{dzis_plus_miesiac}}.</li><li>Общая продолжительность обучения не превысит 60 часов.</li></ol>',
  s5h: '§5 Место обучения',
  s5: '<ol><li>{{miejsce_szkolenia}}</li></ol>',
  s6h: '§6 Заявления участника',
  s6: '<ol><li>Участник заявляет, что:<ul><li>легально находится на территории Польши,</li><li>имеет действительный паспорт,</li><li>имеет документ, подтверждающий легальность пребывания,</li><li>проинформирован, что настоящее соглашение не является трудовым договором или договором поручения.</li></ul></li><li>Участник обязуется незамедлительно информировать Фирму об изменении статуса пребывания.</li></ol>',
  s7h: '§7 Заключительные положения',
  s7: '<ol><li>Соглашение имеет гражданско-правовой и учебный характер.</li><li>В неурегулированных вопросах применяются положения Гражданского кодекса.</li><li>Соглашение составлено в двух идентичных экземплярах.</li></ol>',
  sig: 'Фирма: ________________________<br/><br/>Участник: ________________________',
};

const HI1 = {
  title: 'निःशुल्क प्रारंभिक प्रशिक्षण समझौता',
  intro: '{{dzis}} को निम्नलिखित के बीच संपन्न:',
  company: `${FIRMA}<br/>आगे «कंपनी» कहलाएगी`,
  a: 'और',
  participant: '<strong>श्री/श्रीमती:</strong> {{imie_nazwisko}}<br/>नागरिकता: {{kraj_pochodzenia}}<br/>पासपोर्ट सं.: {{nr_paszportu}}<br/>निवास का पता: {{adres_zamieszkania}}<br/>आगे «प्रतिभागी» कहलाएगा/कहलाएगी।',
  s1h: '§1 समझौते का विषय',
  s1: '<ol><li>कंपनी प्रतिभागी को निःशुल्क प्रारंभिक प्रशिक्षण में भाग लेने का अवसर देती है, जिसका स्वरूप केवल शैक्षिक और अवलोकनात्मक है।</li><li>प्रशिक्षण का उद्देश्य है:<ul><li>प्रतिभागी को कार्य-संगठन से परिचित कराना,</li><li>सुरक्षा प्रक्रियाओं से,</li><li>सेवा मानकों से,</li><li>उद्यम के कार्य करने के तरीके से।</li></ul></li><li>प्रशिक्षण रोजगार, वेतनभोगी कार्य या कंपनी के लिए सेवाएँ देना नहीं है।</li></ol>',
  s2h: '§2 प्रशिक्षण का स्वरूप',
  s2: '<ol><li>प्रतिभागी:<ul><li>परिचालन कार्य नहीं करता,</li><li>स्वतंत्र रूप से ग्राहकों की सेवा नहीं करता,</li><li>ऐसे कार्य नहीं करता जिनसे कंपनी को प्रत्यक्ष आर्थिक लाभ हो,</li><li>केवल निगरानी में अवलोकन और प्रशिक्षण गतिविधियों में भाग लेता है।</li></ul></li><li>प्रतिभागी रोजगार-संबंध जैसे सेवा आदेशों का पालन करने के लिए बाध्य नहीं है।</li><li>कंपनी किसी भी समय बिना कारण बताए प्रशिक्षण समाप्त कर सकती है।</li></ol>',
  s3h: '§3 पारिश्रमिक का अभाव',
  s3: '<ol><li>पक्ष सहमति से पुष्टि करते हैं कि प्रशिक्षण पूर्णतः निःशुल्क है।</li><li>प्रतिभागी को नहीं मिलेगा:<ul><li>पारिश्रमिक,</li><li>भत्ता,</li><li>बोनस,</li><li>खर्चों की वापसी,</li><li>कोई भी कर्मचारी-लाभ।</li></ul></li></ol>',
  s4h: '§4 प्रशिक्षण अवधि',
  s4: '<ol><li>प्रशिक्षण {{dzis}} से {{dzis_plus_miesiac}} की अवधि में होगा।</li><li>प्रशिक्षण की कुल अवधि 60 घंटे से अधिक नहीं होगी।</li></ol>',
  s5h: '§5 प्रशिक्षण का स्थान',
  s5: '<ol><li>{{miejsce_szkolenia}}</li></ol>',
  s6h: '§6 प्रतिभागी की घोषणाएँ',
  s6: '<ol><li>प्रतिभागी घोषणा करता है कि:<ul><li>वह पोलैंड में वैध रूप से रह रहा है,</li><li>उसके पास वैध पासपोर्ट है,</li><li>उसके पास वैध निवास की पुष्टि करने वाला दस्तावेज़ है,</li><li>उसे सूचित किया गया है कि यह समझौता रोजगार अनुबंध या मैंडेट अनुबंध नहीं है।</li></ul></li><li>प्रतिभागी निवास-स्थिति में परिवर्तन की सूचना तुरंत कंपनी को देने का वचन देता है।</li></ol>',
  s7h: '§7 अंतिम प्रावधान',
  s7: '<ol><li>समझौते का स्वरूप नागरिक-कानूनी और प्रशिक्षण-संबंधी है।</li><li>अनियमित मामलों में नागरिक संहिता के प्रावधान लागू होंगे।</li><li>समझौता दो समान प्रतियों में तैयार किया गया है।</li></ol>',
  sig: 'कंपनी: ________________________<br/><br/>प्रतिभागी: ________________________',
};

const EN1 = {
  title: 'AGREEMENT ON FREE ONBOARDING TRAINING',
  intro: 'concluded on {{dzis}} between:',
  company: `${FIRMA}<br/>hereinafter the "Company"`,
  a: 'and',
  participant: '<strong>Mr/Ms:</strong> {{imie_nazwisko}}<br/>citizenship: {{kraj_pochodzenia}}<br/>passport no.: {{nr_paszportu}}<br/>address of residence: {{adres_zamieszkania}}<br/>hereinafter the "Participant".',
  s1h: '§1 Subject of the agreement',
  s1: '<ol><li>The Company enables the Participant to take part in free onboarding training of an exclusively educational and observational nature.</li><li>The purpose of the training is:<ul><li>to familiarise the Participant with the organisation of work,</li><li>safety procedures,</li><li>service standards,</li><li>the way the enterprise operates.</li></ul></li><li>The training does not constitute employment, paid work or the provision of services for the Company.</li></ol>',
  s2h: '§2 Nature of the training',
  s2: '<ol><li>The Participant:<ul><li>does not perform operational work,</li><li>does not serve customers independently,</li><li>does not perform activities bringing the Company a direct economic benefit,</li><li>takes part only in observation and training activities under supervision.</li></ul></li><li>The Participant is not obliged to follow official instructions characteristic of an employment relationship.</li><li>The Company may end the training at any time without giving a reason.</li></ol>',
  s3h: '§3 No remuneration',
  s3: '<ol><li>The Parties jointly confirm that the training is entirely free of charge.</li><li>The Participant is not entitled to:<ul><li>remuneration,</li><li>per diem,</li><li>bonus,</li><li>reimbursement of costs,</li><li>any employee benefits.</li></ul></li></ol>',
  s4h: '§4 Training period',
  s4: '<ol><li>The training takes place in the period from {{dzis}} to {{dzis_plus_miesiac}}.</li><li>The total duration of the training will not exceed 60 hours.</li></ol>',
  s5h: '§5 Place of training',
  s5: '<ol><li>{{miejsce_szkolenia}}</li></ol>',
  s6h: '§6 Participant declarations',
  s6: '<ol><li>The Participant declares that they:<ul><li>are staying legally on the territory of Poland,</li><li>hold a valid passport,</li><li>hold a document confirming the legality of their stay,</li><li>have been informed that this agreement does not constitute an employment contract or a mandate contract.</li></ul></li><li>The Participant undertakes to inform the Company immediately of any change in their residence status.</li></ol>',
  s7h: '§7 Final provisions',
  s7: '<ol><li>The agreement is of a civil-law and training nature.</li><li>In matters not regulated herein, the provisions of the Civil Code apply.</li><li>The agreement has been drawn up in two identical copies.</li></ol>',
  sig: 'Company: ________________________<br/><br/>Participant: ________________________',
};

function buildHtml1(R: typeof PL1): string {
  const row = (l: string, r: string) => `<tr><td>${l}</td><td>${r}</td></tr>`;
  const rows = [
    row(`<p style="text-align:center"><strong>${PL1.title}</strong></p>`, `<p style="text-align:center"><strong>${R.title}</strong></p>`),
    row(`<p>${PL1.intro}</p>`, `<p>${R.intro}</p>`),
    row(`<p>${PL1.company}</p>`, `<p>${R.company}</p>`),
    row(`<p>${PL1.a}</p>`, `<p>${R.a}</p>`),
    row(`<p>${PL1.participant}</p>`, `<p>${R.participant}</p>`),
    ...['1', '2', '3', '4', '5', '6', '7'].map(n =>
      row(`<p><strong>${(PL1 as any)['s' + n + 'h']}</strong></p>${(PL1 as any)['s' + n]}`, `<p><strong>${(R as any)['s' + n + 'h']}</strong></p>${(R as any)['s' + n]}`)),
    row(`<p style="margin-top:36px">${PL1.sig}</p>`, `<p style="margin-top:36px">${R.sig}</p>`),
  ].join('');
  return `<table style="table-layout:fixed"><colgroup><col style="width:50%"><col style="width:50%"></colgroup>${rows}</table>`;
}

// ══════════════════════════════════════════════════════════════════════════
// 2) Oświadczenie — kontakt przez pełnomocnika
// ══════════════════════════════════════════════════════════════════════════

const DOTS = '……………………………………………………';

const PL2 = {
  title: 'OŚWIADCZENIE',
  p1: 'Ja, niżej podpisany/a <strong>{{imie_nazwisko}}</strong>, oświadczam, że nie znam języka polskiego ani przepisów prawa obowiązujących w Rzeczypospolitej Polskiej w zakresie dotyczącym mojego pobytu i wykonywanych czynności na rzecz firmy.',
  p2: 'W związku z powyższym, w przypadku kontroli lub jakichkolwiek pytań dotyczących legalności mojego pobytu, zatrudnienia lub wykonywanych czynności na rzecz firmy, uprzejmie proszę o kontakt z moim pełnomocnikiem, który jest upoważniony do udzielania wszelkich wyjaśnień i reprezentowania mnie w tych sprawach.',
  agent: 'Dane pełnomocnika:',
  thanks: 'Dziękuję za zrozumienie.',
  date: 'Data',
  sign: 'Podpis pracownika',
};

const ES2 = {
  title: 'DECLARACIÓN',
  p1: 'Yo, el/la abajo firmante <strong>{{imie_nazwisko}}</strong>, declaro que no conozco el idioma polaco ni las disposiciones legales vigentes en la República de Polonia en lo relativo a mi estancia y a las actividades que realizo para la empresa.',
  p2: 'Por lo anterior, en caso de control o de cualquier pregunta relativa a la legalidad de mi estancia, empleo o actividades realizadas para la empresa, ruego amablemente ponerse en contacto con mi apoderado, quien está autorizado a dar todas las explicaciones y a representarme en estos asuntos.',
  agent: 'Datos del apoderado:',
  thanks: 'Gracias por su comprensión.',
  date: 'Fecha',
  sign: 'Firma del trabajador',
};

const RU2 = {
  title: 'ЗАЯВЛЕНИЕ',
  p1: 'Я, нижеподписавшийся/аяся <strong>{{imie_nazwisko}}</strong>, заявляю, что не знаю польского языка и положений права, действующих в Республике Польша, в части, касающейся моего пребывания и действий, выполняемых мною в пользу фирмы.',
  p2: 'В связи с вышеизложенным, в случае проверки или любых вопросов, касающихся законности моего пребывания, трудоустройства или выполняемых мною действий в пользу фирмы, убедительно прошу обращаться к моему уполномоченному представителю, который вправе давать все разъяснения и представлять меня в этих делах.',
  agent: 'Данные представителя:',
  thanks: 'Благодарю за понимание.',
  date: 'Дата',
  sign: 'Подпись работника',
};

const HI2 = {
  title: 'घोषणा-पत्र',
  p1: 'मैं, नीचे हस्ताक्षर करने वाला/वाली <strong>{{imie_nazwisko}}</strong>, घोषणा करता/करती हूँ कि मुझे पोलिश भाषा तथा पोलैंड गणराज्य में लागू उन कानूनी प्रावधानों की जानकारी नहीं है, जो मेरे प्रवास और कंपनी के लिए किए जाने वाले कार्यों से संबंधित हैं।',
  p2: 'उपरोक्त के संबंध में, मेरे प्रवास, रोजगार या कंपनी के लिए किए जाने वाले कार्यों की वैधता से जुड़ी किसी भी जाँच या प्रश्न की स्थिति में, कृपया मेरे अधिकृत प्रतिनिधि से संपर्क करें, जो सभी स्पष्टीकरण देने और इन मामलों में मेरा प्रतिनिधित्व करने के लिए अधिकृत है।',
  agent: 'प्रतिनिधि का विवरण:',
  thanks: 'समझने के लिए धन्यवाद।',
  date: 'तिथि',
  sign: 'कर्मचारी के हस्ताक्षर',
};

const EN2 = {
  title: 'DECLARATION',
  p1: 'I, the undersigned <strong>{{imie_nazwisko}}</strong>, declare that I do not know the Polish language or the legal provisions in force in the Republic of Poland concerning my stay and the activities I perform for the company.',
  p2: 'In view of the above, in the event of an inspection or any questions concerning the legality of my stay, employment or activities performed for the company, I kindly ask you to contact my attorney-in-fact, who is authorised to provide all explanations and to represent me in these matters.',
  agent: 'Attorney-in-fact details:',
  thanks: 'Thank you for your understanding.',
  date: 'Date',
  sign: 'Employee signature',
};

function col2(T: typeof PL2): string {
  return `<p style="text-align:center"><strong>${T.title}</strong></p>
<p>${T.p1}</p>
<p>${T.p2}</p>
<p><strong>${T.agent}</strong></p>
<p>{{pelnomocnik_dane}}</p>
<p>${T.thanks}</p>
<br/>
<p>${T.date}: {{dzis}}</p>
<p>${T.sign}: ${DOTS}</p>`;
}

function buildHtml2(R: typeof PL2): string {
  return `<table style="table-layout:fixed"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tr><td>${col2(PL2)}</td><td>${col2(R)}</td></tr></table>`;
}

// ══════════════════════════════════════════════════════════════════════════
// Seed
// ══════════════════════════════════════════════════════════════════════════

const VARIANTS: { name: string; content_html: string; sort: number }[] = [
  { name: 'Porozumienie o szkoleniu wdrożeniowym (PL / hiszpański)', content_html: buildHtml1(ES1), sort: 60 },
  { name: 'Porozumienie o szkoleniu wdrożeniowym (PL / rosyjski)', content_html: buildHtml1(RU1), sort: 61 },
  { name: 'Porozumienie o szkoleniu wdrożeniowym (PL / hindi)', content_html: buildHtml1(HI1), sort: 62 },
  { name: 'Porozumienie o szkoleniu wdrożeniowym (PL / angielski)', content_html: buildHtml1(EN1), sort: 63 },
  { name: 'Oświadczenie — kontakt przez pełnomocnika (PL / hiszpański)', content_html: buildHtml2(ES2), sort: 70 },
  { name: 'Oświadczenie — kontakt przez pełnomocnika (PL / rosyjski)', content_html: buildHtml2(RU2), sort: 71 },
  { name: 'Oświadczenie — kontakt przez pełnomocnika (PL / hindi)', content_html: buildHtml2(HI2), sort: 72 },
  { name: 'Oświadczenie — kontakt przez pełnomocnika (PL / angielski)', content_html: buildHtml2(EN2), sort: 73 },
];

// Brak unikalnego constraintu na `name` w hr_doc_templates -> ręczny insert-lub-update
// po nazwie (ten sam wzorzec co scripts/import-bbs-doc-templates.mts), żeby rerun
// był bezpieczny i nie duplikował wierszy.
const { data: existing, error: existErr } = await sb.from('hr_doc_templates').select('id, name');
if (existErr) { console.error('hr_doc_templates (odczyt):', existErr.message); process.exit(1); }
const existingByName = new Map((existing ?? []).map((r: any) => [r.name, r.id]));

let inserted = 0, updated = 0, failed = 0;
for (const v of VARIANTS) {
  const row = { name: v.name, content_html: v.content_html, has_letterhead: false, sort: v.sort, category: 'umowy', kind: 'html' };
  const existingId = existingByName.get(v.name);
  if (existingId) {
    const { error } = await sb.from('hr_doc_templates').update(row).eq('id', existingId);
    if (error) { failed++; console.error(`✗ ${v.name}: ${error.message}`); }
    else { updated++; console.log(`↻ zaktualizowano: ${v.name}`); }
  } else {
    const { error } = await sb.from('hr_doc_templates').insert(row);
    if (error) { failed++; console.error(`✗ ${v.name}: ${error.message}`); }
    else { inserted++; console.log(`✓ dodano: ${v.name}`); }
  }
}

console.log(`\nGotowe. Nowe: ${inserted}, zaktualizowane: ${updated}, błędy: ${failed} (z ${VARIANTS.length}).`);
