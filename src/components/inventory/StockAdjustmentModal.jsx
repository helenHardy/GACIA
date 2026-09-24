import React, { useState, useEffect, useMemo } from 'react'
import { X, Save, Search, Loader2, AlertCircle, Package, Building2, ArrowUpDown, ClipboardList, TrendingUp, TrendingDown, Scale } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../../context/BranchContext'

const ADJUSTMENT_TYPES = [
    { value: 'INCREMENTO', label: 'Incremento', hint: 'Mercadería encontrada, devolución o corrección al alza' },
    { value: 'DECREMENTO', label: 'Decremento', hint: 'Merma, daño, robo o corrección a la baja' },
    { value: 'RECALIBRACION', label: 'Recalibración', hint: 'Registro del stock contado físicamente' }
]

const REASONS = [
    { value: 'CONTEO_FISICO', label: 'Conteo físico' },
    { value: 'MERMA', label: 'Merma' },
    { value: 'DANO', label: 'Daño' },
    { value: 'ROBO_PERDIDA', label: 'Robo / Pérdida' },
    { value: 'VENCIMIENTO', label: 'Vencimiento' },
    { value: 'ERROR_CAPTURA', label: 'Error de captura' },
    { value: 'OTRO', label: 'Otro' }
]

export default function StockAdjustmentModal({ product: initialProduct, onClose, onCreated }) {
    const { selectedBranchId, branches } = useBranch()

    const [products, setProducts] = useState([])
    const [selectedProduct, setSelectedProduct] = useState(initialProduct || null)
    const [productSearch, setProductSearch] = useState('')
    const [searching, setSearching] = useState(false)

    const [adjustmentType, setAdjustmentType] = useState('INCREMENTO')
    const [reason, setReason] = useState('CONTEO_FISICO')
    const [reasonDetail, setReasonDetail] = useState('')
    const [quantity, setQuantity] = useState('')
    const [countedStock, setCountedStock] = useState('')
    const [notes, setNotes] = useState('')

    const [error, setError] = useState(null)
    const [isSaving, setIsSaving] = useState(false)

    const branch = branches.find(b => String(b.id) === String(selectedBranchId))
    const branchLabel = branch?.name || 'Sucursal activa'

    useEffect(() => {
        if (initialProduct) setSelectedProduct(initialProduct)
    }, [initialProduct])

    useEffect(() => {
        if (!selectedProduct || productSearch) searchProducts(productSearch)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productSearch, selectedBranchId])

    async function searchProducts(term) {
        try {
            setSearching(true)
            let query = supabase
                .from('products')
                .select(`
                    id, name, sku, image_url, active,
                    brand:brands(name),
                    settings:product_branch_settings(branch_id, stock)
                `)
                .eq('active', true)
                .order('name')
                .limit(50)

            const { data, error } = await query
            if (error) throw error

            let list = data || []
            if (selectedBranchId && selectedBranchId !== 'all') {
                list = list.filter(p =>
                    (p.settings || []).some(s => String(s.branch_id) === String(selectedBranchId))
                )
            }
            if (term) {
                const t = term.toLowerCase()
                list = list.filter(p =>
                    (p.name || '').toLowerCase().includes(t) ||
                    (p.sku || '').toLowerCase().includes(t)
                )
            }
            setProducts(list)
        } catch (err) {
            console.error('Error searching products:', err)
        } finally {
            setSearching(false)
        }
    }

    const currentStock = useMemo(() => {
        if (!selectedProduct) return 0
        const settings = selectedProduct.settings || []
        if (selectedBranchId && selectedBranchId !== 'all') {
            const s = settings.find(x => String(x.branch_id) === String(selectedBranchId))
            return Number(s?.stock) || 0
        }
        return settings.reduce((acc, s) => acc + (Number(s.stock) || 0), 0)
    }, [selectedProduct, selectedBranchId])

    const parsedQuantity = parseFloat(quantity)
    const parsedCounted = parseFloat(countedStock)

    const quantityChange = useMemo(() => {
        if (adjustmentType === 'INCREMENTO') {
            return isNaN(parsedQuantity) ? null : Math.abs(parsedQuantity)
        }
        if (adjustmentType === 'DECREMENTO') {
            return isNaN(parsedQuantity) ? null : -Math.abs(parsedQuantity)
        }
        if (adjustmentType === 'RECALIBRACION') {
            if (isNaN(parsedCounted)) return null
            return parsedCounted - currentStock
        }
        return null
    }, [adjustmentType, parsedQuantity, parsedCounted, currentStock])

    const resultingStock = quantityChange === null ? currentStock : currentStock + quantityChange

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)

        if (!selectedBranchId || selectedBranchId === 'all') {
            return setError('Seleccione una sucursal específica para realizar el ajuste.')
        }
        if (!selectedProduct) {
            return setError('Debe seleccionar un producto.')
        }
        if (adjustmentType === 'RECALIBRACION') {
            if (countedStock === '' || isNaN(parsedCounted) || parsedCounted < 0) {
                return setError('Ingrese el stock contado físicamente (número mayor o igual a cero).')
            }
        } else {
            if (quantity === '' || isNaN(parsedQuantity) || parsedQuantity <= 0) {
                return setError('Ingrese una cantidad mayor a cero.')
            }
        }
        if (quantityChange === null || quantityChange === 0) {
            return setError('El ajuste no genera ningún cambio de stock (delta = 0).')
        }
        if (resultingStock < 0) {
            return setError(`Stock insuficiente. Disponible: ${currentStock}, Ajuste: ${quantityChange}.`)
        }
        if (reason === 'OTRO' && !reasonDetail.trim()) {
            return setError('Debe especificar el detalle del motivo cuando selecciona "Otro".')
        }

        try {
            setIsSaving(true)
            const { data, error: rpcError } = await supabase.rpc('create_stock_adjustment', {
                p_branch_id: Number(selectedBranchId),
                p_product_id: selectedProduct.id,
                p_adjustment_type: adjustmentType,
                p_reason: reason,
                p_reason_detail: reason === 'OTRO' ? reasonDetail.trim() : null,
                p_quantity: adjustmentType !== 'RECALIBRACION' ? Math.abs(parsedQuantity) : null,
                p_counted_stock: adjustmentType === 'RECALIBRACION' ? parsedCounted : null,
                p_notes: notes.trim() || null
            })

            if (rpcError) throw new Error(rpcError.message)

            onCreated?.(data)
            onClose()
        } catch (err) {
            console.error('Error creating stock adjustment:', err)
            setError(err.message || 'No se pudo crear el ajuste de stock.')
        } finally {
            setIsSaving(false)
        }
    }

    const deltaColor = quantityChange === null || quantityChange === 0
        ? 'hsl(var(--foreground))'
        : quantityChange > 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))'

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            zIndex: 1000, overflowY: 'auto', padding: '2rem 1rem'
        }}>
            <div className="card shadow-2xl" style={{
                width: '100%', maxWidth: '640px', padding: 0,
                backgroundColor: 'hsl(var(--background))', borderRadius: '32px',
                border: '1px solid hsl(var(--border) / 0.8)',
                animation: 'modalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                margin: '0 auto 5rem auto'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 2rem', borderBottom: '1px solid hsl(var(--border) / 0.4)',
                    backgroundColor: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em', margin: 0 }}>
                            Ajustar Stock
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', opacity: 0.6 }}>
                            <Building2 size={14} />
                            <span style={{ fontWeight: '800', fontSize: '0.8rem' }}>{branchLabel}</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.4, padding: '0.5rem' }}>
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '1.5rem 2rem 2rem' }}>
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.85rem 1rem', borderRadius: '14px', marginBottom: '1.25rem',
                            backgroundColor: 'hsl(var(--destructive) / 0.08)',
                            border: '1px solid hsl(var(--destructive) / 0.25)',
                            color: 'hsl(var(--destructive))', fontWeight: '600', fontSize: '0.9rem'
                        }}>
                            <AlertCircle size={18} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Producto */}
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.5rem' }}>
                        Producto
                    </label>
                    {!selectedProduct ? (
                        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o SKU..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem',
                                    borderRadius: '14px', border: '1px solid hsl(var(--border) / 0.5)',
                                    backgroundColor: 'white', fontSize: '0.9rem', fontWeight: '600',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <div style={{
                                maxHeight: '220px', overflowY: 'auto', marginTop: '0.5rem',
                                border: '1px solid hsl(var(--border) / 0.4)', borderRadius: '14px',
                                backgroundColor: 'white', padding: '0.4rem'
                            }}>
                                {searching ? (
                                    <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                                        <Loader2 size={20} className="animate-spin" style={{ opacity: 0.3, margin: '0 auto' }} />
                                    </div>
                                ) : products.length === 0 ? (
                                    <p style={{ padding: '1rem', margin: 0, opacity: 0.4, fontWeight: '700', fontSize: '0.85rem', textAlign: 'center' }}>
                                        Sin resultados
                                    </p>
                                ) : (
                                    products.map(p => {
                                        const stock = (p.settings || [])
                                            .filter(s => !selectedBranchId || selectedBranchId === 'all' || String(s.branch_id) === String(selectedBranchId))
                                            .reduce((a, s) => a + (Number(s.stock) || 0), 0)
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedProduct(p)
                                                    setProductSearch('')
                                                }}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                    padding: '0.65rem 0.85rem', borderRadius: '10px', border: 'none',
                                                    backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.4)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '8px',
                                                    backgroundColor: 'hsl(var(--secondary) / 0.4)', overflow: 'hidden',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                }}>
                                                    {p.image_url
                                                        ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : <Package size={16} style={{ opacity: 0.2 }} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: '800', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {p.name}
                                                    </p>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '700', opacity: 0.4 }}>
                                                        SKU: {p.sku || '---'} · Stock: {stock}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                            borderRadius: '16px', border: '1px solid hsl(var(--primary) / 0.25)',
                            backgroundColor: 'hsl(var(--primary) / 0.04)', marginBottom: '1.25rem'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: 'hsl(var(--secondary) / 0.4)', overflow: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                {selectedProduct.image_url
                                    ? <img src={selectedProduct.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <Package size={22} style={{ opacity: 0.2 }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: '900', fontSize: '1rem' }}>{selectedProduct.name}</p>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', opacity: 0.5 }}>
                                    SKU: {selectedProduct.sku || '---'}
                                    {selectedProduct.brand?.name ? ` · ${selectedProduct.brand.name}` : ''}
                                </span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.45 }}>Stock actual</p>
                                <p style={{ margin: '0.15rem 0 0', fontSize: '1.5rem', fontWeight: '900' }}>{currentStock}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedProduct(null)}
                                title="Cambiar producto"
                                style={{
                                    padding: '0.4rem', borderRadius: '8px', border: 'none',
                                    backgroundColor: 'hsl(var(--secondary) / 0.6)', cursor: 'pointer'
                                }}
                            >
                                <Search size={16} />
                            </button>
                        </div>
                    )}

                    {/* Tipo de ajuste */}
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.5rem' }}>
                        Tipo de ajuste
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                        {ADJUSTMENT_TYPES.map(t => {
                            const active = adjustmentType === t.value
                            const Icon = t.value === 'INCREMENTO' ? TrendingUp : t.value === 'DECREMENTO' ? TrendingDown : Scale
                            return (
                                <button
                                    key={t.value}
                                    type="button"
                                    title={t.hint}
                                    onClick={() => setAdjustmentType(t.value)}
                                    style={{
                                        padding: '0.75rem 0.5rem', borderRadius: '14px', cursor: 'pointer',
                                        border: active ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.5)',
                                        backgroundColor: active ? 'hsl(var(--primary) / 0.08)' : 'white',
                                        color: active ? 'hsl(var(--primary))' : 'inherit',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                                        fontWeight: '800', fontSize: '0.75rem'
                                    }}
                                >
                                    <Icon size={18} />
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Motivo */}
                    <div style={{ display: 'grid', gridTemplateColumns: reason === 'OTRO' ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.5rem' }}>
                                Motivo
                            </label>
                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                style={{
                                    width: '100%', padding: '0.75rem 1rem', borderRadius: '14px',
                                    border: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'white',
                                    fontSize: '0.9rem', fontWeight: '700', boxSizing: 'border-box'
                                }}
                            >
                                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        {reason === 'OTRO' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.5rem' }}>
                                    Detalle del motivo
                                </label>
                                <input
                                    type="text"
                                    value={reasonDetail}
                                    onChange={(e) => setReasonDetail(e.target.value)}
                                    placeholder="Describa el motivo..."
                                    maxLength={200}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem', borderRadius: '14px',
                                        border: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'white',
                                        fontSize: '0.9rem', fontWeight: '600', boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Cantidad / Conteo */}
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.5rem' }}>
                        {adjustmentType === 'RECALIBRACION' ? 'Stock contado físicamente' : 'Cantidad a ajustar'}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', borderRadius: '12px', border: '1px solid hsl(var(--border) / 0.5)', padding: '0.25rem' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (adjustmentType === 'RECALIBRACION') {
                                        setCountedStock(String(Math.max(0, (parseFloat(countedStock) || 0) - 1)))
                                    } else {
                                        setQuantity(String(Math.max(0, (parseFloat(quantity) || 0) - 1)))
                                    }
                                }}
                                style={{ width: '36px', height: '36px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}
                            >-</button>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={adjustmentType === 'RECALIBRACION' ? countedStock : quantity}
                                onChange={(e) => {
                                    if (adjustmentType === 'RECALIBRACION') setCountedStock(e.target.value)
                                    else setQuantity(e.target.value)
                                }}
                                placeholder="0"
                                style={{
                                    width: '110px', textAlign: 'center', fontWeight: '900', fontSize: '1.15rem',
                                    border: 'none', background: 'none', outline: 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (adjustmentType === 'RECALIBRACION') {
                                        setCountedStock(String((parseFloat(countedStock) || 0) + 1))
                                    } else {
                                        setQuantity(String((parseFloat(quantity) || 0) + 1))
                                    }
                                }}
                                style={{ width: '36px', height: '36px', border: 'none', background: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}
                            >+</button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', opacity: 0.45, flex: 1 }}>
                            {adjustmentType === 'RECALIBRACION'
                                ? 'Escriba cuántas unidades hay en la estantería.'
                                : adjustmentType === 'INCREMENTO'
                                    ? 'Unidades a sumar al stock.'
                                    : 'Unidades a restar del stock.'}
                        </p>
                    </div>

                    {/* Preview del impacto */}
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center',
                        padding: '1rem 1.25rem', borderRadius: '16px', marginBottom: '1.25rem',
                        backgroundColor: 'hsl(var(--secondary) / 0.35)', border: '1px solid hsl(var(--border) / 0.4)'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.45 }}>Actual</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '1.4rem', fontWeight: '900', opacity: 0.6 }}>{currentStock}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <ArrowUpDown size={16} style={{ opacity: 0.3 }} />
                            <span style={{ fontWeight: '900', fontSize: '1.1rem', color: deltaColor }}>
                                {quantityChange === null ? '—' : (quantityChange > 0 ? '+' : '') + quantityChange}
                            </span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '900', textTransform: 'uppercase', opacity: 0.45 }}>Resultado</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '1.4rem', fontWeight: '900', color: deltaColor }}>
                                {resultingStock}
                            </p>
                        </div>
                    </div>

                    {/* Notas */}
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '0.5rem' }}>
                        Notas (opcional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        maxLength={500}
                        placeholder="Observaciones adicionales..."
                        style={{
                            width: '100%', padding: '0.75rem 1rem', borderRadius: '14px',
                            border: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'white',
                            fontSize: '0.9rem', fontWeight: '600', resize: 'vertical',
                            boxSizing: 'border-box', fontFamily: 'inherit'
                        }}
                    />

                    <p style={{
                        margin: '1rem 0 1.25rem', fontSize: '0.75rem', fontWeight: '600',
                        opacity: 0.5, display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}>
                        <ClipboardList size={14} />
                        El ajuste quedará en estado <strong>PENDIENTE</strong> hasta su aprobación.
                    </p>

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '0.75rem 1.5rem', borderRadius: '14px',
                                border: '2px solid hsl(var(--border))', backgroundColor: 'white',
                                fontWeight: '900', cursor: 'pointer'
                            }}
                        >
                            CANCELAR
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !selectedProduct}
                            style={{
                                padding: '0.75rem 2rem', borderRadius: '14px', border: 'none',
                                backgroundColor: 'hsl(var(--primary))', color: 'white',
                                fontWeight: '1000', fontSize: '1rem', cursor: 'pointer',
                                boxShadow: '0 8px 20px -6px hsl(var(--primary) / 0.4)',
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                opacity: isSaving || !selectedProduct ? 0.6 : 1
                            }}
                        >
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                            ENVIAR A APROBACIÓN
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes modalFadeIn {
                    from { opacity: 0; transform: translateY(40px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                input[type=number]::-webkit-inner-spin-button,
                input[type=number]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
        </div>
    )
}
