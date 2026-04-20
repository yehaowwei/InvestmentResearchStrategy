package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.DashboardDraftDto;
import com.bi.dto.PublishRequest;
import com.bi.dto.SaveDashboardRequest;
import com.bi.service.DashboardService;
import com.bi.vo.PublishResultVo;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;

@RestController
@RequestMapping("/api/design/dashboard")
public class DashboardDesignController {
    private final DashboardService dashboardService;

    public DashboardDesignController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/{dashboardCode}")
    public ApiResponse<DashboardDraftDto> draft(@PathVariable("dashboardCode") String dashboardCode) {
        return ApiResponse.ok(dashboardService.getDraft(dashboardCode));
    }

    @PostMapping("/save")
    public ApiResponse<DashboardDraftDto> save(@RequestBody @Valid SaveDashboardRequest request) {
        return ApiResponse.ok(dashboardService.saveDraft(request));
    }

    @PostMapping("/publish")
    public ApiResponse<PublishResultVo> publish(@RequestBody @Valid PublishRequest request) {
        return ApiResponse.ok(dashboardService.publish(request.getDashboardCode(), request.getPublishNote()));
    }

    @DeleteMapping("/{dashboardCode}")
    public ApiResponse<Boolean> delete(@PathVariable("dashboardCode") String dashboardCode) {
        return ApiResponse.ok(dashboardService.deleteDashboard(dashboardCode));
    }
}
