import { dbUrl } from "./db.mjs"

// Runs before test discovery. A configured non-local target must fail here,
// before any test module can create a client or write a fixture.
dbUrl()
