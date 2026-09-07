// Web build only. Metro resolves platform extensions before the bare name, so
// on web this file replaces the dispatcher entirely -- which means the
// dispatcher's require('./CameraCaptureScreen.vision') is never even parsed
// into the web bundle, and VisionCamera / Nitro stay out of the module graph.
// (react-native-vision-camera has no web implementation at all, so bundling it
// would fail outright rather than merely shipping dead bytes.)
export { FallbackCameraCaptureScreen as CameraCaptureScreen } from './CameraCaptureScreen.fallback';
