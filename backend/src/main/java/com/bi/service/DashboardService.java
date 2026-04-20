package com.bi.service;

import com.bi.dto.DashboardDraftDto;
import com.bi.dto.SaveDashboardRequest;
import com.bi.vo.PublishResultVo;

public interface DashboardService {
    java.util.List<com.bi.dto.DashboardDraftDto> listDashboards();

    DashboardDraftDto getDraft(String dashboardCode);

    DashboardDraftDto saveDraft(SaveDashboardRequest request);

    PublishResultVo publish(String dashboardCode, String publishNote);

    boolean deleteDashboard(String dashboardCode);
}
