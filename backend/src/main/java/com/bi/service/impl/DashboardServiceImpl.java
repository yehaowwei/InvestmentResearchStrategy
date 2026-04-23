package com.bi.service.impl;

import com.bi.dto.DashboardDraftDto;
import com.bi.dto.SaveDashboardRequest;
import com.bi.service.DashboardService;
import com.bi.service.dashboard.DashboardStoreSupport;
import com.bi.vo.PublishResultVo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DashboardServiceImpl implements DashboardService {
    private final DashboardStoreSupport dashboardStoreSupport;

    public DashboardServiceImpl(DashboardStoreSupport dashboardStoreSupport) {
        this.dashboardStoreSupport = dashboardStoreSupport;
    }

    @Override
    public List<DashboardDraftDto> listDashboards() {
        return dashboardStoreSupport.listDashboards();
    }

    @Override
    public DashboardDraftDto getDraft(String dashboardCode) {
        DashboardDraftDto draft = dashboardStoreSupport.loadDashboard(dashboardCode);
        draft.setComponents(dashboardStoreSupport.loadComponents(dashboardCode));
        return draft;
    }

    @Override
    @Transactional
    public DashboardDraftDto saveDraft(SaveDashboardRequest request) {
        DashboardDraftDto draft = request.getDraft();
        if (draft.getComponents() == null || draft.getComponents().isEmpty()) {
            throw new IllegalArgumentException("Dashboard must contain at least one component");
        }

        String requestedCode = request.getDashboardCode();
        String effectiveDashboardCode = requestedCode == null || requestedCode.isBlank()
                ? draft.getDashboardCode()
                : requestedCode;
        boolean creatingNewDashboard = effectiveDashboardCode == null || effectiveDashboardCode.isBlank();

        if (creatingNewDashboard || !dashboardStoreSupport.existsDashboard(effectiveDashboardCode)) {
            if (creatingNewDashboard) {
                effectiveDashboardCode = dashboardStoreSupport.insertDashboardAndGenerateCode(draft.getName());
            } else {
                dashboardStoreSupport.insertDashboard(effectiveDashboardCode, draft.getName());
            }
        } else {
            dashboardStoreSupport.updateDashboardDraft(effectiveDashboardCode, draft.getName());
        }

        dashboardStoreSupport.replaceComponents(effectiveDashboardCode, draft.getComponents());
        return getDraft(effectiveDashboardCode);
    }

    @Override
    @Transactional
    public PublishResultVo publish(String dashboardCode, String publishNote) {
        Integer versionNo = dashboardStoreSupport.publishDashboard(dashboardCode);
        return PublishResultVo.builder()
                .dashboardCode(dashboardCode)
                .versionNo(versionNo)
                .build();
    }

    @Override
    @Transactional
    public boolean deleteDashboard(String dashboardCode) {
        return dashboardStoreSupport.deleteDashboard(dashboardCode);
    }
}
