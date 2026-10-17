# Horizon 0.32.4: Academy and Arcology Polish

Version 0.32.4 resolves two late closed-beta usability issues in Horizon Academy and the Spires construction path.

## Horizon Academy guide

- Guide controls now use a contained two-column grid instead of a flexible row that could overflow the panel.
- Labels are shortened to `Restart`, `Skip`, `Enter practice`, and `Hide guide`, with full accessible descriptions retained.
- The guide now scrolls within the available mobile viewport.
- Its action grid stays attached to the bottom of the guide while the instructions scroll.

## Spires Arcology

- A Spires-controlled Metropolis now replaces its normal Habitat Upgrade option with `Habitat Upgrade: Arcology` in the Infrastructure section.
- The upgrade requires Resource IV and costs 4 Material, 4 Currency, and 3 Labor.
- Arcology is no longer buried in a separate Shattered Reach construction group.
- Non-Spires factions remain unable to issue an Arcology construction Order, including through direct command submission.

## Verification

Regression coverage confirms that the Spires mastery exercise stages a legal Arcology upgrade, that the build interface exposes it in the normal Habitat Upgrade position, and that non-Spires Arcology attempts remain invalid.
