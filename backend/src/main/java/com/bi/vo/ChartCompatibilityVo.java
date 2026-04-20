package com.bi.vo;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ChartCompatibilityVo {
    private List<String> chartTypes;
    private String recommended;
}
