import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BranchContext = createContext()

export function BranchProvider({ children }) {
    const [branches, setBranches] = useState([])
    const [selectedBranchId, setSelectedBranchId] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                fetchBranches()
            } else {
                setBranches([])
                setSelectedBranchId(null)
            }
        })

        fetchBranches()
        return () => subscription.unsubscribe()
    }, [])

    async function fetchBranches() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
            const isAdmin = profile?.role === 'Administrador'

            let query = supabase.from('branches').select('*').eq('active', true).order('name')
            
            if (!isAdmin) {
                const { data: assignments } = await supabase.from('user_branches').select('branch_id').eq('user_id', user.id)
                const assignedIds = assignments?.map(a => a.branch_id) || []
                if (assignedIds.length > 0) {
                    query = query.in('id', assignedIds)
                } else {
                    setBranches([])
                    setLoading(false)
                    return
                }
            }

            const { data } = await query
            if (data && data.length > 0) {
                const finalBranches = isAdmin ? [{ id: 'all', name: 'Todas las Sucursales' }, ...data] : data
                setBranches(finalBranches)
                
                // Usar localStorage para persistir la sucursal seleccionada
                const savedId = localStorage.getItem('selectedBranchId')
                const exists = finalBranches.find(b => b.id.toString() === savedId)
                if (exists) {
                    setSelectedBranchId(exists.id)
                } else {
                    setSelectedBranchId(finalBranches[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching global branches:', error)
        } finally {
            setLoading(false)
        }
    }

    const selectBranch = (id) => {
        setSelectedBranchId(id)
        localStorage.setItem('selectedBranchId', id)
    }

    const value = {
        branches,
        selectedBranchId,
        selectedBranch: branches.find(b => b.id === selectedBranchId),
        setSelectedBranchId: selectBranch,
        loading
    }

    return (
        <BranchContext.Provider value={value}>
            {children}
        </BranchContext.Provider>
    )
}

export function useBranch() {
    const context = useContext(BranchContext)
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider')
    }
    return context
}
