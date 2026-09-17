import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
import { useCameraPermissions } from 'expo-camera';
import { Button } from '../../components/ui';
import { useT } from '../../i18n';
import { radii } from '../../theme/tokens';
import { API_BASE_URL } from '../../constants/config';
import { LIVENESS_HTML, livenessStringsScript } from './liveness/livenessPage';
import { FallbackCameraCaptureScreen } from './CameraCaptureScreen.fallback';
import type { CameraCaptureProps } from './cameraCaptureTypes';

// Real liveness inside Expo Go: the detection runs in a WebView, because a
// browser engine is one of the few capable runtimes Expo Go's binary actually
// ships. See liveness/livenessPage.ts for why this shape is necessary.
//
// Point EXPO_PUBLIC_LIVENESS_URL at a hosted copy of that page to load it over
// the network instead -- preferable in production, since the page can then be
// updated without shipping a JS bundle, and it keeps the origin honest.
const LIVENESS_URL = process.env.EXPO_PUBLIC_LIVENESS_URL;

// getUserMedia only runs in a secure context, and WKWebView takes the document
// origin from baseUrl. The API origin is the natural choice when it is https;
// https://localhost is the fallback because localhost counts as secure too,
// which keeps a plain-http dev API from silently disabling the camera.
const SECURE_BASE_URL = API_BASE_URL.startsWith('https://') ? API_BASE_URL : 'https://localhost';

type LivenessMessage =
  | { type: 'ready' }
  | { type: 'status'; phase: string }
  | { type: 'captured'; base64: string; width: number; height: number }
  | { type: 'cancel' }
  | { type: 'fallback' }
  // The page's own bootstrap asks for this when its engine never started:
  // reloading the document in place would navigate to its base URL.
  | { type: 'retry' }
  | { type: 'error'; kind: string; message: string };

/**
 * How long the page may stay completely silent.
 *
 * Its bootstrap posts "page-loaded" as the first thing it does, so silence
 * past this means the document itself never ran -- the WebView failed to load
 * it at all. Everything after that point the page times for itself.
 */
const PAGE_SILENCE_MS = 20_000;

export function WebViewCameraCaptureScreen({ onCaptured, onCancel }: CameraCaptureProps) {
  const t = useT();
  /*
   * THE PAGE CANNOT GRANT ITSELF A PERMISSION THE APP DOES NOT HOLD.
   *
   * getUserMedia inside the WebView is granted by the host app, not by the
   * document: on Android react-native-webview answers the page's
   * onPermissionRequest from the permissions the APP holds, and on iOS
   * mediaCapturePermissionGrantType="grant" skips WKWebView's own prompt --
   * which also means it never triggers the OS one. Either way, if nothing has
   * requested CAMERA at runtime the page's request is denied outright and the
   * only symptom is NotAllowedError from deep inside the detector, long after
   * the model has loaded.
   *
   * This screen used to assume Expo Go already held it. Nothing on this path
   * ever asked -- the VisionCamera and fallback screens both do, but neither
   * of them runs here -- so the check failed on a clean install every time.
   * Asking before the WebView mounts is what makes the grant real, and the
   * WebView must stay unmounted until then: mounting it fires getUserMedia
   * immediately, spending the one request the page gets.
   */
  const [permission, requestPermission] = useCameraPermissions();
  const askedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  // What the page is actually doing. A single "starting…" for the whole boot
  // is indistinguishable from a hang, and on older hardware the model load is
  // genuinely slow rather than broken.
  const [stage, setStage] = useState('Starting liveness check…');
  // Set when the page reports it cannot run at all (camera blocked, model
  // failed to load) and the reviewer chose to carry on anyway. Swapping to the
  // plain expo-camera screen keeps the punch flow reachable rather than
  // stranding them on an error page.
  const [useFallback, setUseFallback] = useState(false);
  const handledRef = useRef(false);
  // Bumped to rebuild the WebView from scratch on "Try again".
  const [attempt, setAttempt] = useState(0);
  const [heard, setHeard] = useState(false);
  const [silent, setSilent] = useState(false);

  const retry = useCallback(() => {
    handledRef.current = false;
    setHeard(false);
    setSilent(false);
    setStage('Starting liveness check…');
    setLoading(true);
    setAttempt((a) => a + 1);
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: LivenessMessage;
      try {
        msg = JSON.parse(event.nativeEvent.data) as LivenessMessage;
      } catch {
        console.warn('[liveness] unparseable message', event.nativeEvent.data);
        return;
      }
      setHeard(true);

      switch (msg.type) {
        case 'ready':
          setLoading(false);
          return;

        case 'status': {
          // Surfaced in the Metro log so a failing check can be diagnosed
          // without attaching a debugger to the WebView.
          console.log('[liveness] phase:', msg.phase);
          const label: Record<string, string> = {
            'page-loaded': 'Starting the camera…',
            'engine-mirror': 'Trying another server for the face check…',
            'camera-ready': 'Loading the face model…',
            'loading-model': 'Loading the face model…',
            'gpu-unavailable-using-cpu': 'This device needs the slower check — one moment…',
          };
          if (label[msg.phase]) setStage(label[msg.phase]);
          return;
        }

        case 'captured': {
          if (handledRef.current) return;
          handledRef.current = true;
          try {
            // The punch upload wants a file path, not a data URL: on native,
            // buildPunchFormData sends React Native's {uri,name,type} multipart
            // shape, which has to reference something on disk.
            const file = new File(Paths.cache, `selfie_${Date.now()}.jpg`);
            file.create({ overwrite: true });
            file.write(msg.base64, { encoding: 'base64' });
            onCaptured(file.uri);
          } catch (err) {
            console.warn('[liveness] could not save the captured frame', err);
            handledRef.current = false;
          }
          return;
        }

        case 'fallback':
          setLoading(false);
          setUseFallback(true);
          return;

        case 'cancel':
          onCancel();
          return;

        case 'retry':
          retry();
          return;

        case 'error':
          console.warn(`[liveness] ${msg.kind}: ${msg.message}`);
          setLoading(false);
          return;
      }
    },
    [onCaptured, onCancel, retry]
  );

  /*
   * NOTHING HEARD AT ALL.
   *
   * "Starting liveness check…" used to be shown for as long as the page said
   * nothing, which on a phone that could not run the page was forever. The page
   * now reports and times its own failures, so silence this long means it
   * never ran -- and the employee gets the same three ways out the page would
   * have offered, instead of a spinner.
   */
  useEffect(() => {
    if (heard || !permission?.granted || useFallback) return;
    const id = setTimeout(() => {
      console.warn('[liveness] the page never reported in');
      setSilent(true);
    }, PAGE_SILENCE_MS);
    return () => clearTimeout(id);
  }, [heard, attempt, permission?.granted, useFallback]);

  /*
   * Once only, and never after a refusal: re-requesting a denied permission
   * is a no-op on Android and re-prompts forever on iOS. The button below is
   * the deliberate second ask.
   */
  useEffect(() => {
    if (askedRef.current) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      askedRef.current = true;
      void requestPermission();
    }
  }, [permission, requestPermission]);

  if (useFallback) {
    return <FallbackCameraCaptureScreen onCaptured={onCaptured} onCancel={onCancel} />;
  }

  // null while the hook resolves -- not the same as denied, and showing the
  // refusal copy in that gap would be a lie for one frame.
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          {permission.canAskAgain ? t('camera.needed') : t('camera.denied')}
        </Text>
        {permission.canAskAgain && (
          <Button title={t('camera.grant')} onPress={requestPermission} />
        )}
        <Button title={t('common.cancel')} variant="outline" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <WebView
        key={attempt}
        style={styles.flex}
        source={LIVENESS_URL ? { uri: LIVENESS_URL } : { html: LIVENESS_HTML, baseUrl: SECURE_BASE_URL }}
        // The employee's language, handed to the document BEFORE it loads.
        // The page cannot call a React hook, and when LIVENESS_URL points at a
        // hosted copy there is no string here to interpolate into either -- so
        // injection is the one route that works for both sources.
        injectedJavaScriptBeforeContentLoaded={livenessStringsScript()}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        // Without this iOS punts the camera preview into a fullscreen player
        // and the overlay canvas is never seen.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Expo Go already holds the OS camera permission, so re-prompting
        // inside the WebView would ask the same question twice.
        mediaCapturePermissionGrantType="grant"
        allowsProtectedMedia
        setSupportMultipleWindows={false}
        onError={(e) => console.warn('[liveness] webview error', e.nativeEvent)}
        onHttpError={(e) => console.warn('[liveness] webview http error', e.nativeEvent)}
      />

      {silent ? (
        <View style={styles.loading}>
          <Text style={styles.failTitle}>{t('live.modelFailTitle')}</Text>
          <Text style={styles.failBody}>{t('live.modelFailBody')}</Text>
          <Text style={styles.failDetail}>The check's page did not load.</Text>
          <View style={styles.failActions}>
            <Button title={t('common.retry')} onPress={retry} />
            <Button title={t('live.continueWithout')} variant="outline" onPress={() => setUseFallback(true)} />
            <Button title={t('common.cancel')} variant="outline" onPress={onCancel} />
          </View>
        </View>
      ) : loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#FFFFFF" size="large" />
          <Text style={styles.loadingText}>{stage}</Text>
          {/* Always reachable. The page can take a while on older hardware,
              and waiting with no way out is worse than giving up. */}
          <Pressable onPress={onCancel} hitSlop={10} style={styles.loadingCancel}>
            <Text style={styles.loadingCancelText}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Fixed colors, not read from useThemeStore: this is a camera overlay, not a
// themed app surface, and stays visually identical regardless of the app's
// light/dark setting -- same reasoning as CameraCaptureScreen.vision/.fallback.
const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#0F172A',
  },
  permissionText: { color: '#FFFFFF', fontSize: 12.5, textAlign: 'center', marginBottom: 8 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#0B0F1A',
  },
  loadingCancel: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 10 },
  failTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center', paddingHorizontal: 26 },
  failBody: { color: 'rgba(255,255,255,0.75)', fontSize: 13.5, lineHeight: 20, textAlign: 'center', paddingHorizontal: 26 },
  failDetail: { color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'center', paddingHorizontal: 26 },
  failActions: { alignSelf: 'stretch', gap: 10, paddingHorizontal: 26, marginTop: 8 },
  loadingCancelText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', opacity: 0.9 },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
