package com.bi.service;

public interface SharedStateService {
    Object getState(String stateKey);

    Object saveState(String stateKey, Object state);
}
