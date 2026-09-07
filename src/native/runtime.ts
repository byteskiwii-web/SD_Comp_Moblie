import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Which capabilities the *current binary* actually has. Expo Go ships a fixed
// native runtime, so anything backed by a third-party native module --
// VisionCamera, the Nitro face detector, background location -- simply isn't
// in it. Importing such a module there throws at module-evaluation time, which
// red-screens the app before the first render, so a runtime check inside a
// component is already too late: the branch has to decide whether the import
// is ever reached at all.
export const isWeb = Platform.OS === 'web';
// StoreClient is the Expo Go app itself; a dev/standalone build reports Bare.
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const hasVisionCamera = !isWeb && !isExpoGo;
export const supportsBackgroundLocation = !isWeb && !isExpoGo;
/**
 * modules/shift-timer is a local Expo module with an android/ directory and
 * nothing else -- there is no iOS implementation. So it is missing from Expo
 * Go on every platform AND from any iOS build, dev client included, and
 * importing it throws "Cannot find native module ShiftTimer" at module
 * evaluation, before anything renders.
 */
export const hasShiftTimer = !isWeb && !isExpoGo && Platform.OS === 'android';

export const runtimeLabel = isWeb ? 'web' : isExpoGo ? 'Expo Go' : 'development build';
