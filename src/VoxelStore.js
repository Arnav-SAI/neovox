import { create } from 'zustand'
import { supabase } from './lib/supabase'

export const useVoxelStore = create((set, get) => ({
    voxels: [],
    selectedColor: '#00ffff', // Default Neon Cyan (Brighter)

    setSelectedColor: (color) => set({ selectedColor: color }),

    // 1. Fetch all existing artifacts from the DB
    initializeVoxels: async () => {
        const { data, error } = await supabase
            .from('voxels')
            .select('x, y, z, color')

        if (error) {
            console.error('Error fetching voxels:', error)
            return
        }
        set({ voxels: data || [] })
    },

    // 2. Add a new artifact (Optimistic Update)
    addVoxel: async (x, y, z) => {
        const { selectedColor } = get()
        const newVoxel = { x, y, z, color: selectedColor }

        // Update local UI immediately for zero lag
        set((state) => ({ voxels: [...state.voxels, newVoxel] }))

        // Push to Supabase
        const { error } = await supabase.from('voxels').insert([newVoxel])

        if (error) {
            console.error('Error saving voxel:', error)
        }
    },

    // 3. Listen for other people's artifacts in real-time
    subscribeToVoxels: () => {
        const channel = supabase
            .channel('voxels_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voxels' },
                (payload) => {
                    const newVoxel = payload.new
                    const currentVoxels = get().voxels

                    // Only add if it's not already in our local state (prevent duplicates)
                    const exists = currentVoxels.some(v => v.x === newVoxel.x && v.y === newVoxel.y && v.z === newVoxel.z)
                    if (!exists) {
                        set((state) => ({ voxels: [...state.voxels, newVoxel] }))
                    }
                })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }
}))