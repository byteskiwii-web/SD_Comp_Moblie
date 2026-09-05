import Constants, { ExecutionEnvironment } from 'expo-constants';

// Expo Go ships a fixed native runtime, so anything backed by custom native
// code -- VisionCamera, the Nitro face detector, background location -- simply
// isn't in that binary. Importing such a module there throws at evaluation
// time, which red-screens the app before the first render. Screens that depend
// on one must branch on this flag and require() the fallback instead, so the
// native module is never touched inside Expo Go.
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
