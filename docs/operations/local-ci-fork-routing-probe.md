# Temporary fork-routing proof

This branch is a runtime probe for the local CI qualification ledger. It carries
one documentation-only change on top of the reliability candidate so that the
fork has a unique head SHA, distinct from the internal qualification heads.

The expected result is hosted execution with the Local CI proof bridge skipped,
and no local agent job or App check for this fork-owned head. This temporary
probe is not intended to merge. Record its real provider and host observations
in the qualification ledger before closing it.
