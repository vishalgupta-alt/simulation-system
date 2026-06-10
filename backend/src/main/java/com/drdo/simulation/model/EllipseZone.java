package com.drdo.simulation.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "ellipse_zones")
public class EllipseZone {
    @Id
    private String id;
    private String name;
    private double centerX;
    private double centerY;
    private double radiusX;
    private double radiusY;
    private double rotation;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "ellipse_control_points", joinColumns = @JoinColumn(name = "ellipse_id"))
    private List<Waypoint> controlPoints;

    public EllipseZone() {}

    public EllipseZone(String id, String name, double centerX, double centerY, double radiusX, double radiusY, double rotation, List<Waypoint> controlPoints) {
        this.id = id;
        this.name = name;
        this.centerX = centerX;
        this.centerY = centerY;
        this.radiusX = radiusX;
        this.radiusY = radiusY;
        this.rotation = rotation;
        this.controlPoints = controlPoints;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public double getCenterX() {
        return centerX;
    }

    public void setCenterX(double centerX) {
        this.centerX = centerX;
    }

    public double getCenterY() {
        return centerY;
    }

    public void setCenterY(double centerY) {
        this.centerY = centerY;
    }

    public double getRadiusX() {
        return radiusX;
    }

    public void setRadiusX(double radiusX) {
        this.radiusX = radiusX;
    }

    public double getRadiusY() {
        return radiusY;
    }

    public void setRadiusY(double radiusY) {
        this.radiusY = radiusY;
    }

    public double getRotation() {
        return rotation;
    }

    public void setRotation(double rotation) {
        this.rotation = rotation;
    }

    public List<Waypoint> getControlPoints() {
        return controlPoints;
    }

    public void setControlPoints(List<Waypoint> controlPoints) {
        this.controlPoints = controlPoints;
    }
}
