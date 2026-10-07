import React, { useState, useEffect, useCallback } from 'react'
import { X, RefreshCcw, AlertCircle, CheckCircle, XCircle, Package, Filter, TrendingUp, TrendingDown, Scale, Clock, Ban, ExternalLink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useBranch } from '../../context/BranchContext'

const STATUS_CONFIG = {
    PENDIENTE: { label: 'Pendiente', bg: 'hsl(38 92% 50% / 0.12)', color: 'hsl(38 92% 35%)', icon: Clock },
    APROBADO: { label: 'Aprobado', bg: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 30%)', icon: CheckCircle },
    RECHAZADO: { label: 'Rechazado', bg: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 50%)', icon: XCircle },
    CANCELADO: { label: 'Cancelado', bg: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))', icon: Ban }
}

const TYPE_CONFIG = {
    INCREMENTO: { label: 'Incremento', icon: TrendingUp, color: 'hsl(142 76% 36%)' },
    DECREMENTO: { label: 'Decremento', icon: TrendingDown, color: 'hsl(var(--destructive))' },
    RECALIBRACION: { label: 'Recalibración', icon: Scale, color: 'hsl(217 91% 60%)' }
}

const REASON_LABELS = {
    CONTEO_FISICO: 'Conteo físico',
    MERMA: 'Merma',
    DANO: 'Daño',
    ROBO_PERDIDA: 'Robo / Pérdida',
    VENCIMIENTO: 'Vencimiento',
    ERROR_CAPTURA: 'Error de captura',
    OTRO: 'Otro'
}

export default function StockAdjustmentsDrawer({ onClose, onChanged }) {
    const { selectedBranchId } = useBranch()
    const [adjustments, setAdjustments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [statusFilter, setStatusFilter] = useState('TODOS')
    const [actionId, setActionId] = useState(null)
    const [rejectTarget, setRejectTarget] = useState(null)
    const [rejectReason, setRejectReason] = useState('')
    const [actionError, setActionError] = useState(null)

    const fetchAdjustments = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            let query = supabase
                .from('stock_adjustments')
                .select(`
                    *,
                    product:products(name, sku),
                    branch:branches(name)
                `)
                .order('created_at', { ascending: false })
                .limit(100)

            if (selectedBranchId && selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            const { data, error: err } = await query
            if (err) throw new Error('No se pudo cargar el historial de ajustes.')

            setAdjustments(data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [selectedBranchId])

    useEffect(() => {
        fetchAdjustments()
    }, [fetchAdjustments])

    async function handleApprove(adj) {
        if (!window.confirm(`¿Aprobar el ajuste ${adj.folio}? Se aplicará el cambio de stock de forma irreversible.`)) return
        try {
            setActionId(adj.id)
            setActionError(null)
            const { error: rpcError } = await supabase.rpc('approve_stock_adjustment', {
                p_adjustment_id: adj.id
            })
            if (rpcError) throw new Error(rpcError.message)
            await fetchAdjustments()
            onChanged?.()
        } catch (err) {
            setActionError(err.message || 'No se pudo aprobar el ajuste.')
        } finally {
            setActionId(null)
        }
    }

    async function handleReject() {
        if (!rejectTarget) return
        if (!rejectReason.trim()) {
            setActionError('Debe indicar el motivo del rechazo.')
            return
        }
        try {
            setActionId(rejectTarget.id)
            setActionError(null)
            const { error: rpcError } = await supabase.rpc('reject_stock_adjustment', {
                p_adjustment_id: rejectTarget.id,
                p_rejection_reason: rejectReason.trim()
            })
            if (rpcError) throw new Error(rpcError.message)
            setRejectTarget(null)
            setRejectReason('')
            await fetchAdjustments()
            onChanged?.()
        } catch (err) {
            setActionError(err.message || 'No se pudo rechazar el ajuste.')
        } finally {
            setActionId(null)
        }
    }

    async function handleCancel(adj) {
        if (!window.confirm(`¿Cancelar el ajuste ${adj.folio}? No se aplicará ningún cambio.`)) return
        try {
            setActionId(adj.id)
            setActionError(null)
            const { error: rpcError } = await supabase.rpc('cancel_stock_adjustment', {
                p_adjustment_id: adj.id
            })
            if (rpcError) throw new Error(rpcError.message)
            await fetchAdjustments()
            onChanged?.()
        } catch (err) {
            setActionError(err.message || 'No se pudo cancelar el ajuste.')
        } finally {
            setActionId(null)
        }
    }

    const pendingCount = adjustments.filter(a => a.status === 'PENDIENTE').length

    const filtered = statusFilter === 'TODOS'
        ? adjustments
        : adjustments.filter(a => a.status === statusFilter)

    return (
        <div
            style={{
                position: 'fixed', top: 0, right: 0, width: '100vw', height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                display: 'flex', justifyContent: 'flex-end', zIndex: 150
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: '520px', height: '100%',
                    backgroundColor: 'white', display: 'flex', flexDirection: 'column',
                    animation: 'slideIn 0.3s ease-out', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <style>{`
                    @keyframes slideIn {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                `}</style>

                {/* Header */}
                <div style={{
                    padding: '1.5rem 1.75rem', borderBottom: '1px solid hsl(var(--border) / 0.4)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(180deg, hsl(var(--primary) / 0.03) 0%, transparent 100%)'
                }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>
                            Historial de Ajustes
                        </h2>
                        <p style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.5, margin: '0.15rem 0 0' }}>
                            {pendingCount > 0 ? `${pendingCount} pendiente(s) de aprobación` : 'Sin ajustes pendientes'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ padding: '0.5rem', borderRadius: '10px', border: 'none', backgroundColor: 'hsl(var(--secondary) / 0.5)', cursor: 'pointer' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filtros */}
                <div style={{
                    padding: '0.85rem 1.75rem', display: 'flex', gap: '0.4rem',
                    borderBottom: '1px solid hsl(var(--border) / 0.3)', overflowX: 'auto',
                    alignItems: 'center'
                }}>
                    <Filter size={14} style={{ opacity: 0.35, flexShrink: 0 }} />
                    {['TODOS', 'PENDIENTE', 'APROBADO', 'RECHAZADO', 'CANCELADO'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            style={{
                                padding: '0.35rem 0.85rem', borderRadius: '100px', border: 'none',
                                fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap',
                                backgroundColor: statusFilter === s ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                                color: statusFilter === s ? 'white' : 'inherit'
                            }}
                        >
                            {s === 'TODOS' ? 'Todos' : STATUS_CONFIG[s].label}
                        </button>
                    ))}
                </div>

                {actionError && (
                    <div style={{
                        margin: '0.75rem 1.75rem 0', padding: '0.7rem 1rem', borderRadius: '12px',
                        backgroundColor: 'hsl(var(--destructive) / 0.08)',
                        border: '1px solid hsl(var(--destructive) / 0.25)',
                        color: 'hsl(var(--destructive))', fontWeight: '600', fontSize: '0.8rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        {actionError}
                    </div>
                )}

                {/* Lista */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.75rem' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <RefreshCcw size={32} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                            <p style={{ marginTop: '1rem', fontWeight: '700', opacity: 0.4 }}>Cargando...</p>
                        </div>
                    ) : error ? (
                        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '16px' }}>
                            <AlertCircle size={40} style={{ margin: '0 auto 1rem', color: 'hsl(var(--destructive))', opacity: 0.5 }} />
                            <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>{error}</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.1 }} />
                            <p style={{ fontWeight: '800', opacity: 0.3, fontSize: '0.9rem' }}>Sin ajustes registrados</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {filtered.map(adj => {
                                const st = STATUS_CONFIG[adj.status] || STATUS_CONFIG.PENDIENTE
                                const tp = TYPE_CONFIG[adj.adjustment_type] || TYPE_CONFIG.INCREMENTO
                                const StatusIcon = st.icon
                                const TypeIcon = tp.icon
                                const delta = Number(adj.quantity_change) || 0
                                const isBusy = actionId === adj.id
                                const product = adj.product
                                const branch = adj.branch

                                return (
                                    <div key={adj.id} style={{
                                        padding: '1rem 1.15rem', borderRadius: '16px',
                                        border: '1px solid hsl(var(--border) / 0.35)',
                                        backgroundColor: adj.status === 'PENDIENTE' ? 'hsl(38 92% 50% / 0.03)' : 'white'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: '900', letterSpacing: '0.04em',
                                                        color: 'hsl(var(--primary))'
                                                    }}>{adj.folio}</span>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        padding: '0.15rem 0.55rem', borderRadius: '100px',
                                                        fontSize: '0.65rem', fontWeight: '800',
                                                        backgroundColor: st.bg, color: st.color
                                                    }}>
                                                        <StatusIcon size={11} />
                                                        {st.label}
                                                    </span>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                        padding: '0.15rem 0.55rem', borderRadius: '100px',
                                                        fontSize: '0.65rem', fontWeight: '800',
                                                        backgroundColor: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))'
                                                    }}>
                                                        <TypeIcon size={11} />
                                                        {tp.label}
                                                    </span>
                                                </div>
                                                <p style={{ margin: '0.45rem 0 0', fontWeight: '800', fontSize: '0.95rem' }}>
                                                    {product?.name || 'Producto'}
                                                </p>
                                                <p style={{ margin: '0.15rem 0 0', fontSize: '0.7rem', fontWeight: '600', opacity: 0.45 }}>
                                                    SKU: {product?.sku || '---'}
                                                    {branch?.name ? ` · ${branch.name}` : ''} · {REASON_LABELS[adj.reason] || adj.reason}
                                                    {adj.reason_detail ? ` (${adj.reason_detail})` : ''}
                                                </p>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <p style={{
                                                    margin: 0, fontSize: '1.25rem', fontWeight: '900', color: tp.color,
                                                    letterSpacing: '-0.02em'
                                                }}>
                                                    {delta > 0 ? '+' : ''}{delta}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '800', opacity: 0.4 }}>
                                                    {adj.previous_stock} → {Number(adj.previous_stock) + delta}
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{
                                            marginTop: '0.65rem', paddingTop: '0.65rem',
                                            borderTop: '1px dashed hsl(var(--border) / 0.4)',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
                                            flexWrap: 'wrap'
                                        }}>
                                            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '700', opacity: 0.4 }}>
                                                {new Date(adj.requested_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                {' '}· {new Date(adj.requested_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                                {adj.approved_at ? ` · Aprobado ${new Date(adj.approved_at).toLocaleDateString('es', { day: '2-digit', month: 'short' })}` : ''}
                                            </p>

                                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                {adj.status === 'APROBADO' && (
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                        fontSize: '0.65rem', fontWeight: '800', color: 'hsl(var(--primary))'
                                                    }}>
                                                        <ExternalLink size={11} />
                                                        Ver en Kardex
                                                    </span>
                                                )}
                                                {adj.status === 'PENDIENTE' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleCancel(adj)}
                                                            disabled={actionId !== null}
                                                            style={{
                                                                padding: '0.4rem 0.85rem', borderRadius: '10px',
                                                                border: '1px solid hsl(var(--border))',
                                                                backgroundColor: 'white',
                                                                color: 'hsl(var(--secondary-foreground))',
                                                                fontWeight: '800', fontSize: '0.7rem', cursor: 'pointer',
                                                                opacity: actionId ? 0.5 : 1
                                                            }}
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setRejectTarget(adj)
                                                                setRejectReason('')
                                                                setActionError(null)
                                                            }}
                                                            disabled={actionId !== null}
                                                            style={{
                                                                padding: '0.4rem 0.85rem', borderRadius: '10px',
                                                                border: '1px solid hsl(var(--destructive) / 0.4)',
                                                                backgroundColor: 'white', color: 'hsl(var(--destructive))',
                                                                fontWeight: '800', fontSize: '0.7rem', cursor: 'pointer',
                                                                opacity: actionId ? 0.5 : 1
                                                            }}
                                                        >
                                                            Rechazar
                                                        </button>
                                                        <button
                                                            onClick={() => handleApprove(adj)}
                                                            disabled={actionId !== null}
                                                            style={{
                                                                padding: '0.4rem 0.85rem', borderRadius: '10px',
                                                                border: 'none', backgroundColor: 'hsl(var(--primary))',
                                                                color: 'white', fontWeight: '800', fontSize: '0.7rem',
                                                                cursor: 'pointer', opacity: actionId ? 0.5 : 1,
                                                                display: 'flex', alignItems: 'center', gap: '0.3rem'
                                                            }}
                                                        >
                                                            {isBusy ? <RefreshCcw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                                            Aprobar
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {adj.rejection_reason && adj.status === 'RECHAZADO' && (
                                            <p style={{
                                                margin: '0.5rem 0 0', fontSize: '0.7rem', fontWeight: '700',
                                                color: 'hsl(var(--destructive))', opacity: 0.85
                                            }}>
                                                Rechazo: {adj.rejection_reason}
                                            </p>
                                        )}
                                        {adj.notes && (
                                            <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', fontWeight: '600', opacity: 0.45 }}>
                                                Notas: {adj.notes}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Modal de rechazo */}
                {rejectTarget && (
                    <div style={{
                        position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: '1.5rem'
                    }}>
                        <div style={{
                            width: '100%', maxWidth: '360px', backgroundColor: 'white',
                            borderRadius: '20px', padding: '1.5rem', boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
                        }}>
                            <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: '900' }}>
                                Rechazar ajuste
                            </h3>
                            <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', fontWeight: '600', opacity: 0.55 }}>
                                {rejectTarget.folio} — indique el motivo del rechazo.
                            </p>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={3}
                                maxLength={300}
                                placeholder="Motivo del rechazo..."
                                style={{
                                    width: '100%', padding: '0.7rem 0.9rem', borderRadius: '12px',
                                    border: '1px solid hsl(var(--border) / 0.5)', fontSize: '0.85rem',
                                    fontWeight: '600', resize: 'vertical', boxSizing: 'border-box',
                                    fontFamily: 'inherit', marginBottom: '1rem'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setRejectTarget(null); setRejectReason(''); setActionError(null) }}
                                    style={{
                                        padding: '0.55rem 1rem', borderRadius: '10px',
                                        border: '1px solid hsl(var(--border))', backgroundColor: 'white',
                                        fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer'
                                    }}
                                >
                                    Volver
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={actionId !== null || !rejectReason.trim()}
                                    style={{
                                        padding: '0.55rem 1rem', borderRadius: '10px', border: 'none',
                                        backgroundColor: 'hsl(var(--destructive))', color: 'white',
                                        fontWeight: '800', fontSize: '0.8rem',
                                        cursor: 'pointer', opacity: actionId || !rejectReason.trim() ? 0.5 : 1
                                    }}
                                >
                                    Confirmar rechazo
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
