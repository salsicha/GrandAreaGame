
Summary of Remaining Gaps

With the Defiance Toggle implemented, the core loop (Crisis -> Tribute -> Action -> Resolution -> Cleanup) is functionally complete for a prototype. However, compared to the full GEMINI.md spec, the following are still abstract or simplified:

"Framing" / Ministry of Truth: The design calls for a mechanic to "frame" actions to adjust costs (e.g., spending Benevolent Cover to justify an Invasion). Currently, this is hardcoded into the action logic (e.g., Invade automatically checks/deducts Social Capital). A future update could add a UI to let players choose how much Social Capital to spend to mitigate Happiness loss.
The Black Budget: The distinction between using "Stash" vs "Political Capital" for Coups is implemented, but the specific "Black Budget" mechanic is currently just the "Stash" value.