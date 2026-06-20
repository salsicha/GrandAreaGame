GrandAreaGame
=============

Turn based strategy game based on Chomsky political theory

Rules reference: [RULES.md](RULES.md)


cd frontend
python3 -m http.server 8000


Open http://localhost:8000
Use "Pulse Low Happiness" to animate territories with happiness < 80, or "Pulse Invaded" after resolving an invasion through the turn manager.


Click "Shuffle Deck", "Draw Card" to draw a crisis; the card description appears and the engine will use state.crisis during resolution.
Use "Discard Current" to discard the active card.

Development checks
------------------

Install PHP for BGA syntax checks:

```bash
brew install php
```

Run the test suite:

```bash
npm test
```
