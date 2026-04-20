package com.bi.vo;

import com.bi.dto.DashboardDraftDto;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RuntimeDashboardVo {
    private String dashboardCode;
    private Integer versionNo;
    private DashboardDraftDto dashboard;
}
