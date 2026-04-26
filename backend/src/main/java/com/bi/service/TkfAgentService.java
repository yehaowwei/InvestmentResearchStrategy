package com.bi.service;

import com.bi.dto.TkfAgentRequest;
import com.bi.vo.TkfAgentResponseVo;

public interface TkfAgentService {
    TkfAgentResponseVo chat(TkfAgentRequest request);
}
