import React, { useState, useEffect } from 'react'
import { 
    FileText, 
    Calendar, 
    Filter, 
    Download, 
    RefreshCw, 
    Building2, 
    ShoppingBag, 
    Search,
    Clock,
    User,
    ChevronRight,
    Package,
    Tag,
    Layers,
    ArrowRight,
    Eye,
    X,
    Printer
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { utils, writeFile } from 'xlsx'
import { useBranch } from '../context/BranchContext'

export default function Reports() {
    const [activeTab, setActiveTab] = useState('products') // 'products', 'invoices'
    const [loading, setLoading] = useState(false)
    const { branches, selectedBranchId, setSelectedBranchId } = useBranch()
    
    // Data states
    const [soldProducts, setSoldProducts] = useState([])
    const [invoices, setInvoices] = useState([])
    const [selectedInvoice, setSelectedInvoice] = useState(null)
    
    // Filters
    const [period, setPeriod] = useState('day') // 'day', 'month', 'year', 'range'
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterOnlyPending, setFilterOnlyPending] = useState(false)
    const [sellers, setSellers] = useState([])
    const [selectedSellerId, setSelectedSellerId] = useState('all')

    useEffect(() => {
        fetchSellers()
    }, [])

    useEffect(() => {
        fetchData()
    }, [activeTab, period, startDate, endDate, selectedBranchId, selectedSellerId])

    async function fetchSellers() {
        const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
        setSellers(data || [])
    }

    async function fetchData() {
        if (activeTab === 'products') {
            fetchSoldProducts()
        } else {
            fetchInvoices()
        }
    }

    function handlePrint() {
        if (!selectedInvoice) return

        const printWindow = window.open('', '_blank', 'width=800,height=900')
        const totalPaid = selectedInvoice.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0
        const balance = Number(selectedInvoice.total) - totalPaid

        let paymentsHtml = ''
        if (selectedInvoice.is_credit) {
            let runningBalance = Number(selectedInvoice.total)
            const sortedPayments = [...(selectedInvoice.customer_payments || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            
            paymentsHtml = `
                <h3 style="margin-top: 30px; text-transform: uppercase; font-size: 14px;">Detalle de Crédito</h3>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
                    <thead>
                        <tr style="background-color: #f1f5f9;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Fecha/Hora</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Monto Abonado</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">${new Date(selectedInvoice.created_at).toLocaleString()}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">0.00 Bs.</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${Number(selectedInvoice.total).toFixed(2)} Bs.</td>
                        </tr>
                        ${sortedPayments.map(p => {
                            runningBalance -= Number(p.amount)
                            return `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px;">${new Date(p.created_at).toLocaleString()}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${Number(p.amount).toFixed(2)} Bs.</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${runningBalance.toFixed(2)} Bs.</td>
                                </tr>
                            `
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f8fafc; font-weight: bold;">
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">TOTAL PAGADO:</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalPaid.toFixed(2)} Bs.</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">SALDO: ${balance.toFixed(2)} Bs.</td>
                        </tr>
                    </tfoot>
                </table>
            `
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Factura #${selectedInvoice.sale_number}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 12px; font-size: 13px; }
                        .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                        .total-box { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1 style="margin: 0; color: #1e293b;">COMPROBANTE DE VENTA</h1>
                            <p style="margin: 5px 0; color: #64748b;">Nro de Factura: <strong>#${selectedInvoice.sale_number}</strong></p>
                            <p style="margin: 5px 0; color: #64748b;">Fecha: ${new Date(selectedInvoice.created_at).toLocaleString()}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-weight: bold;">Cliente: ${selectedInvoice.customers?.name || 'Venta General'}</p>
                            <p style="margin: 5px 0; color: #64748b;">Vendedor: ${selectedInvoice.seller?.full_name || 'Admin'}</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Producto</th>
                                <th style="text-align: center;">Cant.</th>
                                <th style="text-align: right;">P. Unitario</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedInvoice.items?.map(item => `
                                <tr>
                                    <td>${item.product?.sku || 'N/A'}</td>
                                    <td>${item.product?.name}</td>
                                    <td style="text-align: center;">${item.quantity}</td>
                                    <td style="text-align: right;">${Number(item.price).toFixed(2)}</td>
                                    <td style="text-align: right;">${(item.quantity * item.price).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="total-box">
                        TOTAL: Bs. ${Number(selectedInvoice.total).toFixed(2)}
                    </div>

                    ${paymentsHtml}

                    <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px dashed #eee; padding-top: 20px;">
                        Gracias por su preferencia - Documento generado desde el Sistema de Ventas
                    </div>
                </body>
            </html>
        `)
        printWindow.document.close()
        printWindow.print()
    }

    function handlePrintSalesReport() {
        if (soldProducts.length === 0) return

        const printWindow = window.open('', '_blank', 'width=1000,height=900')
        const totalSold = soldProducts.reduce((acc, item) => acc + (item.quantity * item.price), 0)

        printWindow.document.write(`
            <html>
                <head>
                    <title>Reporte de Ventas - ${new Date().toLocaleDateString()}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 40px; color: #334155; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
                        td { border: 1px solid #e2e8f0; padding: 10px; font-size: 12px; }
                        .header { margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; }
                        .total-row { background-color: #f1f5f9; font-weight: bold; font-size: 14px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1 style="margin: 0; color: #1e293b;">REPORTE DE VENTAS POR PRODUCTO</h1>
                        <p style="margin: 5px 0; color: #64748b;">Generado el: ${new Date().toLocaleString()}</p>
                        <p style="margin: 5px 0; color: #64748b;">Periodo: ${period === 'day' ? startDate : `${startDate} al ${endDate}`}</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>SKU</th>
                                <th>Marca</th>
                                <th>Modelo</th>
                                <th style="text-align: center;">Cant.</th>
                                <th style="text-align: right;">P. Unitario</th>
                                <th style="text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${soldProducts.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.product?.sku || 'N/A'}</td>
                                    <td>${item.product?.brand?.name || 'N/A'}</td>
                                    <td>${item.product?.model?.name || 'N/A'}</td>
                                    <td style="text-align: center;">${item.quantity}</td>
                                    <td style="text-align: right;">Bs. ${Number(item.price).toFixed(2)}</td>
                                    <td style="text-align: right; font-weight: bold;">Bs. ${(item.quantity * item.price).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="6" style="text-align: right; padding: 15px;">TOTAL GENERAL</td>
                                <td style="text-align: right; padding: 15px;">Bs. ${totalSold.toFixed(2)}</td>
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

    async function fetchSoldProducts() {
        try {
            setLoading(true)
            let query = supabase
                .from('sale_items')
                .select(`
                    *,
                    product:product_id (
                        name, 
                        sku, 
                        brand:brands(name), 
                        model:models(name)
                    ),
                    sale:sale_id!inner (
                        created_at, 
                        sale_number, 
                        branch_id
                    )
                `)

            // Date filtering
            if (period === 'day') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(startDate + 'T23:59:59')
                query = query.gte('sale.created_at', start.toISOString()).lte('sale.created_at', end.toISOString())
            } else if (period === 'range') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(endDate + 'T23:59:59')
                query = query.gte('sale.created_at', start.toISOString()).lte('sale.created_at', end.toISOString())
            }

            if (selectedBranchId && selectedBranchId !== 'all') {
                query = query.eq('sale.branch_id', selectedBranchId)
            }

            if (selectedSellerId && selectedSellerId !== 'all') {
                query = query.eq('sale.user_id', selectedSellerId)
            }

            const { data, error } = await query
            if (error) throw error

            // Group and format
            setSoldProducts(data || [])
        } catch (err) {
            console.error('Error fetching sold products:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchInvoices() {
        try {
            setLoading(true)
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    customers(id, name, current_balance),
                    seller:profiles!fk_sales_user(full_name),
                    items:sale_items(
                        *,
                        product:product_id(name, sku, description, brand:brands(name), model:models(name))
                    ),
                    customer_payments (*)
                `)
                .order('created_at', { ascending: false })

            // Date filtering
            if (period === 'day') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(startDate + 'T23:59:59')
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
            } else if (period === 'range') {
                const start = new Date(startDate + 'T00:00:00')
                const end = new Date(endDate + 'T23:59:59')
                query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
            }

            if (selectedBranchId && selectedBranchId !== 'all') {
                query = query.eq('branch_id', selectedBranchId)
            }

            if (selectedSellerId && selectedSellerId !== 'all') {
                query = query.eq('user_id', selectedSellerId)
            }

            const { data, error } = await query
            if (error) throw error

            setInvoices(data || [])
            if (data?.length > 0) {
                // Keep current selection if it still exists
                const stillExists = selectedInvoice ? data.find(inv => inv.id === selectedInvoice.id) : null
                setSelectedInvoice(stillExists || data[0])
            } else {
                setSelectedInvoice(null)
            }
        } catch (err) {
            console.error('Error fetching invoices:', err)
        } finally {
            setLoading(false)
        }
    }

    const exportToExcel = () => {
        let reportData = []
        let filename = ''

        if (activeTab === 'products') {
            reportData = soldProducts.map((item, index) => ({
                'Nro': index + 1,
                'SKU': item.product?.sku || 'N/A',
                'Marca': item.product?.brand?.name || 'N/A',
                'Modelo': item.product?.model?.name || 'N/A',
                'Cantidad': item.quantity,
                'Precio Unitario': item.price,
                'Total': item.total,
                'Fecha': new Date(item.sale?.created_at).toLocaleString()
            }))
            filename = 'Reporte_Productos_Vendidos'
        } else {
            reportData = invoices.map(inv => ({
                'Fecha': new Date(inv.created_at).toLocaleString(),
                'Nro Factura': inv.sale_number,
                'Cliente': inv.customers?.name || 'Venta General',
                'Vendedor': inv.seller?.full_name || 'Sistema',
                'Total': inv.total,
                'Descripción': inv.description || ''
            }))
            filename = 'Reporte_Facturas'
        }

        const ws = utils.json_to_sheet(reportData)
        const wb = utils.book_new()
        utils.book_append_sheet(wb, ws, "Reporte")
        writeFile(wb, `${filename}_${startDate}.xlsx`)
    }

    // Payment registration logic
    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [isSaving, setIsSaving] = useState(false)

    const handleRegisterPayment = async () => {
        if (!selectedInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0) return
        
        try {
            setIsSaving(true)
            const { error } = await supabase.from('customer_payments').insert([{
                sale_id: selectedInvoice.id,
                customer_id: selectedInvoice.customer_id,
                amount: parseFloat(paymentAmount),
                payment_method: paymentMethod,
                notes: `Abono desde Reportes - Ticket #${selectedInvoice.sale_number}`
            }])

            if (error) throw error

            setPaymentModalOpen(false)
            setPaymentAmount('')
            fetchInvoices() // Refresh to see updated payments
        } catch (err) {
            console.error('Error registering payment:', err)
            alert('Error al registrar pago')
        } finally {
            setIsSaving(false)
        }
    }

    const totalInvoicesSum = invoices.reduce((acc, inv) => acc + Number(inv.total), 0)
    const totalSold = soldProducts.reduce((acc, item) => acc + Number(item.total), 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
            {/* Header and Main Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.04em', margin: 0, color: 'hsl(var(--foreground))' }}>
                        Reportes
                    </h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Consulta y exporta el rendimiento de tus ventas</p>
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', padding: '0.4rem', borderRadius: '16px', width: 'fit-content' }}>
                        <button
                            onClick={() => setActiveTab('products')}
                            style={{
                                padding: '0.6rem 1.5rem',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'products' ? 'white' : 'transparent',
                                color: activeTab === 'products' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.5)',
                                boxShadow: activeTab === 'products' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Reporte de Ventas
                        </button>
                        <button
                            onClick={() => setActiveTab('invoices')}
                            style={{
                                padding: '0.6rem 1.5rem',
                                borderRadius: '12px',
                                border: 'none',
                                fontSize: '0.9rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'invoices' ? 'white' : 'transparent',
                                color: activeTab === 'invoices' ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.5)',
                                boxShadow: activeTab === 'invoices' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Reporte de Factura
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={exportToExcel} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', fontWeight: '800' }}>
                        <Download size={20} /> EXPORTAR EXCEL
                    </button>
                    <button onClick={fetchData} className="btn" style={{ padding: '0.75rem', borderRadius: '14px', backgroundColor: 'hsl(var(--secondary) / 0.5)' }}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '16px', gap: '0.4rem' }}>
                    {['day', 'range'].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '12px',
                                border: 'none',
                                backgroundColor: period === p ? 'white' : 'transparent',
                                color: period === p ? 'hsl(var(--primary))' : '#64748b',
                                fontSize: '0.85rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                boxShadow: period === p ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none',
                                textTransform: 'uppercase'
                            }}
                        >
                            {p === 'day' ? 'Diario' : 'Rango'}
                        </button>
                    ))}
                </div>

                <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Calendar size={16} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, color: 'hsl(var(--primary))' }} />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3.2rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none', backgroundColor: 'white', color: '#1e293b' }}
                    />
                </div>

                {period === 'range' && (
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, color: 'hsl(var(--primary))' }} />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 3.2rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none', backgroundColor: 'white', color: '#1e293b' }}
                        />
                    </div>
                )}

                <div style={{ position: 'relative', minWidth: '200px' }}>
                    <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, color: 'hsl(var(--primary))' }} />
                    <select
                        value={selectedSellerId}
                        onChange={(e) => setSelectedSellerId(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.8rem', borderRadius: '16px', border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontWeight: '700', outline: 'none', backgroundColor: 'white', color: '#1e293b', appearance: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">TODOS LOS VENDEDORES</option>
                        {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.full_name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
                
                <div style={{ marginLeft: 'auto' }}>
                    {activeTab === 'invoices' && (
                        <button 
                            onClick={() => setFilterOnlyPending(!filterOnlyPending)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '16px',
                                border: '1.5px solid',
                                borderColor: filterOnlyPending ? 'hsl(var(--destructive))' : '#e2e8f0',
                                backgroundColor: filterOnlyPending ? 'hsl(var(--destructive) / 0.1)' : 'white',
                                color: filterOnlyPending ? 'hsl(var(--destructive))' : '#475569',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                            }}
                        >
                            <Filter size={16} />
                            {filterOnlyPending ? 'MOSTRANDO SOLO DEUDAS' : 'FILTRAR POR DEUDAS'}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'products' ? (
                /* TAB 1: PRODUCTOS VENDIDOS */
                <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.5)', backgroundColor: 'white' }}>
                    <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #eee', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>Resumen de Productos Vendidos</h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>Desglose detallado por ítem</p>
                        </div>
                        <button 
                            onClick={handlePrintSalesReport}
                            style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '12px',
                                border: '1.5px solid hsl(var(--primary))',
                                backgroundColor: 'hsl(var(--primary) / 0.05)',
                                color: 'hsl(var(--primary))',
                                fontSize: '0.8rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                transition: '0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--primary))'; e.currentTarget.style.color = 'white' }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--primary) / 0.05)'; e.currentTarget.style.color = 'hsl(var(--primary))' }}
                        >
                            <Printer size={18} /> IMPRIMIR REPORTE (PDF)
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                                <tr>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Nro</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>SKU</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Marca</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Modelo</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'center' }}>Cantidad</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'right' }}>P. Unitario</th>
                                    <th style={{ padding: '1rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="7" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando datos...</td></tr>
                                ) : soldProducts.length === 0 ? (
                                    <tr><td colSpan="7" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>No hay ventas registradas</td></tr>
                                ) : (
                                    soldProducts.map((item, index) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
                                            <td style={{ padding: '1rem', fontWeight: '600', opacity: 0.4 }}>{index + 1}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: '700', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '2px 8px', borderRadius: '6px' }}>{item.product?.sku || 'N/A'}</span>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: '700' }}>{item.product?.brand?.name || 'N/A'}</td>
                                            <td style={{ padding: '1rem', fontWeight: '600' }}>{item.product?.model?.name || 'N/A'}</td>
                                            <td style={{ padding: '1rem', textAlign: 'center', fontWeight: '800' }}>{item.quantity}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>Bs. {Number(item.price).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '900', color: 'hsl(var(--primary))' }}>Bs. {Number(item.total).toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot style={{ backgroundColor: 'hsl(var(--primary))', color: 'white' }}>
                                <tr>
                                    <td colSpan="6" style={{ padding: '1.25rem 2rem', textAlign: 'right', fontWeight: '800', fontSize: '1.1rem' }}>TOTAL GENERAL</td>
                                    <td style={{ padding: '1.25rem 2rem', textAlign: 'right', fontWeight: '900', fontSize: '1.4rem' }}>Bs. {totalSold.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : (
                /* TAB 2: REPORTE DE FACTURA (Dual View) */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
                    {/* Invoice List (Left) */}
                    <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', backgroundColor: 'white', border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #eee', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase' }}>Facturas Emitidas</h3>
                            <div style={{ backgroundColor: 'hsl(var(--primary))', color: 'white', padding: '4px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '900' }}>
                                TOTAL: Bs. {totalInvoicesSum.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            {loading ? (
                                <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>Cargando...</div>
                            ) : invoices.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>No hay facturas</div>
                            ) : (
                                invoices
                                .filter(inv => {
                                    if (!filterOnlyPending) return true
                                    if (!inv.is_credit) return false
                                    const totalPaid = inv.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0
                                    return (Number(inv.total) - totalPaid) > 0.01
                                })
                                .map(inv => {
                                    const totalPaid = inv.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0
                                    const balance = Number(inv.total) - totalPaid
                                    const isFullyPaid = !inv.is_credit || balance <= 0.01

                                    return (
                                        <div
                                            key={inv.id}
                                            onClick={() => setSelectedInvoice(inv)}
                                            style={{
                                                padding: '0.75rem 1.25rem',
                                                borderBottom: '1px solid #f1f1f1',
                                                cursor: 'pointer',
                                                display: 'grid',
                                                gridTemplateColumns: '1.2fr 1.8fr 1.2fr 0.8fr',
                                                alignItems: 'center',
                                                backgroundColor: selectedInvoice?.id === inv.id ? 'hsl(var(--primary) / 0.05)' : 'white',
                                                borderLeft: selectedInvoice?.id === inv.id ? '4px solid hsl(var(--primary))' : '4px solid transparent',
                                                transition: '0.2s',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{ opacity: 0.6 }}>
                                                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800' }}>{new Date(inv.created_at).toLocaleDateString()}</p>
                                                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '700' }}>{new Date(inv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>

                                            <div>
                                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '800', color: 'hsl(var(--primary))' }}>Nro: {inv.sale_number}</p>
                                                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>{inv.customers?.name || 'Venta General'}</p>
                                                <p style={{ margin: 0, fontSize: '0.65rem', opacity: 0.5 }}>{inv.seller?.full_name || 'Vendedor'}</p>
                                            </div>

                                            <div style={{ textAlign: 'right', paddingRight: '0.5rem' }}>
                                                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '900' }}>{Number(inv.total).toFixed(2)}</p>
                                                <div style={{ 
                                                    fontSize: '0.6rem', 
                                                    fontWeight: '900', 
                                                    padding: '2px 6px', 
                                                    borderRadius: '4px',
                                                    display: 'inline-block',
                                                    backgroundColor: isFullyPaid ? '#ecfdf5' : '#fff1f2',
                                                    color: isFullyPaid ? '#10b981' : '#e11d48',
                                                    border: '1px solid',
                                                    borderColor: isFullyPaid ? '#d1fae5' : '#ffe4e6',
                                                    marginTop: '2px'
                                                }}>
                                                    {isFullyPaid ? 'PAGADO' : `DEBE: ${balance.toFixed(2)}`}
                                                </div>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                                <button className="btn" style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', gap: '0.3rem', backgroundColor: 'white', border: '1px solid #eee' }}>
                                                    <Eye size={14} /> Ver
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Invoice Detail (Right) */}
                    <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', backgroundColor: 'white', border: '1px solid hsl(var(--border) / 0.5)', overflow: 'hidden', position: 'sticky', top: '1.5rem' }}>
                        {selectedInvoice ? (
                            <>
                                <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', color: 'hsl(var(--primary))' }}>Detalle de Factura #{selectedInvoice.sale_number}</h4>
                                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', opacity: 0.5 }}>Cliente: {selectedInvoice.customers?.name || 'Venta General'}</p>
                                            </div>
                                            <button 
                                                onClick={handlePrint}
                                                style={{ 
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '10px',
                                                    border: '1.5px solid #eee',
                                                    backgroundColor: 'white',
                                                    color: '#64748b',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800',
                                                    cursor: 'pointer',
                                                    transition: '0.2s'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.color = 'hsl(var(--primary))' }}
                                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.color = '#64748b' }}
                                            >
                                                <Printer size={16} /> IMPRIMIR PDF
                                            </button>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900' }}>Bs. {Number(selectedInvoice.total).toFixed(2)}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: selectedInvoice.is_credit ? 'hsl(var(--destructive))' : '#10b981' }}>
                                                    {selectedInvoice.is_credit ? 'Venta a Crédito' : `Pagado via ${selectedInvoice.payment_method}`}
                                                </span>
                                                {selectedInvoice.is_credit && (
                                                    <button 
                                                        onClick={() => setPaymentModalOpen(true)}
                                                        style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'hsl(var(--primary))', color: 'white', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                                                    >
                                                        REGISTRAR PAGO
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '0.5rem' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead style={{ backgroundColor: '#fff', borderBottom: '2px solid #f1f1f1' }}>
                                            <tr>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>CÓDIGO</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>NOMBRE</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>CANT.</th>
                                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: '800', opacity: 0.4 }}>PRECIO</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedInvoice.items?.map(item => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: '700' }}>{item.product?.sku || 'N/A'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: '700' }}>{item.product?.name}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: '800' }}>{item.quantity}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '700' }}>{Number(item.price).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {selectedInvoice.is_credit && (
                                    <div style={{ padding: '1.5rem', backgroundColor: '#fdfdfd', borderTop: '2px solid #eee' }}>
                                        <p style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '900', color: '#334155', textTransform: 'uppercase', letterSpacing: '1px' }}>DETALLE DE CRÉDITO</p>
                                        
                                        <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #ddd' }}>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #ddd' }}>Fecha</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800', borderRight: '1px solid #ddd' }}>Hora</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800', borderRight: '1px solid #ddd' }}>Monto</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Saldo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Initial Row: The Debt itself */}
                                                    <tr style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '0.75rem', borderRight: '1px solid #ddd' }}>{new Date(selectedInvoice.created_at).toLocaleDateString()}</td>
                                                        <td style={{ padding: '0.75rem', borderRight: '1px solid #ddd' }}>{new Date(selectedInvoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #ddd' }}>0.00 Bs.</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>{Number(selectedInvoice.total).toFixed(2)} Bs.</td>
                                                    </tr>
                                                    
                                                    {/* Payment Rows */}
                                                    {(() => {
                                                        let runningBalance = Number(selectedInvoice.total)
                                                        return selectedInvoice.customer_payments?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(p => {
                                                            runningBalance -= Number(p.amount)
                                                            return (
                                                                <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                                                                    <td style={{ padding: '0.75rem', borderRight: '1px solid #ddd' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                                                                    <td style={{ padding: '0.75rem', borderRight: '1px solid #ddd' }}>{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #ddd', color: '#10b981', fontWeight: '800' }}>{Number(p.amount).toFixed(2)} Bs.</td>
                                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>{runningBalance.toFixed(2)} Bs.</td>
                                                                </tr>
                                                            )
                                                        })
                                                    })()}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: '900' }}>
                                                        <td colSpan="2" style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #ddd' }}>TOTAL PAGADO:</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', borderRight: '1px solid #ddd', color: '#10b981' }}>
                                                            {selectedInvoice.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2)} Bs.
                                                        </td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                            SALDO ACTUAL: {(Number(selectedInvoice.total) - (selectedInvoice.customer_payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0)).toFixed(2)} Bs.
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {selectedInvoice.description && (
                                    <div style={{ padding: '1.5rem', backgroundColor: '#fff9e6', borderTop: '1px solid #ffeeba' }}>
                                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: '800', opacity: 0.5, textTransform: 'uppercase' }}>Nota / Descripción:</p>
                                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', fontWeight: '600' }}>{selectedInvoice.description}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                <FileText size={80} />
                                <p style={{ fontWeight: '800', marginTop: '1rem' }}>Selecciona una factura para ver el detalle</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {paymentModalOpen && selectedInvoice && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '400px', padding: '2rem', borderRadius: '24px', backgroundColor: 'white' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontWeight: '900' }}>Registrar Pago</h3>
                            <button onClick={() => setPaymentModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.3 }}><X /></button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', fontWeight: '700', opacity: 0.4 }}>
                                    Total Factura: Bs. {Number(selectedInvoice.total).toFixed(2)}
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.5rem', opacity: 0.5 }}>MÉTODO DE PAGO</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    {['Efectivo', 'QR'].map(method => (
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
