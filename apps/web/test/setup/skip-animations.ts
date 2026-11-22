import { MotionGlobalConfig } from 'framer-motion';

// The DOM of the tests cannot run the browser's animations. A popup that is cancelled half-way (the test ends, or the popup closes while it
// is still fading in) would reject a promise nobody waits for and every such test run would end with "unhandled errors", so the fades
// are skipped: a popup is simply there, or gone.
MotionGlobalConfig.skipAnimations = true;
