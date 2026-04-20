package com.bi.service;

import com.bi.dto.FilterCondition;
import com.bi.vo.RuntimeDashboardVo;

import java.util.List;

public interface RuntimeService {
    RuntimeDashboardVo loadPublishedDashboard(String dashboardCode, Integer versionNo, List<FilterCondition> filters);
}
