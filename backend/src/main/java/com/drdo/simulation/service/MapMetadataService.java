package com.drdo.simulation.service;

import com.drdo.simulation.model.MapMetadataResponse;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@Service
public class MapMetadataService {

    @org.springframework.beans.factory.annotation.Value("${geoserver.url}")
    private String geoserverUrl;

    @org.springframework.beans.factory.annotation.Value("${geoserver.layers}")
    private String geoserverLayers;

    private MapMetadataResponse metadata;
    private byte[] cachedMapImage;
    private boolean isUsingFallback = false;

    @PostConstruct
    public void init() {
        // Default to standard georeferenced bounds matching the WGS84 GeoServer layer bounds
        this.metadata = new MapMetadataResponse(
                true,    // georeferenced
                -180.0,  // minLon
                180.0,   // maxLon
                -90.0,   // minLat
                90.0,    // maxLat
                21600,   // originalWidth
                10800,   // originalHeight
                geoserverUrl,
                geoserverLayers
        );

        byte[] geoserverMap = fetchFromGeoServer();
        if (geoserverMap != null) {
            this.cachedMapImage = geoserverMap;
            this.isUsingFallback = false;
        } else {
            System.out.println("Warning: Falling back to classpath world-map.jpg image.");
            this.isUsingFallback = true;
            try {
                this.cachedMapImage = loadFallbackMap();
            } catch (Exception e) {
                System.err.println("Critical Error: Failed to load fallback map! " + e.getMessage());
            }
        }
    }

    public MapMetadataResponse getMetadata() {
        return metadata;
    }

    public byte[] getCachedMapImage() {
        if (isUsingFallback) {
            // Attempt self-healing re-fetch from GeoServer WMS
            byte[] geoserverMap = fetchFromGeoServer();
            if (geoserverMap != null) {
                this.cachedMapImage = geoserverMap;
                this.isUsingFallback = false;
                System.out.println("Self-healed: Map successfully loaded from GeoServer WMS.");
            }
        }
        return cachedMapImage;
    }

    private byte[] fetchFromGeoServer() {
        String queryUrl = this.geoserverUrl
                + "?service=WMS&version=1.1.0&request=GetMap"
                + "&layers=" + this.geoserverLayers
                + "&bbox=-180.0,-90.0,180.0,90.0"
                + "&width=4096&height=2048"
                + "&srs=EPSG:4326&styles="
                + "&format=image/jpeg";
        try {
            System.out.println("Attempting to fetch map image from GeoServer WMS: " + queryUrl);
            URL url = new URL(queryUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(8000);
            if (conn.getResponseCode() == 200) {
                try (InputStream in = conn.getInputStream();
                     ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                    return out.toByteArray();
                }
            } else {
                System.err.println("GeoServer WMS returned HTTP status: " + conn.getResponseCode());
            }
        } catch (Exception e) {
            System.err.println("Failed to fetch map image from GeoServer: " + e.getMessage());
        }
        return null;
    }

    private byte[] loadFallbackMap() throws Exception {
        try (InputStream is = getClass().getResourceAsStream("/static/world-map.jpg")) {
            if (is == null) {
                File fallbackFile = new File("src/main/resources/static/world-map.jpg");
                if (fallbackFile.exists()) {
                    try (FileInputStream fis = new FileInputStream(fallbackFile)) {
                        return fis.readAllBytes();
                    }
                }
                throw new java.io.FileNotFoundException("Fallback map image world-map.jpg not found in classpath or src folder");
            }
            return is.readAllBytes();
        }
    }
}
