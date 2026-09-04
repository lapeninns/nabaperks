-- The mandatory-MFA contract was withdrawn by product decision before it was
-- promoted to production. Keep this already-published migration version as a
-- non-blocking ledger step. The final accepted single-factor authority policy
-- is installed by the later forward-only convergence migration so databases
-- that already recorded this version reach the same state.

notify pgrst, 'reload schema';
