# FlipForge

FlipForge is a single-page flashcard study app built with vanilla HTML, CSS, and JavaScript. It has no build step, framework, package installation, or external runtime dependency.

## Architecture

- `index.html` provides the semantic page structure, accessible dialogs, and controls.
- `styles.css` defines the responsive layout, focus styles, and 3D study-card flip.
- `app.js` owns the centralized application state and renders decks, cards, and study mode. Deck and card text is inserted as text, not HTML.

Decks, cards, the selected deck, and study progress are stored in `localStorage` under `flipforge_app_v1`. A starter deck is created only on a first load when browser storage is empty. Storage read/parse and write failures are caught and reported to the user.

Searching filters cards by front or back text. Study mode uses the matching cards; its button shows the number of cards that will be studied.

## Keyboard shortcuts

- `/` focuses card search when not typing and outside Study Mode.
- `Space` or `Enter` flips the current study card.
- `ArrowRight` / `ArrowLeft` advances or goes back.
- `Escape` exits Study Mode.

Typing shortcuts are ignored while focus is in an input or textarea.

## Run locally

From the repository directory, start Python's built-in static server:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). No build or install commands are needed. Data is saved in that browser's local storage for the site origin.
