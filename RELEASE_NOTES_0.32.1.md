# Horizon 0.32.1: Shattered Reach Usability

Version 0.32.1 is a focused faction-integrity and training-usability patch for the 0.32.0 closed-beta build.

## Salvo Bombardment

- Selecting an eligible Bombard Frigate or Siege Cruiser now exposes a direct Bombard action in the vessel controls.
- Bombardment enters the normal map target mode and highlights only legal hostile hexes.
- Players target a hex rather than a vessel or Combat Unit stack.
- Damage is allocated automatically to the force with the lowest CU count, then the lowest carrier capacity, then the slowest movement value.
- Automatic allocation is authoritative. A client cannot redirect damage by submitting a different target player.
- A force's final CU remains protected, the two-damage-per-hex limit remains active, and each Siege Tender may support only one range-two Bombardment per Turn.
- Ammunition costs are included in projected Order budgets.

## Aegis Blockade transactions

- The Orders panel clearly labels the existing free Blockade transfer as a gift.
- Diplomacy now contains Sell a Blockade, where an Aegis player chooses a platform, buyer, and resource price.
- Sales require an active agreement and buyer acceptance. The Blockade remains in its current hex and changes owner only after acceptance.
- Blockade sales cannot be countered as ordinary resource trades. A buyer may accept or reject and ask the Aegis player for revised terms.
- Bot buyers evaluate the defensive asset as part of the proposal rather than treating it as an empty offer.

## Horizon Academy

- All 33 faction exercises now provide three explicit, ordered interaction steps with panel names, control labels, target-selection instructions, and expected results.
- Hidden guidance can be restored with Show Academy Guide without resetting the exercise.
- Prepared positions now include the required specialist units, Technology, legal targets, agreements, structures, and open construction slots for their lesson.
- Salvo lessons stage legal adjacent and Siege Tender-supported targets.
- Aegis mastery stages an agreement and sale-ready Blockade.
- Spires mastery begins with a Metropolis ready to become an Arcology rather than an already-completed Arcology.
- Foundry Prospector, Wayfarer capacity, and Guild Factory or enhancement positions were corrected.

## Additional faction audit repairs

- Guild Order projection applies every queued permanent Labor reduction and rejects queues that would cross the Labor Capacity floor of 1.
- Resolved Guild enhancements update current Labor Capacity immediately.
- Regression coverage now verifies Bombardment priority, authoritative hex targeting, Siege Tender use limits, Blockade sales, Guild Labor planning, and Academy guide restoration.
