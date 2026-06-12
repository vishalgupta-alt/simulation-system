package com.drdo.simulation.model;

public class MapMetadataResponse {
    private boolean georeferenced;
    private double minLon;
    private double maxLon;
    private double minLat;
    private double maxLat;
    private int originalWidth;
    private int originalHeight;

    private String geoserverUrl;
    private String geoserverLayers;

    public MapMetadataResponse() {}

    public MapMetadataResponse(boolean georeferenced, double minLon, double maxLon, double minLat, double maxLat, int originalWidth, int originalHeight) {
        this.georeferenced = georeferenced;
        this.minLon = minLon;
        this.maxLon = maxLon;
        this.minLat = minLat;
        this.maxLat = maxLat;
        this.originalWidth = originalWidth;
        this.originalHeight = originalHeight;
    }

    public MapMetadataResponse(boolean georeferenced, double minLon, double maxLon, double minLat, double maxLat, int originalWidth, int originalHeight, String geoserverUrl, String geoserverLayers) {
        this.georeferenced = georeferenced;
        this.minLon = minLon;
        this.maxLon = maxLon;
        this.minLat = minLat;
        this.maxLat = maxLat;
        this.originalWidth = originalWidth;
        this.originalHeight = originalHeight;
        this.geoserverUrl = geoserverUrl;
        this.geoserverLayers = geoserverLayers;
    }

    public boolean isGeoreferenced() {
        return georeferenced;
    }

    public void setGeoreferenced(boolean georeferenced) {
        this.georeferenced = georeferenced;
    }

    public double getMinLon() {
        return minLon;
    }

    public void setMinLon(double minLon) {
        this.minLon = minLon;
    }

    public double getMaxLon() {
        return maxLon;
    }

    public void setMaxLon(double maxLon) {
        this.maxLon = maxLon;
    }

    public double getMinLat() {
        return minLat;
    }

    public void setMinLat(double minLat) {
        this.minLat = minLat;
    }

    public double getMaxLat() {
        return maxLat;
    }

    public void setMaxLat(double maxLat) {
        this.maxLat = maxLat;
    }

    public int getOriginalWidth() {
        return originalWidth;
    }

    public void setOriginalWidth(int originalWidth) {
        this.originalWidth = originalWidth;
    }

    public int getOriginalHeight() {
        return originalHeight;
    }

    public void setOriginalHeight(int originalHeight) {
        this.originalHeight = originalHeight;
    }

    public String getGeoserverUrl() {
        return geoserverUrl;
    }

    public void setGeoserverUrl(String geoserverUrl) {
        this.geoserverUrl = geoserverUrl;
    }

    public String getGeoserverLayers() {
        return geoserverLayers;
    }

    public void setGeoserverLayers(String geoserverLayers) {
        this.geoserverLayers = geoserverLayers;
    }
}
