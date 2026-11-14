const STORAGE_KEY = "flipforge_app_v1";

const elements = {
  deckList: document.querySelector("#deck-list"),
  deckTitle: document.querySelector("#active-deck-title"),
  deckDescription: document.querySelector("#active-deck-description"),
  deckCountLabel: document.querySelector("#deck-count-label"),
  cardGrid: document.querySelector("#card-grid"),
  cardSearch: document.querySelector("#card-search"),
  emptyState: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-state-title"),
  emptyCopy: document.querySelector("#empty-state-copy"),
  emptyAction: document.querySelector("#empty-state-action"),
  deckView: document.querySelector("#deck-view"),
  studyView: document.querySelector("#study-view"),
  studyCard: document.querySelector("#study-card"),
  studyCardInner: document.querySelector("#study-card-inner"),
  studyFront: document.querySelector("#study-front"),
  studyBack: document.querySelector("#study-back"),
  studyProgress: document.querySelector("#study-progress"),
  studyDeckName: document.querySelector("#study-deck-name"),
  editCurrentCard: document.querySelector("#edit-current-card-button"),
  deleteCurrentCard: document.querySelector("#delete-current-card-button"),
  announcements: document.querySelector("#announcements"),
  startStudy: document.querySelector("#start-study-button"),
  studyButtonLabel: document.querySelector("#study-button-label"),
  shuffleDeck: document.querySelector("#shuffle-deck-button"),
  addCard: document.querySelector("#add-card-button"),
  deckDialog: document.querySelector("#deck-dialog"),
  deckForm: document.querySelector("#deck-form"),
  deckDialogTitle: document.querySelector("#deck-dialog-title"),
  deckId: document.querySelector("#deck-id"),
  deckTitleInput: document.querySelector("#deck-title"),
  deckDescriptionInput: document.querySelector("#deck-description"),
  saveDeck: document.querySelector("#save-deck-button"),
  deleteDeck: document.querySelector("#delete-deck-button"),
  cardDialog: document.querySelector("#card-dialog"),
  cardForm: document.querySelector("#card-form"),
  cardDialogTitle: document.querySelector("#card-dialog-title"),
  cardId: document.querySelector("#card-id"),
  cardFront: document.querySelector("#card-front"),
  cardBack: document.querySelector("#card-back"),
  saveCard: document.querySelector("#save-card-button"),
  deleteCard: document.querySelector("#delete-card-button")
};

let shouldPersistInitialState = false;

const makeId = () => (
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const makeCardId = () => (
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
);

function createSeedState() {
  const deckId = "flipforge-welcome";
  return {
    decks: [{
      id: deckId,
      name: "Getting started",
      description: "A few quick cards to help you get to know FlipForge.",
      createdAt: Date.now(),
      cards: [
        { id: "welcome-1", front: "What is FlipForge?", back: "A simple, friendly space to create flashcards and learn one card at a time." },
        { id: "welcome-2", front: "How do I make a deck?", back: "Choose “New deck” and give your study topic a name. You can add a description, too." },
        { id: "welcome-3", front: "How do I study?", back: "Select a deck, then choose “Study deck.” Flip each card to check what you know." },
        { id: "welcome-4", front: "Where is my study data saved?", back: "Your decks and cards stay in this browser, so you can pick up where you left off." }
      ]
    }],
    activeDeckId: deckId,
    currentCardIndex: 0,
    isFlipped: false,
    studyState: { isActive: false, cardQueue: [] }
  };
}

function loadState() {
  let savedValue;
  try {
    savedValue = localStorage.getItem(STORAGE_KEY);
    if (savedValue === null) {
      shouldPersistInitialState = true;
      const initialState = localStorage.length === 0
        ? createSeedState()
        : {
            decks: [],
            activeDeckId: null,
            currentCardIndex: 0,
            isFlipped: false,
            studyState: { isActive: false, cardQueue: [] }
          };
      return initialState;
    }

    const savedState = JSON.parse(savedValue);
    if (!savedState || !Array.isArray(savedState.decks)) {
      throw new Error("Saved FlipForge data has an invalid structure.");
    }
    const savedCards = Array.isArray(savedState.cards) ? savedState.cards : [];
    const decks = savedState.decks
      .filter((deck) => deck && typeof deck.id === "string" && (typeof deck.name === "string" || typeof deck.title === "string"))
      .map((deck) => {
        const deckCards = Array.isArray(deck.cards)
          ? deck.cards
          : savedCards.filter((card) => card?.deckId === deck.id);
        return {
          id: deck.id,
          name: typeof deck.name === "string" ? deck.name : deck.title,
          description: typeof deck.description === "string" ? deck.description : "",
          createdAt: Number.isFinite(deck.createdAt) ? deck.createdAt : Date.now(),
          cards: deckCards
            .filter((card) => card && typeof card.id === "string" && typeof card.front === "string" && typeof card.back === "string")
            .map(({ id, front, back }) => ({ id, front, back }))
        };
      });
    const deckIds = new Set(decks.map((deck) => deck.id));
    const savedStudyState = savedState.studyState || {};
    const activeDeckId = deckIds.has(savedState.activeDeckId) ? savedState.activeDeckId : (decks[0]?.id ?? null);
    const queueIds = new Set(decks.flatMap((deck) => deck.cards.map((card) => card.id)));
    const cardQueue = Array.isArray(savedStudyState.cardQueue)
      ? savedStudyState.cardQueue.filter((id) => queueIds.has(id))
      : [];
    return {
      decks,
      activeDeckId,
      studyState: {
        isActive: savedStudyState.isActive === true && cardQueue.length > 0,
        cardQueue
      },
      currentCardIndex: Math.min(
        Math.max(
          Number.isInteger(savedState.currentCardIndex)
            ? savedState.currentCardIndex
            : Number.isInteger(savedStudyState.currentIndex) ? savedStudyState.currentIndex : 0,
          0
        ),
        Math.max(cardQueue.length - 1, 0)
      ),
      isFlipped: savedState.isFlipped === true || savedStudyState.isFlipped === true
    };
  } catch (error) {
    console.error("Unable to load FlipForge data:", error);
    window.alert("FlipForge couldn't read its saved data. Your current browser storage was left unchanged.");
    return {
      decks: [],
      activeDeckId: null,
      currentCardIndex: 0,
      isFlipped: false,
      studyState: { isActive: false, cardQueue: [] }
    };
  }
}

const state = loadState();

// Persist every state transition in one place so reloads restore the same workspace and study position.
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Unable to save FlipForge data:", error);
    window.alert("FlipForge couldn't save your changes. Check that browser storage is available.");
  }
}

class ModalController {
  constructor(dialog, form, getFallbackFocus) {
    this.dialog = dialog;
    this.form = form;
    this.getFallbackFocus = getFallbackFocus;
    this.returnFocusTarget = null;
    this.dialog.tabIndex = -1;

    dialog.addEventListener("keydown", (event) => this.trapTab(event));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.close();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) this.close();
    });
    dialog.addEventListener("close", () => this.handleClose());
  }

  open(firstInput, returnFocusTarget = document.activeElement) {
    this.returnFocusTarget = returnFocusTarget instanceof HTMLElement ? returnFocusTarget : null;
    this.dialog.showModal();
    firstInput.focus();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  trapTab(event) {
    if (event.key !== "Tab") return;
    const focusable = [...this.dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((element) => (
      !element.closest("[hidden]")
      && element.getAttribute("aria-hidden") !== "true"
      && element.getClientRects().length > 0
    ));

    if (focusable.length === 0) {
      event.preventDefault();
      this.dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !this.dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !this.dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  handleClose() {
    this.form.querySelectorAll("input, textarea, select").forEach((field) => {
      field.setCustomValidity("");
    });
    this.form.reset();

    const returnFocusTarget = this.returnFocusTarget;
    this.returnFocusTarget = null;
    window.requestAnimationFrame(() => {
      const targetIsAvailable = returnFocusTarget?.isConnected
        && !returnFocusTarget.closest("[hidden]")
        && !returnFocusTarget.matches(":disabled");
      const focusTarget = targetIsAvailable ? returnFocusTarget : this.getFallbackFocus();
      if (focusTarget instanceof HTMLElement && !focusTarget.matches(":disabled")) {
        focusTarget.focus();
      }
    });
  }
}

const deckModal = new ModalController(
  elements.deckDialog,
  elements.deckForm,
  () => elements.deckList.querySelector('.deck-select[aria-current="true"]')
    ?? document.querySelector("#add-deck-button")
);
const cardModal = new ModalController(
  elements.cardDialog,
  elements.cardForm,
  () => elements.addCard
);

function announce(message) {
  elements.announcements.textContent = message;
}

function activeDeck() {
  return state.decks.find((deck) => deck.id === state.activeDeckId) ?? null;
}

function cardsForActiveDeck() {
  return activeDeck()?.cards ?? [];
}

function findCard(cardId) {
  for (const deck of state.decks) {
    const card = deck.cards.find((item) => item.id === cardId);
    if (card) return card;
  }
  return null;
}

function visibleCardsForActiveDeck() {
  const query = elements.cardSearch.value.trim().toLocaleLowerCase();
  return cardsForActiveDeck().filter((card) => (
    card.front.toLocaleLowerCase().includes(query)
    || card.back.toLocaleLowerCase().includes(query)
  ));
}

function renderDecks() {
  const existingItems = new Map(
    [...elements.deckList.children].map((item) => [item.dataset.deckId, item])
  );

  state.decks.forEach((deck, index) => {
    let item = existingItems.get(deck.id);
    if (!item) item = createDeckListItem(deck);
    existingItems.delete(deck.id);

    const expectedItem = elements.deckList.children[index] ?? null;
    if (expectedItem !== item) elements.deckList.insertBefore(item, expectedItem);

    item.classList.toggle("active", deck.id === state.activeDeckId);
    const selectButton = item.querySelector('[data-action="select"]');
    selectButton.setAttribute("aria-current", deck.id === state.activeDeckId ? "true" : "false");
    item.querySelector(".deck-name").textContent = deck.name;
    item.querySelector(".deck-card-count").textContent = `${deck.cards.length} ${deck.cards.length === 1 ? "card" : "cards"}`;
    item.querySelector('[data-action="edit"]').setAttribute("aria-label", `Edit ${deck.name}`);
    item.querySelector('[data-action="delete"]').setAttribute("aria-label", `Delete ${deck.name}`);
  });

  existingItems.forEach((item) => item.remove());
}

function createDeckListItem(deck) {
    const item = document.createElement("li");
    item.className = "deck-list-item";
    item.dataset.deckId = deck.id;

    const selectButton = document.createElement("button");
    selectButton.className = "deck-select";
    selectButton.type = "button";
    selectButton.dataset.action = "select";
    selectButton.dataset.deckId = deck.id;

    const dot = document.createElement("span");
    dot.className = "deck-dot";
    dot.setAttribute("aria-hidden", "true");

    const nameWrap = document.createElement("span");
    nameWrap.className = "deck-name-wrap";
    const name = document.createElement("span");
    name.className = "deck-name";
    const count = document.createElement("span");
    count.className = "deck-card-count";
    nameWrap.append(name, count);
    selectButton.append(dot, nameWrap);

    const editButton = document.createElement("button");
    editButton.className = "small-action deck-edit";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.dataset.action = "edit";
    editButton.dataset.deckId = deck.id;

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-action delete deck-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.deckId = deck.id;

    item.append(selectButton, editButton, deleteButton);
    return item;
}

function renderCards() {
  const deck = activeDeck();
  const allCards = cardsForActiveDeck();
  const query = elements.cardSearch.value.trim().toLocaleLowerCase();
  const visibleCards = visibleCardsForActiveDeck();
  const existingCards = new Map(
    [...elements.cardGrid.children].map((article) => [article.dataset.cardId, article])
  );

  elements.deckCountLabel.textContent = deck
    ? `${allCards.length} ${allCards.length === 1 ? "card" : "cards"} in this deck`
    : "Your study space";
  elements.deckTitle.textContent = deck ? deck.name : "Welcome to FlipForge";
  elements.deckDescription.textContent = deck?.description ?? "";
  elements.addCard.disabled = !deck;
  elements.startStudy.disabled = visibleCards.length === 0;
  elements.shuffleDeck.disabled = visibleCards.length === 0;
  elements.studyButtonLabel.textContent = query
    ? `Study ${visibleCards.length} matching ${visibleCards.length === 1 ? "card" : "cards"}`
    : `Study all ${allCards.length} ${allCards.length === 1 ? "card" : "cards"}`;

  visibleCards.forEach((card, index) => {
    let article = existingCards.get(card.id);
    if (!article) {
      article = document.createElement("article");
      article.className = "flashcard";
      article.dataset.cardId = card.id;

      const top = document.createElement("div");
      top.className = "flashcard-top";
      const number = document.createElement("span");
      number.className = "card-number";
      const side = document.createElement("span");
      side.className = "card-side-label";
      side.textContent = "Front";
      top.append(number, side);

      const front = document.createElement("p");
      front.className = "flashcard-question";

      const backLabel = document.createElement("span");
      backLabel.className = "card-side-label card-back-label";
      backLabel.textContent = "Back";

      const back = document.createElement("p");
      back.className = "flashcard-answer";

      const actions = document.createElement("div");
      actions.className = "flashcard-actions";
      const editButton = document.createElement("button");
      editButton.className = "small-action";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.dataset.action = "edit";
      editButton.dataset.cardId = card.id;
      actions.append(editButton);
      article.append(top, front, backLabel, back, actions);
    }

    article.querySelector(".card-number").textContent = `Card ${String(index + 1).padStart(2, "0")}`;
    article.querySelector(".flashcard-question").textContent = card.front;
    article.querySelector(".flashcard-answer").textContent = card.back;
    article.querySelector(".small-action").setAttribute("aria-label", `Edit card: ${card.front}`);
    const expectedArticle = elements.cardGrid.children[index] ?? null;
    if (expectedArticle !== article) elements.cardGrid.insertBefore(article, expectedArticle);
    existingCards.delete(card.id);
  });
  existingCards.forEach((article) => article.remove());

  const hasDeck = Boolean(deck);
  elements.emptyState.hidden = visibleCards.length > 0;
  elements.cardGrid.hidden = visibleCards.length === 0;
  if (!hasDeck) {
    elements.emptyTitle.textContent = "Your FlipForge starts here";
    elements.emptyCopy.textContent = "Create a deck, add a few flashcards, and start learning at your own pace.";
    elements.emptyAction.textContent = "Create your first deck";
    elements.emptyAction.onclick = () => openDeckDialog();
  } else if (allCards.length === 0) {
    elements.emptyTitle.textContent = "A blank page, full of potential";
    elements.emptyCopy.textContent = "Add your first card to this deck, then come back to study.";
    elements.emptyAction.textContent = "Add your first card";
    elements.emptyAction.onclick = () => openCardDialog();
  } else {
    elements.emptyTitle.textContent = "No cards found";
    elements.emptyCopy.textContent = "Try another search, or clear the search field to see all cards.";
    elements.emptyAction.textContent = "Clear search";
    elements.emptyAction.onclick = () => {
      elements.cardSearch.value = "";
      renderCards();
      elements.cardSearch.focus();
    };
  }
}

function renderStudyCard(shouldAnnounce = false) {
  const study = state.studyState;
  const currentId = study.cardQueue[state.currentCardIndex];
  const card = findCard(currentId);
  if (!card) {
    exitStudyMode();
    return;
  }

  elements.studyCardInner.classList.toggle("is-flipped", state.isFlipped);
  elements.studyFront.textContent = card.front;
  elements.studyBack.textContent = card.back;
  elements.studyCard.setAttribute("aria-label", state.isFlipped ? "Show flashcard front" : "Show flashcard back");
  elements.studyProgress.textContent = `Card ${state.currentCardIndex + 1} of ${study.cardQueue.length}`;
  document.querySelector("#previous-card-button").disabled = state.currentCardIndex === 0;
  document.querySelector("#next-card-button").disabled = state.currentCardIndex === study.cardQueue.length - 1;
  if (elements.studyCardInner.classList.contains("is-resetting")) {
    window.requestAnimationFrame(() => elements.studyCardInner.classList.remove("is-resetting"));
  }
  if (shouldAnnounce) {
    announce(`Card ${state.currentCardIndex + 1} of ${study.cardQueue.length}. ${state.isFlipped ? "Answer" : "Question"}: ${state.isFlipped ? card.back : card.front}`);
  }
}

function resetFlipBeforeCardChange() {
  state.isFlipped = false;
  elements.studyCardInner.classList.add("is-resetting");
  elements.studyCardInner.classList.remove("is-flipped");
  // Commit the front-facing transform before the next card's text is rendered.
  elements.studyCardInner.getBoundingClientRect();
}

function currentStudyCard() {
  return findCard(state.studyState.cardQueue[state.currentCardIndex]);
}

function render() {
  renderDecks();
  renderCards();
  elements.deckView.hidden = state.studyState.isActive;
  elements.studyView.hidden = !state.studyState.isActive;
  if (state.studyState.isActive) {
    elements.studyDeckName.textContent = activeDeck()?.name ?? "";
    renderStudyCard();
  }
}

function selectDeck(deckId) {
  resetFlipBeforeCardChange();
  state.currentCardIndex = 0;
  if (state.studyState.isActive) exitStudyMode();
  state.activeDeckId = deckId;
  elements.cardSearch.value = "";
  saveState();
  render();
}

function openDeckDialog(deck = null, returnFocusTarget = document.activeElement) {
  if (state.studyState.isActive) exitStudyMode();
  elements.deckForm.reset();
  elements.deckId.value = deck?.id ?? "";
  elements.deckTitleInput.value = deck?.name ?? "";
  elements.deckDescriptionInput.value = deck?.description ?? "";
  elements.deckDialogTitle.textContent = deck ? "Edit deck" : "Create a deck";
  elements.saveDeck.textContent = deck ? "Save changes" : "Create deck";
  elements.deleteDeck.hidden = !deck;
  deckModal.open(elements.deckTitleInput, returnFocusTarget);
}

function openCardDialog(card = null, returnFocusTarget = document.activeElement) {
  if (!activeDeck()) return;
  elements.cardForm.reset();
  elements.cardId.value = card?.id ?? "";
  elements.cardFront.value = card?.front ?? "";
  elements.cardBack.value = card?.back ?? "";
  elements.cardDialogTitle.textContent = card ? "Edit card" : "Add a card";
  elements.saveCard.textContent = card ? "Save changes" : "Add card";
  elements.deleteCard.hidden = !card;
  cardModal.open(elements.cardFront, returnFocusTarget);
}

function saveDeck(event) {
  event.preventDefault();
  const name = elements.deckTitleInput.value.trim();
  const description = elements.deckDescriptionInput.value.trim();
  if (!name) {
    elements.deckTitleInput.setCustomValidity("Enter a deck name without only spaces.");
    elements.deckTitleInput.reportValidity();
    return;
  }
  elements.deckTitleInput.setCustomValidity("");

  if (elements.deckId.value) {
    const deck = state.decks.find((item) => item.id === elements.deckId.value);
    if (!deck) {
      window.alert("This deck no longer exists. Close the dialog and try again.");
      return;
    }
    deck.name = name;
    deck.description = description;
    announce(`Updated deck ${name}.`);
  } else {
    const deck = { id: makeId(), name, description, createdAt: Date.now(), cards: [] };
    state.decks.push(deck);
    state.activeDeckId = deck.id;
    elements.cardSearch.value = "";
    announce(`Created deck ${name}.`);
  }
  saveState();
  deckModal.close();
  render();
}

function deleteDeck(deckId = elements.deckId.value, closeModal = false, returnFocusTarget = document.activeElement) {
  const deck = state.decks.find((item) => item.id === deckId);
  if (!deck) return;
  const cardCount = deck.cards.length;
  const message = `Delete “${deck.name}” and its ${cardCount} ${cardCount === 1 ? "card" : "cards"}? This cannot be undone.`;
  if (!window.confirm(message)) return;

  const deletedCardIds = new Set(deck.cards.map((card) => card.id));
  state.decks = state.decks.filter((item) => item.id !== deck.id);
  if (state.activeDeckId === deck.id) {
    state.activeDeckId = state.decks[0]?.id ?? null;
    elements.cardSearch.value = "";
  }
  if (state.studyState.cardQueue.some((id) => deletedCardIds.has(id))) {
    resetFlipBeforeCardChange();
    state.currentCardIndex = 0;
    state.studyState = { isActive: false, cardQueue: [] };
  }
  saveState();
  if (closeModal) deckModal.close();
  render();
  if (!closeModal) {
    window.requestAnimationFrame(() => {
      const target = returnFocusTarget?.isConnected
        ? returnFocusTarget
        : elements.deckList.querySelector('.deck-select[aria-current="true"]')
          ?? document.querySelector("#add-deck-button");
      target?.focus();
    });
  }
  announce(`Deleted deck ${deck.name}.`);
}

function saveCard(event) {
  event.preventDefault();
  const front = elements.cardFront.value.trim();
  const back = elements.cardBack.value.trim();
  if (!front || !back) {
    const field = front ? elements.cardBack : elements.cardFront;
    field.setCustomValidity("Add text to both sides of the card.");
    field.reportValidity();
    return;
  }
  elements.cardFront.setCustomValidity("");
  elements.cardBack.setCustomValidity("");

  const deck = activeDeck();
  if (!deck) return;
  if (elements.cardId.value) {
    const card = deck.cards.find((item) => item.id === elements.cardId.value);
    if (!card) {
      window.alert("This card no longer exists. Close the dialog and try again.");
      return;
    }
    card.front = front;
    card.back = back;
    announce("Card updated.");
  } else {
    deck.cards.push({ id: makeCardId(), front, back });
    announce("Card added.");
  }
  // Edits keep card IDs stable so a persisted study queue can still locate them.
  saveState();
  cardModal.close();
  render();
}

function deleteCard(cardId, closeModal = false) {
  const deck = activeDeck();
  const card = deck?.cards.find((item) => item.id === cardId);
  if (!card) return;
  if (!window.confirm(`Delete “${card.front}”? This cannot be undone.`)) return;

  resetFlipBeforeCardChange();
  deck.cards = deck.cards.filter((item) => item.id !== cardId);
  const deletedQueueIndex = state.studyState.cardQueue.indexOf(cardId);
  state.studyState.cardQueue = state.studyState.cardQueue.filter((id) => id !== cardId);
  if (state.studyState.cardQueue.length === 0) {
    state.studyState = { isActive: false, cardQueue: [] };
    state.currentCardIndex = 0;
  } else if (deletedQueueIndex !== -1) {
    if (deletedQueueIndex < state.currentCardIndex) state.currentCardIndex -= 1;
    state.currentCardIndex = Math.min(state.currentCardIndex, state.studyState.cardQueue.length - 1);
  }
  saveState();
  if (closeModal) cardModal.close();
  render();
  announce("Card deleted.");
}

function shuffleQueue(queue) {
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[randomIndex]] = [queue[randomIndex], queue[index]];
  }
}

function startStudyMode(shuffle = false) {
  const deck = activeDeck();
  const cards = visibleCardsForActiveDeck();
  if (!deck || cards.length === 0) return;
  const cardQueue = cards.map((card) => card.id);
  if (shuffle) shuffleQueue(cardQueue);
  // Starting a session snapshots this deck's card IDs; subsequent study actions update this queue.
  state.studyState = {
    isActive: true,
    cardQueue
  };
  resetFlipBeforeCardChange();
  state.currentCardIndex = 0;
  elements.deckView.hidden = true;
  elements.studyView.hidden = false;
  elements.studyDeckName.textContent = deck.name;
  renderStudyCard(true);
  saveState();
}

function exitStudyMode() {
  // The queue and flip position are transient; decks and cards remain untouched.
  resetFlipBeforeCardChange();
  state.currentCardIndex = 0;
  state.studyState = { isActive: false, cardQueue: [] };
  saveState();
  render();
  announce("Exited study mode.");
}

function flipStudyCard() {
  if (!state.studyState.isActive) return;
  state.isFlipped = !state.isFlipped;
  renderStudyCard(true);
  saveState();
}

function moveStudyCard(direction) {
  const nextIndex = state.currentCardIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.studyState.cardQueue.length) return;
  resetFlipBeforeCardChange();
  state.currentCardIndex = nextIndex;
  renderStudyCard(true);
  saveState();
}

function shuffleCards() {
  resetFlipBeforeCardChange();
  shuffleQueue(state.studyState.cardQueue);
  state.currentCardIndex = 0;
  renderStudyCard(true);
  saveState();
}

document.querySelector("#add-deck-button").addEventListener("click", () => openDeckDialog());
document.querySelector("#sidebar-add-deck").addEventListener("click", () => openDeckDialog());
document.querySelector("#add-card-button").addEventListener("click", () => openCardDialog());
elements.deckList.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const actionButton = event.target.closest("button[data-action][data-deck-id]");
  if (!actionButton || !elements.deckList.contains(actionButton)) return;

  const deck = state.decks.find((item) => item.id === actionButton.dataset.deckId);
  if (!deck) return;

  if (actionButton.dataset.action === "select") {
    selectDeck(deck.id);
  } else if (actionButton.dataset.action === "edit") {
    openDeckDialog(deck, actionButton);
  } else if (actionButton.dataset.action === "delete") {
    deleteDeck(deck.id, false, actionButton);
  }
});
elements.cardGrid.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const actionButton = event.target.closest('button[data-action="edit"][data-card-id]');
  if (!actionButton || !elements.cardGrid.contains(actionButton)) return;
  const card = activeDeck()?.cards.find((item) => item.id === actionButton.dataset.cardId);
  if (card) openCardDialog(card, actionButton);
});
elements.startStudy.addEventListener("click", startStudyMode);
elements.shuffleDeck.addEventListener("click", () => startStudyMode(true));
elements.deckForm.addEventListener("submit", saveDeck);
elements.cardForm.addEventListener("submit", saveCard);
elements.deckTitleInput.addEventListener("input", () => elements.deckTitleInput.setCustomValidity(""));
elements.cardFront.addEventListener("input", () => elements.cardFront.setCustomValidity(""));
elements.cardBack.addEventListener("input", () => elements.cardBack.setCustomValidity(""));
elements.deleteDeck.addEventListener("click", () => deleteDeck(elements.deckId.value, true));
elements.deleteCard.addEventListener("click", () => deleteCard(elements.cardId.value, true));
elements.editCurrentCard.addEventListener("click", () => {
  const card = currentStudyCard();
  if (card) openCardDialog(card, elements.editCurrentCard);
});
elements.deleteCurrentCard.addEventListener("click", () => {
  const card = currentStudyCard();
  if (card) deleteCard(card.id);
});
elements.cardSearch.addEventListener("input", renderCards);
elements.studyCard.addEventListener("click", flipStudyCard);
document.querySelector("#flip-card-button").addEventListener("click", flipStudyCard);
document.querySelector("#previous-card-button").addEventListener("click", () => moveStudyCard(-1));
document.querySelector("#next-card-button").addEventListener("click", () => moveStudyCard(1));
document.querySelector("#shuffle-cards-button").addEventListener("click", shuffleCards);
document.querySelector("#exit-study-button").addEventListener("click", exitStudyMode);

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.closest("dialog") === elements.deckDialog) deckModal.close();
    else cardModal.close();
  });
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLElement
    && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  if (document.querySelector("dialog[open]")) return;
  if (event.key === "/" && !isTyping && !state.studyState.isActive) {
    event.preventDefault();
    elements.cardSearch.focus();
    return;
  }
  if (!state.studyState.isActive || isTyping) return;

  if (event.key === "Escape") {
    exitStudyMode();
  } else if (event.key === " " || event.key === "Enter") {
    if (target === elements.studyCard || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return;
    event.preventDefault();
    flipStudyCard();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveStudyCard(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveStudyCard(-1);
  }
});

render();
if (shouldPersistInitialState) saveState();
