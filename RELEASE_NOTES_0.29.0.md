# Horizon 0.29.0: Strategic AI

Horizon 0.29.0 is the first dedicated AI strategy release. It keeps the 0.28.0 multiplayer and mobile reliability work while giving the Core Set civilizations a unified, rules-faithful strategic model.

## Goal-based Legacy planning

- Bots now plan around Hidden, Universal, Civilization, and Horizon Gate goals together.
- Universal and Civilization objectives expose meaningful progress for planning and reports.
- Hidden objective selection considers progress, faction affinity, deadlines, action pace, and public competition.
- Orders receive bonuses when they advance a selected Legacy path instead of merely matching a generic faction preference.

## Threat-aware diplomacy

- Opponent models now track public production, Technology, agreements, objective pressure, victory threat, Gate risk, relationships, and diplomatic stance.
- Bots distinguish runaway leaders from unreliable Gate partners.
- Trade acceptance accounts for scarcity, reserves, objective value, Gate emergencies, relationship history, and the strategic benefit given to the other civilization.
- Unfavorable trade proposals can receive one bounded legal counteroffer.
- Bot-to-bot proposals are reviewed immediately; unanswered counteroffers expire at the next Turn.
- Trades and agreements preserve resources already committed to sealed Orders.
- Agreements and Technology exports are evaluated against containment, deterrence, cooperation, and Gate-support stances.

## Tactical and faction improvements

- Military planning can detach the smallest winning task force while retaining reserve forces for defense or a second operation.
- Threat maps respect active non-aggression and allied benefits.
- Varkesh and Farbound Homeworld production choices are selected from the current strategic reserve.
- Bot-controlled hosts grant appropriate Envoy and defensive hosting permissions when diplomacy supports them.
- Civilization-specific progress and faction actions are now included in the shared objective model.
- Colony Ships remain on valid settlement sites and prioritize establishing Habitats or replacing missing Modules.
- Order bundles pay reserve penalties once, account for production before Gate deadlines, and preserve resources required by Hidden objectives.
- Final-Era market support continues after a civilization's first Tribute.
- Era III Hidden card text and progress now match the existing LP scoring rules.

## Verification

- Added 0.29.0 objective, diplomacy, counteroffer, threat, and report tests.
- Self-play diagnostics now report Hidden completion, Civilization and Universal claims, contribution rate, counteroffers, invalid submissions, objective coverage, and faction LP balance.
- Diagnostics accept a profile, map, and player count; see `bots/README.md` for commands.
- The test runner executes individual test cases reliably across supported Node versions.
- See `docs/AI_VALIDATION_0.29.0.md` for measured results and remaining performance targets. This release implements the new strategic model; consistent expert-level play still requires further calibration, particularly for Hidden objectives and Standard Board Gate survival.
