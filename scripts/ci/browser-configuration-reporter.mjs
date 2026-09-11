import { captureBrowserConfiguration } from "./browser-configuration.mjs"

// Playwright's JSON reporter omits FullProject.use. Capture the resolved
// options in shared report metadata before that reporter serialises them.
export default class BrowserConfigurationReporter {
  onBegin(config) {
    config.metadata.nabaperksBrowserConfiguration =
      captureBrowserConfiguration(config)
  }

  printsToStdio() {
    return false
  }
}
