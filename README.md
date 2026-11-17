# Paiguta sõnad (H5P.OrderWords)

*Eesti keeles · [English](#english)*

H5P sisutüüp, kus vastaja paigutab sõnad õigesse järjekorda või õigetesse lünkadesse. Sõnu saab lohistada, kirjutada või valida rippmenüüst. Lünkadesse sobib ka mitu õiget vastust, valikutesse saab lisada eksitavaid sõnu ning ülesandele või igale reale saab lisada pildi. Toetatud on matemaatika- ja keemiavalemid (LaTeX).

**Näidisfailid:** https://urmasvessin.ee/testid/h5p/h5p-sisutuup-place-words-paiguta-sonad/

## Vastamisviisid

- **Lohista lünkadesse → Kogu tekst (sõnade järjestamine).** Iga tekstirida on eraldi lause. Iga sõna saab oma lahtri ja kirjavahemärgid jäävad paigale. Vastaja paigutab sõnapangast sõnad lahtritesse lohistades või klikkides. Markeritega saab mitmesõnalise fraasi hoida koos ühe sõnaplaadina, nt `Ta elab [New Yorgis].`
- **Lohista lünkadesse → Ainult markeritega tähistatud sõnad.** Vastaja lohistab vastused markeritega tähistatud lünkadesse.
- **Kirjuta lünkadesse.** Vastaja kirjutab vastused lünkadesse.
- **Vali rippmenüüst.** Iga lünga juures on rippmenüü. See võib näidata kõiki vastusevariante või kindlat arvu variante (vaikimisi 4). Õige vastus on alati valikute hulgas.

## Võimalused

- **Lüngad ja alternatiivid.** Lüngarežiimides märgitakse vastused markeritega, nt `[vastus]`. Mitu õiget varianti eraldatakse eraldajaga (`[kass|koer]`), ja `[!!]` tähendab, et õige vastus on tühi. Markereid tekstis ei kuvata.
- **Markerid:** `[ ]`, `{ }`, `# #`, `@ @` või `* *`. Alternatiivide eraldaja on vaikimisi `|` ja seda saab muuta.
- **Lisavalikud.** Valikutesse saab lisada eksitavaid sõnu või vastuseid. Sõnade järjestamisel saab lisavalikud anda iga tekstirea kohta eraldi.
- **Vastusevalikute asukoht** lohistamisrežiimides on teksti all, teksti kohal või mõlemas kohas. Valikud saab segada.
- **Lahtrite laius.** Lünkade ja lahtrite laius sõltub kas vastuse pikkusest või on kõigil sama.
- **Pildid.**
  - Lüngarežiimides saab ülesandele lisada ühe pildi.
  - Sõnade järjestamisel saab iga tekstirea juurde lisada eraldi pildi.
  - Pildi saab üles laadida või anda URL-iga. Pilt võib olla teksti kohal või vasakul ning laiuse saab määrata protsentides või pikslites.
- **Valemid.** LaTeX-valemid (nt `\( x^2 \)`) kuvatakse H5P.MathDisplay abil, kui see on platvormil olemas. Sõnade järjestamisel on iga valem üks sõnaplaat.
- **Hindamine.**
  - Sõnade järjestamisel annab punkti kas iga õigel kohal olev sõna või iga täiesti õige lause.
  - Lüngarežiimides annab iga lünk ühe punkti.
  - Suur- ja väiketähti eristatakse.
- **Kontrollimine.** Pärast kontrollimist on näha õigete, valede ja puuduvate arv koos tulemusega. Puuduvate vastuste näitamise saab välja lülitada ja uuesti proovimise saab lubada.
- **Aruandlus.** Tulemus saadetakse xAPI-ga (`fill-in`). Moodle'i mod_hvp aruandes on õpilase vastus näha lünkade või sõnalahtrite kaupa.
- **Keeled:** eesti, hispaania, inglise, saksa, vene. Kõik kasutajaliidese tekstid saab sisus muuta.

## Sõltuvus

Redaktor vajab teeki [H5PEditor.PlaceWordsShowWhen](https://github.com/urmasv/H5PEditor.PlaceWordsShowWhen) (`library.json` → `editorDependencies`).

Hoidla juur on teegi juur, ehitamist pole vaja.

## Litsents

MIT, vt [LICENSE](LICENSE).

## Autor

UrmasV

---

<a id="english"></a>

# Place Words (H5P.OrderWords)

*[Eesti keeles](#paiguta-sõnad-h5porderwords) · English*

An H5P content type in which the learner places words in the correct order or in the correct gaps. Words can be dragged, typed or chosen from a dropdown. Gaps can have several correct answers, distractors can be added to the options, and an image can be added to the task or to each line. Mathematical and chemical formulas (LaTeX) are supported.

**Sample files:** https://urmasvessin.ee/testid/h5p/h5p-sisutuup-place-words-paiguta-sonad/

## Answering modes

- **Drag into gaps → Whole text (word ordering).** Each line of the text is a separate sentence. Every word gets its own slot and punctuation stays in place. The learner moves words from the word bank into the slots by dragging or clicking. Markers keep a multi-word phrase together as one tile, e.g. `He lives in [New York].`
- **Drag into gaps → Only words marked with markers.** The learner drags the answers into the gaps marked with markers.
- **Type into gaps.** The learner types the answers into the gaps.
- **Choose from dropdown.** Each gap has a dropdown. It can show all answer options or a set number of options (4 by default). The correct answer is always included.

## Features

- **Gaps and alternatives.** In gap modes the answers are marked with markers, e.g. `[answer]`. Several correct alternatives are separated with the separator (`[cat|dog]`), and `[!!]` means the correct answer is empty. The markers are not displayed in the text.
- **Markers:** `[ ]`, `{ }`, `# #`, `@ @` or `* *`. The default alternative separator is `|` and it can be changed.
- **Additional options.** Distractor words or answers can be added to the options. In word ordering they can be given separately for each line of the text.
- **Answer options position** in the drag modes: below the text, above the text, or both. The options can be shuffled.
- **Slot width.** The width of gaps and slots either follows the length of the answer or is the same for all.
- **Images.**
  - In gap modes one image can be added to the task.
  - In word ordering a separate image can be added to each line of the text.
  - An image can be uploaded or given by URL. It can be placed above or to the left of the text, and its width can be set in percent or pixels.
- **Formulas.** LaTeX formulas (e.g. `\( x^2 \)`) are rendered with H5P.MathDisplay when it is available on the platform. In word ordering each formula is a single tile.
- **Scoring.**
  - In word ordering a point is given either for each correctly placed word or for each fully correct sentence.
  - In gap modes each gap gives one point.
  - Scoring is case-sensitive.
- **Checking.** After checking, the numbers of correct, wrong and missing answers are shown together with the result. Showing the missing answers can be turned off and retry can be enabled.
- **Reporting.** The result is sent via xAPI (`fill-in`). The Moodle mod_hvp report shows the learner's answer for each gap or word slot.
- **Languages:** Estonian, English, German, Russian, Spanish. All user interface texts can be changed in the content.

## Dependency

The editor requires the library [H5PEditor.PlaceWordsShowWhen](https://github.com/urmasv/H5PEditor.PlaceWordsShowWhen) (`library.json` → `editorDependencies`).

The repository root is the library root; no build step is needed.

## License

MIT, see [LICENSE](LICENSE).

## Author

UrmasV
