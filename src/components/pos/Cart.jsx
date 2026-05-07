import React from 'react'
import { Plus, Minus, Trash2, Package, ShoppingCart, Box } from 'lucide-react'

export default function Cart({ items, onRemove, onUpdateQuantity, onSetQuantity, onSetPrice, currencySymbol = 'Bs.' }) {
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
                        gap: '1rem',
                        alignItems: 'center',
                        padding: '1rem 1.5rem',
                        backgroundColor: 'hsl(var(--background))',
                        borderRadius: '20px',
                        border: '1px solid hsl(var(--border) / 0.5)',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                        transition: 'all 0.2s ease',
                        animation: 'fadeIn 0.3s ease-out'
                    }}
                >
                    {/* Item Image Mini */}
                    <div style={{
                        width: '50px',
                        height: '50px',
                        backgroundColor: 'hsl(var(--secondary) / 0.4)',
                        borderRadius: '12px',
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
                            <Box size={24} opacity={0.4} />
                        )}
                    </div>

                    <div style={{ flex: 1.5, minWidth: 0 }}>
                        <h4 style={{
                            fontSize: '0.95rem',
                            fontWeight: '800',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '0.2rem'
                        }} title={item.name}>{item.name}</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.4, fontWeight: '700' }}>SKU: {item.sku || 'N/A'}</p>
                    </div>

                    {/* Unit Price Editable */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Precio Unit.</p>
                        <div style={{ position: 'relative', width: '130px' }}>
                            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '800', opacity: 0.3, fontSize: '0.8rem' }}>{currencySymbol}</span>
                            <input
                                type="number"
                                step="0.01"
                                style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', fontSize: '0.95rem', fontWeight: '900', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--secondary) / 0.2)', border: '1px solid hsl(var(--border) / 0.3)', borderRadius: '12px', outline: 'none' }}
                                value={item.price}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                onChange={(e) => onSetPrice && onSetPrice(item.id, parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    {/* Quantity Controls */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Cantidad</p>
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
                                style={{ width: '50px', fontSize: '1rem', fontWeight: '900', textAlign: 'center', backgroundColor: 'transparent', border: 'none', outline: 'none' }}
                                value={item.quantity}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                onChange={(e) => {
                                    let val = parseInt(e.target.value) || 0
                                    if (val < 0) val = 0
                                    if (item.stock && val > item.stock) val = item.stock
                                    onSetQuantity(item.id, val)
                                }}
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
                        {item.stock != null && <p style={{ margin: '0.2rem 0 0', fontSize: '0.6rem', fontWeight: '700', opacity: 0.35, textAlign: 'center' }}>Disp: {item.stock}</p>}
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '800', opacity: 0.4, textTransform: 'uppercase' }}>Subtotal</p>
                        <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'hsl(var(--foreground))' }}>
                            {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                        </p>
                    </div>

                    <button
                        className="btn"
                        style={{ color: 'hsl(var(--destructive) / 0.5)', padding: '0.6rem', borderRadius: '12px', backgroundColor: 'hsl(var(--destructive) / 0.05)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'hsl(var(--destructive))'; e.currentTarget.style.backgroundColor = 'hsl(var(--destructive) / 0.1)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'hsl(var(--destructive) / 0.5)'; e.currentTarget.style.backgroundColor = 'hsl(var(--destructive) / 0.05)' }}
                        onClick={() => onRemove(item.id)}
                    >
                        <Trash2 size={20} />
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
