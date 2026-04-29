import React, { useState, useEffect } from 'react'
import {
    Upload,
    ArrowLeft,
    Plus,
    Edit2,
    Trash2,
    RefreshCw,
    Image as ImageIcon,
    X,
    Save,
    Package
} from 'lucide-react'
import { inventoryService } from '../services/inventoryService'
import ProductModal from '../components/inventory/ProductModal'
import { supabase } from '../lib/supabase'

export default function Classifications() {
    const [loading, setLoading] = useState(false)
    const [brands, setBrands] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [brandLogoFile, setBrandLogoFile] = useState(null)
    const [selectedBrand, setSelectedBrand] = useState(null)
    const [brandProducts, setBrandProducts] = useState([])
    const [isProductModalOpen, setIsProductModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)

    // Form data for brand creation
    const [formData, setFormData] = useState({ name: '', logo_url: '' })

    useEffect(() => {
        fetchBrands()
    }, [])

    useEffect(() => {
        if (selectedBrand) {
            fetchBrandProducts(selectedBrand.id)
        }
    }, [selectedBrand])

    const fetchBrands = async () => {
        try {
            setLoading(true)
            const data = await inventoryService.getBrands()
            setBrands(data || [])
        } catch (error) {
            console.error('Error fetching brands:', error)
            alert('Error al cargar marcas')
        } finally {
            setLoading(false)
        }
    }

    const fetchBrandProducts = async (brandId) => {
        try {
            setLoading(true)
            const products = await inventoryService.getProductsByBrand(brandId)
            setBrandProducts(products || [])
        } catch (error) {
            console.error('Error fetching products:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleOpenModal = (item = null) => {
        setEditingItem(item)
        setFormData({
            name: item?.name || '',
            logo_url: item?.logo_url || ''
        })
        setBrandLogoFile(null)
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name.trim()) return alert('El nombre de la marca es requerido')

        try {
            setIsSaving(true)
            let logoUrl = formData.logo_url
            if (brandLogoFile) {
                logoUrl = await inventoryService.uploadBrandLogo(brandLogoFile)
            }

            if (editingItem) {
                await inventoryService.updateBrand(editingItem.id, formData.name, logoUrl)
            } else {
                await inventoryService.createBrand(formData.name, logoUrl)
            }
            
            setIsModalOpen(false)
            fetchBrands()
        } catch (error) {
            console.error('Error saving brand:', error)
            alert('Error al guardar marca: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveProduct = async (formData) => {
        try {
            setIsSaving(true)
            const { branch_settings, ...productData } = formData

            let productId = editingProduct?.id

            if (editingProduct) {
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
                if (error) throw error
            } else {
                const { data, error } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                if (error) throw error
                productId = data[0].id
            }

            if (branch_settings && branch_settings.length > 0) {
                const settingsToSave = branch_settings.map(s => ({
                    product_id: productId,
                    branch_id: s.branch_id,
                    stock: s.stock || 0,
                    min_stock: s.min_stock || 0,
                    price: s.price || null
                }))

                const { error: settingsError } = await supabase
                    .from('product_branch_settings')
                    .upsert(settingsToSave, { onConflict: 'product_id, branch_id' })

                if (settingsError) throw settingsError
            }

            setIsProductModalOpen(false)
            setEditingProduct(null)
            if (selectedBrand) {
                fetchBrandProducts(selectedBrand.id)
            }
        } catch (error) {
            console.error('Error saving product:', error)
            alert('Error al guardar producto: ' + (error.message || error.details || JSON.stringify(error)))
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar esta marca?')) return
        try {
            setLoading(true)
            await inventoryService.deleteBrand(id)
            fetchBrands()
        } catch (error) {
            console.error('Error deleting brand:', error)
            alert('Error al eliminar marca: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
            {/* Quick Access Brand Bar */}
            {selectedBrand && (
                <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    overflowX: 'auto', 
                    paddingBottom: '0.5rem', 
                    msOverflowStyle: 'none', 
                    scrollbarWidth: 'none',
                    borderBottom: '1px solid hsl(var(--border) / 0.3)'
                }}>
                    {brands.map(b => (
                        <button 
                            key={b.id}
                            onClick={() => {
                                setSelectedBrand(b)
                                fetchBrandProducts(b.id)
                            }}
                            style={{
                                padding: '0.5rem 1.25rem',
                                borderRadius: '100px',
                                backgroundColor: selectedBrand?.id === b.id ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                color: selectedBrand?.id === b.id ? 'white' : 'inherit',
                                border: 'none',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {b.name}
                        </button>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {selectedBrand && (
                        <button className="btn-icon" onClick={() => setSelectedBrand(null)} style={{ padding: '0.5rem', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)', border: 'none', cursor: 'pointer' }}>
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>
                            {selectedBrand ? selectedBrand.name : 'Marcas'}
                        </h1>
                        <p style={{ opacity: 0.5, fontWeight: '500' }}>
                            {selectedBrand ? `Productos de la marca ${selectedBrand.name}` : 'Gestión de catálogo: Marcas'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchBrands} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={() => selectedBrand ? setIsProductModalOpen(true) : handleOpenModal()} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800', gap: '0.5rem' }}>
                        <Plus size={20} /> NUEVO
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {selectedBrand ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {loading && brandProducts.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando productos...</div>
                    ) : brandProducts.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>No hay productos registrados para esta marca</p>
                        </div>
                    ) : (
                        brandProducts.map(product => (
                            <div key={product.id} className="card hover:shadow-lg transition-all" style={{ padding: '1.25rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.4)', display: 'flex', gap: '1.25rem', alignItems: 'center', backgroundColor: 'white' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                    {product.image_url ? (
                                        <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <Package size={24} style={{ opacity: 0.2 }} />
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{product.name}</h3>
                                    <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: '0.2rem 0' }}>SKU: {product.sku || 'N/A'}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-icon" onClick={() => { setEditingProduct(product); setIsProductModalOpen(true); }} style={{ padding: '0.5rem', borderRadius: '10px', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.1)', border: 'none', cursor: 'pointer' }}>
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    {loading && brands.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando marcas...</div>
                    ) : brands.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                            <ImageIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>No se encontraron marcas</p>
                        </div>
                    ) : (
                        brands.map(brand => (
                            <div 
                                key={brand.id} 
                                className="card hover:shadow-md transition-all" 
                                style={{ 
                                    padding: '1.25rem', 
                                    borderRadius: '16px', 
                                    border: '1px solid hsl(var(--border) / 0.4)', 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center', 
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedBrand(brand)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                        {brand.logo_url ? (
                                            <img src={brand.logo_url} alt={brand.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <ImageIcon size={20} style={{ opacity: 0.3 }} />
                                        )}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>{brand.name}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleOpenModal(brand)} className="btn hover:bg-secondary" style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--primary))', border: 'none', cursor: 'pointer' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(brand.id)} className="btn hover:bg-secondary" style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--destructive))', border: 'none', cursor: 'pointer' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'hsl(var(--background))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
                                {editingItem ? 'Editar' : 'Nueva'} Marca
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Nombre</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Ej: Nombre..."
                                    style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '1rem' }}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Logo de la Marca</label>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ 
                                        width: '80px', 
                                        height: '80px', 
                                        borderRadius: '16px', 
                                        backgroundColor: 'hsl(var(--secondary) / 0.4)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        overflow: 'hidden',
                                        border: '2px dashed hsl(var(--border) / 0.5)'
                                    }}>
                                        {brandLogoFile ? (
                                            <img src={URL.createObjectURL(brandLogoFile)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : formData.logo_url ? (
                                            <img src={formData.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <ImageIcon size={32} style={{ opacity: 0.2 }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="btn" style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '0.5rem', 
                                            padding: '0.6rem 1rem', 
                                            borderRadius: '10px', 
                                            backgroundColor: 'hsl(var(--secondary) / 0.7)', 
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: '700'
                                        }}>
                                            <Upload size={16} /> Subir Logo
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                style={{ display: 'none' }} 
                                                onChange={(e) => setBrandLogoFile(e.target.files[0])}
                                            />
                                        </label>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.4rem' }}>PNG, JPG. Max 2MB.</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                                <button onClick={() => setIsModalOpen(false)} className="btn" style={{ flex: 1, padding: '1rem', borderRadius: '14px', fontWeight: '700' }}>Cancelar</button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="btn btn-primary"
                                    style={{ flex: 1, padding: '1rem', borderRadius: '14px', fontWeight: '800', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                                >
                                    {isSaving ? <RefreshCw className="animate-spin" /> : <Save />}
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Product Modal */}
            {isProductModalOpen && (
                <ProductModal
                    onClose={() => {
                        setIsProductModalOpen(false)
                        setEditingProduct(null)
                        if (selectedBrand) fetchBrandProducts(selectedBrand.id)
                        else fetchBrands()
                    }}
                    onSave={handleSaveProduct}
                    isSaving={isSaving}
                    product={editingProduct ? { ...editingProduct, brand_id: selectedBrand.id } : { brand_id: selectedBrand.id }}
                />
            )}
        </div>
    )
}
