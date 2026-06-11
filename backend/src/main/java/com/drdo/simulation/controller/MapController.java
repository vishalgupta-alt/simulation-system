package com.drdo.simulation.controller;

import com.drdo.simulation.model.MapMetadataResponse;
import com.drdo.simulation.service.MapMetadataService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/map")
public class MapController {

    private final MapMetadataService mapMetadataService;

    @Autowired
    public MapController(MapMetadataService mapMetadataService) {
        this.mapMetadataService = mapMetadataService;
    }

    @GetMapping("/metadata")
    public MapMetadataResponse getMapMetadata() {
        return mapMetadataService.getMetadata();
    }

    @GetMapping(value = "/image", produces = MediaType.IMAGE_JPEG_VALUE)
    public byte[] getMapImage() {
        return mapMetadataService.getCachedMapImage();
    }
}
