import React, { useState, useEffect } from 'react'
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    RefreshCw,
    Tags,
    Building2,
    Box,
    Layers,
    Save,
    X,
    AlertCircle
} from 'lucide-react'
import { inventoryService } from '../services/inventoryService'

export default function Classifications() {
    const [activeTab, setActiveTab] = useState('categories') // 'categories', 'brands', 'models'
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    // Specific data for Models view
    const [brands, setBrands] = useState([])

    // Form data
    const [formData, setFormData] = useState({ name: '', brand_id: '' })

    useEffect(() => {
        fetchData()
        if (activeTab === 'models') {
            fetchBrands()
        }
    }, [activeTab])

    const fetchData = async () => {
        try {
            setLoading(true)
            let data = []
            if (activeTab === 'categories') {
                data = await inventoryService.getCategories()
            } else if (activeTab === 'brands') {
                data = await inventoryService.getBrands()
            } else if (activeTab === 'models') {
                data = await inventoryService.getModels()
                // For models, we might want to join brands manually if the service doesn't return joined data
                // Or we update the service. The current service returns brand_id.
                // Let's assume we need to map brand names or fetch them.
                // Re-fetching brands to map names if needed.
            }
            setItems(data || [])
        } catch (error) {
            console.error('Error fetching data:', error)
            alert('Error al cargar datos')
        } finally {
            setLoading(false)
        }
    }

    const fetchBrands = async () => {
        try {
            const data = await inventoryService.getBrands()
            setBrands(data || [])
        } catch (error) {
            console.error('Error fetching brands:', error)
        }
    }

    const handleOpenModal = (item = null) => {
        setEditingItem(item)
        setFormData({
            name: item?.name || '',
            brand_id: item?.brand_id || (brands.length > 0 ? brands[0].id : '')
        })
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name.trim()) return alert('El nombre es requerido')
        if (activeTab === 'models' && !formData.brand_id) return alert('La marca es requerida')

        try {
            setIsSaving(true)
            if (activeTab === 'categories') {
                if (editingItem) await inventoryService.updateCategory(editingItem.id, formData.name)
                else await inventoryService.createCategory(formData.name)
            } else if (activeTab === 'brands') {
                if (editingItem) await inventoryService.updateBrand(editingItem.id, formData.name)
                else await inventoryService.createBrand(formData.name)
            } else if (activeTab === 'models') {
                if (editingItem) await inventoryService.updateModel(editingItem.id, formData.name, formData.brand_id)
                else await inventoryService.createModel(formData.name, formData.brand_id)
            }
            setIsModalOpen(false)
            fetchData()
        } catch (error) {
            console.error('Error saving:', error)
            alert('Error al guardar: ' + error.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este elemento?')) return
        try {
            setLoading(true)
            if (activeTab === 'categories') await inventoryService.deleteCategory(id)
            else if (activeTab === 'brands') await inventoryService.deleteBrand(id)
            else if (activeTab === 'models') await inventoryService.deleteModel(id)
            fetchData()
        } catch (error) {
            console.error('Error deleting:', error)
            alert('Error al eliminar: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Helper to get brand name for models view
    const getBrandName = (brandId) => {
        const brand = brands.find(b => b.id === brandId)
        return brand ? brand.name : 'Desconocida'
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>Clasificaciones</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Gestión de catálogo: Categorías, Marcas y Modelos</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchData} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn btn-primary shadow-lg shadow-primary/20" onClick={() => handleOpenModal()} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800', gap: '0.5rem' }}>
                        <Plus size={20} /> NUEVO
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', paddingBottom: '0.5rem' }}>
                {[
                    { id: 'categories', label: 'Categorías', icon: <Tags size={18} /> },
                    { id: 'brands', label: 'Marcas', icon: <Building2 size={18} /> },
                    { id: 'models', label: 'Modelos', icon: <Box size={18} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '12px',
                            border: 'none',
                            backgroundColor: activeTab === tab.id ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                            color: activeTab === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                            fontWeight: activeTab === tab.id ? '800' : '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            bottom: '-1px',
                            borderBottom: activeTab === tab.id ? '2px solid hsl(var(--primary))' : '2px solid transparent'
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)' }}>
                {/* Search */}
                <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                    <input
                        type="text"
                        placeholder={`Buscar ${activeTab === 'categories' ? 'categorías' : activeTab === 'brands' ? 'marcas' : 'modelos'}...`}
                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', backgroundColor: 'hsl(var(--secondary) / 0.4)', borderRadius: '14px', border: 'none', fontSize: '0.95rem', outline: 'none' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* List */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                    {loading && items.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando...</div>
                    ) : filteredItems.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
                            <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p>No se encontraron resultados</p>
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <div key={item.id} className="card hover:shadow-md transition-shadow" style={{ padding: '1.25rem', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>{item.name}</h3>
                                    {activeTab === 'models' && (
                                        <span style={{ fontSize: '0.75rem', opacity: 0.6, display: 'block', marginTop: '0.25rem' }}>
                                            {getBrandName(item.brand_id)}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleOpenModal(item)} className="btn hover:bg-secondary" style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--primary))' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} className="btn hover:bg-destructive/10" style={{ padding: '0.5rem', borderRadius: '8px', color: 'hsl(var(--destructive))' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="card shadow-2xl" style={{ width: '100%', maxWidth: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'hsl(var(--background))' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>
                                {editingItem ? 'Editar' : 'Nuevo'} {activeTab === 'categories' ? 'Categoría' : activeTab === 'brands' ? 'Marca' : 'Modelo'}
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

                            {activeTab === 'models' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Marca</label>
                                    <select
                                        style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid hsl(var(--border))', fontSize: '1rem' }}
                                        value={formData.brand_id}
                                        onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                                    >
                                        <option value="">Seleccionar Marca</option>
                                        {brands.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
        </div>
    )
}
