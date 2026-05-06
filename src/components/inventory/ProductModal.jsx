import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Loader2, Building2, Plus, Image as ImageIcon, Trash2, Tag, Info, Package, Barcode, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { inventoryService } from '../../services/inventoryService'

export default function ProductModal({ product, onClose, onSave, isSaving, currencySymbol = 'Bs.', readOnly = false }) {
    const [formData, setFormData] = useState({
        name: '',
        sku: '',
        brand_id: '',
        model_id: '',
        description: '',
        price: 0,
        image_url: '',
        active: true
    })
    const [uploadingImage, setUploadingImage] = useState(false)
    const [branchSettings, setBranchSettings] = useState([])
    const [branches, setBranches] = useState([])
    const [brands, setBrands] = useState([])
    const [models, setModels] = useState([])
    const [loadingBranches, setLoadingBranches] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchInitialData()
        fetchBrands()
    }, [])

    async function fetchInitialData() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const [branchesReq, profileReq, assignmentsReq] = await Promise.all([
                supabase.from('branches').select('*').eq('active', true),
                supabase.from('profiles').select('role').eq('id', user.id).single(),
                supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
            ])

            let allBranches = branchesReq.data || []
            const userRole = profileReq.data?.role
            const assignedBranchIds = (assignmentsReq.data || []).map(a => a.branch_id)

            if (userRole !== 'Administrador') {
                allBranches = allBranches.filter(b => assignedBranchIds.includes(b.id))
            }

            setBranches(allBranches)
        } catch (err) {
            console.error('Error fetching initial data:', err)
        } finally {
            setLoadingBranches(false)
        }
    }

    async function fetchBrands() {
        try {
            const data = await inventoryService.getBrands()
            setBrands(data || [])
        } catch (err) {
            console.error('Error fetching brands:', err)
        }
    }

    async function fetchModels(brandId) {
        if (!brandId) return
        try {
            const data = await inventoryService.getModelsByBrand(brandId)
            setModels(data || [])
        } catch (err) {
            console.error('Error fetching models:', err)
        }
    }

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name || '',
                sku: product.sku || '',
                brand_id: product.brand_id || '',
                model_id: product.model_id || '',
                description: product.description || '',
                price: product.price || 0,
                image_url: product.image_url || '',
                active: product.active ?? true
            })
            if (product.brand_id) {
                fetchModels(product.brand_id)
            }
            fetchProductBranchSettings()
        }
    }, [product, branches])

    async function fetchProductBranchSettings() {
        try {
            let data = []
            if (product?.id) {
                const { data: existingData, error } = await supabase
                    .from('product_branch_settings')
                    .select('*')
                    .eq('product_id', product.id)
                if (error) throw error
                data = existingData || []
            }

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
        setFormData(prev => {
            let val = type === 'number' ? parseFloat(value) || 0 : value
            if (type === 'number' && (name === 'price')) {
                val = Math.max(0, val)
            }
            return {
                ...prev,
                [name]: val
            }
        })
    }

    const handleBranchSettingChange = (branchId, field, value) => {
        setBranchSettings(prev => prev.map(s =>
            s.branch_id === branchId ? { ...s, [field]: Math.max(0, parseFloat(value) || 0) } : s
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
            sku: formData.sku?.trim() || null,
            brand_id: formData.brand_id || null,
            model_id: formData.model_id || null
        }

        onSave({ ...dataToSave, branch_settings: branchSettings })
    }

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
        outline: 'none'
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
                <div style={{
                    padding: '1.5rem 2rem',
                    borderBottom: '1px solid hsl(var(--border))',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'hsl(var(--secondary) / 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '12px' }}>
                            <Package size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
                                {product?.id ? 'Editar Modelo' : 'Nuevo Modelo'}
                            </h2>
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

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2rem' }}>
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
                                    position: 'relative'
                                }}>
                                    {formData.image_url ? (
                                        <>
                                            <img src={formData.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                                                style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'hsl(var(--destructive))', color: 'white', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <ImageIcon size={48} style={{ opacity: 0.2 }} />
                                        </div>
                                    )}
                                    {!readOnly && (
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                        />
                                    )}
                                </div>
                            </div>

                            <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <h3 style={sectionTitleStyle}><Info size={18} /> Información General</h3>
                                
                                <div style={inputWrapperStyle}>
                                    <label style={labelStyle}>Nombre del Modelo</label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        style={{ ...inputStyle, backgroundColor: readOnly ? 'hsl(var(--secondary) / 0.2)' : 'hsl(var(--background))' }}
                                        readOnly={readOnly}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div style={inputWrapperStyle}>
                                        <label style={labelStyle}>SKU / Código</label>
                                        <input
                                            name="sku"
                                            value={formData.sku}
                                            onChange={handleChange}
                                            style={inputStyle}
                                        />
                                    </div>
                                    <div style={inputWrapperStyle}>
                                        <label style={labelStyle}>Precio de Venta (Único)</label>
                                        <input
                                            name="price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.price}
                                            onChange={handleChange}
                                            onFocus={(e) => e.target.select()}
                                            style={{ ...inputStyle, fontWeight: '800', color: 'hsl(var(--primary))' }}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '1.5rem 0',
                            borderTop: '1px solid hsl(var(--border))',
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSaving}>Cancelar</button>
                            {!readOnly && (
                                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin" /> : (product?.id ? 'Guardar Cambios' : 'Crear Modelo')}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
