export const routes = {
    home: '/',
    campaignPattern: '/campaign/:campaignId',
    campaign: (id: string) => `/campaign/${encodeURIComponent(id)}`,
    scene: (campaignId: string, sceneId: string) =>
        `/campaign/${encodeURIComponent(campaignId)}?scene=${encodeURIComponent(sceneId)}`,
}
