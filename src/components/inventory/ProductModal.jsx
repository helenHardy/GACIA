import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, Building2, Plus, Image as ImageIcon, Trash2, Tag, Info, Package, Barcode, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { inventoryService } from '../../services/inventoryService'

export default function ProductModal({ product, onClose, onSave, isSaving, currencySymbol = 'Bs.' }) {
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        category_id: '',
        brand_id: '',
        model_id: '',
        description: '',
        price: 0,
        image_url: ''
    })
    const [categories, setCategories] = useState([])
    const [brands, setBrands] = useState([])
    const [models, setModels] = useState([])
    const [isAddingCategory, setIsAddingCategory] = useState(false)
    const [isAddingBrand, setIsAddingBrand] = useState(false)
    const [isAddingModel, setIsAddingModel] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newBrandName, setNewBrandName] = useState('')
    const [newModelName, setNewModelName] = useState('')
    const [uploadingImage, setUploadingImage] = useState(false)
    const [branchSettings, setBranchSettings] = useState([])
    const [branches, setBranches] = useState([])
    const [loadingBranches, setLoadingBranches] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchInitialData()
    }, [])

    async function fetchInitialData() {
        try {
            const [branchesData, brandsData, categoriesData] = await Promise.all([
                supabase.from('branches').select('*').eq('active', true),
                inventoryService.getBrands(),
                inventoryService.getCategories()
            ])
            setBranches(branchesData.data || [])
            setBrands(brandsData || [])
            setCategories(categoriesData || [])
        } catch (err) {
            console.error('Error fetching initial data:', err)
        } finally {
            setLoadingBranches(false)
        }
    }

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                sku: product.sku || '',
                category_id: product.category_id || '',
                brand_id: product.brand_id || '',
                model_id: product.model_id || '',
                description: product.description || '',
                price: product.price || 0,
                image_url: product.image_url || ''
            })
            fetchProductBranchSettings()
            if (product.brand_id) {
                fetchModels(product.brand_id)
            }
        }
    }, [product, branches])

    async function fetchModels(brandId) {
        try {
            const data = await inventoryService.getModels(brandId)
            setModels(data || [])
        } catch (err) {
            console.error('Error fetching models:', err)
        }
    }

    async function fetchProductBranchSettings() {
        if (!product) return
        try {
            const { data } = await supabase
                .from('product_branch_settings')
                .select('*')
                .eq('product_id', product.id)

            const settings = branches.map(branch => {
                const existing = data?.find(s => s.branch_id === branch.id)
                return {
                    branch_id: branch.id,
                    branch_name: branch.name,
                    stock: existing?.stock || 0,
                    min_stock: existing?.min_stock || 0,
                    price: existing?.price || null
                }
            })
            setBranchSettings(settings)
        } catch (err) {
            console.error('Error fetching settings:', err)
        }
    }

    useEffect(() => {
        if (!product && branches.length > 0) {
            setBranchSettings(branches.map(b => ({
                branch_id: b.id,
                branch_name: b.name,
                stock: 0,
                min_stock: 0,
                price: null
            })))
        }
    }, [branches, product])

    const handleChange = (e) => {
        const { name, value, type } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value
        }))
    }

    const handleBranchSettingChange = (branchId, field, value) => {
        setBranchSettings(prev => prev.map(s =>
            s.branch_id === branchId ? { ...s, [field]: parseFloat(value) || 0 } : s
        ))
    }

    const handleBrandChange = (e) => {
        const brandId = e.target.value
        setFormData(prev => ({ ...prev, brand_id: brandId, model_id: '' }))
        if (brandId) {
            fetchModels(brandId)
        } else {
            setModels([])
        }
    }

    const handleAddBrand = async () => {
        if (!newBrandName.trim()) return
        try {
            const brand = await inventoryService.createBrand(newBrandName.trim())
            setBrands(prev => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)))
            setFormData(prev => ({ ...prev, brand_id: brand.id }))
            setNewBrandName('')
            setIsAddingBrand(false)
            fetchModels(brand.id)
        } catch (err) {
            console.error(err)
            setError('Error al crear marca')
        }
    }

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return
        try {
            const category = await inventoryService.createCategory(newCategoryName.trim())
            setCategories(prev => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)))
            setFormData(prev => ({ ...prev, category_id: category.id }))
            setNewCategoryName('')
            setIsAddingCategory(false)
        } catch (err) {
            console.error(err)
            setError('Error al crear categoría')
        }
    }

    const handleAddModel = async () => {
        if (!newModelName.trim() || !formData.brand_id) return
        try {
            const model = await inventoryService.createModel(newModelName.trim(), formData.brand_id)
            setModels(prev => [...prev, model].sort((a, b) => a.name.localeCompare(b.name)))
            setFormData(prev => ({ ...prev, model_id: model.id }))
            setNewModelName('')
            setIsAddingModel(false)
        } catch (err) {
            console.error(err)
            setError('Error al crear modelo')
        }
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            setUploadingImage(true)
            const publicUrl = await inventoryService.uploadProductImage(file)
            setFormData(prev => ({ ...prev, image_url: publicUrl }))
        } catch (err) {
            console.error(err)
            setError('Error al subir imagen. Asegúrate de que el bucket "product-images" sea público.')
        } finally {
            setUploadingImage(false)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.name) {
            setError('El nombre del producto es obligatorio')
            return
        }

        const dataToSave = {
            ...formData,
            category_id: formData.category_id || null,
            brand_id: formData.brand_id || null,
            model_id: formData.model_id || null
        }

        onSave({ ...dataToSave, branch_settings: branchSettings })
    }

    // Modern styles objects
    const sectionTitleStyle = {
        fontSize: '0.875rem',
        fontWeight: '700',
        color: 'hsl(var(--primary))',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
    }

    const inputWrapperStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem'
    }

    const labelStyle = {
        fontSize: '0.75rem',
        fontWeight: '600',
        color: 'hsl(var(--secondary-foreground) / 0.8)'
    }

    const inputStyle = {
        width: '100%',
        padding: '0.6rem 0.8rem',
        borderRadius: '8px',
        border: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--background))',
        fontSize: '0.875rem',
        transition: 'all 0.2s ease',
        outline: 'none',
        ':focus': {
            borderColor: 'hsl(var(--primary))',
            boxShadow: '0 0 0 2px hsl(var(--primary) / 0.1)'
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%',
                maxWidth: '950px',
                padding: 0,
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'hsl(var(--background))',
                borderRadius: '16px',
                border: '1px solid hsl(var(--border))'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid hsl(var(--border))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'hsl(var(--secondary) / 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.5rem',
                            backgroundColor: 'hsl(var(--primary) / 0.1)',
                            color: 'hsl(var(--primary))',
                            borderRadius: '12px'
                        }}>
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                                {product ? 'Editar Producto' : 'Nuevo Producto'}
                            </h2>
                            <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>Gestione los detalles, stock y precios del inventario</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn" style={{ padding: '0.5rem', borderRadius: '50%' }} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                    {error && (
                        <div style={{ padding: '1rem', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid hsl(var(--destructive) / 0.2)' }}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>

                            {/* Left Column: Media & Primary Details */}
                            <div style={{ gridColumn: 'span 12', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>

                                <div style={{ gridColumn: 'span 4' }}>
                                    <h3 style={sectionTitleStyle}><ImageIcon size={18} /> Multimedia</h3>
                                    <div style={{
                                        width: '100%',
                                        aspectRatio: '1',
                                        backgroundColor: 'hsl(var(--secondary) / 0.3)',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px dashed hsl(var(--border))',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        {formData.image_url ? (
                                            <>
                                                <img src={formData.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '5px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                                                        className="shadow-lg"
                                                        style={{ backgroundColor: 'hsl(var(--destructive))', color: 'white', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                                <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                                                <p style={{ fontSize: '0.75rem', fontWeight: '500', opacity: 0.5 }}>Arrastra o haz clic para subir</p>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                        />
                                        {uploadingImage && (
                                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                                            </div>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '0.75rem', textAlign: 'center' }}>Formatos soportados: JPG, PNG, WebP (Máx 5MB)</p>
                                </div>

                                <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h3 style={sectionTitleStyle}><Info size={18} /> Información General</h3>

                                    <div style={inputWrapperStyle}>
                                        <label style={labelStyle}>Nombre del Producto</label>
                                        <input
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Ej: Camiseta Deportiva Pro"
                                            className="form-input"
                                            style={inputStyle}
                                            required
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div style={inputWrapperStyle}>
                                            <label style={labelStyle}>SKU / Código</label>
                                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                <Barcode size={16} style={{ position: 'absolute', left: '10px', opacity: 0.4 }} />
                                                <input
                                                    name="sku"
                                                    value={formData.sku}
                                                    onChange={handleChange}
                                                    placeholder="KOD-12345"
                                                    style={{ ...inputStyle, paddingLeft: '2.4rem' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={inputWrapperStyle}>
                                            <label style={labelStyle}>Precio Base Sugerido ({currencySymbol}) ({product ? 'Referencial' : 'Opcional'})</label>
                                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '10px', fontWeight: 'bold', opacity: 0.4 }}>{currencySymbol.includes('.') ? currencySymbol : currencySymbol + ' '}</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    name="price"
                                                    value={formData.price}
                                                    onChange={handleChange}
                                                    placeholder="0.00"
                                                    style={{ ...inputStyle, paddingLeft: currencySymbol.length > 2 ? '3.2rem' : '1.8rem' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={inputWrapperStyle}>
                                        <label style={labelStyle}>Descripción Detallada</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleChange}
                                            placeholder="Detalles sobre materiales, dimensiones, uso..."
                                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Middle Section: Categorization */}
                            <div style={{ gridColumn: 'span 12', padding: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderRadius: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>

                                <div style={inputWrapperStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={labelStyle}><Layers size={14} style={{ marginRight: 4 }} /> Categoría</label>
                                        <button type="button" onClick={() => setIsAddingCategory(true)} style={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>+ Nueva</button>
                                    </div>
                                    {isAddingCategory ? (
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Nombre..." />
                                            <button type="button" onClick={handleAddCategory} className="btn btn-primary" style={{ padding: '0 0.5rem' }}><Save size={16} /></button>
                                            <button type="button" onClick={() => setIsAddingCategory(false)} className="btn btn-secondary" style={{ padding: '0 0.5rem' }}><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <select name="category_id" value={formData.category_id} onChange={handleChange} style={inputStyle}>
                                            <option value="">Seleccionar...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div style={inputWrapperStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={labelStyle}><Tag size={14} style={{ marginRight: 4 }} /> Marca</label>
                                        <button type="button" onClick={() => setIsAddingBrand(true)} style={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>+ Nueva</button>
                                    </div>
                                    {isAddingBrand ? (
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <input autoFocus value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Nombre..." />
                                            <button type="button" onClick={handleAddBrand} className="btn btn-primary" style={{ padding: '0 0.5rem' }}><Save size={16} /></button>
                                            <button type="button" onClick={() => setIsAddingBrand(false)} className="btn btn-secondary" style={{ padding: '0 0.5rem' }}><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <select name="brand_id" value={formData.brand_id} onChange={handleBrandChange} style={inputStyle}>
                                            <option value="">Seleccionar...</option>
                                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div style={inputWrapperStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={labelStyle}><Layers size={14} style={{ marginRight: 4 }} /> Modelo</label>
                                        <button type="button" onClick={() => setIsAddingModel(true)} disabled={!formData.brand_id} style={{ fontSize: '0.7rem', color: formData.brand_id ? 'hsl(var(--primary))' : 'gray', border: 'none', background: 'none', cursor: formData.brand_id ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>+ Nuevo</button>
                                    </div>
                                    {isAddingModel ? (
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <input autoFocus value={newModelName} onChange={(e) => setNewModelName(e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Nombre..." />
                                            <button type="button" onClick={handleAddModel} className="btn btn-primary" style={{ padding: '0 0.5rem' }}><Save size={16} /></button>
                                            <button type="button" onClick={() => setIsAddingModel(false)} className="btn btn-secondary" style={{ padding: '0 0.5rem' }}><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <select name="model_id" value={formData.model_id} onChange={handleChange} disabled={!formData.brand_id} style={{ ...inputStyle, opacity: !formData.brand_id ? 0.6 : 1 }}>
                                            <option value="">{formData.brand_id ? 'Seleccionar...' : 'Elija Marca primero'}</option>
                                            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>


                            {/* Bottom Section: Branch Settings */}
                            <div style={{ gridColumn: 'span 12' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                    <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}><Building2 size={18} /> Stock y Precios por Sucursal</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                                        <input
                                            type="checkbox"
                                            id="manage_batches"
                                            checked={formData.manage_batches || false}
                                            onChange={(e) => setFormData(prev => ({ ...prev, manage_batches: e.target.checked }))}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="manage_batches" style={{ fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer' }}>Usar Lotes/Vencimientos</label>
                                    </div>
                                </div>

                                {loadingBranches ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={32} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} /></div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        {branchSettings.map(s => (
                                            <div key={s.branch_id} style={{ padding: '1.25rem', backgroundColor: 'hsl(var(--background))', borderRadius: '12px', border: '1px solid hsl(var(--border))', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.75rem' }}>
                                                    <Building2 size={16} style={{ opacity: 0.5 }} />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{s.branch_name}</span>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                                    <div style={inputWrapperStyle}>
                                                        <label style={labelStyle}>Stock</label>
                                                        <input
                                                            type="number"
                                                            value={s.stock}
                                                            readOnly
                                                            style={{ ...inputStyle, textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.5)', cursor: 'not-allowed', opacity: 0.7 }}
                                                        />
                                                    </div>
                                                    <div style={inputWrapperStyle}>
                                                        <label style={labelStyle}>Mínimo</label>
                                                        <input type="number" value={s.min_stock} onChange={(e) => handleBranchSettingChange(s.branch_id, 'min_stock', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                                                    </div>
                                                    <div style={inputWrapperStyle}>
                                                        <label style={labelStyle}>Precio ({currencySymbol})</label>
                                                        <input type="number" step="0.01" placeholder="Base" value={s.price || ''} onChange={(e) => handleBranchSettingChange(s.branch_id, 'price', e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div style={{
                            padding: '1.5rem 0',
                            borderTop: '1px solid hsl(var(--border))',
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'flex-end',
                            marginTop: '1rem'
                        }}>
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn btn-secondary"
                                disabled={isSaving}
                                style={{ padding: '0.75rem 2rem', fontWeight: '600' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isSaving}
                                style={{ padding: '0.75rem 3rem', fontWeight: '700', minWidth: '200px', display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        {product ? 'Guardar Cambios' : 'Crear Producto'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
