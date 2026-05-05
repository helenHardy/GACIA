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
    const [selectedProduct, setSelectedProduct] = useState(null) // DB Model
    const [brandModels, setBrandModels] = useState([]) // DB Models for Brand
    const [modelProducts, setModelProducts] = useState([]) // DB Products for Model
    const [isProductModalOpen, setIsProductModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    
    // Model modal state (for DB models)
    const [isModelModalOpen, setIsModelModalOpen] = useState(false)
    const [editingModel, setEditingModel] = useState(null)
    const [modelFormData, setModelFormData] = useState({ name: '' })

    // Form data for brand creation
    const [formData, setFormData] = useState({ name: '', logo_url: '' })

    useEffect(() => {
        fetchBrands()
    }, [])

    useEffect(() => {
        if (selectedBrand) {
            fetchBrandModels(selectedBrand.id)
            setSelectedProduct(null)
        }
    }, [selectedBrand])

    useEffect(() => {
        if (selectedProduct) {
            fetchModelProducts(selectedProduct.id)
        }
    }, [selectedProduct])

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

    const fetchBrandModels = async (brandId) => {
        try {
            setLoading(true)
            const models = await inventoryService.getModels(brandId)
            setBrandModels(models || [])
        } catch (error) {
            console.error('Error fetching models:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchModelProducts = async (modelId) => {
        try {
            setLoading(true)
            const products = await inventoryService.getProductsByModel(modelId)
            setModelProducts(products || [])
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

    const handleOpenModelModal = (model = null) => {
        setEditingModel(model)
        setModelFormData({
            name: model?.name || ''
        })
        setIsModelModalOpen(true)
    }

    const handleSaveModel = async () => {
        if (!modelFormData.name.trim()) return alert('El nombre es requerido')
        
        try {
            setIsSaving(true)
            if (editingModel) {
                await inventoryService.updateModel(editingModel.id, modelFormData.name, selectedBrand.id)
            } else {
                await inventoryService.createModel(modelFormData.name, selectedBrand.id)
            }
            setIsModelModalOpen(false)
            fetchBrandModels(selectedBrand.id)
        } catch (error) {
            console.error('Error saving model:', error)
            alert('Error al guardar: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteModel = async (id) => {
        try {
            setLoading(true)
            
            // 1. Verificar si hay productos asociados a este modelo que tengan stock
            const { data: products, error: pError } = await supabase
                .from('products')
                .select('id, name')
                .eq('model_id', id)

            if (pError) throw pError

            if (products && products.length > 0) {
                const productIds = products.map(p => p.id)
                
                const { data: stockData, error: sError } = await supabase
                    .from('product_branch_settings')
                    .select('stock')
                    .in('product_id', productIds)

                if (sError) throw sError

                const totalStock = stockData?.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0) || 0

                if (totalStock > 0) {
                    alert(`No se puede eliminar el producto porque todavía tiene ${totalStock} unidades en stock en el sistema. Debe agotar el stock antes de eliminarlo.`)
                    return
                }
            }

            if (!confirm('¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.')) return

            await inventoryService.deleteModel(id)
            fetchBrandModels(selectedBrand.id)
        } catch (error) {
            console.error('Error deleting model:', error)
            alert('Error al eliminar: ' + error.message)
        } finally {
            setLoading(false)
        }
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

    const handleDeleteProduct = async (id) => {
        try {
            setLoading(true)
            
            // 1. Verificar stock del producto específico
            const { data: stockData, error: sError } = await supabase
                .from('product_branch_settings')
                .select('stock')
                .eq('product_id', id)

            if (sError) throw sError

            const totalStock = stockData?.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0) || 0

            if (totalStock > 0) {
                alert(`No se puede eliminar este modelo porque todavía tiene ${totalStock} unidades en stock. Agote el stock antes de eliminarlo.`)
                return
            }

            if (!confirm('¿Estás seguro de eliminar este modelo permanentemente?')) return

            const { error } = await supabase.from('products').delete().eq('id', id)
            if (error) throw error
            
            fetchModelProducts(selectedProduct.id)
        } catch (error) {
            console.error('Error deleting product:', error)
            alert('Error al eliminar: ' + error.message)
        } finally {
            setLoading(false)
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
            if (selectedProduct) {
                fetchModelProducts(selectedProduct.id)
            } else if (selectedBrand) {
                fetchBrandModels(selectedBrand.id)
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
            {/* Quick Access Bars */}
            {selectedBrand && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Brand Bar */}
                    <div style={{ 
                        display: 'flex', 
                        gap: '0.75rem', 
                        overflowX: 'auto', 
                        paddingBottom: '0.25rem', 
                        msOverflowStyle: 'none', 
                        scrollbarWidth: 'none'
                    }}>
                        {brands.map(b => (
                            <button 
                                key={b.id}
                                onClick={() => {
                                    setSelectedBrand(b)
                                    fetchBrandModels(b.id)
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

                    {/* Product Bar */}
                    {brandModels.length > 0 && (selectedBrand || selectedProduct) && (
                        <div style={{ 
                            display: 'flex', 
                            gap: '0.6rem', 
                            overflowX: 'auto', 
                            paddingBottom: '0.5rem', 
                            msOverflowStyle: 'none', 
                            scrollbarWidth: 'none',
                            borderBottom: '1px solid hsl(var(--border) / 0.3)'
                        }}>
                            {brandModels.map(m => (
                                <button 
                                    key={m.id}
                                    onClick={() => setSelectedProduct(m)}
                                    style={{
                                        padding: '0.4rem 1rem',
                                        borderRadius: '10px',
                                        backgroundColor: selectedProduct?.id === m.id ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                                        color: selectedProduct?.id === m.id ? 'hsl(var(--primary))' : 'inherit',
                                        border: '1px solid ' + (selectedProduct?.id === m.id ? 'hsl(var(--primary))' : 'hsl(var(--border) / 0.5)'),
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {(selectedBrand || selectedProduct) && (
                        <button 
                            className="btn-icon" 
                            onClick={() => {
                                if (selectedProduct) setSelectedProduct(null)
                                else setSelectedBrand(null)
                            }} 
                            style={{ padding: '0.5rem', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)', border: 'none', cursor: 'pointer' }}
                        >
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>
                            {selectedProduct ? selectedProduct.name : (selectedBrand ? selectedBrand.name : 'Marcas')}
                        </h1>
                        <p style={{ opacity: 0.5, fontWeight: '500' }}>
                            {selectedProduct ? `Modelos de ${selectedProduct.name}` : (selectedBrand ? `Productos de la marca ${selectedBrand.name}` : 'Gestión de catálogo: Marcas')}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchBrands} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        className="btn btn-primary shadow-lg shadow-primary/20" 
                        onClick={() => {
                            if (selectedProduct) setIsProductModalOpen(true)
                            else if (selectedBrand) handleOpenModelModal()
                            else handleOpenModal()
                        }} 
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800', gap: '0.5rem' }}
                    >
                        <Plus size={20} /> NUEVO
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {selectedProduct ? (
                /* LEVEL 3: Modelos (DB Products) - LIST VIEW */
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.4)', borderRadius: '20px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                            <tr>
                                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Imagen</th>
                                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Modelo</th>
                                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>SKU / Código</th>
                                <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && modelProducts.length === 0 ? (
                                <tr><td colSpan="4" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando modelos...</td></tr>
                            ) : modelProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                                        <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                        <p>No hay modelos registrados para este producto</p>
                                    </td>
                                </tr>
                            ) : (
                                modelProducts.map(product => (
                                    <tr key={product.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary) / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <Package size={18} style={{ opacity: 0.2 }} />
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: '700' }}>{product.name}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{product.sku || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <button className="btn-icon" onClick={() => { setEditingProduct(product); setIsProductModalOpen(true); }} style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary) / 0.1)', border: 'none', cursor: 'pointer' }}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button className="btn-icon" onClick={() => handleDeleteProduct(product.id)} style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--destructive))', backgroundColor: 'hsl(var(--destructive) / 0.1)', border: 'none', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : selectedBrand ? (
                /* LEVEL 2: Productos (DB Models) */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {loading && brandModels.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando productos...</div>
                    ) : brandModels.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>No hay productos registrados para esta marca</p>
                        </div>
                    ) : (
                        brandModels.map(model => (
                            <div 
                                key={model.id} 
                                className="card hover:shadow-lg transition-all" 
                                style={{ 
                                    padding: '1.25rem', 
                                    borderRadius: '20px', 
                                    border: '1px solid hsl(var(--border) / 0.4)', 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center', 
                                    backgroundColor: 'white',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setSelectedProduct(model)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '45px', height: '45px', borderRadius: '12px', backgroundColor: 'hsl(var(--secondary) / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Package size={22} style={{ opacity: 0.4 }} />
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{model.name}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleOpenModelModal(model)} className="btn-icon" style={{ padding: '0.5rem', borderRadius: '10px', color: 'hsl(var(--primary))', border: 'none', cursor: 'pointer', backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDeleteModel(model.id)} className="btn-icon" style={{ padding: '0.5rem', borderRadius: '10px', color: 'hsl(var(--destructive))', border: 'none', cursor: 'pointer', backgroundColor: 'hsl(var(--destructive) / 0.05)' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* LEVEL 1: Marcas (DB Brands) */
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

            {/* Brand Modal */}
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

            {/* Model (Product) Modal */}
            {isModelModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'hsl(var(--background))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
                                {editingModel ? 'Editar' : 'Nuevo'} Producto
                            </h2>
                            <button onClick={() => setIsModelModalOpen(false)} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Nombre del Producto</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Ej: Galaxy S24..."
                                    style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '1rem' }}
                                    value={modelFormData.name}
                                    onChange={(e) => setModelFormData({ ...modelFormData, name: e.target.value })}
                                />
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                                <button onClick={() => setIsModelModalOpen(false)} className="btn" style={{ flex: 1, padding: '1rem', borderRadius: '14px', fontWeight: '700' }}>Cancelar</button>
                                <button
                                    onClick={handleSaveModel}
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

            {/* Product (Model) Modal */}
            {isProductModalOpen && (
                <ProductModal
                    onClose={() => {
                        setIsProductModalOpen(false)
                        setEditingProduct(null)
                        if (selectedProduct) fetchModelProducts(selectedProduct.id)
                        else if (selectedBrand) fetchBrandModels(selectedBrand.id)
                        else fetchBrands()
                    }}
                    onSave={handleSaveProduct}
                    isSaving={isSaving}
                    product={editingProduct ? { ...editingProduct, brand_id: selectedBrand.id, model_id: selectedProduct?.id } : { brand_id: selectedBrand.id, model_id: selectedProduct?.id }}
                />
            )}
        </div>
    )
}
