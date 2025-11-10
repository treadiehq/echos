<script setup lang="ts">
const props = defineProps<{ steps: any[]; activeAgent?: string | null }>();

const steps = computed(() => props.steps || []);

const agents = computed(() => Array.from(new Set(steps.value.map((s) => s.agent))));

const loopCounts = computed(() => {
  const map: Record<string, number> = {};
  steps.value.forEach((s) => {
    map[s.agent] = (map[s.agent] || 0) + 1;
  });
  return map;
});

const edges = computed(() => {
  const map = new Map<string, { from: string; to: string; count: number; self: boolean }>();
  for (let i = 0; i < steps.value.length - 1; i++) {
    const from = steps.value[i].agent;
    const to = steps.value[i + 1].agent;
    const key = from === to ? `${from}::self` : `${from}->${to}`;
    if (!map.has(key)) {
      map.set(key, { from, to, count: 0, self: from === to });
    }
    map.get(key)!.count += 1;
  }
  return Array.from(map.values());
});

const width = 960;
const height = 360;
const nodeRadius = 46;
const uid = `graph-${Math.random().toString(36).slice(2, 8)}`;

const positions = computed(() => {
  const list = agents.value;
  if (!list.length) return {};

  const centerX = width / 2;
  const centerY = height / 2 + 8;

  if (list.length === 1) {
    return { [list[0]]: { x: centerX, y: centerY } };
  }

  if (list.length === 2) {
    return {
      [list[0]]: { x: centerX - 200, y: centerY },
      [list[1]]: { x: centerX + 200, y: centerY }
    };
  }

  const radius = Math.min(width, height) / 2 - 100;
  const angleStep = (Math.PI * 2) / list.length;

  return Object.fromEntries(
    list.map((agent, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      return [
        agent,
        {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        }
      ];
    })
  );
});

const palette = computed(() => {
  const hues = [210, 262, 320, 155, 35];
  return Object.fromEntries(
    agents.value.map((agent, index) => {
      const hue = hues[index % hues.length];
      return [
        agent,
        {
          stroke: `hsla(${hue} 95% 72% / 0.86)`,
          glow: `hsla(${hue} 95% 62% / 0.32)`,
          fillInner: `hsla(${hue} 72% 18% / 0.9)`,
          fillOuter: `hsla(${hue} 95% 38% / 0.35)`
        }
      ];
    })
  );
});

const activeAgent = computed(() => props.activeAgent ?? null);

const markerIds = {
  default: `url(#arrow-${uid})`,
  active: `url(#arrow-active-${uid})`
};

function computeEdgeGeometry(edge: { from: string; to: string; self: boolean }) {
  const from = positions.value[edge.from];
  const to = positions.value[edge.to];
  if (!from || !to || edge.self) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const normX = dx / distance;
  const normY = dy / distance;

  const start = {
    x: from.x + normX * (nodeRadius + 8),
    y: from.y + normY * (nodeRadius + 8)
  };
  const end = {
    x: to.x - normX * (nodeRadius + 10),
    y: to.y - normY * (nodeRadius + 10)
  };

  const perpX = -normY;
  const perpY = normX;
  const curve = Math.min(90, distance / 2.2);

  const control = {
    x: (start.x + end.x) / 2 + perpX * curve,
    y: (start.y + end.y) / 2 + perpY * curve
  };

  return { start, end, control };
}

function edgePath(edge: { from: string; to: string; self: boolean }) {
  const from = positions.value[edge.from];
  if (!from) return "";

  if (edge.self) {
    const topY = from.y - nodeRadius * 2.4;
    const startX = from.x - nodeRadius * 0.6;
    const endX = from.x + nodeRadius * 0.6;
    const leftX = from.x - nodeRadius * 2;
    const rightX = from.x + nodeRadius * 2;
    const startY = from.y - nodeRadius + 6;
    return `M ${startX} ${startY} C ${leftX} ${topY}, ${rightX} ${topY}, ${endX} ${startY}`;
  }

  const geom = computeEdgeGeometry(edge);
  if (!geom) return "";

  return `M ${geom.start.x} ${geom.start.y} Q ${geom.control.x} ${geom.control.y} ${geom.end.x} ${geom.end.y}`;
}

function edgeLabelPosition(edge: { from: string; to: string; self: boolean }) {
  const from = positions.value[edge.from];
  if (!from) return { x: 0, y: 0 };

  if (edge.self) {
    return { x: from.x, y: from.y - nodeRadius * 2.2 };
  }

  const geom = computeEdgeGeometry(edge);
  if (!geom) return { x: 0, y: 0 };
  const t = 0.5;
  const one = 1 - t;
  const x =
    one * one * geom.start.x +
    2 * one * t * geom.control.x +
    t * t * geom.end.x;
  const y =
    one * one * geom.start.y +
    2 * one * t * geom.control.y +
    t * t * geom.end.y;
  return { x, y };
}

function isEdgeActive(edge: { from: string; to: string }) {
  if (!activeAgent.value) return false;
  return edge.from === activeAgent.value || edge.to === activeAgent.value;
}

const defaultEdgeColor = "rgba(148, 163, 253, 0.28)";
</script>

<template>
  <div class="w-full relative">
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      class="w-full"
      style="min-height: 320px"
    >
      <defs>
        <linearGradient :id="`bg-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="transparent" />
          <stop offset="100%" stop-color="transparent" />
        </linearGradient>

        <pattern :id="`grid-${uid}`" patternUnits="userSpaceOnUse" width="48" height="48">
          <path d="M 48 0 L 0 0 0 48" stroke="transparent" stroke-width="0.5" />
        </pattern>

        <filter :id="`node-shadow-${uid}`" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="rgba(56,189,248,0.28)" />
        </filter>

        <marker
          :id="`arrow-${uid}`"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="rgba(148,163,253,0.45)" />
        </marker>

        <marker
          :id="`arrow-active-${uid}`"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill="rgba(56,189,248,0.8)" />
        </marker>

        <radialGradient
          v-for="agent in agents"
          :key="agent"
          :id="`node-grad-${uid}-${agent}`"
          cx="50%"
          cy="45%"
          r="60%"
        >
          <stop offset="0%" :stop-color="palette[agent]?.fillInner || 'rgba(30,64,175,0.9)'" stop-opacity="1" />
          <stop offset="100%" :stop-color="palette[agent]?.fillOuter || 'rgba(148,163,253,0.32)'" stop-opacity="1" />
        </radialGradient>
      </defs>

      <!-- Background removed for transparency -->

      <g v-if="agents.length">
        <g>
          <path
            v-for="edge in edges"
            :key="`${edge.from}-${edge.to}`"
            :d="edgePath(edge)"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke="isEdgeActive(edge) ? (palette[edge.from]?.stroke || 'rgba(56,189,248,0.8)') : defaultEdgeColor"
            :stroke-width="edge.self ? 1.6 : isEdgeActive(edge) ? 3.4 : 2"
            :opacity="activeAgent && !isEdgeActive(edge) ? 0.45 : 0.85"
            :marker-end="edge.self ? undefined : (isEdgeActive(edge) ? markerIds.active : markerIds.default)"
            stroke-dasharray="6 8"
          >
            <animate
              v-if="isEdgeActive(edge)"
              attributeName="stroke-dashoffset"
              from="32"
              to="0"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>

          <template v-for="edge in edges" :key="`badge-${edge.from}-${edge.to}`">
            <g v-if="edge.count" :transform="`translate(${edgeLabelPosition(edge).x}, ${edgeLabelPosition(edge).y})`">
              <rect
                x="-18"
                y="-11"
                width="36"
                height="22"
                rx="6"
                :fill="isEdgeActive(edge) ? 'rgba(0,0,0)' : 'rgba(148,163,253,0.16)'"
                :stroke="isEdgeActive(edge) ? 'rgba(56,189,248,0.6)' : 'rgba(148,163,253,0.4)'"
                stroke-width="1"
              />
              <text
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="11"
                font-weight="600"
                fill="rgba(248,250,252,0.9)"
              >
                {{ edge.count }}×
              </text>
            </g>
          </template>
        </g>

        <g v-for="agent in agents" :key="agent">
          <g v-if="positions[agent]" :transform="`translate(${positions[agent].x}, ${positions[agent].y})`">
            <circle
              :r="nodeRadius + 14"
              :fill="palette[agent]?.glow || 'rgba(56,189,248,0.22)'"
              opacity="0.45"
            />
            <circle
              :r="activeAgent === agent ? nodeRadius + 6 : nodeRadius + 2"
              :stroke="palette[agent]?.stroke || 'rgba(148,163,253,0.6)'"
              stroke-width="2"
              fill="none"
              opacity="0.9"
            />
            <circle
              :r="activeAgent === agent ? nodeRadius + 1 : nodeRadius - 1"
              :fill="`url(#node-grad-${uid}-${agent})`"
              :stroke="palette[agent]?.stroke || 'rgba(148,163,253,0.6)'"
              :stroke-width="activeAgent === agent ? 2.6 : 1.6"
              :filter="activeAgent === agent ? `url(#node-shadow-${uid})` : undefined"
              class="transition-all duration-300"
            />

            <text
              y="-6"
              text-anchor="middle"
              font-size="10"
              font-weight="600"
              fill="rgba(248,250,252,0.92)"
              class="select-none tracking-wide"
            >
              {{ agent }}
            </text>
            <g transform="translate(0, 14)">
              <rect
                x="-19"
                y="-12"
                width="36"
                height="18"
                rx="9"
                fill="rgba(15,23,42,0.55)"
                :stroke="palette[agent]?.stroke || 'rgba(148,163,253,0.6)'"
                stroke-width="1"
              />
              <text
                text-anchor="middle"
                font-size="8"
                font-weight="500"
                fill="rgba(248,250,252,0.9)"
                class="font-mono select-none"
              >
                {{ loopCounts[agent] || 0 }}×
              </text>
            </g>
          </g>
        </g>
      </g>

      <g v-else>
        <text
          :x="width / 2"
          :y="height / 2"
          text-anchor="middle"
          font-size="14"
          fill="rgba(248,250,252,0.45)"
        >
          Run a task to visualise agent routing here.
        </text>
      </g>
    </svg>
  </div>
</template>
