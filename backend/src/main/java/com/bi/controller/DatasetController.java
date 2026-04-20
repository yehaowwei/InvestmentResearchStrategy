package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.service.DatasetService;
import com.bi.vo.DatasetVo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/dataset")
public class DatasetController {
    private final DatasetService datasetService;

    public DatasetController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping
    public ApiResponse<List<DatasetVo>> list() {
        return ApiResponse.ok(datasetService.listDatasets());
    }

    @GetMapping("/{datasetCode}")
    public ApiResponse<DatasetVo> detail(@PathVariable("datasetCode") String datasetCode) {
        return ApiResponse.ok(datasetService.getDataset(datasetCode));
    }
}
