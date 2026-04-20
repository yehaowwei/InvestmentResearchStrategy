package com.bi.service;

import com.bi.dto.ChartPreviewRequest;
import com.bi.dto.QueryDsl;
import com.bi.vo.ChartCompatibilityVo;
import com.bi.vo.ChartPreviewVo;

public interface ChartService {
    ChartPreviewVo preview(ChartPreviewRequest request);

    ChartCompatibilityVo compatibility(QueryDsl queryDsl);
}
