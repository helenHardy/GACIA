import { supabase } from '../lib/supabase'

export const inventoryService = {
    // BRANDS
    async getBrands() {
        const { data, error } = await supabase.from('brands').select('*').order('name')
        if (error) throw error
        return data
    },

    async createBrand(name) {
        const { data, error } = await supabase.from('brands').insert([{ name }]).select().single()
        if (error) throw error
        return data
    },

    async updateBrand(id, name) {
        const { data, error } = await supabase.from('brands').update({ name }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteBrand(id) {
        const { error } = await supabase.from('brands').delete().eq('id', id)
        if (error) throw error
    },

    // CATEGORIES
    async getCategories() {
        const { data, error } = await supabase.from('categories').select('*').order('name')
        if (error) throw error
        return data
    },

    async createCategory(name) {
        const { data, error } = await supabase.from('categories').insert([{ name }]).select().single()
        if (error) throw error
        return data
    },

    async updateCategory(id, name) {
        const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteCategory(id) {
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (error) throw error
    },

    // MODELS
    async getModels(brandId) {
        let query = supabase.from('models').select('*').order('name')
        if (brandId) {
            query = query.eq('brand_id', brandId)
        }
        const { data, error } = await query
        if (error) throw error
        return data
    },

    async createModel(name, brandId) {
        const { data, error } = await supabase.from('models').insert([{ name, brand_id: brandId }]).select().single()
        if (error) throw error
        return data
    },

    async updateModel(id, name, brandId) {
        const { data, error } = await supabase.from('models').update({ name, brand_id: brandId }).eq('id', id).select().single()
        if (error) throw error
        return data
    },

    async deleteModel(id) {
        const { error } = await supabase.from('models').delete().eq('id', id)
        if (error) throw error
    },

    // IMAGES
    async uploadProductImage(file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath)

        console.log('Generated Image URL:', data.publicUrl)
        return data.publicUrl
    }
}
