import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Package, Tag, Plus } from 'lucide-react'

export default function ProductGrid({ searchTerm, branchId, category, onAddToCart, currencySymbol = 'Bs.', refreshKey }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchProducts()
    }, [branchId, refreshKey])

    async function fetchProducts() {
        if (!branchId) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    category:categories(name),
                    settings:product_branch_settings!inner(*)
                `)
                .eq('settings.branch_id', branchId)
                .order('name')

            if (error) throw error

            const mapped = data.map(p => ({
                ...p,
                price: p.settings[0].price || p.price,
                stock: p.settings[0].stock
            }))

            setProducts(mapped || [])
        } catch (err) {
            console.error('Error fetching products POS:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p => {
        const matchesSearch = (p.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (p.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        const matchesCategory = category === 'Todos' || p.category?.name === category
        return matchesSearch && matchesCategory
    })

    return (
        <div style={{ position: 'relative', minHeight: '200px' }}>
            {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--background) / 0.8)', zIndex: 10, backdropFilter: 'blur(4px)', borderRadius: '20px' }}>
                    <RefreshCw size={40} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: '700', opacity: 0.5 }}>Cargando catálogo...</p>
                </div>
            )}

            {filteredProducts.length === 0 && !loading ? (
                <div style={{ padding: '6rem 2rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', opacity: 0.5 }}>
                        <Package size={40} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>No hay productos coincidentes</h3>
                    <p style={{ opacity: 0.5, maxWidth: '300px' }}>Intenta con otro término de búsqueda o categoría diferente.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '1.25rem',
                    paddingBottom: '2rem',
                    opacity: loading ? 0.3 : 1,
                    transition: 'opacity 0.3s ease'
                }}>
                    {filteredProducts.map(product => (
                        <div
                            key={product.id}
                            className="card"
                            style={{
                                padding: 0,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '1px solid hsl(var(--border) / 0.5)',
                                borderRadius: '20px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: 'hsl(var(--background))',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-8px)'
                                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                                e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.3)'
                                const plusBtn = e.currentTarget.querySelector('.add-indicator')
                                if (plusBtn) plusBtn.style.opacity = '1'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none'
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.05)'
                                e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.5)'
                                const plusBtn = e.currentTarget.querySelector('.add-indicator')
                                if (plusBtn) plusBtn.style.opacity = '0'
                            }}
                            onClick={() => product.stock > 0 && onAddToCart(product)}
                        >
                            {product.stock <= 0 && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'rgba(255,255,255,0.6)',
                                    zIndex: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        backgroundColor: 'hsl(var(--destructive))',
                                        color: 'white',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '12px',
                                        fontWeight: '900',
                                        fontSize: '0.8rem',
                                        textTransform: 'uppercase',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }}>
                                        Agotado
                                    </div>
                                </div>
                            )}
                            {/* Image / Icon Holder */}
                            <div style={{
                                height: '160px',
                                backgroundColor: 'hsl(var(--secondary) / 0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Package size={48} style={{ opacity: 0.1 }} />
                                )}

                                {/* Hover Indicator */}
                                <div className="add-indicator" style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'hsl(var(--primary) / 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.2s ease',
                                    backdropFilter: 'blur(2px)'
                                }}>
                                    <div style={{ backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '0.75rem', borderRadius: '50%', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' }}>
                                        <Plus size={24} />
                                    </div>
                                </div>

                                {/* Category Badge */}
                                <div style={{
                                    position: 'absolute',
                                    top: 12,
                                    left: 12,
                                    padding: '4px 10px',
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    backdropFilter: 'blur(4px)',
                                    borderRadius: '8px',
                                    fontSize: '0.65rem',
                                    fontWeight: '800',
                                    color: 'hsl(var(--primary))',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <Tag size={10} />
                                    {product.category?.name || 'Gral.'}
                                </div>
                            </div>

                            {/* Info Section */}
                            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{
                                        fontSize: '1rem',
                                        fontWeight: '800',
                                        marginBottom: '0.25rem',
                                        color: 'hsl(var(--foreground))',
                                        lineHeight: '1.3',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {product.name}
                                    </h3>
                                    <p style={{ fontSize: '0.7rem', fontWeight: '700', padding: '2px 6px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--secondary-foreground) / 0.6)', borderRadius: '6px', display: 'inline-block' }}>
                                        #{product.sku || 'N/A'}
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid hsl(var(--border) / 0.3)', paddingTop: '0.75rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <p style={{
                                            color: 'hsl(var(--primary))',
                                            fontWeight: '900',
                                            fontSize: '1.2rem',
                                            margin: 0,
                                            letterSpacing: '-0.02em'
                                        }}>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '2px' }}>{currencySymbol}</span>
                                            {(product.price ?? 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            fontWeight: '800',
                                            color: (product.stock || 0) > 5 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></div>
                                            {product.stock || 0} disp.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
