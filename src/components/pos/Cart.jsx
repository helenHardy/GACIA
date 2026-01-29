import React from 'react'
import { Plus, Minus, Trash2, Package, ShoppingCart, Box } from 'lucide-react'

export default function Cart({ items, onRemove, onUpdateQuantity, currencySymbol = 'Bs.' }) {
    if (items.length === 0) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--secondary-foreground))', padding: '2rem', opacity: 0.3 }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px dashed currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <ShoppingCart size={40} />
                </div>
                <p style={{ fontWeight: '800', fontSize: '1.1rem' }}>Carrito Vacío</p>
                <p style={{ fontSize: '0.85rem', fontWeight: '500', maxWidth: '180px', textAlign: 'center' }}>Selecciona productos del catálogo para comenzar la venta.</p>
            </div>
        )
    }

    return (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map(item => (
                <div
                    key={item.id}
                    style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        padding: '1rem',
                        backgroundColor: 'hsl(var(--background))',
                        borderRadius: '16px',
                        border: '1px solid hsl(var(--border) / 0.5)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        animation: 'fadeIn 0.3s ease-out'
                    }}
                >
                    {/* Item Image Mini */}
                    <div style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: 'hsl(var(--secondary) / 0.4)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'hsl(var(--primary))',
                        flexShrink: 0,
                        overflow: 'hidden'
                    }}>
                        {item.image_url ? (
                            <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <Box size={20} opacity={0.4} />
                        )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{
                            fontSize: '0.9rem',
                            fontWeight: '800',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '0.2rem'
                        }} title={item.name}>{item.name}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--primary))', fontWeight: '900' }}>
                                {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                            </span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.4, fontWeight: '700' }}>
                                ({currencySymbol}{item.price.toFixed(2)} c/u)
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '12px', padding: '0.35rem', border: '1px solid hsl(var(--border) / 0.3)' }}>
                        <button
                            className="btn"
                            style={{
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                borderRadius: '8px',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                border: 'none'
                            }}
                            onClick={() => onUpdateQuantity(item.id, -1)}
                        >
                            <Minus size={14} />
                        </button>
                        <span style={{ fontSize: '0.9rem', fontWeight: '900', minWidth: '28px', textAlign: 'center' }}>{item.quantity}</span>
                        <button
                            className="btn"
                            style={{
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                borderRadius: '8px',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                border: 'none'
                            }}
                            onClick={() => onUpdateQuantity(item.id, 1)}
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    <button
                        className="btn"
                        style={{
                            color: 'hsl(var(--destructive) / 0.5)',
                            padding: '0.5rem',
                            borderRadius: '10px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'hsl(var(--destructive))'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'hsl(var(--destructive) / 0.5)'}
                        onClick={() => onRemove(item.id)}
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    )
}
