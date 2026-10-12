export const routes = {
    home: '/',
    campaignPattern: '/campaign/:campaignId',
    campaign: (id: string) => `/campaign/${encodeURIComponent(id)}`,
}
