package com.drdo.simulation.model;

import jakarta.persistence.Embeddable;

@Embeddable
public class Waypoint {
    private double x;
    private double y;
    private String name;
    private Double latitude;
    private Double longitude;

    public Waypoint() {}

    public Waypoint(double x, double y, String name) {
        this.x = x;
        this.y = y;
        this.name = name;
    }

    public Waypoint(double x, double y, String name, Double latitude, Double longitude) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }
}

