package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.DashboardDraftDto;
import com.bi.service.DashboardService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public ApiResponse<java.util.List<DashboardDraftDto>> list() {
        return ApiResponse.ok(dashboardService.listDashboards());
    }

    @GetMapping("/{dashboardCode}")
    public ApiResponse<DashboardDraftDto> detail(@PathVariable("dashboardCode") String dashboardCode) {
        return ApiResponse.ok(dashboardService.getDraft(dashboardCode));
    }

    @DeleteMapping("/{dashboardCode}")
    public ApiResponse<Boolean> delete(@PathVariable("dashboardCode") String dashboardCode) {
        return ApiResponse.ok(dashboardService.deleteDashboard(dashboardCode));
    }
}
