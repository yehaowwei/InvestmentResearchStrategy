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
    @Builder.Default
    private Map<String, Object> capability = new LinkedHashMap<>();
    @Builder.Default
    private Map<String, Object> defaultDsl = new LinkedHashMap<>();
}
