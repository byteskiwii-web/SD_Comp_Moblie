import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { File, Paths } from 'expo-file-system';
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
  | { type: 'error'; kind: string; message: string };

export function WebViewCameraCaptureScreen({ onCaptured, onCancel }: CameraCaptureProps) {
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

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: LivenessMessage;
      try {
        msg = JSON.parse(event.nativeEvent.data) as LivenessMessage;
      } catch {
        console.warn('[liveness] unparseable message', event.nativeEvent.data);
        return;
      }

      switch (msg.type) {
        case 'ready':
          setLoading(false);
          return;

        case 'status': {
          // Surfaced in the Metro log so a failing check can be diagnosed
          // without attaching a debugger to the WebView.
          console.log('[liveness] phase:', msg.phase);
          const label: Record<string, string> = {
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

        case 'error':
          console.warn(`[liveness] ${msg.kind}: ${msg.message}`);
          setLoading(false);
          return;
      }
    },
    [onCaptured, onCancel]
  );

  if (useFallback) {
    return <FallbackCameraCaptureScreen onCaptured={onCaptured} onCancel={onCancel} />;
  }

  return (
    <View style={styles.flex}>
      <WebView
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

      {loading && (
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
