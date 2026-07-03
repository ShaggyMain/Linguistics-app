<p align="center"><img src="assets/icon.png" width="96" alt="SpeakStream logo" /></p>

# SpeakStream

**Trenażer płynnego czytania po angielsku w stylu telepromptera** — faza 1: kontroler ruchu lotniczego (ATC).

Tekst w standardowej frazeologii ICAO generowany jest **proceduralnie na urządzeniu** (żadnego LLM, backendu ani konta — 100% offline) i przewija się ze stałą, regulowaną na żywo prędkością. Sesja trwa **około 1 minuty** — jak serwis czytany przez prezentera z promptera. Twoim zadaniem jest nadążyć na głos.

## Jak uruchomić

```bash
npm install
npx expo start
```

Zeskanuj kod QR aplikacją **Expo Go** (Android/iOS). Wszystko działa w Expo Go — bez dev-buildu.

```bash
npm test        # testy generatora (anty-powtórki, frazeologia, łuk faz, poziomy, pokrycie)
npm run typecheck
```

## Co potrafi (faza 1 — ATC)

- **Żywy scenariusz zamiast losowych zdań:** każda sesja rozgrywa się na jednym z 8 realnych lotnisk (Heathrow, JFK, Schiphol, Frankfurt…). Wiatr jest losowany pierwszy, a **pasy w użyciu wybierane pod wiatr**; wszystkie zezwolenia przez całą sesję używają tych samych pasów i tych samych częstotliwości na stanowisko. Pogoda dryfuje łagodnie, QNH i ATIS są spójne.
- **Maszyna stanów faz lotu:** ten sam znak wywoławczy przechodzi logiczny łuk (pushback → taxi → hold short → line up → takeoff → handoff; enroute → descent → approach → final → landing → vacate).
- **Wydarzenia wielotransmisyjne** przeplecione innym ruchem: go-around z wektorami na ponowne podejście (także emergentnie, gdy pas jest zajęty), PAN PAN z priorytetem (C1+), warunkowe line-up „behind the landing…" (C2), caution wake turbulence za ciężkim, sekwencjonowanie „number 2, follow the…".
- **Poziomy B1–C2:** rosnąca gęstość instrukcji (1 → 2–4 klauzul łączonych w jedną transmisję), słownictwo i sugerowane tempo; od C2 liczby czytane po lotniczemu („three one zero", „niner", „runway two seven right").
- **Anty-powtórki:** okno 50 sygnatur (szablon + wartości slotów) utrwalane między sesjami, brak dwóch identycznych transmisji, tego samego szablonu i znaku wywoławczego pod rząd, pule tasowane.
- **Teleprompter:** stała prędkość na `useFrameCallback` (reanimated), suwak WPM działający w trakcie, strefa czytania (focal band), wygaszane krawędzie, odliczanie 3-2-1, kierunek przewijania do wyboru, pasek postępu i podsumowanie sesji (czas, słowa, średnie WPM).
- **Sesja ~1 minuty:** generator dobiera ilość tekstu do wybranej prędkości tak, by strumień płynął pełną minutę.

## Architektura

```
src/
  app/            # ekrany: Home / Reader / Settings (React Navigation)
  teleprompter/   # silnik przewijania + auto-sugestia prędkości
  domains/
    types.ts      # kontrakt Domain / Session / Transmission
    registry.ts   # rejestr branż (ATC aktywna; reporter i prawnik wkrótce)
    atc/          # pools, templates, phases, scenario, session + testy
  store/          # zustand + AsyncStorage (ustawienia, historia anty-powtórek)
  theme/          # tokeny motywu „Radar Night"
```

Nowa branża (faza 2/3) = **jeden moduł** implementujący `Domain` + wpis w `registry.ts`. Rdzeń i teleprompter pozostają nietknięte.

## Motyw „Radar Night"

Głęboka granatowa czerń `#0B0F17` + bursztyn instrumentów `#FFB454` — wysoki kontrast, przyjazny oczom nocą, z lotniczym charakterem. Logo: trzy linie promptera z podświetloną linią w strefie czytania i chevronem ruchu.

## Ustawienia

Kierunek przewijania (klasycznie w górę / w dół) · odczyt liczb (auto / cyfry / słowa lotnicze) · readbacki pilota (domyślnie wył.) · miks częstotliwości (Tower & Ground / Approach & Center) · haptyka · reset historii anty-powtórek.

---

Szczegółowa specyfikacja: [SPEC.md](SPEC.md) (+ aneks z decyzjami z realizacji).
