# SpeakStream — SPEC.md

> Trenażer płynności czytania po angielsku w stylu **teleprompter**. Tekst branżowy generowany proceduralnie na urządzeniu przewija się z góry na dół, dając presję czasową na przeczytanie zdania. Regulowana prędkość, poziomy CEFR, 100% offline i za darmo.
>
> **Nazwa robocza:** `SpeakStream` (zmień, jeśli chcesz).
> **Ten plik jest jedynym źródłem prawdy dla Claude Code.**

---

## 1. Koncepcja i UX

- Użytkownik wybiera **branżę** (na start: kontroler ruchu lotniczego), **poziom CEFR** (B1–C2) i **prędkość**, po czym startuje.
- Tekst po angielsku **przewija się pionowo, płynnie, ze stałą prędkością**. Użytkownik musi nadążyć z czytaniem — w tym leży presja treningowa.
- Tryb **tylko-czytanie**: użytkownik czyta na głos sam z siebie; aplikacja **nie** nagrywa ani nie rozpoznaje mowy (opcja mikrofonu poza zakresem — patrz §12).
- **Prędkość regulowana suwakiem na żywo** (w trakcie przewijania) + **auto-sugestia** startowej prędkości liczona z długości/złożoności tekstu i poziomu.
- Referencja wizualna: klip „C1 Level English – Speak Fast and Clear" (@watchspeakrepeat) — biały tekst, wyśrodkowany, wygaszany u góry i dołu, na ciemnym tle.

---

## 2. Zakres i fazowanie

Architektura **od początku** wtyczkowa (każda branża = osobny moduł), ale **budujemy tylko FAZĘ 1**.

| Faza | Branża | Status |
|------|--------|--------|
| **1** | **ATC — kontroler ruchu lotniczego** | **budujemy teraz (pełna apka + ten moduł)** |
| 2 | Dziennikarz / prezenter TV | później (dołożenie modułu) |
| 3 | Prawnik | później (dołożenie modułu) |

Dodanie fazy 2/3 ma wymagać **tylko** nowego modułu spełniającego interfejs `Domain` — bez zmian w rdzeniu ani w teleprompterze.

---

## 3. Twarde ograniczenia (nienegocjowalne)

- **100% darmowe** i **w pełni offline**: brak backendu, brak płatnego/„live" API, brak klucza API, brak logowania.
- Tekst **generowany proceduralnie na urządzeniu** (szablony + banki słownictwa + maszyna stanów). **Żadnego LLM w runtime.**
- Musi działać w **Expo Go** (bez własnych modułów natywnych wymagających dev-buildu, jeśli da się uniknąć).
- **TypeScript**, kod czysty i otestowany w części generatora.

---

## 4. Stack technologiczny

Spójny z FEAST Trainer, gdzie to możliwe:

- **Expo (SDK aktualne) + TypeScript**
- **Nawigacja:** React Navigation `native-stack` *(alternatywa: Expo Router — dowolne, oba działają w Expo Go; wybierz jedno i trzymaj się go)*
- **Stan:** `zustand`
- **Trwałość:** `@react-native-async-storage/async-storage` (ustawienia, historia anty-powtórek, opcjonalne statystyki)
- **Animacja przewijania:** `react-native-reanimated` (kluczowe: `useFrameCallback` do stałej prędkości)
- **Wygaszanie krawędzi:** `expo-linear-gradient`
- **Haptyka (opcjonalnie):** `expo-haptics`

> Nie dokładaj Skia — teleprompter to zwykły przewijany tekst, Skia niepotrzebna.

---

## 5. Architektura

```
src/
  app/                      # ekrany + nawigacja
    HomeScreen.tsx
    ReaderScreen.tsx
    SettingsScreen.tsx
  teleprompter/
    Teleprompter.tsx        # komponent przewijania (reanimated useFrameCallback)
    useAutoSpeed.ts         # sugestia prędkości z długości/poziomu
  domains/
    types.ts                # interfejsy Domain / Session / Transmission / Level
    registry.ts             # rejestr dostępnych domen
    atc/
      index.ts              # implementacja Domain dla ATC
      pools.ts              # banki: linie lotnicze, pasy, drogi, kursy, wiatr...
      templates.ts          # szablony frazeologii ze slotami
      phases.ts             # maszyna stanów faz lotu
      session.ts            # generator sesji + anty-powtórki + pokrycie
      levels.ts             # konfiguracje B1–C2
      __tests__/
        session.test.ts
  store/
    settingsStore.ts        # zustand + persist
    historyStore.ts         # rolling history sygnatur (anty-powtórki)
  theme/
    tokens.ts               # kolory, typografia, odstępy
```

### Interfejs domeny (kontrakt na przyszłe branże)

```ts
// domains/types.ts
export type LevelId = 'B1' | 'B2' | 'C1' | 'C2';

export interface Level {
  id: LevelId;
  label: string;
  suggestedWpm: number;      // startowa prędkość (px/s liczymy z WPM)
}

export interface Transmission {
  text: string;              // 1+ linijek gotowych do wyświetlenia
  meta?: Record<string, unknown>; // np. kategoria, kod frazeologii (na przyszłość)
}

export interface Session {
  next(): Transmission;      // zwraca kolejny fragment strumienia
}

export interface Domain {
  id: string;                // 'atc' | 'journalist' | 'lawyer'
  name: string;
  levels: Level[];
  createSession(opts: { level: LevelId; seed?: number }): Session;
}
```

Teleprompter woła `session.next()` w miarę potrzeby (tryb nieskończony) — nie zna szczegółów domeny.

---

## 6. Silnik generacji ATC (rdzeń — opisany dokładnie, NIE zgadywać)

Realne komunikaty ATC to **ustrukturyzowana frazeologia** (standard ICAO): skończona gramatyka ze slotami. Generujemy ciągły strumień transmisji kontrolera, brzmiący jak praca na żywym ruchu.

### 6.1 Banki zmiennych (`pools.ts`)

- **Linie/znaki wywoławcze:** Delta, American, United, Southwest, Speedbird (British Airways), Lufthansa, KLM, Air France, Emirates, Qatari, Cactus, itp. + losowy numer lotu. Plus GA: „November Four Five Alpha" (rejestracje literowo-cyfrowe).
- **Pasy (RWY):** 04L/22R, 09/27, 18/36, z L/C/R.
- **Drogi kołowania (TWY):** Alpha, Bravo, … Kilo.
- **Punkty oczekiwania (POINT):** litery alfabetu fonetycznego.
- **Kursy (HDG):** 010–360.
- **Wysokości / poziomy (ALT/FL):** np. 3000 ft, FL180, FL350.
- **Prędkości (SPD):** węzły.
- **Wiatr (WIND):** kierunek/prędkość, porywy (np. „240 at 8", „270 at 15 gusting 25").
- **Częstotliwości (FREQ):** 118.10–136.975.
- **Kod transpondera (SQUAWK):** 4 cyfry ósemkowe.
- **QNH:** hPa/inHg.
- **Typy statków (TYPE):** heavy, regional jet, Cessna, itp. (do sekwencjonowania/ruchu).

### 6.2 Szablony frazeologii (`templates.ts`)

Każdy szablon = tekst ze slotami `{CALLSIGN}`, `{RWY}`, `{TWY}`, `{POINT}`, `{HDG}`, `{ALT}`/`{FL}`, `{SPD}`, `{WIND}`, `{FREQ}`, `{FACILITY}`, `{SQUAWK}`, `{QNH}`, `{N}`, `{TYPE}`. Przykłady (angielski, standardowa frazeologia):

- Landing: `{CALLSIGN}, runway {RWY}, cleared to land, wind {WIND}.`
- Takeoff: `{CALLSIGN}, runway {RWY}, cleared for takeoff, wind {WIND}.`
- Line up and wait: `{CALLSIGN}, runway {RWY}, line up and wait.`
- Hold short: `{CALLSIGN}, hold short of runway {RWY}.`
- Taxi: `{CALLSIGN}, taxi to holding point {POINT} via {TWY}, hold short of runway {RWY}.`
- Pushback: `{CALLSIGN}, pushback approved.`
- Climb: `{CALLSIGN}, climb and maintain flight level {FL}.`
- Descend: `{CALLSIGN}, descend and maintain {ALT} feet.`
- Vector: `{CALLSIGN}, turn left heading {HDG}.` / `... turn right heading {HDG}.`
- Speed: `{CALLSIGN}, reduce speed to {SPD} knots.` / `... increase speed to {SPD} knots.`
- Handoff: `{CALLSIGN}, contact {FACILITY} on {FREQ}, good day.`
- Squawk: `{CALLSIGN}, squawk {SQUAWK}.`
- Altimeter: `{CALLSIGN}, QNH {QNH}.`
- Approach: `{CALLSIGN}, cleared ILS approach runway {RWY}, report established.`
- Traffic: `{CALLSIGN}, traffic is a {TYPE}, report in sight.`
- Sequencing: `{CALLSIGN}, you're number {N}, follow the {TYPE} on final.`
- Wind check: `{CALLSIGN}, wind {WIND}.`
- Go around: `{CALLSIGN}, go around, I say again, go around.`
- Non-normal (C1+): `{CALLSIGN}, roger your PAN, cleared to land runway {RWY}, emergency services standing by.`

Każdy szablon oznacz **kategorią** (`ground` | `tower` | `approach` | `enroute` | `nonnormal`) i **fazą**, do której pasuje (patrz 6.3), oraz **minimalnym poziomem** (część dostępna dopiero od B2/C1).

### 6.3 Maszyna stanów faz lotu (`phases.ts`) — KLUCZ do spójności

Aby strumień był **logiczny i spójny** (wymóg), każdy statek ma stan i porusza się realnym łukiem:

- **Odlot:** `PARKED → PUSHBACK → TAXI_OUT → HOLD_SHORT → LINEUP → TAKEOFF → DEPARTURE (handoff)`
- **Przylot:** `ENROUTE → DESCENT → APPROACH → FINAL → LAND → TAXI_IN → GATE`

Do stanu przypisany jest zestaw dopuszczalnych szablonów (np. `HOLD_SHORT` → hold short / line up; `FINAL` → landing / sequencing / go around). Dozwolone są „wtręty" (heading/altitude/speed/squawk/traffic/handoff) z pewnym prawdopodobieństwem.

### 6.4 Generator sesji (`session.ts`)

- Utrzymuje **N aktywnych statków** (miks odlotów i przylotów).
- Na każde wywołanie `next()`: wybiera statek, emituje transmisję pasującą do jego stanu (wypełniając sloty z banków), **następnie przesuwa jego stan** (czasem dokłada wtręt). Gdy statek dojdzie do `DEPARTURE`/`GATE`, znika i pojawia się nowy.
- Dzięki temu **ten sam znak wywoławczy** przechodzi realną sekwencję (np. taxi → hold short → line up → cleared for takeoff → contact departure).

### 6.5 Skalowanie poziomem (`levels.ts`)

| Poziom | Instrukcji/transmisję | Zestaw szablonów | Domyślne WPM | Odczyt liczb | Sytuacje non-normal |
|-------|----------------------|------------------|--------------|--------------|---------------------|
| **B1** | 1 | podstawowe (taxi, hold short, land/takeoff, handoff) | wolno | cyfry („240") | nie |
| **B2** | 1–2 | + vector/climb/descend/speed/squawk | średnio | cyfry | nie |
| **C1** | 2–3 (łączone w jednej transmisji) | pełny + sequencing/traffic | szybko | opcja: odczyt lotniczy („two four zero") | tak |
| **C2** | gęsto, wiele + szybkie handoffy | pełny + non-normal | najszybciej | odczyt lotniczy domyślnie | tak |

Łączenie C1/C2, np.: `United 88, turn left heading 310, descend and maintain 4000, contact approach on 119.1.`

### 6.6 Anty-powtórki (wymóg: „żeby się nie powtarzały")

- **Rolling history** (np. ostatnie 50) *sygnatur* transmisji = `templateId + kluczowe wartości slotów`, trzymana w pamięci + AsyncStorage. Kandydat odrzucany, jeśli sygnatura jest w historii.
- Brak **bezpośredniego** powtórzenia tej samej kategorii/tego samego znaku dwa razy z rzędu.
- Znaki wywoławcze **unikalne** wśród aktywnych statków; numery lotów bez niedawnego powtórzenia.
- Banki tasowane (shuffle) zamiast losowania z powtórzeniami.

### 6.7 Pokrycie tematów (wymóg: „obejmowały różne kwestie/pojęcia/wyrażenia")

- Ważona rotacja tak, by w ciągu sesji użytkownik zobaczył `ground`, `tower`, `approach`, `enroute` oraz (od C1) `nonnormal`. Licz kategorie i podbijaj niedoreprezentowane.

### 6.8 Ustawienia domenowe (przełączniki)

- **Odczyt liczb:** `digits` (domyślnie B1–B2) vs `aviation` (spelled, domyślnie C2) — patrz §6.5.
- **Readbacki pilota:** domyślnie **wyłączone** (strumień samego kontrolera, jak w referencji). Włączenie dokłada linie odczytu pilota po transmisji — łatwe rozszerzenie zwiększające pokrycie frazeologii.
- **Facility bias:** domyślnie miks TOWER+GROUND (jak w klipie); opcjonalnie APPROACH/CENTER dla przewagi wektorów/poziomów.

---

## 7. Silnik teleprompter (`teleprompter/`)

Wymóg: **płynne, stałej prędkości** przewijanie pionowe z presją czasową; **prędkość regulowana na żywo**; **tryb nieskończony**.

**Podejście (najprostsze i poprawne):** użyj `useFrameCallback` z reanimated do przesuwania `translateY` treści o `pxPerSec * dt` w każdej klatce. To daje:
- stałą prędkość liniową,
- trywialną **zmianę prędkości na żywo** (zmieniasz `pxPerSec`, ruch od razu inny),
- łatwy **strumień nieskończony**: gdy górny element wyjedzie poza ekran, wołasz `session.next()`, dokładasz na dół i recyklujesz/usuwasz górny.

Detale:
- **Mapowanie prędkości:** suwak w WPM → `pxPerSec` na bazie średniej wysokości linii; ekspozycja zakresu np. ~90–260 WPM (dostrój). `useAutoSpeed.ts` proponuje start z poziomu i długości transmisji.
- **Strefa czytania (focal band):** subtelne podświetlenie ~w centrum/dolnej tercji — „aktualna" linia.
- **Wygaszanie krawędzi:** `expo-linear-gradient` u góry i dołu w kolorze tła (efekt jak w referencji).
- **Sterowanie:** play / pause / restart; suwak prędkości; wskaźnik postępu (przy trybie o stałej długości).
- **Kierunek przewijania:** ustawienie w Settings. **Domyślnie:** tekst wjeżdża od dołu i wędruje w górę przez strefę czytania (klasyczny teleprompter). Zapewnij toggle na wariant odwrotny (góra→dół), bo o taki pytałeś — jedna linia konfiguracji.
- **Tryby:** `endless` (domyślny, ciągła praktyka) oraz `fixed` (sesja o ustalonej liczbie transmisji, z postępem i podsumowaniem czasu).

Uwaga wydajnościowa: nie renderuj tysięcy linii — utrzymuj okno kilku–kilkunastu widocznych + recykling.

---

## 8. Ekrany / UI

- **Home:** wybór branży (na razie tylko **ATC**, pozostałe wyszarzone „wkrótce"), poziom B1–C2, prędkość (z auto-sugestią), tryb (endless/fixed) → **Start**.
- **Reader:** teleprompter na pełnym ekranie + sterowanie (play/pause/restart, suwak prędkości). Minimalny UI, maks. czytelność, ciemne tło.
- **Settings:** kierunek przewijania, odczyt liczb (digits/aviation), readbacki pilota (on/off), zakres/jednostka prędkości, haptyka, reset historii anty-powtórek.

**Styl:** czysty, wysoki kontrast, ciemne tło, biały tekst wyśrodkowany, duża typografia dla czytelności w ruchu. (Możesz nawiązać do estetyki lotniczej, ale to nie jest wymóg.)

---

## 9. Kryteria akceptacji (FAZA 1)

1. Działa w **Expo Go**, **bez** backendu/klucza API, **w pełni offline**.
2. **10+ minut** ciągłego strumienia ATC **bez** dosłownego powtórzenia i **bez** natychmiastowych powtórzeń szablonu/znaku wywoławczego.
3. Transmisje są **poprawną** standardową frazeologią (ICAO-style), gramatycznie sensowne.
4. Ten sam znak wywoławczy podąża **logicznym łukiem faz lotu**.
5. Zmiana poziomu **widocznie** zmienia gęstość / prędkość / słownictwo (B1 proste i wolne, C2 gęste i szybkie).
6. Przewijanie **płynne** (bez zacięć), prędkość **regulowana na żywo**; play/pause/restart działają.
7. Dodanie nowej branży wymaga **tylko** nowego modułu spełniającego `Domain` — bez zmian w rdzeniu/teleprompterze.
8. Testy generatora ATC przechodzą (patrz §11).

---

## 10. PLAN DZIAŁANIA (kamienie milowe — do prowadzenia Claude Code krok po kroku)

- **M0 — Setup:** projekt Expo+TS, zależności (§4), nawigacja, baza `theme/tokens`, `settingsStore` (zustand + persist), `historyStore`.
- **M1 — Teleprompter:** komponent z `useFrameCallback`, focal band, wygaszanie krawędzi, play/pause/restart, suwak prędkości na żywo, tryb endless z dokładaniem treści. (Na tym etapie karm go tekstem-atrapą.)
- **M2 — Model treści ATC:** `pools.ts`, `templates.ts` (z kategoriami/fazami/min. poziomem), `levels.ts`.
- **M3 — Generator ATC:** `phases.ts` + `session.ts` (maszyna stanów, anty-powtórki, pokrycie). **Napisz testy** (§11).
- **M4 — Home:** wybór branży/poziomu/prędkości/trybu → Start.
- **M5 — Spięcie Reader:** generator → teleprompter; `useAutoSpeed`; ustawienia domenowe (kierunek, odczyt liczb, readbacki).
- **M6 — Settings + trwałość + polish:** persystencja ustawień, haptyka, dopracowanie stylu.
- **M7 — QA:** weryfikacja względem §9.
- **(Później) M8/M9:** moduł dziennikarza / prawnika — reużycie `Domain`/`Session` + teleprompter.

---

## 11. Testy generatora (M3)

- **Brak powtórzeń:** wygeneruj 300 transmisji; brak dwóch identycznych sygnatur w oknie 50; brak dwóch identycznych z rzędu.
- **Poprawność:** każdy wynik pasuje do znanego szablonu po podstawieniu (brak pustych slotów, brak nieprawidłowych wartości — np. HDG 000–360, SQUAWK 4 cyfry ósemkowe).
- **Spójność faz:** dla wybranego znaku sekwencja stanów jest monotoniczna po dozwolonym łuku (odlot/przylot).
- **Skalowanie poziomem:** średnia liczba instrukcji/transmisję rośnie B1<B2<C1<C2; non-normal pojawia się dopiero od C1.
- **Pokrycie:** w 200 transmisjach występują wszystkie kategorie odpowiednie dla poziomu.

---

## 12. Poza zakresem (świadomie)

- Rozpoznawanie/nagrywanie mowy i ocena wymowy (mikrofon) — **nie** w tej wersji.
- Live-AI / LLM w runtime, jakikolwiek backend, konta, płatności.
- Moduły dziennikarza i prawnika — dopiero fazy 2/3.

---

## 13. Decyzje, które podjąłem za Ciebie (powiedz, jeśli któraś ma być inna)

- **Generacja proceduralna na urządzeniu** (nie live-LLM), żeby spełnić „100% darmowe + offline". Ścieżka do opcjonalnego live-AI zostaje otwarta przez interfejs `Domain`.
- **Strumień samego kontrolera** domyślnie (readbacki pilota jako opcja) — zgodnie z referencją.
- **Cyfry** domyślnie, **odczyt lotniczy** opcjonalnie/od C2.
- **Tryb nieskończony** jako domyślny.
- **React Navigation** (Expo Router jako równorzędna alternatywa).
- **Kierunek przewijania jako ustawienie** — domyślnie klasyczny teleprompter (w górę), z toggle na góra→dół.
- **Maszyna stanów faz lotu** jako mechanizm spójności.

---

## 14. GOTOWY PROMPT DO WKLEJENIA W CLAUDE CODE

```
Jesteś w pustym repo (Expo + TypeScript). Przeczytaj SPEC.md — to jedyne źródło prawdy.
Zbuduj aplikację TYLKO dla FAZY 1 (ATC). Dziennikarza i prawnika zostaw na później,
ale od początku trzymaj architekturę domen wtyczkowo (interfejsy Domain/Session/Transmission).

Twarde ograniczenia: 100% darmowe, w pełni offline, bez backendu, bez płatnego/„live" API,
bez klucza API, bez logowania; działa w Expo Go. Tekst generowany proceduralnie na urządzeniu
(banki + szablony + maszyna stanów) — ŻADNEGO LLM w runtime.

Pracuj przyrostowo według kamieni milowych M0→M7 ze SPEC.md. Po każdym kamieniu zatrzymaj się
i pokaż wynik (pliki + jak uruchomić). Zacznij od M0 (scaffold + zależności + nawigacja + store)
oraz M1 (teleprompter na useFrameCallback z reanimated), po czym czekaj na moje „dalej".

Do generatora ATC napisz testy z §11 SPEC.md (brak powtórzeń, poprawność frazeologii,
logiczny łuk faz lotu, skalowanie poziomem, pokrycie).

Jeśli natrafisz na decyzję nieopisaną w SPEC.md — NIE ZGADUJ, zapytaj mnie.
```

---

## 15. ANEKS — decyzje z realizacji (2026-07-03, uzgodnione z autorem)

1. **Długość sesji:** zamiast trybów `endless`/`fixed` z §7 — **jedna stała sesja ~1 minuty** ciągłego, realistycznego strumienia (wymóg dodany po SPEC: „tekst musi lecieć co najmniej ~1 minutę, jak na prompterze reportera"). Generator dobiera ilość tekstu do prędkości startowej z buforem (68 s), więc tekst nie kończy się przed czasem; po przejściu ostatniej linii przez strefę czytania pojawia się podsumowanie (czas, słowa, śr. WPM, liczba transmisji). Silnik `Session.next()` pozostaje strumieniem nieskończonym — tryb endless można przywrócić jedną zmianą w UI.
2. **Silnik scenariusza (rozszerzenie §6):** sesja rozgrywa się na jednym z 8 realnych lotnisk z prawdziwymi układami pasów; wiatr losowany najpierw, **pasy w użyciu wybierane pod wiatr** i spójne przez całą sesję; jedna częstotliwość na stanowisko (Ground/Tower/Approach/Departure/Center); pogoda ewoluuje łagodnym błądzeniem losowym; QNH/altimeter wg regionu (hPa vs inHg); ATIS może raz przejść na kolejną literę (komunikat „information … now current" od C1). Dodane wydarzenia: emergentny go-around przy zajętym pasie, „continue approach", warunkowe line-up (C2) z modelem zajętości pasa, caution wake turbulence po ciężkim/super, QNH podawane danemu statkowi tylko raz, wysokości/prędkości monotoniczne w zniżaniu, GA (Cessna/Cirrus) bez pushbacku.
3. **Motyw:** „Radar Night" — tło #0B0F17, akcent bursztynowy #FFB454, tekst #F5F7FA. Nazwa pozostaje **SpeakStream**; logo = trzy linie promptera z aktywną linią w strefie czytania i chevronem ruchu (SVG w aplikacji + wygenerowane ikony w `assets/`).
4. **Doprecyzowania techniczne:** suwak prędkości = `@react-native-community/slider`; ekran nie usypia podczas czytania (`expo-keep-awake`); splash przez plugin `expo-splash-screen`; testy generatora w czystym TS (jest + ts-jest), bez zależności od React Native.
5. **Plan §14 wykonany w całości (M0→M7) w jednej sesji** na prośbę autora („wykonaj ten plan"), zamiast przystanków po każdym kamieniu.
