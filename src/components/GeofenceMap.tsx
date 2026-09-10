import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ColorScheme, radii } from '../theme/tokens';
import { useThemeStore } from '../stores/themeStore';
import { useT } from '../i18n';

/**
 * Where you are, relative to the fence you have to be inside.
 *
 * DRAWN, NOT A MAP TILE. The design this comes from shows a street map with a
 * dashed circle over it — and that map, in the mockup itself, is a Google
 * Static Maps image stamped "API KEY REQUIRED" across every tile. It never
 * loaded. Shipping it would mean a billed key, a network round trip on the one
 * screen people open in a hurry with bad signal, and a grey box wherever
 * either failed.
 *
 * `react-native-maps` is the other route and is not an option: it is not in
 * Expo Go, which is how this app is distributed.
 *
 * So the fence is drawn from the numbers we already have. It answers the two
 * questions the street map was there to answer — am I inside, and how far off
 * — and it answers them offline, instantly, with no key. What it gives up is
 * the streets, which were decoration: nobody checks the road layout to decide
 * whether to punch.
 *
 * The employee's dot sits at the TRUE bearing from the site, so "I'm north of
 * the shop" reads correctly. Distance is linear inside the fence, where
 * precision matters, and compressed outside it, where only the fact of being
 * out does.
 */
export function GeofenceMap({
  distanceMetres,
  radiusMetres,
  bearingDegrees,
  inside,
  siteName,
  height = 190,
}: {
  /** Metres from the site. Null while no fix has arrived. */
  distanceMetres: number | null;
  radiusMetres: number;
  /** 0 = due north of the site, clockwise. Null when it cannot be computed. */
  bearingDegrees: number | null;
  inside: boolean;
  siteName: string;
  height?: number;
}) {
  const colors = useThemeStore((s) => s.colors);
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const t = useT();

  // A square viewBox keeps the circle a circle at any card width.
  const SIZE = 220;
  const C = SIZE / 2;
  const OUTER = SIZE / 2 - 12;
  const FENCE = OUTER * 0.6;

  const tint = inside ? colors.success : colors.warning;

  /**
   * Metres to pixels.
   *
   * Linear inside the fence: half way to the boundary looks half way, which is
   * the part somebody reads carefully when they are close to the edge.
   *
   * Outside it, an asymptote. A linear scale would put an employee 2 km away
   * far off the card, and rescaling the whole drawing to fit them would shrink
   * the fence to a dot and lose the only detail that matters. This keeps the
   * fence the same size always, and places anyone outside in the band beyond
   * it — further is still further, but it never leaves the frame.
   */
  const toPixels = (metres: number): number => {
    if (radiusMetres <= 0) return FENCE;
    if (metres <= radiusMetres) return (metres / radiusMetres) * FENCE;
    const over = (metres - radiusMetres) / radiusMetres;
    return FENCE + (OUTER - FENCE) * (over / (over + 1));
  };

  const hasFix = distanceMetres != null;
  const r = hasFix ? toPixels(distanceMetres) : 0;
  // Bearing is clockwise from north; screen y grows downward, hence the minus.
  const rad = ((bearingDegrees ?? 0) - 90) * (Math.PI / 180);
  const x = C + r * Math.cos(rad);
  const y = C + r * Math.sin(rad);

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <RadialGradient id="fenceFill" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.16} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0.03} />
          </RadialGradient>
        </Defs>

        {/* Two faint rings outside the fence. They are what stops the drawing
            reading as a single flat blob, and they give the dot something to
            be positioned AGAINST when it is out of bounds. */}
        <Circle cx={C} cy={C} r={OUTER} stroke={colors.slate200} strokeWidth={1} fill="none" />
        <Circle
          cx={C}
          cy={C}
          r={(OUTER + FENCE) / 2}
          stroke={colors.slate200}
          strokeWidth={1}
          strokeDasharray="2 6"
          fill="none"
        />

        {/* North, so the bearing means something. A compass rose would be
            decoration; one letter is the whole of what is needed. */}
        <Line x1={C} y1={C - OUTER} x2={C} y2={C - OUTER + 7} stroke={colors.slate300} strokeWidth={1.5} />
        <SvgText
          x={C}
          y={C - OUTER - 3}
          fill={colors.slate400}
          fontSize={9}
          fontWeight="700"
          textAnchor="middle"
        >
          N
        </SvgText>

        {/* The fence itself: filled so "inside" reads as a place, dashed so it
            reads as a boundary rather than an object. */}
        <Circle cx={C} cy={C} r={FENCE} fill="url(#fenceFill)" />
        <Circle
          cx={C}
          cy={C}
          r={FENCE}
          stroke={tint}
          strokeWidth={2}
          strokeDasharray="6 5"
          fill="none"
        />

        {/* The site, at the centre, as a pin rather than another dot -- two
            dots of different colours would need a legend to tell apart. */}
        <G>
          <Circle cx={C} cy={C} r={11} fill={colors.surface} />
          <Circle cx={C} cy={C} r={11} stroke={colors.brand[700]} strokeWidth={2} fill={colors.surface} />
          <Path
            d={`M ${C} ${C - 5} c -2.6 0 -4.6 2 -4.6 4.5 0 3.3 4.6 8 4.6 8 s 4.6 -4.7 4.6 -8 c 0 -2.5 -2 -4.5 -4.6 -4.5 z`}
            fill={colors.brand[700]}
          />
        </G>

        {hasFix && (
          <>
            {/* The line is the distance, made visible. Without it the dot is
                just somewhere on the card. */}
            <Line x1={C} y1={C} x2={x} y2={y} stroke={tint} strokeWidth={1.5} strokeDasharray="3 4" />
            <Circle cx={x} cy={y} r={9} fill={tint} fillOpacity={0.22} />
            <Circle cx={x} cy={y} r={5} fill={tint} stroke={colors.surface} strokeWidth={2} />
          </>
        )}
      </Svg>

      {/* Labels sit outside the SVG so they take the app's font and scale with
          the reader's text size, which SvgText does not. */}
      <View style={styles.siteChip}>
        <Ionicons name="location" size={11} color={colors.brand[700]} />
        <Text style={styles.siteChipText} numberOfLines={1}>
          {siteName}
        </Text>
      </View>

      <View style={styles.scaleChip}>
        <Text style={styles.scaleText}>
          {t('map.fenceRadius', { metres: radiusMetres })}
        </Text>
      </View>

      {!hasFix && (
        <View style={styles.waiting}>
          <Text style={styles.waitingText}>{t('map.locating')}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Initial bearing from the site to the employee, degrees clockwise from north.
 *
 * The great-circle formula rather than a flat-earth atan2 of the deltas: at
 * Indian latitudes a degree of longitude is about 10% shorter than a degree of
 * latitude, so treating them as equal would swing the dot noticeably off true
 * for exactly the east-west offsets a high street produces.
 */
export function bearingBetween(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLon = toRad(toLng - fromLng);
  const y = Math.sin(dLon) * Math.cos(toRad(toLat));
  const x =
    Math.cos(toRad(fromLat)) * Math.sin(toRad(toLat)) -
    Math.sin(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.cos(dLon);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: {
      borderRadius: radii.lg,
      backgroundColor: colors.slate50,
      borderWidth: 1,
      borderColor: colors.slate100,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    siteChip: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '62%',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate200,
    },
    siteChipText: { fontSize: 10.5, fontWeight: '700', color: colors.textLight, flexShrink: 1 },

    scaleChip: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate200,
    },
    scaleText: { fontSize: 10, fontWeight: '600', color: colors.slate500 },

    waiting: {
      position: 'absolute',
      top: 10,
      alignSelf: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.slate200,
    },
    waitingText: { fontSize: 10.5, fontWeight: '600', color: colors.slate500 },
  });
