import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Package, Tag, Plus } from 'lucide-react'

export default function ProductGrid({ searchTerm, branchId, category, onAddToCart, currencySymbol = 'Bs.', refreshKey, viewMode = 'grid' }) {
    const [products, setProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 10

    useEffect(() => {
        fetchProducts()
    }, [branchId, refreshKey])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, category])

    async function fetchProducts() {
        if (!branchId) return
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    category:categories(name),
                    brand:brands(name),
                    model:models(name),
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

    const totalPages = Math.ceil(filteredProducts.length / pageSize)
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    return (
        <div style={{ position: 'relative', minHeight: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'hsl(var(--background) / 0.8)', zIndex: 10, backdropFilter: 'blur(4px)', borderRadius: '20px' }}>
                    <RefreshCw size={40} className="animate-spin" style={{ color: 'hsl(var(--primary))', marginBottom: '1rem' }} />
                    <p style={{ fontWeight: '700', opacity: 0.5 }}>Cargando catálogo...</p>
                </div>
            )}

            <div style={{ flex: 1 }}>
                {filteredProducts.length === 0 && !loading ? (
                    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: 'hsl(var(--secondary-foreground))', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', opacity: 0.5 }}>
                            <Package size={40} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>No hay productos coincidentes</h3>
                        <p style={{ opacity: 0.5, maxWidth: '300px' }}>Intenta con otro término de búsqueda o categoría diferente.</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '1.25rem',
                        paddingBottom: '2rem',
                        opacity: loading ? 0.3 : 1,
                        transition: 'opacity 0.3s ease'
                    }}>
                        {paginatedProducts.map(product => (
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

                                <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            fontSize: '1rem',
                                            fontWeight: '800',
                                            marginBottom: '0.2rem',
                                            color: 'hsl(var(--foreground))',
                                            lineHeight: '1.2',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}>
                                            {product.name}
                                        </h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: '800', padding: '1px 5px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                {product.brand?.name || 'Sin Marca'}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', backgroundColor: 'hsl(var(--secondary) / 0.6)', color: 'hsl(var(--secondary-foreground) / 0.7)', borderRadius: '4px' }}>
                                                {product.model?.name || 'N/A'}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, letterSpacing: '0.05em' }}>
                                            SKU: <span style={{ color: 'hsl(var(--foreground))' }}>{product.sku || 'N/A'}</span>
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
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
                        {paginatedProducts.map(product => (
                            <div
                                key={product.id}
                                className="card"
                                onClick={() => product.stock > 0 && onAddToCart(product)}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1.25rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    border: '1px solid hsl(var(--border) / 0.5)',
                                    borderRadius: '16px',
                                    backgroundColor: product.stock <= 0 ? 'hsl(var(--secondary) / 0.05)' : 'hsl(var(--background))',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    opacity: product.stock <= 0 ? 0.6 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (product.stock > 0) {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--primary) / 0.05)'
                                        e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.2)'
                                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = product.stock <= 0 ? 'hsl(var(--secondary) / 0.05)' : 'hsl(var(--background))'
                                    e.currentTarget.style.borderColor = 'hsl(var(--border) / 0.5)'
                                    e.currentTarget.style.boxShadow = 'none'
                                }}
                            >
                                {/* Product Thumbnail */}
                                <div style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '10px',
                                    backgroundColor: 'hsl(var(--secondary) / 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    overflow: 'hidden'
                                }}>
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <Package size={24} style={{ opacity: 0.2 }} />
                                    )}
                                </div>

                                {/* Main Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.15rem' }}>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'hsl(var(--foreground))' }}>{product.name}</h3>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'hsl(var(--primary))', opacity: 0.8 }}>
                                                {product.brand?.name}
                                            </span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '600', opacity: 0.4 }}>
                                                {product.model?.name ? `- ${product.model.name}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Tag size={12} /> {product.category?.name || 'Gral.'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.4)' }}>
                                            SKU: <span style={{ color: 'hsl(var(--secondary-foreground) / 0.8)' }}>{product.sku || 'N/A'}</span>
                                        </span>
                                        {product.stock <= 0 && <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'hsl(var(--destructive))' }}>AGOTADO</span>}
                                    </div>
                                </div>

                                {/* Stock & Price */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4, margin: 0, textTransform: 'uppercase' }}>Disp.</p>
                                        <p style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: product.stock > 5 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))' }}>{product.stock || 0}</p>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: '100px' }}>
                                        <p style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4, margin: 0, textTransform: 'uppercase' }}>Precio</p>
                                        <p style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, color: 'hsl(var(--primary))' }}>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.6, marginRight: '2px' }}>{currencySymbol}</span>
                                            {(product.price ?? 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        backgroundColor: product.stock > 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: product.stock > 0 ? '0 4px 6px -1px rgb(var(--primary) / 0.2)' : 'none'
                                    }}>
                                        <Plus size={20} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.25rem',
                    backgroundColor: 'hsl(var(--secondary) / 0.1)',
                    borderRadius: '24px',
                    border: '1px solid hsl(var(--border) / 0.5)',
                    marginTop: '1rem'
                }}>
                    <button
                        className="btn"
                        onClick={() => {
                            setCurrentPage(prev => Math.max(1, prev - 1))
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        disabled={currentPage === 1}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '16px',
                            fontSize: '0.9rem',
                            fontWeight: '800',
                            backgroundColor: currentPage === 1 ? 'hsl(var(--secondary) / 0.3)' : 'hsl(var(--secondary) / 0.6)',
                            color: 'hsl(var(--foreground))',
                            border: 'none',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.8)' }}
                        onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.6)' }}
                    >
                        Anterior
                    </button>

                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        {[...Array(totalPages)].map((_, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setCurrentPage(i + 1)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    backgroundColor: currentPage === i + 1 ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.3)',
                                    color: currentPage === i + 1 ? 'white' : 'hsl(var(--foreground) / 0.6)',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '0.9rem'
                                }}
                                onMouseEnter={(e) => { if (currentPage !== i + 1) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.6)' }}
                                onMouseLeave={(e) => { if (currentPage !== i + 1) e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.3)' }}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>

                    <button
                        className="btn"
                        onClick={() => {
                            setCurrentPage(prev => Math.min(totalPages, prev + 1))
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        disabled={currentPage === totalPages}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '16px',
                            fontSize: '0.9rem',
                            fontWeight: '800',
                            backgroundColor: currentPage === totalPages ? 'hsl(var(--secondary) / 0.3)' : 'hsl(var(--primary))',
                            color: currentPage === totalPages ? 'hsl(var(--foreground) / 0.4)' : 'white',
                            border: 'none',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s',
                            boxShadow: currentPage === totalPages ? 'none' : '0 4px 12px rgb(var(--primary) / 0.3)'
                        }}
                        onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.transform = 'none' }}
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    )
}
