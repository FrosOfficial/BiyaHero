import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { PALETTE, FONT } from '../theme/theme';
import { Jeepney, Stop } from '../data/corridorData';
import { levelFromRatio } from './StatusMeterPill';

interface CorridorMapProps {
  stops: Stop[];
  jeeps: Jeepney[];
  height?: number;
}

const capColor = (ratio: number) => {
  const level = levelFromRatio(ratio);
  if (level === 'sabit') return PALETTE.coral;
  if (level === 'squeezed') return PALETTE.yellow;
  return PALETTE.mint;
};

export default function CorridorMap({ stops, jeeps, height = 360 }: CorridorMapProps) {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  const n = ordered.length;
  const padTop = 24;
  const padBottom = 24;
  const usable = height - padTop - padBottom;
  const stepY = usable / (n - 1);
  const laneX = 46;

  const yForOrder = (order: number) => padTop + (order - 1) * stepY;

  const jeepY = (j: Jeepney): number => {
    const cur = ordered.find((s) => s.id === j.currentStopId);
    const nxt = ordered.find((s) => s.id === j.nextStopId);
    if (!cur || !nxt) return padTop;
    // eta small => near next stop. assume a leg starts around eta 6.
    const frac = Math.min(1, Math.max(0, 1 - j.etaMinutes / 6));
    const y1 = yForOrder(cur.order);
    const y2 = yForOrder(nxt.order);
    return y1 + (y2 - y1) * frac;
  };

  return (
    <View>
      <Svg width="100%" height={height}>
        {/* route line */}
        <Line
          x1={laneX}
          y1={yForOrder(1)}
          x2={laneX}
          y2={yForOrder(n)}
          stroke={PALETTE.blue}
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* stops */}
        {ordered.map((s) => {
          const y = yForOrder(s.order);
          return (
            <G key={s.id}>
              <Circle cx={laneX} cy={y} r={9} fill={PALETTE.cardBg} stroke={PALETTE.border} strokeWidth={2.5} />
              <Circle cx={laneX} cy={y} r={3.5} fill={PALETTE.border} />
              {/* waiting-count badge */}
              <Rect
                x={laneX - 40}
                y={y - 10}
                width={22}
                height={20}
                rx={5}
                fill={PALETTE.purple}
                stroke={PALETTE.border}
                strokeWidth={1.5}
              />
              <SvgText
                x={laneX - 29}
                y={y + 4}
                fill="#FFFFFF"
                fontSize={10}
                fontWeight="bold"
                textAnchor="middle"
              >
                {s.commutersWaiting}
              </SvgText>
              <SvgText x={laneX + 20} y={y + 4} fill={PALETTE.text} fontSize={12} fontWeight="bold">
                {s.short}
              </SvgText>
            </G>
          );
        })}
        {/* jeep markers */}
        {jeeps.map((j) => {
          const y = jeepY(j);
          const color = capColor(j.capacityCount / j.maxCapacity);
          return (
            <G key={j.id}>
              <Rect
                x={laneX - 10}
                y={y - 8}
                width={20}
                height={16}
                rx={4}
                fill={color}
                stroke={PALETTE.border}
                strokeWidth={2}
              />
              <SvgText x={laneX + 150} y={y + 4} fill={PALETTE.textMuted} fontSize={10} fontWeight="bold">
                {j.plateNumber} · {j.etaMinutes}m
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={styles.legend}>
        <LegendDot color={PALETTE.mint} label="Chill" />
        <LegendDot color={PALETTE.yellow} label="Squeezed" />
        <LegendDot color={PALETTE.coral} label="Sabit" />
        <LegendDot color={PALETTE.purple} label="Waiting" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: PALETTE.border },
  legendText: { fontSize: 11, fontWeight: FONT.bold, color: PALETTE.text },
});
