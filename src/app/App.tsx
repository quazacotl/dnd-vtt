import {BrowserRouter, Navigate, Route, Routes} from 'react-router'

import {CampaignPage, campaignController} from '@/pages/campaign'
import {routes} from '@/shared/config/routes'

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path={routes.home}
                    element={<Navigate to={routes.campaign('demo')} replace />}
                />
                <Route
                    path={routes.campaignPattern}
                    element={<CampaignPage controller={campaignController} />}
                />
                <Route path="*" element={<Navigate to={routes.home} replace />} />
            </Routes>
        </BrowserRouter>
    )
}
