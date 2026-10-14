# Launch copy and starter issues

## Draft announcement

> HoldMyBeer is an experimental local plugin/skill project for teaching workflows to the agent you already use. Record a task, let your connected agent inspect timestamped frames and propose questions/actions, then review a fresh-input browser trial. The current runner is limited to a bundled draft fixture. We need independent client installation tests, accessibility checks and a real workflow beyond that fixture. Nothing here publishes to social accounts. https://github.com/wspotter/HoldMyBeer

This is draft copy. Verify the repository URL and current preview behavior before posting it anywhere.

## Starter issue 1: Recorder permission guidance

**Title:** Explain browser screen-capture permissions and recorder states

**Body:**

The preview can capture a selected browser tab after the user chooses to start, but first-time browser permission prompts can be surprising. Please document what the person sees, how to start and stop capture, and how to tell whether a recording was retained. Keep the instructions browser-neutral where possible and avoid requesting broader screen access than needed. Do not attach personal recordings.

## Starter issue 2: Fixture workflow example

**Title:** Add a clear example procedure for the bundled fixture

**Body:**

Write a short example for the bundled test app that names the goal of each step and an observable check. Use fictional captions and filenames. The example should make clear that the saved item is a fixture draft, not a social post. Add it to the docs or skill guidance and include a reviewer-friendly reproduction path.

## Starter issue 3: Failure messages

**Title:** Make bundled-runner failures easier to understand

**Body:**

Review the messages shown when a fixture step fails or needs teaching. Suggest plain wording that identifies the failed check, the evidence available, and a useful next question for the person. Keep observed facts separate from guesses; do not imply AI diagnosis.

## Starter issue 4: Keyboard accessibility review

**Title:** Review the teaching interface with keyboard-only navigation

**Body:**

Try the teaching interface using only a keyboard. Record the page and control where focus becomes unclear, trapped, or unavailable, and describe the expected interaction. Please do not include personal data or screenshots containing private information. A concise text reproduction is enough.

## Starter issue 5: Hermes compatibility evidence

**Title:** Verify the read-only Hermes scaffold against a documented version

**Body:**

The current Hermes integration is an opt-in scaffold that registers only `hmb_status`, a read-only request to the configured loopback preview. Verify import and tool registration against a specific Hermes release or commit. Report the version, sanitized command/output, and whether the status request succeeds with the preview running. Do not enable it in a production agent or expose the preview to the network.
