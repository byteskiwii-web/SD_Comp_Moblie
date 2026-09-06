import { registerRootComponent } from 'expo';

// Module-scope side effects that must exist in a headless (no-Activity) JS
// context too, not only when App.tsx renders -- see
// registerShiftTimerTask.ts's comment. ES imports evaluate in source order,
// so these run before App is imported below.
import './src/utils/notificationSetup';
import './src/tasks/registerShiftTimerTask';
import { stopLegacyLocationTask } from './src/utils/legacyTaskCleanup';

import App from './App';

stopLegacyLocationTask();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
