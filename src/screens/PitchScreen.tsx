import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PALETTE, FONT } from '../theme/theme';
import NeoCard from '../components/NeoCard';
import NeoButton from '../components/NeoButton';
import StickerBadge from '../components/StickerBadge';

interface Slide {
  tag: string;
  tagColor: string;
  title: string;
  bullets: string[];
  punch?: string;
}

const SLIDES: Slide[] = [
  {
    tag: 'THE HOOK',
    tagColor: PALETTE.yellow,
    title: 'We track everything except the ride we take every day',
    bullets: [
      'We track food delivery, Grab, even Shopee parcels to the minute.',
      'The jeepney? Millions of us still stand on the curb and guess.',
      'Is my ride 2 minutes away, or 30?',
    ],
    punch: 'I built BiyaHero to end the guessing.',
  },
  {
    tag: 'THE PROBLEM',
    tagColor: PALETTE.coral,
    title: 'The daily commute is a blind gamble',
    bullets: [
      '15–45 min wasted daily waiting blind in heat or rain.',
      'The capacity gamble: the jeep arrives packed (siksikan) or refusing riders.',
      'Extra friction for students and quiet commuters.',
      'Drivers burn fuel idling at empty stops.',
    ],
  },
  {
    tag: 'THE SOLUTION',
    tagColor: PALETTE.mint,
    title: 'Introducing BiyaHero',
    bullets: [
      'Two-way app linking waiting commuters and approaching drivers.',
      'Live GPS + stop-level ETA.',
      'Comfort & Seat Radar: Green / Yellow / Red before the jeep arrives.',
      'Zero-hardware hybrid: 1-tap driver mode + rider crowdsourcing.',
    ],
    punch: 'No expensive trackers. Runs on the phones people already have.',
  },
  {
    tag: 'WHY BIYAHERO',
    tagColor: PALETTE.blue,
    title: 'Why it beats the current way',
    bullets: [
      'Only option that shows comfort, not just location.',
      'Google Maps gives a static route; BiyaHero tells you if you get a seat.',
      'Beats blind waiting, static maps, and costly hardware fleets.',
      'User feedback: [ADD 3–5 real prototype reactions here].',
    ],
  },
  {
    tag: 'THE ASK',
    tagColor: PALETTE.purple,
    title: '₱500,000 to build & pilot BiyaHero',
    bullets: [
      'Development — ₱250,000',
      'UI/UX Design — ₱75,000',
      'Cloud / Infrastructure — ₱50,000',
      'Testing — ₱50,000',
      'Driver Onboarding Kits — ₱75,000',
    ],
    punch: 'Let’s make every commuter their own hero.',
  },
];

export default function PitchScreen() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const isAsk = i === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>Pitch Deck</Text>
          <StickerBadge label={`${i + 1} / ${SLIDES.length}`} color={PALETTE.cardBg} />
        </View>

        <NeoCard tag={`★ ${slide.tag}`} tagColor={slide.tagColor} style={styles.slide} offset={5}>
          <Text style={styles.title}>{slide.title}</Text>
          <View style={styles.bullets}>
            {slide.bullets.map((b, idx) => (
              <View key={idx} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: isAsk ? PALETTE.purple : slide.tagColor }]} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
          {slide.punch ? (
            <View style={[styles.punchBox, { backgroundColor: slide.tagColor }]}>
              <Text style={[styles.punchText, { color: isAsk || slide.tag === 'THE PROBLEM' ? '#FFFFFF' : PALETTE.border }]}>
                {slide.punch}
              </Text>
            </View>
          ) : null}
        </NeoCard>

        {/* dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, { backgroundColor: idx === i ? PALETTE.border : 'transparent' }]}
            />
          ))}
        </View>

        <View style={styles.nav}>
          <NeoButton
            label="Back"
            color={PALETTE.cardBg}
            onPress={() => setI((v) => Math.max(0, v - 1))}
            icon={<Ionicons name="chevron-back" size={18} color={PALETTE.border} />}
            style={styles.flex}
          />
          <NeoButton
            label={isAsk ? 'Restart' : 'Next'}
            color={PALETTE.yellow}
            onPress={() => setI((v) => (isAsk ? 0 : v + 1))}
            icon={<Ionicons name={isAsk ? 'refresh' : 'chevron-forward'} size={18} color={PALETTE.border} />}
            style={styles.flex}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { padding: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 28, fontWeight: FONT.black, color: PALETTE.text },
  slide: { backgroundColor: PALETTE.cardBg, minHeight: 340, marginTop: 4 },
  title: { fontSize: 22, fontWeight: FONT.black, color: PALETTE.text, marginBottom: 16, lineHeight: 28 },
  bullets: { gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: PALETTE.border, marginTop: 4 },
  bulletText: { flex: 1, fontSize: 15, fontWeight: FONT.semibold, color: PALETTE.text, lineHeight: 21 },
  punchBox: { marginTop: 18, borderWidth: 2.5, borderColor: PALETTE.border, borderRadius: 12, padding: 12 },
  punchText: { fontSize: 15, fontWeight: FONT.black, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 999, borderWidth: 2, borderColor: PALETTE.border },
  nav: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
