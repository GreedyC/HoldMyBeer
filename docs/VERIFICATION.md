# Preview evidence — October 14, 2026

This is a working local prototype, not the completed AI teaching product.

| Check                | Observed result                                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Normal fixture trial | Real Chromium upload/fill/save; retained draft ID retrieved successfully                                              |
| Changed button       | Trial stopped with `needs_teaching`; no draft was created by the stopped step                                         |
| Reviewed repair      | Exact `Store draft` locator selected; new caption saved and retained                                                  |
| Media import         | Three-second explicitly labeled transport-test WebM decoded, duration 3 seconds, readyState 4                         |
| Timestamp note       | Retained after save and page reload                                                                                   |
| Teaching answers     | Retained after save and page reload                                                                                   |
| Trial history        | Normal, stopped and repaired attempts selectable in the interface                                                     |
| Mobile layout        | 390px viewport checked; no horizontal document overflow                                                               |
| Browser console      | No errors in the tested workspace flow                                                                                |
| Backend tests        | 3 passed, including persistence, validation, upload preservation, origin rejection, and all three real browser paths  |
| Hermes scaffold      | Read-only tool registration stub and real loopback status request passed; not loaded into a production Hermes profile |

Local browser evidence used installed Playwright 1.62 with its matching Chromium. A separate environment initially resolved a newer Playwright expecting a different browser revision. Use `python3 -m playwright install chromium` from your activated environment; do not reuse a browser cache without checking compatibility. CI installs a matching browser before tests.

The screen picker itself has not been manually exercised in this environment. The imported clip is a media-transport test, not a recorded workflow. Automatic visual questions, procedure compilation and arbitrary-app replay remain future work.
