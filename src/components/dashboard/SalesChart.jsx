import React from 'react'

export default function SalesChart({ data }) {
    if (!data || data.length === 0) return (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
            No hay datos suficientes para mostrar el gráfico.
        </div>
    )

    const height = 240
    const width = 600
    const padding = 40
    const chartHeight = height - padding * 2
    const chartWidth = width - padding * 2

    const maxVal = Math.max(...data.map(d => d.total), 10)
    const barWidth = (chartWidth / data.length) * 0.7
    const gap = (chartWidth / data.length) * 0.3

    return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                    <line
                        key={i}
                        x1={padding}
                        y1={height - padding - (chartHeight * p)}
                        x2={width - padding}
                        y2={height - padding - (chartHeight * p)}
                        stroke="hsl(var(--border))"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Bars */}
                {data.map((d, i) => {
                    const barHeight = (d.total / maxVal) * chartHeight
                    const x = padding + (i * (barWidth + gap)) + (gap / 2)
                    const y = height - padding - barHeight

                    return (
                        <g key={i}>
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                fill="url(#barGradient)"
                                rx="4"
                                className="chart-bar"
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <title>{`${d.date}: $${d.total.toFixed(2)}`}</title>
                            </rect>
                            <text
                                x={x + barWidth / 2}
                                y={height - padding + 20}
                                textAnchor="middle"
                                fontSize="10"
                                fill="hsl(var(--secondary-foreground))"
                            >
                                {d.label}
                            </text>
                        </g>
                    )
                })}

                {/* Y-axis labels */}
                {[0, 0.5, 1].map((p, i) => (
                    <text
                        key={i}
                        x={padding - 10}
                        y={height - padding - (chartHeight * p)}
                        textAnchor="end"
                        alignmentBaseline="middle"
                        fontSize="10"
                        fill="hsl(var(--secondary-foreground))"
                    >
                        ${(maxVal * p).toFixed(0)}
                    </text>
                ))}

                <style>
                    {`
                        .chart-bar {
                            opacity: 0;
                            animation: slideUp 0.5s ease-out forwards;
                            cursor: pointer;
                            transition: opacity 0.2s;
                        }
                        .chart-bar:hover {
                            opacity: 0.8;
                        }
                        @keyframes slideUp {
                            from { transform: scaleY(0); transform-origin: bottom; opacity: 0; }
                            to { transform: scaleY(1); transform-origin: bottom; opacity: 1; }
                        }
                    `}
                </style>
            </svg>
        </div>
    )
}
