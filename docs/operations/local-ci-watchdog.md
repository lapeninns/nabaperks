# Local CI GitHub watchdog

The operator selected GitHub Actions on 2026-09-05 instead of UptimeRobot or
Healthchecks. Standard hosted runners for this public repository are free.
No additional service account or App permission is required.

## Evidence and limitations

The real host poll loop creates a `Nabaperks Local CI heartbeat` check through
the pinned App and updates it every five minutes. Its permanent anchor is the
merged provisioning commit recorded in `agentLiveness.anchorSha`; ordinary
merges cannot make the heartbeat disappear. It does not attach a success check
to current PRs or prove VM health or successful job execution. Those still need
the regular local CI proof and nightly proof.

`agent-watchdog.yml` runs every five minutes, offset from the hour. It accepts
only successful, completed heartbeats with the configured name, App ID, App
slug and anchor SHA. Evidence over 20 minutes old or more than one minute in
the future fails. API and response failures fail closed. A separate job probes
the public production health endpoint. Neither job is a merge dependency.

GitHub schedules can be delayed or dropped, and this design cannot independently
detect a GitHub outage. Workflow notifications depend on the operator's GitHub
notification settings. A 20-minute age limit is not a guaranteed notification
deadline. The public probe does not supply an independent uptime ratio for
the future availability gate in cutover step 6.

## Activate and rehearse

1. Merge through the normal review and CI rules, build the merged job image,
   and install the merged host agent. Keep `LOCAL_CI_WATCHDOG_ENABLED` unset.
2. Verify a real heartbeat check from App ID `4839346` on the contract anchor.
   Wait for its next update. Do not create synthetic healthy check runs.
3. Enable Actions failure notifications in the scheduling operator's GitHub
   settings. Scheduled workflow notifications normally go to the user who last
   changed the cron expression. Verify receipt with the failure rehearsal;
   merely enabling a setting is not proof of delivery.
4. Set repository variable `LOCAL_CI_WATCHDOG_ENABLED=true` and dispatch
   `agent-watchdog.yml`. Both heartbeat and public health jobs must succeed.
   This variable activates monitoring only; it does not promote `LOCAL_CI_MODE`,
   the bridge, nightly proof or any merge dependency.
5. With no local job running, stop the LaunchAgent and leave the last real
   heartbeat untouched. After more than 20 minutes, dispatch the watchdog and
   also observe a scheduled run fail. Verify the operator receives the failure
   notification and record the actual delay. Never forge a stale timestamp.
6. Restart the agent, observe a new real heartbeat, and confirm the next
   watchdog succeeds. Record run URLs, App check ID and actual times in the
   provisioning evidence. Separately rehearse VM/job recovery before promotion.

Disable monitoring by deleting `LOCAL_CI_WATCHDOG_ENABLED`. This pauses the
watchdog without changing the local execution plane. The App key remains only
on the Mac. The watchdog uses its workflow token with `checks: read` and
`contents: read`; it has no App private key or permission to fabricate a beat.

Sources: [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[scheduled workflow limitations](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows),
[workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs),
and [Checks API](https://docs.github.com/en/rest/checks/runs).
