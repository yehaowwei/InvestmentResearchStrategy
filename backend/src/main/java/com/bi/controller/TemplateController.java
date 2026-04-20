package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.service.TemplateService;
import com.bi.vo.TemplateVo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/template")
public class TemplateController {
    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public ApiResponse<List<TemplateVo>> list() {
        return ApiResponse.ok(templateService.listTemplates());
    }

    @GetMapping("/{templateCode}")
    public ApiResponse<TemplateVo> detail(@PathVariable("templateCode") String templateCode) {
        return ApiResponse.ok(templateService.getTemplate(templateCode));
    }
}
