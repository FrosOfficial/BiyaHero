import { ViewStyle } from 'react-native';

// BiyaHero - Neo-Brutalist Manila Pop design tokens
export const PALETTE = {
  // Retro Manila Pop (light canvas)
  bg: '#FAF6ED', // Cream paper canvas background
  cardBg: '#FFFFFF', // Crisp white card fill
  border: '#18181B', // Deep charcoal black border
  text: '#18181B', // High-contrast primary text
  textMuted: '#52525B', // Subtitle / muted text
  yellow: '#FFC700', // Manila jeepney canary gold (primary action)
  coral: '#FF4757', // Alert red / Sabit capacity / Stop
  mint: '#00D2A0', // Vibrant mint green / Chill seats / Boarding
  blue: '#3A86FF', // Electric Dodger blue / Active route line
  purple: '#8338EC', // Audience / Persona tag purple
  orange: '#FF7A00', // Traffic congestion orange

  // Dark Tech Mode (from PPTX deck)
  darkBg: '#0F172A',
  darkCard: '#1E293B',
  darkBorder: '#334155',
  darkAmber: '#F59E0B',
  darkCyan: '#38BDF8',
  darkEmerald: '#34D399',
  darkRose: '#FB7185',
  darkText: '#F8FAFC',
  darkTextMuted: '#94A3B8',
};

// Hard offset shadow generator (authentic neo-brutalism, iOS + Android)
export const neoShadow = (offset: number = 4): ViewStyle => ({
  shadowColor: '#18181B',
  shadowOffset: { width: offset, height: offset },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: offset,
});

export const FONT = {
  black: '900' as const,
  bold: '700' as const,
  semibold: '600' as const,
  regular: '400' as const,
};
