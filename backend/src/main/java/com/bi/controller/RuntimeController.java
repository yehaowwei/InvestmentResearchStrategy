package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.FilterCondition;
import com.bi.service.RuntimeService;
import com.bi.vo.RuntimeDashboardVo;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/runtime")
public class RuntimeController {
    private final RuntimeService runtimeService;

    public RuntimeController(RuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    @PostMapping("/dashboard")
    public ApiResponse<RuntimeDashboardVo> load(@RequestParam("dashboardCode") String dashboardCode,
                                                @RequestParam(value = "versionNo", required = false) Integer versionNo,
                                                @RequestBody(required = false) List<FilterCondition> filters) {
        return ApiResponse.ok(runtimeService.loadPublishedDashboard(dashboardCode, versionNo, filters));
    }
}
