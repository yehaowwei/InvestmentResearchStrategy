package com.bi.vo;

import lombok.Builder;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class TkfAgentResponseVo {
    private String intent;
    private String reply;
    private String strategyName;
    private String strategyDescription;
    @Builder.Default
    private List<String> selectedChartIds = new ArrayList<>();
    @Builder.Default
    private List<TkfChartReasonVo> chartReasons = new ArrayList<>();
    private boolean fallback;
}
