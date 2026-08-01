import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Search, RefreshCw, Download, Printer, Users, DollarSign, FileText, HandCoins, X, Phone, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBranch } from '../context/BranchContext'

export default function Debtors() {
    const [debtors, setDebtors] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedCustomerId, setExpandedCustomerId] = useState(null)
    const { selectedBranchId, branches } = useBranch()

    // Payment modal state
    const [paymentInvoice, setPaymentInvoice] = useState(null)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        fetchDebtors()
    }, [selectedBranchId]) // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchDebtors() {
        try {
            setLoading(true)
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    customers(id, name, phone, tax_id),
                    seller:profiles!fk_sales_user(full_name),
                    customer_payments (*)
                `)
                .eq('is_credit', true)
                .order('created_at', { ascending: false })

            if (selectedBranchId === 'all') {
                const branchIds = branches.map(b => b.id)
                if (branchIds.length > 0) {
                    query = query.in('branch_id', branchIds)
                }
            } else if (selectedBranchId) {
                query = query.eq('branch_id', selectedBranchId)
            }

            const { data, error } = await query
            if (error) throw error

            // Group pending credit invoices by customer
            const grouped = {}
            ;(data || []).forEach(inv => {
                const paid = inv.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0
                const balance = Number(inv.total) - paid
                if (balance <= 0.01) return

                const key = inv.customer_id ? String(inv.customer_id) : 'general'
                if (!grouped[key]) {
                    grouped[key] = {
                        customer_id: inv.customer_id,
                        name: inv.customers?.name || 'Venta General',
                        tax_id: inv.customers?.tax_id || '',
                        phone: inv.customers?.phone || '',
                        totalDebt: 0,
                        invoiceCount: 0,
                        invoices: []
                    }
                }
                grouped[key].totalDebt += balance
                grouped[key].invoiceCount += 1
                grouped[key].invoices.push({
                    ...inv,
                    totalPaid: paid,
                    balance,
                    daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(inv.created_at).getTime()) / 86400000))
                })
            })

            const list = Object.values(grouped).sort((a, b) => b.totalDebt - a.totalDebt)
            setDebtors(list)
        } catch (err) {
            console.error('Error fetching debtors:', err)
            alert('Error al cargar los deudores')
        } finally {
            setLoading(false)
        }
    }

    const handleRegisterPayment = async () => {
        if (!paymentInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) return

        try {
            setIsSaving(true)
            const { error } = await supabase.from('customer_payments').insert([{
                sale_id: paymentInvoice.id,
                customer_id: paymentInvoice.customer_id,
                amount: parseFloat(paymentAmount),
                payment_method: paymentMethod,
                notes: `Abono desde Deudores - Ticket #${paymentInvoice.sale_number}`
            }])

            if (error) throw error

            setPaymentInvoice(null)
            setPaymentAmount('')
            fetchDebtors()
        } catch (err) {
            console.error('Error registering payment:', err)
            alert('Error al registrar pago')
        } finally {
            setIsSaving(false)
        }
    }

    const handleExportCSV = () => {
        if (debtors.length === 0) {
            alert('No hay datos para exportar')
            return
        }

        const headers = ['Cliente,NIT,Teléfono,Facturas Pendientes,Deuda Total']
        const rows = debtors.map(d => {
            const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`
            return [
                escape(d.name),
                escape(d.tax_id),
                escape(d.phone),
                d.invoiceCount,
                d.totalDebt.toFixed(2)
            ].join(',')
        })

        const csvContent = [headers, ...rows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `deudores_export_${new Date().toLocaleDateString('sv-SE')}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    function handlePrintDebtorsReport() {
        if (debtors.length === 0) return

        const printWindow = window.open('', '_blank', 'width=1000,height=900')

        printWindow.document.write(`
            <html>
                <head>
                    <title>Reporte de Deudores - ${new Date().toLocaleDateString()}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 10px; font-size: 12px; }
                        .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
                        .total-row { background-color: #f1f5f9; font-weight: bold; font-size: 14px; }
                        .debt { color: #e11d48; font-weight: 700; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 style="margin: 0; color: #1e293b;">REPORTE DE DEUDORES</h1>
                        <p style="margin: 5px 0; color: #64748b;">Generado el: ${new Date().toLocaleString()}</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Cliente</th>
                                <th>NIT</th>
                                <th>Teléfono</th>
                                <th style="text-align: center;">Facturas Pendientes</th>
                                <th style="text-align: right;">Deuda Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${debtors.map((d, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${d.name}</td>
                                    <td>${d.tax_id || 'N/A'}</td>
                                    <td>${d.phone || 'N/A'}</td>
                                    <td style="text-align: center;">${d.invoiceCount}</td>
                                    <td style="text-align: right;" class="debt">Bs. ${d.totalDebt.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="5" style="text-align: right; padding: 15px;">TOTAL DEUDA PENDIENTE</td>
                                <td style="text-align: right; padding: 15px; color: #e11d48;">Bs. ${totalDebt.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div class="footer">
                        Documento generado automáticamente por el Sistema de Ventas
                    </div>
                </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    const totalDebt = debtors.reduce((acc, d) => acc + d.totalDebt, 0)
    const totalInvoices = debtors.reduce((acc, d) => acc + d.invoiceCount, 0)

    const filteredDebtors = debtors.filter(d =>
        (d.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (d.tax_id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (d.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ position: 'relative', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Header with Title and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>Deudores</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Clientes con facturas a crédito pendientes</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn" onClick={fetchDebtors} disabled={loading} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="btn" onClick={handleExportCSV} style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }} title="Exportar CSV">
                        <Download size={20} />
                    </button>
                    <button
                        onClick={handlePrintDebtorsReport}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '14px',
                            border: '1.5px solid hsl(var(--destructive))',
                            backgroundColor: 'hsl(var(--destructive) / 0.05)',
                            color: 'hsl(var(--destructive))',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            transition: '0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--destructive))'; e.currentTarget.style.color = 'white' }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--destructive) / 0.05)'; e.currentTarget.style.color = 'hsl(var(--destructive))' }}
                    >
                        <Printer size={18} /> IMPRIMIR
                    </button>
                </div>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                        <Users size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clientes Deudores</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--foreground))', lineHeight: 1 }}>{debtors.length}</p>
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deuda Total</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--destructive))', lineHeight: 1 }}>Bs. {totalDebt.toFixed(2)}</p>
                    </div>
                </div>
                <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>
                        <FileText size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.85rem', fontWeight: '600', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Facturas Pendientes</p>
                        <p style={{ fontSize: '2rem', fontWeight: '900', color: 'hsl(var(--foreground))', lineHeight: 1 }}>{totalInvoices}</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="card shadow-sm" style={{ padding: '1.5rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', backgroundColor: 'hsl(var(--background))' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', backgroundColor: 'white', padding: '0.5rem', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.5)' }}>
                    <Search size={22} style={{ marginLeft: '1rem', opacity: 0.4 }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, NIT o teléfono..."
                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', padding: '0.5rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <RefreshCw size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))', opacity: 0.5 }} />
                    </div>
                ) : filteredDebtors.length === 0 ? (
                    <div style={{ padding: '6rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                        <DollarSign size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'hsl(var(--foreground))', marginBottom: '0.5rem' }}>No hay deudores</h3>
                        <p style={{ maxWidth: '400px', margin: '0 auto' }}>Todas las facturas a crédito están al día. Los clientes con saldo pendiente aparecerán aquí.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredDebtors.map(d => {
                            const isExpanded = expandedCustomerId === String(d.customer_id)
                            return (
                                <div key={String(d.customer_id)} style={{ borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.4)', backgroundColor: 'white', overflow: 'hidden' }}>
                                    {/* Customer Row */}
                                    <div
                                        onClick={() => setExpandedCustomerId(isExpanded ? null : String(d.customer_id))}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2.5fr 1.5fr 1fr 1fr 0.5fr',
                                            alignItems: 'center',
                                            padding: '1rem 1.25rem',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        className="hover:bg-secondary/20"
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                                                backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '800'
                                            }}>
                                                {d.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>{d.name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {d.phone ? <><Phone size={11} /> {d.phone}</> : 'Sin teléfono'} {d.tax_id ? ` · ${d.tax_id}` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700', opacity: 0.6 }}>
                                            {d.invoiceCount} factura{d.invoiceCount !== 1 ? 's' : ''}
                                        </div>
                                        <div style={{ fontWeight: '800' }}>
                                            Bs. {d.totalDebt.toFixed(2)}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '0.25rem 0.75rem', borderRadius: '99px', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))' }}>
                                                DEUDOR
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </div>
                                    </div>

                                    {/* Expanded Invoices */}
                                    {isExpanded && (
                                        <div style={{ backgroundColor: '#f8fafc', borderTop: '1px solid hsl(var(--border) / 0.4)' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                <thead>
                                                    <tr style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left' }}>Nro Factura</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left' }}>Fecha</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left' }}>Vendedor</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Total</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Pagado</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Saldo</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'center' }}>Días</th>
                                                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {d.invoices.map(inv => (
                                                        <tr key={inv.id} style={{ borderTop: '1px solid hsl(var(--border) / 0.3)', backgroundColor: 'white' }}>
                                                            <td style={{ padding: '0.75rem 1.25rem' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: '700', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '2px 8px', borderRadius: '6px' }}>#{inv.sale_number}</span>
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1.25rem', fontWeight: '600' }}>{new Date(inv.created_at).toLocaleDateString()}</td>
                                                            <td style={{ padding: '0.75rem 1.25rem', fontWeight: '600' }}>{inv.seller?.full_name || 'Admin'}</td>
                                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: '700' }}>Bs. {Number(inv.total).toFixed(2)}</td>
                                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>Bs. {Number(inv.totalPaid).toFixed(2)}</td>
                                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--destructive))' }}>Bs. {Number(inv.balance).toFixed(2)}</td>
                                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontSize: '0.65rem', fontWeight: '900', padding: '2px 8px', borderRadius: '6px',
                                                                    backgroundColor: inv.daysOverdue > 30 ? '#fff1f2' : 'hsl(var(--secondary) / 0.5)',
                                                                    color: inv.daysOverdue > 30 ? '#e11d48' : '#64748b'
                                                                }}>
                                                                    {inv.daysOverdue}d
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>
                                                                <button
                                                                    onClick={() => { setPaymentInvoice(inv); setPaymentAmount('') }}
                                                                    className="btn btn-primary"
                                                                    style={{ padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800', gap: '0.4rem' }}
                                                                >
                                                                    <HandCoins size={16} /> ABONAR
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {paymentInvoice && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontWeight: '900' }}>Registrar Abono</h3>
                            <button onClick={() => setPaymentInvoice(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.3 }}><X /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #eee' }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800' }}>{paymentInvoice.customers?.name || 'Venta General'}</p>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', opacity: 0.6 }}>Factura #{paymentInvoice.sale_number} · {new Date(paymentInvoice.created_at).toLocaleDateString()}</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                                    <span style={{ opacity: 0.6 }}>Saldo pendiente:</span>
                                    <span style={{ fontWeight: '900', color: 'hsl(var(--destructive))' }}>Bs. {Number(paymentInvoice.balance).toFixed(2)}</span>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem', opacity: 0.5 }}>MONTO A ABONAR (Bs.)</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    autoFocus
                                    style={{ width: '100%', padding: '1rem', fontSize: '1.5rem', fontWeight: '900', borderRadius: '12px', border: '1.5px solid #eee', outline: 'none' }}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem', opacity: 0.5 }}>MÉTODO DE PAGO</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    {['Efectivo', 'QR', 'Transferencia', 'Depósito'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            style={{
                                                padding: '0.75rem',
                                                borderRadius: '10px',
                                                border: '1.5px solid',
                                                borderColor: paymentMethod === method ? 'hsl(var(--primary))' : '#eee',
                                                backgroundColor: paymentMethod === method ? 'hsl(var(--primary) / 0.05)' : 'white',
                                                color: paymentMethod === method ? 'hsl(var(--primary))' : 'inherit',
                                                fontWeight: '800',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleRegisterPayment}
                                disabled={isSaving || !paymentAmount}
                                className="btn btn-primary"
                                style={{ padding: '1rem', borderRadius: '14px', fontWeight: '900', fontSize: '1rem', marginTop: '1rem' }}
                            >
                                {isSaving ? 'GUARDANDO...' : 'CONFIRMAR ABONO'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
