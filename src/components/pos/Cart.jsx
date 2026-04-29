import React from 'react'
import { Plus, Minus, Trash2, Package, ShoppingCart, Box } from 'lucide-react'

export default function Cart({ items, onRemove, onUpdateQuantity, onSetQuantity, currencySymbol = 'Bs.' }) {
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
        <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map(item => (
                <div
                    key={item.id}
                    style={{
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center',
                        padding: '0.75rem',
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'hsl(var(--secondary) / 0.2)', borderRadius: '14px', padding: '0.4rem', border: '1px solid hsl(var(--border) / 0.4)' }}>
                        <button
                            className="btn"
                            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '10px', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => onUpdateQuantity(item.id, -1)}
                        >
                            <Minus size={14} />
                        </button>
                        <input
                            type="number"
                            style={{ width: '45px', fontSize: '0.95rem', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
                            value={item.quantity}
                            onChange={(e) => onSetQuantity(item.id, parseInt(e.target.value) || 0)}
                        />
                        <button
                            className="btn"
                            disabled={item.quantity >= (item.stock || 0)}
                            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '10px', backgroundColor: item.quantity >= (item.stock || 0) ? 'hsl(var(--secondary) / 0.5)' : 'hsl(var(--primary))', color: item.quantity >= (item.stock || 0) ? 'inherit' : 'white', boxShadow: '0 4px 6px -1px rgb(var(--primary) / 0.2)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => onUpdateQuantity(item.id, 1)}
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '90px' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Subtotal</p>
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'hsl(var(--primary))' }}>
                            {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                        </p>
                    </div>

                    <button
                        className="btn"
                        style={{ color: 'hsl(var(--destructive) / 0.5)', padding: '0.5rem', borderRadius: '10px' }}
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
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}</style>
        </div>
    )
}
