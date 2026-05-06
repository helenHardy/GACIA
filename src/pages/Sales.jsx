import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, ClipboardList, RefreshCw, AlertTriangle, Building2, Calendar, User, Eye, Edit2, Trash2, ShoppingCart, TrendingUp, DollarSign, Target, Filter, ChevronRight, X, Printer, Download, Tag, HandCoins, Save } from 'lucide-react'
import { utils, writeFile } from 'xlsx'
import { supabase } from '../lib/supabase'
import SaleModal from '../components/pos/SaleModal'
import EditSaleModal from '../components/pos/EditSaleModal'
import Ticket from '../components/pos/Ticket'
import { useBranch } from '../context/BranchContext'


export default function Sales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSale, setEditingSale] = useState(null)
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingSaleForEdit, setEditingSaleForEdit] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const [currencySymbol, setCurrencySymbol] = useState('Bs.')
    const [saleForTicket, setSaleForTicket] = useState(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const { selectedBranchId, branches } = useBranch()
    const [filterBranchId, setFilterBranchId] = useState(selectedBranchId || 'all')
    const [filterMode, setFilterMode] = useState('day') // 'day', 'month', 'year', 'range'
    const [filterDay, setFilterDay] = useState(new Date().toLocaleDateString('sv-SE'))
    const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString())
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString())
    const [filterStartDate, setFilterStartDate] = useState(new Date().toLocaleDateString('sv-SE'))
    const [filterEndDate, setFilterEndDate] = useState(new Date().toLocaleDateString('sv-SE'))
    const [activeTab, setActiveTab] = useState('history') // 'history', 'products', 'detailed'
    const [saleItems, setSaleItems] = useState([])
    const [loadingItems, setLoadingItems] = useState(false)
    const [paymentModalOpen, setPaymentModalOpen] = useState(false)
    const [selectedSaleForPayment, setSelectedSaleForPayment] = useState(null)
    const [paymentAmount, setPaymentAmount] = useState('')
    const [selectedSaleForDetail, setSelectedSaleForDetail] = useState(null)
    const [sellers, setSellers] = useState([])
    const [filterSellerId, setFilterSellerId] = useState('all')
    const [filterOnlyDebts, setFilterOnlyDebts] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('Efectivo')
    const [cashAmount, setCashAmount] = useState('')
    const [qrAmount, setQrAmount] = useState('')
    const ticketRef = useRef()

    const getLocalDate = (date) => {
        if (!date) return ''
        const d = new Date(date)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }



    useEffect(() => {
        checkUserRole()
        fetchSales()
        fetchSaleItems()
        fetchSettings()
        fetchSellers()

        const handleTicketEvent = (e) => handlePrint(e.detail)
        window.addEventListener('print-ticket', handleTicketEvent)
        return () => window.removeEventListener('print-ticket', handleTicketEvent)
    }, [])

    async function checkUserRole() {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
            setIsAdmin(data?.role === 'Administrador')
        }
    }

    useEffect(() => {
        if (selectedBranchId) setFilterBranchId(selectedBranchId)
    }, [selectedBranchId])

    useEffect(() => {
        localStorage.setItem('sales_mode', filterMode)
    }, [filterMode])



    async function fetchSettings() {
        const { data } = await supabase.from('settings').select('*')
        if (data) {
            const currency = data.find(s => s.key === 'currency')?.value
            if (currency === 'BOL') setCurrencySymbol('Bs.')
            else if (currency === 'EUR') setCurrencySymbol('€')
            else if (currency === 'USD') setCurrencySymbol('$')
        }
    }

    async function fetchSellers() {
        try {
            const { data } = await supabase.from('profiles').select('id, full_name').order('full_name')
            setSellers(data || [])
        } catch (err) {
            console.error('Error fetching sellers:', err)
        }
    }

    async function fetchSales() {
        try {
            setLoading(true)
            setError(null)
            let query = supabase
                .from('sales')
                .select(`
                    *,
                    customers:customer_id (*),
                    branches:branch_id (*),
                    profiles:profiles!fk_sales_user (full_name),
                    customer_payments (*)
                `)
                .order('created_at', { ascending: false })

            // Security: if not admin, restrict to assigned branches
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
                if (profile?.role !== 'Administrador') {
                    const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                    const assignedIds = assignments?.map(a => a.branch_id) || []
                    if (assignedIds.length > 0) {
                        query = query.in('branch_id', assignedIds)
                    } else {
                        setSales([])
                        setLoading(false)
                        return
                    }
                }
            }

            const { data, error } = await query

            if (error) throw error
            setSales(data || [])
        } catch (err) {
            console.error('Error fetching sales:', err)
            setError('Error al cargar el historial de ventas.')
        } finally {
            setLoading(false)
        }
    }

    async function fetchSaleItems() {
        try {
            setLoadingItems(true)
            let query = supabase
                .from('sale_items')
                .select(`
                    *,
                    products:product_id (name, sku, brand:brand_id(name)),
                    sales:sale_id (
                        created_at, 
                        sale_number, 
                        branch_id, 
                        user_id,
                        profiles:profiles!fk_sales_user (full_name)
                    )
                `)
                .order('created_at', { ascending: false, foreignTable: 'sales' })

            // Security: if not admin, restrict to assigned branches
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
                if (profile?.role !== 'Administrador') {
                    const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                    const assignedIds = assignments?.map(a => a.branch_id) || []
                    if (assignedIds.length > 0) {
                        query = query.in('sales.branch_id', assignedIds)
                    } else {
                        setSaleItems([])
                        setLoadingItems(false)
                        return
                    }
                }
            }

            const { data, error } = await query
            if (error) throw error
            setSaleItems(data || [])
        } catch (err) {
            console.error('Error fetching sale items:', err)
        } finally {
            setLoadingItems(false)
        }
    }



    const handleRegisterPayment = async () => {
        const isMixto = paymentMethod === 'Mixto'
        const totalAmount = isMixto ? (parseFloat(cashAmount || 0) + parseFloat(qrAmount || 0)) : parseFloat(paymentAmount || 0)
        
        if (!selectedSaleForPayment || totalAmount <= 0) return
        
        try {
            setIsSaving(true)
            
            let paymentsToInsert = []
            
            if (isMixto) {
                if (parseFloat(cashAmount) > 0) {
                    paymentsToInsert.push({
                        sale_id: selectedSaleForPayment.id,
                        customer_id: selectedSaleForPayment.customer_id,
                        amount: parseFloat(cashAmount),
                        payment_method: 'Efectivo',
                        notes: `Abono Mixto (Efectivo) - Ticket #${selectedSaleForPayment.sale_number}`
                    })
                }
                if (parseFloat(qrAmount) > 0) {
                    paymentsToInsert.push({
                        sale_id: selectedSaleForPayment.id,
                        customer_id: selectedSaleForPayment.customer_id,
                        amount: parseFloat(qrAmount),
                        payment_method: 'QR',
                        notes: `Abono Mixto (QR) - Ticket #${selectedSaleForPayment.sale_number}`
                    })
                }
            } else {
                paymentsToInsert.push({
                    sale_id: selectedSaleForPayment.id,
                    customer_id: selectedSaleForPayment.customer_id,
                    amount: parseFloat(paymentAmount),
                    payment_method: paymentMethod,
                    notes: `Abono a Ticket #${selectedSaleForPayment.sale_number}`
                })
            }

            if (paymentsToInsert.length === 0) {
                setIsSaving(false)
                return
            }

            const { error } = await supabase.from('customer_payments').insert(paymentsToInsert)

            if (error) throw error

            setPaymentModalOpen(false)
            setSelectedSaleForPayment(null)
            setPaymentAmount('')
            setCashAmount('')
            setQrAmount('')
            setPaymentMethod('Efectivo')
            fetchSales()
            
            // If viewing details, update that too
            if (selectedSaleForDetail && selectedSaleForDetail.id === selectedSaleForPayment.id) {
                const { data: updatedSale } = await supabase
                    .from('sales')
                    .select('*, customers:customer_id (*), branches:branch_id (*), profiles:profiles!fk_sales_user (full_name), customer_payments (*)')
                    .eq('id', selectedSaleForPayment.id)
                    .single()
                if (updatedSale) setSelectedSaleForDetail(updatedSale)
            }
        } catch (err) {
            console.error('Error registering payment:', err)
            alert('Error al registrar pago: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }


    const handlePrint = async (sale) => {
        try {
            setLoading(true)
            const { data: items } = await supabase.from('sale_items').select('*, products(name, sku)').eq('sale_id', sale.id)

            const formattedItems = items.map(i => ({
                ...i,
                name: i.products?.name,
                sku: i.products?.sku
            }))

            const ticketData = {
                sale: sale,
                items: formattedItems,
                branch: sale.branches,
                customer: sale.customers,
                paymentMethod: sale.payment_method,
                currencySymbol
            }

            setSaleForTicket(ticketData)

            // Wait for state to update and render before printing
            setTimeout(() => {
                const printArea = ticketRef.current.innerHTML
                const printWindow = window.open('', '_blank', 'width=800,height=600')
                printWindow.document.write(`<html><head><title>Ticket #${sale.sale_number}</title><style>body{margin:0;padding:0;}</style></head><body>${printArea}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>`)
                printWindow.document.close()
            }, 100)
        } catch (err) {
            console.error(err)
            alert('Error al generar ticket')
        } finally {
            setLoading(false)
        }
    }


    const handleExportCSV = () => {
        try {
            if (filteredSales.length === 0) {
                alert('No hay datos para exportar')
                return
            }

            const headers = ['Orden', 'Cliente', 'NIT/CI', 'Sucursal', 'Vendedor', 'Fecha', 'Hora', 'Total']
            const rows = filteredSales.map(s => [
                s.sale_number || '',
                s.customers?.name || 'Cliente General',
                s.customers?.tax_id || '',
                s.branches?.name || '',
                s.profiles?.full_name || 'Sistema',
                new Date(s.created_at).toLocaleDateString(),
                new Date(s.created_at).toLocaleTimeString(),
                s.total || 0
            ])

            const worksheet = utils.aoa_to_sheet([headers, ...rows])
            const workbook = utils.book_new()
            utils.book_append_sheet(workbook, worksheet, 'Ventas')

            // Auto-size columns
            const maxWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)))
            worksheet['!cols'] = maxWidths.map(w => ({ wch: w + 2 }))

            writeFile(workbook, `ventas_export_${new Date().toLocaleDateString('sv-SE')}.xlsx`)
        } catch (err) {
            console.error('Error exporting Excel:', err)
            alert('Error al exportar datos')
        }
    }

    const handleEdit = async (sale, forceReadOnly = false) => {
        if (!forceReadOnly && (isAdmin || sale.can_edit)) {
            // Open POS-style edit modal (products only)
            setEditingSaleForEdit(sale)
            setIsEditModalOpen(true)
            return
        }

        // Read-only view uses the old SaleModal
        try {
            setLoading(true)
            const { data: items, error } = await supabase.from('sale_items').select('*, products(name, sku)').eq('sale_id', sale.id)
            if (error) throw error
            const formattedItems = items.map(i => ({
                product_id: i.product_id,
                name: i.products?.name,
                sku: i.products?.sku,
                quantity: i.quantity,
                price: i.price,
                total: i.total
            }))
            setEditingSale({ ...sale, items: formattedItems })
            setIsReadOnly(true)
            setIsModalOpen(true)
        } catch (err) {
            console.error(err)
            alert('Error al cargar detalles de la venta')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async (saleData) => {
        try {
            setIsSaving(true)
            const { items, ...header } = saleData
            const { data: { user } } = await supabase.auth.getUser()
            let targetSaleId = null

            if (editingSale) {
                targetSaleId = editingSale.id
                // Borramos los items anteriores. Los triggers se encargarán de devolver el stock (BEFORE DELETE)
                await supabase.from('sale_items').delete().eq('sale_id', targetSaleId)

                // Actualizamos la cabecera.
                await supabase.from('sales').update({
                    customer_id: header.customer_id,
                    branch_id: header.branch_id,
                    subtotal: header.subtotal,
                    tax: header.tax,
                    discount: header.discount,
                    total: header.total,
                    is_credit: header.is_credit,
                    user_id: user?.id
                }).eq('id', targetSaleId)
            } else {
                // Nueva venta.
                const { data: sale, error: sError } = await supabase.from('sales').insert([{ ...header, user_id: user?.id }]).select().single()
                if (sError) throw sError
                targetSaleId = sale.id
            }

            const itemsToSave = items.map(item => ({
                sale_id: targetSaleId, product_id: item.product_id, quantity: item.quantity, price: item.price, total: item.total
            }))
            // Al insertar, el trigger trg_kardex_sale_insert_update descontará el stock
            await supabase.from('sale_items').insert(itemsToSave)

            setIsModalOpen(false)
            setEditingSale(null)
            fetchSales()
            fetchSaleItems()
        } catch (err) {
            console.error(err)
            alert('Error al procesar la venta: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleVoid = async (sale) => {
        if (!window.confirm(`¿Estás seguro de ANULAR la venta #${sale.sale_number}? Los productos volverán al stock.`)) return
        try {
            setLoading(true)
            // Al eliminar la venta, los triggers se encargarán de:
            // 1. Devolver el stock (Trigger BEFORE DELETE en sale_items via CASCADE)
            // 2. Revertir el crédito del cliente (Trigger AFTER DELETE en sales)
            const { error } = await supabase.from('sales').delete().eq('id', sale.id)
            if (error) throw error
            fetchSales()
            fetchSaleItems()
        } catch (err) {
            console.error(err)
            alert('Error al anular venta: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    async function togglePermission(saleId, field, currentValue) {
        try {
            const { error } = await supabase
                .from('sales')
                .update({ [field]: !currentValue })
                .eq('id', saleId)

            if (error) throw error

            // Update local state instead of full re-fetch for better UX
            setSales(prev => prev.map(s => s.id === saleId ? { ...s, [field]: !currentValue } : s))
        } catch (err) {
            console.error('Error toggling permission:', err)
            alert('Error al actualizar permisos')
        }
    }

    const filteredSales = sales.filter(s => {
        const saleDate = new Date(s.created_at)
        const saleLocalDate = getLocalDate(s.created_at)

        const matchesSearch = (s.customers?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (s.sale_number?.toString() || '').includes(searchTerm) ||
            (s.id?.toString() || '').includes(searchTerm)

        const matchesBranch = filterBranchId === 'all' ||
            String(s.branch_id || '') === String(filterBranchId) ||
            String(s.branches?.id || '') === String(filterBranchId)

        const matchesSeller = filterSellerId === 'all' || String(s.user_id) === String(filterSellerId)

        const paidAmount = s.customer_payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0
        const isDebt = s.is_credit && (s.total - paidAmount > 0.01)
        const matchesDebt = !filterOnlyDebts || isDebt

        let matchesTime = true
        if (filterMode === 'day') {
            matchesTime = saleLocalDate === filterDay
        } else if (filterMode === 'month') {
            matchesTime = (saleDate.getMonth() + 1).toString() === filterMonth && saleDate.getFullYear().toString() === filterYear
        } else if (filterMode === 'range') {
            matchesTime = saleLocalDate >= filterStartDate && saleLocalDate <= filterEndDate
        }

        return matchesSearch && matchesBranch && matchesTime && matchesSeller && matchesDebt
    })

    const filteredItems = saleItems.filter(item => {
        const s = item.sales
        if (!s) return false

        const saleDate = new Date(s.created_at)
        const saleLocalDate = getLocalDate(s.created_at)

        const matchesSearch = (item.products?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (s.sale_number?.toString() || '').includes(searchTerm) ||
            (item.products?.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase())

        const matchesBranch = filterBranchId === 'all' || String(s.branch_id || '') === String(filterBranchId)

        const matchesSeller = filterSellerId === 'all' || String(s.user_id || '') === String(filterSellerId)

        let matchesTime = true
        if (filterMode === 'day') {
            matchesTime = saleLocalDate === filterDay
        } else if (filterMode === 'month') {
            matchesTime = (saleDate.getMonth() + 1).toString() === filterMonth && saleDate.getFullYear().toString() === filterYear
        } else if (filterMode === 'range') {
            matchesTime = saleLocalDate >= filterStartDate && saleLocalDate <= filterEndDate
        }

        return matchesSearch && matchesBranch && matchesTime && matchesSeller
    })

    const aggregatedItems = filteredItems.reduce((acc, item) => {
        const isGlobalFilter = filterSellerId === 'all'
        const sellerName = isGlobalFilter ? 'Todos' : (item.sales?.profiles?.full_name || 'Sistema')
        const key = isGlobalFilter ? `${item.product_id}-${item.price}` : `${item.product_id}-${item.price}-${sellerName}`
        
        if (!acc[key]) {
            acc[key] = {
                id: item.id,
                product_id: item.product_id,
                name: item.products?.name,
                sku: item.products?.sku,
                brand: item.products?.brand?.name,
                price: item.price,
                seller: sellerName,
                totalQuantity: 0,
                totalBruto: 0
            }
        }
        acc[key].totalQuantity += item.quantity
        acc[key].totalBruto += item.total
        return acc
    }, {})

    const displayItems = Object.values(aggregatedItems).sort((a, b) => a.name.localeCompare(b.name))

    const totalGeneralQty = displayItems.reduce((acc, item) => acc + item.totalQuantity, 0)
    const totalGeneralBruto = displayItems.reduce((acc, item) => acc + item.totalBruto, 0)

    // Metrics calculation (based on global sales but with local time awareness)
    const today = getLocalDate(new Date())

    const salesToday = sales.filter(s => getLocalDate(s.created_at) === today)
    const totalToday = salesToday.reduce((acc, s) => acc + (s.total || 0), 0)

    // Average ticket based on filtered list to provide context to the current view
    const avgSale = filteredSales.length > 0 ? (filteredSales.reduce((acc, s) => acc + (s.total || 0), 0) / filteredSales.length) : 0

    const totalMonth = sales.filter(s => {
        const d = new Date(s.created_at)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((acc, s) => acc + (s.total || 0), 0)

    const exportToExcel = () => {
        let data = [];
        let fileName = "";
        let sheetName = "";

        if (activeTab === 'products') {
            data = displayItems.map(item => ({
                'Producto': item.name,
                'SKU': item.sku || '---',
                'Marca': item.brand || '---',
                'Vendedor': item.seller,
                'Cantidad': item.totalQuantity,
                'Precio Unit.': item.price,
                'Total Bruto': item.totalBruto
            }));
            fileName = `Reporte_Productos_Vendidos_${new Date().toISOString().split('T')[0]}.xlsx`;
            sheetName = "Productos Vendidos";
        } else {
            data = filteredSales.map(s => ({
                'Orden': `#${s.sale_number || s.id}`,
                'Cliente': s.customers?.name || 'Cliente General',
                'Sucursal': s.branches?.name,
                'Vendedor': s.profiles?.full_name || 'N/A',
                'Fecha': new Date(s.created_at).toLocaleDateString(),
                'Hora': new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                'Total': s.total
            }));
            fileName = `Reporte_Ventas_${new Date().toISOString().split('T')[0]}.xlsx`;
            sheetName = "Ventas";
        }

        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, sheetName);
        writeFile(wb, fileName);
    }

    const printReport = () => {
        const isSoldTab = activeTab === 'products'
        const printWindow = window.open('', '_blank');
        const content = `
            <html>
            <head>
                <title>${isSoldTab ? 'Reporte de Productos Vendidos' : 'Reporte de Ventas'}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #1a1a1a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 25px; }
                    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; font-size: 13px; }
                    th { background-color: #f9fafb; font-weight: bold; color: #374151; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
                    .footer { margin-top: 40px; text-align: right; font-weight: 900; font-size: 18px; color: #3b82f6; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 style="margin: 0; font-size: 28px;">${isSoldTab ? 'REPORTE DE PRODUCTOS VENDIDOS' : 'REPORTE GENERAL DE VENTAS'}</h1>
                    <p style="margin: 5px 0; opacity: 0.6;">Generado el: ${new Date().toLocaleString()}</p>
                </div>
                <table>
                    <thead>
                        ${isSoldTab ? `
                            <tr>
                                <th>PRODUCTO</th>
                                <th>SKU</th>
                                <th>VENDEDOR</th>
                                <th style="text-align: center;">CANTIDAD</th>
                                <th style="text-align: right;">PRECIO UNIT.</th>
                                <th style="text-align: right;">TOTAL BRUTO</th>
                            </tr>
                        ` : `
                            <tr>
                                <th>ORDEN</th>
                                <th>CLIENTE</th>
                                <th>SUCURSAL</th>
                                <th>VENDEDOR</th>
                                <th>FECHA Y HORA</th>
                                <th style="text-align: right;">TOTAL</th>
                            </tr>
                        `}
                    </thead>
                    <tbody>
                        ${isSoldTab ? 
                            displayItems.map(item => `
                                <tr>
                                    <td style="font-weight: bold;">${item.name}</td>
                                    <td>${item.sku || '---'}</td>
                                    <td>${item.seller}</td>
                                    <td style="text-align: center;">${item.totalQuantity}</td>
                                    <td style="text-align: right;">${currencySymbol}${item.price?.toFixed(2)}</td>
                                    <td style="text-align: right; font-weight: bold;">${currencySymbol}${item.totalBruto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('')
                            :
                            filteredSales.map(s => `
                                <tr>
                                    <td style="font-weight: bold;">#${s.sale_number || s.id}</td>
                                    <td>${s.customers?.name || 'Cliente General'}</td>
                                    <td>${s.branches?.name}</td>
                                    <td>${s.profiles?.full_name || 'N/A'}</td>
                                    <td>${new Date(s.created_at).toLocaleString()}</td>
                                    <td style="text-align: right; font-weight: bold;">${currencySymbol}${s.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
                <div class="footer">
                    <p>TOTAL GENERAL: ${currencySymbol}${(isSoldTab ? totalGeneralBruto : filteredSales.reduce((acc, s) => acc + (s.total || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p style="font-size: 12px; font-weight: normal; color: #6b7280; margin-top: 5px;">${isSoldTab ? `Productos listados: ${displayItems.length}` : `Transacciones reportadas: ${filteredSales.length}`}</p>
                </div>
                <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
            </body>
            </html>
        `;
        printWindow.document.write(content);
        printWindow.document.close();
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {isModalOpen && (
                <SaleModal
                    initialData={editingSale}
                    isSaving={isSaving}
                    readOnly={isReadOnly}
                    currencySymbol={currencySymbol}
                    onClose={() => { setIsModalOpen(false); setEditingSale(null); setIsReadOnly(false); }}
                    onSave={handleSave}
                />
            )}

            {isEditModalOpen && editingSaleForEdit && (
                <EditSaleModal
                    sale={editingSaleForEdit}
                    isSaving={isSaving}
                    currencySymbol={currencySymbol}
                    onClose={() => { setIsEditModalOpen(false); setEditingSaleForEdit(null); }}
                    onSave={async (saleData) => {
                        try {
                            setIsSaving(true)
                            const { items, ...header } = saleData
                            const { data: { user } } = await supabase.auth.getUser()
                            const targetSaleId = editingSaleForEdit.id

                            // Deduplicate items by product_id (merge quantities)
                            const mergedItems = {}
                            items.forEach(item => {
                                const pid = String(item.product_id)
                                if (mergedItems[pid]) {
                                    mergedItems[pid].quantity += Number(item.quantity)
                                    mergedItems[pid].total += Number(item.total)
                                } else {
                                    mergedItems[pid] = {
                                        product_id: Number(item.product_id),
                                        quantity: Number(item.quantity),
                                        price: Number(item.price),
                                        total: Number(item.total)
                                    }
                                }
                            })
                            const uniqueItems = Object.values(mergedItems)

                            // Use atomic RPC to handle stock reversal + re-deduction in one transaction
                            const { error: rpcError } = await supabase.rpc('modify_sale_items', {
                                p_sale_id: String(targetSaleId),
                                p_items: uniqueItems,
                                p_subtotal: Number(header.subtotal),
                                p_tax: Number(header.tax),
                                p_discount: Number(header.discount),
                                p_total: Number(header.total),
                                p_user_id: user?.id ? String(user.id) : ''
                            })

                            if (rpcError) throw rpcError

                            setIsEditModalOpen(false)
                            setEditingSaleForEdit(null)
                            fetchSales()
                            fetchSaleItems()
                        } catch (err) {
                            console.error(err)
                            alert('Error al modificar la venta: ' + err.message)
                        } finally {
                            setIsSaving(false)
                        }
                    }}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.03em', margin: 0 }}>Historial de Ventas</h1>
                    <p style={{ opacity: 0.5, fontWeight: '500' }}>Gestión integral de transacciones y facturación</p>
                </div>
                <div style={{ display: 'flex', backgroundColor: 'hsl(var(--secondary) / 0.5)', padding: '0.35rem', borderRadius: '16px', gap: '0.35rem' }}>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{
                            border: 'none',
                            padding: '0.6rem 1.5rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '900',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'history' ? 'white' : 'transparent',
                            color: activeTab === 'history' ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground) / 0.5)',
                            boxShadow: activeTab === 'history' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <ClipboardList size={18} />
                        HISTORIAL DE VENTAS
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        style={{
                            border: 'none',
                            padding: '0.6rem 1.5rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '900',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'products' ? 'white' : 'transparent',
                            color: activeTab === 'products' ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground) / 0.5)',
                            boxShadow: activeTab === 'products' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <ShoppingCart size={18} />
                        PRODUCTOS VENDIDOS
                    </button>
                    <button
                        onClick={() => setActiveTab('detailed')}
                        style={{
                            border: 'none',
                            padding: '0.6rem 1.5rem',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '900',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'detailed' ? 'white' : 'transparent',
                            color: activeTab === 'detailed' ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground) / 0.5)',
                            boxShadow: activeTab === 'detailed' ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Tag size={18} />
                        TICKETS DETALLADOS
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                {[
                    { label: 'Total Filtrado', val: `${currencySymbol}${filteredSales.reduce((acc, s) => acc + (s.total || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <TrendingUp size={24} />, bg: 'linear-gradient(135deg, hsl(142 76% 36%), hsl(142 70% 45%))', trend: `Sumatoria actual` },
                    { label: 'Transacciones', val: filteredSales.length, icon: <ClipboardList size={24} />, bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)', trend: 'Resultados encontrados' }
                ].map((m, i) => (

                    <div key={i} className="card shadow-md" style={{ background: m.bg, color: 'white', border: 'none', padding: '1.5rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, transform: 'rotate(-15deg)' }}>{m.icon}</div>
                        <p style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em', margin: 0 }}>{m.label}</p>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0, letterSpacing: '-0.02em' }}>{m.val}</h2>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: '6px', alignSelf: 'flex-start' }}>{m.trend}</span>
                    </div>
                ))}
            </div>

            <div className="card shadow-sm" style={{ padding: '1.25rem', borderRadius: '24px', border: '1px solid hsl(var(--border) / 0.6)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', backgroundColor: 'white' }}>
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
                    {/* Seller Filter */}
                    <div style={{ position: 'relative', minWidth: '200px' }}>
                        <select
                            value={filterSellerId}
                            onChange={(e) => setFilterSellerId(e.target.value)}
                            style={{ 
                                width: '100%', 
                                padding: '0.85rem 1rem 0.85rem 2.5rem', 
                                backgroundColor: 'hsl(var(--secondary) / 0.3)', 
                                borderRadius: '14px', 
                                border: '1px solid transparent',
                                fontWeight: '700', 
                                fontSize: '0.9rem', 
                                outline: 'none',
                                appearance: 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            <option value="all">Todos los Vendedores</option>
                            {sellers.map(seller => (
                                <option key={seller.id} value={seller.id}>{seller.full_name}</option>
                            ))}
                        </select>
                        <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--primary))' }} />
                    </div>

                    {/* Date Picker */}
                    <div style={{ position: 'relative' }}>
                        <input
                            type="date"
                            style={{ 
                                padding: '0.85rem 1rem 0.85rem 2.5rem', 
                                backgroundColor: 'hsl(var(--secondary) / 0.3)', 
                                borderRadius: '14px', 
                                border: '1px solid transparent',
                                fontWeight: '700', 
                                fontSize: '0.9rem', 
                                outline: 'none' 
                            }}
                            value={filterDay}
                            onChange={(e) => setFilterDay(e.target.value)}
                        />
                        <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--primary))' }} />
                    </div>

                    <div style={{ width: '1px', height: '2.5rem', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0 0.5rem' }}></div>

                    {/* Mode Selector */}
                    <div style={{ display: 'flex', backgroundColor: 'hsl(var(--secondary) / 0.4)', padding: '0.35rem', borderRadius: '14px', gap: '0.35rem' }}>
                        {['day', 'month', 'year', 'range'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => setFilterMode(mode)}
                                style={{
                                    border: 'none',
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '11px',
                                    fontSize: '0.8rem',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    backgroundColor: filterMode === mode ? 'white' : 'transparent',
                                    color: filterMode === mode ? 'hsl(var(--primary))' : 'hsl(var(--secondary-foreground) / 0.6)',
                                    boxShadow: filterMode === mode ? '0 4px 10px rgba(0,0,0,0.06)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {mode === 'day' ? 'DÍA' : mode === 'month' ? 'MES' : mode === 'year' ? 'AÑO' : 'RANGO'}
                            </button>
                        ))}
                    </div>

                    <div style={{ width: '1px', height: '2.5rem', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0 0.5rem' }}></div>

                    {/* Dynamic Filters based on Mode */}
                    {filterMode === 'month' && (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <select
                                style={{ padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                            >
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                                    <option key={i} value={(i + 1).toString()}>{m}</option>
                                ))}
                            </select>
                            <select
                                style={{ padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterYear}
                                onChange={(e) => setFilterYear(e.target.value)}
                            >
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <option key={y} value={y.toString()}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filterMode === 'year' && (
                        <select
                            style={{ padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y.toString()}>{y}</option>
                            ))}
                        </select>
                    )}

                    {filterMode === 'range' && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input
                                type="date"
                                style={{ padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                            />
                            <span style={{ fontWeight: '800', opacity: 0.5 }}>-</span>
                            <input
                                type="date"
                                style={{ padding: '0.85rem 1rem', backgroundColor: 'hsl(var(--secondary) / 0.3)', borderRadius: '14px', border: 'none', fontWeight: '700', fontSize: '0.9rem', outline: 'none' }}
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                            />
                        </div>
                    )}

                    <div style={{ width: '1px', height: '2.5rem', backgroundColor: 'hsl(var(--border) / 0.5)', margin: '0 0.5rem' }}></div>

                    {/* Debt Filter Toggle */}
                    <button
                        onClick={() => setFilterOnlyDebts(!filterOnlyDebts)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.85rem 1.25rem',
                            borderRadius: '14px',
                            border: '1px solid ' + (filterOnlyDebts ? '#fca5a5' : 'transparent'),
                            backgroundColor: filterOnlyDebts ? '#fef2f2' : 'hsl(var(--secondary) / 0.3)',
                            color: filterOnlyDebts ? '#ef4444' : 'hsl(var(--secondary-foreground) / 0.7)',
                            fontWeight: '800',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <AlertTriangle size={18} color={filterOnlyDebts ? '#ef4444' : 'currentColor'} />
                        SOLO DEUDAS
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={exportToExcel} className="btn-hover" style={{ padding: '0.85rem 1.5rem', borderRadius: '14px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontWeight: '900', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                        <Download size={18} /> Exportar Excel
                    </button>
                    <button onClick={printReport} className="btn-hover" style={{ padding: '0.85rem 1.5rem', borderRadius: '14px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: '900', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                        <Printer size={18} /> Imprimir Reporte
                    </button>
                    <button
                        onClick={() => {
                            if (selectedBranchId) setFilterBranchId(selectedBranchId)
                            else setFilterBranchId('all');
                            setFilterMode('day');
                            setFilterDay(getLocalDate(new Date()));
                            setFilterSellerId('all');
                            setFilterOnlyDebts(false);
                            setSearchTerm('');
                        }}
                        style={{ padding: '0.85rem 1.5rem', borderRadius: '14px', backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                        Limpiar
                    </button>
                </div>
            </div>


            <div className="card shadow-sm" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)' }}>
                {activeTab === 'history' ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.3)' }}>
                            <tr>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Orden</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Cliente</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Sucursal</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Vendedor</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Fecha</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Total</th>
                                <th style={{ padding: '0.6rem 1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', opacity: 0.5 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && sales.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: '6rem', textAlign: 'center' }}>
                                        <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                                    </td>
                                </tr>
                            ) : filteredSales.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ padding: '6rem', textAlign: 'center' }}>
                                        <div style={{ opacity: 0.2, marginBottom: '1rem' }}><ShoppingCart size={64} style={{ margin: '0 auto' }} /></div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', opacity: 0.4 }}>No hay ventas registradas</h3>
                                        <p style={{ opacity: 0.3, fontSize: '0.9rem' }}>Realiza tu primera venta en el punto de venta.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSales.map(s => (
                                     <tr key={s.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.2)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '0.4rem 1rem' }}>
                                            <span style={{ backgroundColor: 'hsl(var(--primary) / 0.08)', color: 'hsl(var(--primary))', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900' }}>#{s.sale_number || s.id.slice(0, 8)}</span>
                                        </td>
                                        <td style={{ padding: '0.4rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'hsl(var(--secondary) / 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--secondary-foreground) / 0.6)' }}>
                                                    <User size={12} />
                                                </div>
                                                <span style={{ fontWeight: '800', fontSize: '0.8rem', color: 'hsl(var(--foreground))' }}>{s.customers?.name || 'Cliente General'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.4rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'hsl(var(--secondary-foreground) / 0.7)', fontWeight: '600' }}>
                                                <Building2 size={12} />
                                                {s.branches?.name}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: 'hsl(var(--secondary-foreground) / 0.6)' }}>
                                            {s.profiles?.full_name?.split(' ')[0]}
                                        </td>
                                        <td style={{ padding: '0.4rem 1rem' }}>
                                            <div style={{ fontWeight: '800', fontSize: '0.75rem', color: 'hsl(var(--foreground))' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                                            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td style={{ padding: '0.4rem 1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span style={{ fontSize: '1rem', fontWeight: '900', letterSpacing: '-0.02em', color: s.is_credit ? 'hsl(var(--destructive))' : 'inherit' }}>{currencySymbol}{s.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                {s.is_credit && (
                                                    <>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#ef4444' }}>
                                                            Pend: {currencySymbol}{(s.total - (s.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toFixed(2)}
                                                        </span>
                                                        <span style={{ fontSize: '0.55rem', fontWeight: '900', backgroundColor: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', padding: '1px 4px', borderRadius: '3px', marginTop: '2px' }}>CRÉDITO</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.4rem 1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
                                                {s.is_credit && (s.total - (s.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)) > 0 && (
                                                    <button 
                                                        onClick={() => { setSelectedSaleForPayment(s); setPaymentModalOpen(true); setPaymentAmount(''); setCashAmount(''); setQrAmount(''); setPaymentMethod('Efectivo'); }} 
                                                        className="btn" 
                                                        style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: 'hsl(142 76% 36% / 0.1)', color: 'hsl(142 76% 36%)' }} 
                                                        title="Registrar Pago"
                                                    >
                                                        <HandCoins size={14} />
                                                    </button>
                                                )}
                                                <button onClick={() => handlePrint(s)} className="btn" style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--foreground))' }} title="Imprimir Ticket"><Printer size={14} /></button>
                                                <button onClick={() => setSelectedSaleForDetail(s)} className="btn" style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: 'hsl(var(--secondary) / 0.5)', color: 'hsl(var(--primary))' }} title="Ver Detalles"><Eye size={14} /></button>
                                                {(isAdmin || s.can_void) && (
                                                    <button onClick={() => handleVoid(s)} className="btn" style={{ padding: '0.35rem', borderRadius: '8px', backgroundColor: 'hsl(var(--destructive) / 0.05)', color: 'hsl(var(--destructive))' }} title="Anular"><Trash2 size={14} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                ) : activeTab === 'detailed' ? (
                    <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc' }}>
                        {loading ? (
                            <div style={{ padding: '4rem', textAlign: 'center' }}>
                                <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                            </div>
                        ) : filteredSales.length === 0 ? (
                            <div style={{ padding: '4rem', textAlign: 'center' }}>
                                <div style={{ opacity: 0.2, marginBottom: '0.5rem' }}><ShoppingCart size={48} style={{ margin: '0 auto' }} /></div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '800', opacity: 0.4 }}>No se encontraron tickets</h3>
                            </div>
                        ) : (
                            filteredSales.map(s => {
                                const ticketItems = (saleItems || []).filter(item => String(item.sale_id) === String(s.id));
                                return (
                                    <div key={s.id} className="card-hover" style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', transition: 'all 0.2s ease', boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.05)', marginBottom: '0.75rem' }}>
                                        {/* Card Header */}
                                        <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>TICKET</span>
                                                    <span style={{ fontSize: '1rem', fontWeight: '900', color: 'hsl(217 91% 60%)' }}>#{s.sale_number}</span>
                                                </div>
                                                <div style={{ height: '16px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
                                                <div>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', marginRight: '0.4rem', textTransform: 'uppercase' }}>Fecha:</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>{new Date(s.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                                <div style={{ height: '16px', width: '1px', backgroundColor: '#e2e8f0' }}></div>
                                                <div>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', marginRight: '0.4rem', textTransform: 'uppercase' }}>Cliente:</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#1e293b' }}>{s.customers?.name || 'Cliente General'}</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                {s.is_credit && (
                                                    <div style={{ backgroundColor: '#fff1f2', color: '#e11d48', padding: '2px 8px', borderRadius: '6px', fontSize: '0.6rem', fontWeight: '900', border: '1px solid #ffe4e6' }}>
                                                        CRÉDITO
                                                    </div>
                                                )}
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{ fontSize: '1.2rem', fontWeight: '900', color: 'hsl(217 91% 60%)', letterSpacing: '-0.02em' }}>{currencySymbol}{s.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', alignItems: 'stretch' }}>
                                            <div style={{ padding: '1rem', borderRight: '1px solid #f1f5f9' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <h4 style={{ fontSize: '0.65rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Detalle de Venta</h4>
                                                    <span style={{ fontSize: '0.6rem', color: 'hsl(217 91% 60%)', fontWeight: '800', backgroundColor: 'hsl(217 91% 60% / 0.1)', padding: '2px 8px', borderRadius: '20px' }}>{ticketItems.length} Productos</span>
                                                </div>
                                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ padding: '0 1rem 0.5rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Descripción</th>
                                                            <th style={{ padding: '0 1rem 0.5rem 1rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Cant.</th>
                                                            <th style={{ padding: '0 1rem 0.5rem 1rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Subtotal</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ticketItems.map((item, idx) => (
                                                            <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#fcfcfc' : 'white' }}>
                                                                <td style={{ padding: '0.5rem', borderRadius: '8px 0 0 8px', border: '1px solid #f1f5f9', borderRight: 'none' }}>
                                                                    <div style={{ fontWeight: '900', color: '#1e293b', fontSize: '0.85rem' }}>{item.products?.name}</div>
                                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>P. Unit: {currencySymbol}{item.price?.toFixed(2)}</div>
                                                                </td>
                                                                <td style={{ padding: '0.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: '900', color: '#475569' }}>{item.quantity}</span>
                                                                </td>
                                                                <td style={{ padding: '0.5rem', textAlign: 'right', borderRadius: '0 8px 8px 0', border: '1px solid #f1f5f9', borderLeft: 'none', fontWeight: '900', color: '#0f172a', fontSize: '0.9rem' }}>
                                                                    {currencySymbol}{item.total?.toFixed(2)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div style={{ padding: '1rem', backgroundColor: '#fcfdfe', borderLeft: '1px solid #f1f5f9' }}>
                                                <div style={{ position: 'sticky', top: '1rem' }}>
                                                    {s.is_credit ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                            <h4 style={{ fontSize: '0.65rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Estado Crediticio</h4>
                                                            <div style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #ffe4e6', boxShadow: '0 2px 8px -2px rgba(225, 29, 72, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                <div>
                                                                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: '#e11d48', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Saldo:</span>
                                                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#e11d48', letterSpacing: '-0.03em' }}>
                                                                        {currencySymbol}{(s.total - (s.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                
                                                                {(s.total - (s.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)) > 0.01 && (
                                                                    <button 
                                                                        onClick={() => { setSelectedSaleForPayment(s); setPaymentModalOpen(true); setPaymentAmount(''); setCashAmount(''); setQrAmount(''); setPaymentMethod('Efectivo'); }}
                                                                        style={{ 
                                                                            width: '100%', 
                                                                            padding: '0.75rem', 
                                                                            borderRadius: '12px', 
                                                                            backgroundColor: '#e11d48', 
                                                                            color: 'white', 
                                                                            border: 'none', 
                                                                            fontWeight: '900', 
                                                                            fontSize: '0.85rem', 
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '0.5rem',
                                                                            boxShadow: '0 4px 12px rgba(225, 29, 72, 0.2)'
                                                                        }}
                                                                    >
                                                                        <HandCoins size={18} /> Registrar Abono
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historial de Abonos</span>
                                                                {s.customer_payments?.length > 0 ? (
                                                                    s.customer_payments.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(pay => (
                                                                        <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                                            <span style={{ color: '#64748b', fontWeight: '800', fontSize: '0.8rem' }}>{new Date(pay.created_at).toLocaleDateString()}</span>
                                                                            <span style={{ color: '#10b981', fontWeight: '900', fontSize: '0.95rem' }}>+{currencySymbol}{pay.amount?.toFixed(2)}</span>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', fontSize: '0.8rem', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>Sin registros</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.5rem 1rem', borderRadius: '50px', border: '1px solid #bbf7d0' }}>
                                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16a34a', boxShadow: '0 0 8px #16a34a' }}></div>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: '900' }}>VENTA PAGADA</span>
                                                            </div>
                                                            <div style={{ marginTop: '1rem' }}>
                                                                <p style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '800', marginBottom: '2px' }}>Transacción Completada</p>
                                                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>Cobro al contado</p>
                                                            </div>
                                                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                                                <span style={{ fontSize: '0.6rem', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase' }}>Ref: {String(s.id).slice(0, 10)}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: 'hsl(var(--secondary) / 0.1)' }}>
                            <tr>
                                <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>Producto</th>
                                <th style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>Cant. Total</th>
                                <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>P. Unit</th>
                                <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>Total Bruto</th>
                                <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>Vendedor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingItems && saleItems.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '6rem', textAlign: 'center' }}>
                                        <RefreshCw size={40} className="animate-spin" style={{ margin: '0 auto', color: 'hsl(var(--primary))', opacity: 0.3 }} />
                                    </td>
                                </tr>
                            ) : displayItems.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '6rem', textAlign: 'center' }}>
                                        <div style={{ opacity: 0.2, marginBottom: '1rem' }}><ShoppingCart size={64} style={{ margin: '0 auto' }} /></div>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', opacity: 0.4 }}>No se encontraron productos</h3>
                                        <p style={{ opacity: 0.3, fontSize: '0.9rem' }}>Ajusta los filtros para ver más resultados.</p>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {displayItems.map((item, idx) => (
                                        <tr key={`${item.product_id}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.75rem 1.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{
                                                        backgroundColor: 'hsl(217 91% 60% / 0.1)',
                                                        color: 'hsl(217 91% 60%)',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: '900',
                                                        textTransform: 'uppercase',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {item.brand || 'S/M'}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e293b' }}>{item.name}</span>
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>SKU: {item.sku || '---'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                                                <span style={{
                                                    backgroundColor: 'hsl(217 91% 60% / 0.1)',
                                                    color: 'hsl(217 91% 60%)',
                                                    padding: '6px 12px',
                                                    borderRadius: '10px',
                                                    fontWeight: '900',
                                                    fontSize: '1rem',
                                                    minWidth: '40px',
                                                    display: 'inline-block'
                                                }}>
                                                    {item.totalQuantity}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: '600', color: '#64748b' }}>
                                                {currencySymbol}{item.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', fontWeight: '900', color: '#0f172a', fontSize: '1.05rem' }}>
                                                {currencySymbol}{item.totalBruto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '0.75rem 1.25rem', textAlign: 'right', color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>
                                                {item.seller}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ backgroundColor: 'white' }}>
                                        <td style={{ padding: '1.5rem 1.25rem', fontWeight: '900', fontSize: '1.1rem', color: '#0f172a', textTransform: 'uppercase' }}>
                                            TOTAL GENERAL
                                        </td>
                                        <td style={{ padding: '1.25rem', textAlign: 'center' }}>
                                            <span style={{
                                                backgroundColor: 'hsl(217 91% 60%)',
                                                color: 'white',
                                                padding: '8px 16px',
                                                borderRadius: '12px',
                                                fontWeight: '900',
                                                fontSize: '1.1rem'
                                            }}>
                                                {totalGeneralQty}
                                            </span>
                                        </td>
                                        <td></td>
                                        <td style={{ padding: '1.25rem', textAlign: 'right', fontWeight: '900', color: 'hsl(217 91% 60%)', fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
                                            {currencySymbol}{totalGeneralBruto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td></td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Detalle de Venta (Imagen 4) */}
            {selectedSaleForDetail && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '2rem' }}>
                    <div className="card shadow-2xl" style={{ backgroundColor: 'white', padding: 0, borderRadius: '24px', maxWidth: '1000px', width: '100%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: 'none' }}>
                        {/* Header Section */}
                        <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div>
                                    <p style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase' }}>TICKET</p>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '900', color: 'hsl(217 91% 60%)', margin: 0 }}>#{selectedSaleForDetail.sale_number}</h3>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase' }}>CLIENTE</p>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#1e293b', margin: 0 }}>{selectedSaleForDetail.customers?.name || 'Cliente General'}</h3>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase' }}>VENDEDOR</p>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#64748b', margin: 0 }}>{selectedSaleForDetail.profiles?.full_name?.split(' ')[0]}</h3>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase' }}>FECHA</p>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#64748b', margin: 0 }}>{new Date(selectedSaleForDetail.created_at).toLocaleDateString()}</h3>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.6rem', fontWeight: '800', color: '#94a3b8', margin: '0 0 2px 0', textTransform: 'uppercase' }}>TOTAL</p>
                                <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'hsl(217 91% 60%)', margin: 0, lineHeight: 1 }}>{currencySymbol}{selectedSaleForDetail.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                                {selectedSaleForDetail.is_credit && (
                                    <p style={{ fontSize: '0.85rem', fontWeight: '900', color: '#ef4444', margin: '4px 0 0 0' }}>
                                        Saldo Pendiente: {currencySymbol}{(selectedSaleForDetail.total - (selectedSaleForDetail.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toFixed(2)}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setSelectedSaleForDetail(null)} className="btn" style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', opacity: 0.3 }}><X size={20} /></button>
                        </div>

                        {/* Body Section */}
                        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1rem 2rem' }}>
                            {/* Products Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'left', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>PRODUCTO</th>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>CANT.</th>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'right', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>PRECIO</th>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'right', fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {saleItems.filter(i => i.sale_id === selectedSaleForDetail.id).map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.6rem 0' }}>
                                                <div style={{ fontWeight: '900', fontSize: '0.85rem', color: '#0f172a' }}>{item.products?.name}</div>
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>SKU: {item.products?.sku || '---'}</div>
                                            </td>
                                            <td style={{ padding: '0.6rem 0', textAlign: 'center', fontWeight: '900', fontSize: '0.9rem', color: '#1e293b' }}>{item.quantity}</td>
                                            <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: '700', fontSize: '0.85rem', color: '#1e293b' }}>{currencySymbol}{item.price?.toFixed(2)}</td>
                                            <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: '900', fontSize: '0.9rem', color: '#0f172a' }}>{currencySymbol}{item.total?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Notas de la Venta */}
                            {selectedSaleForDetail.notes && (
                                <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'hsl(var(--secondary) / 0.1)', borderRadius: '16px', border: '1px solid hsl(var(--border) / 0.4)' }}>
                                    <h4 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <ClipboardList size={14} /> Notas / Observaciones
                                    </h4>
                                    <p style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedSaleForDetail.notes}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
                                {selectedSaleForDetail.is_credit && (selectedSaleForDetail.total - (selectedSaleForDetail.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)) > 0 && (
                                    <button 
                                        onClick={() => { setSelectedSaleForPayment(selectedSaleForDetail); setPaymentModalOpen(true); setPaymentAmount('') }} 
                                        className="btn" 
                                        style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    >
                                        <HandCoins size={18} /> Registrar Pago
                                    </button>
                                )}
                                <button onClick={() => handlePrint(selectedSaleForDetail)} className="btn" style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Printer size={18} /> Re-imprimir Ticket
                                </button>
                            </div>

                            {/* Dotted Line Separator */}
                            <div style={{ borderTop: '1px dotted #e2e8f0', margin: '2rem 0' }}></div>

                            {/* Payment History */}
                            {selectedSaleForDetail.is_credit && (
                                <div style={{ marginTop: '1rem' }}>
                                    <h4 style={{ fontSize: '0.7rem', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>HISTORIAL DE PAGOS</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {selectedSaleForDetail.customer_payments?.length > 0 ? (
                                            selectedSaleForDetail.customer_payments.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(pay => (
                                                <div key={pay.id} style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: '900', fontSize: '1rem', color: '#1e293b' }}>{new Date(pay.created_at).toLocaleDateString()}</span>
                                                        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>{pay.payment_method}</span>
                                                    </div>
                                                    <span style={{ fontWeight: '900', fontSize: '1.1rem', color: '#10b981' }}>+{currencySymbol}{pay.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p style={{ opacity: 0.3, textAlign: 'center', padding: '2rem' }}>No hay pagos registrados aún.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Pago (Quick Pay) */}
            {paymentModalOpen && selectedSaleForPayment && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '2rem' }}>
                    <div className="card shadow-2xl" style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '24px', maxWidth: '400px', width: '100%', border: 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900' }}>Registrar Pago</h3>
                            <button onClick={() => setPaymentModalOpen(false)} style={{ opacity: 0.5 }}><X size={24} /></button>
                        </div>
                        
                        <div style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '16px' }}>
                            <div style={{ fontSize: '0.85rem', opacity: 0.6, fontWeight: '700' }}>TICKET #{selectedSaleForPayment.sale_number}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                                <span style={{ fontWeight: '700' }}>Total:</span>
                                <span style={{ fontWeight: '800' }}>{currencySymbol}{selectedSaleForPayment.total?.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginTop: '0.25rem' }}>
                                <span style={{ fontWeight: '700' }}>Pendiente:</span>
                                <span style={{ fontWeight: '900' }}>
                                    {currencySymbol}{(selectedSaleForPayment.total - (selectedSaleForPayment.customer_payments?.reduce((acc, p) => acc + p.amount, 0) || 0)).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.85rem' }}>Método de Pago</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {['Efectivo', 'QR', 'Mixto'].map(method => (
                                    <button
                                        key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '12px',
                                            border: '2px solid ' + (paymentMethod === method ? 'hsl(217 91% 60%)' : '#f1f5f9'),
                                            backgroundColor: paymentMethod === method ? 'hsl(217 91% 60% / 0.05)' : 'transparent',
                                            color: paymentMethod === method ? 'hsl(217 91% 60%)' : '#64748b',
                                            fontWeight: '800',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {method}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {paymentMethod === 'Mixto' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.4rem' }}>Monto Efectivo</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', opacity: 0.3 }}>{currencySymbol}</span>
                                        <input
                                            type="number"
                                            value={cashAmount}
                                            onChange={(e) => setCashAmount(e.target.value)}
                                            placeholder="0.00"
                                            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', borderRadius: '14px', border: '2px solid #f1f5f9', fontWeight: '900', fontSize: '1.1rem', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.4rem' }}>Monto QR</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', opacity: 0.3 }}>{currencySymbol}</span>
                                        <input
                                            type="number"
                                            value={qrAmount}
                                            onChange={(e) => setQrAmount(e.target.value)}
                                            placeholder="0.00"
                                            style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.5rem', borderRadius: '14px', border: '2px solid #f1f5f9', fontWeight: '900', fontSize: '1.1rem', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '800', opacity: 0.5, marginBottom: '0.5rem' }}>Monto a Abonar</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '900', opacity: 0.3 }}>{currencySymbol}</span>
                                    <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="0.00"
                                        style={{ width: '100%', padding: '1rem 1rem 1rem 2.5rem', borderRadius: '14px', border: '2px solid #e2e8f0', fontWeight: '900', fontSize: '1.25rem', outline: 'none' }}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={handleRegisterPayment}
                            disabled={isSaving || (paymentMethod === 'Mixto' ? (!cashAmount && !qrAmount) : !paymentAmount)}
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '1rem', borderRadius: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', backgroundColor: 'hsl(217 91% 60%)' }}
                        >
                            {isSaving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
                            Confirmar Abono
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden Ticket reference for printing */}
            <div style={{ display: 'none' }}>
                {saleForTicket && (
                    <Ticket
                        ref={ticketRef}
                        sale={saleForTicket.sale}
                        items={saleForTicket.items}
                        branch={saleForTicket.branch}
                        customer={saleForTicket.customer}
                        paymentMethod={saleForTicket.paymentMethod}
                        currencySymbol={saleForTicket.currencySymbol}
                    />
                )}
            </div>
        </div>

    )
}
