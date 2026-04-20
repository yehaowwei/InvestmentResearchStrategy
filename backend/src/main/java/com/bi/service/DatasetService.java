package com.bi.service;

import com.bi.vo.DatasetVo;
import com.bi.dto.CreateDataPoolRequest;
import com.bi.dto.CreateCalculatedMetricRequest;
import com.bi.vo.SourceTableVo;

import java.util.List;

public interface DatasetService {
    List<DatasetVo> listDatasets();

    DatasetVo getDataset(String datasetCode);

    DatasetVo createDataPool(CreateDataPoolRequest request);

    DatasetVo updateDataPool(String dataPoolCode, CreateDataPoolRequest request);

    List<com.bi.vo.FieldMetaVo> previewDataPoolFields(CreateDataPoolRequest request);

    DatasetVo addCalculatedMetric(String dataPoolCode, CreateCalculatedMetricRequest request);

    void deleteDataPool(String dataPoolCode);

    List<SourceTableVo> listSourceTables();
}
