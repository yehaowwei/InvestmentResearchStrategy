package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ChartComponentDto;
import com.bi.dto.DashboardDraftDto;
import com.bi.dto.FilterCondition;
import com.bi.service.DashboardService;
import com.bi.service.RuntimeService;
import com.bi.vo.RuntimeDashboardVo;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class RuntimeServiceImpl implements RuntimeService {
    private final DashboardService dashboardService;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public RuntimeServiceImpl(DashboardService dashboardService, JsonSnapshotSupport jsonSnapshotSupport) {
        this.dashboardService = dashboardService;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    @Override
    public RuntimeDashboardVo loadPublishedDashboard(String dashboardCode, Integer versionNo, List<FilterCondition> filters) {
        DashboardDraftDto draft = dashboardService.getDraft(dashboardCode);
        if (filters != null && !filters.isEmpty()) {
            draft.setComponents(draft.getComponents().stream().map(component -> mergeFilters(component, filters)).toList());
        }
        return RuntimeDashboardVo.builder()
                .dashboardCode(dashboardCode)
                .versionNo(draft.getPublishedVersion())
                .dashboard(draft)
                .build();
    }

    @SuppressWarnings("unchecked")
    private ChartComponentDto mergeFilters(ChartComponentDto component, List<FilterCondition> filters) {
        ChartComponentDto copy = jsonSnapshotSupport.convert(component, ChartComponentDto.class);
        Map<String, Object> dslConfig = jsonSnapshotSupport.convert(component.getDslConfig(), Map.class);
        Map<String, Object> queryDsl = dslConfig.get("queryDsl") instanceof Map<?, ?>
                ? new java.util.LinkedHashMap<>((Map<String, Object>) dslConfig.get("queryDsl"))
                : new java.util.LinkedHashMap<>();
        List<Map<String, Object>> merged = new ArrayList<>();
        Object existingFilters = queryDsl.get("filters");
        if (existingFilters instanceof List<?> list) {
            for (Object item : list) {
                merged.add(jsonSnapshotSupport.convert(item, Map.class));
            }
        }
        for (FilterCondition filter : filters) {
            merged.add(jsonSnapshotSupport.convert(filter, Map.class));
        }
        queryDsl.put("filters", merged);
        dslConfig.put("queryDsl", queryDsl);
        copy.setDslConfig(dslConfig);
        return copy;
    }
}

