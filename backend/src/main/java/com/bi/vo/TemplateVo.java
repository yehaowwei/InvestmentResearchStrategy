package com.bi.vo;

import lombok.Builder;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
@Builder
public class TemplateVo {
    private String templateCode;
    private String templateName;
    private String rendererCode;
    private String description;
    @Builder.Default
    private Map<String, Object> capability = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Object> panelSchema = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Object> defaultDsl = new LinkedHashMap<>();
}
