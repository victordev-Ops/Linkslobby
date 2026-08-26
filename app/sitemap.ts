import { MetadataRoute } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const revalidate = 86400 // Revalidate every 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.linkslobby.com'
  
  try {
    const supabase = await createSupabaseServerClient()

    // Fetch all public profiles for dynamic user routes
    const { data: profiles } = await supabase
      .from('profiles')
      .select('slug, updated_at')
      .eq('is_deactivated', false)
      .order('updated_at', { ascending: false })
      .limit(10000)

    const staticRoutes: MetadataRoute.Sitemap = [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date('2026-07-28'),
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date('2026-07-28'),
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/safety`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/login`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.9,
      },
    ]

    // Dynamic public profile routes
    const profileRoutes = (profiles || []).map((profile) => ({
      url: `${baseUrl}/u/${profile.slug}`,
      lastModified: new Date(profile.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    // Dynamic game link routes
    const gameRoutes = (profiles || []).flatMap((profile) => [
      {
        url: `${baseUrl}/confess/${profile.slug}`,
        lastModified: new Date(profile.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/ama/${profile.slug}`,
        lastModified: new Date(profile.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/dykm/${profile.slug}`,
        lastModified: new Date(profile.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/anonymous/${profile.slug}`,
        lastModified: new Date(profile.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/hot-seat/${profile.slug}`,
        lastModified: new Date(profile.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${baseUrl}/three-words/${profile.slug}`,
        lastModified: new Date(profile.updated_at),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      },
    ])

    return [...staticRoutes, ...profileRoutes, ...gameRoutes]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return just static routes if database fails
    return [
      {
        url: `${baseUrl}/`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/terms`,
        lastModified: new Date('2026-07-28'),
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/privacy`,
        lastModified: new Date('2026-07-28'),
        changeFrequency: 'monthly',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/safety`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: `${baseUrl}/login`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.9,
      },
    ]
  }
}
