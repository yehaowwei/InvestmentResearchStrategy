package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.CreateCalculatedMetricRequest;
import com.bi.dto.CreateDataPoolRequest;
import com.bi.service.DatasetService;
import com.bi.vo.DatasetVo;
import com.bi.vo.FieldMetaVo;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import com.bi.vo.SourceTableVo;

@RestController
@RequestMapping("/api/data-pool")
public class DataPoolController {
    private final DatasetService datasetService;

    public DataPoolController(DatasetService datasetService) {
        this.datasetService = datasetService;
    }

    @GetMapping
    public ApiResponse<List<DatasetVo>> list() {
        return ApiResponse.ok(datasetService.listDatasets());
    }

    @GetMapping("/source-tables")
    public ApiResponse<List<SourceTableVo>> sourceTables() {
        return ApiResponse.ok(datasetService.listSourceTables());
    }

    @GetMapping("/{dataPoolCode}")
    public ApiResponse<DatasetVo> detail(@PathVariable("dataPoolCode") String dataPoolCode) {
        return ApiResponse.ok(datasetService.getDataset(dataPoolCode));
    }

    @PostMapping
    public ApiResponse<DatasetVo> create(@RequestBody @Valid CreateDataPoolRequest request) {
        return ApiResponse.ok(datasetService.createDataPool(request));
    }

    @PostMapping("/preview-fields")
    public ApiResponse<List<FieldMetaVo>> previewFields(@RequestBody CreateDataPoolRequest request) {
        return ApiResponse.ok(datasetService.previewDataPoolFields(request));
    }

    @PutMapping("/{dataPoolCode}")
    public ApiResponse<DatasetVo> update(@PathVariable("dataPoolCode") String dataPoolCode,
                                         @RequestBody @Valid CreateDataPoolRequest request) {
        return ApiResponse.ok(datasetService.updateDataPool(dataPoolCode, request));
    }

    @DeleteMapping("/{dataPoolCode}")
    public ApiResponse<Boolean> delete(@PathVariable("dataPoolCode") String dataPoolCode) {
        datasetService.deleteDataPool(dataPoolCode);
        return ApiResponse.ok(true);
    }

    @PostMapping("/{dataPoolCode}/calculated-metrics")
    public ApiResponse<DatasetVo> addCalculatedMetric(@PathVariable("dataPoolCode") String dataPoolCode,
                                                      @RequestBody @Valid CreateCalculatedMetricRequest request) {
        return ApiResponse.ok(datasetService.addCalculatedMetric(dataPoolCode, request));
    }
}
