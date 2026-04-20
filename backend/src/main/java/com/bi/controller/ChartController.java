package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.ChartPreviewRequest;
import com.bi.dto.QueryDsl;
import com.bi.service.ChartService;
import com.bi.vo.ChartCompatibilityVo;
import com.bi.vo.ChartPreviewVo;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chart")
public class ChartController {
    private final ChartService chartService;

    public ChartController(ChartService chartService) {
        this.chartService = chartService;
    }

    @PostMapping("/preview")
    public ApiResponse<ChartPreviewVo> preview(@RequestBody @Valid ChartPreviewRequest request) {
        return ApiResponse.ok(chartService.preview(request));
    }

    @PostMapping("/compatibility")
    public ApiResponse<ChartCompatibilityVo> compatibility(@RequestBody QueryDsl queryDsl) {
        return ApiResponse.ok(chartService.compatibility(queryDsl));
    }
}
