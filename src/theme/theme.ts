import { ViewStyle } from 'react-native';

// BiyaHero design tokens — clean transit style: soft cards, light lines,
// medium-weight type, generous air. Manila Pop accent colors kept.
export const PALETTE = {
  bg: '#F3F4F6', // soft light-grey canvas
  cardBg: '#FFFFFF', // white card
  card2: '#F7F8FA', // faint inset panel (steppers, chips)
  border: '#E6E7EB', // soft hairline (borders only, not text)
  text: '#1C1D21', // primary text
  textMuted: '#8A8F99', // secondary text
  yellow: '#FFC53D', // jeepney gold (primary action)
  coral: '#FF5A5F', // alert / sabit / stop
  mint: '#12B886', // chill seats / boarding / go
  blue: '#3A86FF', // route line / info
  purple: '#845EF7', // accent / persona
  orange: '#FF922B', // traffic

  // Dark Tech Mode (from PPTX deck) — unused by the app UI, kept for reference
  darkBg: '#0F172A',
  darkCard: '#1E293B',
  darkBorder: '#334155',
  darkText: '#F8FAFC',
  darkTextMuted: '#94A3B8',
};

// Soft elevation shadow (replaces the old hard-offset brutalist shadow).
// Same name so existing callers keep working; `n` is a rough elevation.
export const neoShadow = (n: number = 2): ViewStyle => ({
  shadowColor: '#0B1220',
  shadowOffset: { width: 0, height: Math.max(1, Math.round(n / 2)) },
  shadowOpacity: 0.07,
  shadowRadius: n + 4,
  elevation: Math.max(1, Math.round(n / 2)),
});

// Weights: lighter than before. `black` is now a semibold-ish 700, not 900.
export const FONT = {
  black: '700' as const,
  bold: '600' as const,
  semibold: '500' as const,
  medium: '500' as const,
  regular: '400' as const,
};

export const RADIUS = { sm: 10, md: 14, lg: 18, pill: 999 };
