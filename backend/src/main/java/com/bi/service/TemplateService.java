package com.bi.service;

import com.bi.vo.TemplateVo;

import java.util.List;

public interface TemplateService {
    List<TemplateVo> listTemplates();

    TemplateVo getTemplate(String templateCode);
}
